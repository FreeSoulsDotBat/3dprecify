# 003-app-shell-and-ds — DoD evidence (increment CLOSED 2026-07-03)

**Branch**: `feature/003-app-shell-and-ds` · **Owner sign-off**: Jonatan, 2026-07-03 ("pode fechar a 003").
All 73 tasks done (T001–T073); every user story homologated by the owner the same day it shipped.

## Gates (final run, post-polish)

| Gate | Result |
|------|--------|
| `prettier --check` / `eslint` (boundaries FSD-Lite) | clean |
| `dependency-cruiser` | 126 modules, 0 violations |
| `tsc --noEmit` (web + pricing-core) | clean |
| Unit/integration | **75/75** (web 68 in 13 files · pricing-core 7) |
| Coverage (`packages/*`) | 100% stmts/branches/funcs |
| Playwright e2e (chromium + mobile, Auth emulator) | **54/54** |
| Token-parity snapshot | 4/4 (87 tokens frozen, incl. status-text) |

## Story homologations (owner, 2026-07-03 — evidence inline at each tasks.md checkpoint)

- **US1 T027 PASS** — 4-tab shell (TabBar ≤425px / sidebar), canonical R$ 2,00 / R$ 3,00; breakpoint
  changed 414→425px during homologation (owner decision, A39 partial).
- **US2 T070 PASS** — public `/calcular`, guarded tabs + return-to-intent, sign-in re-skin, A33 phase-1
  offline message; dual-logo layout accepted.
- **US3 T044 PASS** — focus-to-title, light first-class + persistence (A34 chain incl.
  `prefers-color-scheme`), `--danger-text` contrast, reduced-motion.
- **US4 T071 PASS** — offline banner (<1s, calc keeps working), branded 404, error screen with stable
  "Código de suporte: {correlationId}", copy-honesty locked by test.
- **US5 T058 PASS** — server-confirmed identity via live `/api/v1/me` against emulator-validated backend
  (A23 proven end-to-end), honest "Gratuito", persisting theme Switch, sign-out re-guards.
- **T065 final** — ACCEPTED BY OWNER per V2 (advisory homologation): the five story passes cover every
  surface in both themes/viewports; quickstart V1–V10 all PASS (record appended to quickstart.md).

## Success criteria: SC-001..SC-008 all covered (see quickstart execution record).

## Decisions honored (capture log: `docs/decisions/audit-findings-r2.md` §5)

A20 (transport: getIdToken per request, ApiError, baseURL, Sentry hook — incl. no-response
normalization), A23 (identity from `/me` response only), A33 phases 1+2, A34 (theme chain), A39 partial
(425px), A40/ADR-0007 (Radix + `tf-*`), C1 (Dialog built, FR-016), D2 (Sentry FE live), TD-014 closed
(webfonts), TD-015 closed (status-text tokens), TD-017 closed (shell adopted).

## Residual debt / follow-ups (registered)

- **TD-018** — top-bar shows client-session e-mail; globalizing `/me` is an owner call.
- **TD-019** — `use-identity` on `apiFetch` until A21 backend contract fix (phantom 422); Orval
  `clean:false` rationale documented.
- **A21/A22/D4** — backend contract fix + runtime-env wiring + shared `gate:all` (decided in R2, not in
  003 scope; schedule next).
- **R2-1..R2-7** — mechanical doc reconciles incl. stale `CLAUDE.md` "Nothing committed yet" and the
  `quality-gate.ps1` hook inconsistency.
- Deploy (T022 of 001 / FR-010) remains out of 003 scope — blocked on manual cloud prereqs.
