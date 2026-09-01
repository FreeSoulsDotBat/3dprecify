// B5 (2026-09-01) — "este canal tem taxa?" tinha DUAS implementações que deviam significar a MESMA
// coisa e não coincidiam: `entities/history/frozen-payload.ts` (o congelado, `feeBearing`) ignorava
// sobretaxas (`surcharges`), enquanto `features/calculator/calculator-model.ts` (o vivo, `hasFee`)
// já as contava desde 016/PR-F (US16, ADR-0027 §3.2). Um canal cuja ÚNICA cobrança é uma sobretaxa
// (ex.: Shopee "Manuseio de item volumoso", R$ 50) lia "sem taxa" no congelado e a linha do canal
// sumia do documento — o mesmo dado, duas respostas.
//
// FSD-Lite: `entities/history` e `features/calculator` não se importam um ao outro (eslint-
// boundaries) — a casa comum é `shared/lib`, o mesmo precedente de `decimal-leaf.ts` (extraído
// desta MESMA dupla de módulos, nesta mesma frente de correção). A forma aqui é NORMALIZADA: o
// vivo carrega números; o congelado carrega strings decimais (a folha frozen — ver
// `decimal-leaf.ts`). `Number(x)` lê as duas igualmente (`Number("12.00") === Number(12)`), então
// a MESMA função serve aos dois lados sem conversão explícita — só a checagem de PRESENÇA importa
// para `priceBands`/`freightVoucherBands`/`surcharges`, nunca o valor de cada item.

/** A forma mínima que as duas leituras (viva e congelada) de um canal têm em comum. Cada campo é
 *  `unknown` de propósito: o vivo passa `number`, o congelado passa `string | null` (uma folha
 *  `DecimalLeafValue`) — a regra não presume qual dos dois é. */
export interface FeeBearingChannelShape {
    commissionPct?: unknown;
    fixedFee?: unknown;
    minPerItem?: unknown;
    freightCost?: unknown;
    priceBands?: unknown;
    freightVoucherBands?: unknown;
    /** Vivo: `{label, value: number}[]` (`ChannelSurcharge`, pricing-core). Congelado: a mesma
     *  forma com `value` como string decimal. A regra só olha o COMPRIMENTO da lista. */
    surcharges?: unknown;
}

/**
 * Um canal carrega taxa quando qualquer um dos 4 escalares é `> 0`, OU quando carrega uma tabela
 * progressiva (`priceBands`/`freightVoucherBands`), OU quando carrega ao menos UMA sobretaxa
 * declarada — mesmo com os 4 escalares zerados. Este ÚLTIMO ramo é o que a leitura congelada
 * perdia (B5): uma sobretaxa é uma cobrança tão real quanto uma comissão, e "canal sem taxa" com
 * uma sobretaxa de R$ 50 gravada era a mesma classe de mentira que o motor já recusa (T120).
 */
export function channelHasDeclaredFee(input: FeeBearingChannelShape | null | undefined): boolean {
    if (input === null || input === undefined) return false;
    const positive = (value: unknown): boolean => Number(value ?? 0) > 0;
    const filled = (value: unknown): boolean => Array.isArray(value) && value.length > 0;
    return (
        positive(input.commissionPct) ||
        positive(input.fixedFee) ||
        positive(input.minPerItem) ||
        positive(input.freightCost) ||
        filled(input.priceBands) ||
        filled(input.freightVoucherBands) ||
        filled(input.surcharges)
    );
}
