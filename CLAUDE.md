<!-- SPECKIT START -->
Current ground: **002-foundation BUILT & green** (toolchain, gates, backend+web skeletons, contract pipeline,
CI). See `specs/002-foundation/{spec,tasks,dod-evidence}.md`. Next real increment: implement **001-walking-
skeleton** product stories ON this foundation (its plan/tasks are bannered as superseded for tooling).

Decided stack/standards (authoritative): ADR-0001..0004 + `docs/decisions/{tech-stack-decisions,audit-findings}.md`.
- pnpm workspaces (Node 24) · React 19 + Vite 8 PWA + Tailwind v4 + shadcn · TanStack Router/Query · Zustand ·
  RHF+Zod · FSD-Lite (+eslint-boundaries, dependency-cruiser).
- FastAPI (Py 3.12, uv) · pydantic-settings · camelCase wire (alias_generator) · `ErrorCode` enum → Orval TS
  union in `apps/web/src/shared/api` · structlog correlation-first + `X-Correlation-Id` · Firebase emulator (dev).
- Deploy: Cloud Run + Firebase Hosting (southamerica-east1), WIF keyless.
- Gates: `pnpm gate` (format/lint+boundaries/depcruise/typecheck/coverage) + backend (ruff/basedpyright/pytest/
  import-linter). Pricing formula canonical in `packages/pricing-core` (TS, offline) — backend never recomputes.

Constitution: `.specify/memory/constitution.md` (incl. **Principle VIII** — no inferring architecture/standards).
Pricing domain reference: `docs/pricing-model-from-spreadsheet.md` (original model — third-party sheet NOT copied).
**Nothing committed yet** — Jonatan authorizes the first commit (see 002 dod-evidence for manual prereqs).
<!-- SPECKIT END -->
