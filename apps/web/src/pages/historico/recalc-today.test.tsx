// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordMock, entitlement, onlineRef } = vi.hoisted(() => ({
  recordMock: vi.fn(),
  entitlement: { data: undefined as { status: string } | undefined },
  onlineRef: { value: true },
}));
vi.mock("@/entities/history/use-history", () => ({
  useRecordSnapshot: () => ({ mutateAsync: recordMock, isPending: false }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => entitlement }));
vi.mock("@/shared/lib/use-online", () => ({ useOnline: () => onlineRef.value }));
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return {
    ...actual,
    useFeeCatalog: () => ({
      catalog: actual.FEE_CATALOG_SEED,
      source: "seed" as const,
      refreshFailed: false,
      refreshing: false,
      refetch: vi.fn(),
    }),
  };
});

import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import type { HistoryItem } from "@/entities/history/outbox";
import type { CatalogContext } from "@/features/calculator/calculator-model";
import type { ProductOut } from "@/shared/api/generated";
import { FEE_CATALOG_SEED } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Toaster, useToastStore } from "@/shared/ui";

import { recalcToday, RecalcTodayButton } from "./recalc-today";

// 009/T020 (E4, PR-B, US3) — "Recalcular hoje", written FAILING-first (FR-505).
//
// The whole point is that it re-resolves the ORIGIN and reprices from TODAY's catalog, NOT the frozen
// inputs — otherwise it could never answer "meu custo subiu desde que cotei?" with a "sim", and US7
// would be structurally unable to do its job. It creates a NEW record and leaves the original
// untouched. Where the origin no longer resolves it reprices the frozen inputs under the current
// formula and SAYS SO — never presenting a frozen reprice as catalog-current. (Lives at the page
// layer, like pages/bom `kit-save`: the recompute needs `features/calculator`, and FSD-Lite forbids
// a feature importing another feature.)

const t = messages.historico;

const ctx: CatalogContext = { catalog: FEE_CATALOG_SEED, source: "seed", now: 1_800_000_000_000 };

function productAt(costPerRoll: string): ProductOut {
  return {
    id: "prod-1",
    name: "Vaso G",
    filamentId: "f-1",
    printerId: "p-1",
    filamentValues: { material: "PLA", costPerRoll, rollWeightKg: "1.000" },
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
  } as ProductOut;
}

const FROZEN: FrozenSnapshotPayload = {
  schemaVersion: 1,
  kind: "SINGLE",
  modelVersion: "3.1.0",
  catalogVersion: null,
  inputs: { costPerRoll: "110" },
  breakdown: { material: "11.00" },
  totals: { custoTotal: "20.60", precoVarejo: "30.90", precoAtacado: "26.78" },
  provenance: { kind: "PRODUCT", id: "prod-1", name: "Vaso G" },
};

function makeItem(over: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "s1",
    clientSnapshotId: "csid-1",
    kind: "SINGLE",
    label: null,
    headlineTotal: "30.90",
    headlineBasis: "PRECO_VAREJO",
    deviceQuotedAt: "2026-07-03T12:00:00Z",
    syncState: "synced",
    snapshot: {
      id: "s1",
      clientSnapshotId: "csid-1",
      kind: "SINGLE",
      label: null,
      quoteValidityDays: null,
      deviceQuotedAt: "2026-07-03T12:00:00Z",
      deviceUtcOffsetMinutes: -180,
      modelVersion: "3.1.0",
      payloadSchemaVersion: 1,
      payload: FROZEN as unknown as Record<string, unknown>,
      headlineTotal: "30.90",
      headlineBasis: "PRECO_VAREJO",
    },
    entry: null,
    ...over,
  } as HistoryItem;
}

describe("recalcToday — reprices at TODAY's catalog when the origin resolves (FR-505)", () => {
  it("a filament price RISE yields a HIGHER total — repricing frozen inputs never could (pinning)", () => {
    const baseline = recalcToday(FROZEN, { product: productAt("110.00") }, ctx);
    const raised = recalcToday(FROZEN, { product: productAt("220.00") }, ctx);

    expect(baseline.fromFrozen).toBe(false);
    expect(raised.fromFrozen).toBe(false);
    expect(Number(raised.payload.totals.precoVarejo)).toBeGreaterThan(
      Number(baseline.payload.totals.precoVarejo),
    );
  });

  it("carries the origin provenance forward onto the NEW document", () => {
    const out = recalcToday(FROZEN, { product: productAt("110.00") }, ctx);
    expect(out.payload.kind).toBe("SINGLE");
    expect(out.payload.provenance).toEqual({ kind: "PRODUCT", id: "prod-1", name: "Vaso G" });
  });

  it("origin GONE ⇒ re-emits the frozen document and FLAGS it not catalog-current", () => {
    const out = recalcToday(FROZEN, {}, ctx);
    expect(out.fromFrozen).toBe(true);
    expect(out.payload).toBe(FROZEN); // frozen inputs under an unchanged formula ARE the frozen values
  });
});

describe("RecalcTodayButton — a NEW record, the original untouched", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    entitlement.data = { status: "active" };
    onlineRef.value = true;
    recordMock.mockResolvedValue({ clientSnapshotId: "new", syncState: "synced" });
  });
  afterEach(() => cleanup());

  function renderButton(over: Partial<HistoryItem> = {}, product?: ProductOut) {
    return render(
      <>
        <RecalcTodayButton item={makeItem(over)} product={product} />
        <Toaster />
      </>,
    );
  }

  it("confirms, then records a new snapshot at today's basis — never mutating the original", async () => {
    const user = setup();
    renderButton({}, productAt("220.00")); // origin resolves at a HIGHER cost today

    await user.click(screen.getByRole("button", { name: t.recalcAction }));
    expect(await screen.findByText(/Isso cria um NOVO registro/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.recalcConfirm }));

    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1));
    const body = recordMock.mock.calls[0][0];
    expect(body.clientSnapshotId).toMatch(/[0-9a-f-]{36}/); // a NEW id, never the original's
    expect(body.clientSnapshotId).not.toBe("csid-1");
    expect(body.headlineBasis).toBe("PRECO_VAREJO"); // the original's quoted basis
    expect(body.payload.provenance).toEqual({ kind: "PRODUCT", id: "prod-1", name: "Vaso G" });
    // The recomputed headline reflects today's higher catalog, not the frozen 30,90.
    expect(Number(body.headlineTotal)).toBeGreaterThan(30.9);
  });

  it("origin gone ⇒ the dialog says it does NOT reflect today's catalog (never a silent reprice)", async () => {
    const user = setup();
    renderButton({}, undefined); // no live product

    await user.click(screen.getByRole("button", { name: t.recalcAction }));
    expect(await screen.findByText(/não reflete os preços de hoje/)).toBeInTheDocument();
  });

  it("offline ⇒ the dialog carries the stale-catalog caption (F3)", async () => {
    const user = setup();
    onlineRef.value = false;
    renderButton({}, productAt("110.00"));

    await user.click(screen.getByRole("button", { name: t.recalcAction }));
    expect(await screen.findByText(t.recalcOfflineNote)).toBeInTheDocument();
  });

  it("without an active premium the action does not exist (recalc is a WRITE)", () => {
    entitlement.data = { status: "lapsed" };
    renderButton({}, productAt("110.00"));
    expect(screen.queryByRole("button", { name: t.recalcAction })).not.toBeInTheDocument();
  });
});
