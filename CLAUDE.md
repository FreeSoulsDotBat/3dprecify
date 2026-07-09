Current ground: **E1 COMPLETE and SHIPPED to `develop`** — 004-e1-pricing-model (corrected pricing model +
005 US1/US2 multi-channel MVP, PR #6, 2026-07-08) + 005-marketplace-multichannel (fee catalog + offline cache
+ toggle + itemized outros custos, US3–US6 + polish, PR #7, 2026-07-08); both owner-homologated. Evidence:
`specs/{004-e1-pricing-model,005-marketplace-multichannel}/dod-evidence.md`. `pricing-core` is **3.0.0**
(ADR-0011); the fee catalog is served + cached + seeded (ADR-0010). R2 follow-ups A20/A22/A23/D2 are DONE
(typed transport wrapper, deploy env wiring + `docs/environments.md`, `/me` identity, FE Sentry).
**006-uat-deploy-hardening CODE HALF SHIPPED** (PR #8, 2026-07-09): D4 `gate:all` parity + A21 honest
contract/Schemathesis + privacy notice + UAT runbook; **first release cut `develop`→`main` done
(`0b12426`, Deploy trigger visible)**. **OWNER DECISION 2026-07-09: provisioning + first deploy DEFERRED
until v1 complete = E1–E6** — REVISITABLE as development unfolds (a change lands as a dated spec
Clarification + decision-log entry); FR-010 consciously open until then (006 spec Clarifications). Next real
increment: **E2 (catalog + persistence + entitlement scaffolding)**. Still open elsewhere: 005 T042 (design
reconciliation, non-blocking) + D1–D4 ML ingestion (blocked on the house ML account, Q-D).

Decided stack/standards (authoritative): ADR-0001..0011 + `docs/decisions/{tech-stack-decisions,audit-findings,audit-findings-r2}.md`.
- pnpm workspaces (Node 24) · React 19 + Vite 8 PWA + Tailwind v4 + Radix-wired `tf-*` DS (ADR-0007 — NOT the
  shadcn utility skin) · TanStack Router/Query · Zustand · RHF+Zod · FSD-Lite (+eslint-boundaries, dependency-cruiser).
- FastAPI (Py 3.12, uv) · pydantic-settings · camelCase wire (alias_generator) · `ErrorCode` enum → Orval TS
  union in `apps/web/src/shared/api` · structlog correlation-first + `X-Correlation-Id` · Firebase emulator (dev).
- Deploy: Cloud Run + Firebase Hosting (southamerica-east1), WIF keyless. Runbook: `docs/runbooks/uat-deploy.md`.
- Gates: **`pnpm gate:all`** (frontend format/lint+boundaries/depcruise/typecheck/coverage AND backend
  ruff/basedpyright/pytest/import-linter) — the SAME literal command runs in lefthook pre-push and the CI gate
  job (D4, no local↔CI drift). Pricing formula canonical in `packages/pricing-core` (TS, offline) — backend
  never recomputes (only e2e/docker/drift/secret-scan are CI-only).

Constitution: `.specify/memory/constitution.md` (incl. **Principle VIII** — no inferring architecture/standards).
Pricing domain reference: `docs/pricing-model-from-spreadsheet.md` (original model — third-party sheet NOT copied).
Integration branch is **`develop`** (slices land via owner-authorized squash-merged PRs; `main` = release, per
ADR-0006). Shipped so far: 001+003 (PRs #3/#4), 004+005 (PRs #6/#7). Jonatan authorizes each push/merge.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/007-e2-catalog-entitlement/plan.md
<!-- SPECKIT END -->
