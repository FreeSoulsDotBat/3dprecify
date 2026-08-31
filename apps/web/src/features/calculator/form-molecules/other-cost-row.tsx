// `OtherCostRow` — one "Outros custos" name+value row, extracted verbatim from calculator-form.tsx
// (019-polish readability split, no behavior change).
import { type Control, Controller } from "react-hook-form";

import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Field, NumberField } from "@/shared/ui";

const t = messages.calculator;

/** One "Outros custos" row (US5): a free-text name + a currency value, wired to `otherCosts.{i}`. The
 *  value error comes from the per-row model outcome (not RHF), so a bad row flags itself while the
 *  price still computes from the valid rows (FR-116). A blank name is accepted (neutral placeholder). */
export function OtherCostRow({
    control,
    index,
    error,
    onRemove,
}: {
    control: Control<CalcFormValues>;
    index: number;
    error?: string;
    onRemove: (index: number) => void;
}) {
    // The per-row labels are omitted (they'd repeat down the list — homologation nit); the name's
    // placeholder + the value's R$ affix carry the meaning, and each input keeps an `aria-label` so the
    // control is still named for assistive tech. The name column is wider than the value (3:2) so longer
    // names ("Frete até a transportadora") truncate less while the money field stays comfortably usable.
    return (
        <div className="flex items-end gap-2" data-testid="other-cost-row">
            <Controller
                control={control}
                name={`otherCosts.${index}.name` as const}
                render={({ field }) => (
                    <Field className="flex-[3]">
                        {(p) => (
                            <div className="tf-inputwrap">
                                <input
                                    {...p}
                                    type="text"
                                    className="tf-input"
                                    aria-label={t.outrosCustos.name}
                                    placeholder={t.outrosCustos.namePlaceholder}
                                    name={field.name}
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            </div>
                        )}
                    </Field>
                )}
            />
            <Controller
                control={control}
                name={`otherCosts.${index}.value` as const}
                render={({ field }) => (
                    <Field className="flex-[2]" error={error}>
                        {(p) => (
                            <NumberField
                                {...p}
                                currency
                                aria-label={t.outrosCustos.value}
                                name={field.name}
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                error={Boolean(error)}
                            />
                        )}
                    </Field>
                )}
            />
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                aria-label={t.outrosCustos.removeCost}
            >
                ✕
            </Button>
        </div>
    );
}
