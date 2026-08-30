"""E2E/dev backend runner (E2 T025) — uvicorn on the Windows-safe event loop.

psycopg's async driver cannot run on Windows' ProactorEventLoop. This matters here because
uvicorn >= 0.36 hardcodes a ProactorEventLoop *factory* on Windows single-process and passes
it straight to ``asyncio.Runner(loop_factory=...)`` — which BYPASSES the event-loop policy, so
setting ``WindowsSelectorEventLoopPolicy`` has no effect on the loop uvicorn actually serves on.
To force psycopg onto a compatible loop we skip ``Server.run()`` (the code that injects the
Proactor factory) and drive ``server.serve()`` on an explicit ``SelectorEventLoop``. Linux/CI
keep uvicorn's default path. Configuration comes from the P3D_* env exactly like production —
the Playwright webServer sets P3D_DATABASE_URL (dedicated e2e database) and
P3D_FIREBASE_AUTH_EMULATOR_HOST (token verify against the same Auth emulator the SPA uses).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import uvicorn

# Plain-python invocation: put the backend root on sys.path so `app.*` resolves (pytest gets
# this via pythonpath config; a script does not).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    config = uvicorn.Config("app.main:app", host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)

    if sys.platform == "win32":  # pragma: no cover - platform-specific
        # Serve on an explicit SelectorEventLoop so psycopg's async driver works (see module
        # docstring — the event-loop policy alone cannot override uvicorn's loop factory).
        loop = asyncio.SelectorEventLoop()
        try:
            loop.run_until_complete(server.serve())
        finally:
            loop.close()
    else:
        server.run()


if __name__ == "__main__":
    main()
