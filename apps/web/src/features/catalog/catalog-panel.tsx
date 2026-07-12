import { type CSSProperties, type ReactNode, useState } from "react";

import { type CatalogListState } from "@/entities/catalog/use-catalog";
import { honestWriteError } from "@/shared/api/error-messages";
import { messages } from "@/shared/i18n/messages.pt-br";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Icon,
  Sheet,
  SheetContent,
  SheetTitle,
  Spinner,
  toast,
} from "@/shared/ui";

// Generic premium catalog panel (T019, reused by T022). It owns the list/empty/loading/error/offline
// presentation plus the create/edit Sheet and the delete confirm Dialog; the entity-specific bits
// (form, row texts, wire mapping) come in as props. The honesty rules are enforced HERE: a success
// toast fires ONLY after a real 2xx; a failed write keeps the Sheet open with a specific, honest line
// (offline → "precisa de conexão"; a server code → its pt-BR phrase) and never fakes a save.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

const captionText: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-caption)",
  color: "var(--text-muted)",
};
const rowName: CSSProperties = {
  display: "block",
  fontWeight: "var(--fw-semibold)",
  color: "var(--text-strong)",
};
const rowSummary: CSSProperties = {
  display: "block",
  fontSize: "var(--fs-caption)",
  color: "var(--text-muted)",
};

export interface CatalogPanelCopy {
  addLabel: string;
  emptyTitle: string;
  emptyBody: string;
  newTitle: string;
  editTitle: string;
  savedToast: string;
  count: (n: number) => string;
}

export interface CatalogPanelProps<TItem extends { id: string }, TForm, TWire = unknown> {
  list: CatalogListState<TItem>;
  copy: CatalogPanelCopy;
  rowName: (item: TItem) => string;
  rowSummary: (item: TItem) => string;
  /** Sheet mode (filaments/printers, §0.2). Omitted when the panel NAVIGATES instead (products). */
  emptyForm?: TForm;
  toFormValues?: (item: TItem) => TForm;
  renderForm?: (args: {
    mode: "create" | "edit";
    defaultValues: TForm;
    submitting: boolean;
    submitError?: string;
    onSubmit: (body: TWire) => void;
    onCancel: () => void;
  }) => ReactNode;
  create?: (body: TWire) => Promise<unknown>;
  update?: (id: string, body: TWire) => Promise<unknown>;
  /** Navigation mode (products, ux §1.6b): create/edit are FULL PAGE routes, not a Sheet. */
  onCreateNavigate?: () => void;
  onEditNavigate?: (item: TItem) => void;
  remove: (id: string) => Promise<unknown>;
  /** A create/update is in flight (drives the form's save spinner). */
  saving?: boolean;
  /** A delete is in flight (drives the confirm-dialog spinner). */
  deleting: boolean;
  /** US6-4: an honest info line added to the delete confirm when products reference this item. */
  deleteWarning?: (item: TItem) => string | undefined;
}

type SheetState<TItem> = { mode: "create" } | { mode: "edit"; item: TItem };

export function CatalogPanel<TItem extends { id: string }, TForm, TWire = unknown>({
  list,
  copy,
  rowName: nameOf,
  rowSummary: summaryOf,
  emptyForm,
  toFormValues,
  renderForm,
  create,
  update,
  onCreateNavigate,
  onEditNavigate,
  remove,
  saving,
  deleting,
  deleteWarning,
}: CatalogPanelProps<TItem, TForm, TWire>) {
  const [sheet, setSheet] = useState<SheetState<TItem> | null>(null);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  const openCreate = () => {
    if (onCreateNavigate) return onCreateNavigate(); // full-page route (products, §1.6b)
    setSubmitError(undefined);
    setSheet({ mode: "create" });
  };
  const openEdit = (item: TItem) => {
    if (onEditNavigate) return onEditNavigate(item);
    setSubmitError(undefined);
    setSheet({ mode: "edit", item });
  };
  const closeSheet = () => {
    setSheet(null);
    setSubmitError(undefined);
  };

  const handleSubmit = async (body: TWire) => {
    setSubmitError(undefined);
    try {
      if (sheet?.mode === "edit") await update?.(sheet.item.id, body);
      else await create?.(body);
      toast(copy.savedToast, { tone: "success" }); // real 2xx only
      setSheet(null);
    } catch (err) {
      setSubmitError(honestWriteError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(undefined);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(honestWriteError(err));
    }
  };

  const addButton = (block = false) => (
    <Button size="sm" onClick={openCreate} className={block ? undefined : "shrink-0"}>
      <Icon name="plus" size={16} aria-hidden /> {copy.addLabel}
    </Button>
  );

  let body: ReactNode;
  if (list.isLoading) {
    body = (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  } else if (list.isError && list.error?.code === "ENTITLEMENT_REQUIRED") {
    // Reads are gated server-side for a non-active account — honest, no fake CRUD (the full US7
    // teaser lands separately; this is the calm, no-price/date placeholder).
    body = <EmptyState icon="crown" title={messages.apiError.entitlementRequired} />;
  } else if (list.isError) {
    body = (
      <Alert tone="danger" title={catalogo.loadError}>
        <Button variant="secondary" size="sm" onClick={list.refetch} className="mt-2">
          {catalogo.retry}
        </Button>
      </Alert>
    );
  } else if (list.items.length === 0) {
    body = (
      <EmptyState
        icon="package"
        title={copy.emptyTitle}
        description={copy.emptyBody}
        action={addButton(true)}
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p style={captionText}>{copy.count(list.items.length)}</p>
          {addButton()}
        </div>
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.items.map((item) => (
            <li key={item.id}>
              <Card padding="sm" className="flex items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEdit(item)}
                >
                  <span style={rowName}>{nameOf(item)}</span>
                  <span style={rowSummary}>{summaryOf(item)}</span>
                  {list.stale && <span style={rowSummary}>{catalogo.staleHint}</span>}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.edit} ${nameOf(item)}`}
                  onClick={() => openEdit(item)}
                >
                  <Icon name="pencil" size={18} aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.remove} ${nameOf(item)}`}
                  onClick={() => setDeleteTarget(item)}
                >
                  <Icon name="trash-2" size={18} aria-hidden />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Offline read (Q2): calm info banner, never danger. Writes still surface an honest intercept. */}
      {list.stale && (
        <Alert tone="info" title={catalogo.offlineTitle}>
          {catalogo.offlineBody}
        </Alert>
      )}

      {body}

      {/* Create / edit — right-anchored full-height Sheet (survives the mobile keyboard, §0.2). */}
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent side="right">
          {sheet && renderForm && (
            <div className="flex flex-col gap-4">
              <SheetTitle>{sheet.mode === "edit" ? copy.editTitle : copy.newTitle}</SheetTitle>
              {renderForm({
                mode: sheet.mode,
                defaultValues:
                  sheet.mode === "edit" ? toFormValues!(sheet.item) : (emptyForm as TForm),
                submitting: saving ?? false,
                submitError,
                onSubmit: handleSubmit,
                onCancel: closeSheet,
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete — center confirm Dialog with the name echoed; never a silent delete. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(undefined);
          }
        }}
      >
        <DialogContent variant="center">
          {deleteTarget && (
            <div className="flex flex-col gap-3">
              <DialogTitle>{cf.deleteTitle.replace("{nome}", nameOf(deleteTarget))}</DialogTitle>
              <DialogDescription>{cf.deleteBody}</DialogDescription>
              {/* US6-4: referenced-item warn — honest heads-up, still deletable (server captures
                  last-known + unlinks in the same txn). */}
              {deleteWarning?.(deleteTarget) && (
                <Alert tone="info">{deleteWarning(deleteTarget)}</Alert>
              )}
              {deleteError && <Alert tone="danger">{deleteError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  {cf.cancel}
                </Button>
                <Button variant="danger" loading={deleting} onClick={handleDelete}>
                  {cf.deleteConfirm}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
