import type { ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// US6/T030 — the Produtos list-row summary (ux §1.1): the reference NAMES, never a price
// (FR-310 — a row price would imply a stored snapshot). A degraded reference reads as manual.

export function productSummary(
  product: ProductOut,
  filamentName?: string,
  printerName?: string,
): string {
  const manual = messages.catalogo.manualRef;
  const fil = product.filamentId ? (filamentName ?? manual) : manual;
  const prn = product.printerId ? (printerName ?? manual) : manual;
  return `${fil} · ${prn}`;
}

/** K3 (ADR-0017 §4) — the attention state, DERIVED from the missing references and never stored.
 *  A product born manual (materialized by a kit save) and one degraded by a deletion are the same
 *  honest state, because the remedy is identical: link a saved filament AND printer. It clears the
 *  moment both are linked (SC-412). Deriving it is what keeps the two paths from drifting apart. */
export function productNeedsAttention(product: ProductOut): boolean {
  return product.filamentId === null || product.printerId === null;
}
