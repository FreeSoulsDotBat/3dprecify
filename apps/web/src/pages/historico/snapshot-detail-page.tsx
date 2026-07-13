import { Link } from "@tanstack/react-router";

import type { FrozenBreakdown, FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import { useHistory } from "@/entities/history/use-history";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Badge, BreakdownRow, Card, Icon, Spinner } from "@/shared/ui";
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
} from "./history-format";

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
  const history = useHistory();
  // The union again — never the server query alone. A pending record must open exactly like a
  // synced one: it is the same document, and the seller's own quote must not be unreadable simply
  // because the server has not seen it yet.
  const item = history.items.find((i) => i.clientSnapshotId === snapshotId) ?? null;

  if (history.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Shell>
    );
  }

  if (!item) {
    return (
      <Shell>
        <Alert tone="info">{t.notFound}</Alert>
      </Shell>
    );
  }

  const payload = frozenPayloadOf(item);
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

      {payload && (
        <>
          <p className="tf-historico__meta">{t.frozenCaption.replace("{data}", date)}</p>
          {payload.lines && payload.lines.length > 0 && <KitLines payload={payload} />}
          {payload.breakdown && <Breakdown breakdown={payload.breakdown} />}
          {payload.totals.custoTotal && (
            <BreakdownRow
              label={tr.custoTotal}
              value={money(payload.totals.custoTotal)}
              emphasis="total"
            />
          )}
          <TechnicalSheet payload={payload} />
        </>
      )}
    </Shell>
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
 *  to look anything up (and so a renamed product cannot rewrite a past quote). */
function KitLines({ payload }: { payload: FrozenSnapshotPayload }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="tf-historico__section">{t.kitPieces}</h2>
      {(payload.lines ?? []).map((line, i) => (
        <span key={i} className="tf-historico__piece">
          <span>{line.name ?? t.adhocFallback}</span>
          <span className="tf-historico__qty">{line.quantity}×</span>
          <strong>{line.totals.precoVarejo ? money(line.totals.precoVarejo) : "—"}</strong>
        </span>
      ))}
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
 *  words, because the seller has every reason to expect the number to have moved, and it did not. */
function TechnicalSheet({ payload }: { payload: FrozenSnapshotPayload }) {
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
      <p className="tf-historico__meta">{t.frozenExplainer}</p>
      {/* FR-528, owner decision F2: the snapshot ASSERTS its date; it does not pretend the date was
          VERIFIED. One muted line, here and nowhere else. */}
      <span className="tf-historico__meta">{t.deviceClockNote}</span>
    </Card>
  );
}
