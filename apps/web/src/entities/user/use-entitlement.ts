import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { type EntitlementView, getEntitlementApiV1EntitlementGet } from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

// E2/T025b (FR-304) — the account's own plan state from GET /api/v1/entitlement (ADR-0012
// R1b). Server-derived, never fabricated: the Conta page renders exactly what this returns
// (none/active/lapsed) or an honest unknown on error. uid-keyed like ["me"] (D1) so a
// re-login as a different user never reads the previous user's cached plan.

export const ENTITLEMENT_QUERY_KEY = ["entitlement"] as const;

export function useEntitlement(): UseQueryResult<EntitlementView, ApiError> {
  const status = useSessionStore((s) => s.status);
  const uid = useSessionStore((s) => s.user?.uid);
  return useQuery<EntitlementView, ApiError>({
    queryKey: [...ENTITLEMENT_QUERY_KEY, uid],
    enabled: status === "authenticated" && !!uid,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await getEntitlementApiV1EntitlementGet();
      // The transport throws a typed ApiError on any non-2xx — only 200 reaches here.
      if (res.status !== 200) {
        throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
      }
      return res.data;
    },
  });
}
