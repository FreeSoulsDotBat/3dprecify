import { type CSSProperties } from "react";
import { type Control, Controller, useFieldArray, useForm } from "react-hook-form";

import { type ChannelSlotOutcome, computeFromForm } from "@/features/calculator/calculator-model";
import { FeeSeal } from "@/features/calculator/fee-seal";
import {
  type CalcFieldMeta,
  type CalcFormValues,
  calculatorResolver,
  CHANNEL_FEE_FIELDS,
  type ChannelSlotForm,
  defaultCalcValues,
  defaultChannelSlot,
  LABOR_FIELDS,
  MANDATORY_FIELDS,
  type MarketplaceId,
  MARKETPLACE_OPTIONS,
  MARKUP_FIELDS,
  type Modality,
  MODALITY_OPTIONS,
  OPTIONAL_FIELDS,
} from "@/features/calculator/calculator-schema";
import { useFeeCatalog } from "@/shared/fee-catalog";
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
} from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// E1 calculator screen. The US refs below are spec 004's user stories — NOT 005's (005-US4 is the
// pending "Incluir marketplaces no preço" toggle, not delivered in this MVP). RHF (form state) + Zod
// (calculatorResolver) own the pt-BR inputs; the price + breakdown come from one synchronous
// computeFromForm pass over the canonical pricing-core engine (recompute on every change,
// deterministic, offline — FR-036/FR-039). 004-US1 = a correct retail + wholesale price (PriceHero);
// 004-US2 = the transparent per-line breakdown that visibly sums to custo_total + the markup
// derivation (BreakdownRow); 004-US4 = the optional labor + admin costs that fold into custo_total;
// 004-US5 = the marketplace fee gross-up (channel prices shown only once a fee is set — FR-033). No
// persistence / paywall (004-US6). The 005 multi-channel expansion (channels[] + honesty seals) layers
// on top; its US3–US6 (toggle, itemized Outros custos, offline cache) remain pending (tasks.md).

const t = messages.calculator;

const gridCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--space-3)",
};

const sectionLabel: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-sm)",
  fontWeight: "var(--fw-semibold)",
  color: "var(--text-strong)",
};

const captionText: CSSProperties = {
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
function SectionTitle({ title, info }: { title: string; info: { label: string; body: string } }) {
  return (
    <div className="flex items-center gap-1">
      <p style={sectionLabel}>{title}</p>
      <InfoTip label={info.label}>{info.body}</InfoTip>
    </div>
  );
}

/** One controlled numeric input wired to RHF + the DS Field/NumberField. */
function ControlledField({
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
function PriceResults({ result, values }: { result: PriceResult; values: CalcFormValues }) {
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
          <BreakdownRow
            label={t.results.admin}
            value={result.admin}
            emphasis={line(result.admin, true)}
          />
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

      {/* (5) The suggested prices — the user's final takeaway, so they close the screen.
          Both retail + wholesale are always shown together (SC-010). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
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
function FieldGroup({
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
}: {
  control: Control<CalcFormValues>;
  index: number;
  meta: (typeof CHANNEL_FEE_FIELDS)[number];
  error?: string;
}) {
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
  onRemove,
  onMarketplaceChange,
}: {
  control: Control<CalcFormValues>;
  index: number;
  slot: ChannelSlotForm;
  outcome?: ChannelSlotOutcome;
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
      <div style={gridCard}>
        {CHANNEL_FEE_FIELDS.map((meta) => (
          <ChannelFeeField
            key={meta.name}
            control={control}
            index={index}
            meta={meta}
            error={outcome?.errors[meta.name]}
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
                  <ChannelLevelRows
                    caption={t.captions.varejo}
                    anuncio={r.precoAnuncioVarejo ?? 0}
                    liquido={r.recebidoLiquidoVarejo ?? 0}
                    freight={r.freightCostVarejo}
                  />
                  <ChannelLevelRows
                    caption={t.captions.atacado}
                    anuncio={r.precoAnuncioAtacado ?? 0}
                    liquido={r.recebidoLiquidoAtacado ?? 0}
                    freight={r.freightCostAtacado}
                    marginTop
                  />
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
function MarketplaceSection({
  control,
  values,
  fields,
  channelOutcomes,
  onAppend,
  onRemove,
  onMarketplaceChange,
  refreshFailed,
  refreshing,
  onRetryCatalog,
}: {
  control: Control<CalcFormValues>;
  values: CalcFormValues;
  fields: { id: string }[];
  channelOutcomes: ChannelSlotOutcome[];
  onAppend: (slot: ChannelSlotForm) => void;
  onRemove: (index: number) => void;
  onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
  refreshFailed: boolean;
  refreshing: boolean;
  onRetryCatalog: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle title={t.sections.marketplace} info={t.sectionInfo.marketplace} />
      {/* US3: a failed online fee refresh is NON-BLOCKING — the saved/seed reference still pre-fills
          and every price computes; this only offers a retry (tone "info", role="status" — no alarm). */}
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
            onRemove={onRemove}
            onMarketplaceChange={onMarketplaceChange}
          />
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={() => onAppend(defaultChannelSlot())}>
        {t.channels.addChannel}
      </Button>
      <ChannelPrices values={values} channelOutcomes={channelOutcomes} />
    </div>
  );
}

export function CalcularPage() {
  const { control, watch, setValue } = useForm<CalcFormValues>({
    defaultValues: defaultCalcValues,
    resolver: calculatorResolver,
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "channels" });

  // The fee catalog (served → persisted store → bundled seed) pre-fills covered channels + drives the
  // honesty seal. It NEVER blocks: seed/store always answer offline, and every price stays local. A
  // failed online refresh is surfaced as a non-blocking retry (US3), never an error wall.
  const {
    catalog,
    source,
    isError: catalogRefreshFailed,
    isFetching: catalogRefreshing,
    refetch: retryCatalog,
  } = useFeeCatalog();

  const values = watch();
  const { result, channels: channelOutcomes } = computeFromForm(values, {
    catalog,
    source,
    now: Date.now(),
  });

  // Switching a slot's marketplace resets its modality to that market's default (or none), so a
  // stale ML "Clássico" never lingers on a Shopee slot.
  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const first = (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality;
    setValue(`channels.${index}.modality`, first);
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} className="tf-page-header--center" />

      {/* Top→bottom: (1) mandatory costs → (2) optional adjustments → (3) markup →
          (4) breakdown → (5) suggested prices. The user enters costs and sees how the
          number is built before the final retail/wholesale takeaway closes the screen. */}
      <FieldGroup
        control={control}
        title={t.sections.inputs}
        info={t.sectionInfo.inputs}
        fields={MANDATORY_FIELDS}
      />
      <FieldGroup
        control={control}
        title={t.sections.optional}
        info={t.sectionInfo.optional}
        hint={t.sections.optionalHint}
        fields={OPTIONAL_FIELDS}
      />
      <FieldGroup
        control={control}
        title={t.sections.labor}
        info={t.sectionInfo.labor}
        fields={LABOR_FIELDS}
      />
      <FieldGroup
        control={control}
        title={t.sections.markup}
        info={t.sectionInfo.markup}
        fields={MARKUP_FIELDS}
      />

      {result ? (
        <PriceResults result={result} values={values} />
      ) : (
        <Alert tone="danger">{t.invalidNote}</Alert>
      )}

      {/* (6) Marketplace — one slot per channel (add/remove); each channel's grossed-up anúncio +
          líquido for varejo e atacado are read together below in "Preços por canal" (US1). */}
      <MarketplaceSection
        control={control}
        values={values}
        fields={fields}
        channelOutcomes={channelOutcomes}
        onAppend={append}
        onRemove={remove}
        onMarketplaceChange={handleMarketplaceChange}
        refreshFailed={catalogRefreshFailed}
        refreshing={catalogRefreshing}
        onRetryCatalog={retryCatalog}
      />

      <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>
    </section>
  );
}
