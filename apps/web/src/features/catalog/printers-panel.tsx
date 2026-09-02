import {
    useCreatePrinter,
    useDeletePrinter,
    usePrinters,
    useProducts,
    useUpdatePrinter,
} from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import type { PrinterIn, PrinterOut } from "@/shared/api/generated";
import { premiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { CatalogPanel } from "./catalog-panel";
import {
    emptyPrinterForm,
    type PrinterFormValues,
    printerSummary,
    printerToForm,
} from "./catalog-schema";
import { PrinterForm } from "./printer-form";

// Printers tab wiring (T022) — the mirror of FilamentsPanel: the same generic premium panel with the
// printer read cache + online-only write mutations + the printer form. 019/PR-B (T044/T045): same
// `gate` wiring as the sibling — presentation AND the create/update barrier by absence.

const catalog = messages.catalog;
const cf = messages.catalogForm;

export function PrintersPanel() {
    const list = usePrinters();
    const create = useCreatePrinter();
    const update = useUpdatePrinter();
    const remove = useDeletePrinter();
    const entitlement = useEntitlement();
    const gate = premiumGate(entitlement.data, { status: useSessionStore((s) => s.status) });
    // US6-4: deleting a referenced printer warns first (the server keeps last-known + unlinks).
    const { items: products } = useProducts();
    const deleteWarning = (p: PrinterOut) => {
        const n = products.filter((prod) => prod.printerId === p.id).length;
        return n > 0 ? messages.productForm.deleteWarnPrinter.replace("{n}", String(n)) : undefined;
    };

    return (
        <CatalogPanel<PrinterOut, PrinterFormValues, PrinterIn>
            list={list}
            detailKicker={catalog.detailPrinter}
            feature="printers"
            gate={gate}
            copy={{
                addLabel: catalog.addPrinter,
                emptyTitle: catalog.emptyPrintersTitle,
                emptyBody: catalog.emptyPrintersBody,
                newTitle: cf.newPrinter,
                editTitle: cf.editPrinter,
                savedToast: cf.savedPrinter,
                count: (n) => catalog.countPrinters.replace("{n}", String(n)),
            }}
            rowName={(p) => p.name}
            rowSummary={printerSummary}
            emptyForm={emptyPrinterForm}
            toFormValues={printerToForm}
            renderForm={(args) => <PrinterForm {...args} />}
            create={gate === "active" ? (body) => create.mutateAsync(body) : undefined}
            update={gate === "active" ? (id, body) => update.mutateAsync({ id, body }) : undefined}
            remove={gate === "active" ? (id) => remove.mutateAsync(id) : undefined}
            saving={create.isPending || update.isPending}
            deleting={remove.isPending}
            deleteWarning={deleteWarning}
        />
    );
}
