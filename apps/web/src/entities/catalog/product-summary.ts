import type { ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// US6/T030 — the Produtos list-row summary (ux §1.1): the reference NAMES, never a price
// (FR-310 — a row price would imply a stored snapshot). A degraded reference reads as manual.

/** Whether the sibling filament/printer caches are still loading (FB-04) — while loading, an
 *  unresolved reference must show a neutral placeholder, never "manual": a loading reference is
 *  indistinguishable from a genuinely manual one only if you ignore data provenance. */
export interface ReferenceLoadState {
    filaments: boolean;
    printers: boolean;
}

export function productSummary(
    product: ProductOut,
    filamentName?: string,
    printerName?: string,
    loading: ReferenceLoadState = { filaments: false, printers: false },
): string {
    const manual = messages.catalogo.manualRef;
    const resolving = messages.catalogo.resolvingRef;
    const fil = product.filamentId
        ? (filamentName ?? (loading.filaments ? resolving : manual))
        : manual;
    const prn = product.printerId
        ? (printerName ?? (loading.printers ? resolving : manual))
        : manual;
    return `${fil} · ${prn}`;
}

/** K3 (ADR-0017 §4) — the attention state, DERIVED from the missing references and never stored.
 *  A product born manual (materialized by a kit save) and one degraded by a deletion are the same
 *  honest state, because the remedy is identical: link a saved filament AND printer. It clears the
 *  moment both are linked (SC-412). Deriving it is what keeps the two paths from drifting apart. */
export function productNeedsAttention(product: ProductOut): boolean {
    return product.filamentId === null || product.printerId === null;
}
