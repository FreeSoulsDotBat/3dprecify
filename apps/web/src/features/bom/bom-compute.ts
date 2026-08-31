import {
    type BomLineResult,
    type BomResult,
    computeBom,
    type PriceInput,
} from "@3dprecify/pricing-core";

// 008/T005 — the thin assembly adapter (research R7): the page collects one already-built
// PriceInput per line (the calculator seam exposes it) and this module is the ONLY place the
// lines meet `computeBom`. `features/bom` never parses forms and never does money arithmetic
// (ux §0.2) — pricing-core owns every number.

/** One composer line as the page tracks it: the engine input (null while the line's editor is
 *  invalid — honestly excluded from the compute, captioned in the UI) + its quantity. */
export interface ComposerLine {
    input: PriceInput | null;
    quantity: number;
}

export interface ComposedBom {
    /** The canonical assembly result over the VALID lines (ADR-0016). */
    bom: BomResult;
    /** Aligned to the input lines; null where the line was invalid (excluded, never silently zero). */
    lineResults: (BomLineResult | null)[];
}

export function composeBom(lines: ComposerLine[]): ComposedBom {
    // Compact the VALID lines for the engine, then re-expand its per-line results back onto the
    // composer's positions — the same aligned-outcome idiom `computeFromForm` uses for channels.
    const valid = lines.filter(
        (l): l is { input: PriceInput; quantity: number } => l.input !== null,
    );
    const bom = computeBom(valid.map(({ input, quantity }) => ({ input, quantity })));
    let next = 0;
    const lineResults: (BomLineResult | null)[] = lines.map((l) =>
        l.input === null ? null : (bom.lines[next++] ?? null),
    );
    return { bom, lineResults };
}
