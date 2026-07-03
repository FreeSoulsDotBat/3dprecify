import { defineConfig } from "orval";

// Generates the TS client + TanStack Query hooks + ErrorCode union from the server-authoritative
// OpenAPI (A8). Output lands in src/shared/api (committed; exempt from ESLint/Prettier).
//
// A9/T067: the generated client no longer calls `fetch` directly — it routes through the
// custom mutator `apiFetch` in `transport.ts` (A20). That gives every generated call the
// fresh Firebase ID token, the typed `VITE_API_BASE_URL`, the typed `ApiError`
// (code + correlationId), and the Sentry tag hook — for free, uniformly.
export default defineConfig({
  precifica: {
    input: "../../contracts/openapi.json",
    output: {
      mode: "single",
      target: "src/shared/api/generated.ts",
      client: "react-query",
      httpClient: "fetch",
      // NOTE: `clean` is intentionally OFF. It wipes the whole output folder
      // (`src/shared/api`) before generating — which now also holds the hand-written
      // mutator `transport.ts`, `error-messages.ts`, and their tests. `single` mode
      // overwrites `generated.ts` in place, so no clean is needed.
      clean: false,
      prettier: false,
      override: {
        // `orvalFetch` (not `apiFetch`) is the mutator: Orval binds the generic to the FULL
        // response envelope and expects `{ data, status, headers }` back, which the ergonomic
        // body-returning `apiFetch` can't provide. Both live in `transport.ts` and share the
        // same A20 core (token + baseURL + ApiError + correlationId + Sentry). See transport.ts.
        mutator: {
          path: "src/shared/api/transport.ts",
          name: "orvalFetch",
        },
      },
    },
  },
});
