import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { BOM_QUERY_ROOT, purgeBomCache } from "@/entities/bom/bom-cache";
import { CATALOG_QUERY_ROOT, purgeCatalogCache } from "@/entities/catalog/catalog-cache";
import { purgeHistoryCache } from "@/entities/history/history-cache";
import { HISTORY_QUERY_ROOT } from "@/entities/history/use-history";
import { purgeScenarioCache, SCENARIO_QUERY_ROOT } from "@/entities/scenario/scenario-cache";
import { purgeEntitlementCache } from "@/entities/user/entitlement-cache";
import { ENTITLEMENT_QUERY_KEY } from "@/entities/user/use-entitlement";
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
                // The Histórico READ cache joins the same in-memory sweep (E4/T011) — it is rebuildable
                // from the server, so evicting it is free.
                queryClient.removeQueries({ queryKey: HISTORY_QUERY_ROOT });
                // "Meus cenários" is the SAME kind of user data (010/T012, E5) — the same sweep, and the
                // same reason it is safe: the server holds no queue state, so evicting it is free (VR-612).
                queryClient.removeQueries({ queryKey: SCENARIO_QUERY_ROOT });
                // The persisted plan (009/T011b) is swept too: a device shared by two accounts must never
                // let one of them read — let alone act on — the other's premium.
                queryClient.removeQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
                if (prev.user?.uid) {
                    void purgeCatalogCache(prev.user.uid);
                    void purgeBomCache(prev.user.uid);
                    void purgeHistoryCache(prev.user.uid);
                    void purgeScenarioCache(prev.user.uid);
                    void purgeEntitlementCache(prev.user.uid);
                    // NOTE (review PR-A, B3): the OUTBOX is deliberately NOT purged here. It is the ONLY copy
                    // of a quote that never reached the account, and this subscription ALSO fires on
                    // INVOLUNTARY transitions the sign-out guard never mediated — a revoked/expired token
                    // makes the Firebase SDK auto-sign-out (onIdTokenChanged(null)) with no dialog, no toast.
                    // Purging here would silently destroy the seller's work (ADR-0018 §10). The uid-keyed
                    // outbox (`history:outbox:{uid}`) cannot leak cross-account, so retaining it is safe; the
                    // ONLY place it is purged is the guard's explicit "descartar" branch, where the seller
                    // chose it. On the next sign-in of the same uid it reappears and drains.
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
