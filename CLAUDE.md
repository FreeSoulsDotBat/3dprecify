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
**E6 IN PROGRESS ON `develop` — 19/44 tasks. 012-e6-billing PR-A SHIPPED** (PR #28, `0a3296b`,
2026-07-23, owner-merged) — the turnstile: price → checkout → verified grant (US1+US2+US3), spec-kit flow
followed (product-owner → specify → clarify → plan + ADRs → tasks, Principle VIII). **ADR-0023** flipped
Proposed → **Accepted** at that gate (T020). The 013 audit then hardened billing ON `develop` (`1212a16`,
#30): **E6-02** (the `x-signature` manifest's `data.id` comes from the notification QUERY PARAM, MP's real
contract — a body-only read 401'd every legitimate webhook) and **L2-N1** (a grant with no bounded expiry
reads as PREMIUM FOREVER, so an unboundable payment is matched-not-granted).
**`feature/012-e6-billing` is FULLY ABSORBED and must not be resumed** — verified 2026-08-01 by merging
`develop` into it: the merged tree differed from `develop` in **zero** files (the whole `specs/012-e6-billing/`
included). Worse, it is a TRAP: its 2026-07-23 merge commit is titled "develop (013 audit remediation)" but
`1212a16` landed 2026-07-24, so **E6-02 and L2-N1 were never on that branch** — resuming from it would
reintroduce both. Continue E6 from `develop`. (This ground line previously claimed 012 was "mid-flight,
31 commits ahead, not yet shipped"; all three were false, and that false record is what made the 2026-08-01
"sync the drifting branch" plan wrong.)
**E6's next slice is PR-B** (T021–T030): US4 cancel-at-period-end · US5 grace & dunning · US6 the Conta
billing home, then e2e + `qa-produto` + gate. **T002 is an OWNER task and is NOT a PR-B blocker**: it
provisions the real MP sandbox (access token + webhook secret + the two `preapproval_plan`s) and gates only
T016b/T018b+ — PR-B is built against the local stub, as PR-A was.
**013-audit-remediation SHIPPED to `develop`** (PR #29, `42cc45c`) — the 10-specialist audit's remediation
increment; its deferred US8 became increment 014. See `specs/013-audit-remediation/{spec.md,tasks.md}`.
**014-fee-category-mapping PR-A SHIPPED to `develop`** (PR #31, `461a367`, 2026-07-31, owner-merged) —
the category→commission axis + the Amazon map (US1+US2+US3 + the monthly comparator), plus **Fase 6C**,
the correction phase that gated the merge. **ADR-0024** (progressive price bands; additive `bandMode`,
absence = `SELECTION`) Accepted + live. Owner-homologated (`qa-produto`, PASS COM RESSALVAS 92%, 41
screenshots, geometry read from the DOM) after an adversarial workflow review whose ONE blocker —
`catalogVersion` unbumped across a 77→79-entry change — was fixed before merge. Evidence:
`specs/014-fee-category-mapping/{tasks.md,dod-evidence.md}`.
**014's lesson, paid three times in one phase: a screenshot finds what a geometric assertion cannot,
and a geometric assertion finds what text extraction cannot.** `toBeVisible`/`toContainText` pass on an
element wholly occluded or overflowed — occlusion is not a property of text — so layout is asserted with
BOXES; and the picker's result list read as a second filled field, plus a count that claimed "8 found"
when 31 matched, were both invisible to every assertion and visible in the image. Corollary: a review
that only reads code homologates nothing.
**014 US4 SHIPPED to `develop`** (PR #32, `0e3a951`, 2026-08-01, owner-merged) — the monthly loop's
6 pre-conditions (T101–T106) + the orchestrator as PURE DECISION (`packages/fee-ingest/src/refresh.ts`,
under the 100% ratchet and wired into the generator). **The loop does NOT fire on its own**: GitHub's
`schedule` runs from the DEFAULT branch (`main`) and the release cut is deferred until v1, so the
practical trigger will be `workflow_dispatch` even once the YAML exists. `fee-refresh.yml` (T049/T050,
blocked on T069b) and the `develop` ruleset (T048a, repo config) are deliberately OUT — owner decision
2026-07-31, not an omission. FR-020a is the property that governs the module and it is STRUCTURAL:
`RefreshOutcome` is a two-case union, so no forgotten `if` can create a write path the type does not have.
**US4's lesson, and it cost two CRITICAL blockers found only by a 3-lens review: a suite that passes
proves nothing about a program that does not RUN, and a test that asserts PRESENCE proves nothing about
a lie.** The package did not boot under plain `node` — three extensionless relative value imports, the
first inherited from PR-A — and every test was blind to it because vitest is the tolerant resolver; and
the PR body printed "Sem mudança de tarifa" directly above "Categorias removidas da fonte", because
every test asserted a string was present and none asserted one was absent. Corollary for any future
review mandate: **at least one lens must be allowed to EXECUTE the entry point.**
**014 US5 + US8 + the three reviews' follow-ups SHIPPED to `develop`** (PR #34, `21399f5`, 2026-08-01,
owner-merged) — the staleness seal (US5), the category as scenario INTENTION (US8, homologated by
MUTATION: the commission was changed in the served catalog and the same saved scenario repriced
R$ 35,93 → R$ 44,14 with the category intact), and the follow-ups the three review rounds left.
**A1-r is NOT fixed and its theory was DISPROVED**: the "valley" shape is neither necessary nor
sufficient — 5 valley tables (2 built adversarially) gave **0 dominated points in ~71k**, and ML's real
table already has a valley today, so the ingestion detector the owner chose would have false-positived
on the ML's first month. The guard shipped instead tests the PROPERTY (`packages/pricing-core/tests/
band-dominance.test.ts` — "the published announce is the cheapest that delivers the base", 6 tables,
mutation-proven non-vacuous), which needs no name for the shape. **Follow-up B is CLOSED at the root**
(the NUL is gone; `.gitattributes` had fixed only `diff`/`blame`, never ripgrep).
**US5/US8's lesson: a red gate that is INTERMITTENT is worse than one that is deterministic.** CI went
red with all 107 files PASSING and exit 1 — three `window is not defined` from three `QueryClient`s that
`use-catalog.test.tsx` never unmounted; the very next commit passed WITHOUT the fix. It reproduces in no
isolated run, which is exactly why it teaches "just run it again".
STILL OPEN in 014 (NOT review debt): **US6 ML slice**
(blocked on the `seguranca` parecer's 8 conditions AND a separate owner authorization), US1 residual,
Polish. Follow-ups with their measurements in `tasks.md`: **A1-r** (above — needs design, not a patch;
reachable exposure TODAY is zero, now measured four ways), the monotonicity sweep still to widen,
**C** (`PRICING_MODEL_VERSION` unbumped over a rewritten implementation — 0 differences measured over
9 tables × 100k bases), **U5-a/b/f · U8-a/b/c/d**, plus 14 lower-severity findings left **unverified,
never confirmed**.
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
at specs/014-fee-category-mapping/plan.md
(014 = the category→fee mapping increment. **PR-A SHIPPED 2026-07-31** (`461a367`), **US4 SHIPPED
2026-08-01** (`0e3a951`) and **US5+US8+follow-ups SHIPPED 2026-08-01** (`21399f5`); **US6 + US1 residual
+ Polish remain** — see `specs/014-fee-category-mapping/tasks.md`.
**The monthly loop exists but does NOT fire**: no `fee-refresh.yml` yet (blocked on T069b), and GitHub's
`schedule` reads from `main`, which the deferred release cut has not reached. Its four
gates are MEASURED and recorded in ADR-0010 §A13 — read that before touching the ingestion:
ML has NO geo-gate (the belief held since 2026-07-06 is false), Amazon needs NO credential,
and ML's commission is piecewise-constant down the category tree (~87.5% of nodes inherit),
which is why resolution walks the ancestor chain. THREE structural choices are deliberately
UNDECIDED under Principle VIII — see plan.md §Decisões estruturais pendentes; the tasks that
depend on them stop until the owner decides. **The ML slice (US6) needs BOTH the `seguranca`
parecer's 8 conditions AND a separate owner authorization — do not start it on a "continue".**
`catalogVersion` is now sequenced by `nextCatalogVersion` in `packages/fee-ingest/src/guardrails.ts`:
it moves only when the CONTENT changes, because that label is frozen into an ADR-0019-immutable
snapshot and must keep answering WHICH table priced a record. 012-e6-billing is still mid-flight on
its own branch; re-point here when it lands.)
<!-- SPECKIT END -->
