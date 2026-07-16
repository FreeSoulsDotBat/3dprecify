import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, type BrowserContext, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";

// 009/T016 (E4, PR-A) e2e helpers — shared by the two Histórico specs. The offline helpers are the
// load-bearing part: the T016 visual homologation gave a FALSE PASS because its emulation only set
// `navigator.onLine`, which the TanStack `onlineManager` does NOT observe. A real device losing
// signal fires the window `offline` EVENT — so these helpers do BOTH (belt and suspenders), which is
// what actually reaches the `onlineManager` and exercises B1.

const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
const t = messages;

export async function signUpThrowaway(page: Page, tag: string): Promise<string> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      void w.__e2eAuth.signUp(em, pw); // fire-and-forget (redirect destroys the eval context)
    },
    { em: email, pw: "test-passw0rd" },
  );
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  return email;
}

/** Grant premium through the REAL operator path (the CLI writing the ledger — ADR-0012). */
export function grantPremium(email: string): void {
  execSync(`uv run python -m app.scripts.grant_premium grant ${email} --source beta --by e2e`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

/** Revoke it through the same ledger CLI — used to force a 403-at-sync (a `blocked` entry). */
export function revokePremium(email: string): void {
  execSync(`uv run python -m app.scripts.grant_premium revoke ${email} --by e2e`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

/** Go offline in a way that reaches the `onlineManager` — the CDP flag AND the window event. */
export async function goOffline(page: Page, context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

/** Come back online the same way — both the CDP flag and the window event. */
export async function goOnline(page: Page, context: BrowserContext): Promise<void> {
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

/** Open the record Sheet from the calculator and confirm — retail is pre-selected. */
export async function recordFromCalculator(page: Page): Promise<void> {
  await page.getByRole("button", { name: t.historico.saveAction }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(t.historico.saveSheetIntro)).toBeVisible();
  await sheet.getByRole("button", { name: t.historico.saveSheetSubmit }).click();
}
