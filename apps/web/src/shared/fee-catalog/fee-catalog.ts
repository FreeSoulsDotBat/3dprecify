import { z } from "zod";

// Fee-catalog contract (ADR-0010 §1, snapshot shape 1B). ONE shape used identically by the served
// artifact (fee-catalog/catalog.json), the persisted client store and the bundled seed. The client
// resolves fees for any (marketplace, determinants) OFFLINE; pricing-core owns the price math — the
// backend serves data only (FR-118). Every curated entry MUST carry provenance (sourceUrl /
// effectiveDate / lastReviewed) — the truth-gate test fails the build otherwise (Constitution II).

export const MARKETPLACES = ["MERCADO_LIVRE", "AMAZON", "SHOPEE"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

/** Schema version of the payload shape (bumped on a breaking catalog-shape change). */
export const SCHEMA_VERSION = "1";

/** Staleness window: the seal warns past this many days since `lastReviewed` (ADR-0010 Part 2). */
export const STALENESS_DAYS = 30;

/** Half-open price band `[minPrice, maxPrice)` (`maxPrice: null` = ∞) — lower-inclusive tie-rule. */
const priceBandSchema = z.object({
  minPrice: z.number().nonnegative(),
  maxPrice: z.number().positive().nullable(),
  commissionPct: z.number().min(0).lt(100).nullable(),
  fixedFee: z.number().nonnegative().nullable(),
});

/** Freight / free-shipping descriptor (ADR-0010 Part 4) — a discriminated union on `kind`. */
const freightSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }),
  z.object({
    // ML: an editable ESTIMATE — the `thresholdPrice` IS sourced, but the `defaultSubsidy` magnitude
    // is a labelled estimate (A4: exempt from the provenance gate; the seal marks it "estimativa").
    kind: z.literal("ESTIMATE"),
    thresholdPrice: z.number().nonnegative(),
    defaultSubsidy: z.number().nonnegative(),
    inputs: z.array(z.string()).optional(),
  }),
  z.object({
    // Shopee: a seller-co-funded voucher ceiling by price band (curatable from the official source).
    kind: z.literal("BAND_VOUCHER"),
    bands: z.array(
      z.object({
        minPrice: z.number().nonnegative(),
        maxPrice: z.number().positive().nullable(),
        voucherCeiling: z.number().nonnegative(),
      }),
    ),
  }),
]);

/** One resolved fee entry, keyed by its marketplace-specific `determinants` (null = single entry). */
export const feeEntrySchema = z.object({
  determinants: z.record(z.string(), z.string()).nullable(),
  commissionPct: z.number().min(0).lt(100).nullable(),
  fixedFee: z.number().nonnegative().nullable(),
  minPerItem: z.number().nonnegative().nullable().optional(), // Amazon per-item commission floor
  priceBands: z.array(priceBandSchema).nullable().optional(),
  freight: freightSchema,
  source: z.string().min(1),
  sourceUrl: z.url(),
  effectiveDate: z.string().min(1),
  lastReviewed: z.string().min(1),
});
export type FeeEntry = z.infer<typeof feeEntrySchema>;

const marketplaceCatalogSchema = z.object({
  marketplace: z.enum(MARKETPLACES),
  determinantsSchema: z.record(z.string(), z.unknown()).nullish(),
  entries: z.array(feeEntrySchema),
});
export type MarketplaceCatalog = z.infer<typeof marketplaceCatalogSchema>;

/** The whole snapshot document (ADR-0010 1B) — every channel's fees + provenance in one shape. */
export const feeCatalogSchema = z.object({
  catalogVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  marketplaces: z.array(marketplaceCatalogSchema),
});
export type FeeCatalog = z.infer<typeof feeCatalogSchema>;

/** Parse + validate an unknown payload (served artifact / store / seed) against the schema. */
export function parseFeeCatalog(data: unknown): FeeCatalog {
  return feeCatalogSchema.parse(data);
}

/**
 * Resolve the fee entry for a `(marketplace, feeDeterminants)` — keyed by DETERMINANTS only (A6). The
 * price-keyed band/floor fixed-point stays in pricing-core. Returns null when the catalog has no
 * matching entry (→ manual entry + a "sem referência" seal; never a fabricated pre-fill).
 */
export function resolveEntry(
  catalog: FeeCatalog,
  marketplace: Marketplace,
  feeDeterminants: Record<string, string> | null,
): FeeEntry | null {
  const mk = catalog.marketplaces.find((m) => m.marketplace === marketplace);
  if (!mk || mk.entries.length === 0) return null;
  if (!feeDeterminants) {
    // No determinants (e.g. Shopee): the single null-keyed entry, else the first.
    return mk.entries.find((e) => e.determinants === null) ?? mk.entries[0] ?? null;
  }
  return (
    mk.entries.find(
      (e) =>
        e.determinants !== null &&
        Object.entries(e.determinants).every(([k, v]) => feeDeterminants[k] === v),
    ) ?? null
  );
}

/**
 * True when the entry is older than the staleness window (`now − lastReviewed > STALENESS_DAYS`).
 * `now` is passed in (epoch ms) so the function stays pure/deterministic (no `Date.now()` inside). An
 * unparseable date returns false — never cry wolf over a malformed value.
 */
export function isStale(entry: FeeEntry, now: number): boolean {
  const reviewed = Date.parse(entry.lastReviewed);
  if (Number.isNaN(reviewed)) return false;
  const ageDays = (now - reviewed) / (1000 * 60 * 60 * 24);
  return ageDays > STALENESS_DAYS;
}
