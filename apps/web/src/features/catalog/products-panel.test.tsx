// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// US6/T030 — the Produtos tab panel. Create/edit are FULL PAGE routes (ux §1.6b), so the panel
// navigates instead of opening the Sheet; delete keeps the confirm Dialog. The row summary shows
// the reference names ("filamento · impressora") — NEVER a stored price (FR-310: a row price
// would imply a snapshot; prices recompute on open).

const { navigateMock, useProductsMock, useFilamentsMock, usePrintersMock, entitlementStatus } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    useProductsMock: vi.fn(),
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
    entitlementStatus: { current: "active" as "active" | "lapsed" | "none" },
  }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return {
    ...actual,
    useProducts: () => useProductsMock(),
    useFilaments: () => useFilamentsMock(),
    usePrinters: () => usePrintersMock(),
    useDeleteProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
// F-lapsed: the panel now reads its own lapsed state (mutable so a test can flip it).
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({ data: { status: entitlementStatus.current }, isLoading: false }),
}));

import { ProductsPanel } from "./products-panel";

const catalogo = messages.catalogo;

function listState(items: unknown[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

const product = {
  id: "prod-1",
  name: "Vaso G",
  filamentId: "f-1",
  printerId: "p-1",
  filamentValues: { material: "PLA", costPerRoll: "110.00", rollWeightKg: "1.000" },
  printerValues: {
    machineValue: "1200.00",
    machineLifetimeHours: "2000.000",
    avgPowerKw: "0.1200",
    maintenanceReservePerHour: "0.500000",
  },
  pieceInputs: {
    printGrams: "100.000",
    printTimeHours: "5.000",
    failurePct: "0.000",
    finishTimeHours: "0.000",
    finishRatePerHour: "0.000000",
    laborHours: "0.000",
    laborRatePerHour: "0.000000",
    markupVarejoPct: "50.000",
    markupAtacadoPct: "30.000",
  },
  tariffPerKwh: "1.000000",
  includeMarketplace: true,
  channels: [],
  otherCosts: [],
  createdAt: "2026-07-10T00:00:00Z",
  updatedAt: "2026-07-10T00:00:00Z",
};

beforeEach(() => {
  useProductsMock.mockReturnValue(listState([]));
  useFilamentsMock.mockReturnValue(
    listState([{ id: "f-1", name: "PLA Azul", costPerRoll: "110.00", rollWeightKg: "1.000" }]),
  );
  usePrintersMock.mockReturnValue(listState([{ id: "p-1", name: "Ender 3" }]));
  entitlementStatus.current = "active";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductsPanel — Produtos tab (US6/T030)", () => {
  it("empty state offers the add action, which navigates to the full-page create route", () => {
    render(<ProductsPanel />);

    expect(screen.getByText(catalogo.emptyProductsTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: catalogo.addProduct }));
    // 013/F-02: the create form is a search param on /catalogo now, not a 2-segment route.
    expect(navigateMock).toHaveBeenCalledWith({ to: "/catalogo", search: { produto: "novo" } });
  });

  it("lists products with the REFERENCE names as summary — never a price", () => {
    useProductsMock.mockReturnValue(listState([product]));
    render(<ProductsPanel />);

    expect(screen.getByText("Vaso G")).toBeInTheDocument();
    expect(screen.getByText("PLA Azul · Ender 3")).toBeInTheDocument();
    expect(screen.getByText(catalogo.countProducts.replace("{n}", "1"))).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("labels a degraded reference as manual in the summary", () => {
    useProductsMock.mockReturnValue(listState([{ ...product, filamentId: null }]));
    render(<ProductsPanel />);

    expect(screen.getByText(`${catalogo.manualRef} · Ender 3`)).toBeInTheDocument();
  });

  it("FB-04: shows a neutral loading placeholder while references are still loading — never 'manual'", () => {
    useProductsMock.mockReturnValue(listState([product]));
    useFilamentsMock.mockReturnValue({
      items: [],
      isLoading: true,
      isError: false,
      error: null,
      stale: false,
      refetch: vi.fn(),
    });
    usePrintersMock.mockReturnValue({
      items: [],
      isLoading: true,
      isError: false,
      error: null,
      stale: false,
      refetch: vi.fn(),
    });
    render(<ProductsPanel />);

    expect(
      screen.getByText(`${catalogo.resolvingRef} · ${catalogo.resolvingRef}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${catalogo.manualRef} · ${catalogo.manualRef}`),
    ).not.toBeInTheDocument();
  });

  it("row tap navigates to the full-page edit route", () => {
    useProductsMock.mockReturnValue(listState([product]));
    render(<ProductsPanel />);

    fireEvent.click(screen.getByText("Vaso G"));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/catalogo",
      search: { produto: "prod-1" },
    });
  });

  // F-lapsed (confirmation audit) — the Produtos tab must honor the lapsed state like its siblings.
  it("active: shows the products (no lapsed banner)", () => {
    useProductsMock.mockReturnValue(listState([product]));
    render(<ProductsPanel />);
    expect(screen.getByText("Vaso G")).toBeInTheDocument();
    expect(screen.queryByText(catalogo.lapsedTitle)).not.toBeInTheDocument();
  });

  it("lapsed: shows the 'Premium pausado' banner and tapping delete opens the reactivation intercept, NOT a working confirm", () => {
    entitlementStatus.current = "lapsed";
    useProductsMock.mockReturnValue(listState([product]));
    render(<ProductsPanel />);

    // Reads survive: the product is still listed with the calm banner (FR-409 + ux-catalog §3).
    expect(screen.getByText("Vaso G")).toBeInTheDocument();
    expect(screen.getByText(catalogo.lapsedTitle)).toBeInTheDocument();

    // Tapping delete must reach the honest reactivation surface — for products (navigation mode)
    // the row/delete affordance leads to the read-only page, NEVER the working destructive confirm.
    fireEvent.click(screen.getByRole("button", { name: `${catalogo.remove} Vaso G` }));
    expect(screen.queryByText(messages.catalogForm.deleteBody)).not.toBeInTheDocument();
  });
});
