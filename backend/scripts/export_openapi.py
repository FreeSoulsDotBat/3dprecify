"""Dump the FastAPI OpenAPI spec to ``contracts/openapi.json`` (the server-authoritative contract).

Committed and consumed by Orval (A8). CI regenerates this + the TS client and fails on drift (SC-6).
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import create_app


def main() -> None:
    app = create_app()
    out = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
