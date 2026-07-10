import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Icon,
} from "@/shared/ui";

// US7/T032 — the honest free-tier teaser (ux §2), extending the shipped Catálogo empty-state.
// Three non-negotiables (§0.3): the affordance is VISIBLE (hiding it would lie about the
// product); the intercept is honest and specific; nothing persists and no success is faked.
// NO price, NO date, NO purchase CTA — billing is E6; a buy button would promise a flow that
// does not exist (Principle II). When E6 lands, the dismiss becomes the upgrade entry.

const catalogo = messages.catalogo;

/** The teaser panel itself — shared by the Catálogo tab and the calculator's catalog slot. */
export function PremiumTeaserDialog({
  open,
  onOpenChange,
  signedOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedOut: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="center">
        <div className="flex flex-col gap-3">
          <Icon name="crown" size={24} aria-hidden />
          <DialogTitle>{catalogo.teaserDialogTitle}</DialogTitle>
          <DialogDescription>
            {signedOut ? catalogo.teaserSignedOutBody : catalogo.teaserDialogBody}
          </DialogDescription>
          <p className="text-sm text-[var(--text-muted)]">{catalogo.teaserFreeNote}</p>
          <div className="flex justify-end gap-2">
            {signedOut && (
              <Button
                variant="secondary"
                onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/catalogo" } })}
              >
                {catalogo.teaserSignIn}
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>{catalogo.teaserDismiss}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The Catálogo tab surface for free/signed-out accounts (ux §2.1/§2.2): honest value copy, a
 *  visible affordance whose tap opens the teaser, and the quiet premium line. Never broken CRUD. */
export function CatalogTeaser({ signedOut }: { signedOut: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        icon="package"
        title={catalogo.teaserTitle}
        description={catalogo.teaserBody}
        action={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} aria-hidden /> {catalogo.addFilament}
          </Button>
        }
      />
      <p className="text-center text-sm text-[var(--text-muted)]">
        {messages.apiError.entitlementRequired}
      </p>
      <PremiumTeaserDialog open={open} onOpenChange={setOpen} signedOut={signedOut} />
    </div>
  );
}
