# ADR-0003: Architecture & standards decided before implementation (no inference)

- **Status**: Accepted
- **Date**: 2026-06-28
- **Deciders**: Jonatan (owner, explicit directive) + lead session.

## Context
While preparing to resume implementation, the lead session began taking "conventional defaults" for tooling and
coding standards (e.g. React Router, Context, ESLint/Prettier, pydantic-settings, CORS, app-factory, secret
handling). Jonatan rejected this: he wants **no inference** in the structural/architectural/communication/
coding-standards space. These must be defined **completely and explicitly, with him,** before any implementation
that depends on them — to avoid premature lock-in and to keep an AI-generated codebase scalable without coupling
or monolith sprawl.

## Decision
Add **Constitution Principle VIII — "Architecture Decided Before Implementation — No Inference" (NON-NEGOTIABLE)**
(Constitution bumped 1.0.0 → 1.1.0). Agents must not infer/assume/default: build & tooling, package manager &
monorepo orchestration, project/module structure & boundaries, state management, styling/UI system & design
tokens, API contract & codegen tooling, data-layer/ORM/migration patterns, secrets/config strategy, and
lint/format/type/test conventions. Unresolved → STOP, surface ≥3 options + confidence, owner decides, record it.
Product/UX/content choices may still use reasonable conventions.

Previously inferred "defaults" are **retracted** (decisions-backlog §6b). A 10-agent internet sweep (2025-2026)
is gathering the option landscape per domain to feed themed decision rounds with Jonatan.

## Options considered
- **A. Codify as a non-negotiable Constitution principle (chosen).** Strongest, gate-enforceable. Confidence 85%.
- **B. Keep it as a workflow note only.** Lighter, but weak — easy to drift back into inferring. Confidence 40%.
- **C. Case-by-case judgement.** Fastest, but exactly what Jonatan rejected. Confidence 20%.

## Consequences
- Positive: no silent architectural drift; every structural choice is explicit, owner-approved, traceable; the
  AI-generated codebase follows declared standards.
- Trade-offs: more upfront decision rounds before code (intended); slower to first code, but deliberate.
- Follow-ups: add an 8th Constitution-Check gate to `plan-template.md` at the next plan run; run the themed
  decision rounds from the 10-agent research; record each outcome (ADR or decisions doc) before implementing it.
