import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";
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
// T038 — ESTE COMENTARIO CADUCOU na US7 e foi corrigido: ele dizia "sem preco, sem CTA de
// compra (billing e E6)" ACIMA de um preco e de um botao de compra. A premissa caiu quando o E6
// chegou; a garantia que sobra e outra — so os tres precos praticados, sem urgencia e sem de/por.
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
          <TeaserUpgrade signedOut={signedOut} />
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
      {/* T038/D5 — o §7.2 pede a faixa no Dialog E no PAINEL, e o painel tinha ficado sem: o
          vendedor que abria a aba Catalogo via "Salvar faz parte do Premium" e NENHUM preco, e so
          descobria o valor tocando em "+ Adicionar filamento". Das quatro superficies, tres
          acendiam onde ele aterrissa e uma exigia um toque a mais. */}
      {!open && <TeaserUpgrade signedOut={signedOut} align="center" />}
      <PremiumTeaserDialog open={open} onOpenChange={setOpen} signedOut={signedOut} />
    </div>
  );
}
