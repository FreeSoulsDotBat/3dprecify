# ADR-0001: Development process & meta-plan

- **Status**: Accepted
- **Date**: 2026-06-26
- **Deciders**: Jonatan (owner) + lead session; informed by the 10-specialist SDD gap review.

## Context
The SDD compressed PASSO 0 (how we plan/execute each increment). The gap review found that the named
`scrum-master` cannot orchestrate other subagents (only the main thread can), ADRs were referenced but had no
mechanism, branching/PR was undefined (work landed on `main` despite a feature-branch claim), and the DoD was
self-attested (the local hook runs only lint/format/type, not tests). This ADR fixes the process.

## Decision (Round 1)
1. **Orchestration & human gates** — The **main thread (Jonatan + lead Claude session) is the orchestrator**;
   it sequences the specialist agents. `scrum-master` is an **advisor** (cadence, DoR/DoD audit, handoff order),
   not an executor. Jonatan approves at **3 gates**: (G1) scope after `/speckit-specify`; (G2) every ADR;
   (G3) increment DoD sign-off. Everything else is agent-autonomous.
2. **Branching & merge** — Private **GitHub** remote. Planning/process docs commit to `main`. Each
   **implementation increment** uses a branch `NNN-slug` → **PR** with required CI checks → squash-merge to
   `main` (solo self-approval allowed; the value is CI running on the PR, not on the dev machine).
3. **CI & DoD enforcement** — **GitHub Actions** runs lint + type-check + tests (Vitest, pytest, Playwright) on
   every push/PR. Intended as a **required check** to merge (PR + green CI, admin-bypass for planning docs).
   **Constraint (2026-06-27):** branch protection / rulesets are unavailable on **GitHub Free + private repos**
   (403 "Upgrade to Pro"). Decision: keep the repo private and enforce the gate **by convention** — CI shows
   ✅/❌ on every PR/push; do not merge red. Upgrade to GitHub Pro (or add the ruleset) to make it a **hard**
   gate when collaborators join. The local PostToolUse hook stays as fast feedback only. Each increment appends
   a **DoD evidence block** (test output, qa-produto screenshots/console, analyze result).
4. **ADRs** — `docs/adr/` MADR-style, numbered, ≥3 options + confidence, linked from `plan.md` Constitution
   Check. Required for any out-of-scope/structural decision (Constitution §V/Governance).

### Definition of Ready (entry gate for an increment)
Acceptance criteria + ≥1 measurable Success Criterion; contracts/data-model exist for touched surfaces; UX
packet delivered if UI-touching; dependencies done; failing tests authored first.

### Definition of Done (exit gate)
Spec clean & current · logical tests green · visual homologated by qa-produto · server-side entitlement where
applicable · Constitution Check clean · lint/format/type-check green · no dead/duplicated code · DoD evidence
block recorded.

### Increment workflow
DoR → (PO scope, G1) → arquiteto/ADR if needed (G2) → data/back/front implement (test-first) →
qa-software (logical) + qa-produto (visual) → seguranca review if auth/payments/premium → devops (CI/deploy) →
DoD sign-off (G3) → squash-merge PR.

### Feature ↔ increment ↔ story
One spec-kit feature = one increment = one branch/PR. Each P-story is an independently-testable checkpoint
within it. DoD applies per story-checkpoint and per feature.

## Options considered
- **A. Main-thread orchestrator + 3 human gates + branch-per-increment + blocking CI + MADR ADRs** — chosen.
  Pros: enforceable, verifiable "done", matches tool reality; Cons: a bit more ceremony than trunk/local-only.
  Confidence 80%.
- **B. Per-phase human approval + trunk on main + local-hook-only** — max control/lowest infra, but Jonatan
  becomes a bottleneck and test-first stays honor-system. Confidence 55%.
- **C. Full agent autonomy except ADRs + direct-to-main + CI non-blocking** — fastest, but weakest guarantees;
  violates the blocking-gate principle. Confidence 50%.

## Consequences
- Positive: "done" is mechanically verifiable; decisions are traceable; clean diff boundary per increment.
- Trade-offs: requires GitHub remote + CI upkeep; PR overhead for a solo dev (accepted for the CI guarantee).
- Follow-ups: stand up CI workflow (extend as backend/web land); branch protection is **convention-only** until
  a GitHub Pro upgrade (free+private blocks it); bootstrap + pricing-core are grandfathered on `main` as the
  base; remaining 001 work and all later increments use feature branches.
