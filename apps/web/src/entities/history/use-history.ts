import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  type SnapshotIn,
  type SnapshotOut,
  listHistoryApiV1HistoryGet,
  recordSnapshotApiV1HistoryPost,
} from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import { loadCachedSnapshots, persistCachedSnapshots } from "./history-cache";
import {
  discardEntry,
  drainOutbox,
  enqueueSnapshot,
  listOutbox,
  mergeHistory,
  retryEntry,
  type HistoryItem,
  type OutboxEntry,
  type SyncState,
} from "./outbox";

// 009/T010 (E4, PR-A) — RECORDING a snapshot.
//
// ONE code path, online and offline. The record is ALWAYS queued durably first, then the queue is
// drained immediately. Online, the drain finishes inside the same interaction and the record comes
// back `synced`; offline, it stays `pending` and syncs itself later. There is no separate "offline
// branch" that could rot: the only difference between the two is whether the drain got an answer.
//
// Queue-then-drain (rather than post-then-queue-on-failure) is what makes the honesty possible. A
// post that never answers (`status === 0`) may well have LANDED — with post-first we would not know
// whether to queue it, and either choice lies. Queued first, the retry replays the same
// `clientSnapshotId` and the database's unique key resolves it to the row it already created.

export const HISTORY_QUERY_ROOT = ["history"] as const;

export const historyQueryKey = (uid: string | undefined) => ["history", "snapshots", uid] as const;
export const outboxQueryKey = (uid: string | undefined) => ["history", "outbox", uid] as const;

/** POSTs one frozen body. 201 (created) and 200 (idempotent replay) are the same to the client:
 *  the record is on the server. */
export async function postSnapshot(body: SnapshotIn): Promise<SnapshotOut> {
  const res = await recordSnapshotApiV1HistoryPost(body);
  // The transport throws a typed ApiError on any non-2xx, so only the accepted branches are
  // reachable — 201 (created) and 200 (the row the server already had for this idempotency key).
  if (res.status !== 201 && res.status !== 200) {
    throw new Error("unreachable: non-2xx surfaces as ApiError");
  }
  return res.data;
}

/** What actually happened, as the surface must report it — never softened, never inflated. */
export interface RecordOutcome {
  clientSnapshotId: string;
  syncState: SyncState;
}

export function useRecordSnapshot(): UseMutationResult<RecordOutcome, Error, SnapshotIn> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<RecordOutcome, Error, SnapshotIn>({
    // T016/B1 — the blocker the visual homologation found. TanStack's DEFAULT `networkMode:
    // "online"` PAUSES a mutation while the browser reports offline: `mutationFn` never runs, so
    // `enqueueSnapshot` never runs either. The seller tapped "Salvar" at the feira, nothing
    // happened, and a reload lost the quote FOREVER. ADR-0018 explicitly rejected paused mutations
    // as the sync strategy — and we inherited them anyway, by omission.
    //
    // Recording is a DEVICE-first write (ADR-0018 §1): it must reach IndexedDB whether or not there
    // is a network, and the drain that follows is what deals with connectivity. `"always"` is
    // therefore not a workaround, it is the actual semantics of this operation.
    networkMode: "always",
    mutationFn: async (body: SnapshotIn) => {
      // The queue is uid-keyed; there is nowhere to put a record that has no account.
      if (!uid) throw new Error("cannot record without a signed-in account");

      // Durable FIRST. This THROWS if the device cannot store it — and it must: the alternative is
      // telling the seller "pendente" over nothing at all.
      const entry = await enqueueSnapshot(uid, body);

      // Best-effort immediate send of the WHOLE queue (this record plus any prior pendings).
      // `drainOutbox` never throws — it classifies each failure into an honest state and returns
      // every processed entry's FINAL state, keyed by id.
      const settled = await drainOutbox(uid, { post: postSnapshot });

      // Read THIS entry's outcome straight from the drain — never by re-reading the queue and
      // inferring "gone ⇒ saved" (review PR-A, M1). If the drain could not even reach this entry
      // (its own queue read failed), it is ABSENT from the map, and "absent" is `pending`, never a
      // fabricated `synced`: an unconfirmed send is not a saved one.
      return {
        clientSnapshotId: entry.clientSnapshotId,
        syncState: settled[entry.clientSnapshotId] ?? "pending",
      };
    },
    onSettled: () => {
      // Both halves of the union (server list + queue) may have moved — even on failure, since the
      // record may be queued and merely unsent.
      void client.invalidateQueries({ queryKey: historyQueryKey(uid) });
      void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// 009/T013 — READING the Histórico.
// ---------------------------------------------------------------------------------------------

/** The read state the Histórico renders — the MERGED union plus honest load/stale/error flags. */
export interface HistoryListState {
  /** (server) ∪ (outbox), deduped on clientSnapshotId, server-wins, newest-first. */
  items: HistoryItem[];
  /** First online read in flight with nothing on the device yet. */
  isLoading: boolean;
  /** A COLD failure: the server refused AND there is nothing cached AND nothing queued. */
  isError: boolean;
  /** Serving the device cache because the online read failed — the honest "may be outdated". */
  stale: boolean;
  refetch: () => void;
}

/** The queue, as a query, so the list and the banner re-render when a drain moves it. */
function useOutboxQuery(uid: string | undefined) {
  return useQuery<OutboxEntry[]>({
    queryKey: outboxQueryKey(uid),
    enabled: !!uid,
    // A LOCAL IndexedDB read must NEVER depend on the network (review PR-A, B1). With the default
    // `networkMode: "online"` this query PAUSES the instant the window fires `offline` and reports
    // its `initialData: []` — so the seller's own queued quote disappears from the Histórico in the
    // exact scenario (the fair, offline) the outbox exists for. It was the one query in this module
    // still missing `"always"`.
    networkMode: "always",
    queryFn: () => (uid ? listOutbox(uid) : Promise.resolve([])),
    initialData: [],
  });
}

/**
 * THE LIST IS THE UNION — and this hook is the ONLY way to read it.
 *
 * No component may read the server query alone. That is not style: it is the structural answer to
 * the E3 PR-C lesson (*a correct component starved of correct data still lies*), where a perfectly
 * correct degraded-line component rendered a deleted product as live because it was handed a stale
 * cache. A queued record that the list did not show would be worse still — the seller would believe
 * the quote was never made.
 */
export function useHistory(): HistoryListState {
  const status = useSessionStore((s) => s.status);
  const uid = useSessionStore((s) => s.user?.uid);

  // Pre-fill from the uid-keyed device cache; reset whenever the uid changes, so account B never
  // flashes account A's ledger.
  const [cached, setCached] = useState<SnapshotOut[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCached(null);
    if (!uid) return;
    void loadCachedSnapshots(uid).then((items) => {
      if (!cancelled && items) setCached(items);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const query = useQuery({
    queryKey: historyQueryKey(uid),
    enabled: status === "authenticated" && !!uid,
    retry: false,
    staleTime: 60_000,
    // Offline, a PAUSED query would leave the page in a permanent "loading" limbo. Let it run and
    // FAIL: the failure is what tells the surface it is serving the device cache (`stale`), which
    // is the honest thing to say — the alternative is a spinner that never resolves.
    networkMode: "always",
    queryFn: async () => {
      // Follow the keyset cursor to EXHAUSTION (review PR-A, M3). The server pages to avoid a silent
      // cap on how many snapshots a seller may keep; if the client stopped at the first page, the
      // TAIL of the history would never reach the device — and a detail opened for an unfetched
      // record (the detail resolves via this list) would falsely read "não encontrado". Walking
      // every page also lands the WHOLE ledger in the cache, which is what makes the offline read
      // complete.
      const all: SnapshotOut[] = [];
      let cursor: string | null | undefined;
      do {
        const res = await listHistoryApiV1HistoryGet(cursor ? { cursor } : undefined);
        if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
        all.push(...res.data.items);
        cursor = res.data.nextCursor;
      } while (cursor);
      return all;
    },
  });

  const fetched = query.data;
  useEffect(() => {
    if (fetched && uid) void persistCachedSnapshots(uid, fetched);
  }, [fetched, uid]);

  const outbox = useOutboxQuery(uid).data ?? [];
  const server = query.data ?? cached ?? [];
  const items = mergeHistory(server, outbox);

  // "Do we have ANYTHING to show?" — and the retained server data counts (review PR-A, M6).
  // TanStack KEEPS `query.data` through a failed background refetch, so a refetch that fails while
  // rows are on screen must flag `stale` (a calm strip), NEVER `isError` (a wall over the seller's
  // own data). The old `hasLocal` looked only at the cache/queue and missed the retained data, so
  // the error wall rendered on top of the list it was erroring about.
  const hasData = query.data !== undefined || cached !== null || outbox.length > 0;
  return {
    items,
    isLoading: query.isFetching && !hasData,
    // The wall is ONLY for a COLD failure — nothing fetched, nothing cached, nothing queued.
    isError: query.isError && !hasData,
    // Serving something non-fresh (retained data OR the device cache) after a failed read.
    stale: query.isError && hasData,
    refetch: () => void query.refetch(),
  };
}

/** Drain the queue on demand (the "Sincronizar agora" action, and the app's reconnect sweep). */
export function useSyncOutbox(opts: { retryBlocked?: boolean } = {}): {
  sync: () => void;
  syncing: boolean;
} {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);
  const retryBlocked = opts.retryBlocked ?? false;

  const mutation = useMutation({
    // Same reason as the record mutation: the drain reads and rewrites the DEVICE's queue, and it
    // must run even when the browser says offline — that is when it classifies a lost response as
    // `pending` instead of leaving the seller staring at a frozen button.
    networkMode: "always",
    mutationFn: async () => {
      if (!uid) return;
      // Correctness does not rest on avoiding a concurrent drain: the DB's unique key is what makes
      // a replay idempotent. A second drain can only waste a request, never duplicate a record.
      await drainOutbox(uid, { post: postSnapshot, retryBlocked });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: historyQueryKey(uid) });
      void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
    },
  });

  return { sync: () => mutation.mutate(), syncing: mutation.isPending };
}

/**
 * Per-entry actions for a `blocked`/`failed` record — the [Tentar novamente] / [Descartar] a stuck
 * entry needs so it is not a dead end (review PR-A, B2). Both invalidate the merged list so the card
 * and the detail re-derive; a still-poisoned queue is what makes every future sign-out prompt.
 */
export function useEntryActions(): {
  retry: (clientSnapshotId: string) => void;
  discard: (clientSnapshotId: string) => void;
  retrying: boolean;
  discarding: boolean;
} {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: historyQueryKey(uid) });
    void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
  };

  const retryMutation = useMutation({
    networkMode: "always",
    mutationFn: async (clientSnapshotId: string) => {
      if (!uid) return;
      // `retryBlocked` implicitly true: retrying is an explicit re-send, so a blocked entry is
      // reset to pending and attempted just like a failed one.
      await retryEntry(uid, clientSnapshotId, { post: postSnapshot });
    },
    onSettled: invalidate,
  });

  const discardMutation = useMutation({
    networkMode: "always",
    mutationFn: async (clientSnapshotId: string) => {
      if (!uid) return;
      await discardEntry(uid, clientSnapshotId);
    },
    onSettled: invalidate,
  });

  return {
    retry: (id) => retryMutation.mutate(id),
    discard: (id) => discardMutation.mutate(id),
    retrying: retryMutation.isPending,
    discarding: discardMutation.isPending,
  };
}
