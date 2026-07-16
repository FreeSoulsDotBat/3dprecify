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

// EVERY read-modify-write of the queue runs under this lock (ADR-0018 §6).
//
// This is not defensive plumbing — it fixes a real record-destroying bug the T016 visual
// homologation caught. The drain used to read the queue, POST (slow), then write back the list it
// had computed BEFORE the round-trip. Anything the seller recorded in that window was not in that
// list, so the write-back ERASED it — while the UI had already said "Pendente neste dispositivo".
// A false pending is the worst lie this feature can tell, and the DB's unique key cannot catch it:
// that key prevents DUPLICATES, not a record that is never POSTed at all.
//
// `navigator.locks` serializes across TABS; the promise chain serializes within one tab and covers
// browsers (and jsdom) where the Web Locks API is absent. The critical section stays SHORT — no
// network call ever happens inside it.
let tabChain: Promise<unknown> = Promise.resolve();

async function withOutboxLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as { locks?: LockManager }).locks;
  const run = async (): Promise<T> =>
    locks ? ((await locks.request(historyOutboxKey(uid), fn)) as T) : fn();
  const next: Promise<T> = tabChain.then(run, run);
  tabChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Queue a snapshot. **Throws** if the device cannot store it — the record action has to be able to
 * tell the seller it did NOT queue, rather than show "pendente" over nothing.
 */
export async function enqueueSnapshot(uid: string, body: SnapshotIn): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    clientSnapshotId: String(body.clientSnapshotId),
    body,
    syncState: "pending",
    attempts: 0,
  };
  await withOutboxLock(uid, async () => {
    const existing = await listOutbox(uid);
    await writeOutbox(uid, [
      ...existing.filter((e) => e.clientSnapshotId !== entry.clientSnapshotId),
      entry,
    ]);
  });
  return entry;
}

/** Drop ONE entry, re-reading the queue inside the lock so a concurrent enqueue survives. */
async function removeEntry(uid: string, clientSnapshotId: string): Promise<void> {
  try {
    await withOutboxLock(uid, async () => {
      const current = await listOutbox(uid);
      await writeOutbox(
        uid,
        current.filter((e) => e.clientSnapshotId !== clientSnapshotId),
      );
    });
  } catch {
    // The entry is already on the server; a failed write-back only means it will be replayed, and
    // the replay is idempotent. Never surface this as a recording failure.
  }
}

/** Update ONE entry in place, same re-read-inside-the-lock discipline. */
async function updateEntry(
  uid: string,
  clientSnapshotId: string,
  patch: (entry: OutboxEntry) => OutboxEntry,
): Promise<void> {
  try {
    await withOutboxLock(uid, async () => {
      const current = await listOutbox(uid);
      await writeOutbox(
        uid,
        current.map((e) => (e.clientSnapshotId === clientSnapshotId ? patch(e) : e)),
      );
    });
  } catch {
    // The entry keeps its previous state and is retried later — never dropped.
  }
}

/** Part of the sign-out privacy sweep — the queue never leaks into the next account. */
export async function purgeOutbox(uid: string): Promise<void> {
  try {
    await withOutboxLock(uid, () => del(historyOutboxKey(uid)));
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
 * Settle ONE entry against the server and return its FINAL state — read DIRECTLY from the send
 * outcome, never re-inferred by re-reading the queue.
 *
 * That directness is the fix for the "false salvo" (review PR-A, M1): the record path used to POST,
 * then re-read the queue and treat "not there ⇒ the server has it". But `listOutbox` returns `[]` on
 * ANY read error, so a glitched re-read reported `synced` over a record the server never accepted —
 * the worst lie this feature can tell. Here `synced` is returned ONLY when `post` actually resolved;
 * an unconfirmable send stays `pending`.
 *
 * PR-B (M5): a status-0 (lost response) MUST stay `pending` and be retried — it may have landed. The
 * coming backoff/cap policy may space retries out, but it must NEVER flip a status 0 to `failed`.
 */
export async function settleEntry(
  uid: string,
  entry: OutboxEntry,
  deps: DrainDeps,
): Promise<SyncState> {
  try {
    await deps.post(entry.body);
    // Accepted — 201 (created) or 200 (the server returned the row it already had). Identical to
    // the client: the record is on the server, so the queue entry has done its job.
    await removeEntry(uid, entry.clientSnapshotId);
    return "synced";
  } catch (error) {
    const status = (error as { status?: number }).status ?? 0;

    // Deleted elsewhere by the seller — drop quietly (§5). It is gone from the account AND the
    // queue, so there is nothing left to report as unsent. (Unreachable on a first-time record: a
    // just-minted id the server has never seen cannot 404.)
    if (status === 404) {
      await removeEntry(uid, entry.clientSnapshotId);
      return "synced";
    }

    const syncState: OutboxEntry["syncState"] =
      status === 403
        ? "blocked"
        : status === 422
          ? "failed"
          : // Includes status 0 (no response): the write may have landed. PENDING, never "falhou".
            "pending";

    await updateEntry(uid, entry.clientSnapshotId, (current) => ({
      ...current,
      syncState,
      attempts: current.attempts + 1,
      lastStatus: status,
    }));
    return syncState;
  }
}

/**
 * Drain the queue. Entries are INDEPENDENT — a failing entry never blocks the ones behind it.
 *
 * Returns each processed entry's FINAL `SyncState`, keyed by `clientSnapshotId`, so a caller (the
 * record action) can read the outcome of ITS entry without a lying re-read (M1). An entry the drain
 * never reached — because the queue read itself failed — is simply absent from the map, and the
 * caller treats "absent" as `pending`, never `synced`.
 *
 * Each entry is settled ON ITS OWN, under the lock, against the queue as it stands AT THAT MOMENT.
 * The earlier shape — read the whole list, post, write the list back — destroyed any record queued
 * during the round-trip (T016/B2): it wrote a list computed before the seller had even tapped Save.
 *
 * Correctness of the SEND does not rest on this function either: the DB's unique key is what makes a
 * retry idempotent. A caller may drain from several triggers (boot, `online`, focus, post-sign-in)
 * and even from two tabs without risking a duplicate.
 */
export async function drainOutbox(
  uid: string,
  deps: DrainDeps,
): Promise<Record<string, SyncState>> {
  const entries = await listOutbox(uid);
  const results: Record<string, SyncState> = {};

  for (const entry of entries) {
    // A permanent rejection is never auto-retried; a blocked entry waits for the seller (or for
    // premium to come back). Untouched — not rewritten, not reordered — but its existing state is
    // still recorded so the caller can read the target's outcome.
    if (entry.syncState === "failed" || (entry.syncState === "blocked" && !deps.retryBlocked)) {
      results[entry.clientSnapshotId] = entry.syncState;
      continue;
    }

    results[entry.clientSnapshotId] = await settleEntry(uid, entry, deps);
  }

  return results;
}

/**
 * Re-send ONE entry on demand — the [Tentar novamente] action a `blocked`/`failed` entry needs so it
 * is not a dead end (review PR-A, B2). Reset to `pending` under the lock, then settle it. Returns the
 * resulting state (or `pending` if it could not be re-read — never a fabricated `synced`).
 */
export async function retryEntry(
  uid: string,
  clientSnapshotId: string,
  deps: DrainDeps,
): Promise<SyncState> {
  await updateEntry(uid, clientSnapshotId, (current) => ({ ...current, syncState: "pending" }));
  const entry = (await listOutbox(uid)).find((e) => e.clientSnapshotId === clientSnapshotId);
  if (!entry) return "pending"; // could not re-read it — never claim it was accepted
  return settleEntry(uid, entry, deps);
}

/**
 * Discard ONE entry — the [Descartar] action. The seller's EXPLICIT choice (always confirmed at the
 * UI), never automatic: a blocked/failed record is retained until they decide (ADR-0018 §9).
 */
export async function discardEntry(uid: string, clientSnapshotId: string): Promise<void> {
  await removeEntry(uid, clientSnapshotId);
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
