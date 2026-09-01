// A CALCULADORA de peça única: `PriceInput` → `PriceResult` (custo por linha + markups + canais).
// Movido de index.ts na divisão por responsabilidade (chore de legibilidade 2026-08-31); corpo
// verbatim. Specs: 004/005; ADR-0008 (dinheiro) · ADR-0009 (máquina) · ADR-0011 (contrato 3.0.0).
import { computeChannel, type ChannelInput, type ChannelResult } from "./channel-slot.ts";
import { assertNonNegative, assertPositive, ValidationError } from "./errors.ts";
import { PRICING_MODEL_VERSION, RETIRED_INPUT_FIELDS } from "./model-version.ts";
import { Decimal, sumMoney, toMoney } from "./rounding.ts";

/** One named "outros custos" sub-cost; its value folds into custo_total exactly as 004's adminTotal. */
export interface OtherCostItem {
    name: string;
    value: number; // R$, ≥ 0
}

export interface PriceInput {
    costPerRoll: number; // R$, ≥ 0
    rollWeightKg: number; // kg, > 0
    /** g, ≥ 0 — **todo** o filamento que a peça consome: purga, suporte e brim entram aqui (4.0.0 /
     *  FR-914). O antigo `wasteGrams` foi removido em 4.0.0 e é RECUSADO (ADR-0026). */
    printGrams: number;
    printTimeHours: number; // h, ≥ 0
    avgPowerKw: number; // kW, ≥ 0 (effective average draw)
    tariffPerKwh: number; // R$/kWh, ≥ 0
    machineValue: number; // R$, ≥ 0
    machineLifetimeHours: number; // h, > 0
    maintenanceReservePerHour?: number; // R$/h, ≥ 0, default 0
    /**
     * %, ≥ 0, default 0 — e **sem teto, deliberadamente** (015/A8, `[F03a-002]`, decisão do dono
     * 2026-08-03). A auditoria pré-provisionamento perguntou se `failurePct = 1000` deveria ser
     * recusado, já que produz uma falha de 10× o subtotal de produção. Não deve: **300% representa
     * legitimamente uma peça que falha três vezes antes de sair**, e um teto arbitrário recusaria um
     * caso real. O número é do vendedor.
     *
     * Este comentário existe para impedir que o próximo leitor "conserte" o que foi decidido.
     */
    failurePct?: number;
    finishTimeHours?: number; // h, ≥ 0, default 0
    finishRatePerHour?: number; // R$/h, ≥ 0, default 0
    laborHours?: number; // h, ≥ 0, default 0
    laborRatePerHour?: number; // R$/h, ≥ 0, default 0
    otherCosts?: OtherCostItem[]; // 0..N named sub-costs; Σ value = admin (replaces 004 `adminTotal`)
    markupVarejoPct: number; // %, ≥ 0
    markupAtacadoPct: number; // %, ≥ 0
    channels?: ChannelInput[]; // 0..N listing channels (replaces the 004 single marketplace fee)
    catalogVersion?: string; // provenance of the resolved fees, echoed onto the result; null when all-manual
}

export interface PriceResult {
    material: number;
    energy: number;
    machine: number;
    falha: number;
    finishing: number;
    labor: number;
    admin: number;
    /** The named sub-costs, rounded (ADR-0008) and in input order — each renders as its own breakdown
     *  line (FR-115); Σ value === `admin`. Empty when the "Outros custos" slot is empty. */
    otherCosts: OtherCostItem[];
    custoTotal: number;
    precoVarejo: number;
    precoAtacado: number;
    channels: ChannelResult[];
    catalogVersion: string | null;
    modelVersion: string;
}

export function computeCalculator(input: PriceInput): PriceResult {
    // A PRIMEIRA coisa que acontece aqui, antes de qualquer validação (ADR-0026 §3.1): um campo
    // aposentado é recusado pelo NOME, e a mensagem diz a saída. Se esta recusa viesse depois, uma
    // entrada que também fosse inválida por outro motivo culparia o outro campo — e o chamador
    // consertaria a coisa errada, deixando o descarte silencioso de pé.
    for (const field of RETIRED_INPUT_FIELDS) {
        if (field in input) {
            throw new ValidationError(
                `${field} foi removido do modelo de preço em 4.0.0 — use stripRetiredFields() antes de recomputar`,
                field,
            );
        }
    }

    // Normalize optionals to their 0 default (FR-023).
    const maintenanceReservePerHour = input.maintenanceReservePerHour ?? 0;
    const failurePct = input.failurePct ?? 0;
    const finishTimeHours = input.finishTimeHours ?? 0;
    const finishRatePerHour = input.finishRatePerHour ?? 0;
    const laborHours = input.laborHours ?? 0;
    const laborRatePerHour = input.laborRatePerHour ?? 0;
    const otherCosts = input.otherCosts ?? [];
    const channels = input.channels ?? [];

    // Validation (FR-038 / SC-008) — never compute a bad number. Shared cost inputs still throw
    // (a bad denominator dooms the whole calc); per-channel validation lives in computeChannel.
    assertNonNegative(input.costPerRoll, "costPerRoll");
    assertPositive(input.rollWeightKg, "rollWeightKg");
    assertNonNegative(input.printGrams, "printGrams");
    assertNonNegative(input.printTimeHours, "printTimeHours");
    assertNonNegative(input.avgPowerKw, "avgPowerKw");
    assertNonNegative(input.tariffPerKwh, "tariffPerKwh");
    assertNonNegative(input.machineValue, "machineValue");
    assertPositive(input.machineLifetimeHours, "machineLifetimeHours");
    assertNonNegative(maintenanceReservePerHour, "maintenanceReservePerHour");
    assertNonNegative(failurePct, "failurePct");
    assertNonNegative(finishTimeHours, "finishTimeHours");
    assertNonNegative(finishRatePerHour, "finishRatePerHour");
    assertNonNegative(laborHours, "laborHours");
    assertNonNegative(laborRatePerHour, "laborRatePerHour");
    otherCosts.forEach((c, i) => assertNonNegative(c.value, `otherCosts[${i}].value`));
    assertNonNegative(input.markupVarejoPct, "markupVarejoPct");
    assertNonNegative(input.markupAtacadoPct, "markupAtacadoPct");

    // Full-precision intermediates (Decimal); quantize only at emit (ADR-0008).
    // Production inputs — the three lines the failure factor covers (A16.4).
    // 4.0.0 (FR-024 / ADR-0026): material = gramas × custo por grama. O somando de desperdício saiu —
    // purga/suporte/brim entram nas GRAMAS USADAS, e o que se perde por impressão inteira perdida é a
    // taxa de falha. Eram dois campos que o vendedor lia como a mesma coisa (homologação do dono, D2).
    const material = new Decimal(input.costPerRoll)
        .dividedBy(new Decimal(input.rollWeightKg).times(1000))
        .times(input.printGrams);
    // A16.2 (SC-005): energy = the effective average draw (avgPowerKw) × time × tariff.
    // There is deliberately NO nameplate-power × duty-cycle path — the corrected model takes the
    // real average kW directly, so only this line moves when avgPowerKw changes.
    const energy = new Decimal(input.printTimeHours)
        .times(input.avgPowerKw)
        .times(input.tariffPerKwh); // FR-025
    // ADR-0009 A (SC-007): ONE coherent capital-recovery rate — straight-line amortization
    // (machineValue / lifetimeHours) + a maintenance reserve/hour. No separate depreciation/ROI/
    // maintenance lines that would triple-count the same wear.
    const machineHourRate = new Decimal(input.machineValue)
        .dividedBy(input.machineLifetimeHours)
        .plus(maintenanceReservePerHour);
    const machine = machineHourRate.times(input.printTimeHours); // FR-026

    const materialR = toMoney(material);
    const energyR = toMoney(energy);
    const machineR = toMoney(machine);

    // A16.4 (SC-006): a failed print wastes ALL production inputs, so failure is a % of
    // material + energy + machine — never material alone. Taken over the (rounded) production
    // subtotal so the shown falha = failure% of the shown subtotal (21,50 → 2,15 for SC-001).
    const producaoR = sumMoney([materialR, energyR, machineR]);
    const failureRate = toMoney(new Decimal(producaoR).times(failurePct).dividedBy(100)); // FR-027

    // Cost lines OUTSIDE the failure base (OQ-8).
    const finishingR = toMoney(new Decimal(finishTimeHours).times(finishRatePerHour)); // FR-028
    const laborR = toMoney(new Decimal(laborHours).times(laborRatePerHour));
    // FR-114/115: "outros custos" is now a slot of named sub-costs. Each value is rounded per ADR-0008
    // and echoed back (in order) as its own breakdown line; admin = Σ of those rounded lines. An empty
    // slot ⇒ [] / 0 — behaviourally identical to 004's single `adminTotal`.
    const otherCostsR: OtherCostItem[] = otherCosts.map((c) => ({
        name: c.name,
        value: toMoney(c.value),
    }));
    const adminR = sumMoney(otherCostsR.map((c) => c.value));

    const custoTotal = sumMoney([
        materialR,
        energyR,
        machineR,
        failureRate,
        finishingR,
        laborR,
        adminR,
    ]); // FR-029

    // Markup over the displayed (rounded) custo_total — WYSIWYG (FR-030).
    const precoVarejo = toMoney(
        new Decimal(custoTotal).times(percentMultiplier(input.markupVarejoPct)),
    );
    const precoAtacado = toMoney(
        new Decimal(custoTotal).times(percentMultiplier(input.markupAtacadoPct)),
    );

    // Multi-channel gross-up (FR-110/112): each configured channel is priced independently over BOTH
    // suggested prices and shown together ("Preços por canal"). No marketplace fee is EVER folded into
    // custo_total. Foundational covers %-commission + fixedFee + a generic freightCost; the Amazon
    // per-item floor + price-band fixed-point + per-slot error isolation land in US1.
    const channelResults = channels.map((ch) => computeChannel(precoVarejo, precoAtacado, ch));

    return {
        material: materialR,
        energy: energyR,
        machine: machineR,
        falha: failureRate,
        finishing: finishingR,
        labor: laborR,
        admin: adminR,
        otherCosts: otherCostsR,
        custoTotal,
        precoVarejo,
        precoAtacado,
        channels: channelResults,
        catalogVersion: input.catalogVersion ?? null,
        modelVersion: PRICING_MODEL_VERSION,
    };
}

/** `1 + pct/100` as a Decimal (markup multiplier). */
function percentMultiplier(pct: number): Decimal {
    return new Decimal(1).plus(new Decimal(pct).dividedBy(100));
}
