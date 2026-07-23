import { useNavigate } from "@tanstack/react-router";

import {
  useDeleteProduct,
  useFilaments,
  usePrinters,
  useProducts,
} from "@/entities/catalog/use-catalog";
import type { ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

import { productNeedsAttention, productSummary } from "@/entities/catalog/product-summary";

import { CatalogPanel } from "./catalog-panel";

// Produtos tab wiring (US6/T030): the uid-keyed read cache plugged into the generic premium
// panel in NAVIGATION mode — create/edit live on the full-page route (ux §1.6b), delete keeps
// the confirm Dialog here. The row summary resolves the reference NAMES from the sibling
// caches; a degraded link reads as manual. Never a price in a row (FR-310).

const catalogo = messages.catalogo;
const pf = messages.productForm;

export function ProductsPanel() {
  const list = useProducts();
  const { items: filaments, isLoading: filamentsLoading } = useFilaments();
  const { items: printers, isLoading: printersLoading } = usePrinters();
  const remove = useDeleteProduct();
  const navigate = useNavigate();

  const nameOf = (id: string | null, kind: "filament" | "printer") => {
    if (!id) return undefined;
    const pool: { id: string; name: string }[] = kind === "filament" ? filaments : printers;
    return pool.find((x) => x.id === id)?.name;
  };

  return (
    <CatalogPanel<ProductOut, never>
      list={list}
      copy={{
        addLabel: catalogo.addProduct,
        emptyTitle: catalogo.emptyProductsTitle,
        emptyBody: catalogo.emptyProductsBody,
        newTitle: pf.newProduct,
        editTitle: pf.editProduct,
        savedToast: pf.savedProduct,
        count: (n) => catalogo.countProducts.replace("{n}", String(n)),
      }}
      rowName={(p) => p.name}
      rowSummary={(p) =>
        productSummary(p, nameOf(p.filamentId, "filament"), nameOf(p.printerId, "printer"), {
          filaments: filamentsLoading,
          printers: printersLoading,
        })
      }
      // K3: one honest state for a product born manual (materialized by a kit save) and one
      // degraded by a deletion — same missing links, same remedy, so the same calm line.
      rowNote={(p) => (productNeedsAttention(p) ? catalogo.needsAttention : undefined)}
      // 013/F-02: the 2-segment routes are gone (they blanked on cold-load under `base:'./'`).
      // Navigate straight to the `?produto=` shape — going through the deprecated redirect route
      // would still work, but it costs an extra hop and keeps a dead URL alive in history.
      onCreateNavigate={() => void navigate({ to: "/catalogo", search: { produto: "novo" } })}
      onEditNavigate={(p) => void navigate({ to: "/catalogo", search: { produto: p.id } })}
      remove={(id) => remove.mutateAsync(id)}
      deleting={remove.isPending}
    />
  );
}
