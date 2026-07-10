// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { CalcularPage } from "./calcular-page";

// US5/T024 — the catalog pickers: premium sellers pick a saved filament/printer and the fields
// pre-fill (staying editable); free/signed-out users see NO picker (SC-310 — the manual flow is
// untouched; the US7 teaser lands separately). Catalog hooks are mocked (the read cache has its
// own suite); the session store is driven directly.

const { useFilamentsMock, usePrintersMock } = vi.hoisted(() => ({
  useFilamentsMock: vi.fn(),
  usePrintersMock: vi.fn(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return {
    ...actual,
    useFilaments: () => useFilamentsMock(),
    usePrinters: () => usePrintersMock(),
  };
});

const t = messages.calculator;

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

function listState(items: unknown[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalcularPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useFilamentsMock.mockReturnValue(listState([filament]));
  usePrintersMock.mockReturnValue(listState([printer]));
});

afterEach(() => {
  cleanup();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — US5 catalog pickers (T024)", () => {
  it("signed-out: no picker renders — the manual free flow is untouched (SC-310)", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    renderPage();
    expect(
      screen.queryByRole("combobox", { name: t.catalogPicker.filament }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: t.catalogPicker.printer }),
    ).not.toBeInTheDocument();
  });

  it("premium with saved items: picking a filament pre-fills its fields, still editable", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "a@b.dev" } as never,
    });
    renderPage();

    const picker = screen.getByRole("combobox", { name: t.catalogPicker.filament });
    fireEvent.change(picker, { target: { value: "f-1" } });

    const cost = screen.getByRole("textbox", { name: t.fields.costPerRoll });
    expect(cost).toHaveValue("110,00");
    expect(screen.getByRole("textbox", { name: t.fields.rollWeight })).toHaveValue("1,000");
    expect(screen.getByRole("textbox", { name: new RegExp(t.fields.wasteGrams) })).toHaveValue(
      "5,000",
    );

    // Pre-fill, never lock: the field stays an ordinary editable input.
    fireEvent.change(cost, { target: { value: "99" } });
    expect(cost).toHaveValue("99");
  });

  it("picking a printer pre-fills the machine fields", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "a@b.dev" } as never,
    });
    renderPage();

    fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
      target: { value: "p-1" },
    });

    expect(screen.getByRole("textbox", { name: t.fields.machineValue })).toHaveValue("1200,00");
    expect(screen.getByRole("textbox", { name: t.fields.machineLifetime })).toHaveValue("2000,000");
    expect(screen.getByRole("textbox", { name: t.fields.avgPower })).toHaveValue("0,1200");
  });

  it("authenticated but zero saved items: no picker noise", () => {
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "a@b.dev" } as never,
    });
    renderPage();
    expect(
      screen.queryByRole("combobox", { name: t.catalogPicker.filament }),
    ).not.toBeInTheDocument();
  });
});
