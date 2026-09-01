import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { type EntitlementView } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Card, Icon, Spinner } from "@/shared/ui";

import "./billing.css";

// E6/T014-T015 (US2 — ux-billing.md §3.2-§3.5, the honesty crux of the whole epic). At the moment
// of return from MP's hosted checkout the app does NOT know if the payment succeeded — a grant is
// written ONLY by the server-verified webhook/reconciliation (§0.1). So this surface polls SERVER
// truth (`GET /api/v1/entitlement`, the house refetch pattern) over a BOUNDED window and settles
// to exactly one of three honest states. It never pre-flips premium and never shows a
// "processando" that implies a charge already succeeded.
//
// The abandoned case (no payment ever completed) must be indistinguishable from never-started
// (US2.2): the "unconfirmed" state below names that explicitly ("se você não concluiu, nada foi
// cobrado") and leaves the account exactly as it was — no ghost "pendente premium" badge anywhere.

const t = messages.billing;

/** ~45s of polling (15 × 3s) — the ADR-0012 propagation window covers the common
 *  webhook-before-return case (ux §3.2); exported so the test suite can drive it deterministically
 *  instead of guessing at the wall-clock budget. */
export const CHECKOUT_RETURN_POLL_INTERVAL_MS = 3000;
export const CHECKOUT_RETURN_MAX_ATTEMPTS = 15;

function isVerifiedPaymentGrant(data: EntitlementView | undefined): boolean {
    return data?.status === "active" && data.source === "payment";
}

export function CheckoutReturnPanel() {
    const entitlement = useEntitlement();
    const navigate = useNavigate();
    const [attempts, setAttempts] = useState(0);

    const success = isVerifiedPaymentGrant(entitlement.data);
    const exhausted = !success && attempts >= CHECKOUT_RETURN_MAX_ATTEMPTS;
    const pending = !success && !exhausted;

    // Re-arms itself on every attempt while still pending; stops the instant either a verified
    // grant lands or the bounded patience runs out — never an infinite silent poll.
    useEffect(() => {
        if (!pending) return;
        const id = setTimeout(() => {
            entitlement.refetch();
            setAttempts((n) => n + 1);
        }, CHECKOUT_RETURN_POLL_INTERVAL_MS);
        return () => clearTimeout(id);
        // `entitlement.refetch` is a fresh closure every render (react-query); `attempts` alone drives
        // re-arming the timer, which is the only thing this effect needs to react to. (No
        // exhaustive-deps lint rule is configured in this project — nothing to suppress.)
    }, [pending, attempts]);

    function backToConta() {
        void navigate({ to: "/conta" });
    }

    if (success) {
        return (
            <Card className="tf-billing-return">
                <Icon name="crown" size={28} aria-hidden />
                <h2>{t.returnSuccessTitle}</h2>
                <p>{t.returnSuccessBody}</p>
                <Button onClick={() => void navigate({ to: "/calcular" })}>
                    {t.returnSuccessAction}
                </Button>
            </Card>
        );
    }

    if (exhausted) {
        return (
            <Card className="tf-billing-return">
                <Icon name="circle-alert" size={28} aria-hidden />
                <h2>{t.returnUnconfirmedTitle}</h2>
                <p>{t.returnUnconfirmedBody}</p>
                <div className="tf-billing-return__actions">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setAttempts(0);
                            entitlement.refetch();
                        }}
                    >
                        {t.returnVerifyAgain}
                    </Button>
                    <Button variant="ghost" onClick={backToConta}>
                        {t.returnBackToAccount}
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="tf-billing-return">
            <Spinner />
            <h2>{t.returnPendingTitle}</h2>
            <p>{t.returnPendingBody}</p>
            <div className="tf-billing-return__actions">
                <Button variant="secondary" onClick={() => entitlement.refetch()}>
                    {t.returnRefresh}
                </Button>
                <Button variant="ghost" onClick={backToConta}>
                    {t.returnBackToAccount}
                </Button>
            </div>
        </Card>
    );
}
