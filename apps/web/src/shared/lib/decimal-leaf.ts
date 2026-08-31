// A folha decimal dos DOCUMENTOS (snapshot congelado ADR-0019 · cenário ADR-0021) — a função de
// serialização que era gêmea em entities/history/frozen-payload.ts e
// entities/scenario/config-document.ts, unificada aqui (chore de legibilidade 2026-08-31; guarda:
// pages/decimal-leaf-characterization.test.ts). Os ENVELOPES continuam independentes em cada
// entity, de propósito (a independência estrutural de `PriceInput` é decisão registrada lá);
// só a serialização de folha — que é pura e não menciona `PriceInput` — tem uma casa única.
import { Decimal } from "@3dprecify/pricing-core";

/** Uma folha serializada: string decimal EXATA, null, ou a descida recursiva. Nunca um float. */
export type DecimalLeafValue =
    string | null | DecimalLeafValue[] | { [field: string]: DecimalLeafValue };

/** Stringify a JS number EXACTLY (no 2dp rounding) — the `PriceInput` leaf idiom: quantizar um
 *  INPUT corromperia em silêncio (0.125 kW não é 0.13 kW). */
export function toExactString(value: number): string {
    return new Decimal(value).toString();
}

/** Serialize one INPUT value RECURSIVELY: a numeric leaf → an exact decimal string (never
 *  rounded); strings/null pass through; arrays and nested objects are descended so no float can
 *  hide in a channel band (the E4 review PR-A I1 lesson — a shallow freeze lets a nested band
 *  leaf survive as a float). Booleans/`undefined` do not occur in a resolved `PriceInput` leaf
 *  set; invent nothing for one (→ `null`). */
export function stringifyLeaf(value: unknown): DecimalLeafValue {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return toExactString(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(stringifyLeaf);
    if (typeof value === "object") {
        const out: { [field: string]: DecimalLeafValue } = {};
        for (const [key, child] of Object.entries(value)) {
            if (child === undefined) continue;
            out[key] = stringifyLeaf(child);
        }
        return out;
    }
    return null;
}
