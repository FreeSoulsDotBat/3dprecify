import { useEffect, useRef } from "react";

import { useSyncOutbox } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { useSessionExpired } from "@/shared/session/session-expiry";
import { useSessionStore } from "@/shared/session/session-store";

// 009/T013 (E4, PR-A) — the queue drains itself (ADR-0018 §7).
//
// A pending record that only synced when the seller happened to open the Histórico would be a
// promise half-kept: the app says "sincroniza sozinho quando a conexão voltar", so it has to.
// The four event triggers of ADR-0018 §7: app boot / sign-in (uid appears), reconnect (`online`),
// window `focus`, and the tab becoming visible (`visibilitychange`) — plus the moment the
// entitlement becomes `active` again, which un-blocks a queue refused with a 403.
//
// `focus`/`visibilitychange` were the two missing triggers (review PR-A, M5): they also close the
// captive-portal gap, where `navigator.onLine` stays `true` so no `online` event ever fires and
// nothing would otherwise drain in-session.
//
// DEFERRED to PR-B (dated 2026-07-15, review PR-A M5): the TIME-based recovery — an exponential
// backoff that reads `attempts`/`lastStatus`, and the promised `entities/history/sync-engine.ts`.
// Invariant that PR-B must preserve: a `status 0` (lost response) is retried, NEVER flipped to
// `failed` by any cap — the write may have landed.
//
// It is safe to fire this from anywhere, any number of times: exactly-once lives in the DATABASE
// (the unique key on `clientSnapshotId`), never in this component. A redundant drain can waste a
// request; it can never duplicate a record.

export function OutboxSyncer() {
    const uid = useSessionStore((s) => s.user?.uid);
    const status = useSessionStore((s) => s.status);
    const entitled = useEntitlement().data?.status === "active";
    // hotfix 016/A3 (H4) — the mirror of `retryBlocked`, driven by the SESSION coming back.
    // hotfix/R3 da homologação: `status === "authenticated"` sozinho é EXATAMENTE o estado do A3
    // (401 do servidor com sessão de cliente viva) — com só essa condição, a entrada era re-tentada
    // a cada montagem, contra a promessa "não é re-tentado sozinho". O gate composto exige a sessão
    // do cliente viva E o marcador de expiração LIMPO (ele só limpa num sucesso real de transporte
    // ou num novo sign-in) — ou seja, o retry dispara quando a sessão VOLTOU, não enquanto ela
    // está morta do lado do servidor.
    const sessionExpired = useSessionExpired();
    const { sync } = useSyncOutbox({
        retryBlocked: entitled,
        retryUnauthenticated: status === "authenticated" && !sessionExpired,
    });

    // Kept in a ref so the effect keys on the things that MEAN something (the account, the plan) and
    // not on a fresh closure every render.
    const syncRef = useRef(sync);
    syncRef.current = sync;

    useEffect(() => {
        if (!uid) return;
        syncRef.current();
        const trigger = () => syncRef.current();
        const onVisible = () => {
            if (document.visibilityState === "visible") syncRef.current();
        };
        window.addEventListener("online", trigger);
        window.addEventListener("focus", trigger);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("online", trigger);
            window.removeEventListener("focus", trigger);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [uid, entitled, status]);

    return null;
}
