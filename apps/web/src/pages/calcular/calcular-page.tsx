import { type ChangeEvent, useState } from "react";

import { type CalculatorInput, computeCalculator } from "@/features/calculator/calculator-model";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card, Field, NumberField, PriceHero } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// Calculator screen (T031) — moved out of features/calculator into pages/calcular
// and re-skinned with the DS primitives + the focusable PageHeader. The math is
// unchanged: the pure calculator-model over canonical pricing-core (never recomputed
// here). The full corrected model (energy/machine/failure/marketplace) is the E1 work.
//
// R2-6 (audit-findings-r2): the seed inputs are the canonical documented example
// (R$100 / 1kg / 20g / 50%) so the default render shows material R$ 2,00 / suggested
// R$ 3,00 (spec.md:45-46) — previously seeded 110/1/85/50, which hurt eyeball
// homologation.
const initial: CalculatorInput = {
  costPerRoll: "100,00",
  rollWeightKg: "1",
  grams: "20",
  markupPct: "50",
};

export function CalcularPage() {
  const t = messages.calculator;
  const [form, setForm] = useState<CalculatorInput>(initial);
  const update = (key: keyof CalculatorInput) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const result = computeCalculator(form);
  const markupCaption = `${t.markupCaptionPrefix} ${form.markupPct || "0"}%`;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />

      <PriceHero
        label={t.results.suggested}
        value={result.suggestedPrice}
        caption={markupCaption}
        tone="accent"
        size="md"
      />

      <Card
        padding="md"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
      >
        <Field label={t.fields.costPerRoll} required>
          {(p) => (
            <NumberField
              {...p}
              currency
              value={form.costPerRoll}
              onChange={update("costPerRoll")}
            />
          )}
        </Field>
        <Field
          label={t.fields.rollWeight}
          required
          error={result.rollWeightError ? t.rollWeightError : undefined}
        >
          {(p) => (
            <NumberField
              {...p}
              unit="kg"
              value={form.rollWeightKg}
              onChange={update("rollWeightKg")}
              error={result.rollWeightError}
            />
          )}
        </Field>
        <Field label={t.fields.grams} required>
          {(p) => <NumberField {...p} unit="g" value={form.grams} onChange={update("grams")} />}
        </Field>
        <Field label={t.fields.markup} hint={t.markupHint}>
          {(p) => (
            <NumberField {...p} unit="%" value={form.markupPct} onChange={update("markupPct")} />
          )}
        </Field>
      </Card>

      <Card padding="md">
        <BreakdownRow
          label={t.results.material}
          sublabel={`${form.grams || "0"} g`}
          value={result.materialCost}
          color="var(--accent)"
        />
        <BreakdownRow label={t.results.suggested} value={result.suggestedPrice} emphasis="total" />
      </Card>

      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "var(--fs-caption)",
          color: "var(--text-muted)",
        }}
      >
        {t.freemiumNote}
      </p>
    </section>
  );
}
