import Decimal from "decimal.js-light";

// ADR-0008 money policy — every emitted BRL value is 2-decimal ROUND_HALF_UP. This module is the
// SOLE source of the rounding rule; intermediates stay full-precision Decimal and are quantized only
// when emitted, and each aggregate is the sum of already-rounded lines so the breakdown closes.
export const MONEY_DP = 2;

type Num = Decimal | number | string;

/** Quantize a full-precision value to a 2-decimal BRL amount (ROUND_HALF_UP). */
export function toMoney(value: Num): number {
    return new Decimal(value).toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP).toNumber();
}

/** Exact sum of already-rounded money lines — the aggregate a breakdown must add up to. */
export function sumMoney(rounded: number[]): number {
    return toMoney(rounded.reduce<Decimal>((acc, n) => acc.plus(n), new Decimal(0)));
}

// Re-export Decimal so the engine composes full-precision intermediates from one instance.
export { Decimal };
