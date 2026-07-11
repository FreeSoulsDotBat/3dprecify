// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T004 — the BOM composer (US1, research R7 wiring): a PREMIUM user composes ad-hoc +
// catalog-referenced lines with quantities and reads a live per-line + assembly breakdown.
// Every money number on this page comes from `computeBom` via `composeBom` (ux §0.2) — these
// tests assert the rendered outcome, not any view-layer arithmetic. Teaser specifics are T007.

const { useEntitlementMock, useProductsMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useProductsMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return { ...actual, useProducts: () => useProductsMock() };
});
// Deterministic fee context: an EMPTY catalog (no pre-fill) so every channel number in these
// tests derives only from typed fees — never from the bundled seed's current values.
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return {
    ...actual,
    useFeeCatalog: () => ({
      catalog: {
        catalogVersion: "test-0",
        schemaVersion: "1",
        generatedAt: "2026-01-01T00:00:00Z",
        marketplaces: [],
      },
      source: "seed" as const,
      refreshFailed: false,
      refreshing: false,
      refetch: vi.fn(),
    }),
  };
});

import { BomPage } from "./bom-page";

const t = messages.bom;

/** SC-001-shaped saved product (wire decimal strings): custo 28,65 · varejo 42,98 (per unit). */
const productP: ProductOut = {
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
    wasteGrams: "10",
    printTimeHours: "5",
    failurePct: "10",
    finishTimeHours: "0.5",
    finishRatePerHour: "10.00",
    laborHours: "0",
    laborRatePerHour: "0",
    markupVarejoPct: "50",
    markupAtacadoPct: "30",
  },
  tariffPerKwh: "1.00",
  includeMarketplace: true,
  channels: [],
  otherCosts: [],
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

function listState(items: ProductOut[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPremiumPage(products: ProductOut[] = []) {
  useSessionStore.setState({ status: "authenticated" });
  useEntitlementMock.mockReturnValue({
    data: { status: "active" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useProductsMock.mockReturnValue(listState(products));
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

describe("BomPage — server-informed gate (ADR-0015, US1-4)", () => {
  it("premium (active) reaches the composer: empty state + add affordance", () => {
    renderPremiumPage();
    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(t.addLine) })).toBeInTheDocument();
  });

  it("while the entitlement check is in flight, neither composer nor teaser renders (honest wait)", () => {
    useSessionStore.setState({ status: "authenticated" });
    useEntitlementMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    useProductsMock.mockReturnValue(listState([]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BomPage />
      </QueryClientProvider>,
    );
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.teaserTitle)).not.toBeInTheDocument();
  });

  it("an entitlement FETCH ERROR is an honest retry state — never the composer, never the teaser", () => {
    useSessionStore.setState({ status: "authenticated" });
    useEntitlementMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    useProductsMock.mockReturnValue(listState([]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BomPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText(t.guardError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.guardRetry })).toBeInTheDocument();
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.teaserTitle)).not.toBeInTheDocument();
  });
});

describe("BomPage — compose ad-hoc lines (US1-1/US1-2)", () => {
  it("adding a line shows it (Peça 1, avulsa) with the default per-unit price live", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    // Line header: "Peça 1" + "(avulsa)"; defaults compute custo 20,60 (seed values).
    expect(screen.getByText(new RegExp(t.lineLabel.replace("{n}", "1")))).toBeInTheDocument();
    expect(screen.getByText(new RegExp("\\(avulsa\\)"))).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?20,60/).length).toBeGreaterThan(0);
    // The assembly summary is present with the same honest total.
    expect(screen.getByText(t.assemblyTitle)).toBeInTheDocument();
  });

  it("changing the quantity recomputes the line total and the assembly live (×3 → 61,80)", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    const qty = screen.getByRole("textbox", { name: new RegExp(t.quantity) });
    fireEvent.change(qty, { target: { value: "3" } });
    expect(screen.getAllByText(/R\$\s?61,80/).length).toBeGreaterThan(0);
  });

  it("quantity 0 is an honest zero: captioned, listed, contributing nothing (edge)", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    const qty = screen.getByRole("textbox", { name: new RegExp(t.quantity) });
    fireEvent.change(qty, { target: { value: "0" } });
    expect(screen.getByText(t.qtyZero)).toBeInTheDocument();
    // The line stays listed; the assembly total reads zero.
    expect(screen.getByText(new RegExp(t.lineLabel.replace("{n}", "1")))).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?0,00/).length).toBeGreaterThan(0);
  });

  it("two lines sum independently (Q1) and removing one updates the total live (US1 remove)", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    // 2 × default line (20,60) = 41,20 — read from the engine, never summed in JSX.
    expect(screen.getAllByText(/R\$\s?41,20/).length).toBeGreaterThan(0);
    const removeButtons = screen.getAllByRole("button", { name: new RegExp(t.removeLine) });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[1]);
    expect(screen.queryByText(/R\$\s?41,20/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?20,60/).length).toBeGreaterThan(0);
  });
});

describe("BomPage — catalog-referenced line (US1/Q2, live product → PriceInput)", () => {
  it("binding a saved product pre-fills the line and prices it from the product's LIVE values", () => {
    renderPremiumPage([productP]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    const picker = screen.getByRole("combobox", { name: new RegExp(t.useProduct) });
    fireEvent.change(picker, { target: { value: "p1" } });
    // SC-001 numbers from the product's wire values: custo 28,65 /un.
    expect(screen.getAllByText(/R\$\s?28,65/).length).toBeGreaterThan(0);
    // The line header now carries the product name; provenance is sealed honestly.
    expect(screen.getAllByText(/Vaso G/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(new RegExp(t.fromCatalog.replace("{nome}", "Vaso G"))),
    ).toBeInTheDocument();
  });

  it("a catalog-bound line ×qty scales through the engine (3 × 28,65 = 85,95)", () => {
    renderPremiumPage([productP]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    fireEvent.change(screen.getByRole("combobox", { name: new RegExp(t.useProduct) }), {
      target: { value: "p1" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(t.quantity) }), {
      target: { value: "3" },
    });
    expect(screen.getAllByText(/R\$\s?85,95/).length).toBeGreaterThan(0);
  });
});

// The §1.3 secondary disclosure keeps a line short: optional/labor/outros/marketplace collapse
// under one affordance; its accessible label is composed from the existing section titles.
const advancedLabel = [
  messages.calculator.sections.optional,
  messages.calculator.sections.labor,
  messages.calculator.outrosCustos.title,
  messages.calculator.sections.marketplace,
].join(" · ");

/** Open the expanded line's secondary disclosure, then type a commission (calcular.test idiom —
 *  the accessible name carries the "opcional" tag). */
function typeCommission(value: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) }));
  const commission = screen.getByRole("textbox", {
    name: (n) => n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
  });
  fireEvent.change(commission, { target: { value } });
}

describe("BomPage — line density (ux §1.3 secondary disclosure)", () => {
  it("a fresh line keeps the secondary sections collapsed — only Custos da peça pays the height", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    // The disclosure affordance is visible; the sections behind it are not mounted yet.
    expect(screen.getByRole("button", { name: new RegExp(advancedLabel) })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", {
        name: (n) => n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
      }),
    ).not.toBeInTheDocument();
    // The primary sections stay visible (mandatory costs + the per-unit price).
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(messages.calculator.fields.costPerRoll),
      }),
    ).toBeInTheDocument();
  });

  it("opening the disclosure reveals the marketplace section (and the rest)", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) }));
    expect(
      screen.getByRole("textbox", {
        name: (n) => n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
      }),
    ).toBeInTheDocument();
  });
});

describe("BomPage — per-channel rollup (US1/FR-403, honest by construction)", () => {
  it("a line with a manual channel fee rolls up under 'Preços por canal (montagem)'", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    // The default line ships one Mercado Livre slot with blank fees; over the EMPTY test catalog
    // nothing pre-fills, so type a manual 20% commission: anúncio varejo = 30,90 / 0,8 = 38,63.
    typeCommission("20");
    const rollup = screen.getByText(t.channelsTitle).closest("section, div");
    expect(rollup).not.toBeNull();
    expect(within(rollup as HTMLElement).getAllByText(/38,63/).length).toBeGreaterThan(0);
  });

  // T006b top nit: a FORM-invalid channel slot (commission ≥ 100) never reaches the engine, so
  // it must surface in the assembly rollup as an honest skipped count — never a silent drop
  // from "N peça(s) somaram" (ux §1.7).
  it("a form-invalid slot on one line surfaces as skipped in the rollup, siblings still sum", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    // Line 2 is the expanded one — make its ML slot invalid (commission 100).
    typeCommission("100");
    // Line 1 (default ML slot, zero fees) still contributes; line 2 is counted as skipped.
    const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
    expect(within(rollup).getByText(t.channelContributing.replace("{n}", "1"))).toBeInTheDocument();
    expect(within(rollup).getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
  });

  it("a marketplace whose ONLY slot is form-invalid still gets an honest rollup block", () => {
    renderPremiumPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    typeCommission("100");
    const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
    expect(within(rollup).getByText(t.channelNoContrib)).toBeInTheDocument();
    expect(within(rollup).getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
    // Honest absence — never a fabricated R$ 0,00 price in the block.
    expect(within(rollup).queryByText(/R\$\s?0,00/)).not.toBeInTheDocument();
  });
});
