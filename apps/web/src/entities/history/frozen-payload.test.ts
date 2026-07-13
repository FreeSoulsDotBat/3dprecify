import type { BomResult, PriceInput, PriceResult } from "@3dprecify/pricing-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  FROZEN_PAYLOAD_SCHEMA_VERSION,
  freezeBomResult,
  freezePriceResult,
  type FrozenBreakdown,
  type MoneyString,
  readFrozenMoney,
  toMoneyString,
} from "./frozen-payload";

// 009/T002 (E4, PR-A) — the frozen document, written FAILING-first.
//
// Two traps this suite exists to pin, both of which produce a LIE rather than a crash:
//
//   1. THE FLOAT TRAP. Postgres stores a JSON number as `numeric` without precision loss — but
//      `json.loads` (Python) and `JSON.parse` (JS) hand it back as a FLOAT. The loss happens in the
//      serializer, app-side, silently. So every money/quantity/percentage leaf in the payload is a
//      decimal STRING; the only JSON numbers are integer counts (FR-525, data-model D1).
//
//   2. THE FABRICATED ZERO. A snapshot renders ONLY the lines it recorded (FR-507). If a future
//      formula adds a breakdown line, an older snapshot must render WITHOUT it — never as "0,00".
//      The subtle way to get this wrong is through the TYPE SYSTEM: type the frozen payload with the
//      LIVE `PriceResult` and a future field makes TypeScript *assert* that a 2026 snapshot has it,
//      so the renderer reaches for `payload.newLine ?? 0` and prints a zero that was never recorded.
//      Hence: the frozen types are structurally independent of `PriceResult`, and every breakdown
//      line is OPTIONAL — absent is a first-class value, distinct from zero.

function priceResult(over: Partial<PriceResult> = {}): PriceResult {
  return {
    material: 18.75,
    energy: 1.2,
    machine: 5.0,
    falha: 0.5,
    finishing: 0,
    labor: 0,
    admin: 0,
    otherCosts: [],
    custoTotal: 25.45,
    precoVarejo: 38.18,
    precoAtacado: 33.09,
    channels: [],
    catalogVersion: null,
    modelVersion: "3.1.0",
    ...over,
  };
}

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

describe("toMoneyString — the float dies here (FR-525)", () => {
  it("emits an exact 2dp decimal string, never a float", () => {
    expect(toMoneyString(187.35)).toBe("187.35");
    expect(toMoneyString(0)).toBe("0.00");
    expect(toMoneyString(1)).toBe("1.00");
  });

  it("does not leak binary-float noise into the string", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754. Whatever we store must not carry that tail.
    expect(toMoneyString(0.1 + 0.2)).toBe("0.30");
  });
});

describe("the frozen payload carries NO JSON numbers for money (the serializer trap)", () => {
  it("every money leaf survives a JSON round-trip as the SAME string", () => {
    const payload = freezePriceResult(priceInput(), priceResult(), null);
    const roundTripped = JSON.parse(JSON.stringify(payload)) as typeof payload;

    expect(roundTripped.totals.custoTotal).toBe("25.45");
    expect(roundTripped.totals.precoVarejo).toBe("38.18");
    // The point: a string round-trips byte-identically. A number would come back as a float.
    expect(typeof roundTripped.totals.custoTotal).toBe("string");
    expect(roundTripped).toEqual(payload);
  });

  it("no money field anywhere in the document is a JSON number", () => {
    const payload = freezePriceResult(
      priceInput(),
      priceResult({
        otherCosts: [{ name: "Embalagem", value: 3.5 }],
        channels: [
          {
            marketplace: "Mercado Livre",
            feeDeterminants: null,
            feeSource: null,
            precoAnuncioVarejo: 61.9,
            recebidoLiquidoVarejo: 38.18,
            precoAnuncioAtacado: 52.4,
            recebidoLiquidoAtacado: 33.09,
            freightCostVarejo: 0,
            freightCostAtacado: 0,
            error: null,
          },
        ],
      }),
      null,
    );

    const numericLeaves: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (typeof node === "number") {
        // Integer counts are the ONLY legal JSON numbers (quantity, contributingLines, …).
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
    walk(JSON.parse(JSON.stringify(payload)), "$");

    expect(numericLeaves).toEqual([]);
  });
});

describe("no fabricated zero — absent is not zero (FR-507)", () => {
  it("readFrozenMoney returns null for an absent line, and never '0.00'", () => {
    expect(readFrozenMoney(undefined)).toBeNull();
    // A line that WAS recorded as zero is a real, recorded zero — it must still read as zero.
    expect(readFrozenMoney("0.00")).toBe("0.00");
  });

  it("a payload recorded by an older formula renders only the lines it recorded", () => {
    // Simulate a 2026 snapshot: the document simply has no key for a line invented later.
    const older = { material: "18.75", energy: "1.20" } as FrozenBreakdown;

    expect(readFrozenMoney(older.material)).toBe("18.75");
    // `finishing` was never recorded here. It must be ABSENT — not a zero the renderer invented.
    expect(readFrozenMoney(older.finishing)).toBeNull();
  });

  it("every breakdown line is OPTIONAL at the type level — the type system cannot assert a line exists", () => {
    // This is the guard against the fabricated zero being produced by TypeScript itself: if these
    // fields were required (as they are on the live `PriceResult`), a future pricing-core field would
    // make the compiler promise that a 2026 snapshot carries it.
    expectTypeOf<FrozenBreakdown["material"]>().toEqualTypeOf<MoneyString | undefined>();
    expectTypeOf<FrozenBreakdown["finishing"]>().toEqualTypeOf<MoneyString | undefined>();
  });
});

describe("the document is self-sufficient — the export PRINTS, it never CALCULATES (ADR-0020 §1)", () => {
  it("a kit payload carries each line's quantity-scaled money and the channel rollup", () => {
    const bom: BomResult = {
      lines: [
        {
          line: priceResult(),
          quantity: 3,
          custoTotal: 76.35,
          precoVarejo: 114.54,
          precoAtacado: 99.27,
        },
      ],
      custoTotal: 76.35,
      precoVarejo: 114.54,
      precoAtacado: 99.27,
      channels: [
        {
          marketplace: "Shopee",
          precoAnuncioVarejo: 185.7,
          recebidoLiquidoVarejo: 114.54,
          precoAnuncioAtacado: 157.2,
          recebidoLiquidoAtacado: 99.27,
          freightCostVarejo: 0,
          freightCostAtacado: 0,
          contributingLines: 1,
          skippedLines: 0,
        },
      ],
      modelVersion: "3.1.0",
    };

    const payload = freezeBomResult(
      [{ input: priceInput(), quantity: 3, name: "Vaso G" }],
      bom,
      null,
    );

    expect(payload.kind).toBe("KIT");
    // The piece's NAME and QUANTITY must be in the document — a kit quote itemizes its pieces
    // (SC-515), and the server renderer may not go looking them up.
    expect(payload.lines?.[0]?.name).toBe("Vaso G");
    expect(payload.lines?.[0]?.quantity).toBe(3);
    // The quantity-scaled money must be STORED, not derived at print time.
    expect(payload.lines?.[0]?.totals.precoVarejo).toBe("114.54");
    expect(payload.channels?.[0]?.precoAnuncioVarejo).toBe("185.70");
    // Counts are the only legal JSON numbers.
    expect(payload.channels?.[0]?.contributingLines).toBe(1);
  });

  it("stamps the schema version and the formula version it was recorded under", () => {
    const payload = freezePriceResult(priceInput(), priceResult(), null);
    expect(payload.schemaVersion).toBe(FROZEN_PAYLOAD_SCHEMA_VERSION);
    expect(payload.modelVersion).toBe("3.1.0");
  });
});

describe("provenance is captured, never referenced (ADR-0019 §5)", () => {
  it("captures the origin's id AND its name, so a dangling id still renders honestly", () => {
    const payload = freezePriceResult(priceInput(), priceResult(), {
      kind: "PRODUCT",
      id: "p1",
      name: "Vaso G",
    });

    expect(payload.provenance).toEqual({ kind: "PRODUCT", id: "p1", name: "Vaso G" });
  });

  it("a snapshot with no origin (an ad-hoc calculation) has null provenance, never a fake one", () => {
    expect(freezePriceResult(priceInput(), priceResult(), null).provenance).toBeNull();
  });
});
