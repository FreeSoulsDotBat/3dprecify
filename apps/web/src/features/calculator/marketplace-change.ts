import type { UseFormSetValue } from "react-hook-form";

import type { FeeCatalog } from "@/shared/fee-catalog";

import { feeFieldsToBlankOnMarketplaceChange } from "./channel-field-plan";
import {
    type CalcFormValues,
    type ChannelFieldName,
    type MarketplaceId,
    slotResetOnMarketplaceChange,
} from "./calculator-schema";

// 019/Polish — this handler was triplicated verbatim across `calcular-page.tsx`, `produto-page.tsx`
// and `widgets/bom-line-editor/bom-line-editor.tsx`. Switching a slot's marketplace resets its
// modality to that market's default (or none), so a stale ML "Clássico" never lingers on a Shopee
// slot; it also blanks exactly the fee fields the NEW marketplace's plan does not show (016/US11,
// T044 homologação PR-E, RA5) — a field the new plan still shows keeps its value.
//
// B2 (CORRIGIDO 2026-09-01, decisão do dono): a troca de marketplace REVALIDA, nas três telas.
// Antes só a calculadora passava `{ shouldValidate: true }` — nas outras duas, um erro antigo
// ("comissão inválida") continuava exibido depois que a troca já havia limpado o campo, até o
// próximo toque. Não era decisão de ninguém: eram três cópias que divergiram. A revalidação agora
// é da FUNÇÃO, não do chamador — não há mais parâmetro para um sítio esquecer.
export function applyMarketplaceChange(
    setValue: UseFormSetValue<CalcFormValues>,
    catalog: FeeCatalog,
    index: number,
    marketplace: MarketplaceId,
): void {
    const opts = { shouldValidate: true } as const;
    // 014/T097 — modality AND category: the category belongs to the OLD marketplace's taxonomy.
    const next = slotResetOnMarketplaceChange(marketplace);
    setValue(`channels.${index}.modality`, next.modality, opts);
    setValue(`channels.${index}.category`, next.category, opts);
    // 016/PR-F (US17, FR-926) — sellerProfile/volumoso são PER MARKETPLACE, mesma razão da categoria.
    setValue(`channels.${index}.sellerType`, next.sellerType, opts);
    setValue(`channels.${index}.highVolume`, next.highVolume, opts);
    setValue(`channels.${index}.surcharges`, next.surcharges, opts);
    for (const [field, value] of Object.entries(
        feeFieldsToBlankOnMarketplaceChange(catalog, marketplace),
    )) {
        setValue(`channels.${index}.${field as ChannelFieldName}` as const, value, opts);
    }
}
