// O ADAPTADOR de canal: `ChannelInput` (o slot como o cliente o descreve) → `ChannelFees` (o que o
// gross-up consome), com validação POR SLOT e isolamento de erro (SC-107). Movido de index.ts na
// divisão por responsabilidade (chore de legibilidade 2026-08-31); corpo verbatim.
import {
    grossUp,
    validateBandRules,
    type BandMode,
    type ChannelFees,
    type ChannelSurcharge,
    type PriceBand,
    type VoucherBand,
} from "./channels.ts";

/**
 * One marketplace listing channel to price. `marketplace`/`feeDeterminants`/`feeSource` are opaque
 * provenance labels the engine echoes back onto the result — it never resolves fees (the client passes
 * already-resolved fees in, FR-110 / A6). Price-keyed resolution the engine DOES own: the Amazon
 * per-item commission floor (`minPerItem`, SC-112), the price-band fixed-point (`priceBands`, SC-108),
 * and the co-funded freight voucher (`freightVoucherBands`, Shopee, FR-111a) — all by listing price.
 */
export interface ChannelInput {
    marketplace?: string;
    feeDeterminants?: Record<string, string>;
    feeSource?: string; // human-readable provenance of the resolved fees (catalog source), echoed back
    commissionPct: number; // %, [0, 100) — the base commission (a matching priceBand overrides it)
    fixedFee?: number; // R$, ≥ 0, default 0
    minPerItem?: number; // R$, ≥ 0, default 0 — Amazon per-item commission floor
    freightCost?: number; // R$, ≥ 0, default 0 — deducted from líquido (never added to custo_total)
    freightVoucherBands?: VoucherBand[]; // Shopee co-funded voucher, deducted by the announce band (FR-111a)
    priceBands?: PriceBand[]; // fee by listing-price band (Shopee / ML custo fixo) — resolved by pricing-core
    bandMode?: BandMode; // ABSENT = "SELECTION" (ADR-0024) — absence is what preserves every stored payload
    /**
     * Custos opcionais que o VENDEDOR declara (ADR-0027 §3.2) — o valor vem do catálogo, nunca do
     * código. Somados por cima do fixo em TODOS os regimes, e é aí que está a razão de existirem:
     * um `fixedFee` digitado é INERTE sobre uma entrada bandada (regra 013/F1), então os R$ 50 do
     * volumoso da Shopee somados ali desapareceriam em silêncio. ABSENTE = nenhum = byte-idêntico.
     */
    surcharges?: ChannelSurcharge[];
}

/**
 * Per-channel gross-up outcome (varejo + atacado), shown together in "Preços por canal" (FR-112). A
 * slot that fails its own validation carries an `error` and null prices — its siblings still compute
 * (per-slot isolation, SC-107); the engine never throws for one bad channel.
 */
export interface ChannelResult {
    marketplace: string | null;
    feeDeterminants: Record<string, string> | null;
    feeSource: string | null; // provenance of the resolved fees (catalog source) — echoed, null when manual
    precoAnuncioVarejo: number | null;
    recebidoLiquidoVarejo: number | null;
    precoAnuncioAtacado: number | null;
    recebidoLiquidoAtacado: number | null;
    // Total freight deducted from EACH level's líquido — per level because a co-funded voucher is
    // resolved by that level's announce band (varejo/atacado can differ). 0 when the slot has no freight.
    freightCostVarejo: number;
    freightCostAtacado: number;
    /** As sobretaxas declaradas, ECOADAS (ADR-0027 §3.2) — a legenda e a linha do PDF se nomeiam a
     *  partir daqui. Lista VAZIA quando não há nenhuma: uma forma só para o consumidor. */
    surcharges: ChannelSurcharge[];
    error: string | null;
}

/**
 * Price ONE channel over both base prices (FR-110/112). The client passes ALREADY-RESOLVED fees
 * (commission %, fixed fee, per-item floor, freight, price bands); pricing-core owns the price-keyed
 * math — the band fixed-point + the commission floor + the gross-up (see ./channels). A slot that
 * fails its OWN validation returns an `error` with null prices and never throws, so its siblings keep
 * computing (per-slot isolation, SC-107).
 */
export function computeChannel(
    precoVarejo: number,
    precoAtacado: number,
    ch: ChannelInput,
): ChannelResult {
    const commissionPct = ch.commissionPct;
    const fixedFee = ch.fixedFee ?? 0;
    const minPerItem = ch.minPerItem ?? 0;
    const freightCost = ch.freightCost ?? 0;
    const voucherBands = ch.freightVoucherBands ?? [];
    const surcharges = ch.surcharges ?? [];

    const shell: ChannelResult = {
        marketplace: ch.marketplace ?? null,
        feeDeterminants: ch.feeDeterminants ?? null,
        feeSource: ch.feeSource ?? null,
        precoAnuncioVarejo: null,
        recebidoLiquidoVarejo: null,
        precoAnuncioAtacado: null,
        recebidoLiquidoAtacado: null,
        freightCostVarejo: 0,
        freightCostAtacado: 0,
        // Ecoadas mesmo no slot que FALHA: o vendedor declarou o custo, e sumir com a declaração junto
        // com o preço esconderia metade do motivo do erro.
        surcharges,
        error: null,
    };
    const fail = (error: string): ChannelResult => ({ ...shell, error });

    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct >= 100) {
        return fail("commissionPct must be a finite number in [0, 100)");
    }
    if (!Number.isFinite(fixedFee) || fixedFee < 0)
        return fail("fixedFee must be a finite number >= 0");
    if (!Number.isFinite(minPerItem) || minPerItem < 0) {
        return fail("minPerItem must be a finite number >= 0");
    }
    if (!Number.isFinite(freightCost) || freightCost < 0) {
        return fail("freightCost must be a finite number >= 0");
    }
    if (voucherBands.some((b) => !Number.isFinite(b.voucherCeiling) || b.voucherCeiling < 0)) {
        return fail("freightVoucherBands.voucherCeiling must be a finite number >= 0");
    }
    // ADR-0027 §3.2 — uma sobretaxa malformada não vira preço. O rótulo entra na conta porque é ele
    // que a legenda e a linha do PDF imprimem: uma linha de dinheiro sem nome é uma taxa sem
    // procedência, exatamente o que o array rotulado existe para impedir.
    if (surcharges.some((s) => !Number.isFinite(s.value) || s.value < 0)) {
        return fail("surcharges[].value must be a finite number >= 0");
    }
    if (surcharges.some((s) => s.label.trim().length === 0)) {
        return fail(
            "surcharges[].label must name the charge (a fee line with no name has no origin)",
        );
    }
    // A recusa de forma das bandas (fixedFeeRule fora de SELECTION, c + pct >= 100) chega ao vendedor
    // como ERRO POR SLOT NOMEADO — nunca um Infinity sob selo, nunca um slot vizinho derrubado.
    const bandRuleError = validateBandRules(ch.priceBands, ch.bandMode);
    if (bandRuleError !== null) return fail(bandRuleError);

    const fees: ChannelFees = {
        commissionPct,
        fixedFee,
        minPerItem,
        freightCost,
        freightVoucherBands: voucherBands.length > 0 ? voucherBands : undefined,
        priceBands: ch.priceBands,
        // Carried through, never re-derived. Dropping it here would silently degrade a progressive
        // schedule back to selection — the exact defect ADR-0024 fixes, reintroduced where the default
        // makes it invisible (ADR-0024 §5 names losing this field as the real risk, not the arithmetic).
        ...(ch.bandMode ? { bandMode: ch.bandMode } : {}),
        // Mesmo raciocínio do `bandMode` acima, e o ADR-0027 §5 nomeia este como O risco da mudança:
        // o perigo não é errar a aritmética (é linear e testada em três regimes), é um trajeto PERDER
        // o campo e degradar em silêncio para a constante antiga — invisível, porque o padrão o
        // justifica. Ausente vira lista vazia lá dentro, que é byte-idêntico.
        ...(surcharges.length > 0 ? { surcharges } : {}),
    };
    const varejo = grossUp(precoVarejo, fees);
    const atacado = grossUp(precoAtacado, fees);
    return {
        ...shell,
        freightCostVarejo: varejo.freightCost,
        freightCostAtacado: atacado.freightCost,
        precoAnuncioVarejo: varejo.anuncio,
        recebidoLiquidoVarejo: varejo.liquido,
        precoAnuncioAtacado: atacado.anuncio,
        recebidoLiquidoAtacado: atacado.liquido,
    };
}
