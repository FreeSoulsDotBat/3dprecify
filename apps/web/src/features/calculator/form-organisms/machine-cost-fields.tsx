// `MachineCostFields` — the machine-cost question rewrite (estimar/ajustar, 016/US8), extracted
// verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { useState } from "react";
import { type Control, useController } from "react-hook-form";

import {
    costPerHour,
    deriveMachineLifetimeHours,
    detectRitmoMode,
    RITMOS_HORAS_ANO,
    type RitmoIndex,
} from "@/features/calculator/machine-cost";
import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { PAYBACK_YEAR_OPTIONS, RITMO_OPTIONS } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import { useAvisoDeCampo } from "@/shared/lib/use-aviso-de-campo";
import { useIsCalcWide } from "@/shared/lib/use-is-wide";
import { Alert, Button, Field, InfoTip, NumberField, Segmented, Select } from "@/shared/ui";

import { CampoAviso } from "../form-atoms/campo-aviso";
import { sectionLabel } from "../form-atoms/form-styles";
import { fmtHoras, MachineCostReadout } from "../form-molecules/machine-cost-readout";

const t = messages.calculator;

type MachineMode = "estimar" | "ajustar";

/**
 * 016/US8 (FR-910, SC-906) — the machine-cost question rewrite. The seller answers (1) quanto
 * custou (`machineValue`, unchanged) · (2) com que frequência ela roda (3 opções, sem digitar) ·
 * (3) em quantos anos quer que se pague, and the derived `machineLifetimeHours` is said OUT LOUD
 * as a cost/hour caption. "Ajustar" reveals the raw hours field directly (with its own tooltip).
 *
 * Reactivity is derived, not duplicated: `detectRitmoMode(currentHours)` re-runs on every render
 * off the LIVE `machineLifetimeHours` field value, so a scenario/catalog load that calls
 * `setValue("machineLifetimeHours", …)` from OUTSIDE this component is picked up automatically —
 * no stale local copy of ritmo/payback to resync. `manualOverride` only forces "ajustar" open when
 * the seller explicitly asked for it; a lifetime outside every ritmo×payback ALWAYS shows
 * "ajustar" regardless (US8-AC4 — the value the document holds is never silently coerced).
 */
export function MachineCostFields({ control }: { control: Control<CalcFormValues> }) {
    const valueField = useController({ control, name: "machineValue" });
    const lifetimeField = useController({ control, name: "machineLifetimeHours" });
    const [manualOverride, setManualOverride] = useState(false);
    // 019/PR-C (T057, prancheta 15f) — o corte da própria Calculadora (`.tf-calc-grid`, 1024px), não
    // o `useIsWide` de 1280px do resto do app: nenhum dos dois hooks existentes servia a ESTE bloco
    // isoladamente (divergência registrada abaixo do Segmented). `useIsCalcWide` fecha isso.
    const isCalcWide = useIsCalcWide();
    // 019/PR-C (T057, prancheta 15e) — a confirmação inline ao tocar "Estimar" vindo de "Ajustar",
    // com horas fora de todo ritmo × payback. Fica pendente até "Usar {novo} h" (aplica e volta para
    // "Estimar") ou "Manter {atual} h" (fecha sem mudar nada — o segmented continua em "Ajustar",
    // porque `manualOverride` nunca deixou de ser `true`).
    const [pendingConfirm, setPendingConfirm] = useState(false);

    const currentHours = parseDecimal(lifetimeField.field.value);
    const detected = detectRitmoMode(currentHours);
    const adjustMode = manualOverride || detected === null;
    const mode: MachineMode = adjustMode ? "ajustar" : "estimar";
    const ritmoIndex: RitmoIndex = detected?.ritmoIndex ?? 1;
    const paybackYears = detected?.paybackYears ?? 3;

    const applyRitmo = (idx: RitmoIndex, years: number) => {
        lifetimeField.field.onChange(String(deriveMachineLifetimeHours(idx, years)));
    };

    // 019/PR-C (T057, prancheta 15d) — um campo vazio dá `parseDecimal` = NaN, e NaN !== 0: sem este
    // guarda, "falta o valor da máquina" nunca aparecia (a comparação estrita nunca batia) e
    // `formatBRL(NaN)` imprimia "R$ " sem o zero. Vazio e zero são o MESMO caso aqui — os dois não
    // têm valor de máquina a dividir.
    const rawMachineValueNum = parseDecimal(valueField.field.value);
    const machineValueNum = Number.isFinite(rawMachineValueNum) ? rawMachineValueNum : 0;
    const perHour = costPerHour(machineValueNum, currentHours);
    const proposedHours = deriveMachineLifetimeHours(ritmoIndex, paybackYears);
    const anosLabel = (
        paybackYears === 1 ? t.machineCost.paybackYearLabel : t.machineCost.paybackYearsLabel
    ).replace("{n}", String(paybackYears));

    const handleModeChange = (next: MachineMode) => {
        if (next === "ajustar") {
            setManualOverride(true);
            setPendingConfirm(false);
            return;
        }
        if (!adjustMode) return; // já em "estimar" — nada a fazer.
        if (detectRitmoMode(currentHours) !== null) {
            // As horas cruas JÁ são produto de um ritmo × payback — nada seria sobrescrito.
            setManualOverride(false);
            return;
        }
        setPendingConfirm(true);
    };

    const aviso = useAvisoDeCampo(
        "machineLifetimeHours",
        String(lifetimeField.field.value ?? ""),
        Boolean(lifetimeField.fieldState.error),
    );
    const onBlurLifetime = () => {
        lifetimeField.field.onBlur();
        aviso.onBlur();
    };

    return (
        <div className="flex flex-col gap-3">
            <Field label={t.fields.machineValue} required>
                {(p) => (
                    <NumberField
                        {...p}
                        currency
                        name={valueField.field.name}
                        value={valueField.field.value}
                        onChange={valueField.field.onChange}
                        onBlur={valueField.field.onBlur}
                        ref={valueField.field.ref}
                    />
                )}
            </Field>

            {/* 019/PR-C (T057, prancheta 15f, decisão do dono 28/08) — a divergência registrada
          anteriormente (nenhum dos dois hooks existentes servia a ESTE bloco) fecha com
          `useIsCalcWide` (o corte de 1024px do próprio `.tf-calc-grid`). Dois `Segmented` NUNCA
          montados juntos (mesmo motivo do ADR-0031: dois radiogroups com o mesmo nome) — o hook
          decide qual dos dois existe, nunca CSS escondendo um dos dois. */}
            {isCalcWide ? (
                <div className="flex items-center gap-2">
                    <p style={{ ...sectionLabel, flex: 1 }}>{t.machineCost.blockTitle}</p>
                    <Segmented<MachineMode>
                        options={[
                            { id: "estimar", label: t.machineCost.estimar },
                            { id: "ajustar", label: t.machineCost.ajustar },
                        ]}
                        value={mode}
                        onChange={handleModeChange}
                        ariaLabel={t.fields.machineLifetime}
                        role="radiogroup"
                        size="sm"
                        data-testid="machine-mode"
                    />
                </div>
            ) : (
                <Segmented<MachineMode>
                    options={[
                        { id: "estimar", label: t.machineCost.estimar },
                        { id: "ajustar", label: t.machineCost.ajustar },
                    ]}
                    value={mode}
                    onChange={handleModeChange}
                    // O grupo decide COMO a vida útil é obtida — é ela que nomeia o grupo, não a pergunta do ritmo.
                    ariaLabel={t.fields.machineLifetime}
                    role="radiogroup"
                    split
                    data-testid="machine-mode"
                />
            )}

            {!adjustMode ? (
                <>
                    {/* 016/PR-C homologação (B3) — `auto-fit, minmax(240px, 1fr)`: the two selects stack
              at full width the instant the card is too narrow for a real 240px each (360/390px,
              where the widest option — "Poucas horas por semana" — measured up to 197px of its
              own text and had ZERO room to spare), and sit side by side with genuine breathing
              room from ~1024px up, where 1fr distributes whatever is left over the 240px floor.
              (R2) Neither `Field` uses `tightLabel` anymore — both reserve the SAME 2-line label
              height (field.css), so a wrapped "Em quantos anos…" label no longer pushes its
              Select 15-16px below the sibling's. */}
                    <div className="tf-machine-ritmo-grid">
                        <Field label={t.machineCost.ritmoLabel}>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={RITMO_OPTIONS}
                                    value={String(ritmoIndex)}
                                    onChange={(e) =>
                                        applyRitmo(
                                            Number(e.target.value) as RitmoIndex,
                                            paybackYears,
                                        )
                                    }
                                />
                            )}
                        </Field>
                        <Field label={t.machineCost.paybackLabel}>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={PAYBACK_YEAR_OPTIONS}
                                    value={String(paybackYears)}
                                    onChange={(e) => applyRitmo(ritmoIndex, Number(e.target.value))}
                                />
                            )}
                        </Field>
                    </div>
                </>
            ) : (
                <>
                    {/* 016/PR-C homologação (B4) — the InfoTip trigger is a `labelAddon`: a FLEX SIBLING of
              the `<label>`, on the label row, never nested inside it (see field.tsx's doc — a
              nested button folds its own name into the control's accessible name). */}
                    {/* Review do PR #58 (2026-08-15) — este aviso EXISTIA sem caminho de render, e é o achado
              mais caro que o review pegou. O limiar (`plausibilidade.ts`), a frase
              (`messages.pt-br.ts`) e o teste unitário estavam verdes; nenhuma tela chamava
              `avisoDeCampo("machineLifetimeHours", …)`, porque este campo NÃO é um `CalcFieldMeta`
              — ele renderiza aqui, no seu controle dedicado, e não pelo `ControlledField`. O
              próprio `calculator-schema.ts:365` diz isso por escrito.
              Consequência real: quem pensa a vida útil em ANOS e digita 3 leva o custo/hora de
              R$ 1,11 para R$ 1.333,33, calado — um dos nove ALTA declarados corrigidos.
              E a medição da homologação era CEGA a isto: a bateria faz `continue` quando o campo
              não está visível, e a semente 3600h abre em modo ritmo, onde ele nem é montado.
              019/PR-C (T057) — o aviso não é mais o `hint` do `Field`: sai como `<Aviso>` irmão,
              via `CampoAviso`, igual aos demais campos (14b). */}
                    <Field
                        label={t.fields.machineLifetime}
                        labelAddon={
                            <InfoTip label={t.fieldTips.machineLifetime.label}>
                                {t.fieldTips.machineLifetime.body}
                            </InfoTip>
                        }
                        required
                    >
                        {(p) => (
                            <NumberField
                                {...p}
                                unit="h"
                                name={lifetimeField.field.name}
                                value={lifetimeField.field.value}
                                onChange={lifetimeField.field.onChange}
                                onBlur={onBlurLifetime}
                                ref={lifetimeField.field.ref}
                            />
                        )}
                    </Field>
                    <CampoAviso aviso={aviso} testId="aviso-machineLifetimeHours" />
                </>
            )}

            <MachineCostReadout
                perHour={perHour}
                machineValueNum={machineValueNum}
                currentHours={currentHours}
            />

            {/* 019/PR-C (T057, prancheta 15e) — a confirmação inline, dentro do próprio bloco (nunca
          cobrindo a tela): os dois números em disputa, cada um no seu botão. */}
            {pendingConfirm && (
                <Alert
                    tone="warning"
                    role="alertdialog"
                    data-testid="machine-confirm"
                    title={t.machineCost.confirmTitle
                        .replace("{atual}", fmtHoras(currentHours))
                        .replace("{novo}", fmtHoras(proposedHours))}
                >
                    <p>
                        {t.machineCost.confirmBody
                            .replace("{ritmo}", fmtHoras(RITMOS_HORAS_ANO[ritmoIndex])) // "1.200", como a 15e
                            .replace("{anos}", anosLabel)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                applyRitmo(ritmoIndex, paybackYears);
                                setManualOverride(false);
                                setPendingConfirm(false);
                            }}
                        >
                            {t.machineCost.confirmUse.replace("{novo}", fmtHoras(proposedHours))}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPendingConfirm(false)}
                        >
                            {t.machineCost.confirmKeep.replace("{atual}", fmtHoras(currentHours))}
                        </Button>
                    </div>
                </Alert>
            )}
        </div>
    );
}
