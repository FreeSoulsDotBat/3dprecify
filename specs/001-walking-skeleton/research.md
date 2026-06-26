# Phase 0 Research — Walking Skeleton

Each item: Decision · Rationale · Alternatives · Confidence.

## R1. Server-side Firebase ID token verification (FastAPI)
- **Decision**: Use the official `firebase-admin` Python SDK — `auth.verify_id_token(token)` — initialized with
  a service-account credential. Reject on missing/invalid/expired token (401).
- **Rationale**: Official, verifies signature + expiry + audience/issuer against Google's keys; least code; the
  authoritative server-side boundary required by FR-003 / Principle IV.
- **Alternatives**: Manual JWKS fetch + `python-jose`/`pyjwt` (more moving parts, easy to get audience/issuer
  checks wrong); a reverse-proxy/auth gateway (overkill for this slice).
- **Confidence**: 90% (stable, documented API).

## R2. Google sign-in on web
- **Decision**: Firebase Auth Web SDK with `GoogleAuthProvider` via `signInWithPopup` (fallback
  `signInWithRedirect`). Treat Google One Tap as a later enhancement.
- **Rationale**: Simplest reliable path that yields a Firebase ID token for the backend; One Tap adds friction-
  reduction but not new capability for the skeleton.
- **Alternatives**: Google Identity Services One Tap wired to Firebase `signInWithCredential` (better UX, more
  setup) — deferred. Raw OAuth (reinvents Firebase).
- **Confidence**: 88%.

## R3. Offline-capable app (PWA)
- **Decision**: `vite-plugin-pwa` (Workbox) for a service worker + web app manifest caching the app shell. The
  pricing core is framework-free TypeScript, so the calculation itself runs with no network regardless.
- **Rationale**: Satisfies FR-008 with minimal config; standard Vite integration; sets up installability for the
  later Capacitor wrap.
- **Alternatives**: Hand-written service worker (more error-prone); no SW + rely only on in-memory JS (fails to
  load the app shell offline after first visit).
- **Confidence**: 85%.

## R4. Where the pricing formula lives
- **Decision**: Single canonical implementation in `packages/pricing-core` (pure TS). The FastAPI backend does
  NOT recompute price in this slice.
- **Rationale**: Offline requires client-side calc; duplicating the formula in Python would violate Principle V
  (single source of truth). Server recomputation, if ever needed for anti-fraud, is a later, explicit decision.
- **Alternatives**: Compute on server (breaks offline); compute in both (duplication/divergence).
- **Confidence**: 90%.

## R5. Deployment hosts (free-tier-friendly, web-first)
- **Decision (provisional for the skeleton)**: SPA on **Cloudflare Pages**; FastAPI on **Render** (free web
  service) or **Fly.io**. Final pick confirmed at deploy time.
- **Rationale**: Both have usable free tiers, simple Git/Docker deploys, and HTTPS (needed for Firebase Auth and
  PWA). Docker is already installed locally for parity.
- **Alternatives**: Vercel/Netlify (SPA); Railway/Cloud Run (API). All viable; difference is marginal for a skeleton.
- **Confidence**: 65% (free-tier terms change; revisit at deploy — flagged, not hidden, per Principle II).

## Open risks carried forward (not blocking this slice)
- Google Play Billing × Mercado Pago recurring (ADR before any payment code).
- Offline × server-side entitlements (entitlement token with TTL) — relevant when premium arrives, not now.
