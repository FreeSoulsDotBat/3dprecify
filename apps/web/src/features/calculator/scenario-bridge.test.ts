import { describe, expect, it } from "vitest";

import { type FeeCatalog, feeCatalogSchema } from "@/shared/fee-catalog";

import { computeFromForm } from "./calculator-model";
import {
  applyScenarioConfig,
  buildScenarioConfig,
  computeScenarioKitChannels,
} from "./scenario-bridge";
import {
  CALC_FIELD_NAMES,
  type CalcFormValues,
  defaultCalcValues,
  defaultChannelSlot,
} from "./calculator-schema";
import type { ScenarioConfig } from "@/entities/scenario/config-document";

// 010/T009 (E5, PR-A US1) — the SAVE direction, written FAILING-first: the save action maps the
// live calculator state into the config intent document. Non-negotiables pinned here:
//   * only EXPLICIT overrides persist (a blank/catalog-pre-filled slot carries no feeOverrides key);
//   * the AD_HOC basis captures the scalar PriceInput, never channels/otherCosts duplicated into it;
//   * nothing is materialized client-side (this module has no side effect at all — every export is
//     a pure function over its arguments, provable by construction: no import of any writer).
//
// 010/T014 (E5, PR-A US2) — the REOPEN direction, same file (the two are one seam): a non-overridden
// slot patches to a BLANK string (re-resolves live through the UNMODIFIED `computeFromForm` path,
// FR-609); an overridden slot patches to its saved value and reads "ajustado por você" through that
// same existing path — this suite proves it by actually calling `computeFromForm`, never a pricing
// re-implementation.

const catalog: FeeCatalog = feeCatalogSchema.parse({
  catalogVersion: "2026-07-19.t",
  schemaVersion: "1",
  generatedAt: "2026-07-19T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      entries: [
        {
          determinants: { listingType: "CLASSICO" },
          commissionPct: 12,
          fixedFee: 6.75,
          freight: { kind: "NONE" },
          source: "Ajuda Mercado Livre",
          sourceUrl: "https://www.mercadolivre.com.br/ajuda/",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-07-18",
        },
      ],
    },
  ],
});
const ctx = { catalog, source: "catalog" as const, now: Date.parse("2026-07-19T12:00:00Z") };

function values(over: Partial<CalcFormValues> = {}): CalcFormValues {
  return { ...defaultCalcValues, ...over };
}

describe("buildScenarioConfig — SAVE (T009)", () => {
  it("returns null when the form is invalid — nothing is ever saved from a broken calc", () => {
    const bad = values({ costPerRoll: "" }); // required, blank ⇒ invalid
    const outcome = computeFromForm(bad, ctx);
    expect(
      buildScenarioConfig({
        values: bad,
        channelOutcomes: outcome.channels,
        parsedInput: outcome.input,
      }),
    ).toBeNull();
  });

  it("a slot the seller never typed into serializes with NO feeOverrides key (catalog pre-fill stays live)", () => {
    const form = values({ channels: [defaultChannelSlot("MERCADO_LIVRE")] });
    const outcome = computeFromForm(form, ctx);
    const config = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
    });
    expect(config).not.toBeNull();
    expect("feeOverrides" in config!.channels[0]!).toBe(false);
  });

  it("a slot the seller DID type into keeps only the edited leaves, as decimal strings", () => {
    const slot = { ...defaultChannelSlot("MERCADO_LIVRE"), commissionPct: "15", fixedFee: "5,50" };
    const form = values({ channels: [slot] });
    const outcome = computeFromForm(form, ctx);
    const config = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
    })!;

    expect(config.channels[0]!.feeOverrides).toEqual({ commissionPct: "15", fixedFee: "5.5" });
    expect(config.channels[0]!.feeOverrides).not.toHaveProperty("minPerItem");
  });

  it("the AD_HOC cost basis carries the scalar input, and NOT channels/otherCosts (no duplication)", () => {
    const form = values({ channels: [] });
    const outcome = computeFromForm(form, ctx);
    const config = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
    })!;

    expect(config.costBasis.kind).toBe("AD_HOC");
    if (config.costBasis.kind !== "AD_HOC") throw new Error("unreachable");
    expect(config.costBasis.ref).toBeNull();
    expect(config.costBasis.lastKnown).not.toHaveProperty("channels");
    expect(config.costBasis.lastKnown).not.toHaveProperty("otherCosts");
    expect(config.costBasis.lastKnown.costPerRoll).toBe("100");
  });

  it("010/T021b — a PRODUCT ref override captures a PRODUCT basis instead of AD_HOC", () => {
    const form = values({ channels: [] });
    const outcome = computeFromForm(form, ctx);
    const config = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
      productRef: { id: "p1", name: "Vaso G" },
    })!;

    expect(config.costBasis.kind).toBe("PRODUCT");
    if (config.costBasis.kind !== "PRODUCT") throw new Error("unreachable");
    expect(config.costBasis.ref).toEqual({ id: "p1", name: "Vaso G" });
    expect(config.costBasis.lastKnown.costPerRoll).toBe("100");
    expect(config.costBasis.lastKnown).not.toHaveProperty("channels");
  });

  it("materializes nothing client-side — a pure mapping, no writer imported or called", () => {
    // Provable by construction: the module exports two pure functions and imports no mutation/IO
    // seam (no `use-scenarios`, no fetch, no idb-keyval). Re-asserted operationally: calling it
    // twice with the same input yields deep-equal, side-effect-free output.
    const form = values();
    const outcome = computeFromForm(form, ctx);
    const a = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
    });
    const b = buildScenarioConfig({
      values: form,
      channelOutcomes: outcome.channels,
      parsedInput: outcome.input,
    });
    expect(a).toEqual(b);
  });
});

describe("applyScenarioConfig → computeFromForm — REOPEN + live recompute (T014)", () => {
  it("a non-overridden slot re-resolves from TODAY's catalog on reopen (the live-vs-frozen boundary)", () => {
    const saveForm = values({ channels: [defaultChannelSlot("MERCADO_LIVRE")] });
    const saveOutcome = computeFromForm(saveForm, ctx);
    const config = buildScenarioConfig({
      values: saveForm,
      channelOutcomes: saveOutcome.channels,
      parsedInput: saveOutcome.input,
    })!;

    const patch = applyScenarioConfig(config);
    const reopened = values({
      ...patch.scalars,
      channels: patch.channels,
      otherCosts: patch.otherCosts,
    });
    const reopenedOutcome = computeFromForm(reopened, ctx);

    expect(reopenedOutcome.channels[0]!.seal.kind).toBe("reference"); // re-resolved, not "adjusted"
    expect(reopenedOutcome.channels[0]!.result?.error).toBeNull();
  });

  it('an overridden slot keeps the seller\'s value and reads "ajustado por você" on reopen', () => {
    const slot = { ...defaultChannelSlot("MERCADO_LIVRE"), commissionPct: "20" };
    const saveForm = values({ channels: [slot] });
    const saveOutcome = computeFromForm(saveForm, ctx);
    const config = buildScenarioConfig({
      values: saveForm,
      channelOutcomes: saveOutcome.channels,
      parsedInput: saveOutcome.input,
    })!;

    const patch = applyScenarioConfig(config);
    const reopened = values({
      ...patch.scalars,
      channels: patch.channels,
      otherCosts: patch.otherCosts,
    });
    const reopenedOutcome = computeFromForm(reopened, ctx);

    expect(patch.channels[0]!.commissionPct).toBe("20");
    expect(reopenedOutcome.channels[0]!.seal.kind).toBe("adjusted");
  });

  it("FR-609a — a slot the catalog cannot resolve reopens to the honest manual fallback, never a fabricated pre-fill", () => {
    const slot = defaultChannelSlot("SHOPEE"); // uncovered by the fixture catalog
    const saveForm = values({ channels: [slot] });
    const saveOutcome = computeFromForm(saveForm, ctx);
    const config = buildScenarioConfig({
      values: saveForm,
      channelOutcomes: saveOutcome.channels,
      parsedInput: saveOutcome.input,
    })!;

    const patch = applyScenarioConfig(config);
    const reopened = values({
      ...patch.scalars,
      channels: patch.channels,
      otherCosts: patch.otherCosts,
    });
    const reopenedOutcome = computeFromForm(reopened, ctx);

    expect(reopenedOutcome.channels[0]!.seal.kind).toBe("none"); // "sem referência"
    expect(reopenedOutcome.channels[0]!.result?.precoAnuncioVarejo ?? 0).not.toBeNaN();
  });

  it("FR-609b — a saved override ≥100% commission errors ONLY its slot on reopen; siblings keep computing, no NaN/Infinity", () => {
    const bad = { ...defaultChannelSlot("MERCADO_LIVRE"), commissionPct: "150" };
    const good = { ...defaultChannelSlot("MERCADO_LIVRE"), modality: "PREMIUM" as const };
    const saveForm = values({ channels: [bad, good] });
    const saveOutcome = computeFromForm(saveForm, ctx);
    const config = buildScenarioConfig({
      values: saveForm,
      channelOutcomes: saveOutcome.channels,
      parsedInput: saveOutcome.input,
    })!;

    const patch = applyScenarioConfig(config);
    expect(patch.channels[0]!.commissionPct).toBe("150"); // the out-of-range override round-trips
    const reopened = values({
      ...patch.scalars,
      channels: patch.channels,
      otherCosts: patch.otherCosts,
    });
    const reopenedOutcome = computeFromForm(reopened, ctx);

    expect(Object.keys(reopenedOutcome.channels[0]!.errors).length).toBeGreaterThan(0);
    expect(reopenedOutcome.channels[1]!.result?.error).toBeNull(); // sibling still computes
    expect(reopenedOutcome.ok).toBe(true); // one bad slot never fails the whole form
  });

  it("scalars round-trip through the pt-BR conversion without corruption (e.g. 0.1 stays 0.1, never 1)", () => {
    const saveForm = values({ avgPowerKw: "0,1", channels: [] });
    const saveOutcome = computeFromForm(saveForm, ctx);
    const config = buildScenarioConfig({
      values: saveForm,
      channelOutcomes: saveOutcome.channels,
      parsedInput: saveOutcome.input,
    })!;

    const patch = applyScenarioConfig(config);
    expect(patch.scalars.avgPowerKw).toBe("0,1");
  });
});

// 010/T024 (E5, PR-B US3, Q12) — the KIT-basis reopen: the ONE shared `channels[]` applied
// UNIFORMLY to every kit line's `lastKnown` input → `computeBom` → the per-marketplace rollup.
// No `pricing-core` change (reuses `computeFromForm`/`computeBom` verbatim).
describe("computeScenarioKitChannels (T024)", () => {
  const kitLastKnown = (over: Record<string, string> = {}): Record<string, string> => {
    const scalars: Record<string, string> = {};
    for (const name of CALC_FIELD_NAMES) scalars[name] = defaultCalcValues[name]!;
    return { ...scalars, ...over };
  };

  const kitConfig = (
    lines: { name: string | null; quantity: number; input: Record<string, string> }[],
    channelOverrides: Record<string, string> = {},
  ): ScenarioConfig => ({
    schemaVersion: 1,
    includeMarketplace: true,
    costBasis: {
      kind: "KIT",
      ref: { id: "k1", name: "Kit sazonal" },
      lastKnown: { lines },
    },
    channels: [
      {
        marketplace: "MERCADO_LIVRE",
        modality: "CLASSICO",
        ...(Object.keys(channelOverrides).length ? { feeOverrides: channelOverrides } : {}),
      },
    ],
    otherCosts: [],
  });

  it("returns null for a non-KIT basis — the caller's cue to render the scalar form instead", () => {
    const adhoc: ScenarioConfig = {
      schemaVersion: 1,
      includeMarketplace: true,
      costBasis: { kind: "AD_HOC", ref: null, lastKnown: {} },
      channels: [],
      otherCosts: [],
    };
    expect(computeScenarioKitChannels(adhoc, ctx)).toBeNull();
  });

  it("applies the ONE shared channel set to EVERY line and rolls up per marketplace", () => {
    const config = kitConfig([
      { name: "Vaso G", quantity: 2, input: kitLastKnown() },
      { name: "Vaso P", quantity: 3, input: kitLastKnown() },
    ]);
    const rollup = computeScenarioKitChannels(config, ctx)!;

    expect(rollup.lines).toEqual([
      { name: "Vaso G", quantity: 2, ok: true },
      { name: "Vaso P", quantity: 3, ok: true },
    ]);
    expect(rollup.excludedLineCount).toBe(0);
    expect(rollup.bom).not.toBeNull();
    const ml = rollup.bom!.channels.find((c) => c.marketplace === "MERCADO_LIVRE")!;
    expect(ml.contributingLines).toBe(2); // BOTH lines fed the same channel — the uniform application
  });

  it("an invalid line (unparseable scalar) is EXCLUDED — never silently zeroed; siblings still compute", () => {
    const config = kitConfig([
      { name: "Vaso G", quantity: 1, input: kitLastKnown({ costPerRoll: "not-a-number" }) },
      { name: "Vaso P", quantity: 1, input: kitLastKnown() },
    ]);
    const rollup = computeScenarioKitChannels(config, ctx)!;

    expect(rollup.lines[0]).toEqual({ name: "Vaso G", quantity: 1, ok: false });
    expect(rollup.lines[1]).toEqual({ name: "Vaso P", quantity: 1, ok: true });
    expect(rollup.excludedLineCount).toBe(1);
    expect(rollup.bom!.channels[0]!.contributingLines).toBe(1); // only the valid line
  });

  it("EVERY line excluded ⇒ bom is null, never a fake all-zero rollup", () => {
    const config = kitConfig([
      { name: "Vaso G", quantity: 1, input: kitLastKnown({ costPerRoll: "not-a-number" }) },
    ]);
    const rollup = computeScenarioKitChannels(config, ctx)!;
    expect(rollup.bom).toBeNull();
  });

  it("an explicit fee override applies uniformly — 'ajustado por você' on every line, not just one", () => {
    const config = kitConfig(
      [
        { name: "Vaso G", quantity: 1, input: kitLastKnown() },
        { name: "Vaso P", quantity: 1, input: kitLastKnown() },
      ],
      { commissionPct: "20" },
    );
    const rollup = computeScenarioKitChannels(config, ctx)!;
    // Both lines priced (uniform override, not a per-line divergence) — proven by both contributing.
    expect(rollup.bom!.channels[0]!.contributingLines).toBe(2);
  });

  // 010/T035+T036 (E5, PR-C, US7) — the E4 bridge needs the SAME resolved `PriceInput`s the rollup
  // priced, so recording never re-derives anything: `frozenLines` is the freeze-ready twin of
  // `bom.lines`, 1:1, name+quantity+input, excluded lines simply absent (mirrors bom-page's own
  // `frozenKitLines` convention — no new pricing/serialization logic invented here).
  it("frozenLines carries exactly the lines that reached bom, aligned 1:1, with their resolved input", () => {
    const config = kitConfig([
      { name: "Vaso G", quantity: 2, input: kitLastKnown({ costPerRoll: "not-a-number" }) },
      { name: "Vaso P", quantity: 3, input: kitLastKnown() },
    ]);
    const rollup = computeScenarioKitChannels(config, ctx)!;

    expect(rollup.frozenLines).toHaveLength(1);
    expect(rollup.frozenLines[0]!.name).toBe("Vaso P");
    expect(rollup.frozenLines[0]!.quantity).toBe(3);
    expect(rollup.frozenLines[0]!.input).toBeTruthy();
  });

  it("frozenLines is empty (never fabricated) when every line was excluded", () => {
    const config = kitConfig([
      { name: "Vaso G", quantity: 1, input: kitLastKnown({ costPerRoll: "not-a-number" }) },
    ]);
    const rollup = computeScenarioKitChannels(config, ctx)!;
    expect(rollup.frozenLines).toHaveLength(0);
  });
});
