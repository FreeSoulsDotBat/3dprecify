# Feature Specification: R2 infra close-out — first public UAT deploy + contract hardening + gate parity

**Feature Branch**: `feature/006-uat-deploy-hardening`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "R2 infra close-out — first public UAT deploy (T022) + API-contract hardening (A21) + full local↔CI gate parity (D4) + ground-state reconcile. The follow-ups decided 2026-07-02 in `docs/decisions/audit-findings-r2.md` §R2-G2/G3 that remain unimplemented now that E1 (004+005) is merged to `develop`. Already done and OUT of scope (verified in-repo 2026-07-08): A9/A20 typed transport wrapper, A22 runtime-env wiring + `docs/environments.md`, D2 FE observability, A23 `/me` identity wiring."

> **Why now.** The E1 calculator (specs 004 + 005) is fully built, homologated and merged to `develop` — but
> FR-010 (public deploy, a MUST since 002) remains unmet: no user can reach the app; every proof is local or
> CI-only. The deploy pipeline exists but has **never run**: it is manual-only, every deploy target is
> deliberately inert (its enablement flag and credentials were never configured), and the pipeline definition
> is absent from the repository's default branch, so the hosting platform does not even offer the manual
> trigger. Separately, two decisions that keep our quality claims honest are still pending: the
> protected-endpoint error contract + response-conformance checking (A21 — the conformance tool is a declared
> dependency invoked nowhere), and the shared everything-gate (D4 — the local pre-push hook runs only the
> frontend checks, so "green locally" ≠ "green in CI"; that gap already cost one red-PR fix cycle on PR #6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A real user reaches the deployed calculator (T022, Priority: P1)

The owner triggers a deploy to the UAT environment. Minutes later, any person with the public UAT link — on
their phone, with no developer tooling — opens the Precifica3D calculator, computes a price with the full
multi-channel model, signs in with Google, and sees their server-confirmed identity on the account page. The
owner can homologate every future slice remotely from a real device, and FR-010 stops being unmet.

**Why this priority**: It is the only MUST-level requirement (FR-010, carried since 002) still open, and it
unblocks everything downstream: remote homologation, real-device feedback, UAT for E2+. Every other story in
this spec exists to make this one safe and repeatable.

**Independent Test**: Trigger one deploy, then complete the smoke checklist from a phone that has never seen
the project: app loads → calculator computes → fee reference is the served one → sign-in works → identity
shows → offline mode still computes. No local tooling involved.

**Acceptance Scenarios**:

1. **Given** the UAT environment is configured and enabled, **When** the owner triggers the deploy, **Then**
   the pipeline completes without manual intervention and reports the deployed version (traceable to the exact
   commit).
2. **Given** the deploy completed, **When** a visitor opens the public UAT URL on a mobile device, **Then**
   the app shell loads, the calculator computes prices (multi-channel + sub-costs), and the marketplace fee
   reference is served fresh (its honesty seal shows the online reference, not the embedded fallback).
3. **Given** the deployed app, **When** the visitor signs in with Google, **Then** sign-in succeeds against
   real authentication and the account page shows the server-confirmed identity; a failure shows the friendly
   pt-BR error — never a blank screen or a raw error code.
4. **Given** the deployed app was loaded once, **When** the device goes offline, **Then** the calculator keeps
   computing fully (the free/offline/signed-out guarantee holds in production exactly as it does locally).
5. **Given** a deployed version misbehaves, **When** the owner follows the documented rollback, **Then** the
   previous version is restored and verified within minutes.
6. **Given** an environment that is NOT enabled/configured, **When** a deploy is triggered against it,
   **Then** the pipeline stops loudly at the guard step — it never half-deploys or silently no-ops.

---

### User Story 2 - One command, every gate — local green means CI green (D4, Priority: P2)

A developer (or agent) about to push runs a single command that executes **all** quality gates — frontend
formatting/lint/boundaries/types/coverage AND backend lint/types/tests/import-rules — the exact same set CI
runs. The pre-push hook invokes that same command, so a push that passes locally cannot fail CI for a gate
reason. "No drift by construction" becomes literally true instead of aspirational.

**Why this priority**: The local↔CI gap already produced a red PR cycle (PR #6: backend lint + coverage
failures not caught locally) and currently survives only as tribal knowledge ("remember to run the backend
gate manually"). Fixing it protects every future slice, including this spec's own PR.

**Independent Test**: Introduce a deliberate backend lint violation and a frontend coverage drop; the single
command fails locally on both. Fix them; the command passes; push; CI passes without any gate-related failure.

**Acceptance Scenarios**:

1. **Given** a working tree with a backend-only defect (lint/type/test), **When** the developer runs the
   all-gates command, **Then** it fails locally with the same verdict CI would give.
2. **Given** the all-gates command passes locally, **When** the branch is pushed and the PR runs CI, **Then**
   no gate check fails (parity holds for frontend AND backend gates).
3. **Given** the pre-push hook, **When** a push is attempted, **Then** the hook runs the same all-gates target
   (accepted cost: slower push, decided R2-G3) — not a reduced subset.

---

### User Story 3 - The API's error contract tells the truth, provably (A21, Priority: P3)

A consumer of the API contract (today: the generated typed client; tomorrow: any integrator) sees exactly the
error responses the API can actually produce on protected endpoints — authentication failures and validation
errors in the standard error envelope — with no phantom schemas. A conformance suite exercises the real API
against the published contract in CI, so the contract cannot silently drift from reality.

**Why this priority**: Honesty of the published contract (Principle II applied to the API surface) and the
last inert quality tool (the conformance checker is a declared dependency that runs nowhere). Lower priority
than deploy/parity because today's only consumer is our own generated client — but it must land before E2
grows the API surface.

**Independent Test**: Regenerate the typed client from the updated contract — the phantom validation schemas
disappear and the drift-guard stays green; run the conformance suite in CI — it exercises the endpoints and
passes; deliberately break a documented response shape locally — the suite fails.

**Acceptance Scenarios**:

1. **Given** the published contract, **When** a protected endpoint rejects a request (unauthenticated,
   forbidden, malformed), **Then** the documented response for that status is the standard error envelope —
   and the actual wire response matches it.
2. **Given** the regenerated typed client, **When** the contract drift-guard runs, **Then** it stays green and
   no phantom validation schema remains in the generated types.
3. **Given** the conformance suite in CI, **When** an endpoint's real response stops matching its documented
   contract, **Then** CI fails.

---

### User Story 4 - The recorded ground state matches reality (Priority: P4)

Anyone (owner, agent, future contributor) reading the project's ground-state summary sees the truth: E1
(004 + 005) is shipped to `develop`; the next increment is this one. The stale deploy-era orphan branch is
pruned after confirming it is superseded. Lean Living Documentation (Principle VI) holds.

**Why this priority**: Cheap, prevents every future session from re-deriving state or trusting stale
instructions — but nothing user-facing depends on it.

**Independent Test**: Read the ground-state summary — it names 004+005 as shipped (PRs #6/#7) and this spec as
current; the orphan branch no longer exists on the remote (its unique changes verified subsumed first).

**Acceptance Scenarios**:

1. **Given** the updated ground-state summary, **When** a new session starts from it, **Then** no statement in
   it contradicts the repository (branches, merged PRs, next increment).
2. **Given** the orphan deploy-era branch, **When** its diff is compared against `develop`, **Then** every
   change it carries is confirmed superseded before the branch is deleted — never deleted blind.

### Edge Cases

- **Deploy fails mid-way** (image built but service not switched, or API live but web assets stale): the
  pipeline must fail loudly and leave a usable state; the runbook covers verifying which half moved and
  rolling back. A deploy whose smoke checklist fails is a FAILED deploy (Principle II) — no "shipped with
  caveats".
- **Keyless credential misconfiguration** (identity federation between CI and cloud): the failure surfaces at
  the deploy step with an actionable message — never a silently skipped push.
- **Cross-origin misconfiguration** (web origin not allowed by the API): the calculator must keep working
  (it is fully client-side); only the identity/fee-refresh calls degrade, with their existing honest,
  non-blocking errors. The smoke checklist explicitly covers this failure mode.
- **First-load performance on a cold service**: the first request after idle may be slow; the smoke checklist
  measures a cold and a warm load so expectations are recorded honestly, not hidden.
- **Conformance suite finds a real mismatch** (documented shape ≠ actual response): fix the API or the
  contract — never loosen the suite to pass (Principle II).
- **All-gates command is slow on modest hardware**: accepted, decided cost (R2-G3). The command must still be
  a single target with no "fast mode" subset that reintroduces drift.
- **Deploy triggered from the wrong source branch**: UAT deploys build from `develop` (the integration
  branch, per ADR-0006); the runbook states the intended source per environment and the pipeline records
  which commit shipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-201**: The owner MUST be able to trigger a deploy of the current integration state to a public UAT
  environment through a deliberate manual action (never automatic on merge), and the action MUST be available
  without local tooling.
- **FR-202**: The deployed UAT app MUST serve the full E1 calculator (004+005) at a public URL: app shell,
  multi-channel pricing, itemized sub-costs, served fee reference with honesty seals, sign-in, and
  server-confirmed identity.
- **FR-203**: The deployed app MUST preserve the free/offline/signed-out guarantees in production: the
  calculator computes with no sign-in and keeps computing offline after first load; no price computation ever
  happens server-side.
- **FR-204**: A deploy MUST be verifiable by a documented smoke checklist executable from any device with the
  URL (no developer tooling), and a deploy that fails the checklist MUST be treated as failed.
- **FR-205**: The deployed version MUST be traceable to the exact commit that produced it, and observable
  failures (API errors) MUST carry the existing correlation identifier end-to-end in production.
- **FR-206**: A documented rollback procedure MUST exist and MUST have been exercised at least once against
  UAT before this feature is considered done.
- **FR-207**: Deploy targets MUST stay inert-by-default: an environment that has not been explicitly enabled
  and configured MUST refuse to deploy at a guard step with a clear message.
- **FR-208**: The UAT environment's required configuration (which values, where they live, who sets them)
  MUST be documented, and secrets MUST never enter the repository (existing secret-scan gates keep applying).
- **FR-209**: Deploying MUST NOT require bypassing the repository's governance (ADR-0006: `main` = release,
  owner authorizes merges); the mechanism that makes the manual trigger available MUST be owner-authorized
  and recorded. Mechanism: **the first formal release merge `develop` → `main`** (owner-decided 2026-07-08,
  see Clarifications) — `main` receives the homologated E1 state through ADR-0006's own release path, which
  makes the pipeline definition available on the default branch as a consequence. This release cut is NOT
  accompanied by a production deploy (prod stays out of scope); it is the state snapshot that UAT work
  hardens against.
- **FR-210**: Protected API endpoints MUST document their authentication/authorization/validation error
  responses as the standard error envelope, MUST NOT publish phantom schemas that the API never returns, and
  the regenerated typed client MUST reflect this with the contract drift-guard green.
- **FR-211**: An automated response-conformance check (real requests vs published contract) MUST run in CI
  and MUST fail when reality and contract diverge; the temporary "hand-written test substitutes for it" note
  on the fee-reference endpoint ends when this lands.
- **FR-212**: A single command MUST run every quality gate (frontend format/lint/boundaries/types/coverage +
  backend lint/types/tests/import-rules), and BOTH the local pre-push hook and CI MUST invoke that same
  command — no reduced local subset.
- **FR-213**: The project's ground-state summary MUST be reconciled to the post-004/005 reality, and the
  superseded deploy-era orphan branch MUST be pruned only after its diff is verified subsumed by `develop`.
- **FR-214**: BEFORE the UAT URL is shared beyond the owner, the app MUST present the owner-decided privacy
  posture for sign-in (Google sign-in collects e-mail). Decision: **Option A — a minimal honest privacy
  notice** (what is collected — e-mail via Google sign-in; why — identifying your account; no resale, no
  tracking beyond error monitoring) as a page/section linked from the sign-in screen, in pt-BR —
  owner-decided 2026-07-08, see Clarifications. The calculator itself collects nothing and stays
  notice-free.

### Key Entities

- **UAT environment**: the single pre-production deploy target — its enablement flag, non-secret
  configuration values, secret values, and public URL(s). Inert until explicitly enabled.
- **Deploy run**: one execution of the pipeline — source commit, target environment, outcome, deployed
  version identifier; the unit the runbook and rollback reason about.
- **Smoke checklist**: the ordered, device-executable verification list that defines "deployed and working"
  (load, compute, served fees, sign-in, identity, offline, cold/warm load).
- **Error contract**: the published set of error responses per endpoint (status → standard error envelope),
  the thing conformance checking keeps honest.
- **All-gates command**: the single quality target shared verbatim by the local pre-push hook and CI.
- **Runbook**: the deploy + rollback + configuration document for UAT.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-201**: A person with only the UAT link, on a phone that never saw the project, reaches the calculator
  and computes a price in under 60 seconds from first tap, with zero developer assistance.
- **SC-202**: 100% of the smoke checklist passes on the first accepted deploy — including sign-in with
  server-confirmed identity and the served (non-embedded) fee reference — and the result is recorded as DoD
  evidence.
- **SC-203**: After one online load, the deployed calculator computes prices with the device fully offline —
  same results as online (byte-identical inputs → identical prices).
- **SC-204**: A repeat deploy with no code change completes end-to-end in under 30 minutes and produces no
  user-visible change (repeatable, idempotent); the rehearsed rollback restores the previous version in under
  10 minutes.
- **SC-205**: The conformance suite runs in CI and passes; a deliberately broken response shape makes it fail
  (verified once, locally); zero phantom validation schemas remain in the regenerated client.
- **SC-206**: Over this feature's own PRs, zero CI failures caused by a gate the local all-gates command
  would have caught — and the pre-push hook and CI invoke the identical target (inspectable, not asserted).
- **SC-207**: The ground-state summary contains zero statements contradicted by the repository, and the
  orphan branch is gone from the remote with its supersession recorded.

## Clarifications

### Session 2026-07-08

- Q: LGPD/privacy posture before sharing the UAT URL (sign-in collects e-mail via Google) → A: **Option A —
  minimal honest privacy notice** (pt-BR page/section linked from sign-in: e-mail collected via Google
  sign-in to identify the account; error monitoring; no resale/tracking). Enough for UAT with test users;
  a fuller LGPD pass (consent management, data deletion flow) is deliberately deferred to the epic that
  introduces persistence (E2). Folded into FR-214.
- Q: Mechanism to make the manual deploy trigger available (pipeline definition absent from the default
  branch `main`) → A: **full release merge `develop` → `main`** (owner chose this over a workflows-only
  PR). The first formal release cut lands the homologated E1 state on `main` through ADR-0006's own path,
  and the deploy trigger becomes available as a consequence. Explicitly acknowledged: this cuts a release
  before a verified deploy exists — accepted by the owner; the release is a repository state snapshot, not
  a production deploy (prod deploy remains out of scope). Folded into FR-209.

### Session 2026-07-09

- Q: When to provision the cloud side and run the first deploy? → A (OWNER DECISION, re-scopes this
  feature): **defer provisioning + first deploy until "version 1 complete" = epics E1–E6 delivered**
  (calculator ✅ · catalog+persistence · BOM · history/export · marketplace scenarios · billing — the
  monetizable product). Consequences, recorded honestly (Principle II): the US1 EXECUTION half
  (provisioning P1–P11, GitHub `uat` Environment, the deploy trigger, smoke checklist, rollback
  rehearsal — FR-201..208 fulfillment, SC-201..204 measurement) is **DEFERRED to the v1-complete
  milestone**, and **FR-010 (public deploy, MUST since 002) consciously stays open across E2–E6** — remote
  homologation on real devices remains impossible until then. Everything the deploy needs is left READY
  and verified at the dry level: pipeline on the default branch (trigger visible), runbook, gate parity,
  honest contract, privacy notice. Risk accepted: the first real deploy will carry a much larger surface;
  mitigants are the hardened pipeline, the runbook, and the conformance/e2e suites. This feature therefore
  CLOSES with its code half (US2, US3, US1-code, US4) + the release cut; the execution half re-opens as
  the v1-launch increment.

## Assumptions

- The owner provides (or creates, guided) the cloud project, billing, and console access for the UAT
  environment; where a step needs console/billing actions only the owner can take, the work item is
  explicitly owner-gated (like Q-D in 005) rather than silently assumed.
- The UAT URL is an unlisted default platform URL (no custom domain in this feature); anyone with the link
  can reach it — access control beyond unlisted-ness is out of scope for UAT.
- UAT deploys build from the integration branch (`develop`), per the pipeline's stated intent. The release
  merge `develop` → `main` (FR-209) is owner-authorized within this feature, but deploying FROM `main`
  (production) remains a separate, future owner act.
- The existing pipeline definition, runtime-env wiring, typed transport wrapper, FE observability, and
  `/me` identity wiring are reused as-is (verified present in-repo 2026-07-08); this feature configures,
  triggers, verifies, and documents — it does not rebuild them.
- The already-registered decisions this feature implements (A21, D4, T022 mechanics) were made 2026-07-02
  (`docs/decisions/audit-findings-r2.md` §R2-G2/G3); this spec does not reopen them.
- The e2e suite continues to run against the local preview + emulator in CI; smoke-testing the deployed UAT
  is a manual, documented checklist in this feature (automating it is a candidate follow-up, not scope).

## Out of Scope

- **Production deploy** and custom domain. The release merge `develop` → `main` (FR-209) IS in scope as the
  trigger-availability mechanism, but nothing is deployed FROM `main` in this feature.
- ML fee-catalog ingestion (D1–D4 of 005) — still blocked on the dedicated house ML account (Q-D).
- E2 persistence/entitlements, payments (E6), i18n library (TD-001), brand webfonts (TD-010/014).
- T042 design reconciliation — belongs to 005, non-blocking, unaffected here.
- Full LGPD program (consent management, data-deletion flows) — deferred to the persistence epic (E2), per
  the Clarifications decision.
