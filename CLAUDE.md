Current ground: **001-walking-skeleton + 003-app-shell-and-ds SHIPPED to `develop`** (squash-merged 2026-07-04
as PR #3 / 2026-07-05 as PR #4 — both owner-homologated + adversarially audited) on the **002-foundation** base
(toolchain, gates, backend+web skeletons, contract pipeline, CI). See `specs/{002-foundation,003-app-shell-and-
ds}/{spec,tasks,dod-evidence}.md`. Next real increment: **E1 calculator** (real pricing model — A16/A24/A25
pending) + the R2 backend/infra follow-ups (A21 `/me` contract, A22 GH Environments, D4 shared `gate:all`,
deploy T022).

Decided stack/standards (authoritative): ADR-0001..0007 + `docs/decisions/{tech-stack-decisions,audit-findings}.md`.
- pnpm workspaces (Node 24) · React 19 + Vite 8 PWA + Tailwind v4 + Radix-wired `tf-*` DS (ADR-0007 — NOT the
  shadcn utility skin) · TanStack Router/Query · Zustand · RHF+Zod · FSD-Lite (+eslint-boundaries, dependency-cruiser).
- FastAPI (Py 3.12, uv) · pydantic-settings · camelCase wire (alias_generator) · `ErrorCode` enum → Orval TS
  union in `apps/web/src/shared/api` · structlog correlation-first + `X-Correlation-Id` · Firebase emulator (dev).
- Deploy: Cloud Run + Firebase Hosting (southamerica-east1), WIF keyless.
- Gates: `pnpm gate` (format/lint+boundaries/depcruise/typecheck/coverage) + backend (ruff/basedpyright/pytest/
  import-linter). Pricing formula canonical in `packages/pricing-core` (TS, offline) — backend never recomputes.

Constitution: `.specify/memory/constitution.md` (incl. **Principle VIII** — no inferring architecture/standards).
Pricing domain reference: `docs/pricing-model-from-spreadsheet.md` (original model — third-party sheet NOT copied).
Integration branch is **`develop`** (slices land via owner-authorized squash-merged PRs; `main` = release, per
ADR-0006). First commits landed 2026-07-04 (001 via PR #3); 003 merged 2026-07-05 (PR #4). Jonatan authorizes
each push/merge.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/006-uat-deploy-hardening/plan.md
<!-- SPECKIT END -->
