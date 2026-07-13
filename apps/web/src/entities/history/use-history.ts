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
  drainOutbox,
  enqueueSnapshot,
  listOutbox,
  mergeHistory,
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
    mutationFn: async (body: SnapshotIn) => {
      // The queue is uid-keyed; there is nowhere to put a record that has no account.
      if (!uid) throw new Error("cannot record without a signed-in account");

      // Durable FIRST. This THROWS if the device cannot store it — and it must: the alternative is
      // telling the seller "pendente" over nothing at all.
      const entry = await enqueueSnapshot(uid, body);

      // Best-effort immediate send. `drainOutbox` never throws — it classifies each failure into an
      // honest state and keeps the entry.
      await drainOutbox(uid, { post: postSnapshot });

      const still = (await listOutbox(uid)).find(
        (e) => e.clientSnapshotId === entry.clientSnapshotId,
      );
      // Gone from the queue ⇒ the server has it. Still there ⇒ whatever state the drain gave it.
      return { clientSnapshotId: entry.clientSnapshotId, syncState: still?.syncState ?? "synced" };
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
    queryFn: async () => {
      const res = await listHistoryApiV1HistoryGet();
      if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data.items;
    },
  });

  const fetched = query.data;
  useEffect(() => {
    if (fetched && uid) void persistCachedSnapshots(uid, fetched);
  }, [fetched, uid]);

  const outbox = useOutboxQuery(uid).data ?? [];
  const server = query.data ?? cached ?? [];
  const items = mergeHistory(server, outbox);

  // A queued record is data the seller HOLDS. An error wall over it would hide their own quote.
  const hasLocal = cached !== null || outbox.length > 0;
  return {
    items,
    isLoading: query.isFetching && query.data === undefined && !hasLocal,
    isError: query.isError && !hasLocal,
    stale: query.isError && query.data === undefined && hasLocal,
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
