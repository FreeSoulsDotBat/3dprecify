// `ControlledField` (+ its RHF-bound body) — one controlled numeric input, extracted verbatim
// from calculator-form.tsx (019-polish readability split, no behavior change).
import {
    type Control,
    Controller,
    type ControllerFieldState,
    type ControllerRenderProps,
} from "react-hook-form";

import type { CalcFieldMeta, CalcFormValues } from "@/features/calculator/calculator-schema";
import { useAvisoDeCampo } from "@/shared/lib/use-aviso-de-campo";
import { Field, InfoTip, NumberField } from "@/shared/ui";

import { CampoAviso } from "../form-atoms/campo-aviso";

/** 019/PR-C (T056) — o corpo de `ControlledField`, extraído em componente PRÓPRIO (nome maiúsculo)
 *  para que `useAvisoDeCampo` (um hook de verdade — `useRef`/`useState`/zustand) seja chamado
 *  dentro de um function component reconhecido pelo `react-hooks/rules-of-hooks`, e não dentro do
 *  `render` do `<Controller>` (uma função qualquer, ainda que chamada de forma estável a cada
 *  render — o lint não sabe disso). */
function ControlledFieldBody({
    meta,
    field,
    fieldState,
}: {
    meta: CalcFieldMeta;
    field: ControllerRenderProps<CalcFormValues, CalcFieldMeta["name"]>;
    fieldState: ControllerFieldState;
}) {
    const aviso = useAvisoDeCampo(meta.name, String(field.value ?? ""), Boolean(fieldState.error));
    return (
        // 019/PR-C (T056, prancheta 14f) — o `<Aviso>` é IRMÃO do `Field`, dentro do mesmo wrapper de
        // célula: num grid `auto-fit` (`.tf-costs-grid`), cada filho DIRETO é um item — dois elementos
        // soltos aqui viraria duas células, e o aviso empurraria o campo vizinho em vez de crescer
        // dentro da própria célula.
        <div className="calc-field-cell">
            <Field
                label={meta.label}
                labelAddon={meta.tip && <InfoTip label={meta.tip.label}>{meta.tip.body}</InfoTip>}
                required={meta.required}
                optional={!meta.required}
                hint={meta.hint}
                error={fieldState.error?.message}
            >
                {(p) => (
                    <NumberField
                        {...p}
                        currency={meta.currency}
                        unit={meta.unit}
                        precision={meta.precision}
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={() => {
                            field.onBlur();
                            aviso.onBlur();
                        }}
                        ref={field.ref}
                        error={Boolean(fieldState.error)}
                    />
                )}
            </Field>
            <CampoAviso aviso={aviso} testId={`aviso-${meta.name}`} />
        </div>
    );
}

/** One controlled numeric input wired to RHF + the DS Field/NumberField. 016/US6 (FR-908,
 *  homologação B4) — when `meta.tip` is set, an InfoTip `?` renders on the LABEL ROW, à direita do
 *  rótulo (US6-AC1) — a `labelAddon`, never sharing the control row with the input (that was the
 *  B4 finding: the tip competed with a wide unit affix like "/kWh" for the same cramped row at
 *  360/390px, and shrank "Tarifa de energia" to 1px of visible input). It never touches
 *  `field.value`/`onChange` (US6-AC3). */
export function ControlledField({
    control,
    meta,
}: {
    control: Control<CalcFormValues>;
    meta: CalcFieldMeta;
}) {
    return (
        <Controller
            control={control}
            name={meta.name}
            render={({ field, fieldState }) => (
                <ControlledFieldBody meta={meta} field={field} fieldState={fieldState} />
            )}
        />
    );
}
