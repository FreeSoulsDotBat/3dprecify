# Contracts — 011-token-optimization

**Consciously empty.** 011 is a development-infrastructure increment: it exposes no API endpoint, CLI surface,
UI, or wire format to users or other systems. Its binding "contracts" are:

- **ADR-0022** (`docs/adr/0022-token-cost-engineering-dev-workflow.md`) — the routing table, filter policy,
  refresh mechanism, and rollback playbook as standing standards (Principle VIII).
- **The evidence procedures** in [quickstart.md](../quickstart.md) — raw-vs-filtered gate proof, tee recovery,
  hook survival, exercised rollbacks (FR-004/FR-006/SC-002/SC-008).
- **The sacred boundary**: `pnpm gate:all` byte-identical in lefthook and CI (FR-011/SC-009) — the one
  interface 011 touches by explicitly not touching it.

No OpenAPI/Orval artifacts are generated or affected; the contract drift-guard has nothing to observe here.
