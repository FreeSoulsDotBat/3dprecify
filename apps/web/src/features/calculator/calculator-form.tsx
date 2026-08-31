import { type CSSProperties, useState } from "react";
import {
    type Control,
    Controller,
    type ControllerFieldState,
    type ControllerRenderProps,
    useController,
} from "react-hook-form";

import {
    type ChannelSlotOutcome,
    formatBRL,
    isUnpriced,
} from "@/features/calculator/calculator-model";
import { CategoryPicker } from "@/features/calculator/category-picker";
import { FeeSeal, FixedFeeSourceBadge } from "@/features/calculator/fee-seal";
import {
    ShopeeMeasuredFreightWarning,
    ShopeeRegressiveFeeWarning,
} from "@/features/calculator/shopee-warnings";
import {
    costPerHour,
    deriveMachineLifetimeHours,
    detectRitmoMode,
    RITMOS_HORAS_ANO,
    type RitmoIndex,
} from "@/features/calculator/machine-cost";
import {
    type CalcFieldMeta,
    type CalcFormValues,
    CHANNEL_FEE_FIELDS,
    type ChannelSlotForm,
    defaultChannelSlot,
    type MarketplaceId,
    MARKETPLACE_OPTIONS,
    PAYBACK_YEAR_OPTIONS,
    RITMO_OPTIONS,
} from "@/features/calculator/calculator-schema";
import { formatDatePtBr } from "@/shared/lib/format-date";
import { avisoDeComissao, avisosDePlausibilidade } from "@/shared/lib/plausibilidade";
import { useAvisoDeCampo, type UseAvisoDeCampoResult } from "@/shared/lib/use-aviso-de-campo";
import { useIsCalcWide } from "@/shared/lib/use-is-wide";
import { channelFieldPlan } from "@/features/calculator/channel-field-plan";
import {
    decimalHoursToHm,
    hmToDecimalString,
    parseRelogio,
} from "@/features/calculator/time-input";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";
import {
    type CategoryNode,
    type FeeCatalog,
    type OptionalSurcharge,
    resolveFreightSubsidyCeiling,
} from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import type { PriceResult } from "@3dprecify/pricing-core";
import {
    Alert,
    Aviso,
    BreakdownRow,
    Button,
    Card,
    Field,
    InfoTip,
    NumberField,
    PriceHero,
    type PriceHeroTone,
    Segmented,
    Select,
    Switch,
} from "@/shared/ui";

import "./calculator-form.css";

// The calculator FORM BODY, extracted verbatim from calcular-page (T030). Both Calcular and the
// product full-page route (ux §1.6b — "a product form is essentially the calculator + a name +
// two catalog refs") mount these sections over the SAME RHF control + the SAME computeFromForm,
// so the SC-305 byte-identity anchor holds on both surfaces by construction. Pure extraction:
// no behavior change, no new primitives.

const t = messages.calculator;

export const gridCard: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-3)",
};

export const sectionLabel: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-sm)",
    fontWeight: "var(--fw-semibold)",
    color: "var(--text-strong)",
};

export const captionText: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    color: "var(--text-muted)",
};

// "Preços por canal": the modality reads lighter than the marketplace name, and a divider separates
// stacked channels — so a channel header is distinct from the group sub-title above it (T019b #4).
const channelModality: CSSProperties = {
    fontWeight: "var(--fw-regular)",
    color: "var(--text-muted)",
};

// 019/PR-F (T142, prancheta 10a) — "Preços por marketplace" leva o mesmo tratamento tipográfico
// que `.tf-catalog-md__kicker` (catalog-master-detail.css) já usa: caption maiúscula, tracking,
// tom muted. Cópia local em vez de importar a classe de outra feature (nenhum acoplamento de CSS
// entre `features/catalog` e `features/calculator`) — os valores são os mesmos, de propósito.
const kickerLabel: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    fontWeight: "var(--fw-semibold)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
};

// 019/PR-F (10a) — o título de cada cartão de marketplace ("Mercado Livre · Clássico"): a
// prancheta usa `font-size:var(--fs-body-sm);font-weight:var(--fw-semibold)`, um degrau abaixo do
// `sectionLabel` (fs-sm) que os títulos de SEÇÃO usam — o cartão não é uma seção.
const channelCardTitle: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-body-sm)",
    fontWeight: "var(--fw-semibold)",
    color: "var(--text-strong)",
};

// 019/PR-F (10a) — a trilha da barra de proporção. Sem classe `tf-*` própria: a prancheta também
// não tem uma (é estilo inline solto na marcação estática), então o mesmo objeto `CSSProperties`
// que o resto deste arquivo já usa para nós sem primitivo dedicado (ver `sectionLabel` acima).
const proportionTrack: CSSProperties = {
    display: "flex",
    height: "8px",
    borderRadius: "var(--radius-pill)",
    overflow: "hidden",
    background: "var(--bg-muted)",
};

// Warning caption for a co-funded voucher that exceeds the margin (líquido < 0) — truthful, not clamped.
const warnCaption: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    color: "var(--danger-text)",
};

/**
 * Homologação automatizada — os dois avisos que NÃO têm campo culpado, porque só o RESULTADO os
 * denuncia:
 *
 * - **preço zero** (CF-001-LEIGO-D-P5): a persona que zera o que não entende chega a custo R$ 0,00
 *   e preço de venda R$ 0,00. Cada campo em 0 é perfeitamente válido isolado.
 * - **custo absurdo** (CF-001-LEIGO-D-P6): erros de casa decimal em vários campos ao mesmo tempo
 *   compõem R$ 6.000.061,60 sem que nenhum limiar POR CAMPO seja atingido.
 *
 * `printGrams: 1` declara ao módulo puro que a peça existe — a tela só chega aqui com um resultado
 * calculado, então a guarda "formulário recém-aberto" já foi satisfeita pelo próprio render.
 */
function AvisoDeResultado({ result }: { result: PriceResult }) {
    const avisos = avisosDePlausibilidade(
        { printGrams: 1 },
        { custoTotal: result.custoTotal, precoVarejo: result.precoVarejo },
    );
    if (avisos.length === 0) return null;
    // 019/PR-C (T056, prancheta 14d) — vira `<Aviso>`, sem "Entendi": não há campo para corrigir, e
    // um botão que não dispensa nada é botão vazio. Duas frases juntas param de ser um `join(" ")` —
    // são dois fatos, e cada um pede seu próprio `<p>`.
    return <Aviso data-testid="aviso-resultado" lines={avisos.map((a) => a.texto)} />;
}

/** A section title with an inline ⓘ info tip explaining what/how the section calculates. */
export function SectionTitle({
    title,
    info,
}: {
    title: string;
    info: { label: string; body: string };
}) {
    return (
        <div className="flex items-center gap-1">
            <p style={sectionLabel}>{title}</p>
            <InfoTip label={info.label}>{info.body}</InfoTip>
        </div>
    );
}

/** 019/PR-C (T056, prancheta 14) — o corpo do `<Aviso>` de UM campo, comum aos três consumidores
 *  de `useAvisoDeCampo` (`ControlledField`/`TimeHmField`/`MachineCostFields`): nenhum aviso ⇒ nada
 *  renderiza; com uma recusa junto (14b), sem "Entendi" — não se dispensa uma lição que acompanha
 *  uma recusa. */
function CampoAviso({ aviso, testId }: { aviso: UseAvisoDeCampoResult; testId: string }) {
    if (!aviso.aviso) return null;
    return (
        <Aviso
            data-testid={testId}
            action={
                !aviso.comErro && (
                    <Button variant="ghost" size="sm" onClick={aviso.onEntendi}>
                        {t.plausibilidade.entendi}
                    </Button>
                )
            }
        >
            {aviso.aviso}
        </Aviso>
    );
}

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

/**
 * Review do PR #58 (2026-08-15) — o campo de HORAS com rascunho local.
 *
 * O achado: `2:30` funcionava COLADO e não funcionava DIGITADO. A causa é o campo ser controlado
 * por `String(h)`: ao teclar `0`, depois `:`, o texto `"0:"` não casa como relógio, cai no
 * `parseInt` que devolve 0, o React re-renderiza com `"0"` e o `:` que a pessoa acabou de digitar
 * some. Continuando, `"30"` vira **30 horas** — 60× o que ela quis dizer, calado.
 *
 * O conserto é dar um rascunho local ao campo enquanto o texto contém um separador: nesse estado
 * ele NÃO commita nada e deixa a pessoa terminar de escrever. Assim que o relógio fecha (`0:30`),
 * commita e devolve o controle ao valor derivado. No blur, um rascunho que nunca fechou cai no
 * `parseInt` de sempre — nada fica preso num estado que o motor não conhece.
 *
 * Esta é a única parte do campo com estado próprio, e ela existe só para os caracteres
 * intermediários — o valor que chega ao motor continua sendo o mesmo decimal de sempre.
 */
function CampoDeHoras({
    h,
    min,
    onCommit,
    onBlurField,
}: {
    h: number;
    min: number;
    onCommit: (h: number, min: number) => void;
    onBlurField: () => void;
}) {
    const [rascunho, setRascunho] = useState<string | null>(null);
    const temSeparador = (v: string) => /[:hH]/.test(v);
    return (
        <NumberField
            aria-label={t.timeInput.hoursAria}
            unit={t.timeInput.hoursUnit}
            inputMode="text"
            placeholder="0"
            value={rascunho ?? String(h)}
            onChange={(e) => {
                const bruto = e.target.value;
                const relogio = parseRelogio(bruto);
                if (relogio) {
                    setRascunho(null);
                    onCommit(relogio.h, relogio.min);
                    return;
                }
                if (temSeparador(bruto)) {
                    // Meio de digitação ("0:", "2h"): segura o texto e NÃO mexe no número ainda.
                    setRascunho(bruto);
                    return;
                }
                setRascunho(null);
                onCommit(Number.parseInt(bruto, 10) || 0, min);
            }}
            onBlur={() => {
                if (rascunho !== null) {
                    const relogio = parseRelogio(rascunho);
                    if (relogio) onCommit(relogio.h, relogio.min);
                    else onCommit(Number.parseInt(rascunho, 10) || 0, min);
                    setRascunho(null);
                }
                onBlurField();
            }}
        />
    );
}

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
// 019/PR-C (T057, prancheta 15) — pt-BR só de agrupamento (sem casas), para a divisão do readout
// ("de R$ 4.000,00 ÷ 3.600 h") e para os números da confirmação ("2.000 h" / "3.600 h").
function fmtHoras(n: number): string {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

/** 019/PR-C (T057, prancheta 15a/15b/15d) — o custo/hora deixa de ser legenda solta e vira
 *  READOUT, com a divisão que o produziu escrita embaixo — existe nos DOIS modos agora (15b: hoje
 *  só existia em "estimar"). `machineValueNum===0` mantém o número (é literalmente R$ 0,00, não
 *  uma mentira), mas com peso de tinta menor + a ressalva ao lado (15d). `currentHours<=0` não tem
 *  o que dividir — NADA renderiza (15c: "não há divisão por zero" é a terceira afirmação falsa que
 *  um R$ 0,00 em destaque seria). */
function MachineCostReadout({
    perHour,
    machineValueNum,
    currentHours,
}: {
    perHour: number;
    machineValueNum: number;
    currentHours: number;
}) {
    if (!(currentHours > 0)) return null;
    const semValor = machineValueNum === 0;
    return (
        <div className="calc-machine-readout" data-testid="machine-readout">
            <span style={captionText}>{t.machineCost.readoutLabel}</span>
            <div className="flex items-baseline gap-2" style={{ flexWrap: "wrap" }}>
                <span
                    className="tf-tnum"
                    style={{
                        fontSize: "var(--fs-xl)",
                        fontWeight: "var(--fw-bold)",
                        color: semValor ? "var(--text-muted)" : "var(--text-strong)",
                        lineHeight: 1.1,
                    }}
                >
                    {formatBRL(perHour)}
                </span>
                {semValor && (
                    <span style={{ fontSize: "var(--fs-caption)", color: "var(--warning-text)" }}>
                        {t.machineCost.ressalvaSemValor}
                    </span>
                )}
            </div>
            <span className="tf-tnum" style={captionText}>
                {t.machineCost.readoutDivisao
                    .replace("{valor}", formatBRL(machineValueNum))
                    .replace("{horas}", fmtHoras(currentHours))}
            </span>
        </div>
    );
}

type MachineMode = "estimar" | "ajustar";

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

/** 019/PR-F (T142, prancheta 10) — o nível de preço que o `<Segmented split>` governa: o cartão
 *  grande, a linha-resumo do outro nível e os números de cada marketplace leem TODOS o mesmo
 *  `level`. Estado só de apresentação (nunca RHF) — nenhuma aritmética nova, é seleção de qual
 *  campo já calculado o cartão mostra. */
type PriceLevel = "varejo" | "atacado";

/** 019/PR-F (T142, prancheta 10a) — o corpo do cartão grande (accent no varejo, superfície
 *  NEUTRA no atacado escolhido: a diferença entre os dois é cor, não corpo — o mesmo tamanho, um
 *  preço por vez). `PriceHeroTone` ainda não tinha um tom neutro-com-borda; ver price-hero.css. */
const HERO_TONE: Record<PriceLevel, PriceHeroTone> = { varejo: "accent", atacado: "neutral" };

/** 019/PR-F (10b) — "seis dígitos entram no corpo médio; o corpo grande fica para os valores de
 *  até quatro dígitos". Medido pela prancheta, não pela largura de tela: R$ 950.096,00 (6 dígitos)
 *  cabe no `md` sem rolagem; um preço de 4 dígitos usa o `lg` sempre que existir espaço. */
function heroSizeFor(value: number): "md" | "lg" {
    return Math.floor(Math.abs(value)).toString().length > 4 ? "md" : "lg";
}

/** 019/PR-F (10a) — a barra fina de proporção dos custos, sob a conta: as MESMAS linhas e cores
 *  do detalhamento acima, como largura. Reverte 016/US5 FR-907-AC2 (as bolinhas de cor tinham
 *  sido removidas do detalhamento como "chrome de legenda"; a prancheta 10a as traz de volta —
 *  agora como a própria chave de cor da barra, registrando a reversão aqui e no relatório da
 *  fatia). As parcelas somam exatamente `custoTotal` por construção (mesmos valores arredondados
 *  que compõem `PriceResult.custoTotal`, packages/pricing-core); sem custo total positivo a barra
 *  não ensina nada — não renderiza. */
function CostProportionBar({
    rows,
    custoTotal,
}: {
    rows: { label: string; value: number; color: string }[];
    custoTotal: number;
}) {
    if (custoTotal <= 0 || rows.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            <div style={proportionTrack} data-testid="cost-proportion-bar">
                {rows.map((row, i) => (
                    <span
                        key={i}
                        aria-hidden="true"
                        style={{
                            display: "block",
                            height: "100%",
                            width: `${(row.value / custoTotal) * 100}%`,
                            background: row.color,
                        }}
                    />
                ))}
            </div>
            {/* A frase da prancheta continua em "…metade do seu custo é material.": essa segunda parte
          é o EXEMPLO do desenho (50% = material neste conjunto de dados), não copy fixa — T141
          já registrou a decisão; só a parte fixa é exibida até o dono decidir sobre o exemplo. */}
            <p style={captionText}>{t.sections.proportionCaption}</p>
        </div>
    );
}

/** US1 hero price (um nível por vez) + US2 transparent breakdown. Rendered only for a fully
 *  valid form.
 *
 *  019/PR-F (T142, prancheta 10, decisão do dono 28/08): a conta agora TERMINA no custo total —
 *  "Preço varejo"/"Preço atacado" saem do detalhamento e o markup sobe para o cabeçalho da seção
 *  (`markupHeader`). "Preços por marketplace" vira seção PRÓPRIA, antes dos cartões finais (não
 *  mais dobrada dentro do mesmo Card do detalhamento — a inversão de FR-907 que o 016 tinha feito
 *  para reduzir seções agora abre de novo, porque o segmented precisa de um lugar visível entre
 *  os dois). `<Segmented split>` (já existe desde a PR-A) governa o cartão grande, a linha-resumo
 *  do outro nível e os números de cada marketplace — um único `level` para os três. */
export function PriceResults({
    result,
    values,
    channelOutcomes = [],
}: {
    result: PriceResult;
    values: CalcFormValues;
    channelOutcomes?: ChannelSlotOutcome[];
}) {
    const [level, setLevel] = useState<PriceLevel>("varejo");
    const line = (value: number, optional: boolean) =>
        optional && value === 0 ? ("muted" as const) : ("default" as const);

    // As MESMAS linhas alimentam o detalhamento E a barra de proporção (fonte única — se um dia
    // divergirem, é a barra que erra, nunca o detalhamento; ver o comentário de CostProportionBar).
    const proportionRows = [
        {
            label: t.results.material,
            value: result.material,
            color: "var(--tf-purple)",
            emphasis: "default" as const,
        },
        {
            label: t.results.energy,
            value: result.energy,
            color: "var(--tf-cyan)",
            emphasis: "default" as const,
        },
        {
            label: t.results.machine,
            value: result.machine,
            color: "var(--tf-orange)",
            emphasis: "default" as const,
        },
        {
            label: t.results.failure,
            value: result.falha,
            color: "var(--tf-purple-deep)",
            emphasis: line(result.falha, true),
        },
        {
            label: t.results.finishing,
            value: result.finishing,
            color: "var(--tf-teal-deep)",
            emphasis: line(result.finishing, true),
        },
        {
            label: t.results.labor,
            value: result.labor,
            color: "var(--tf-amber-deep)",
            emphasis: line(result.labor, true),
        },
        // US5 (FR-115): each named "Outros custos" sub-cost is its own breakdown line (a blank name
        // falls back to a neutral label); every one reads the SAME muted dot as "Embalagem" in 10a's
        // example (the prancheta names one example cost — the colour is generic for the whole slot).
        ...result.otherCosts.map((c) => ({
            label: c.name.trim() || t.outrosCustos.lineFallback,
            value: c.value,
            color: "var(--text-muted)",
            emphasis: "default" as const,
        })),
    ];

    const heroPrice = level === "varejo" ? result.precoVarejo : result.precoAtacado;
    const heroMarkupPct =
        (level === "varejo" ? values.markupVarejoPct : values.markupAtacadoPct) || "0";
    const otherLevel: PriceLevel = level === "varejo" ? "atacado" : "varejo";
    const summaryPrice = otherLevel === "varejo" ? result.precoVarejo : result.precoAtacado;
    const summaryMarkupPct =
        (otherLevel === "varejo" ? values.markupVarejoPct : values.markupAtacadoPct) || "0";
    const summaryText = t.sections.summaryLine
        .replace("{nivel}", t.captions[otherLevel])
        .replace("{pct}", summaryMarkupPct);

    return (
        <>
            {/* (4) Transparent breakdown — every R$ line sums to custo_total; the markup that turns it
          into a price now reads in the section header (10a), not as a derivation row here. */}
            <div className="flex flex-col gap-1">
                <SectionTitle title={t.sections.breakdown} info={t.sectionInfo.breakdown} />
                <p style={captionText} className="tf-tnum">
                    {t.sections.markupHeader
                        .replace("{varejo}", values.markupVarejoPct || "0")
                        .replace("{atacado}", values.markupAtacadoPct || "0")}
                </p>
            </div>
            <div className="flex flex-col gap-2">
                {/* Homologação automatizada (CF-001-LEIGO-D-P5) — a persona que "zera o que não entende"
            chega a custo R$ 0,00 e preço de venda R$ 0,00, e o produto entregava isso calado. Cada
            campo em 0 é perfeitamente válido isolado: só o RESULTADO denuncia. Por isso este aviso
            é o único que não mora num campo — não há um campo culpado. */}
                <AvisoDeResultado result={result} />
                <Card padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-col">
                        {proportionRows.map((row, i) => (
                            <BreakdownRow
                                key={i}
                                label={row.label}
                                value={row.value}
                                color={row.color}
                                emphasis={row.emphasis}
                            />
                        ))}
                        <BreakdownRow
                            label={t.results.custoTotal}
                            value={result.custoTotal}
                            emphasis="total"
                        />
                    </div>
                    <CostProportionBar rows={proportionRows} custoTotal={result.custoTotal} />
                </Card>
            </div>

            {/* 019/PR-F (10a/10e) — o primitivo que faltava construir (research §I): a bandeja
          Varejo|Atacado governa o cartão grande, a linha-resumo do outro nível e os números de
          cada marketplace. `radiogroup`, não `tablist`: a escolha é um VALOR que troca o que os
          cartões abaixo mostram, não um painel controlado por `aria-controls` — o mesmo padrão já
          usado pelo `Segmented` de tema/modo-de-máquina neste arquivo (a prancheta transcreve
          `role="tablist"` na marcação estática, mas a semântica a11y não é copy; ver docstring do
          próprio `Segmented`). */}
            <Segmented<PriceLevel>
                options={[
                    { id: "varejo", label: t.captions.varejo },
                    { id: "atacado", label: t.captions.atacado },
                ]}
                value={level}
                onChange={setLevel}
                ariaLabel={t.sections.priceLevelLabel}
                role="radiogroup"
                split
                data-testid="price-level-segmented"
            />

            {/* 019/PR-F (10a/10c) — "Preços por marketplace" agora é seção PRÓPRIA, ANTES dos cartões
          finais (o cartão é o fim da leitura). Ausente por completo sem canal ativo (toggle OFF /
          nenhum slot) OU sem Premium (`channelOutcomes=[]` que a page já passa) — nunca um
          contêiner borrado ou vazio: a seção simplesmente não existe no DOM (10c, "Sem Premium"). */}
            {channelOutcomes.length > 0 && (
                <div className="flex flex-col gap-3" data-testid="marketplace-prices-section">
                    <span style={kickerLabel}>{t.channels.pricesTitle}</span>
                    <div className="tf-marketplace-cards">
                        <ChannelPriceBlocks
                            values={values}
                            channelOutcomes={channelOutcomes}
                            level={level}
                        />
                    </div>
                    <p style={captionText}>{t.sections.marketplaceLevelHint}</p>
                </div>
            )}

            {/* 015/A8 ([F03a-003], decisão do dono 2026-08-03) — atacado acima do varejo é ENTRADA
          VÁLIDA: o motor calcula, nada é recusado, e a UI avisa. A comparação é sobre os PREÇOS
          resultantes, não sobre as strings de markup: é a consequência que o vendedor vê na tela,
          e ela sobrevive a qualquer mudança na forma como o markup é digitado.

          O tom é `info`, deliberadamente, e não `danger`: um aviso escrito como erro faz o
          vendedor concluir que o produto RECUSOU — e o produto não recusou. Isto também é o que o
          separa visualmente de `.tf-field__error`, que é onde uma validação de verdade aparece. */}
            {result.precoAtacado > result.precoVarejo && (
                <Alert tone="info">{t.avisoAtacadoAcimaDoVarejo}</Alert>
            )}

            {/* (5) The suggested price — the user's final takeaway, so they close the screen.
          019/PR-F (10a/10d/10e, decisão do dono 28/08): um preço grande por vez agora — o par de
          cartões de peso igual (015/A6) SAI; o outro nível vira a linha-resumo abaixo, no MESMO
          tamanho de texto que o detalhamento usa (BreakdownRow), nunca escondido. */}
            <div className="flex flex-col gap-3">
                {/* T016 — final price card reads centered (label/amount/caption), not left-aligned. */}
                <PriceHero
                    label={t.results[level]}
                    value={heroPrice}
                    caption={`${t.captions.markup} ${heroMarkupPct}%`}
                    tone={HERO_TONE[level]}
                    size={heroSizeFor(heroPrice)}
                    center
                    data-testid="price-hero"
                />
                <BreakdownRow
                    label={summaryText}
                    value={summaryPrice}
                    data-testid="price-summary-line"
                />
            </div>
        </>
    );
}

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

/** One channel fee input, wired to `channels.{i}.{field}`. Its error comes from the per-slot
 *  model outcome (not RHF), so a bad slot flags itself while the siblings keep computing. */
function ChannelFeeField({
    control,
    index,
    meta,
    error,
    applied,
}: {
    control: Control<CalcFormValues>;
    index: number;
    meta: (typeof CHANNEL_FEE_FIELDS)[number];
    error?: string;
    /** 015/A8 ([F11a-007]) — o valor que o CATÁLOGO está aplicando neste campo, quando ele é único
     *  OU o valor RESOLVIDO da banda aplicada (016/A1). Quando o valor vem de um `fixedFeeRule`, a
     *  frase da regra vive na legenda de largura total do slot — nunca como sufixo aqui (reverify:
     *  o sufixo cortava em todos os viewports e produzia a leitura errada que existia para evitar). */
    applied?: number;
}) {
    // 015/A8 ([F11a-007], decisão do dono 2026-08-03) — o placeholder passa a dizer a VERDADE.
    //
    // A homologação mediu: com Amazon e sem categoria os quatro campos ficavam vazios com o
    // placeholder padrão "0,00" — a tela lia `Comissão 0,00 %` — enquanto "Preços por canal" mostrava
    // um preço com 15% já descontados. O número que o vendedor procura primeiro estava em branco, e o
    // selo que o explicava era o elemento de menor peso visual do painel. Campo vazio ao lado de um
    // preço descontado é a única leitura errada possível.
    //
    // O placeholder é o registro visual certo para isto, e não um valor preenchido: ele JÁ significa
    // "não digitado" em toda a interface. Um valor real no campo faria o vendedor achar que vouchou
    // por ele — e o `editedFields` (que o cenário salva como `overridden`) passaria a mentir.
    const placeholder =
        applied === undefined
            ? undefined
            : meta.currency
              ? applied.toFixed(2).replace(".", ",")
              : String(applied).replace(".", ",");
    return (
        <Controller
            control={control}
            name={`channels.${index}.${meta.name}` as const}
            render={({ field }) => {
                // Homologação automatizada (CF-010-UI-02) — o vendedor escreve `0,12` querendo dizer 12%.
                // Ninguém recusa: 0,12% é uma comissão válida. Medido: o anúncio cai de R$ 27,55 para
                // R$ 25,24 e ele anuncia abaixo do necessário, descobrindo no extrato do marketplace.
                const aviso =
                    meta.name === "commissionPct"
                        ? avisoDeComissao(parseDecimal(String(field.value ?? "")))
                        : null;
                return (
                    <Field
                        label={meta.label}
                        optional
                        hint={
                            aviso ? (
                                <span className="tf-field__aviso" data-testid="aviso-commissionPct">
                                    {aviso}
                                </span>
                            ) : undefined
                        }
                        error={error}
                    >
                        {(p) => (
                            <NumberField
                                {...p}
                                currency={meta.currency}
                                unit={meta.unit}
                                name={field.name}
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                error={Boolean(error)}
                                {...(placeholder ? { placeholder } : {})}
                            />
                        )}
                    </Field>
                );
            }}
        />
    );
}

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
function SurchargeCheckbox({
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

/** One editable channel slot: marketplace + the determinants `channelFieldPlan` says this
 *  marketplace has (a modality SELECT, a category picker — both, one, or neither), the manual fee
 *  grid restricted to the axes the catalog declares, and a remove control. Changing the marketplace
 *  resets the modality to that market's default. 016/US12 (T052, FR-918) — this used to infer BOTH
 *  the modality select AND the category picker from `modalityOptions.length > 0` (the F1 defect):
 *  the plan now decides each independently from the catalog, and RA5 means `slotDeterminants`
 *  (fee-prefill.ts) reads the exact same shape when it decides what is SENT. */
function ChannelSlot({
    control,
    index,
    slot,
    outcome,
    spine,
    catalog,
    onRemove,
    onMarketplaceChange,
}: {
    control: Control<CalcFormValues>;
    index: number;
    slot: ChannelSlotForm;
    outcome?: ChannelSlotOutcome;
    /** This marketplace's category spine (empty when it has no category axis, or not loaded yet). */
    spine: readonly CategoryNode[];
    catalog: FeeCatalog;
    onRemove: (index: number) => void;
    onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
}) {
    const plan = channelFieldPlan(catalog, slot.marketplace);
    const modalityDeterminant = plan.determinants.find((d) => d.kind === "SELECT");
    const hasCategoryDeterminant = plan.determinants.some((d) => d.kind === "CATEGORY_PICKER");
    // 016/US11 (T044 homologação PR-E, bloqueador) — the render-side half of the fix: a field renders
    // if the PLAN shows it OR it already carries a value. The second clause is what makes a saved
    // scenario safe — reopening one saved BEFORE this marketplace's plan dropped a field (e.g. a
    // Shopee "Frete" typed before an Amazon switch that never fires `onMarketplaceChange`, since a
    // reopen replaces the whole channel array directly) shows the field, editable/erasable, instead
    // of hiding a number that keeps charging. Never changes the CALCULATION (FR-919): a present value
    // still computes exactly as before — only its visibility is guaranteed.
    const feeFieldMetas = CHANNEL_FEE_FIELDS.filter(
        (meta) => plan.feeFields.includes(meta.name) || slot[meta.name].trim() !== "",
    );
    // hotfix 016/A2 (H2c) — o subsídio de frete da Shopee como INFORMAÇÃO sob o campo "Frete".
    // Dirigido por dado (como o volumoso): renderiza sse o catálogo publica `freightSubsidyInfo` E o
    // slot já tem um anúncio (varejo) para resolver a faixa — nunca um teto genérico sem preço.
    const shopeeSubsidy =
        slot.marketplace === "SHOPEE"
            ? catalog.marketplaces.find((m) => m.marketplace === "SHOPEE")?.freightSubsidyInfo
            : undefined;
    const subsidyCeiling =
        shopeeSubsidy && outcome?.result?.precoAnuncioVarejo != null
            ? resolveFreightSubsidyCeiling(shopeeSubsidy, outcome.result.precoAnuncioVarejo)
            : null;
    return (
        <Card padding="md" className="flex flex-col gap-3" data-testid="channel-slot">
            <div className="flex items-end gap-2">
                <Controller
                    control={control}
                    name={`channels.${index}.marketplace` as const}
                    render={({ field }) => (
                        <Field label={t.channels.marketplace} className="flex-1" tightLabel>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={MARKETPLACE_OPTIONS}
                                    name={field.name}
                                    value={field.value}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        onMarketplaceChange(index, e.target.value as MarketplaceId);
                                    }}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            )}
                        </Field>
                    )}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(index)}
                    aria-label={t.channels.removeChannel}
                >
                    ✕
                </Button>
            </div>
            {modalityDeterminant && (
                <Controller
                    control={control}
                    name={`channels.${index}.modality` as const}
                    render={({ field }) => (
                        <Field label={modalityDeterminant.label} tightLabel>
                            {(p) => (
                                <Select
                                    {...p}
                                    options={modalityDeterminant.options ?? []}
                                    name={field.name}
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            )}
                        </Field>
                    )}
                />
            )}
            {/* 016/US12 — only where the PLAN says this marketplace publishes a category spine, never
          inferred from the modality axis (the F1 defect: Shopee has neither today, which is exactly
          why the old inference worked by coincidence). */}
            {hasCategoryDeterminant && (
                <Controller
                    control={control}
                    name={`channels.${index}.category` as const}
                    render={({ field }) => (
                        <CategoryPicker
                            spine={spine}
                            value={field.value}
                            onChange={(id) => field.onChange(id ?? "")}
                            // FR-006d — the picker's empty state must agree with THIS slot's seal. "none" is the
                            // seal for a slot standing on nothing; anything else (a reference, a catch-all, or a
                            // rate the seller typed himself) means the money is settled and only the name list is
                            // missing. Derived from the seal itself so the two can never drift apart.
                            hasFeeReference={outcome !== undefined && outcome.seal.kind !== "none"}
                        />
                    )}
                />
            )}
            {/* 016/PR-F (US17, FR-926, RA5) — the seller-profile axis, driven by the SAME plan that gates
          `slotDeterminants`. TWO questions, not one generic SELECT: "Você vende como" (empty = not
          answered → catch-all, T057) and, ONLY when CPF, "mais de 450 pedidos?". */}
            {plan.sellerProfile && (
                <>
                    <Controller
                        control={control}
                        name={`channels.${index}.sellerType` as const}
                        render={({ field }) => (
                            <Field label={t.channels.sellerProfile.sellerTypeLabel} tightLabel>
                                {(p) => (
                                    <Select
                                        {...p}
                                        options={[
                                            {
                                                value: "CPF",
                                                label: t.channels.sellerProfile.sellerTypeOptions
                                                    .CPF,
                                            },
                                            {
                                                value: "CNPJ",
                                                label: t.channels.sellerProfile.sellerTypeOptions
                                                    .CNPJ,
                                            },
                                        ]}
                                        placeholder={t.channels.sellerProfile.sellerTypePlaceholder}
                                        name={field.name}
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        ref={field.ref}
                                    />
                                )}
                            </Field>
                        )}
                    />
                    {/* 016/PR-F — só perguntado quando CPF (a segunda pergunta de Q6). Um `highVolume`
              respondido antes e deixado para trás ao trocar para CNPJ não é um risco de dinheiro: o
              mapeamento (`resolveShopeeSellerProfile`) só forma o determinante com AMBAS as
              respostas === CPF+SIM, então um valor órfão sob CNPJ nunca é lido (RA5 — a decisão
              mora numa função só, e essa função nunca vê `highVolume` sem `sellerType === "CPF"`). */}
                    {slot.sellerType === "CPF" && (
                        <Controller
                            control={control}
                            name={`channels.${index}.highVolume` as const}
                            render={({ field }) => (
                                <Field label={t.channels.sellerProfile.highVolumeLabel} tightLabel>
                                    {(p) => (
                                        <Select
                                            {...p}
                                            options={[
                                                {
                                                    value: "SIM",
                                                    label: t.channels.sellerProfile
                                                        .highVolumeOptions.SIM,
                                                },
                                                {
                                                    value: "NAO",
                                                    label: t.channels.sellerProfile
                                                        .highVolumeOptions.NAO,
                                                },
                                            ]}
                                            placeholder={
                                                t.channels.sellerProfile.sellerTypePlaceholder
                                            }
                                            name={field.name}
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            ref={field.ref}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                    )}
                </>
            )}
            <div style={gridCard}>
                {feeFieldMetas.map((meta) => (
                    <ChannelFeeField
                        key={meta.name}
                        control={control}
                        index={index}
                        meta={meta}
                        error={outcome?.errors[meta.name]}
                        applied={outcome?.appliedFees[meta.name]}
                    />
                ))}
            </div>
            {/* 016/PR-F homologação (A1 + reverify) — entrada bandada: os placeholders de Comissão/Taxa
          fixa acima mostram a banda que REALMENTE se aplica ao preço da tela, e ela muda se o preço
          mudar de faixa — esta legenda diz isso uma vez, para o slot inteiro. A frase da REGRA
          ("taxa fixa = {pct}% do preço") vive AQUI, em largura total, e não como sufixo do
          placeholder: com 77–187px úteis o sufixo cortava para "2,50 (= 50" — parêntese aberto e um
          número solto, a leitura errada que a frase existia para impedir. O placeholder mostra só o
          valor resolvido; a legenda quebra linha à vontade (medido no reverify, r5-*). */}
            {outcome?.appliedFeesFromBand && (
                <p style={captionText}>
                    {t.channels.bandedFeesCaption}
                    {outcome.appliedFixedFeeRulePct != null &&
                        " " +
                            t.channels.fixedFeeRuleCaption.replace(
                                "{pct}",
                                String(outcome.appliedFixedFeeRulePct),
                            )}
                </p>
            )}
            {/* hotfix 016/A2 (H2c) — o subsídio de frete da Shopee como INFORMAÇÃO, nunca como desconto:
          zero número no código (Constituição II), tudo lido de `freightSubsidyInfo` via
          `resolveFreightSubsidyCeiling`. Fica ao lado da grade de taxas, junto das outras legendas
          do slot — nunca dentro do campo "Frete", que continua sendo a ÚNICA origem de desconto
          (H2/FR-111b). */}
            {shopeeSubsidy && subsidyCeiling !== null && (
                <p style={captionText} data-testid="freight-subsidy-info">
                    {t.channels.freightSubsidy.caption.replace(
                        "{ceiling}",
                        formatBRL(subsidyCeiling),
                    )}{" "}
                    {t.channels.freightSubsidy.provenance
                        .replace("{source}", shopeeSubsidy.source)
                        .replace("{date}", formatDatePtBr(shopeeSubsidy.effectiveDate))}
                </p>
            )}
            {/* 016/US16 (FR-923, ADR-0027 §3.2) — catalog-driven optional surcharges (Shopee
          MANUSEIO_VOLUMOSO). Zero string/number here — label, value and provenance all come from
          `plan.surcharges` (the catalog). */}
            {plan.surcharges.length > 0 && (
                <div className="flex flex-col gap-2">
                    {plan.surcharges.map((s) => (
                        <SurchargeCheckbox
                            key={s.id}
                            control={control}
                            index={index}
                            surcharge={s}
                        />
                    ))}
                </div>
            )}
            {/* Honesty seal (FR-107): where this slot's fees came from + how fresh they are; the ML
          free-shipping subsidy carries its own "estimativa" seal (A4); the fixed fee's OWN
          provenance (016/PR-F, T057) is a SEPARATE block when the entry carries one. 019/PR-C
          (prancheta 13d) — a ORDEM é fixa: bloco da comissão, bloco da taxa fixa, pílulas por
          último (nunca `flex-wrap`, que deixava o selo curto subir e o longo descer). */}
            {outcome && (
                <div className="flex flex-col gap-2">
                    <FeeSeal state={outcome.seal} marketplace={slot.marketplace} />
                    {outcome.fixedFeeSource && (
                        <FixedFeeSourceBadge
                            source={outcome.fixedFeeSource}
                            marketplace={slot.marketplace}
                        />
                    )}
                    {outcome.freightIsEstimate && (
                        <FeeSeal state={{ kind: "estimate" }} marketplace={slot.marketplace} />
                    )}
                </div>
            )}
            {/* 016/US17 (FR-924) — the two honest Shopee warnings. The regressive-fee one fires only where
          the money is real (CPF de alto volume, a base que o motor recusou — I9); the measured-
          freight one is a static, always-visible risk note for any Shopee slot. */}
            {slot.marketplace === "SHOPEE" && (
                <div className="flex flex-col gap-2">
                    {slot.sellerType === "CPF" &&
                        slot.highVolume === "SIM" &&
                        isUnpriced(outcome?.result ?? null) && <ShopeeRegressiveFeeWarning />}
                    <ShopeeMeasuredFreightWarning />
                </div>
            )}
        </Card>
    );
}

/** One markup level's rows for a priced channel: anúncio, an optional freight deduction line, and
 *  líquido — flagged when negative when a typed freight exceeds the margin. hotfix-016-a2 (R4): a
 *  freight line exists ONLY when the seller typed `freightCost` (FR-111b — "declarado OU com
 *  valor"); the old "Shopee co-funded voucher" wording described the 005 model the sources refuted
 *  (art. 23431: the coupon subsidy is Shopee's cost, universal — never the seller's).
 *
 *  019/PR-F (T142, prancheta 10a/10c) — no caption "Varejo"/"Atacado" própria mais: o `<Segmented
 *  split>` de `PriceResults` já governa qual nível é este, e repeti-lo aqui seria a mesma
 *  informação duas vezes. O aviso de frete (`freightHint`) migra da legenda solta que existia
 *  ABAIXO do bloco para o `sublabel` da própria linha "Frete" (10c: `tf-brow--muted` com o
 *  sublabel embutido) — um único lugar em vez de dois. */
function ChannelLevelRows({
    anuncio,
    liquido,
    freight,
}: {
    anuncio: number;
    liquido: number;
    freight: number;
}) {
    return (
        <>
            <BreakdownRow label={t.results.precoAnuncio} value={anuncio} />
            {freight > 0 && (
                <BreakdownRow
                    label={t.channels.freightLine}
                    sublabel={t.channels.freightHint}
                    value={-freight}
                    emphasis="muted"
                />
            )}
            <BreakdownRow
                label={t.results.recebidoLiquido}
                value={liquido}
                emphasis={liquido < 0 ? "negative" : "default"}
            />
            {liquido < 0 && <p style={warnCaption}>{t.channels.negativeLiquido}</p>}
        </>
    );
}

/** One markup level the engine REFUSED to price (SC-817 / FR-014a): the announce it would need
 *  falls in a window the marketplace publishes no fee for, so there is no rate to charge and no
 *  líquido to promise. Saying that costs one line; printing R$ 0,00 would cost the seller a sale.
 *  019/PR-F — no caption própria pela mesma razão de `ChannelLevelRows` acima. */
function UnpricedLevel() {
    return (
        <p style={warnCaption} data-testid="unpriced-level">
            {t.channels.unpricedBand}
        </p>
    );
}

/** "Preços por marketplace" cards: every slot's anúncio + líquido, one `level` at a time (the
 *  `<Segmented split>` in `PriceResults` governs it — SAME `level` as the hero + the summary
 *  line). A slot with an inline error shows a note, not stale prices.
 *
 *  019/PR-F (T142, prancheta 10a/10d) — was folded into the SAME "Como chegamos no preço" Card
 *  (016/US5, FR-907); now it is its OWN section (10a: "vira seção própria"), and each channel is
 *  its OWN `<Card>` (10d: a two-column grid at ≥1024px via `.tf-marketplace-cards`, one column
 *  below that) instead of a `channelDivider`-separated list inside one big card. Returns `null`
 *  with no active channel — the caller only renders the wrapping section when this has content. */
function ChannelPriceBlocks({
    values,
    channelOutcomes,
    level,
}: {
    values: CalcFormValues;
    channelOutcomes: ChannelSlotOutcome[];
    level: PriceLevel;
}) {
    if (channelOutcomes.length === 0) return null;
    return (
        <>
            {channelOutcomes.map((oc, i) => {
                const slot = values.channels[i];
                const name = t.marketplaceNames[slot.marketplace] ?? t.channels.channelFallback;
                const modName = slot.modality ? t.modalityNames[slot.modality] : "";
                const r = oc.result;
                // Three states: a valid priced channel shows its rows; a valid slot with no fee yet shows
                // a hint (base==anúncio rows would just echo the headline); a bad slot shows its note.
                const priced = r && r.error === null && oc.hasFee;
                // SC-817 — a level whose announce falls outside every published band is NOT priced.
                // `?? 0` would have printed R$ 0,00 under a "Referência" seal; the absence of a published
                // fee is said in words, and only for the LEVEL SELECTED (varejo and atacado can land on
                // different sides of a gap, but only one shows at a time now). `r` non-null is what
                // `priced` already proved — `fields` re-narrows it once, so `anuncio`/`liquido` type as
                // `number | null` (never `undefined`, matching `ChannelResult`'s own shape).
                const fields = r
                    ? level === "varejo"
                        ? {
                              anuncio: r.precoAnuncioVarejo,
                              liquido: r.recebidoLiquidoVarejo,
                              freight: r.freightCostVarejo,
                          }
                        : {
                              anuncio: r.precoAnuncioAtacado,
                              liquido: r.recebidoLiquidoAtacado,
                              freight: r.freightCostAtacado,
                          }
                    : null;
                return (
                    <Card
                        key={i}
                        padding="md"
                        className="flex flex-col gap-2"
                        data-testid="channel-price"
                    >
                        <p style={channelCardTitle}>
                            {name}
                            {modName && <span style={channelModality}> · {modName}</span>}
                        </p>
                        <div className="flex flex-col">
                            {priced && fields ? (
                                fields.anuncio === null || fields.liquido === null ? (
                                    <UnpricedLevel />
                                ) : (
                                    <ChannelLevelRows
                                        anuncio={fields.anuncio}
                                        liquido={fields.liquido}
                                        freight={fields.freight}
                                    />
                                )
                            ) : (
                                <p style={captionText}>
                                    {oc.result ? t.channels.noFeeHint : t.channels.errorRow}
                                </p>
                            )}
                        </div>
                    </Card>
                );
            })}
        </>
    );
}

/**
 * US1 multi-channel marketplace pricing. Starts with one Mercado Livre slot; the user adds/removes
 * slots, picks each marketplace + modality, enters (or, in US2, pre-fills) its fees, and reads every
 * channel's grossed-up anúncio + líquido (varejo e atacado) together in "Preços por canal". Each
 * slot validates in isolation — commission ≥ 100% errors only its slot (SC-107).
 */
export function MarketplaceSection({
    control,
    values,
    fields,
    channelOutcomes,
    included,
    onToggleInclude,
    onAppend,
    onRemove,
    onMarketplaceChange,
    refreshFailed,
    refreshing,
    onRetryCatalog,
    spineFor,
    catalog,
    entitled,
    signedOut,
}: {
    control: Control<CalcFormValues>;
    values: CalcFormValues;
    fields: { id: string }[];
    channelOutcomes: ChannelSlotOutcome[];
    included: boolean;
    onToggleInclude: (included: boolean) => void;
    onAppend: (slot: ChannelSlotForm) => void;
    onRemove: (index: number) => void;
    onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
    refreshFailed: boolean;
    refreshing: boolean;
    onRetryCatalog: () => void;
    /** Category spine per marketplace, from the catalog that already travels with the fees (D2). */
    spineFor: (marketplace: MarketplaceId) => readonly CategoryNode[];
    /** 016/US12 — feeds `channelFieldPlan` (RA5: the same plan that decides what renders here also
     *  decides what is SENT as a determinant, in `fee-prefill.ts:slotDeterminants`). */
    catalog: FeeCatalog;
    /**
     * 016/US11 (T048, FR-915) — is THIS account entitled to price a channel? `true` on the two
     * always-premium surfaces (kit lines, the product page — both mount only behind their own
     * page-level entitlement gate already); on the free calculator it is the server-derived
     * `entitlement.data?.status === "active"` (ADR-0012 — the UI gate is convenience, never the
     * authority; a checking/error state degrades to "not entitled", never a guessed "yes").
     */
    entitled: boolean;
    /** Where `TeaserUpgrade` sends a signed-out visitor (through sign-in, preserving intent). */
    signedOut: boolean;
}) {
    return (
        <div className="flex flex-col gap-3">
            {/* US4: the "Incluir marketplaces no preço" master toggle stays OUTSIDE the collapsible body so
          the section is always re-enableable. It is pure visibility — off hides every channel row and
          stops computing the channels (SC-105); the direct varejo/atacado headline is untouched.
          The toggle sits on its OWN full-width row (label left, switch right) so the label never gets
          squeezed into a 2-line wrap beside the switch at 390px (homologation nit). */}
            <SectionTitle title={t.sections.marketplace} info={t.sectionInfo.marketplace} />
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
                <span>{t.channels.includeToggle}</span>
                {/* 016/US11 (T048, FR-915) — for a non-entitled account the switch is DISABLED and FALSE,
            unconditionally: never the form's own `included` value, which would let a stale
            `includeMarketplace: true` (the default) read as "on" the instant entitlement resolves
            momentarily false (checking/error). Nenhum número de canal, parcial ou fake. */}
                <Switch
                    checked={entitled && included}
                    disabled={!entitled}
                    onCheckedChange={onToggleInclude}
                    aria-label={t.channels.includeToggle}
                />
            </label>
            {!entitled ? (
                // 016/T055-reverify — na faixa full-width do grátis, o "Assinar" sem align ficava a
                // ~950px da legenda que o motiva (o MESMO órfão de 149,6px que fez a prop `align`
                // nascer no E6/T038-D2). Centrado, texto e CTA leem como uma unidade.
                <div
                    className="flex flex-col gap-2"
                    style={{ textAlign: "center" }}
                    data-testid="marketplace-premium-gate"
                >
                    <p style={captionText}>{t.channels.premiumOnly}</p>
                    <TeaserUpgrade signedOut={signedOut} align="center" />
                </div>
            ) : (
                included && (
                    <>
                        {/* US3: a failed online fee refresh is NON-BLOCKING — the saved/seed reference still pre-fills
                and every price computes; this only offers a retry (tone "info", role="status" — no alarm).
                `refreshFailed` is STICKY (see the hook) so the notice doesn't blink out during a retry's
                transient pending window; `refreshing` then drives the button's in-flight spinner. */}
                        {refreshFailed && (
                            <Alert tone="info" title={t.channels.refreshErrorTitle}>
                                <p>{t.channels.refreshErrorBody}</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onRetryCatalog}
                                    loading={refreshing}
                                    className="mt-2"
                                >
                                    {t.channels.refreshRetry}
                                </Button>
                            </Alert>
                        )}
                        <div className="flex flex-col gap-3">
                            {fields.map((f, i) => (
                                <ChannelSlot
                                    key={f.id}
                                    control={control}
                                    index={i}
                                    slot={values.channels[i]}
                                    outcome={channelOutcomes[i]}
                                    spine={spineFor(values.channels[i].marketplace)}
                                    catalog={catalog}
                                    onRemove={onRemove}
                                    onMarketplaceChange={onMarketplaceChange}
                                />
                            ))}
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onAppend(defaultChannelSlot())}
                        >
                            {t.channels.addChannel}
                        </Button>
                        {/* 016/US5 — "Preços por canal" no longer renders here: it folded into `PriceResults`'
                "Como chegamos no preço" Card (FR-907), so this section stays purely the channel
                INPUT editing UI (marketplace/modality/category/fees + the honesty seal). */}
                    </>
                )
            )}
        </div>
    );
}

/** One "Outros custos" row (US5): a free-text name + a currency value, wired to `otherCosts.{i}`. The
 *  value error comes from the per-row model outcome (not RHF), so a bad row flags itself while the
 *  price still computes from the valid rows (FR-116). A blank name is accepted (neutral placeholder). */
function OtherCostRow({
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
