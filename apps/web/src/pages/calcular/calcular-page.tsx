import { type CSSProperties } from "react";
import { type Control, Controller, useForm } from "react-hook-form";

import { computeFromForm } from "@/features/calculator/calculator-model";
import {
  type CalcFieldMeta,
  type CalcFormValues,
  calculatorResolver,
  defaultCalcValues,
  MANDATORY_FIELDS,
  MARKUP_FIELDS,
  OPTIONAL_FIELDS,
} from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import type { PriceResult } from "@3dprecify/pricing-core";
import { Alert, BreakdownRow, Card, Field, InfoTip, NumberField, PriceHero } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// E1 calculator screen (US1 + US2). RHF (form state) + Zod (calculatorResolver) own the pt-BR
// inputs; the price + breakdown come from one synchronous computeFromForm pass over the
// canonical pricing-core engine (recompute on every change, deterministic, offline — FR-036/
// FR-039). US1 = a correct retail + wholesale price (PriceHero); US2 = the transparent per-line
// breakdown that visibly sums to custo_total + the markup derivation (BreakdownRow). labor/admin
// (US4) and marketplace (US5) are intentionally NOT surfaced yet. No persistence / paywall (US6).

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

export function CalcularPage() {
  const { control, watch } = useForm<CalcFormValues>({
    defaultValues: defaultCalcValues,
    resolver: calculatorResolver,
    mode: "onChange",
  });

  const values = watch();
  const { result } = computeFromForm(values);

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
        title={t.sections.markup}
        info={t.sectionInfo.markup}
        fields={MARKUP_FIELDS}
      />

      {result ? (
        <PriceResults result={result} values={values} />
      ) : (
        <Alert tone="danger">{t.invalidNote}</Alert>
      )}

      <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>
    </section>
  );
}
