// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }));
vi.mock("idb-keyval", () => ({
    get: vi.fn(async (k: string) => idbStore.get(k)),
    set: vi.fn(async (k: string, v: unknown) => {
        idbStore.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
        idbStore.delete(k);
    }),
}));

import { BOM_QUERY_ROOT, bomIdbKey } from "@/entities/bom/bom-cache";
import { CATALOG_QUERY_ROOT, catalogIdbKey } from "@/entities/catalog/catalog-cache";
import { historyIdbKey } from "@/entities/history/history-cache";
import { historyOutboxKey } from "@/entities/history/outbox";
import { HISTORY_QUERY_ROOT } from "@/entities/history/use-history";
import { scenarioIdbKey, SCENARIO_QUERY_ROOT } from "@/entities/scenario/scenario-cache";
import { entitlementIdbKey } from "@/entities/user/entitlement-cache";
import { ENTITLEMENT_QUERY_KEY } from "@/entities/user/use-entitlement";
import { ME_QUERY_KEY } from "@/entities/user/use-identity";
import { useSessionStore } from "@/shared/session/session-store";

import { AppProviders, queryClient } from "./providers";

// 009 (E4, PR-A) — B3, written FAILING-first. The app-layer subscription sweeps uid-keyed stores on
// any transition to `anonymous`. That is a privacy guarantee for READ caches (rebuildable), but the
// OUTBOX is the ONLY copy of a quote that never reached the account — and this subscription ALSO
// fires on transitions the sign-out guard never mediated (a revoked token auto-signs-out the SDK).
// Purging the outbox here would silently destroy the seller's work (ADR-0018 §10). The uid key keeps
// it from leaking cross-account, so it is retained; only the guard's explicit discard purges it.

beforeEach(() => {
    vi.clearAllMocks();
    idbStore.clear();
    useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

describe("an INVOLUNTARY sign-out never destroys the only copy of a quote", () => {
    it("retains the uid-keyed outbox while still sweeping the rebuildable read caches", async () => {
        idbStore.set(historyOutboxKey("u1"), [{ clientSnapshotId: "a" }]);
        idbStore.set("entitlement:u1", { status: "active" });

        render(
            <AppProviders>
                <div />
            </AppProviders>,
        );

        // A token revocation flips the SDK to anonymous WITHOUT passing through requestSignOut/the guard.
        await act(async () => {
            useSessionStore.setState({ status: "anonymous", user: null });
            await Promise.resolve();
        });

        // The rebuildable read cache IS swept (privacy) — proof the sweep ran at all.
        await waitFor(() => expect(idbStore.has("entitlement:u1")).toBe(false));
        // The outbox — the ONLY copy of an unsynced quote — survives. Its uid key prevents any leak.
        expect(idbStore.has(historyOutboxKey("u1"))).toBe(true);
    });
});

// --- T050 (013 audit remediation, finding T-02) --------------------------------------------------
// The privacy sweep (`providers.tsx:26-63`) is currently proven only for the ["anonymous", the
// outbox-vs-rest split] shape — every OTHER idb key + query root is asserted only by whether the
// sweep "ran at all" (one representative key). Two gaps this closes:
//   (a) every one of the 5 idb stores + all 6 query roots is asserted BY NAME, so a regression that
//       drops (or never adds) any single one of them is caught — never masked by a passing neighbour;
//   (b) the `uidChanged` branch (u1 -> u2 DIRECTLY, no intervening `anonymous`) has NEVER been
//       exercised — `providers.tsx:29`'s `||` has a dead half until now.

// 019/PR-D (T127) — `entities/catalog/price-observations.ts` deliberadamente NÃO ganha cache de
// dispositivo (leia o comentário do módulo): não há `priceObservationsIdbKey`, e a query key não
// entra nas tabelas abaixo porque não há nada a purgar. A ausência é o próprio contrato — a
// asserção que a mantém verdadeira é o prefixo genérico: se algum dia alguém adicionar uma chave IDB
// para observações, ela aparece aqui e os dois testes T050 abaixo (que enumeram TODAS as chaves)
// passam a falhar até serem atualizados a propósito.
const PRICE_OBSERVATIONS_IDB_PREFIX = "price-observations";

/** Seed all 5 idb-keyed caches + the outbox + all 6 query roots for a given uid. */
function seedEverythingFor(uid: string): void {
    idbStore.set(bomIdbKey(uid), [{ id: "bom-1" }]);
    idbStore.set(catalogIdbKey("filaments", uid), [{ id: "fil-1" }]);
    idbStore.set(catalogIdbKey("printers", uid), [{ id: "prt-1" }]);
    idbStore.set(catalogIdbKey("products", uid), [{ id: "prod-1" }]);
    idbStore.set(historyIdbKey(uid), [{ id: "snap-1" }]);
    idbStore.set(scenarioIdbKey(uid), [{ id: "scn-1" }]);
    idbStore.set(entitlementIdbKey(uid), { status: "active" });
    idbStore.set(historyOutboxKey(uid), [{ clientSnapshotId: `outbox-${uid}` }]);

    queryClient.setQueryData([...ME_QUERY_KEY, uid], { uid });
    queryClient.setQueryData([...CATALOG_QUERY_ROOT, "filaments", uid], [{ id: "fil-1" }]);
    queryClient.setQueryData([...BOM_QUERY_ROOT, uid], [{ id: "bom-1" }]);
    queryClient.setQueryData([...HISTORY_QUERY_ROOT, uid], [{ id: "snap-1" }]);
    queryClient.setQueryData([...SCENARIO_QUERY_ROOT, uid], [{ id: "scn-1" }]);
    queryClient.setQueryData([...ENTITLEMENT_QUERY_KEY, uid], { status: "active" });
}

function idbKeysFor(uid: string): Record<string, string> {
    return {
        bom: bomIdbKey(uid),
        catalogFilaments: catalogIdbKey("filaments", uid),
        catalogPrinters: catalogIdbKey("printers", uid),
        catalogProducts: catalogIdbKey("products", uid),
        history: historyIdbKey(uid),
        scenario: scenarioIdbKey(uid),
        entitlement: entitlementIdbKey(uid),
    };
}

function queryDataFor(uid: string): Record<string, unknown> {
    return {
        me: queryClient.getQueryData([...ME_QUERY_KEY, uid]),
        catalog: queryClient.getQueryData([...CATALOG_QUERY_ROOT, "filaments", uid]),
        bom: queryClient.getQueryData([...BOM_QUERY_ROOT, uid]),
        history: queryClient.getQueryData([...HISTORY_QUERY_ROOT, uid]),
        scenario: queryClient.getQueryData([...SCENARIO_QUERY_ROOT, uid]),
        entitlement: queryClient.getQueryData([...ENTITLEMENT_QUERY_KEY, uid]),
    };
}

describe("T050 — the privacy sweep purges every named store, per key (finding T-02)", () => {
    it("(a) transition -> anonymous purges every idb key + query root EXCEPT the outbox", async () => {
        seedEverythingFor("u1");

        render(
            <AppProviders>
                <div />
            </AppProviders>,
        );

        await act(async () => {
            useSessionStore.setState({ status: "anonymous", user: null });
            await Promise.resolve();
        });

        const idbKeys = idbKeysFor("u1");
        await waitFor(() => {
            for (const [name, key] of Object.entries(idbKeys)) {
                expect(idbStore.has(key), `idb key "${name}" (${key}) should be purged`).toBe(
                    false,
                );
            }
        });
        // Named per query root — never a bulk/count assertion.
        const remaining = queryDataFor("u1");
        for (const [name, value] of Object.entries(remaining)) {
            expect(value, `query data "${name}" should be evicted`).toBeUndefined();
        }
        // The ONLY store never purged by this subscription.
        expect(idbStore.has(historyOutboxKey("u1"))).toBe(true);
        // price-observations never had a device cache to begin with — nothing appears to purge.
        expect(
            Array.from(idbStore.keys()).some((k) => k.startsWith(PRICE_OBSERVATIONS_IDB_PREFIX)),
        ).toBe(false);
    });

    it("(b) u1 -> u2 DIRECTLY (no intervening anonymous) purges u1's data via the uidChanged branch", async () => {
        seedEverythingFor("u1");
        seedEverythingFor("u2");

        render(
            <AppProviders>
                <div />
            </AppProviders>,
        );

        // NO transition through "anonymous" — straight to a different uid, still "authenticated".
        await act(async () => {
            useSessionStore.setState({ status: "authenticated", user: { uid: "u2" } as never });
            await Promise.resolve();
        });

        const u1IdbKeys = idbKeysFor("u1");
        await waitFor(() => {
            for (const [name, key] of Object.entries(u1IdbKeys)) {
                expect(idbStore.has(key), `u1's idb key "${name}" (${key}) should be purged`).toBe(
                    false,
                );
            }
        });
        const u1Remaining = queryDataFor("u1");
        for (const [name, value] of Object.entries(u1Remaining)) {
            expect(value, `u1's query data "${name}" should be evicted`).toBeUndefined();
        }
        // u1's outbox is retained (same invariant as the anonymous path).
        expect(idbStore.has(historyOutboxKey("u1"))).toBe(true);

        // u2's own idb data — seeded above, never named in `purgeXCache(prev.user.uid)` (which only ever
        // takes the PREVIOUS uid, "u1") — survives untouched: proof the idb purge is scoped to the
        // previous account, not a global wipe. (The in-memory `removeQueries` calls are root-fuzzy by
        // design — see `providers.tsx:24-25` — so they evict every uid's entry under a root; only the
        // idb layer is asserted per-account here.)
        const u2IdbKeys = idbKeysFor("u2");
        for (const [name, key] of Object.entries(u2IdbKeys)) {
            expect(idbStore.has(key), `u2's idb key "${name}" (${key}) should survive`).toBe(true);
        }
        expect(idbStore.has(historyOutboxKey("u2"))).toBe(true);
        // No device cache exists for price-observations under EITHER account.
        expect(
            Array.from(idbStore.keys()).some((k) => k.startsWith(PRICE_OBSERVATIONS_IDB_PREFIX)),
        ).toBe(false);
    });
});
