# Data Model — 013-audit-remediation (Phase 1)

**Invariante central desta feature: ZERO migrações de banco.** Nenhuma tabela, coluna, constraint ou índice muda. Os "modelos" desta feature são deltas de dados de referência e uma tabela de constantes que muda de residência.

## §1 · Tabela canônica de tetos de validação (`backend/app/validation.py`)

Valores IDÊNTICOS aos vigentes em `products.py` hoje — mudam de residência, não de valor:

| Constante | Valor | Aplica-se a |
|---|---|---|
| `CEIL_MONEY` | 10^10 | leaves monetários (payloads de snapshot; campos de custo) |
| `CEIL_CONFIG_LEAF` | 10^12 | leaves de config de cenário (JSONB — teto DELIBERADAMENTE maior, consumidor passa explícito) |
| `CEIL_RATE` | 10^12 | tarifas (ex.: `tariffPerKwh`) |
| `CEIL_GRAMS` / `CEIL_KG` / `CEIL_HOURS` / `CEIL_KW` / `CEIL_PERCENT` | (valores atuais de `products.py:45-51`) | campos físicos/percentuais |
| `CEIL_QUANTITY` | 2.147.483.647 (int4) | **NOVO** — `BomLineIn.quantity` (E3-02; teto = limite físico da coluna) |

Regra de consumo: routers importam do módulo; `reject_bad_leaves(node, *, money_ceiling)` recebe o teto do caller (history passa `CEIL_MONEY`, scenarios passa `CEIL_CONFIG_LEAF`) — a divergência existente vira parâmetro explícito. Posições de dinheiro em `totals`/`breakdown` passam a rejeitar JSON integer (E4-01): int é aceito apenas como contagem.

## §2 · Entradas curadas do catálogo de taxas (US8 — `backend/app/data/catalog.json` + `seed.ts`)

Shape EXISTENTE do catálogo (nenhum campo novo no schema Zod/servidor). Conteúdo a curar:

| Marketplace | Entrada | Campos usados | Fonte do valor |
|---|---|---|---|
| Mercado Livre | plano Clássico (caso-comum; SC-101/005) | `commissionPct` (+ `priceBands`/`fixedFee` conforme a tarifa oficial por faixa de preço) | página oficial de tarifas ML BR — coletar com `sourceUrl` + `effectiveDate` |
| Amazon | comissão padrão + piso por item | `commissionPct`, `minPerItem: 1.00` (o floor que o engine já suporta — `band-floor.test.ts`) | página oficial de tarifas Amazon BR — idem |

Restrições (research §6): granularidade por-categoria NÃO cabe no schema atual — a entrada é o caso-comum com selo de referência + override manual (semântica igual à Shopee atual); valores só entram após validação explícita do dono (FR-015); `seed.ts` ≡ `catalog.json` (paridade guardada); `catalogVersion` incrementa (`YYYY-MM-DD.n` — e a comparação passa a ser data+int pelo fix E1-03 do mesmo escopo).

## §3 · Parâmetros de busca das rotas migradas (C-02 — contrato de URL do front)

| Rota | Search params (validateSearch) | Substitui |
|---|---|---|
| `/historico` | `snapshot?: string` (abre detalhe) | `/historico/$snapshotId` |
| `/catalogo` | `tab` (existente) + `produto?: string` (`"novo"` \| id — abre form) | `/catalogo/produtos/novo` e `/catalogo/produtos/$productId` |

Redirects (hosting + client) mapeiam 1:1 as URLs antigas — ver `contracts/api-deltas.md §3`.

## §4 · Estados sem mudança (declarados para o analyze)

- Entitlement (`none/active/lapsed`) — INTOCADO; C-03 só apresenta o estado existente.
- Snapshot/Scenario/Bom/Catalog schemas — intocados; E5-01 muda o CONTEÚDO gravado no JSONB `config.costBasis.lastKnown` em saves de base KIT (passa a ser re-capturado), não o shape.
- Nenhuma mudança em `pricing-core` (a gramática do parser vive no front `shared/lib`; o engine não muda nesta feature — E1-05 é comparação interna e entra como desejável no lote C-12 sem mudança de contrato).
