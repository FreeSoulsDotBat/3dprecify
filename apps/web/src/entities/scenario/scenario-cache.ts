import { del, get, set } from "idb-keyval";

import type { ScenarioOut } from "@/shared/api/generated";

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

/** A stored payload is trusted only if it is an array of rows each carrying a string `id`. */
function isScenarioArray(raw: unknown): raw is ScenarioOut[] {
    return (
        Array.isArray(raw) &&
        raw.every(
            (x) =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as { id?: unknown }).id === "string",
        )
    );
}

/** The uid's cached (unfiltered) scenario list; null on empty/error/corrupt — never a broken list
 *  fed to the UI. */
export async function loadCachedScenarios(uid: string): Promise<ScenarioOut[] | null> {
    try {
        const raw = await get(scenarioIdbKey(uid));
        return isScenarioArray(raw) ? raw : null;
    } catch {
        return null;
    }
}

/** Best-effort persist — the cache is a convenience, never authoritative (a write failure is
 *  swallowed; the online read still answered). */
export async function persistCachedScenarios(uid: string, items: ScenarioOut[]): Promise<void> {
    try {
        await set(scenarioIdbKey(uid), items);
    } catch {
        /* a list that failed to cache is simply re-read online next time */
    }
}

/** Part of the sign-out privacy sweep (`app/providers.tsx`). */
export async function purgeScenarioCache(uid: string): Promise<void> {
    try {
        await del(scenarioIdbKey(uid));
    } catch {
        /* a failed purge must never crash the sign-out flow */
    }
}
