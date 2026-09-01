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
**E6 CODE-COMPLETE ON `develop` — PR-A + PR-B + PR-C shipped. 012-e6-billing PR-A SHIPPED** (PR #28, `0a3296b`,
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
**012-e6-billing PR-B SHIPPED** (PR #35, `26397a5`, 2026-08-02, owner-merged, CI 8/8 first try) — the
REVERSE half: US4 cancel-at-period-end · US5 grace & dunning · US6 the Conta billing home. Grace
window is MEASURED, not guessed: `MP_RETRY_WINDOW_DAYS=10` (T003, MP's official docs) +
`GRACE_FLOOR_DAYS=7` (owner Q5), and the test pins the `max` RULE, not the number. Anchored on
`current_period_end`, never `now` — the server clock would hand different grace lengths to the same event.
SC-708 is now STRUCTURAL: `plan-panel.tsx` receives a resolved `PlanState` and has no access to the ledger
or the PSP mirror, so it CANNOT infer billing state; `PlanState` is a discriminated union, so no forgotten
`if` yields a stateless panel. SC-709 proved by FORM: `git diff develop` over `app/entitlement/`,
`entities/user/` and `packages/` is **zero** — a green suite proves nothing BROKE; an empty diff proves
nothing CHANGED, which is what SC-709 asks. Owner ratified three calls at the gate (ux-billing §4.3 line
KEPT · our refetch renamed "Recarregar" so it stops colliding with the MP button · grace caption gains the
`info` tone the spec's §9-G1 already provided, **badge stays green** — the premium IS active, and degrading
it is the opposite lie).
**PR-B's lesson, and it cost three real defects: more than a thousand automated tests found none of them —
each one needed something to EXECUTE the product.** The browser walk (T027) found a **fake-active**: the
"subscription wins" precedence was applied WITHOUT consulting the ledger, so an `authorized` subscription
whose grant had expired rendered "Premium · renova em {data}" over a FROZEN account (it happens for real —
a renewal webhook can be lost, which is why reconciliation exists). 14 unit tests missed it because they
only ever fed CONSISTENT combinations, and the inconsistency is the case that matters. Then the visual
homologation (T028, FAIL 72%, 18 screenshots) found **100.5px of overflow with a button born outside the
viewport** and a **toast that never rendered** (MutationObserver: 0 insertions in 8s — the dialog unmounts
before React Query calls a `mutate` callback, so the copy sat in the bundle asserting an acknowledgement
that never happened). **And the geometry guard born from that caught my own INCOMPLETE fix** (467 still
overflowed) before I called it done; proven non-vacuous by mutation (747 vs 390).
**012-e6-billing PR-C SHIPPED** (PR #36, `2d3e538`, 2026-08-03, owner-merged) — US7 the four teasers lit
(front 1211→1219) · US8 refund/chargeback revocation (`grant_writer._revoke_for_refund`, red-first) ·
Play Billing readiness behind a flag that is OFF and ASSERTED server-side (T035) · e2e billing-teasers
6/6 against the real stack · visual homologation PASS COM RESSALVAS 88% (37 screenshots). (This ground
line previously still called PR-C "the remaining slice" FOUR DAYS after the owner merged it — the same
false-record class as 2026-08-01, caught 2026-08-07 while planning a redundant "PR-C spin-up".)
**E6 remaining = owner-side only**: T002 (MP sandbox provisioning — gates T016b/T018b+ real-sandbox
validation; all three PRs were built against the local stub) and T036 (Play `purchaseToken` provider,
BLOQUEADO NO DONO). No implementable E6 work is open.
**Hotfix A2/A3 SHIPPED to `develop`** (PR #51, `3accd38`, 2026-08-07, owner-merged) — A2: art. 23431
VERBATIM attributes the R$ 20/30/40 freight coupon to SHOPEE; the 005 `BAND_VOUCHER` charged it to the
seller in a field showing 0,00. Data fix: Shopee freight → `NONE` + additive `freightSubsidyInfo`,
`catalogVersion 2026-08-07.0`; seed liquid 4,24→24,24, negative-liquid dies, no ANNOUNCE changes, frozen
docs SHA-256-identical; FR-111a revoked in spec 005 (dated Clarification), FR-111b finally honored. A3:
outbox `unauthenticated` state (401 NEVER purges — property-proven) + sticky "Entrar de novo" banner.
Homologation PASS 93%, 0 blockers; new qa trap: the SEED answers first paint — a served-catalog mutation
is only real after waiting for the MUTATED value. R5 follow-up: thousands mask lost on programmatic
scenario reopen (PR-C/016 B2 class). Receipt: `docs/homologacao/hotfix-a2-a3-desenho.md`.
**013-audit-remediation SHIPPED to `develop`** (PR #29, `42cc45c`) — the 10-specialist audit's remediation
increment; its deferred US8 became increment 014. See `specs/013-audit-remediation/{spec.md,tasks.md}`.
**014-fee-category-mapping PR-A SHIPPED to `develop`** (PR #31, `461a367`, 2026-07-31, owner-merged) —
the category→commission axis + the Amazon map (US1+US2+US3 + the monthly comparator), plus **Fase 6C**,
the correction phase that gated the merge. **ADR-0024** (progressive price bands; additive `bandMode`,
absence = `SELECTION`) **Accepted (2026-08-30, em revisão dedicada no fechamento do 019** — não no gate do 014: esta linha
dizia "Accepted + live" desde 31/07 por erro de registro; o dono reviu o ADR com a prova de três pontos e o aceitou). Owner-homologated (`qa-produto`, PASS COM RESSALVAS 92%, 41
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

**016-correcao-homologacao CODE-COMPLETE on `develop` (2026-08-07)** — V0 + all 6 slices
owner-merged: PR-A #44 (`d59c1b8`, single teaser + Orçamentos/Simulações labels) · PR-B #45
(`abf185b`, real logo + desktop 37→93% + item-9 scroll killed on the VERTICAL axis — headless
never sees a classic scrollbar; the guard now measures BOTH axes) · PR-C #46 (`ca98217`, tooltips
+ h/min + the machine QUESTION + thousands mask; homologation FAIL 74%→fixed; seed price moved to
16,16/24,24/21,01 with the ritmo-mode first visit) · PR-D #47 (`ef7d9d9`, **pricing-core 4.0.0**:
wasteGrams removed with NOMINAL refusal by key + `stripRetiredFields`/`isPreRemovalModel` in the
package itself, Alembic `0007` DROP, wire `extra="forbid"`, the two costurados DECLARING the
discard) · PR-E #48 (`176ba15`, marketplace→Premium with the rewritten promise + dated
Clarifications in specs 005 AND 007 in the SAME slice; `channelFieldPlan`+`feeAxes`; the
invisible-money blocker killed BOTH ways: plan-driven reset + "declared OR non-empty" render) ·
PR-F #49 (`62a0960`/`a612050`, **pricing-core 4.1.0**: `fixedFeeRule PCT_OF_PRICE` + surcharges;
the T057 VERBATIMs decided every number — comissão continua abaixo de R$8, CPF sem volume = tabela
catch-all ⇒ DUAS entradas; a latent published-floor guard defect found and killed; Amazon
INDIVIDUAL R$2,00 in 39 entries incl. INSIDE the 3 banded ones — 013/F1 inertness would have
silently eaten them; `catalogVersion 2026-08-06.1`; homologation 88→92% with the clipped
placeholder-suffix lesson: honesty phrases live in full-width elements, placeholders carry only
numbers). Polish (T072–T074) closed the increment: the 7 never-homologated scenarios measured
(84%, 57 screenshots — core holds: real offline calc, honest outbox, NO network failure sold as
"not premium", 360px journey with zero overflow), the 016's OWN regression fixed (PR-B's logo
PNGs missing from the PWA precache glob — the 009/T016-N5 class reintroduced, proven fixed in the
sw.js manifest), SC-910 sweep 80 entries/0 problems, **ADRs 0026/0027 flipped Accepted at the
close-PR merge gate; 0025 stays Proposed (deferred with ML/US6-ML/017)**. Priority follow-ups
recorded in dod-evidence §Polish: **A2 (ALTA — Shopee freight field shows R$0,00 while
BAND_VOUCHER deducts R$20, pre-existing 005 model, same class as the PR-E blocker)** · A3 (expired
session has no way back; outbox blames the network) · A4 (2-segment blank-page trap swallows the
404) · A5–A11 (design/backlog). See `specs/016-correcao-homologacao/dod-evidence.md`.

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
- **Comentários (2026-09-01, aprovado pelo dono): a explicação sai da linha, a âncora fica.** Regra em
  `docs/PADRAO_DE_COMENTARIOS.md`. No código vai UMA linha, `// @doc <ID>[ §seção] — <resumo>`; a
  explicação vive num ADR (`docs/adr/`), num DEC (`docs/decisoes-de-codigo.md`, decisão pequena e local)
  ou num FONTE (`docs/fontes-verbatim.md`, citação literal da fonte que determinou um número). O caminho
  de volta é a seção `## Onde isso vive no código`, **por símbolo, nunca por linha**. `packages/repo-audit`
  roda no `gate:all` e derruba âncora morta, seção morta, verbete órfão, ponteiro podre e recaída de
  densidade. O alvo NÃO é zero comentário — é zero DECISÃO dentro do código: JSDoc de contrato até 6
  linhas fica.

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

Homologation process (authoritative): `docs/homologacao/PROCESSO-HOMOLOGACAO.md` — walking every scenario is
HALF the process; the other half is the owner **re-walking each reported point after the fix**. A dev/agent
"corrigido" is `CORREÇÃO DECLARADA`, never homologated; only the owner's second pass closes a point, and while
a round has points awaiting re-verification, **untouched scenarios do not open** (owner, 2026-08-10). Round 1
(2026-08-03/04 report → increment 016, 15 points) is OPEN, in re-verification since 2026-08-10.
Constitution: `.specify/memory/constitution.md` (incl. **Principle VIII** — no inferring architecture/standards).
Pricing domain reference: `docs/pricing-model-from-spreadsheet.md` (original model — third-party sheet NOT copied).
Integration branch is **`develop`** (slices land via owner-authorized squash-merged PRs; `main` = release, per
ADR-0006). Shipped so far: 001+003 (PRs #3/#4), 004+005 (PRs #6/#7). Jonatan authorizes each push/merge.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/019-porte-design/plan.md
(019 = o PORTE DO DESIGN: as 157 superfícies que a auditoria de 2026-08-20 achou sem protótipo foram
TODAS desenhadas pelo dono no Claude Design (projeto a90ed7d4, 33 pranchetas × 2 temas) CONTRA o
código; o handoff versionado em docs/design/handoff-019/ (README = punch-list; tf-components.css
byte-a-byte) diz que a maior parte já existe e está correta — o 019 aplica os DELTAS + as features que
o dono incluiu. Escopo (brief docs/product/019-porte-design-scope-brief.md, 20 US, 6 fatias):
PR-A fundação DS (8 primitivos, --warning-text c/ gate de contraste, SEM anel de foco — decisão do
dono 25/08 reafirmada 27/08, exceção explícita ao WCAG 2.4.7; canal→marketplace no texto visível) ·
PR-B Premium sem parede (bloqueia SÓ no salvar; premiumGate puro em shared/billing; <Frozen> = fieldset
disabled; barreira = AUSÊNCIA do handler; diff VAZIO em app/entitlement) · PR-C Calculadora
(plausibilidade no blur + Entendi por sessão; máquina readout + confirmação; selo compact c/ dispensa
até-a-fonte-mudar; T212 sticky; SEM bump) · PR-D recálculo do Catálogo (price_observations escrita
pelo CLIENTE pós-render, products.seller_fixed_price que NÃO compõe, name_norm + índice parcial +
sufixo "(2)" em silêncio; migração 0008; OPUS; Clarification na 007 aplicada) · PR-E Montar-e-Enviar
(computeQuote 4.2.0 MINOR c/ varredura de igualdade; venda direta, desconto no total, piso avisa;
Enviar = snapshot kind=QUOTE + PDF; migração 0009 estende o CASE do CHECK; OPUS; US18 RETIRADA) ·
PR-F Simulações ≥1280px (emenda datada no ADR-0031) + D1/D2 guardas. Autoridade técnica:
specs/019-porte-design/research.md (A–K); ADRs 0032/0033/0034 Proposed (dono flipa por fatia).
Homologação do 019 ESPERA a Rodada 1 — cada fatia sai em CORREÇÃO DECLARADA. Copy SEMPRE verbatim
da prancheta (DesignSync). 018 mergeado (#58, 6a1a55a; ADR-0031 Accepted).
**014's US6-ML remains gated** (seguranca's 8 conditions + separate owner authorization — never on
a "continue"); 014 US1 residual + Polish also remain, see `specs/014-fee-category-mapping/tasks.md`.
017 (monthly fee ingestion): **PR-A SHIPPED to develop** (`daade76` — spine + Amazon collector, first real run) + tarifas 2026-08-07 lidas (`09f5a4f`, PR #54); continues on `017-pr-b-precos`, untouched by this branch.)
<!-- SPECKIT END -->
