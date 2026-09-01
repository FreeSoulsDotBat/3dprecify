import { messages } from "@/shared/i18n/messages.pt-br";

import type { SyncState } from "./outbox";

// B3 (corrigido 2026-09-01 a pedido do dono) — o aviso que traduz o desfecho da sincronização.
//
// Era a MESMA cadeia if/else copiada em três telas (`record-snapshot-sheet`, `quote-builder` e
// `recalc-today`), e a terceira cópia ficou para trás quando o hotfix 016/A3 acrescentou o ramo
// `unauthenticated`: com a sessão expirada, o "Recalcular hoje" caía no vermelho genérico de falha
// em vez de dizer que bastava entrar de novo — assustando, sem dizer o que fazer.
//
// O `switch` é EXAUSTIVO de propósito, e é isso que impede a próxima cópia de nascer: um estado
// novo em `SyncState` sem ramo aqui não compila (o retorno deixaria de ser `SyncToast`), em vez de
// escorregar para um `else` que fala a frase errada com convicção.
export interface SyncToast {
    message: string;
    tone: "success" | "info" | "danger";
}

const t = messages.history;

export function syncToastFor(state: SyncState): SyncToast {
    switch (state) {
        case "synced":
            return { message: t.saved, tone: "success" };
        case "pending":
            return { message: t.syncPendingToast, tone: "info" };
        // Pausado, não falhado: a retentativa volta sozinha quando o entitlement retorna (ADR-0018 §9).
        case "blocked":
            return { message: t.syncBlockedToast, tone: "info" };
        // hotfix 016/A3 (H4) — ramo próprio, nunca o "falhou" em vermelho: sessão morta não é recusa
        // do servidor, e a palavra "conexão" não aparece na cópia dele.
        case "unauthenticated":
            return { message: t.syncUnauthenticatedToast, tone: "info" };
        case "failed":
            return { message: t.syncFailedToast, tone: "danger" };
    }
}
