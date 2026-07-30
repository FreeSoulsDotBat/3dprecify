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
 * when the bands cover the line; if none does — a band set that stops short of ∞, or one with a
 * published gap, both representable data — the answer is `null`: the level is UNPRICED (SC-817).
 * Answering with the last segment instead would invent the rate for the excess the source never
 * published.
 */
function progressiveAnnounce(
  base: number,
  bands: PriceBand[],
): { list: Decimal; band: PriceBand } | null {
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
function chooseBand(base: number, bands: PriceBand[], minPerItem: number): BandCandidate | null {
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
      net: new Decimal(anuncio).minus(charged).minus(applied.fixedFee),
    };
  };

  const fromSchedules = bands
    .map((b) => at(toMoney(grossUpOnce(base, b.commissionPct, b.fixedFee, minPerItem)), b))
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
  return ordered[0]!;
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

  /** SC-817 — no published band covers this price. A state, not a number: the caller shows "sem
   *  referência" rather than a price borrowed from a band that does not contain it. */
  const unpriced: ChannelLevel = {
    anuncio: null,
    liquido: null,
    appliedBand: null,
    freightCost: 0,
  };

  const bands = fees.priceBands;
  const first = bands?.[0];

  // PROGRESSIVE (ADR-0024): the fee is a SUM over slices, so there is no single `commissionPct` that
  // describes it — this branch owns both the announce and the charged commission, and returns early
  // through the shared freight/líquido tail below.
  if (fees.bandMode === "PROGRESSIVE" && bands && first) {
    const solved = progressiveAnnounce(base, bands);
    if (!solved) return unpriced;
    let anuncioProg = toMoney(solved.list);
    // The per-item floor still applies, now measured against the PROGRESSIVE commission.
    if (progressiveCommission(bands, anuncioProg).toNumber() < minPerItem) {
      anuncioProg = toMoney(new Decimal(base).plus(minPerItem).plus(solved.band.fixedFee));
    }
    // The floor regime moves the announce, so re-check that it still sits inside a published band:
    // a slice of the price outside the schedule has no rate, and summing over it would invent one.
    const held = bandContaining(bands, anuncioProg);
    if (!held) return unpriced;
    const owed = progressiveCommission(bands, anuncioProg);
    const charged = owed.toNumber() >= minPerItem ? owed : new Decimal(minPerItem);
    return finish(anuncioProg, charged, held.fixedFee, [held.minPrice, held.maxPrice]);
  }

  if (bands && first) {
    const chosen = chooseBand(base, bands, minPerItem);
    if (!chosen) return unpriced;
    // Charged by the band that CONTAINS the announce — never by the one that merely produced it.
    return finish(chosen.anuncio, chosen.charged, chosen.applied.fixedFee, [
      chosen.applied.minPrice,
      chosen.applied.maxPrice,
    ]);
  }

  const fixedFee = fees.fixedFee ?? 0;
  const anuncio = toMoney(grossUpOnce(base, fees.commissionPct, fixedFee, minPerItem));
  // Commission actually charged on the ROUNDED announce (WYSIWYG) — the floor may bind here too.
  const pctCommission = new Decimal(fees.commissionPct).dividedBy(100).times(anuncio);
  const commissionCharged =
    pctCommission.toNumber() >= minPerItem ? pctCommission : new Decimal(minPerItem);
  return finish(anuncio, commissionCharged, fixedFee, null);
}
