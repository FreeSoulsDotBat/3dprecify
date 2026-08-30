# E6 — quickstart validation walk (sandbox; the owner-homologation script)

> Prereqs: compose Postgres :5433 · auth emulator :9099 · backend :8100 with **sandbox** MP creds
> (`P3D_MP_ACCESS_TOKEN`, `P3D_MP_WEBHOOK_SECRET`, the two plan ids) · preview :4173 · a dev tunnel pointing
> MP sandbox notifications at `/api/v1/billing/webhook/mercadopago`. The LIVE webhook is validated at the v1
> deploy (owner Q3) — nothing in this walk requires production.

1. **The offer (US1/FR-701)**: signed-in free seller → any premium teaser → the plan surface shows
   R$ 15,99/mês and R$ 155,88/ano ("equivalente a R$ 12,99/mês"), honest delta, working "Assinar".
   Signed-out → the CTA routes through sign-in first (FR-702).
2. **Checkout (US2)**: choose a period → redirected to MP's hosted sandbox checkout (`initPoint`); pay with
   an MP sandbox card. Abandon once first: return to the app → no grant, no ghost state (US2.2), Conta
   unchanged.
3. **The flip (US3/SC-701)**: complete the sandbox payment → webhook (tunnel) fires → within one entitlement
   refresh every E2–E5 premium surface unlocks, NO re-login. Verify server-side: one `billing_events` row,
   one `source=payment` grant with `expiresAt = currentPeriodEnd`.
4. **Exactly-once (SC-703)**: replay the same sandbox notification (MP dashboard re-send) N times → still
   exactly one grant/inbox row. Kill the tunnel, re-trigger, run
   `uv run python -m app.scripts.reconcile_subscriptions` → the missed event heals to the SAME single grant.
5. **Spoof (SC-702)**: POST a forged webhook (bad signature / absent / `live_mode` mismatch) → 401/reject,
   zero DB writes.
6. **Cancel (US4/SC-704)**: cancel from Conta → "ativo até {data}, não renova"; force-expire (test clock /
   sandbox period) → read-only freeze (reads live, writes 403, 0 rows deleted); re-subscribe → writes back,
   data intact.
7. **Grace (US5/FR-708)**: simulate a failed renewal (sandbox rejection card) → Conta shows "pagamento
   pendente — regularize até {data}" with premium STILL active (the grace grant); recover → continuous
   active; exhaust → honest lapse.
8. **Dual grant**: on a `beta`-granted account, subscribe → both grants stand; Conta shows the subscription;
   cancel + expire the subscription → account STILL active on the courtesy grant.
9. **Refund (US8, if shipped)**: sandbox refund → grant revoked, immediate honest lapse; replay → idempotent.
10. **Play flag (SC-711)**: `curl` the two Play routes → 404 in every E6 env; the flag is env-config only.
11. **Teasers (US7/FR-710)**: all four teasers (catálogo, kits, histórico, cenários) show the real price +
    working Assinar; honesty sweep — no fabricated number, no false urgency, no "de/por" fake anchor.
12. **SC-709**: full existing suites green unchanged (`pnpm gate:all` + e2e) — E6 altered no gated feature.
