import { type CSSProperties, type ReactNode, useState } from "react";

import { type CatalogListState } from "@/entities/catalog/use-catalog";
import { honestWriteError } from "@/shared/api/error-messages";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useIsWide } from "@/shared/lib/use-is-wide";
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

import "./catalog-master-detail.css";

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
    /** 013/FB-02 — threaded straight from the panel's `lapsed` prop. */
    readOnly?: boolean;
    onSubmit: (body: TWire) => void;
    onCancel: () => void;
  }) => ReactNode;
  create?: (body: TWire) => Promise<unknown>;
  update?: (id: string, body: TWire) => Promise<unknown>;
  /** Navigation mode (products, ux §1.6b): create/edit are FULL PAGE routes, not a Sheet. */
  onCreateNavigate?: () => void;
  onEditNavigate?: (item: TItem) => void;
  remove: (id: string) => Promise<unknown>;
  /** 013/FB-02 — Premium lapsed (ux-catalog §3): reads stay complete, writes render inert (the
   *  Sheet opens read-only with the reactivation line instead of Salvar). This only presents the
   *  state `useEntitlement()` already returned — no new gate (Constitution IV untouched). */
  lapsed?: boolean;
  /** A calm per-row note (E3/K3): the honest "needs attention" line on a product whose saved
   *  filament/printer references are missing. Absent → the row renders exactly as before. */
  rowNote?: (item: TItem) => string | undefined;
  /** Optional per-row duplicate action (E3/US4 — kits). Absent → no duplicate affordance. */
  onDuplicate?: (item: TItem) => void;
  /** A create/update is in flight (drives the form's save spinner). */
  saving?: boolean;
  /** A delete is in flight (drives the confirm-dialog spinner). */
  deleting: boolean;
  /** US6-4: an honest info line added to the delete confirm when products reference this item. */
  deleteWarning?: (item: TItem) => string | undefined;
  /** 018/US1 — rótulo do bloco de detalhe no desktop ("Filamento salvo", "Produto salvo"…). */
  detailKicker?: string;
}

type SheetState<TItem> = { mode: "create" } | { mode: "edit"; item: TItem };

export function CatalogPanel<TItem extends { id: string }, TForm, TWire = unknown>({
  list,
  copy,
  rowName: nameOf,
  rowSummary: summaryOf,
  rowNote: noteOf,
  lapsed = false,
  onDuplicate,
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
  detailKicker,
}: CatalogPanelProps<TItem, TForm, TWire>) {
  const [sheet, setSheet] = useState<SheetState<TItem> | null>(null);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  // 018/US1 — mestre-detalhe do desktop. Estado local, NUNCA na URL: a aba continua vindo de
  // `?tab=` (013/F-02 segue valendo), mas a seleção dentro de uma lista é efêmera e escrevê-la na
  // URL faria cada clique mexer no roteador sem que ninguém queira aquele link (ADR-0031/C).
  const isWide = useIsWide();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A seleção "vaza" de seção sozinha? Não: a página monta um componente DIFERENTE por seção, então
  // trocar de aba desmonta este painel e o estado nasce limpo.
  const [inlineError, setInlineError] = useState<string | undefined>(undefined);

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

  // 018/US1 — salvar PELA FICHA: mesma mutation do Sheet, mesmo toast só depois de um 2xx real, e o
  // erro fica ao lado do formulário em vez de dentro de uma gaveta que nem está aberta.
  const handleInlineSubmit = async (item: TItem, wire: TWire) => {
    setInlineError(undefined);
    try {
      await update?.(item.id, wire);
      toast(copy.savedToast, { tone: "success" });
    } catch (err) {
      setInlineError(honestWriteError(err));
    }
  };

  const addButton = (block = false) => (
    <Button size="sm" onClick={openCreate} className={block ? undefined : "shrink-0"}>
      <Icon name="plus" size={16} aria-hidden /> {copy.addLabel}
    </Button>
  );

  const rowActions = (item: TItem) => (
    <>
      {onDuplicate && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${catalogo.duplicate} ${nameOf(item)}`}
          onClick={() => onDuplicate(item)}
        >
          <Icon name="copy" size={18} aria-hidden />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${catalogo.remove} ${nameOf(item)}`}
        onClick={() => (lapsed ? openEdit(item) : setDeleteTarget(item))}
      >
        <Icon name="trash-2" size={18} aria-hidden />
      </Button>
    </>
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
  } else if (isWide) {
    // ---- 018/US1 — mestre-detalhe (≥1280px). Lista à esquerda, ficha do item à direita. ----
    const term = query.trim().toLowerCase();
    const visible = term
      ? list.items.filter((item) =>
          `${nameOf(item)} ${summaryOf(item)}`.toLowerCase().includes(term),
        )
      : list.items;
    // Derivada contra a lista ATUAL a cada render: item excluído, filtrado ou vindo de outro
    // aparelho cai para um item válido — nunca para uma ficha órfã.
    const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

    body = (
      <div className="tf-catalog-md">
        <div className="tf-catalog-md__master">
          <div className="tf-catalog-md__toolbar">
            <label className="tf-inputwrap tf-catalog-md__search">
              <span className="sr-only">{catalogo.searchLabel}</span>
              <Icon name="search" size={18} aria-hidden />
              <input
                className="tf-input"
                type="search"
                value={query}
                placeholder={catalogo.searchPlaceholder}
                aria-label={catalogo.searchLabel}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p style={captionText}>{copy.count(visible.length)}</p>
            {addButton()}
          </div>

          {visible.length === 0 ? (
            // O vazio da BUSCA não é o vazio do catálogo: aqui existem itens salvos, o filtro é que
            // não achou. Dizer "nenhum filamento salvo" seria mentira sobre os dados do vendedor.
            <EmptyState
              icon="package"
              title={catalogo.searchEmptyTitle}
              description={catalogo.searchEmptyBody}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  {catalogo.searchClear}
                </Button>
              }
            />
          ) : (
            <ul className="tf-catalog-md__list" data-testid="master-list">
              {visible.map((item) => {
                const isSelected = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid="master-item"
                      aria-current={isSelected ? "true" : undefined}
                      className={`tf-card tf-card--interactive tf-catalog-md__card${
                        isSelected ? " tf-catalog-md__card--selected" : ""
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span style={rowName}>{nameOf(item)}</span>
                      <span style={rowSummary}>{summaryOf(item)}</span>
                      {noteOf?.(item) && (
                        <span style={rowSummary} data-testid="row-note">
                          {noteOf(item)}
                        </span>
                      )}
                      {list.stale && <span style={rowSummary}>{catalogo.staleHint}</span>}
                      {lapsed && <span style={rowSummary}>{catalogo.readOnlyHint}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <aside className="tf-card tf-catalog-md__detail" data-testid="detail-panel">
            <header className="tf-catalog-md__detail-head">
              <div className="tf-catalog-md__detail-title">
                {detailKicker && <span className="tf-catalog-md__kicker">{detailKicker}</span>}
                <h2>{nameOf(selected)}</h2>
              </div>
              <div className="flex items-center gap-1">{rowActions(selected)}</div>
            </header>

            {noteOf?.(selected) && <Alert tone="info">{noteOf(selected)}</Alert>}
            {inlineError && <Alert tone="danger">{inlineError}</Alert>}

            {renderForm && toFormValues ? (
              // Filamento e impressora: a ficha É o editor. O MESMO formulário do Sheet, montado
              // aqui — não uma segunda cópia (decisão do dono no clarify; research §E).
              // `key` pelo id: sem ele o RHF manteria os defaultValues do item anterior, porque
              // `defaultValues` só valem na montagem.
              <div key={selected.id}>
                {renderForm({
                  mode: "edit",
                  defaultValues: toFormValues(selected),
                  submitting: saving ?? false,
                  submitError: inlineError,
                  readOnly: lapsed,
                  onSubmit: (wire) => void handleInlineSubmit(selected, wire),
                  onCancel: () => setInlineError(undefined),
                })}
              </div>
            ) : (
              // Produto e kit: a ficha RESUME e manda para o editor de página cheia que já existe.
              <div className="flex flex-col gap-3">
                <p style={rowSummary}>{summaryOf(selected)}</p>
                <Button variant="secondary" onClick={() => openEdit(selected)}>
                  <Icon name="pencil" size={18} aria-hidden /> {catalogo.detailOpenEditor}
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>
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
                  {noteOf?.(item) && (
                    <span style={rowSummary} data-testid="row-note">
                      {noteOf(item)}
                    </span>
                  )}
                  {list.stale && <span style={rowSummary}>{catalogo.staleHint}</span>}
                  {lapsed && <span style={rowSummary}>{catalogo.readOnlyHint}</span>}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.edit} ${nameOf(item)}`}
                  onClick={() => openEdit(item)}
                >
                  <Icon name="pencil" size={18} aria-hidden />
                </Button>
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${catalogo.duplicate} ${nameOf(item)}`}
                    onClick={() => onDuplicate(item)}
                  >
                    <Icon name="copy" size={18} aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.remove} ${nameOf(item)}`}
                  // 013/FB-02 (T034 homologation nit): on lapsed, tapping delete must NOT open the
                  // working destructive confirm and then 403 on submit — ux-catalog §3: "Never show a
                  // delete/edit as *working* then fail — the intercept happens on tap, honestly." Edit
                  // already routes lapsed to the read-only reactivation surface; delete now mirrors it,
                  // so both write affordances land on the same honest intercept (the server's
                  // ENTITLEMENT_REQUIRED 403 stays the real backstop — this is presentation only).
                  onClick={() => (lapsed ? openEdit(item) : setDeleteTarget(item))}
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

      {/* 013/FB-02 — Premium lapsed (ux-catalog §3): calm, never punitive; reads stay complete. */}
      {!list.stale && !list.isError && list.items.length > 0 && lapsed && (
        <Alert tone="info" title={catalogo.lapsedTitle}>
          {catalogo.lapsedBody}
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
                readOnly: lapsed,
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
