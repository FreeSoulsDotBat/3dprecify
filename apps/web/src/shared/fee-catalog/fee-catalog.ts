import { bandContaining } from "@3dprecify/pricing-core";
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

/**
 * Como a taxa FIXA de uma banda se forma (016/PR-F, ADR-0027 §3.1, pricing-core 4.1.0).
 *
 * ADITIVO, e a AUSÊNCIA significa a constante `fixedFee` — o significado que todo catálogo já
 * persistido tem hoje, e que todo `priceBands` gravado dentro de um congelado (ADR-0019) ou de um
 * cenário (ADR-0021) já carrega. Mesma disciplina do `bandMode` (ADR-0024).
 *
 * `nullish` e não `optional`: o backend serializa ausente como `null` explícito, e um schema que só
 * tolera `undefined` RECUSARIA o payload servido — recusa que aqui é SILENCIOSA (o app cai no seed
 * embutido e ninguém vê erro). A mesma armadilha que o `bandMode` documenta logo abaixo.
 */
const fixedFeeRuleSchema = z.object({
    kind: z.literal("PCT_OF_PRICE"),
    /** % do ANÚNCIO, em (0, 100) aberto nas duas pontas. */
    pct: z.number().gt(0).lt(100),
});

/** Half-open price band `[minPrice, maxPrice)` (`maxPrice: null` = ∞) — lower-inclusive tie-rule. */
const priceBandSchema = z
    .object({
        minPrice: z.number().nonnegative(),
        maxPrice: z.number().positive().nullable(),
        commissionPct: z.number().min(0).lt(100).nullable(),
        fixedFee: z.number().nonnegative().nullable(),
        fixedFeeRule: fixedFeeRuleSchema.nullish(),
    })
    // O denominador do gross-up fechado é `1 − c/100 − pct/100`. Zerado ele devolve `Infinity`;
    // invertido, um preço NEGATIVO — os dois com cara de resposta, os dois sob selo de referência.
    // A recusa mora no schema E no motor (`validateBandRules`) porque as duas portas são reais: esta
    // impede o dado de existir, aquela impede um consumidor de tropeçar num payload antigo.
    .refine(
        (b) => b.fixedFeeRule == null || (b.commissionPct ?? 0) + b.fixedFeeRule.pct < 100,
        "commissionPct + fixedFeeRule.pct must be < 100 (o gross-up não teria solução) — ADR-0027",
    );

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
        /**
         * **DEPRECATED em 2026-08-07 (hotfix 016/A2) — sem emissores, NUNCA removido.**
         *
         * Era: "Shopee — o teto de cupom co-financiado pelo vendedor, por faixa de preço". A releitura
         * VERBATIM das fontes (art. 26839 + art. 23431) diz o contrário do que esta forma assume: *"A
         * Shopee **oferece** subsídios de frete para todos os vendedores"* e *"Cupons de frete grátis
         * **válidos para fretes de até** R$20"* — o R$ 20/30/40 é o valor que a SHOPEE oferece e é um
         * TETO DE VALIDADE do cupom, não uma cobrança do vendedor. O catálogo deixou de emitir esta
         * forma (as duas entradas Shopee passaram a `{kind: "NONE"}`); o subsídio virou informação
         * NÃO-COMPUTANTE em `freightSubsidyInfo`.
         *
         * **Por que o schema continua sabendo lê-la, e por que removê-la seria errado:** este `kind`
         * viaja DENTRO de payload de snapshot congelado (ADR-0019, imutável por trigger de banco) e de
         * documento de cenário (ADR-0021). Um schema que passasse a recusá-la faria um documento que o
         * produto promete imutável parar de abrir — ou, pior, abrir afirmando outro número sem uma
         * linha dele mudar. Mesma disciplina do `bandMode` (ADR-0024) e do `fixedFeeRule` (ADR-0027).
         * O motor (`pricing-core`) também mantém a capacidade INTACTA, e por isso `PRICING_MODEL_VERSION`
         * não foi bumpado: nada do que já foi gravado muda de valor.
         *
         * Reabre-se com o verbatim que falta (o artigo de coparticipação linkado no 26839 e o art. 7749)
         * — e aí a decisão é do dono, não uma inferência sobre dinheiro (Princípio VIII).
         */
        kind: z.literal("BAND_VOUCHER"),
        bands: z.array(
            z.object({
                minPrice: z.number().nonnegative(),
                maxPrice: z.number().positive().nullable(),
                /** DEPRECATED — ver o `kind` acima. Honrado para payloads já gravados, nunca mais emitido. */
                voucherCeiling: z.number().nonnegative(),
            }),
        ),
    }),
]);

/**
 * O subsídio de frete da Shopee como **INFORMAÇÃO**, nunca como parcela da conta
 * (hotfix 016/A2, 2026-08-07).
 *
 * Mora no nível do MARKETPLACE — precedente exato de `optionalSurcharges`: não é tarifa por perfil
 * nem por faixa de tarifa; é uma política que vale para todos os vendedores ("*Todos os vendedores
 * têm os benefícios do Programa de Frete Grátis*", art. 23431 e 26839, duas vezes literais — não há
 * adesão a modelar).
 *
 * **NÃO-COMPUTANTE, e isso é a decisão inteira.** Nenhum consumidor multiplica, soma ou desconta
 * nada daqui: `entryToChannelFees` não o lê. Ele existe para o vendedor SABER que a Shopee subsidia
 * — a informação é boa notícia e apagá-la em silêncio perderia o que ele usa para decidir — sem que
 * um teto de validade de cupom volte a virar aritmética.
 *
 * **Por que um campo novo e NÃO um `kind: "SUBSIDY_INFO"` no union `freight`:** `freightSchema` é
 * um `z.discriminatedUnion`. Um `kind` novo no artefato SERVIDO faria o cliente PWA já instalado
 * RECUSAR o catálogo inteiro — e a recusa aqui é SILENCIOSA (cai no seed embutido e ninguém vê
 * erro; `parseSeedResilient` e os comentários de `bandMode`/`fixedFeeRule` documentam a armadilha).
 * Uma propriedade extra num `z.object` não-strict é simplesmente DESCARTADA pelo cliente antigo,
 * que então lê exatamente `freight: {kind: "NONE"}` — a verdade nova. Compatibilidade por
 * construção, não por sorte.
 *
 * `nullish` e não `optional` pela mesma razão de sempre: o backend serializa ausente como `null`.
 */
const freightSubsidyInfoSchema = z.object({
    /** Faixas `[minPrice, maxPrice)` do ANÚNCIO; `ceiling` = até quanto o cupom da Shopee vale. */
    bands: z.array(
        z.object({
            minPrice: z.number().nonnegative(),
            maxPrice: z.number().positive().nullable(),
            ceiling: z.number().nonnegative(),
        }),
    ),
    source: z.string().min(1),
    sourceUrl: z.url(),
    effectiveDate: z.string().min(1),
    lastReviewed: z.string().min(1),
});
export type FreightSubsidyInfo = z.infer<typeof freightSubsidyInfoSchema>;

/** One resolved fee entry, keyed by its marketplace-specific `determinants` (null = single entry). */
export const feeEntrySchema = z
    .object({
        determinants: z.record(z.string(), z.string()).nullable(),
        commissionPct: z.number().min(0).lt(100).nullable(),
        fixedFee: z.number().nonnegative().nullable(),
        /**
         * 016/PR-F (US14) — procedência PRÓPRIA do `fixedFee`, quando ele não vem da mesma página que a
         * comissão. ADITIVO; ausente = o `source`/`sourceUrl`/`effectiveDate` da entrada respondem
         * pelos dois números, que é o caso de toda entrada de antes desta fatia.
         *
         * Existe porque a Amazon publica as duas coisas em páginas DIFERENTES: a comissão sai da
         * G200336920 (Seller Central) e a cobrança por item do plano Individual sai de
         * venda.amazon.com.br/precos. Um `sourceUrl` só apontaria o vendedor para uma página que não
         * contém o número que ele está vendo — uma procedência que não procede é pior que nenhuma.
         *
         * Sem `lastReviewed` próprio de propósito: a releitura mensal abre as duas páginas na MESMA
         * passada, então a data de conferência da entrada responde pelas duas folhas. Um segundo
         * relógio aqui envelheceria sozinho e o selo de obsolescência (`isStale`) não o leria.
         */
        fixedFeeSource: z
            .object({
                source: z.string().min(1),
                sourceUrl: z.url(),
                effectiveDate: z.string().min(1),
            })
            .nullish(),
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
    //
    // 016/PR-F: `fixedFeeRule` já existe (ADR-0027) e ainda assim NÃO abre exceção aqui. A regra é o
    // que o motor cobra; a constante continua sendo obrigatória porque ela é o que a banda vale
    // quando a regra sai — e uma banda com os dois lados vazios é uma banda sem número nenhum sob um
    // selo que diz "Referência". A dispensa que a §9.4 sugere é decisão de PR-G, não uma folga que
    // esta fatia toma sozinha.
    .refine((e) => e.priceBands == null || e.priceBands.every((b) => b.fixedFee !== null), {
        message:
            "every price band must carry its own fixedFee — a null band fixedFee prices R$ 0,00 under a reference seal (FR-928)",
        path: ["priceBands"],
    })
    // 016/PR-F (ADR-0027 §3.1) — `fixedFeeRule` só tem significado em `bandMode: "SELECTION"`
    // (ausente = SELECTION). Numa entrada PROGRESSIVE a tarifa é cobrada por FATIA do preço, e
    // "metade do preço" não é uma fatia: carregar a regra ali é erro de FORMA, não um caso a
    // interpretar. Recusado aqui e no motor pelo mesmo motivo dos refines acima — o dado não deve
    // existir, e um payload antigo que o tenha não deve virar preço.
    .refine(
        (e) =>
            e.bandMode !== "PROGRESSIVE" ||
            e.priceBands == null ||
            e.priceBands.every((b) => b.fixedFeeRule == null),
        {
            message:
                "fixedFeeRule only means something in bandMode SELECTION — a progressive band charges per slice (ADR-0027)",
            path: ["priceBands"],
        },
    )
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

/**
 * Um custo OPCIONAL que o vendedor declara, publicado pelo marketplace (016/US16, FR-923,
 * ADR-0027 §3.2) — Shopee: manuseio de item volumoso, R$ 50,00 por PEDIDO (art. 3305).
 *
 * Mora no nível do MARKETPLACE e não na entrada: não é tarifa por perfil nem por faixa de preço —
 * vale para quem despachar um item volumoso, qualquer que seja a tabela que o resolve.
 *
 * O `value` vem daqui e NUNCA do código (Constituição II), e o `label` idem: a próxima sobretaxa
 * publicada é DADO, não uma tela nova. `appliesPer` dirige a LEGENDA (clarify Q5) e não a
 * aritmética — o motor soma o valor uma vez, e é a legenda que diz ao vendedor se aquilo se repete
 * por item num pedido de vários.
 */
const optionalSurchargeSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.number().nonnegative(),
    appliesPer: z.enum(["ORDER", "ITEM"]),
    source: z.string().min(1),
    sourceUrl: z.url(),
    effectiveDate: z.string().min(1),
    lastReviewed: z.string().min(1),
});
export type OptionalSurcharge = z.infer<typeof optionalSurchargeSchema>;

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
        // 016/US16 (FR-923, ADR-0027 §3.2) — ADITIVO. Ausente/null = nenhuma sobretaxa opcional, que é
        // o que todo catálogo de antes desta fatia significa, e o resultado continua byte-idêntico.
        optionalSurcharges: z.array(optionalSurchargeSchema).nullish(),
        // hotfix 016/A2 (2026-08-07) — ADITIVO e NÃO-COMPUTANTE. Ausente/null = nenhum subsídio a
        // informar, que é o que todo catálogo de antes deste hotfix significa, e o resultado computado
        // continua byte-idêntico (é a propriedade que `fee-catalog.test.ts` prova). Ver
        // `freightSubsidyInfoSchema` para por que ele é um campo novo e não um `kind` do union `freight`.
        freightSubsidyInfo: freightSubsidyInfoSchema.nullish(),
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

        // 016/US16 — o mesmo argumento da guarda acima, na outra lista. O `id` é o que o cenário
        // persiste (`ScenarioChannelIntent.surcharges: string[]`, ADR-0021) e o que o checkbox liga:
        // dois `id` iguais fariam o VALOR resolvido depender da ordem do arquivo. Um empate num número
        // de dinheiro não pode sobreviver ao parse.
        const ids = new Set<string>();
        for (const s of mk.optionalSurcharges ?? []) {
            if (ids.has(s.id)) {
                ctx.addIssue({
                    code: "custom",
                    message: `duplicate optionalSurcharge id in ${mk.marketplace}: ${s.id} — the resolved value would depend on array order`,
                    path: ["optionalSurcharges"],
                });
                return;
            }
            ids.add(s.id);
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
        const dropped =
            (Array.isArray(doc?.marketplaces) ? doc.marketplaces.length : 0) - kept.length;
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

/**
 * Resolve o teto do cupom de frete da Shopee para o ANÚNCIO desta faixa — leitura pura, informativa
 * (hotfix 016/A2, H2c). A seleção half-open, lower-inclusive é a `bandContaining` DO MOTOR
 * (genérica sobre `{minPrice, maxPrice}`, exportada na Onda 4 do chore de legibilidade) — o motor
 * continua sem saber de `freightSubsidyInfo` (campo não-computante, fora de `ChannelFees`); só o
 * idioma de seleção de faixa tem uma casa única.
 *
 * `null` quando o anúncio não cai em nenhuma faixa publicada (ex.: um preço negativo, impossível na
 * prática) ou quando o marketplace não publica `freightSubsidyInfo` — em ambos os casos a legenda
 * simplesmente não renderiza, nunca inventa um teto.
 */
export function resolveFreightSubsidyCeiling(
    info: FreightSubsidyInfo | null | undefined,
    anuncio: number,
): number | null {
    if (!info) return null;
    return bandContaining(info.bands, anuncio)?.ceiling ?? null;
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;
export function isStale(entry: FeeEntry, now: number): boolean {
    const reviewed = Date.parse(entry.lastReviewed);
    if (Number.isNaN(reviewed)) return false;
    const ageDays = (now - reviewed) / MS_PER_DAY;
    return ageDays > STALENESS_DAYS;
}
