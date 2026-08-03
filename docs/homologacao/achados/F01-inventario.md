# F01 — Inventário e mapa real de arquitetura

## Resumo

Monorepo pnpm: `apps/web` (React 19 + TanStack Router, FSD-Lite, 11 rotas), `backend`
(FastAPI, 11 módulos de API, ~42 endpoints), `packages/pricing-core` (motor de preço, 12
exports) e `packages/fee-ingest` (ingestão de tarifas, 26 exports, scraping Playwright da
Amazon). Modelo de dados: 9 tabelas (`accounts`, `entitlement_grants`, `filaments`, `printers`,
`products`, `boms`, `bom_lines`, `snapshots`, `scenarios`, `subscriptions`, `billing_events` —
11 no total), 5 migrações Alembic. Auth = Firebase ID token (`current_claims`); premium =
`require_entitlement`/`require_catalog_read`. Cliente: Orval-gerado + wrapper `transport.ts`;
persistência local via `idb-keyval` (7 caches por `uid`). Superfícies externas: Firebase Auth,
Mercado Pago (`api.mercadopago.com`), página pública da Amazon Seller Central (scraping), API
do ML referenciada só em `scripts/probes/` (não em produção). Testes: 96 arquivos vitest FE +
25 pytest BE + 21 specs Playwright + 15 arquivos vitest nos pacotes.

## 1. Árvore de módulos do frontend (`apps/web/src`)

Fronteira declarada em `eslint.config.mjs:66-88`: `app → pages → widgets → feature → entities
→ shared` (cada camada só importa de camadas estritamente abaixo; regra `default: "disallow"`
em `eslint.config.mjs:69`). O arquivo gerado `shared/api/generated.ts` é isento do lint
(`eslint.config.mjs:21`).

### `app/` (`apps/web/src/app/`)
| Arquivo | Conteúdo |
|---|---|
| `router.tsx` | Definição de rotas TanStack Router (ver §2) |
| `app-shell.tsx` + `.css` | Shell/layout raiz |
| `providers.tsx` (+`.test.tsx`) | Providers React (query client, etc.) |
| `router.guards.test.tsx` | Testes dos guards de rota |
| `sign-out-entry-points.test.tsx` | Testes de pontos de sign-out |

### `pages/` (9 fatias)
| Fatia | Conteúdo |
|---|---|
| `bom/` | `bom-page.tsx`, `kit-save.ts` — página do composer de Kits |
| `calcular/` | `calcular-page.tsx` — calculadora principal |
| `catalogo/` | `catalogo-page.tsx`, `produto-page.tsx` — catálogo + form de produto |
| `conta/` | `conta-page.tsx` — conta/plano/billing |
| `error/` | `error-page.tsx` |
| `historico/` | `historico-page.tsx`, `snapshot-detail-page.tsx`, `compare-today.tsx`, `recalc-today.tsx` |
| `not-found/` | `not-found-page.tsx` |
| `privacidade/` | `privacidade-page.tsx` |
| `sign-in/` | `sign-in-page.tsx` |

### `widgets/` (5 fatias)
`app-nav/`, `bom-line-editor/`, `offline-banner/`, `page-header/`, `top-bar/` — cada uma um
componente de UI compartilhado entre páginas (nome da pasta = nome do widget).

### `features/` (7 fatias)
| Fatia | Conteúdo (arquivos não-teste) |
|---|---|
| `auth/` | `sign-in-screen.tsx` |
| `billing/` | `billing-cta.tsx`, `checkout-return.tsx`, `offer-panel.tsx`, `plan-panel.tsx`, `plan-view.ts`, `use-subscription.ts` |
| `bom/` | `assembly-summary.tsx`, `bom-compute.ts`, `bom-line-card.tsx`, `bom-teaser.tsx`, `channel-rollup.tsx` |
| `calculator/` | `calculator-form.tsx`, `calculator-model.ts`, `calculator-schema.ts`, `catalog-prefill.ts`, `category-picker.tsx`, `fee-prefill.ts`, `fee-seal.tsx`, `kit-basis-summary.tsx`, `product-mapping.ts`, `scenario-bridge.ts` |
| `catalog/` | `catalog-controls.tsx`, `catalog-panel.tsx`, `catalog-schema.ts`, `filament-form.tsx`, `filaments-panel.tsx`, `kits-panel.tsx`, `premium-teaser.tsx`, `printer-form.tsx`, `printers-panel.tsx`, `products-panel.tsx` |
| `history/` | `entry-actions.tsx`, `export-sheet.tsx`, `history-teaser.tsx`, `outbox-syncer.tsx`, `record-snapshot-sheet.tsx`, `sign-out-outbox-guard.tsx`, `snapshot-manage.tsx` |
| `scenarios/` | `save-scenario-sheet.tsx`, `scenario-context-bar.tsx`, `scenario-teaser.tsx`, `scenarios-list-sheet.tsx` |

### `entities/` (5 fatias)
| Fatia | Conteúdo |
|---|---|
| `bom/` | `bom-cache.ts` (persistência local), `use-bom.ts` |
| `catalog/` | `catalog-cache.ts`, `product-summary.ts`, `use-catalog.ts` |
| `history/` | `frozen-payload.ts`, `history-cache.ts`, `history-format.ts`, `origin.ts`, `outbox.ts`, `use-export.ts`, `use-history.ts`, + `__fixtures__/` |
| `scenario/` | `config-document.ts`, `resolved-basis.ts`, `scenario-cache.ts`, `use-scenarios.ts` |
| `user/` | `entitlement-cache.ts`, `use-entitlement.ts`, `use-identity.ts`, `user.ts` |

### `shared/` (8 fatias)
| Fatia | Conteúdo |
|---|---|
| `api/` | `generated.ts` (Orval), `transport.ts`, `error-messages.ts` |
| `billing/` | `plans.ts`, `price-line.ts`, `teaser-upgrade.tsx` |
| `fee-catalog/` | `category-tree.ts`, `fee-catalog.ts`, `index.ts` (barrel), `seed.ts`, `use-fee-catalog.ts` |
| `i18n/` | `messages.pt-br.ts` (55.3K), `copy-honesty.test.ts` |
| `lib/` | `decimal-ptbr.ts`, `env.ts`, `firebase.ts`, `save-file.ts`, `use-debounced-value.ts`, `use-online.ts` |
| `observability/` | `sentry.ts` |
| `session/` | `session-store.ts`, `sign-out-guard.ts` |
| `ui/` | design system `tf-*` (button, card, dialog, field, select, switch, toast, icon, etc.) + `index.ts` barrel |

## 2. Rotas (`apps/web/src/app/router.tsx`)

| Caminho | Componente | `beforeLoad`/guard | `validateSearch` |
|---|---|---|---|
| `/` | — (redirect) | `router.tsx:69-71` redireciona para `/calcular` | — |
| `/calcular` | `CalcularPage` (`router.tsx:79`) | nenhum (público) | nenhum |
| `/catalogo` | `CatalogoPage` (`router.tsx:118`) | `router.tsx:115-117`: `requireAuth` **somente se** `search.produto` estiver presente | `tab?: "filaments"\|"printers"\|"products"\|"kits"`, `produto?: string` (`router.tsx:100-111`) |
| `/catalogo/produtos/novo` | — (redirect) | `router.tsx:130-133`: `requireAuth` sempre, depois redireciona para `/catalogo?produto=novo` | — |
| `/catalogo/produtos/$productId` | — (redirect) | `router.tsx:139-142`: `requireAuth` sempre, depois redireciona para `/catalogo?produto=$productId` | — |
| `/kits` | `BomPage` (`router.tsx:160`) | nenhum (público) | `id?: string`, `copy?: boolean` (`router.tsx:156-159`) |
| `/historico` | `HistoricoPage` (`router.tsx:188`) | `router.tsx:185-187`: `requireAuth` **somente se** `search.snapshot` estiver presente | `snapshot?: string` (`router.tsx:181-183`) |
| `/historico/$snapshotId` | — (redirect) | `router.tsx:198-201`: `requireAuth` sempre, depois redireciona para `/historico?snapshot=$snapshotId` | — |
| `/conta` | `ContaPage` (`router.tsx:219`) | `router.tsx:218`: `requireAuth` sempre | `checkout?: "retorno"`, `assinar?: "1"` (`router.tsx:214-217`) |
| `/sign-in` | `SignInPage` (`router.tsx:239`) | `router.tsx:231-238`: se já autenticado, redireciona para `search.redirect` (via `safeRedirect`, `router.tsx:43-47`) ou `/calcular` | `redirect?: string` (`router.tsx:228-230`) |
| `/privacidade` | `PrivacidadePage` (`router.tsx:247`) | nenhum (público) | nenhum |

`requireAuth` (`router.tsx:52-56`) lança `redirect({ to: "/sign-in", search: { redirect: target } })`
quando `status !== "authenticated"`.

## 3. API do backend (`backend/app/api/*.py`)

Legenda: CC = `require_catalog_read` (ativo|lapsado); RE = `require_entitlement` (ativo);
CL = `current_claims` (só autenticação, sem entitlement); nenhum = sem dependência de auth.

| Módulo | Método + caminho | Dependência (linha) | Linha da rota |
|---|---|---|---|
| `fee_catalog.py` | GET `/fee-catalog` | nenhuma (`fee_catalog.py:4` — Constitution IV) | 118 |
| `billing.py` | POST `/billing/webhook/mercadopago` | nenhuma — autenticação por assinatura MP, não `current_claims` (`billing.py:2,12`) | 67 |
| `billing.py` | POST `/billing/checkout` | CL (171) | 164 |
| `billing.py` | GET `/billing/subscription` | CL (250) | 244 |
| `billing.py` | POST `/billing/subscription/cancel` | CL (265) | 259 |
| `billing.py` | POST `/billing/checkout/play` (registrada só se `settings.play_billing_enabled`, `billing.py:313,322-323`) | CL (330) | 327 |
| `entitlement.py` | GET `/entitlement` | CL (32) | 30 |
| `export.py` | GET `/history/export.csv` | RE (45) | 39 |
| `export.py` | GET `/history/{snapshot_id}/quote.pdf` | RE (91) | 80 |
| `boms.py` | GET `/boms` | CC (547) | 545 |
| `boms.py` | POST `/boms` | RE (581) | 574 |
| `boms.py` | GET `/boms/{bom_id}` | CC (614) | 611 |
| `boms.py` | PUT `/boms/{bom_id}` | RE (628) | 621 |
| `boms.py` | DELETE `/boms/{bom_id}` | RE (652) | 645 |
| `history.py` | POST `/history` | RE (311) | 292 |
| `history.py` | GET `/history` | CC (367) | 365 |
| `history.py` | GET `/history/{snapshot_id}` | CC (435) | 432 |
| `history.py` | PATCH `/history/{snapshot_id}` | RE (449) | 442 |
| `history.py` | DELETE `/history/{snapshot_id}` | RE (478) | 471 |
| `filaments.py` | GET `/filaments` | CC (122) | 120 |
| `filaments.py` | POST `/filaments` | RE (142) | 135 |
| `filaments.py` | GET `/filaments/{filament_id}` | CC (162) | 159 |
| `filaments.py` | PUT `/filaments/{filament_id}` | RE (175) | 168 |
| `filaments.py` | DELETE `/filaments/{filament_id}` | RE (196) | 189 |
| `me.py` | GET `/me` | CL (20) | 19 |
| `printers.py` | GET `/printers` | CC (123) | 121 |
| `printers.py` | POST `/printers` | RE (143) | 136 |
| `printers.py` | GET `/printers/{printer_id}` | CC (163) | 160 |
| `printers.py` | PUT `/printers/{printer_id}` | RE (176) | 169 |
| `printers.py` | DELETE `/printers/{printer_id}` | RE (197) | 190 |
| `products.py` | GET `/products` | CC (448) | 446 |
| `products.py` | POST `/products` | RE (478) | 471 |
| `products.py` | GET `/products/{product_id}` | CC (499) | 496 |
| `products.py` | PUT `/products/{product_id}` | RE (518) | 511 |
| `products.py` | DELETE `/products/{product_id}` | RE (536) | 529 |
| `scenarios.py` | GET `/scenarios` | CC (493) | 491 |
| `scenarios.py` | POST `/scenarios` | RE (532) | 525 |
| `scenarios.py` | GET `/scenarios/{scenario_id}` | CC (556) | 553 |
| `scenarios.py` | PUT `/scenarios/{scenario_id}` | RE (573) | 566 |
| `scenarios.py` | PATCH `/scenarios/{scenario_id}` | RE (633) | 626 |
| `scenarios.py` | POST `/scenarios/{scenario_id}/duplicate` | RE (656) | 649 |
| `scenarios.py` | DELETE `/scenarios/{scenario_id}` | RE (694) | 687 |

Total: 41 endpoints sempre registrados + 1 condicional (`/billing/checkout/play`, atrás de flag
— corpo do handler sempre levanta `AppError(BILLING_UNAVAILABLE, …)`, `billing.py:337-339`).

## 4. Modelo de dados (`backend/app/models/__init__.py`)

| `__tablename__` (linha) | Identidade / dono | Constraints/Index declarados |
|---|---|---|
| `accounts` (74) | PK `account_uid: str` (77) | `CheckConstraint("currency = 'BRL'")` (75) |
| `entitlement_grants` (96) | PK `id: uuid` (101); `account_uid` FK→accounts (102-104) | `CheckConstraint(source IN ('beta','comp','payment'))` (99) |
| `filaments` (127) | PK `id: uuid` (140); `owner_uid` FK→accounts (141-143) | 4 `CheckConstraint` (129-137: nome não-vazio, custo≥0/não-NaN, peso rolo>0, desperdício≥0/não-NaN) |
| `printers` (163) | PK `id: uuid` (179); `owner_uid` FK→accounts (180-182) | 5 `CheckConstraint` (165-176: nome, valor máquina, vida útil>0, potência, manutenção) |
| `products` (208) | PK `id: uuid` (295); `owner_uid` FK→accounts (296) | ~20 `CheckConstraint` entre linhas 210-287 (não enumerados individualmente aqui — ver arquivo) |
| `boms` (366) | PK `id: uuid` (373); `owner_uid` FK→accounts (374) | `CheckConstraint(name_not_blank)` (368); `Index("ix_boms_owner_uid_deleted_at", "owner_uid","deleted_at")` (370) |
| `bom_lines` (406) | PK `id: uuid` (506); `bom_id` FK→boms (507); `product_id` FK opcional (514); **sem `owner_uid` próprio** (dono via `bom_id`) | ~18 `CheckConstraint` (409-494); `Index("ix_bom_lines_bom_id_position","bom_id","position")` (503) |
| `snapshots` (588) | PK `id: uuid` (651); `owner_uid` FK→accounts (652); `client_snapshot_id: uuid` (657) | `UniqueConstraint("owner_uid","client_snapshot_id")` (592); ~12 `CheckConstraint` (594-641, incl. `payload_is_object`, `payload_kind_matches`, `payload_version_matches`, `payload_schema_valid`); `Index(...)` (642) |
| `scenarios` (722) | PK `id: uuid` (747); `owner_uid` FK→accounts (748) | `CheckConstraint(name_not_blank, len≤120)` (724); `CheckConstraint(config_is_object)` (728); `CheckConstraint(config_schema_valid)` (729); + mais 1 (732); `Index(...)` (738) |
| `subscriptions` (787) | PK `id: uuid` (808); `owner_uid` FK→accounts (809) | `CheckConstraint(provider_enum)` (789); `CheckConstraint(plan_period_enum)` (790); +1 (791); `UniqueConstraint("mp_preapproval_id")` (795); `Index(...)` (798) |
| `billing_events` (843) | PK `id: uuid` (852); `subscription_id` FK→subscriptions (853); **sem `owner_uid` próprio** | `CheckConstraint(...)` (845); `UniqueConstraint("event_key")` (849) |

11 tabelas no total.

### Migrações (`backend/alembic/versions/`)
| id | Descrição (docstring) |
|---|---|
| `0001` | "e2 full schema" |
| `0002` | "e3 boms + bom_lines" (Revises: 0001) |
| `0003` | "e4 snapshots (frozen document + immutability trigger)" (Revises: 0002) |
| `0004` | "e5 scenarios (mutable intent document — the deliberate opposite of an E4 snapshot)" (Revises: 0003) |
| `0005` | "e6 billing (the PSP mirror + the exactly-once inbox + the additive payment-grant extension)" (Revises: 0004) |

## 5. Pacotes

### `packages/pricing-core/src` (12 exports)
| Arquivo:linha | Export |
|---|---|
| `rounding.ts:6` | `MONEY_DP` (const) |
| `rounding.ts:11` | `toMoney(value)` |
| `rounding.ts:16` | `sumMoney(rounded)` |
| `channels.ts:8` | `PriceBand` (interface) |
| `channels.ts:27` | `BandMode` (type) |
| `channels.ts:31` | `VoucherBand` (interface) |
| `channels.ts:38` | `ChannelFees` (interface) |
| `channels.ts:59` | `ChannelLevel` (interface) |
| `channels.ts:250` | `grossUp(base, fees)` |
| `index.ts:20` | `PRICING_MODEL_VERSION` = `"3.1.0"` |
| `index.ts:23,35,53,68,91` | `OtherCostItem`, `ChannelInput`, `ChannelResult`, `PriceInput`, `PriceResult` (interfaces) |
| `index.ts:110` | `ValidationError` (class) |
| `index.ts:133` | `computeCalculator(input)` |
| `index.ts:324,330,346,358` | `BomLineInput`, `BomLineResult`, `BomChannelRollup`, `BomResult` (interfaces) |
| `index.ts:388` | `computeBom(lines)` |
| `index.ts:505` | re-export de `BandMode, ChannelFees, ChannelLevel, PriceBand, VoucherBand` de `./channels` |

### `packages/fee-ingest/src` (arquivos não-teste)
| Arquivo | Exports (linha) |
|---|---|
| `amazon-parse.ts` | `RawRow` (9), `ParsedBand` (11), `ParsedCategory` (17), `CommissionCell` (62), `readCommissionCell` (85), `parseAmazonTable` (137), `CANARIES` (203), `CATCH_ALL_NAME` (212) |
| `amazon-to-catalog.ts` | `AMAZON_SOURCE_URL` (6), `categoryId` (11), `amazonSpine` (25), `AMAZON_FEE_BASE_CAVEAT` (40), `AMAZON_CAVEATS_FULL` (51), `BuildOptions` (54), `effectiveDatesOf` (83), `amazonEntries` (105) |
| `catalog-diff.ts` | `FieldChange` (12), `EntryDiff` (18), `CatalogDiff` (26), `diffCatalogs` (111), `mayAutoMerge` (235) |
| `guardrails.ts` | `SanityOptions` (11), `SanityVerdict` (24), `checkParseSanity` (32), `CoverableBand` (62), `checkBandCoverage` (85), `nextCatalogVersion` (129), `checkCategoryIdCollisions` (159), `CollectedAtVerdict` (179), `collectedAtFor` (192) |
| `refresh.ts` | `CHANGED_ROWS_CEILING` = 0.5 (23), `CEILING_MIN_ENTRIES` = 10 (34), `RefreshOutcome` (39, union de 2 casos), `prBody` (96), `decideRefresh` (163) |
| `build-amazon.mjs` | script executável (não exporta) — lê a página pública da Amazon via Playwright/chromium (`build-amazon.mjs:41-58`) ou um arquivo capturado via `--from` (linha 60-64); escreve `backend/app/data/catalog.json` (linha 33) |

## 6. Fronteira cliente ↔ backend

- **Cliente gerado**: `apps/web/src/shared/api/generated.ts` (203.1K, ~5000 linhas) —
  cabeçalho declara `Generated by orval v8.19.0 … Do not edit manually` (`generated.ts:1-6`);
  isento do ESLint (`eslint.config.mjs:21`). Usa hooks TanStack Query e chama `orvalFetch` de
  `./transport` (`generated.ts:26`) em vez de `fetch` cru.
- **Wrapper de transporte**: `apps/web/src/shared/api/transport.ts`. Função central `request()`
  (linha 95) resolve a URL (`resolveUrl`, linha 67), aplica timeout de 15s via
  `AbortController` (linha 100-101), normaliza falhas de transporte e respostas 4xx/5xx em
  `ApiError` (classe, linha 30-42) e reporta a Sentry via `captureApiError` (linha 49-53).
  Três entradas públicas: `apiFetch` (181), `apiFetchFile` (211) e `orvalFetch` (223, o mutator
  do Orval).
- **Onde a autenticação é anexada**: `authHeaders()` (`transport.ts:59-65`) pega
  `auth?.currentUser` (Firebase) e chama `user.getIdToken()` para um Bearer token fresco por
  requisição. É anexado apenas se `isApiOrigin(url)` for verdadeiro (`transport.ts:76-82,
  111-113`) — um allowlist de origem que impede vazar o token para uma URL absoluta de outro
  domínio.

## 7. Camadas de persistência do cliente (`idb-keyval`)

7 módulos usam `idb-keyval` (import em cada arquivo: `import { del, get, set } from
"idb-keyval"`, ex. `bom-cache.ts:1`). Cada um deriva uma chave por `uid`:

| Módulo | Função de chave (linha) |
|---|---|
| `entities/bom/bom-cache.ts` | `bomIdbKey(uid)` (14) |
| `entities/catalog/catalog-cache.ts` | `catalogIdbKey(resource, uid)` (16) |
| `entities/history/history-cache.ts` | `historyIdbKey(uid)` (16) |
| `entities/history/outbox.ts` | `historyOutboxKey(uid)` (47) |
| `entities/scenario/scenario-cache.ts` | `scenarioIdbKey(uid)` (17) |
| `entities/user/entitlement-cache.ts` | `entitlementIdbKey(uid)` (24) |

`apps/web/src/shared/fee-catalog/use-fee-catalog.ts` também referencia `idb-keyval`
(confirmado por `Grep`, conteúdo não lido linha a linha nesta fase).

## 8. Superfícies externas

| Superfície | Onde | Detalhe |
|---|---|---|
| Firebase Auth | `apps/web/src/shared/lib/firebase.ts:15-21` | `initializeApp` + `getAuth`; emulador conectado condicionalmente (`firebase.ts:22-23`) |
| Mercado Pago (API) | `backend/app/billing/providers/mercadopago.py:26` | `MP_API_BASE_URL = "https://api.mercadopago.com"` |
| Mercado Pago (webhook) | `backend/app/api/billing.py:68` | `POST /billing/webhook/mercadopago` recebe eventos MP (assinatura, não `current_claims`) |
| Página pública da Amazon Seller Central | `packages/fee-ingest/src/build-amazon.mjs:34-35` (URL), `41-58` (scraping via Playwright/chromium) | Lida via navegador headless porque a página é renderizada em JS (comentário, linha 42) |
| API do Mercado Livre (ML) | `scripts/probes/g1-ml-listing-prices.mjs`, `scripts/probes/g3-ml-refresh-rotation.mjs`, `scripts/probes/ml-oauth.mjs` | Referências apenas em scripts de sonda (`scripts/probes/`) — **não** encontrada em `packages/fee-ingest/src` nem em nenhum caminho de produção (busca `Grep` retornou só os 3 probes + o próprio `fee-catalog.test.ts`, que é teste) |

## 9. Testes

| Suite | Localização | Contagem de arquivos |
|---|---|---|
| vitest (frontend) | `apps/web/src/**/*.test.ts(x)` | 96 |
| pytest (backend) | `backend/tests/test_*.py` | 25 |
| Playwright (e2e) | `apps/web/tests/e2e/*.spec.ts` | 21 |
| vitest (`packages/pricing-core/tests`) | 10 arquivos (`band-convergence`, `band-dominance`, `band-floor`, `channels`, `computeBom`, `computeCalculator`, `determinism`, `progressive-bands`, `rounding`, `version`) | 10 |
| vitest (`packages/fee-ingest/src/*.test.ts`) | `amazon-parse`, `amazon-to-catalog`, `artifact-fixed-point`, `catalog-diff`, `refresh` | 5 |

Contagem pura de arquivos — sem julgamento de cobertura.

## Não determinado

1. ~~`fee-catalog.ts` contém bytes NUL~~ — **AFIRMAÇÃO FALSA, RETIRADA na verificação da fase.**
   O subagente rodou `grep -c $' ' fee-catalog.ts` e leu "325" como 325 linhas com NUL. `$' '`
   é um padrão VAZIO, que casa TODAS as linhas: 325 é a contagem de linhas do arquivo, não de
   ocorrências. Medido corretamente com Python (`open(...,'rb').read().count(b' ')`): **0 bytes
   NUL**. O byte existiu — era a sentinela de `determinantKey` — e foi removido em `8eda30b`
   (follow-up B da 014). O registro fica aqui, e não apagado, porque o método que produziu o falso
   positivo é reaproveitável e vai enganar de novo: **contar linhas casadas não é contar
   ocorrências, e um padrão vazio casa tudo.**

2. `Product.__table_args__` (`backend/app/models/__init__.py:210-287`, ~20
   `CheckConstraint`s) e `Scenario`/`Subscription` não foram transcritos constraint-a-constraint
   nesta fase (só contados e referenciados por faixa de linha) — se F02+ precisar do texto
   exato de cada regra, leia diretamente essas faixas.
3. ~~Chave `idb-keyval` do fee-catalog~~ — **RESOLVIDO na verificação da fase.**
   `apps/web/src/shared/fee-catalog/use-fee-catalog.ts:33` — `FEE_CATALOG_STORE_KEY = "fee-catalog"`
   (chave única, NÃO segmentada por uid, ao contrário dos caches de catálogo/histórico/cenários; o
   catálogo de tarifas é dado público, não do vendedor). A chave de query é `["fee-catalog"]`
   (linha 36).

4. ~~`backend/app/entitlement` faz chamada de rede externa?~~ — **RESOLVIDO: não.**
   `backend/app/entitlement/__init__.py:15-22` — os únicos imports são `dataclasses`, `datetime`,
   `typing`, `fastapi.Depends` e `sqlalchemy.select`. Nenhum cliente HTTP. O módulo só consulta o
   banco.

5. ~~Conteúdo de `backend/app/main.py` além de CORS/include_router~~ — **RESOLVIDO.**
   `create_app` (`backend/app/main.py:92`) faz, em ordem: `register_exception_handlers(app)`
   (linha 97 — o envelope de erro + correlation id), `CORSMiddleware` como middleware MAIS EXTERNO
   (linha 100), a rota `GET /health` (linha 121), o `include_router` das APIs, e — só quando
   `settings.app_env == "dev"` — uma rota de debug `/_debug/boom` que demonstra o envelope. Nenhum
   outro middleware.

## Correções aplicadas na verificação desta fase

O achado do NUL (item 1) era **falso** e o método que o produziu é reaproveitável, então fica
registrado em vez de apagado. Os itens 3, 4 e 5 estavam abertos por não terem sido lidos, não por
serem indetermináveis — foram resolvidos por leitura direta. Sobra **um** item genuinamente aberto
(o 2), que é volume de transcrição e não incerteza.
