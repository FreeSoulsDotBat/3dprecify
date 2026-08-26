import { type CSSProperties, useState } from "react";
import { type Control, Controller, useController } from "react-hook-form";

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
import { avisoDeCampo, avisoDeComissao, avisosDePlausibilidade } from "@/shared/lib/plausibilidade";
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
  BreakdownRow,
  Button,
  Card,
  Field,
  InfoTip,
  NumberField,
  PriceHero,
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

const channelDivider: CSSProperties = {
  borderTop: "1px solid var(--border-default)",
  paddingTop: "var(--space-3)",
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
  return (
    <Alert tone="info">
      <span data-testid="aviso-resultado">{avisos.map((a) => a.texto).join(" ")}</span>
    </Alert>
  );
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
      render={({ field, fieldState }) => {
        // Homologação automatizada — o aviso de plausibilidade nasce AQUI, do próprio valor do
        // campo, sem prop nenhuma atravessando a árvore. Consequência desejada: o
        // `widgets/bom-line-editor`, que renderiza os MESMOS `CalcFieldMeta`, ganha os mesmos
        // avisos sem uma linha a mais.
        //
        // Ele entra como HINT, nunca como `error`: o `Field` substitui o hint pelo erro, então um
        // campo genuinamente inválido continua mostrando a recusa (que é o que importa), e o aviso
        // some — que é o comportamento certo, porque avisar sobre a plausibilidade de um número que
        // o produto nem aceitou seria ruído. E, sobretudo: aviso não é erro. Ver o cabeçalho de
        // `plausibilidade.ts` — "AVISO NUNCA VIRA VALIDAÇÃO".
        const aviso = avisoDeCampo(meta.name, String(field.value ?? ""));
        return (
          <Field
            label={meta.label}
            labelAddon={meta.tip && <InfoTip label={meta.tip.label}>{meta.tip.body}</InfoTip>}
            required={meta.required}
            optional={!meta.required}
            hint={
              aviso ? (
                <>
                  {meta.hint && <span className="tf-field__hint-line">{meta.hint}</span>}
                  <span className="tf-field__aviso" data-testid={`aviso-${meta.name}`}>
                    {aviso}
                  </span>
                </>
              ) : (
                meta.hint
              )
            }
            error={fieldState.error?.message}
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
                error={Boolean(fieldState.error)}
              />
            )}
          </Field>
        );
      }}
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

/** 016/US7 (FR-909) — the printTime border: two number inputs (h + min), converted to/from the
 *  SAME decimal the engine has always received (`time-input.ts` owns the pure conversion; the RHF
 *  field value never changes shape). A document saved with a decimal (`5.5`) reopens showing the
 *  derived h+min (`5h 30min`) — the read path is the same helper, not a second rule. */
export function TimeHmField({ control }: { control: Control<CalcFormValues> }) {
  return (
    <Controller
      control={control}
      name="printTimeHours"
      render={({ field, fieldState }) => {
        const { h, min } = decimalHoursToHm(field.value);
        const commit = (nextH: number, nextMin: number) => {
          field.onChange(hmToDecimalString(nextH, nextMin));
        };
        // Este campo NÃO passa pelo `ControlledField` (tem controle próprio de h+min), então o
        // aviso precisa ser pedido aqui — e é justamente o caso do achado CF-002-LEIGO-C: 150 no
        // campo de HORAS, quando o vendedor queria dizer 150 minutos, multiplica o custo por 15.
        const aviso = avisoDeCampo("printTimeHours", String(field.value ?? ""));
        return (
          <Field
            label={t.fields.printTime}
            required
            hint={
              aviso ? (
                <span className="tf-field__aviso" data-testid="aviso-printTimeHours">
                  {aviso}
                </span>
              ) : undefined
            }
            error={fieldState.error?.message}
          >
            {() => (
              <div className="flex items-center gap-2">
                <CampoDeHoras h={h} min={min} onCommit={commit} onBlurField={field.onBlur} />
                <NumberField
                  aria-label={t.timeInput.minutesAria}
                  unit={t.timeInput.minutesUnit}
                  inputMode="numeric"
                  placeholder="0"
                  value={String(min)}
                  onChange={(e) => commit(h, Number.parseInt(e.target.value, 10) || 0)}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          </Field>
        );
      }}
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
export function MachineCostFields({ control }: { control: Control<CalcFormValues> }) {
  const valueField = useController({ control, name: "machineValue" });
  const lifetimeField = useController({ control, name: "machineLifetimeHours" });
  const [manualOverride, setManualOverride] = useState(false);

  const currentHours = parseDecimal(lifetimeField.field.value);
  const detected = detectRitmoMode(currentHours);
  const adjustMode = manualOverride || detected === null;
  const ritmoIndex: RitmoIndex = detected?.ritmoIndex ?? 1;
  const paybackYears = detected?.paybackYears ?? 3;

  const applyRitmo = (idx: RitmoIndex, years: number) => {
    lifetimeField.field.onChange(String(deriveMachineLifetimeHours(idx, years)));
  };

  const machineValueNum = parseDecimal(valueField.field.value);
  const perHour = costPerHour(machineValueNum, currentHours);

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
                  onChange={(e) => applyRitmo(Number(e.target.value) as RitmoIndex, paybackYears)}
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
          <p style={captionText}>
            {t.machineCost.derivedCaption.replace("{value}", formatBRL(perHour))}
          </p>
          {/* 016/PR-C homologação (R1) — plain text read with no clickable affordance; `secondary`
              draws the real border+surface a button needs to look tappable (`ghost` reads as
              text until hovered/focused, which a touch device never does before the tap itself). */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setManualOverride(true)}
            className="self-start"
          >
            {t.machineCost.adjustButton}
          </Button>
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
              não está visível, e a semente 3600h abre em modo ritmo, onde ele nem é montado. */}
          <Field
            label={t.fields.machineLifetime}
            labelAddon={
              <InfoTip label={t.fieldTips.machineLifetime.label}>
                {t.fieldTips.machineLifetime.body}
              </InfoTip>
            }
            required
            hint={(() => {
              const aviso = avisoDeCampo(
                "machineLifetimeHours",
                String(lifetimeField.field.value ?? ""),
              );
              return aviso ? (
                <span className="tf-field__aviso" data-testid="aviso-machineLifetimeHours">
                  {aviso}
                </span>
              ) : undefined;
            })()}
          >
            {(p) => (
              <NumberField
                {...p}
                unit="h"
                name={lifetimeField.field.name}
                value={lifetimeField.field.value}
                onChange={lifetimeField.field.onChange}
                onBlur={lifetimeField.field.onBlur}
                ref={lifetimeField.field.ref}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              setManualOverride(false);
              applyRitmo(ritmoIndex, paybackYears);
            }}
          >
            {t.machineCost.backToEstimateButton}
          </Button>
        </>
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

/** US1 hero prices + US2 transparent breakdown. Rendered only for a fully valid form.
 *  US5 (FR-907) — the per-channel descriptives ("Preços por canal") fold in here, inside the
 *  SAME "Como chegamos no preço" Card, instead of living as their own titled section: pass
 *  `channelOutcomes` from the page (already computed regardless of where `MarketplaceSection`
 *  itself renders) and they render right after the cost breakdown, before the final price
 *  cards — one section describes every price the seller reads. */
export function PriceResults({
  result,
  values,
  channelOutcomes = [],
}: {
  result: PriceResult;
  values: CalcFormValues;
  channelOutcomes?: ChannelSlotOutcome[];
}) {
  const line = (value: number, optional: boolean) =>
    optional && value === 0 ? ("muted" as const) : ("default" as const);

  return (
    <>
      {/* (4) Transparent breakdown — every R$ line sums to custo_total, then the markup
          derivation (SC-002). Shown BEFORE the suggested prices so the user sees how the
          number is built before the takeaway. */}
      <div className="flex flex-col gap-2">
        <SectionTitle title={t.sections.breakdown} info={t.sectionInfo.breakdown} />
        {/* Homologação automatizada (CF-001-LEIGO-D-P5) — a persona que "zera o que não entende"
            chega a custo R$ 0,00 e preço de venda R$ 0,00, e o produto entregava isso calado. Cada
            campo em 0 é perfeitamente válido isolado: só o RESULTADO denuncia. Por isso este aviso
            é o único que não mora num campo — não há um campo culpado. */}
        <AvisoDeResultado result={result} />
        <Card padding="md">
          {/* 016/US5 — the colour key dots beside Material/Energia were removed (FR-907-AC2);
              the rows are already legible by label + tabular value, and the dots read as
              chart-legend chrome the breakdown never needed. */}
          <BreakdownRow label={t.results.material} value={result.material} />
          <BreakdownRow label={t.results.energy} value={result.energy} />
          <BreakdownRow label={t.results.machine} value={result.machine} />
          <BreakdownRow
            label={t.results.failure}
            value={result.falha}
            emphasis={line(result.falha, true)}
          />
          <BreakdownRow
            label={t.results.finishing}
            value={result.finishing}
            emphasis={line(result.finishing, true)}
          />
          <BreakdownRow
            label={t.results.labor}
            value={result.labor}
            emphasis={line(result.labor, true)}
          />
          {/* US5 (FR-115): each named "Outros custos" sub-cost is its own breakdown line (a blank name
              falls back to a neutral label). Their sum is folded into custo_total below. */}
          {result.otherCosts.map((c, i) => (
            <BreakdownRow
              key={`other-cost-${i}`}
              label={c.name.trim() || t.outrosCustos.lineFallback}
              value={c.value}
            />
          ))}
          <BreakdownRow label={t.results.custoTotal} value={result.custoTotal} emphasis="total" />
          {/* How each sale price derives from custo_total via markup (FR-033). */}
          <BreakdownRow
            label={t.results.varejo}
            sublabel={`${t.captions.markup} ${values.markupVarejoPct || "0"}%`}
            value={result.precoVarejo}
            emphasis="accent"
          />
          <BreakdownRow
            label={t.results.atacado}
            sublabel={`${t.captions.markup} ${values.markupAtacadoPct || "0"}%`}
            value={result.precoAtacado}
          />
          {/* US5 (FR-907) — "Preços por canal" folded into the SAME Card: no second titled
              section, no duplicated total/markup lines above, nothing lost (every channel still
              shows anúncio + líquido for varejo e atacado). Absent entirely with no active
              channel (toggle OFF / no slots), exactly as the standalone section was before. */}
          {channelOutcomes.length > 0 && (
            <div className="flex flex-col gap-4" style={channelDivider}>
              <p style={sectionLabel}>{t.channels.pricesTitle}</p>
              <ChannelPriceBlocks values={values} channelOutcomes={channelOutcomes} />
            </div>
          )}
        </Card>
      </div>

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

      {/* (5) The suggested prices — the user's final takeaway, so they close the screen.
          Both retail + wholesale are always shown together (SC-010). */}
      {/* 015/A6 ([F11a-002]) — was a hardcoded `1fr 1fr` at EVERY width. At 360px that left each
          price card ~108px of content for a value needing 124px, and the number was the thing that
          gave: it broke mid-digit (`950.096` on two lines) so the page would not overflow. The
          constraint was never the font size — it was the two-column grid. `auto-fit` + a 160px
          floor keeps both prices side by side wherever they fit and stacks them at 360, where a
          six-figure price then has room to spare. SC-010 is untouched: both are still always
          shown together, now one above the other instead of one beside the other. */}
      <div
        style={{
          display: "grid",
          // 210px = the 147px a six-figure price needs at 36px + the card's 48px of padding,
          // plus headroom for font fallback. Measured, not guessed: a 160px floor fixed 360px
          // and left 390px still scrolling 24px, because two columns still fit there.
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {/* T016 — final price cards read centered (label/amount/caption), not left-aligned. */}
        <PriceHero
          label={t.results.varejo}
          value={result.precoVarejo}
          caption={`${t.captions.markup} ${values.markupVarejoPct || "0"}%`}
          tone="accent"
          size="md"
          center
        />
        <PriceHero
          label={t.results.atacado}
          value={result.precoAtacado}
          caption={`${t.captions.markup} ${values.markupAtacadoPct || "0"}%`}
          tone="energy"
          size="md"
          center
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

/** ISO date ("2026-02-02") → pt-BR "02/02/2026" (mirrors `fee-seal.tsx`'s `fmtDate`; kept local —
 *  the surcharge caption is the only consumer in this file). */
function fmtDatePtBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
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
                    next ? [...current, surcharge.id] : current.filter((id) => id !== surcharge.id),
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
                .replace("{date}", fmtDatePtBr(surcharge.effectiveDate))}
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
                      { value: "CPF", label: t.channels.sellerProfile.sellerTypeOptions.CPF },
                      { value: "CNPJ", label: t.channels.sellerProfile.sellerTypeOptions.CNPJ },
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
                        { value: "SIM", label: t.channels.sellerProfile.highVolumeOptions.SIM },
                        { value: "NAO", label: t.channels.sellerProfile.highVolumeOptions.NAO },
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
          {t.channels.freightSubsidy.caption.replace("{ceiling}", formatBRL(subsidyCeiling))}{" "}
          {t.channels.freightSubsidy.provenance
            .replace("{source}", shopeeSubsidy.source)
            .replace("{date}", fmtDatePtBr(shopeeSubsidy.effectiveDate))}
        </p>
      )}
      {/* 016/US16 (FR-923, ADR-0027 §3.2) — catalog-driven optional surcharges (Shopee
          MANUSEIO_VOLUMOSO). Zero string/number here — label, value and provenance all come from
          `plan.surcharges` (the catalog). */}
      {plan.surcharges.length > 0 && (
        <div className="flex flex-col gap-2">
          {plan.surcharges.map((s) => (
            <SurchargeCheckbox key={s.id} control={control} index={index} surcharge={s} />
          ))}
        </div>
      )}
      {/* Honesty seal (FR-107): where this slot's fees came from + how fresh they are; the ML
          free-shipping subsidy carries its own "estimativa" seal (A4); the fixed fee's OWN
          provenance (016/PR-F, T057) is a SEPARATE badge when the entry carries one. */}
      {outcome && (
        <div className="flex flex-wrap items-center gap-2">
          <FeeSeal state={outcome.seal} />
          {outcome.freightIsEstimate && <FeeSeal state={{ kind: "estimate" }} />}
          {outcome.fixedFeeSource && <FixedFeeSourceBadge source={outcome.fixedFeeSource} />}
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
 *  (art. 23431: the coupon subsidy is Shopee's cost, universal — never the seller's). */
function ChannelLevelRows({
  caption,
  anuncio,
  liquido,
  freight,
  marginTop,
}: {
  caption: string;
  anuncio: number;
  liquido: number;
  freight: number;
  marginTop?: boolean;
}) {
  return (
    <>
      <p style={marginTop ? { ...captionText, marginTop: "var(--space-2)" } : captionText}>
        {caption}
      </p>
      <BreakdownRow label={t.results.precoAnuncio} value={anuncio} />
      {freight > 0 && (
        <BreakdownRow label={t.channels.freightLine} value={-freight} emphasis="muted" />
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
 *  líquido to promise. Saying that costs one line; printing R$ 0,00 would cost the seller a sale. */
function UnpricedLevel({ caption, marginTop }: { caption: string; marginTop?: boolean }) {
  return (
    <>
      <p style={marginTop ? { ...captionText, marginTop: "var(--space-2)" } : captionText}>
        {caption}
      </p>
      <p style={warnCaption} data-testid="unpriced-level">
        {t.channels.unpricedBand}
      </p>
    </>
  );
}

/** "Preços por canal" ROWS: every slot's anúncio + líquido for varejo e atacado, shown together
 *  so the seller compares channels at a glance. A slot with an inline error shows a note, not
 *  stale prices. 016/US5 (FR-907) — this used to own its own titled Card; it is now the tail of
 *  `PriceResults`' single "Como chegamos no preço" Card (the caller supplies the heading), so the
 *  descriptives live in ONE section instead of two. Returns `null` with no active channel — same
 *  visibility rule as before (toggle OFF / no slots ⇒ nothing renders, t.channels.pricesTitle
 *  included, since the caller only renders its wrapping heading when this has content). */
function ChannelPriceBlocks({
  values,
  channelOutcomes,
}: {
  values: CalcFormValues;
  channelOutcomes: ChannelSlotOutcome[];
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
        return (
          <div
            key={i}
            className="flex flex-col gap-1"
            data-testid="channel-price"
            style={i > 0 ? channelDivider : undefined}
          >
            <p style={sectionLabel}>
              {name}
              {modName && <span style={channelModality}> · {modName}</span>}
            </p>
            {priced ? (
              <>
                {/* SC-817 — a level whose announce falls outside every published band is NOT
                      priced. `?? 0` would have printed R$ 0,00 under a "Referência" seal; the
                      absence of a published fee is said in words, and only for the level it hits
                      (varejo and atacado can land on different sides of a gap). */}
                {r.precoAnuncioVarejo === null || r.recebidoLiquidoVarejo === null ? (
                  <UnpricedLevel caption={t.captions.varejo} />
                ) : (
                  <ChannelLevelRows
                    caption={t.captions.varejo}
                    anuncio={r.precoAnuncioVarejo}
                    liquido={r.recebidoLiquidoVarejo}
                    freight={r.freightCostVarejo}
                  />
                )}
                {r.precoAnuncioAtacado === null || r.recebidoLiquidoAtacado === null ? (
                  <UnpricedLevel caption={t.captions.atacado} marginTop />
                ) : (
                  <ChannelLevelRows
                    caption={t.captions.atacado}
                    anuncio={r.precoAnuncioAtacado}
                    liquido={r.recebidoLiquidoAtacado}
                    freight={r.freightCostAtacado}
                    marginTop
                  />
                )}
                {(r.freightCostVarejo > 0 || r.freightCostAtacado > 0) && (
                  <p style={captionText}>{t.channels.freightHint}</p>
                )}
              </>
            ) : (
              <p style={captionText}>{oc.result ? t.channels.noFeeHint : t.channels.errorRow}</p>
            )}
          </div>
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
            <Button variant="secondary" size="sm" onClick={() => onAppend(defaultChannelSlot())}>
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
