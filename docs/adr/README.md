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

## Pending (to be written; numbers assigned when authored)
- Payments — Google Play Billing vs Mercado Pago recurring (blocking before any payment code; E6).
- Entitlement enforcement design — offline + TTL vs per-request (lands at E2).
