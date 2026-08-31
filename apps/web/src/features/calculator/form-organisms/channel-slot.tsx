// `ChannelSlot` — one editable channel slot (marketplace + determinants + fee grid + honesty
// seal), extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior
// change).
import { type Control, Controller } from "react-hook-form";

import {
    isUnpriced,
    type ChannelSlotOutcome,
    formatBRL,
} from "@/features/calculator/calculator-model";
import { CategoryPicker } from "@/features/calculator/category-picker";
import { channelFieldPlan } from "@/features/calculator/channel-field-plan";
import {
    CHANNEL_FEE_FIELDS,
    type CalcFormValues,
    type ChannelSlotForm,
    type MarketplaceId,
    MARKETPLACE_OPTIONS,
} from "@/features/calculator/calculator-schema";
import { FeeSeal, FixedFeeSourceBadge } from "@/features/calculator/fee-seal";
import {
    ShopeeMeasuredFreightWarning,
    ShopeeRegressiveFeeWarning,
} from "@/features/calculator/shopee-warnings";
import {
    type CategoryNode,
    type FeeCatalog,
    resolveFreightSubsidyCeiling,
} from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDatePtBr } from "@/shared/lib/format-date";
import { Button, Card, Field, Select } from "@/shared/ui";

import { captionText, gridCard } from "../form-atoms/form-styles";
import { ChannelFeeField } from "../form-molecules/channel-fee-field";
import { SurchargeCheckbox } from "../form-molecules/surcharge-checkbox";

const t = messages.calculator;

/** One editable channel slot: marketplace + the determinants `channelFieldPlan` says this
 *  marketplace has (a modality SELECT, a category picker — both, one, or neither), the manual fee
 *  grid restricted to the axes the catalog declares, and a remove control. Changing the marketplace
 *  resets the modality to that market's default. 016/US12 (T052, FR-918) — this used to infer BOTH
 *  the modality select AND the category picker from `modalityOptions.length > 0` (the F1 defect):
 *  the plan now decides each independently from the catalog, and RA5 means `slotDeterminants`
 *  (fee-prefill.ts) reads the exact same shape when it decides what is SENT. */
export function ChannelSlot({
    control,
    index,
    slot,
    outcome,
    spine,
    catalog,
    onRemove,
    onMarketplaceChange,
}: {
    control: Control<CalcFormValues>;
    index: number;
    slot: ChannelSlotForm;
    outcome?: ChannelSlotOutcome;
    /** This marketplace's category spine (empty when it has no category axis, or not loaded yet). */
    spine: readonly CategoryNode[];
    catalog: FeeCatalog;
    onRemove: (index: number) => void;
    onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
}) {
    const plan = channelFieldPlan(catalog, slot.marketplace);
    const modalityDeterminant = plan.determinants.find((d) => d.kind === "SELECT");
    const hasCategoryDeterminant = plan.determinants.some((d) => d.kind === "CATEGORY_PICKER");
    // 016/US11 (T044 homologação PR-E, bloqueador) — the render-side half of the fix: a field renders
    // if the PLAN shows it OR it already carries a value. The second clause is what makes a saved
    // scenario safe — reopening one saved BEFORE this marketplace's plan dropped a field (e.g. a
    // Shopee "Frete" typed before an Amazon switch that never fires `onMarketplaceChange`, since a
    // reopen replaces the whole channel array directly) shows the field, editable/erasable, instead
    // of hiding a number that keeps charging. Never changes the CALCULATION (FR-919): a present value
    // still computes exactly as before — only its visibility is guaranteed.
    const feeFieldMetas = CHANNEL_FEE_FIELDS.filter(
        (meta) => plan.feeFields.includes(meta.name) || slot[meta.name].trim() !== "",
    );
    // hotfix 016/A2 (H2c) — o subsídio de frete da Shopee como INFORMAÇÃO sob o campo "Frete".
    // Dirigido por dado (como o volumoso): renderiza sse o catálogo publica `freightSubsidyInfo` E o
    // slot já tem um anúncio (varejo) para resolver a faixa — nunca um teto genérico sem preço.
    const shopeeSubsidy =
        slot.marketplace === "SHOPEE"
            ? catalog.marketplaces.find((m) => m.marketplace === "SHOPEE")?.freightSubsidyInfo
            : undefined;
    const subsidyCeiling =
        shopeeSubsidy && outcome?.result?.precoAnuncioVarejo != null
            ? resolveFreightSubsidyCeiling(shopeeSubsidy, outcome.result.precoAnuncioVarejo)
            : null;
    return (
        <Card padding="md" className="flex flex-col gap-3" data-testid="channel-slot">
            <div className="flex items-end gap-2">
                <Controller
                    control={control}
                    name={`channels.${index}.marketplace` as const}
                    render={({ field }) => (
                        <Field label={t.channels.marketplace} className="flex-1" tightLabel>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={MARKETPLACE_OPTIONS}
                                    name={field.name}
                                    value={field.value}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        onMarketplaceChange(index, e.target.value as MarketplaceId);
                                    }}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            )}
                        </Field>
                    )}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(index)}
                    aria-label={t.channels.removeChannel}
                >
                    ✕
                </Button>
            </div>
            {modalityDeterminant && (
                <Controller
                    control={control}
                    name={`channels.${index}.modality` as const}
                    render={({ field }) => (
                        <Field label={modalityDeterminant.label} tightLabel>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={modalityDeterminant.options ?? []}
                                    name={field.name}
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            )}
                        </Field>
                    )}
                />
            )}
            {/* 016/US12 — only where the PLAN says this marketplace publishes a category spine, never
          inferred from the modality axis (the F1 defect: Shopee has neither today, which is exactly
          why the old inference worked by coincidence). */}
            {hasCategoryDeterminant && (
                <Controller
                    control={control}
                    name={`channels.${index}.category` as const}
                    render={({ field }) => (
                        <CategoryPicker
                            spine={spine}
                            value={field.value}
                            onChange={(id) => field.onChange(id ?? "")}
                            // FR-006d — the picker's empty state must agree with THIS slot's seal. "none" is the
                            // seal for a slot standing on nothing; anything else (a reference, a catch-all, or a
                            // rate the seller typed himself) means the money is settled and only the name list is
                            // missing. Derived from the seal itself so the two can never drift apart.
                            hasFeeReference={outcome !== undefined && outcome.seal.kind !== "none"}
                        />
                    )}
                />
            )}
            {/* 016/PR-F (US17, FR-926, RA5) — the seller-profile axis, driven by the SAME plan that gates
          `slotDeterminants`. TWO questions, not one generic SELECT: "Você vende como" (empty = not
          answered → catch-all, T057) and, ONLY when CPF, "mais de 450 pedidos?". */}
            {plan.sellerProfile && (
                <>
                    <Controller
                        control={control}
                        name={`channels.${index}.sellerType` as const}
                        render={({ field }) => (
                            <Field label={t.channels.sellerProfile.sellerTypeLabel} tightLabel>
                                {(p) => (
                                    <Select
                                        {...p}
                                        options={[
                                            {
                                                value: "CPF",
                                                label: t.channels.sellerProfile.sellerTypeOptions
                                                    .CPF,
                                            },
                                            {
                                                value: "CNPJ",
                                                label: t.channels.sellerProfile.sellerTypeOptions
                                                    .CNPJ,
                                            },
                                        ]}
                                        placeholder={t.channels.sellerProfile.sellerTypePlaceholder}
                                        name={field.name}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        ref={field.ref}
                                    />
                                )}
                            </Field>
                        )}
                    />
                    {/* 016/PR-F — só perguntado quando CPF (a segunda pergunta de Q6). Um `highVolume`
              respondido antes e deixado para trás ao trocar para CNPJ não é um risco de dinheiro: o
              mapeamento (`resolveShopeeSellerProfile`) só forma o determinante com AMBAS as
              respostas === CPF+SIM, então um valor órfão sob CNPJ nunca é lido (RA5 — a decisão
              mora numa função só, e essa função nunca vê `highVolume` sem `sellerType === "CPF"`). */}
                    {slot.sellerType === "CPF" && (
                        <Controller
                            control={control}
                            name={`channels.${index}.highVolume` as const}
                            render={({ field }) => (
                                <Field label={t.channels.sellerProfile.highVolumeLabel} tightLabel>
                                    {(p) => (
                                        <Select
                                            {...p}
                                            options={[
                                                {
                                                    value: "SIM",
                                                    label: t.channels.sellerProfile
                                                        .highVolumeOptions.SIM,
                                                },
                                                {
                                                    value: "NAO",
                                                    label: t.channels.sellerProfile
                                                        .highVolumeOptions.NAO,
                                                },
                                            ]}
                                            placeholder={
                                                t.channels.sellerProfile.sellerTypePlaceholder
                                            }
                                            name={field.name}
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            ref={field.ref}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                    )}
                </>
            )}
            <div style={gridCard}>
                {feeFieldMetas.map((meta) => (
                    <ChannelFeeField
                        key={meta.name}
                        control={control}
                        index={index}
                        meta={meta}
                        error={outcome?.errors[meta.name]}
                        applied={outcome?.appliedFees[meta.name]}
                    />
                ))}
            </div>
            {/* 016/PR-F homologação (A1 + reverify) — entrada bandada: os placeholders de Comissão/Taxa
          fixa acima mostram a banda que REALMENTE se aplica ao preço da tela, e ela muda se o preço
          mudar de faixa — esta legenda diz isso uma vez, para o slot inteiro. A frase da REGRA
          ("taxa fixa = {pct}% do preço") vive AQUI, em largura total, e não como sufixo do
          placeholder: com 77–187px úteis o sufixo cortava para "2,50 (= 50" — parêntese aberto e um
          número solto, a leitura errada que a frase existia para impedir. O placeholder mostra só o
          valor resolvido; a legenda quebra linha à vontade (medido no reverify, r5-*). */}
            {outcome?.appliedFeesFromBand && (
                <p style={captionText}>
                    {t.channels.bandedFeesCaption}
                    {outcome.appliedFixedFeeRulePct != null &&
                        " " +
                            t.channels.fixedFeeRuleCaption.replace(
                                "{pct}",
                                String(outcome.appliedFixedFeeRulePct),
                            )}
                </p>
            )}
            {/* hotfix 016/A2 (H2c) — o subsídio de frete da Shopee como INFORMAÇÃO, nunca como desconto:
          zero número no código (Constituição II), tudo lido de `freightSubsidyInfo` via
          `resolveFreightSubsidyCeiling`. Fica ao lado da grade de taxas, junto das outras legendas
          do slot — nunca dentro do campo "Frete", que continua sendo a ÚNICA origem de desconto
          (H2/FR-111b). */}
            {shopeeSubsidy && subsidyCeiling !== null && (
                <p style={captionText} data-testid="freight-subsidy-info">
                    {t.channels.freightSubsidy.caption.replace(
                        "{ceiling}",
                        formatBRL(subsidyCeiling),
                    )}{" "}
                    {t.channels.freightSubsidy.provenance
                        .replace("{source}", shopeeSubsidy.source)
                        .replace("{date}", formatDatePtBr(shopeeSubsidy.effectiveDate))}
                </p>
            )}
            {/* 016/US16 (FR-923, ADR-0027 §3.2) — catalog-driven optional surcharges (Shopee
          MANUSEIO_VOLUMOSO). Zero string/number here — label, value and provenance all come from
          `plan.surcharges` (the catalog). */}
            {plan.surcharges.length > 0 && (
                <div className="flex flex-col gap-2">
                    {plan.surcharges.map((s) => (
                        <SurchargeCheckbox
                            key={s.id}
                            control={control}
                            index={index}
                            surcharge={s}
                        />
                    ))}
                </div>
            )}
            {/* Honesty seal (FR-107): where this slot's fees came from + how fresh they are; the ML
          free-shipping subsidy carries its own "estimativa" seal (A4); the fixed fee's OWN
          provenance (016/PR-F, T057) is a SEPARATE block when the entry carries one. 019/PR-C
          (prancheta 13d) — a ORDEM é fixa: bloco da comissão, bloco da taxa fixa, pílulas por
          último (nunca `flex-wrap`, que deixava o selo curto subir e o longo descer). */}
            {outcome && (
                <div className="flex flex-col gap-2">
                    <FeeSeal state={outcome.seal} marketplace={slot.marketplace} />
                    {outcome.fixedFeeSource && (
                        <FixedFeeSourceBadge
                            source={outcome.fixedFeeSource}
                            marketplace={slot.marketplace}
                        />
                    )}
                    {outcome.freightIsEstimate && (
                        <FeeSeal state={{ kind: "estimate" }} marketplace={slot.marketplace} />
                    )}
                </div>
            )}
            {/* 016/US17 (FR-924) — the two honest Shopee warnings. The regressive-fee one fires only where
          the money is real (CPF de alto volume, a base que o motor recusou — I9); the measured-
          freight one is a static, always-visible risk note for any Shopee slot. */}
            {slot.marketplace === "SHOPEE" && (
                <div className="flex flex-col gap-2">
                    {slot.sellerType === "CPF" &&
                        slot.highVolume === "SIM" &&
                        isUnpriced(outcome?.result ?? null) && <ShopeeRegressiveFeeWarning />}
                    <ShopeeMeasuredFreightWarning />
                </div>
            )}
        </Card>
    );
}
