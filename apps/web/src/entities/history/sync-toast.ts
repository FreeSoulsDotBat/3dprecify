import { messages } from "@/shared/i18n/messages.pt-br";

import type { SyncState } from "./outbox";

// ⚠ @doc DEC-014 — o `switch` é EXAUSTIVO de propósito: estado novo sem ramo aqui NÃO COMPILA,
//   em vez de escorregar para um `else` que fala a frase errada com convicção.
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
