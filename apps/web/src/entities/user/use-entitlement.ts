import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { type EntitlementView, getEntitlementApiV1EntitlementGet } from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import { loadCachedEntitlement, persistCachedEntitlement } from "./entitlement-cache";

// E2/T025b (FR-304) — the account's own plan state from GET /api/v1/entitlement (ADR-0012 R1b).
// Server-derived, never fabricated: the Conta page renders exactly what this returns (none/active/
// lapsed) or an honest unknown on error. uid-keyed like ["me"] (D1) so a re-login as a different
// user never reads the previous user's cached plan.
//
// 009/T011b (owner decision 2026-07-13) — the last server answer is now PERSISTED (uid-keyed
// IndexedDB, purged on sign-out), so it survives a cold boot. Without it, a premium seller who
// opened the app already offline had NO server answer at all and met the free teaser: the offline
// outbox (ADR-0018) was unreachable in exactly the scenario it exists for.
//
// This does not move the gate. The cached value is the SERVER's own last word, not a client-held
// flag (ADR-0015's nuance, ADR-0018 §9), it can only echo what the server said, and the server
// still decides at sync — a write on a stale `active` is refused with a 403 and its record becomes
// `blocked`: visible and retained, never silently accepted.

export const ENTITLEMENT_QUERY_KEY = ["entitlement"] as const;

/** What a gate reads. `stale` is the honest middle state the old shape could not express: we DO
 *  have the server's answer, it is simply the one from last time. */
export interface EntitlementState {
    data: EntitlementView | undefined;
    /** No answer at all — neither fresh nor remembered. Honest unknown, never assumed premium. */
    isError: boolean;
    /** First read in flight with nothing remembered yet. */
    isLoading: boolean;
    /** Serving the persisted last-known SERVER answer because the online read failed. */
    stale: boolean;
    /** A read is in flight (drives the "Atualizar" button's spinner, even when data is on screen). */
    isFetching: boolean;
    refetch: () => void;
}

export function useEntitlement(): EntitlementState {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);

    // Pre-fill from the uid-keyed device cache. It resets to null whenever the uid changes, so
    // account B never reads account A's plan on a shared device.
    const [cached, setCached] = useState<EntitlementView | null>(null);
    useEffect(() => {
        let cancelled = false;
        setCached(null);
        if (!uid) return;
        void loadCachedEntitlement(uid)
            .then((view) => {
                if (!cancelled && view) setCached(view);
            })
            // 015/A5 ([F08-001]) — o pre-carregamento pode falhar (quota estourada, store corrompido,
            // navegacao privada) e a tela sobrevive, porque a consulta online roda de qualquer jeito. O que
            // nao pode e falhar em SILENCIO: sem este catch a rejeicao ficava sem tratador, e o vendedor
            // perdia o pre-preenchimento e o boot offline sem ninguem ficar sabendo. O `outbox.ts:121` ja
            // fazia o certo com `then(run, run)`; os seis pre-carregamentos nao herdaram.
            .catch((erro: unknown) => {
                console.warn(
                    "[cache] pre-carregamento de entitlement falhou; seguindo pela rede",
                    erro,
                );
            });
        return () => {
            cancelled = true;
        };
    }, [uid]);

    const query = useQuery<EntitlementView, ApiError>({
        queryKey: [...ENTITLEMENT_QUERY_KEY, uid],
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: 60_000,
        // Same reason as the outbox query (review PR-A, C4): the default `networkMode` PAUSES this the
        // instant the window fires `offline`, and a paused query never errors — so `stale` would read
        // FALSE and the surface would pass a remembered `active` off as fresh, hiding a possible lapse.
        // `"always"` + `retry: false` makes it RUN and FAIL offline, feeding the honest `stale` flag
        // (the persisted cache still supplies the value).
        networkMode: "always",
        queryFn: async () => {
            const res = await getEntitlementApiV1EntitlementGet();
            // The transport throws a typed ApiError on any non-2xx — only 200 reaches here.
            if (res.status !== 200) {
                throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
            }
            return res.data;
        },
    });

    const fetched = query.data;
    useEffect(() => {
        if (fetched && uid) void persistCachedEntitlement(uid, fetched);
    }, [fetched, uid]);

    // A FRESH answer always wins over the remembered one — a lapse must never be hidden behind a
    // stale `active`.
    const data = query.data ?? cached ?? undefined;
    return {
        data,
        // The wall is ONLY for "no answer at all" — neither fresh nor remembered.
        isError: query.isError && data === undefined,
        isLoading: query.isFetching && data === undefined,
        // The read failed but we DO have the server's word — from this session (React Query keeps the
        // last answer through a failed background refetch) or from the last one (the device cache).
        // Either way it is not fresh, and every surface says so rather than passing it off as current.
        stale: query.isError && data !== undefined,
        isFetching: query.isFetching,
        refetch: () => void query.refetch(),
    };
}
