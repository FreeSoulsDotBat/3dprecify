import { describe, expect, it } from "vitest";

import { decimalHoursToHm, hmToDecimalHours, hmToDecimalString, parseRelogio } from "./time-input";

// 016/US7 (T020, FR-909, SC-905) — the h+min ↔ decimal border, red first: this module does not
// exist yet at the time this test is written.

describe("time-input — h+min ↔ decimal (US7, arquitetura-016.md §7)", () => {
  it("é bijetiva no domínio de minutos inteiros: qualquer (h,min) 0..59 round-trips exatamente", () => {
    for (let h = 0; h <= 10; h++) {
      for (let min = 0; min < 60; min++) {
        const decimalStr = hmToDecimalString(h, min);
        expect(decimalHoursToHm(decimalStr)).toEqual({ h, min });
      }
    }
  });

  it("5,33 exibe 5h 20min", () => {
    expect(decimalHoursToHm("5,33")).toEqual({ h: 5, min: 20 });
  });

  it("5.33 (forma dot-decimal, herdada) exibe 5h 20min também", () => {
    expect(decimalHoursToHm("5.33")).toEqual({ h: 5, min: 20 });
  });

  it("5.5 → 5h 30min", () => {
    expect(decimalHoursToHm("5.5")).toEqual({ h: 5, min: 30 });
    expect(decimalHoursToHm("5,5")).toEqual({ h: 5, min: 30 });
  });

  it("0 é 0h 0min", () => {
    expect(decimalHoursToHm(0)).toEqual({ h: 0, min: 0 });
    expect(decimalHoursToHm("0")).toEqual({ h: 0, min: 0 });
  });

  it("um decimal herdado qualquer reabre sem número quebrado", () => {
    expect(decimalHoursToHm("2")).toEqual({ h: 2, min: 0 });
    expect(decimalHoursToHm("0,25")).toEqual({ h: 0, min: 15 });
    expect(decimalHoursToHm("abc")).toEqual({ h: 0, min: 0 }); // NaN → 0h0min, never crashes
  });

  it("minutos ≥ 60 digitados no campo de minutos transbordam deterministicamente", () => {
    expect(hmToDecimalHours(5, 60)).toBe(6);
    expect(decimalHoursToHm(hmToDecimalString(5, 60))).toEqual({ h: 6, min: 0 });
    // 2h + 75min = 3h15min — nunca um "2h75min" na tela.
    expect(decimalHoursToHm(hmToDecimalString(2, 75))).toEqual({ h: 3, min: 15 });
  });

  it("o transbordo de arredondamento na EXIBIÇÃO (round(frac×60)===60) carrega para +1h, 0min", () => {
    expect(decimalHoursToHm(1.999999999)).toEqual({ h: 2, min: 0 });
  });

  it("5h e 30min convertem para o decimal 5,5 que o motor já recebia (FR-909-AC1)", () => {
    expect(hmToDecimalHours(5, 30)).toBe(5.5);
  });

  it("entradas negativas/não-finitas nos campos h/min são tratadas como 0, nunca NaN", () => {
    expect(hmToDecimalHours(-1, 10)).toBe(10 / 60);
    expect(hmToDecimalHours(5, Number.NaN)).toBe(5);
  });
});

// Guarda da correção CF-002-LEIGO-C — o tempo colado do fatiador.
describe("parseRelogio — as formas que PrusaSlicer/Cura/Bambu imprimem", () => {
  it.each([
    ["2:30", 2, 30],
    ["2h30", 2, 30],
    ["2H30", 2, 30],
    ["2 : 30", 2, 30],
    ["12:05", 12, 5],
    ["0:45", 0, 45],
    ["48:00", 48, 0],
  ])("%s → %sh %smin", (bruto, h, min) => {
    expect(parseRelogio(bruto)).toEqual({ h, min });
  });

  it.each(["2:60", "2:99", "2:", ":30", "2h", "abc", "", "2,5", "150"])(
    "%s NÃO é relógio — o campo segue como antes",
    (bruto) => {
      expect(parseRelogio(bruto)).toBeNull();
    },
  );

  it("o resultado alimenta a MESMA conversão de sempre — nenhuma segunda regra de tempo", () => {
    const r = parseRelogio("2:30");
    expect(hmToDecimalString(r!.h, r!.min)).toBe(hmToDecimalString(2, 30));
  });
});
