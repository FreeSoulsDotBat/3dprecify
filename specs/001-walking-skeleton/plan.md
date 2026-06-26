# Implementation Plan: Walking Skeleton — minimal authenticated price

**Branch**: `001-walking-skeleton` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-walking-skeleton/spec.md`

## Summary

Thin vertical slice proving the product's spine: a user signs in with Google, reaches a mobile-first
calculator, and gets a minimal 3D-print price (material cost + markup) computed by an offline-capable
TypeScript core. A FastAPI endpoint verifies the Firebase ID token server-side, establishing the
server-authoritative boundary that premium gating will later build on. Deployed to the web.

## Technical Context

**Language/Version**: TypeScript 5.x (web + shared pricing core) · Python 3.12 (backend)

**Primary Dependencies**: React 18 + Vite · `firebase` JS SDK (Auth, GoogleAuthProvider) · `vite-plugin-pwa`
(offline app shell) · FastAPI · `firebase-admin` (server-side ID token verification) · Vitest · pytest · Playwright

**Storage**: None in this slice (stateless calculator; no persistence). Postgres belongs to the broader
architecture and is intentionally deferred.

**Testing**: Vitest (pricing-core numeric unit tests) · pytest (token-verification on the protected endpoint) ·
Playwright via `qa-produto` (visual homologation of the rendered screen)

**Target Platform**: Web, mobile-first (≤ 414 px), desktop-compatible. Android/Play via Capacitor — later.

**Project Type**: Web application (frontend + backend) + shared TS package (monorepo)

**Performance Goals**: Price recompute < 50 ms on-device · sign-in → calculator < 30 s (SC-001)

**Constraints**: Offline-capable calculation (FR-008) · server-side auth verification (FR-003) · pt-BR copy
(FR-009) · lean artifacts (Constitution VI)

**Scale/Scope**: 1 screen · 4 inputs · 2 outputs · single authenticated session. Foundation for growth, not scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design. A failed gate BLOCKS the plan
until resolved or justified in Complexity Tracking with an approved ADR.*

- [x] **I. Scalability & Quality First** — monorepo isolates a reusable `packages/pricing-core`; web-first but
      structured so Capacitor (Android/iOS) and i18n attach without a rewrite.
- [x] **II. Truth Over Approval** — all dependencies are real and current; deploy-host and token-verification
      choices are resolved in `research.md` with rationale and confidence, not assumed.
- [x] **III. Test-First** — pricing-core has numeric Vitest cases (incl. the R$2.00/R$3.00 example and edge
      cases); pytest covers token verification; Playwright homologates the screen. Tests precede implementation.
- [x] **IV. Server-Side Boundary** — the protected endpoint verifies the Firebase ID token server-side; the
      client is not trusted. No premium gating yet, but this is the boundary it will reuse.
- [x] **V. Clean Architecture Integrity** — the pricing formula lives ONCE in `packages/pricing-core` (TS);
      the Python backend does NOT reimplement it (avoids duplication). Greenfield; no drift.
- [x] **VI. Lean Living Documentation** — spec/plan/artifacts kept minimal; no dead rules.
- [x] **VII. Spec-Driven Flow** — spec is the source of truth; `/speckit-clarify` skipped by design (thin slice,
      no ambiguity — progressive gates, D2); checklist passed; `/speckit-analyze` to run after `/speckit-tasks`.

**Result: PASS (0 violations).** Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-walking-skeleton/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (pricing-core + protected API)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root — monorepo)

```text
packages/
└── pricing-core/             # pure TypeScript, framework-free, offline; the CANONICAL formula
    ├── src/
    │   └── computePrice.ts
    └── tests/
        └── computePrice.test.ts   # Vitest numeric cases (incl. edge cases)

apps/
└── web/                      # React + Vite PWA (mobile-first, pt-BR copy)
    ├── src/
    │   ├── features/auth/        # Google sign-in, session, route guard
    │   ├── features/pricing/     # calculator screen (consumes pricing-core)
    │   └── lib/                  # firebase client init, BRL formatting
    ├── tests/                    # component/interaction tests + Playwright specs
    └── vite.config.ts            # vite-plugin-pwa

backend/
└── app/                      # FastAPI
    ├── main.py                   # app + routes (/health public, /api/v1/me protected)
    ├── auth.py                   # Firebase ID token verification (firebase-admin)
    └── tests/                    # pytest (valid/invalid/expired token)
```

**Structure Decision**: Monorepo with a framework-free `packages/pricing-core` (single source of truth for the
formula, runs offline on the client), `apps/web` (React+Vite PWA), and `backend` (FastAPI). This directly
serves Constitution I (shared core → web/Android/iOS) and V (no formula duplication across TS and Python).

## Complexity Tracking

> No Constitution violations — section intentionally empty.
