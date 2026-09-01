// `SurchargeCheckbox` — one catalog-driven optional surcharge toggle, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import { type Control, Controller } from "react-hook-form";

import { formatBRL } from "@/features/calculator/calculator-model";
import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import type { OptionalSurcharge } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDatePtBr } from "@/shared/lib/format-date";
import { Switch } from "@/shared/ui";

import { captionText } from "../form-atoms/form-styles";

const t = messages.calculator;

/**
 * Um interruptor de sobretaxa opcional, dirigido pelo catálogo — nada aqui nomeia a sobretaxa.
 * Nunca marcado ⇒ o id nunca entra no array, byte-idêntico ao que havia antes deste eixo.
 *
 * ⚠ @doc DEC-093 — `Switch` do DS e não checkbox nativo: o nativo tinha 13×13px, bem abaixo do
 *   alvo de toque de 44×44px que todo outro controle garante.
 */
export function SurchargeCheckbox({
    control,
    index,
    surcharge,
}: {
    control: Control<CalcFormValues>;
    index: number;
    surcharge: OptionalSurcharge;
}) {
    const t2 = t.channels.surcharges;
    return (
        <Controller
            control={control}
            name={`channels.${index}.surcharges` as const}
            render={({ field }) => {
                const checked = (field.value ?? []).includes(surcharge.id);
                const inputId = `surcharge-${index}-${surcharge.id}`;
                return (
                    <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2" htmlFor={inputId}>
                            <Switch
                                id={inputId}
                                checked={checked}
                                onCheckedChange={(next) => {
                                    const current: string[] = field.value ?? [];
                                    field.onChange(
                                        next
                                            ? [...current, surcharge.id]
                                            : current.filter((id) => id !== surcharge.id),
                                    );
                                }}
                                onBlur={field.onBlur}
                            />
                            <span>{surcharge.label}</span>
                        </label>
                        <p style={captionText}>
                            {t2.perOrderCaption.replace("{value}", formatBRL(surcharge.value))}
                            {" · "}
                            {t2.provenance
                                .replace("{source}", surcharge.source)
                                .replace("{date}", formatDatePtBr(surcharge.effectiveDate))}
                        </p>
                    </div>
                );
            }}
        />
    );
}
