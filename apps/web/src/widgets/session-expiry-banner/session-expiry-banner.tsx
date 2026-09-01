import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionExpired } from "@/shared/session/session-expiry";
import { Alert } from "@/shared/ui";

// ⚠ @doc DEC-056 — tom `info`, nunca `danger`: nada foi destruído, o outbox guardou tudo. `<a>`
//   puro e não `<Link>`, para renderizar sem `RouterProvider` montado.
export function SessionExpiryBanner(): ReactNode {
    const expired = useSessionExpired();
    const href = useRouterState({ select: (s) => s.location.href });
    if (!expired) return null;

    const t = messages.session;
    return (
        // hotfix/R1 da homologação — STICKY: no instante do 401 o vendedor está tipicamente no FIM da
        // página (é onde "Salvar em Orçamentos" mora), e o banner montado no topo nascia 1.746px
        // (1440) / 3.608px (360) FORA da viewport — a classe "botão nascido fora da viewport" do
        // E6/T028. Sticky no topo do shell, o caminho de volta está onde o vendedor está.
        <div style={{ position: "sticky", top: 0, zIndex: 40 }}>
            <Alert tone="info" title={t.expiredTitle} data-testid="session-expiry-banner">
                <p>{t.expiredBody}</p>
                <a
                    className="tf-btn tf-btn--primary tf-btn--sm mt-2"
                    href={`/sign-in?redirect=${encodeURIComponent(href)}`}
                >
                    {t.expiredAction}
                </a>
            </Alert>
        </div>
    );
}
