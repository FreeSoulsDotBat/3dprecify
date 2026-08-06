import { z } from "zod";

import { ancestorChain, categorySpineSchema, indexSpine } from "./category-tree";

// Fee-catalog contract (ADR-0010 §1, snapshot shape 1B). ONE shape used identically by the served
// artifact (backend/app/data/catalog.json), the persisted client store and the bundled seed. The client
// resolves fees for any (marketplace, determinants) OFFLINE; pricing-core owns the price math — the
// backend serves data only (FR-118). Every curated entry MUST carry provenance (sourceUrl /
// effectiveDate / lastReviewed) — the truth-gate test fails the build otherwise (Constitution II).

export const MARKETPLACES = ["MERCADO_LIVRE", "AMAZON", "SHOPEE"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

/** Schema version of the payload shape (bumped on a breaking catalog-shape change). */
export const SCHEMA_VERSION = "1";

/** O laco mensal le no dia 1 de cada mes, entao ate 31 dias sem releitura e OPERACAO NORMAL. */
const LOOP_CYCLE_DAYS = 31;

/** Revisao do PR mensal + merge + corte de release + o cliente buscar o catalogo. */
const DELIVERY_SLACK_DAYS = 14;

/**
 * Janela de obsolescencia: o selo avisa passados tantos dias desde `lastReviewed` (ADR-0010 Part 2).
 *
 * 014/T052 (FR-020b emendada, Clarification 2026-08-01) — eram 30 dias, e o laco roda MENSALMENTE.
 * A janela tinha exatamente o tamanho do ciclo, entao todo valor passava os ultimos dias gritando
 * "pode estar desatualizada" MESMO COM O ROBO FUNCIONANDO. Um alarme que dispara todo mes sobre
 * valores corretos e reverificados nao avisa: ele treina o vendedor a ignorar exatamente o aviso que
 * a US5 existe para dar.
 *
 * O relogio CONTINUA em `lastReviewed`, e de proposito: o risco que o selo mede e a Amazon ter mudado
 * a tarifa desde que CONFERIMOS. Medir a partir da entrega faria um numero nao-verificado ha meses
 * parecer fresco ao chegar num aparelho novo — a mentira inversa, e maior.
 *
 * Somado em vez de cravado para que o numero nao seja magico: se o laco mudar de cadencia, o que se
 * ajusta e a parcela que mudou, e a razao continua legivel.
 */
export const STALENESS_DAYS = LOOP_CYCLE_DAYS + DELIVERY_SLACK_DAYS;

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
export const feeEntrySchema = z
  .object({
    determinants: z.record(z.string(), z.string()).nullable(),
    commissionPct: z.number().min(0).lt(100).nullable(),
    fixedFee: z.number().nonnegative().nullable(),
    minPerItem: z.number().nonnegative().nullable().optional(), // Amazon per-item commission floor
    priceBands: z.array(priceBandSchema).nullable().optional(),
    // How the bands combine (ADR-0024 / FR-014b). ABSENT = "SELECTION", and that default is what keeps
    // every frozen snapshot and saved scenario meaning exactly what it meant when it was written —
    // `priceBands` travels inside those payloads, and snapshots are immutable by DB trigger (ADR-0019).
    // "PROGRESSIVE" = the fee is charged per SLICE of the price (Amazon: "15% até R$ 200,00 e 10% para
    // o excedente acima de R$ 200,00").
    // `nullish`, not `optional`: the backend serializes absent values as an explicit `null`, so a
    // schema that only tolerates `undefined` would REJECT the served payload — and rejection here is
    // silent (the app falls back to the bundled seed and nobody sees an error).
    bandMode: z.enum(["SELECTION", "PROGRESSIVE"]).nullish(),
    freight: freightSchema,
    source: z.string().min(1),
    sourceUrl: z.url(),
    effectiveDate: z.string().min(1),
    lastReviewed: z.string().min(1),
  })
  // F3 (confirmation audit) + SC-802/FR-008: a null top-level `commissionPct` is only legitimate when
  // the commission actually lives in `priceBands`. `entryToChannelFees` reads `null ?? 0`, so an entry
  // that reaches the calculator without a commission prefills 0% under a "referência" seal.
  .refine((e) => e.commissionPct !== null || (e.priceBands != null && e.priceBands.length > 0), {
    message:
      "an entry with a null commissionPct must carry priceBands (else it prefills 0% under a reference seal — F3/SC-802)",
    path: ["commissionPct"],
  })
  // 014/A2 — and EVERY band must carry its own commission, INDEPENDENTLY of the top level.
  //
  // This used to be the second half of the guard above, joined by `||`, so a non-null top-level
  // commission approved the whole entry without ever looking at the bands. That top-level number is a
  // decoy: `entryToChannelFees` maps `b.commissionPct ?? 0` and the BANDS REPLACE the top, so the 12%
  // exists, satisfies the guard, and is never charged — the price in that band comes out at 0% under a
  // "Referência" seal. Exactly the shape 014's ML curation produces (the sub-R$79 fixed-cost bands
  // know the fixed fee but not the commission), which is why this is latent rather than theoretical.
  .refine((e) => e.priceBands == null || e.priceBands.every((b) => b.commissionPct !== null), {
    message:
      "every price band must carry its own commission — a null band commission prefills 0% under a reference seal regardless of the top-level rate (FR-008/SC-802)",
    path: ["priceBands"],
  })
  // 016/US12 (FR-928, arquitetura-016 §9.4) — the F3 guard's mirror on `fixedFee`: the exact same
  // defect class, on the other numeric leaf. `entryToChannelFees` maps `b.fixedFee ?? 0`, so a band
  // with a null fixedFee prices R$ 0,00 under a "Referência" seal — never a fact anyone published.
  // No `fixedFeeRule` escape hatch exists yet (PR-F/ADR-0027 introduces it in `pricing-core`); until
  // then every published band MUST carry its own numeric fixedFee.
  .refine((e) => e.priceBands == null || e.priceBands.every((b) => b.fixedFee !== null), {
    message:
      "every price band must carry its own fixedFee — a null band fixedFee prices R$ 0,00 under a reference seal (FR-928)",
    path: ["priceBands"],
  })
  // A band mode with no bands to combine is a generator bug, not a harmless no-op: it reads as
  // "this entry is progressive" while the engine charges a flat rate. Reject rather than ignore.
  .refine((e) => e.bandMode == null || (e.priceBands != null && e.priceBands.length > 0), {
    message: "bandMode only means something with priceBands to combine (ADR-0024/FR-014b)",
    path: ["bandMode"],
  });
export type FeeEntry = z.infer<typeof feeEntrySchema>;

/** Order-independent identity of a determinant set — two entries with the same one are ambiguous. */
function determinantKey(d: Record<string, string> | null): string {
  // Sentinela do caso "sem determinantes". Precisa ser INFORJAVEL por um conjunto real: toda chave
  // real ou e vazia (`{}`) ou contem `=`, entao qualquer texto sem `=` e nao-vazio serve.
  //
  // Era um byte NUL literal, e isso custou caro fora do dominio: git e ripgrep detectam binario pelo
  // NUL, entao ESTE arquivo — esquema do dinheiro — ficava sem `diff`, sem `blame` e invisivel ao
  // `Grep`. Um arquivo de preco que o revisor nao consegue ler em diff e a mesma familia do §C3.
  // O `.gitattributes` devolveu `diff`/`blame`; o ripgrep faz a propria deteccao e ignora o atributo,
  // entao a unica correcao que vale para as DUAS ferramentas e nao ter o byte.
  if (d === null) return "(null determinants)";
  return Object.keys(d)
    .sort()
    .map((k) => `${k}=${d[k]}`)
    .join("&");
}

/** The 4 fee fields the channel form has always shown, by their WIRE name (016/US12, FR-918). */
const feeAxisSchema = z.enum(["commissionPct", "fixedFee", "minPerItem", "freightCost"]);

const marketplaceCatalogSchema = z
  .object({
    marketplace: z.enum(MARKETPLACES),
    determinantsSchema: z.record(z.string(), z.unknown()).nullish(),
    /** The resolution spine (014/D2) — only the nodes whose rate diverges, plus their ancestors. */
    categorySpine: categorySpineSchema.nullish(),
    // 016/US12 (FR-918, arquitetura-016 §F.2 rule 2) — ADITIVO. Which of the 4 numeric fee fields
    // this marketplace's channel section shows. ABSENT = the four fields = the form every catalog
    // shipped before this axis existed already rendered (I4) — a cached catalog from before 016
    // reads identically. Curated 016: Shopee [commissionPct, fixedFee, freightCost] · Amazon
    // [commissionPct, fixedFee, minPerItem] · Mercado Livre [commissionPct, fixedFee, freightCost].
    feeAxes: z.array(feeAxisSchema).nullish(),
    entries: z.array(feeEntrySchema),
  })
  .superRefine((mk, ctx) => {
    // Two entries with the same determinant set are AMBIGUOUS. The old resolver picked whichever came
    // first in the array — a money value decided by file order. Rejecting here is what makes SC-801
    // ("independent of entry order") true rather than merely tested: the resolver never has to break
    // a tie, because a tie cannot survive parsing.
    const seen = new Set<string>();
    for (const e of mk.entries) {
      const key = determinantKey(e.determinants);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate determinant set in ${mk.marketplace}: ${key} — resolution would depend on entry order`,
          path: ["entries"],
        });
        return;
      }
      seen.add(key);
    }

    // When a spine IS shipped, every category-keyed entry must appear in it: a category the spine
    // does not carry can never be reached by an ancestor walk from a real category, so it is dead
    // data pretending to be coverage.
    //
    // Deliberately NOT enforced: "category-keyed entries require a spine". A first draft of this
    // guard rejected that combination claiming such entries "could never resolve" — which is false.
    // `ancestorChain` of an unknown category yields the category itself, so the exact match still
    // finds the entry; what is lost is inheritance, not resolution. Requiring a spine belongs in the
    // INGESTION's own validation (fatal in the generator, FR-026), not in a schema that also has to
    // accept catalogs persisted by older clients.
    // `!= null` covers BOTH: absent (a persisted catalog from before 014) and an explicit `null`
    // (how the backend serializes a marketplace with no spine).
    if (mk.categorySpine != null) {
      const ids = new Set(mk.categorySpine.map((n) => n.id));
      const categorised = mk.entries.filter((e) => e.determinants?.category != null);
      for (const e of categorised) {
        const cat = e.determinants?.category;
        if (cat !== undefined && !ids.has(cat)) {
          ctx.addIssue({
            code: "custom",
            message: `entry keyed to category "${cat}", which is absent from ${mk.marketplace}'s spine`,
            path: ["entries"],
          });
          return;
        }
      }
    }
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
 * Parse the BUNDLED SEED without ever taking the app down (FR-026).
 *
 * `parseFeeCatalog` throwing is the right behaviour for the generator and for CI — a malformed
 * artifact must not ship. It is the wrong behaviour at module load in the client: the seed used to be
 * hand-written with a single entry, but from 014 on it is ROBOT-GENERATED, and one duplicate
 * determinant set or one orphan `parentId` would mean a white screen at boot, online and offline, for
 * every user, until a new bundle ships.
 *
 * The asymmetry gave the defect away: the served and persisted paths already swallow their errors and
 * fall back to the seed. The seed had nothing to fall back to.
 *
 * Rigour is not reduced — an invalid marketplace is DROPPED, so its slots resolve to null and seal
 * "sem referência". It never becomes a price. What changes is that a defect detectable two layers
 * earlier stops reaching the seller as a blank app.
 */
export function parseSeedResilient(data: unknown): FeeCatalog {
  try {
    return feeCatalogSchema.parse(data);
  } catch {
    // Keep the marketplaces that stand on their own; drop the ones that do not.
    const doc = data as { marketplaces?: unknown[] } | null;
    const kept = Array.isArray(doc?.marketplaces)
      ? doc.marketplaces.filter((m) => marketplaceCatalogSchema.safeParse(m).success)
      : [];
    const dropped = (Array.isArray(doc?.marketplaces) ? doc.marketplaces.length : 0) - kept.length;
    // Loud, but not fatal: this MUST be visible to whoever shipped the bundle.
    console.error(
      `[fee-catalog] bundled seed failed validation; dropped ${dropped} marketplace(s). Affected channels will read "sem referência".`,
    );
    const salvaged = feeCatalogSchema.safeParse({ ...doc, marketplaces: kept });
    if (salvaged.success) return salvaged.data;
    return {
      catalogVersion: "invalid-seed",
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date(0).toISOString(),
      marketplaces: [],
    };
  }
}

/** Exact determinant equality — same keys, same values. NOT the old subset match (see below). */
function sameDeterminants(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * Resolve the fee entry for a `(marketplace, feeDeterminants)`. The price-keyed band/floor fixed-point
 * stays in pricing-core.
 *
 * 014 replaced two defects here:
 *
 * 1. **Subset matching that won by array order.** An entry `{listingType}` and an entry
 *    `{listingType, category}` BOTH matched a slot supplying both, and `.find()` returned whichever
 *    came first in the file — a commission decided by JSON ordering (SC-801 violated). Matching is now
 *    EXACT per level, and specificity is expressed by WALKING THE ANCESTOR CHAIN: the nearest ancestor
 *    with an entry wins. That ordering is structural — the chain is unique and most-specific-first —
 *    so there is no sorting, no tie-break, and no dependence on entry order. (Ties cannot even be
 *    represented: the schema rejects duplicate determinant sets.)
 *
 * 2. **`?? mk.entries[0]`** — a slot with no determinants (modality empty, which is exactly what
 *    scenarios and kits saved before 014 carry) received the FIRST entry in the array: an arbitrary
 *    category's commission, under a "referência" seal. Removed, not adjusted (FR-027): without
 *    determinants and without an explicit null-keyed entry the honest answer is "sem referência".
 *
 * Returns null when nothing matches → manual entry + a "sem referência" seal, never a fabricated
 * pre-fill (Constitution II).
 */
export function resolveEntry(
  catalog: FeeCatalog,
  marketplace: Marketplace,
  feeDeterminants: Record<string, string> | null,
): FeeEntry | null {
  const mk = catalog.marketplaces.find((m) => m.marketplace === marketplace);
  if (!mk || mk.entries.length === 0) return null;

  if (!feeDeterminants) {
    return mk.entries.find((e) => e.determinants === null) ?? null;
  }

  const exact = (want: Record<string, string>): FeeEntry | null =>
    mk.entries.find((e) => e.determinants !== null && sameDeterminants(e.determinants, want)) ??
    null;

  const { category, ...rest } = feeDeterminants;

  if (category !== undefined) {
    const index = indexSpine(mk.categorySpine ?? []);
    // Most-specific-first: the chosen category, then each ancestor. The spine is sparse by design
    // (~87.5% of ML nodes inherit their parent's rate), so most lookups legitimately miss on the way up.
    for (const node of ancestorChain(index, category)) {
      const hit = exact({ ...rest, category: node });
      if (hit) return hit;
    }
  }

  // The marketplace's own published catch-all, if it publishes one. Reached only after the whole
  // category chain misses — never before it, which is the point.
  return exact(rest);
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
