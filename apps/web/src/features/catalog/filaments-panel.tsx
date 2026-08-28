import {
  useCreateFilament,
  useDeleteFilament,
  useFilaments,
  useProducts,
  useUpdateFilament,
} from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import type { FilamentIn, FilamentOut } from "@/shared/api/generated";
import { premiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

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
// 019/PR-B (T044/T045) — `gate` substitui o `lapsed` binário do 013/FB-02: além de decidir a
// apresentação, ele agora também decide se `create`/`update` chegam ao painel — a barreira do
// não-premium é a AUSÊNCIA do mutator, nunca uma checagem de `if` que alguém possa esquecer.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

export function FilamentsPanel() {
  const list = useFilaments();
  const create = useCreateFilament();
  const update = useUpdateFilament();
  const remove = useDeleteFilament();
  const entitlement = useEntitlement();
  const gate = premiumGate(entitlement.data, { status: useSessionStore((s) => s.status) });
  // US6-4: deleting a referenced filament warns first (the server keeps last-known + unlinks).
  const { items: products } = useProducts();
  const deleteWarning = (f: FilamentOut) => {
    const n = products.filter((p) => p.filamentId === f.id).length;
    return n > 0 ? messages.productForm.deleteWarnFilament.replace("{n}", String(n)) : undefined;
  };

  return (
    <CatalogPanel<FilamentOut, FilamentFormValues, FilamentIn>
      list={list}
      detailKicker={catalogo.detailFilament}
      feature="filaments"
      gate={gate}
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
      create={gate === "active" ? (body) => create.mutateAsync(body) : undefined}
      update={gate === "active" ? (id, body) => update.mutateAsync({ id, body }) : undefined}
      remove={(id) => remove.mutateAsync(id)}
      saving={create.isPending || update.isPending}
      deleting={remove.isPending}
      deleteWarning={deleteWarning}
    />
  );
}
