import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";

// 019/Polish — moved verbatim out of history-ledger.tsx.

const t = messages.history;

/**
 * ⚠ @doc DEC-066 — o título segue a precedência, mas NUNCA sequestra o dreno: uma entrada
 *   falhada escondia o [Sincronizar agora] e prendia todo `pending` saudável atrás dela.
 */
export function QueueBanner({
    queued,
    online,
    syncing,
    onSync,
    onSee,
}: {
    queued: HistoryItem[];
    online: boolean;
    syncing: boolean;
    onSync: () => void;
    onSee: () => void;
}) {
    const failed = queued.filter((i) => i.syncState === "failed").length;
    const blocked = queued.filter((i) => i.syncState === "blocked").length;
    const unauthenticated = queued.filter((i) => i.syncState === "unauthenticated").length;
    const pending = queued.filter((i) => i.syncState === "pending").length;

    const hasProblem = failed > 0 || blocked > 0 || unauthenticated > 0;
    // A healthy pending can be sent by hand — but only online, where the button can actually work.
    const canDrain = pending > 0 && online;

    let tone: "info" | "danger" = "info";
    let text: string;
    if (failed > 0) {
        tone = "danger";
        text = t.queueFailed.replace("{n}", String(failed));
    } else if (blocked > 0) {
        text = t.queueBlocked.replace("{n}", String(blocked));
    } else if (unauthenticated > 0) {
        text = t.queueUnauthenticated.replace("{n}", String(unauthenticated));
    } else if (!online) {
        text = t.queuePendingOffline.replace("{n}", String(pending));
    } else {
        text = t.queuePending.replace("{n}", String(pending));
    }

    return (
        <Alert tone={tone}>
            <span className="tf-historico__banner">
                {text}
                <span className="flex gap-2">
                    {/* Jump to the first entry that needs a decision, so it is never buried below the fold. */}
                    {hasProblem && (
                        <Button size="sm" variant="secondary" onClick={onSee}>
                            {t.queueSee}
                        </Button>
                    )}
                    {/* The way back (016/A3 H5 pattern): a plain `<a>`, like `TeaserUpgrade` — never fires a
              client-side sign-out, only navigates through the existing safe-redirect sign-in flow. */}
                    {unauthenticated > 0 && (
                        <a
                            className="tf-btn tf-btn--secondary tf-btn--sm"
                            href={`/sign-in?redirect=${encodeURIComponent("/historico")}`}
                        >
                            {t.signInAction}
                        </a>
                    )}
                    {/* Never a button that cannot work: sync is offered only for a healthy pending, online. */}
                    {canDrain && (
                        <Button size="sm" variant="secondary" onClick={onSync} loading={syncing}>
                            {t.syncNow}
                        </Button>
                    )}
                </span>
            </span>
        </Alert>
    );
}
