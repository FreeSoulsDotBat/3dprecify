# Specification Quality Checklist: E4 — Histórico + snapshots reproduzíveis + export

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Zero `[NEEDS CLARIFICATION]` markers.** The scope was modeled up front by the product-owner
(`docs/product/e4-scope-brief.md`); four load-bearing questions were decided by the owner on 2026-07-12, and
`/speckit-clarify` put five more to the owner the same day (spec §Clarifications).

**`/speckit-clarify` outcome (2026-07-12)** — 5 questions asked:

- **Q2 CONFIRMED** — kits recordable from PR-A (the first slice's frozen payload carries kit lines + channel
  rollup).
- **Q5 CONFIRMED** — PDF + CSV; public share link OUT.
- **Q8 FLIPPED** 🔄 — **offline recording queue**, against the PO's 80% recommendation of online-only. This is
  the **product's first offline write** (every write in E2/E3 is online-only) and it materially grew PR-A:
  local durability, exactly-once sync, a visible pending state, entitlement checked at sync (FR-527/529).
- **Snapshot clock** (a follow-up the flip forced, since the date *is* the claim) — **device clock only**. The
  server stores a timestamp it cannot verify; the dual-date alternative was offered and declined. Recorded as
  an **owner-accepted integrity limitation** (FR-528), explicitly so the security review judges it as a
  decision rather than discovering it as a bug.
- **NEW (not among the nine)** — a **kit** quote must itemize its pieces (name + quantity) + total, still with
  zero internal cost lines (FR-512).

Six defaults stand unconfirmed but declared and written into the FRs (Q1, Q4, Q9, Q10, Q11, Q12 — all at
75–90% PO confidence). A green checklist means "specified and testable", not "owner-confirmed on all nine".

**Terminology fixed during validation**: the brief cited a `business-rules.md` rule **"R3"** that does not
exist — it was the PO's shorthand for *"Revised Round 3 (2026-06-29)"* in §Freemium boundary. Corrected in both
the spec and the brief. The underlying claim held on verification, and the same section independently
corroborates the Q5 default by already naming *"Export / share (PDF / CSV)"* as Premium.

**Known deliberate gap (owner decision Q13)**: E1–E3 model no seller identity, so an exported quote will carry
the seller's personal login e-mail and no business name. Recorded, accepted, left open.
