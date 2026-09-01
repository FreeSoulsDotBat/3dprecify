import { forwardRef, useImperativeHandle, useState } from "react";

import { useDeleteScenario } from "@/entities/scenario/use-scenarios";
import type { ScenarioOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    toast,
} from "@/shared/ui";

import { honestWriteError } from "@/shared/api/error-messages";

const t = messages.scenarios;

// 019/Polish — moved out of `scenarios-list-sheet.tsx` verbatim (own render, own 2 `useState`s —
// the state was already isolated to this overlay). `ScenariosList` opens it via the imperative
// `open(item)` handle instead of lifting `deleteTarget`/`deleteError` back up — the same
// single-event-handler batching the original `onDeleteRequest` had.
export interface DeleteScenarioDialogHandle {
    open: (item: ScenarioOut) => void;
}

export const DeleteScenarioDialog = forwardRef<DeleteScenarioDialogHandle>(
    function DeleteScenarioDialog(_props, ref) {
        const del = useDeleteScenario();

        const [target, setTarget] = useState<ScenarioOut | null>(null);
        const [error, setError] = useState<string | undefined>(undefined);

        useImperativeHandle(ref, () => ({
            open(item: ScenarioOut) {
                setError(undefined);
                setTarget(item);
            },
        }));

        const handleDelete = async () => {
            if (!target) return;
            setError(undefined);
            try {
                await del.mutateAsync(target.id);
                toast(t.deleted, { tone: "success" }); // real 2xx only
                setTarget(null);
            } catch (err) {
                setError(honestWriteError(err));
            }
        };

        return (
            // Delete (soft) — always confirmed, never silent (ux §6).
            <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
                <DialogContent variant="center">
                    {target && (
                        <div className="flex flex-col gap-3">
                            <DialogTitle>
                                {t.deleteTitle.replace("{nome}", target.name)}
                            </DialogTitle>
                            <DialogDescription>{t.deleteBody}</DialogDescription>
                            {error && <Alert tone="danger">{error}</Alert>}
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setTarget(null)}>
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
        );
    },
);
