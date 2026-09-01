import { useEffect, useRef } from "react";

import { useSyncOutbox } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { useSessionExpired } from "@/shared/session/session-expiry";
import { useSessionStore } from "@/shared/session/session-store";

// @doc ADR-0018 §7 — os gatilhos do dreno; `focus`/`visibilitychange` fecham o portal cativo.
// ⚠ @doc DEC-021 — disparar daqui é seguro de qualquer lugar: exatamente-uma-vez mora no BANCO.

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
