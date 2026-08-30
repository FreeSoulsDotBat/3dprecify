// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 019/PR-B (T105) — a parede US7 saiu (016/US1 tinha unificado as QUATRO em UM `PremiumTeaser`;
// agora nem essa sobrevive no Catálogo). Grátis e deslogado veem a MESMA IA de quem paga — o
// tablist inteiro — com o vazio didático no lugar de cada lista, nunca uma tela substituta. Este
// arquivo testava exatamente o oposto (ausência de tablist, ausência de "Adicionar filamento") —
// reescrito para as novas invariantes: tablist sempre presente, vazio didático + UM convite.

const { navigateMock, useEntitlementMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useEntitlementMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock, useSearch: () => ({}) };
});
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));
const emptyList = {
  items: [],
  isLoading: false,
  isError: false,
  error: null,
  stale: false,
  refetch: vi.fn(),
};
const idleMutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock("@/entities/catalog/use-catalog", () => ({
  useFilaments: () => emptyList,
  usePrinters: () => emptyList,
  useProducts: () => emptyList,
  useCreateFilament: () => idleMutation,
  useUpdateFilament: () => idleMutation,
  useDeleteFilament: () => idleMutation,
  useCreatePrinter: () => idleMutation,
  useUpdatePrinter: () => idleMutation,
  useDeletePrinter: () => idleMutation,
  useDeleteProduct: () => idleMutation,
  useCreateProduct: () => idleMutation,
  useUpdateProduct: () => idleMutation,
  useFixProductPrice: () => idleMutation,
}));
// 019/PR-D (T124) — a page recomputa/observa preços; esta suíte é sobre o teaser, não sobre isso.
vi.mock("@/entities/catalog/price-observations", () => ({
  usePriceObservations: () => ({
    byKey: new Map(),
    isLoading: false,
    isError: false,
    error: null,
    entitlementDenied: false,
  }),
  useObservePrices: () => ({ observe: vi.fn() }),
  derivePriceChanges: () => ({ changed: [], count: 0 }),
  observationKey: (kind: string, id: string) => `${kind}:${id}`,
}));
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return {
    ...actual,
    useFeeCatalog: () => ({
      catalog: { catalogVersion: "test-0", schemaVersion: "1", generatedAt: "", marketplaces: [] },
      source: "seed" as const,
      refreshFailed: false,
      refreshing: false,
      refetch: vi.fn(),
    }),
  };
});

import { CatalogoPage } from "./catalogo-page";

const tb = messages.billing;
const catalogo = messages.catalogo;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("Catálogo tab — FREE signed-in: a MESMA IA, com o vazio didático (019/PR-B T105)", () => {
  beforeEach(() => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "none" }, isLoading: false });
  });

  it("mostra o tablist inteiro — nunca uma tela substituta", () => {
    render(<CatalogoPage />);
    expect(screen.getByRole("tablist", { name: catalogo.tabsLabel })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o vazio didático explica a feature — mesmo título/frase de quem paga, verbatim (T042)", () => {
    render(<CatalogoPage />);
    const vazio = screen.getByTestId("vazio-didatico");
    expect(vazio).toHaveTextContent(catalogo.emptyFilamentsTitle);
    expect(vazio).toHaveTextContent(catalogo.didaticoFilamentsBody);
  });

  it("exatamente UM convite 'Assinar Premium', levando à oferta direto — sem preço-de-checkout, sem data", () => {
    render(<CatalogoPage />);
    const links = screen.getAllByRole("link", { name: tb.subscribeAction });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/conta?assinar=1");

    // E6/US7 — só os três preços praticados, nunca uma urgência/desconto fabricado.
    const texto = document.body.textContent ?? "";
    for (const n of texto.match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
    expect(texto).not.toMatch(/\b(últimas|só hoje|última chance|aproveite)\b/i);
    expect(texto).not.toMatch(/191,88/);
    expect(texto).not.toMatch(/\d{2}\/\d{2}|\bem breve\b/i); // no date promise
  });

  it("nothing persists and no success is faked (there is nothing to dismiss)", () => {
    render(<CatalogoPage />);
    expect(idleMutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText(messages.catalogForm.savedFilament)).not.toBeInTheDocument();
  });
});

describe("Catálogo tab — SIGNED-OUT: a MESMA IA, o convite passa pelo sign-in (019/PR-B T105)", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("mostra o mesmo tablist + vazio didático, e o convite carrega a intenção de voltar", () => {
    render(<CatalogoPage />);
    expect(screen.getByRole("tablist", { name: catalogo.tabsLabel })).toBeInTheDocument();
    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");
  });
});

describe("Catálogo tab — premium ativo: tabs SEM vazio didático (regression guard)", () => {
  it("active entitlement renders the tabs, never the vazio didático/convite", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
    render(<CatalogoPage />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.queryByTestId("vazio-didatico")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: tb.subscribeAction })).not.toBeInTheDocument();
  });
});
