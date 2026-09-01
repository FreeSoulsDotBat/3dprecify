import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import type { SyncState } from "./outbox";
import { syncToastFor } from "./sync-toast";

// B3 — o bug que esta função existe para matar: a cadeia de avisos era copiada em três telas, e a
// cópia do "Recalcular hoje" ficou sem o ramo `unauthenticated` (acrescentado às outras duas pelo
// hotfix 016/A3). Com a sessão expirada ela caía no vermelho genérico de falha.
const t = messages.history;

describe("syncToastFor — um aviso por desfecho, nas três telas", () => {
    it("sessão expirada NÃO é falha: tom `info` e a cópia que diz como voltar", () => {
        // O coração do B3. Se alguém reintroduzir um `else` genérico, este caso vira `danger`.
        expect(syncToastFor("unauthenticated")).toEqual({
            message: t.syncUnauthenticatedToast,
            tone: "info",
        });
        expect(syncToastFor("unauthenticated").message).not.toBe(t.syncFailedToast);
    });

    it("premium pausado é PAUSA, não falha (ADR-0018 §9)", () => {
        expect(syncToastFor("blocked")).toEqual({ message: t.syncBlockedToast, tone: "info" });
    });

    it("na fila é `info` — sincroniza sozinho; só a recusa do servidor é `danger`", () => {
        expect(syncToastFor("pending")).toEqual({ message: t.syncPendingToast, tone: "info" });
        expect(syncToastFor("failed")).toEqual({ message: t.syncFailedToast, tone: "danger" });
    });

    it("gravado é sucesso", () => {
        expect(syncToastFor("synced")).toEqual({ message: t.saved, tone: "success" });
    });

    it("todo estado de `SyncState` tem aviso próprio — nenhum cai no de outro", () => {
        const estados: SyncState[] = ["synced", "pending", "blocked", "failed", "unauthenticated"];
        const mensagens = estados.map((e) => syncToastFor(e).message);
        expect(new Set(mensagens).size).toBe(estados.length);
    });
});
