import { useEffect, useRef } from "react";

import { useSyncOutbox } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { useSessionStore } from "@/shared/session/session-store";

// 009/T013 (E4, PR-A) — the queue drains itself (ADR-0018 §7).
//
// A pending record that only synced when the seller happened to open the Histórico would be a
// promise half-kept: the app says "sincroniza sozinho quando a conexão voltar", so it has to.
// Triggers: app boot / sign-in (uid appears), reconnect (`online`), and the moment the entitlement
// becomes `active` again — which is what un-blocks a queue that was refused with a 403.
//
// It is safe to fire this from anywhere, any number of times: exactly-once lives in the DATABASE
// (the unique key on `clientSnapshotId`), never in this component. A redundant drain can waste a
// request; it can never duplicate a record.

export function OutboxSyncer() {
  const uid = useSessionStore((s) => s.user?.uid);
  const entitled = useEntitlement().data?.status === "active";
  const { sync } = useSyncOutbox({ retryBlocked: entitled });

  // Kept in a ref so the effect keys on the things that MEAN something (the account, the plan) and
  // not on a fresh closure every render.
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (!uid) return;
    syncRef.current();
    const onOnline = () => syncRef.current();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [uid, entitled]);

  return null;
}
