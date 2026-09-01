import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import {
    goOffline,
    goOnline,
    grantPremium,
    recordFromCalculator,
    signUpThrowaway,
} from "./history-helpers";

// 018 mestre-detalhe: a ≥1280px o primeiro registro abre sozinho ao lado da lista (SC-002), então
// o badge/valor do card aparece duas vezes (o card `.tf-historico__link` da lista + a coluna
// `complementary` do detalhe). O card da lista é a leitura que este arquivo prova (a fila nunca
// some); a ficha aberta é escopada à parte quando o teste lê o CONTEÚDO do registro.
function ledgerCard(page: Page) {
    return page.locator(".tf-historico__link").first();
}
function historicoDetail(page: Page) {
    return (page.viewportSize()?.width ?? 0) >= 1280 ? page.getByRole("complementary") : page;
}

// 009/T016 (E4, PR-A) e2e — the OFFLINE record, against the REAL stack. This is the one layer where
// IndexedDB, the TanStack `onlineManager`, Web Locks and the real query defaults run together — the
// layer where B1 lives and where the T016 homologation gave a false PASS. The claims a unit test
// cannot make honestly (the mock never touches the `onlineManager`):
//   · a record made OFFLINE appears in the Histórico as PENDING (B1 — the card must not vanish);
//   · it PERSISTS across a reload while still offline (IndexedDB durability);
//   · coming back online DRAINS it to `synced` (a real 2xx);
//   · reopening the detail renders the SAME frozen values, with no recomputation.

const t = messages.history;

test("a record made offline is pending, survives a reload, then drains to synced (B1/FR-527)", async ({
    page,
    context,
}, info) => {
    const email = await signUpThrowaway(page, `hist-offline-${info.workerIndex}`);
    grantPremium(email);

    // Reload so the entitlement query resolves `active` and the record button appears (premium-only).
    await page.goto("/calcular");
    await page.reload();
    await expect(page.getByText("R$ 16,16")).toBeVisible(); // the E1 seed computes a result
    await expect(page.getByRole("button", { name: t.saveAction })).toBeVisible();

    // Lose the network in a way that reaches the onlineManager (event, not just navigator.onLine).
    await goOffline(page, context);

    // Record while offline. The confirmation is the HONEST pending toast — never "salvo".
    await recordFromCalculator(page);
    await expect(page.getByText(t.syncPendingToast)).toBeVisible();
    await expect(page.getByText(t.saved)).toHaveCount(0);

    // The Histórico shows the PENDING card. Without the B1 fix the paused outbox query reports an
    // empty queue and this card VANISHES — the seller's own quote, invisible. This step is the probe.
    await page.goto("/historico");
    await expect(ledgerCard(page).getByText(t.syncPendingBadge)).toBeVisible();
    const money = page.locator(".tf-historico__money strong").first();
    await expect(money).toBeVisible();
    const quoted = (await money.textContent())?.trim() ?? "";
    expect(quoted).toMatch(/R\$/);

    // It PERSISTS across a reload while STILL offline — the durability the outbox exists for.
    await page.reload();
    await expect(ledgerCard(page).getByText(t.syncPendingBadge)).toBeVisible();
    await expect(page.locator(".tf-historico__money strong").first()).toHaveText(quoted);

    // Back online → the OutboxSyncer drains on the `online` event → the badge clears (a real 2xx).
    await goOnline(page, context);
    await expect(page.getByText(t.syncPendingBadge)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".tf-historico__money strong").first()).toHaveText(quoted);

    // Reopen the detail — the SAME frozen value, plus the two-shelf explainer and the device-clock
    // note. Nothing is recomputed: it is a document, not a live price.
    await page.locator(".tf-historico__link").first().click();
    const detalhe = historicoDetail(page);
    await expect(detalhe.getByText(t.quotedValue)).toBeVisible();
    await expect(page.locator(".tf-historico__money strong").first()).toHaveText(quoted);
    await expect(detalhe.getByText(t.frozenExplainer)).toBeVisible();
    await expect(detalhe.getByText(t.deviceClockNote)).toBeVisible();
});
