import { forwardRef, useImperativeHandle, useState } from "react";

import { useRenameScenario } from "@/entities/scenario/use-scenarios";
import type { ScenarioOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Field, Sheet, SheetContent, SheetTitle, toast, TextField } from "@/shared/ui";

import { honestWriteError } from "@/shared/api/error-messages";

const t = messages.scenarios;

// 013 US4 (FB-03) — the create path (`save-scenario-sheet.tsx`) and the backend both validate note
// <= 500; the rename path did not. Same limit, same message (`t.noteTooLong`) — never a second
// string for the same rule.
const NOTE_MAX = 500;

// 019/Polish — moved out of `scenarios-list-sheet.tsx` verbatim (own render, own 4 `useState`s —
// the state was already isolated to this overlay). `ScenariosList` opens it via the imperative
// `open(item)` handle instead of lifting `renameTarget`/`renameName`/`renameNote`/`renameError` back
// up — the same single-event-handler batching the original `openRename` had (name/note/error reset
// together with the target in one call), so there is no extra render/flash.
export interface RenameScenarioSheetHandle {
    open: (item: ScenarioOut) => void;
}

export const RenameScenarioSheet = forwardRef<RenameScenarioSheetHandle>(
    function RenameScenarioSheet(_props, ref) {
        const rename = useRenameScenario();

        const [target, setTarget] = useState<ScenarioOut | null>(null);
        const [name, setName] = useState("");
        const [note, setNote] = useState("");
        const [error, setError] = useState<string | undefined>(undefined);

        useImperativeHandle(ref, () => ({
            open(item: ScenarioOut) {
                setError(undefined);
                setName(item.name);
                setNote(item.note ?? "");
                setTarget(item);
            },
        }));

        const submitRename = async () => {
            if (!target) return;
            const trimmed = name.trim();
            if (trimmed === "") {
                setError(t.nameRequired);
                return;
            }
            if (trimmed.length > 120) {
                setError(t.nameTooLong);
                return;
            }
            if (note.length > NOTE_MAX) {
                setError(t.noteTooLong);
                return;
            }
            try {
                await rename.mutateAsync({
                    id: target.id,
                    body: { name: trimmed, note: note.trim() || null },
                });
                toast(t.renamed, { tone: "success" }); // real 2xx only
                setTarget(null);
            } catch (err) {
                setError(honestWriteError(err));
            }
        };

        return (
            // Rename (PATCH) — name/note ONLY; never re-sends the whole config (ux §6).
            // SheetContent stays MOUNTED (like the delete Dialog): unmounting it in the same
            // commit that flips `open` false skips Radix's layered close path and strands the overlay/
            // body pointer-events (the T030 frozen-app defect — nested-dialog conditional-unmount).
            <Sheet open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
                <SheetContent>
                    <div className="flex flex-col gap-4">
                        <SheetTitle>{t.renameSheetTitle}</SheetTitle>
                        <Field label={t.nameField} required>
                            {(p) => (
                                <TextField
                                    {...p}
                                    type="text"
                                    maxLength={121}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label={t.noteField} optional>
                            {(p) => (
                                <div className="tf-inputwrap">
                                    <textarea
                                        {...p}
                                        className="tf-input"
                                        rows={3}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </div>
                            )}
                        </Field>
                        {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
                        <Button onClick={() => void submitRename()} loading={rename.isPending}>
                            {t.saveChanges}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        );
    },
);
