// `FieldGroup` — a titled grid of controlled fields, extracted verbatim from calculator-form.tsx
// (019-polish readability split, no behavior change).
import type { Control } from "react-hook-form";

import type { CalcFieldMeta, CalcFormValues } from "@/features/calculator/calculator-schema";
import { Card } from "@/shared/ui";

import { captionText, gridCard } from "../form-atoms/form-styles";
import { SectionTitle } from "../form-atoms/section-title";
import { ControlledField } from "../form-molecules/controlled-field";

/** A titled grid of controlled fields, with an ⓘ info tip on the section title. */
export function FieldGroup({
    control,
    title,
    info,
    hint,
    fields,
}: {
    control: Control<CalcFormValues>;
    title: string;
    info: { label: string; body: string };
    hint?: string;
    fields: readonly CalcFieldMeta[];
}) {
    return (
        <div className="flex flex-col gap-2">
            <SectionTitle title={title} info={info} />
            {hint && <p style={captionText}>{hint}</p>}
            <Card padding="md" style={gridCard}>
                {fields.map((meta) => (
                    <ControlledField key={meta.name} control={control} meta={meta} />
                ))}
            </Card>
        </div>
    );
}
