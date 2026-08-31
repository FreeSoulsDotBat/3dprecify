// `TimeHmField` (+ its RHF-bound body) — the h+min printTime border, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import {
    type Control,
    Controller,
    type ControllerFieldState,
    type ControllerRenderProps,
} from "react-hook-form";

import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { decimalHoursToHm, hmToDecimalString } from "@/features/calculator/time-input";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useAvisoDeCampo } from "@/shared/lib/use-aviso-de-campo";
import { Field, NumberField } from "@/shared/ui";

import { CampoAviso } from "../form-atoms/campo-aviso";
import { CampoDeHoras } from "../form-atoms/campo-de-horas";

const t = messages.calculator;

/** 019/PR-C (T056) — o corpo de `TimeHmField`, extraído pela MESMA razão de `ControlledFieldBody`
 *  (`useAvisoDeCampo` precisa de um function component de verdade). O blur do aviso é disparado
 *  tanto pelo campo de horas (`CampoDeHoras`) quanto pelo de minutos — os dois marcam "saí do
 *  campo" para o mesmo `printTimeHours`. */
function TimeHmFieldBody({
    field,
    fieldState,
}: {
    field: ControllerRenderProps<CalcFormValues, "printTimeHours">;
    fieldState: ControllerFieldState;
}) {
    const { h, min } = decimalHoursToHm(field.value);
    const commit = (nextH: number, nextMin: number) => {
        field.onChange(hmToDecimalString(nextH, nextMin));
    };
    // Este campo NÃO passa pelo `ControlledField` (tem controle próprio de h+min), então o aviso
    // precisa ser pedido aqui — e é justamente o caso do achado CF-002-LEIGO-C: 150 no campo de
    // HORAS, quando o vendedor queria dizer 150 minutos, multiplica o custo por 15.
    const aviso = useAvisoDeCampo(
        "printTimeHours",
        String(field.value ?? ""),
        Boolean(fieldState.error),
    );
    const onBlurTime = () => {
        field.onBlur();
        aviso.onBlur();
    };
    return (
        <div className="calc-field-cell">
            <Field
                label={t.fields.printTime}
                required
                hint={undefined}
                error={fieldState.error?.message}
            >
                {() => (
                    <div className="flex items-center gap-2">
                        <CampoDeHoras h={h} min={min} onCommit={commit} onBlurField={onBlurTime} />
                        <NumberField
                            aria-label={t.timeInput.minutesAria}
                            unit={t.timeInput.minutesUnit}
                            inputMode="numeric"
                            placeholder="0"
                            value={String(min)}
                            onChange={(e) => commit(h, Number.parseInt(e.target.value, 10) || 0)}
                            onBlur={onBlurTime}
                        />
                    </div>
                )}
            </Field>
            <CampoAviso aviso={aviso} testId="aviso-printTimeHours" />
        </div>
    );
}

/** 016/US7 (FR-909) — the printTime border: two number inputs (h + min), converted to/from the
 *  SAME decimal the engine has always received (`time-input.ts` owns the pure conversion; the RHF
 *  field value never changes shape). A document saved with a decimal (`5.5`) reopens showing the
 *  derived h+min (`5h 30min`) — the read path is the same helper, not a second rule. */
export function TimeHmField({ control }: { control: Control<CalcFormValues> }) {
    return (
        <Controller
            control={control}
            name="printTimeHours"
            render={({ field, fieldState }) => (
                <TimeHmFieldBody field={field} fieldState={fieldState} />
            )}
        />
    );
}
