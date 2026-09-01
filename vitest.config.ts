import { defineConfig } from "vitest/config";

// Root Vitest config (V8 coverage). Runs every workspace project's unit tests so the gate
// enforces them. Two coverage regimes, by per-glob thresholds:
//   • packages/* — the pure-logic core (pricing-core) stays at a 100% ratchet.
//   • apps/web/src — a REALISTIC FLOOR (owner decision 2026-07-12, recorded in
//     docs/decisions/tech-stack-decisions.md, Round CG). This does NOT replace visual
//     homologation — it is an ADDITIONAL DoD step layered on top of it: apps/web is now
//     validated by BOTH the homologation walk AND this coverage floor. Floors sit below the
//     measured baseline (statements ~81 / branches ~77 / functions ~78 / lines ~82) to catch a
//     real coverage DROP without flaking on ordinary churn.
export default defineConfig({
    test: {
        projects: ["packages/*", "apps/web"],
        // 2026-08-31 — teto medido, não palpite: sob a suíte COMPLETA com cobertura nesta máquina,
        // testes de página pesados (premium-write-absence @ lapsed, calcular-scenario-*) que rodam
        // em 1–1,5s isolados passam de 5s por contenção (679 módulos; import ~400s no run medido).
        // O default de 5s virava um dado girado a cada push — o conjunto de vítimas trocava por
        // carga. 20s não mascara um hang real (o run inteiro leva ~85s) e mata o flake na causa.
        testTimeout: 20_000,
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary"],
            include: ["packages/*/src/**", "apps/web/src/**"],
            // Generated Orval client, type decls, build output and the tests themselves never count.
            // T-07 (013 audit remediation): the exclusion used to be the whole `shared/api/**` folder,
            // but only `generated.ts` is actually Orval-generated — `transport.ts`/`error-messages.ts`
            // are hand-written (transport wrapper + ErrorCode->pt-BR mapping) and were silently exempted
            // from the coverage floor despite already having their own `*.test.ts` files.
            exclude: [
                "**/dist/**",
                "**/*.d.ts",
                "**/*.test.*",
                "apps/web/src/shared/api/generated.ts",
                // 014: CLI entry points, not library logic — they wire fs/network around code that IS
                // covered. The fail-safe they used to inline now lives in `guardrails.ts` precisely so it
                // is testable instead of exempt (FR-018a).
                "packages/*/src/**/*.mjs",
                // 014/T083: fixture DATA (a frozen document from before ADR-0024) plus the note that
                // records where it came from. Not code — v8 tried to parse the .md and warned on every run.
                "**/__fixtures__/**",
            ],
            thresholds: {
                "packages/*/src/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
                "apps/web/src/**": { statements: 77, branches: 73, functions: 74, lines: 78 },
            },
        },
    },
});
