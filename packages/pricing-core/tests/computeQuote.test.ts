import { describe, it, expect } from "vitest";

import {
    computeBom,
    computeQuote,
    PRICING_MODEL_VERSION,
    ValidationError,
    type PriceInput,
    type QuoteDiscountMode,
    type QuoteLineInput,
} from "../src/index.ts";
import { toMoney } from "../src/rounding.ts";

/**
 * 019/PR-E · T079 — `computeQuote` (ADR-0034 §Decision 1, US16).
 *
 * A regra do desconto e do piso mora NO MOTOR, não na tela: a FR-1916 proíbe soma paralela, e dois
 * lugares arredondando dinheiro divergem num centavo que ninguém vê. Este arquivo é a prova fora da
 * UI — e nasceu vermelho, antes de `computeQuote` existir.
 */

/** Peça de conta redonda: só material × markup, para que os números sejam verificáveis à mão. */
function peca(gramas: number, markupVarejoPct = 100): PriceInput {
    return {
        costPerRoll: 100, // R$ 100/kg ⇒ R$ 0,10/g
        rollWeightKg: 1,
        printGrams: gramas,
        printTimeHours: 0,
        avgPowerKw: 0,
        tariffPerKwh: 0,
        machineValue: 0,
        machineLifetimeHours: 1000,
        markupVarejoPct,
        markupAtacadoPct: 50,
    };
}

// 3 linhas × quantidades: unitários 20 / 40 / 10 ⇒ bruto 60 + 80 + 10 = R$ 150,00;
// custos unitários 10 / 20 / 5 ⇒ piso 30 + 40 + 5 = R$ 75,00.
const VETOR: QuoteLineInput[] = [
    { name: "Vaso G", input: peca(100), quantity: 3 },
    { name: "Vaso M", input: peca(200), quantity: 2 },
    { input: peca(50), quantity: 1 }, // sem nome: o nome é opcional e vira null
];

describe("computeQuote — os totais e o piso (ADR-0034 §1)", () => {
    it("sem desconto: bruto = líquido = o precoVarejo do conjunto; piso = custoTotal", () => {
        const bom = computeBom(VETOR);
        const q = computeQuote({ lines: VETOR });

        expect(q.grossTotal).toBe(bom.precoVarejo);
        expect(q.grossTotal).toBe(150);
        expect(q.discountAmount).toBe(0);
        expect(q.netTotal).toBe(150);
        expect(q.costFloor).toBe(bom.custoTotal);
        expect(q.costFloor).toBe(75);
        expect(q.belowCost).toBe(false);
        expect(q.modelVersion).toBe(PRICING_MODEL_VERSION);
        // O `bom` inteiro viaja junto: o construtor mostra o detalhe sem recalcular nada.
        expect(q.bom).toEqual(bom);
    });

    it("as linhas do documento saem prontas — nenhuma multiplicação sobra para a tela (FR-1916)", () => {
        const q = computeQuote({ lines: VETOR });
        expect(q.lines).toEqual([
            { name: "Vaso G", quantity: 3, unitPrice: 20, subtotal: 60 },
            { name: "Vaso M", quantity: 2, unitPrice: 40, subtotal: 80 },
            { name: null, quantity: 1, unitPrice: 10, subtotal: 10 },
        ]);
        // A soma dos subtotais É o bruto: o documento fecha com o total que ele mesmo imprime.
        expect(q.lines.reduce((a, l) => a + l.subtotal, 0)).toBe(q.grossTotal);
    });

    it("desconto PCT de 10%: incide no TOTAL, uma vez", () => {
        const q = computeQuote({ lines: VETOR, discount: { mode: "PCT", value: 10 } });
        expect(q.grossTotal).toBe(150);
        expect(q.discountAmount).toBe(15);
        expect(q.netTotal).toBe(135);
        expect(q.netTotal).toBe(toMoney(q.grossTotal - q.discountAmount));
        expect(q.belowCost).toBe(false);
    });

    it("desconto AMOUNT de R$ 10,00", () => {
        const q = computeQuote({ lines: VETOR, discount: { mode: "AMOUNT", value: 10 } });
        expect(q.discountAmount).toBe(10);
        expect(q.netTotal).toBe(140);
        expect(q.netTotal).toBe(toMoney(q.grossTotal - q.discountAmount));
    });

    it("PCT de 100% zera o líquido sem nunca ficar negativo", () => {
        const q = computeQuote({ lines: VETOR, discount: { mode: "PCT", value: 100 } });
        expect(q.discountAmount).toBe(150);
        expect(q.netTotal).toBe(0);
        expect(q.belowCost).toBe(true);
    });

    it("o desconto percentual arredonda pela regra da casa (meio centavo, ROUND_HALF_UP)", () => {
        // bruto 20,10 × 2,5% = 0,5025 → 0,50; bruto 20,30 × 2,5% = 0,5075 → 0,51 (o meio centavo sobe).
        const a = computeQuote({
            lines: [{ input: peca(100.5), quantity: 1 }],
            discount: { mode: "PCT", value: 2.5 },
        });
        expect(a.grossTotal).toBe(20.1);
        expect(a.discountAmount).toBe(0.5);
        expect(a.netTotal).toBe(19.6);

        const b = computeQuote({
            lines: [{ input: peca(101.5), quantity: 1 }],
            discount: { mode: "PCT", value: 2.5 },
        });
        expect(b.grossTotal).toBe(20.3);
        expect(b.discountAmount).toBe(0.51);
        expect(b.netTotal).toBe(19.79);
    });

    it("o desconto em reais também é quantizado antes de entrar na conta", () => {
        const q = computeQuote({ lines: VETOR, discount: { mode: "AMOUNT", value: 10.005 } });
        expect(q.discountAmount).toBe(10.01);
        expect(q.netTotal).toBe(139.99);
    });

    it("um orçamento sem linha nenhuma é zero, e zero não é 'abaixo do custo'", () => {
        const q = computeQuote({ lines: [] });
        expect(q.grossTotal).toBe(0);
        expect(q.netTotal).toBe(0);
        expect(q.costFloor).toBe(0);
        expect(q.belowCost).toBe(false);
        expect(q.lines).toEqual([]);
    });
});

describe("computeQuote — o piso avisa, e o empate NÃO é 'abaixo' (ADR-0034 §1.4/§1.5)", () => {
    // markup 0% ⇒ precoVarejo === custoTotal: o empate exato, que é o caso que a regra define.
    const noCusto: QuoteLineInput[] = [{ input: peca(100, 0), quantity: 1 }];

    it("vender exatamente no custo NÃO é vender abaixo dele (estritamente menor)", () => {
        const q = computeQuote({ lines: noCusto });
        expect(q.netTotal).toBe(q.costFloor);
        expect(q.belowCost).toBe(false);
    });

    it("um centavo abaixo do piso é abaixo do piso", () => {
        const q = computeQuote({ lines: noCusto, discount: { mode: "AMOUNT", value: 0.01 } });
        expect(q.netTotal).toBe(toMoney(q.costFloor - 0.01));
        expect(q.belowCost).toBe(true);
    });

    it("avisa, não bloqueia (Q10): o resultado existe, com o líquido que o vendedor pediu", () => {
        const q = computeQuote({ lines: noCusto, discount: { mode: "PCT", value: 50 } });
        expect(q.belowCost).toBe(true);
        expect(q.netTotal).toBe(5);
    });
});

describe("computeQuote — as recusas (ADR-0034 §1.6, §1.1)", () => {
    const casos: { nome: string; mode: QuoteDiscountMode; value: number }[] = [
        { nome: "desconto em reais maior que o total", mode: "AMOUNT", value: 150.01 },
        { nome: "desconto negativo em reais", mode: "AMOUNT", value: -1 },
        { nome: "desconto percentual negativo", mode: "PCT", value: -0.5 },
        { nome: "percentual acima de 100", mode: "PCT", value: 100.01 },
        { nome: "valor não-finito (NaN)", mode: "PCT", value: Number.NaN },
        { nome: "valor não-finito (Infinity)", mode: "AMOUNT", value: Number.POSITIVE_INFINITY },
    ];

    for (const caso of casos) {
        it(`recusa: ${caso.nome}`, () => {
            const chamada = (): unknown =>
                computeQuote({ lines: VETOR, discount: { mode: caso.mode, value: caso.value } });
            expect(chamada).toThrow(ValidationError);
            try {
                chamada();
                expect.unreachable("deveria ter recusado");
            } catch (e) {
                expect((e as ValidationError).field).toBe("discount.value");
            }
        });
    }

    it("recusa um modo de desconto que não existe (o tipo não protege o chamador JS)", () => {
        const discount = { mode: "GRATIS" as QuoteDiscountMode, value: 1 };
        const chamada = (): unknown => computeQuote({ lines: VETOR, discount });
        expect(chamada).toThrow(ValidationError);
        try {
            chamada();
            expect.unreachable("deveria ter recusado");
        } catch (e) {
            expect((e as ValidationError).field).toBe("discount.mode");
        }
    });

    it("recusa em RUNTIME uma linha com canal de marketplace — orçamento é venda DIRETA (Q6)", () => {
        // `PriceInput.channels` é opcional no TIPO (`index.ts:173`), então o compilador NÃO barra isto:
        // quem monta a linha a partir de um produto do catálogo carrega os canais junto sem perceber.
        // Uma comissão embutida num orçamento seria dinheiro cobrado do cliente por um canal que não
        // existe nessa venda — por isso a recusa é nominal, com o índice da linha culpada.
        const lines: QuoteLineInput[] = [
            { input: peca(100), quantity: 1 },
            {
                input: { ...peca(200), channels: [{ marketplace: "Shopee", commissionPct: 14 }] },
                quantity: 2,
            },
        ];
        try {
            computeQuote({ lines });
            expect.unreachable("deveria ter recusado");
        } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).field).toBe("lines[1].input.channels");
        }
    });

    it("uma lista de canais VAZIA passa — ausência e vazio dizem a mesma coisa: sem marketplace", () => {
        const q = computeQuote({ lines: [{ input: { ...peca(100), channels: [] }, quantity: 1 }] });
        expect(q.grossTotal).toBe(20);
        expect(q.bom.channels).toEqual([]);
    });

    it("a quantidade inválida continua sendo recusada por computeBom, com o campo dele", () => {
        try {
            computeQuote({ lines: [{ input: peca(100), quantity: 1.5 }] });
            expect.unreachable("deveria ter recusado");
        } catch (e) {
            expect((e as ValidationError).field).toBe("lines[0].quantity");
        }
    });
});

describe("PRICING_MODEL_VERSION sobe junto com a capacidade (ADR-0034 §Decision 1)", () => {
    it("é 4.2.0 — o rótulo congelado precisa dizer QUAL motor produziu o número", () => {
        expect(PRICING_MODEL_VERSION).toBe("4.2.0");
        expect(computeQuote({ lines: VETOR }).modelVersion).toBe("4.2.0");
    });
});
