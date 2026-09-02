import type { PriceInput } from "@3dprecify/pricing-core";

import { productNeedsAttention } from "@/entities/catalog/product-summary";
import { computeFromForm, type CatalogContext } from "@/features/calculator/calculator-model";
import { productToForm } from "@/features/calculator/product-mapping";
import type { QuoteCatalogItem, QuoteLineInputResult } from "@/features/history/quote-builder";

import { bomLineToInput } from "./recalc-today";

// 019/PR-E (T088) — a PONTE entre o Catálogo e o construtor de orçamento (decisão de fronteira do
// dispatch T088, precedente T124 da PR-D). `features/history` não importa `features/calculator`
// nem `features/bom` (eslint-boundaries) — é a PAGE quem os junta, exatamente como
// `pages/catalog/catalog-page.tsx` já faz para o recálculo (T124) e como `recalc-today.tsx`
// (mesma pasta) já lê D3/D6 para o kit congelado. O caminho do KIT reusa `bomLineToInput`
// LITERALMENTE (mesma leitura "servidor já resolveu, vinculada ou não"); o do PRODUTO usa
// `productToForm`/`computeFromForm` direto, porque um `ProductOut` já É a forma que eles pedem —
// não precisa do disfarce de "linha de kit" para chegar lá.

/** O input já resolvido, MENOS `channels` — um orçamento é venda DIRETA (Q6, ADR-0034 §1.1);
 *  `computeQuote` recusa `channels` em runtime, então a fronteira mora aqui, não na tela. */
function directSale(input: PriceInput): PriceInput {
    return { ...input, channels: undefined };
}

/** Follow-up registrado (T088): três telas (`catalogo-page`, `recalc-today`, este arquivo) já
 *  reimplementam o caminho "ProductOut/linha de kit → PriceInput via productToForm+computeFromForm".
 *  Descer esse mapeamento para `entities/catalog` (puro, sem hooks) removeria a triplicação — fica
 *  para o arquiteto avaliar; não decidido aqui (Princípio VIII). */
export function toLineInput(
    item: QuoteCatalogItem,
    ctx: CatalogContext,
): QuoteLineInputResult | null {
    if (item.kind === "PRODUCT") {
        const { product } = item;
        const origin = { kind: "PRODUCT" as const, id: product.id, name: product.name };
        // K3 — referência ausente: preço PARADO, não entra no orçamento (18b).
        if (productNeedsAttention(product)) {
            return { lines: [], origin, degraded: false, stopped: true };
        }
        const { values } = productToForm(product);
        const outcome = computeFromForm(values, ctx);
        if (!outcome.input) return { lines: [], origin, degraded: false, stopped: false };
        // ADR-0033 §3 — o preço declarado pelo vendedor no Catálogo nunca entra aqui: o preço do
        // orçamento é sempre o do MOTOR (`computeFromForm`, não uma leitura do produto).
        return {
            lines: [{ input: directSale(outcome.input), quantity: 1, name: product.name }],
            origin,
            degraded: false,
            stopped: false,
        };
    }

    const { kit } = item;
    let anyDegraded = false;
    const lines: QuoteLineInputResult["lines"] = [];
    for (const line of kit.lines) {
        if (line.degraded) anyDegraded = true;
        const input = bomLineToInput(line, ctx);
        if (!input) continue;
        lines.push({
            input: directSale(input),
            quantity: line.quantity,
            // D6 (ADR-0017 §6) — sem vínculo, sem nome: o motor não inventa rótulo, e a tela mostra
            // "(avulsa)" quando `name` chega `undefined` (mesma regra de `bom-line-card.tsx`).
            name: line.pieceName ?? undefined,
        });
    }
    return {
        lines,
        origin: { kind: "KIT", id: kit.id, name: kit.name },
        degraded: anyDegraded,
        stopped: false,
    };
}
