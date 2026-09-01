import type { UseFormSetValue } from "react-hook-form";

import type { FeeCatalog } from "@/shared/fee-catalog";

import { feeFieldsToBlankOnMarketplaceChange } from "./channel-field-plan";
import {
    type CalcFormValues,
    type ChannelFieldName,
    type MarketplaceId,
    slotResetOnMarketplaceChange,
} from "./calculator-schema";

// ⚠ @doc DEC-091 — a revalidação é da FUNÇÃO, não do chamador: as três cópias divergiram e duas
//   deixavam um erro antigo na tela depois que a troca já tinha limpado o campo.
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
