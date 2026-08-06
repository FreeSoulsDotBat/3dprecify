// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { feeFieldsToBlankOnMarketplaceChange } from "@/features/calculator/channel-field-plan";
import type { FeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { MarketplaceSection } from "./calculator-form";
import {
  type CalcFormValues,
  type ChannelSlotForm,
  defaultCalcValues,
  defaultChannelSlot,
  type ChannelFieldName,
  type MarketplaceId,
  slotResetOnMarketplaceChange,
} from "./calculator-schema";

afterEach(() => cleanup());

const t = messages.calculator;

// 016/US11 (T044 homologação PR-E, bloqueador RA5) — the hidden-field-still-charges defect, at the
// component boundary this time (channel-field-plan.test.ts already pins the pure helper). Fixture:
// ML publishes `freightCost` in its `feeAxes`, Amazon does not (mirrors the real seed's curation).
const catalog: FeeCatalog = {
  catalogVersion: "test",
  schemaVersion: "1",
  generatedAt: "2026-08-06T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"] },
      categorySpine: null,
      feeAxes: ["commissionPct", "fixedFee", "freightCost"],
      entries: [],
    },
    {
      marketplace: "AMAZON",
      determinantsSchema: { plan: ["INDIVIDUAL", "PROFISSIONAL"] },
      categorySpine: null,
      feeAxes: ["commissionPct", "fixedFee", "minPerItem"],
      entries: [],
    },
    { marketplace: "SHOPEE", determinantsSchema: null, categorySpine: null, entries: [] },
  ],
};

function Harness({ initialChannels }: { initialChannels: ChannelSlotForm[] }) {
  const { control, watch, setValue } = useForm<CalcFormValues>({
    defaultValues: { ...defaultCalcValues, channels: initialChannels },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "channels" });
  const values = watch();

  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const next = slotResetOnMarketplaceChange(marketplace);
    setValue(`channels.${index}.modality`, next.modality);
    setValue(`channels.${index}.category`, next.category);
    // The SAME fix the real pages apply (calcular-page.tsx/produto-page.tsx/bom-line-editor.tsx).
    for (const [field, value] of Object.entries(
      feeFieldsToBlankOnMarketplaceChange(catalog, marketplace),
    )) {
      setValue(`channels.${index}.${field as ChannelFieldName}` as const, value);
    }
  };

  return (
    <MarketplaceSection
      control={control}
      values={values}
      fields={fields}
      channelOutcomes={[]}
      included
      onToggleInclude={() => {}}
      onAppend={(slot) => append(slot)}
      onRemove={remove}
      onMarketplaceChange={handleMarketplaceChange}
      refreshFailed={false}
      refreshing={false}
      onRetryCatalog={() => {}}
      spineFor={() => []}
      catalog={catalog}
      entitled
      signedOut={false}
    />
  );
}

describe("bloqueador PR-E — a hidden fee field must never keep charging (RA5)", () => {
  it("switching marketplace BLANKS a fee field the new plan does not show — no field, no value", async () => {
    render(
      <Harness
        initialChannels={[
          { ...defaultChannelSlot("MERCADO_LIVRE"), modality: "CLASSICO", freightCost: "50" },
        ]}
      />,
    );
    const slot0 = screen.getByTestId("channel-slot");

    // Frete visible + carries the typed 50 on ML (freightCost IS in ML's feeAxes).
    expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("50");

    // Switch to Amazon (freightCost NOT in its feeAxes) — the field must disappear...
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(screen.getByLabelText(t.channels.marketplace), {
      target: { value: "AMAZON" },
    });
    expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toBeNull();

    // ...and switching BACK to ML must show it EMPTY, never the stale 50 (the value was blanked,
    // not merely hidden — a hidden-but-alive R$50 is exactly the defect this closes).
    fireEvent.change(screen.getByLabelText(t.channels.marketplace), {
      target: { value: "MERCADO_LIVRE" },
    });
    expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("");
  });

  it("a field the new plan hides is NOT charged: switching marketplace clears the RHF value itself", () => {
    // Regression-shaped assertion for the exact homologação repro: ML+Frete=50 → Amazon must not
    // merely hide the input, the underlying form value backing the price computation is gone too
    // (computeFromForm reads `values.channels[i].freightCost` — an empty string parses to 0).
    const slot: ChannelSlotForm = {
      ...defaultChannelSlot("MERCADO_LIVRE"),
      modality: "CLASSICO",
      freightCost: "50",
    };
    const blanked = feeFieldsToBlankOnMarketplaceChange(catalog, "AMAZON");
    expect(blanked.freightCost).toBe("");
    // Sanity: applying the blank patch onto the ML slot removes exactly the leaking field.
    expect({ ...slot, ...blanked }).toMatchObject({ freightCost: "" });
  });

  it("a field OUTSIDE the plan but carrying a value (a reopened scenario) RENDERS — never invisible money", () => {
    // Simulates a scenario saved BEFORE the plan narrowed (or one built against a different
    // catalog): the channel array is set directly (as a scenario reopen does via `replaceChannels`,
    // never through `onMarketplaceChange`), so nothing would have blanked it.
    render(
      <Harness
        initialChannels={[
          { ...defaultChannelSlot("AMAZON"), modality: "PROFISSIONAL", freightCost: "50" },
        ]}
      />,
    );
    const slot0 = screen.getByTestId("channel-slot");
    // Amazon's plan does NOT include freightCost — yet the field is visible because it carries a
    // value (the "OR has value" render clause), editable/erasable, never a silent number.
    expect(slot0.querySelector(`input[name="channels.0.freightCost"]`)).toHaveValue("50");
  });
});
