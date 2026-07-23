import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";

import { useSearch } from "@tanstack/react-router";

import { useEntitlement } from "@/entities/user/use-entitlement";
import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { KitsPanel } from "@/features/catalog/kits-panel";
import { CatalogTeaser } from "@/features/catalog/premium-teaser";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Button } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

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

const tablistStyle: CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
};

function CatalogTabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    let next: number;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const id = TABS[next].id;
    onChange(id);
    refs.current[id]?.focus();
  };

  return (
    <div role="tablist" aria-label={catalogo.tabsLabel} style={tablistStyle}>
      {TABS.map((tab, index) => {
        const selected = active === tab.id;
        return (
          <Button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            role="tab"
            id={`catalog-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`catalog-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            variant={selected ? "primary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

export function CatalogoPage() {
  // Landing tab: `?tab=products` (the product page returns here after a save) or `?tab=kits` (a
  // saved kit lands the seller on its list, E3/K2); otherwise Filamentos.
  const search = useSearch({ strict: false }) as { tab?: string; produto?: string };
  const [active, setActive] = useState<TabId>(() => {
    if (search.tab === "products") return "products";
    if (search.tab === "kits") return "kits";
    return "filaments";
  });

  // 013/F-02 (D1=A): the product create/edit FULL PAGE — formerly its own 2-segment route,
  // now `?produto=<id>` (or `?produto=novo`) on `/catalogo` (the route's `beforeLoad` already
  // required auth for this param, mirroring the old routes' own guard exactly — no entitlement
  // teaser check here either, matching the routes it replaces: ProdutoPage relies on the
  // server's write-time gate, GC-5). 013/FB-02: `readOnly` is the same server-informed lapsed
  // read here as everywhere else on this page — ProdutoPage does not re-derive it.
  const entitlement = useEntitlement();
  if (search.produto !== undefined) {
    return (
      <ProdutoPage
        productId={search.produto === "novo" ? undefined : search.produto}
        readOnly={entitlement.data?.status === "lapsed"}
      />
    );
  }

  // US7 (spec scenario 2 / ux §2): free and signed-out accounts meet the honest teaser — never
  // a broken CRUD screen. The teaser renders ONLY on a POSITIVELY known non-premium state
  // (signed-out, or the server said "none"); while loading/unknown the real panels render and
  // stay honest on their own (the server-side 403 → crown state). Server stays authoritative.
  const sessionStatus = useSessionStore((s) => s.status);
  const signedOut = sessionStatus !== "authenticated";
  if (signedOut || entitlement.data?.status === "none") {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageHeader title={messages.nav.catalogo} />
        <CatalogTeaser signedOut={signedOut} />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={messages.nav.catalogo} />
      <CatalogTabs active={active} onChange={setActive} />
      <div role="tabpanel" id={`catalog-panel-${active}`} aria-labelledby={`catalog-tab-${active}`}>
        {active === "filaments" && <FilamentsPanel />}
        {active === "printers" && <PrintersPanel />}
        {active === "products" && <ProductsPanel />}
        {active === "kits" && <KitsPanel />}
      </div>
    </section>
  );
}
