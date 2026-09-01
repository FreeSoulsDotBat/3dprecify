import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { type EntitlementView, getEntitlementApiV1EntitlementGet } from "@/shared/api/generated";
import { type ApiError, unreachableStatus } from "@/shared/api/transport";
import { useCachedPreload } from "@/shared/lib/use-cached-preload";
import { useSessionStore } from "@/shared/session/session-store";

import { loadCachedEntitlement, persistCachedEntitlement } from "./entitlement-cache";

// ⚠ @doc DEC-045 — persistir a última resposta do servidor NÃO move o portão: é a palavra dele
//   em cache, não flag de cliente, e a escrita sobre um `active` velho ainda leva 403.

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
    const cached = useCachedPreload(
        loadCachedEntitlement,
        // `uid!`: safe — `enabled` below gates the actual call, so this is never dereferenced while
        // undefined; it only needs to be a stable dep for the reset-on-change effect.
        [uid!] as const,
        !!uid,
        "[cache] pre-carregamento de entitlement falhou; seguindo pela rede",
    );

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
                throw unreachableStatus("getEntitlementApiV1EntitlementGet");
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
