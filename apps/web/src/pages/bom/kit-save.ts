import { formToProductIn } from "@/features/calculator/product-mapping";
import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import type { BomIn, BomLineIn } from "@/shared/api/generated";

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

/** The K4 pre-fill: "Peça {n} · {kit}" — the seller can always rename it before saving. */
export function defaultPieceName(index: number, kitName: string): string {
  const kit = kitName.trim();
  return kit ? `Peça ${index + 1} · ${kit}` : `Peça ${index + 1}`;
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
