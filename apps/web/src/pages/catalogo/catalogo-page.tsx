import { useNavigate, useSearch } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { KitsPanel } from "@/features/catalog/kits-panel";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { PremiumTeaser } from "@/shared/billing/premium-teaser";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Segmented } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import "./catalogo-page.css";

// Catálogo — the premium catalog surface (E2 · US3/US4 → T019/T022; US6 → T030). IA = segmented
// tabs (ux §0.1-A, G1) composed from a Button toggle-group with `role="tablist"` + roving tabindex
// + `aria-selected` (no new DS primitive invented). Each tab owns one premium panel; Produtos
// navigates to its full-page create/edit routes (§1.6b). The route is PUBLIC — only the
// `?produto=` sub-view within it requires auth (`router.tsx` `catalogoRoute`, 007/US7); the
// free/lapsed teaser is US7. (013 audit remediation, E2-04: this comment previously said
// "auth-guarded", contradicting the router.)

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

  // US7 (spec scenario 2 / ux §2): free and signed-out accounts meet the honest teaser — never
  // a broken CRUD screen. The teaser renders ONLY on a POSITIVELY known non-premium state
  // (signed-out, or the server said "none"); while loading/unknown the real panels render and
  // stay honest on their own (the server-side 403 → crown state). Server stays authoritative.
  //
  // Both hooks are called UNCONDITIONALLY, above every early return (including the `?produto=`
  // branch right below) — the Rules of Hooks: this component stays mounted across a `/catalogo`
  // ⇄ `/catalogo?produto=…` transition (same route, different search), so a hook called on only
  // ONE of those branches throws "Rendered fewer hooks than expected" on the very next render.
  const sessionStatus = useSessionStore((s) => s.status);
  const entitlement = useEntitlement();

  // 013/F-02 (D1=A): the product create/edit FULL PAGE — formerly its own 2-segment route, now
  // `?produto=<id>` (or `?produto=novo`) on `/catalogo` (the route's `beforeLoad` already
  // required auth for this param, mirroring the old routes' own guard exactly — no entitlement
  // teaser check here either, matching the routes it replaces: ProdutoPage relies on the
  // server's write-time gate, GC-5). 013/FB-02: `readOnly` is the same server-informed lapsed
  // read here as everywhere else on this page — ProdutoPage does not re-derive it.
  if (search.produto !== undefined) {
    return (
      <ProdutoPage
        productId={search.produto === "novo" ? undefined : search.produto}
        readOnly={entitlement.data?.status === "lapsed"}
      />
    );
  }

  const signedOut = sessionStatus !== "authenticated";
  if (signedOut || entitlement.data?.status === "none") {
    return (
      <section className="mx-auto flex w-full tf-page-wide flex-col gap-4">
        <PageHeader title={messages.nav.catalogo} />
        <PremiumTeaser feature="CATALOG" signedOut={signedOut} />
      </section>
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
