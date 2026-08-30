import { createHmac } from "node:crypto";

import { type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

import { E2E_BACKEND_URL } from "../../playwright.config";

// E6/T016 — billing.spec.ts helpers: signing a webhook the same way the real MP stub's Python
// `fire_webhook` does (`backend/tests/mp_stub/stub.py`), replicated in TS so the Playwright
// process (a SEPARATE OS process from the standalone stub, `run_standalone.py`) can fire signed
// webhooks straight at the real backend without any shared Python object. Must match
// `app.billing.signature.canonical_manifest` byte-for-byte — verified against the frozen
// `test_billing_security.py` fixtures during this task.

/** Must match `P3D_MP_WEBHOOK_SECRET` in `playwright.config.ts`'s backend webServer entry. */
export const MP_STUB_SECRET = "e2e-mp-stub-webhook-secret";

const WEBHOOK_PATH = "/api/v1/billing/webhook/mercadopago";

export interface FireWebhookOptions {
  paymentId: string;
  /** Wrong on purpose for the SC-702 spoof case. */
  secret?: string;
  requestId?: string;
  liveMode?: boolean;
  eventType?: string;
}

/** Signs `{type, action, data:{id}, live_mode}` with MP's real manifest (`id:…;request-id:…;
 *  ts:…;`, `data.id` lowercased) and POSTs it straight at the backend under test — mirrors
 *  `MPStub.fire_webhook` (Python) without needing the stub's in-process registration API. */
export async function fireStubWebhook(
  request: APIRequestContext,
  opts: FireWebhookOptions,
): Promise<APIResponse> {
  const ts = Math.floor(Date.now() / 1000);
  const requestId = opts.requestId ?? "e2e-req-1";
  const secret = opts.secret ?? MP_STUB_SECRET;
  const manifest = `id:${opts.paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return request.post(`${E2E_BACKEND_URL}${WEBHOOK_PATH}`, {
    headers: {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    },
    data: {
      type: opts.eventType ?? "subscription_authorized_payment",
      action: "created",
      data: { id: opts.paymentId },
      live_mode: opts.liveMode ?? false,
    },
  });
}

/** Captures the bearer token the app's OWN authenticated fetch sends to
 *  `GET /api/v1/entitlement` — lets a test hit that endpoint directly (`request` fixture) without
 *  ever reading Firebase internals or touching app source (no `getIdToken` seam is exposed). Call
 *  BEFORE the entitlement query fires (e.g. right after sign-up), then trigger a fetch (a nav to
 *  /conta is enough) and await the returned promise. */
export function captureEntitlementBearerToken(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/entitlement")) {
        const auth = req.headers()["authorization"];
        if (auth) resolve(auth);
      }
    });
  });
}
