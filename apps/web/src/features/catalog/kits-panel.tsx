import { useNavigate } from "@tanstack/react-router";

import { useBoms, useDeleteBom } from "@/entities/bom/use-bom";
import type { BomOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CatalogPanel } from "./catalog-panel";

// Kits tab (E3/T015c — US6/K2). A saved kit is catalog content, so it reuses the SAME premium
// panel every other tab uses (list · empty state · confirm-delete) in NAVIGATION mode: opening a
// kit routes back to the composer, which reloads its lines and RECOMPUTES the price — no price
// was ever stored (FR-407), so a row can only ever describe structure ("2 peças"), never money.

const catalogo = messages.catalogo;

export function KitsPanel() {
  const list = useBoms();
  const remove = useDeleteBom();
  const navigate = useNavigate();

  return (
    <CatalogPanel<BomOut, never>
      list={list}
      detailKicker={catalogo.detailKit}
      copy={{
        addLabel: catalogo.addKit,
        emptyTitle: catalogo.emptyKitsTitle,
        emptyBody: catalogo.emptyKitsBody,
        newTitle: catalogo.addKit,
        editTitle: catalogo.editKit,
        savedToast: messages.bom.saved,
        count: (n) => catalogo.countKits.replace("{n}", String(n)),
      }}
      rowName={(k) => k.name}
      rowSummary={(k) => catalogo.countKitPieces.replace("{n}", String(k.lines?.length ?? 0))}
      onCreateNavigate={() => void navigate({ to: "/kits" })}
      onEditNavigate={(k) => void navigate({ to: "/kits", search: { id: k.id } })}
      // Duplicate (US4) opens the copy in the composer as a NEW, unsaved kit — the seller reviews
      // and saves it. Nothing is written behind their back, and the copy's lines reference the same
      // products, so a duplicate never forks the catalog.
      onDuplicate={(k) => void navigate({ to: "/kits", search: { id: k.id, copy: true } })}
      remove={(id) => remove.mutateAsync(id)}
      deleting={remove.isPending}
    />
  );
}
