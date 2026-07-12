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
Clarification + decision-log entry); FR-010 consciously open until then (006 spec Clarifications).
**E2 COMPLETE and SHIPPED to `develop`** — 007-e2-catalog-entitlement, three owner-authorized slices:
PR-A #10 (`16c1824`, first DB + Constitution IV: entitlement gate + append-only ledger + operator grant CLI,
ADR-0012) + PR-B #11 (`e655504`, premium catalog loop — filaments/printers CRUD + uid-keyed offline cache +
SC-305 byte-identical prefill) + PR-C #12 (`3a940ba`, products live-recomputed w/ reference + last-known
degradation US6, and the honest free-tier teaser US7 with `/catalogo` public); all owner-homologated + full CI
green (incl. contract drift-guard). Evidence: `specs/007-e2-catalog-entitlement/dod-evidence.md`. Entitlement
(ADR-0012) + SQLAlchemy 2.0 schema/migration `0001` (ADR-0013) now live.
**E3 COMPLETE and SHIPPED to `develop`** — 008-e3-multi-piece-bom (multi-piece BOM / Kits, premium), three
owner-authorized slices: PR-A #15 (`64fe10e`, kit composer + honest US5 teaser + K1 Kits IA — US1+US5) + PR-B #16
(`b8b5eee`, kit persistence + atomic materialization + ADR-0017 — US2·US4·US6) + PR-C #17 (`e0ed56e`, US3
catalog-reference lifecycle — D3 live-reflect + D6 read-time degradation + the honest degraded "(avulsa)" caption);
all owner-homologated + full CI green (gate:all + e2e 102/102 + contract drift-guard). Evidence:
`specs/008-e3-multi-piece-bom/dod-evidence.md`. **ADR-0017** (atomic kit-save + materialization; §6 addendum:
D6 kit-line degradation is read-time, not eager delete-capture) now Accepted + live. Next real increment: **E4**.
Still open elsewhere: 005 T042 (design reconciliation, non-blocking) + D1–D4 ML ingestion
(blocked on the house ML account, Q-D).

Decided stack/standards (authoritative): ADR-0001..0014 + `docs/decisions/{tech-stack-decisions,audit-findings,audit-findings-r2}.md`.
- pnpm workspaces (Node 24) · React 19 + Vite 8 PWA + Tailwind v4 + Radix-wired `tf-*` DS (ADR-0007 — NOT the
  shadcn utility skin) · TanStack Router/Query · Zustand · RHF+Zod · FSD-Lite (+eslint-boundaries, dependency-cruiser).
- FastAPI (Py 3.12, uv) · pydantic-settings · camelCase wire (alias_generator) · `ErrorCode` enum → Orval TS
  union in `apps/web/src/shared/api` · structlog correlation-first + `X-Correlation-Id` · Firebase emulator (dev).
- Deploy: Cloud Run + Firebase Hosting (southamerica-east1), WIF keyless. Runbook: `docs/runbooks/uat-deploy.md`.
- Gates: **`pnpm gate:all`** (frontend format/lint+boundaries/depcruise/typecheck/coverage AND backend
  ruff/basedpyright/pytest/import-linter) — the SAME literal command runs in lefthook pre-push and the CI gate
  job (D4, no local↔CI drift). Pricing formula canonical in `packages/pricing-core` (TS, offline) — backend
  never recomputes (only e2e/docker/drift/secret-scan are CI-only).

Knowledge graph — **graphify** (ADR-0014, amended 2026-07-10). A structural (AST) code graph lives in
`graphify-out/` (gitignored; ~2877 nodes, built with **0 LLM tokens**). Standing rules:
- **Freshness — every merge into `develop` refreshes the graph.** The refresh is `graphify update .`
  (AST-only, ~20s, 0 tokens). The AI runs it as part of the `develop` close-out/bookkeeping step;
  `pnpm graph:update` is the manual command; a best-effort lefthook `post-merge` hook is a safety net
  (ff-pulls may skip it, so the AI procedure is load-bearing). Doc/paper/image changes need the skill
  path (`/graphify --update` in-session) — the CLI `update` covers **code only**.
- **Graph-first for structural search.** For "where is X / what calls Y / how does subsystem Z
  connect / what's in this area" questions, consult `pnpm graph:query "…"` (or `graphify query/
  explain/path`) **before** blind Grep/Read sweeps — it's cheaper and answers navigation directly.
  Grep/Glob/Read stay correct for exact-string lookups, known single files, and every edit/verify.
  Query discipline: the matcher is literal substring — use terms that exist in the graph's labels,
  cap output with `--budget 1500`, and fall back to Grep when no vocabulary matches. Agents without
  Bash (arquiteto, designer-ux, product-owner, scrum-master) Read `graphify-out/GRAPH_REPORT.md`
  (§Community Hubs) as their graph surface instead.
- **Work memory — the graph learns.** At the start of graph work run `graphify reflect --if-stale`
  and read `graphify-out/reflections/LESSONS.md` (preferred sources, known dead ends, corrections).
  After answering from the graph, save it back: `graphify save-result --question "…" --answer "…"
  --type query --nodes … --outcome useful|dead_end|corrected` — deterministic, 0 LLM tokens; the
  next graph update ingests the Q&A.

Token-spend ledger (owner rule 2026-07-10): every AI operation that costs real tokens — semantic
extraction, subagent fan-outs, multi-agent workflows — appends a row to `docs/token-ledger.md`
(date · operation · estimate → actual · lesson). Estimate BEFORE running, record the actual AFTER;
graphify runs also mirror into local `graphify-out/cost.json`.

Constitution: `.specify/memory/constitution.md` (incl. **Principle VIII** — no inferring architecture/standards).
Pricing domain reference: `docs/pricing-model-from-spreadsheet.md` (original model — third-party sheet NOT copied).
Integration branch is **`develop`** (slices land via owner-authorized squash-merged PRs; `main` = release, per
ADR-0006). Shipped so far: 001+003 (PRs #3/#4), 004+005 (PRs #6/#7). Jonatan authorizes each push/merge.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/008-e3-multi-piece-bom/plan.md
<!-- SPECKIT END -->
