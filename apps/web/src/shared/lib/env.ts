import { z } from "zod";

// Zod-validated client env (FR-C5.1). Firebase fields are optional so the skeleton runs without
// credentials (auth status = "not-configured"); when present, the auth store goes live.
const schema = z.object({
    VITE_FIREBASE_API_KEY: z.string().optional(),
    VITE_FIREBASE_AUTH_DOMAIN: z.string().optional(),
    VITE_FIREBASE_PROJECT_ID: z.string().optional(),
    VITE_FIREBASE_APP_ID: z.string().optional(),
    VITE_USE_AUTH_EMULATOR: z.enum(["true", "false"]).default("false"),
    VITE_AUTH_EMULATOR_URL: z.string().default("http://localhost:9099"),
    // Transport baseURL (A20). Default targets the local uvicorn backend. Prod/staging
    // inject their Cloud Run origin at build time (Hosting→Cloud Run is cross-origin, so
    // this MUST be absolute). Chosen over an empty-string same-origin default on purpose:
    // when the backend is absent (dev without `uv run`, or the e2e harness) an explicit
    // host yields a clean connection failure → the transport's typed ApiError → the Conta
    // page's handled identity error state; a same-origin relative "/api/v1/me" would instead
    // hit the SPA fallback and mask the failure with a 200 HTML page.
    VITE_API_BASE_URL: z.string().default("http://localhost:8000"),
    // FE observability DSN (decision D2 / R2-G3). Optional: when absent (dev, e2e, unit
    // tests) Sentry init is a silent no-op; prod/staging inject it as a GitHub Environment
    // secret → build-time var (A22). Never gates anything — it only routes errors/breadcrumbs.
    VITE_SENTRY_DSN: z.string().optional(),
    // Release identifier for Sentry (optional). When the CI injects it at build time, errors are
    // grouped by release; absent (dev/e2e/tests) Sentry simply omits it. Only routes errors.
    VITE_RELEASE: z.string().optional(),
});

export const env = schema.parse(import.meta.env);

export const isFirebaseConfigured = Boolean(
    env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID,
);
