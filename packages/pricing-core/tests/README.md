# pricing-core tests

**Convention (A7):** all `pricing-core` tests live here as `tests/*.test.ts` — never `src/*.test.ts`.
Keep the `src/` tree production-only; the numeric success criteria (SC-001…SC-112) and the version /
determinism gates are colocated in this folder and run via `vitest run` (`pnpm test`).

Current files:

- `computeCalculator.test.ts` — the 004 cost model (SC-001…SC-012) migrated to the 3.0.0 shape +
  the single-channel gross-up + itemized `otherCosts`.
- `version.test.ts` — `PRICING_MODEL_VERSION` ↔ package.json major (ADR-0008 / ADR-0011).
- `determinism.test.ts` — purity, no mutation, version stamp (SC-109 / SC-110).
- `rounding.test.ts` — ADR-0008 money rounding.

The multi-channel band/floor cases (SC-101, SC-102, SC-107, SC-108, SC-110, SC-112) land test-first
in US1 as `channels.test.ts` + `band-floor.test.ts`.
