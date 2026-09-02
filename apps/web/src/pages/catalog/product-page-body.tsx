import { type ComponentProps } from "react";
import { type Control } from "react-hook-form";

import { RecordSnapshotButton, type RecordSource } from "@/features/history/record-snapshot-sheet";
import {
    CostsSection,
    FieldGroup,
    MarketplaceSection,
    OtherCostsSection,
    PriceResults,
} from "@/features/calculator/calculator-form";
import { type CalcOutcome, type ChannelSlotOutcome } from "@/features/calculator/calculator-model";
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

import { EditableSection } from "./product-page-editable-section";

const t = messages.calculator;

// 019/Polish — moved verbatim out of produto-page.tsx: the custos/mercado two-column grid (016/
// PR-B layout, SC-305 with Calcular) + the results/record/save-scenario footer. Pure JSX
// extraction — every prop is exactly what the render already closed over; no state/effect moved.

export function ProductFormGrid({
    active,
    control,
    otherCostFields,
    otherCostErrors,
    onAppendOtherCost,
    onRemoveOtherCost,
    marketplaceSectionProps,
    channelOutcomes,
}: {
    active: boolean;
    control: Control<CalcFormValues>;
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
                <EditableSection active={active}>
                    {/* 016/PR-C (US6/US7/US8/US9) — see calcular-page.tsx: SAME body, SAME components,
                so this route stays byte-identical to Calcular (SC-305). */}
                    <CostsSection control={control} fields={COST_FIELDS} />
                    <FieldGroup
                        control={control}
                        title={t.sections.labor}
                        info={t.sectionInfo.labor}
                        fields={LABOR_AND_FINISH_FIELDS}
                    />
                    <OtherCostsSection
                        control={control}
                        fields={otherCostFields}
                        errors={otherCostErrors}
                        onAppend={onAppendOtherCost}
                        onRemove={onRemoveOtherCost}
                    />
                </EditableSection>
            </div>
            <div className="tf-calc-grid__col">
                <EditableSection active={active}>
                    <FieldGroup
                        control={control}
                        title={t.sections.markup}
                        info={t.sectionInfo.markup}
                        fields={MARKUP_FIELDS}
                    />
                    <MarketplaceSection
                        {...marketplaceSectionProps}
                        channelOutcomes={channelOutcomes}
                    />
                </EditableSection>
            </div>
        </div>
    );
}

export function ProductFooter({
    result,
    values,
    channelOutcomes,
    recordSource,
    editing,
    input,
}: {
    result: CalcOutcome["result"];
    values: CalcFormValues;
    channelOutcomes: ChannelSlotOutcome[];
    recordSource: RecordSource | null;
    editing: { id: string; name: string } | undefined;
    input: CalcOutcome["input"];
}) {
    return (
        <div className="tf-calc-footer">
            {result ? (
                <PriceResults result={result} values={values} channelOutcomes={channelOutcomes} />
            ) : (
                <Alert tone="danger">{t.invalidNote}</Alert>
            )}

            {/* Record the on-screen price as a frozen snapshot, tagged with this product as its
            origin (US3/T019). Present only for a premium seller on a saved product with a valid
            live price. */}
            {recordSource && <RecordSnapshotButton source={recordSource} />}

            {/* 010/T021b (E5, PR-B) — save a scenario referencing THIS saved product (closes FR-606a
            on the UI side): `buildScenarioConfig`'s `productRef` captures `costBasis.kind =
            "PRODUCT"` instead of AD_HOC, so the D3/D6 lifecycle (T011 server re-snapshot, T022
            read-time resolve) applies on reopen. Offered only on a SAVED product with a valid
            live price — a new/unsaved product has no id to reference yet (mirrors `recordSource`
            above). */}
            {editing && result && input && (
                <div className="flex justify-center">
                    <SaveScenarioSheet
                        source={{
                            buildConfig: () =>
                                buildScenarioConfig({
                                    values,
                                    channelOutcomes,
                                    parsedInput: input,
                                    productRef: { id: editing.id, name: editing.name },
                                }),
                            basisLabel: `${editing.name} (${messages.scenarios.basisKindProduct})`,
                        }}
                    />
                </div>
            )}
        </div>
    );
}
