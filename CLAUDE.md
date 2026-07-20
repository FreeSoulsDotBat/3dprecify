### Cost / model delegation (Claude Code dev workflow — ADR-0022)
- **Routing (per-agent, in `.claude/agents/*.md` frontmatter):** the 6 executors — `dev-backend`,
  `dev-frontend`, `dev-estrutura-de-dados`, `devops`, `qa-software`, `scrum-master` — run `model: sonnet`
  + `effort: medium`; the judgment roles (`arquiteto`, `seguranca`, `product-owner`), **`designer-ux` AND
  `qa-produto`** stay on `model: opus` — `qa-produto` was **rolled back haiku→opus 2026-07-19** (owner, at
  the E5 PR-A gate: haiku confabulated a visual-homologation PASS with 0 screenshots; ADR-0022 §table row 7,
  the playbook's first exercised routing revert).
- **Delegation:** routine, spec-driven reads & edits → a cheaper worker subagent; planning, architecture,
  security review, and final pre-merge review → keep on the main / `opus` model.
- **Escalation (pricing domain — NON-NEGOTIABLE):** any data-model / schema change that touches the pricing
  domain — `packages/pricing-core`, the marketplace fee catalog, any money/rate/percent leaf, or the
  snapshot/kit/scenario payloads — is escalated from `dev-estrutura-de-dados` (sonnet) **to `opus`**. A
  pricing-domain schema change is the one place a cheap executor carries real financial risk.
- **Effort:** prefer lower `effort` on mechanical tasks; the executor `medium` cap is the default — lift it
  per-invocation ONLY for a genuinely hard task, and record the lift in that operation's ledger row.
- **Rollback:** every routing choice is a one-line frontmatter revert (ADR-0022 §Rollback playbook).

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
D6 kit-line degradation is read-time, not eager delete-capture) now Accepted + live.
**E4 COMPLETE and SHIPPED to `develop`** — 009-e4-history-snapshots-export (immutable price snapshots / Histórico,
premium), three owner-authorized slices + a close-out: PR-A #18 (`b1fbd80`, the frozen shelf — record
online+offline via a durable uid-keyed outbox + consult + honest US5 teaser; **ADR-0018** offline outbox +
**ADR-0019** immutable snapshots, incl. the project's first PL/pgSQL immutability trigger; frozen-payload envelope
Option A) + PR-B #19 (`bd9d95e`, the two-shelf rule made visible — US3 catalog-churn inertness + read-time origin +
"Recalcular hoje" + US6 manage/lapse over a keyset-paginated **unbounded** ledger; **A29 closed**) + PR-C #20
(`e10b49f`, US4 server-rendered PDF/CSV export behind an **active**-entitlement gate — `reportlab==5.0.0` pinned
not assumed — + the built-not-dropped US7 then-vs-now compare; **ADR-0020**) + close-out PR #21 (`55f49b6`, the T034
cross-slice homologation's one real find — a PDF quote whose long item-name overran the price columns, invisible to
text assertions because glyphs collide on the page not in the string; fixed + geometry-guarded, recalc inherits the
label, CSV formula-injection consciously accepted w/ 4 re-open triggers). All owner-homologated after multi-agent
review-fix cycles; **ADR-0018/0019/0020 Accepted**, **A29 closed** (open since 2026-07-02). Evidence:
`specs/009-e4-history-snapshots-export/{tasks.md,dod-evidence.md}`. **The lesson E4 paid for, twice: opening the
artifact is necessary and not sufficient — do it with adversarial DATA, and for a rendered artifact adversarial
SIZE, asserting geometry (text extraction is blind to a layout collision).**
**E5 COMPLETE and SHIPPED to `develop`** — 010-e5-saved-scenarios (saved marketplace scenarios, premium), three
owner-authorized slices in two days: PR-A #24 (`8386972`, the saved shelf — save/consult/offline-read + honest
teaser; **ADR-0021** hybrid-JSONB store-intent/resolve-live Accepted) + PR-B #25 (`c9c053b`, the live contract —
read-time resolver D3/D6 for **PRODUCT+KIT** bases + duplicate-to-tweak + PUT/PATCH/DELETE/search/lapse + Q12 kit
rollup; the e2e wave surfaced **3 real defects, all fixed in-slice** — flat `lastKnown` wire shape, dead
dirty-tracking, an invisible search field whose "frozen overlay" reading was a misdiagnosis corrected by
main-loop live MCP-browser debugging) + PR-C #26 (`fccc87e`, the E4 bridge — record a frozen snapshot from a
scenario, `"SCENARIO"` provenance payload-side only, immutability untouched). All owner-homologated (T018 88% ·
T031 92% · T037 **PASS 95%**) + full CI green. **KIT-basis scenario CREATION deferred** (owner 2026-07-20 — the
kit composer holds per-line channels, kit-level channelSet UX unspecified → designer-ux). Evidence:
`specs/010-e5-saved-scenarios/{tasks.md,dod-evidence.md}`. **E5's lesson: a layout/hit-testing symptom is
diagnosed in a REAL browser with element geometry — two plausible remote hypotheses were both wrong; jsdom is
blind to it (the third time this project paid that class).**
**011-token-optimization: levers LANDED via PR #22** (ADR-0022 Accepted) — routing + rtk filter + graphify hook
live; **the pilot verdict (T032–T034, ≥30%-or-honest-shortfall) is being closed now at E5 end** from the
per-operation ledger rows. Evidence: `specs/011-token-optimization/dod-evidence.md`.
**Next increment: E6** (billing — Mercado Pago recurring / Play Billing; PENDING the unnumbered payments ADR).
It is UNSTARTED and must go through the spec-kit flow (product-owner → specify → clarify → plan + ADRs → tasks)
before any code — do NOT infer it.
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
- **Freshness (ADR-0022 amends ADR-0014, 2026-07-19 + addendum same day) — the graphify commit hook is
  PRIMARY; the lefthook `post-merge` net covers develop pulls.** `graphify hook install`'s
  `post-commit`/`post-checkout` hooks rebuild the graph deterministically on every local commit/branch
  switch (AST-only, detached ~25s, 0 tokens; log `~/.cache/graphify-rebuild.log`, escape
  `GRAPHIFY_SKIP_HOOK=1`). **MEASURED FACT 2026-07-19 (corrected a never-tested hedge): a ff `git pull`
  DOES fire `post-merge`** (git 2.45.1, `pull.rebase=false`) — so the remote squash-merge path is covered
  deterministically by the lefthook `post-merge` block → `scripts/graph-refresh.sh` (guarded to develop,
  non-fatal). The AI close-out `graphify update .` is the documented fallback; `pnpm graph:update` is the
  manual command. Boundary: `git pull --rebase` fires no post-merge. NEVER declare
  `post-commit`/`post-checkout` in `lefthook.yml` (`lefthook install` would overwrite graphify's hooks;
  `post-merge` is not graphify's — declaring it is safe, proven). Doc/paper/image changes need the skill
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
at specs/011-token-optimization/plan.md
<!-- SPECKIT END -->
