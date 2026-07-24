"""E6/T016 (QA e2e) — serves `MPStub` (`stub.py`) over REAL HTTP via uvicorn, standalone, as a
third Playwright webServer process (`apps/web/playwright.config.ts`, port 8200 by convention).

DEV/TEST-ONLY, never imported by `app/*`. Mirrors `backend/scripts/run_e2e_server.py`'s
plain-python invocation shape (sys.path insert so `app.*`/`tests.*` resolve without pytest's
pythonpath config).

Why `db_url` matters here: the e2e stack drives this process from a SEPARATE OS process than the
Playwright test runner, so `MPStub`'s in-memory registration API (`create_preapproval` /
`authorize_payment` / `fire_webhook`, exercised directly by `test_billing_terminus.py` under
pytest) is unreachable from a Playwright spec — there is no shared Python object across the
process boundary. `stub.py`'s module docstring documents the one piece of the stub that DOES work
cross-process for exactly this reason: `_fallback_authorized_payment`, DB-backed (queries the same
Postgres the app itself writes to), so a Playwright spec can drive the full checkout → webhook →
grant loop by (a) letting the app's own checkout call the stub's HTTP `POST /preapproval` (already
wired), and (b) firing a signed webhook for ANY payment id the fallback then resolves against the
sole pending/authorized subscription with no `billing_events` row yet. See `billing.spec.ts` /
`billing-helpers.ts` for the consuming side and the single-candidate ordering constraint that
implies.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# backend/tests/mp_stub/run_standalone.py -> parents[2] == backend/ (so `app.*`/`tests.*` resolve).
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn

from tests.mp_stub.stub import MPStub

MP_STUB_PORT = int(os.environ.get("MP_STUB_PORT", "8200"))


def main() -> None:
    db_url = os.environ.get("P3D_DATABASE_URL")
    stub = MPStub(db_url=db_url)
    uvicorn.run(stub.asgi_app, host="127.0.0.1", port=MP_STUB_PORT, log_level="warning")


if __name__ == "__main__":
    main()
