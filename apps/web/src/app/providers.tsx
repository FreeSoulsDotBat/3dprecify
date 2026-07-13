import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { BOM_QUERY_ROOT, purgeBomCache } from "@/entities/bom/bom-cache";
import { CATALOG_QUERY_ROOT, purgeCatalogCache } from "@/entities/catalog/catalog-cache";
import { purgeOutbox } from "@/entities/history/outbox";
import { HISTORY_QUERY_ROOT } from "@/entities/history/use-history";
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
      const wentAnonymous = state.status === "anonymous" && prev.status !== "anonymous";
      const uidChanged = !!prev.user?.uid && prev.user.uid !== state.user?.uid;
      if (wentAnonymous || uidChanged) {
        queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
        // Catalog isolation (FR-309/Q2 identity-leak lesson): evict the previous account's
        // uid-keyed queries AND sweep its persisted device cache so a signed-out (or swapped)
        // account can never linger in memory or IndexedDB. Best-effort — never blocks sign-out.
        queryClient.removeQueries({ queryKey: CATALOG_QUERY_ROOT });
        // Saved kits are the same kind of user data and get the same sweep (E3/T014) — a kit list
        // left behind on a shared device would leak exactly what the catalog sweep prevents.
        queryClient.removeQueries({ queryKey: BOM_QUERY_ROOT });
        // The Histórico joins the same sweep (E4/T011) — and it is the one store where the sweep
        // can DESTROY data, not just a rebuildable cache: an unsynced record exists nowhere else.
        // That is exactly why sign-out is now guarded (features/history/sign-out-outbox-guard):
        // by the time this runs, the seller has already been asked and has chosen. The purge
        // itself must therefore stay unconditional — it is the privacy guarantee.
        queryClient.removeQueries({ queryKey: HISTORY_QUERY_ROOT });
        if (prev.user?.uid) {
          void purgeCatalogCache(prev.user.uid);
          void purgeBomCache(prev.user.uid);
          void purgeOutbox(prev.user.uid);
        }
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
