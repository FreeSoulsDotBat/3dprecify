import { type ChangeEvent, useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card, Field, NumberField, PriceHero } from "@/shared/ui";

import { type CalculatorInput, computeCalculator } from "./calculator-model";

// US2 walking-skeleton calculator: material + markup → suggested price, live as
// the user types. The math is the pure calculator-model (over pricing-core); this
// is the thin view that wires the inputs to the Truth's Forge primitives. The full
// corrected model (energy/machine/failure/marketplace/atacado) is the E1 blueprint.
const initial: CalculatorInput = {
  costPerRoll: "110,00",
  rollWeightKg: "1",
  grams: "85",
  markupPct: "50",
};

export function CalculatorScreen() {
  const t = messages.calculator;
  const [form, setForm] = useState<CalculatorInput>(initial);
  const update = (key: keyof CalculatorInput) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const result = computeCalculator(form);
  const markupCaption = `markup ${form.markupPct || "0"}%`;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="tf-title" style={{ fontSize: "var(--fs-lg)" }}>
        {t.title}
      </h1>

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
