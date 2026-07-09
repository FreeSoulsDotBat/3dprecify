# Audit Findings R2 — 3-agent inconsistency & missing-decision sweep (2026-07-02)

Agents: **arquiteto** (ADRs/tooling vs code drift) · **designer-ux** (UX/UI + visual homologation) ·
**product-owner** (scope, pricing domain, roadmap). Method: compare every written decision (ADR-0001..0006,
tech-stack-decisions, audit-findings G1–G4, specs 001/002, ux-decisions, business-rules) against the code.

**Verdict:** the decided core is well executed — formula lives only in `pricing-core` (backend never
recomputes), camelCase wire end-to-end incl. error envelope, correlation-id/structlog per O1, token graph AA,
pt-BR/BRL input UX correct. Problems cluster in three areas: **(1)** the DoD/doc record diverged from reality,
**(2)** the FE↔API boundary is neither decided nor built — exactly what 001 touches next, **(3)** product/UX
decisions the roadmap assumes resolved but nobody took.

IDs continue the A-series from `audit-findings.md` (last used A19). Sections: R2-x = mechanical reconcile,
D-x = declared-done-not-built (needs implement-vs-demote call), A20+ = new open decisions.

---

## 1. RECONCILE — record vs reality (mechanical; no decision needed, just fix)

| # | Finding | Evidence |
|---|---------|----------|
| R2-1 | `tasks.md` banner says T014/T020 visual homologation "still open" while both lines are `[x] PASS` | `specs/001-walking-skeleton/tasks.md:16-18` vs `:72-74,:99-102` |
| R2-2 | T024 (DoD/Constitution check) marked done with FR-010 (public deploy, MUST) unmet — T022 pending | `tasks.md:115-117` vs `spec.md:78`, `quickstart.md:44` |
| R2-3 | `CLAUDE.md` "Nothing committed yet" + dod-evidence "first commit/first push" caveats are stale — repo has history, CI has run | `CLAUDE.md:17`; `specs/002-foundation/dod-evidence.md:38-39` |
| R2-4 | `eslint.config.mjs` header says boundaries rules "land in Phase 5" — they are configured below in the same file | `eslint.config.mjs:1-2` vs `:32-67` |
| R2-5 | ux-decisions fixed the verbatim label "Markup (margem sobre o custo)"; app ships "Markup" + separate hint (likely better — sync the doc) | `docs/product/ux-decisions.md:21` vs `messages.pt-br.ts:20,23` |
| R2-6 | Calculator seed values (110/1/85/50) diverge from the canonical documented example (100/1/20/50 → R$2,00/R$3,00), hurting eyeball homologation | `calculator-screen.tsx:12-17` vs `spec.md:48-49`, `contracts/pricing-core.md:30` |

## 2. DECLARED DONE, NOT BUILT — needs a call each: implement now vs demote to tech-debt

002 `dod-evidence.md:34` claims "A1–A12, O1, V1–V2 implemented"; these parts are not (Principles II/VI
tension — the DoD record must be made true either way).

| ID | Gap | Evidence | Call |
|----|-----|----------|------|
| D1 | **A9-FE wrapper**: Orval client is raw generated `fetch` — never throws on 4xx/5xx, no typed `ApiError`, no correlationId read, no Sentry tag, no token injection, no baseURL (relative `/api/v1/me` breaks cross-origin Hosting→Cloud Run). Only a `TODO`. | `apps/web/orval.config.ts:5`; `shared/api/generated.ts:116-132` | **implement** (A20, R2-G2) |
| D2 | **O1/A11-FE observability**: no `@sentry/react`, no init/breadcrumbs, no global error boundary, no `VITE_SENTRY_DSN` in env schema | `apps/web/package.json`; `shared/lib/env.ts:5-13`; `main.tsx` | **implement** (R2-G3) |
| D3 | **C1.5 Schemathesis**: declared dev-dep, never invoked — no pytest usage, no CI step; drift-guard only checks client regen, not response conformance | `backend/pyproject.toml:22`; `.github/workflows/ci.yml` | **activate** (A21, R2-G2) |
| D4 | **F1.2/FR-C2.3 hook parity**: lefthook runs zero Python gates (no `uv run`), nor depcruise/coverage — "CI == hooks by construction" is true only for the JS subset | `lefthook.yml:13-19` vs `ci.yml:31-48` | **shared gate target** (R2-G3) |
| D5 | **Runtime env at deploy**: `deploy.yml` injects only `P3D_APP_ENV`/`P3D_REGION`; missing CORS origins (stays localhost), `P3D_FIREBASE_PROJECT_ID` (Admin SDK never initializes → every `/me` 401 fail-closed), Sentry DSN, release SHA. Runtime env contract per environment never documented. | `deploy.yml:50`; `settings.py:22-32`; `auth.py:32-33` | **GitHub Environments** (A22, R2-G3) |

## 3. NEW OPEN DECISIONS (Principle VIII — decide with Jonatan; none registered before this sweep)

### Blocks finishing 001 (FE↔API boundary)
- ~~**A20 FE↔API transport design**~~ — **RESOLVED 2026-07-02 (R2-G2): `getIdToken()` per request** + A9
  wrapper spec (see §5). Closes D1 design.
- ~~**A21 OpenAPI error contract of protected endpoints**~~ — **RESOLVED 2026-07-02 (R2-G2): declare
  ErrorEnvelope on 401/403/422 + activate Schemathesis** (see §5). Closes D3.
- ~~**A22 Runtime env contract per environment**~~ — **RESOLVED 2026-07-02 (R2-G3): GitHub Environments +
  env vars, contract documented in `docs/environments.md`** (see §5). Closes D5.
- ~~**A23 Must 001 exercise the server boundary from the real app?**~~ — **RESOLVED 2026-07-02 (R2-G1):
  wire `/me` post-login with visible server-confirmed identity** (see §5). A20 now blocks 001.

### Before E1 spec (pricing domain)
- **A24 Taxes / BR tax regime position** [MED/E1] — spreadsheet carries a zeroed tax field; audience is
  "MEI solo"; no epic E1–E7 addresses taxation. Decide: out-of-v1 with rationale · module in E1 · own epic.
- **A25 Labor + admin costs IN/OUT of E1** [MED/E1] — spreadsheet `custo_total` includes labor (hrs × R$/h)
  and admin costs; roadmap E1 line (`business-rules.md:45`) omits both. Fold into the A16 variable freeze.
  Also record there: markup base changes material→custo_total at E1 — pricing-core semver must mark the
  semantic change (interacts with A13/TD-009 snapshots).
- **A26 3D viewer / STL volume estimation: explicit non-goal** [LOW/product] — model is 100% manual grams
  (FR-004); nothing in spec/roadmap/code mentions STL/three.js, but the "3D" name sets the expectation and no
  written statement says "we won't". Record: permanent non-goal vs future epic.

### Before E2 (persistence / monetization)
- **A27 Data fate when Premium lapses** [HIGH/E2] — R3 made 100% of persistence paid; nobody decided what
  happens to saved catalog/quotes on cancel: delete · read-only freeze · export window · fiscal retention.
  LGPD interplay (A19: retention vs erasure). Must exist before E2 schema.
- **A28 Launch auth-provider set** [MED/E2-E7] — Google-only was decided "for this slice" only; store
  policies commonly require an alternative (e-mail/Apple); prerequisite for paid accounts. Decide the launch set.
- **A29 Formula-version UX for saved quotes** [MED/E4] — mechanism decided (frozen snapshot + semver,
  A13/TD-009); user-facing behavior not: silent freeze · labeled ("calculado com a fórmula v1") · offer
  recalculation with diff. Pair with E4 spec.
- **A30 Persona/ICP as ratified product artifact** [MED/now] — persona exists only in design briefs
  (`claude-design-brief.md:16`); A17 (WTP validation) has no target population without it. Formalize segments
  (MEI vs non-MEI, hobbyist vs prestador) + anti-persona.
- **A31 "Zero free persistence" flagged as premise-to-validate** [MED/E2] — R3 removed any free save (no
  taste-it-first); A17 validates price willingness, not activation friction. Amend A17 scope or define a
  reduced-friction hypothesis (e.g. 1 local non-synced draft) to A/B at E2.
- ~~**A32 Premium copy inside 001**~~ — **RESOLVED 2026-07-02 (R2-G4): keep as teaser + spec note** (see §5).

### UX/UI (decide before the next UI push / real shell)
- ~~**A33 Offline UX strategy**~~ — **RESOLVED 2026-07-02 (R2-G4): two phases — sign-in mapping now,
  global banner at shell adoption** (see §5).
- ~~**A34 Theme persistence + `prefers-color-scheme`**~~ — **RESOLVED 2026-07-02 (R2-G4): persist
  middleware + inline pre-paint script** (see §5).
- ~~**A35 Iconography for an offline PWA**~~ — **RESOLVED 2026-07-02 via 003 plan R10** (inline typed
  React components for themable icons; static SVGs for grafismos/logo; see §5).
- **A36 In-repo visual baseline for homologation** [MED/homolog] — **DEFERRED (R2-G4): Jonatan sharing the
  Claude Design prototype; decide against the material.** No visual source of truth in-repo today: PASS
  evidence unversioned, prototype lives outside, Figma vetoed.
- ~~**A37 404 + router error boundary + `ErrorCode`→pt-BR message map**~~ — **RESOLVED 2026-07-02 via 003
  plan R5/R6** (all in the 003 slice; see §5).
- ~~**A38 `shared/ui` barrel vs F3.4 "no internal barrels"**~~ — **RESOLVED 2026-07-02 via ADR-0007**
  (only permitted barrel: `shared/ui/index.ts`, + entry-point lint rule; see §5).
- **A39 Breakpoint system** [LOW/UI] — "mobile-first ≤414px" declared; only Tailwind default `sm:` used;
  `--app-max`/`--content-max` tokens defined but unused. Name the target breakpoints when building the shell.

### Added 2026-07-02 (from the 003 planning sweep; reconciled — see prototype-audit doc)
- ~~**A40 DS component strategy**~~ — **RESOLVED 2026-07-02: ADR-0007 Option C ratified by Jonatan** via
  the direct planning session (see §5).
- **A41 Postgres hosting** [MED/E2] — Cloud SQL (same region/WIF) vs alternatives; pair with TD-004 schema
  work.
- **A42 pricing-core rounding + money representation** [HIGH/E1] — per-line rounding so the breakdown sums
  to the total (as prototype v2+ does), decimal lib vs float, and what freezes in snapshots; folds with
  A13/TD-009 into the pending "ADR-0008".

## 4. Registered items resurfaced (amend, don't renumber)

- ~~**A15 IP/provenance gate (Amado3D)**~~ — **RESOLVED 2026-07-02 (R2-G1): clean-room rebuild** (see §5).
- **Backend flat `app/` vs B1.1 domain-modular** — conscious skeleton simplification (pyproject comment) but
  unregistered → add TD row, trigger "first real domain at E1 → migrate to `src/<domain>/` + import-linter
  contracts".
- **`ErrorCode` 6/10 seed codes** — additive by design; sync at E2 (`ENTITLEMENT_REQUIRED`, `QUOTA_EXCEEDED`,
  `CONFLICT`, `RATE_LIMITED`) and update the ADR-0002 seed list.
- **Minor UI drift vs brief** (fold into TD-017 scope or fix cheaply): sign-in CTA below 44px and not
  brand-primary (`sign-in-screen.tsx:29-34`); theme toggle lacks state/`aria-pressed`; sign-in title not
  `tf-title`; branded splash missing; empty-vs-seeded initial state implicit.
- **LGPD consent UX** (A19/TD-013 adjacent) — ensure the notice/consent decision exists before T022 (first
  public deploy), which is its trigger.
- **Webfonts TD-014 + Peace Sans TD-010** — registered; resurface priority: no brand font loads at all today
  (whole identity falls back to `system-ui`).

## 5. Decision-capture log (R2 rounds)

Format mirrors `audit-findings.md` RESOLVED section. Fill as rounds happen.

- **A15 → clean-room rebuild** (2026-07-02, R2-G1). The E1 full model will be specified from public
  cost-engineering first principles (energy, depreciation, labor, admin costs, marketplace fees, taxes);
  `docs/pricing-model-from-spreadsheet.md` is demoted to a **checklist of cost categories** — no formulas,
  constants, or calibrations carried over from the Amado3D spreadsheet. Zero IP risk; no external
  permission dependency; E1 unblocked for spec work. **Consequence:** A16 reframes from "which spreadsheet
  defects to fix vs replicate" to "define the original v1 variable set" (defect list becomes irrelevant —
  nothing is replicated).
- **A23 → wire `/me` with visible proof** (2026-07-02, R2-G1). After login the app calls `/api/v1/me` and
  renders the server-confirmed identity (e.g. e-mail from the response body). The skeleton proves the full
  FE→API→auth thread end-to-end, satisfying FR-003/SC-004 in the real app (not only pytest).
  **Consequence:** A20 (transport design) now BLOCKS 001 — must be decided before wiring code.
- **A20 → `getIdToken()` per request** (2026-07-02, R2-G2). The HTTP wrapper calls `user.getIdToken()` on
  every authenticated request; Firebase SDK caches and auto-refreshes near expiry. No token stored in
  Zustand (store keeps `User` only, per F4.4); no staleness window; no retry logic needed in the skeleton.
  Rest of the wrapper as already decided in A9/ADR-0002: typed `ApiError` (correlationId from header+body),
  throw on 4xx/5xx, `baseURL` from `VITE_API_BASE_URL`, Sentry tag. Closes D1 design; implementation next.
- **A21 → fix protected-endpoint contract + activate Schemathesis** (2026-07-02, R2-G2). Declare
  `responses={401,403,422: ErrorEnvelope}` on protected routes (shared util or `app.openapi()` override),
  drop the phantom `HTTPValidationError` schemas, regenerate the TS client, and add a CI/pytest step running
  Schemathesis for response conformance. **Closes D3** (no longer inert).
- **A22 → GitHub Environments + env vars** (2026-07-02, R2-G3). Document the per-env `P3D_*` contract in
  `docs/environments.md`; `deploy.yml` injects non-sensitive values as env vars (`P3D_CORS_ORIGINS`,
  `P3D_FIREBASE_PROJECT_ID`, `P3D_RELEASE=${{ github.sha }}`) and `P3D_SENTRY_DSN` as a GitHub Environment
  secret → env var. Consistent with A11 (Sentry auth-token already lives there); no new GCP infra.
  **Closes D5.**
- **D2 → implement FE observability now** (2026-07-02, R2-G3). `@sentry/react` init with breadcrumbs
  (console/network/clicks), global `ErrorBoundary` logging `code` + `correlationId`, `VITE_SENTRY_DSN` in
  the typed env schema (optional in dev). Makes the 002 DoD claim true; first real API call (A23) is born
  observable.
- **D4 → full parity via shared gate target** (2026-07-02, R2-G3). Single target (e.g. `pnpm gate:all`)
  running JS gates + Python gates (`uv run` ruff/basedpyright/pytest/lint-imports) + depcruise, invoked by
  BOTH lefthook pre-push and CI — "no drift by construction" becomes literally true. Accepted cost: slower
  local push.
- **A33 → offline UX in two phases** (2026-07-02, R2-G4). Phase 1 (in 001): map
  `auth/network-request-failed` → specific offline message on sign-in — closes the `spec.md:58` edge case.
  Phase 2 (at real shell adoption, TD-017/E3): `navigator.onLine` + online/offline events in a
  `shared/network` store feeding a global banner. Both phases decided now; no `/health` ping probe.
- **A34 → theme persist + pre-paint script** (2026-07-02, R2-G4). Add `persist` (localStorage) middleware
  to `theme-store` and an inline pre-paint script in `index.html` resolving localStorage →
  `prefers-color-scheme` → dark before React mounts (no FOUC, honors OS pref). Closes the contradiction
  with "light first-class" (`ux-decisions.md:28`) and fulfills the promise in `colors.css:176-179`.
- **A32 → keep Premium copy as teaser + spec note** (2026-07-02, R2-G4). The freemium note stays (coherent
  with business-rules R3, early value priming); add a scope note to 001 spec legitimizing it as an
  informative teaser — no price/date promise.
- **A35/A36/A37 → deferred pending Claude Design prototype in-context** (2026-07-02, R2-G4). Jonatan will
  share the Claude Design prototype; iconography (A35), visual-baseline strategy (A36) and the 404/error-UI
  scheduling (A37) get decided against the actual design material — not before. Explicit trigger: prototype
  available in-context.
- **A40 → RESOLVED: ADR-0007 Option C ratified by Jonatan** (2026-07-02, via the direct planning session
  he drove with the planning agent; the 003 spec+plan chain proceeded under his approval). Radix behavior
  skinned with `tf-*` tokens; refines ADR-0004 F2.2. **Also settles A38**: only permitted barrel is
  `shared/ui/index.ts` + entry-point lint rule.
- **A35 → RESOLVED via 003 plan R10** (2026-07-02): themable icons = inline **typed React components**
  (currentColor, tree-shaken); decorative grafismos/logo = static SVGs under `public/brand/`; all
  self-hosted/offline (Lucide pinned).
- **A37 → RESOLVED via 003 plan R5/R6** (2026-07-02): all in the 003 slice — 404 catch-all route, router
  error boundary with "Código de suporte: {correlationId}", and the `ErrorCode`→pt-BR map in `shared/api`.
- **RECONCILIATION FIX (2026-07-02):** 003 `research.md` R4 originally dropped `prefers-color-scheme` from
  the pre-paint chain, contradicting captured **A34**; corrected in place to `localStorage →
  prefers-color-scheme → dark`.
- **RECONCILIATION FIX 2 (2026-07-02, tasks.md):** T005 re-worded to the A34 chain (+`persist`); T022/T056
  sharpened to require identity from the **`/me` response** (A23 — not the client session); added **T067**
  (A20 transport wrapper — closes D1), **T068** (post-login `/me` call → A23/FR-003/SC-004 in the real
  app), **T069** (Sentry FE per D2). Without these the 003 slice would have shipped session-only identity
  and left A20/D2 unscheduled.
- **STILL OPEN:** A36 (visual baseline: recommend reference PNGs now + pixel-regression post-003), A39
  (breakpoints), A41 (Postgres host, E2), A42 (rounding/money → ADR-0008, E1), plus the product queue
  A24–A31 and mechanical reconciles R2-1..6.
- **POST-CLOSE AUDIT + FIX BATCH** (2026-07-03, 5-agent adversarial sweep, authorized by Jonatan): found
  **1 HIGH** (cross-user identity leak on Conta — confirmed in dev AND production build; fixed with
  uid-keyed `/me` query + sign-out cache purge + regression test) and 6 mediums, all fixed (transport
  invalid-JSON normalization + 15s timeout + Authorization origin allowlist; 390px huge-value overflow;
  light-theme banner contrast + the e2e gap that hid it; Sentry PII scrub + release stamping; dead
  `-tabs` dep; doc rewording incl. the "Radix TabBar" trap → ADR-0007 nav exception note). Registered
  TD-020 (parseDecimal) and TD-021 (shared/network). Full record: `dod-evidence.md` §"Post-close audit".
  Gates after batch: 79/79 unit · 62/62 e2e · coverage 100%. Re-homologation pending.
- **003-app-shell-and-ds CLOSED** (2026-07-03): all 73 tasks done, five stories owner-homologated same
  day, T065 owner-accepted per V2; gates 75/75 unit · 54/54 e2e · depcruise/lint/tsc clean. Evidence:
  `specs/003-app-shell-and-ds/dod-evidence.md`. Closed with it: TD-014, TD-015, TD-017, D1, D2, A20,
  A23, A33 (both phases), A34, A35, A37, A38, A40, C1. New debt: TD-018 (top-bar identity), TD-019
  (use-identity → generated client after A21).
- **A39 (partial) → nav breakpoint = mobile ≤425px / desktop >425px, decided by Jonatan** (2026-07-03,
  after MVP homologation — "cobertura de telas é baixa"; supersedes the ≤414px draft). Implemented in
  `app-shell.tsx` MOBILE_QUERY; T033 updated. Full breakpoint system (tablet/content-max tiers) still open.
- **TD-014 → CLOSED** (2026-07-03): Inter 400/500/600/700 + Lilita One + Paytone One vendored from Google
  Fonts (latin subset, covers pt-BR) into `apps/web/public/brand/fonts/`; `@font-face` block activated in
  `base.css`. Peace Sans remains commented (TD-010). Also: shared/api lint exemption narrowed to
  `generated.ts` only — `transport.ts` is now linted (clean).
- **New reconcile item R2-7:** `.specify/scripts/quality-gate.ps1` (PostToolUse hook) behaves
  inconsistently — manual run prints the pre-decision placeholder ("Stack not chosen yet — no-op"), hook
  runs execute prettier+eslint but report exit failures as opaque "blocking error / no stderr" noise.
  Reconcile the script with the real gate (or align it with the D4 shared `gate:all` target).
- **C1/FR-016 → RESOLVED: build now (Option B), decided by Jonatan** (2026-07-02, via the agent channel).
  `Dialog`/`Sheet` ships in 003 as tested DS batch-1 library surface (T072 focus-trap test-first + T073
  Radix-skinned build); first product consumer arrives at E2 (catálogo). FR coverage now 17/17, SC 8/8.
  **003 is READY for `/speckit-implement`** (73 tasks, analyze clean, all reconciliation citations in
  place). Recommended execution: Setup → Foundational → US1 (MVP) → STOP & VALIDATE before US2+.
- **Prototype audited** (2026-07-02, 6-agent sweep): verdict + findings in
  `docs/design/prototype-audit-2026-07-02.md`; correction prompt for Claude Design in
  `docs/design/prompts/claude-design-prototype-fixes.md`. A35/A36/A37 now have their material (Lucide
  self-hosted mask+currentColor; tokens byte-identical to app + full screen inventory; good 404, missing
  generic error screen + code→message map) — capture the three decisions next round.

### E1 pricing-model scope frozen (2026-07-05, owner decision round — unblocks the E1 spec)

- **A16 → E1 v1 cost model = "complete corrected + fine refinements"** (Jonatan, 2026-07-05). Beyond the
  001 `material + markup`, the clean-room (A15) v1 model computes, from first principles:
  1. **Material** — cost/roll ÷ roll-weight × grams, **plus explicit waste** (purge/brim/support/refugo)
     as a modelled quantity, not a flat % (fixes spreadsheet defect #4/#6).
  2. **Energy** — time × power(kW) × tariff(kWh) with a **configurable duty cycle** (real FDM average draw,
     not the 1.2 kW nameplate — fixes defect #3).
  3. **Machine-hour cost** — a **single coherent** capital-recovery method (NO triple-count of
     maintenance + ROI + depreciation — fixes defect #2). Exact method is an ADR (see below).
  4. **Failure** — a failure factor applied to **all production inputs** (material + energy + machine-time),
     not material-only (fixes defect #4).
  5. **Finishing / post-processing** — **explicit time × rate**, not a flat % of material (surpasses sheet).
  6. **Markup** over cost (retail/wholesale) — see A25 for the base change.
- **A25 → labor + admin both IN, as OPTIONAL inputs (default 0)** (Jonatan, 2026-07-05). Labor = hours ×
  R$/h; admin = packaging/freight/domain/supplies/internet. **Markup base moves `material` → `custo_total`
  at E1** — a SEMANTIC change: `pricing-core` gets a **major semver bump** and a version identifier
  (interacts with TD-009/A13 saved-calc snapshots). Optional-with-default-0 keeps the calc approachable
  while surpassing the sheet's `custo_total`.
- **A24 → taxes OUT of v1, with rationale** (Jonatan, 2026-07-05). Rationale: the audience is the **MEI solo
  seller**, whose **DAS is a FIXED monthly amount, not a per-unit %** — modelling it as a per-piece cost line
  would be wrong. Recorded as an explicit non-goal for E1; revisit as its own fiscal concern (own epic) if a
  Simples-regime module is ever validated. No `imposto %` field in the E1 calculator.
- **Marketplace fees → BASIC single-channel fee IN E1** (Jonatan, 2026-07-05). One channel: commission % +
  fixed fee with the **correct gross-up `(base + fixa) / (1 − pct)`** (fixes defect #5). The **multi-channel
  simulator** (ML/Shopee side-by-side, saved scenarios) stays **E5** per the roadmap — resolves the
  `business-rules.md:45` (E1 lists "marketplace fees") vs E5 ("Marketplace simulator") tension. E1 calc stays
  **free** (no premium gate).
- **Follow-ups triggered:** (a) new ADR — **machine-hour capital-recovery method** (the "single coherent"
  choice in A16.3), blocks the E1 domain model; (b) `pricing-core` **version registry + rounding policy**
  (ADR-0008, already pending) is now on the E1 critical path; (c) update `business-rules.md:45` roadmap line
  to reflect labor/admin IN, taxes OUT, marketplace-basic-in-E1/simulator-E5.

- **E1 model sub-decisions resolved (2026-07-05, owner round 2 — closes the E1 open questions):**
  - **ADR-0009 → Option A: straight-line amortization/hour** (Jonatan). Machine-hour cost =
    `valor_maquina / vida_util_horas` + an optional SEPARATE maintenance reserve (default 0). The ROI/return
    lives once in the markup over `custo_total` (A25) — provably no triple-count. ADR now Accepted.
  - **ADR-0008 → 1A + 2B** (Jonatan). `PRICING_MODEL_VERSION = 2.0.0` (001 material+markup treated as v1);
    rounding = `decimal.js-light`, each cost line → 2dp `ROUND_HALF_UP`, aggregates = sum of already-rounded
    lines, intermediates full-precision; markup + marketplace gross-up run on the displayed (rounded)
    `custo_total` (WYSIWYG). Consistent with ADR-0004 money policy. ADR now Accepted.
  - **OQ-1 markup defaults → +50% varejo / +30% atacado** (Jonatan) — editable pre-fills (UX starting
    values, NOT formula constants; clean-room integrity kept).
  - **OQ-2 energy → single "consumo médio efetivo (kW)" field** (Jonatan), suggested default ~0,12 kW +
    tooltip. Corrects the nameplate-as-continuous defect at the input, not with a hidden duty constant.
  - **OQ-5 marketplace → gross-up on BOTH varejo and atacado**, showing price-to-list + a "recebido líquido"
    (net-after-fee) transparency line for each (Jonatan).
  - **OQ-4 admin → single "outros custos" total** in v1 (recommend-and-proceed, owner-accepted); itemize at E2.
  - **OQ-8 failure base → material + energy + machine-time only** (recommend-and-proceed per the A16.4 freeze;
    finishing/labor/admin are NOT in the failure base).
  - **Consequence:** E1 open questions closed; `spec.md` being finalized from `scope-draft.md`; ADR-0008/0009
    Accepted. Ready for `/speckit-plan` once the spec lands.

### E1 BUILT (2026-07-06 — US1–US6 + polish, `feature/004-e1-pricing-model`)

The frozen scope above is implemented and green — owner-authorized commits on
`feature/004-e1-pricing-model` (NOT yet merged to `develop`; owner authorizes the PR).
- **Engine** (`packages/pricing-core` 2.0.0): `computeCalculator` — material+explicit waste,
  effective-draw energy (A16.2, no nameplate×duty), single machine-hour recovery (ADR-0009 A),
  failure over material+energy+machine (A16.4), finishing time×rate, optional labor+admin folded
  into `custo_total`, markup over the rounded `custo_total` (WYSIWYG, ADR-0008), single-channel
  marketplace gross-up `(base+fixa)/(1−pct)` netting back on BOTH varejo+atacado. Money via
  `decimal.js-light`, 2dp HALF_UP, aggregates = sum of rounded lines.
- **UI** (`apps/web` calculator): mandatory + optional-core inputs, transparent per-line breakdown,
  both prices, labor/admin + marketplace sections, per-section ⓘ tooltips; pt-BR/BRL per-field
  validation (**TD-020 retired**). No `imposto` field (A24 / FR-021). Free + offline, no
  persistence/paywall (US6).
- **Verification:** SC-001 = custo_total 28,65 / varejo 42,98 / atacado 37,25; SC-003 marketplace
  anúncio 59,98/52,81, líquido 42,98/37,25. `pnpm gate` green (100% pricing-core coverage);
  `pnpm e2e` green (66). Full evidence: `specs/004-e1-pricing-model/dod-evidence.md`.
- **Homologation:** US1+US2 (MVP) owner-homologated 2026-07-05 + the 8-item UI remediation +
  title/logo centring. US4 (labor/admin) + US5 (marketplace) visual homologation (T031/T036)
  pending owner sign-off, then the develop PR (owner-authorized).

### 005 BUILT (2026-07-08 — E1 marketplace expansion, `feature/005-us3-offline-cache` on the 004 base)

Spec 005 (multi-channel + fee catalog + itemized outros custos — supersedes the E5 multi-channel
deferral, owner-decided) is implemented, green, and homologated. NOT yet merged to `develop`
(owner authorizes the PR).
- **Engine** (`packages/pricing-core` **3.0.0**, ADR-0011): `channels[]` (per-slot gross-up on BOTH
  levels, error isolation SC-107), price-band + Amazon `minPerItem` fixed-point (SC-108/112),
  Shopee co-funded voucher per level (SC-111), itemized `otherCosts[]` echoed rounded onto the
  result (FR-114/115). 004's single-channel surface REMOVED (A1, Constitution V).
- **Fee catalog** (ADR-0010 amended): curated artifact at `backend/app/data/catalog.json` served by
  public data-only `GET /api/v1/fee-catalog` (no-auth FR-117, no price compute FR-118) → persisted
  IndexedDB cache → bundled seed for first-run offline. Honesty seals (reference/embedded/adjusted/
  none/estimate/stale); provenance truth-gate with the ML-freight ESTIMATE exemption (A4).
- **UI**: channel slots (marketplace+modality determinants, catalog pre-fill, per-slot inline
  errors), "Preços por canal", non-blocking failed-refresh retry (US3), "Incluir marketplaces no
  preço" visibility toggle (US4 — owner-clarified pure show/hide; NO `includeInHeadline`, deferred
  E4), itemized "Outros custos" slot (US5 — `adminTotal` field removed).
- **Verification:** `pnpm gate` 224 tests + 100% pricing-core coverage; backend gate clean;
  `pnpm e2e` 26/26; SC-101..112 mapped in `specs/005-marketplace-multichannel/dod-evidence.md`.
- **Homologation (2026-07-08, qa-produto agents + owner):** US4 PASS · US5 PASS · US3 ISSUE
  found-and-fixed — the retry notice unmounted mid-refetch (raw `isError` drops during TanStack's
  transient `'pending'`); fixed with a sticky `refreshFailed` latch + deterministic latch test
  (mocked-hook tests alone had missed it — lesson: homologate against the REAL render). Cosmetic
  nits (toggle-label wrap, verbose row labels) fixed same day. **Open:** T042 design reconciliation
  (non-blocking) · D1–D4 ML ingestion (off critical path, blocked on the house ML account Q-D) ·
  the owner-authorized squash-merge PR to `develop`.

### FIRST RELEASE CUT (2026-07-09 — `develop`→`main`, FR-209 / 006)

Owner-authorized first formal release merge (`0b12426`, --no-ff), per the 006 spec Clarification of
2026-07-08. **Purpose: deploy-trigger availability** — GitHub only surfaces `workflow_dispatch` for
workflows on the default branch; with `deploy.yml` now on `main`, the manual `Deploy` control exists
(verified: workflow listed active post-push) and `auto-pr.yml` activated as the ADR-0006 side effect.
**Explicitly accepted:** the release snapshot was cut BEFORE a verified deploy exists; UAT deploys build
from `develop`, nothing was deployed FROM `main`. Snapshot = 002 + 001/003 (PRs #3/#4) + E1 complete
(004+005, PRs #6/#7) + 006 code half (PR #8: `gate:all` parity D4 · honest error contract + Schemathesis
A21 · privacy notice FR-214 · UAT runbook · ground reconcile). NOT a new ADR — ADR-0006 already rules
`main` = release; this line records the first exercise of that rule.

### 006 BUILT — CODE HALF (2026-07-09) + DEPLOY DEFERRED TO V1 (owner decision)

**Shipped to `develop` (PR #8) and cut to `main` (`0b12426`):** D4 `gate:all` (literal same command in
lefthook pre-push and ONE CI job + explicit `build` job; deliberate-failure verified — **A21 and D4 are
DONE**) · A21 honest error contract (`/me` 200+401, phantom `HTTPValidationError` stripped, Schemathesis
conformance as pytest/ASGI failing-first, Orval regen, `use-identity` on the generated client — **TD-019
retired**) · FR-214 privacy notice (`/privacidade` + sign-in link, test-first) · UAT runbook
(`docs/runbooks/uat-deploy.md`) · ground reconcile + orphan `fix/deploy-env-wiring` pruned (supersession
proven) · `VITE_RELEASE` stamp (owner-accepted).

**OWNER DECISION (2026-07-09): provisioning + first deploy DEFERRED until v1 complete = E1–E6** (catalog,
BOM, history/export, scenarios, billing on top of the shipped calculator). Consequences recorded in the 006
spec Clarifications: **T022-deploy / FR-010 (MUST) consciously stays open across E2–E6**; remote
homologation waits; everything is dry-ready (trigger visible on `main`, runbook, parity, honest contract).
The execution half (P1–P11 provisioning, Deploy trigger, smoke, rollback — 006 T002–T006/T025–T028)
re-opens as the **v1-launch increment**. Next real increment: **E2 (catalog + persistence + entitlement
scaffolding)**.
