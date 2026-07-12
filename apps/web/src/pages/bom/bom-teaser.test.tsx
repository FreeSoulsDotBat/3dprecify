// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T007 — the honest kit teaser (US5, ux §2): free/lapsed/signed-out at /kits meet an honest
// Premium panel — NO fake success, NO price, NO date, NO pre-E6 purchase CTA (FR-410/SC-408).
// Signed-out adds Entrar → /sign-in?redirect=/kits. The E2 teaser lineage, Kit copy (K1).

const { useEntitlementMock, useProductsMock, navigateMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useProductsMock: vi.fn(),
  navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock, useSearch: () => ({}) };
});
vi.mock("@/entities/bom/use-bom", () => ({
  useBoms: () => ({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  }),
  useCreateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
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

  it("a LAPSED account is NOT teased — its saved kits stay reachable (FR-409, the Q3 freeze)", () => {
    // PR-A parked this: nothing was saveable then, so lapsed fell through to the teaser. Now that
    // kits persist they are the seller's own data — a lapse freezes WRITES, it does not repossess
    // the work. So a lapsed account reaches the composer, can reopen and recompute, and is told
    // plainly that only saving needs an active Premium (the save call itself denies server-side).
    renderAt("authenticated", "lapsed");
    expect(screen.queryByText(t.teaserTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
  });
});

describe("BOM teaser — signed-out (US5, ux §2.2)", () => {
  it("shows the account+premium honesty line and the Entrar path", () => {
    renderAt("anonymous");
    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.getByText(t.teaserSignedOutBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.teaserSignIn })).toBeInTheDocument();
  });

  it("Entrar carries the return-to-intent to /kits (K1 route)", () => {
    renderAt("anonymous");
    fireEvent.click(screen.getByRole("button", { name: t.teaserSignIn }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { redirect: "/kits" },
    });
  });
});
