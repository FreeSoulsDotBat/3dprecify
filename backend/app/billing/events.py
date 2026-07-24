"""E6 (T009) — the normalised, VERIFIED payment event shape shared by every provider.

`PaymentProvider` implementations (MP now, the flag-gated Play provider at E7 — ADR-0023 §6) each
translate their own wire shape into a `VerifiedEvent`; `grant_writer.process_verified_event`
consumes only this shape, never a provider's raw response and never a webhook body's own claimed
fields (Constitution IV / SEC-104). Provider-agnostic by construction — the terminus does not know
or care which PSP produced the event.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

EventKind = Literal["payment", "payment_failed", "refund", "chargeback", "cancel"]


@dataclass(frozen=True)
class VerifiedEvent:
    """The result of verify-then-lookup (SEC-104/D2) — every field comes from the LOOKED-UP
    authoritative resource, never the webhook body."""

    #: The PSP reference that resolves to OUR `subscriptions.mp_preapproval_id` (server-side
    #: only — SEC-204/VR-703; never a client/body-supplied account id).
    subscription_ref: str
    #: The idempotency key = `billing_events.event_key` (data-model §2) — MP's own resource id.
    event_key: str
    kind: EventKind
    #: `None` when the event carries no period boundary (e.g. `cancel`).
    period_end: datetime | None
    mp_status: str
    #: The looked-up resource, verbatim — the `billing_events.raw` audit payload.
    raw: dict[str, Any]
