import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { productNeedsAttention } from "@/entities/catalog/product-summary";
import {
    type PriceObservation,
    type RecomputedPrice,
    derivePriceChanges,
    observationKey,
    usePriceObservations,
    useObservePrices,
} from "@/entities/catalog/price-observations";
import { useFilaments, usePrinters, useProducts } from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { productToForm } from "@/features/calculator/product-mapping";
import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { KitsPanel } from "@/features/catalog/kits-panel";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { premiumGate } from "@/shared/billing/premium-gate";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Segmented } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import "./catalogo-page.css";

// Catálogo — the premium catalog surface (E2 · US3/US4 → T019/T022; US6 → T030). IA = segmented
// tabs (ux §0.1-A, G1) composed from a Button toggle-group with `role="tablist"` + roving tabindex
// + `aria-selected` (no new DS primitive invented). Each tab owns one premium panel; Produtos
// navigates to its full-page create/edit routes (§1.6b). The route is PUBLIC.
//
// 019/PR-B (T044, "Premium sem parede") — a parede US7 (`PremiumTeaser`, logado `none` OU
// deslogado) SAIU: os quatro painéis leem o próprio `premiumGate()` e mostram o vazio didático —
// não paga vê a MESMA IA de quem paga, nunca uma tela substituta. O `?produto=` continua exigindo
// auth no `beforeLoad` do router (não mexido aqui); dentro dele o formulário agora nasce inerte
// para qualquer `gate !== "active"`, não só `lapsed` (013/FB-02 só cobria o vencido).

const catalog = messages.catalog;

type TabId = "filaments" | "printers" | "products" | "kits";

const TABS: readonly { id: TabId; label: string }[] = [
    { id: "filaments", label: catalog.tabFilaments },
    { id: "printers", label: catalog.tabPrinters },
    { id: "products", label: catalog.tabProducts },
    { id: "kits", label: catalog.tabKits },
];

// 018/T010 — o `CatalogTabs` local virou `Segmented` em `shared/ui`: o MESMO comportamento de
// teclado (um ponto de tabulação + setas) que vivia aqui, agora com um dono só, porque a Conta
// passou a precisar do mesmo padrão e duas cópias é como uma delas fica para trás numa correção.
function CatalogTabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
    return (
        <Segmented
            options={TABS}
            value={active}
            onChange={onChange}
            ariaLabel={catalog.tabsLabel}
            idPrefix="catalog-tab"
            controlsPrefix="catalog-panel"
            size="sm"
        />
    );
}

export function CatalogPage() {
    // Landing tab: `?tab=products` (the product page returns here after a save) or `?tab=kits` (a
    // saved kit lands the seller on its list, E3/K2); otherwise Filamentos.
    const search = useSearch({ strict: false }) as { tab?: string; produto?: string };
    const navigate = useNavigate();
    // ⚠ @doc DEC-068 — a aba é DERIVADA da URL, nunca congelada em `useState`: com o formulário
    //   em `?produto=` o componente fica montado a visita inteira, e um `active` congelado
    //   fazia `/catalogo?tab=kits` renderizar a aba do estado velho.
    const active: TabId = TABS.some((tab) => tab.id === search.tab)
        ? (search.tab as TabId)
        : "filaments";
    // `replace` — switching tabs is not a navigation the Back button should have to walk through.
    const setActive = (id: TabId) =>
        void navigate({ to: "/catalogo", search: { tab: id }, replace: true });

    // 019/PR-B (T044) — a parede US7 saiu: os dois hooks continuam UNCONDICIONAIS, acima de todo
    // early return (Rules of Hooks — este componente segue montado na transição `/catalogo` ⇄
    // `/catalogo?produto=…`, mesma rota, `search` diferente), e `gate` é o único derivado que os
    // quatro painéis e o `ProdutoPage` leem para decidir vazio didático × lista / vivo × inerte.
    const sessionStatus = useSessionStore((s) => s.status);
    const entitlement = useEntitlement();
    const gate = premiumGate(entitlement.data, { status: sessionStatus });

    // 019/PR-D (T124) — o recálculo do Catálogo mora AQUI, não em `features/catalog` (boundary:
    // features/catalog não importa features/calculator). Também UNCONDICIONAL, acima do early
    // return do `?produto=` — os mesmos hooks de sempre.
    const products = useProducts();
    const { isLoading: filamentsLoading } = useFilaments();
    const { isLoading: printersLoading } = usePrinters();
    const { catalog, source } = useFeeCatalog();
    const {
        byKey,
        isLoading: observationsLoading,
        isError: observationsError,
    } = usePriceObservations();
    const { observe } = useObservePrices();

    // "Envenenamento" (achado registrado na fatia): com filamentos/impressoras ainda carregando,
    // `productToForm` prefiliria custo/potência a partir de defaults ("0"), e o preço computado
    // seria uma mentira momentânea — NENHUM item entra no mapa, e o PUT de observação nem dispara.
    const referencesLoading = filamentsLoading || printersLoading;

    const recomputeItems = useMemo(() => {
        if (referencesLoading) return [] as { id: string; precoVarejo: number }[];
        const out: { id: string; precoVarejo: number }[] = [];
        for (const p of products.items) {
            // Degradado (K3): fora do recálculo — nenhum "R$ 0,00", nenhuma observação nova.
            if (productNeedsAttention(p)) continue;
            const bundle = productToForm(p);
            const outcome = computeFromForm(bundle.values, { catalog, source, now: Date.now() });
            if (outcome.result) out.push({ id: p.id, precoVarejo: outcome.result.precoVarejo });
        }
        return out;
    }, [products.items, referencesLoading, catalog, source]);

    const recomputed = useMemo(
        () => new Map(recomputeItems.map((r) => [r.id, r.precoVarejo])),
        [recomputeItems],
    );

    // "Parado" (K3): a última observação salva de QUALQUER produto — inclusive um degradado, cujo
    // preço na lista é o congelado de quando o vínculo ainda existia (prancheta 16f).
    const observations = useMemo(() => {
        const out = new Map<string, { observedPrice: number; observedAt: string }>();
        for (const p of products.items) {
            const obs: PriceObservation | undefined = byKey.get(observationKey("PRODUCT", p.id));
            if (obs)
                out.set(p.id, { observedPrice: obs.observedPrice, observedAt: obs.observedAt });
        }
        return out;
    }, [products.items, byKey]);

    const observeInput = useMemo<RecomputedPrice[]>(
        () =>
            recomputeItems.map((r) => ({
                subjectKind: "PRODUCT" as const,
                subjectId: r.id,
                precoVarejo: r.precoVarejo,
            })),
        [recomputeItems],
    );

    const { changed, count: changedCount } = derivePriceChanges(observeInput, byKey);
    const changedByProductId = useMemo(
        () => new Map(changed.map((c) => [c.subjectId, { was: c.was, observedAt: c.observedAt }])),
        [changed],
    );

    // ⚠ @doc DEC-098 — a AUSÊNCIA da chamada é a barreira, nunca um 403 como primeira linha. E a
    //   "visita" é a LISTA: com a ficha aberta ninguém viu a lista, e um GET que falhou por rede
    //   não avança a marca — senão o PUT sobrescreve um "era" que o vendedor nunca viu.
    const listVisible = search.produto === undefined;
    useEffect(() => {
        if (gate !== "active" || !listVisible) return;
        if (referencesLoading || observationsLoading || observationsError) return;
        observe(observeInput, catalog.catalogVersion);
    }, [
        gate,
        listVisible,
        referencesLoading,
        observationsLoading,
        observationsError,
        observeInput,
        observe,
        catalog.catalogVersion,
    ]);

    // 013/F-02 (D1=A): the product create/edit FULL PAGE — formerly its own 2-segment route, now
    // `?produto=<id>` (or `?produto=novo`) on `/catalogo` (the route's `beforeLoad` already
    // required auth for this param, mirroring the old routes' own guard exactly — no entitlement
    // teaser check here either, matching the routes it replaces: ProdutoPage relies on the
    // server's write-time gate, GC-5). 019/PR-B: `gate` replaces the `lapsed`-only read (013/FB-02
    // never covered a "none"/free account reaching this URL directly — T044 closes that gap).
    if (search.produto !== undefined) {
        return (
            <ProdutoPage
                productId={search.produto === "novo" ? undefined : search.produto}
                gate={gate}
            />
        );
    }

    return (
        <section className="mx-auto flex w-full tf-page-wide flex-col gap-4">
            {/* 018/US1 — no desktop o título e as seções dividem UMA faixa de cabeçalho (o desenho põe as
          pílulas à direita do título). Abaixo do corte a faixa quebra em duas linhas sozinha, sem
          media query: é `flex-wrap` fazendo o trabalho, e o mobile continua exatamente como estava. */}
            <div className="tf-catalogo-head">
                <PageHeader title={messages.nav.catalog} />
                <CatalogTabs active={active} onChange={setActive} />
            </div>
            <div
                role="tabpanel"
                id={`catalog-panel-${active}`}
                aria-labelledby={`catalog-tab-${active}`}
            >
                {active === "filaments" && <FilamentsPanel />}
                {active === "printers" && <PrintersPanel />}
                {active === "products" && (
                    <ProductsPanel
                        recomputed={recomputed}
                        observations={observations}
                        changed={changedByProductId}
                        changedCount={changedCount}
                    />
                )}
                {active === "kits" && <KitsPanel />}
            </div>
        </section>
    );
}
