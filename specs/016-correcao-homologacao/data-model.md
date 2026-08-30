# Data Model — 016 (Phase 1)

**Regra transversal (I4/ADR-0024)**: toda extensão abaixo é ADITIVA e opcional; **ausência =
comportamento de hoje**. Nenhuma migração de payload gravado. Shapes definitivos com alternativas em
`arquitetura-016.md`; contratos formais em `contracts/`.

## 1. pricing-core (packages/pricing-core)

### 1.1 Versão e campos aposentados (PR-D → 4.0.0)

| item | forma | regra |
| --- | --- | --- |
| `PRICING_MODEL_VERSION` | `"4.0.0"` | gate `version.test.ts` amarra ao major do package.json |
| `RETIRED_INPUT_FIELDS` | `["wasteGrams"] as const` | recusa por CHAVE PRESENTE (`in`), antes de validar; `ValidationError` nomeia o campo |
| `stripRetiredFields(stored)` | `{ kept, discarded: {field, value}[] }` | pura; genérica na folha; `delete`, nunca `undefined` |
| `isPreRemovalModel(v)` | `major(v) < 4` | sinal para documento congelado (que guarda `modelVersion`) |

**Entrada do motor**: `PricingInput` perde `wasteGrams` (era `material = (gramas + desperdício) ×
custo/kg`; passa a `gramas × custo/kg`). `computeBom` herda a recusa por linha.

### 1.2 Banda de preço (PR-F → 4.1.0)

```
PriceBand {
  minPrice, maxPrice, commissionPct,
  fixedFee: number,                          // obrigatório: o valor quando não há regra
  fixedFeeRule?: { kind: "PCT_OF_PRICE", pct } // ADITIVO; pct ∈ (0,100)
}
bandFixedFee(band, anuncio) = band.fixedFeeRule ? anuncio × pct/100 : band.fixedFee
```

Validações (recusa no schema + erro por slot no motor): `fixedFeeRule` só em `bandMode SELECTION`;
`commissionPct + pct < 100` por banda (denominador do gross-up nunca zera/inverte).

### 1.3 Sobretaxas de canal (PR-F → 4.1.0)

```
ChannelSurcharge { label, value }
ChannelInput  { …, surcharges?: ChannelSurcharge[] }   // ausência = byte-idêntico
ChannelResult { …, surcharges: ChannelSurcharge[] }    // ecoado p/ legenda e PDF
fixoEfetivo(banda, L) = bandFixedFee(banda, L) + Σ surcharges.value   // atravessa a banda (013/F1)
```

## 2. Catálogo de tarifas (apps/web/src/shared/fee-catalog + backend/app/data/catalog.json)

| extensão | nível | forma | fatia |
| --- | --- | --- | --- |
| `feeAxes?` | marketplace | `("commissionPct"\|"fixedFee"\|"minPerItem"\|"freight")[]` — dirige a tela; ausência = 4 campos | PR-E |
| `determinantsSchema.SHOPEE` | marketplace | `sellerProfile: [CPF, CPF_ALTO_VOLUME]` (CNPJ = `null` catch-all, entrada de hoje INTOCADA) | PR-E/F |
| entradas CPF / CPF_ALTO_VOLUME | entrada | tabelas publicadas como DADO (alto volume = CPF + R$ 3 já somado); bandas CPF começam em **R$ 12** (§9.5 — abaixo: I9 + aviso US17) | PR-F |
| banda CNPJ `[0,80)` | entrada | parte em `[0,8)` c/ `fixedFeeRule` + `[8,80)` c/ `fixedFee 4` — número final APÓS releitura verbatim art. 26839 | PR-F |
| `optionalSurcharges?` | marketplace | `{ id: "MANUSEIO_VOLUMOSO", label, value: 50, appliesPer: "ORDER", procedência }[]` | PR-F |
| `fixedFeeSource?` | entrada | procedência própria da taxa fixa (Amazon INDIVIDUAL: `/precos`, data própria); metadado — não chega ao motor | PR-F |
| Amazon INDIVIDUAL | dado | `fixedFee: 0 → 2` nas 38 entradas; `minPerItem` fica 1,00 (D7) | PR-F |
| `catalogVersion` | catálogo | UM bump por FATIA que muda conteúdo, via `nextCatalogVersion`: PR-E (curadoria `feeAxes`) e PR-F (dado — T068), cada uma o seu | PR-E, PR-F |
| ~~`fixedCostMatrix?`~~ | marketplace | **ADIADO** (ADR-0025 Proposed — volta com US6-ML/017) | — |

**Refine novo (FR-928)**: banda com `fixedFee` nulo e sem `fixedFeeRule` ⇒ inválida no schema;
`entryToChannelFees` nunca produz `?? 0` sob selo — o nível cai no estado I9.

## 3. Frontend — modelos de feature

| item | forma | fatia |
| --- | --- | --- |
| `PremiumFeatureId` | `"SCENARIOS"\|"CATALOG"\|"CATALOG_PICKER"\|"KITS"\|"QUOTES"` — chave do registro i18n fechado (título·subtítulo·legenda) | PR-A |
| `ChannelFieldPlan` | `{ determinants[], feeFields[], surcharges[] }` — derivado puro do catálogo; alimenta render E `slotDeterminants` (RA5) | PR-E |
| `slotDeterminants(SHOPEE)` | perfil CPF+altoVolume → `CPF_ALTO_VOLUME` · CPF → `CPF` · CNPJ/sem resposta → `null` | PR-E/F |
| `ScenarioFormPatch.discarded` | `DiscardedField[]` — sobe do `stripRetiredFields` para a tela declarar o descarte | PR-D |
| `ScenarioChannelIntent.surcharges?` | `string[]` (ids; valor resolve ao vivo — ADR-0021) | PR-F |
| Derivações de borda (US7/US8) | h+min ↔ decimal; `RITMOS=[260,1200,3300]` × payback; NUNCA persistidas | PR-C |

## 4. Banco (backend, migração Alembic `0003` — PR-D)

| coluna | ação |
| --- | --- |
| `filaments.default_waste_grams` (+CHECK) | **DROP** |
| `products.waste_grams` NOT NULL (+CHECK) | **DROP** |
| `bom_lines.waste_grams` (+CHECK) | **DROP** |

Downgrade recria colunas com default `'0'` — **schema reversível, valores não** (escrito na
migração). Snapshots (ADR-0019) e outbox (ADR-0018) intocados — opacos e imutáveis.

## 5. Wire (OpenAPI/Orval — PR-D)

`FilamentIn/FilamentOut.defaultWasteGrams` e `PieceInputs.wasteGrams` SAEM; `FilamentIn` e
`PieceInputs` passam a `extra="forbid"` (422 nomeando a mudança de modelo — cliente velho falha
alto, não mente); `scenarios.py` para de emitir a folha em `lastKnown`; `boms.py` para de
sincronizar. Regen da RAIZ (`export_openapi` + `gen:api`) + prova de idempotência (drift-guard).

## 6. Estados e transições que importam

- **Documento salvo pré-4.0.0 reaberto** → `stripRetiredFields` → recomputa sem `wasteGrams` → a
  tela DECLARA o descarte e explica a divergência onde aparece (FR-913). Congelado: exibe o que foi
  cotado, para sempre (I3).
- **Slot Shopee sem perfil respondido** → determinantes de hoje (`null`) → tabela CNPJ →
  byte-idêntico.
- **Simulação salva sem `surcharges`** → nenhum → byte-idêntico (US16-AC2).
- **Usuário grátis** → switch de marketplace desabilitado e falso; nenhum número de canal por
  nenhum caminho (deep-link incluído); autoridade de entitlement continua no servidor (ADR-0012).
