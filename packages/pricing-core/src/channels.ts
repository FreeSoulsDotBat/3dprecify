// Per-channel marketplace gross-up — the price-band fixed-point + the per-item commission floor
// (ADR-0011 Part 3). Pure, deterministic, offline. Consumes ALREADY-RESOLVED fees (the client
// resolves the catalog entry by determinants; this owns only the price-keyed math — A6). Money via
// ADR-0008 (2-dp HALF_UP). Used by computeCalculator per channel; `grossUp` is exported for tests.
import { Decimal, toMoney } from "./rounding";

/** A listing-price fee band — half-open `[minPrice, maxPrice)` (`maxPrice: null` = ∞). */
export interface PriceBand {
  minPrice: number;
  maxPrice: number | null;
  commissionPct: number;
  fixedFee: number;
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

/** A co-funded free-shipping voucher band by listing price — half-open `[minPrice, maxPrice)`. Its
 *  `voucherCeiling` is the seller's contribution, deducted from líquido at the resulting announce (Shopee). */
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
  freightVoucherBands?: VoucherBand[]; // co-funded voucher, deducted by the announce band (Shopee, FR-111a)
  priceBands?: PriceBand[];
  bandMode?: BandMode; // ABSENT = "SELECTION" — see BandMode; absence preserves every stored payload
}

/** One gross-up outcome for a single base price. `freightCost` is the total freight deducted at THIS
 *  level (flat + the voucher resolved for this level's announce — the voucher can differ varejo/atacado). */
export interface ChannelLevel {
  anuncio: number;
  liquido: number;
  appliedBand: [number, number | null] | null;
  freightCost: number;
}

const MAX_BAND_ITERS = 4;

/** Half-open, lower-inclusive band selection: `price ∈ [minPrice, maxPrice)` (`maxPrice` null = ∞).
 *  Generic over any `{ minPrice, maxPrice }` band (price-fee bands AND freight voucher bands). */
function bandContaining<T extends { minPrice: number; maxPrice: number | null }>(
  bands: T[],
  price: number,
): T | null {
  return (
    bands.find((b) => price >= b.minPrice && (b.maxPrice === null || price < b.maxPrice)) ?? null
  );
}

/**
 * Announce (full precision) that nets `base` (before freight) after commission + fixed fee, choosing
 * whichever regime is self-consistent:
 *   % regime:  list = (base + fixedFee) / (1 − commissionPct/100)   when commissionPct/100·list ≥ minPerItem
 *   floor:     list = base + minPerItem + fixedFee                  when the per-item floor binds
 */
function grossUpOnce(
  base: number,
  commissionPct: number,
  fixedFee: number,
  minPerItem: number,
): Decimal {
  const keep = new Decimal(1).minus(new Decimal(commissionPct).dividedBy(100));
  const listPct = new Decimal(base).plus(fixedFee).dividedBy(keep);
  const commissionAtListPct = (commissionPct / 100) * listPct.toNumber();
  if (commissionAtListPct >= minPerItem) return listPct;
  return new Decimal(base).plus(minPerItem).plus(fixedFee);
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
 *   L − fee(L) − fixedFee_k = base
 *   ⇒ L = (base + fixedFee_k + acc_k − pct_k·min_k) / (1 − pct_k)
 *
 * Solve every segment, keep the one whose solution lands inside its OWN segment. Exactly one does
 * when the bands cover the line; if none does — a band set that stops short of ∞, which is
 * representable data, not an impossible state — fall back to the last segment so the result stays
 * deterministic instead of throwing on a price nobody priced for.
 */
function progressiveAnnounce(base: number, bands: PriceBand[]): { list: Decimal; band: PriceBand } {
  const solved: { list: Decimal; band: PriceBand }[] = [];
  let acc = new Decimal(0);
  for (const band of bands) {
    const rate = new Decimal(band.commissionPct).dividedBy(100);
    solved.push({
      list: new Decimal(base)
        .plus(band.fixedFee)
        .plus(acc)
        .minus(rate.times(band.minPrice))
        .dividedBy(new Decimal(1).minus(rate)),
      band,
    });
    if (band.maxPrice !== null) acc = acc.plus(rate.times(band.maxPrice - band.minPrice));
  }
  const inOwnSegment = solved.find(({ list, band }) => {
    const n = list.toNumber();
    return n >= band.minPrice && (band.maxPrice === null || n < band.maxPrice);
  });
  // No segment holds its own solution ⇒ the price sits above every band, i.e. a band set that stops
  // short of ∞. Representable data, so answer deterministically with the last segment rather than
  // throwing on a price the source never priced for.
  return inOwnSegment ?? solved[solved.length - 1];
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
  let commissionPct = fees.commissionPct;
  let fixedFee = fees.fixedFee ?? 0;
  let appliedBand: [number, number | null] | null = null;

  // Shared tail for BOTH band modes: the freight truth (flat + the co-funded voucher resolved for
  // THIS announce, so varejo and atacado can land in different voucher bands) and the líquido.
  const finish = (
    anuncioFinal: number,
    charged: Decimal,
    fixed: number,
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

  const bands = fees.priceBands;
  const first = bands?.[0];

  // PROGRESSIVE (ADR-0024): the fee is a SUM over slices, so there is no single `commissionPct` that
  // describes it — this branch owns both the announce and the charged commission, and returns early
  // through the shared freight/líquido tail below.
  if (fees.bandMode === "PROGRESSIVE" && bands && first) {
    const solved = progressiveAnnounce(base, bands);
    let anuncioProg = toMoney(solved.list);
    // The per-item floor still applies, now measured against the PROGRESSIVE commission.
    if (progressiveCommission(bands, anuncioProg).toNumber() < minPerItem) {
      anuncioProg = toMoney(new Decimal(base).plus(minPerItem).plus(solved.band.fixedFee));
    }
    const owed = progressiveCommission(bands, anuncioProg);
    const charged = owed.toNumber() >= minPerItem ? owed : new Decimal(minPerItem);
    return finish(anuncioProg, charged, solved.band.fixedFee, [
      solved.band.minPrice,
      solved.band.maxPrice,
    ]);
  }

  if (bands && first) {
    // Seed the band from the base, compute the announce, re-select the band for THAT announce;
    // iterate until the band is stable (or the terminal cap — always deterministic). The iteration
    // exists because SELECTION's fee function JUMPS at each threshold; PROGRESSIVE's does not.
    let band = bandContaining(bands, base) ?? bands[bands.length - 1];
    for (let i = 0; i < MAX_BAND_ITERS; i++) {
      const listRounded = toMoney(grossUpOnce(base, band.commissionPct, band.fixedFee, minPerItem));
      const next = bandContaining(bands, listRounded) ?? band;
      if (next === band) break;
      band = next;
    }
    commissionPct = band.commissionPct;
    fixedFee = band.fixedFee;
    appliedBand = [band.minPrice, band.maxPrice];
  }

  const anuncio = toMoney(grossUpOnce(base, commissionPct, fixedFee, minPerItem));
  // Commission actually charged on the ROUNDED announce (WYSIWYG) — the floor may bind here too.
  const pctCommission = new Decimal(commissionPct).dividedBy(100).times(anuncio);
  const commissionCharged =
    pctCommission.toNumber() >= minPerItem ? pctCommission : new Decimal(minPerItem);
  return finish(anuncio, commissionCharged, fixedFee, appliedBand);
}
