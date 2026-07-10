import {
  useCreatePrinter,
  useDeletePrinter,
  usePrinters,
  useUpdatePrinter,
} from "@/entities/catalog/use-catalog";
import type { PrinterIn, PrinterOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CatalogPanel } from "./catalog-panel";
import {
  emptyPrinterForm,
  type PrinterFormValues,
  printerSummary,
  printerToForm,
} from "./catalog-schema";
import { PrinterForm } from "./printer-form";

// Printers tab wiring (T022) — the mirror of FilamentsPanel: the same generic premium panel with the
// printer read cache + online-only write mutations + the printer form.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

export function PrintersPanel() {
  const list = usePrinters();
  const create = useCreatePrinter();
  const update = useUpdatePrinter();
  const remove = useDeletePrinter();

  return (
    <CatalogPanel<PrinterOut, PrinterFormValues, PrinterIn>
      list={list}
      copy={{
        addLabel: catalogo.addPrinter,
        emptyTitle: catalogo.emptyPrintersTitle,
        emptyBody: catalogo.emptyPrintersBody,
        newTitle: cf.newPrinter,
        editTitle: cf.editPrinter,
        savedToast: cf.savedPrinter,
        count: (n) => catalogo.countPrinters.replace("{n}", String(n)),
      }}
      rowName={(p) => p.name}
      rowSummary={printerSummary}
      emptyForm={emptyPrinterForm}
      toFormValues={printerToForm}
      renderForm={(args) => <PrinterForm {...args} />}
      create={(body) => create.mutateAsync(body)}
      update={(id, body) => update.mutateAsync({ id, body })}
      remove={(id) => remove.mutateAsync(id)}
      saving={create.isPending || update.isPending}
      deleting={remove.isPending}
    />
  );
}
