# Tasks: Remediação da Auditoria Adversarial 2026-07-23

**Input**: Design documents from `/specs/013-audit-remediation/` (spec.md · plan.md · research.md · data-model.md · contracts/api-deltas.md · quickstart.md) + `AUDITORIA.md` e `PLANO-CORRECAO.md` (raiz — evidência arquivo:linha de cada fix)

**Tests**: MANDATORY (Constitution III) — cada correção nasce do teste FAILING que codifica a entrada adversarial/mutação da auditoria (FR-017). US2/US3/US8 exigem homologação visual (qa-produto).

**Organization**: cada user story = 1 PR revisável partindo de `develop` (US6 pode dividir em 2). Roteamento ADR-0022 anotado por task: `[opus]` = domínio de dinheiro/pricing ou julgamento (escalação NON-NEGOTIABLE); demais = executor sonnet/medium. **Nenhuma task toca `backend/app/billing/**` ou `features/billing/**`** (isolamento do E6).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Criar branch `013-audit-remediation` a partir de `develop` e confirmar baseline verde (`pnpm gate:all` + `pnpm e2e`) antes de qualquer mudança; commitar `specs/013-audit-remediation/` nela
  - Baseline `gate:all` VERDE na árvore pristina (`gate:fe` ok; `gate:be` exigiu subir o Docker Desktop — sem daemon, 238 testes `requires_db` viram skip e a cobertura cai a 58% < 82%, que é o modo de falha ambiental, não de código). `pnpm e2e` baseline NÃO foi medido isoladamente: o estado gated de `develop` (todo merge exige e2e verde) é a referência, e a medição real acontece no T019 sobre o branch da US1 — se vier vermelho lá, bissecciona-se antes de atribuir à US1.
- [X] T002 Registrar no `docs/token-ledger.md` a linha de estimativa das ondas de implementação desta feature (regra do dono: estimar ANTES; realizar por onda no fechamento de cada PR)

---

## Phase 2: Foundational

**Purpose**: nada bloqueia todas as stories — as 8 são independentes por construção (plan §Structure). Única prerequisite transversal:

- [X] T003 Congelar as referências de auditoria: conferir que `AUDITORIA.md` e `PLANO-CORRECAO.md` estão commitados no branch (são a especificação arquivo:linha de cada fix) e que cada task abaixo cita o achado correspondente

**Checkpoint**: qualquer story pode começar, em qualquer ordem; a ordem recomendada é a das fases.

---

## Phase 3: User Story 1 — Nenhum preço silenciosamente errado por entrada numérica (P1) 🎯 MVP

**Goal**: matar a família FA-01/FB-01/FA-02/FA-06 com a gramática estrita (research §1) + preservar bands/voucher sob override (E1-02) + revalidação nos prefills (FA-03). Issues C-01 + C-14.

**Independent Test**: quickstart SC-001 — o conjunto adversarial completo nas duas superfícies.

### Tests for User Story 1 (write FIRST, observe FAILING) ⚠️

- [X] T010 [P] [US1] [opus] Testes FAILING da gramática em `apps/web/src/shared/lib/decimal-ptbr.test.ts`: tabela completa do research §1 (aceitos: `1500`→1500 · `0,12`→0.12 · `1.500,00`→1500 · `1.500`→1500 · `0.12`→0.12 · `1500.00`→1500 · `1.50`→1.5; rejeitados→null: `1,234,56` · `10-5` · `5x3` · `12,,5` · `1.5000` · string vazia pós-limpeza) + caso documentado `1.500`≡1500 (pt-BR vence)
- [X] T011 [P] [US1] Testes FAILING das superfícies em `apps/web/src/features/calculator/calculator-schema.test.ts` e `apps/web/src/features/catalog/catalog-schema.test.ts`: entrada rejeitada vira erro de campo (nunca valor silencioso); afixos `R$ `/unidade continuam tolerados
- [X] T012 [P] [US1] [opus] Teste FAILING do seam de override em `apps/web/src/features/calculator/calculator-model.test.ts`: slot Shopee coberto + 1 campo editado ⇒ `priceBands` e `freightVoucherBands` PRESENTES no compute; selo "ajustado por você" (achado E1-02 — a lacuna de teste nomeada)
- [X] T013 [P] [US1] Teste FAILING de prefill em `apps/web/src/pages/calcular/calcular.test.tsx`: campo com erro visível + prefill válido de catálogo ⇒ erro some sem toque manual (achado FA-03)

### Implementation for User Story 1

- [X] T014 [US1] [opus] Implementar a gramática estrita em `apps/web/src/shared/lib/decimal-ptbr.ts` (validar ANTES de converter; `parseFloat` só como conversão final) — T010/T011 verdes
- [X] T015 [US1] Consolidar `wireToPtBr` triplicado (`features/calculator/{catalog-prefill.ts:13,product-mapping.ts:18,scenario-bridge.ts:49}`) em export único de `apps/web/src/shared/lib/decimal-ptbr.ts` + teste que trava a premissa "wire tem no máximo um ponto" (achado FA-05)
- [X] T016 [US1] [opus] Merge seletivo no override em `apps/web/src/features/calculator/calculator-model.ts:170-179` — sobrescrever só os escalares digitados, preservar `priceBands`/`freightVoucherBands` do entry — T012 verde
- [X] T017 [US1] `{shouldValidate:true}` nos 4 `setValue` de prefill em `apps/web/src/pages/calcular/calcular-page.tsx:139-141,167-169,175-181,235` — T013 verde (5 sites: :139 escalares de cenário · :141 `includeMarketplace` · :168 filamento · :178 impressora · :235 reset de modalidade)
- [X] T018 [P] [US1] (desejável, mesmo PR) Unificar display: `apps/web/src/shared/ui/breakdown-row.tsx:19-26` e `price-hero.tsx:35-37` passam a usar `formatDecimal` (achado Q-01)
  - **PARCIAL, deliberado**: `price-hero.tsx` migrado (byte-idêntico — mesma locale/options). `breakdown-row.tsx` **NÃO** migrado: `calculator-form.tsx:394` o chama com `value={-freight}` e o componente renderiza negativo com glifo próprio U+2212 ANTES do prefixo (`−R$ 50,00`); `formatDecimal` produziria `R$ -50,00` — regressão visual real. Q-01 fica parcialmente aberto por decisão consciente (a task é "desejável", e um estouro visual no preço é pior que a duplicação).
- [ ] T018b [US1] Homologação visual (qa-produto, [opus]): estados de ERRO do parser nas duas superfícies (digitar o conjunto adversarial no calculator e no form de filamento, 390px + desktop — a mensagem de campo aparece, nenhum valor silencioso) — evidência PNG em `specs/013-audit-remediation/evidence/` (Constitution III — remediação C1 do analyze)
- [ ] T019 [US1] `pnpm gate:all` + `pnpm e2e` verdes; abrir PR de US1 para `develop`; ledger da onda; merge só com autorização do dono

**Checkpoint**: SC-001 provado — o maior risco de dinheiro do relatório morto.

---

## Phase 4: User Story 2 — Todo link do app abre (P1)

**Goal**: migrar as 3 rotas para query-param + redirects em 2 camadas (D1=A, research §2). Issue C-02.

**Independent Test**: quickstart SC-002 — `page.goto` direto nas URLs novas; redirects das antigas no emulador de hosting.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] e2e FAILING `apps/web/tests/e2e/deep-links.spec.ts`: `page.goto("/historico?snapshot=<id>")` e `page.goto("/catalogo?produto=<id>")` renderizam o conteúdo (a classe de teste hoje deliberadamente evitada — passa a existir); inclui refresh (reload) na tela aberta
- [X] T021 [P] [US2] Teste de router em `apps/web/src/app/router.guards.test.tsx`: rotas antigas (`/historico/$id`, `/catalogo/produtos/*`) redirecionam client-side para as novas preservando o id

### Implementation for User Story 2

- [X] T022 [US2] Migrar as 3 rotas em `apps/web/src/app/router.tsx:116,128,173` para `validateSearch` (`/historico?snapshot=` · `/catalogo?produto=novo|<id>`) e atualizar TODOS os `navigate`/`Link` internos (grep por `historico/` e `catalogo/produtos` em `apps/web/src`)
- [X] T023 [US2] Rotas antigas viram redirect client-side (≥1 release) em `apps/web/src/app/router.tsx`
- [X] T024 [US2] Redirects 301 com captura em `firebase.json` (`/historico/:id` → `/historico?snapshot=:id` etc.) + validar no emulador de hosting — risco declarado do research §2: se a captura não suportar, aplicar o fallback documentado e ANOTAR no PR
  - ⚠ **CONFIG ESCRITA, VALIDAÇÃO NÃO PROVADA — não tratar como verde.** O emulador local NÃO confirmou os redirects, e a causa foi isolada: no Windows, o `glob-slash` do `superstatic` passa o glob por `path.normalize`/`path.join` e troca `/` por `\`, então **NENHUM** redirect casa — inclusive um estático sem `:id`. O mesmo config casa corretamente em Node/Linux (WSL, `configMatcher: true`), e o Firebase Hosting real avalia redirects na infra do Google, não neste utilitário. Ou seja: é bug de tooling local, não evidência contra o `firebase.json`. **Verificação pendente**: runner Linux na CI OU `firebase hosting:channel:deploy` de preview. Como o deploy segue deferido até v1 (decisão do dono 2026-07-09), fica registrado como pendência nomeada em vez de bloquear a US2.
- [ ] T025 [US2] Homologação visual (qa-produto, [opus]): abrir cada URL nova fria (390px + desktop), F5 na tela aberta, URL antiga redirecionando — evidência PNG em `specs/013-audit-remediation/evidence/`
- [ ] T026 [US2] Gate + e2e verdes; PR de US2; ledger; autorização do dono

**Checkpoint**: SC-002 provado; achado F-02 (Alto) morto sem tocar `base`.

---

## Phase 5: User Story 3 — Catálogo honesto para conta lapsed (P1)

**Goal**: banner + forms somente-leitura + convite de reativação, padrão copiado de cenários/kits (research §4). Issue C-03.

**Independent Test**: quickstart SC-003 — conta com grant expirado nas 3 superfícies.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Testes de componente FAILING em `apps/web/src/features/catalog/filament-form.test.tsx`, `printer-form.test.tsx` e `apps/web/src/pages/catalogo/produto-page.test.tsx`: com entitlement lapsed ⇒ `fieldset` desabilitado + rodapé de reativação; com active ⇒ editável (regressão)
- [X] T031 [P] [US3] Teste FAILING em `apps/web/src/pages/catalogo/catalogo.test.tsx`: lapsed vê banner `catalogo.lapsedTitle`/`lapsedBody` + listas completas (leitura integral preservada — FR-409 do E2 intacto); `none` continua vendo o teaser (não o banner)

### Implementation for User Story 3

- [X] T032 [US3] Cópia de reativação nova em `apps/web/src/shared/i18n/messages.pt-br.ts` (conforme `specs/007-e2-catalog-entitlement/ux-catalog.md:550-552`); ligar as strings órfãs `:316-319`
- [X] T033 [US3] `useEntitlement()` em `apps/web/src/pages/catalogo/catalogo-page.tsx:101` + prop `readOnly` descendo para `apps/web/src/features/catalog/{filament-form.tsx,printer-form.tsx}` e `apps/web/src/pages/catalogo/produto-page.tsx` (padrão de `scenarios-list-sheet.tsx:313`/`bom-page.tsx:412`); corrigir o comentário afirmativo-falso de `filament-form.tsx:12`
- [ ] T034 [US3] Homologação visual (qa-produto, [opus]): lapsed em 390px + desktop nas 3 superfícies + a transição lapsed→active reabilitando sem re-login — evidência PNG
- [ ] T035 [US3] Gate + e2e verdes; PR de US3; ledger; autorização do dono

**Checkpoint**: os 3 Altos da auditoria mortos (FA-01/FB-01 · F-02 · FB-02).

---

## Phase 6: User Story 4 — Fronteiras de validação consistentes (P2)

**Goal**: `backend/app/validation.py` único + espelho front (research §3, data-model §1). Issues C-06 + C-07.

**Independent Test**: quickstart SC-004 — over-ceiling em tudo ⇒ 422 nunca 500.

### Tests for User Story 4 ⚠️

- [X] T040 [P] [US4] [opus] Testes FAILING espelho em `backend/tests/test_boms.py`: `tariffPerKwh ≥ CEIL_RATE` em linha ad-hoc nova ⇒ 422 (nunca 500 — achado E3-01); `quantity > CEIL_QUANTITY` ⇒ 422 (E3-02); `lines: []` ⇒ 422 (D4)
- [X] T041 [P] [US4] Teste FAILING em `backend/tests/test_history.py`: leaf int em posição de dinheiro (`totals`/`breakdown`) ⇒ 422 (achado E4-01); e em `backend/tests/test_scenarios.py`: teto `CEIL_CONFIG_LEAF` continua o vigente (paridade explícita, não silenciosa)
- [X] T042 [P] [US4] Testes FAILING front: teto de magnitude no `numField` de `apps/web/src/features/catalog/catalog-schema.test.ts` (erro inline "valor muito alto" — FB-05); nota >500 no rename em `apps/web/src/features/scenarios/scenarios-list-sheet.test.tsx` com a string `t.noteTooLong` (FB-03)

### Implementation for User Story 4

- [X] T043 [US4] [opus] Criar `backend/app/validation.py` (módulo-folha: constantes `CEIL_*` da tabela data-model §1 + `finite_non_negative` + `reject_bad_leaves(node, *, money_ceiling)` parametrizado); contrato import-linter novo em `backend/pyproject.toml` (validation = leaf, padrão do contrato de settings)
- [X] T044 [US4] [opus] Migrar os 5 routers por substituição 1:1 (`backend/app/api/{products.py:45-68,filaments.py:41-46,printers.py:36-42,history.py:83-129,scenarios.py:80-116,boms.py:91-106}`); matar o comentário "mirrors verbatim" falso de `scenarios.py:93` (achado Q-04); `BomLineIn` ganha os tetos (E3-01/E3-02)
- [X] T045 [US4] `BomIn.lines` `min_length=1` em `backend/app/api/boms.py` (D4) + **regen obrigatório**: verificar o comando de regen REAL no `ci.yml`/`package.json` (o nome `export_openapi` do quickstart foi assumido — remediação A1 do analyze) e rodá-lo + `pnpm gen:api` do ROOT + `git diff --exit-code` provando idempotência (contracts §1 — a lição do drift-guard)
- [X] T046 [P] [US4] Front: tetos no `numField` de `apps/web/src/features/catalog/catalog-schema.ts` (FB-05) + validação de nota no rename em `apps/web/src/features/scenarios/scenarios-list-sheet.tsx:198-235,391-403` (FB-03)
  - 6 tetos espelhando `backend/app/validation.py` 1:1 (`CEIL_MONEY`/`CEIL_KG`/`CEIL_GRAMS`/`CEIL_HOURS`/`CEIL_KW`/`CEIL_RATE`), string nova `v.tooHigh`. **Limite declarado**: `CEIL_QUANTITY` (quantity de linha de BOM) e `CEIL_CONFIG_LEAF` (walker JSONB de cenários/histórico) **NÃO** foram espelhados — ficam fora dos arquivos que FB-05/FB-03 nomeiam. O servidor segue rejeitando com 422 correto; o cliente é que não antecipa com mensagem inline. Follow-up delimitado, não lacuna silenciosa.
- [ ] T047 [US4] Gate verde (inclui import-linter novo); PR de US4 (pode dividir BE/FE em 2 PRs se o diff passar de ~400 linhas); ledger; autorização do dono

**Checkpoint**: SC-004 provado; a 6ª cópia divergente é impossível por construção.

---

## Phase 7: User Story 5 — Regressões de privacidade/migração não passam (P2)

**Goal**: os testes-guarda das mutações da auditoria (research §5). Issues C-08 + C-09 + C-10.

**Independent Test**: quickstart SC-005 — as 4 mutações aplicadas uma a uma ⇒ 4 vermelhos.

### Tests for User Story 5 (a story É os testes) ⚠️

- [X] T050 [P] [US5] Estender `apps/web/src/app/providers.test.tsx:34-55`: popular as 5 chaves idb + 6 query-roots; asserção POR CHAVE nos dois branches (→anonymous varre tudo salvo outbox; u1→u2 direto varre u1) — achado T-02
- [X] T051 [P] [US5] Teste `requires_db` novo `backend/tests/test_migrations.py`: `upgrade head → downgrade base → upgrade head` + `to_regclass` nulo pós-downgrade para `subscriptions`/`billing_events`/`scenarios`/`snapshots` — achado T-01
- [X] T052 [P] [US5] Passo `alembic heads` (== exatamente 1) em `scripts/check-migrations.sh` — achado P-03
- [X] T053 [P] [US5] Teste novo em `backend/tests/test_scenarios.py`: kit de 2+ linhas com UMA linha de produto deletado, shape resolvido via `GET /scenarios/{id}` (estender `_mk_kit_with_ad_hoc_line:837`) — achado E5-04
- [X] T054 [P] [US5] `vitest.config.ts:20`: exclusão de coverage restrita a `apps/web/src/shared/api/generated.ts` (transport/error-messages voltam ao piso) — achado T-07
- [X] T054b [P] [US5] Registrar T-06 (truncate autouse nos testes DB não-billing) como consciente-não-feito em `docs/tech-debt.md`, com gatilho de re-abertura "primeiro uid-literal duplicado ou asserção de contagem global order-dependente" (remediação G2 do analyze — decisão explícita, não silêncio)

### Implementation for User Story 5

- [X] T055 [US5] Prova das 4 mutações no PR (aplicar → vermelho → reverter, quickstart SC-005), com o output colado na descrição do PR
- [ ] T056 [US5] Gate + e2e verdes; PR de US5; ledger; autorização do dono

**Checkpoint**: SC-005 provado — "o código implementa, o teste verifica".

---

## Phase 8: User Story 8 — Pré-fill de taxas ML e Amazon (P2)

**Goal**: curadoria D3=B com protocolo de fonte + gate do dono (research §6, data-model §2). Parte do FR-015.

**Independent Test**: quickstart SC-008.

### Tests for User Story 8 ⚠️

- [ ] T060 [P] [US8] Teste FAILING de paridade `apps/web/src/shared/fee-catalog/seed.test.ts`: `FEE_CATALOG_SEED` ≡ `backend/app/data/catalog.json` byte-a-byte (a paridade vira guarda executável para as entradas novas; a validação do seed pelo `parseFeeCatalog` — E1-06 — vive em US6/T075, desacoplada do gate do dono)
- [ ] T061 [P] [US8] Teste FAILING de prefill em `apps/web/src/features/calculator/fee-prefill.test.ts`: slot ML ⇒ taxas pré-preenchidas + selo "referência"; slot Amazon ⇒ `minPerItem: 1.00` aplicado (SC-112)

### Implementation for User Story 8

- [ ] T062 [US8] [opus] Levantar as tarifas oficiais (ML Clássico BR — comissão/faixas; Amazon BR — comissão padrão + piso R$ 1) com `sourceUrl` + `effectiveDate` + data de coleta, na ordem de sourcing registrada (fonte determinística/oficial; WebSearch fallback; API 403-bloqueada); entregar como TABELA-PROPOSTA no PR, sem tocar código ainda
- [ ] T063 [US8] **GATE DO DONO (bloqueante)**: Jonatan valida cada valor da tabela-proposta — nenhum número entra sem aprovação explícita (FR-015, Truth Over Approval); granularidade por-categoria fica DECLARADA como fora do schema atual (research §6 — se o dono quiser, é evolução futura, flag no PR)
- [ ] T064 [US8] Entradas aprovadas em `backend/app/data/catalog.json` + espelho em `apps/web/src/shared/fee-catalog/seed.ts` + bump do `catalogVersion` — T060/T061 verdes
- [ ] T065 [US8] Homologação visual (qa-produto, [opus]): selecionar ML e Amazon no calculator, selo + valores visíveis, 390px — evidência PNG
- [ ] T066 [US8] Gate verde; PR de US8; ledger; autorização do dono (o merge é a segunda assinatura sobre os valores)

**Checkpoint**: SC-008 provado; FR-105a da spec 005 finalmente verdadeiro no produto shipado.

---

## Phase 9: User Story 6 — Lote de correções pontuais (P3)

**Goal**: os fixes P remanescentes de C-11 (backend) + C-12 (front) + C-13 (CORS/higiene). Pode dividir em 2 PRs (BE/FE).

**Independent Test**: cada item tem o teste do achado; gate verde.

### Tests for User Story 6 ⚠️

- [ ] T070 [P] [US6] [opus] Teste FAILING em `backend/tests/test_scenarios.py`: PUT de cenário base-KIT com kit vivo alterado ⇒ `lastKnown` re-capturado (achado E5-01); e duplicate com nome de 118 chars ⇒ "Cópia de …" truncando a BASE com reticências ≤120 (achado E5-02)
- [ ] T071 [P] [US6] Testes FAILING front: `freshest()` com `2026-07-07.10` vs `.2` escolhe a .10 em `apps/web/src/shared/fee-catalog/use-fee-catalog.test.ts` (E1-03); products-panel com referências em loading mostra placeholder neutro, nunca "Manual · Manual", em `apps/web/src/features/catalog/products-panel.test.tsx` (FB-04)
- [ ] T072 [P] [US6] Teste FAILING em `backend/tests/test_history.py`: payload profundo/grande rejeitado ANTES da varredura recursiva (E4-02); `from`/`to` naïve ⇒ 422 exigindo tz (E4-05)

### Implementation for User Story 6

- [ ] T073 [US6] [opus] Backend: `_resnapshot_cost_basis` cobre `kind=="KIT"` via `_resolve_kit_last_known` em `backend/app/api/scenarios.py:473-501` + corrigir o comentário do docstring e o de `backend/tests/test_scenarios.py:952-953`; ellipsis F5 em `scenarios.py:677-679`
- [ ] T074 [P] [US6] Backend: `owner_uid` no where de `_live_links` em `backend/app/api/products.py:421-438` (E2-03); size-cap antes de `_reject_bad_leaves` + limite de profundidade em `backend/app/api/history.py:159-205` (E4-02); tz-aware em `history.py:388-389` (E4-05)
- [ ] T075 [P] [US6] Front: fix `freshest()` em `apps/web/src/shared/fee-catalog/use-fee-catalog.ts:27-29`; `FEE_CATALOG_SEED` validado pelo `parseFeeCatalog` no boot em `use-fee-catalog.ts:86-89` (achado E1-06 — movido de US8 pela remediação G1 do analyze); placeholder isLoading em `apps/web/src/features/catalog/products-panel.tsx:26-35`; comparação de regime em Decimal em `packages/pricing-core/src/channels.ts:69,109-110` (E1-05, desejável — [opus] se tocado, é pricing-core)
- [ ] T076 [P] [US6] Front DS: remover os 10 ícones mortos de `apps/web/src/shared/ui/icon.tsx` (FC-01); mover as 3 strings para `messages.pt-br.ts` e injetar via prop em `toast.tsx:64,76` e `dialog.tsx:44` (FC-02)
- [ ] T077 [US6] CORS restrito em `backend/app/main.py:82-94` (métodos/headers do contracts §2) + apagar `.config/rtk/filters.toml` (P-02); e2e/preview verdes como prova de que nada quebrou
- [ ] T077b [US6] Homologação visual (qa-produto, [opus]): products-panel em carregamento frio mostra placeholder neutro (nunca "Manual · Manual"); DS após remoção de ícones/moves de strings sem regressão visível (Toast/Dialog com aria corretos), 390px + desktop — evidência PNG (Constitution III — remediação C1 do analyze)
- [ ] T078 [US6] Gate + e2e verdes; PR(s) de US6; ledger; autorização do dono

**Checkpoint**: todos os fixes de código do escopo entregues.

---

## Phase 10: User Story 7 — Passe documental (P3, INDEPENDENTE — pode rodar cedo)

**Goal**: as 12 claims reconciliadas num PR docs-only (FR-014 + Clarifications D2/D4/D5/D6). Issue C-15.

**Independent Test**: quickstart SC-006 — grep por claim.

### Tests for User Story 7

- [X] T080 [US7] Checklist de verificação por grep (quickstart SC-006) colado na descrição do PR — cada claim com o comando e o resultado esperado (docs-only: o "teste" é a inspeção reproduzível)

### Implementation for User Story 7

- [X] T081 [P] [US7] `specs/007-e2-catalog-entitlement/dod-evidence.md:30` — remover "RLS backstop" da evidência SC-308 (E2-02); `specs/011-token-optimization/dod-evidence.md:104-106,173-175` — corrigir a frequência do banner rtk (P-01)
- [X] T082 [P] [US7] `specs/005-marketplace-multichannel/spec.md:126,130,199,233` — Clarification datada oficializando o show/hide (D2=A, FA-04) + nota SC-109→3.1.0 por ADR-0016 (E1-07)
- [X] T083 [P] [US7] `.specify/memory/constitution.md:100` — "orchestrates"→"advises on" + bump PATCH 1.1.0→1.1.1 com sync-impact report (F-01, per §Governance)
- [X] T084 [P] [US7] `backend/app/auth.py:1-7` — docstring atualizada para o uso real (F-03); `apps/web/src/pages/catalogo/catalogo-page.tsx:19` — comentário "auth-guarded" corrigido (E2-04)
- [X] T085 [P] [US7] `specs/009-e4-history-snapshots-export/data-model.md` — remover o `server_default` não-implementado (E4-03) e reconciliar o nome do UNIQUE no §4/§6.1 (E4-04); nota no ADR-0012 sobre o lookup real (E2-05)
- [X] T086 [P] [US7] `CLAUDE.md` — ground atualizado (E6 não está mais UNSTARTED; registrar 013 em andamento) (M-01); `docs/decisions-backlog.md:92` — disclaimer cobre §9 (P-04); registrar D4/D5/D6 (Clarification na spec 008 para min_length; nota da decisão autoUpdate silencioso; premissa single-tab do outbox em `docs/tech-debt.md` com gatilho de telemetria)
- [ ] T087 [US7] PR docs-only de US7; autorização do dono

**Checkpoint**: SC-006 provado; risco sistêmico nº 1 zerado para a lista catalogada.

---

## Phase 11: Polish & Cross-Cutting

- [ ] T090 Rodar o quickstart inteiro (todas as seções) numa passada final no branch de integração e colar o resultado em `specs/013-audit-remediation/dod-evidence.md` (criar — evidência por SC, padrão da casa)
- [ ] T091 [P] Atualizar `AUDITORIA.md` com uma seção "Status da remediação" (tabela achado→PR que o fechou) — a auditoria vira rastreável até o fim
- [ ] T092 [P] Fechar as linhas do `docs/token-ledger.md` (estimativa→real por onda) e `graphify update .` se os hooks não cobrirem (doc/paper muda via skill path)
- [ ] T093 Gate final `pnpm gate:all` + `pnpm e2e` no último PR; DoD da constituição conferido (spec limpa · testes verdes · visual homologado · sem código morto novo)

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2, trivial)** → stories em qualquer ordem.
- **US1, US2, US3** (P1): independentes entre si — podem correr em paralelo (arquivos disjuntos: parser/calculator · router/firebase · catalog forms). Ordem recomendada: US1 primeiro (MVP — maior risco de dinheiro).
- **US4** (P2): independente; T045 (min_length+regen) é o único com risco de conflito de contrato — não rodar em paralelo com outro PR que mude OpenAPI.
- **US5** (P2): independente; T050 toca `providers.test.tsx` (nenhuma story toca `providers.tsx` em si).
- **US8** (P2): T062→T063 (GATE DO DONO)→T064 é estritamente sequencial; T060/T061 podem ser escritos antes do gate.
- **US6** (P3): T073/T074 tocam `scenarios.py`/`history.py` — **rodar DEPOIS de US4** (que migra esses arquivos para o validation module) para evitar conflito; resto independente.
- **US7** (P3, docs-only): pode rodar A QUALQUER MOMENTO após Setup — recomendado cedo (restaura a confiança nos docs que os PRs citam). Única dependência: T086 (CLAUDE.md ground) idealmente após o merge do PR-A do E6 ou com redação que não conflite.
- **Polish**: após todas as stories desejadas.

## Parallel Example: os três P1 em paralelo

```text
Dev A (US1): T010–T019  — shared/lib + features/calculator
Dev B (US2): T020–T026  — app/router + firebase.json + e2e novo
Dev C (US3): T030–T035  — features/catalog + pages/catalogo + i18n
US7 (docs): T080–T087 em paralelo com qualquer um (arquivos de docs)
```

## Implementation Strategy

- **MVP = US1** (Phase 3): um PR, mata o risco nº 1 do Top-10. Parar e validar SC-001 antes de seguir.
- **Entrega incremental**: US1 → US2 → US3 (os 3 Altos mortos) → US4+US5 (estrutural+guardas, paralelos) → US8 (gate do dono no meio) → US6 → US7 quando conveniente → Polish.
- **Cada PR**: testes FAILING primeiro (commit separado provando o vermelho), fix, gate:all + e2e, ledger da onda, autorização do dono para merge (regra da casa).
- Roteamento: tasks [opus] = parser/override/validation/lastKnown/pricing-core/curadoria + homologações qa-produto; restantes = executores sonnet/medium (ADR-0022); lifts de effort só com registro no ledger.
