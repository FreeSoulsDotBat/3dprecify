import {
    bandFixedFee,
    type BandMode,
    type ChannelFees,
    type ChannelSurcharge,
    grossUp,
    type PriceBand,
    toMoney,
    type VoucherBand,
} from "@3dprecify/pricing-core";

import {
    type CatalogSource,
    type CategoryNode,
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

/**
 * 016/PR-F (US17, FR-926, T057) — maps the TWO Shopee questions ("Você vende como" + "mais de 450
 * pedidos?") onto the ONE determinant the catalog publishes. Verbatim art. 26839 (T057, dod-evidence
 * §PR-F): a CPF seller who does NOT clear 450 orders/90 days pays the EXACT SAME table as CNPJ ("a
 * taxa adicional de R$3 … não será aplicada, ficando vigente apenas a taxa por item vendido") — so
 * every other combination (CNPJ of any volume; CPF not-high-volume; either question unanswered)
 * resolves to the catch-all, byte-identical to a slot that never answered at all (FR-926 last clause).
 */
export function resolveShopeeSellerProfile(
    sellerType: string | undefined,
    highVolume: string | undefined,
): string | null {
    return sellerType === "CPF" && highVolume === "SIM" ? "CPF_ALTO_VOLUME" : null;
}

/** The determinants a slot contributes to the catalog lookup. Modality maps to the marketplace's
 *  determinant key (ML → listingType, Amazon → plan); Shopee contributes its seller-profile axis
 *  (RA5 — resolved by `resolveShopeeSellerProfile`, the SAME mapping `channelFieldPlan` gates the
 *  render on) when it resolves to something; Outro contributes none (null).
 *
 *  US2 added the `category` axis. Until 014 this function sent ONLY the modality, so a
 *  category-keyed entry could never resolve — the map would exist and nothing would reach it. An
 *  absent or empty category is OMITTED rather than sent as "", because the resolver matches
 *  determinant sets exactly and `category: ""` would match nothing at all. */
export function slotDeterminants(
    marketplace: MarketplaceId,
    modality: string,
    category?: string,
    sellerProfile?: string | null,
): Record<string, string> | null {
    // Shopee has no modality axis — gating on `!modality` below (every other marketplace) would always
    // return null for it, which is exactly what the seller-profile-less slot of today means (FR-926
    // last clause: unanswered = catch-all = byte-identical).
    if (marketplace === "SHOPEE") {
        return sellerProfile ? { sellerProfile } : null;
    }
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
    /** 016/PR-F (US17, FR-926) — the Shopee seller-profile answers (RA5: mapped by the SAME
     *  `resolveShopeeSellerProfile` `slotDeterminants` uses, so render and lookup never drift). */
    sellerType?: string,
    highVolume?: string,
): SlotResolution {
    const mk = toCatalogMarketplace(marketplace);
    if (!mk) return { entry: null, originCategoryId: null, viaCatchAll: false };

    const sellerProfile = resolveShopeeSellerProfile(sellerType, highVolume);
    const entry = resolveEntry(
        catalog,
        mk,
        slotDeterminants(marketplace, modality, category, sellerProfile),
    );
    if (!entry) return { entry: null, originCategoryId: null, viaCatchAll: false };

    // The entry itself says which category it belongs to — an ancestor's id when the chosen category
    // inherited.
    const originCategoryId = entry.determinants?.category ?? null;

    // "Catch-all" only means something where a category COULD have been chosen. Shopee has a single
    // null-keyed entry and NO category axis at all: flagging that as "categoria não informada" would
    // invent a choice the seller was never offered. The axis exists iff the marketplace ships a spine.
    const hasCategoryAxis =
        (catalog.marketplaces.find((m) => m.marketplace === mk)?.categorySpine?.length ?? 0) > 0;

    return {
        entry,
        originCategoryId,
        // The question is NOT "did the seller pick a category?" — it is "does the entry we are about to
        // quote carry one?". Those differ whenever a chosen category fails to resolve (an id from a saved
        // scenario, from a catalog that dropped the node, or left over from a marketplace switch): the
        // ancestor walk misses, the lookup falls through to the modality-only entry, and asking the first
        // question would have sealed Amazon's catch-all as "Referência" for a category it is not about.
        viaCatchAll: hasCategoryAxis && originCategoryId === null,
    };
}

/** Resolve a slot's catalog entry (null when uncovered → manual + "sem referência"). */
export function resolveSlotEntry(
    catalog: FeeCatalog,
    marketplace: MarketplaceId,
    modality: string,
    category?: string,
    sellerType?: string,
    highVolume?: string,
): FeeEntry | null {
    return resolveSlot(catalog, marketplace, modality, category, sellerType, highVolume).entry;
}

/**
 * 016/PR-F (US16, FR-923, ADR-0027 §3.2) — resolve the seller-checked surcharge IDS against the
 * marketplace's published `optionalSurcharges`, mapping into the engine's `{label, value}` shape.
 * An id the catalog no longer publishes (a curation change, or a stale saved scenario) is DROPPED,
 * never invented — the checkbox itself degrades the same way any other catalog-driven control does
 * (`channelFieldPlan.surcharges` simply stops offering it). Empty/absent ids → empty list, which is
 * byte-identical to every calculation before this axis existed (US16-AC2).
 */
export function resolveSurcharges(
    catalog: FeeCatalog,
    marketplace: MarketplaceId,
    ids: readonly string[] | undefined,
): ChannelSurcharge[] {
    if (!ids || ids.length === 0) return [];
    const mk = toCatalogMarketplace(marketplace);
    if (!mk) return [];
    const published = catalog.marketplaces.find((m) => m.marketplace === mk)?.optionalSurcharges;
    if (!published || published.length === 0) return [];
    const byId = new Map(published.map((s) => [s.id, s]));
    const out: ChannelSurcharge[] = [];
    for (const id of ids) {
        const s = byId.get(id);
        if (s) out.push({ label: s.label, value: s.value });
    }
    return out;
}

/** A resolved entry mapped into the pure engine's channel fee inputs. `freightIsEstimate` marks the
 *  ML free-shipping subsidy so the UI can seal that specific value as an "estimativa" (A4);
 *  `freightVoucherBands` carries the Shopee co-funded voucher for the engine to resolve by announce. */
export interface ResolvedChannelFees {
    commissionPct: number;
    fixedFee: number;
    minPerItem: number;
    priceBands?: PriceBand[];
    /** How the bands combine (ADR-0024). Carried through UNCHANGED — the engine owns the meaning, and
     *  dropping it here would silently degrade a progressive entry back to selection, which is the very
     *  defect ADR-0024 exists to fix (its §5 names losing this field as the real risk, not the math). */
    bandMode?: BandMode;
    freightCost: number;
    freightVoucherBands?: VoucherBand[];
    freightIsEstimate: boolean;
}

/** 016/US12 (FR-928) — the invariant `entryToChannelFees` leans on: `feeEntrySchema`'s band refine
 *  already rejects a null band `fixedFee` before any catalog ships. Throwing here (rather than
 *  `?? 0`) turns a violated invariant into a loud failure instead of a silent R$ 0,00 under seal. */
function nonNullBandFixedFee(fixedFee: number | null): number {
    if (fixedFee === null) {
        throw new Error(
            "band fixedFee is null — feeEntrySchema should have refused this catalog (FR-928)",
        );
    }
    return fixedFee;
}

/**
 * Entrada resolvida do catálogo → tarifas de canal do motor (SC-111). Entrada com bandas leva
 * `priceBands` adiante; entrada simples leva comissão/fixo/`minPerItem`. Frete conforme o `kind`.
 *
 * ⚠ @doc DEC-039 — o ramo `BAND_VOUCHER` NÃO é código morto: catálogo persistido de antes do
 *   hotfix ainda o lê, e largar o mapeamento mudaria em silêncio o que ele computa.
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
                  // 016/US12 (FR-928) — NO `?? 0`. `feeEntrySchema`'s band refine already refuses to publish
                  // a band with a null `fixedFee` (the schema is the real guard: such a catalog never ships),
                  // so this is an invariant, not a live branch — and an invariant that silently defaulted to
                  // 0 is exactly the F3/014-A2 defect class this refuses instead. A catalog that somehow
                  // slipped past the schema throws LOUD here rather than pricing R$ 0,00 under a reference
                  // seal.
                  fixedFee: nonNullBandFixedFee(b.fixedFee),
                  // 016/PR-F (ADR-0027 §3.1) — carregada INTACTA, pelo mesmo motivo do `bandMode` logo
                  // abaixo, e ADR-0027 §5 nomeia ESTE como o risco real da mudança: não é errar a
                  // aritmética (linear, testada em três regimes), é um trajeto PERDER o campo e degradar
                  // em silêncio para a constante antiga. Aqui isso trocaria "metade do preço abaixo de
                  // R$ 8" pelo R$ 4,00 da faixa de cima — e o padrão justificaria o número errado.
                  ...(b.fixedFeeRule ? { fixedFeeRule: b.fixedFeeRule } : {}),
              }))
            : undefined,
        ...(entry.bandMode ? { bandMode: entry.bandMode } : {}),
        freightCost,
        freightVoucherBands,
        freightIsEstimate,
    };
}

/** What one price BAND is charging, resolved for a specific announce (016/PR-F homologação, A1). */
export interface AppliedBandFees {
    commissionPct: number;
    /** The R$ value to SHOW — a plain band `fixedFee`, or a `fixedFeeRule` already resolved for
     *  THIS announce (never the raw rule: a placeholder can only show a number). */
    fixedFee: number;
    /** The `fixedFeeRule.pct` `fixedFee` was resolved from, or `null` for a plain constant fee — the
     *  caller adds an honest "(= {pct}% do preço)" suffix so the number is never read as a flat
     *  constant that happens not to move. */
    fixedFeeRulePct: number | null;
}

/**
 * 016/PR-F homologação (A1) — the placeholder gap the 015/A8 mechanism left open: a BANDED entry's
 * flat `commissionPct`/`fixedFee` read `entry.commissionPct ?? 0` / `entry.fixedFee ?? 0` (they live
 * per-band, not at the entry's top level), so `processSlot` deliberately skips them (`bandada` guard,
 * `calculator-model.ts`) rather than publish a false "Comissão 0,00%" under a reference seal. That
 * left the field BLANK instead — honest, but silent about a real charge (Shopee: 20% + R$ 4,00, or
 * +R$ 3,00, or half the listing price below R$ 8).
 *
 * Once the engine has priced the level, `grossUp`'s own `appliedBand` [F11a-007-esque] already knows
 * which band answered — this looks that SAME band back up in `fees.priceBands` (byte-identical to
 * the entry the engine used) and reads its commission/fixed fee. No second price is computed here:
 * only which band the engine's own answer belongs to.
 */
export function appliedBandFees(fees: ChannelFees, base: number): AppliedBandFees | null {
    if (!fees.priceBands || fees.priceBands.length === 0) return null;
    const level = grossUp(base, fees);
    if (level.appliedBand === null || level.anuncio === null) return null;
    const [minPrice, maxPrice] = level.appliedBand;
    const band = fees.priceBands.find((b) => b.minPrice === minPrice && b.maxPrice === maxPrice);
    if (!band) return null;
    if (band.fixedFeeRule) {
        // A leitura do fixo é a DO MOTOR (`bandFixedFee`, casa única — ADR-0027 §3.1); aqui só se
        // quantiza para exibição, como a legenda imprime.
        const fixedFee = toMoney(bandFixedFee(band, level.anuncio));
        return {
            commissionPct: band.commissionPct,
            fixedFee,
            fixedFeeRulePct: band.fixedFeeRule.pct,
        };
    }
    return { commissionPct: band.commissionPct, fixedFee: band.fixedFee, fixedFeeRulePct: null };
}

/**
 * Derive a slot's honesty seal. `edited` wins — once the user changes a pre-filled value it reads
 * "ajustado por você". No entry → "sem referência". Otherwise a dated reference, marked "embutida"
 * when it came from the bundled seed (offline) and "desatualizada" past the STALENESS_DAYS window — the two
 * marks COMPOSE, and until T098 they did not: `embedded` short-circuited the staleness clause, so
 * the copy that ages most was the one that could never say it had aged (SC-807).
 */
export function feeSealState(args: {
    entry: FeeEntry | null;
    source: CatalogSource;
    now: number;
    edited: boolean;
    /** Name of the category the number is FOR — may be an ancestor of the chosen one (US2). */
    originCategoryName?: string | null;
    viaCatchAll?: boolean;
}): FeeSealState {
    const { entry, source, now, edited, originCategoryName, viaCatchAll } = args;
    if (edited) return { kind: "adjusted" };
    if (!entry) return { kind: "none" };
    const embedded = source === "seed";
    const dated = {
        source: entry.source,
        reviewedOn: entry.lastReviewed,
        embedded,
        stale: isStale(entry, now),
        // 019/PR-C (T052/T058, prancheta 13b·3) — a entrada SEMPRE carrega `sourceUrl`, mas a semente
        // (embutida, offline) deliberadamente não cita fonte nenhuma: "Ver fonte" alcançaria uma página
        // que ninguém buscou ao empacotar o app, não a que confirmou o número na tela.
        ...(embedded ? {} : { sourceUrl: entry.sourceUrl }),
    };
    // A catch-all is a DIFFERENT claim from "this is your category's rate", and collapsing the two is
    // how a seller ends up with the wrong number believing it is his. Amazon's "Outros" is the highest
    // band of the table, so the error is systematically upward — the seal has to say which it is.
    if (viaCatchAll) return { kind: "catchAll", ...dated };
    // The key is OMITTED rather than set to null when there is no category, so a slot on a
    // category-less marketplace keeps exactly the shape it had before 014.
    return { kind: "reference", ...dated, ...(originCategoryName ? { originCategoryName } : {}) };
}

/**
 * The category spine a slot's picker should offer. Empty when the marketplace has no category axis
 * (Shopee/Outro), or when the name index has not been fetched yet — the picker distinguishes those
 * two cases in its own copy, because "no categories exist here" and "not downloaded yet" are very
 * different things to tell a seller.
 */
export function spineForMarketplace(
    catalog: FeeCatalog,
    marketplace: MarketplaceId,
): readonly CategoryNode[] {
    const mk = toCatalogMarketplace(marketplace);
    if (!mk) return [];
    return catalog.marketplaces.find((m) => m.marketplace === mk)?.categorySpine ?? [];
}
