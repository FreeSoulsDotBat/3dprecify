# Implementation Plan: Correção da homologação humana + decisões de dados de marketplace

**Branch**: `016-correcao-homologacao` | **Date**: 2026-08-05 | **Spec**: `specs/016-correcao-homologacao/spec.md`

**Input**: Feature specification from `/specs/016-correcao-homologacao/spec.md` (pós-clarify 8/8,
pós-reversão ML) + **desenho arquitetural** `specs/016-correcao-homologacao/arquitetura-016.md`
(arquiteto, escalação opus ADR-0022) + ADRs **0025/0026/0027 (Proposed)**.

> **Estado pós-reversão (dono, 2026-08-05)**: a parte ML — US15/FR-922, comparação por logística,
> peso, seletor de categoria — está **ADIADA** para junto do token da casa (US6-ML/017). A decisão A
> do arquiteto (fixedCostMatrix, ADR-0025) fica Proposed para esse momento; **nenhuma tarefa ML
> neste plano**. O fatiamento é V0 + PR-A..PR-F, sem PR-G.

## Summary

O 016 aplica as correções da homologação pessoal do dono (2026-08-05) e as decisões de dados de
marketplace da mesma data, em seis fatias autorizadas uma a uma: teaser premium unificado + rótulos
(PR-A), layout desktop (PR-B), campos do formulário sem tocar a fórmula (PR-C), remoção completa do
`wasteGrams` com pricing-core **4.0.0** (PR-D, isolada), marketplace-vira-premium + campos dirigidos
pelo catálogo (PR-E), e as mudanças de dado/regra Shopee/Amazon com pricing-core **4.1.0** aditivo
(PR-F). Abordagem técnica: toda extensão de schema é **aditiva com ausência = comportamento antigo**
(padrão ADR-0024); o motor continua canônico e offline; a ordem das fatias minimiza o número de
`PRICING_MODEL_VERSION` efêmeros que podem ser carimbados em snapshot imutável (argumento §H do
desenho).

## Technical Context

**Language/Version**: TypeScript (React 19, Node 24) no frontend e pacotes; Python 3.12 (uv) no backend

**Primary Dependencies**: pnpm workspaces · Vite 8 PWA + Tailwind v4 + DS `tf-*` (ADR-0007) ·
TanStack Router/Query · Zustand · RHF+Zod · FastAPI + pydantic-settings + SQLAlchemy 2.0/Alembic ·
`packages/pricing-core` (dep única: `decimal.js-light`, ADR-0008) · Orval (wire camelCase → TS)

**Storage**: PostgreSQL (migração Alembic `0003` DROP das três colunas de desperdício); catálogo de
tarifas servido + cacheado + semeado (ADR-0010); snapshots imutáveis por trigger (ADR-0019)

**Testing**: vitest (+ ratchet 100% no pricing-core) · Playwright e2e (geometria por caixas +
screenshot) · pytest + Schemathesis · contract drift-guard (regen OpenAPI/Orval da raiz +
idempotência) · `pnpm gate:all` — o MESMO literal no lefthook pre-push e na CI

**Target Platform**: Web PWA (mobile-first 360px+ · desktop 1440px), Android futuro via Capacitor

**Project Type**: Web app (apps/web + backend FastAPI + packages compartilhados, FSD-Lite)

**Performance Goals**: cálculo offline instantâneo (pricing-core puro, sem parse novo em caminho
quente — decisão D.1 do desenho rejeitou Zod na borda do motor)

**Constraints**: offline-capable (catálogo cacheado antigo NÃO pode quebrar ⇒ extensões aditivas,
I4); imutabilidade de snapshot (I3); `catalogVersion` só se move com conteúdo (I5); nenhum número
sem fonte oficial datada (I6); `feature → feature` proibido (I8)

**Scale/Scope**: 17 US ativas + V0 (US15 adiada) · 27 FRs · 6 fatias · 2 bumps de versão
(4.0.0 MAJOR em PR-D, 4.1.0 MINOR em PR-F) · 1 migração de banco · ~5 telas + calculadora

## Constitution Check

- [x] **I. Scalability & Quality First** — extensões aditivas ao catálogo/motor preservam o core
      compartilhado web+Android; nenhuma escolha de conveniência sem ADR (0025/0026/0027 Proposed).
- [x] **II. Truth Over Approval** — os conflitos spec×código estão MEDIDOS e listados
      (arquitetura-016 §9), com o maior deles (catálogo ML vazio) já decidido pelo dono (adiar);
      FR-927 tem pré-condição de releitura verbatim do art. 26839 ANTES de gravar número; FR-928
      impede R$ 0,00 inventado sob selo. Confianças declaradas por decisão (72–95%).
- [x] **III. Test-First** — cada fatia tem testes lógicos (numéricos para toda mudança de preço:
      varredura de limiar em R$ 8, byte-idêntico FR-919, SC-906) e visuais (geometria por caixas +
      screenshot, SC-901/903/909); observar o vermelho antes de implementar.
- [x] **IV. Server-Side Entitlements** — a virada marketplace-premium (US11) usa o gate servidor
      existente (ADR-0012); o switch desabilitado no cliente é UX, não autoridade — o dado premium
      (catálogo de tarifas por usuário) continua atrás do entitlement do servidor.
- [x] **V. Clean Architecture Integrity** — os 4 teasers antigos são DELETADOS (não embrulhados);
      `TeaserUpgrade` do E6 é ABSORVIDO, nunca bifurcado (§H); colunas mortas do banco caem (DROP).
- [x] **VI. Lean Living Documentation** — Clarifications datadas nas specs 005 E 007 viajam na
      MESMA fatia (PR-E); a US15 adiada fica registrada na spec, não apagada.
- [x] **VII. Spec-Driven Flow** — specify → clarify (8/8) → arquiteto → plan → tasks; a spec é a
      fonte de verdade e a reversão ML está registrada nela.
- [x] **VIII. Architecture Decided Before Implementation** — toda escolha estrutural traça para
      arquitetura-016 (decisões B–H com alternativas rejeitadas e confiança) e ADRs 0025–0027;
      nada é inferido; a decisão A (ML) está tomada e ADIADA junto com a story.

*Re-check pós-Phase 1*: PASS — os artefatos de design (data-model, contracts, quickstart) não
introduziram nenhuma escolha estrutural fora do desenho do arquiteto.

## Project Structure

### Documentation (this feature)

```text
specs/016-correcao-homologacao/
├── spec.md              # pós-clarify, pós-reversão ML
├── arquitetura-016.md   # desenho do arquiteto (decisões A–H; A adiada)
├── plan.md              # este arquivo
├── research.md          # Phase 0 — decisões consolidadas (nenhum NEEDS CLARIFICATION restante)
├── data-model.md        # Phase 1 — entidades e extensões aditivas
├── quickstart.md        # Phase 1 — guia de validação por fatia
├── contracts/
│   ├── pricing-core-4x.md      # superfície 4.0.0 (MAJOR) e 4.1.0 (MINOR)
│   ├── catalog-extensions.md   # extensões aditivas do catálogo de tarifas
│   └── wire-changes.md         # OpenAPI/Orval: remoções de waste + extra=forbid
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — fora deste comando)
```

### Source Code (repository root)

```text
apps/web/src/
├── shared/billing/premium-teaser.tsx        # NOVO (PR-A) — o padrão único; TeaserUpgrade absorvido
├── shared/billing/teaser-upgrade.tsx        # do E6 — ABSORVIDO, não bifurcado
├── shared/i18n/messages.pt-br.ts            # registro fechado de conteúdo dos teasers + rótulos novos
├── shared/fee-catalog/fee-catalog.ts        # feeAxes · optionalSurcharges · fixedFeeSource ·
│                                            #   determinantsSchema.SHOPEE (aditivos, PR-E/PR-F)
├── shared/fee-catalog/seed.ts               # dado curado (bump de catalogVersion em PR-F)
├── features/calculator/
│   ├── calculator-form.tsx                  # layout colunas (PR-B) · seções fundidas + h/min +
│   │                                        #   pergunta da máquina (PR-C) · seção dirigida (PR-E)
│   ├── calculator-model.ts                  # ChannelSlotOutcome (sem logistics — ML adiado)
│   ├── calculator-schema.ts                 # MODALITY_OPTIONS → derivado do determinantsSchema
│   ├── channel-field-plan.ts                # NOVO (PR-E) — plano puro derivado do catálogo
│   ├── fee-prefill.ts                       # refine FR-928 (banda com fixedFee nulo ⇒ I9)
│   └── scenario-bridge.ts                   # costurado 1 da regra de leitura (PR-D)
├── pages/historico/recalc-today.tsx         # costurado 2 — declaração por isPreRemovalModel (PR-D)
└── pages/{catalogo,kits,historico,cenarios}/ # consumo do PremiumTeaser (PR-A) + rótulos (PR-A)

packages/pricing-core/src/
├── index.ts                                 # 4.0.0: RETIRED_INPUT_FIELDS + recusa nominal +
│                                            #   stripRetiredFields + isPreRemovalModel (PR-D)
└── channels.ts                              # 4.1.0: PriceBand.fixedFeeRule + ChannelInput.surcharges
                                             #   + bandFixedFee nas TRÊS chamadas (PR-F)

backend/
├── alembic/versions/0003_remove_waste.py    # DROP das 3 colunas + CHECKs (PR-D)
├── app/schemas/…                            # FilamentIn/Out e PieceInputs sem waste, extra=forbid
├── app/api/scenarios.py · boms.py           # param de emissão/sincronização do waste sai (PR-D)
└── app/data/catalog.json                    # dado Amazon INDIVIDUAL fixedFee 2.00 + Shopee (PR-F)

packages/fee-ingest/src/guardrails.ts        # nextCatalogVersion — sequencia o bump (PR-F)
```

**Structure Decision**: monorepo existente (pnpm workspaces, FSD-Lite no frontend); nenhum diretório
novo além dos arquivos listados. O encontro entre features é sempre em `shared/` (I8).

## Fatias e ordem (autoritativo pós-reversão)

| fatia | US | bump | conteúdo essencial |
| --- | --- | --- | --- |
| **V0** | — | — | MEDIÇÃO do Grupo 0 (logado sem premium, backend correto) ANTES de qualquer conserto |
| **PR-A** | US1, US2 | — | `PremiumTeaser` único (contrato de conteúdo fechado, i18n) + rótulos Orçamentos/Simulações; 4 teasers antigos deletados; `TeaserUpgrade` absorvido |
| **PR-B** | US3–US5 | — | logo por tema + sidebar à frente; colunas no desktop (≥60% a 1440px); fusão "Como chegamos no preço"; geometria asseverada |
| **PR-C** | US6–US9 | — | 11 tooltips (conteúdo pesquisado com procedência); h+min na borda; pergunta da máquina (RITMOS=[260,1200,3300] h/ano × payback); máscara currency; fusões de seção — TUDO derivação de borda, nada persistido (§7 do desenho) |
| **PR-D** | US10 | **4.0.0 MAJOR** | recusa nominal por chave (`RETIRED_INPUT_FIELDS`) + `stripRetiredFields`/`isPreRemovalModel` no próprio pricing-core; migração `0003` DROP; wire `extra="forbid"` + regen + drift-guard; os DOIS costurados declaram o descarte |
| **PR-E** | US11–US13 | — | switch premium desabilitado+falso com assinar; promessa da 1ª dobra reescrita; Clarifications datadas nas specs **005 E 007** na MESMA fatia; `channelFieldPlan` puro + `feeAxes` explícito (ausência = 4 campos de hoje); picker hierárquico com contador verdadeiro; FR-928 |
| **PR-F** | US14, US16–US18 | **4.1.0 MINOR** + `catalogVersion` | `fixedFeeRule PCT_OF_PRICE` na banda (banda Shopee CNPJ parte em `[0,8)`+`[8,80)` — APÓS releitura verbatim do art. 26839, §9.3); `surcharges[]` atravessando a banda (armadilha 013/F1 evitada); determinante composto `sellerProfile` (CNPJ = null intocado); Amazon INDIVIDUAL `fixedFee 2.00` + `fixedFeeSource`; avisos US17 |

**Por que PR-D antes de PR-F**: cada versão efêmera de `PRICING_MODEL_VERSION` pode ser carimbada
num snapshot imutável para sempre — a ordem minimiza os rótulos que chegam a existir (§H). PR-D não
espera o E6 (interseção de arquivos vazia, medida); a colisão real é PR-A × E6 US7 e a mitigação é
absorver `teaser-upgrade.tsx`.

## Complexity Tracking

Sem violações constitucionais a justificar. As três mudanças estruturais do domínio de pricing
carregam ADR próprio (0025 adiado · 0026 · 0027) e escalação opus cumprida no desenho.
