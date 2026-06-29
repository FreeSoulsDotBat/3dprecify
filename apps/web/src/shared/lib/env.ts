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
  VITE_API_BASE_URL: z.string().default("http://localhost:8000"),
});

export const env = schema.parse(import.meta.env);

export const isFirebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID,
);
