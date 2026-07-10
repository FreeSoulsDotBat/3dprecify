// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US6/T030 — the product full-page route (ux §1.6b): the calculator layout + a name + the two
// catalog pickers. NO stored price is ever shown — the page recomputes live via the EXISTING
// `computeFromForm` at the current PRICING_MODEL_VERSION (FR-310/FR-313); the SC-305 anchor
// numbers (seed R$ 30,90 / picked catalog R$ 26,48) must hold here exactly as in Calcular.
// Reopening a DEGRADED product (deleted reference) shows the calm info alert and the last-known
// values as ordinary editable fields (US6-4) — never blank, never broken.

const { navigateMock, useProductsMock, useFilamentsMock, usePrintersMock, createMock, updateMock } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    useProductsMock: vi.fn(),
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
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
    useCreateProduct: () => ({ mutateAsync: createMock, isPending: false }),
    useUpdateProduct: () => ({ mutateAsync: updateMock, isPending: false }),
  };
});

import { ProdutoPage } from "./produto-page";

const t = messages.calculator;
const pf = messages.productForm;

const filament = {
  id: "f-1",
  name: "PLA Azul",
  material: "PLA",
  costPerRoll: "110.00",
  rollWeightKg: "1.000",
  defaultWasteGrams: "5.000",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};
const printer = {
  id: "p-1",
  name: "Ender 3",
  machineValue: "1200.00",
  machineLifetimeHours: "2000.000",
  avgPowerKw: "0.1200",
  maintenanceReservePerHour: "0.500000",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};
const savedProduct = {
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
    wasteGrams: "5.000",
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
  includeMarketplace: false,
  channels: [],
  otherCosts: [],
  createdAt: "2026-07-10T00:00:00Z",
  updatedAt: "2026-07-10T00:00:00Z",
};

function listState(items: unknown[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPage(productId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProdutoPage productId={productId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u-1", email: "u@x.dev" } as never,
  });
  useProductsMock.mockReturnValue(listState([savedProduct]));
  useFilamentsMock.mockReturnValue(listState([filament]));
  usePrintersMock.mockReturnValue(listState([printer]));
  createMock.mockResolvedValue(savedProduct);
  updateMock.mockResolvedValue(savedProduct);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("ProdutoPage — create (US6/T030)", () => {
  it("renders name + pickers + the calculator sections, recomputing live (seed R$ 30,90)", () => {
    renderPage();

    expect(screen.getByRole("textbox", { name: pf.nameLabel })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: t.catalogPicker.filament })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: t.catalogPicker.printer })).toBeInTheDocument();
    // Live recompute of the untouched defaults — same seed number as Calcular (FR-310).
    expect(screen.getAllByText("R$ 30,90").length).toBeGreaterThan(0);
  });

  it("picking the saved refs pre-fills editable fields and recomputes the SC-305 number", () => {
    renderPage();

    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
      target: { value: "f-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
      target: { value: "p-1" },
    });

    expect(screen.getByDisplayValue("110,00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1200,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 26,48").length).toBeGreaterThan(0);
  });

  it("saves through the wire mapping and navigates back to the catalog", async () => {
    renderPage();

    fireEvent.change(screen.getByRole("textbox", { name: pf.nameLabel }), {
      target: { value: "Vaso G" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
      target: { value: "f-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
      target: { value: "p-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const body = createMock.mock.calls[0][0];
    expect(body).toMatchObject({ name: "Vaso G", filamentId: "f-1", printerId: "p-1" });
    expect(body.pieceInputs.markupVarejoPct).toBe("50");
    expect(navigateMock).toHaveBeenCalledWith({ to: "/catalogo" });
  });

  it("without a saved filament AND printer, explains honestly why a product cannot be created", () => {
    useFilamentsMock.mockReturnValue(listState([]));
    renderPage();

    expect(screen.getByText(pf.needRefs)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pf.saveProduct })).not.toBeInTheDocument();
  });

  it("a required name is enforced before any write", async () => {
    renderPage();
    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
      target: { value: "f-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
      target: { value: "p-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

    await waitFor(() => expect(screen.getByText(pf.nameRequired)).toBeInTheDocument());
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("ProdutoPage — reopen/edit (US6-3/US6-4)", () => {
  it("reopens a saved product with its inputs and recomputes — no stored price on the wire", () => {
    renderPage("prod-1");

    expect(screen.getByRole("textbox", { name: pf.nameLabel })).toHaveValue("Vaso G");
    expect(screen.getByDisplayValue("110,00")).toBeInTheDocument();
    // R$ 26,48 comes from computeFromForm NOW, not from any persisted price (FR-310/FR-313).
    expect(screen.getAllByText("R$ 26,48").length).toBeGreaterThan(0);
  });

  it("a DEGRADED product shows the calm info alert + manual picker + editable last-known values", () => {
    useProductsMock.mockReturnValue(listState([{ ...savedProduct, filamentId: null }]));
    renderPage("prod-1");

    expect(screen.getByText(pf.degradedFilament)).toBeInTheDocument();
    const picker = screen.getByRole("combobox", { name: t.catalogPicker.filament });
    expect(picker).toHaveValue("");
    expect(screen.getByDisplayValue("110,00")).toBeInTheDocument(); // last-known, editable
  });

  it("saving an edit PUTs through the wire mapping", async () => {
    renderPage("prod-1");
    fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const { id, body } = updateMock.mock.calls[0][0];
    expect(id).toBe("prod-1");
    expect(body).toMatchObject({ name: "Vaso G", filamentId: "f-1", printerId: "p-1" });
  });
});
