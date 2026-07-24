import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import type { HistoryItem } from "@/entities/history/outbox";
import { useHistory, useSyncOutbox, type HistoryFilters } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { EntryActions } from "@/features/history/entry-actions";
import { HistoryTeaserPanel } from "@/features/history/history-teaser";
import { SnapshotDetailPage } from "@/pages/historico/snapshot-detail-page";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Sheet,
  SheetContent,
  SheetTitle,
  Spinner,
} from "@/shared/ui";
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
  // 013/F-02 (D1=A): `?snapshot=<clientSnapshotId>` — formerly its own 2-segment route
  // (`/historico/$snapshotId`), now a search param on THIS route (route's `beforeLoad` already
  // required auth for this param, mirroring the old route's own guard).
  const search = useSearch({ strict: false }) as { snapshot?: string };

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
  if (search.snapshot) return <SnapshotDetailPage snapshotId={search.snapshot} />;
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
  const navigate = useNavigate();

  // The filter state (US6). The search DEBOUNCES into the query key — the input stays responsive
  // while at most one server read fires per settled term. The período is a preset (or a custom
  // range); `filters` is the single derived value the read keys off, memoised so a re-render for an
  // unrelated reason never re-fires the query.
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [custom, setCustom] = useState<CustomRange>({ from: "", to: "" });
  const debouncedSearch = useDebouncedValue(search, 250);

  const filters = useMemo<HistoryFilters>(() => {
    const f: HistoryFilters = {};
    if (debouncedSearch.trim()) f.q = debouncedSearch.trim();
    const range = periodRange(period, custom);
    if (range.from) f.from = range.from;
    if (range.to) f.to = range.to;
    return f;
  }, [debouncedSearch, period, custom]);

  const history = useHistory(filters);
  const entitled = entitlement.data?.status === "active";
  const { sync, syncing } = useSyncOutbox({ retryBlocked: entitled });

  // One connectivity truth that REACTS to reconnection (review PR-A, C6) — not a one-time read.
  const online = useOnline();
  const queued = history.items.filter((i) => i.syncState !== "synced");

  // Two different questions, two different truths. The BAR (and its [Limpar]) keys off the RAW input
  // so it never flickers out mid-keystroke. But WHICH empty state to show keys off the EFFECTIVE
  // filter — the debounced `filters` the list was actually read under — because `history.items`
  // reflects `filters`, not the keystroke. Reading the raw input here flashed the cold "you have no
  // history" screen for the 250 ms debounce window right after clearing a no-match search: raw goes
  // empty instantly while the list is still the filtered (empty) result (review PR-B minor). An empty
  // ledger UNDER a filter is a search MISS, never the cold empty state — the two must never be confused.
  const rawFilterActive = Boolean(search.trim()) || period !== "all";
  const effectiveFilter = Boolean(filters.q || filters.from || filters.to);
  const settled = !history.isLoading && !history.isError;
  const showFilters = history.items.length > 0 || rawFilterActive || effectiveFilter;
  const showEmpty = settled && history.items.length === 0 && !effectiveFilter;
  const showSearchEmpty = settled && history.items.length === 0 && effectiveFilter;

  const clearFilters = () => {
    setSearch("");
    setPeriod("all");
    setCustom({ from: "", to: "" });
  };

  // What the "no match" line names as the refinement: the EFFECTIVE search term the empty result
  // reflects (`filters.q`, the debounced value — not the raw keystroke, which may already be cleared),
  // else the período in force (so a período-only miss still reads honestly, never an empty quote).
  const periodLabel =
    period === "30"
      ? t.period30
      : period === "90"
        ? t.period90
        : period === "custom"
          ? `${custom.from || "—"} – ${custom.to || "—"}`
          : "";
  const searchEmptyTerm = (filters.q ?? "") || periodLabel;

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

      {/* The filter bar refines a LIVE server read — so it appears only once there IS a ledger to
          refine (or a filter is already in force, to keep [Limpar] reachable). It never touches the
          queue: `useHistory` merges the outbox below this layer, so a search can never hide the
          seller's own unsynced quote. */}
      {showFilters && (
        <HistoryFilterBar
          search={search}
          onSearch={setSearch}
          period={period}
          onPeriod={setPeriod}
          custom={custom}
          onCustom={setCustom}
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

      {/* A filtered read that found nothing is NOT the cold empty state — the seller HAS history, this
          search simply misses. Say so by term, and offer the one move that recovers: clear it. */}
      {showSearchEmpty && (
        <div className="flex flex-col items-center gap-3">
          <EmptyState icon="history" title={t.searchEmpty.replace("{termo}", searchEmptyTerm)} />
          <Button variant="secondary" onClick={clearFilters}>
            {t.searchClear}
          </Button>
        </div>
      )}

      {history.items.map((item) => (
        <SnapshotCard key={item.clientSnapshotId} item={item} />
      ))}

      {/* The ledger is NEVER loaded whole (FR-518): the server keysets, and this fetches the next
          page on demand. Absent once the last page is in — there is no silent cap behind it. */}
      {history.hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="secondary" loading={history.isFetchingMore} onClick={history.loadMore}>
            {t.loadMore}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── US6 período presets ──────────────────────────────────────────────────────────────────────
// A preset maps to a device-date LOWER bound; "custom" carries an explicit [from, to] the seller
// picked. The bounds are ISO instants (what the server filter expects); an empty custom field is
// simply omitted, never sent as a blank the server would honour as a real bound.

type PeriodKey = "all" | "30" | "90" | "custom";
interface CustomRange {
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;

function periodRange(period: PeriodKey, custom: CustomRange): { from?: string; to?: string } {
  if (period === "30") return { from: new Date(Date.now() - 30 * DAY_MS).toISOString() };
  if (period === "90") return { from: new Date(Date.now() - 90 * DAY_MS).toISOString() };
  if (period === "custom") {
    const out: { from?: string; to?: string } = {};
    if (custom.from) out.from = new Date(`${custom.from}T00:00:00`).toISOString();
    // Inclusive upper bound: the whole picked day, to its last millisecond.
    if (custom.to) out.to = new Date(`${custom.to}T23:59:59.999`).toISOString();
    return out;
  }
  return {};
}

function HistoryFilterBar({
  search,
  onSearch,
  period,
  onPeriod,
  custom,
  onCustom,
}: {
  search: string;
  onSearch: (value: string) => void;
  period: PeriodKey;
  onPeriod: (period: PeriodKey) => void;
  custom: CustomRange;
  onCustom: (range: CustomRange) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<CustomRange>(custom);

  const presets: { key: PeriodKey; label: string }[] = [
    { key: "all", label: t.periodAll },
    { key: "30", label: t.period30 },
    { key: "90", label: t.period90 },
  ];
  const customActive = period === "custom" && Boolean(custom.from || custom.to);

  return (
    <div className="tf-historico__filters">
      <Field label={t.searchLabel}>
        {({ id, ...aria }) => (
          <div className="tf-inputwrap">
            <input
              id={id}
              {...aria}
              className="tf-input"
              type="search"
              maxLength={120}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
      </Field>

      <div className="tf-historico__chips" role="group" aria-label={t.periodCustom}>
        {presets.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "primary" : "secondary"}
            onClick={() => onPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={period === "custom" ? "primary" : "secondary"}
          onClick={() => {
            setDraft(custom);
            setSheetOpen(true);
          }}
        >
          {t.periodCustom}
        </Button>
      </div>

      {customActive && (
        <span className="tf-historico__filterchip">
          {t.filterActive.replace("{de}", custom.from || "—").replace("{ate}", custom.to || "—")}
          <Button size="sm" variant="ghost" onClick={() => onPeriod("all")}>
            {t.filterClear}
          </Button>
        </span>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent showClose={false}>
          <SheetTitle>{t.periodCustom}</SheetTitle>
          <div className="flex flex-col gap-3">
            <Field label={t.periodFrom}>
              {({ id, ...aria }) => (
                <div className="tf-inputwrap">
                  <input
                    id={id}
                    {...aria}
                    className="tf-input"
                    type="date"
                    value={draft.from}
                    onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  />
                </div>
              )}
            </Field>
            <Field label={t.periodTo}>
              {({ id, ...aria }) => (
                <div className="tf-inputwrap">
                  <input
                    id={id}
                    {...aria}
                    className="tf-input"
                    type="date"
                    value={draft.to}
                    onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  />
                </div>
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                {t.back}
              </Button>
              <Button
                onClick={() => {
                  onCustom(draft);
                  onPeriod("custom");
                  setSheetOpen(false);
                }}
              >
                {t.periodApply}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
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
      to="/historico"
      search={{ snapshot: item.clientSnapshotId }}
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
