import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_BACKEND_URL } from "../../playwright.config";
import { captureEntitlementBearerToken, fireStubWebhook } from "./billing-helpers";
import { signUpThrowaway } from "./history-helpers";

// E6/T016 — the billing turnstile against the REAL stack + the local MP stub
// (backend/tests/mp_stub, served standalone on :8200, `run_standalone.py`). Quickstart steps 1-5.
//
// Ordering note: SC-701 ("the flip") and SC-703 ("exactly-once") lean on the stub's
// `_fallback_authorized_payment` (stub.py docstring) — a DB query for the SOLE pending/authorized
// subscription with no `billing_events` row yet, because the standalone stub runs in a SEPARATE
// OS process from this Playwright run and has no shared Python object to register a payment
// through (see `run_standalone.py`'s docstring). That query is GLOBAL, not uid-scoped, so exactly
// one such candidate must exist at the moment each of those two tests fires its webhook — hence
// `serial` mode AND running them before the abandonment test (US2), which deliberately leaves a
// permanently-pending, billing_events-less subscription behind.
//
// Chromium-only, the WHOLE FILE (not just the fallback-dependent tests): Playwright runs the
// "chromium" and "mobile" projects as separate, genuinely PARALLEL workers by default (measured —
// `playwright test billing.spec.ts` with no --project picked 2 concurrent workers). Every OTHER
// test in this file that reaches checkout also writes a `pending` subscription into the SAME e2e
// database, so even the tests that don't themselves NEED the fallback (US2's abandonment, for
// one) can pollute the global candidate pool for a concurrently-running SC-701/SC-703 test on the
// other project — observed once as a false "ignored" instead of "ok". Simplest correct fix: this
// file only ever runs its checkout-touching flows on one project. Mobile-viewport regression for
// Conta is covered separately (a11y-overflow.spec.ts's guarded-surfaces case).

const t = messages.billing;
const tc = messages.conta;
const tn = messages.nav;

test.describe("E6 billing turnstile (MP stub)", () => {
  test.describe.configure({ mode: "serial" });

  // Playwright requires the literal `{}` fixtures destructure as the first param even when no
  // fixture is used; only `testInfo` is needed here.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "billing.spec.ts is chromium-only — see the file header (cross-project concurrent checkouts share one e2e database)",
    );
  });

  // ── US1 — offer honesty ──────────────────────────────────────────────────────────────────

  test("signed-out: a guarded /conta routes through sign-in (the CTA's only reachable door today)", async ({
    page,
  }) => {
    // BillingCta itself is only reachable once already inside Conta (the four teasers don't
    // consume it yet — T031/T032, still open). The signed-out boundary is enforced one layer up,
    // by the /conta route guard itself (also covered generically by auth-boundary.spec.ts); this
    // assertion documents that the CTA is never reachable signed-out, honestly, rather than
    // fabricating a UI path that doesn't exist yet. Unit coverage of the CTA's OWN signed-out
    // branch (routes to /sign-in without calling checkout) lives in offer-panel.test.tsx.
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fconta/);
    await expect(page.getByRole("heading", { name: messages.signIn.title })).toBeVisible();
  });

  test("signed-in free seller: the offer shows exact honest prices, no de/por, annual pre-highlighted", async ({
    page,
  }, info) => {
    await signUpThrowaway(page, `offer-${info.workerIndex}`);
    await page.goto("/conta");

    await page.getByRole("button", { name: t.subscribeAction }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(t.offerFreeLead)).toBeVisible();

    // Exact prices — the one product constant, byte-for-byte.
    await expect(dialog.getByText(t.planMonthlyPrice, { exact: true })).toBeVisible(); // R$ 15,99/mês
    await expect(dialog.getByText(t.planAnnualPrice, { exact: true })).toBeVisible(); // R$ 155,88/ano
    await expect(dialog.getByText(t.planAnnualEquiv, { exact: true })).toBeVisible(); // equiv. 12,99/mês

    // No de/por anchor, ever (§0.2).
    await expect(dialog.getByText(/191,88/)).toHaveCount(0);
    await expect(dialog.locator("s, del")).toHaveCount(0);

    // Annual pre-highlighted "recomendado"; monthly is one tap away.
    await expect(dialog.getByText(t.planAnnualBadge)).toBeVisible();
    await expect(dialog.locator('input[value="annual"]')).toBeChecked();
    await expect(dialog.locator('input[value="monthly"]')).not.toBeChecked();
    await dialog.locator('input[value="monthly"]').click();
    await expect(dialog.locator('input[value="monthly"]')).toBeChecked();

    // Hand-off honesty notices.
    await expect(dialog.getByText(t.handoffNotice)).toBeVisible();
    await expect(dialog.getByText(t.cardNeverTouches)).toBeVisible();
  });

  // ── US3/SC-701 — the flip ────────────────────────────────────────────────────────────────

  test("US3/SC-701: a confirmed stub payment grants entitlement server-side, no re-login needed", async ({
    page,
    request,
  }) => {
    await signUpThrowaway(page, "flip");
    await page.goto("/conta");

    // Reach checkout: intercept the external hand-off (the stub's init_point is a fake domain,
    // never resolvable by real DNS) so the app's window.location.assign lands somewhere real.
    await page.route("https://stub.mercadopago.local/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP stub</html>" }),
    );

    await page.getByRole("button", { name: t.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: t.subscribeAction }).click();
    await page.waitForURL(/stub\.mercadopago\.local/);

    // The stub "confirms" the payment: a real signed webhook straight at the backend (SEC-101..
    // 107 verified, then resolved by the stub's cross-process DB fallback — see file header).
    const res = await fireStubWebhook(request, { paymentId: "e2e-flip-payment" });
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("ok");

    // Land back in the app WITHOUT the `checkout=retorno` marker — see the dedicated, currently
    // FAILING test below for why: this is a deliberate workaround for a found app defect, not the
    // real `back_url` shape (a real MP return DOES carry that query string).
    await page.goto("/conta");
    await expect(page.getByText(tc.planPremium)).toBeVisible();

    // Spot-check: a premium surface unlocks WITHOUT re-login (same session, no new sign-in).
    await page.getByRole("link", { name: tn.catalogo }).click();
    await expect(page.getByRole("tab", { name: messages.catalogo.tabFilaments })).toBeVisible();
  });

  // KNOWN APP DEFECT (found by this task, reported — NOT fixed here, app source is off-limits).
  // Repro: sign in, then a HARD navigation (`page.goto`, matching a real MP browser redirect-back)
  // to ANY guarded route — even plain `/conta`, no query needed — transiently renders
  // unauthenticated and bounces through `/sign-in?redirect=%2Fconta` before the real session
  // resolves and redirects back. `router.tsx`'s `safeRedirect` only remembers the PATHNAME from
  // that bounce, never the full search — so a bounce off `/conta?checkout=retorno` lands back on
  // plain `/conta`, silently skipping `CheckoutReturnPanel` (the honest "confirming with Mercado
  // Pago…" → success surface, US2/US3's whole point) in favour of the ordinary plan row. Every
  // OTHER e2e test that hard-navigates to a guarded route tolerates this because it only asserts
  // on content that is IDENTICAL before/after the bounce (a heading, a button) — this is the first
  // one asserting on a query-carrying URL, which is why nothing caught it earlier.
  // Suspected root cause: `session-store.ts`'s `onIdTokenChanged` listener flips `status` to
  // "anonymous" on an initial `null` callback that fires before Firebase Auth finishes restoring
  // the persisted session (observed reproducibly against the Auth emulator); `main.tsx`'s
  // loading-gate only covers the state BEFORE that first callback, not a possibly-transient one.
  // Proposed minimal fix (dev-frontend): gate on `auth.authStateReady()` (firebase ^10+) instead
  // of / in addition to the first `onIdTokenChanged` callback, so `status` never leaves "loading"
  // until persistence has genuinely settled — OR have `safeRedirect`/`RETURN_TO_INTENT` carry the
  // full `pathname + search`, not just `pathname`, so even a legitimate bounce loses nothing.
  test("US3/SC-701 (return-surface UI): back from checkout shows the honest confirming state, then success", async ({
    page,
    request,
  }) => {
    test.fail(
      true,
      "app defect — see comment above; /conta?checkout=retorno loses its query on a cold reload",
    );

    await signUpThrowaway(page, "flip-ui");
    await page.goto("/conta");
    await page.route("https://stub.mercadopago.local/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP stub</html>" }),
    );
    await page.getByRole("button", { name: t.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: t.subscribeAction }).click();
    await page.waitForURL(/stub\.mercadopago\.local/);

    const res = await fireStubWebhook(request, { paymentId: "e2e-flip-ui-payment" });
    expect((await res.json()).status).toBe("ok");

    // Return from the hand-off (MP's back_url — a 1-segment route, meant to be reachable cold).
    await page.goto("/conta?checkout=retorno");
    await expect(page.getByRole("heading", { name: t.returnSuccessTitle })).toBeVisible({
      timeout: 20_000,
    });
  });

  // ── SC-703 — exactly-once ────────────────────────────────────────────────────────────────

  test("SC-703: the same signed webhook fired 3x still results in exactly ONE grant", async ({
    page,
    request,
  }) => {
    await signUpThrowaway(page, "once");
    const tokenPromise = captureEntitlementBearerToken(page);
    await page.goto("/conta");
    const bearer = await tokenPromise;

    await page.route("https://stub.mercadopago.local/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP stub</html>" }),
    );
    await page.getByRole("button", { name: t.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: t.subscribeAction }).click();
    await page.waitForURL(/stub\.mercadopago\.local/);

    const paymentId = "e2e-once-payment";
    const first = await fireStubWebhook(request, { paymentId });
    const second = await fireStubWebhook(request, { paymentId });
    const third = await fireStubWebhook(request, { paymentId });

    expect(first.status()).toBe(200);
    expect((await first.json()).status).toBe("ok"); // the ONE call that actually granted
    // Idempotent: neither replay grants a second time (webhook route acks 200 either way, SEC-105).
    expect(second.status()).toBe(200);
    expect((await second.json()).status).not.toBe("ok");
    expect(third.status()).toBe(200);
    expect((await third.json()).status).not.toBe("ok");

    // Server-side confirmation via the API directly (not just the UI's word for it).
    const entitlementRes = await request.get(`${E2E_BACKEND_URL}/api/v1/entitlement`, {
      headers: { Authorization: bearer },
    });
    expect(entitlementRes.status()).toBe(200);
    const entitlement = await entitlementRes.json();
    expect(entitlement.status).toBe("active");
    expect(entitlement.source).toBe("payment");
  });

  // ── US2 — checkout hand-off + abandonment ────────────────────────────────────────────────

  test("US2: an abandoned checkout leaves no ghost premium; a retry shows the honest 409 copy", async ({
    page,
  }, info) => {
    await signUpThrowaway(page, `abandon-${info.workerIndex}`);
    await page.goto("/conta");

    await page.route("https://stub.mercadopago.local/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP stub</html>" }),
    );

    await page.getByRole("button", { name: t.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: t.subscribeAction }).click();
    await page.waitForURL(/stub\.mercadopago\.local/);

    // The abandoner: never completes the payment, just comes back to the app on their own.
    await page.goto("/conta");
    await expect(page.getByText(tc.planFree)).toBeVisible();
    // exact: true — "Assinar Premium" (still visible, a free account) would otherwise substring-
    // match "Premium" too; the badge text itself is the only exact match we care about.
    await expect(page.getByText(tc.planPremium, { exact: true })).toHaveCount(0);
    // No ghost "pendente premium" state anywhere on the page.
    await expect(page.getByText(/pendente/i)).toHaveCount(0);

    // A second Assinar attempt hits SEC-604 (an open subscription already exists) — honest copy,
    // never the raw status code.
    await page.getByRole("button", { name: t.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: t.subscribeAction }).click();
    await expect(page.getByRole("alert").getByText(t.checkoutInProgress)).toBeVisible();
    await expect(page.getByText(/\b409\b/)).toHaveCount(0);
  });

  // ── SC-702 — spoofed webhook ──────────────────────────────────────────────────────────────

  test("SC-702: a forged webhook signature is rejected 401 and grants nothing", async ({
    page,
    request,
  }, info) => {
    await signUpThrowaway(page, `spoof-${info.workerIndex}`);
    const tokenPromise = captureEntitlementBearerToken(page);
    await page.goto("/conta");
    const bearer = await tokenPromise;

    const res = await fireStubWebhook(request, {
      paymentId: "e2e-spoof-payment",
      secret: "definitely-the-wrong-secret",
    });
    expect(res.status()).toBe(401);

    const entitlementRes = await request.get(`${E2E_BACKEND_URL}/api/v1/entitlement`, {
      headers: { Authorization: bearer },
    });
    expect(entitlementRes.status()).toBe(200);
    expect((await entitlementRes.json()).status).toBe("none");
  });
});
