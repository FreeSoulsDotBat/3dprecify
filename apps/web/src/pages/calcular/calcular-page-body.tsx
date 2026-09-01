import { type ComponentProps } from "react";
import { type Control } from "react-hook-form";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { freezePriceResult, type FrozenProvenance } from "@/entities/history/frozen-payload";
import { RecordSnapshotButton } from "@/features/history/record-snapshot-sheet";
import {
    CostsSection,
    FieldGroup,
    MarketplaceSection,
    OtherCostsSection,
    PriceResults,
} from "@/features/calculator/calculator-form";
import { type ChannelSlotOutcome, type CalcOutcome } from "@/features/calculator/calculator-model";
import { buildScenarioConfig } from "@/features/calculator/scenario-bridge";
import {
    type CalcFormValues,
    COST_FIELDS,
    LABOR_AND_FINISH_FIELDS,
    MARKUP_FIELDS,
} from "@/features/calculator/calculator-schema";
import { SaveScenarioSheet } from "@/features/scenarios/save-scenario-sheet";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert } from "@/shared/ui";

const t = messages.calculator;

// 019/Polish — moved verbatim out of calcular-page.tsx: the two-column input grid + the results/
// save/record footer (016/PR-B/PR-C layout + 010/T010 + 009/T010 blocks). Pure JSX extraction —
// every prop is exactly what the render already closed over; no state/effect moved.

export function CalculatorGrid({
    control,
    marketplaceEntitled,
    otherCostFields,
    otherCostErrors,
    onAppendOtherCost,
    onRemoveOtherCost,
    marketplaceSectionProps,
    channelOutcomes,
}: {
    control: Control<CalcFormValues>;
    marketplaceEntitled: boolean;
    otherCostFields: Array<{ id: string }>;
    otherCostErrors: CalcOutcome["otherCostErrors"];
    onAppendOtherCost: () => void;
    onRemoveOtherCost: (index: number) => void;
    marketplaceSectionProps: Omit<ComponentProps<typeof MarketplaceSection>, "channelOutcomes">;
    channelOutcomes: ChannelSlotOutcome[];
}) {
    return (
        <div className="tf-calc-grid">
            <div className="tf-calc-grid__col">
                {/* 016/PR-C (US6/US7/US8/US9) — "Custos da peça" now carries the fused
              MANDATORY+OPTIONAL fields, the h+min time input and the machine-cost question; the
              old separate "Ajustes opcionais" section is gone (US9-AC2). */}
                <CostsSection control={control} fields={COST_FIELDS} />
                <FieldGroup
                    control={control}
                    title={t.sections.labor}
                    info={t.sectionInfo.labor}
                    fields={LABOR_AND_FINISH_FIELDS}
                />
                {marketplaceEntitled && (
                    <OtherCostsSection
                        control={control}
                        fields={otherCostFields}
                        errors={otherCostErrors}
                        onAppend={onAppendOtherCost}
                        onRemove={onRemoveOtherCost}
                    />
                )}
            </div>
            <div className="tf-calc-grid__col">
                <FieldGroup
                    control={control}
                    title={t.sections.markup}
                    info={t.sectionInfo.markup}
                    fields={MARKUP_FIELDS}
                />
                {!marketplaceEntitled && (
                    <OtherCostsSection
                        control={control}
                        fields={otherCostFields}
                        errors={otherCostErrors}
                        onAppend={onAppendOtherCost}
                        onRemove={onRemoveOtherCost}
                    />
                )}
                {/* (6) Marketplace — one slot per channel (add/remove); each channel's grossed-up
              anúncio + líquido for varejo e atacado are read together in the footer's "Como
              chegamos no preço" (US1, fused per US5). PREMIUM keeps this nested here, exactly
              where it always was — the free GATE moves out below instead (R3). */}
                {marketplaceEntitled && (
                    <MarketplaceSection
                        {...marketplaceSectionProps}
                        channelOutcomes={channelOutcomes}
                    />
                )}
            </div>
            {!marketplaceEntitled && (
                <div className="tf-calc-grid__full">
                    <MarketplaceSection {...marketplaceSectionProps} channelOutcomes={[]} />
                </div>
            )}
        </div>
    );
}

export function CalculatorFooter({
    result,
    values,
    channelOutcomes,
    marketplaceEntitled,
    input,
    loadedScenario,
    scenarioProvenance,
}: {
    result: CalcOutcome["result"];
    values: CalcFormValues;
    channelOutcomes: ChannelSlotOutcome[];
    marketplaceEntitled: boolean;
    input: CalcOutcome["input"];
    loadedScenario: { config: ScenarioConfig } | null;
    scenarioProvenance: FrozenProvenance | null;
}) {
    return (
        <div className="tf-calc-footer">
            {result ? (
                <PriceResults
                    result={result}
                    values={values}
                    channelOutcomes={marketplaceEntitled ? channelOutcomes : []}
                />
            ) : (
                <Alert tone="danger">{t.invalidNote}</Alert>
            )}

            {/* 010/T010 (E5, PR-A US1) — "Salvar cenário": PREMIUM-ONLY inline, directly below "Preços
            por canal" (ux §2.1), beside the existing freemium caption. `SaveScenarioSheet` mirrors
            `RecordSnapshotButton` and returns null without an active entitlement — the free
            calculator stays byte-untouched (SC-109), the honest door is "Meus cenários" above. */}
            <div className="flex justify-center">
                <SaveScenarioSheet
                    source={{
                        disabled: !result || !input,
                        buildConfig: () =>
                            buildScenarioConfig({
                                values,
                                channelOutcomes,
                                parsedInput: input,
                            }),
                        basisLabel: messages.scenarios.basisKindAdhoc,
                    }}
                />
            </div>

            {/* 009/T010 — record what you are quoting (US1). Below the results, beside the freemium
            note: the offer sits exactly where the value is. Owner decision Q15 (2026-07-13): the
            button is PREMIUM-ONLY and simply ABSENT otherwise — no teaser trigger here
            (`RecordSnapshotButton` returns null), so the free calculator stays literally untouched
            (SC-109 / SC-507 / SC-512). The honest door is the Histórico tab.
            010/T036 (E5, PR-C, US7) — suppressed while a KIT-basis scenario is loaded: these
            calculator fields are NOT what is on screen then (`KitBasisSummary`'s own rollup is),
            so freezing them would record numbers the seller never saw; its own record button
            lives with the rollup above. An AD_HOC/PRODUCT-basis scenario reuses this SAME button
            — its provenance is simply `scenarioProvenance` instead of `null` ("originou-se do
            cenário X"). */}
            {result && input && loadedScenario?.config.costBasis.kind !== "KIT" && (
                <div className="flex justify-center">
                    <RecordSnapshotButton
                        source={{
                            kind: "SINGLE",
                            freeze: () => freezePriceResult(input, result, scenarioProvenance),
                        }}
                    />
                </div>
            )}
        </div>
    );
}
