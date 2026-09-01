import { describe, expect, it } from "vitest";

import {
    computeQuote,
    ValidationError,
    type PriceInput,
    type QuoteDiscountMode,
} from "../src/index.ts";

import fixture from "../../../contracts/discount-parity.json" with { type: "json" };

/**
 * Tarefa QA 2026-09-01 — a paridade motor↔backend do desconto de orçamento.
 *
 * FONTE (o motor, o que este arquivo pina): `packages/pricing-core/src/quote.ts` —
 * `resolveDiscountAmount` (linhas ~60-92) + a identidade `netTotal = grossTotal - discountAmount`
 * em `computeQuote` (linha ~121). As três regras: (a) PCT recusa valor > 100 (linha ~69);
 * (b) AMOUNT recusa valor > grossTotal (linha ~79); (c) a identidade acima.
 *
 * ESPELHO: `backend/app/api/history.py:_validate_declared_discount` (~linhas 134-176) — o par
 * exercitado em `backend/tests/test_discount_parity_mirror.py`, que lê a MESMA fixture JSON
 * (`contracts/discount-parity.json`). Se um lado mudar um limite e o outro não, um documento que
 * o app congela localmente passa a ser recusado pelo servidor com 422 — e o outbox offline
 * re-POSTa esse 422 para sempre (ADR-0018 §3, ver comentário no topo de `history.py`).
 *
 * Por que a fixture fica em `contracts/`: é o único diretório do repo hoje dedicado a um artefato
 * que TEM de concordar através da fronteira TS↔Python (hoje só `openapi.json`); um desconto que
 * diverge entre os dois lados é exatamente essa classe de risco, então o par de testes nasce ao
 * lado do contrato existente em vez de um novo lugar ad-hoc.
 */

interface DiscountCase {
    id: string;
    description: string;
    gross: string;
    discount: {
        mode: QuoteDiscountMode;
        engineValue: number;
        wireValue: string;
        wireAmount: string;
    } | null;
    expected: "accept" | "reject";
    expectedDiscountAmount: string | null;
    expectedNet: string | null;
}

const CASES = (fixture as unknown as { cases: DiscountCase[] }).cases;

/** Uma única linha cujo `precoVarejo` é EXATAMENTE `gross` (markup 100%, sem nenhum outro custo —
 *  o mesmo truque de `computeQuote.test.ts`): custo = gross/2, gramas = custo / 0,10 R$/g. */
function lineFor(gross: number): { input: PriceInput; quantity: number } {
    const custo = gross / 2;
    const gramas = custo / 0.1;
    return {
        input: {
            costPerRoll: 100,
            rollWeightKg: 1,
            printGrams: gramas,
            printTimeHours: 0,
            avgPowerKw: 0,
            tariffPerKwh: 0,
            machineValue: 0,
            machineLifetimeHours: 1000,
            markupVarejoPct: 100,
            markupAtacadoPct: 50,
        },
        quantity: 1,
    };
}

describe("paridade do desconto — o MOTOR (contracts/discount-parity.json)", () => {
    it("a fixture compartilhada tem os 13 casos esperados", () => {
        expect(CASES).toHaveLength(13);
    });

    for (const caso of CASES) {
        it(`${caso.id} — ${caso.description}`, () => {
            const gross = Number(caso.gross);
            const line = lineFor(gross);
            // Não-vacuidade da própria fixture/helper: a linha precisa produzir o bruto pedido
            // ANTES de o desconto entrar em cena, senão todo o resto do caso compara contra lixo.
            expect(computeQuote({ lines: [line] }).grossTotal).toBe(gross);

            const call = (): unknown =>
                computeQuote({
                    lines: [line],
                    discount:
                        caso.discount === null
                            ? undefined
                            : { mode: caso.discount.mode, value: caso.discount.engineValue },
                });

            if (caso.expected === "reject") {
                expect(call).toThrow(ValidationError);
                return;
            }

            const q = call() as ReturnType<typeof computeQuote>;
            expect(q.grossTotal).toBe(gross);
            expect(q.netTotal).toBe(Number(caso.expectedNet));
            expect(q.discountAmount).toBe(
                caso.expectedDiscountAmount === null ? 0 : Number(caso.expectedDiscountAmount),
            );
            // A identidade (regra c), reafirmada por caso — não só confiada ao motor.
            expect(q.netTotal).toBe(Math.round((q.grossTotal - q.discountAmount) * 100) / 100);
        });
    }
});
