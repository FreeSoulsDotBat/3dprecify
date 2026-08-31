// O MOTOR DE KIT (E3 assembly compute — ADR-0016, 3.1.0): N linhas independentes × quantidade,
// soma + rollup por marketplace. Sem amortização de mesa compartilhada em 3.1.0 (spec Q1; um modo
// de mesa compartilhada estende isto aditivamente). Contrato:
// specs/008-e3-multi-piece-bom/contracts/pricing-core-bom.md. Movido de index.ts na divisão por
// responsabilidade (chore de legibilidade 2026-08-31); corpo verbatim.
import { computeCalculator, type PriceInput, type PriceResult } from "./calculator.ts";
import { ValidationError } from "./errors.ts";
import { PRICING_MODEL_VERSION } from "./model-version.ts";
import { Decimal, sumMoney, toMoney } from "./rounding.ts";

/** One BOM line: the existing single-piece input (reused verbatim) × a finite integer qty ≥ 0. */
export interface BomLineInput {
    input: PriceInput;
    quantity: number;
}

/** Per-line outcome: the per-UNIT result (unchanged) + its money scaled by quantity. */
export interface BomLineResult {
    line: PriceResult;
    quantity: number;
    custoTotal: number;
    precoVarejo: number;
    precoAtacado: number;
}

/**
 * Per-marketplace assembly rollup (FR-403). Money fields are assembly TOTALS — Σ over the
 * contributing lines of (that line's slot values × quantity), per level. Counts are per LINE,
 * not per slot: a line with several slots of one marketplace contributes once (its money still
 * sums every valid slot), and it counts as skipped only when EVERY one of its slots for that
 * marketplace errored (honest, not silent — extends SC-107). A rollup nobody fed
 * (`contributingLines === 0`) reports null prices, never a fake R$ 0,00.
 */
export interface BomChannelRollup {
    marketplace: string | null;
    precoAnuncioVarejo: number | null;
    recebidoLiquidoVarejo: number | null;
    precoAnuncioAtacado: number | null;
    recebidoLiquidoAtacado: number | null;
    freightCostVarejo: number;
    freightCostAtacado: number;
    contributingLines: number;
    skippedLines: number;
}

export interface BomResult {
    lines: BomLineResult[];
    custoTotal: number;
    precoVarejo: number;
    precoAtacado: number;
    channels: BomChannelRollup[];
    modelVersion: string;
}

/** Decimal accumulator behind one BomChannelRollup while the lines stream in. */
interface RollupAccumulator {
    marketplace: string | null;
    anuncioVarejo: Decimal;
    liquidoVarejo: Decimal;
    anuncioAtacado: Decimal;
    liquidoAtacado: Decimal;
    freightVarejo: Decimal;
    freightAtacado: Decimal;
    contributingLines: number;
    skippedLines: number;
}

/**
 * Canonical assembly compute (ADR-0016). Money rule one level up from ADR-0008: the per-unit line
 * is already rounded (2dp), per-line×qty is `toMoney(Decimal × qty)` — never native `*` — and every
 * aggregate is `sumMoney` of those already-rounded per-line values, so the assembly total equals
 * the sum of the numbers the user SEES (FR-412, no double-rounding). A line's channel error stays
 * channel-local (per-slot isolation); a bad quantity or piece input throws ValidationError exactly
 * like computeCalculator does.
 */
export function computeBom(lines: BomLineInput[]): BomResult {
    lines.forEach((l, i) => {
        if (!Number.isInteger(l.quantity) || l.quantity < 0) {
            throw new ValidationError(
                `lines[${i}].quantity must be a finite integer >= 0`,
                `lines[${i}].quantity`,
            );
        }
    });

    const lineResults: BomLineResult[] = lines.map(({ input, quantity }) => {
        const line = computeCalculator(input);
        const times = (perUnit: number): number => toMoney(new Decimal(perUnit).times(quantity));
        return {
            line,
            quantity,
            custoTotal: times(line.custoTotal),
            precoVarejo: times(line.precoVarejo),
            precoAtacado: times(line.precoAtacado),
        };
    });

    // Per-marketplace rollup — grouped in first-appearance order (deterministic; Map keeps it).
    const rollups = new Map<string | null, RollupAccumulator>();
    for (const { line, quantity } of lineResults) {
        // Line-scoped flags so the counts stay per LINE even when a line carries several slots of
        // the same marketplace (money accumulates per slot; counts resolve after the line closes).
        const lineFlags = new Map<string | null, { ok: boolean; err: boolean }>();
        for (const slot of line.channels) {
            let acc = rollups.get(slot.marketplace);
            if (!acc) {
                acc = {
                    marketplace: slot.marketplace,
                    anuncioVarejo: new Decimal(0),
                    liquidoVarejo: new Decimal(0),
                    anuncioAtacado: new Decimal(0),
                    liquidoAtacado: new Decimal(0),
                    freightVarejo: new Decimal(0),
                    freightAtacado: new Decimal(0),
                    contributingLines: 0,
                    skippedLines: 0,
                };
                rollups.set(slot.marketplace, acc);
            }
            const flags = lineFlags.get(slot.marketplace) ?? { ok: false, err: false };
            lineFlags.set(slot.marketplace, flags);
            // Two ways a slot cannot feed the rollup, and BOTH are skips, never silent drops: its own
            // validation failed, or a level is UNPRICED — no published band covers that announce
            // (SC-817). Summing an unpriced level as R$ 0,00 would understate the kit under a seal; a
            // partial sum is exactly the lie the whole rollup exists to avoid.
            if (
                slot.error !== null ||
                slot.precoAnuncioVarejo === null ||
                slot.precoAnuncioAtacado === null
            ) {
                flags.err = true; // honest: resolved to a skipped LINE below, never silently dropped
                continue;
            }
            flags.ok = true;
            // Past that guard a slot carries the four prices together (computeChannel writes announce and
            // líquido as one outcome per level): a `?? 0` here would add four dead branches the
            // 100%-branch gate can never cover — the non-null assertion states the invariant instead.
            acc.anuncioVarejo = acc.anuncioVarejo.plus(
                new Decimal(slot.precoAnuncioVarejo!).times(quantity),
            );
            acc.liquidoVarejo = acc.liquidoVarejo.plus(
                new Decimal(slot.recebidoLiquidoVarejo!).times(quantity),
            );
            acc.anuncioAtacado = acc.anuncioAtacado.plus(
                new Decimal(slot.precoAnuncioAtacado!).times(quantity),
            );
            acc.liquidoAtacado = acc.liquidoAtacado.plus(
                new Decimal(slot.recebidoLiquidoAtacado!).times(quantity),
            );
            acc.freightVarejo = acc.freightVarejo.plus(
                new Decimal(slot.freightCostVarejo).times(quantity),
            );
            acc.freightAtacado = acc.freightAtacado.plus(
                new Decimal(slot.freightCostAtacado).times(quantity),
            );
        }
        // Close the line: one contributing count per marketplace it fed; skipped only when every
        // slot of that marketplace on this line errored. A flags entry exists only because a slot
        // set ok OR err, so `!ok` implies err — a third branch would be dead code the 100%-branch
        // gate can never cover.
        for (const [marketplace, flags] of lineFlags) {
            const acc = rollups.get(marketplace)!;
            if (flags.ok) acc.contributingLines += 1;
            else acc.skippedLines += 1;
        }
    }

    const channels: BomChannelRollup[] = [...rollups.values()].map((acc) => ({
        marketplace: acc.marketplace,
        precoAnuncioVarejo: acc.contributingLines === 0 ? null : toMoney(acc.anuncioVarejo),
        recebidoLiquidoVarejo: acc.contributingLines === 0 ? null : toMoney(acc.liquidoVarejo),
        precoAnuncioAtacado: acc.contributingLines === 0 ? null : toMoney(acc.anuncioAtacado),
        recebidoLiquidoAtacado: acc.contributingLines === 0 ? null : toMoney(acc.liquidoAtacado),
        freightCostVarejo: toMoney(acc.freightVarejo),
        freightCostAtacado: toMoney(acc.freightAtacado),
        contributingLines: acc.contributingLines,
        skippedLines: acc.skippedLines,
    }));

    return {
        lines: lineResults,
        custoTotal: sumMoney(lineResults.map((l) => l.custoTotal)),
        precoVarejo: sumMoney(lineResults.map((l) => l.precoVarejo)),
        precoAtacado: sumMoney(lineResults.map((l) => l.precoAtacado)),
        channels,
        modelVersion: PRICING_MODEL_VERSION,
    };
}
