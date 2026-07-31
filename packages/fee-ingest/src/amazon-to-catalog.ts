import { CATCH_ALL_NAME, type ParsedCategory } from "./amazon-parse";

// ParsedCategory[] → the catalog's shape (014/US3). Pure: no network, no clock — the caller injects
// the collection date so the output is byte-reproducible for the monthly diff.

export const AMAZON_SOURCE_URL =
  "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920";

/** Amazon publishes NAMES, not ids (unlike ML). The id is a stable slug of the published name, so
 *  the identity survives a re-run; Q12 keeps the marketplace's own vocabulary verbatim in `name`. */
export function categoryId(name: string): string {
  return name
    .normalize("NFD")
    .replace(
      new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"),
      "",
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Amazon's fee table is FLAT — it publishes no hierarchy, so every node is a root. Inventing a tree
 *  here would be inventing a taxonomy (Q12 says no), and the ancestor walk degrades to exact match. */
export function amazonSpine(categories: readonly ParsedCategory[]) {
  return categories.map((c) => ({ id: categoryId(c.name), name: c.name, parentId: null }));
}

/**
 * The two limitations this map ships WITH, declared in every entry rather than hidden (FR-014):
 *
 * 1. Amazon charges its commission on a base that INCLUDES shipping; our engine charges on the
 *    announce price. So the number here understates the real fee for a shipped item. Declared, not
 *    modelled — modelling it is a `pricing-core` change and explicitly out of scope (Q9).
 * 2. The referral table does NOT vary by plan (measured 2026-07-28: zero mentions of plan across all
 *    38 rows), so both plans carry the same commission. The Individual plan's separate PER-ITEM
 *    charge is not published on this page — so it is NOT included, and saying so is the only honest
 *    option. Inventing a number for it would violate Constitution II.
 */
export const AMAZON_FEE_BASE_CAVEAT = "comissão sobre base que inclui frete";

/**
 * The FULL caveat, for the detail surface — NOT for the seal.
 *
 * The seal is a Badge: a 250-character sentence inline in it is unreadable, and unreadable is not
 * honest just because the words are present. So the per-entry `source` carries the SHORT form (which
 * still names the category and declares the fee-base limitation, FR-014/SC-803) and the full text
 * belongs on the "de onde vem este número" detail sheet — a surface `designer-ux` specified and that
 * this increment has not built yet. Recorded as a gap, not shipped as a wall of text.
 */
export const AMAZON_CAVEATS_FULL =
  "A Amazon cobra a comissão sobre uma base que inclui o frete; este app calcula sobre o preço anunciado, então a taxa real pode ser maior. A tabela não varia por plano; a cobrança por item do plano Individual não é publicada nesta fonte e não está incluída.";

export interface BuildOptions {
  /** ISO date the source was read. Injected so the output is reproducible. */
  collectedAt: string;
  /** ISO date the source itself declares as effective, when it publishes one. */
  effectiveDate: string;
  /**
   * 014/T101 — o `effectiveDate` que cada entrada JA tinha, por determinantes.
   *
   * Sem isto, a regeracao carimbava a data da EXECUCAO em toda entrada, e o campo passava a
   * responder "quando o robo passou" em vez de "desde quando a tarifa vale". Como `effectiveDate`
   * nao e inerte no comparador — e nao deve ser, uma mudanca real de vigencia e noticia de
   * dinheiro — duas execucoes sobre a mesma tabela marcavam TODAS as entradas como alteradas e
   * `mayAutoMerge` nunca dispensava nada: o laco mensal nascia incapaz de dizer "nada mudou".
   *
   * Ausente = primeira montagem (ou chamador que nao tem historico): toda entrada recebe
   * `effectiveDate`, que e o comportamento anterior e continua correto para uma entrada nova.
   */
  previousEffectiveDates?: ReadonlyMap<string, string>;
}

/** Identidade de uma entrada Amazon: o par de determinantes que a resolve. */
function entryKey(plan: string, category: string | null): string {
  return `${plan}|${category ?? ""}`;
}

/**
 * O mapa de `effectiveDate` por entrada, lido do artefato ANTERIOR — a memoria que a regeracao
 * precisa para nao reescrever uma vigencia que a fonte nunca mudou (T101).
 */
export function effectiveDatesOf(
  entries: readonly {
    determinants: { plan: string; category?: string };
    effectiveDate: string;
  }[],
): ReadonlyMap<string, string> {
  return new Map(
    entries.map((e) => [
      entryKey(e.determinants.plan, e.determinants.category ?? null),
      e.effectiveDate,
    ]),
  );
}

const PLANS = ["PROFISSIONAL", "INDIVIDUAL"] as const;

/**
 * One entry per (plan, category). The commission is plan-independent (see caveat 2), but the
 * catalog is keyed by the determinants the slot supplies — `{plan, category}` — so both plans get a
 * row. Duplicating the number is deliberate: the alternative is a determinant-set the resolver would
 * have to special-case, and special cases in a money lookup are where silent errors live.
 */
export function amazonEntries(categories: readonly ParsedCategory[], opts: BuildOptions) {
  /** One entry. `category: null` makes it the modality-only entry — see below. */
  const entry = (plan: (typeof PLANS)[number], c: ParsedCategory, category: string | null) => ({
    determinants: category === null ? { plan } : { plan, category },
    commissionPct: c.commissionPct,
    fixedFee: 0,
    minPerItem: c.minPerItem,
    priceBands: c.bands
      ? c.bands.map((b) => ({
          minPrice: b.minPrice,
          maxPrice: b.maxPrice,
          commissionPct: b.commissionPct,
          // The per-item minimum applies per product regardless of band.
          fixedFee: 0,
        }))
      : null,
    // ADR-0024 / FR-014b. EVERY banded cell this source publishes is charged per PORTION, not by
    // selecting one rate for the whole price: "15% até R$ 200,00 e 10% para o EXCEDENTE acima de
    // R$ 200,00" (venda.amazon.com.br/precos). Emitting the bands WITHOUT this discriminator is what
    // made the app under-charge the commission above the threshold — R$ 10,00 constant on
    // Móveis/Colchões and R$ 5,00 on Acessórios Eletrônicos — all under a "Referência" seal.
    ...(c.bands ? { bandMode: "PROGRESSIVE" as const } : {}),
    freight: { kind: "NONE" as const },
    source: `Tabela de comissões da Amazon — ${c.name} (${AMAZON_FEE_BASE_CAVEAT})`,
    sourceUrl: AMAZON_SOURCE_URL,
    // T101: a fonte manda; na ausencia de declaracao, o que a entrada JA tinha; so uma entrada
    // nova estreia com a data desta coleta.
    effectiveDate: opts.previousEffectiveDates?.get(entryKey(plan, category)) ?? opts.effectiveDate,
    lastReviewed: opts.collectedAt,
  });

  const perCategory = PLANS.flatMap((plan) =>
    categories.map((c) => entry(plan, c, categoryId(c.name))),
  );

  // 014/Q5 · T094 — the MODALITY-ONLY entry: what a slot resolves to when the seller has not chosen a
  // category. It is a straight COPY of the published "Outros" row, never an average, a range midpoint
  // or an extreme of the table (FR-011a) — using it quotes Amazon instead of guessing, which is the
  // only reason Q5 allows a pre-fill here at all. `resolveSlot` reports it as `viaCatchAll` so the
  // seal says "categoria não informada" rather than passing it off as the seller's own rate.
  //
  // Conditional on the row EXISTING: if a future reading no longer publishes "Outros", the honest
  // outcome is no catch-all and a "sem referência" seal — never a substitute picked by us. That is
  // also what keeps Mercado Livre correctly without one: it publishes a range, and a range is not a
  // catch-all. The asymmetry falls out of the data, not out of an `if` about marketplaces.
  const published = categories.find((c) => c.name === CATCH_ALL_NAME);
  const modalityOnly = published ? PLANS.map((plan) => entry(plan, published, null)) : [];

  return [...perCategory, ...modalityOnly];
}
