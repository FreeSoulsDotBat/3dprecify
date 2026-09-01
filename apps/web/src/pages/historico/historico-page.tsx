import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { useFilaments, usePrinters, useProducts } from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { useBoms } from "@/entities/bom/use-bom";
import {
    QuoteBuilder,
    type QuoteCatalogItem,
    type QuoteLineInputResult,
} from "@/features/history/quote-builder";
import { SnapshotDetailPage } from "@/pages/historico/snapshot-detail-page";
import { premiumGate } from "@/shared/billing/premium-gate";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useIsWide } from "@/shared/lib/use-is-wide";
import { useSessionStore } from "@/shared/session/session-store";
import { Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { GateChecking, GateError } from "@/pages/historico/history-gate-states";
import { HistoryLedger } from "@/pages/historico/history-ledger";
import { HistoryMasterDetail } from "@/pages/historico/history-master-detail";
import { useHistoricoSearch } from "@/pages/historico/historico-search";
import { toLineInput } from "@/pages/historico/quote-line-input";

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

const t = messages.history;

export function HistoricoPage() {
    const sessionStatus = useSessionStore((s) => s.status);
    const entitlement = useEntitlement();
    // 013/F-02 (D1=A): `?snapshot=<clientSnapshotId>` — formerly its own 2-segment route
    // (`/historico/$snapshotId`), now a search param on THIS route (route's `beforeLoad` already
    // required auth for this param, mirroring the old route's own guard).
    // 019/PR-E (T088) — `?construir=1`, molde de `?produto=novo`/`?snapshot=` (1 segmento, a
    // armadilha de `base:'./'` do 013/F-02): abre o construtor de orçamento NA MESMA rota.
    const search = useHistoricoSearch();
    // 018/US2 — o corte de 1280px decide entre mestre-detalhe e a tela de hoje.
    const isWide = useIsWide();
    // 019/PR-B (T046, prancheta 32f) — a parede caiu: "never-subscribed" e "signed-out" NÃO saltam
    // mais para um teaser de página inteira. A página segue com o cabeçalho normal e é a
    // `HistoryLedger` (e o corte mestre-detalhe, que a compõe) quem decide mostrar o vazio didático
    // no lugar da lista — exatamente como quem paga vê um vazio quando ainda não tem registro.
    const gate = premiumGate(entitlement.data, { status: sessionStatus });

    // Session bootstrap is NOT "signed out" — a premium seller must never flash the door. Nor is "we
    // have not heard from the server yet" the same as "free": `unknown` com dado ausente ainda
    // precisa do spinner/erro de sempre (o deslogado nunca chega aqui — `premiumGate` já resolve
    // `signed-out` sem depender de `entitlement.data`).
    if (sessionStatus === "loading") return <GateChecking />;
    if (gate === "unknown" && !entitlement.data && entitlement.isLoading) return <GateChecking />;
    // Settled with NO answer and nothing cached (offline / server down / no persisted plan): do NOT
    // fall through to the ledger's COLD error wall, and do NOT presume "free" for a premium seller
    // whose plan simply could not be checked. A calm "could not verify your plan" + retry, mirroring
    // the shipped E2/E3 gate (review PR-A, C5).
    if (gate === "unknown" && !entitlement.data) return <GateError onRetry={entitlement.refetch} />;
    // 019/PR-E (T088) — a barreira é a AUSÊNCIA do construtor (Premium sem parede, PR-B): sem gate
    // `active` o `?construir=1` cai para o vazio didático/lista de sempre — nunca um formulário
    // inerte de orçamento. O `beforeLoad` da rota já exige sessão para este parâmetro; falta só o
    // gate de entitlement, que é sempre em-página (Constituição IV).
    if (search.construir && gate === "active") return <QuoteBuilderRoute />;
    // 018/US2 — no desktop, lista e registro na MESMA tela. Abaixo do corte nada muda: `?snapshot=`
    // continua sendo uma tomada de página inteira, que é o caminho do mobile e do link compartilhado.
    if (isWide) return <HistoryMasterDetail snapshotId={search.snapshot} />;
    if (search.snapshot) return <SnapshotDetailPage snapshotId={search.snapshot} />;
    return <HistoryLedger />;
}

/**
 * 019/PR-E (T088) — o construtor de orçamento, na mesma rota (`?construir=1`, molde do
 * `?produto=novo`/`?snapshot=` de sempre). A page é quem tem os quatro hooks do Catálogo E o
 * `useFeeCatalog` — a mesma composição de `pages/catalogo/catalogo-page.tsx` (T124), só que aqui
 * alimenta `toLineInput` em vez de um mapa `recomputed`.
 *
 * T125 (ADR-0033) — o construtor NÃO lê observação de preço (vocabulário exclusivo do recálculo do
 * Catálogo, guarda `fixed-price-property.test.tsx`): a data de "preço parado desde" que a lista de
 * escolha mostra é `updatedAt` do próprio registro do produto, nunca uma observação salva.
 */
function QuoteBuilderRoute() {
    const navigate = useNavigate();
    const products = useProducts();
    const boms = useBoms();
    const { isLoading: filamentsLoading } = useFilaments();
    const { isLoading: printersLoading } = usePrinters();
    const { catalog, source } = useFeeCatalog();

    const referencesLoading = filamentsLoading || printersLoading;

    const observations = useMemo(() => {
        const out = new Map<string, { observedAt: string }>();
        for (const p of products.items) out.set(p.id, { observedAt: p.updatedAt });
        return out;
    }, [products.items]);

    const ctx = useMemo(() => ({ catalog, source, now: Date.now() }), [catalog, source]);
    const toLine = useCallback(
        (item: QuoteCatalogItem): QuoteLineInputResult | null => toLineInput(item, ctx),
        [ctx],
    );

    // A volta para a lista: `onSent` NÃO abre o registro recém-gravado direto — a lista mostra o
    // novo card (o mestre-detalhe abre o primeiro sozinho, que já é o mais recente).
    const backToList = () => void navigate({ to: "/historico", search: {}, replace: true });

    return (
        <section className="tf-historico mx-auto flex w-full tf-page-wide flex-col gap-4">
            <PageHeader title={t.title} />
            {products.isLoading || boms.isLoading || referencesLoading ? (
                <div className="flex justify-center py-8">
                    <Spinner />
                </div>
            ) : (
                <QuoteBuilder
                    products={products.items}
                    kits={boms.items}
                    observations={observations}
                    toLineInput={toLine}
                    onSent={backToList}
                />
            )}
        </section>
    );
}
