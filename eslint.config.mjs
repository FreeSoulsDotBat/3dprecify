// Flat ESLint config (ADR-0004). eslint-plugin-boundaries enforces the FSD-Lite import
// direction (materialized in 003): app → pages → widgets → features → entities → shared.
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
            // Generated API client (Orval, A8) — exempt. Hand-written modules in shared/api
            // (e.g. transport.ts) ARE linted; only the generated file is exempt.
            "apps/web/src/shared/api/generated.ts",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
    },
    // FSD-Lite boundaries (apps/web only). Canonical import direction:
    //   app → pages → widgets → features → entities → shared.
    // A layer may import only from layers STRICTLY below it; upward and
    // sideways-across-siblings (feature→other-feature, page→other-page, …) imports
    // are forbidden. Same-slice imports (within one folder) are auto-allowed, so
    // NOT listing a layer's own type below is what blocks its cross-sibling imports.
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
                    type: "pages",
                    pattern: "apps/web/src/pages/*",
                    mode: "folder",
                    capture: ["page"],
                },
                {
                    type: "widgets",
                    pattern: "apps/web/src/widgets/*",
                    mode: "folder",
                    capture: ["widget"],
                },
                {
                    type: "feature",
                    pattern: "apps/web/src/features/*",
                    mode: "folder",
                    capture: ["feature"],
                },
                {
                    type: "entities",
                    pattern: "apps/web/src/entities/*",
                    mode: "folder",
                    capture: ["entity"],
                },
                { type: "shared", pattern: "apps/web/src/shared", mode: "folder" },
            ],
        },
        rules: {
            "boundaries/dependencies": [
                "error",
                {
                    default: "disallow",
                    rules: [
                        {
                            from: { type: "app" },
                            allow: {
                                to: {
                                    type: [
                                        "app",
                                        "pages",
                                        "widgets",
                                        "feature",
                                        "entities",
                                        "shared",
                                    ],
                                },
                            },
                        },
                        {
                            from: { type: "pages" },
                            allow: { to: { type: ["widgets", "feature", "entities", "shared"] } },
                        },
                        {
                            from: { type: "widgets" },
                            allow: { to: { type: ["feature", "entities", "shared"] } },
                        },
                        {
                            from: { type: "feature" },
                            allow: { to: { type: ["entities", "shared"] } },
                        },
                        { from: { type: "entities" }, allow: { to: { type: ["shared"] } } },
                        { from: { type: "shared" }, allow: { to: { type: ["shared"] } } },
                    ],
                },
            ],
        },
    },
    // Ratchet de tamanho (chore de legibilidade 2026-08-31): a auditoria achou monolitos de até
    // 1873 linhas porque nada os freava. Após as duas rodadas de quebra, a maior fonte não-teste
    // tem 583 linhas (calculator-model, o atual detentor) — o teto 600 passa hoje e bloqueia o
    // próximo monolito. ABAIXE o teto conforme os restantes encolherem; nunca o suba sem decisão
    // registrada. Testes/specs ficam de fora (suítes longas são outra discussão).
    {
        files: ["apps/web/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
        ignores: ["**/*.test.*", "**/*.spec.*"],
        rules: {
            "max-lines": ["error", { max: 600, skipBlankLines: false, skipComments: false }],
        },
    },
    // Disable stylistic rules that conflict with Prettier (Prettier owns formatting).
    prettier,
);
