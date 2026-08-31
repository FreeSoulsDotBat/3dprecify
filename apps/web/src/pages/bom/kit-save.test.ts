import { describe, expect, it } from "vitest";

import { defaultCalcValues } from "@/features/calculator/calculator-schema";

import { defaultPieceName, type KitSaveLine, linesToBomIn } from "./kit-save";

// 008/T015 — the composer→wire adapter, written FAILING-first. It is the ONLY place a composed
// line becomes a `BomLineIn`, and it encodes the two rules that keep a save honest:
//   1. a line that is still BOUND and untouched saves as a live reference (`productId` only);
//   2. an ad-hoc line — and a bound line the seller EDITED after binding (ADR-0017's
//      "adjusted bound line": unbind → ad-hoc → materialize) — saves as a named value-set.

function line(over: Partial<KitSaveLine> = {}): KitSaveLine {
    return {
        values: { ...structuredClone(defaultCalcValues), printGrams: "100", printTimeHours: "5" },
        quantityRaw: "2",
        productId: "",
        productName: null,
        filamentMaterial: null,
        adjusted: false,
        pieceName: "Suporte",
        ...over,
    };
}

describe("defaultPieceName — the K4 pre-fill", () => {
    it("names an ad-hoc piece after its position and the kit", () => {
        expect(defaultPieceName(0, "Kit Suporte")).toBe("Peça 1 · Kit Suporte");
        expect(defaultPieceName(2, "Kit Suporte")).toBe("Peça 3 · Kit Suporte");
    });

    it("falls back to a bare piece name while the kit is still unnamed", () => {
        expect(defaultPieceName(0, "  ")).toBe("Peça 1");
    });
});

describe("linesToBomIn — reference vs materialization", () => {
    it("a bound, untouched line saves as a LIVE REFERENCE (id only, no values)", () => {
        const body = linesToBomIn("Kit Suporte", [
            line({ productId: "p1", productName: "Base", adjusted: false }),
        ]);

        expect(body.name).toBe("Kit Suporte");
        expect(body.lines).toHaveLength(1);
        const [l] = body.lines;
        expect(l.productId).toBe("p1");
        expect(l.quantity).toBe(2);
        // The server re-snapshots from the live product — sending values would fight the D3 rule
        // (and the wire's XOR validator would 422 the whole save).
        expect(l.pieceName).toBeUndefined();
        expect(l.pieceInputs).toBeUndefined();
        expect(l.filamentValues).toBeUndefined();
    });

    it("an ad-hoc line saves as a NAMED value-set (it has to materialize)", () => {
        const body = linesToBomIn("Kit Suporte", [line({ pieceName: "Suporte L" })]);
        const [l] = body.lines;

        expect(l.productId).toBeUndefined();
        expect(l.pieceName).toBe("Suporte L");
        expect(l.pieceInputs?.printGrams).toBe("100");
        expect(l.filamentValues).toBeDefined();
        expect(l.printerValues).toBeDefined();
        expect(l.tariffPerKwh).toBeDefined();
    });

    it("an ADJUSTED bound line unbinds and materializes — the edit is never thrown away", () => {
        // ADR-0017's edit-after-bind convention. Saving it as a reference would let the live
        // product's values SUPERSEDE the seller's adjustment: silent data loss, the exact thing
        // the materialization rule exists to prevent.
        const body = linesToBomIn("Kit Suporte", [
            line({
                productId: "p1",
                productName: "Base",
                adjusted: true,
                pieceName: "Base ajustada",
                values: {
                    ...structuredClone(defaultCalcValues),
                    printGrams: "250",
                    printTimeHours: "9",
                },
            }),
        ]);
        const [l] = body.lines;

        expect(l.productId).toBeUndefined();
        expect(l.pieceName).toBe("Base ajustada");
        expect(l.pieceInputs?.printGrams).toBe("250");
    });

    it("carries quantity per line, including the honest zero", () => {
        const body = linesToBomIn("Kit", [
            line({ quantityRaw: "0" }),
            line({ quantityRaw: "7", pieceName: "Outra" }),
        ]);
        expect(body.lines.map((l) => l.quantity)).toEqual([0, 7]);
    });

    it("trims the kit name and keeps the submitted line order", () => {
        const body = linesToBomIn("  Kit Suporte  ", [
            line({ pieceName: "A" }),
            line({ pieceName: "B" }),
        ]);
        expect(body.name).toBe("Kit Suporte");
        expect(body.lines.map((l) => l.pieceName)).toEqual(["A", "B"]);
    });
});
