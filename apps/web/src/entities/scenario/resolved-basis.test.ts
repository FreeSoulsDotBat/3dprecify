import { describe, expect, it } from "vitest";

import { canOpenOrigin, readResolvedCostBasis } from "./resolved-basis";

// 010/T023 (E5, PR-B US3) — written FAILING-first (the module did not exist).

describe("readResolvedCostBasis", () => {
  it("AD_HOC never degrades — there is nothing to resolve (data-model §1)", () => {
    const meta = readResolvedCostBasis({
      costBasis: { kind: "AD_HOC", ref: null, degraded: false, lastKnown: {} },
    });
    expect(meta).toEqual({ kind: "AD_HOC", ref: null, degraded: false });
  });

  it("PRODUCT that resolves live (D3) carries degraded=false + the ref", () => {
    const meta = readResolvedCostBasis({
      costBasis: {
        kind: "PRODUCT",
        ref: { id: "p1", name: "Vaso G" },
        degraded: false,
        lastKnown: {},
      },
    });
    expect(meta).toEqual({ kind: "PRODUCT", ref: { id: "p1", name: "Vaso G" }, degraded: false });
  });

  it("KIT that no longer resolves (D6) carries degraded=true, the captured ref name still shown", () => {
    const meta = readResolvedCostBasis({
      costBasis: {
        kind: "KIT",
        ref: { id: "k1", name: "Kit sazonal" },
        degraded: true,
        lastKnown: { lines: [] },
      },
    });
    expect(meta).toEqual({ kind: "KIT", ref: { id: "k1", name: "Kit sazonal" }, degraded: true });
  });

  it("an unrecognizable shape returns null — never fabricates a kind", () => {
    expect(readResolvedCostBasis({})).toBeNull();
    expect(readResolvedCostBasis(null)).toBeNull();
    expect(readResolvedCostBasis({ costBasis: { kind: "BOGUS" } })).toBeNull();
  });
});

describe("canOpenOrigin — F1: 'Abrir origem' offered ONLY when the ref actually resolves", () => {
  it("true for a live, resolving PRODUCT/KIT ref", () => {
    expect(canOpenOrigin({ kind: "PRODUCT", ref: { id: "p1", name: "x" }, degraded: false })).toBe(
      true,
    );
    expect(canOpenOrigin({ kind: "KIT", ref: { id: "k1", name: "x" }, degraded: false })).toBe(
      true,
    );
  });

  it("false when degraded (D6) — never a broken link", () => {
    expect(canOpenOrigin({ kind: "PRODUCT", ref: { id: "p1", name: "x" }, degraded: true })).toBe(
      false,
    );
  });

  it("false for AD_HOC (nothing to open) and for null meta", () => {
    expect(canOpenOrigin({ kind: "AD_HOC", ref: null, degraded: false })).toBe(false);
    expect(canOpenOrigin(null)).toBe(false);
  });
});
