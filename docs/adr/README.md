# Architecture Decision Records

MADR-style. One file per decision: `NNNN-kebab-title.md`. Use `template.md`. Statuses: Proposed → Accepted → Superseded.
Every ADR lists ≥3 options with pros/cons/scalability/confidence (Constitution). Link ADRs from the relevant
`plan.md` Constitution Check.

## Index
| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-development-process.md) | Development process & meta-plan | Accepted |
| [0002](0002-api-contract-error-observability.md) | API contract, wire casing, error model & observability | Accepted |
| [0003](0003-no-inference-decide-before-implement.md) | Architecture & standards decided before implementation (no inference) | Accepted |
| [0004](0004-technology-stack-and-coding-standards.md) | Technology stack & coding standards (full ratified stack) | Accepted |
| [0005](0005-environments-and-promotion.md) | Environments (local/UAT/prod) & promotion model | Accepted |
| [0006](0006-branching-and-pr-automation.md) | Branching model, PR automation, convention-only protection | Accepted |
| [0007](0007-design-system-layer.md) | Design system layer — Radix behavior skinned with `tf-*` tokens | Accepted |
| [0008](0008-pricing-core-versioning-rounding.md) | pricing-core version registry & rounding policy | Accepted |
| [0009](0009-machine-hour-cost-recovery.md) | Machine-hour capital-recovery method | Accepted |
| [0010](0010-marketplace-fee-catalog-architecture.md) | Marketplace fee-catalog architecture (served endpoint + persisted cache + bundled seed · ML PR-ingestion · freight model) | Accepted (Part 3 ingestion runtime amended 2026-07-24 → CI-first) |
| [0011](0011-pricing-core-3-0-0-multichannel-result-contract.md) | pricing-core 3.0.0 — multi-channel result contract, band fixed-point & snapshot policy (extends ADR-0008) | Accepted |
| [0012](0012-entitlement-flag-mechanism.md) | Entitlement flag mechanism — server-authoritative Postgres ledger, per-request check (TD-005) | Accepted |
| [0013](0013-persistence-stack.md) | Persistence stack — SQLAlchemy 2.0 typed + Alembic + psycopg3 on PostgreSQL (TD-004) | Accepted |
| [0014](0014-knowledge-graph-maintenance-and-agent-search.md) | Knowledge-graph maintenance (refresh on every `develop` merge) & graph-first agent code search (graphify) | Accepted |
| [0015](0015-e3-bom-entitlement-enforcement.md) | E3 BOM entitlement — server-informed feature guard over a client-side compute (extends ADR-0012) | Accepted |
| [0016](0016-pricing-core-3-1-0-bom-compose-contract.md) | pricing-core 3.1.0 — `computeBom` assembly contract with per-channel rollup (extends ADR-0008/0011) | Accepted |
| [0017](0017-kit-save-materialization.md) | Kit-save materialization — atomic txn, path-scoped FR-310 relaxation, name-dedup (extends ADR-0013) | Accepted |
| [0018](0018-offline-snapshot-outbox.md) | Offline snapshot outbox — device-durable queue, exactly-once sync, entitlement at sync | Accepted |
| [0019](0019-snapshot-immutability-enforcement.md) | Snapshot immutability — enforcement in depth + provenance without a foreign key | Accepted |
| [0020](0020-export-artifact-rendering.md) | Export artifact rendering — server-rendered PDF/CSV behind an active-entitlement gate | Accepted |
| [0021](0021-scenario-persistence-live-reference-model.md) | Scenario persistence & the live-reference model — hybrid JSONB config, store-intent/resolve-live, no-FK Product-or-Kit basis (extends ADR-0013/0017) | Accepted |
| [0022](0022-token-cost-engineering-dev-workflow.md) | Token-cost engineering of the dev workflow — per-role model routing + command-output filter + graphify auto-rebuild (amends ADR-0014) | Accepted |
| [0023](0023-payments-mercado-pago-recurring.md) | Payments — Mercado Pago recurring (preapproval + hosted checkout, verify-by-lookup, exactly-once inbox, shared grant_writer, Play flag-ready OFF; extends ADR-0012) | Proposed |
| 0024–0031 | *(linhas ausentes deste índice — os arquivos existem em `docs/adr/`; backfill pendente, ver nota abaixo)* | — |
| [0032](0032-primitivos-do-porte-do-design.md) | Os primitivos do porte — onde cada classe `tf-*` mora, e como o porte não cria uma segunda camada (estende ADR-0007) | Proposed |
| [0033](0033-observacao-e-fixacao-de-preco.md) | Observação de preço, fixação de preço e unicidade de nome — o Catálogo ganha dado novo sem virar fonte de preço (019/PR-D) | Proposed |
| [0034](0034-orcamento-montado-motor-e-congelamento.md) | "Montar e Enviar" — `computeQuote` no motor e o congelamento pela maquinaria do E4 (019/PR-E) | Proposed |

> **Nota (2026-08-26, arquiteto/019)**: o índice parou de ser atualizado em 0023 — os ADRs **0024 a
> 0031 existem** como arquivo e estão em uso (o 0031 foi aceito em 2026-08-26). Não preenchi as linhas
> deles porque não medi o status de cada um, e inventar status num índice é pior que a lacuna. O
> backfill é uma tarefa de uma linha por ADR para quem tiver a leitura na mão.

## Pending (to be written; numbers assigned when authored)
- ~~Payments — Google Play Billing vs Mercado Pago recurring~~ → **resolved as ADR-0023** (2026-07-20;
  Play Billing's own ADR is authored at E7 turn-on).
