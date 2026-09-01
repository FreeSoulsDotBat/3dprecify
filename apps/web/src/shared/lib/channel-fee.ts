// ⚠ @doc DEC-034 — UMA função para os dois lados: o congelado ignorava sobretaxa e a linha de
//   um marketplace cuja única cobrança era sobretaxa SUMIA do documento. Só PRESENÇA importa.

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
