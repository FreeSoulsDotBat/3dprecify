import { Link, useNavigate } from "@tanstack/react-router";

import type { HistoryItem } from "@/entities/history/outbox";
import { useHistory, useSyncOutbox } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { HistoryTeaserPanel } from "@/features/history/history-teaser";
import { messages } from "@/shared/i18n/messages.pt-br";
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
} from "./history-format";

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
  return <HistoryLedger />;
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

  const online = typeof navigator === "undefined" || navigator.onLine;
  const queued = history.items.filter((i) => i.syncState !== "synced");
  const showEmpty = !history.isLoading && !history.isError && history.items.length === 0;

  return (
    <section className="tf-historico mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />
      <p className="text-sm text-[var(--text-muted)]">{t.subtitle}</p>

      {/* A lapse deletes NOTHING: the ledger stays readable, and only writing needs an active
          Premium (FR-517). */}
      {entitlement.data?.status === "lapsed" && <Alert tone="info">{t.lapsedBanner}</Alert>}

      {history.stale && (
        <Alert tone="info" title={t.offlineTitle}>
          {t.offlineBody}
        </Alert>
      )}

      {queued.length > 0 && (
        <QueueBanner queued={queued} online={online} syncing={syncing} onSync={sync} />
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

/** Precedence: failed > blocked > pending — the state that needs a human decision wins the banner.
 *  The per-card badges tell the full truth regardless of what the banner happens to say. */
function QueueBanner({
  queued,
  online,
  syncing,
  onSync,
}: {
  queued: HistoryItem[];
  online: boolean;
  syncing: boolean;
  onSync: () => void;
}) {
  const failed = queued.filter((i) => i.syncState === "failed").length;
  const blocked = queued.filter((i) => i.syncState === "blocked").length;
  const pending = queued.filter((i) => i.syncState === "pending").length;

  if (failed > 0) {
    return <Alert tone="danger">{t.queueFailed.replace("{n}", String(failed))}</Alert>;
  }
  if (blocked > 0) {
    return <Alert tone="info">{t.queueBlocked.replace("{n}", String(blocked))}</Alert>;
  }
  // Offline there is no button: one that cannot work is a button that pretends.
  if (!online) {
    return <Alert tone="info">{t.queuePendingOffline.replace("{n}", String(pending))}</Alert>;
  }
  return (
    <Alert tone="info">
      <span className="tf-historico__banner">
        {t.queuePending.replace("{n}", String(pending))}
        <Button size="sm" variant="secondary" onClick={onSync} loading={syncing}>
          {t.syncNow}
        </Button>
      </span>
    </Alert>
  );
}

function SnapshotCard({ item }: { item: HistoryItem }) {
  const pieces = frozenPayloadOf(item)?.lines?.length ?? 0;
  const kind = item.kind === "KIT" ? t.kindKit.replace("{n}", String(pieces)) : t.kindSingle;

  return (
    <Link
      to="/historico/$snapshotId"
      params={{ snapshotId: item.clientSnapshotId }}
      className="tf-historico__link"
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
      </Card>
    </Link>
  );
}
