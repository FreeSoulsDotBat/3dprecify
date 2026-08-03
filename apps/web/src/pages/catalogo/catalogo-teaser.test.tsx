// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US7/T031 — the honest free-tier teaser on the Catálogo tab (ux §2). The affordance is VISIBLE
// (hiding it would lie about the product); tapping opens an honest panel: no price, no date, no
// "assinar agora" (billing is E6), nothing persists, no fake success. Signed-out adds the
// honest extra step (enter + Premium) and an Entrar path to /sign-in.

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
}));

import { CatalogoPage } from "./catalogo-page";

const catalogo = messages.catalogo;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("Catálogo tab — FREE signed-in teaser (US7 scenario 2)", () => {
  beforeEach(() => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "none" }, isLoading: false });
  });

  it("explains the premium value honestly — never a broken CRUD screen", () => {
    render(<CatalogoPage />);

    expect(screen.getByText(catalogo.teaserTitle)).toBeInTheDocument();
    expect(screen.getByText(catalogo.teaserBody)).toBeInTheDocument();
    // The quiet honest line (reuses the server's own deny copy).
    expect(screen.getByText(messages.apiError.entitlementRequired)).toBeInTheDocument();
    // NO CRUD surface: no tablist, no premium empty-state.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("the VISIBLE affordance opens the honest teaser panel — no price, no date, no purchase CTA", () => {
    render(<CatalogoPage />);

    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(catalogo.teaserDialogTitle);
    expect(dialog).toHaveTextContent(catalogo.teaserFreeNote); // "continuam grátis" reaffirmed
    // E6/US7 — a proibição de PREÇO caiu com a premissa dela ("billing is E6", e o E6 chegou). O
    // que sobra é a honestidade do preço: só os três números praticados, sem urgência e sem "de/por".
    const texto = dialog.textContent ?? "";
    for (const n of texto.match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
    expect(texto).not.toMatch(/\b(últimas|só hoje|última chance|aproveite)\b/i);
    expect(texto).not.toMatch(/191,88/);
    expect(dialog.textContent).not.toMatch(/\d{2}\/\d{2}|\bem breve\b/i); // no date promise
    // O CTA de compra agora EXISTE e leva à oferta — não a um checkout com um período que ninguém
    // escolheu. O que continua proibido é a compra fingida: nada aqui pode virar premium sozinho.
    expect(dialog.querySelector('a[href*="/conta?assinar=1"], a[href*="/sign-in"]')).not.toBeNull();
  });

  it("dismissing the teaser persists NOTHING and fakes NO success", () => {
    render(<CatalogoPage />);
    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));
    fireEvent.click(screen.getByRole("button", { name: catalogo.teaserDismiss }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(idleMutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText(messages.catalogForm.savedFilament)).not.toBeInTheDocument();
  });
});

describe("Catálogo tab — SIGNED-OUT teaser (US7 / ux §2.2)", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("shows the same honest layout with the enter+premium step and an Entrar path", () => {
    render(<CatalogoPage />);

    expect(screen.getByText(catalogo.teaserTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(catalogo.teaserSignedOutBody);
    fireEvent.click(screen.getByRole("button", { name: catalogo.teaserSignIn }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { redirect: "/catalogo" },
    });
  });
});

describe("Catálogo tab — premium keeps the real CRUD surface", () => {
  it("active entitlement renders the tabs, not the teaser", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
    render(<CatalogoPage />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.queryByText(catalogo.teaserTitle)).not.toBeInTheDocument();
  });
});
