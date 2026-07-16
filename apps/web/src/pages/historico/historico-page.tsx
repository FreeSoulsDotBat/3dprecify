import { Link, useNavigate } from "@tanstack/react-router";

import type { HistoryItem } from "@/entities/history/outbox";
import { useHistory, useSyncOutbox } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { EntryActions } from "@/features/history/entry-actions";
import { HistoryTeaserPanel } from "@/features/history/history-teaser";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Badge, Button, Card, EmptyState, Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import {
  basisCaption,
  cardTitle,
  frozenPayloadOf,
  money,
  offsetOf,
  quotedDate,
  SYNC_BADGE,
} from "@/entities/history/history-format";

import "./historico-page.css";

// 009/T013 (E4, PR-A) — the Histórico list (US2). It fills the honest "em breve" placeholder that
// has stood here since 001: the tab already existed, and FR-524 forbids adding another.
//
// The card is a LEDGER ROW, not a price, and the layout is what enforces that:
//
//   * the DATE sits structurally ABOVE the money (FR-523) — a card cannot be skimmed as a live
//     price, because the first thing under the label is when it was quoted;
//   * the money is "Valor cotado", never "Preço" — *preço* is what the calculator says TODAY;
//   * the basis is spelled out under it (an unlabelled total is an ambiguous claim);
//   * no PriceHero, no live treatment, no colour that reads as "current".
//
// The list comes from ONE selector (server ∪ outbox, server-wins). No component here may read the
// server query alone — a queued record the list did not show would leave the seller believing their
// quote was never made.

const t = messages.historico;

export function HistoricoPage() {
  const sessionStatus = useSessionStore((s) => s.status);
  const entitlement = useEntitlement();

  // Session bootstrap is NOT "signed out" — a premium seller must never flash the teaser (the E3
  // lesson). Nor is "we have not heard from the server yet" the same as "free".
  if (sessionStatus === "loading") return <GateChecking />;
  if (sessionStatus !== "authenticated") return <TeaserShell signedOut />;
  if (!entitlement.data && entitlement.isLoading) return <GateChecking />;
  // A never-granted account meets the honest door. A LAPSED one does not: its records are its own
  // data, and FR-517 promises they stay readable — it reaches the ledger and is simply told, calmly,
  // that writing needs an active Premium.
  if (entitlement.data?.status === "none") return <TeaserShell signedOut={false} />;
  // Settled with NO answer and nothing cached (offline / server down / no persisted plan): do NOT
  // fall through to the ledger's COLD error wall, and do NOT presume "free" for a premium seller
  // whose plan simply could not be checked. A calm "could not verify your plan" + retry, mirroring
  // the shipped E2/E3 gate (review PR-A, C5).
  if (!entitlement.data) return <GateError onRetry={entitlement.refetch} />;
  return <HistoryLedger />;
}

function GateError({ onRetry }: { onRetry: () => void }) {
  return (
    <GateShell>
      <div className="flex flex-col items-center gap-3 py-8">
        <Alert tone="danger">{t.guardError}</Alert>
        <Button variant="secondary" onClick={onRetry}>
          {t.guardRetry}
        </Button>
      </div>
    </GateShell>
  );
}

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="tf-historico mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />
      {children}
    </section>
  );
}

function GateChecking() {
  return (
    <GateShell>
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    </GateShell>
  );
}

function TeaserShell({ signedOut }: { signedOut: boolean }) {
  return (
    <GateShell>
      <HistoryTeaserPanel signedOut={signedOut} />
    </GateShell>
  );
}

function HistoryLedger() {
  const entitlement = useEntitlement();
  const history = useHistory();
  const entitled = entitlement.data?.status === "active";
  const { sync, syncing } = useSyncOutbox({ retryBlocked: entitled });
  const navigate = useNavigate();

  // One connectivity truth that REACTS to reconnection (review PR-A, C6) — not a one-time read.
  const online = useOnline();
  const queued = history.items.filter((i) => i.syncState !== "synced");
  const showEmpty = !history.isLoading && !history.isError && history.items.length === 0;

  // [Ver] jumps to the first entry that needs a human decision (a failed/blocked card).
  const firstProblem = queued.find((i) => i.syncState === "failed" || i.syncState === "blocked");
  const seeFirstProblem = () => {
    if (!firstProblem) return;
    const el = document.getElementById(`snap-${firstProblem.clientSnapshotId}`);
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="tf-historico mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />
      <p className="text-sm text-[var(--text-muted)]">{t.subtitle}</p>

      {/* A lapse deletes NOTHING: the ledger stays readable, and only writing needs an active
          Premium (FR-517). */}
      {entitlement.data?.status === "lapsed" && <Alert tone="info">{t.lapsedBanner}</Alert>}

      {/* Serving the device cache. WHY it is serving it changes what is honest to say: offline is a
          calm, expected state; a failed read while ONLINE is something the seller can retry. Saying
          "Modo leitura offline" to someone who is plainly online would be a small, needless lie
          (T016 nit). Either way the rows below still render — never an error wall over data the
          seller already holds. */}
      {history.stale &&
        (online ? (
          <Alert tone="danger">
            <span className="tf-historico__banner">
              {t.loadError}
              <Button size="sm" variant="secondary" onClick={history.refetch}>
                {t.retry}
              </Button>
            </span>
          </Alert>
        ) : (
          <Alert tone="info" title={t.offlineTitle}>
            {t.offlineBody}
          </Alert>
        ))}

      {queued.length > 0 && (
        <QueueBanner
          queued={queued}
          online={online}
          syncing={syncing}
          onSync={sync}
          onSee={seeFirstProblem}
        />
      )}

      {history.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {/* The full-panel error is ONLY for a cold failure — nothing cached, nothing queued. There is
          never an error wall over data the seller already holds. */}
      {history.isError && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Alert tone="danger">{t.loadError}</Alert>
          <Button variant="secondary" onClick={history.refetch}>
            {t.retry}
          </Button>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center gap-3">
          <EmptyState icon="history" title={t.emptyTitle} description={t.emptyBody} />
          <Button variant="secondary" onClick={() => void navigate({ to: "/calcular" })}>
            {t.emptyAction}
          </Button>
        </div>
      )}

      {history.items.map((item) => (
        <SnapshotCard key={item.clientSnapshotId} item={item} />
      ))}
    </section>
  );
}

/**
 * The aggregate banner. Its TITLE follows the precedence failed > blocked > pending — the state that
 * needs a human decision wins the wording. But the DRAINAGE action is no longer held hostage by it
 * (review PR-A, C6): a single failed/blocked entry used to hide [Sincronizar agora] entirely,
 * trapping every healthy pending behind it — the app's only manual drain, gone. Now the banner
 * ALWAYS offers to sync when there is a healthy pending online, and a [Ver] jump when something needs
 * a decision. The per-card badges tell the full truth regardless of what the banner says.
 */
function QueueBanner({
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
  const pending = queued.filter((i) => i.syncState === "pending").length;

  const hasProblem = failed > 0 || blocked > 0;
  // A healthy pending can be sent by hand — but only online, where the button can actually work.
  const canDrain = pending > 0 && online;

  let tone: "info" | "danger" = "info";
  let text: string;
  if (failed > 0) {
    tone = "danger";
    text = t.queueFailed.replace("{n}", String(failed));
  } else if (blocked > 0) {
    text = t.queueBlocked.replace("{n}", String(blocked));
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

function SnapshotCard({ item }: { item: HistoryItem }) {
  const pieces = frozenPayloadOf(item)?.lines?.length ?? 0;
  const kind = item.kind === "KIT" ? t.kindKit.replace("{n}", String(pieces)) : t.kindSingle;

  // A blocked/failed entry needs an escape hatch right where the seller sees it, or it is a dead end
  // that poisons every future sign-out (review PR-A, B2). Pending is drained by the banner instead.
  const stuck = item.syncState === "blocked" || item.syncState === "failed";

  return (
    <Link
      to="/historico/$snapshotId"
      params={{ snapshotId: item.clientSnapshotId }}
      className="tf-historico__link"
      id={`snap-${item.clientSnapshotId}`}
    >
      <Card padding="sm" className="tf-historico__card">
        <span className="tf-historico__label">{cardTitle(item)}</span>

        {item.syncState !== "synced" && (
          <Badge tone={item.syncState === "failed" ? "danger" : "info"}>
            {SYNC_BADGE[item.syncState]}
          </Badge>
        )}

        {/* The date comes BEFORE the money. Always. */}
        <span className="tf-historico__meta">
          {t.quotedAtCard.replace("{data}", quotedDate(item.deviceQuotedAt, offsetOf(item)))} ·{" "}
          {kind}
        </span>

        <span className="tf-historico__money">
          <span>{t.quotedValue}</span>
          <strong>{money(item.headlineTotal)}</strong>
        </span>
        <span className="tf-historico__basis">{basisCaption(item.headlineBasis)}</span>

        {stuck && <EntryActions item={item} />}
      </Card>
    </Link>
  );
}
