# Specification Quality Checklist: E1 expansion — multi-channel marketplace pricing + itemized other-costs

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs) — behavior only; the fee-catalog contract is decided in ADR-0010/0011, referenced not embedded
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain — **resolved by owner 2026-07-06 after source-of-truth research** (scope → 3 curated marketplaces ML/Amazon/Shopee; ML free-shipping subsidy modelled as an editable estimate)
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- **All checklist items pass (2026-07-06).** Scope resolved by the owner after source-of-truth research:
  **three curated marketplaces — Mercado Livre, Amazon, Shopee** (Magalu/Casas Bahia/AliExpress dropped for
  lack of a reliable public fee source; Elo7 shut down 2026-05-11). The ML free-shipping subsidy is modelled as
  an editable estimate. Truth-guards (Constitution II) baked in: every curated value carries `sourceUrl` +
  `effectiveDate` and is reconciled against the official source in "Fee sources of truth"; unverifiable values
  fall back to manual; the ML subsidy is never presented as authoritative.
- Everything else in 004 (US1–US6, FR-001…FR-039, SC-001…SC-012) is preserved and only extended; this spec
  adds on top rather than restating, per Constitution VI (lean living docs).
- **Architecture decided (2026-07-06):** ADR-0010 (fee-catalog — **served endpoint + persisted client cache +
  bundled seed**; delivery amended 2026-07-06, owner-directed; ML PR-ingestion, freight model) + ADR-0011
  (pricing-core 3.0.0 result contract), both owner-homologated → Constitution VIII gate is clear. Spec reconciled
  to the served-endpoint delivery (FR-105/107/108/117, US2/US3/US6, SC-104, edge cases, Assumptions). **Ready for `/speckit-plan`.**
- **Design (no delivery rework):** under the served-endpoint delivery the homologated prototype's catalog *loading* +
  *fetch-error/retry* + *seed/embutida* states are **all in play** (fetch on first load → persist → non-blocking retry → seed) —
  no states to remove; manual entry stays for uncovered/override.
