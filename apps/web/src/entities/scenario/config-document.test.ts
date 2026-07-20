import type { BomResult, PriceInput } from "@3dprecify/pricing-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  SCENARIO_CONFIG_SCHEMA_VERSION,
  serializeChannelIntent,
  serializeScenarioConfig,
  type ScenarioChannelSlotState,
  type ScenarioConfig,
  type ScenarioLastKnownInput,
  serializeAdHocBasis,
  serializeKitBasis,
  serializeProductBasis,
} from "./config-document";

// 010/T003 (E5, PR-A foundational) — the config INTENT DOCUMENT, written FAILING-first
// (data-model.md §3, contracts/api-surface.md §Schemas).
//
// Two traps this suite exists to pin, the E4 lineage carried one level up:
//
//   1. THE FLOAT TRAP. Every money/rate/qty/percent leaf must survive a JSON round-trip as the SAME
//      decimal STRING — `JSON.parse` hands a JSON number back as a binary64 float, silently, app-side.
//      Only true integer COUNTS (`schemaVersion`, a kit line's `quantity`) may be JSON numbers.
//
//   2. THE RESOLVED-VALUE TRAP. A scenario stores INTENT, never a resolved price/fee. A fee slot the
//      seller never touched must serialize with NO `feeOverrides` key at all — its absence IS the
//      live-vs-frozen boundary (the catalog re-resolves it on reopen). An overridden slot keeps ONLY
//      the leaves the seller actually edited.
//
// Plus the E4 §9.6 lesson, one level up: the envelope types must be STRUCTURALLY INDEPENDENT of
// `PriceInput`/`BomResult` — a pricing-core bump must never change this document's shape.

function priceInput(over: Partial<PriceInput> = {}): PriceInput {
  return {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 150,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1.0,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
    ...over,
  };
}

function channelSlot(over: Partial<ScenarioChannelSlotState> = {}): ScenarioChannelSlotState {
  return {
    marketplace: "MERCADO_LIVRE",
    modality: "CLASSICO",
    commissionPct: { value: 0, overridden: false },
    fixedFee: { value: 0, overridden: false },
    minPerItem: { value: 0, overridden: false },
    freightCost: { value: 0, overridden: false },
    ...over,
  };
}

describe("the envelope is the flat shape of data-model.md §3", () => {
  it("has exactly the root keys: schemaVersion, includeMarketplace, costBasis, channels, otherCosts", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeAdHocBasis(priceInput()),
      channels: [],
      otherCosts: [],
    });

    expect(Object.keys(config).sort()).toEqual(
      ["channels", "costBasis", "includeMarketplace", "otherCosts", "schemaVersion"].sort(),
    );
  });

  it("stamps SCENARIO_CONFIG_SCHEMA_VERSION (an integer JSON number — the one legal envelope count)", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeAdHocBasis(priceInput()),
      channels: [],
      otherCosts: [],
    });

    expect(config.schemaVersion).toBe(SCENARIO_CONFIG_SCHEMA_VERSION);
    expect(Number.isInteger(config.schemaVersion)).toBe(true);
  });
});

describe("feeOverrides — the absence IS the live-vs-frozen boundary (FR-607, data-model §3.2)", () => {
  it("a non-overridden slot serializes with NO feeOverrides key at all", () => {
    const intent = serializeChannelIntent(channelSlot());

    expect(intent).toEqual({ marketplace: "MERCADO_LIVRE", modality: "CLASSICO" });
    expect("feeOverrides" in intent).toBe(false);
  });

  it("an overridden slot keeps ONLY the explicitly-edited leaves, as decimal strings", () => {
    const intent = serializeChannelIntent(
      channelSlot({
        commissionPct: { value: 12.5, overridden: true },
        fixedFee: { value: 6, overridden: true },
        // minPerItem / freightCost left untouched — must stay ABSENT from feeOverrides.
      }),
    );

    expect(intent.feeOverrides).toEqual({ commissionPct: "12.5", fixedFee: "6" });
    expect(intent.feeOverrides).not.toHaveProperty("minPerItem");
    expect(intent.feeOverrides).not.toHaveProperty("freightCost");
  });

  it("every feeOverrides leaf is a STRING, never a JSON number", () => {
    const intent = serializeChannelIntent(
      channelSlot({ freightCost: { value: 0, overridden: true } }),
    );

    expect(intent.feeOverrides?.freightCost).toBe("0");
    expect(typeof intent.feeOverrides?.freightCost).toBe("string");
  });
});

describe("money/rate/qty/percent leaves are decimal STRINGS end-to-end (no float ever appears)", () => {
  it("otherCosts values are decimal strings", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeAdHocBasis(priceInput()),
      channels: [],
      otherCosts: [{ name: "Embalagem", value: 2.5 }],
    });

    expect(config.otherCosts).toEqual([{ name: "Embalagem", value: "2.5" }]);
    expect(typeof config.otherCosts[0]?.value).toBe("string");
  });

  it("an AD_HOC costBasis.lastKnown stringifies every PriceInput leaf, recursively", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeAdHocBasis(priceInput({ avgPowerKw: 0.1 })),
      channels: [],
      otherCosts: [],
    });

    expect(config.costBasis.kind).toBe("AD_HOC");
    expect(config.costBasis.ref).toBeNull();
    const lastKnown = config.costBasis.lastKnown as ScenarioLastKnownInput;
    expect(lastKnown.costPerRoll).toBe("100");
    expect(lastKnown.avgPowerKw).toBe("0.1");
    expect(lastKnown.markupVarejoPct).toBe("50");
  });

  it("a PRODUCT costBasis carries the soft ref + a stringified lastKnown snapshot (D6 groundwork)", () => {
    const costBasis = serializeProductBasis({ id: "0192f0", name: "Vaso G" }, priceInput());

    expect(costBasis).toEqual(
      expect.objectContaining({ kind: "PRODUCT", ref: { id: "0192f0", name: "Vaso G" } }),
    );
    expect((costBasis.lastKnown as ScenarioLastKnownInput).rollWeightKg).toBe("1");
  });

  it("a KIT costBasis stringifies every line's input, but keeps quantity as an integer count", () => {
    const costBasis = serializeKitBasis({ id: "b1", name: "Combo" }, [
      { name: "Vaso G", quantity: 3, input: priceInput() },
    ]);

    expect(costBasis.kind).toBe("KIT");
    if (costBasis.kind !== "KIT") throw new Error("unreachable");
    const line = costBasis.lastKnown.lines[0];
    expect(line?.name).toBe("Vaso G");
    expect(line?.quantity).toBe(3);
    expect(Number.isInteger(line?.quantity)).toBe(true);
    expect(line?.input.costPerRoll).toBe("100");
  });

  it("no leaf anywhere in a serialized document is a non-integer JSON number (the round-trip proof)", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeKitBasis({ id: "b1", name: "Combo" }, [
        { name: "Vaso G", quantity: 2, input: priceInput({ avgPowerKw: 0.125 }) },
      ]),
      channels: [
        channelSlot({
          commissionPct: { value: 14.5, overridden: true },
        }),
      ],
      otherCosts: [{ name: "Embalagem", value: 3.5 }],
    });

    const roundTripped = JSON.parse(JSON.stringify(config)) as unknown;
    const numericLeaves: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (typeof node === "number") {
        if (!Number.isInteger(node)) numericLeaves.push(path);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
      }
    };
    walk(roundTripped, "$");

    expect(numericLeaves).toEqual([]);
  });
});

describe("round-trip: serialize → JSON.parse → deserialize preserves exact decimal strings", () => {
  it("a round-tripped config is byte-identical to the original (no float ever intrudes)", () => {
    const config = serializeScenarioConfig({
      includeMarketplace: true,
      costBasis: serializeProductBasis(
        { id: "0192f0", name: "Vaso G" },
        // The classic IEEE-754 tail: 0.1 + 0.2 !== 0.3 in binary64. It must never leak into a stored leaf.
        priceInput({ avgPowerKw: 0.1 + 0.2 }),
      ),
      channels: [
        channelSlot({ fixedFee: { value: 6, overridden: true } }),
        channelSlot({ marketplace: "SHOPEE", modality: "" }),
      ],
      otherCosts: [{ name: "Embalagem", value: 2.5 }],
    });

    const roundTripped = JSON.parse(JSON.stringify(config)) as ScenarioConfig;

    expect(roundTripped).toEqual(config);
    // A string round-trips byte-identically through JSON; a JSON number would not survive as one.
    const basis = roundTripped.costBasis.lastKnown as ScenarioLastKnownInput;
    expect(typeof basis.avgPowerKw).toBe("string");
    expect(basis.avgPowerKw).toBe(
      (config.costBasis.lastKnown as ScenarioLastKnownInput).avgPowerKw,
    );
  });
});

describe("the envelope types are structurally independent of PriceInput/BomResult (E4 §9.6 lesson)", () => {
  it("ScenarioConfig does not structurally match, and is not matched by, PriceInput or BomResult", () => {
    // A pricing-core field bump must never change this document's shape (VR-603 / data-model N1). The
    // envelope is hand-declared, not `extends`/`Pick`/mapped from the live engine types — if it were,
    // a future `PriceInput` field would silently widen or narrow `ScenarioConfig` too.
    expectTypeOf<ScenarioConfig>().not.toMatchTypeOf<PriceInput>();
    expectTypeOf<ScenarioConfig>().not.toMatchTypeOf<BomResult>();
    expectTypeOf<PriceInput>().not.toMatchTypeOf<ScenarioConfig>();
    expectTypeOf<BomResult>().not.toMatchTypeOf<ScenarioConfig>();
  });

  it("ScenarioLastKnownInput is a generic string-leaf record, not PriceInput itself", () => {
    expectTypeOf<ScenarioLastKnownInput>().not.toEqualTypeOf<PriceInput>();
  });
});
