import { useNavigate } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, EmptyState } from "@/shared/ui";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";

// 008/T008 — the honest BOM teaser (US5, ux §2): the E2 US7 teaser lineage with BOM copy. The
// whole feature is Premium (Q3, first paywalled compute — ADR-0015), so free/lapsed/signed-out
// meet this panel instead of the composer. Three non-negotiables: NO price, NO date, NO pre-E6
// purchase CTA (billing is E6 — a buy button would promise a flow that does not exist,
// Principle II); the free single-piece calculator promise is reaffirmed in plain words (FR-411).

const t = messages.bom;

export function BomTeaser({ signedOut }: { signedOut: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3">
      <EmptyState icon="crown" title={t.teaserTitle} description={t.teaserBody} />
      <p className="text-center text-sm">
        {signedOut ? t.teaserSignedOutBody : t.teaserDialogBody}
      </p>
      <p className="text-center text-sm text-[var(--text-muted)]">{t.teaserFreeNote}</p>
      <TeaserUpgrade signedOut={signedOut} />
      <div className="flex justify-center gap-2">
        {signedOut && (
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/kits" } })}
          >
            {t.teaserSignIn}
          </Button>
        )}
        <Button onClick={() => void navigate({ to: "/calcular" })}>{t.teaserDismiss}</Button>
      </div>
    </div>
  );
}
