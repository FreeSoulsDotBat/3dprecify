// Canonical 3D-print pricing core — a superfície pública inteira, legível de uma vez. Pure,
// deterministic, offline. The backend never recomputes any price (FR-118); this package is the
// single source of the formula. ADR-0008 (money) · ADR-0009 (machine) · ADR-0011 (result contract).
//
// Divisão por responsabilidade (chore de legibilidade 2026-08-31; corpos movidos VERBATIM, guarda
// tests/public-surface.test.ts + a varredura de igualdade version-equality):
//   rounding ← channels ← channel-slot ← calculator ← bom ← quote     (acíclico)
//        ↖ errors ↗                ↖ model-version ↗
//
//   model-version.ts  o rótulo PRICING_MODEL_VERSION + campos aposentados (ADR-0026)
//   errors.ts         ValidationError + asserções de entrada
//   rounding.ts       toMoney/sumMoney/Decimal — a única regra de arredondamento (ADR-0008)
//   channels.ts       gross-up por faixa: bandas, piso, voucher, sobretaxa (ADR-0024/0027)
//   channel-slot.ts   ChannelInput→ChannelFees, validação POR SLOT + isolamento (SC-107)
//   calculator.ts     computeCalculator — peça única: custo por linha + markups + canais
//   bom.ts            computeBom — kit: linhas × quantidade + rollup por marketplace (ADR-0016)
//   quote.ts          computeQuote — orçamento: venda direta, desconto no total, piso (ADR-0034)

export {
    PRICING_MODEL_VERSION,
    RETIRED_INPUT_FIELDS,
    isPreRemovalModel,
    stripRetiredFields,
    type DiscardedField,
} from "./model-version.ts";
export { ValidationError } from "./errors.ts";
export {
    computeCalculator,
    type OtherCostItem,
    type PriceInput,
    type PriceResult,
} from "./calculator.ts";
export { type ChannelInput, type ChannelResult } from "./channel-slot.ts";
export {
    computeBom,
    type BomChannelRollup,
    type BomLineInput,
    type BomLineResult,
    type BomResult,
} from "./bom.ts";
export {
    computeQuote,
    type QuoteDiscount,
    type QuoteDiscountMode,
    type QuoteInput,
    type QuoteLineInput,
    type QuoteLineResult,
    type QuoteResult,
} from "./quote.ts";
// The per-channel gross-up primitive (band fixed-point + commission floor) + its types live in
// ./channels; re-export so consumers and tests reach them from the package entry.
// `bandContaining`/`bandFixedFee` exportadas desde a Onda 4 do chore de legibilidade (2026-08-31):
// eram regras reimplementadas fora do pacote (fee-prefill/fee-catalog) — a leitura da faixa e do
// fixo tem UMA casa, aqui.
export { bandContaining, bandFixedFee, grossUp } from "./channels.ts";
export type {
    BandMode,
    ChannelFees,
    ChannelLevel,
    ChannelSurcharge,
    FixedFeeRule,
    PriceBand,
    VoucherBand,
} from "./channels.ts";
// 3.1.0 public money primitives (ADR-0016): consumers (the BOM feature layer) format/verify with
// these instead of ever doing native float arithmetic — pricing-core stays the only money home.
export { Decimal, toMoney, sumMoney } from "./rounding.ts";
