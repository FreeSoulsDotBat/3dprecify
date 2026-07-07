import type { FeeCatalog } from "./fee-catalog";

// Bundled seed (ADR-0010 R1) — guarantees first-ever OFFLINE pre-fills before any fetch persists to
// the store. It MIRRORS the committed fee-catalog/catalog.json (the source of truth the backend
// serves); the truth-gate test asserts both parse under the same schemaVersion and carry provenance.
// US2 curation (T022): Shopee is curated (price-band based, category-independent — sourced from the
// official 2026 commission policy). ML + Amazon stay empty pending their category-specific rates
// (fabricating them would violate Constitution II; uncovered → manual + "sem referência").
export const FEE_CATALOG_SEED: FeeCatalog = {
  catalogVersion: "2026-07-07.0",
  schemaVersion: "1",
  generatedAt: "2026-07-07T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"], category: [] },
      entries: [],
    },
    {
      marketplace: "AMAZON",
      determinantsSchema: { category: [], plan: ["INDIVIDUAL", "PROFISSIONAL"] },
      entries: [],
    },
    {
      marketplace: "SHOPEE",
      determinantsSchema: null,
      entries: [
        {
          determinants: null,
          commissionPct: null,
          fixedFee: null,
          priceBands: [
            { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
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
          source:
            "Central de Educação do Vendedor Shopee — Política de Comissão para vendedores CNPJ e CPF em 2026",
          sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-07-07",
        },
      ],
    },
  ],
};
