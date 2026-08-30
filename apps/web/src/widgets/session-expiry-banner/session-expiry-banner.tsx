import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionExpired } from "@/shared/session/session-expiry";
import { Alert } from "@/shared/ui";

// hotfix 016/A3 (H5, 2026-08-07) — the CAMINHO DE VOLTA the T072 homologação found missing: the
// server can refuse a live client session (a 401 with a real session-expiry code), and until this
// slice NO screen moved when that happened — `router.tsx`'s guard only reacts to the CLIENT
// (Firebase) session dying, which this is not. Rendered in `app-shell` (every authenticated tab
// mounts it) so it is reachable from wherever the 401 happened, not just one page.
//
// Tone "info", never "danger": nothing was destroyed (the outbox's `unauthenticated` state, H4,
// keeps every unsynced quote), so this is an invitation, not an alarm.
//
// A plain `<a>`, same pattern as `TeaserUpgrade` — never the router's `<Link>` — so this renders and
// is testable with no RouterProvider mounted; `useRouterState` reads the CURRENT `location.href`
// (TanStack's own field: pathname + search, never the browser's absolute URL) so the redirect
// preserves the seller's intent through `/sign-in`'s existing `safeRedirect` whitelist.
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
