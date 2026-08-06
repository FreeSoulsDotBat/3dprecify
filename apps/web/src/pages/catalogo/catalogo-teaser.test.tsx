// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US7/T031 — the honest free-tier teaser on the Catálogo tab (ux §2). 016/US1 (T006): rewritten
// for the unified `PremiumTeaser` (feature=CATALOG) — no dialog, no "+ Adicionar filamento"
// affordance on the free surface (US1-AC2), the panel is visible directly.

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

const tb = messages.billing;
const pt = messages.premiumTeaser.CATALOG;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("Catálogo tab — FREE signed-in teaser (US7 scenario 2, rewritten 016/US1)", () => {
  beforeEach(() => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "none" }, isLoading: false });
  });

  it("explains the premium value honestly, directly — never a broken CRUD screen, never a dialog", () => {
    render(<CatalogoPage />);

    expect(screen.getByText(pt.title)).toBeInTheDocument();
    expect(screen.getByText(pt.subtitle)).toBeInTheDocument();
    expect(screen.getByText(pt.caption)).toBeInTheDocument();
    // NO CRUD surface, NO dialog, NO "+ Adicionar filamento" affordance (US1-AC2).
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adicionar filamento/i })).not.toBeInTheDocument();
  });

  it("the CTA leads to the offer directly — no price, no date, no fake purchase", () => {
    render(<CatalogoPage />);

    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta).toHaveAttribute("href", "/conta?assinar=1");
    // E6/US7 — a proibição de PREÇO caiu com a premissa dela ("billing is E6", e o E6 chegou). O
    // que sobra é a honestidade do preço: só os três números praticados, sem urgência/"de-por".
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

describe("Catálogo tab — SIGNED-OUT teaser (US7 / ux §2.2, rewritten 016/US1)", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("shows the same honest layout, and the CTA's own href carries the sign-in + redirect intent", () => {
    render(<CatalogoPage />);

    expect(screen.getByText(pt.title)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");
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
    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
  });
});
