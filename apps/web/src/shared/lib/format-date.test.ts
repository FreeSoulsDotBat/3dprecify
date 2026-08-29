import { describe, expect, it } from "vitest";

import { formatDatePtBr, formatDayMonthPtBr } from "./format-date";

describe("formatDatePtBr", () => {
  it("data pura ISO → dd/mm/aaaa", () => {
    expect(formatDatePtBr("2026-07-06")).toBe("06/07/2026");
  });

  it("string crua se não parsear", () => {
    expect(formatDatePtBr("não é data")).toBe("não é data");
  });

  it("data pura ignora fuso — sem TZ nunca vira o dia anterior (o bug clássico do UTC-midnight)", () => {
    expect(formatDatePtBr("2026-01-01")).toBe("01/01/2026");
  });

  it(
    "instante que cruza a meia-noite UTC — lido no fuso do APARELHO (explícito no teste, já que o " +
      "processo do vitest não controla TZ de forma confiável)",
    () => {
      // 2026-05-12T02:30:00Z em America/Sao_Paulo (UTC-3) é 11/05 local.
      expect(formatDatePtBr("2026-05-12T02:30:00Z", "America/Sao_Paulo")).toBe("11/05/2026");
    },
  );

  it("o mesmo instante em UTC não cruza — continua 12/05", () => {
    expect(formatDatePtBr("2026-05-12T02:30:00Z", "UTC")).toBe("12/05/2026");
  });
});

describe("formatDayMonthPtBr", () => {
  it('data pura ISO → dd/mm (a prancheta 16, "Salvo em 12/05")', () => {
    expect(formatDayMonthPtBr("2026-05-12")).toBe("12/05");
  });

  it("instante que cruza a meia-noite UTC — mesma regra de fuso do aparelho", () => {
    expect(formatDayMonthPtBr("2026-05-12T02:30:00Z", "America/Sao_Paulo")).toBe("11/05");
  });

  it("string crua se não parsear", () => {
    expect(formatDayMonthPtBr("xyz")).toBe("xyz");
  });
});
