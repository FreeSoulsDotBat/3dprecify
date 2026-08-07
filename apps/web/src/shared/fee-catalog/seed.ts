import type { FeeCatalog } from "./fee-catalog";

// Bundled seed (ADR-0010 R1) — guarantees first-ever OFFLINE pre-fills before any fetch persists to
// the store. It MIRRORS the committed backend/app/data/catalog.json (the source of truth the backend
// serves); the truth-gate test asserts both parse under the same schemaVersion and carry provenance.
// US2 curation (T022): Shopee is curated (price-band based, category-independent — sourced from the
// official 2026 commission policy). ML + Amazon stay empty pending their category-specific rates
// (fabricating them would violate Constitution II; uncovered → manual + "sem referência").
// 016/US12 (T051, FR-918) — `feeAxes` curation (arquitetura-016 §F.2 rule 2): which of the 4
// numeric fee fields each marketplace's channel section shows. Bumps `catalogVersion` (content
// changed, I5) alongside the mirrored `backend/app/data/catalog.json`.
export const FEE_CATALOG_SEED: FeeCatalog = {
  // 016/PR-F (I5) — bumpa UMA vez pelo conjunto todo desta fatia (Shopee partida em R$ 8 + entrada
  // CPF_ALTO_VOLUME + volumoso + os R$ 2,00 do Individual da Amazon). Decidido por
  // `nextCatalogVersion` (`packages/fee-ingest/src/guardrails.ts`) e não à mão: regerar na mesma
  // data de coleta sob rótulo idêntico foi o defeito de 014 (77 → 79 entradas, `2026-07-28.0` dos
  // dois lados), e o rótulo viaja congelado dentro de um snapshot que o ADR-0019 torna imutável —
  // um registro ambíguo fica ambíguo para sempre.
  catalogVersion: "2026-08-06.1",
  schemaVersion: "1",
  generatedAt: "2026-08-06T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"], category: [] },
      feeAxes: ["commissionPct", "fixedFee", "freightCost"],
      entries: [],
    },
    {
      marketplace: "AMAZON",
      determinantsSchema: { category: [], plan: ["INDIVIDUAL", "PROFISSIONAL"] },
      feeAxes: ["commissionPct", "fixedFee", "minPerItem"],
      entries: [],
    },
    {
      marketplace: "SHOPEE",
      // 016/US17 (FR-926, arquitetura-016 §C.1) — UM eixo, e ele seleciona QUAL TABELA PUBLICADA
      // vale. Um único valor de entrada nova, e é o que a releitura verbatim do art. 26839
      // determinou (T057, item 2): o CPF que NÃO passa de 450 pedidos/90 dias paga exatamente a
      // tabela do catch-all — "a taxa adicional de R$3 … não será aplicada, ficando vigente apenas
      // a taxa por item vendido (R$4, R$16, R$20 ou R$26)". Logo DUAS entradas, não três; a
      // terceira ("CPF") que o arquiteto previu como possível é a correção-como-DADO que ele
      // deixou em aberto, e a fonte a dispensou.
      //
      // Um eixo composto e não dois: "CNPJ + alto volume" não existe publicado, e dois eixos
      // criariam um espaço cartesiano com buracos irrepresentáveis.
      determinantsSchema: { sellerProfile: ["CPF_ALTO_VOLUME"] },
      feeAxes: ["commissionPct", "fixedFee", "freightCost"],
      // 016/US16 (FR-923, ADR-0027 §3.2) — o número vem DAQUI, nunca do código.
      optionalSurcharges: [
        {
          id: "MANUSEIO_VOLUMOSO",
          label: "Manuseio de item volumoso",
          value: 50.0,
          // POR PEDIDO: num pedido de vários itens ela é cobrada UMA vez. A legenda existe porque
          // o motor soma o valor uma vez e o vendedor precisa saber que não é por unidade.
          appliesPer: "ORDER",
          source: "Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos",
          sourceUrl: "https://seller.shopee.com.br/edu/article/3305",
          effectiveDate: "2026-02-02",
          lastReviewed: "2026-08-06",
        },
      ],
      entries: [
        {
          // A entrada CATCH-ALL = o regime CNPJ (e o CPF de baixo volume, que paga a mesma tabela).
          // Ela continua sendo a de `determinants: null` e não ganha chave própria: é isso que
          // mantém byte-idêntico todo documento salvo e todo slot em que o vendedor não respondeu
          // o perfil (FR-926, última cláusula), e evita a MESMA tabela de dinheiro em dois lugares.
          determinants: null,
          commissionPct: null,
          fixedFee: null,
          priceBands: [
            // 016/US18 (FR-927) — a banda [0,80) PARTE EM DUAS. Verbatim do art. 26839 (T057):
            // "Para produtos com preço abaixo de R$8, o adicional por item é a metade do preço do
            // produto. Produtos acima de R$8 mantêm a comissão conforme a variação de valor do
            // item" ⇒ a comissão de 20% CONTINUA incidindo; o que vira função do preço é o
            // ADICIONAL. `fixedFee: 0` é marcador inerte — com a regra presente o motor nunca lê a
            // constante — e continua obrigatório pelo refine FR-928.
            {
              minPrice: 0,
              maxPrice: 8,
              commissionPct: 20,
              fixedFee: 0,
              fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
            },
            // Em L = R$ 8,00 as duas linhas cobram o mesmo (metade de 8 = os R$ 4 constantes): a
            // fonte é contínua no limiar e a partição não inventa degrau nenhum.
            { minPrice: 8, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
            { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
            { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
            { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
          ],
          freight: {
            kind: "BAND_VOUCHER",
            bands: [
              { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
              { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
              { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
            ],
          },
          // O `source` NOMEIA o regime que a entrada representa — senão o selo esconde a premissa
          // de que este é o vendedor CNPJ (ou CPF abaixo de 450 pedidos/90 dias).
          source:
            "Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias)",
          sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-08-06",
        },
        {
          // 016/US17 — CPF que ultrapassa 450 pedidos em 90 dias: a MESMA tabela com +R$ 3 no fixo
          // de cada banda. Verbatim (T057): "além do valor da comissão é aplicada uma taxa
          // adicional de R$3 por item vendido". Está DENTRO da tabela e não como sobretaxa
          // separada, porque a fonte publica o número já somado — modelá-lo à parte duplicaria um
          // valor e faria o selo apontar para duas procedências onde há uma.
          determinants: { sellerProfile: "CPF_ALTO_VOLUME" },
          commissionPct: null,
          fixedFee: null,
          // As bandas começam em R$ 12 (arquiteto §9.5) e NÃO há banda abaixo disso — nem a
          // partição de R$ 8, que é do catch-all. Motivo: a tabela + R$ 3 daria 20% + R$ 7,00 num
          // item de R$ 9, enquanto a fonte publica, verbatim, "um produto de R$10 tem uma taxa de
          // R$6,50, enquanto um de R$8 terá taxa de R$6" — a regressiva existe e a fórmula dela
          // NÃO é publicada. Precificar ali mentiria sob selo; abaixo de R$ 12 o nível fica sem
          // referência (I9) + o aviso da US17 com os dois pontos + campo manual.
          priceBands: [
            { minPrice: 12, maxPrice: 80, commissionPct: 20, fixedFee: 7 },
            { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 19 },
            { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 23 },
            { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 29 },
          ],
          freight: {
            kind: "BAND_VOUCHER",
            bands: [
              { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
              { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
              { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
            ],
          },
          source:
            "Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CPF com mais de 450 pedidos em 90 dias (taxa adicional de R$ 3,00 por item)",
          sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-08-06",
        },
      ],
    },
  ],
};
