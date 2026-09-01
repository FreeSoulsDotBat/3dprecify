# MAPA DO CÓDIGO — 3DPrecify

> Documento de navegação para quem nunca viu este código. Gerado pela auditoria de legibilidade
> de 2026-08-31 (branch `019-polish`). Atualizar ao fim de cada onda de refatoração.

Monorepo pnpm. `apps/web` (React 19 + Vite + TanStack Router/Query + RHF + Zod, PWA, FSD-Lite) ·
`backend/` (FastAPI Py 3.12, SQLAlchemy async, Postgres, structlog) · `packages/pricing-core`
(fórmula canônica de preço, zero-dep salvo `decimal.js-light`) · `packages/fee-ingest` (gerador do
catálogo de tarifas, roda em CI/local, nunca no app).

**Regra de ouro para navegar: o backend nunca recalcula preço.** A fórmula vive só em
`packages/pricing-core/src/`. O backend guarda, gateia (entitlement) e renderiza PDF/CSV de valores
já congelados. (Verificado na auditoria: nenhuma aritmética de dinheiro no backend — a única
operação é a verificação de identidade `gross − amount == net` em `backend/app/api/history.py:162`,
que recusa documentos que não fecham, nunca produz número.)

---

## 1. Fluxo ponta a ponta — "usuário cria uma precificação"

### 1.1 Rota → página

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 1 | `apps/web/src/main.tsx` | bootstrap | monta `RouterProvider` com `context={{status}}` do session store; re-invalida o router quando a sessão muda |
| 2 | `apps/web/src/app/router.tsx:66` | `indexRoute` | `/` → redirect para `/calcular` (redirect de caminho, não gate de auth) |
| 3 | `apps/web/src/app/router.tsx:76` | `calcularRoute` | `/calcular` é **pública**: sem `beforeLoad`, renderiza anônimo/offline |
| 4 | `apps/web/src/app/app-shell.tsx` | `AppShell` | top-bar, nav, banner offline, `<Outlet/>` |
| 5 | `apps/web/src/pages/calcular/calcular-page.tsx:106` | `CalcularPage` | a tela; único orquestrador do fluxo |

### 1.2 Form + schema

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 6 | `pages/calcular/calcular-page.tsx:107-117` | `useForm<CalcFormValues>` | RHF com `defaultValues: defaultCalcValues`, `resolver: calculatorResolver`, `mode:"onChange"` |
| 7 | `features/calculator/calculator-schema.ts:311` | `defaultCalcValues` | os 17 campos escalares como **strings pt-BR** (`"0,00"`) + `channels[]` + `otherCosts[]` |
| 8 | `features/calculator/calculator-schema.ts:147` | `calculatorSchema` (Zod) | parse pt-BR → number com bounds (`>0` para denominadores, `>=0` no resto) |
| 9 | `features/calculator/calculator-schema.ts:178` | `calculatorResolver` | adapta o Zod ao RHF (erros por campo, pt-BR) |
| 10 | `shared/lib/decimal-ptbr.ts` | `parseDecimal` / `formatBRL` | a **única** conversão string pt-BR ↔ number |
| 11 | `pages/calcular/calcular-page.tsx:258` | `const values = watch()` | RHF re-renderiza a cada tecla — não há botão "Calcular" |

### 1.3 Fee-catalog (served + cache offline + seed) — entra ANTES do compute

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 12 | `pages/calcular/calcular-page.tsx:249-255` | `useFeeCatalog()` | devolve `{catalog, source, refreshFailed, refreshing, refetch}` |
| 13 | `shared/fee-catalog/use-fee-catalog.ts:138` | `useFeeCatalog` | orquestra as **3 fontes**, nesta ordem: |
| 13a | `use-fee-catalog.ts:20` | `VALIDATED_SEED` | **piso síncrono** — o primeiro render sempre tem dado; seed inválido derruba só o marketplace ofensor |
| 13b | `shared/fee-catalog/seed.ts:68` + `seed.data.json` | `FEE_CATALOG_SEED` | JSON **gerado** (`pnpm fee:build`), nunca editado à mão |
| 13c | `use-fee-catalog.ts:146-154` | `loadPersistedCatalog` | hidrata o cache offline (IndexedDB, chave `"fee-catalog"`) |
| 13d | `use-fee-catalog.ts:157-170` | `useQuery(fetchServedCatalog)` | refresh online não-bloqueante → `GET /api/v1/fee-catalog`; sucesso persiste no IDB |
| 13e | `use-fee-catalog.ts:126` / `:59` | `adoptCatalog` / `freshest` | só adota se mais novo (`catalogVersion` = `"YYYY-MM-DD.n"`) |
| 13f | `shared/fee-catalog/fee-catalog.ts:398/407/427` | `feeCatalogSchema` / `parseFeeCatalog` / `parseSeedResilient` | contrato Zod (o mesmo para served, persistido e seed) |
| 14 | `backend/app/api/fee_catalog.py:219` | `get_fee_catalog` | serve `backend/app/data/catalog.json` com ETag (artefato também gerado pelo fee-ingest) |
| 15 | `packages/fee-ingest/src/build.mjs` | `pnpm fee:build` | compõe → valida → escreve o catalog.json do backend **e** o seed.data.json do front |
| 16 | `pages/calcular/calcular-page.tsx:257` | `catalogCtx` | o `CatalogContext` (`{catalog, source, now}`) que viaja para o modelo |

### 1.4 Modelo (adapter form ↔ engine)

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 17 | `pages/calcular/calcular-page.tsx:264` | `computeFromForm(values, catalogCtx)` | **a chamada** — síncrona, a cada render |
| 18 | `features/calculator/calculator-model.ts:443` | `computeFromForm` | o único seam entre strings pt-BR e o engine |
| 19 | `calculator-model.ts:444-452` | `calculatorSchema.safeParse` | escalar inválido ⇒ `{ok:false, fieldErrors}` e **nada** é computado |
| 20 | `calculator-model.ts:411` | `parseOtherCosts` | cada linha de "Outros custos" valida isolada |
| 21 | `calculator-model.ts:273` | `processSlot` | resolve as taxas efetivas de UM canal + o selo de honestidade |
| 21a | `calculator-model.ts:137` | `parseManualFees` | o que o vendedor digitou (`editedFields`) |
| 21b | `features/calculator/fee-prefill.ts:100` | `resolveSlot` | acha a `FeeEntry` por marketplace + modalidade + categoria (+ perfil Shopee), subindo a árvore |
| 21c | `fee-prefill.ts:228` | `entryToChannelFees` | `FeeEntry` (catálogo) → `ChannelFees` do engine |
| 21d | `calculator-model.ts:234` | `resolveSlotFees` | funde catálogo × override digitado. **Comissão digitada derruba a tabela de bandas**; taxa fixa digitada não |
| 21e | `fee-prefill.ts:163` | `resolveSurcharges` | sobretaxas marcadas — o id é a intenção, o catálogo tem o dinheiro |
| 21f | `fee-prefill.ts:319` | `feeSealState` | `reference`/`adjusted`/`none`/`stale` → o selo (`fee-seal.tsx`) |
| 22 | `calculator-model.ts:476-481` | monta o `PriceInput` | escalares + otherCosts + channels + `catalogVersion` (só se algum slot usou o catálogo) |

### 1.5 pricing-core — o compute canônico

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 23 | `packages/pricing-core/src/calculator.ts` | `computeCalculator(input)` | entrada do motor (barrel: `index.ts`) |
| 23a | `model-version.ts` + `calculator.ts` | `stripRetiredFields` | campos aposentados (`wasteGrams`) recusados **pelo nome**, antes de tudo |
| 23b | `errors.ts` (usadas em `calculator.ts`) | `assertNonNegative`/`assertPositive` | denominador ruim condena o cálculo inteiro (`ValidationError`) |
| 23c | `calculator.ts` (linha `material`) | `material` | `costPerRoll / (rollWeightKg*1000) * printGrams` |
| 23d | `calculator.ts` | `energy` | `printTimeHours * avgPowerKw * tariffPerKwh` |
| 23e | `calculator.ts` | `machine` | `(machineValue/lifetimeHours + manutenção/h) * printTimeHours` |
| 23f | `calculator.ts` | `producaoR` / `falhaR` | falha = `failurePct` sobre material+energia+máquina **já arredondados** (sem teto, deliberado) |
| 23g | `calculator.ts` | `finishingR`, `laborR`, `adminR` | fora da base de falha; admin = Σ otherCosts arredondados |
| 23h | `calculator.ts` | `custoTotal = sumMoney([...])` | a soma fecha com as linhas exibidas (WYSIWYG) |
| 23i | `calculator.ts` | `precoVarejo`/`precoAtacado` | `custoTotal × (1 + markup/100)` |
| 23j | `channel-slot.ts` | `computeChannel` | por canal, **isolado**: slot com erro devolve `error` + preços null, irmãos seguem |
| 23k | `channels.ts:416` | `grossUp(base, fees)` | o gross-up por nível (varejo e atacado separados) |
| 23l | `channels.ts:461-481` | ramo `PROGRESSIVE` | `progressiveAnnounce` (`:259`) + `progressiveCommission` (`:233`) |
| 23m | `channels.ts:483-493` | ramo `SELECTION` | `chooseBand` (`:330`) + `rankCandidate` (`:313`) |
| 23n | `channels.ts:495-503` | ramo plano | `grossUpOnce` (`:205`) + piso `minPerItem` |
| 23o | `channels.ts:424-439` | `finish` | frete: plano + voucher Shopee pela banda do anúncio; `liquido = anúncio − comissão − fixo − frete` |
| 23p | `channels.ts:443-448` | `unpriced` | nenhuma banda cobre o preço ⇒ `null`, nunca um preço emprestado |
| 23q | `rounding.ts` | `toMoney`/`sumMoney`/`MONEY_DP` | **única** fonte da regra de arredondamento (2dp ROUND_HALF_UP, ADR-0008) |
| 24 | `calculator-model.ts:483-560` | re-alinhamento | resultados voltam à posição do slot no form; `appliedBandFees` (`fee-prefill.ts:296`) re-deriva qual banda foi aplicada só para exibir |

### 1.6 Exibição

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 25 | `features/calculator/form-organisms/costs-section.tsx` | `CostsSection` | campos de custo (com `MachineCostFields` `:487` e `TimeHmField` `:409`) |
| 26 | `form-organisms/price-results.tsx` | `PriceResults` | **a saída**: PriceHero, BreakdownRow por linha, CostProportionBar, derivação do markup |
| 27 | `form-organisms/{marketplace-section,channel-slot}.tsx` | `MarketplaceSection` / `ChannelSlot` | "Preços por canal": anúncio + líquido por nível, `UnpricedLevel`, `FeeSeal` |
| 28 | `features/calculator/fee-seal.tsx` | `FeeSeal` | o selo de procedência |
| 29 | `form-organisms/other-costs-section.tsx` | `OtherCostsSection` | linhas nomeadas de "Outros custos" |
| 30 | `shared/lib/plausibilidade.ts` + `shared/ui/aviso.tsx` | avisos | heurísticas de plausibilidade (não bloqueiam) |
| 31 | `shared/i18n/messages.pt-br.ts` | `messages.calculator` | **toda** a cópia da tela |

### 1.7 Persistência — dois destinos distintos

**(A) Snapshot / Histórico (imutável — "o que eu cobrei"):**

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 32 | `pages/calcular/calcular-page.tsx:651` | `<RecordSnapshotButton source={{kind, freeze}}/>` | só existe com entitlement `active` |
| 33 | `features/history/record-snapshot-sheet.tsx:57` | `RecordSnapshotButton` | sem premium retorna `null` (não é botão cinza) |
| 34 | `record-snapshot-sheet.tsx:115` | `useState(() => source.freeze())` | **congela na ABERTURA** da gaveta — os números lidos são os gravados |
| 35 | `entities/history/frozen-payload.ts:336` | `freezePriceResult(result, input, provenance)` | dinheiro vira **string exata** (`toMoneyString` `:41`); kit: `freezeBomResult` `:356`; orçamento: `buildQuotePayload` `:395` |
| 36 | `record-snapshot-sheet.tsx:134-160` | `onSubmit` | monta `SnapshotIn` com `clientSnapshotId = crypto.randomUUID()`, base escolhida, relógio do device |
| 37 | `entities/history/use-history.ts:79` | `useRecordSnapshot` | `networkMode:"always"` |
| 38 | `entities/history/outbox.ts:138` | `enqueueSnapshot(uid, body)` | **IndexedDB primeiro** — falha aqui é falha honesta |
| 39 | `outbox.ts:303` | `drainOutbox(uid, {post})` | tenta a fila inteira; classifica cada falha, nunca lança |
| 40 | `use-history.ts:63` | `postSnapshot` → Orval | cliente gerado (`shared/api/generated.ts`) |
| 41 | `backend/app/api/history.py:375` | `record_snapshot` | `POST /api/v1/history`, gate `require_entitlement`, idempotente por `clientSnapshotId` (201 novo / 200 replay) |
| 42 | `pages/historico/snapshot-detail-page.tsx` | `SnapshotDetailPage` | releitura do congelado |

**(B) Cenário / "Minhas simulações" (config vivo, reabrível):** ver fluxo 2b.

---

## 2. Dois fluxos curtos

### 2a. Webhook do Mercado Pago → grant premium

| # | arquivo | símbolo | o que faz |
|---|---|---|---|
| 1 | `backend/app/api/billing.py:81` | `mercadopago_webhook` | `POST /api/v1/billing/webhook/mercadopago` — **pública** (MP não tem token Firebase) |
| 2 | `billing.py:87-93` | parse do body | não-JSON/não-dict ⇒ 401 direto |
| 3 | `billing.py:100-104` | `data_id` | lido do **query param** `?data.id=` primeiro (contrato real do MP), body como fallback |
| 4 | `backend/app/billing/signature.py:35` | `verify_signature` | HMAC sobre `id:{data_id};request-id:{x-request-id};ts:{ts};` vs `x-signature`. Falhou ⇒ 401 **antes de tocar o banco** |
| 5 | `billing.py:118-121` | guarda de ambiente | `body.live_mode` tem que casar com `app_env == "prod"` — sandbox nunca escreve grant de prod |
| 6 | `billing.py:127-144` | `lookup_verified_event` | **só agora** consulta o MP; indisponível ⇒ 503 (MP reenvia a cada 15 min) |
| 7 | `backend/app/billing/grant_writer.py:47` | `process_verified_event` | resolve a `Subscription` **só** por `event.subscription_ref`; sem match ⇒ zero escrita |
| 8 | `grant_writer.py:85-86` | guarda `period_end is None` | pagamento sem prazo não vira grant (senão premium eterno) |
| 9 | `grant_writer.py:88-101` | inbox `on_conflict_do_nothing` | exactly-once **estrutural** por `event_key` |
| 10 | `grant_writer.py:104-114` | grant + `sub.status="authorized"` | **mesma transação** |
| 11 | `grant_writer.py:119` / `:172` | `_open_grace` / `_revoke_for_refund` | `payment_failed` abre carência (`max(10,7)` dias); refund/chargeback revoga |
| 12 | `backend/app/entitlement/__init__.py:55` | `read_entitlement_state` | deriva `none\|active\|lapsed` do ledger **ao vivo** |
| 13 | `entitlement/__init__.py:92` / `:105` | `require_entitlement` / `require_catalog_read` | porta de escrita (só active) e de leitura (active ou lapsed) |
| 14 | `apps/web/src/entities/user/use-entitlement.ts:42` | `useEntitlement` | `GET /api/v1/entitlement`, cache uid-scoped |

Vizinhos: `billing.py:191` `create_checkout` · `billing/checkout.py:48` `start_checkout` ·
`billing/reconcile.py:41` `reconcile_all` · `scripts/grant_premium.py` (CLI do operador).

### 2b. Usuário salva um cenário e reabre (resolver read-time D3/D6)

**Salvar:** `calcular-page.tsx:628` `<SaveScenarioSheet>` (só com entitlement) →
`features/calculator/scenario-bridge.ts:140` `buildScenarioConfig` →
`entities/scenario/config-document.ts:247` `serializeScenarioConfig` (números viram strings exatas;
`channels` como **intenção** — `overridden` por campo, não o valor resolvido) →
`save-scenario-sheet.tsx:98` congela na abertura → `use-scenarios.ts:151` `useCreateScenario` →
`backend/app/api/scenarios.py:530` `create_scenario` (valida + gateia + grava) →
`scenarios.py:446` `_resnapshot_cost_basis` (em todo save, re-snapshota `costBasis.lastKnown`).

**Reabrir (D3/D6):** `use-scenarios.ts:72` `useScenarios` → `scenarios.py:422` `_render_out`
(ecoa o config verbatim EXCETO `costBasis`) → `scenarios.py:385` `_resolve_cost_basis_for_read`:
`AD_HOC` nunca degrada; `PRODUCT`/`KIT` cujo `ref` resolve (dono + não apagado) ⇒ **D3 live-reflect**
(`degraded:false`, valores atuais); não resolve ⇒ **D6 last-known** (`degraded:true`, o gravado).
Nunca em branco. → `scenarios-list-sheet.tsx:497` `scenarioOpenArgs` →
`calcular-page.tsx:159` `openScenario` → `scenario-bridge.ts:200` `applyScenarioConfig` →
`resolved-basis.ts:25/:39` `readResolvedCostBasis`/`canOpenOrigin` →
`scenario-context-bar.tsx:69` barra "você está editando X" →
`calcular-page.tsx:95/:271` `computeFormSignature`/dirty (assinatura fresca todo render — memoizar foi bug real) →
`scenario-bridge.ts:332` `discardedFieldNotice` (campo aposentado descartado ao reabrir).

---

## 3. "Quero mexer em X → comece por este arquivo"

| quero mexer em | arquivo(s) de entrada | símbolo chave |
|---|---|---|
| **custo de material/energia/máquina** | `packages/pricing-core/src/calculator.ts` | `computeCalculator` (linhas `material`/`energy`/`machine`). UI: `features/calculator/form-organisms/machine-cost-fields.tsx`, `features/calculator/machine-cost.ts` |
| **margem/lucro (markup)** | `packages/pricing-core/src/calculator.ts` | `percentMultiplier` + os dois `toMoney(custoTotal × …)`; campos em `calculator-schema.ts` `MARKUP_FIELDS` |
| **comissão de marketplace** | `packages/pricing-core/src/channels.ts` | `grossUp` (`:416`), `grossUpOnce` (`:205`), piso `minPerItem`; entrada por `computeChannel` (`channel-slot.ts`) |
| **bandas de preço progressivas** | `packages/pricing-core/src/channels.ts` | `progressiveAnnounce` (`:259`), `progressiveCommission` (`:233`), `chooseBand` (`:330`), `validateBandRules` (`:172`), `BandMode` (`:59`) |
| **frete/subsídio (voucher)** | `packages/pricing-core/src/channels.ts` | `finish` (`:424-439`) + `bandContaining` (`:124`); teto em `shared/fee-catalog/fee-catalog.ts:464` |
| **catálogo de tarifas (fetch/cache/seed)** | `shared/fee-catalog/use-fee-catalog.ts` | `useFeeCatalog` (`:138`); schema `fee-catalog.ts:398`; served `backend/app/api/fee_catalog.py:219`; gerador `packages/fee-ingest/src/build.mjs` |
| **autenticação (Firebase)** | `shared/lib/firebase.ts` + `shared/session/session-store.ts` | `useSessionStore`; guardas `app/router.tsx:52` `requireAuth`; backend `backend/app/auth.py` `current_claims` |
| **entitlement / premium gating** | `shared/billing/premium-gate.ts` (UI) + `backend/app/entitlement/__init__.py` (autoridade) | `premiumGate`, `useEntitlement` (`entities/user/use-entitlement.ts:42`), `require_entitlement`/`require_catalog_read` |
| **billing Mercado Pago** | `backend/app/api/billing.py` | `mercadopago_webhook` (`:81`), `create_checkout` (`:191`); regras em `backend/app/billing/{signature,checkout,grant_writer,subscription,reconcile}.py`; front `features/billing/` |
| **snapshots / histórico** | `entities/history/frozen-payload.ts` + `use-history.ts` | `freezePriceResult` (`:336`), fila `outbox.ts` (`enqueueSnapshot` `:138`, `drainOutbox` `:303`); backend `history.py:375` |
| **export PDF/CSV** | `entities/history/use-export.ts` + `backend/app/services/quote_render.py` | rotas `backend/app/api/export.py:44/:89`; UI `features/history/export-sheet.tsx` |
| **kits / BOM** | `packages/pricing-core/src/bom.ts` + `pages/bom/bom-page.tsx` | `computeBom`; hooks `entities/bom/use-bom.ts`; backend `backend/app/api/boms.py` |
| **cenários salvos** | `entities/scenario/config-document.ts` + `features/calculator/scenario-bridge.ts` | `serializeScenarioConfig` (`:247`), `applyScenarioConfig` (`:200`); backend `scenarios.py:385` |
| **catálogo (filamentos/impressoras/produtos)** | `features/catalog/catalog-panel.tsx` + `entities/catalog/use-catalog.ts` | `useFilaments`/`usePrinters`/`useProducts`; pré-fill `features/calculator/catalog-prefill.ts`; backend `backend/app/api/{filaments,printers,products}.py` |
| **design system tf-*** | `shared/ui/index.ts` + `apps/web/src/styles/tokens/*.css` | componentes `shared/ui/{button,card,field,alert,price-hero,breakdown-row,plist,segmented}.tsx`; guardas `styles/tf-class-uniqueness.test.ts`, `token-parity.test.ts` |
| **rotas / navegação** | `apps/web/src/app/router.tsx` | `routeTree` (`:136`), `requireAuth` (`:52`); shell `app/app-shell.tsx`; nav `widgets/{app-nav,top-bar}/` |
| **i18n / mensagens** | `shared/i18n/messages.pt-br.ts` (compositor) + `shared/i18n/messages/*.pt-br.ts` (um módulo por tela) | `messages`; erros de wire → pt-BR em `shared/api/error-messages.ts` |
| **logging / correlação** | `backend/app/observability.py` + `shared/observability/sentry.ts` | `configure_observability` (`:40`), `CORRELATION_HEADER`; `ApiError.correlationId` em `shared/api/transport.ts:36`; runbook `docs/observability.md` |

---

## 4. Fronteiras

**UI** — `apps/web/src/{pages,features,widgets,shared/ui}`. `pages/*` são as telas do router; orquestram
mas não decidem regra. `features/*` são fatias de comportamento (cada uma dona da própria cópia + estado
local). `widgets/*` é chrome sem domínio (`app-nav`, `top-bar`, `offline-banner`). `shared/ui/*` é o
design system `tf-*`, puro. Regra prática: se importa `messages.pt-br` e renderiza JSX, é UI.

**Regra de negócio** — `packages/pricing-core/src/{index,channels,rounding}.ts` é **a** fórmula:
zero-dependência, sem I/O, sem pt-BR, sem React; o backend jamais a replica. Um degrau acima,
`features/calculator/{calculator-model,calculator-schema,fee-prefill,scenario-bridge}.ts` é o *modelo do
calculador*: converte strings ↔ números, resolve qual tarifa se aplica, decide o selo, chama o engine —
mas nunca faz aritmética de dinheiro própria (todo valor passa por `toMoney`/`sumMoney`). No servidor a
regra é de **autorização e integridade**, não de preço: `backend/app/{entitlement,billing}/`,
`backend/app/validation.py` (folha pura de validadores financeiros) e o resolver D3/D6 de `scenarios.py`.

**Acesso a dados** — no front, três camadas: (1) `shared/api/generated.ts` — cliente **Orval gerado** do
OpenAPI, nunca editado à mão; (2) `shared/api/transport.ts` — wrapper manual (auth Firebase, `ApiError`
tipada com `code`+`correlationId`); (3) `entities/*/use-*.ts` — hooks TanStack Query (query keys, cache
uid-scoped, mutations), com offline em IndexedDB via `*-cache.ts` e `entities/history/outbox.ts`. No
backend: `backend/app/db/__init__.py` (`get_session`) é a única fonte de sessão; `models/__init__.py` são
as tabelas; os routers em `api/*.py` fazem as queries diretamente (não há camada repository).

**Quem vigia as fronteiras:**
- `eslint.config.mjs` — `eslint-plugin-boundaries`: direção FSD-Lite `app → pages → widgets → features →
  entities → shared`, `default: "disallow"`; bloqueia import entre irmãos. `generated.ts` é a única isenção.
- `.dependency-cruiser.cjs` — `no-circular`; `pricing-core-is-canonical` (o pacote nunca importa `apps/`);
  `fee-ingest-is-standalone`. Roda em `pnpm depcruise`.
- `backend/pyproject.toml [tool.importlinter]` — `settings`/`lib`/`validation` são folhas; três contratos de
  camadas: `api → entitlement → db`, `api → services → models`, `api → billing → models` (`uv run lint-imports`).
- Extras: `styles/tf-class-uniqueness.test.ts` e `token-parity.test.ts` vigiam o DS; `vitest.config.ts` mantém
  `packages/*/src/**` em **100%** de cobertura; `lefthook.yml` roda `pnpm gate:all` no pre-push (o mesmo literal da CI).

---

## 5. Glossário — qual nome é o canônico

Convenção vigente: **wire = camelCase inglês** · **UI = pt-BR** · comentários hoje misturam os dois
livremente (causa raiz de metade das colisões). Canônico = o nome a usar daqui em diante.

| Conceito | Nomes concorrentes encontrados | Canônico |
|---|---|---|
| comissão % do marketplace | `commissionPct`, `commission_pct`, "comissão", "taxa", "tarifa", `fee` | wire `commissionPct` · UI **"comissão"**. **Banir "tarifa" para marketplace** — tarifa já significa energia (`tariffPerKwh`) |
| taxa fixa por item | `fixedFee`, `fixedFeeRule`, "o fixo", `minPerItem`, `perItem` | **três conceitos distintos**: `fixedFee` (constante) · `fixedFeeRule` (função do preço) · `minPerItem` (piso da comissão) |
| custo opcional declarado | `surcharges`, `optionalSurcharges`, "sobretaxa", "custos opcionais" | `surcharges` no motor / `optionalSurcharges` no catálogo (distinção real) · UI "custos opcionais" |
| canal de venda | `channel`, `slot`, `marketplace` | **`channel`** = a configuração · **`marketplace`** = a identidade (ML/Amazon/Shopee) · **aposentar `slot`** |
| faixa de preço | `PriceBand`, "banda", "faixa", "janela", "window" | wire `band` · pt **"faixa"** (é o que o vendedor lê) |
| preço anunciado | `precoAnuncio*`, `anuncio`, "announce", "list(ing) price", `listPct` | wire `anuncio`/`precoAnuncio*` · comentários **"anúncio"**, nunca "announce"/"list" |
| recebido líquido | `liquido`, `net`, `netTotal` | ⚠️ colisão: `liquido`/`net` = após taxas do marketplace; `netTotal` (orçamento) = após **desconto** → renomear para `totalComDesconto`/`totalAfterDiscount` |
| orçamento vs histórico | `quote`, `kind:"QUOTE"`, `PRECO_ORCAMENTO`, `snapshot`, `history`/`historico`, rótulo "Orçamentos" | **`snapshot`** = o registro congelado (qualquer kind) · **`quote`** = o kind orçamento. O nó rota-`/historico`-com-rótulo-"Orçamentos" fica documentado aqui até decisão de produto |
| documento congelado | `snapshot`, `FrozenSnapshotPayload`, `payload`, "registro imutável" | wire `snapshot`/`payload` · UI "registro" |
| cenário | `scenario`, `config`, "cenário", "simulação" | `scenario` · UI "simulação" (rótulo das telas) — `config` é o *campo*, não o conceito |
| kit / conjunto | `bom`, `kit`, "assembly", "montagem" | wire `bom` (contrato do backend) · UI "kit" · **aposentar "assembly"/"montagem"** nos comentários |
| unidade do kit | `line`, `piece`/"peça", `item` | wire `line` · UI "peça" (kit) / "item" (orçamento) |
| selo / procedência | `seal`, `provenance`, `origin`, `source`/`feeSource` | `provenance` = de onde o **número** veio · `origin` = de onde o **registro** veio · `seal` = a apresentação |
| piso | `minPerItem`, `costFloor`, `publishedFloor`, `commissionPctMin`, `MIN_PARSE_ROWS` | manter os nomes ingleses específicos; em pt dizer sempre *piso de quê* |
| premium / plano | `entitlement`, `premium`, `plan`, `grant`, `subscription` | wire `entitlement` (+`status none\|active\|lapsed`) · UI "plano"/"Premium" · `grant`/`subscription` são mecanismos de billing, não sinônimos |
| dinheiro: quantizar × serializar × formatar | `toMoney`, `toMoneyString`, `toExactString`, `formatBRL`, `money()`, `fmt*` | **quantizar** = `toMoney` (só pricing-core) · **serializar** = `toMoneyString` · **formatar** = `formatBRL` (só `shared/lib/decimal-ptbr`) · `fmt` local: proibido |
| dono da linha | `owner_uid`, `owner`, "dono", "titular", `account_uid` | `owner_uid` (coluna) · prosa pt "dono" |
| apagar | `delete`, `deleted_at`, `tombstone`, `anonymized_at`, "eliminação" | `deleted_at` = soft-delete de linha · `tombstone` = marcador de sync · `anonymized_at` = LGPD; não intercambiar |

---

## 6. Como rodar, testar e debugar

### Subir o stack de dev

```bash
pnpm i                                  # raiz (pnpm 11, node >=24 <25 — ver .nvmrc)
docker compose up -d postgres           # porta 5433:5432, db "precifica3d"
cd backend && uv run alembic upgrade head

# backend — NO WINDOWS use SEMPRE o runner, nunca `uvicorn` direto (psycopg async quebra):
PORT=8000 P3D_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 uv run python scripts/run_e2e_server.py

# front + emulador Firebase Auth (o pnpm dev da raiz embrulha os dois):
pnpm dev
```

**Portas.** Dev solto: front `5173`, backend `8000`, auth emulator `9099`, Postgres `5433`.
**Full-stack / homologação / e2e: SEMPRE as dedicadas `4173` (preview) e `8100` (backend)** — outro
projeto do dono ocupa 5173/8000. MP stub: `8200`. Antes de diagnosticar e2e "flaky":
`netstat -ano | findstr "4173 8100 8200"` — um `vite preview` órfão em 4173 serve bundle congelado.

### Testes

```bash
pnpm gate:all        # o gate completo (= lefthook pre-push = CI)
pnpm gate:fe / pnpm gate:be
pnpm e2e             # Playwright (sobe preview+backend+MP stub)

# um teste só:
pnpm vitest run apps/web/src/features/calculator/calculator-model.test.ts
pnpm vitest run packages/pricing-core -t "progressive"
cd backend && uv run pytest tests/test_billing_webhook.py -k signature -q
cd backend && uv run pytest -q -x --no-cov       # rápido, sem gate de cobertura
```

### Logs de depuração

**Backend (structlog + correlação):** `observability.py:40` instala `CorrelationIdMiddleware`
(header **`X-Correlation-Id`**) + `_log_requests`. Cada request emite UMA linha JSON:
`{ts, level, correlationId, service, route, status, latencyMs, errorCode, releaseSha}`. Nível fixado
em INFO (`make_filtering_bound_logger`, `:35` — não há env var para debug hoje). Sentry só com
`P3D_SENTRY_DSN`. Na prática:

```bash
curl -i -H "X-Correlation-Id: dbg-001" http://localhost:8100/api/v1/entitlement
# o mesmo id volta no header, na linha de log e no envelope de erro
```

No browser, `transport.ts` lê o header da resposta e o carrega no `ApiError` — todo erro de API na
tela já tem o id que casa com a linha do backend. Runbook: `docs/observability.md`.

**Frontend:** `shared/observability/sentry.ts` (no-op sem `VITE_SENTRY_DSN`). **Não há logger
estruturado de front nem flag de debug** — React DevTools + breakpoints. Env do cliente validada por
Zod em `shared/lib/env.ts` (`VITE_API_BASE_URL` default `:8000` — troque para `:8100` em full-stack).

### Preço saiu errado: os 5 breakpoints (entrada → regras → saída)

O caminho de cômputo continua puro e sem trace (deliberado — ver Pendências no relatório); o que
GANHOU log estruturado na Onda 7 foi todo o resto (ver §7). O roteiro de debugger:

| ordem | breakpoint | o que inspecionar |
|---|---|---|
| 1. ENTRADA | `pages/calcular/calcular-page.tsx:264` `computeFromForm(values, catalogCtx)` | `values` (strings pt-BR), `catalogCtx.source` (`"seed"` vs `"catalog"`) e `catalogVersion`. **Metade dos "preço errado" morre aqui**: o servido não chegou e o seed antigo pré-preencheu |
| 2. PARSE | `calculator-model.ts:443-452` | `parsed.data` — números convertidos. `NaN`/casa perdida = `parseDecimal` (`shared/lib/decimal-ptbr.ts`) |
| 3. RESOLUÇÃO DE TARIFA (o mais provável) | `calculator-model.ts:273` `processSlot` | `manual.editedFields`, `resolution.entry`/`viaCatchAll`, e o retorno de `resolveSlotFees` — em particular `fees.priceBands` e `fees.bandMode`. Pegadinha campeã: *comissão digitada derruba a tabela de bandas inteira*; taxa fixa digitada é inerte sobre entrada bandada |
| 4. COMPUTE | `pricing-core/src/calculator.ts` `computeCalculator` e por canal os 3 ramos de `channels.ts` `grossUp` (PROGRESSIVE/SELECTION/plano) | cada valor é `Decimal` — no watch chame `.toString()`. `anuncio: null` = `unpriced` (nenhuma faixa cobre; intencional) |
| 5. SAÍDA | `features/calculator/form-organisms/price-results.tsx` `PriceResults` | `result` e `channelOutcomes[i].result`. Breakdown que "não fecha" = soma de linhas já arredondadas (proposital, `rounding.ts`) |

Bônus: se o preço está certo mas a **legenda** da faixa mente, o culpado é `appliedBandFees`
(`fee-prefill.ts:296`) — re-derivação de exibição, não o engine.

**Técnica de repro:** um snapshot gravado guarda `PriceInput` **e** `PriceResult` como strings exatas
(`freezePriceResult`). Peça ao usuário para salvar o cálculo, leia `GET /api/v1/history/{id}` e
reproduza o `input` num teste do `pricing-core` — é o melhor repro que existe hoje.

---

## 7. O que a refatoração de legibilidade mudou (Ondas 1–8, 2026-08-31)

**Novas casas (tudo por movimento verbatim; comportamento idêntico, provado por suíte + guardas):**

- `packages/pricing-core/src/` — `index.ts` é só o barrel (70 linhas): `model-version.ts` ·
  `errors.ts` · `rounding.ts` · `channels.ts` · `channel-slot.ts` · `calculator.ts` · `bom.ts` ·
  `quote.ts`. Guardas: `tests/public-surface.test.ts` (API pinada) + varredura version-equality.
  `bandContaining`/`bandFixedFee` agora são exportadas — as reimplementações em
  `fee-prefill`/`fee-catalog` morreram.
- `features/calculator/` — `calculator-form.tsx` é barrel (27 linhas) sobre `form-atoms/` ·
  `form-molecules/` · `form-organisms/` · `form-logic/` (24 arquivos). Novos módulos puros:
  `form-signature.ts`, `catalog-prefill-apply.ts`, `marketplace-change.ts`.
- `backend/app/models/` — pacote por agregado (`base/account/catalog/product/kit/observation/
  snapshot/scenario/billing`); o listener de imutabilidade mora AO LADO do `Snapshot`.
- `backend/app/api/catalog_resolver.py` — o lar público dos helpers compartilhados
  (products↔kits↔cenários); os imports privados com pyright-ignore morreram.
- `backend/app/billing/states.py` — `SubscriptionStatus(StrEnum)` + `NON_TERMINAL_STATUSES`.
- `backend/app/auth.py::Claims` — dataclass congelada; rotas usam `claims.uid`, não `claims["uid"]`.
- `shared/i18n/messages/` — o catálogo de strings dividido por tela; `messages.pt-br.ts` compõe.
- `shared/lib/decimal-leaf.ts` (serializador único dos documentos) · `shared/lib/uid-cache.ts`
  (fábrica dos 5 caches) · `shared/lib/use-cached-preload.ts` (pré-carga única).
- Telas: `catalog-panel` por ramo · `quote-builder` → picker/review · `historico-page` →
  ledger/master-detail/gate-states · `bom-page` → colunas/summary · `scenarios-list-sheet` →
  rename/delete próprios.

**Observabilidade nova (Onda 7 — aditiva, respostas byte-idênticas).** Eventos structlog:
`unhandled_error` (500 com exc_info + Sentry) · `webhook_signature_rejected` (7 motivos) ·
`grant_written`/`grace_opened`/`grants_revoked`/`event_unmatched`/`event_unboundable` ·
`name_conflict_resolved` · `snapshot_replay` · `auth_rejected`/`entitlement_denied`; `_emit` agora
carrega `excType`/`excMessage` e a rota por TEMPLATE (`/history/{snapshot_id}`), agregável. No
front: `unreachableStatus(operacao)` distingue os 29 throws no Sentry; o seed loga as
`ZodError.issues`.

**Freios instalados:** prettier `tabWidth: 4` · eslint `max-lines: 750` em fontes não-teste
(abaixe conforme os restantes encolherem) · pino de superfície do pricing-core · teste de
caracterização dos serializadores (`pages/decimal-leaf-characterization.test.ts`).

**Rodada 2 (continue do dono, 2026-08-31):** realinhamento do calculator-model com índice
explícito (`engineIndexBySlot` + `pricedSlotOutcome` — morre o `ep++` posicional) ·
`scoreCandidate` nomeada em `channels.ts` · 3 dos 5 `as unknown as` do duplicar-produto caem
(os 2 restantes têm causa raiz comentada: Out sem tipo no wire) · as 4 últimas páginas >590
encolhem para 245–472 linhas (14 irmãos novos em `pages/{calcular,catalogo,historico}/`) ·
ratchet `max-lines` abaixado para 600. A delegação do Zod ao `validateBandRules` foi avaliada e
PULADA com registro (mudaria caminhos de issues; pendência mantida no relatório).

**O que NÃO mudou de propósito:** os 11 bugs registrados no relatório (B1–B11) seguem intocados —
correção é decisão do dono; o vocabulário `account`/`conta` no i18n e o rótulo
"Orçamentos"/rota `/historico` aguardam decisão de produto; o trace opcional do motor
(`PriceResult.trace?`) segue como proposta.
