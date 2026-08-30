"""E6 (T010) — MP `x-signature` HMAC verification (SEC-101..107). Runs BEFORE any lookup or DB
touch (SEC-103) — deny-by-default on any doubt (bad/absent/garbage signature, missing headers, a
stale timestamp, or an absent secret — SEC-403 fail-closed).

**Manifest** (MP docs, seguranca-round.md §1, verified 2026-07-20): ``id:<data.id>;request-id:
<x-request-id>;ts:<ts>;`` — HMAC-SHA256 keyed by the per-environment webhook secret, `data.id`
lowercased (a documented MP quirk). Compared with `hmac.compare_digest` (SEC-107, constant-time).

**Freshness window — dated deviation (dev-backend, 2026-07-21).** MP publishes no default replay
window (research.md D6, [ARCH-OWED], never resolved by the arquiteto/plan round). 300s (5 minutes)
is a conventional webhook-signature tolerance (Stripe/AWS SNS precedent) picked here as an
implementation-level parameter of an already-decided mechanism (signature verification itself is
ADR-0023/seguranca-round decided) — NOT a structural/architecture call. Flagged for confirmation at
the seguranca PR-A review gate (T017); trivially tunable (one constant) if the owner sets a
different value.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time

FRESHNESS_WINDOW_SECONDS = 300  # SEC-106 — see the dated-deviation note above.

_SIGNATURE_RE = re.compile(r"^ts=(?P<ts>\d+),v1=(?P<v1>[0-9a-fA-F]{64})$")


def canonical_manifest(data_id: str, request_id: str, ts: str) -> str:
    """The exact MP manifest string, `data.id` lowercased (the documented quirk)."""
    return f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"


def verify_signature(
    *,
    x_signature: str | None,
    x_request_id: str | None,
    data_id: str | None,
    secret: str | None,
    now: float | None = None,
) -> bool:
    """SEC-101..107/SEC-403: `True` only for a well-formed, fresh, correctly-HMAC'd signature over a
    secret that is actually configured. Any other input — missing header, malformed
    `ts=…,v1=…`, stale `ts`, wrong `v1`, unset secret — is `False`. Never raises (deny is a plain
    boolean)."""
    if not secret or not x_signature or not x_request_id or not data_id:
        return False
    match = _SIGNATURE_RE.match(x_signature.strip())
    if not match:
        return False
    ts_raw = match.group("ts")
    v1 = match.group("v1")
    when = now if now is not None else time.time()
    if abs(when - int(ts_raw)) > FRESHNESS_WINDOW_SECONDS:
        return False
    manifest = canonical_manifest(data_id, request_id=x_request_id, ts=ts_raw)
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
