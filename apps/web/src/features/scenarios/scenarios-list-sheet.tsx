import { useState } from "react";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import {
  useDeleteScenario,
  useDuplicateScenario,
  useRenameScenario,
  useScenarios,
} from "@/entities/scenario/use-scenarios";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { apiErrorMessage } from "@/shared/api/error-messages";
import type { ScenarioOut } from "@/shared/api/generated";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Field,
  Icon,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Spinner,
  toast,
} from "@/shared/ui";

import { ScenarioTeaserDialog, ScenarioTeaserPanel } from "./scenario-teaser";

import "./scenario-list.css";

// 010/T013+T029 (E5, PR-A US2 + PR-B US6) — "Meus cenários": the door (§0.1) + the list (§3) + the
// honest teaser (§3.5/§7) + manage (search · rename · duplicate · delete) + the lapse read-only
// freeze (§0.1/§6). This is the "Meus cenários" Sheet reached from the Calcular page header entry —
// VISIBLE for everyone (free/signed-out included).
//
// ROUTING NOTE (a measured repo fact, not a UX-doc default): a Sheet/overlay, never a
// `/calcular/cenarios` sub-route — `base:'./'` blanks any 2-segment route on cold load/refresh
// (the same trap `/kits?id=` sidestepped). Reaching a scenario in an e2e test must use client-nav.
//
// Reopening a card CLOSES the sheet and hands the raw `ScenarioConfig` + `{id, name}` to the caller
// (the Calcular page), which owns `applyScenarioConfig` (`features/calculator/scenario-bridge.ts`) —
// this feature never touches calculator form types (the FSD-Lite boundary, see scenario-bridge.ts).
//
// T029 dated deviation (noted, owner-visible): the ux wireframe's per-card "⋯" overflow menu is
// composed here as inline icon buttons (pencil/copy/trash-2) instead — there is no DropdownMenu DS
// primitive (ux §10.2 G3 flags this as a compose-first gap), and `features/catalog/catalog-panel.tsx`
// already ships the identical inline-icon-row convention for filaments/printers/kits; reusing it
// keeps one idiom instead of inventing a menu component for this slice. Functionally equivalent
// (Abrir · Duplicar · Renomear · Excluir, each gated per §0.1) — a design nit, not a behavior change.
// T026's checkbox claimed the "Duplicar" affordance was already wired client-side; it was not (only
// the backend endpoint existed) — completed here as part of the shared action row.

const t = messages.scenarios;

// 013 US4 (FB-03) — the create path (`save-scenario-sheet.tsx`) and the backend both validate note
// <= 500; the rename path did not. Same limit, same message (`t.noteTooLong`) — never a second
// string for the same rule.
const NOTE_MAX = 500;

export interface ScenariosListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScenario: (
    config: ScenarioConfig,
    meta: { id: string; name: string; note: string | null },
  ) => void;
}

/** "há poucos minutos" / "há N min/h/dia(s)/semana(s)" — a MANAGEMENT convenience, never a
 *  date-as-claim (§0.2/§11-F6: the card states no date, only how long since it last changed). */
function relativeLabel(iso: string, now: number): string {
  const diffMin = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffDay = Math.floor(diffH / 24);
  if (diffDay < 7) return `há ${diffDay} dia${diffDay === 1 ? "" : "s"}`;
  const diffWeek = Math.floor(diffDay / 7);
  return `há ${diffWeek} semana${diffWeek === 1 ? "" : "s"}`;
}

/** A failed write's honest, specific line — never a generic error, never a fake success (§0.1). */
function honestWriteError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 0 ? t.writeOffline : apiErrorMessage(err);
  }
  return t.writeOffline;
}

function ScenarioCard({
  item,
  onOpen,
  writesDisabled,
  writesReason,
  onRename,
  onDuplicate,
  onDeleteRequest,
}: {
  item: ScenarioOut;
  onOpen: () => void;
  writesDisabled: boolean;
  writesReason: string | undefined;
  onRename: (item: ScenarioOut) => void;
  onDuplicate: (item: ScenarioOut) => void;
  onDeleteRequest: (item: ScenarioOut) => void;
}) {
  const reasonId = `tf-scenario-reason-${item.id}`;
  return (
    <Card padding="sm" className="flex flex-col gap-1" data-testid="scenario-card">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-1 text-left"
        aria-label={`${t.open} ${item.name}`}
      >
        {/* T030b: single-line ellipsis on the name (already truncate); the note gets an EXPLICIT
            ellipsis marker layered on the 2-line clamp — `line-clamp-2` alone hides overflow but
            leaves no visual cue that text was cut (the T018 nit). */}
        <p className="truncate text-sm font-medium">{item.name}</p>
        {item.note && (
          <p className="tf-scenario-note line-clamp-2 text-sm text-[var(--text-muted)]">
            {item.note}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          {t.updatedRelative.replace("{quando}", relativeLabel(item.updatedAt, Date.now()))}
        </p>
      </button>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={writesDisabled}
          aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
          aria-label={`${t.rename} ${item.name}`}
          onClick={() => onRename(item)}
        >
          <Icon name="pencil" size={18} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={writesDisabled}
          aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
          aria-label={`${t.duplicate} ${item.name}`}
          onClick={() => onDuplicate(item)}
        >
          <Icon name="copy" size={18} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={writesDisabled}
          aria-describedby={writesDisabled && writesReason ? reasonId : undefined}
          aria-label={`${t.delete} ${item.name}`}
          onClick={() => onDeleteRequest(item)}
        >
          <Icon name="trash-2" size={18} aria-hidden />
        </Button>
      </div>
      {writesDisabled && writesReason && (
        <p id={reasonId} className="text-right text-xs text-[var(--text-muted)]">
          {writesReason}
        </p>
      )}
    </Card>
  );
}

function ScenarioListBody({
  onOpenScenario,
  onClose,
  lapsed,
}: {
  onOpenScenario: (item: ScenarioOut) => void;
  onClose: () => void;
  lapsed: boolean;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const { items, isLoading, isError, stale, refetch, loadMore, hasMore, isFetchingMore } =
    useScenarios({ q: debouncedQuery });

  const online = useOnline();
  const writesDisabled = lapsed || !online;
  const writesReason = lapsed ? t.writeLapsed : !online ? t.writeOffline : undefined;

  const rename = useRenameScenario();
  const duplicate = useDuplicateScenario();
  const del = useDeleteScenario();

  const [renameTarget, setRenameTarget] = useState<ScenarioOut | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameNote, setRenameNote] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<ScenarioOut | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const [duplicateError, setDuplicateError] = useState<string | undefined>(undefined);

  const openRename = (item: ScenarioOut) => {
    setRenameError(undefined);
    setRenameName(item.name);
    setRenameNote(item.note ?? "");
    setRenameTarget(item);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (trimmed === "") {
      setRenameError(t.nameRequired);
      return;
    }
    if (trimmed.length > 120) {
      setRenameError(t.nameTooLong);
      return;
    }
    if (renameNote.length > NOTE_MAX) {
      setRenameError(t.noteTooLong);
      return;
    }
    try {
      await rename.mutateAsync({
        id: renameTarget.id,
        body: { name: trimmed, note: renameNote.trim() || null },
      });
      toast(t.renamed, { tone: "success" }); // real 2xx only
      setRenameTarget(null);
    } catch (err) {
      setRenameError(honestWriteError(err));
    }
  };

  const handleDuplicate = async (item: ScenarioOut) => {
    setDuplicateError(undefined);
    try {
      const copy = await duplicate.mutateAsync(item.id);
      toast(t.duplicated, { tone: "success" }); // real 2xx only
      // ux §5: the copy loads immediately so the seller can tweak-and-compare right away.
      onOpenScenario(copy);
    } catch (err) {
      setDuplicateError(honestWriteError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(undefined);
    try {
      await del.mutateAsync(deleteTarget.id);
      toast(t.deleted, { tone: "success" }); // real 2xx only
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(honestWriteError(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <Spinner />
      </div>
    );
  }

  // A cold failure (nothing cached, nothing served) — never an error wall over data already held.
  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger">{t.loadError}</Alert>
        <Button variant="secondary" onClick={refetch}>
          {t.retry}
        </Button>
      </div>
    );
  }

  const searching = debouncedQuery.trim() !== "";

  return (
    <div className="flex flex-col gap-3">
      {/* No visible label — the input carries placeholder + aria-label. (`className="sr-only"` on
          the Field hid the WHOLE control, not the label: the search box shipped 1×1px invisible —
          the real T030 "manage" red.) */}
      <Field tightLabel>
        {(p) => (
          <div className="tf-inputwrap">
            <input
              {...p}
              type="text"
              className="tf-input"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t.searchPlaceholder}
            />
          </div>
        )}
      </Field>

      {stale && (
        <Alert tone="info" title={t.offlineTitle}>
          {t.offlineBody}
          <Button variant="secondary" size="sm" onClick={refetch} className="mt-2">
            {t.retry}
          </Button>
        </Alert>
      )}
      {!stale && !isError && items.length > 0 && lapsed && (
        <Alert tone="info" title={t.lapsedTitle}>
          {t.lapsedBody}
        </Alert>
      )}
      {duplicateError && <Alert tone="danger">{duplicateError}</Alert>}

      {items.length === 0 ? (
        searching ? (
          <EmptyState
            icon="boxes"
            title={t.searchEmpty.replace("{termo}", debouncedQuery.trim())}
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                {t.searchClear}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="boxes"
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <Button variant="secondary" onClick={onClose}>
                {t.emptyAction}
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <ScenarioCard
                key={item.id}
                item={item}
                onOpen={() => onOpenScenario(item)}
                writesDisabled={writesDisabled}
                writesReason={writesReason}
                onRename={openRename}
                onDuplicate={(i) => void handleDuplicate(i)}
                onDeleteRequest={(i) => {
                  setDeleteError(undefined);
                  setDeleteTarget(i);
                }}
              />
            ))}
          </div>
          {hasMore && (
            <Button variant="secondary" onClick={loadMore} loading={isFetchingMore}>
              {t.loadMore}
            </Button>
          )}
        </>
      )}

      {/* Rename (PATCH) — name/note ONLY; never re-sends the whole config (ux §6). */}
      {/* SheetContent stays MOUNTED (like the delete Dialog below): unmounting it in the same
          commit that flips `open` false skips Radix's layered close path and strands the overlay/
          body pointer-events (the T030 frozen-app defect — nested-dialog conditional-unmount). */}
      <Sheet open={renameTarget !== null} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <SheetContent>
          <div className="flex flex-col gap-4">
            <SheetTitle>{t.renameSheetTitle}</SheetTitle>
            <Field label={t.nameField} required>
              {(p) => (
                <div className="tf-inputwrap">
                  <input
                    {...p}
                    type="text"
                    className="tf-input"
                    maxLength={121}
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                  />
                </div>
              )}
            </Field>
            <Field label={t.noteField} optional>
              {(p) => (
                <div className="tf-inputwrap">
                  <textarea
                    {...p}
                    className="tf-input"
                    rows={3}
                    value={renameNote}
                    onChange={(e) => setRenameNote(e.target.value)}
                  />
                </div>
              )}
            </Field>
            {renameError && <p className="text-sm text-[var(--danger-text)]">{renameError}</p>}
            <Button onClick={() => void submitRename()} loading={rename.isPending}>
              {t.saveChanges}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete (soft) — always confirmed, never silent (ux §6). */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent variant="center">
          {deleteTarget && (
            <div className="flex flex-col gap-3">
              <DialogTitle>{t.deleteTitle.replace("{nome}", deleteTarget.name)}</DialogTitle>
              <DialogDescription>{t.deleteBody}</DialogDescription>
              {deleteError && <Alert tone="danger">{deleteError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  {t.back}
                </Button>
                <Button
                  variant="danger"
                  loading={del.isPending}
                  onClick={() => void handleDelete()}
                >
                  {t.deleteConfirm}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ScenariosListSheet({
  open,
  onOpenChange,
  onOpenScenario,
}: ScenariosListSheetProps) {
  const sessionStatus = useSessionStore((s) => s.status);
  const entitlement = useEntitlement();
  const signedOut = sessionStatus !== "authenticated";
  // Never/free (a session that exists but never bought Premium) meets the SAME honest door as
  // signed-out (§0.1 matrix, "none" row) — never a broken empty list pretending the feature is on.
  const showTeaser = signedOut || entitlement.data?.status === "none";
  const [teaserDialogOpen, setTeaserDialogOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent>
          <SheetTitle>{t.listTitle}</SheetTitle>
          <SheetDescription>{t.listSubtitle}</SheetDescription>

          {showTeaser ? (
            <>
              <ScenarioTeaserPanel
                signedOut={signedOut}
                onOpenDialog={() => setTeaserDialogOpen(true)}
                dialogOpen={teaserDialogOpen}
              />
              <ScenarioTeaserDialog
                open={teaserDialogOpen}
                onOpenChange={setTeaserDialogOpen}
                signedOut={signedOut}
              />
            </>
          ) : (
            <ScenarioListBody
              lapsed={entitlement.data?.status === "lapsed"}
              onClose={() => onOpenChange(false)}
              onOpenScenario={(item) => {
                onOpenScenario(item.config as unknown as ScenarioConfig, {
                  id: item.id,
                  name: item.name,
                  note: item.note,
                });
                onOpenChange(false);
              }}
            />
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}
