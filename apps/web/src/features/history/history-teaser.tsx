import { useNavigate } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, EmptyState } from "@/shared/ui";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";

// 009/T015 (E4, PR-A) — the honest door (US5; E2 US7 / E3 US5 lineage).
//
// It lives on the **Histórico tab** and nowhere else. Owner decision (2026-07-13): the free
// calculator is not a sales floor — a seller who came to price a piece is never sold to mid-task,
// so the record button does not exist without an active Premium (SC-109 of spec 005 stays literally
// true). The offer belongs where someone is actually asking about history.
//
// Three prohibitions, inherited: no price, no availability date, no pre-E6 purchase CTA (billing is
// E6 — a buy button would promise a flow that does not exist, Principle II). And one that is new
// and specific to THIS surface:
//
//   NO SAMPLE ENTRY. Anywhere else a demo row would merely be a lie; on a ledger of what the seller
//   charged, it would be a FAKE RECEIPT — the exact thing this epic exists to make impossible.

const t = messages.historico;

export function HistoryTeaserPanel({ signedOut }: { signedOut: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3">
      <EmptyState icon="crown" title={t.teaserTitle} description={t.teaserBody} />
      {signedOut && <p className="text-center text-sm">{t.teaserSignedOutBody}</p>}
      {/* What the seller is actually worried about when they meet a paywall. */}
      <p className="text-center text-sm text-[var(--text-muted)]">{t.teaserFreeNote}</p>
      <TeaserUpgrade signedOut={signedOut} />
      <div className="flex justify-center gap-2">
        {signedOut && (
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/historico" } })}
          >
            {messages.signIn.title}
          </Button>
        )}
        <Button onClick={() => void navigate({ to: "/calcular" })}>{t.emptyAction}</Button>
      </div>
    </div>
  );
}
