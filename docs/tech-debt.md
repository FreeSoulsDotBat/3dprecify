# Technical Debt & Deferred Decisions

## Governing rule (Jonatan, 2026-06-27)
Before deciding anything with a **real chance of changing later**, flag the **change-likelihood %**. Decide now
only if the choice is stable or cheap-to-reverse. Otherwise log it here as **explicit tech debt** with: the %,
the **trigger** that will force the decision, and the **cheap placeholder** used in the meantime. Conventional
choices with low change-risk (≤~20%) are taken inline and noted in the relevant ADR/doc, not here.

`change %` = estimated probability that, if we locked this **now**, we'd later change it (higher = better to defer).

## Register
| ID | Deferred decision | change % | Trigger (when to decide) | Placeholder used now |
|----|-------------------|----------|--------------------------|----------------------|
| TD-001 | i18n architecture (full i18n library) | 40% | Internationalization epic (post-launch) | Typed pt-BR messages module keyed by error `code`; no i18n lib in 001 |
| ~~TD-002~~ | ~~Visual design system / tokens / styling~~ | — | **Being addressed now (2026-06-27)**: co-authoring the Claude Design prompt with Jonatan's vision + UX decided here; final UI rendered by Claude Design | resolved-in-progress |
| ~~TD-003~~ | ~~Deploy target (SPA host + FastAPI host)~~ | — | **RESOLVED 2026-06-28**: backend=Cloud Run (ADC keyless), SPA=Firebase Hosting | resolved |
| TD-004 | DB physical schema / money repr / multi-tenancy / migrations | 70% | E2 spec (catalog/persistence) | None — 001 is stateless, no DB |
| TD-005 | Entitlement enforcement design (offline+TTL vs per-request) | 50% | E2 + its ADR | None — 001 has no premium surface |
| TD-006 | Payments (Play Billing vs Mercado Pago recurring) | 60% | E6 + ADR (regulatory flux) | None — no payment code before E6 |
| ~~TD-007~~ | ~~Monorepo task runner (Turbo)~~ | — | **RESOLVED 2026-06-28**: pnpm workspaces now → Turborepo at first CI/build pain (F1.3) | resolved |
| TD-008 | pricing-core packaging (ESM/CJS + d.ts) + cross-lang parity | 40% | A 2nd consumer needs the built pkg (server won't reimplement the formula per ADR) | Direct TS import within the monorepo |

Resolved debt moves to the relevant ADR/doc and is struck from this table.
