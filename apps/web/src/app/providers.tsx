import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { ME_QUERY_KEY } from "@/entities/user/use-identity";
import { useSessionStore } from "@/shared/session/session-store";
import { Toaster } from "@/shared/ui";

export const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  // Belt-and-suspenders identity isolation (D1). The /me query is keyed by uid so a
  // re-login as a different user can never read the previous user's cached identity;
  // this app-layer subscription ALSO evicts the ["me"] cache the moment the session goes
  // anonymous, so a signed-out identity can never linger in the shared client. It lives
  // HERE (not in the shared session-store) because eviction needs the QueryClient, and
  // shared must not import from app (FSD-Lite boundary) — so the app layer OBSERVES the
  // shared store instead. `removeQueries({ queryKey: ["me"] })` is fuzzy, so it clears
  // every ["me", uid] entry.
  useEffect(() => {
    return useSessionStore.subscribe((state, prev) => {
      if (state.status === "anonymous" && prev.status !== "anonymous") {
        queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      }
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Global toast queue (T020). Mapped from ErrorCode → pt-BR at call sites (T055). */}
      <Toaster />
    </QueryClientProvider>
  );
}
