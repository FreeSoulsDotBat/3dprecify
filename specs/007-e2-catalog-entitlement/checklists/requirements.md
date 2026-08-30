# Specification Quality Checklist: E2 — catalog + persistence + entitlement scaffolding

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — entities and gates are stated at outcome
      level; the one storage-mechanism question is explicitly ROUTED to the plan phase (TD-005 ADR), and the
      local-dev-database note lives in Assumptions as posture, not design
- [x] Focused on user value and business needs — each story names the seller/operator value; the freemium
      boundary and out-of-band grants trace to `business-rules.md`
- [x] Written for non-technical stakeholders — the WHY-now preamble and stories read without repo knowledge
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — the four owner decisions (Q1/Q2/Q3/Q5) were taken 2026-07-09
      via the product-owner scope draft and are folded in; Q4 is deliberately a plan-phase ADR (recorded in
      Clarifications with the product constraints fixed); Q6 is a recorded assumption
- [x] Requirements are testable and unambiguous — FR-301..313 each state a verifiable MUST
- [x] Success criteria are measurable — SC-301..310 carry percentages, byte-identity, bounded propagation,
      zero-tolerance isolation
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined — Given/When/Then per story incl. deny paths, lapse, dangling
      references, offline read
- [x] Edge cases are identified — propagation lag, lapse, dangling refs, invalid data, client manipulation,
      offline write attempt, error vocabulary, A28 flag
- [x] Scope is clearly bounded — MVP = US1–US5; US6/US7 P2; Out of Scope names a target epic for every
      deferral
- [x] Dependencies and assumptions identified — R3 freemium rule, out-of-band grants, Google-only, local dev
      DB posture, reuse of auth/transport/validation

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — FRs map onto story scenarios + SCs
- [x] User scenarios cover primary flows — gate, grant, CRUD ×2, pre-fill, product, free teaser
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- US8 (offline catalog) from the scope draft was folded into US3/US5 acceptance scenarios per the decided Q2
  semantics (read cache only) rather than kept as a conditional story.
- Plan-phase gates to honor: TD-005 entitlement ADR (arquiteto presents options to the owner — Q4), TD-004
  physical schema shaped by Q3 freeze (soft-delete/read-only semantics), `ENTITLEMENT_REQUIRED` joining the
  ErrorCode pipeline (ADR-0002 seed list), designer-ux → Claude Design for catalog flows + teaser (US7).
