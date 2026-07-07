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

  const bands = fees.priceBands;
  if (bands && bands.length > 0) {
    // Seed the band from the base, compute the announce, re-select the band for THAT announce;
    // iterate until the band is stable (or the terminal cap — always deterministic).
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
  // The co-funded voucher (Shopee) is band-dependent on THIS announce — resolve it here so varejo and
  // atacado each deduct the voucher for their own listing price (they can fall in different bands).
  const voucher =
    fees.freightVoucherBands && fees.freightVoucherBands.length > 0
      ? (bandContaining(fees.freightVoucherBands, anuncio)?.voucherCeiling ?? 0)
      : 0;
  const freightCost = toMoney(new Decimal(flatFreight).plus(voucher));
  const liquido = toMoney(
    new Decimal(anuncio).minus(commissionCharged).minus(fixedFee).minus(freightCost),
  );
  return { anuncio, liquido, appliedBand, freightCost };
}
