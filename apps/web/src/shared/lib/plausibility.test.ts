import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import {
    fieldWarning,
    commissionWarning,
    quantityWarning,
    plausibilityWarnings,
    fieldLesson,
    THRESHOLDS,
} from "./plausibility";

// Guarda dos avisos de plausibilidade — a correção dos NOVE achados ALTA da homologação
// automatizada de 2026-08-13.
//
// Cada caso abaixo é um vendedor real do relatório, com o número que ele realmente digitou. Um
// teste que só verificasse "existe uma função" não provaria nada: o defeito nunca foi a ausência
// de código, foi o silêncio diante de um número específico.

describe("as frases são factualmente verdadeiras (review do PR #58)", () => {
    it("120 h dão EXATAMENTE 5 dias, e a frase não diz 'mais de 5'", () => {
        const [notice] = plausibilityWarnings({ printTimeHours: 120 });
        expect(notice?.text).toContain("5 dias");
        expect(notice?.text).not.toContain("mais de");
    });
    it("o aviso de consumo não afirma que o valor digitado É um chuveiro", () => {
        const [notice] = plausibilityWarnings({ avgPowerKw: 120 });
        expect(notice?.text).not.toMatch(/120 kW é o de um chuveiro/);
    });
    it("a média nacional de tarifa é a MESMA do tooltip do campo — um fato, um lugar", () => {
        const [notice] = plausibilityWarnings({ tariffPerKwh: 6 });
        const doTooltip = /R\$ \d+,\d{2}/.exec(messages.calculator.fieldTips.tariff.body)?.[0];
        expect(doTooltip).toBeTruthy();
        expect(notice?.text).toContain(doTooltip!);
    });
});

describe("erro de unidade — o número plausível que significa outra coisa", () => {
    it("avisa sobre 120 em Consumo médio (a etiqueta diz 120 W, o campo pede kW)", () => {
        const [notice] = plausibilityWarnings({ avgPowerKw: 120 });
        expect(notice?.field).toBe("avgPowerKw");
        expect(notice?.text).toContain("120");
        expect(notice?.text).toContain("0,12"); // ENSINA a conversão, não só reclama
    });

    it("avisa sobre 220 em Consumo médio (a tensão da tomada, não o consumo)", () => {
        expect(plausibilityWarnings({ avgPowerKw: 220 })).toHaveLength(1);
    });

    it("avisa sobre 95 na Tarifa (a conta de luz fala em centavos)", () => {
        const [notice] = plausibilityWarnings({ tariffPerKwh: 95 });
        expect(notice?.field).toBe("tariffPerKwh");
    });

    it("avisa sobre 3 na Vida útil (ele pensou em ANOS; o campo pede HORAS)", () => {
        const [notice] = plausibilityWarnings({ machineLifetimeHours: 3 });
        expect(notice?.field).toBe("machineLifetimeHours");
        expect(notice?.text).toContain("3.600"); // o exemplo que a spec já usa
    });

    it("avisa sobre 1000 no Peso do rolo (gramas informadas como quilos)", () => {
        expect(plausibilityWarnings({ rollWeightKg: 1000 })).toHaveLength(1);
    });

    it("avisa sobre 3000 no Valor da hora (o salário do MÊS)", () => {
        expect(plausibilityWarnings({ laborRatePerHour: 3000 })).toHaveLength(1);
    });

    it("avisa sobre 500 na Reserva de manutenção (o gasto do ANO)", () => {
        expect(plausibilityWarnings({ maintenanceReservePerHour: 500 })).toHaveLength(1);
    });

    it("avisa sobre 999999999999 gramas (o peso do rolo, ou uma casa a mais)", () => {
        const [notice] = plausibilityWarnings({ printGrams: 999999999999 });
        expect(notice?.field).toBe("printGrams");
    });

    it("avisa sobre 150 horas de impressão (ele quis dizer 150 MINUTOS)", () => {
        const [notice] = plausibilityWarnings({ printTimeHours: 150 });
        expect(notice?.field).toBe("printTimeHours");
        expect(notice?.text).toContain("6,3"); // 150h = 6,3 dias — verdade, e não "mais de 6"
    });
});

describe("o valor legítimo NÃO é avisado — senão o aviso vira ruído e ninguém lê", () => {
    it.each([
        ["consumo real de uma impressora", { avgPowerKw: 0.12 }],
        ["consumo de uma impressora grande", { avgPowerKw: 0.4 }],
        ["tarifa real brasileira", { tariffPerKwh: 0.95 }],
        ["tarifa cara", { tariffPerKwh: 1.4 }],
        ["vida útil da semente", { machineLifetimeHours: 3600 }],
        ["rolo de 1 kg", { rollWeightKg: 1 }],
        ["rolo grande de 5 kg", { rollWeightKg: 5 }],
        ["hora de trabalho realista", { laborRatePerHour: 18.75 }],
        ["hora de trabalho cara", { laborRatePerHour: 120 }],
        ["reserva por hora realista", { maintenanceReservePerHour: 0.5 }],
        ["impressão longa de 2 dias", { printTimeHours: 48 }],
        ["peça grande de 2 kg", { printGrams: 2000 }],
    ])("%s não gera aviso", (_nome, plausibleInput) => {
        expect(plausibilityWarnings(plausibleInput)).toHaveLength(0);
    });
});

describe("o preço zero — o único aviso que não tem campo culpado", () => {
    it("avisa quando a peça existe e o custo e o preço deram zero", () => {
        const notices = plausibilityWarnings(
            { printGrams: 100 },
            { custoTotal: 0, precoVarejo: 0 },
        );
        expect(notices.map((a) => a.field)).toContain("resultado");
    });

    it("NÃO avisa num formulário recém-aberto e ainda vazio — isso não é erro, é um formulário vazio", () => {
        expect(plausibilityWarnings({}, { custoTotal: 0, precoVarejo: 0 })).toHaveLength(0);
    });

    it("NÃO avisa quando há preço", () => {
        const notices = plausibilityWarnings(
            { printGrams: 100 },
            { custoTotal: 16.16, precoVarejo: 24.24 },
        );
        expect(notices).toHaveLength(0);
    });
});

describe("comissão escrita como fração (CF-010-UI-02)", () => {
    it("avisa sobre 0,12 — ele quis dizer 12%", () => {
        expect(commissionWarning(0.12)).toContain("12");
    });
    it("não avisa sobre uma comissão real de marketplace", () => {
        expect(commissionWarning(12)).toBeNull();
        expect(commissionWarning(16.5)).toBeNull();
    });
    it("não avisa sobre campo vazio ou zero — ainda não é uma afirmação do vendedor", () => {
        expect(commissionWarning(undefined)).toBeNull();
        expect(commissionWarning(0)).toBeNull();
    });
    it("NaN nunca chega à tela — campo vazio faz parseDecimal devolver NaN, e NaN <= 0 é falso", () => {
        // A primeira versão deixava passar e a tela dizia "Confira a comissão: NaN%".
        expect(commissionWarning(Number.NaN)).toBeNull();
        expect(commissionWarning(Number.POSITIVE_INFINITY)).toBeNull();
    });
});

describe("quantidade acima do teto int4 da coluna (CF-021-UI-03)", () => {
    it("o teto é EXATAMENTE o da coluna, e é inclusivo", () => {
        expect(THRESHOLDS.quantityMax).toBe(2_147_483_647);
        expect(quantityWarning(2_147_483_647)).toBeNull();
        expect(quantityWarning(2_147_483_648)).not.toBeNull();
    });
    it("quantidades normais passam mudas", () => {
        for (const q of [1, 2, 10, 1000]) expect(quantityWarning(q)).toBeNull();
    });
});

describe("avisoDeCampo — a porta que a tela usa", () => {
    it("responde pelo nome do campo, lendo a string crua", () => {
        expect(fieldWarning("avgPowerKw", "120")).not.toBeNull();
        expect(fieldWarning("avgPowerKw", "0,12")).toBeNull();
    });
    it("um campo fora da tabela nunca gera aviso", () => {
        expect(fieldWarning("costPerRoll", "999999")).toBeNull();
    });
    it("uma string inválida não gera aviso — quem recusa é o schema, não este módulo", () => {
        expect(fieldWarning("avgPowerKw", "abc")).toBeNull();
    });
});

describe("licaoDeCampo — a lição SÓ, sem cabeça e sem o valor digitado (decisão do dono 28/08, 14b)", () => {
    it("os oito campos com faixa têm lição escrita, verbatim, terminando no fecho de recusa", () => {
        const t = messages.calculator.plausibility;
        for (const [nome, text] of Object.entries(t.lesson)) {
            expect(fieldLesson(nome)).toBe(text);
            expect(text).toContain(t.closingRejected);
            expect(text).not.toContain("Confira");
            expect(text).not.toContain(t.closingNormal);
        }
    });
    it("um campo sem lição escrita (ex.: comissão, quantidade) devolve null", () => {
        expect(fieldLesson("commissionPct")).toBeNull();
        expect(fieldLesson("quantity")).toBeNull();
        expect(fieldLesson("resultado")).toBeNull();
    });
});

describe("A REGRA DO ARQUIVO: aviso nunca vira validação", () => {
    // Estrutural, e é o teste mais importante daqui. A decisão do dono de 2026-08-03 (`failurePct`
    // sem teto) fica a um passo destes limiares; se alguém transformar um aviso em recusa, este
    // teste cai antes de o produto passar a recusar um número que o vendedor tinha o direito de usar.
    it("a superfície do módulo só devolve texto — nunca lança, nunca sinaliza inválido", () => {
        const absurdos = [0, -1, 1e308, Number.MAX_SAFE_INTEGER];
        for (const v of absurdos) {
            expect(() => plausibilityWarnings({ avgPowerKw: v, tariffPerKwh: v })).not.toThrow();
            for (const notice of plausibilityWarnings({ avgPowerKw: v })) {
                expect(typeof notice.text).toBe("string");
            }
        }
    });

    it("toda frase termina dizendo que nada foi recusado", () => {
        const todos = [
            ...plausibilityWarnings({
                avgPowerKw: 120,
                tariffPerKwh: 95,
                machineLifetimeHours: 3,
                rollWeightKg: 1000,
                laborRatePerHour: 3000,
                maintenanceReservePerHour: 500,
                printTimeHours: 150,
                printGrams: 999999999,
            }).map((a) => a.text),
            commissionWarning(0.12) ?? "",
            quantityWarning(2_147_483_648) ?? "",
        ];
        expect(todos).toHaveLength(10);
        for (const text of todos) expect(text).toContain("Nada foi recusado.");
    });
});
