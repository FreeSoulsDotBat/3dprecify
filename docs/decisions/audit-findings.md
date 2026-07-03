# Post-Decision Audit Findings (10-agent completeness sweep, 2026-06-28)

Verdict: the decided tech core is internally consistent; gaps are (A) genuinely-open decisions, (B) stale
pre-decision artifacts to reconcile, (C) missing artifacts to author. Full reports in scratchpad `audit-*.md`.

## RESOLVED (decision rounds after audit)
- **A4 → separate `specs/002-foundation/`** (2026-06-28, G1). Tooling/CI/configs get their own SDD increment; 001 stays product-only. T015/T017 pricing-core kept (camelCase-safe); T001 redone for pnpm under 002.
- **A1 → TanStack Router** (2026-06-28, G1). Type-safe, pairs with TanStack Query.
- **A2 → Prettier + prettier-plugin-tailwindcss** (2026-06-28, G1). Keeps ESLint+boundaries for lint; Prettier for format + Tailwind class sort.
- **A3 → React 19** (2026-06-28, G1). Catalog pin = React 19; single-React dedupe targets 19.

- **A5 → two separate code spaces** (2026-06-28, G2). pricing-core keeps its own zero-dep local validation codes (never wire-generated); backend Python `ErrorCode` = single source for WIRE errors → generated TS union in `shared/api`. No shared union, no import inversion — dissolves the "knot". If a validation code must later cross the wire, add an explicit map (not now).
- **A6 → Firebase Auth emulator** (2026-06-28, G2) for local dev + tests; no real keys locally; needs `firebase.json`/`.firebaserc`. Real-ADC verification only in deployed envs.
- **A7 → per-env CORS allowlist** (2026-06-28, G2) via pydantic-settings (local Vite ports + dev/prod Firebase Hosting domains); credentials on; expose `X-Correlation-Id`. Never `*`.
- **A9 → server-originates correlation id** (2026-06-28, G2). asgi-correlation-id pinned to header `X-Correlation-Id`; error envelope serialized via aliased Pydantic model → `correlationId` camelCase (matches success bodies); Orval wrapper reads header+body → typed `ApiError` + Sentry tag. FE consumes, does NOT originate. **TD:** FE-originates (network-failure correlation) deferred as future upgrade.

- **A8 → `shared/api`, committed** (2026-06-28, G3). Orval output (client/hooks/wrapper/types/ErrorCode-union) committed for drift-guard; ESLint/boundaries/no-barrel override exempts the folder.
- **A10 → southamerica-east1 (São Paulo)** (2026-06-28, G3). Cloud Run + Firebase project location (permanent). BR latency + LGPD residency.
- **A11 → Sentry DSN public build env + auth-token CI secret** (2026-06-28, G3). `VITE_SENTRY_DSN` build-time; backend DSN secret; Sentry auth-token in GitHub Environments for source-map upload; release tagged by git SHA.
- **A12 → integer percent** (2026-06-28, G3). 30 = 30%; locked across wire/DB to match shipped pricing-core (`markupPct/100`) and data-model.

### Observability & assisted-testing (G4, 2026-06-28)
- **O1 → correlation-first debug bundle.** Fixed structured-log event schema emitted by a request-lifecycle middleware: `{ts, level, correlationId, service, route(method+path), userUid?, status, latencyMs, errorCode?, releaseSha}`. Runbook documented: given a correlationId → Cloud Logging filter + linked Sentry issue (release-tagged). FE: Sentry **breadcrumbs** (console/network/clicks) on. **TD:** Sentry **Session Replay** deferred (LGPD + cost; revisit, likely premium-gated).
- **V1 → AI-judgment visual homologation (no pixel baselines now).** qa-produto drives Playwright MCP → captures screenshots at defined viewports (mobile ≤414px + desktop) → judges vs acceptance criteria → emits a report (screenshots + preliminary verdict) → Jonatan confirms/rejects (recorded as DoD evidence). Avoids Windows-dev × Linux-CI pixel flake. **TD:** add Linux/Docker pixel-diff baselines later (option V-both).
- **V2 → visual homologation advisory now, gating later.** DoD checklist item (human-confirmed), not a hard CI blocker in the skeleton; hardens into a gate as the domain stabilizes (matches progressive-gates D2).

### Deferred to their increment as documented tech debt (do NOT block 002-foundation)
- **A13 pricing-core version id** → E2 (subset of TD-008); needed to stamp saved-calc snapshots. Lock before E2 persistence.
- **A14 Base/Mixin + owner_uid index + FK/cascade + system-row carve-out + BOM/product/piece** → E2 data-model.
- **A15 IP/provenance gate (Amado3D)** → **RESOLVED 2026-07-02 (R2-G1): clean-room rebuild** — E1 specified
  from public cost-engineering first principles; spreadsheet doc demoted to category checklist. See
  `audit-findings-r2.md` §5.
- **A16 freeze pricing-model v1 vars** → before E1 spec. (Reframed by A15 clean-room: define the ORIGINAL v1
  variable set; "defects to fix vs replicate" dissolved — nothing is replicated.)
- **A17 WTP validation plan** → business, start collecting E1–E5; decide prices by E6.
- **A18 free-trial / catalog ownership / MVP-launch def / KPIs / final quota integers** → E2.
- **A19 security.md/STRIDE, LGPD notice, deletion/erasure, App Check, rate-limit, headers, check_revoked** → E2/launch (LGPD notice at E1 if public).

## A. OPEN DECISIONS (Principle VIII — decide with Jonatan)
### Block the foundation increment — ALL RESOLVED
- ~~A1 router~~ → TanStack Router · ~~A2 formatter~~ → Prettier+plugin · ~~A3 React~~ → 19 · ~~A4 process~~ → 002-foundation.
- ~~A5 ErrorCode~~ → two spaces · ~~A6 local auth~~ → emulator · ~~A7 CORS~~ → per-env allowlist · ~~A9 correlationId~~ → server-originates.
- ~~A8 generated code~~ → shared/api committed · ~~A10 region~~ → São Paulo · ~~A11 Sentry~~ → public DSN + token secret · ~~A12 percent~~ → integer.
- **Foundation increment is fully unblocked.** Remaining open items (A13–A19) are deferred to E1/E2/launch per the deferral rule (see above).
- **A5 Shared ErrorCode single source** [HIGH] — pricing-core is zero-dep canonical TS, can't import a union generated from Python. Options: hand-authored TS constants as source + Python enum diffed in CI / pricing-core defines its subset + backend mirrors / Python source→generated TS + pricing-core keeps local codes.
- **A6 Local-dev auth mode** [HIGH] — local runtime verifies REAL Firebase tokens (ADC) vs Auth emulator.
- **A7 CORS allowlist** [CRITICAL/E1] — retracted, never re-decided; Firebase Hosting→Cloud Run is cross-origin. Allowlist from per-env settings.
- **A8 Generated-code location in FSD** [HIGH] — `shared/api` (committed for drift-guard, lint/type-exempt?).
- **A9 correlationId casing + direction** [HIGH] — error handlers bypass alias_generator (would leak snake); FE-originates vs server-only; header X-Correlation-Id vs asgi default X-Request-ID; Orval throw-wrapper error class.

### Cheap to set at E1 deploy
- **A10 Cloud region / data residency** [MED] — southamerica-east1 (Cloud Run + Firebase project location).
- **A11 Sentry CI secret + DSN env + release tagging** [MED] — not in the S1 secrets matrix.

### Lock at/before E2
- **A12 Percentage representation** [MED] — fraction 0.30 vs integer 30; MUST match pricing-core input contract (else 100× skew).
- **A13 pricing-core version identifier** [HIGH] — needed to stamp E2 saved-calc snapshots (subset of TD-008).
- **A14 Base/Mixin spec** (owner_uid index, FK/cascade policy, system-row nullable-owner_uid carve-out) + **BOM/product/piece** structure.

### Product (block E1 / business-critical)
- ~~A15 IP/provenance gate~~ → RESOLVED 2026-07-02: clean-room rebuild (`audit-findings-r2.md` §5).
- **A16 Freeze pricing-model v1 variable set** [HIGH/E1] (reframed by A15 clean-room; defect question dissolved).
- **A17 WTP validation plan** [CRITICAL/start-now] — collect E1–E5, decide prices by E6.
- **A18 Free-trial policy** (affects E2 entitlement schema), **catalog ownership/global-default**, MVP/launch def, KPIs, quota integers (final at E2).

### Security/LGPD (E1-public / E2 / launch)
- **A19 security.md / STRIDE** (before E2), **LGPD privacy notice** (E1 if public deploy), **account deletion/erasure vs soft-delete** (E7/Play, design at E2), retention vs fiscal (E6), App Check / rate-limit / security-headers / check_revoked (E2/launch).

## B. STALE ARTIFACTS to reconcile (mechanical; do in foundation increment)
- plan-template.md: add **8th Constitution-Check gate** (Principle VIII) — flagged, still pending.
- 001 plan.md/tasks.md/research.md/data-model.md/quickstart.md: regenerate vs all decisions (npm→pnpm, Node20→24, React18→pin, bulletproof→FSD-Lite, flat-backend→domain-modular, Cloudflare/Render→CloudRun/Firebase, snake→camel, {detail}→envelope, GOOGLE_APPLICATION_CREDENTIALS→ADC, verify_id_token→run_in_threadpool, Vitest2→4, missing tasks). data-model.md snake→camel. contracts/api.md 401→envelope + X-Correlation-Id.
- decisions-backlog.md stale lines: L9 (ADR numbering), L28 (R3.2 A→B), L36 (NUMERIC(12,4)→18,6/12,2), L37 (owner_id→owner_uid), L40 (ORM/driver "LATER"→decided), L48 (§6 router/Context/Prettier "NOW" retracted), §9 (Cloudflare preview, branch-protection caveat).
- business-rules.md L4/L47 + tech-debt: ADR cross-refs wrong (payments cited as ADR-0002).
- constitution.md L100 + .claude/agents/scrum-master.md: "orchestrates/sequence/enforce" → "advisor" per ADR-0001.
- **Principle VIII not in ANY .claude/agents/* file** (constitution L110 requires it) — esp. arquiteto/dev-backend/dev-frontend/dev-estrutura-de-dados.
- tech-debt: add Peace Sans license + palette contrast gates as rows (%/trigger); narrow TD-004 to physical-schema.

## C. MISSING artifacts to author (foundation/E1 build punch-list)
lefthook.yml · .nvmrc · pnpm-workspace.yaml+catalogs · pyproject.toml+uv.lock · orval.config · eslint flat+boundaries · dependency-cruiser · import-linter · vite.config (aliases/PWA/Tailwind/zod-env) · design-token CSS-var file (palette→semantic, both themes; BLOCKED by contrast gate) · pt-BR messages module · PWA manifest+SW+icons (from logo symbol) · auth Zustand store · CurrentUser dep · CORS config · pydantic-settings fields · exception-handler→envelope map · ErrorCode enum module · Dockerfile (Cloud Run) · firebase.json (emulator) + .firebaserc · CI full rewrite (pnpm+uv+gates+gitleaks/trufflehog+emulator+drift-guard+Schemathesis+coverage-ratchet) · DoD evidence-block template · PR template/CODEOWNERS · coverage-ratchet tool · WIF provisioning · deploy+preview+smoke+rollback · Renovate · commit-convention tool · pin MCP versions · security.md · LGPD privacy notice · (foundation spec if A4=separate).
