import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import {
  goOffline,
  goOnline,
  grantPremium,
  recordFromCalculator,
  revokePremium,
  signUpThrowaway,
} from "./history-helpers";

// 009/T016 (E4, PR-A) e2e — the queue at the two moments it can be LOST: a 403-at-sync (B2, a dead
// end without [Tentar novamente]/[Descartar]) and a sign-out with a non-empty queue (B3/Surface 5,
// a silent purge without the guard). Both against the real stack, both about the outbox being the
// ONLY copy of a quote.

const t = messages.historico;

// 018 mestre-detalhe: a ≥1280px o primeiro registro abre sozinho ao lado da lista (SC-002), então
// o badge do card aparece duas vezes (o card `.tf-historico__link` da lista + a coluna
// `complementary` do detalhe). A fila é a leitura da LISTA.
function ledgerCard(page: Page) {
  return page.locator(".tf-historico__link").first();
}

test("a blocked entry offers Tentar novamente / Descartar, and discard removes it (B2/ADR-0018 §9)", async ({
  page,
  context,
}, info) => {
  const email = await signUpThrowaway(page, `hist-blocked-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByRole("button", { name: t.saveAction })).toBeVisible();

  // Record offline → pending. Then the premium lapses BEFORE the queue drains.
  await goOffline(page, context);
  await recordFromCalculator(page);
  await expect(page.getByText(t.syncPendingToast)).toBeVisible();
  revokePremium(email);

  // Back online → the drain POSTs → the server denies it with 403 → the entry is BLOCKED, retained
  // and visible (never silently dropped). A lapse leaves the ledger readable (FR-517).
  await goOnline(page, context);
  await page.goto("/historico");
  const card = ledgerCard(page);
  await expect(card.getByText(t.syncBlockedBadge)).toBeVisible({ timeout: 15_000 });

  // The dead end is gone: the entry offers a way out right on the card. 018 mestre-detalhe: a
  // ≥1280px a ficha aberta ao lado repete o mesmo `EntryActions` — escopado ao card da lista para
  // não colidir com o par da coluna de detalhe.
  await expect(card.getByRole("button", { name: t.retryAgain })).toBeVisible();
  await expect(card.getByRole("button", { name: t.discard })).toBeVisible();

  // Discard is destructive and confirmed. After confirming, the entry is gone.
  await card.getByRole("button", { name: t.discard }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText(t.discardConfirmBody)).toBeVisible();
  await confirm.getByRole("button", { name: t.discard }).click();

  await expect(page.getByText(t.syncBlockedBadge)).toHaveCount(0);
});

test("signing out with a non-empty queue is guarded — never a silent purge (B3/Surface 5)", async ({
  page,
  context,
}, info) => {
  const email = await signUpThrowaway(page, `hist-signout-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByRole("button", { name: t.saveAction })).toBeVisible();

  // A pending record on the device.
  await goOffline(page, context);
  await recordFromCalculator(page);
  await expect(page.getByText(t.syncPendingToast)).toBeVisible();

  // Sign out → the guard BLOCKS with the count; it never purges silently (ADR-0018 §10).
  await page.getByRole("button", { name: messages.account.signOut }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/1 registro/)).toBeVisible();
  // Offline, "Sincronizar agora" is disabled with its reason — never a button that pretends.
  await expect(dialog.getByRole("button", { name: t.signOutSyncNow })).toBeDisabled();
  await expect(dialog.getByText(t.signOutSyncOffline)).toBeVisible();

  // The seller explicitly chooses to discard — a second, explicit confirm before it happens.
  await dialog.getByRole("button", { name: t.signOutDiscard }).click();
  await expect(page.getByText(t.signOutDiscardConfirmBody)).toBeVisible();
  await page.getByRole("button", { name: t.signOutDiscardConfirm }).click();

  // Signed out. The app keeps the seller on the (public) calculator as ANONYMOUS — the soft paywall
  // (ADR-0015), NOT a forced /sign-in redirect (the calculator is usable signed-out). So the premium
  // "Salvar" affordance is gone, replaced by the honest UNIFIED teaser (016/US1). Discard +
  // sign-out completed; the queue was explicitly purged, never leaked into the next session.
  await expect(page.getByText(messages.premiumTeaser.CATALOG_PICKER.title)).toBeVisible();
  await expect(page.getByRole("button", { name: t.saveAction })).toHaveCount(0);
});
