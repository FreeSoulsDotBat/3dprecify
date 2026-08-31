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

/** One catalog-driven optional surcharge toggle (016/US16, FR-923, ADR-0027 §3.2) — Shopee
 *  "Item volumoso" today, but nothing here names it: label, value and provenance all come from
 *  `surcharge` (the catalog entry `channelFieldPlan.surcharges` carries). Checked → the id joins
 *  `channels.{index}.surcharges`; unchecked/never checked → the array never gets the id, which is
 *  byte-identical to every calculation before this axis existed (US16-AC2).
 *
 *  016/PR-F homologação (A2) — was a raw `<input type="checkbox">`, the ONLY native checkbox in the
 *  codebase and 13×13px, well under the ≥44×44px touch target INV-2 guarantees for every other
 *  control. The DS `Switch` (`shared/ui/switch.tsx`) already carries that contract by construction
 *  (a larger hit area around a smaller visible track) plus the correct dark-theme skin for free — so
 *  this becomes the same on/off semantics on the DS primitive instead of a bespoke small checkbox. */
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
