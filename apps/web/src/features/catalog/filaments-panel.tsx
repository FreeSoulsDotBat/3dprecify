import {
  useCreateFilament,
  useDeleteFilament,
  useFilaments,
  useProducts,
  useUpdateFilament,
} from "@/entities/catalog/use-catalog";
import type { FilamentIn, FilamentOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CatalogPanel } from "./catalog-panel";
import {
  emptyFilamentForm,
  type FilamentFormValues,
  filamentSummary,
  filamentToForm,
} from "./catalog-schema";
import { FilamentForm } from "./filament-form";

// Filaments tab wiring (T019): the uid-keyed read cache + the online-only write mutations plugged
// into the generic premium panel. All honesty/state logic lives in `CatalogPanel`.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

export function FilamentsPanel() {
  const list = useFilaments();
  const create = useCreateFilament();
  const update = useUpdateFilament();
  const remove = useDeleteFilament();
  // US6-4: deleting a referenced filament warns first (the server keeps last-known + unlinks).
  const { items: products } = useProducts();
  const deleteWarning = (f: FilamentOut) => {
    const n = products.filter((p) => p.filamentId === f.id).length;
    return n > 0 ? messages.productForm.deleteWarnFilament.replace("{n}", String(n)) : undefined;
  };

  return (
    <CatalogPanel<FilamentOut, FilamentFormValues, FilamentIn>
      list={list}
      copy={{
        addLabel: catalogo.addFilament,
        emptyTitle: catalogo.emptyFilamentsTitle,
        emptyBody: catalogo.emptyFilamentsBody,
        newTitle: cf.newFilament,
        editTitle: cf.editFilament,
        savedToast: cf.savedFilament,
        count: (n) => catalogo.countFilaments.replace("{n}", String(n)),
      }}
      rowName={(f) => f.name}
      rowSummary={filamentSummary}
      emptyForm={emptyFilamentForm}
      toFormValues={filamentToForm}
      renderForm={(args) => <FilamentForm {...args} />}
      create={(body) => create.mutateAsync(body)}
      update={(id, body) => update.mutateAsync({ id, body })}
      remove={(id) => remove.mutateAsync(id)}
      saving={create.isPending || update.isPending}
      deleting={remove.isPending}
      deleteWarning={deleteWarning}
    />
  );
}
