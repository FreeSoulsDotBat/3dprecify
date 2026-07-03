import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { type CurrentUser } from "@/shared/api/generated";
import { ApiError, apiFetch } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import { toUserIdentity, type UserIdentity } from "./user";

// Post-login server-confirmed identity (T068, decision A23). The query fires the
// `/api/v1/me` call THROUGH the T067 transport wrapper (fresh ID token per request,
// typed ApiError on failure) — so the shell renders the identity the server actually
// acknowledged, not the client Firebase session. Gated on `authenticated`: it never
// fires signed-out. `retry: false` so a 401/expired session surfaces the re-login
// message immediately instead of spinning (the Conta page maps the error to pt-BR).
//
// Kept on the ergonomic `apiFetch<CurrentUser>` rather than the now-transport-backed
// generated `getMeApiV1MeGet`: the generated hook's success type is the envelope
// `{ data: CurrentUser | HTTPValidationError, … }` (the 422 union is a phantom from the
// OpenAPI, an A21 backend fix out of this slice), forcing a `.data as CurrentUser` cast
// and losing the clean `ApiError` error typing. `apiFetch` gives `CurrentUser` + `ApiError`
// directly. Both paths share the exact same A20 transport core, so nothing observability-
// or auth-wise differs — this is purely the cleaner call ergonomics.

export const ME_QUERY_KEY = ["me"] as const;

export function useIdentity(): UseQueryResult<UserIdentity, ApiError> {
  const status = useSessionStore((s) => s.status);
  return useQuery<UserIdentity, ApiError>({
    queryKey: ME_QUERY_KEY,
    enabled: status === "authenticated",
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => toUserIdentity(await apiFetch<CurrentUser>("/api/v1/me")),
  });
}
