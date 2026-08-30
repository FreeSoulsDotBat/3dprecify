# Implementation Plan: Remediação da Auditoria Adversarial 2026-07-23

**Branch**: `013-audit-remediation` | **Date**: 2026-07-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-audit-remediation/spec.md` · Fontes normativas: `AUDITORIA.md` + `PLANO-CORRECAO.md` (raiz)

## Summary

Corrigir os achados das ondas 1/3/4/5/6 do plano de correção (3 Altos + 9 Médios + lotes de Baixos + passe documental) **sem nenhuma tecnologia nova** — toda correção usa a stack ratificada (ADR-0001..0023). Abordagem técnica: (1) fix raiz do parser numérico pt-BR com gramática estrita documentada em `shared/lib/decimal-ptbr.ts`; (2) migração das 3 rotas de 2+ segmentos para query-param (padrão `/kits`) + redirects no hosting e no router; (3) variante lapsed do catálogo copiando o padrão já existente em cenários/kits; (4) extração dos validadores financeiros para `backend/app/validation.py` (única mudança estrutural, coberta por contrato import-linter); (5) testes-guarda que transformam as mutações da auditoria em falhas de esteira; (6) curadoria ML/Amazon (D3=B) com protocolo de fonte + gate de validação do dono; (7) passe documental único. Entrega em PRs pequenos a partir de `develop`, um por issue C-nn, sem tocar arquivos quentes do épico E6 (`billing/` não é tocado por nenhum item).

## Technical Context

**Language/Version**: TypeScript ~5.9 (front + pricing-core) · Python 3.12 (backend, uv)

**Primary Dependencies**: React 19 + Vite 8 + TanStack Router/Query + RHF/Zod 4 + idb-keyval (front); FastAPI + SQLAlchemy 2 + Alembic + psycopg3 (backend). Nenhuma dependência nova.

**Storage**: PostgreSQL 17 — **zero migrações nesta feature** (nenhuma mudança de schema; `min_length` do kit é validação de API, não constraint de banco)

**Testing**: Vitest + Testing Library + Playwright (front/e2e) · pytest + testcontainers (backend) · gate único `pnpm gate:all` (D4)

**Target Platform**: PWA web mobile-first + desktop (Firebase Hosting + Cloud Run quando provisionado; deploy segue deferido até v1)

**Project Type**: monorepo web app (pnpm workspaces + backend uv) — estrutura existente, inalterada salvo o módulo novo de validação

**Performance Goals**: nenhuma meta nova — os itens de performance da auditoria (N+1 etc.) são Onda 7, fora deste escopo; SC-007 exige zero regressões

**Constraints**: cada PR passa `gate:all` completo + drift-guard (o PR do `min_length` MUST regenerar `contracts/openapi.json` + client Orval — lição da casa); nenhum item toca `backend/app/billing/**` ou `features/billing/**` (isolamento do E6); passe documental (C-15) é docs-only por definição

**Scale/Scope**: 13 issues (C-01..C-03, C-06..C-15) + curadoria US8; ~8–10 PRs após agrupamento dos lotes; 17 FRs / 8 SCs

## Constitution Check

*GATE: aprovado pré-Phase 0; re-avaliado pós-Phase 1 — sem violações; Complexity Tracking vazio.*

- [x] **I. Scalability & Quality First** — a feature REMOVE dívidas de qualidade catalogadas; nenhuma troca de escalabilidade por conveniência. O parser único e o módulo de validação único reduzem divergência futura (a causa raiz de 2 famílias de achados).
- [x] **II. Truth Over Approval** — a feature nasce de auditoria com evidência arquivo:linha; achados [INFERIDO] não geram correção sem confirmação; os valores de taxas ML/Amazon (US8) são fatos de terceiros: NUNCA inferidos, sempre com fonte + validação explícita do dono (gate de aceite do FR-015). O passe C-15 corrige claims falsas existentes — é a aplicação direta deste princípio.
- [x] **III. Test-First** — cada correção tem a entrada adversarial/mutação da auditoria como teste escrito ANTES do fix (FR-017); US2/US3/US8 exigem homologação visual (qa-produto) além dos testes lógicos; o parser tem casos numéricos explícitos (SC-001).
- [x] **IV. Server-Side Entitlements** — intocado; C-03 é apresentação client-side do estado que o servidor já decide (useEntitlement server-informed, padrão existente); nenhum gate novo, nenhum gate removido.
- [x] **V. Clean Architecture Integrity** — a feature ELIMINA duplicação conhecida (validadores 5×, conversões 3×) e código morto (ícones, strings órfãs, arquivo debris); `backend/app/validation.py` entra no contrato import-linter; nenhuma re-implementação órfã.
- [x] **VI. Lean Living Documentation** — C-15 é literalmente este princípio em ação (deletar o que ficou falso, Clarifications datadas); esta spec/plan referenciam AUDITORIA/PLANO em vez de duplicá-los.
- [x] **VII. Spec-Driven Flow** — specify ✅ → clarify ✅ (D1–D6 respondidos/adotados, seção Clarifications da spec) → checklist ✅ 16/16 → este plan → tasks → analyze → implement; gates respeitados.
- [x] **VIII. Architecture Decided Before Implementation** — toda escolha estrutural rastreia decisão registrada: D1=A (dono, 2026-07-23) para rotas; `validation.py` proposto no PLANO-CORRECAO lido e aprovado pelo dono, reconfirmado neste Constitution Check e coberto por contrato import-linter novo (research §3 — extração intra-camada consistente com o layering existente, sem ADR novo necessário); gramática do parser documentada em research §1 (utilitário compartilhado, não mudança de arquitetura); redirects de hosting em research §2 (config da decisão D1). **Nenhum ADR novo previsto; se a implementação encontrar fronteira não decidida, PARA e sobe ao dono** (instrução explícita do input deste plan).

## Project Structure

### Documentation (this feature)

```text
specs/013-audit-remediation/
├── spec.md              # concluída (clarify embutido — D1..D6)
├── plan.md              # este arquivo
├── research.md          # Phase 0 — decisões técnicas por frente
├── data-model.md        # Phase 1 — deltas (zero migrações; catálogo de taxas; tabela de tetos)
├── quickstart.md        # Phase 1 — guia de validação por SC
├── contracts/
│   └── api-deltas.md    # Phase 1 — deltas de contrato (min_length; CORS; rotas/URLs; regen obrigatório)
├── checklists/requirements.md  # 16/16 ✅
└── tasks.md             # Phase 2 (/speckit-tasks — não criado por este comando)
```

### Source Code (repository root) — arquivos tocados por frente

```text
apps/web/src/
├── shared/lib/decimal-ptbr.ts            # C-01 (fix raiz) + consolidação wireToPtBr (FA-05)
├── shared/ui/{icon.tsx,toast.tsx,dialog.tsx}   # C-12 (FC-01/FC-02)
├── shared/fee-catalog/{seed.ts,use-fee-catalog.ts,fee-catalog.ts}  # C-12 (E1-03/E1-06) + US8 (seed ML/Amazon)
├── app/router.tsx                        # C-02 (rotas novas + redirects client)
├── features/calculator/{calculator-model.ts,calculator-schema.ts,catalog-prefill.ts,product-mapping.ts,scenario-bridge.ts}  # C-01/C-14
├── features/catalog/{catalog-schema.ts,filament-form.tsx,printer-form.tsx,products-panel.tsx,+panels}  # C-03/C-07 (FB-05)/C-12 (FB-04)
├── features/scenarios/scenarios-list-sheet.tsx  # C-07 (FB-03)
├── pages/calcular/calcular-page.tsx      # C-12 (FA-03)
├── pages/catalogo/**, pages/historico/** # C-02 (novas rotas), C-03
└── app/providers.test.tsx                # C-08 (T-02)

backend/app/
├── validation.py                         # C-06 (NOVO — única mudança estrutural)
├── api/{boms.py,products.py,filaments.py,printers.py,history.py,scenarios.py}  # C-06/C-11 (consumo do módulo; E5-01/E5-02/E2-03/E4-02/E4-05; min_length D4)
├── main.py                               # C-13 (CORS)
└── data/catalog.json                     # US8 (entradas ML/Amazon curadas)

backend/tests/                            # C-09 (downgrade round-trip), espelhos 422-nunca-500, E5-04
scripts/check-migrations.sh               # C-09 (alembic heads)
firebase.json                             # C-02 (redirects de hosting das URLs antigas)
vitest.config.ts                          # C-10 (T-07)
backend/pyproject.toml                    # C-06 (contrato import-linter do validation)
docs/**, .specify/memory/constitution.md, CLAUDE.md, specs/{005,007,009,011}/**  # C-15 (passe documental)
.config/rtk/                              # C-13 (remover debris)
```

**Structure Decision**: monorepo existente inalterado. Única adição estrutural: `backend/app/validation.py` como módulo-folha de validação (importável pelos routers; não importa nada de `app.*`), registrado no contrato import-linter — decisão gravada aqui + research §3, sem ADR (extração intra-camada, não mudança de arquitetura). O isolamento do E6 é por construção: nenhum arquivo de `billing` aparece na árvore acima.

## Complexity Tracking

*Vazio — Constitution Check sem violações.*
