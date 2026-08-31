import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Token-parity guard (ADR-0007 follow-up, task T010).
 *
 * The app's semantic color-token graph is adopted verbatim from the homologated
 * Design System (Claude Design `design-import-v3/tokens-colors.css`). This test
 * freezes that graph so DS↔app drift (a renamed / removed / unsanctioned token)
 * fails CI, and it asserts the two sanctioned additions this slice introduces —
 * the semantic status-text tokens `--danger-text` / `--success-text` /
 * `--info-text` (T004) — exist in BOTH themes.
 *
 * `EXPECTED_COLOR_TOKENS` = the homologated DS color graph (84 custom props)
 * + the 3 status-text tokens = 87, **+ `--warning-text` (019/T015/T020) = 88** — a
 * REVISED baseline, not a number that auto-adjusts: `--warning-text` is the 4th tone
 * (the app had neutral/info/success/danger and none for "the number is valid, and you
 * probably don't want it"). It is the in-repo parity baseline (the DS reference itself
 * lives outside the repo, so it cannot be read at test time).
 */

const colorsCssPath = fileURLToPath(new URL("./tokens/colors.css", import.meta.url));

const EXPECTED_COLOR_TOKENS: readonly string[] = [
    "--accent",
    "--accent-active",
    "--accent-contrast",
    "--accent-hover",
    "--accent-soft",
    "--accent-text",
    "--bg-base",
    "--bg-inverse",
    "--bg-muted",
    "--bg-subtle",
    "--border-accent",
    "--border-default",
    "--border-strong",
    "--border-subtle",
    "--danger",
    "--danger-deep",
    "--danger-soft",
    "--danger-text",
    "--energy",
    "--energy-active",
    "--energy-contrast",
    "--energy-hover",
    "--focus-ring",
    "--info",
    "--info-deep",
    "--info-text",
    "--selection-bg",
    "--selection-fg",
    "--success",
    "--success-deep",
    "--success-soft",
    "--success-text",
    "--surface-card",
    "--surface-inverse",
    "--surface-overlay",
    "--surface-raised",
    "--surface-sunken",
    "--text-body",
    "--text-faint",
    "--text-link",
    "--text-muted",
    "--text-on-accent",
    "--text-on-energy",
    "--text-on-inverse",
    "--text-strong",
    "--tf-amber-deep",
    "--tf-black",
    "--tf-cyan",
    "--tf-cyan-active",
    "--tf-cyan-hover",
    "--tf-cyan-soft",
    "--tf-danger",
    "--tf-danger-deep",
    "--tf-danger-soft",
    "--tf-info",
    "--tf-info-soft",
    "--tf-neutral-0",
    "--tf-neutral-100",
    "--tf-neutral-150",
    "--tf-neutral-200",
    "--tf-neutral-300",
    "--tf-neutral-400",
    "--tf-neutral-50",
    "--tf-neutral-500",
    "--tf-neutral-600",
    "--tf-neutral-700",
    "--tf-neutral-800",
    "--tf-neutral-900",
    "--tf-neutral-950",
    "--tf-orange",
    "--tf-orange-active",
    "--tf-orange-hover",
    "--tf-orange-soft",
    "--tf-purple",
    "--tf-purple-active",
    "--tf-purple-deep",
    "--tf-purple-hover",
    "--tf-purple-soft",
    "--tf-purple-soft-2",
    "--tf-success",
    "--tf-success-deep",
    "--tf-success-soft",
    "--tf-teal-deep",
    "--tf-warning",
    "--tf-warning-soft",
    "--tf-white",
    "--warning",
    "--warning-text",
];

function block(css: string, selector: string): string {
    const at = css.indexOf(selector);
    if (at < 0) throw new Error(`selector not found: ${selector}`);
    const start = css.indexOf("{", at);
    let depth = 0;
    let end = start;
    for (; end < css.length; end++) {
        if (css[end] === "{") depth++;
        else if (css[end] === "}") {
            depth--;
            if (depth === 0) break;
        }
    }
    return css.slice(start + 1, end);
}

function definedTokens(cssBlock: string): string[] {
    return [...cssBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

describe("design-system color token parity (T010 / ADR-0007)", () => {
    const css = readFileSync(colorsCssPath, "utf8");
    const rootTokens = new Set(definedTokens(block(css, ":root")));
    const darkTokens = new Set(definedTokens(block(css, '[data-theme="dark"]')));
    const union = [...new Set([...rootTokens, ...darkTokens])].sort();

    it("matches the homologated DS color graph (no drift, no unsanctioned tokens)", () => {
        expect(union).toEqual([...EXPECTED_COLOR_TOKENS].sort());
    });

    it.each(["--danger-text", "--success-text", "--info-text", "--warning-text"])(
        "defines the semantic status-text token %s in BOTH themes",
        (token) => {
            expect(rootTokens.has(token)).toBe(true);
            expect(darkTokens.has(token)).toBe(true);
        },
    );
});
