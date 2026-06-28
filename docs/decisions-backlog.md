# Decisions Backlog — gaps found by the 10-specialist SDD review (2026-06-26)

Working agenda of what is NOT yet defined. Priority: **NOW** (decide before more code) · **SOON** (this/next increment) · **LATER**.
Items get decided in themed rounds with Jonatan; architectural ones become ADRs under `docs/adr/`.
Cross-cutting consensus (raised by ≥3 agents): **CI that actually runs tests + gates merges**, **ADR mechanism**, **error model/codes**, **API contract source + casing**, **entitlement design (offline+TTL)**, **service-account secret handling**.

## 1. Process & Meta-Plan (Scrum Master) — DECIDED 2026-06-26 → ADR-0001
- DONE: Orchestration ownership — main thread orchestrates; `scrum-master` = advisor. (R1.1)
- DONE: ADR mechanism — `docs/adr/` MADR + index + ADR-0001 written. Payments (ADR-0002) & entitlement (ADR-0003) pending.
- DONE: Branching/review model — private GitHub; planning docs→`main`; implementation increments→branch `NNN-slug`→PR→squash. (R1.2)
- DONE: DoD evidence/CI — GitHub Actions `ci.yml` (blocking required check) + per-increment DoD evidence block. (R1.3)
- DONE: Definition of Ready + Definition of Done + 3 human gates (G1 scope / G2 ADR / G3 DoD) + feature↔increment↔story mapping — all in ADR-0001.
- SOON: product roadmap/backlog artifact; cadence/close ritual.
- LATER: commit cadence/convention; estimation & WIP.

## 2. Product & Business Rules (Product Owner) — DECIDED 2026-06-26 → docs/product/business-rules.md
- DONE: **Freemium boundary** = compute free / persistence & scale premium (R2.1=B + quota lever).
- DONE: Roadmap epics sequence E1→E7 as proposed (R2.3=A); entitlement scaffolding lands at E2, purchase at E6.
- DONE: Tiers = Free + single Premium with monthly & annual periods (R2.2=B). Quota integers PROVISIONAL (finalize at E2).
- DONE: Pricing in R$ deferred until validated with real sellers (R2.4=A) — set before E6.
- SOON: free trial policy; MVP/launch definition; catalog ownership (user-scoped); acceptance-criteria standard; KPIs.
- OPEN PREMISE (~55%): willingness-to-pay still unvalidated — validate with real sellers before locking prices (R2.4 defers it).
- LATER: user roles (single owner for launch); onboarding/first-run + starter catalog seed.

## 3. Architecture — partly DECIDED 2026-06-27 → ADR-0002
- DONE: API contract source of truth = server-authoritative OpenAPI (FastAPI) → codegen TS client (R3.1=A).
- DONE: Wire casing = snake_case JSON + camelCase TS via codegen/orval (R3.2=A).
- DONE: ADR template/location/index (R1 → docs/adr/).
- DONE: Error model = `{error:{code,message,details,correlation_id}}` + stable code enum (R3.3); pricing-core keeps enriched typed `throw`, zod at web edge (R3.4).
- DONE: Observability = structured JSON logs + correlation_id middleware + Sentry (R3.3 add-on, ADR-0002 §5).
- SOON: pricing-core packaging (build ESM/CJS + d.ts) + cross-language parity guard (golden-vector fixture for Python); monorepo task runner (npm workspaces + Turbo?); i18n architecture; config/secrets/env matrix (separate Firebase project per env); entitlement architecture (see Security GAP2).
- LATER: offline persistence/sync & conflict strategy; dependency/version policy.

## 4. Data / Database
- NOW: Physical schema/ERD for post-skeleton domain (identity&billing / catalog / product+BOM / costing+history).
- NOW: Money & unit representation — recommend `NUMERIC(12,4)` money, percentages as decimal fraction, canonical units (g, kWh, h).
- NOW: Multi-tenancy/isolation — Postgres RLS + app-layer scoping; every owned row has `owner_id` (Firebase uid).
- NOW(prereq): migration tooling = Alembic + naming conventions.
- SOON: PK strategy (UUIDv7 for offline-mintable ids); soft-delete + audit timestamps; **saved-calculation = frozen snapshot + pricing-core semver** (reproducible quotes); seed/defaults (marketplace fees, wear levels) as updatable system rows; subscriptions/entitlements/billing_event tables; FK/cascade policy; English snake_case naming.
- LATER: ORM/driver (SQLAlchemy 2.0 + psycopg3); offline-sync contract (LWW by updated_at).

## 5. Backend (FastAPI)
- NOW: pydantic-settings config; error envelope (with 3); typed `CurrentUser` auth dependency (composable into `require_entitlement`); CORS (skeleton can't work cross-origin without it); Ruff + mypy wired into the quality gate (Python is currently ungated).
- SOON: layered layout (routers/schemas/services/deps/core) via app-factory; async-vs-sync (firebase-admin verify is blocking → threadpool); test layering + fixtures + emulator marker; OpenAPI authority.
- LATER: structured logging + correlation id; rate limiting (slowapi or edge).

## 6. Frontend (React)
- NOW: routing (React Router v7) + session state (Context) + typed API client (token + 401 interceptor) triad; ESLint/Prettier strict flat config (makes the gate real); i18n lib + Intl BRL + pt-BR comma-decimal input parser.
- SOON: styling = Tailwind + tokens; component lib = shadcn/ui; forms = RHF + zod (schema aligned with pricing-core); PWA data layer (IndexedDB/Dexie when persistence lands); loading/empty/error patterns + error boundary + WCAG 2.2 AA + jsx-a11y; perf/bundle budget (lazy-load Firebase); typed/validated client env (zod).
- LATER: offline entitlement-token handling.

## 7. UX / UI rules — DECIDED 2026-06-28 → docs/product/ux-decisions.md + docs/design/claude-design-brief.md
- DONE: brand identity sourced from Truth's Forge manual/mockups (palette #7800ff/#f7931e/#15bddc + neutros, Peace Sans/Lilita One/Inter, logo+grafismos) → handoff = Claude Design brief.
- DONE: UX foundations — bottom-tab nav, single-screen live-recompute + progressive disclosure, full breakdown result (varejo/atacado), catalog-driven inputs (UX1-4 = A/A/A/A).
- DONE: states matrix; currency/number input UX (R$/comma/unit/inputmode/tabular); WCAG 2.2 AA; markup terminology "Markup (margem sobre o custo)"; light v1 + dark 2nd theme; copy tone direct/technical-cordial.
- LATER: iconography (Lucide/Phosphor — Claude Design call); empty-catalog onboarding (E2).
- FLAGS: wordmark "TRUTHS'S FORGE" typo (assume "TRUTH'S FORGE"); flowchart TF.txt = store, not Precifica3D.

## 6b. Frontend defaults taken (deferral rule, low risk) — applied at implementation
- React Router; Context for session; typed fetch client (token + 401 interceptor); ESLint+Prettier flat config; Vitest.
- i18n library DEFERRED → TD-001 (pt-BR typed messages module meanwhile).

## 8. QA / Test strategy
- NOW: CI runs Vitest+pytest+Playwright and gates merge (today nothing enforces test-first; hook is pwsh-only, lint-only); e2e auth env = Firebase Auth emulator (real Google OAuth not automatable); visual-homologation concrete checklist (zero console.error, no failed requests, viewport set, pt-BR copy match, canonical R$2,00/R$3,00, evidence pasted); coverage targets (pricing-core 100% line/≥95% branch; backend ≥90% auth; web ≥70% logic).
- SOON: web↔API contract test (generated types); visual-regression baselines built in CI/Linux; flaky-test policy (retries CI=2, unit=0, quarantine lane); offline test vs prod build (`vite preview` + setOffline); fixtures/factories; a11y test (@axe-core/playwright).
- LATER: perf budget/Lighthouse-CI; bench computePrice (<50ms); mutation testing (Stryker on pricing-core).

## 9. DevOps / CI-CD
- NOW: GitHub remote (private) + repo hygiene; CI pipeline (lint/type/test/build for Node 24 + Py 3.12) + branch protection on `main`; npm-audit critical triage + Firebase service-account secret path (GitHub Environment secret + host store + gitleaks).
- SOON: environments (Cloudflare per-PR preview + prod) with per-env Firebase; deploy+rollback automation + post-deploy smoke (`/health`, SPA root); versioning/changelog (Conventional Commits, v0.1.0 tag); monitoring (Sentry + uptime ping); dependency updates (Renovate); `backend/Dockerfile` as the tested prod artifact.
- LATER: docker-compose for local parity.

## 10. Security & LGPD
- DONE: service-account `.json` added to `.gitignore` (2026-06-26).
- NOW: entitlement-enforcement design (server-side per-request for premium; basic calc stays offline/free; avoid premium custom-claim staleness); npm-audit critical triage (verify reachability, don't assume dev-only).
- SOON: `security.md` (threat model STRIDE-per-boundary so `seguranca` has a spec to gate); payment security as ADR criteria (MP webhook HMAC + idempotency + server reconciliation; PCI SAQ-A hosted fields); session lifetime/revocation (`check_revoked` on sensitive ops); rate limiting + Firebase App Check; CORS allowlist + security headers (HSTS/CSP/etc.); LGPD privacy policy + lawful basis (contract performance) + consent for marketing; data-subject rights + account deletion (Play requirement) + retention (fiscal vs deletion conflict).
- LATER: PII data-map; data residency (decide early — BR/South-America regions); audit logging for entitlement/payment events.
