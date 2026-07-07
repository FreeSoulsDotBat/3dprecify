import type { PriceBand } from "@3dprecify/pricing-core";

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
 *  determinant key (ML → listingType, Amazon → plan); Shopee/Outro contribute none (null). */
export function slotDeterminants(
  marketplace: MarketplaceId,
  modality: string,
): Record<string, string> | null {
  if (!modality) return null;
  if (marketplace === "MERCADO_LIVRE") return { listingType: modality };
  if (marketplace === "AMAZON") return { plan: modality };
  return null;
}

/** Resolve a slot's catalog entry (null when uncovered → manual + "sem referência"). */
export function resolveSlotEntry(
  catalog: FeeCatalog,
  marketplace: MarketplaceId,
  modality: string,
): FeeEntry | null {
  const mk = toCatalogMarketplace(marketplace);
  if (!mk) return null;
  return resolveEntry(catalog, mk, slotDeterminants(marketplace, modality));
}

/** A resolved entry mapped into the pure engine's channel fee inputs. `freightIsEstimate` marks the
 *  ML free-shipping subsidy so the UI can seal that specific value as an "estimativa" (A4). */
export interface ResolvedChannelFees {
  commissionPct: number;
  fixedFee: number;
  minPerItem: number;
  priceBands?: PriceBand[];
  freightCost: number;
  freightIsEstimate: boolean;
}

/**
 * Map a resolved catalog entry → the pure engine's channel fees (SC-111). A price-band entry (Shopee)
 * carries its `priceBands` through (the engine's fixed-point owns the price-keyed selection); a single
 * entry carries commission/fixed/minPerItem. The ML free-shipping `ESTIMATE.defaultSubsidy` becomes an
 * editable `freightCost` that lowers the líquido and is sealed "estimativa". `BAND_VOUCHER` freight is
 * band-dependent and not yet modelled in the single-value engine freight → 0 for now (documented).
 */
export function entryToChannelFees(entry: FeeEntry): ResolvedChannelFees {
  const freight = entry.freight;
  const freightIsEstimate = freight.kind === "ESTIMATE";
  const freightCost = freight.kind === "ESTIMATE" ? freight.defaultSubsidy : 0;
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
}): FeeSealState {
  const { entry, source, now, edited } = args;
  if (edited) return { kind: "adjusted" };
  if (!entry) return { kind: "none" };
  return {
    kind: "reference",
    source: entry.source,
    reviewedOn: entry.lastReviewed,
    embedded: source === "seed",
    stale: isStale(entry, now),
  };
}
