import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { drainOutbox, listOutbox, purgeOutbox } from "@/entities/history/outbox";
import { historyQueryKey, outboxQueryKey, postSnapshot } from "@/entities/history/use-history";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { registerSignOutGuard } from "@/shared/session/sign-out-guard";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui";

// ⚠ @doc DEC-085 — diálogo BLOQUEANTE com a contagem, nunca um toast depois: toast depois do
//   fato é descarte silencioso com recibo anexado. Duas garantias colidem e as duas estão certas.

const t = messages.history;
const count = (s: string, n: number) => s.replace("{n}", String(n));

type Decision = (proceed: boolean) => void;

export function SignOutOutboxGuard() {
    const uid = useSessionStore((s) => s.user?.uid);
    const client = useQueryClient();
    const [pending, setPending] = useState<number | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [partial, setPartial] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const decide = useRef<Decision | null>(null);

    const close = useCallback((proceed: boolean) => {
        decide.current?.(proceed);
        decide.current = null;
        setPending(null);
        setConfirming(false);
        setPartial(null);
        setSyncing(false);
    }, []);

    useEffect(() => {
        return registerSignOutGuard(async () => {
            if (!uid) return true;
            const queued = await listOutbox(uid);
            if (queued.length === 0) return true; // nothing at stake — never get in the way

            setPending(queued.length);
            // Sign-out is held here until the seller answers.
            return new Promise<boolean>((resolve) => {
                decide.current = resolve;
            });
        });
    }, [uid]);

    // Subscribes to connectivity, so a dialog opened OFFLINE re-enables [Sincronizar agora] the moment
    // the network returns (review PR-A, C6) — the old one-time `navigator.onLine` read froze it
    // disabled forever, leaving only "Sair e descartar".
    const online = useOnline();

    if (pending === null || !uid) return null;

    async function syncNow(owner: string) {
        setSyncing(true);
        setPartial(null);
        await drainOutbox(owner, { post: postSnapshot });
        // Invalidate the merged list after the drain (review PR-A, M10). Draining raw — outside the
        // `useSyncOutbox` seam that normally does this — used to leave a partially-synced list stamping
        // "Pendente" on records the server had already accepted, until some later invalidation.
        void client.invalidateQueries({ queryKey: historyQueryKey(owner) });
        void client.invalidateQueries({ queryKey: outboxQueryKey(owner) });
        const left = await listOutbox(owner);
        setSyncing(false);
        // Everything reached the account — sign out with nothing lost, and nothing discarded.
        if (left.length === 0) {
            close(true);
            return;
        }
        // Some entries did not make it (a rejection, a 403, a dropped connection). We do NOT sign out
        // over them: that would be exactly the silent destruction this dialog exists to prevent.
        setPending(left.length);
        setPartial(left.length);
    }

    async function discardAndSignOut(owner: string) {
        await purgeOutbox(owner);
        close(true);
    }

    return (
        <Dialog open onOpenChange={(next) => !next && close(false)}>
            <DialogContent showClose={false}>
                {confirming ? (
                    <>
                        <DialogTitle>{count(t.signOutDiscardConfirmTitle, pending)}</DialogTitle>
                        <DialogDescription>{t.signOutDiscardConfirmBody}</DialogDescription>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setConfirming(false)}>
                                {t.back}
                            </Button>
                            <Button variant="danger" onClick={() => void discardAndSignOut(uid)}>
                                {t.signOutDiscardConfirm}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogTitle>{count(t.signOutQueueTitle, pending)}</DialogTitle>
                        <DialogDescription>{t.signOutQueueBody}</DialogDescription>

                        {partial !== null && (
                            <Alert tone="danger" className="mt-3">
                                {count(t.signOutPartial, partial)}
                            </Alert>
                        )}

                        <div className="mt-4 flex flex-col gap-2">
                            <Button disabled={!online || syncing} onClick={() => void syncNow(uid)}>
                                {t.signOutSyncNow}
                            </Button>
                            {/* A button that cannot work says why, instead of pretending it can. */}
                            {!online && (
                                <p className="text-center text-sm text-[var(--text-muted)]">
                                    {t.signOutSyncOffline}
                                </p>
                            )}
                            <Button variant="danger" onClick={() => setConfirming(true)}>
                                {t.signOutDiscard}
                            </Button>
                            <Button variant="secondary" onClick={() => close(false)}>
                                {t.back}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
