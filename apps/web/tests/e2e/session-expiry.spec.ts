import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, recordFromCalculator, signUpThrowaway } from "./history-helpers";

// 018 mestre-detalhe: a ≥1280px o primeiro registro abre sozinho ao lado da lista (SC-002), então
// o badge do card aparece duas vezes (o card `.tf-historico__link` da lista + a coluna
// `complementary` do detalhe). O badge da fila é a leitura da LISTA.
function ledgerCard(page: Page) {
    return page.locator(".tf-historico__link").first();
}

// hotfix 016/A3 (H4/H5, 2026-08-07) e2e — the achado A3 against the REAL stack: a 401 SIMULATED at
// the transport (T072's own method — "expiração REAL do refresh do Firebase não foi exercida"; the
// desenho's boundary is honest that this exercises the SAME trigger, a 401 from the server, not the
// real Firebase refresh failure). Proves the three things a unit test cannot alone:
//   · the outbox entry shows the SESSION message, never "conexão" (H4);
//   · the app-wide banner appears with a working way back (H5);
//   · NOTHING is purged and the seller is NEVER signed out (the non-negotiable property).

const t = messages.historico;
const ts = messages.session;

test("um 401 no /history: o outbox fala em sessão (nunca conexão), o banner oferece o caminho de volta, e nada é purgado", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `session-expiry-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/calcular");
    await page.reload();
    await expect(page.getByRole("button", { name: t.saveAction })).toBeVisible();

    // The server refuses a live client session — every /history POST 401s with a real
    // session-expiry code, exactly what `settleEntry` (H4) and `transport.ts` (H5) key off.
    await page.route("**/api/v1/history", (route) => {
        if (route.request().method() !== "POST") return route.continue();
        return route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
                error: {
                    code: "UNAUTHENTICATED",
                    message: "session expired",
                    correlationId: "e2e-401",
                },
            }),
        });
    });

    await recordFromCalculator(page);

    // (H4) The toast names the TRUE cause — never "conexão"/"online" (the achado A3 verbatim).
    const toast = page.getByText(t.syncUnauthenticatedToast);
    await expect(toast).toBeVisible();
    const toastText = (await toast.textContent()) ?? "";
    expect(toastText.toLowerCase()).not.toMatch(/conexão|online/);

    // (H5) The way back appears app-wide, right there on the calculator too.
    const banner = page.getByTestId("session-expiry-banner");
    await expect(banner).toBeVisible();
    const cta = banner.getByRole("link", { name: ts.expiredAction });
    await expect(cta).toHaveAttribute("href", /^\/sign-in\?redirect=/);

    // The seller is NOT signed out — the non-negotiable property, visible: still on an authenticated
    // screen, "Sair" still offered (never bounced to /sign-in automatically).
    await expect(page.getByRole("button", { name: messages.account.signOut })).toBeVisible();

    // Nothing was purged: the Histórico still shows the ONE queued entry, badged with the session
    // message — never "pendente", never "precisa de Premium".
    await page.goto("/historico");
    await expect(ledgerCard(page).getByText(t.syncUnauthenticatedBadge)).toBeVisible();
    await expect(page.getByText(t.syncPendingBadge)).toHaveCount(0);
    await expect(page.getByText(t.syncBlockedBadge)).toHaveCount(0);
    await expect(page.locator(".tf-historico__money strong").first()).toBeVisible();

    // The aggregate QUEUE banner (its own affordance, distinct from the app-wide session banner
    // that ALSO renders here — both offer a way back, and both is the correct, not a duplication
    // bug: `.tf-historico__banner` scopes to the queue's own copy).
    const queueBanner = page.locator(".tf-historico__banner");
    await expect(queueBanner).toContainText(t.queueUnauthenticated.replace("{n}", "1"));
    await expect(queueBanner.getByRole("link", { name: t.signInAction })).toBeVisible();

    // Still routed to 401 — a reload proves the entry SURVIVES (a 401 never removes it, H4's own
    // non-negotiable property, from the outside).
    await page.reload();
    await expect(ledgerCard(page).getByText(t.syncUnauthenticatedBadge)).toBeVisible();
});
