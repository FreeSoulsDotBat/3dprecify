import { CATCH_ALL_NAME, type ParsedCategory } from "./amazon-parse.ts";

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
            new RegExp(
                "[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]",
                "g",
            ),
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
 * ⚠ @doc DEC-058 — as duas limitações são DECLARADAS em cada entrada (FR-014), não escondidas:
 *   a base da comissão da Amazon inclui o frete (o número subestima), e a tabela de referral
 *   não varia por plano. Modelar a primeira é mudança no `pricing-core`, fora de escopo.
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
    "A Amazon cobra a comissão sobre uma base que inclui o frete; este app calcula sobre o preço anunciado, então a taxa real pode ser maior. A tabela de comissões não varia por plano. A cobrança de R$ 2,00 por item do plano Individual não é publicada nesta fonte: ela vem da página de preços e planos da Amazon, declarada em cada entrada do plano Individual.";

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
 * 016/US14 (FR-921) — a cobrança POR ITEM do plano Individual, R$ 2,00.
 *
 * Ela NÃO sai da tabela de comissões: a G200336920 não a publica (é a limitação 2 do caveat acima,
 * que esta fatia deixa de apenas declarar e passa a corrigir). Sai de `venda.amazon.com.br/precos`,
 * e por isso viaja com procedência PRÓPRIA (`fixedFeeSource`) — apontar o vendedor para uma página
 * que não contém o número que ele está vendo é uma procedência que não procede.
 *
 * O plano Profissional fica FORA de propósito: os R$ 19/mês são custo MENSAL do vendedor, não custo
 * por item, e somá-los aqui os cobraria uma vez por unidade vendida.
 */
export const AMAZON_INDIVIDUAL_PER_ITEM_FEE = 2.0;

// 016/PR-F homologação (A4) — a string NÃO repete a vigência: `effectiveDate` abaixo já a carrega
// estruturada, e `FixedFeeSourceBadge` (calculator/fee-seal.tsx) já a imprime como "vigente desde
// dd/mm/aaaa" — um parêntese aqui virava "vigente desde X · vigente desde X" no selo, a mesma data
// dita duas vezes. A medição (vigente desde pelo menos dez/2020) continua verdadeira; só não repete
// na string livre o que o campo estruturado já diz.
export const AMAZON_INDIVIDUAL_FEE_SOURCE = {
    source: "Amazon — Preços e planos de venda: tarifa por item do plano Individual",
    sourceUrl: "https://venda.amazon.com.br/precos",
    effectiveDate: "2020-12-01",
} as const;

/**
 * One entry per (plan, category). The commission is plan-independent (see caveat 2), but the
 * catalog is keyed by the determinants the slot supplies — `{plan, category}` — so both plans get a
 * row. Duplicating the number is deliberate: the alternative is a determinant-set the resolver would
 * have to special-case, and special cases in a money lookup are where silent errors live.
 */
export function amazonEntries(categories: readonly ParsedCategory[], opts: BuildOptions) {
    /** One entry. `category: null` makes it the modality-only entry — see below. */
    const entry = (plan: (typeof PLANS)[number], c: ParsedCategory, category: string | null) => {
        // 016/US14 (FR-921) — o fixo é do PLANO, nunca da categoria. Profissional continua em 0: os
        // R$ 19/mês dele são custo MENSAL do vendedor e somá-los aqui os cobraria por unidade vendida.
        const perItem = plan === "INDIVIDUAL" ? AMAZON_INDIVIDUAL_PER_ITEM_FEE : 0;
        return {
            determinants: category === null ? { plan } : { plan, category },
            commissionPct: c.commissionPct,
            fixedFee: perItem,
            minPerItem: c.minPerItem,
            priceBands: c.bands
                ? c.bands.map((b) => ({
                      minPrice: b.minPrice,
                      maxPrice: b.maxPrice,
                      commissionPct: b.commissionPct,
                      // O MESMO valor DENTRO da banda, e não é redundância: sobre uma entrada bandada o
                      // `fixedFee` do topo é INERTE (regra 013/F1) — o motor cobra o fixo da banda que
                      // CONTÉM o anúncio. Deixar 0 aqui faria os R$ 2,00 sumirem em silêncio exatamente nas
                      // categorias com faixa, que são as menos conferidas. Cobrado UMA vez: o regime
                      // progressivo lê o fixo da banda que contém o anúncio, não a soma das bandas.
                      fixedFee: perItem,
                  }))
                : null,
            // ADR-0024 / FR-014b. EVERY banded cell this source publishes is charged per PORTION, not by
            // selecting one rate for the whole price: "15% até R$ 200,00 e 10% para o EXCEDENTE acima de
            // R$ 200,00" (venda.amazon.com.br/precos). Emitting the bands WITHOUT this discriminator is
            // what made the app under-charge the commission above the threshold — R$ 10,00 constant on
            // Móveis/Colchões and R$ 5,00 on Acessórios Eletrônicos — all under a "Referência" seal.
            ...(c.bands ? { bandMode: "PROGRESSIVE" as const } : {}),
            // A procedência PRÓPRIA do fixo, só onde existe fixo (016/US14). A entrada do Profissional
            // não a carrega: apontar uma fonte para um R$ 0,00 seria citar uma página para dizer nada.
            ...(perItem > 0 ? { fixedFeeSource: AMAZON_INDIVIDUAL_FEE_SOURCE } : {}),
            freight: { kind: "NONE" as const },
            source: `Tabela de comissões da Amazon — ${c.name} (${AMAZON_FEE_BASE_CAVEAT})`,
            sourceUrl: AMAZON_SOURCE_URL,
            // T101: a fonte manda; na ausencia de declaracao, o que a entrada JA tinha; so uma entrada
            // nova estreia com a data desta coleta.
            effectiveDate:
                opts.previousEffectiveDates?.get(entryKey(plan, category)) ?? opts.effectiveDate,
            lastReviewed: opts.collectedAt,
        };
    };

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
