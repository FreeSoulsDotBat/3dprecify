import { del, get, set } from "idb-keyval";

import type { SnapshotOut } from "@/shared/api/generated";

// 009/T013 (E4, PR-A) — the uid-keyed READ cache for the Histórico (US2: readable offline).
//
// Same substrate and same rules as the catalog/kit caches: uid-scoped key (a shared device can
// never surface one account's ledger under the other's uid), no seed (the Histórico is user data —
// empty until the first online read), shape-guarded on read, swept on sign-out.
//
// And the same DELIBERATE difference from the OUTBOX that sits next to it: this cache SWALLOWS
// write failures, because it is a convenience — every row in it already exists on the server. The
// outbox must never swallow one, because a queued row exists NOWHERE else.

/** IndexedDB key — uid-scoped (FR-309 identity-leak lesson). */
export function historyIdbKey(uid: string): string {
  return `history:snapshots:${uid}`;
}

/** A stored payload is trusted only if it is an array of rows each carrying a string `id`. */
function isSnapshotArray(raw: unknown): raw is SnapshotOut[] {
  return (
    Array.isArray(raw) &&
    raw.every(
      (x) => typeof x === "object" && x !== null && typeof (x as { id?: unknown }).id === "string",
    )
  );
}

/** The uid's cached ledger; null on empty/error/corrupt (never a broken list fed to the UI). */
export async function loadCachedSnapshots(uid: string): Promise<SnapshotOut[] | null> {
  try {
    const raw = await get(historyIdbKey(uid));
    return isSnapshotArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Best-effort persist — the cache is a convenience, never authoritative. */
export async function persistCachedSnapshots(uid: string, items: SnapshotOut[]): Promise<void> {
  try {
    await set(historyIdbKey(uid), items);
  } catch {
    /* a ledger that failed to cache is simply re-read online next time */
  }
}

/** Part of the sign-out privacy sweep. */
export async function purgeHistoryCache(uid: string): Promise<void> {
  try {
    await del(historyIdbKey(uid));
  } catch {
    /* a failed purge must never crash the sign-out flow */
  }
}
