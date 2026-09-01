"""B6 (`docs/RELATORIO_LEGIBILIDADE.md`) — the reconciliation runner's exit code.

`app.billing.reconcile.reconcile_all` already computes `subscriptions_unreachable` (015/A2), and
Onda 7 started PRINTING it, but the CLI (`app.scripts.reconcile_subscriptions`) returned exit 0
unconditionally regardless — a scheduler/alert reading "exit 0" could not tell "tudo em dia" from
"MP estava fora do ar e nada foi verificado". Pins both paths so a future refactor cannot silently
drop the exit code back to 0:

* `subscriptions_unreachable == 0` → exit 0, output UNCHANGED (byte-identical happy path);
* `subscriptions_unreachable > 0` → exit != 0, and a partial round (healed > 0 AND unreachable > 0)
  still reports BOTH numbers — the work done does not disappear from the report.

These do NOT need a real database or a real Mercado Pago: `reconcile_all` is monkeypatched, so the
DB session/provider are only ever constructed, never queried against.
"""

from __future__ import annotations

import pytest

from app.billing.reconcile import ReconcileSummary
from app.scripts import reconcile_subscriptions
from app.settings import Settings


class _NullProvider:
    async def aclose(self) -> None:
        return None


class _NullSessionCtx:
    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, *exc: object) -> None:
        return None


def _fake_session_factory() -> _NullSessionCtx:
    return _NullSessionCtx()


def _fake_provider_ctor(settings: Settings) -> _NullProvider:
    return _NullProvider()


def _patch_collaborators(monkeypatch: pytest.MonkeyPatch, summary: ReconcileSummary) -> None:
    monkeypatch.setattr(
        reconcile_subscriptions, "get_session_factory", lambda: _fake_session_factory
    )
    monkeypatch.setattr(reconcile_subscriptions, "MercadoPagoProvider", _fake_provider_ctor)

    async def _fake_reconcile_all(session: object, provider: object) -> ReconcileSummary:
        return summary

    monkeypatch.setattr(reconcile_subscriptions, "reconcile_all", _fake_reconcile_all)


def test_all_reachable_exits_zero_with_unchanged_output(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _patch_collaborators(
        monkeypatch,
        ReconcileSummary(subscriptions_checked=3, grants_written=1, subscriptions_unreachable=0),
    )

    exit_code = reconcile_subscriptions.main([])

    assert exit_code == 0
    out = capsys.readouterr().out
    assert out == "reconcile: checked 3 subscription(s), healed 1 grant(s), unreachable 0\n"


def test_unreachable_subscriptions_exit_nonzero(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _patch_collaborators(
        monkeypatch,
        ReconcileSummary(subscriptions_checked=12, grants_written=0, subscriptions_unreachable=12),
    )

    exit_code = reconcile_subscriptions.main([])

    assert exit_code != 0
    out = capsys.readouterr().out
    assert "checked 12 subscription(s), healed 0 grant(s), unreachable 12" in out
    assert "PARTIAL" in out


def test_partial_round_keeps_healed_count_visible_and_still_fails(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """healed > 0 AND unreachable > 0 at once: the work done must not disappear from the report,
    and the exit code must still reflect the round did not finish what it set out to check."""
    _patch_collaborators(
        monkeypatch,
        ReconcileSummary(subscriptions_checked=5, grants_written=2, subscriptions_unreachable=3),
    )

    exit_code = reconcile_subscriptions.main([])

    assert exit_code != 0
    out = capsys.readouterr().out
    assert "healed 2 grant(s)" in out
    assert "unreachable 3" in out
