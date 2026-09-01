import { type ReactNode, useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui";

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
    const t = messages.account;
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

/**
 * O TOM da legenda e da nota.
 *
 * T028/A3 (dono, 2026-08-01): a homologação mediu que CARÊNCIA e ATIVA tinham temperatura visual
 * idêntica — selo com os mesmos pixels e as duas frases no mesmo `--text-muted` da legenda neutra.
 * Um cartão falhando lia igual a uma assinatura saudável.
 *
 * O selo continua VERDE de propósito: o premium segue ativo durante toda a carência, e degradá-lo
 * diria ao vendedor que ele já perdeu algo — a mentira na direção oposta, e mais cara, porque pode
 * fazê-lo parar de usar o que ainda pagou. Quem carrega a cautela é o TEXTO, que é o fallback que o
 * `ux-billing` §9-G1 previa e que não tinha sido aplicado.
 */
export function planToneVar(state: PlanState): string {
    return state.kind === "grace" ? "var(--info-text)" : "var(--text-muted)";
}

/** A frase sob o badge — a verdade do servidor em pt-BR. `null` quando não há o que acrescentar. */
export function planDetail(state: PlanState): string | null {
    const t = messages.account;
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
        // 015/A8 ([F11b-002], decisão do dono 2026-08-03) — PRIMÁRIO. É a única ação que recupera o
        // Premium, e ela era a única sem preenchimento: mesma cor, mesmo peso e zero fundo do
        // "Recarregar" ao lado, num estado em que o vendedor tem um prazo correndo. A hierarquia
        // visual estava invertida em relação ao risco. O selo de carência mantém o tom `info` e o
        // badge continua VERDE — o Premium ESTÁ ativo, e degradá-lo seria a mentira oposta.
        return <ManageAtProvider label={b.planUpdatePayment} variant="primary" />;
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

/**
 * O caminho gerenciado do MP. Atualizar cartão é superfície DELE — o cartão nunca passa por aqui.
 *
 * 015/A8 — a variante é parâmetro porque os dois usos têm RISCOS diferentes: em carência há uma
 * assinatura a recuperar e um prazo correndo (primário); em ativo não há nada em risco, e "Gerenciar"
 * ao lado de "Cancelar" com o mesmo peso é honesto. `ghost` continua sendo o padrão para que o uso
 * que não pediu ênfase não a ganhe por descuido.
 */
function ManageAtProvider({
    label,
    variant = "ghost",
}: {
    label: string;
    variant?: "primary" | "ghost";
}): ReactNode {
    return (
        <Button
            size="sm"
            variant={variant}
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
                    {/* 015/A8 ([F11b-004], decisão do dono 2026-08-03) — hierarquia INVERTIDA. A medição
              anterior: "Voltar" fantasma 85,6×48px, "Cancelar assinatura" vermelho preenchido
              187,6×48px — o destrutivo era 2,2× mais largo E o único com fundo. A cópia acima é
              exemplar (diz o que se mantém, até quando, que nada é apagado) e o DESENHO a
              contradizia: a saída segura, que a própria mensagem chama de saída segura (FR-014),
              tinha a afordância mais fraca da caixa.
              A largura continua desigual — ela vem do tamanho dos rótulos, e igualá-la era a outra
              opção, que não foi a escolhida. O que muda é o peso: preenchimento na saída segura. */}
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => onOpenChange(false)}>
                            {b.cancelBack}
                        </Button>
                        <Button
                            variant="danger-ghost"
                            loading={cancelar.isPending}
                            onClick={() => {
                                setErro(null);
                                // O toast do sucesso vive no `onSuccess` do HOOK (T028/B2): este dialogo
                                // DESMONTA no flip do estado, e um callback preso a ele nunca roda. O `onError`
                                // fica, porque no erro o dialogo continua montado.
                                cancelar.mutate(undefined, {
                                    // Nada foi espelhado no servidor quando isto falha (o servico so espelha depois de
                                    // o MP confirmar), entao dizer "nada mudou" e literalmente verdade.
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
