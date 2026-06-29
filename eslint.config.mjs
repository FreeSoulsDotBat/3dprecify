// Flat ESLint config (ADR-0004). eslint-plugin-boundaries + dependency-cruiser rules land in Phase 5,
// once the apps/web FSD-Lite folders exist (configuring layer rules against missing folders is premature).
import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.venv/**",
      // Backend is Python (Ruff/basedpyright own it); ESLint must not scan its venv vendored JS.
      "backend/**",
      "**/*.min.js",
      // Generated API client (Orval, A8) — exempt.
      "apps/web/src/shared/api/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  // FSD-Lite boundaries (apps/web only): app → feature/shared; feature → shared + own feature;
  // shared → shared. Cross-feature and upward imports are forbidden.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "apps/web/tsconfig.json" },
      },
      "boundaries/include": ["apps/web/src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "apps/web/src/main.tsx", mode: "file" },
        { type: "app", pattern: "apps/web/src/app", mode: "folder" },
        {
          type: "feature",
          pattern: "apps/web/src/features/*",
          mode: "folder",
          capture: ["feature"],
        },
        { type: "shared", pattern: "apps/web/src/shared", mode: "folder" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          // Same-element imports (within one feature folder) are allowed automatically, so with
          // default:disallow this also blocks cross-feature (feature→other-feature) imports.
          rules: [
            { from: { type: "app" }, allow: { to: { type: ["app", "feature", "shared"] } } },
            { from: { type: "feature" }, allow: { to: { type: "shared" } } },
            { from: { type: "shared" }, allow: { to: { type: "shared" } } },
          ],
        },
      ],
    },
  },
  // Disable stylistic rules that conflict with Prettier (Prettier owns formatting).
  prettier,
);
