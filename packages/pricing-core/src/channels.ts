// Per-channel marketplace gross-up — the price-band fixed-point + the per-item commission floor
// (ADR-0011 Part 3). Pure, deterministic, offline. Consumes ALREADY-RESOLVED fees (the client
// resolves the catalog entry by determinants; this owns only the price-keyed math — A6). Money via
// ADR-0008 (2-dp HALF_UP). Used by computeCalculator per channel; `grossUp` is exported for tests.
import { Decimal, toMoney } from "./rounding.ts";

/**
 * How the FIXED fee of a band forms (ADR-0027 §3.1, pricing-core 4.1.0).
 *
 * **AUSENTE = a constante `fixedFee`** — o significado que todo payload gravado antes desta mudança
 * já tem (a mesma disciplina do `bandMode`, ADR-0024). `priceBands` viaja dentro de snapshot
 * congelado (imutável por trigger, ADR-0019) e de documento de cenário (ADR-0021): se a ausência
 * significasse outra coisa, um congelado que o produto promete imutável passaria a afirmar outro
 * preço sem uma linha dele mudar.
 *
 * `PCT_OF_PRICE` é o caso MÍNIMO que a fonte publica (Shopee art. 26839: abaixo de R$ 8 o adicional
 * por item é metade do preço do produto). Qualquer outra forma é decisão nova, não um `kind` a mais
 * por conveniência.
 */
export interface FixedFeeRule {
    kind: "PCT_OF_PRICE";
    /** % do ANÚNCIO, em (0, 100) — e `commissionPct + pct < 100` na mesma banda (denominador). */
    pct: number;
}

/** A listing-price fee band — half-open `[minPrice, maxPrice)` (`maxPrice: null` = ∞). */
export interface PriceBand {
    minPrice: number;
    maxPrice: number | null;
    commissionPct: number;
    /** R$ — o valor do fixo QUANDO NÃO HÁ regra. Com `fixedFeeRule` presente ele nunca é lido. */
    fixedFee: number;
    fixedFeeRule?: FixedFeeRule; // ADITIVO (ADR-0027) — ausência = a constante acima
}

/**
 * Um custo opcional POR ITEM que o vendedor declara (ADR-0027 §3.2) — Shopee: manuseio de item
 * volumoso, R$ 50,00 por PEDIDO (art. 3305). Rotulado, e não escalar, porque o breakdown e o PDF
 * imprimem linhas que se nomeiam: o rótulo é o que impede a superestimação multi-item de virar
 * surpresa no extrato.
 */
export interface ChannelSurcharge {
    label: string;
    value: number; // R$, ≥ 0
}

/**
 * How a band set combines into one commission (ADR-0024).
 *
 * - `SELECTION` — the band containing the price sets the rate for the WHOLE price (Shopee, ML fixed cost).
 * - `PROGRESSIVE` — each band's rate applies only to its OWN slice of the price. Amazon publishes this
 *   for some categories: "15% até R$ 200,00 e 10% para o **excedente** acima de R$ 200,00".
 *
 * **An ABSENT mode means `SELECTION`, and that is load-bearing, not a convenience.** `priceBands`
 * travels inside frozen snapshot payloads (immutable by DB trigger, ADR-0019) and saved scenario
 * documents (ADR-0021). If absence meant anything else, a snapshot the product promises immutable
 * would silently start asserting a different price without one line of it changing.
 */
export type BandMode = "SELECTION" | "PROGRESSIVE";

/**
 * A free-shipping voucher band by listing price — half-open `[minPrice, maxPrice)`. Its
 * `voucherCeiling` is deducted from líquido at the resulting announce.
 *
 * **DEPRECATED 2026-08-07 (hotfix 016/A2) — no emitters left, and NEVER to be removed.**
 *
 * It used to be described as "the seller's contribution". The verbatim sources (Shopee art. 26839 +
 * art. 23431) say the opposite: *"A Shopee **oferece** subsídios de frete para todos os
 * vendedores"*, and *"Cupons de frete grátis **válidos para fretes de até** R$20"* — the
 * R$ 20/30/40 is what SHOPEE offers, and it is the coupon's validity CEILING, not a seller charge.
 * Deducting it whole from the seller's net turned a R$ 24,24 margin into R$ 4,24 (T072, achado A2).
 * The catalog stopped emitting it (both Shopee entries are `freight: {kind: "NONE"}`); the subsidy
 * is published as non-computing information (`freightSubsidyInfo`).
 *
 * The engine keeps honouring it EXACTLY as before, and that is the point: this field travels inside
 * frozen snapshot payloads (ADR-0019, immutable by DB trigger) and saved scenario documents
 * (ADR-0021). Redefining or dropping the reading would make a document the product promises
 * immutable start asserting a different number without one line of it changing — the same argument
 * `BandMode` (ADR-0024) and `fixedFeeRule` (ADR-0027) already carry. Because nothing computes
 * differently, `PRICING_MODEL_VERSION` was NOT bumped by that hotfix, deliberately.
 *
 * Guarded by `tests/voucher-legacy-payload.test.ts`.
 */
export interface VoucherBand {
    minPrice: number;
    maxPrice: number | null;
    voucherCeiling: number;
}

/** Resolved per-channel fees fed into the gross-up (bands, when present, override commission/fixed). */
export interface ChannelFees {
    commissionPct: number;
    fixedFee?: number;
    minPerItem?: number; // Amazon per-item commission floor (default 0)
    freightCost?: number; // flat freight (manual / ML estimate) deducted from líquido (default 0)
    /** @deprecated 2026-08-07 (hotfix 016/A2) — honoured for STORED payloads only; see `VoucherBand`. */
    freightVoucherBands?: VoucherBand[];
    priceBands?: PriceBand[];
    bandMode?: BandMode; // ABSENT = "SELECTION" — see BandMode; absence preserves every stored payload
    /** Custos opcionais declarados pelo vendedor (ADR-0027 §3.2). ABSENTE/vazio = byte-idêntico. */
    surcharges?: ChannelSurcharge[];
}

/**
 * One gross-up outcome for a single base price. `freightCost` is the total freight deducted at THIS
 * level (flat + the voucher resolved for this level's announce — the voucher can differ
 * varejo/atacado).
 *
 * **`anuncio`/`liquido` are `null` when the level is UNPRICED** (SC-817): the announce falls outside
 * every published band, so no rate covers it. The engine MUST NOT borrow the neighbouring band's fee
 * — that would fill in the CALCULATION the gap FR-014a forbids filling in the CATALOG (the ML
 * R$ 50,01–78,99 gap the source itself leaves). "No published fee for this price" is a state of its
 * own, not a number; the caller shows "sem referência" instead of a price nobody published.
 */
export interface ChannelLevel {
    anuncio: number | null;
    liquido: number | null;
    appliedBand: [number, number | null] | null;
    freightCost: number;
}

/** Half-open, lower-inclusive band selection: `price ∈ [minPrice, maxPrice)` (`maxPrice` null = ∞).
 *  Generic over any `{ minPrice, maxPrice }` band (price-fee bands AND freight voucher bands). */
function bandContaining<T extends { minPrice: number; maxPrice: number | null }>(
    bands: T[],
    price: number,
): T | null {
    return (
        bands.find((b) => price >= b.minPrice && (b.maxPrice === null || price < b.maxPrice)) ??
        null
    );
}

/**
 * **A leitura ÚNICA do fixo de uma banda** (ADR-0027 §3.1) — e é aqui que um esquecimento vira
 * dinheiro errado, por isso ela existe como uma função só, usada nas TRÊS chamadas
 * (`grossUpOnce`, `chooseBand.at`, `grossUp.finish`):
 *
 *     bandFixedFee(banda, anuncio) = banda.fixedFeeRule ? anuncio × pct/100 : banda.fixedFee
 *
 * Sempre sobre o anúncio JÁ arredondado nas chamadas de cobrança (WYSIWYG, como a comissão).
 */
function bandFixedFee(band: PriceBand, anuncio: number): Decimal {
    return band.fixedFeeRule
        ? new Decimal(anuncio).times(band.fixedFeeRule.pct).dividedBy(100)
        : new Decimal(band.fixedFee);
}

/** A banda decomposta nas duas parcelas que o gross-up fechado consome: constante + % do preço. */
function fixedShapeOf(band: PriceBand): { constant: number; pct: number } {
    return band.fixedFeeRule
        ? { constant: 0, pct: band.fixedFeeRule.pct }
        : { constant: band.fixedFee, pct: 0 };
}

/** Σ das sobretaxas declaradas — atravessa TODOS os regimes (ADR-0027 §3.2 / regra 013/F1). */
function surchargeTotal(surcharges: ChannelSurcharge[] | undefined): Decimal {
    return (surcharges ?? []).reduce((t, s) => t.plus(s.value), new Decimal(0));
}

/**
 * As recusas DECLARADAS de ADR-0027 §3.1 — forma inválida é erro nomeado, nunca tolerada em
 * silêncio e nunca um `Infinity` sob selo:
 *
 * - `fixedFeeRule` só tem significado em `bandMode: "SELECTION"`. Numa entrada `PROGRESSIVE` a
 *   tarifa é cobrada por FATIA do preço, e "metade do preço" não é uma fatia — carregar a regra ali
 *   é erro de forma, não um caso a interpretar.
 * - `commissionPct/100 + pct/100 < 1` por banda: senão o denominador do gross-up zera ou inverte, e
 *   o motor devolveria `Infinity` (ou um preço NEGATIVO) com cara de resposta.
 *
 * Devolve a mensagem NOMEANDO a banda (`priceBands[i]`), ou `null` quando está tudo de pé.
 */
export function validateBandRules(
    bands: PriceBand[] | undefined,
    bandMode: BandMode | undefined,
): string | null {
    if (!bands) return null;
    for (const [i, band] of bands.entries()) {
        const rule = band.fixedFeeRule;
        if (!rule) continue;
        if (bandMode === "PROGRESSIVE") {
            return `priceBands[${i}].fixedFeeRule só tem significado em bandMode SELECTION (ADR-0027)`;
        }
        if (!Number.isFinite(rule.pct) || rule.pct <= 0 || rule.pct >= 100) {
            return `priceBands[${i}].fixedFeeRule.pct must be a finite number in (0, 100)`;
        }
        if (band.commissionPct + rule.pct >= 100) {
            return `priceBands[${i}]: commissionPct + fixedFeeRule.pct must be < 100 (o gross-up não teria solução)`;
        }
    }
    return null;
}

/**
 * Announce (full precision) that nets `base` (before freight) after commission + fixed fee + the
 * declared surcharges, choosing whichever regime is self-consistent. Com a taxa fixa podendo ser
 * uma FUNÇÃO do preço (ADR-0027), a álgebra continua **fechada e linear** — nenhuma iteração nova:
 *
 *   L − (c/100)·L − (p/100)·L − F − S = base  ⇒  L = (base + F + S) / (1 − c/100 − p/100)
 *   piso:  L − minPerItem − (p/100)·L − F − S = base  ⇒  L = (base + minPerItem + F + S) / (1 − p/100)
 *
 * onde `F` é a parcela CONSTANTE do fixo e `p` a parcela percentual (uma das duas é sempre zero).
 * Com `p = 0` e `S = 0` — todo payload de antes de 4.1.0 — as duas linhas voltam a ser exatamente
 * as de 4.0.0.
 */
function grossUpOnce(
    base: number,
    commissionPct: number,
    fixed: { constant: number; pct: number },
    minPerItem: number,
    surcharge: Decimal,
): Decimal {
    // Nomes com unidade: `anuncio*` são VALORES EM R$ (o L da álgebra acima); `fator*` são os
    // denominadores adimensionais (1 − percentuais). Nada aqui é um percentual.
    const fatorSemFixoPct = new Decimal(1).minus(new Decimal(fixed.pct).dividedBy(100));
    const fatorRetido = fatorSemFixoPct.minus(new Decimal(commissionPct).dividedBy(100));
    const anuncioRegimePct = new Decimal(base)
        .plus(fixed.constant)
        .plus(surcharge)
        .dividedBy(fatorRetido);
    const comissaoNoAnuncio = (commissionPct / 100) * anuncioRegimePct.toNumber();
    if (comissaoNoAnuncio >= minPerItem) return anuncioRegimePct;
    return new Decimal(base)
        .plus(minPerItem)
        .plus(fixed.constant)
        .plus(surcharge)
        .dividedBy(fatorSemFixoPct);
}

/**
 * Commission owed on `price` when the bands combine PER PORTION (`PROGRESSIVE`, ADR-0024): each band's
 * rate is charged only on the slice of the price that falls inside it. Bands below the price
 * contribute their full width; the band containing it contributes only up to the price; bands above
 * it contribute nothing.
 *
 * Continuous and monotonic in `price` — which is exactly why the progressive gross-up needs no fixed
 * point (see `progressiveAnnounce`).
 */
function progressiveCommission(bands: PriceBand[], price: number): Decimal {
    return bands.reduce((total, b) => {
        const upper = b.maxPrice === null ? price : Math.min(price, b.maxPrice);
        const slice = upper - b.minPrice;
        if (slice <= 0) return total;
        return total.plus(new Decimal(b.commissionPct).dividedBy(100).times(slice));
    }, new Decimal(0));
}

/**
 * Announce (full precision, %-regime) for `PROGRESSIVE` bands, plus the band the solution lands in.
 *
 * `SELECTION` needs an iterated fixed point because its fee function JUMPS at each threshold: the
 * announce picks the band and the band picks the announce. The progressive fee function has no jump,
 * so the solution is closed-form per segment. On segment `[min_k, max_k)`:
 *
 *   fee(L) = acc_k + pct_k·(L − min_k)         acc_k = Σ_{i<k} pct_i·(max_i − min_i)
 *   L − fee(L) − fixedFee_k − S = base         S = Σ surcharges (ADR-0027 §3.2)
 *   ⇒ L = (base + fixedFee_k + S + acc_k − pct_k·min_k) / (1 − pct_k)
 *
 * Solve every segment, keep the one whose solution lands inside its OWN segment. Exactly one does
 * when the bands cover the line; if none does — a band set that stops short of ∞, or one with a
 * published gap, both representable data — the answer is `null`: the level is UNPRICED (SC-817).
 * Answering with the last segment instead would invent the rate for the excess the source never
 * published.
 */
function progressiveAnnounce(
    base: number,
    bands: PriceBand[],
    surcharge: Decimal,
): { list: Decimal; band: PriceBand } | null {
    const solved: { list: Decimal; band: PriceBand }[] = [];
    let acc = new Decimal(0);
    for (const band of bands) {
        const rate = new Decimal(band.commissionPct).dividedBy(100);
        solved.push({
            list: new Decimal(base)
                .plus(band.fixedFee)
                .plus(surcharge)
                .plus(acc)
                .minus(rate.times(band.minPrice))
                .dividedBy(new Decimal(1).minus(rate)),
            band,
        });
        if (band.maxPrice !== null) acc = acc.plus(rate.times(band.maxPrice - band.minPrice));
    }
    return (
        solved.find(({ list, band }) => {
            const n = list.toNumber();
            return n >= band.minPrice && (band.maxPrice === null || n < band.maxPrice);
        }) ?? null
    );
}

/** One SELECTION candidate announce, and the band that ACTUALLY contains it. `assumed` is the band
 *  whose schedule produced it — `null` for a THRESHOLD candidate, which is a published boundary
 *  rather than any band's answer. They differ from `applied` exactly when a schedule is not
 *  self-consistent at its own answer: the case the old bounded fixed-point silently mislabelled. */
interface BandCandidate {
    assumed: PriceBand | null;
    applied: PriceBand;
    anuncio: number;
    charged: Decimal;
    /** Announce minus what the APPLIED band really charges — what the seller actually takes home. */
    net: Decimal;
}

/**
 * Rank a candidate, best first:
 *
 *   0 — self-consistent: the band that priced the announce is the band that contains it. Nets `base`
 *       exactly; this is the ordinary answer and it is what the old fixed-point converged to.
 *   1 — not self-consistent, but the real charge is no bigger than the assumed one, so the seller
 *       still takes home at least `base`. The surplus is real money and is shown as such.
 *   2 — the real charge is bigger: the seller would take home LESS than `base`. Last resort, and
 *       ranked last precisely so a shortfall is never chosen while an honest answer exists.
 *
 * A total order rather than a chain of special cases: no "no candidate qualified" branch to leave
 * uncovered, and the tie-break on the cheapest announce makes it independent of band order.
 */
function rankCandidate(c: BandCandidate, base: number): number {
    if (c.applied === c.assumed) return 0;
    return c.net.greaterThanOrEqualTo(base) ? 1 : 2;
}

/**
 * Pick the (band, announce) pair for `SELECTION` bands — or `null` when NO published band contains
 * any candidate announce (SC-817: the level is unpriced, never priced off a neighbour).
 *
 * This replaced a bounded fixed-point iteration. The iteration existed because SELECTION's fee
 * function JUMPS at each threshold, so the announce picks the band and the band picks the announce;
 * when the two never agree the loop exited on its iteration cap and the caller adopted whatever band
 * was left in the variable — charging the rate and the fixed fee of a band that does NOT contain the
 * announce. Measured: ML bands, base R$ 64,52 → announce R$ 79,00 shown with a R$ 64,52 líquido,
 * R$ 5,00 below the R$ 69,52 the seller really receives. Solving every band directly and ranking the
 * results removes the cap, the oscillation and the silent mislabel in one move.
 */
function chooseBand(
    base: number,
    bands: PriceBand[],
    minPerItem: number,
    surcharge: Decimal,
): BandCandidate | null {
    /** Score one announce against the band that really contains it — `null` when none does. */
    const at = (anuncio: number, assumed: PriceBand | null): BandCandidate | null => {
        const applied = bandContaining(bands, anuncio);
        if (!applied) return null; // this announce lands in a gap — it is not a priceable answer
        const pct = new Decimal(applied.commissionPct).dividedBy(100).times(anuncio);
        const charged = pct.toNumber() >= minPerItem ? pct : new Decimal(minPerItem);
        return {
            assumed,
            applied,
            anuncio,
            charged,
            // O que o vendedor leva PARA CASA: fixo da banda que CONTÉM o anúncio — pela regra dela,
            // quando ela tem uma — menos as sobretaxas que ele declarou (elas atravessam a banda).
            net: new Decimal(anuncio)
                .minus(charged)
                .minus(bandFixedFee(applied, anuncio))
                .minus(surcharge),
        };
    };

    const fromSchedules = bands
        .map((b) =>
            at(
                toMoney(grossUpOnce(base, b.commissionPct, fixedShapeOf(b), minPerItem, surcharge)),
                b,
            ),
        )
        .filter((c): c is BandCandidate => c !== null);
    // The level is priceable only if some PUBLISHED schedule answers it: an announce that both lands
    // inside a published band and actually delivers `base` (rank 0 or 1). Otherwise the price the
    // seller is asking about sits in a window the source never tarifou, and the level is unpriced
    // (SC-817). This gate runs BEFORE the thresholds on purpose — a threshold may refine an answer we
    // can already publish, but it must never CREATE one: walking the seller up to the next published
    // boundary is filling the FR-014a gap by another door, at a price they never asked for.
    if (!fromSchedules.some((c) => rankCandidate(c, base) <= 1)) return null;

    // The thresholds themselves. SELECTION's fee function jumps DOWN at a boundary, so the cheapest
    // announce that still delivers the base is often the boundary itself and NOT any schedule's own
    // answer — without these the engine overshot (ML base R$ 69,51 priced at R$ 84,67 when R$ 79,00
    // already netted R$ 69,52), which also broke monotonicity across the step.
    const fromThresholds = bands
        .map((b) => at(b.minPrice, null))
        .filter((c): c is BandCandidate => c !== null);

    const ordered = [...fromSchedules, ...fromThresholds].sort(
        (a, b) => rankCandidate(a, base) - rankCandidate(b, base) || a.anuncio - b.anuncio,
    );
    const best = ordered[0]!;

    // FORA DA TABELA ≠ lacuna DENTRO da tabela (arquitetura-016 §9.5, SC-817). Uma lacuna entre duas
    // janelas publicadas é uma faixa que a fonte deliberadamente não tarifa, e subir até a próxima
    // janela é honesto: todo preço no meio ESTÁ publicado e nenhum entrega a base (o platô do ML em
    // R$ 79,00). Abaixo do PISO da tabela não é isso: a fonte declara ali outra regra e não a publica
    // por inteiro (Shopee CPF alto volume — art. 26839 cita R$ 6,00 num item de R$ 8, mas não a
    // fórmula). Andar com o vendedor até o piso afirmaria "este é o preço mais barato que dá", e a
    // própria fonte desmente. Então: sem referência (I9) + o aviso da US17, nunca um preço.
    //
    // O teste é sobre a banda ESCOLHIDA: se a conta dela para esta base fecha abaixo do piso, o
    // vendedor está fora da tabela e o anúncio devolvido seria um empurrão até a borda. Com piso
    // ZERO — toda tabela publicada até 016 — o ramo é inalcançável, e é por isso que a regra é
    // byte-idêntica por construção em tudo que já existia.
    const publishedFloor = Math.min(...bands.map((b) => b.minPrice));
    const ownSchedule = toMoney(
        grossUpOnce(
            base,
            best.applied.commissionPct,
            fixedShapeOf(best.applied),
            minPerItem,
            surcharge,
        ),
    );
    return ownSchedule < publishedFloor ? null : best;
}

/**
 * Gross up ONE base price so the seller nets it (before freight) after the marketplace's commission +
 * fixed fee, honoring the Amazon per-item floor and a bounded price-band fixed-point. Freight is a
 * truthful post-deduction — it lowers the net below base by exactly that amount (FR-111a / SC-111),
 * never folded into the gross-up: the flat cost (manual entry / ML estimate) PLUS the co-funded
 * voucher resolved for the resulting announce band (Shopee). Deterministic: half-open lower-inclusive
 * bands + a terminal cap ⇒ the same input always yields the same band, announce and líquido (FR-111 /
 * SC-108). The returned `freightCost` is the total deducted at this level.
 */
export function grossUp(base: number, fees: ChannelFees): ChannelLevel {
    const minPerItem = fees.minPerItem ?? 0;
    const flatFreight = fees.freightCost ?? 0;
    const surcharge = surchargeTotal(fees.surcharges);

    // Shared tail for BOTH band modes: the freight truth (flat + the co-funded voucher resolved for
    // THIS announce, so varejo and atacado can land in different voucher bands) and the líquido.
    // `fixed` já chega como o fixo EFETIVO — `bandFixedFee(banda, L) + Σ surcharges` (ADR-0027).
    const finish = (
        anuncioFinal: number,
        charged: Decimal,
        fixed: Decimal,
        band: [number, number | null] | null,
    ): ChannelLevel => {
        const voucher =
            fees.freightVoucherBands && fees.freightVoucherBands.length > 0
                ? (bandContaining(fees.freightVoucherBands, anuncioFinal)?.voucherCeiling ?? 0)
                : 0;
        const freightCost = toMoney(new Decimal(flatFreight).plus(voucher));
        const liquido = toMoney(
            new Decimal(anuncioFinal).minus(charged).minus(fixed).minus(freightCost),
        );
        return { anuncio: anuncioFinal, liquido, appliedBand: band, freightCost };
    };

    /** SC-817 — no published band covers this price. A state, not a number: the caller shows "sem
     *  referência" rather than a price borrowed from a band that does not contain it. */
    const unpriced: ChannelLevel = {
        anuncio: null,
        liquido: null,
        appliedBand: null,
        freightCost: 0,
    };

    // Forma inválida NÃO vira número (ADR-0027 §3.1). `computeChannel` recusa ANTES, com erro por
    // slot nomeado; este ramo existe para o primitivo exportado, que qualquer teste ou consumidor
    // pode chamar direto — e a resposta honesta ali é "sem referência", jamais um `Infinity`.
    if (validateBandRules(fees.priceBands, fees.bandMode) !== null) return unpriced;

    const bands = fees.priceBands;
    const first = bands?.[0];

    // PROGRESSIVE (ADR-0024): the fee is a SUM over slices, so there is no single `commissionPct` that
    // describes it — this branch owns both the announce and the charged commission, and returns early
    // through the shared freight/líquido tail below.
    if (fees.bandMode === "PROGRESSIVE" && bands && first) {
        const solved = progressiveAnnounce(base, bands, surcharge);
        if (!solved) return unpriced;
        let anuncioProg = toMoney(solved.list);
        // The per-item floor still applies, now measured against the PROGRESSIVE commission.
        if (progressiveCommission(bands, anuncioProg).toNumber() < minPerItem) {
            anuncioProg = toMoney(
                new Decimal(base).plus(minPerItem).plus(solved.band.fixedFee).plus(surcharge),
            );
        }
        // The floor regime moves the announce, so re-check that it still sits inside a published band:
        // a slice of the price outside the schedule has no rate, and summing over it would invent one.
        const held = bandContaining(bands, anuncioProg);
        if (!held) return unpriced;
        const owed = progressiveCommission(bands, anuncioProg);
        const charged = owed.toNumber() >= minPerItem ? owed : new Decimal(minPerItem);
        return finish(anuncioProg, charged, bandFixedFee(held, anuncioProg).plus(surcharge), [
            held.minPrice,
            held.maxPrice,
        ]);
    }

    if (bands && first) {
        const chosen = chooseBand(base, bands, minPerItem, surcharge);
        if (!chosen) return unpriced;
        // Charged by the band that CONTAINS the announce — never by the one that merely produced it.
        return finish(
            chosen.anuncio,
            chosen.charged,
            bandFixedFee(chosen.applied, chosen.anuncio).plus(surcharge),
            [chosen.applied.minPrice, chosen.applied.maxPrice],
        );
    }

    const fixedFee = fees.fixedFee ?? 0;
    const anuncio = toMoney(
        grossUpOnce(
            base,
            fees.commissionPct,
            { constant: fixedFee, pct: 0 },
            minPerItem,
            surcharge,
        ),
    );
    // Commission actually charged on the ROUNDED announce (WYSIWYG) — the floor may bind here too.
    const pctCommission = new Decimal(fees.commissionPct).dividedBy(100).times(anuncio);
    const commissionCharged =
        pctCommission.toNumber() >= minPerItem ? pctCommission : new Decimal(minPerItem);
    return finish(anuncio, commissionCharged, new Decimal(fixedFee).plus(surcharge), null);
}
