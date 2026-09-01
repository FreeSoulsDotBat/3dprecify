import type { HistoryItem, SyncState } from "@/entities/history/outbox";
import { EntryActions } from "@/features/history/entry-actions";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert } from "@/shared/ui";

// 019/Polish — moved verbatim out of snapshot-detail-page.tsx: `SYNC_ALERT_COPY` stays with its
// one reader, `SyncAlert`, per the task's own instruction.

const t = messages.historico;

/** §1.2 — a copy de cada estado do `SyncAlert`, no mesmo idiom de `SYNC_BADGE`
 *  (`entities/history/history-format.ts`). `unauthenticated` tem a SUA própria linha (hotfix
 *  016/A3, H4b): cair no `failed` por omissão diria "Não foi possível registrar" sobre um registro
 *  que não foi rejeitado — a sessão é que morreu. */
const SYNC_ALERT_COPY: Record<Exclude<SyncState, "synced">, { title: string; body: string }> = {
    pending: { title: t.syncPendingTitle, body: t.syncPendingBody },
    blocked: { title: t.syncBlockedTitle, body: t.syncBlockedBody },
    unauthenticated: { title: t.syncUnauthenticatedTitle, body: t.syncUnauthenticatedBody },
    failed: { title: t.syncFailedTitle, body: t.syncFailedBody },
};

/**
 * §1.2 — the record's sync state in plain words, one calm reading per state. `pending` carries the
 * durability caveat (F4, detail-only, muted — never on the card); `failed` shows the support code so
 * the seller has something to report. All three offer [Tentar novamente]/[Descartar] (B2) except a
 * pending offline, where retry cannot work (handled inside `EntryActions`). Never rendered for a
 * synced record — a badge on everything would be noise.
 */
export function SyncAlert({ item }: { item: HistoryItem }) {
    if (item.syncState === "synced") return null;

    const state = item.syncState;
    const { title, body } = SYNC_ALERT_COPY[state];
    const supportCode = item.entry?.lastStatus;

    return (
        <Alert tone={state === "failed" ? "danger" : "info"} title={title}>
            <p>{body}</p>
            {/* F4 — true (IndexedDB eviction is best-effort) and the most alarming line in the app, so it
          lives HERE only, muted, and never on the card. */}
            {state === "pending" && <p className="tf-historico__meta">{t.syncPendingDurability}</p>}
            {state === "failed" && supportCode != null && (
                <p className="tf-historico__meta">
                    {messages.error.supportCode} {supportCode}
                </p>
            )}
            {/* hotfix 016/A3 (H5) — the way back lives right beside the actions: a dead session is only
          ONE tap from being fixed. */}
            {state === "unauthenticated" && (
                <a
                    className="tf-btn tf-btn--secondary tf-btn--sm mt-2"
                    href={`/sign-in?redirect=${encodeURIComponent("/historico")}`}
                >
                    {t.signInAction}
                </a>
            )}
            <EntryActions item={item} />
        </Alert>
    );
}
