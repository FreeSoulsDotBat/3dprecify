import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import {
  type SnapshotIn,
  type SnapshotOut,
  recordSnapshotApiV1HistoryPost,
} from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import { drainOutbox, enqueueSnapshot, listOutbox, type SyncState } from "./outbox";

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
