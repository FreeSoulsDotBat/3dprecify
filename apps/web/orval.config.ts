import { defineConfig } from "orval";

// Generates the TS client + TanStack Query hooks + ErrorCode union from the server-authoritative
// OpenAPI (A8). Output lands in src/shared/api (committed; exempt from ESLint/Prettier).
// TODO(A9): custom fetch mutator (inject token + base URL; extract correlationId -> ApiError + Sentry)
// once real endpoints exist.
export default defineConfig({
  precifica: {
    input: "../../contracts/openapi.json",
    output: {
      mode: "single",
      target: "src/shared/api/generated.ts",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      prettier: false,
    },
  },
});
