"""E6 (T011, ADR-0023 §4) — operator/scheduled reconciliation runner (the `grant_premium.py` CLI
pattern). The resilience layer for a missed webhook (FR-706/US3.5): iterates every non-terminal
subscription, re-observes Mercado Pago's authoritative state, and feeds each looked-up payment
through the SAME terminus the webhook route calls — convergence on `billing_events.event_key`
(SC-703), so a healed payment and a later/earlier webhook delivery for it never double-grant.

Dev posture: invoked by hand (no scheduler before the v1 deploy — the 2026-07-09 deferral stands).
Deploy posture: Cloud Scheduler → a Cloud Run job (cadence ~6h per research.md §D10, confirmed
against MP's real retry cadence).

Usage (uv, from ``backend/``)::

    uv run python -m app.scripts.reconcile_subscriptions
"""

from __future__ import annotations

import argparse
import asyncio

from app.billing.providers.mercadopago import MercadoPagoProvider
from app.billing.reconcile import reconcile_all
from app.db import get_session_factory
from app.settings import get_settings


async def _run() -> None:
    settings = get_settings()
    session_factory = get_session_factory()
    provider = MercadoPagoProvider(settings)
    try:
        async with session_factory() as session:
            summary = await reconcile_all(session, provider)
        print(
            f"reconcile: checked {summary.subscriptions_checked} subscription(s),"
            f" healed {summary.grants_written} grant(s)"
        )
    finally:
        await provider.aclose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="reconcile-subscriptions", description=__doc__)
    parser.parse_args(argv)
    asyncio.run(_run())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
