// O ORÇAMENTO montado (019/PR-E — ADR-0034, 4.2.0). `computeQuote` é função NOVA sobre
// `computeBom`, e não um parâmetro opcional dele: estender o contrato do kit para servir orçamento
// é como alguém aplica desconto num kit sem querer. Compor na tela também estava fora — a FR-1916
// proíbe soma paralela, e dois lugares arredondando dinheiro divergem num centavo que ninguém vê.
// Movido de index.ts na divisão por responsabilidade (chore de legibilidade 2026-08-31); verbatim.
import { computeBom, type BomLineInput, type BomResult } from "./bom.ts";
import { ValidationError } from "./errors.ts";
import { PRICING_MODEL_VERSION } from "./model-version.ts";
import { Decimal, toMoney } from "./rounding.ts";

/** Percentual sobre o total, ou um valor em reais. Nunca por item, nunca duas vezes (ADR-0034 §1.2). */
export type QuoteDiscountMode = "PCT" | "AMOUNT";

export interface QuoteDiscount {
    mode: QuoteDiscountMode;
    /** % em [0, 100] no modo `PCT`; R$ ≥ 0 e ≤ o bruto no modo `AMOUNT`. Sempre NÚMERO aqui — a
     *  string decimal é do documento congelado (`entities/history/frozen-payload.ts`), não do motor. */
    value: number;
}

/** Uma linha do orçamento: a linha de BOM que já existe (verbatim) + o nome que o documento imprime. */
export interface QuoteLineInput extends BomLineInput {
    name?: string;
}

export interface QuoteInput {
    lines: QuoteLineInput[];
    /** Ausente = sem desconto. Ausência e `{value: 0}` produzem o mesmo líquido, por construção. */
    discount?: QuoteDiscount;
}

/** A linha como o documento a imprime — nada aqui exige uma multiplicação da tela (FR-1916). */
export interface QuoteLineResult {
    /** `null` quando a linha não foi nomeada: o motor não inventa rótulo. */
    name: string | null;
    quantity: number;
    /** R$ por unidade = o `precoVarejo` unitário da linha (venda direta, sem canal). */
    unitPrice: number;
    /** R$ da linha inteira = unitário × quantidade, arredondado uma vez só (ADR-0016). */
    subtotal: number;
}

export interface QuoteResult {
    /** O conjunto inteiro, como o motor de kit já o produz — o detalhe sem recálculo nenhum. */
    bom: BomResult;
    lines: QuoteLineResult[];
    /** = `bom.precoVarejo`: a base é a VENDA DIRETA (custo + markup), sem comissão (ADR-0034 §1.1). */
    grossTotal: number;
    discountAmount: number;
    netTotal: number;
    /** = `bom.custoTotal`: o piso é o custo somado dos itens × quantidades (ADR-0034 §1.4). */
    costFloor: number;
    /** ESTRITAMENTE `netTotal < costFloor`. Vender exatamente no custo não é vender abaixo dele, e
     *  chamar o empate de "abaixo" seria um aviso falso. Avisa, não bloqueia (Q10). */
    belowCost: boolean;
    modelVersion: string;
}

/** O desconto já quantizado (ADR-0008: `Decimal` no meio, `toMoney` no fim). */
function resolveDiscountAmount(discount: QuoteDiscount, grossTotal: number): number {
    const { mode, value } = discount;
    if (!Number.isFinite(value) || value < 0) {
        throw new ValidationError(
            "discount.value deve ser um número finito >= 0",
            "discount.value",
        );
    }
    if (mode === "PCT") {
        if (value > 100) {
            throw new ValidationError(
                "discount.value em percentual não pode passar de 100 — o líquido nunca é negativo",
                "discount.value",
            );
        }
        return toMoney(new Decimal(grossTotal).times(value).dividedBy(100));
    }
    if (mode === "AMOUNT") {
        const amount = toMoney(value);
        if (amount > grossTotal) {
            // Um desconto maior que o total é ENTRADA INVÁLIDA, não um total negativo em silêncio
            // (ADR-0034 §1.6): o documento congelado não pode carregar um número que não existe.
            throw new ValidationError(
                "discount.value não pode ser maior que o total do orçamento",
                "discount.value",
            );
        }
        return amount;
    }
    // Alcançável só por chamador JS (o tipo é uma união fechada) — e é justamente o chamador que o
    // compilador não vê que faria um modo desconhecido virar "sem desconto" em silêncio.
    throw new ValidationError(`discount.mode desconhecido: ${String(mode)}`, "discount.mode");
}

/**
 * O orçamento montado (ADR-0034 / US16): N linhas × quantidade → bruto, desconto, líquido e piso.
 *
 * Regras normativas, todas testadas fora da UI (`tests/computeQuote.test.ts`): a base é a venda
 * DIRETA (`bom.precoVarejo`); o desconto incide no total, uma vez; nada de canal, banda ou tarifa
 * entra aqui — o que mantém esta função fora do alcance de `catalogVersion`.
 */
export function computeQuote(input: QuoteInput): QuoteResult {
    const { lines, discount } = input;

    // Esta recusa vem ANTES de qualquer cálculo, no molde da recusa nominal da 4.0.0: um orçamento é
    // venda direta (Q6), e `PriceInput.channels` é OPCIONAL no tipo — quem monta a linha a partir de
    // um produto do catálogo carrega os canais junto sem perceber. Embutir comissão de marketplace
    // num orçamento cobraria do cliente um canal que não existe nessa venda.
    lines.forEach((line, i) => {
        if (line.input.channels !== undefined && line.input.channels.length > 0) {
            throw new ValidationError(
                `lines[${i}].input.channels: um orçamento é venda DIRETA — marketplace não entra (ADR-0034 §1.1)`,
                `lines[${i}].input.channels`,
            );
        }
    });

    // Quantidade e entrada de peça continuam sendo validadas por `computeBom`, com os campos dele.
    const bom = computeBom(lines);
    const grossTotal = bom.precoVarejo;
    const discountAmount = discount === undefined ? 0 : resolveDiscountAmount(discount, grossTotal);
    const netTotal = toMoney(new Decimal(grossTotal).minus(discountAmount));
    const costFloor = bom.custoTotal;

    return {
        bom,
        lines: lines.map((line, i) => {
            // O índice existe: `bom.lines` é o `map` das mesmas linhas, na mesma ordem.
            const result = bom.lines[i]!;
            return {
                name: line.name ?? null,
                quantity: result.quantity,
                unitPrice: result.line.precoVarejo,
                subtotal: result.precoVarejo,
            };
        }),
        grossTotal,
        discountAmount,
        netTotal,
        costFloor,
        belowCost: netTotal < costFloor,
        modelVersion: PRICING_MODEL_VERSION,
    };
}
