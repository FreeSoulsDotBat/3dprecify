import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";

import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// Catálogo — the premium catalog surface (E2 · US3/US4 → T019/T022; US6 → T030). IA = segmented
// tabs (ux §0.1-A, G1) composed from a Button toggle-group with `role="tablist"` + roving tabindex
// + `aria-selected` (no new DS primitive invented). Each tab owns one premium panel; Produtos
// navigates to its full-page create/edit routes (§1.6b). The route is auth-guarded; the
// free/lapsed teaser is US7.

const catalogo = messages.catalogo;

type TabId = "filaments" | "printers" | "products";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "filaments", label: catalogo.tabFilaments },
  { id: "printers", label: catalogo.tabPrinters },
  { id: "products", label: catalogo.tabProducts },
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
  const [active, setActive] = useState<TabId>("filaments");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={messages.nav.catalogo} />
      <CatalogTabs active={active} onChange={setActive} />
      <div role="tabpanel" id={`catalog-panel-${active}`} aria-labelledby={`catalog-tab-${active}`}>
        {active === "filaments" && <FilamentsPanel />}
        {active === "printers" && <PrintersPanel />}
        {active === "products" && <ProductsPanel />}
      </div>
    </section>
  );
}
