# F02A — Drift spec↔código: 001, 002, 003, 004, 005

## Resumo
44 FR + 20 SC avaliados nas 5 specs antigas (001–005). Maioria **IMPLEMENTADO** (tabelas compactas por
spec). Achados de drift reais: **1 DIVERGENTE** (001 FR-002, a calculadora deixou de exigir login — mas
isso é **DIVERGENTE-POR-DECISÃO**, a 003 reescreveu essa regra deliberadamente), **1 AUSENTE-POR-DECISÃO**
(001 FR-010, deploy público — adiado até v1 por decisão do dono), **1 nota já auto-registrada na própria
spec** (005 SC-109, `PRICING_MODEL_VERSION` citado como "3.0.0" mas o pacote está em 3.1.0 desde a E3 —
a spec já sinaliza isso). Nenhum FR core do modelo de precificação (004/005) está AUSENTE ou DIVERGENTE
sem decisão — as fórmulas em `packages/pricing-core/src/index.ts` batem linha a linha com FR-024–039 e
FR-110–119. O drift mais grave encontrado é de **documentação, não de comportamento**: a spec 001 nunca
foi emendada para registrar que 003 tornou a calculadora pública, o que um leitor apressado da 001 sozinha
leria errado.

---

## specs/001-walking-skeleton/spec.md

| FR/SC | Classificação | Local |
|---|---|---|
| FR-001 (sign-in Google) | IMPLEMENTADO | `apps/web/src/app/router.tsx:52-54` (`requireAuth`), fluxo Google em `features/auth` |
| FR-003 (server enforça auth) | IMPLEMENTADO | `backend/app/api/me.py:18` (`current_claims`, só 401 alcançável) |
| FR-004 (campos cost/roll/weight/grams/markup) | IMPLEMENTADO — mas os campos hoje fazem parte do modelo completo (ver FR-005/006) | `apps/web/src/features/calculator/calculator-schema.ts` |
| FR-007 (BRL) | IMPLEMENTADO | `apps/web/src/shared/lib/decimal-ptbr.ts` (`formatBRL`) |
| FR-008 (offline) | IMPLEMENTADO | PWA + `computeCalculator` client-side, `apps/web/tests/e2e/calculator.spec.ts` |
| FR-009 (mobile-first, pt-BR) | IMPLEMENTADO | `apps/web/src/shared/i18n/messages.pt-br.ts` + shell responsivo |
| FR-011 (validação, msgs amigáveis) | IMPLEMENTADO | `calculator-schema.ts` + `ValidationError` em `pricing-core` |

### [F02A-001] FR-002 — a calculadora deixou de exigir login
- Spec/AC: FR-002 (`specs/001-walking-skeleton/spec.md:67`) — "System MUST restrict the calculator to
  authenticated users and direct signed-out visitors to sign in."
- Classificação: **DIVERGENTE-POR-DECISÃO**
- Certeza: 95%
- Local: `apps/web/src/app/router.tsx:64,75` (comentário: "`/` → `/calcular` (path redirect, not an auth
  gate)"; "offline. No `beforeLoad` auth check.")
- Evidência: a rota `/calcular` não tem `requireAuth` no `beforeLoad`. A decisão está registrada na própria
  003: `specs/003-app-shell-and-ds/spec.md:175-176` FR-003 — "Calcular MUST be usable without signing in and
  without a network connection" — e `specs/003-app-shell-and-ds/tasks.md:267` confirma explicitamente: "The
  one behavioral change (Calcular becomes public) is US2/T038 — spec'd (US2), not drift."
- Origem: develop (decisão de 003, não do PR #36 em auditoria)

### [F02A-002] FR-005/FR-006 — a fórmula de duas linhas foi substituída pelo modelo completo
- Spec/AC: FR-005/FR-006 (`specs/001-walking-skeleton/spec.md:72-73`) — `material_cost = cost_per_roll ÷
  (roll_weight_kg × 1000) × grams`; `suggested_price = material_cost × (1 + markup%)`.
- Classificação: **DIVERGENTE-POR-DECISÃO**
- Certeza: 98%
- Local: `packages/pricing-core/src/index.ts:133-239` (`computeCalculator`) implementa o modelo completo
  (material+energia+máquina+falha+acabamento+mão-de-obra+admin, markup sobre `custo_total`).
- Evidência: a própria 004 se declara substituta explícita — `specs/004-e1-pricing-model/spec.md:9-21`
  ("build the full corrected clean-room pricing model... markup over cost_total"). O código de produção
  (`apps/web/src/features/calculator/calculator-model.ts`) chama `computeCalculator`, nunca a fórmula de duas
  linhas de 001.
- Origem: develop

### [F02A-003] FR-010 — deploy público ainda não existe
- Spec/AC: FR-010 (`specs/001-walking-skeleton/spec.md:78`) — "The application MUST be deployed and
  reachable on the web."
- Classificação: **AUSENTE-POR-DECISÃO**
- Certeza: 90%
- Local: `.github/workflows/deploy.yml` existe (scaffold), mas não há evidência de execução real (nenhum
  ambiente GCP provisionado, per `specs/002-foundation/dod-evidence.md` item 4 "Jonatan's manual
  prerequisites", ainda listado como pendente).
- Evidência: decisão do dono registrada em `CLAUDE.md` ("OWNER DECISION 2026-07-09: provisioning + first
  deploy DEFERRED until v1 complete = E1–E6") e no primeiro release cut mencionado em
  `specs/006-uat-deploy-hardening/dod-evidence.md`. Não encontrei um ADR dedicado a essa decisão — só a nota
  de decision-log em `CLAUDE.md`; ver "Não verificado".
- Origem: develop

### [F02A-004] Key Entity "Price Calculation" — "Not persisted in this slice" deixou de ser verdade em geral
- Spec/AC: Key Entities (`specs/001-walking-skeleton/spec.md:85-86`) — "Not persisted in this slice."
- Classificação: **DIVERGENTE-POR-DECISÃO**
- Certeza: 85%
- Local: `apps/web/src/features/history/`, `apps/web/src/features/scenarios/` (diretórios existentes)
- Evidência: E4 (`specs/009-e4-history-snapshots-export`) e E5 (`specs/010-e5-saved-scenarios`) introduzem
  persistência de cálculos como funcionalidade premium — decisão posterior explícita, não regressão. A
  frase da 001 era corretamente escopada "in this slice" — não é um drift real, é a leitura isolada de uma
  spec antiga sem o contexto dos épicos seguintes.
- Origem: develop

**SC-001..SC-005**: cobertos transitivamente pelos testes e2e atuais (`apps/web/tests/e2e/calculator.spec.ts`,
`focus-to-title.spec.ts`, `a11y-overflow.spec.ts`), mas nenhum teste isola literalmente "sign-in em <30s"
(SC-001) — ver Não verificado.

---

## specs/002-foundation/spec.md (increment de tooling, não produto)

Sem drift material encontrado. Tabela compacta (verificado contra o estado atual do repo, não apenas o
`dod-evidence.md` de 2026-06-29):

| FR | Classificação | Local |
|---|---|---|
| FR-C1.1–C1.3 (pnpm/Node24/catalog) | IMPLEMENTADO | `package.json:5-6` (`packageManager`, `engines`), `pnpm-workspace.yaml:7` (`catalog:`) |
| FR-C2.1–C2.4 (gates local==CI) | IMPLEMENTADO | `package.json:19-22` (`gate`/`gate:fe`/`gate:be`/`gate:all`), `.github/workflows/ci.yml:13-32` roda o MESMO `pnpm gate:all`, `lefthook.yml:20` idem |
| FR-C3.1–C3.5 (backend skeleton, envelope, structlog, /health, emulator) | IMPLEMENTADO | `backend/app/main.py:121-122` (`/health`), `backend/app/api/me.py:18` (401 via `current_claims`) |
| FR-C4.1–C4.3 (Orval + drift-guard) | IMPLEMENTADO | `.github/workflows/ci.yml:50-70` (job `contract-drift`), `vitest.config.ts:28` exclui `shared/api/generated.ts` do coverage (confirma client committed) |
| FR-C5.1–C5.5 (frontend skeleton) | IMPLEMENTADO (evoluído bastante desde então, mas a base persiste) | `apps/web/src/app/`, `apps/web/src/shared/ui/` |
| FR-C6.1–C6.2 (Auth emulator) | IMPLEMENTADO | `firebase.json` presente |
| FR-C7.1 (runbook observabilidade) | IMPLEMENTADO | `docs/observability.md` (2.4K) |
| FR-C8.1–C8.2 (Playwright + loop qa-produto) | IMPLEMENTADO | histórico extenso de homologações em todos os `dod-evidence.md` posteriores |
| FR-C9.1 (Dockerfile/Firebase Hosting/CI deploy job) | IMPLEMENTADO (entregue, não executado) | `backend/Dockerfile`, `.github/workflows/deploy.yml` |
| FR-C9.2 (preview/smoke/rollback scaffolded) | NÃO VERIFICADO — não abri o corpo completo de `deploy.yml` | — |
| FR-C10.1 (Princípio VIII nos 6 agentes estruturais) | IMPLEMENTADO | 7 arquivos em `.claude/agents/*.md` contêm a cláusula (contagem via grep) |
| FR-C10.2/C10.3 (plan-template 8 gates, artefatos reconciliados) | NÃO VERIFICADO — não abri `plan-template.md` nem fiz o diff completo dos artefatos citados | — |

Sem drift: a spec é de tooling, o alvo evoluiu mas nenhuma capacidade documentada aqui foi removida.

---

## specs/003-app-shell-and-ds/spec.md

Sem drift novo além do já registrado (FR-002 acima, que é tecnicamente um FR de 003, não drift dela mesma).
Tabela compacta:

| FR | Classificação | Local |
|---|---|---|
| FR-001 (4 seções navegáveis) | **ver achado F02A-005 abaixo** | — |
| FR-002 (foco no título ao trocar seção) | IMPLEMENTADO | `apps/web/tests/e2e/focus-to-title.spec.ts` |
| FR-003 (Calcular livre, offline) | IMPLEMENTADO | ver F02A-001 acima |
| FR-004 (Catálogo/Histórico/Conta exigem auth) | IMPLEMENTADO | `apps/web/src/app/router.tsx:115-132` (`requireAuth` nas rotas de catálogo/produto) |
| FR-005 (server é boundary) | IMPLEMENTADO | `backend/app/api/me.py:18` |
| FR-006 (identidade visual) | NÃO VERIFICADO — exige inspeção visual, fora do escopo desta auditoria estática |
| FR-007 (tema dark/light, sem flash) | IMPLEMENTADO | citado em `dod-evidence.md` US3 T044 PASS; não re-verifiquei visualmente |
| FR-008 (contraste ≥4.5:1) | IMPLEMENTADO | `apps/web/tests/e2e/a11y-targets-contrast.spec.ts` |
| FR-009 (alvo tocável ≥44px) | IMPLEMENTADO | mesmo arquivo acima |
| FR-010 (sem scroll horizontal a 390px) | IMPLEMENTADO | `apps/web/tests/e2e/a11y-overflow.spec.ts` |
| FR-011 (banner offline) | IMPLEMENTADO | `apps/web/src/widgets/offline-banner/offline-banner.tsx:22-24` (`role="status" aria-live="polite"`) |
| FR-012 (404 + erro genérico c/ código de suporte) | IMPLEMENTADO | `apps/web/src/pages/not-found/not-found-page.tsx`, `apps/web/src/pages/error/error-page.tsx` |
| FR-013 (Conta: identidade servidor + plano + tema + sign-out) | IMPLEMENTADO | `apps/web/src/pages/conta/conta-page.tsx`, `conta-plan.test.tsx` |
| FR-014 (copy pt-BR sem fatos comerciais indecididos) | NÃO VERIFICADO — não fiz varredura textual completa |
| FR-015 (Catálogo/Histórico placeholders NESTA fatia) | **DIVERGENTE-POR-DECISÃO** — ver abaixo |
| FR-016 (modal trap focus/Escape) | IMPLEMENTADO | `apps/web/src/shared/ui/dialog.tsx` + `dialog.test.tsx` |
| FR-017 (erros do servidor → pt-BR) | IMPLEMENTADO | citado em TD-019 do `dod-evidence.md`, mapeamento em `shared/api` |

### [F02A-005] FR-001 — 4 seções virou 5 (Kits)
- Spec/AC: FR-001 (`specs/003-app-shell-and-ds/spec.md:171-172`) — "four navigable sections — Calcular,
  Catálogo, Histórico, Conta."
- Classificação: **DIVERGENTE-POR-DECISÃO**
- Certeza: 97%
- Local: `apps/web/src/widgets/app-nav/app-nav.tsx:20-25` — array com 5 entradas
  (`calcular, catalogo, kits, historico, conta`).
- Evidência: decisão do dono registrada em `specs/008-e3-multi-piece-bom/spec.md:52-53` ("K1 — User-facing
  name is 'Kits'; 5th nav tab APPROVED").
- Origem: develop

### [F02A-006] FR-015 — Catálogo/Histórico não são mais placeholders (esperado, spec posterior)
- Spec/AC: FR-015 (`specs/003-app-shell-and-ds/spec.md:197-198`) — "Catálogo and Histórico MUST render as
  neutral placeholder shells in this slice (no catalog CRUD, no saved history...)."
- Classificação: **DIVERGENTE-POR-DECISÃO**
- Certeza: 95%
- Local: `apps/web/src/features/catalog/`, `apps/web/src/features/history/` (CRUD completo)
- Evidência: a própria 003 já escopava isso como temporário ("Catalog CRUD... that is E2", spec.md:234-236);
  E2 (`specs/007-e2-catalog-entitlement`) e E4 (`specs/009-e4-history-snapshots-export`) substituíram os
  placeholders por funcionalidade real — não é drift, é a evolução planejada.
- Origem: develop

---

## specs/004-e1-pricing-model/spec.md

Tabela compacta — **todas as fórmulas (FR-024–039) batem linha a linha** com
`packages/pricing-core/src/index.ts:133-239`:

| FR | Classificação | Local |
|---|---|---|
| FR-001–020 (superfície de inputs) | IMPLEMENTADO | `apps/web/src/features/calculator/calculator-schema.ts` |
| FR-021 (SEM campo de imposto) | IMPLEMENTADO | grep por `imposto`/`tax` em `calculator-schema.ts` não retornou nenhuma ocorrência |
| FR-022 (unidades, pt-BR, tooltip avgPowerKw) | NÃO VERIFICADO — exige inspeção visual |
| FR-023 (defaults 0 vs pré-preenchido) | IMPLEMENTADO | `packages/pricing-core/src/index.ts:135-142` (`?? 0` em cada opcional) |
| FR-024 material | IMPLEMENTADO | `index.ts:168-170` |
| FR-025 energy | IMPLEMENTADO | `index.ts:174-176` |
| FR-026 machine/machineHourRate (ADR-0009 A) | IMPLEMENTADO | `index.ts:180-183` |
| FR-027 falha sobre produção total | IMPLEMENTADO | `index.ts:189-193` |
| FR-028 finishing | IMPLEMENTADO | `index.ts:196` |
| FR-029 custo_total | IMPLEMENTADO | `index.ts:207` |
| FR-030 preços varejo/atacado juntos | IMPLEMENTADO | `index.ts:209-215` |
| FR-031 gross-up marketplace | IMPLEMENTADO (generalizado para N canais em 005) | `index.ts:217-311` |
| FR-032–034 breakdown | IMPLEMENTADO | `index.ts:223-238` (retorna todas as linhas) |
| FR-035 grátis/offline/sem persistência | IMPLEMENTADO | nenhum save/export no fluxo do calculator |
| FR-036 fonte única + versão | IMPLEMENTADO — mas o valor do carimbo mudou (ver 005 SC-109 abaixo) | `index.ts:20` `PRICING_MODEL_VERSION = "3.1.0"` |
| FR-037 arredondamento ADR-0008 | IMPLEMENTADO | `packages/pricing-core/src/rounding.ts` (`toMoney`/`sumMoney`, HALF_UP) |
| FR-038 nunca NaN/Infinity | IMPLEMENTADO | `index.ts:120-131` (`assertNonNegative`/`assertPositive`) |
| FR-039 determinismo | IMPLEMENTADO | função pura, sem I/O |

Sem drift novo — a única nota é o carimbo de versão, tratado abaixo em 005 (a própria spec já a registra).

---

## specs/005-marketplace-multichannel/spec.md

| FR | Classificação | Local |
|---|---|---|
| FR-101–104 (slots de canal) | IMPLEMENTADO | `apps/web/src/features/calculator/calculator-model.ts:230-310` (`processSlot`) |
| FR-105/105a (catálogo servido + curado) | IMPLEMENTADO | `backend/app/api/fee_catalog.py:118-135` (`GET /fee-catalog`, público, sem auth) |
| FR-106/107 (override + selo de honestidade) | IMPLEMENTADO | `calculator-model.ts:196-228` (`resolveSlotFees`), `apps/web/src/features/calculator/fee-seal.ts` (referenciado) |
| FR-108 (fetch→persist→seed, retry não-bloqueante) | IMPLEMENTADO | citado em `dod-evidence.md` US3 (`use-fee-catalog.test.ts`, `calcular-catalog-retry.test.tsx`) — não abri esses arquivos diretamente nesta rodada |
| FR-109 (sem referência → manual) | IMPLEMENTADO | `calculator-model.ts:248,277-278` (`seal: entry ? {kind:"adjusted"} : {kind:"none"}`) |
| FR-110/111 (gross-up N canais, floor, band fixed-point) | IMPLEMENTADO | `packages/pricing-core/src/index.ts:248-311`, `channels.ts` (`grossUp`) |
| FR-111a/111b (frete/subsídio) | IMPLEMENTADO | `index.ts` (`freightCost`, `freightVoucherBands`), `backend/app/api/fee_catalog.py:41-62` (`FreightEstimate`/`FreightBandVoucher`) |
| FR-112 (nunca soma em custo_total) | IMPLEMENTADO | `index.ts:217-221` comentário explícito + código não soma fee em `custoTotal` |
| FR-113 (toggle incluir/excluir) | IMPLEMENTADO — com a nota de descope já registrada na própria spec (§5, D2=A) | `calculator-model.ts:371-375` (`includeMarketplace`) |
| FR-114–116 (outros custos itemizados) | IMPLEMENTADO | `index.ts:198-205` (`otherCostsR`) |
| FR-117 (catálogo público, nunca gate) | IMPLEMENTADO | `fee_catalog.py:3` (docstring "Public, unauthenticated, never a gate") |
| FR-118 (versão 3.0.0) | **ver achado F02A-007** | `index.ts:20` |
| FR-119 (nunca NaN, determinismo) | IMPLEMENTADO | mesma validação de 004 |

### [F02A-007] FR-118/SC-109 — `PRICING_MODEL_VERSION` é "3.1.0", não "3.0.0"
- Spec/AC: FR-118 (`specs/005-marketplace-multichannel/spec.md:210`) — "MUST stamp
  `PRICING_MODEL_VERSION = \"3.0.0\"`."
- Classificação: **DIVERGENTE-POR-DECISÃO** (já auto-registrada na spec, não é achado novo — reporto por
  completude do drift-scan)
- Certeza: 99%
- Local: `packages/pricing-core/src/index.ts:16-20`
- Evidência: a própria spec já anota isso em `specs/005-marketplace-multichannel/spec.md:237` (SC-109,
  nota "2026-07-23, E1-07": "`pricing-core` has since bumped to `3.1.0` (E3's BOM compose contract,
  ADR-0016)... it was never retro-annotated when the later bump landed"). Comportamento correto, só o
  texto literal da spec ficou desatualizado — a própria spec já avisa o leitor.
- Origem: develop

---

## Não verificado

1. **001 SC-001** ("sign in... em <30s") — não encontrei um teste que meça literalmente o tempo; os e2e
   confirmam o fluxo funciona, não a janela de tempo. Pergunta: existe alguma medição de tempo de sign-in
   em algum e2e ou telemetria, ou o critério é só aspiracional?
2. **002 FR-C9.2** — não abri o corpo completo de `.github/workflows/deploy.yml` para confirmar que
   preview/smoke/rollback estão de fato "scaffolded" (vs. apenas o job de deploy em si). Pergunta: o
   arquivo contém steps nomeados de preview/smoke-test/rollback, mesmo que stubados?
3. **002 FR-C10.2/C10.3** — não abri `.specify/templates/plan-template.md` para contar os "8 gates", nem
   fiz diff dos artefatos citados (`decisions-backlog.md`, `business-rules.md`, `constitution.md:100`).
   Pergunta: o plan-template ainda tem exatamente 8 Constitution-Check gates, incluindo o do Princípio
   VIII?
4. **003 FR-006/FR-014** — fidelidade de identidade visual e varredura completa de copy comercial
   (nenhuma menção a provedor de pagamento/política de cancelamento/preço) não foram verificadas nesta
   auditoria estática; exigem inspeção visual/textual completa que não fiz. Pergunta: existe uma varredura
   textual automatizada (teste que falha se aparecer "Mercado Pago"/"cancelamento"/preço em copy do shell)
   além do `dod-evidence.md` citar isso como coberto?
5. **001 FR-010 / deploy deferido** — não encontrei um ADR dedicado à decisão de adiar o deploy até v1
   completo, só a entrada de decision-log em `CLAUDE.md`. Pergunta: existe um ADR formal para essa decisão,
   ou o registro em `CLAUDE.md` é intencionalmente o único registro?
6. **005 FR-108** — não abri diretamente `use-fee-catalog.test.ts` / `calcular-catalog-retry.test.tsx`
   para confirmar o comportamento de retry não-bloqueante; classifiquei IMPLEMENTADO com base na citação
   cruzada do `dod-evidence.md` de 005 e na presença dos arquivos, não em leitura direta do código.
   Pergunta: alguém deveria reabrir esses dois arquivos e confirmar a asserção "non-blocking retry"
   linha a linha?
