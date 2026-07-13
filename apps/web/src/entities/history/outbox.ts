import { del, get, set } from "idb-keyval";

import type { SnapshotIn, SnapshotOut } from "@/shared/api/generated";

// 009/T009 (E4, PR-A) — THE OFFLINE OUTBOX (ADR-0018). The product's FIRST offline write.
//
// Every write in E2/E3 is online-only, and the only offline substrate that exists is a uid-keyed
// READ cache. This module reuses that SUBSTRATE (`idb-keyval`, uid-keyed, purged on sign-out) but
// deliberately NOT its semantics:
//
//   the read cache swallows write failures by design — "the cache is a convenience, never
//   authoritative". THE OUTBOX MUST NOT. It is the ONLY copy of the seller's quote, so a swallowed
//   failure would drop a record while the UI cheerfully says "pendente".
//
// The honesty rules encoded below (each one prevents a lie, not a crash):
//
//   * A LOST RESPONSE IS NOT A FAILURE. `status === 0` means no answer came back — the write may
//     well have landed. The entry stays PENDING and is retried with the SAME idempotency key, which
//     the server resolves to the row it already created. *No answer is not the same as not saved.*
//
//   * A 403 AT SYNC ⇒ BLOCKED, retained and visible. An offline client cannot check entitlement —
//     the server is the authority (Principle IV) — so the denial can only arrive here. It is never
//     silently discarded: the seller decides (retry or discard).
//
//   * A 404 ⇒ the seller DELETED it elsewhere. Dropping the queued entry is not a silent data loss;
//     it is their own later deletion winning (ADR-0018 §5). Resurrecting it would be the one
//     outcome nobody could defend.
//
//   * EXACTLY-ONCE lives in the DATABASE, not here. `clientSnapshotId` is minted at RECORD time
//     (minting at send time would regenerate after an app restart and DUPLICATE) and the unique
//     constraint does the rest. This module never has to be clever about it.

export type SyncState = "synced" | "pending" | "blocked" | "failed";

/** A queued record: the COMPLETE POST body, frozen at record time. Never re-derived, never
 *  recomputed, never patched at send time — the device clock and the idempotency key are part of
 *  the frozen body. */
export interface OutboxEntry {
  clientSnapshotId: string;
  body: SnapshotIn;
  syncState: Exclude<SyncState, "synced">;
  attempts: number;
  lastStatus?: number;
}

/** IndexedDB key — uid-scoped, so a device shared by two accounts never crosses them. */
export function historyOutboxKey(uid: string): string {
  return `history:outbox:${uid}`;
}

function isOutboxArray(raw: unknown): raw is OutboxEntry[] {
  return (
    Array.isArray(raw) &&
    raw.every(
      (x) =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as { clientSnapshotId?: unknown }).clientSnapshotId === "string",
    )
  );
}

/** Read the queue. A corrupt or foreign shape is discarded rather than fed to the UI. */
export async function listOutbox(uid: string): Promise<OutboxEntry[]> {
  try {
    const raw = await get(historyOutboxKey(uid));
    return isOutboxArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Persist the queue. Deliberately NOT wrapped in try/catch — a failure here MUST surface. */
async function writeOutbox(uid: string, entries: OutboxEntry[]): Promise<void> {
  await set(historyOutboxKey(uid), entries);
}

/**
 * Queue a snapshot. **Throws** if the device cannot store it — the record action has to be able to
 * tell the seller it did NOT queue, rather than show "pendente" over nothing.
 */
export async function enqueueSnapshot(uid: string, body: SnapshotIn): Promise<OutboxEntry> {
  const existing = await listOutbox(uid);
  const entry: OutboxEntry = {
    clientSnapshotId: String(body.clientSnapshotId),
    body,
    syncState: "pending",
    attempts: 0,
  };
  await writeOutbox(uid, [
    ...existing.filter((e) => e.clientSnapshotId !== entry.clientSnapshotId),
    entry,
  ]);
  return entry;
}

/** Part of the sign-out privacy sweep — the queue never leaks into the next account. */
export async function purgeOutbox(uid: string): Promise<void> {
  try {
    await del(historyOutboxKey(uid));
  } catch {
    /* a failed purge must never crash the sign-out flow */
  }
}

export interface DrainDeps {
  /** POSTs one frozen body. Resolves on 201 (created) AND on 200 (idempotent replay) alike. */
  post: (body: SnapshotIn) => Promise<SnapshotOut>;
  /** Set when the entitlement just became `active` again: blocked entries are retried. */
  retryBlocked?: boolean;
}

/**
 * Drain the queue. Entries are INDEPENDENT — a failing entry never blocks the ones behind it.
 *
 * Correctness does not rest on this function: the DB's unique key is what makes a retry idempotent.
 * A caller may therefore drain from several triggers (boot, `online`, focus, post-sign-in) and even
 * from two tabs without risking a duplicate; a Web Lock around the call only avoids wasted requests.
 */
export async function drainOutbox(uid: string, deps: DrainDeps): Promise<void> {
  const entries = await listOutbox(uid);
  const remaining: OutboxEntry[] = [];

  for (const entry of entries) {
    // A permanent rejection is never auto-retried; a blocked entry waits for the seller (or for
    // premium to come back).
    if (entry.syncState === "failed" || (entry.syncState === "blocked" && !deps.retryBlocked)) {
      remaining.push(entry);
      continue;
    }

    try {
      await deps.post(entry.body);
      // Accepted — 201 (created) or 200 (the server returned the row it already had). Identical to
      // the client: the record is on the server, so the queue entry has done its job.
    } catch (error) {
      const status = (error as { status?: number }).status ?? 0;
      const attempts = entry.attempts + 1;

      if (status === 404) continue; // deleted elsewhere by the seller — drop quietly (§5)

      if (status === 403) {
        remaining.push({ ...entry, syncState: "blocked", attempts, lastStatus: status });
      } else if (status === 422) {
        remaining.push({ ...entry, syncState: "failed", attempts, lastStatus: status });
      } else {
        // Includes status 0 (no response): the write may have landed. PENDING, never "falhou".
        remaining.push({ ...entry, syncState: "pending", attempts, lastStatus: status });
      }
    }
  }

  await writeOutbox(uid, remaining);
}

/** One row of the Histórico, whether it lives on the server or is still on this device. */
export interface HistoryItem {
  /** Null while pending — an unsynced entry has no server id and must not pretend to. */
  id: string | null;
  clientSnapshotId: string;
  kind: string;
  label: string | null;
  headlineTotal: string;
  headlineBasis: string;
  deviceQuotedAt: string;
  syncState: SyncState;
  /** The full server row, when synced. */
  snapshot: SnapshotOut | null;
  /** The queued entry, when not. */
  entry: OutboxEntry | null;
}

/**
 * THE LIST IS THE UNION. (server) ∪ (outbox), deduped on `clientSnapshotId`, **server-wins**.
 *
 * This is structural, not cosmetic: **no component may read the server query alone.** It is the
 * direct answer to the E3 PR-C lesson — *a correct component starved of correct data still lies* —
 * where a correct degraded-line component rendered a deleted product as live because it was fed a
 * stale cache. Here, no interleaving of "drain removed the entry" and "the query was invalidated"
 * can render a row twice or show a synced row as pending: whichever side is fresher, server wins on
 * the key, and a still-queued entry is still shown.
 *
 * Pending entries sit in their CHRONOLOGICAL place, newest-first by the DEVICE's date — the date
 * that IS the seller's claim. They are never hidden away in a separate drawer (that would read as
 * "draft") and never collapsed into a counter chip (that would be the silent drop).
 */
export function mergeHistory(server: SnapshotOut[], outbox: OutboxEntry[]): HistoryItem[] {
  const syncedKeys = new Set(server.map((s) => String(s.clientSnapshotId)));

  const fromServer: HistoryItem[] = server.map((s) => ({
    id: String(s.id),
    clientSnapshotId: String(s.clientSnapshotId),
    kind: s.kind,
    label: s.label ?? null,
    headlineTotal: String(s.headlineTotal),
    headlineBasis: s.headlineBasis,
    deviceQuotedAt: String(s.deviceQuotedAt),
    syncState: "synced",
    snapshot: s,
    entry: null,
  }));

  const fromOutbox: HistoryItem[] = outbox
    .filter((e) => !syncedKeys.has(e.clientSnapshotId))
    .map((e) => ({
      id: null,
      clientSnapshotId: e.clientSnapshotId,
      kind: e.body.kind,
      label: e.body.label ?? null,
      headlineTotal: String(e.body.headlineTotal),
      headlineBasis: e.body.headlineBasis,
      deviceQuotedAt: String(e.body.deviceQuotedAt),
      syncState: e.syncState,
      snapshot: null,
      entry: e,
    }));

  return [...fromServer, ...fromOutbox].sort((a, b) =>
    b.deviceQuotedAt.localeCompare(a.deviceQuotedAt),
  );
}
