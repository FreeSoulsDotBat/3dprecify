# Data Model — 006 UAT deploy + contract hardening + gate parity

No persisted application data changes in this feature (the pricing domain is untouched; nothing is stored).
The "entities" are **configuration and process records** — where each lives, its fields, and what validates
it. Field inventories live in [research.md](./research.md) §1.1–1.2; this file defines shape + rules only.

## 1. UAT Environment (GitHub Environment `uat` + GCP/Firebase resources)

| Field | Type | Rule |
|---|---|---|
| `DEPLOY_ENABLED` | var, `"true"`/absent | Absent/≠true ⇒ guard step fails the run (FR-207, inert-by-default) |
| `GCP_PROJECT`, `GCP_REGION`, `FIREBASE_PROJECT` | vars | Region MUST be `southamerica-east1` (ADR-0005/A10); `FIREBASE_PROJECT` = `precifica3d-uat` (matches `.firebaserc`) |
| `SPA_ORIGINS` | var, optional JSON array | Only when served origin ≠ derived `*.web.app` default (CORS edge case) |
| `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` | secrets | WIF provider pinned `repository == <owner>/3dprecify`; SA carries least-privilege role set (research §1.2 — verify names at grant) |
| `FIREBASE_SERVICE_ACCOUNT` | secret (JSON) | The one long-lived credential — accepted for UAT, recorded for rotation (research §7) |
| `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_APP_ID` | secrets | From the Firebase Web App (P9) |
| `SENTRY_DSN`, `SENTRY_DSN_WEB` | secrets, optional | Observability only; absence degrades to no-op |

**Invariant**: none of these values ever enters the repository (FR-208 — existing secret scans enforce).

## 2. Deploy Run

| Field | Rule |
|---|---|
| source ref | `develop` for UAT (ADR-0006); recorded in the run |
| commit (`github.sha`) | THE traceability key (FR-205) → `P3D_RELEASE` (backend) and, if the owner accepts the 1-line change, `VITE_RELEASE` (web) |
| outcome | `verified` only when the FULL smoke checklist passes; anything else = **failed deploy** (Principle II) — no partial states recorded as success |
| halves | backend (Cloud Run revision) + web (Hosting release) deploy sequentially in one job; rollback is **per half** (research §7) |

## 3. Smoke Checklist (ordered, device-executable — canonical copy lives in `docs/runbooks/uat-deploy.md`)

App shell loads → calculator computes (multi-channel + sub-costs) → fee seal shows **served** reference (not
`embedded`) → Google sign-in succeeds → account shows `/me` server-confirmed identity → airplane mode →
calculator still computes identically (SC-203) → cold vs warm first-load recorded. **Rule**: executable with
only the URL, no developer tooling (FR-204).

## 4. Error Contract (published OpenAPI error surface)

Per-operation `status → schema` map; the single error schema is the existing camelCase `ErrorEnvelope`.
**Rules**: only *reachable* statuses may be published (no phantom 403/422 — Principle II); every reachable
error status MUST be published (the currently-undocumented 401 on `/me` is the defect); conformance
(Schemathesis over ASGI) fails CI on any divergence. Full map: [contracts/error-contract.md](./contracts/error-contract.md).

## 5. Gate Target

`gate:fe` (format/lint/depcruise/typecheck/coverage) · `gate:be` (ruff check+format, basedpyright, pytest —
which now includes conformance —, lint-imports, under uv) · `gate:all` = `gate:fe && gate:be`. **Invariant
(SC-206)**: `lefthook.yml` pre-push and the CI gate job invoke the **identical** `pnpm gate:all` string —
parity is inspectable by reading both files, never asserted by a meta-test.

## 6. Runbook (`docs/runbooks/uat-deploy.md`)

Sections fixed by research §1.4: (1) config & prerequisites, (2) deploy steps (workflow → `uat`, ref
`develop`, record run URL + sha), (3) smoke checklist (§3 above), (4) rollback + half-deploy triage.
**Rule**: the completed first run (checklist results + cold/warm numbers + rollback rehearsal) is recorded in
`dod-evidence.md` (SC-202/SC-204).
