// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T007 — the honest BOM teaser (US5, ux §2): free/lapsed/signed-out at /bom meet an honest
// Premium panel — NO fake success, NO price, NO date, NO pre-E6 purchase CTA (FR-410/SC-408).
// Signed-out adds Entrar → /sign-in?redirect=/bom. The E2 teaser lineage, BOM copy.

const { useEntitlementMock, useProductsMock, navigateMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useProductsMock: vi.fn(),
  navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return { ...actual, useProducts: () => useProductsMock() };
});

import { BomPage } from "./bom-page";

const t = messages.bom;

function renderAt(status: "authenticated" | "anonymous", plan?: "none" | "lapsed") {
  useSessionStore.setState({ status });
  useEntitlementMock.mockReturnValue({
    data: plan ? { status: plan } : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useProductsMock.mockReturnValue({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BomPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("BOM teaser — free account (US5, SC-408)", () => {
  it("shows the honest panel: value copy, the free-calculator promise, NO composer", () => {
    renderAt("authenticated", "none");
    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.getByText(t.teaserDialogBody)).toBeInTheDocument();
    expect(screen.getByText(t.teaserFreeNote)).toBeInTheDocument();
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(t.addLine) })).not.toBeInTheDocument();
  });

  it("carries NO price, NO date, NO purchase CTA (FR-410 — billing is E6)", () => {
    renderAt("authenticated", "none");
    expect(screen.queryByText(/R\$\s?\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/assinar|comprar|contratar/i)).not.toBeInTheDocument();
    // Signed-in free: the only action is the dismiss — no Entrar (already signed in).
    expect(screen.getByRole("button", { name: t.teaserDismiss })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.teaserSignIn })).not.toBeInTheDocument();
  });

  it("the dismiss routes back to the free calculator (honest exit, FR-411)", () => {
    renderAt("authenticated", "none");
    fireEvent.click(screen.getByRole("button", { name: t.teaserDismiss }));
    expect(navigateMock).toHaveBeenCalledWith({ to: "/calcular" });
  });

  it("a LAPSED account (PR-A: no saved BOMs exist yet) also meets the teaser, calmly", () => {
    renderAt("authenticated", "lapsed");
    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
  });
});

describe("BOM teaser — signed-out (US5, ux §2.2)", () => {
  it("shows the account+premium honesty line and the Entrar path", () => {
    renderAt("anonymous");
    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.getByText(t.teaserSignedOutBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.teaserSignIn })).toBeInTheDocument();
  });

  it("Entrar carries the return-to-intent to /bom", () => {
    renderAt("anonymous");
    fireEvent.click(screen.getByRole("button", { name: t.teaserSignIn }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { redirect: "/bom" },
    });
  });
});
