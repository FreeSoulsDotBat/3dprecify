// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// The catalog panels mount the entities hooks (real useQuery). Mock the whole cache module so the
// page test stays about the IA (segmented tabs, G1) — an empty list is enough to render the panels.
// `filamentsItems`/`entitlement` are mutable (vi.hoisted) so a single test can flip the plan status
// and seed a non-empty filament list (013/FB-02 — the lapsed variant must keep reading everything).
const { filamentsItems, entitlement } = vi.hoisted(() => ({
  filamentsItems: [] as unknown[],
  entitlement: { data: { status: "active" } as { status: string } },
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
  useFilaments: () => ({ ...emptyList, items: filamentsItems }),
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
// The Produtos panel navigates to its full-page create/edit routes (ux §1.6b).
// 013/F-02 follow-up: `search` is mutable so a test can assert the tab is DERIVED from the URL.
const { search, navigateMock } = vi.hoisted(() => ({
  search: { current: {} as { tab?: string; produto?: string } },
  navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock, useSearch: () => search.current };
});
// US7: the page teasers on a POSITIVELY known non-premium state — these IA tests exercise the
// premium surface, so the session is authenticated + the entitlement answers "active" by default.
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({ ...entitlement, isLoading: false }),
}));

import { useSessionStore } from "@/shared/session/session-store";

import { CatalogoPage } from "./catalogo-page";

beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u-1", email: "u@x.dev" } as never,
  });
  entitlement.data = { status: "active" };
  filamentsItems.length = 0;
  search.current = {};
  navigateMock.mockClear();
});
afterEach(() => {
  cleanup();
  useSessionStore.setState({ status: "anonymous", user: null });
});
const catalogo = messages.catalogo;
const pt = messages.premiumTeaser.CATALOG;

// 013/F-02 follow-up — REGRESSION GUARD. The tab used to live in `useState`, re-derived only on
// MOUNT. That was invisible while the product form was its own route (`/catalogo/produtos/*`):
// opening it left this route, so returning always remounted. Once the form became `?produto=` on
// THIS route the component stopped unmounting, and the tab froze — `?tab=` no longer selected
// anything, so a tab deep link silently rendered whatever was in stale state. The e2e caught it as
// a filament-row click that opened a product instead. These pin the URL as the source of truth.
describe("CatalogoPage — the tab is derived from the URL (013/F-02)", () => {
  // `kits` is deliberately absent: KitsPanel needs a QueryClientProvider this suite does not set up,
  // and the derivation under test is identical for every id (it is one `TABS.some` lookup).
  it.each([
    ["printers", () => catalogo.tabPrinters],
    ["products", () => catalogo.tabProducts],
  ])("?tab=%s selects that tab on a cold render", (tab, label) => {
    search.current = { tab };
    render(<CatalogoPage />);
    expect(screen.getByRole("tab", { name: label() })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: catalogo.tabFilaments })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("an unknown ?tab= falls back to Filamentos instead of rendering nothing", () => {
    search.current = { tab: "lixo" };
    render(<CatalogoPage />);
    expect(screen.getByRole("tab", { name: catalogo.tabFilaments })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clicking a tab writes it to the URL (replace) so it survives reload/bookmark", () => {
    render(<CatalogoPage />);
    fireEvent.click(screen.getByRole("tab", { name: catalogo.tabPrinters }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/catalogo",
      search: { tab: "printers" },
      replace: true,
    });
  });
});

describe("CatalogoPage — segmented tabs IA (G1) + premium filament panel", () => {
  it("exposes a tablist with the three catalog domains, Filamentos selected by default", () => {
    render(<CatalogoPage />);
    expect(screen.getByRole("tablist", { name: catalogo.tabsLabel })).toBeInTheDocument();
    const filaments = screen.getByRole("tab", { name: catalogo.tabFilaments });
    expect(filaments).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: catalogo.tabPrinters })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: catalogo.tabProducts })).toBeInTheDocument();
    // The default panel is the Filamentos premium surface (empty state here).
    expect(screen.getByText(catalogo.emptyFilamentsTitle)).toBeInTheDocument();
  });

  it("switches to the REAL Produtos panel when its tab is selected (US6/T030)", () => {
    // 013/F-02: selecting a tab is now a URL change, so the selected tab arrives as `?tab=`.
    search.current = { tab: "products" };
    render(<CatalogoPage />);

    expect(screen.getByRole("tab", { name: catalogo.tabProducts })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(catalogo.emptyProductsTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: catalogo.addProduct })).toBeInTheDocument();
    expect(screen.queryByText(catalogo.emptyFilamentsTitle)).not.toBeInTheDocument();
  });

  it("moves selection with the arrow keys (roving tabindex, tablist a11y)", () => {
    render(<CatalogoPage />);
    const filaments = screen.getByRole("tab", { name: catalogo.tabFilaments });
    fireEvent.keyDown(filaments, { key: "ArrowRight" });

    // The a11y contract is unchanged (ArrowRight moves to the next tab); what changed is WHERE that
    // selection is recorded — the URL, not component state. The keyboard path must go through the
    // same navigation as the click path, or arrow-key selection would not survive a reload.
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/catalogo",
      search: { tab: "printers" },
      replace: true,
    });
  });

  it("mounts the Impressoras premium panel on the printers tab (T022)", () => {
    search.current = { tab: "printers" };
    render(<CatalogoPage />);

    expect(screen.getByText(catalogo.emptyPrintersTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: catalogo.addPrinter })).toBeInTheDocument();
    expect(screen.queryByText(catalogo.emptyFilamentsTitle)).not.toBeInTheDocument();
  });
});

describe("CatalogoPage — lapsed premium variant (013/FB-02, ux-catalog §3)", () => {
  it("shows the calm 'Premium pausado' banner AND the COMPLETE filament list — reads never gate on lapsed", () => {
    entitlement.data = { status: "lapsed" };
    filamentsItems.push({
      id: "f1",
      name: "PLA Azul",
      material: "PLA",
      costPerRoll: "110.00",
      rollWeightKg: "1",
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
    });
    render(<CatalogoPage />);

    expect(screen.getByText(catalogo.lapsedTitle)).toBeInTheDocument();
    expect(screen.getByText(catalogo.lapsedBody)).toBeInTheDocument();
    // The full item still renders — a lapse freezes writes, never reads (FR-409).
    expect(screen.getByText("PLA Azul")).toBeInTheDocument();
    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
  });

  it("'none' (never subscribed) still sees the honest teaser, NOT the lapsed banner — different states, different copy", () => {
    entitlement.data = { status: "none" };
    render(<CatalogoPage />);

    expect(screen.getByText(pt.title)).toBeInTheDocument();
    expect(screen.queryByText(catalogo.lapsedTitle)).not.toBeInTheDocument();
  });
});
