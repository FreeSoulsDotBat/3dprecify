import {
    type CalcFormValues,
    type ChannelSlotForm,
    defaultCalcValues,
} from "@/features/calculator/calculator-schema";
import type {
    ChannelSlotInput,
    OtherCostInput,
    ProductIn,
    ProductOut,
} from "@/shared/api/generated";
import { ptBrToWireDecimal, wireToPtBr } from "@/shared/lib/decimal-ptbr";

// US6/T030 — the wire⇄form mapping for products, same discipline as catalog-prefill (SC-305):
// pure string separator swaps mirroring `parseDecimal`'s rules (dots = thousands, comma =
// decimal), NEVER a float round-trip, so a reopened product feeds `computeFromForm` the exact
// strings a manual entry would produce. Blank channel fees stay BLANK end-to-end (wire null ⇄
// form "") — a blank fee means "resolve from the live fee catalog"; persisting a 0 would
// dishonestly freeze today's fee (D4: channels[] = the same shapes the calculator form uses).

// 013/FA-05 + FA-01: both directions now live in `shared/lib/decimal-ptbr` — `wireToPtBr` was one of
// three identical copies, and the local `ptBrToWire` implemented the OLD lenient rules (it dropped
// EVERY dot), so after the grammar fix a typed "1500.00" would have been READ as 1500 and SAVED as
// "150000". `ptBrToWireDecimal` is the string mirror of `parseDecimal`: same grammar, precision kept.

/** Everything the product page edits: the calculator form values + the product identity bits. */
export interface ProductFormBundle {
    name: string;
    /** Linked filament id, or "" when degraded/manual (US6-4). */
    filamentId: string;
    printerId: string;
    /** The material label rides along so a degraded save keeps it (it has no calculator field). */
    filamentMaterial: string | null;
    values: CalcFormValues;
}

/** The wire pieceInputs keys — identical names to the calculator fields (both mirror
 *  pricing-core's PriceInput), so the mapping is mechanical. */
const PIECE_KEYS = [
    "printGrams",
    "printTimeHours",
    "failurePct",
    "finishTimeHours",
    "finishRatePerHour",
    "laborHours",
    "laborRatePerHour",
    "markupVarejoPct",
    "markupAtacadoPct",
] as const;

// `WireChannel` morreu aqui (2026-08-31): o Out do backend passou a declarar
// `channels: list[ChannelSlot]` / `otherCosts: list[OtherCost]`, então o cliente gerado já traz a
// forma inteira e não havia mais o que redeclarar por fora. As guardas de `typeof` continuam: elas
// protegem de um item vindo do cache offline gravado por uma versão anterior, que é dado, não tipo.

function feeToForm(fee: unknown): string {
    return typeof fee === "string" ? wireToPtBr(fee) : "";
}

/** null when blank — the wire never carries a fabricated 0 for an unset fee. */
function feeToWire(fee: string): string | null {
    return fee.trim() === "" ? null : ptBrToWireDecimal(fee);
}

/** Reopen: wire → the pt-BR form bundle. Resolved values (live while linked, last-known when
 *  degraded — the server applies the D3 resolution rule) land in the ordinary editable fields. */
export function productToForm(product: ProductOut): ProductFormBundle {
    const values: CalcFormValues = {
        ...defaultCalcValues,
        costPerRoll: wireToPtBr(product.filamentValues.costPerRoll),
        rollWeightKg: wireToPtBr(product.filamentValues.rollWeightKg),
        machineValue: wireToPtBr(product.printerValues.machineValue),
        machineLifetimeHours: wireToPtBr(product.printerValues.machineLifetimeHours),
        avgPowerKw: wireToPtBr(product.printerValues.avgPowerKw),
        maintenanceReservePerHour: wireToPtBr(
            product.printerValues.maintenanceReservePerHour ?? "0",
        ),
        printGrams: wireToPtBr(product.pieceInputs.printGrams),
        printTimeHours: wireToPtBr(product.pieceInputs.printTimeHours),
        failurePct: wireToPtBr(product.pieceInputs.failurePct ?? "0"),
        finishTimeHours: wireToPtBr(product.pieceInputs.finishTimeHours ?? "0"),
        finishRatePerHour: wireToPtBr(product.pieceInputs.finishRatePerHour ?? "0"),
        laborHours: wireToPtBr(product.pieceInputs.laborHours ?? "0"),
        laborRatePerHour: wireToPtBr(product.pieceInputs.laborRatePerHour ?? "0"),
        markupVarejoPct: wireToPtBr(product.pieceInputs.markupVarejoPct),
        markupAtacadoPct: wireToPtBr(product.pieceInputs.markupAtacadoPct),
        tariffPerKwh: wireToPtBr(product.tariffPerKwh),
        includeMarketplace: product.includeMarketplace,
        channels: product.channels.map((c): ChannelSlotForm => ({
            marketplace: c.marketplace,
            modality: typeof c.modality === "string" ? c.modality : "",
            commissionPct: feeToForm(c.commissionPct),
            fixedFee: feeToForm(c.fixedFee),
            minPerItem: feeToForm(c.minPerItem),
            freightCost: feeToForm(c.freightCost),
        })),
        otherCosts: product.otherCosts.map((c) => ({
            name: typeof c.name === "string" ? c.name : "",
            value: typeof c.value === "string" ? wireToPtBr(c.value) : "",
        })),
    };
    return {
        name: product.name,
        filamentId: product.filamentId ?? "",
        printerId: product.printerId ?? "",
        filamentMaterial: product.filamentValues.material ?? null,
        values,
    };
}

/** Save: the pt-BR form bundle → the wire body. Linked refs send ONLY the id (the server
 *  re-snapshots from the live row — D3); a degraded ref sends the editable overrides (US6-4). */
export function formToProductIn(bundle: ProductFormBundle): ProductIn {
    const { values } = bundle;
    const pieceInputs = Object.fromEntries(
        PIECE_KEYS.map((key) => [key, ptBrToWireDecimal(values[key])]),
    ) as Record<(typeof PIECE_KEYS)[number], string>;

    const body: ProductIn = {
        name: bundle.name,
        filamentId: bundle.filamentId || null,
        printerId: bundle.printerId || null,
        pieceInputs,
        tariffPerKwh: ptBrToWireDecimal(values.tariffPerKwh),
        includeMarketplace: values.includeMarketplace,
        channels: values.channels.map((c): ChannelSlotInput => ({
            marketplace: c.marketplace,
            modality: c.modality,
            commissionPct: feeToWire(c.commissionPct),
            fixedFee: feeToWire(c.fixedFee),
            minPerItem: feeToWire(c.minPerItem),
            freightCost: feeToWire(c.freightCost),
        })),
        // A fully blank row is an untouched affordance, not user data — dropped. A named row with a
        // blank value persists the 0 the calculator computes for it (FR-116 semantics).
        otherCosts: values.otherCosts
            .filter((c) => c.name.trim() !== "" || c.value.trim() !== "")
            .map((c): OtherCostInput => ({
                name: c.name,
                value: c.value.trim() ? ptBrToWireDecimal(c.value) : "0",
            })),
    };
    if (!body.filamentId) {
        body.filamentValues = {
            material: bundle.filamentMaterial,
            costPerRoll: ptBrToWireDecimal(values.costPerRoll),
            rollWeightKg: ptBrToWireDecimal(values.rollWeightKg),
        };
    }
    if (!body.printerId) {
        body.printerValues = {
            machineValue: ptBrToWireDecimal(values.machineValue),
            machineLifetimeHours: ptBrToWireDecimal(values.machineLifetimeHours),
            avgPowerKw: ptBrToWireDecimal(values.avgPowerKw),
            maintenanceReservePerHour: ptBrToWireDecimal(values.maintenanceReservePerHour),
        };
    }
    return body;
}
