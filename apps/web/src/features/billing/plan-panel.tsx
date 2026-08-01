import { type ReactNode, useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from "@/shared/ui";

import { type PlanState } from "./plan-view";
import { useCancelSubscription } from "./use-subscription";

// E6 PR-B (T026/US6) — a linha do plano na Conta, para cada estado de cobrança.
//
// A DECISÃO de qual estado mostrar mora em `plan-view.ts`, e é pura. Aqui só há renderização: este
// arquivo recebe um `PlanState` já resolvido e não tem acesso ao ledger nem ao espelho do PSP, então
// ele não CONSEGUE inferir estado de cobrança mesmo que alguém tente (SC-708 por construção, e não
// por disciplina).
//
// Toda data é uma afirmação REAL aqui — ao contrário dos cenários da E5, onde datas são proibidas:
// uma data de renovação/expiração é fato do servidor, e escondê-la seria menos honesto, não mais.

const data = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : null;

/** Legenda + tom do badge para cada estado. Uma função, para que o `switch` seja exaustivo. */
export function planCaption(state: PlanState): { badge: string; tone: "success" | "neutral" } {
  const t = messages.conta;
  switch (state.kind) {
    case "unknown":
      return { badge: t.planUnknown, tone: "neutral" };
    case "subscription-active":
    case "subscription-canceled":
    case "courtesy":
      return { badge: t.planPremium, tone: "success" };
    case "grace":
      // Premium SEGUE ativo na carência — o badge não pode sugerir queda. O tom de cautela mora na
      // legenda ("pagamento pendente"), não numa degradação do selo que seria falsa.
      return { badge: t.planPremium, tone: "success" };
    case "lapsed":
      return { badge: t.planLapsed, tone: "neutral" };
    case "free":
      return { badge: t.planFree, tone: "neutral" };
  }
}

/** A frase sob o badge — a verdade do servidor em pt-BR. `null` quando não há o que acrescentar. */
export function planDetail(state: PlanState): string | null {
  const t = messages.conta;
  const b = messages.billing;
  switch (state.kind) {
    case "subscription-active": {
      const quando = data(state.renewsAt);
      const plano = b.planPeriods[state.plan];
      return quando ? `${plano} · ${b.planRenews} ${quando}` : plano;
    }
    case "subscription-canceled": {
      const quando = data(state.activeUntil);
      return quando ? `${b.planActiveUntil} ${quando} · ${b.planWontRenew}` : b.planWontRenew;
    }
    case "grace":
      return b.planGrace;
    case "courtesy": {
      const fonte =
        state.source === "beta" || state.source === "comp"
          ? t.planSources[state.source]
          : t.planSources.comp;
      const quando = data(state.expiresAt);
      return quando ? `${fonte} · ${t.planExpires} ${quando}` : fonte;
    }
    case "lapsed":
      return t.planLapsedHint;
    case "unknown":
    case "free":
      return null;
  }
}

/** A segunda linha, quando o estado precisa de uma. É onde mora a honestidade cara. */
export function planNote(state: PlanState): string | null {
  const b = messages.billing;
  if (state.kind === "grace") {
    const quando = data(state.graceUntil);
    return quando ? b.planGraceDeadline.replace("{data}", quando) : null;
  }
  if (state.kind === "subscription-canceled") {
    // ux-billing §4.3 — sem esta linha, "não renova até {data}" implica um corte que a cortesia
    // mais longa NÃO vai causar. Ver `plan-view.ts` para a detecção e a ressalva de ratificação.
    return state.courtesyOutlives
      ? `${b.planCanceledHint} ${b.planCourtesyOutlives}`
      : b.planCanceledHint;
  }
  return null;
}

export interface PlanActionsProps {
  state: PlanState;
  /** Abre a oferta (§2) — assinar pela primeira vez ou reassinar. */
  onSubscribe: () => void;
}

/**
 * As ações do painel. A separação manda: **gerenciar/atualizar cartão sai para o MP** (é a superfície
 * dele — US6.3), e só o CANCELAR é nosso, in-app, com confirmação (§5).
 */
export function PlanActions({ state, onSubscribe }: PlanActionsProps): ReactNode {
  const b = messages.billing;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (state.kind === "free" || state.kind === "lapsed") {
    return (
      <Button size="sm" onClick={onSubscribe}>
        {state.kind === "lapsed" ? b.planResubscribe : messages.billing.subscribeAction}
      </Button>
    );
  }
  if (state.kind === "subscription-canceled") {
    return (
      <Button size="sm" onClick={onSubscribe}>
        {b.planResubscribe}
      </Button>
    );
  }
  if (state.kind === "grace") {
    return <ManageAtProvider label={b.planUpdatePayment} />;
  }
  if (state.kind === "subscription-active") {
    return (
      <>
        <ManageAtProvider label={b.planManage} />
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          {b.planCancel}
        </Button>
        <CancelDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          activeUntil={state.renewsAt}
        />
      </>
    );
  }
  return null;
}

/** O caminho gerenciado do MP. Atualizar cartão é superfície DELE — o cartão nunca passa por aqui. */
function ManageAtProvider({ label }: { label: string }): ReactNode {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => window.open("https://www.mercadopago.com.br/subscriptions", "_blank")}
    >
      {label}
    </Button>
  );
}

/**
 * §5 — o diálogo de cancelamento. Sem culpa, sem escassez falsa, sem padrão escuro.
 *
 * Ele diz o que o vendedor MANTÉM e até quando, que nada é apagado, e que dá para voltar. "Voltar" é
 * a saída segura (a FR-014 proíbe "Cancelar" como controle de dispensa); "Cancelar assinatura" é o
 * verbo da AÇÃO, e é o único lugar da E6 em que a palavra aparece num botão — sobre a ação
 * destrutiva, nunca sobre a saída.
 */
function CancelDialog({
  open,
  onOpenChange,
  activeUntil,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeUntil: string | null;
}): ReactNode {
  const b = messages.billing;
  const cancelar = useCancelSubscription();
  const [erro, setErro] = useState<string | null>(null);
  const quando = data(activeUntil);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setErro(null);
        onOpenChange(v);
      }}
    >
      <DialogContent variant="center">
        <div className="flex flex-col gap-3">
          <DialogTitle>{b.cancelTitle}</DialogTitle>
          <DialogDescription>
            {quando ? b.cancelBody.replace("{data}", quando) : b.cancelBodyNoDate}
          </DialogDescription>
          <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
            {b.cancelFreeze}
          </p>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {b.cancelBack}
            </Button>
            <Button
              variant="danger"
              loading={cancelar.isPending}
              onClick={() => {
                setErro(null);
                cancelar.mutate(undefined, {
                  onSuccess: (sub) => {
                    onOpenChange(false);
                    // A data do TOAST vem da resposta do servidor, não da que estava na tela: se o
                    // painel estivesse defasado, repetir o valor antigo confirmaria uma promessa que
                    // o servidor não fez.
                    const ate = data(sub?.currentPeriodEnd ?? null);
                    toast(ate ? b.cancelDone.replace("{data}", ate) : b.cancelDoneNoDate, {
                      tone: "success",
                    });
                  },
                  // Nada foi espelhado no servidor quando isto falha (o serviço só espelha depois de
                  // o MP confirmar), então dizer "nada mudou" é literalmente verdade.
                  onError: () => setErro(b.cancelFailed),
                });
              }}
            >
              {b.cancelConfirm}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
