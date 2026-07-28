import type { PriceBand, VoucherBand } from "@3dprecify/pricing-core";

import {
  type CatalogSource,
  type FeeCatalog,
  type FeeEntry,
  isStale,
  type Marketplace,
  MARKETPLACES,
  resolveEntry,
} from "@/shared/fee-catalog";

import type { MarketplaceId } from "./calculator-schema";
import type { FeeSealState } from "./fee-seal";

// US2 pre-fill logic (pure, deterministic — the stateful setValue wiring lives in the page). Resolves
// a channel slot's catalog entry by its determinants (A6) and derives the honesty seal from where the
// numbers came from + how fresh they are. NEVER invents a number: an uncovered slot resolves to null
// → the seal reads "sem referência" and the user types the fees manually (Constitution II).

/** Only these marketplaces exist in the catalog; OUTRO (and any future id) is always manual. */
function toCatalogMarketplace(id: MarketplaceId): Marketplace | null {
  return (MARKETPLACES as readonly string[]).includes(id) ? (id as Marketplace) : null;
}

/** The determinants a slot contributes to the catalog lookup. Modality maps to the marketplace's
 *  determinant key (ML → listingType, Amazon → plan); Shopee/Outro contribute none (null).
 *
 *  US2 added the `category` axis. Until 014 this function sent ONLY the modality, so a
 *  category-keyed entry could never resolve — the map would exist and nothing would reach it. An
 *  absent or empty category is OMITTED rather than sent as "", because the resolver matches
 *  determinant sets exactly and `category: ""` would match nothing at all. */
export function slotDeterminants(
  marketplace: MarketplaceId,
  modality: string,
  category?: string,
): Record<string, string> | null {
  if (!modality) return null;
  const cat: Record<string, string> = category ? { category } : {};
  if (marketplace === "MERCADO_LIVRE") return { listingType: modality, ...cat };
  if (marketplace === "AMAZON") return { plan: modality, ...cat };
  return null;
}

/** What a slot resolved to, and HOW — the seal needs the "how", not just the number. */
export interface SlotResolution {
  entry: FeeEntry | null;
  /** The category the number is actually FOR. May be an ANCESTOR of the chosen one (rates are
   *  piecewise-constant down the tree), which the seal has to disclose rather than imply. */
  originCategoryId: string | null;
  /** True when no category was chosen and the marketplace's OWN published catch-all was used. */
  viaCatchAll: boolean;
}

/**
 * Resolve a slot, reporting how it resolved (Q5).
 *
 * The asymmetry is deliberate and measured: Amazon **publishes** a catch-all ("Outros", 15%), so
 * using it is quoting the marketplace, not guessing. Mercado Livre publishes a **range** (14–19%) and
 * no catch-all — deriving one from a range would be fabricating a number (SC-804), so a slot with no
 * category simply resolves to nothing and the seal reads "sem referência".
 *
 * Nothing here decides that asymmetry: it falls out of the data. A marketplace gets catch-all
 * behaviour if, and only if, its catalog carries a modality-only entry.
 */
export function resolveSlot(
  catalog: FeeCatalog,
  marketplace: MarketplaceId,
  modality: string,
  category?: string,
): SlotResolution {
  const mk = toCatalogMarketplace(marketplace);
  if (!mk) return { entry: null, originCategoryId: null, viaCatchAll: false };

  const entry = resolveEntry(catalog, mk, slotDeterminants(marketplace, modality, category));
  if (!entry) return { entry: null, originCategoryId: null, viaCatchAll: false };

  // The entry itself says which category it belongs to — an ancestor's id when the chosen category
  // inherited. Absent means it is the modality-only entry, i.e. the published catch-all.
  const originCategoryId = entry.determinants?.category ?? null;
  return {
    entry,
    originCategoryId,
    viaCatchAll: originCategoryId === null && Boolean(category) === false,
  };
}

/** Resolve a slot's catalog entry (null when uncovered → manual + "sem referência"). */
export function resolveSlotEntry(
  catalog: FeeCatalog,
  marketplace: MarketplaceId,
  modality: string,
  category?: string,
): FeeEntry | null {
  return resolveSlot(catalog, marketplace, modality, category).entry;
}

/** A resolved entry mapped into the pure engine's channel fee inputs. `freightIsEstimate` marks the
 *  ML free-shipping subsidy so the UI can seal that specific value as an "estimativa" (A4);
 *  `freightVoucherBands` carries the Shopee co-funded voucher for the engine to resolve by announce. */
export interface ResolvedChannelFees {
  commissionPct: number;
  fixedFee: number;
  minPerItem: number;
  priceBands?: PriceBand[];
  freightCost: number;
  freightVoucherBands?: VoucherBand[];
  freightIsEstimate: boolean;
}

/**
 * Map a resolved catalog entry → the pure engine's channel fees (SC-111 / FR-111a). A price-band entry
 * (Shopee) carries its `priceBands` through (the engine's fixed-point owns the price-keyed selection); a
 * single entry carries commission/fixed/minPerItem. Freight per its kind: the ML free-shipping
 * `ESTIMATE.defaultSubsidy` becomes an editable flat `freightCost` sealed "estimativa"; the Shopee
 * `BAND_VOUCHER` carries its `bands` so pricing-core deducts the co-funded voucher for the resulting
 * announce band (never dropping it — that overstated the líquido); `NONE` → no freight.
 */
export function entryToChannelFees(entry: FeeEntry): ResolvedChannelFees {
  const freight = entry.freight;
  const freightIsEstimate = freight.kind === "ESTIMATE";
  const freightCost = freight.kind === "ESTIMATE" ? freight.defaultSubsidy : 0;
  const freightVoucherBands =
    freight.kind === "BAND_VOUCHER"
      ? freight.bands.map((b) => ({
          minPrice: b.minPrice,
          maxPrice: b.maxPrice,
          voucherCeiling: b.voucherCeiling,
        }))
      : undefined;
  return {
    commissionPct: entry.commissionPct ?? 0,
    fixedFee: entry.fixedFee ?? 0,
    minPerItem: entry.minPerItem ?? 0,
    priceBands: entry.priceBands
      ? entry.priceBands.map((b) => ({
          minPrice: b.minPrice,
          maxPrice: b.maxPrice,
          commissionPct: b.commissionPct ?? 0,
          fixedFee: b.fixedFee ?? 0,
        }))
      : undefined,
    freightCost,
    freightVoucherBands,
    freightIsEstimate,
  };
}

/**
 * Derive a slot's honesty seal. `edited` wins — once the user changes a pre-filled value it reads
 * "ajustado por você". No entry → "sem referência". Otherwise a dated reference, marked "embutida"
 * when it came from the bundled seed (offline) and "desatualizada" past the 30-day window.
 */
export function feeSealState(args: {
  entry: FeeEntry | null;
  source: CatalogSource;
  now: number;
  edited: boolean;
  /** Name of the category the number is FOR — may be an ancestor of the chosen one (US2). */
  originCategoryName?: string | null;
  /** Name of the marketplace's published catch-all, when that is what resolved. */
  catchAllName?: string | null;
  viaCatchAll?: boolean;
}): FeeSealState {
  const { entry, source, now, edited, originCategoryName, catchAllName, viaCatchAll } = args;
  if (edited) return { kind: "adjusted" };
  if (!entry) return { kind: "none" };
  const dated = {
    source: entry.source,
    reviewedOn: entry.lastReviewed,
    embedded: source === "seed",
    stale: isStale(entry, now),
  };
  // A catch-all is a DIFFERENT claim from "this is your category's rate", and collapsing the two is
  // how a seller ends up with the wrong number believing it is his. Amazon's "Outros" is the highest
  // band of the table, so the error is systematically upward — the seal has to say which it is.
  if (viaCatchAll) return { kind: "catchAll", ...dated, ...(catchAllName ? { catchAllName } : {}) };
  // The key is OMITTED rather than set to null when there is no category, so a slot on a
  // category-less marketplace keeps exactly the shape it had before 014.
  return { kind: "reference", ...dated, ...(originCategoryName ? { originCategoryName } : {}) };
}
