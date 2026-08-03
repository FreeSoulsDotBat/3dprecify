import { type CSSProperties } from "react";
import { type Control, Controller } from "react-hook-form";

import { type ChannelSlotOutcome } from "@/features/calculator/calculator-model";
import { CategoryPicker } from "@/features/calculator/category-picker";
import { FeeSeal } from "@/features/calculator/fee-seal";
import {
  type CalcFieldMeta,
  type CalcFormValues,
  CHANNEL_FEE_FIELDS,
  type ChannelSlotForm,
  defaultChannelSlot,
  type MarketplaceId,
  MARKETPLACE_OPTIONS,
  MODALITY_OPTIONS,
} from "@/features/calculator/calculator-schema";
import type { CategoryNode } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
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

/** One controlled numeric input wired to RHF + the DS Field/NumberField. */
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
        <Field
          label={meta.label}
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
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={Boolean(fieldState.error)}
            />
          )}
        </Field>
      )}
    />
  );
}

/** US1 hero prices + US2 transparent breakdown. Rendered only for a fully valid form. */
export function PriceResults({ result, values }: { result: PriceResult; values: CalcFormValues }) {
  const line = (value: number, optional: boolean) =>
    optional && value === 0 ? ("muted" as const) : ("default" as const);

  return (
    <>
      {/* (4) Transparent breakdown — every R$ line sums to custo_total, then the markup
          derivation (SC-002). Shown BEFORE the suggested prices so the user sees how the
          number is built before the takeaway. */}
      <div className="flex flex-col gap-2">
        <SectionTitle title={t.sections.breakdown} info={t.sectionInfo.breakdown} />
        <Card padding="md">
          <BreakdownRow label={t.results.material} value={result.material} color="var(--accent)" />
          <BreakdownRow label={t.results.energy} value={result.energy} color="var(--energy)" />
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
        <PriceHero
          label={t.results.varejo}
          value={result.precoVarejo}
          caption={`${t.captions.markup} ${values.markupVarejoPct || "0"}%`}
          tone="accent"
          size="md"
        />
        <PriceHero
          label={t.results.atacado}
          value={result.precoAtacado}
          caption={`${t.captions.markup} ${values.markupAtacadoPct || "0"}%`}
          tone="energy"
          size="md"
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
  /** 015/A8 ([F11a-007]) — o valor que o CATÁLOGO está aplicando neste campo, quando ele é único. */
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
      render={({ field }) => (
        <Field label={meta.label} optional error={error}>
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
      )}
    />
  );
}

/** One editable channel slot: marketplace + (conditional) modality selectors, the manual fee grid,
 *  and a remove control. Changing the marketplace resets the modality to that market's default. */
function ChannelSlot({
  control,
  index,
  slot,
  outcome,
  spine,
  onRemove,
  onMarketplaceChange,
}: {
  control: Control<CalcFormValues>;
  index: number;
  slot: ChannelSlotForm;
  outcome?: ChannelSlotOutcome;
  /** This marketplace's category spine (empty when it has no category axis, or not loaded yet). */
  spine: readonly CategoryNode[];
  onRemove: (index: number) => void;
  onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
}) {
  const modalityOptions = MODALITY_OPTIONS[slot.marketplace] ?? [];
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
      {modalityOptions.length > 0 && (
        <Controller
          control={control}
          name={`channels.${index}.modality` as const}
          render={({ field }) => (
            <Field label={t.channels.modality} tightLabel>
              {(p) => (
                <Select
                  {...p}
                  options={modalityOptions}
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
      {/* 014/US1 — only where the marketplace HAS a category axis. Shopee/Outro publish none, so
          rendering an empty picker there would invent a choice that does not exist. */}
      {modalityOptions.length > 0 && (
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
      <div style={gridCard}>
        {CHANNEL_FEE_FIELDS.map((meta) => (
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
      {/* Honesty seal (FR-107): where this slot's fees came from + how fresh they are; the ML
          free-shipping subsidy carries its own "estimativa" seal (A4). */}
      {outcome && (
        <div className="flex flex-wrap items-center gap-2">
          <FeeSeal state={outcome.seal} />
          {outcome.freightIsEstimate && <FeeSeal state={{ kind: "estimate" }} />}
        </div>
      )}
    </Card>
  );
}

/** One markup level's rows for a priced channel: anúncio, an optional freight/voucher deduction line
 *  (Shopee co-funded voucher / manual freight), and líquido — flagged when negative, since a voucher
 *  can exceed the margin (FR-111a). The deduction is shown, never hidden, so the líquido drop is honest. */
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

/** "Preços por canal": every slot's anúncio + líquido for varejo e atacado, shown together so the
 *  seller compares channels at a glance. A slot with an inline error shows a note, not stale prices. */
function ChannelPrices({
  values,
  channelOutcomes,
}: {
  values: CalcFormValues;
  channelOutcomes: ChannelSlotOutcome[];
}) {
  if (channelOutcomes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p style={sectionLabel}>{t.channels.pricesTitle}</p>
      <Card padding="md" className="flex flex-col gap-4">
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
      </Card>
    </div>
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
        <Switch
          checked={included}
          onCheckedChange={onToggleInclude}
          aria-label={t.channels.includeToggle}
        />
      </label>
      {included && (
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
                onRemove={onRemove}
                onMarketplaceChange={onMarketplaceChange}
              />
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => onAppend(defaultChannelSlot())}>
            {t.channels.addChannel}
          </Button>
          <ChannelPrices values={values} channelOutcomes={channelOutcomes} />
        </>
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
