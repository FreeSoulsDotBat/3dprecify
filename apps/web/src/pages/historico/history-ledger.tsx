import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useHistory, useSyncOutbox, type HistoryFilters } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { premiumGate, type PremiumGate } from "@/shared/billing/premium-gate";
import { VazioDidatico } from "@/shared/billing/vazio-didatico";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionExpired } from "@/shared/session/session-expiry";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, EmptyState, Icon, Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { useHistoricoSearch } from "@/pages/historico/historico-search";

import {
    type CustomRange,
    HistoryFilterBar,
    PERIOD_LABELS,
    periodRange,
    type PeriodKey,
} from "./history-filter-bar";
import { QueueBanner } from "./history-queue-banner";
import { SnapshotCard } from "./history-snapshot-card";

const t = messages.historico;

export function HistoryLedger({ embedded = false }: { embedded?: boolean } = {}) {
    const entitlement = useEntitlement();
    const sessionStatus = useSessionStore((s) => s.status);
    const navigate = useNavigate();
    // 018/US2 — `embedded` = a lista é a coluna ESQUERDA do mestre-detalhe: sem `<section>` própria,
    // sem PageHeader (a página já os tem). O conteúdo é o mesmo, byte por byte.
    const selecionado = useHistoricoSearch().snapshot;

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
    // 019/PR-B (T046, prancheta 32f) — a porta sem parede: "nunca teve" e deslogado (mais o caso raro
    // em que `premiumGate` ainda não sabe dizer mas a LISTA já ouviu o 403 do servidor, T111/T112)
    // ganham o vazio didático NO LUGAR do conteúdo de sempre. `lapsed`/`active` seguem intocados.
    const gate = premiumGate(entitlement.data, { status: sessionStatus });
    const doorGate: PremiumGate =
        gate === "unknown" && history.error?.code === "ENTITLEMENT_REQUIRED"
            ? "never-subscribed"
            : gate;
    const showDoor = doorGate === "never-subscribed" || doorGate === "signed-out";
    // hotfix 016/A3 (H4) — `HistoryLedger` only mounts past `HistoricoPage`'s own
    // `sessionStatus === "authenticated"` gate, so a mount here already means the session IS back:
    // an `unauthenticated` entry may always be retried from this screen (the mirror of `retryBlocked`,
    // driven by the session instead of the entitlement).
    const { sync, syncing } = useSyncOutbox({ retryBlocked: entitled, retryUnauthenticated: true });

    // One connectivity truth that REACTS to reconnection (review PR-A, C6) — not a one-time read.
    const online = useOnline();
    const sessionExpired = useSessionExpired();
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
        period === "custom"
            ? `${custom.from || "—"} – ${custom.to || "—"}`
            : (PERIOD_LABELS[period as keyof typeof PERIOD_LABELS] ?? "");
    const searchEmptyTerm = (filters.q ?? "") || periodLabel;

    // [Ver] jumps to the first entry that needs a human decision (a failed/blocked/unauthenticated card).
    const firstProblem = queued.find(
        (i) =>
            i.syncState === "failed" ||
            i.syncState === "blocked" ||
            i.syncState === "unauthenticated",
    );
    const seeFirstProblem = () => {
        if (!firstProblem) return;
        const el = document.getElementById(`snap-${firstProblem.clientSnapshotId}`);
        el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    };

    // 018/US2 — na coluna, o primeiro registro abre sozinho (é o que o desenho mostra) e a escolha
    // continua morando em `?snapshot=`, onde ela JÁ morava desde o 013/F-02. Inventar um estado
    // local aqui criaria uma segunda verdade sobre "qual registro está aberto".
    // `replace` — abrir o primeiro não é um passo que o Voltar deva ter de desfazer.
    useEffect(() => {
        if (!embedded || selecionado || history.items.length === 0) return;
        void navigate({
            to: "/historico",
            search: { snapshot: history.items[0].clientSnapshotId },
            replace: true,
        });
    }, [embedded, selecionado, history.items, navigate]);

    // A moldura muda; o conteúdo, não.
    //
    // Cuidado que ISTO custou um bug real: a primeira versão declarava `Wrapper` como um COMPONENTE
    // aqui dentro. Cada render criava uma função nova, o React via um TIPO novo, e desmontava a
    // subárvore inteira — o campo de busca perdia o que estava digitado a cada tecla e o debounce
    // nunca chegava ao servidor. Dois testes do US6 pegaram na hora. Elemento, nunca componente.
    const conteudo = showDoor ? (
        // 019/PR-B (T046) — o vazio didático É o conteúdo inteiro: sem filtros, sem fila, sem spinner
        // de lista — não há nada para filtrar ou sincronizar em uma conta que nunca gravou (ou não está
        // logada). O convite é o ÚNICO desta tela (FR-1906/invariante um-teaser).
        <VazioDidatico
            feature="quotes"
            gate={doorGate}
            action={
                <Button onClick={() => void navigate({ to: "/calcular" })}>
                    {messages.premiumTeaser.fazerUmCalculo}
                </Button>
            }
        />
    ) : (
        <>
            {/* 019/PR-E (T088, prancheta 18a) — "Novo orçamento" só existe com gate `active` (Premium
          sem parede, PR-B): a barreira é a AUSÊNCIA do botão, nunca um clique que esbarra num
          403. Sem premium ativo o convite de sempre (VazioDidatico/lapsedBanner) já cobre o caso. */}
            {gate === "active" && (
                // 019/Polish (T139) — a 18a desenha "Novo orçamento" como `tf-btn--full`: o consumidor de
                // produto que a classe esperava desde a PR-A.
                <Button
                    width="full"
                    onClick={() => void navigate({ to: "/historico", search: { construir: true } })}
                >
                    <Icon name="plus" size={16} />
                    {messages.quote.newQuote}
                </Button>
            )}

            {/* A lapse deletes NOTHING: the ledger stays readable, and only writing needs an active
          Premium (FR-517). */}
            {entitlement.data?.status === "lapsed" && <Alert tone="info">{t.lapsedBanner}</Alert>}

            {/* Serving the device cache. WHY it is serving it changes what is honest to say: offline is a
          calm, expected state; a failed read while ONLINE is something the seller can retry. Saying
          "Modo leitura offline" to someone who is plainly online would be a small, needless lie
          (T016 nit). Either way the rows below still render — never an error wall over data the
          seller already holds. */}
            {/* hotfix/R2 da homologação — com a SESSÃO expirada, este alerta genérico de carga virava a
          terceira voz para o mesmo fato (banner do shell + banner da fila já dizem a causa), e o
          "Tentar novamente" dele só pode render outro 401. A causa conhecida cala a genérica. */}
            {history.stale &&
                !sessionExpired &&
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
            {history.isError && !sessionExpired && (
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
                    <EmptyState
                        icon="history"
                        title={t.searchEmpty.replace("{termo}", searchEmptyTerm)}
                    />
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
                    <Button
                        variant="secondary"
                        loading={history.isFetchingMore}
                        onClick={history.loadMore}
                    >
                        {t.loadMore}
                    </Button>
                </div>
            )}
        </>
    );

    if (embedded) return <div className="flex flex-col gap-4">{conteudo}</div>;
    return (
        <section className="tf-historico mx-auto flex w-full tf-page-wide flex-col gap-4">
            <PageHeader title={t.title} />
            <p className="text-sm text-[var(--text-muted)]">{t.subtitle}</p>
            {conteudo}
        </section>
    );
}
