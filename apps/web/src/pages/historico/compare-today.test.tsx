// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { onlineRef } = vi.hoisted(() => ({ onlineRef: { value: true } }));
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

import { basisCaption, formatFrozenBRL } from "@/entities/history/history-format";
import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import type { HistoryItem } from "@/entities/history/outbox";
import type { CatalogContext } from "@/features/calculator/calculator-model";
import type { BomLineOut, BomOut, ProductOut } from "@/shared/api/generated";
import { FEE_CATALOG_SEED } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CompareTodayBlock } from "./compare-today";
import { recalcToday } from "./recalc-today";

// 009/T029 (E4, PR-C, US7) — "meu custo subiu desde que cotei?", written FAILING-first.
//
// This is the one surface in the epic that puts a frozen number and a live number NEXT TO EACH
// OTHER, which makes it the one place where the two-shelf rule is easiest to break. Three properties
// carry the whole story:
//
//   1. Each number says WHAT it is and WHEN (FR-523/SC-511). Two unlabelled totals side by side is
//      not an insight, it is a riddle — and the seller would have to guess which one they charged.
//   2. It never claims a "hoje" it could not compute. `recalcToday` reports `fromFrozen` when it had
//      to fall back to the frozen document; rendering that as "Hoje" would print the July number
//      under today's date — a fabricated answer to the exact question being asked.
//   3. It records NOTHING. The comparison is informational; "Recalcular hoje" (US3) is still the only
//      way a new number becomes a record.

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
        sellerFixedPrice: null,
        sellerFixedAt: null,
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

const FROZEN_KIT: FrozenSnapshotPayload = {
    schemaVersion: 1,
    kind: "KIT",
    modelVersion: "3.1.0",
    catalogVersion: null,
    lines: [],
    totals: { custoTotal: "41.20", precoVarejo: "61.80", precoAtacado: "53.56" },
    provenance: { kind: "KIT", id: "kit-1", name: "Kit Festa" },
};

function bomLine(over: Partial<BomLineOut> = {}): BomLineOut {
    const p = productAt("110.00");
    return {
        id: "l1",
        position: 0,
        quantity: 1,
        productId: "prod-1",
        pieceName: "Vaso G",
        degraded: false,
        pieceInputs: p.pieceInputs,
        filamentValues: p.filamentValues,
        printerValues: p.printerValues,
        tariffPerKwh: p.tariffPerKwh,
        includeMarketplace: false,
        channels: [],
        otherCosts: [],
        ...over,
    };
}

function kitOf(lines: BomLineOut[]): BomOut {
    return {
        id: "kit-1",
        name: "Kit Festa",
        lines,
        createdAt: "2026-07-10T00:00:00Z",
        updatedAt: "2026-07-10T00:00:00Z",
    };
}

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

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function renderBlock(
    over: Partial<HistoryItem> = {},
    origin: { product?: ProductOut; kit?: BomOut } = {},
) {
    return render(<CompareTodayBlock item={makeItem(over)} {...origin} />);
}

beforeEach(() => {
    vi.clearAllMocks();
    onlineRef.value = true;
});
afterEach(() => cleanup());

describe("the comparison answers the question, on request (US7)", () => {
    it("shows BOTH totals — each labelled with what it is and when (FR-523/SC-511)", async () => {
        const user = setup();
        renderBlock({}, { product: productAt("220.00") }); // the filament cost doubled since July
        const today = recalcToday(FROZEN, { product: productAt("220.00") }, ctx);

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        // The frozen side: the number they charged, under the date they charged it.
        expect(screen.getByText(t.quotedAt.replace("{data}", "03/07/2026"))).toBeInTheDocument();
        expect(screen.getByText(formatFrozenBRL("30.90"))).toBeInTheDocument();
        // Today's side: a genuinely different number — this is the "sim" the seller came for.
        expect(screen.getByText(t.compareToday)).toBeInTheDocument();
        expect(
            screen.getByText(formatFrozenBRL(today.payload.totals.precoVarejo!)),
        ).toBeInTheDocument();
        // Which of the two prices this is (varejo vs atacado) — an unlabelled total is ambiguous.
        expect(screen.getByText(basisCaption("PRECO_VAREJO"))).toBeInTheDocument();
    });

    it("compares LIKE with LIKE: an atacado quote compares against today's atacado", async () => {
        const user = setup();
        renderBlock(
            { headlineBasis: "PRECO_ATACADO", headlineTotal: "26.78" },
            { product: productAt("220.00") },
        );
        const today = recalcToday(FROZEN, { product: productAt("220.00") }, ctx);

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        expect(
            screen.getByText(formatFrozenBRL(today.payload.totals.precoAtacado!)),
        ).toBeInTheDocument();
        // The varejo number is a DIFFERENT product decision; showing it here would compare a wholesale
        // quote against a retail price and manufacture an increase that never happened.
        expect(
            screen.queryByText(formatFrozenBRL(today.payload.totals.precoVarejo!)),
        ).not.toBeInTheDocument();
    });

    it("an unchanged cost still shows both — 'não subiu' is an answer too", async () => {
        const user = setup();
        // A snapshot quoted at exactly what this product still costs today. Derived from `recalcToday`
        // rather than hard-coded: the fixture's totals are illustrative, and a literal here would be
        // asserting the pricing formula (that is `pricing-core`'s job, not this surface's).
        const unchanged = recalcToday(FROZEN, { product: productAt("110.00") }, ctx).payload.totals
            .precoVarejo!;
        renderBlock({ headlineTotal: unchanged }, { product: productAt("110.00") });

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        // The same number twice, each still wearing its own label — the surface does not collapse them
        // into one row, because "não mudou" is a comparison the seller has to be able to SEE.
        expect(screen.getAllByText(formatFrozenBRL(unchanged))).toHaveLength(2);
        expect(screen.getByText(t.compareToday)).toBeInTheDocument();
    });

    it("says out loud that it changed nothing — the record is not the comparison", async () => {
        const user = setup();
        renderBlock({}, { product: productAt("220.00") });

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        expect(screen.getByText(t.compareNote)).toBeInTheDocument();
        // The frozen total on screen is still, literally, the stored one.
        expect(screen.getByText(formatFrozenBRL("30.90"))).toBeInTheDocument();
    });
});

describe("it never invents a 'hoje' it could not compute", () => {
    it("origin GONE ⇒ no comparison is offered at all (its absence is silent, FR-503)", () => {
        renderBlock({}, {}); // nothing resolves — deleted product, or simply never linked

        expect(screen.queryByRole("button", { name: t.compareAction })).not.toBeInTheDocument();
    });

    it("a kit line that cannot recompute ⇒ the honest line, never the frozen total wearing today's label", async () => {
        // The trap the PR-A review caught in RecalcDialog: deriving "we repriced" from `!!product`
        // instead of the ACTUAL outcome. Here the kit resolves, so the affordance appears — but one
        // piece fails the calc schema, so `recalcToday` falls back to the frozen document. Printing
        // THAT under "Hoje" would answer "seu custo não mudou" using July's numbers.
        const user = setup();
        const bad = bomLine({
            id: "l2",
            pieceInputs: { ...productAt("110.00").pieceInputs, printGrams: "" },
        });
        render(
            <CompareTodayBlock
                item={makeItem({
                    kind: "KIT",
                    headlineTotal: "61.80",
                    snapshot: {
                        ...makeItem().snapshot!,
                        kind: "KIT",
                        headlineTotal: "61.80",
                        payload: FROZEN_KIT as unknown as Record<string, unknown>,
                    },
                })}
                kit={kitOf([bomLine(), bad])}
            />,
        );

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        expect(screen.getByText(t.compareUnavailable)).toBeInTheDocument();
        expect(screen.queryByText(t.compareToday)).not.toBeInTheDocument();
    });
});

describe("offline, 'hoje' is the cached catalog — and it says so (F3)", () => {
    it("carries the stale-catalog caption, the same one 'Recalcular hoje' uses", async () => {
        onlineRef.value = false;
        const user = setup();
        renderBlock({}, { product: productAt("220.00") });

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        expect(screen.getByText(t.recalcOfflineNote)).toBeInTheDocument();
    });
});

// 016/T037 (US10, FR-913) — the SAME structural note "Recalcular hoje" shows, here too: the compare
// puts a congelado (priced by a RETIRED model) next to a live number, and part of the difference may
// come purely from the model change, not from any real cost movement.
describe("016/T037 — a nota estrutural quando o congelado é de um modelo aposentado", () => {
    it("congelado pré-4.0.0 (3.1.0) + comparação bem-sucedida ⇒ a nota aparece", async () => {
        const user = setup();
        renderBlock({}, { product: productAt("220.00") });

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        expect(await screen.findByText(/calculado pelo modelo 3\.1\.0/)).toBeInTheDocument();
    });

    it("congelado já em 4.0.0 ⇒ nenhuma nota estrutural", async () => {
        const user = setup();
        const item = makeItem();
        item.snapshot!.modelVersion = "4.0.0";
        (item.snapshot!.payload as unknown as { modelVersion: string }).modelVersion = "4.0.0";
        render(<CompareTodayBlock item={item} product={productAt("220.00")} />);

        await user.click(screen.getByRole("button", { name: t.compareAction }));

        await screen.findByText(t.compareToday); // the comparison DID render
        expect(
            screen.queryByText(/O modelo atual não tem mais esse campo/),
        ).not.toBeInTheDocument();
    });
});
