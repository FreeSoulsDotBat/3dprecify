// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// The catalog panels mount the entities hooks (real useQuery). Mock the whole cache module so the
// page test stays about the IA (segmented tabs, G1) — an empty list is enough to render the panels.
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
// The Produtos panel navigates to its full-page create/edit routes (ux §1.6b).
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn() };
});
// US7: the page teasers on a POSITIVELY known non-premium state — these IA tests exercise the
// premium surface, so the session is authenticated + the entitlement answers "active".
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({ data: { status: "active" }, isLoading: false }),
}));

import { useSessionStore } from "@/shared/session/session-store";

import { CatalogoPage } from "./catalogo-page";

beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u-1", email: "u@x.dev" } as never,
  });
});
afterEach(() => {
  cleanup();
  useSessionStore.setState({ status: "anonymous", user: null });
});
const catalogo = messages.catalogo;

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
    render(<CatalogoPage />);
    fireEvent.click(screen.getByRole("tab", { name: catalogo.tabProducts }));

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

    expect(screen.getByRole("tab", { name: catalogo.tabPrinters })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("mounts the Impressoras premium panel on the printers tab (T022)", () => {
    render(<CatalogoPage />);
    fireEvent.click(screen.getByRole("tab", { name: catalogo.tabPrinters }));

    expect(screen.getByText(catalogo.emptyPrintersTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: catalogo.addPrinter })).toBeInTheDocument();
    expect(screen.queryByText(catalogo.emptyFilamentsTitle)).not.toBeInTheDocument();
  });
});
