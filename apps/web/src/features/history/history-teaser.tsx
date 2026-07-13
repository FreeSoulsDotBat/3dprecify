import { useNavigate } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Icon } from "@/shared/ui";

// 009 (E4, PR-A) — the honest teaser at the record action (US5, E2 US7 / E3 US5 lineage).
//
// The record button is VISIBLE to everyone (it is where the value is, so it is where the offer
// belongs) but it never pretends: free, lapsed and signed-out sellers meet this panel instead of
// the Sheet, and NOTHING is queued. Three non-negotiables inherited from E2/E3: no price, no date,
// no pre-E6 purchase CTA (billing is E6 — a buy button would promise a flow that does not exist).
// The free calculator promise is restated in plain words.

const t = messages.historico;

export function HistoryTeaserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const signedOut = useSessionStore((s) => s.status !== "authenticated");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          <Icon name="crown" size={20} /> {t.teaserTitle}
        </DialogTitle>
        <DialogDescription>{t.teaserBody}</DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          {signedOut && (
            <Button
              variant="secondary"
              onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/calcular" } })}
            >
              {messages.signIn.title}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>{t.back}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
