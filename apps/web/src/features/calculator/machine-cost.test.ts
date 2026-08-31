import { describe, expect, it } from "vitest";

import {
    costPerHour,
    deriveMachineLifetimeHours,
    detectRitmoMode,
    RITMOS_HORAS_ANO,
} from "./machine-cost";

// 016/US8 (T021, FR-910, SC-906) — the RITMOS × payback derivation, red first: this module does
// not exist yet at the time this test is written.

describe("machine-cost — RITMOS × payback derivation (US8, arquitetura-016.md §7)", () => {
    it("RITMOS = [260, 1200, 3300] h/ano (aprovados pelo dono)", () => {
        expect(RITMOS_HORAS_ANO).toEqual([260, 1200, 3300]);
    });

    it("payback 3 anos deriva 780 / 3.600 / 9.900 h (SC-906)", () => {
        expect(deriveMachineLifetimeHours(0, 3)).toBe(780);
        expect(deriveMachineLifetimeHours(1, 3)).toBe(3600);
        expect(deriveMachineLifetimeHours(2, 3)).toBe(9900);
    });

    it("R$ 4.000 com payback 3 anos deriva ≈5,13 / ≈1,11 / ≈0,40 por hora (SC-906)", () => {
        expect(costPerHour(4000, 780)).toBeCloseTo(5.13, 2);
        expect(costPerHour(4000, 3600)).toBeCloseTo(1.11, 2);
        expect(costPerHour(4000, 9900)).toBeCloseTo(0.4, 2);
    });

    it("um machineLifetimeHours salvo que bate ritmo × payback inteiro é detectado", () => {
        expect(detectRitmoMode(780)).toEqual({ ritmoIndex: 0, paybackYears: 3 });
        expect(detectRitmoMode(3600)).toEqual({ ritmoIndex: 1, paybackYears: 3 });
        expect(detectRitmoMode(9900)).toEqual({ ritmoIndex: 2, paybackYears: 3 });
        // outro payback do mesmo ritmo também é reconhecido.
        expect(detectRitmoMode(1200)).toEqual({ ritmoIndex: 1, paybackYears: 1 });
    });

    it("2.000h salvas (o default do seed) não batem ritmo×payback inteiro nenhum ⇒ modo ajustar", () => {
        expect(detectRitmoMode(2000)).toBeNull();
    });

    it("zero/negativo/não-finito ⇒ ajustar (null)", () => {
        expect(detectRitmoMode(0)).toBeNull();
        expect(detectRitmoMode(-100)).toBeNull();
        expect(detectRitmoMode(Number.NaN)).toBeNull();
    });

    it("costPerHour nunca devolve NaN/Infinity para uma vida útil inválida", () => {
        expect(costPerHour(4000, 0)).toBe(0);
        expect(costPerHour(4000, Number.NaN)).toBe(0);
        expect(costPerHour(Number.NaN, 780)).toBe(0);
    });
});
