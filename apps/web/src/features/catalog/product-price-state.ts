import type { ProductOut } from "@/shared/api/generated";

// 019/PR-D (T076, prancheta 17c) — o estado "custo hoje > fixado" é PRÓPRIO, e não reusa
// `productNeedsAttention` (entities/catalog/product-summary.ts) de propósito: aquele é sobre uma
// REFERÊNCIA ausente (impedimento — "parado"); este é sobre uma ESCOLHA do vendedor (fixar) que
// ficou atrás do custo recomputado hoje. Os dois podem coexistir sem se confundir.
export function productPriceOverFixed(
    product: Pick<ProductOut, "sellerFixedPrice">,
    recomputedToday: number | undefined,
): boolean {
    if (product.sellerFixedPrice == null || recomputedToday === undefined) return false;
    const fixed = Number(product.sellerFixedPrice);
    if (!Number.isFinite(fixed)) return false;
    return recomputedToday > fixed;
}
