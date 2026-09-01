// @doc DEC-027 — a superfície pública dividida por responsabilidade, com o grafo acíclico.
// ⚠ @doc ADR-0008 — o backend NUNCA recomputa preço (FR-118): este pacote é a fonte única.

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
