import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button } from "@/shared/ui";

// 019/Polish — moved verbatim out of history-ledger.tsx.

const t = messages.historico;

/**
 * The aggregate banner. Its TITLE follows the precedence failed > blocked > unauthenticated >
 * pending — the state that needs a human decision wins the wording. But the DRAINAGE action is no
 * longer held hostage by it (review PR-A, C6): a single failed/blocked entry used to hide
 * [Sincronizar agora] entirely, trapping every healthy pending behind it — the app's only manual
 * drain, gone. Now the banner ALWAYS offers to sync when there is a healthy pending online, and a
 * [Ver] jump when something needs a decision. The per-card badges tell the full truth regardless of
 * what the banner says.
 *
 * hotfix 016/A3 (H4b) — `unauthenticated` is its OWN branch, never folded into `blocked`: the copy
 * must never say "conexão"/"online" (the achado A3: the old `pending` copy promised exactly that
 * with the connection intact), and it offers a real way back — [Entrar de novo] to `/sign-in`,
 * preserving `/historico` as the return-to-intent (`router.tsx`'s own whitelist).
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
