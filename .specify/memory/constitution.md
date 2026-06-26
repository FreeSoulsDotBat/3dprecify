<!--
SYNC IMPACT REPORT
Version change: (template) → 1.0.0
Bump rationale: Initial ratification of the project constitution (MAJOR baseline).
Modified principles: all placeholders replaced with concrete principles.
Added sections:
  - Core Principles (7 principles)
  - Product & Platform Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: none.
Templates requiring updates:
  - .specify/templates/plan-template.md ........ ✅ updated (Constitution Check now enumerates 7 gates)
  - .specify/templates/spec-template.md ......... ✅ compatible (no mandatory section change)
  - .specify/templates/tasks-template.md ........ ✅ updated (tests made MANDATORY + visual test added;
                                                   removed "tests OPTIONAL" language that violated Principle III)
Deferred TODOs: none.
-->

# 3dprecify (Precifica3D) Constitution

> Working language of this document: English (technical source of truth).
> User-facing product copy and UX content: Brazilian Portuguese (pt-BR), internationalization-ready.
> Brand: Truth's Forge.

## Core Principles

### I. Scalability & Quality First (NON-NEGOTIABLE)
Every decision MUST favor, in this order, software scalability (web + mobile from one shared core),
software quality, and product quality. Choices that trade these away for short-term convenience are
rejected unless justified by an ADR. Architecture MUST assume cross-platform growth (web + Google Play +
future international markets) from day one.

### II. Truth Over Approval (NON-NEGOTIABLE)
Agents MUST never flatter or try to please. Every non-trivial claim carries an explicit confidence
percentage and distinguishes **knowledge** (verified) vs **inference** (reasoned) vs **speculation**.
Libraries, APIs, data, and behaviors MUST NEVER be fabricated; when unknown, verify against a current
source or say so. Agents MUST explicitly flag the user's errors and any unverified premise.

### III. Test-First (NON-NEGOTIABLE)
No feature ships without tests. Both layers are required: **logical** tests (unit/integration of domain
and API) and **visual** tests (the rendered UI homologated by QA through the canvas/MCP). Tests are
written and observed failing before implementation; pricing formulas MUST have explicit numeric test
cases.

### IV. Server-Side Entitlements (NON-NEGOTIABLE)
Paid/premium access MUST be validated server-side. The client is never trusted for entitlement, quota,
or feature-gating decisions. Authentication, authorization, and subscription state are authoritative on
the backend and verified on every protected operation.

### V. Clean Architecture Integrity
Code and docs MUST respect the agreed architecture and code structure. Dirty or poorly optimized code is
PROHIBITED. New code MUST account for existing code and prior decisions — no orphan re-implementations,
no duplication, no dead code, no leaving known bugs behind. Any decision outside the agreed architectural
scope MUST be raised as an ADR and approved before it lands.

### VI. Lean Living Documentation
SDD artifacts are the single source of truth and MUST stay minimal and current. Dead rules, superseded
decisions, outdated guidance, and noise are PROHIBITED. When behavior changes, the spec changes in the
same increment; what became false is deleted, not appended around. Documentation grows only when it earns
its keep.

### VII. Spec-Driven Flow with Blocking Gates
The pipeline `constitution → specify → clarify → checklist → plan (+Constitution Check) → tasks →
analyze → implement` is mandatory. `clarify`, `checklist`, `analyze`, and the `Constitution Check` are
GATES that MUST BLOCK progress on violation or unresolved ambiguity. The spec is the source of truth; code
conforms to the spec, never the reverse.

## Product & Platform Constraints

- **Codename**: `3dprecify`. **Public name (initial)**: Precifica3D. Market: Brazil first, international next.
- **Platforms**: mobile-first responsive web + desktop web + Android (Google Play). One shared domain core.
- **Monetization**: freemium; basic pricing free; recurring premium subscription unlocks full features on
  BOTH app and web. Entitlement is enforced per Principle IV.
- **Payments**: recurring subscriptions; the Google Play Billing vs. external-PSP constraint is an open
  architectural risk and MUST be resolved by an ADR before any payment code is written.
- **Design split**: UX (flows, states, information architecture) is produced in-project; final UI is
  produced in Claude Design. Agents own UX specs, not pixel-final UI.

## Development Workflow & Quality Gates

- **Cadence**: small, reviewable, testable increments. The first increment is a vertical walking skeleton
  (auth → one pricing calculation → one screen → web deploy).
- **Quality gates are progressive**: light on the skeleton, hardened as the domain stabilizes; always heavy
  on critical areas (payments, entitlements, pricing formulas).
- **Definition of Done** (per increment): spec updated and clean · logical tests green · visual test
  homologated by QA · server-side entitlement where applicable · Constitution Check clean ·
  lint/format/type-check green (PostToolUse hooks) · no dead/duplicated code.
- **Agent roles & handoffs**: product-owner → arquiteto → dev-estrutura-de-dados → dev-backend /
  dev-frontend → qa-software + qa-produto → devops; scrum-master orchestrates cadence and DoD;
  designer-ux bridges to Claude Design; seguranca reviews auth/RLS/entitlements. Each agent has a focused
  prompt and least-privilege tools.

## Governance

This constitution supersedes other practices. Amendments require an ADR, explicit approval from the
project owner (Jonatan), and a semantic version bump (MAJOR: principle removal/redefinition; MINOR: new
principle/section; PATCH: clarification). Every quality gate MUST verify compliance; a detected violation
blocks the increment until resolved or formally waived by an approved ADR. Runtime agent guidance lives in
`CLAUDE.md` and agent files under `.claude/agents/`, which MUST stay consistent with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-06-26
