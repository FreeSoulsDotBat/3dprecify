import { Link } from "@tanstack/react-router";

import { useBoms } from "@/entities/bom/use-bom";
import { useProducts } from "@/entities/catalog/use-catalog";
import {
  type FrozenBreakdown,
  type FrozenChannel,
  frozenChannelHasFee,
  type FrozenSnapshotPayload,
} from "@/entities/history/frozen-payload";
import { resolveOrigin, type OriginTarget } from "@/entities/history/origin";
import type { HistoryItem } from "@/entities/history/outbox";
import { useSnapshot } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { EntryActions } from "@/features/history/entry-actions";
import { ExportButton } from "@/features/history/export-sheet";
import { SnapshotManageActions } from "@/features/history/snapshot-manage";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Badge, BreakdownRow, Button, Card, Icon, Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import {
  basisCaption,
  cardTitle,
  frozenPayloadOf,
  money,
  offsetOf,
  quotedDate,
  quotedTime,
  SYNC_BADGE,
} from "@/entities/history/history-format";

import { CompareTodayBlock } from "./compare-today";
import { RecalcTodayButton } from "./recalc-today";

import "./historico-page.css";

// 009/T013 (E4, PR-A) — the frozen detail (US2). This surface renders a DOCUMENT, and three
// prohibitions define it — each one a lie it would otherwise tell:
//
//   1. ZERO RECOMPUTATION (SC-501). Every figure below is a STORED string, formatted for reading.
//      Nothing is derived, nothing is summed, `pricing-core` is not called. Recomputing even one
//      line would make the snapshot quietly track today's catalog — the precise opposite of what it
//      promises.
//   2. AN ABSENT LINE IS NOT A ZERO (FR-507). A payload with no `finishing` means the seller did not
//      charge for finishing. Printing "Acabamento R$ 0,00" would invent a fact they never asserted,
//      so the row is simply not rendered. (This is also why the frozen types are structurally
//      independent of the live `PriceResult`: typed against the live one, a future field would make
//      TypeScript *assert* that a 2026 snapshot has it, and the renderer would print `?? 0` — a zero
//      fabricated by the type system.)
//   3. NO DEGRADATION, EVER (FR-503). A snapshot CONTAINS its values; it references nothing, so
//      nothing about it can rot. Deleting the origin product changes nothing here: no caption, no
//      badge, no tone. The surface looks identical to one whose origin was always ad-hoc — and
//      **that absence is the feature**, the exact inverse of E3's degraded kit line.
//
// (The origin's [Abrir produto] affordance and "Recalcular hoje" arrive in PR-B; the captured name
// and the formula version are part of the frozen document and belong here from the start.)

const t = messages.historico;
const tr = messages.calculator.results;

export function SnapshotDetailPage({ snapshotId }: { snapshotId: string }) {
  // Resolve THIS record by its clientSnapshotId (the URL key). Under lazy pagination it need not be
  // on a loaded list page, so useSnapshot fetches it by exact id — and still never reads the server
  // query alone: a pending record lives only in the outbox and must open exactly like a synced one.
  const snap = useSnapshot(snapshotId);
  // US3/T019 — the LIVE catalog, consulted for ONE thing only: whether the captured origin still
  // exists, so we can offer "abrir origem". Never for a value (that would make the snapshot track
  // today's catalog — the exact lie the two-shelf rule forbids). Hooks run before any early return.
  const products = useProducts();
  const kits = useBoms();
  // The entitlement drives ONE thing on this surface: whether to explain the absent write affordances.
  // On lapse the rename/delete/recalc actions are gone (they are WRITES — Principle IV), and without a
  // word here the seller would just find them missing. The list carries this banner; the detail must
  // too, or `snapshot-manage`'s promise ("the lapse banner explains why") is false when reached direct.
  const entitlement = useEntitlement();
  const item = snap.item;

  if (snap.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Shell>
    );
  }

  // A COLD read failure is NOT the same as "this record does not exist" (review PR-A, M7). Saying
  // "Registro não encontrado" when the truth is "we could not load your history" would tell the
  // seller their quote is gone. Distinct branch, distinct copy, with a retry.
  if (!item && snap.isError) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-8">
          <Alert tone="danger">{t.loadError}</Alert>
          <Button variant="secondary" onClick={snap.refetch}>
            {t.retry}
          </Button>
        </div>
      </Shell>
    );
  }

  // Loaded, and the record genuinely is not here.
  if (!item) {
    return (
      <Shell>
        <Alert tone="info">{t.notFound}</Alert>
      </Shell>
    );
  }

  const payload = frozenPayloadOf(item);
  // Read-time resolution (ADR-0019 §5): null when the origin was deleted OR was never set — the
  // affordance is then simply absent, and the two cases are indistinguishable ON PURPOSE.
  const origin = resolveOrigin(payload?.provenance ?? null, products.items, kits.items);
  // The live origin rows (when they resolve) — "Recalcular hoje" reprices from these at today's
  // catalog values (FR-505); when absent, it reprices the frozen inputs and says so.
  const originProduct =
    origin?.kind === "PRODUCT" ? products.items.find((p) => p.id === origin.id) : undefined;
  const originKit = origin?.kind === "KIT" ? kits.items.find((k) => k.id === origin.id) : undefined;
  const offset = offsetOf(item);
  const validity = item.snapshot?.quoteValidityDays ?? item.entry?.body.quoteValidityDays ?? null;
  const date = quotedDate(item.deviceQuotedAt, offset);

  return (
    <Shell title={cardTitle(item)}>
      {item.syncState !== "synced" && (
        <Badge tone={item.syncState === "failed" ? "danger" : "info"}>
          {SYNC_BADGE[item.syncState]}
        </Badge>
      )}

      {/* The claim: what was quoted, and when. */}
      <Card className="tf-historico__claim">
        <span className="tf-historico__meta">
          {t.quotedAtTime
            .replace("{data}", date)
            .replace("{hora}", quotedTime(item.deviceQuotedAt, offset))}
        </span>
        <span className="tf-historico__money">
          <span>{t.quotedValue}</span>
          <strong>{money(item.headlineTotal)}</strong>
        </span>
        <span className="tf-historico__basis">{basisCaption(item.headlineBasis)}</span>
        {/* A promise the seller made — NOT a TTL. Nothing ever expires the record. */}
        {validity !== null && (
          <span className="tf-historico__meta">
            {t.validityLine.replace("{n}", String(validity))}
          </span>
        )}
      </Card>

      {/* A lapse deletes NOTHING and hides nothing readable (FR-517) — it only pauses WRITES. Say so
          right where the rename/delete/recalc affordances would be, so their absence reads as a paused
          plan, not a broken record. Mirrors the list banner. */}
      {entitlement.data?.status === "lapsed" && <Alert tone="info">{t.lapsedBanner}</Alert>}

      {/* US6/T022 — rename + delete, offered only for a synced record on an active premium. */}
      <SnapshotManageActions item={item} />

      {/* §1.2 — the honest per-state alert, with the durability caveat (F4) and the retry/discard
          actions (B2). Only when the record has not reached the account. */}
      <SyncAlert item={item} />

      {payload && (
        <>
          <p className="tf-historico__meta">{t.frozenCaption.replace("{data}", date)}</p>
          {/* SC-818 — a data acima é de HOJE mesmo quando o recálculo não conseguiu repreçar e
              reemitiu o documento antigo. Sem esta linha o registro afirmaria, por omissão, um
              preço de hoje que ninguém calculou hoje. */}
          {payload.repricedFromFrozen && (
            <p className="tf-historico__meta">{t.frozenReusedCaption}</p>
          )}
          {payload.lines && payload.lines.length > 0 && (
            <KitLines payload={payload} basis={item.headlineBasis} />
          )}
          {payload.breakdown && <Breakdown breakdown={payload.breakdown} />}
          {payload.totals.custoTotal && (
            <BreakdownRow
              label={tr.custoTotal}
              value={money(payload.totals.custoTotal)}
              emphasis="total"
            />
          )}
          {payload.channels && payload.channels.length > 0 && <ChannelsBlock payload={payload} />}
          <TechnicalSheet payload={payload} origin={origin} />
          {/* US7/T029 — "meu custo subiu desde que cotei?" answered on request, side by side. It
              records nothing; only "Recalcular hoje" below turns today's number into a record. */}
          <CompareTodayBlock item={item} product={originProduct} kit={originKit} />
        </>
      )}

      {/* ux §4 — the two actions the document itself offers, side by side. They sit OUTSIDE the
          `payload &&` block on purpose: a payload this client cannot parse (a future schema) must
          not take the export with it — the SERVER renders the artifact from the stored row, and it
          can read what it wrote. Each button decides its own visibility. */}
      <div className="flex flex-wrap gap-2">
        {/* US3/T020 — reprice at today's catalog into a NEW record; the original is immutable. */}
        <RecalcTodayButton item={item} product={originProduct} kit={originKit} />
        {/* US4/T028 — the server-rendered quote/ledger (ADR-0020). */}
        <ExportButton item={item} />
      </div>
    </Shell>
  );
}

/**
 * §1.2 — the record's sync state in plain words, one calm reading per state. `pending` carries the
 * durability caveat (F4, detail-only, muted — never on the card); `failed` shows the support code so
 * the seller has something to report. All three offer [Tentar novamente]/[Descartar] (B2) except a
 * pending offline, where retry cannot work (handled inside `EntryActions`). Never rendered for a
 * synced record — a badge on everything would be noise.
 */
function SyncAlert({ item }: { item: HistoryItem }) {
  if (item.syncState === "synced") return null;

  const state = item.syncState;
  const title =
    state === "pending"
      ? t.syncPendingTitle
      : state === "blocked"
        ? t.syncBlockedTitle
        : t.syncFailedTitle;
  const body =
    state === "pending"
      ? t.syncPendingBody
      : state === "blocked"
        ? t.syncBlockedBody
        : t.syncFailedBody;
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
      <EntryActions item={item} />
    </Alert>
  );
}

/**
 * The per-channel prices the seller actually quoted — frozen strings, only formatted (M11). A `null`
 * price renders ABSENT, never `R$ 0,00` (FR-507). A kit rollup additionally states its honest line
 * counts (how many pieces contributed, how many had no such channel).
 */
function ChannelsBlock({ payload }: { payload: FrozenSnapshotPayload }) {
  const channels = payload.channels ?? [];
  return (
    <div className="flex flex-col gap-2">
      <h2 className="tf-historico__section">{t.channels}</h2>
      {channels.map((channel, i) => {
        // 014/T120 — prohibition 2 above ("an absent line is not a zero") applied to the channel
        // block, which was the one place that did not honour it. A slot recorded with NO commission
        // priced at anúncio == base: four rows asserting a marketplace price that was never
        // computed, and that the calculator itself refuses to show. The channel stays — the seller
        // DID choose that marketplace — and says what actually happened instead.
        const semComissao = !frozenChannelHasFee(payload, i);
        return <FrozenChannelRow key={i} channel={channel} semComissao={semComissao} />;
      })}
    </div>
  );
}

/**
 * 014/R3 — o nome do marketplace como a Calcular o escreve. O congelado exibia o enum CRU
 * (`MERCADO_LIVRE`) enquanto a mesma sessão da Calcular mostrava "Mercado Livre · Clássico".
 *
 * O valor cru é FALLBACK, não alvo: um documento antigo pode trazer texto livre que este dicionário
 * não conhece, e traduzir só o que ele conhece mantém a regra desta tela — o que está gravado é
 * renderizado, nunca reescrito. `null` é o canal sem marketplace, que já tinha a sua própria cópia.
 */
function marketplaceLabel(raw: string | null): string {
  if (raw === null) return messages.calculator.channels.channelFallback;
  const known: Record<string, string> = messages.calculator.marketplaceNames;
  return known[raw] ?? raw;
}

function FrozenChannelRow({
  channel,
  semComissao,
}: {
  channel: FrozenChannel;
  semComissao: boolean;
}) {
  return (
    <div className="tf-historico__channel">
      <span className="tf-historico__channel-name">{marketplaceLabel(channel.marketplace)}</span>
      {!semComissao && (
        <>
          {channel.precoAnuncioVarejo != null && (
            <span className="tf-historico__piece">
              <span>
                {tr.precoAnuncio} · {messages.calculator.captions.varejo}
              </span>
              <strong>{money(channel.precoAnuncioVarejo)}</strong>
            </span>
          )}
          {channel.recebidoLiquidoVarejo != null && (
            <span className="tf-historico__piece">
              <span>
                {tr.recebidoLiquido} · {messages.calculator.captions.varejo}
              </span>
              <strong>{money(channel.recebidoLiquidoVarejo)}</strong>
            </span>
          )}
          {channel.precoAnuncioAtacado != null && (
            <span className="tf-historico__piece">
              <span>
                {tr.precoAnuncio} · {messages.calculator.captions.atacado}
              </span>
              <strong>{money(channel.precoAnuncioAtacado)}</strong>
            </span>
          )}
          {channel.recebidoLiquidoAtacado != null && (
            <span className="tf-historico__piece">
              <span>
                {tr.recebidoLiquido} · {messages.calculator.captions.atacado}
              </span>
              <strong>{money(channel.recebidoLiquidoAtacado)}</strong>
            </span>
          )}
        </>
      )}
      {/* Said in words, in the tense of the RECORD: there is nothing to inform now — what happened
          is that this channel carried no commission on the day it was quoted. */}
      {semComissao && <span className="tf-historico__meta">{t.channelNoFee}</span>}
      {/* An honestly recorded per-slot failure, echoed as recorded — never hidden. Outside the gate
          above: an error is not a price, and a slot can fail for reasons unrelated to its fee. */}
      {channel.error && <span className="tf-historico__meta">{channel.error}</span>}
      {/* Kit rollup: how many lines contributed to this channel, how many had none. Also outside —
          the counts describe the composition, not the money. */}
      {channel.contributingLines != null && (
        <span className="tf-historico__meta">
          {t.channelContributing
            .replace("{n}", String(channel.contributingLines))
            .replace(
              "{total}",
              String((channel.contributingLines ?? 0) + (channel.skippedLines ?? 0)),
            )}
        </span>
      )}
    </div>
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="tf-historico mx-auto flex w-full max-w-md flex-col gap-4">
      <Link to="/historico" className="tf-historico__back">
        <Icon name="arrow-left" size={18} aria-hidden /> {t.backToList}
      </Link>
      <PageHeader title={title ?? t.title} />
      {children}
    </section>
  );
}

/** A kit quote ITEMIZES its pieces (SC-515) — with the names as CAPTURED, so the renderer never has
 *  to look anything up (and so a renamed product cannot rewrite a past quote). Each piece is priced
 *  at the SNAPSHOT'S headline basis (review PR-A, C1): a kit quoted at ATACADO itemizes at atacado,
 *  or the pieces would contradict the very total the seller charged (`freezeTotals` stores both). */
function KitLines({ payload, basis }: { payload: FrozenSnapshotPayload; basis: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="tf-historico__section">{t.kitPieces}</h2>
      {(payload.lines ?? []).map((line, i) => {
        const total =
          basis === "PRECO_ATACADO" ? line.totals.precoAtacado : line.totals.precoVarejo;
        return (
          <span key={i} className="tf-historico__piece">
            <span>{line.name ?? t.adhocFallback}</span>
            {/* A COUNT, not a "×" factor: `total` is ALREADY quantity-scaled (review PR-A, C2). */}
            <span className="tf-historico__qty">
              {t.kitPieceQty.replace("{n}", String(line.quantity))}
            </span>
            <strong>{total ? money(total) : "—"}</strong>
          </span>
        );
      })}
    </div>
  );
}

/** SOMENTE as linhas gravadas. A row the payload does not carry is simply not here (FR-507). */
function Breakdown({ breakdown }: { breakdown: FrozenBreakdown }) {
  const rows: [string, string | undefined][] = [
    [tr.material, breakdown.material],
    [tr.energy, breakdown.energy],
    [tr.machine, breakdown.machine],
    [tr.failure, breakdown.falha],
    [tr.finishing, breakdown.finishing],
    [tr.labor, breakdown.labor],
  ];
  const present = rows.filter((r): r is [string, string] => !!r[1]);
  const others = breakdown.otherCosts ?? [];
  if (present.length === 0 && others.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="tf-historico__section">{t.breakdown}</h2>
      {present.map(([label, value]) => (
        <BreakdownRow key={label} label={label} value={money(value)} />
      ))}
      {others.map((cost, i) => (
        <BreakdownRow
          key={`other-${i}`}
          label={cost.name ?? messages.calculator.outrosCustos.lineFallback}
          value={money(cost.value)}
        />
      ))}
    </div>
  );
}

/** The date and the formula version, labelled (A29 / FR-506) — plus the two-shelf rule in plain
 *  words, because the seller has every reason to expect the number to have moved, and it did not.
 *  The "abrir origem" affordance (T019) appears ONLY when `origin` resolved: a captured name whose
 *  id no longer exists shows its name but offers no link — never a "produto excluído" claim. */
function TechnicalSheet({
  payload,
  origin,
}: {
  payload: FrozenSnapshotPayload;
  origin: OriginTarget | null;
}) {
  return (
    <Card className="tf-historico__tech">
      <h2 className="tf-historico__section">{t.techTitle}</h2>
      <span className="tf-historico__meta">
        {t.modelVersionLine.replace("{versao}", payload.modelVersion)}
      </span>
      {/* The CAPTURED name — what the thing was called THEN. It always shows; it is part of the
          frozen document, not a live lookup. */}
      {payload.provenance && (
        <span className="tf-historico__meta">
          {t.originLine.replace("{nome}", payload.provenance.name)}
        </span>
      )}
      {/* Resolved at read time: present iff the origin still exists. Its ABSENCE is silent — the
          two-shelf rule means a gone origin is not a problem the seller has (FR-503). */}
      {origin?.kind === "PRODUCT" && (
        <Link to="/catalogo" search={{ produto: origin.id }} className="tf-historico__origin-link">
          {t.openProduct}
        </Link>
      )}
      {origin?.kind === "KIT" && (
        <Link to="/kits" search={{ id: origin.id }} className="tf-historico__origin-link">
          {t.openKit}
        </Link>
      )}
      <p className="tf-historico__meta">{t.frozenExplainer}</p>
      {/* FR-528, owner decision F2: the snapshot ASSERTS its date; it does not pretend the date was
          VERIFIED. One muted line, here and nowhere else. */}
      <span className="tf-historico__meta">{t.deviceClockNote}</span>
    </Card>
  );
}
