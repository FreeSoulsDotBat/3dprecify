import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { formToProductIn, productToForm } from "@/features/calculator/product-mapping";
import type { BomIn, BomLineIn, BomLineOut, ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// 008/T015 — the composer→wire adapter. It lives at the PAGE layer on purpose: the mapping needs
// `formToProductIn` from `features/calculator`, and FSD-Lite forbids a feature importing another
// feature (eslint-boundaries). The page may import both, so this is where the two meet.
//
// The ad-hoc value-set IS a ProductIn (that is what lets the server materialize it, ADR-0017), so
// the mapping reuses `formToProductIn` verbatim rather than restating the pt-BR→wire rules — one
// implementation of "how a form becomes money on the wire", shared with the product save path.

/** One composer line, as the page tracks it, plus the name its piece would carry if saved. */
export interface KitSaveLine {
    values: CalcFormValues;
    quantityRaw: string;
    /** Bound product id; "" = ad-hoc. */
    productId: string;
    productName: string | null;
    /** Optional display label carried over from the bound product's filament. */
    filamentMaterial: string | null;
    /** The line's fields were edited AFTER binding to a product. */
    adjusted: boolean;
    /** The manual product's name, for any line that materializes (K4). */
    pieceName: string;
}

/** The K4 pre-fill: "Peça {n} · {kit}" — the seller can always rename it before saving. Copy lives
 *  in i18n (the "Peça" noun is pt-BR product vocabulary, not a code constant). */
export function defaultPieceName(index: number, kitName: string): string {
    const kit = kitName.trim();
    const n = String(index + 1);
    return kit
        ? messages.bom.pieceNameKit.replace("{n}", n).replace("{kit}", kit)
        : messages.bom.lineLabel.replace("{n}", n);
}

/** A line saves as a live REFERENCE only while it is bound AND untouched. The moment the seller
 *  edits a bound line it becomes ad-hoc (ADR-0017's edit-after-bind convention): saving it as a
 *  reference would let the live product's values supersede the adjustment — silently discarding
 *  what they just typed. */
export function savesAsReference(line: KitSaveLine): boolean {
    return line.productId !== "" && !line.adjusted;
}

function toLineIn(line: KitSaveLine): BomLineIn {
    const quantity = Number.parseInt(line.quantityRaw.trim(), 10);
    if (savesAsReference(line)) {
        return { quantity, productId: line.productId };
    }
    // Empty ids force the ad-hoc branch of formToProductIn — it emits filamentValues/printerValues
    // instead of references, which is exactly the value-set a manual product materializes from.
    const product = formToProductIn({
        name: line.pieceName,
        filamentId: "",
        printerId: "",
        filamentMaterial: line.filamentMaterial,
        values: line.values,
    });
    return {
        quantity,
        pieceName: line.pieceName.trim(),
        pieceInputs: product.pieceInputs,
        filamentValues: product.filamentValues,
        printerValues: product.printerValues,
        tariffPerKwh: product.tariffPerKwh,
        includeMarketplace: product.includeMarketplace,
        channels: product.channels,
        otherCosts: product.otherCosts,
    };
}

/** `BomIn.lines` is optional on the generated type (the server defaults it to `[]`), but this
 *  adapter always emits it — the narrowed return keeps callers from having to null-check. */
export function linesToBomIn(
    kitName: string,
    lines: KitSaveLine[],
): BomIn & { lines: BomLineIn[] } {
    return { name: kitName.trim(), lines: lines.map(toLineIn) };
}

/** Reopen: a saved line → the composer's form state. The server already applied the D3 rule (a
 *  live line resolves from its product; a degraded one from its last-known snapshot), so the
 *  values arrive RESOLVED and land in the ordinary editable fields — exactly how a reopened
 *  product behaves. The price is not among them: it is recomputed here (FR-407/ADR-0016).
 *
 *  `productToForm` is reused verbatim by handing it the line's value-set, which is the ProductOut
 *  value surface. The synthesized refs are null on purpose: the line's values are the resolved
 *  ones, so the form must treat them as its own editable state, not as a link to re-resolve. */
export function lineToForm(line: BomLineOut): {
    values: CalcFormValues;
    filamentMaterial: string | null;
} {
    const bundle = productToForm({
        id: line.productId ?? "",
        name: line.pieceName ?? "",
        filamentId: null,
        printerId: null,
        filamentValues: line.filamentValues,
        printerValues: line.printerValues,
        pieceInputs: line.pieceInputs,
        tariffPerKwh: line.tariffPerKwh,
        includeMarketplace: line.includeMarketplace,
        channels: line.channels,
        otherCosts: line.otherCosts,
        createdAt: "",
        updatedAt: "",
    } as ProductOut);
    return { values: bundle.values, filamentMaterial: bundle.filamentMaterial };
}
