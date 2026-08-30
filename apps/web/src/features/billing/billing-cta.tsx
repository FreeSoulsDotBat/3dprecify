import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  type CheckoutInPeriod,
  createCheckoutApiV1BillingCheckoutPost,
} from "@/shared/api/generated";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button } from "@/shared/ui";

import "./billing.css";

// E6/T014-T015 (US1/US2 — ux-billing.md §2.1/§3.1, F6). The ONE shared "Assinar" CTA: it lives in
// `features/billing` (a feature cannot import a sibling feature, ux §9-G2) so it is exported for
// the four teasers to CONSUME in a later wave (T031/T032) — nothing is wired into them yet.
//
// Honesty rules baked in (Constitution IV, §0.1): a tap NEVER pre-flips premium. Signed-out routes
// through sign-in first (FR-702) with the intent preserved; signed-in starts a REAL checkout and
// hands off to MP's `initPoint` via `window.location` — the card never touches this app (SC-706).
// A 409 (an open subscription already exists) and a 503 (MP unreachable) each render a plain,
// specific, non-jargon sentence — never a raw status code (F6) and never a fake success.

const t = messages.billing;

export type BillingCtaState = "idle" | "pending" | "conflict" | "unavailable";

export interface BillingCtaProps {
  period: CheckoutInPeriod;
  /** Whitelisted return-to-intent for a signed-out tap (router.tsx RETURN_TO_INTENT). */
  signInRedirect?: string;
  className?: string;
}

export function BillingCta({ period, signInRedirect = "/conta", className }: BillingCtaProps) {
  const status = useSessionStore((s) => s.status);
  const navigate = useNavigate();
  const [state, setState] = useState<BillingCtaState>("idle");

  async function onClick() {
    if (status !== "authenticated") {
      void navigate({ to: "/sign-in", search: { redirect: signInRedirect } });
      return;
    }
    setState("pending");
    try {
      const res = await createCheckoutApiV1BillingCheckoutPost({ period });
      if (res.status !== 200) {
        // unreachable: the transport throws a typed ApiError on any non-2xx (transport.ts) — only
        // a real 200 reaches here.
        throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
      }
      // The browser is about to leave the app for MP's hosted checkout — stay "pending" (the
      // button keeps its spinner + "Abrindo o Mercado Pago…" affordance via `loading`) rather
      // than settle back to idle, so there is no flash of a re-enabled button before navigation.
      window.location.assign(res.data.initPoint);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setState("conflict");
      } else {
        // Any other failure (503 BILLING_UNAVAILABLE, offline, malformed response) settles to the
        // same honest "unavailable" copy — nothing was charged (§2.3).
        setState("unavailable");
      }
    }
  }

  return (
    <div className={className}>
      <Button onClick={() => void onClick()} loading={state === "pending"}>
        {t.subscribeAction}
      </Button>
      {state === "conflict" && (
        <Alert tone="danger" className="tf-billing-cta__alert">
          {t.checkoutInProgress}
        </Alert>
      )}
      {state === "unavailable" && (
        <Alert tone="danger" className="tf-billing-cta__alert">
          {t.offerUnavailable}
        </Alert>
      )}
    </div>
  );
}
