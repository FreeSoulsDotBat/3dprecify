import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US2 (T035) — the freemium auth boundary end to end. Calcular is public/offline; the
// saving tabs (Catálogo/Histórico/Conta) are guarded with return-to-intent. This drives
// the real guards against the Firebase Auth emulator via the app's emulator-only seam
// (window.__e2eAuth, see shared/lib/firebase.ts). Requires the emulator running — use
// `pnpm e2e` at the repo root (firebase emulators:exec wraps the Playwright run).

async function signUpThrowaway(page: Page, tag: string): Promise<void> {
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    async ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      await w.__e2eAuth.signUp(em, pw);
    },
    { em: email, pw: "test-passw0rd" },
  );
}

test("Calcular is reachable signed-out — the boundary does not gate the calculator", async ({
  page,
}) => {
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
  await expect(page).toHaveURL(/\/calcular$/); // no bounce to /sign-in
});

test("a guarded tab signed-out routes through sign-in and lands on the intended section", async ({
  page,
}, info) => {
  await page.goto("/calcular");

  // Select a guarded tab from the app-nav while signed out.
  await page.getByRole("link", { name: messages.nav.catalogo }).click();

  // GC-2: redirected to sign-in carrying the return-to-intent.
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fcatalogo/);
  await expect(page.getByRole("heading", { name: messages.signIn.title })).toBeVisible();

  // Sign in through the Auth emulator seam.
  await signUpThrowaway(page, `boundary-${info.workerIndex}`);

  // GC-3/GC-4: land on the originally requested section (Catálogo), not the calculator.
  await expect(page).toHaveURL(/\/catalogo$/);
  await expect(page.getByText(messages.catalogo.emptyTitle)).toBeVisible();
});

test("a signed-in user is bounced off /sign-in to the calculator by default", async ({
  page,
}, info) => {
  await page.goto("/sign-in");
  await signUpThrowaway(page, `already-${info.workerIndex}`);
  // GC-4: no redirect param → default landing is the public calculator.
  await expect(page).toHaveURL(/\/calcular$/);
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
});
