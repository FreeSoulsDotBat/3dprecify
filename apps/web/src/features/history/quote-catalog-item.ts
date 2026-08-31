import { computeQuote, type QuoteLineInput } from "@3dprecify/pricing-core";

import type { FrozenProvenance } from "@/entities/history/frozen-payload";
import type { BomOut, ProductOut } from "@/shared/api/generated";

// Tipos e helpers do item do catálogo compartilhados entre `quote-builder.tsx` e os dois passos
// extraídos (`quote-item-picker.tsx`/`quote-review.tsx`) — vivem num arquivo à parte para que os
// três se importem sem ciclo (o orquestrador e os passos precisam do MESMO vocabulário).

export type QuoteCatalogItem =
    { kind: "PRODUCT"; product: ProductOut } | { kind: "KIT"; kit: BomOut };

/** O que a PAGE devolve para cada item do catálogo: as linhas já resolvidas pelo motor (sem
 *  `channels` — venda DIRETA, Q6), de onde vieram (para o documento congelado), se alguma peça do
 *  kit está degradada (D6) e se o item está PARADO (K3) e não pode ser orçado hoje. */
export interface QuoteLineInputResult {
    lines: QuoteLineInput[];
    origin: FrozenProvenance | null;
    degraded: boolean;
    stopped: boolean;
}

export function itemId(item: QuoteCatalogItem): string {
    return item.kind === "PRODUCT" ? item.product.id : item.kit.id;
}
export function itemName(item: QuoteCatalogItem): string {
    return item.kind === "PRODUCT" ? item.product.name : item.kit.name;
}

/** O preço base de UM item (sem desconto), usado só como leitura no passo "select" (18b). O
 *  `catch { baseTotal = 0 }` é um bug conhecido REGISTRADO (dod-evidence B1) — NÃO corrigido aqui,
 *  só movido para um nome. */
export function itemBaseTotal(result: QuoteLineInputResult | null | undefined): number {
    let baseTotal = 0;
    if (result && result.lines.length > 0) {
        try {
            baseTotal = computeQuote({ lines: result.lines }).netTotal;
        } catch {
            baseTotal = 0;
        }
    }
    return baseTotal;
}
