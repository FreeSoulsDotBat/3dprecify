import { useNavigate, useSearch } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { KitsPanel } from "@/features/catalog/kits-panel";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { premiumGate } from "@/shared/billing/premium-gate";
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

const catalogo = messages.catalogo;

type TabId = "filaments" | "printers" | "products" | "kits";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "filaments", label: catalogo.tabFilaments },
  { id: "printers", label: catalogo.tabPrinters },
  { id: "products", label: catalogo.tabProducts },
  { id: "kits", label: catalogo.tabKits },
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
      ariaLabel={catalogo.tabsLabel}
      idPrefix="catalog-tab"
      controlsPrefix="catalog-panel"
      size="sm"
    />
  );
}

export function CatalogoPage() {
  // Landing tab: `?tab=products` (the product page returns here after a save) or `?tab=kits` (a
  // saved kit lands the seller on its list, E3/K2); otherwise Filamentos.
  const search = useSearch({ strict: false }) as { tab?: string; produto?: string };
  const navigate = useNavigate();
  // 013/F-02 follow-up — the tab is DERIVED from the URL, never frozen in `useState`.
  //
  // It used to be `useState(initializer)`, which only re-derives on MOUNT. That was fine while the
  // product form lived at `/catalogo/produtos/*`: opening it left this route, so coming back always
  // remounted and re-read `?tab=`. Now the form is `?produto=` on THIS route, so the component stays
  // mounted across the whole visit — and a frozen `active` meant (a) `?tab=products` after a product
  // save no longer selected Produtos, and (b) `/catalogo?tab=kits` as a deep link rendered whatever
  // tab happened to be in stale state. A deep-link bug hiding inside the deep-link story; the e2e
  // caught it as a filament row click that opened a product instead.
  //
  // Deriving makes the URL the single source of truth, so the tab survives reload/bookmark/back.
  // Every TabId is round-trippable, so a tab click survives reload — including `printers`, which the
  // old mount-time initializer silently dropped (it only ever recognised products/kits).
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

  // 013/F-02 (D1=A): the product create/edit FULL PAGE — formerly its own 2-segment route, now
  // `?produto=<id>` (or `?produto=novo`) on `/catalogo` (the route's `beforeLoad` already
  // required auth for this param, mirroring the old routes' own guard exactly — no entitlement
  // teaser check here either, matching the routes it replaces: ProdutoPage relies on the
  // server's write-time gate, GC-5). 019/PR-B: `gate` replaces the `lapsed`-only read (013/FB-02
  // never covered a "none"/free account reaching this URL directly — T044 closes that gap).
  if (search.produto !== undefined) {
    return (
      <ProdutoPage productId={search.produto === "novo" ? undefined : search.produto} gate={gate} />
    );
  }

  return (
    <section className="mx-auto flex w-full tf-page-wide flex-col gap-4">
      {/* 018/US1 — no desktop o título e as seções dividem UMA faixa de cabeçalho (o desenho põe as
          pílulas à direita do título). Abaixo do corte a faixa quebra em duas linhas sozinha, sem
          media query: é `flex-wrap` fazendo o trabalho, e o mobile continua exatamente como estava. */}
      <div className="tf-catalogo-head">
        <PageHeader title={messages.nav.catalogo} />
        <CatalogTabs active={active} onChange={setActive} />
      </div>
      <div role="tabpanel" id={`catalog-panel-${active}`} aria-labelledby={`catalog-tab-${active}`}>
        {active === "filaments" && <FilamentsPanel />}
        {active === "printers" && <PrintersPanel />}
        {active === "products" && <ProductsPanel />}
        {active === "kits" && <KitsPanel />}
      </div>
    </section>
  );
}
