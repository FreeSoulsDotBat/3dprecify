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
