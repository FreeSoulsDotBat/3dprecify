"""E6 billing (ADR-0023) — the purchase turnstile: a new writer of the ADR-0012 ledger.

The entitlement evaluation code (`app.entitlement`) is NEVER edited by this package — it adds
exactly one new producer of `entitlement_grants` rows: a server-verified payment event
(`source=payment`), fed by `grant_writer.process_verified_event`. Two shapes converge on that ONE
terminus: the signature-authenticated webhook route (`app.api.billing`) and the reconciliation
runner (`app.scripts.reconcile_subscriptions`) — both look the resource up against the provider
(`providers/mercadopago.py`) before any write (Constitution IV / SEC-104), and both key on
`billing_events.event_key` for exactly-once (SC-703).

Import direction (import-linter, `E6 layering: api -> billing -> models`): `app.api` may import
`app.billing`; `app.billing` may import `app.models` (+ `app.db`/`app.settings`, unconstrained
leaves); nothing here imports back up into `app.api`.
"""

from __future__ import annotations
