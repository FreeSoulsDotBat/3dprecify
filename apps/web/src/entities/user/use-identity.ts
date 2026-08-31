import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getMeApiV1MeGet } from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import { toUserIdentity, type UserIdentity } from "./user";

// Post-login server-confirmed identity (T068, decision A23). The query fires the
// `/api/v1/me` call through the GENERATED client (TD-019 retired by 006/A21: the contract
// now publishes the honest 200|401 union — no phantom `HTTPValidationError`, no cast). The
// generated call rides the same A20 transport core (`orvalFetch`): fresh ID token per
// request, typed `ApiError` thrown on any non-2xx — so the shell renders the identity the
// server actually acknowledged, not the client Firebase session. Gated on `authenticated`:
// it never fires signed-out. `retry: false` so a 401/expired session surfaces the re-login
// message immediately instead of spinning (the Conta page maps the error to pt-BR).

export const ME_QUERY_KEY = ["me"] as const;

export function useIdentity(): UseQueryResult<UserIdentity, ApiError> {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);
    return useQuery<UserIdentity, ApiError>({
        // Keyed by uid (D1): a re-login as a DIFFERENT user gets a distinct cache entry, so the
        // shell can never read the previous user's cached identity within staleTime. `enabled`
        // also requires the uid so the query never fires with a partial `["me", undefined]` key.
        queryKey: [...ME_QUERY_KEY, uid],
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const res = await getMeApiV1MeGet();
            // The transport throws a typed ApiError on any non-2xx, so only the 200 branch of the
            // generated (honest) 200|401 union is reachable here — plain narrowing, no cast.
            if (res.status !== 200) {
                throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
            }
            return toUserIdentity(res.data);
        },
    });
}
