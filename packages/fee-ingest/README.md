# @3dprecify/fee-ingest

The deterministic fee-catalog ingestion (014). Runs in CI only — never in the app, never in the backend.

**Why it is a workspace package and not a loose script (D1, owner-decided 2026-07-28):** it produces
**money leaves** and must satisfy the *same* schema the client validates against. Outside the workspace it
would duplicate that validation in a second place and sit outside `pnpm gate:all` — and the tool nobody
watches is precisely the one that most needs a gate.

**Boundary:** this package MUST NOT import from `apps/web` or `backend`. It shares the contract, not the app.

**Zero LLM tokens** (SC-811): parsing is deterministic. If an AI-assisted step is ever added here, it owes a
row in `docs/token-ledger.md`.
