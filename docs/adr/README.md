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
| [0010](0010-marketplace-fee-catalog-architecture.md) | Marketplace fee-catalog architecture (served endpoint + persisted cache + bundled seed · ML PR-ingestion · freight model) | Accepted |
| [0011](0011-pricing-core-3-0-0-multichannel-result-contract.md) | pricing-core 3.0.0 — multi-channel result contract, band fixed-point & snapshot policy (extends ADR-0008) | Accepted |
| [0012](0012-entitlement-flag-mechanism.md) | Entitlement flag mechanism — server-authoritative Postgres ledger, per-request check (TD-005) | Accepted |
| [0013](0013-persistence-stack.md) | Persistence stack — SQLAlchemy 2.0 typed + Alembic + psycopg3 on PostgreSQL (TD-004) | Accepted |
| [0014](0014-knowledge-graph-maintenance-and-agent-search.md) | Knowledge-graph maintenance (refresh on every `develop` merge) & graph-first agent code search (graphify) | Accepted |

## Pending (to be written; numbers assigned when authored)
- Payments — Google Play Billing vs Mercado Pago recurring (blocking before any payment code; E6).
