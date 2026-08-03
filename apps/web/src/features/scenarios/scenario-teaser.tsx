import { useNavigate } from "@tanstack/react-router";

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

// 010/T016 (E5, PR-A US5) — the honest premium teaser for "Meus cenários" (E2 US7 / E3 US5 / E4 US5
// lineage — the SAME copy family, parametrized here rather than imported: `features/scenarios`
// cannot import `features/catalog`'s `PremiumTeaserDialog` (FSD-Lite forbids a feature importing a
// sibling feature) — so, exactly like `features/history/history-teaser.tsx` did for the Histórico
// tab, this is a small LOCAL composition of the same shared DS primitives (`Dialog`/`EmptyState`),
// not a clone of the pricing/business logic (there is none here to clone).
//
// Three non-negotiables inherited from every teaser before it (§0.1/§7 of ux-scenarios.md): the
// door is VISIBLE, never hidden; the intercept is honest and specific (no generic error); nothing
// persists and no success is faked. A fourth, specific to this surface: NO fabricated sample
// scenario — the list simply explains, it never shows a fake "Cenário 1" row (SC-607).

const t = messages.scenarios;

/** The Dialog shown when the seller taps the teaser's own action — reused parametrized copy. */
export function ScenarioTeaserDialog({
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
          <DialogTitle>{t.teaserDialogTitle}</DialogTitle>
          <DialogDescription>
            {signedOut ? t.teaserSignedOutBody : t.teaserDialogBody}
          </DialogDescription>
          <p className="text-sm text-[var(--text-muted)]">{t.teaserFreeNote}</p>
          <TeaserUpgrade signedOut={signedOut} />
          <div className="flex justify-end gap-2">
            {signedOut && (
              <Button
                variant="secondary"
                onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/calcular" } })}
              >
                {t.teaserSignIn}
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>{t.teaserDismiss}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The "Meus cenários" surface for free/signed-out sellers (ux §3.5/§7): explains the value, never a
 *  broken empty list and never a fabricated sample row. `open`/`onOpenChange` are OWNED by the
 *  caller (the list sheet) so this panel composes inside it without its own extra dialog wrapper. */
export function ScenarioTeaserPanel({
  signedOut,
  onOpenDialog,
  dialogOpen = false,
}: {
  signedOut: boolean;
  onOpenDialog: () => void;
  /**
   * T038/D4 — o dialog deste painel esta aberto.
   *
   * MEDIDO: com ele aberto, 31,8px (390px) / 39,1px (1280px) da faixa do PAINEL ficavam visiveis
   * abaixo da borda do modal, com opacidade efetiva 1 — um SEGUNDO "Assinar Premium" identico. E a
   * 1280px o card do dialog CORTAVA a linha de preco do painel, deixando o fragmento ",99/mes" na
   * tela ao lado do CTA duplicado. Dinheiro mutilado. Nao era armadilha de clique (o overlay pega
   * o toque), mas nenhuma assercao de texto ve nada disso — so a imagem.
   *
   * A duplicata NASCEU desta faixa: antes da US7 o painel nao tinha preco nem botao.
   */
  dialogOpen?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        icon="crown"
        title={t.teaserTitle}
        description={t.teaserBody}
        action={<Button onClick={onOpenDialog}>{t.teaserAction}</Button>}
      />
      {signedOut && (
        <p className="text-center text-sm text-[var(--text-muted)]">{t.teaserSignedOutBody}</p>
      )}
      <p className="text-center text-sm text-[var(--text-muted)]">{t.teaserFreeNote}</p>
      {!dialogOpen && <TeaserUpgrade signedOut={signedOut} align="center" />}
    </div>
  );
}
