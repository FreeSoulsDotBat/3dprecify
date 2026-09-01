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


async def _run() -> int:
    """Returns the process exit code (B6, `docs/RELATORIO_LEGIBILIDADE.md`): `reconcile_all`
    already computed `subscriptions_unreachable` (015/A2), and Onda 7 started PRINTING it, but the
    caller (`main`) still returned 0 unconditionally — a scheduler/alert reading "exit 0" could not
    tell "tudo em dia" from "MP estava fora do ar e nada foi verificado". A partial round (some
    healed, some unreachable) still reports BOTH numbers — the work done does not disappear — but
    the exit code reflects the failure, because the round did not finish what it set out to check.
    """
    settings = get_settings()
    session_factory = get_session_factory()
    provider = MercadoPagoProvider(settings)
    try:
        async with session_factory() as session:
            summary = await reconcile_all(session, provider)
        print(
            f"reconcile: checked {summary.subscriptions_checked} subscription(s),"
            f" healed {summary.grants_written} grant(s),"
            f" unreachable {summary.subscriptions_unreachable}"
        )
        if summary.subscriptions_unreachable > 0:
            print(
                "reconcile: PARTIAL round — "
                f"{summary.subscriptions_unreachable} subscription(s) could NOT be verified"
                " against Mercado Pago (provider unreachable); any missed webhook for them"
                " remains UNHEALED. Exiting non-zero so a scheduler/alert does not read this"
                " as a clean run."
            )
            return 1
        return 0
    finally:
        await provider.aclose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="reconcile-subscriptions", description=__doc__)
    parser.parse_args(argv)
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
