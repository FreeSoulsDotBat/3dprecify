// `OtherCostsSection` — the "Outros custos" slot (US5), extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import type { Control } from "react-hook-form";

import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button } from "@/shared/ui";

import { SectionTitle } from "../form-atoms/section-title";
import { OtherCostRow } from "../form-molecules/other-cost-row";

const t = messages.calculator;

/** The "Outros custos" slot (US5): 0..N named sub-costs the user adds/removes; each value sums into
 *  custo_total and shows its own breakdown line. Sits alongside the labor fields. */
export function OtherCostsSection({
    control,
    fields,
    errors,
    onAppend,
    onRemove,
}: {
    control: Control<CalcFormValues>;
    fields: { id: string }[];
    errors: (string | undefined)[];
    onAppend: () => void;
    onRemove: (index: number) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <SectionTitle title={t.outrosCustos.title} info={t.sectionInfo.outrosCustos} />
            <p className="text-sm text-[var(--text-muted)]">{t.outrosCustos.hint}</p>
            {fields.map((f, i) => (
                <OtherCostRow
                    key={f.id}
                    control={control}
                    index={i}
                    error={errors[i]}
                    onRemove={onRemove}
                />
            ))}
            <Button variant="secondary" size="sm" onClick={onAppend}>
                {t.outrosCustos.addCost}
            </Button>
        </div>
    );
}
