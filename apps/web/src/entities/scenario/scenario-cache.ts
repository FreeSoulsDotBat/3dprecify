import type { ScenarioOut } from "@/shared/api/generated";
import { createUidCache, isIdentifiedRowArray } from "@/shared/lib/uid-cache";

// 010/T012 (E5, PR-A) — the uid-keyed READ cache for "Meus cenários" (US2: readable offline).
//
// Same substrate and same rules as the catalog/history caches (FR-309 identity-leak lesson): a
// uid-scoped key so a shared device can never surface one account's scenarios under another's uid,
// no seed (scenarios are user data — empty until the first online read), shape-guarded on read,
// swept on sign-out.
//
// And the SAME deliberate difference the catalog cache has from the history OUTBOX (which this
// entity has none of, VR-612/FR-613 — a scenario write has NO offline path): this cache swallows
// write failures because it is a pure convenience — every row in it already exists on the server.
// (019/polish: the load/persist/purge primitives themselves are shared via `shared/lib/uid-cache`.)

/** IndexedDB key — uid-scoped (FR-309 identity-leak lesson). */
export function scenarioIdbKey(uid: string): string {
    return `scenarios:${uid}`;
}

/** TanStack Query key — uid-scoped, mirrors the catalog/history query-key idiom. */
export function scenarioQueryKey(uid: string | undefined) {
    return ["scenarios", uid] as const;
}

/** Fuzzy root key — `removeQueries({ queryKey: SCENARIO_QUERY_ROOT })` clears every uid entry. */
export const SCENARIO_QUERY_ROOT = ["scenarios"] as const;

const cache = createUidCache<ScenarioOut[]>({
    key: scenarioIdbKey,
    guard: isIdentifiedRowArray<ScenarioOut>,
});

/** The uid's cached (unfiltered) scenario list; null on empty/error/corrupt — never a broken list
 *  fed to the UI. */
export async function loadCachedScenarios(uid: string): Promise<ScenarioOut[] | null> {
    return cache.load(uid);
}

/** Best-effort persist — the cache is a convenience, never authoritative (a write failure is
 *  swallowed; the online read still answered). */
export async function persistCachedScenarios(uid: string, items: ScenarioOut[]): Promise<void> {
    return cache.persist(items, uid);
}

/** Part of the sign-out privacy sweep (`app/providers.tsx`). */
export async function purgeScenarioCache(uid: string): Promise<void> {
    return cache.purge(uid);
}
