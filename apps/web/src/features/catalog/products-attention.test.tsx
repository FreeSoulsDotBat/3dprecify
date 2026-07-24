// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// 008/T015d (K3) — the attention indicator on the Produtos LIST, written FAILING-first. A product
// a kit save materialized arrives with no filament/printer references; so does one whose
// references a deletion severed. Both are the same honest state and both must SAY so in the list,
// calmly and identically — a manual product that looked normal would quietly price off values
// nobody is maintaining.

const { useProductsMock, useFilamentsMock, usePrintersMock } = vi.hoisted(() => ({
  useProductsMock: vi.fn(),
  useFilamentsMock: vi.fn(),
  usePrintersMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn() };
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
// F-lapsed: ProductsPanel now reads its own entitlement; this suite is about the K3 attention
// indicator, so the plan is simply "active" (no QueryClientProvider needed for the real hook).
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({ data: { status: "active" }, isLoading: false }),
}));

import { ProductsPanel } from "./products-panel";

const catalogo = messages.catalogo;

function product(over: Partial<ProductOut> = {}): ProductOut {
  return {
    id: "p1",
    name: "Vaso G",
    filamentId: "f1",
    printerId: "pr1",
    filamentValues: { material: "PLA", costPerRoll: "100.00", rollWeightKg: "1.000" },
    printerValues: {
      machineValue: "4000.00",
      machineLifetimeHours: "2000",
      avgPowerKw: "0.100",
      maintenanceReservePerHour: "0",
    },
    pieceInputs: {
      printGrams: "100",
      wasteGrams: "0",
      printTimeHours: "5",
      failurePct: "0",
      finishTimeHours: "0",
      finishRatePerHour: "0",
      laborHours: "0",
      laborRatePerHour: "0",
      markupVarejoPct: "50",
      markupAtacadoPct: "30",
    },
    tariffPerKwh: "1.00",
    includeMarketplace: true,
    channels: [],
    otherCosts: [],
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    ...over,
  } as ProductOut;
}

function listState<T>(items: T[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

beforeEach(() => {
  useFilamentsMock.mockReturnValue(listState([{ id: "f1", name: "PLA Azul" }]));
  usePrintersMock.mockReturnValue(listState([{ id: "pr1", name: "Ender 3" }]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Produtos list — the K3 attention indicator", () => {
  it("flags a product materialized by a kit save (no references yet)", () => {
    useProductsMock.mockReturnValue(
      listState([product({ id: "m1", name: "Suporte L", filamentId: null, printerId: null })]),
    );
    render(<ProductsPanel />);

    expect(screen.getByText(catalogo.needsAttention)).toBeInTheDocument();
  });

  it("flags a product degraded by a deletion with the SAME words — one state, one remedy", () => {
    useProductsMock.mockReturnValue(listState([product({ filamentId: null })]));
    render(<ProductsPanel />);

    expect(screen.getByText(catalogo.needsAttention)).toBeInTheDocument();
  });

  it("stays quiet on a fully linked product (SC-412)", () => {
    useProductsMock.mockReturnValue(listState([product()]));
    render(<ProductsPanel />);

    expect(screen.queryByText(catalogo.needsAttention)).not.toBeInTheDocument();
    expect(screen.getByText(/PLA Azul/)).toBeInTheDocument();
  });
});
