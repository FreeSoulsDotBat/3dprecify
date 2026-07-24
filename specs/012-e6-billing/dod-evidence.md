# DoD Evidence — 012-e6-billing

Per-slice evidence for the owner-gated PR flow (ADR-0006). Verification discipline: every count below was
**re-measured by the main loop** after the executing agent reported it.

## PR-A — The turnstile: price → checkout → verified grant (US1 + US2 + US3)

**Branch**: `feature/012-e6-billing` · **Dates**: 2026-07-20..21 · **PR**: *(pending — T020, owner-gated;
ADR-0023 flips Proposed → Accepted at this gate)* · **Mode**: the owner's **build-first/provision-later**
strategy — everything below ran with ZERO real MP credentials (the T011b local stub).

### The wave map (011 routing live)

| Wave | Agent (model) | Tasks | Tokens (harness) | Verified by main loop |
|---|---|---|---|---|
| UX handoff | designer-ux (opus) | T001 | 126,608 | `ux-billing.md`; 9 flags → owner decided all 2026-07-21 |
| Foundational | dev-estrutura (**opus — ADR-0022 money-domain**) | T004–T007 | 186,659 | 27 passed + 14 SEC red-by-design re-run locally; migration 0005 up→down→up |
| US3 spine | dev-backend (sonnet) | T008–T011b | 311,536 | SEC 16/16 · 366 passed re-run |
| Checkout | dev-backend (sonnet) | T012–T013 | 146,598 | 374/0 re-run; regen hash-idempotent |
| US1 FE | dev-frontend (sonnet) | T014–T015 | 213,059 | 673/673 + tsc clean re-run |
| Cold-return fix | dev-frontend (sonnet, resumed) | e2e defect | 274,029 | 679/679 + auth-boundary 6/6 in-browser |
| e2e | qa-software (sonnet, 2 legs) | T016 | ≥610,419 | 7/7 flows; flip proven at browser level |
| Security review | **seguranca (opus, BLOCKING)** | T017 | 135,575 | APPROVED-WITH-CONDITIONS → conditions closed same-day (378/378) |
| Visual homologation | qa-produto (opus, 3 legs incl. a session crash) | T018 | ~286,883–293,221 (leg-1 usage lost to the crash; two ledger recorders) | PASS 94% · 12 PNGs in `evidence/t018/` |

### The real defects found and fixed pre-gate (the net working as designed)

1. **Cold-return loss (HIGH, e2e-found)**: MP's browser redirect-back bounced through sign-in and LOST the
   query string — the honest confirmation surface never rendered. Fixed (`951d714`): the redirect intent
   carries pathname+search (open-redirect guard extended, regression-tested) + the app boot gates on
   `authStateReady()` (no anonymous flash on cold nav) + the Conta 390px plan-row wraps. Flip proven in the
   browser: honest pending pre-confirmation → success on the mounted panel's own poll, no reload.
2. **T017 security conditions (closed same-day, `41c7f8a`)**: C1 — the SEC-104 contradictory-lookup test
   (signed webhook + rejected lookup → 200 ack, zero writes); C2 — `billing_events.raw` PRUNED to an audit
   whitelist + SEC-501 content sweep (payer email/CPF/card data never persisted); L1 — prod refuses a
   non-production MP base URL (settings validator). L2 (orphan preapproval on a lost checkout race)
   accepted-deferred to T016b. The 300s freshness window was RATIFIED by the review.
3. **Cross-wave tsc gap**: `BILLING_UNAVAILABLE` missing from the FE error-messages map (invisible to
   vitest, caught by the FE wave's typecheck).

### T018 — visual homologation (qa-produto, opus)

**PASS, confidence 94%** — 7/7 points by eye at 390px (+ desktop at the offer), 12 PNGs, **zero app
defects**: exact prices with the de/por ABSENCE asserted · sign-in-first with full return-to-intent · honest
"Confirmando seu pagamento…" → self-poll flip → premium unlocked without re-login · abandonment with no
ghost state and no "409" jargon (owner F6) · spoof invisible · courtesy state honest · subscription
display-precedence over courtesy (eye + API-corroborated). Nits: N1 courtesy-active accounts have no in-UI
paid-conversion door (by design — product flag for the owner) · N2 state surfaces desktop-checked only at
the offer · N3 dev-console ApiError log on the 409 path.

### T019 — gates (2026-07-21, main loop)

- **`pnpm gate:all` → exit 0** (the literal command): web 768 gate-mode / 679 plain vitest · backend 378 ·
  import-linter **4 kept / 0 broken** (the new `E6 layering: api → billing → models` contract included).
- **Drift-guard idempotence**: regen pair → **0 diff** (hash-identical).
- **SC-709**: full e2e chromium **77/77, 0 flaky, 0 skipped** (70 pre-E6 + 7 billing) — every E1–E5 guard
  green unchanged; `pricing-core` untouched (3.1.0).
- **Infra note (for CI observation)**: playwright's 3-webServer boot can race TWO concurrent `uv run`
  alembic processes (global-setup + `run_e2e_server.py`) — reproduced locally under the `firebase
  emulators:exec` wrapper timing; green when servers pre-exist (reuse) or timing separates them. If CI's e2e
  job reds on this, the fix is a single migration owner in global-setup.

### T020 — owner gate

*(pending: PR-A opened for owner homologation + squash-merge authorization; ADR-0023 flips Accepted here)*
