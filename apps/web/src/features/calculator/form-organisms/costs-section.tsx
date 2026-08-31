// `CostsSection` — "Custos da peça": the fused cost grid + time + machine-cost fields, extracted
// verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import type { Control } from "react-hook-form";

import type { CalcFieldMeta, CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Card } from "@/shared/ui";

import { SectionTitle } from "../form-atoms/section-title";
import { ControlledField } from "../form-molecules/controlled-field";
import { TimeHmField } from "../form-molecules/time-hm-field";
import { MachineCostFields } from "./machine-cost-fields";

const t = messages.calculator;

/** 016/US9 (FR-911) — "Custos da peça": COST_FIELDS (the fused mandatory + optional grid) +
 *  TimeHmField (US7) + MachineCostFields (US8), all inside the SAME card — "Ajustes opcionais" no
 *  longer exists as its own titled section. */
export function CostsSection({
    control,
    fields,
}: {
    control: Control<CalcFormValues>;
    fields: readonly CalcFieldMeta[];
}) {
    return (
        <div className="flex flex-col gap-2">
            <SectionTitle title={t.sections.inputs} info={t.sectionInfo.inputs} />
            <Card padding="md" className="flex flex-col gap-4">
                {/* 016/PR-C homologação (B4) — `.tf-costs-grid`, not the hard `gridCard` 1fr-1fr: see
            calculator-form.css for why (the "Tarifa de energia" 1px clip). */}
                <div className="tf-costs-grid">
                    {fields.map((meta) => (
                        <ControlledField key={meta.name} control={control} meta={meta} />
                    ))}
                </div>
                <TimeHmField control={control} />
                <MachineCostFields control={control} />
            </Card>
        </div>
    );
}
