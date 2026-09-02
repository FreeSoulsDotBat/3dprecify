import { Link } from "@tanstack/react-router";
import { createContext, useContext } from "react";

import { useBoms } from "@/entities/bom/use-bom";
import { useProducts } from "@/entities/catalog/use-catalog";
import { frozenKitLines } from "@/entities/history/frozen-payload";
import { resolveOrigin } from "@/entities/history/origin";
import { useSnapshot } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { ExportButton } from "@/features/history/export-sheet";
import { SnapshotManageActions } from "@/features/history/snapshot-manage";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Badge, BreakdownRow, Button, Card, Icon, Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import {
    basisCaption,
    cardTitle,
    frozenPayloadOf,
    formatFrozenBRL,
    offsetOf,
    quotedDate,
    quotedTime,
    SYNC_BADGE,
} from "@/entities/history/history-format";

import { CompareTodayBlock } from "./compare-today";
import { RecalcTodayButton } from "./recalc-today";
import { ChannelsBlock } from "./snapshot-detail-channels";
import { KitLines, QuoteDocument } from "./snapshot-detail-quote";
import { SyncAlert } from "./snapshot-detail-sync-alert";
import { Breakdown, TechnicalSheet } from "./snapshot-detail-tech";

import "./history-page.css";

// ⚠ @doc DEC-015 — ZERO recômputo: todo número aqui é string GUARDADA. Linha ausente NÃO é
//   zero (FR-507), e o snapshot nunca degrada — essa ausência é a feature.

const t = messages.history;
// 019/PR-E — a cópia do orçamento é a da prancheta 18, verbatim (T087).
const tq = messages.quote;
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
    const originKit =
        origin?.kind === "KIT" ? kits.items.find((k) => k.id === origin.id) : undefined;
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
                    <strong>{formatFrozenBRL(item.headlineTotal)}</strong>
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
                    {payload.kind === "KIT" && frozenKitLines(payload).length > 0 && (
                        <KitLines payload={payload} basis={item.headlineBasis} />
                    )}
                    {/* 019/PR-E · US16 (T135) — o orçamento enviado: itens, bruto → desconto → total, e a
              validade como TEXTO. Mesmo regime desta tela: tudo é string GRAVADA, nada recalcula. */}
                    {payload.kind === "QUOTE" && (
                        <QuoteDocument payload={payload} validity={validity} item={item} />
                    )}
                    {payload.breakdown && <Breakdown breakdown={payload.breakdown} />}
                    {payload.totals.custoTotal && (
                        <BreakdownRow
                            label={tr.totalCost}
                            value={formatFrozenBRL(payload.totals.custoTotal)}
                            emphasis="total"
                        />
                    )}
                    {payload.channels && payload.channels.length > 0 && (
                        <ChannelsBlock payload={payload} />
                    )}
                    <TechnicalSheet payload={payload} origin={origin} />
                    {/* US7/T029 — "meu custo subiu desde que cotei?" answered on request, side by side. It
              records nothing; only "Recalcular hoje" below turns today's number into a record. */}
                    <CompareTodayBlock item={item} product={originProduct} kit={originKit} />
                </>
            )}

            {/* 019/PR-E · US17 — dito onde as ações estariam: o que falta ali não está quebrado, é o que
          um orçamento enviado não faz. */}
            {payload?.kind === "QUOTE" && <p className="tf-historico__meta">{tq.noUnfixForSent}</p>}

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
 * 018/US2 — quando o detalhe é a COLUNA DIREITA do mestre-detalhe, ele perde a moldura de página:
 * sem `<section>` própria, sem "Voltar para a lista" (a lista está ali, à esquerda) e sem um
 * segundo `<h1>` na mesma tela — dois `<h1>` seriam uma regressão de acessibilidade vestida de
 * layout. O CONTEÚDO do registro é exatamente o mesmo nos dois modos, e é isso que faz a rota
 * `/historico?snapshot=` continuar respondendo igual no mobile e no link compartilhado.
 *
 * Context em vez de prop: `Shell` é usado em todos os ramos de estado deste arquivo (carregando,
 * erro, ausente, pronto), e enfiar a mesma prop em cada um seria quatro chances de esquecer uma.
 */
export const SnapshotEmbeddedContext = createContext(false);

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
    const embedded = useContext(SnapshotEmbeddedContext);
    if (embedded) return <div className="flex flex-col gap-4">{children}</div>;
    return (
        <section className="tf-historico mx-auto flex w-full tf-page-wide flex-col gap-4">
            <Link to="/historico" className="tf-historico__back">
                <Icon name="arrow-left" size={18} aria-hidden /> {t.backToList}
            </Link>
            <PageHeader title={title ?? t.title} />
            {children}
        </section>
    );
}
