import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { HistoryItem } from "@/entities/history/outbox";
import { useDeleteSnapshot, useUpdateLabel } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { messages } from "@/shared/i18n/messages.pt-br";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    Field,
    toast,
    TextField,
} from "@/shared/ui";

// 009/T022 (E4, PR-B, US6) — manage a snapshot from its detail: rename + delete.
//
// The label is the ONE mutable field (ADR-0019); nothing else on the frozen document is editable.
// Both are WRITES, so the bar appears ONLY on an ACTIVE premium and ONLY for a SYNCED record — a
// pending record has no server id to PATCH/DELETE and is removed through the outbox (Descartar)
// instead. On a lapsed premium the ledger stays readable and the lapse banner explains why renaming
// and deleting are paused, so the affordances are simply absent here.

const t = messages.history;

export function SnapshotManageActions({ item }: { item: HistoryItem }) {
    const { data } = useEntitlement();
    const serverId = item.snapshot?.id ?? null;
    if (data?.status !== "active" || !serverId) return null;
    return <ManageBar item={item} serverId={serverId} />;
}

function ManageBar({ item, serverId }: { item: HistoryItem; serverId: string }) {
    const navigate = useNavigate();
    const update = useUpdateLabel();
    const remove = useDeleteSnapshot();
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [label, setLabel] = useState(item.label ?? "");

    async function onSave() {
        try {
            // A blank label clears it (null), never an empty string — an "" is a label nobody wrote.
            await update.mutateAsync({ id: serverId, label: label.trim() || null });
            toast(t.labelSaved, { tone: "success" });
            setEditing(false);
        } catch {
            toast(t.labelSaveFailed, { tone: "danger" });
        }
    }

    async function onDelete() {
        try {
            await remove.mutateAsync(serverId);
            setConfirming(false);
            toast(t.deleted, { tone: "success" });
            void navigate({ to: "/historico" });
        } catch {
            toast(t.deleteFailed, { tone: "danger" });
        }
    }

    return (
        <div className="flex gap-2">
            <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                    setLabel(item.label ?? "");
                    setEditing(true);
                }}
            >
                {t.editLabel}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
                {t.deleteAction}
            </Button>

            {/* Rename — the label input, prefilled, saved on an explicit action. */}
            <Dialog open={editing} onOpenChange={(next) => !next && setEditing(false)}>
                <DialogContent showClose={false}>
                    <DialogTitle>{t.editLabel}</DialogTitle>
                    <Field label={t.labelField}>
                        {({ id, ...aria }) => (
                            <TextField
                                id={id}
                                {...aria}
                                type="text"
                                maxLength={120}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                        )}
                    </Field>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setEditing(false)}>
                            {t.back}
                        </Button>
                        <Button loading={update.isPending} onClick={() => void onSave()}>
                            {t.editLabelSave}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete — destructive, always confirmed (§1.5). */}
            <Dialog open={confirming} onOpenChange={(next) => !next && setConfirming(false)}>
                <DialogContent showClose={false}>
                    <DialogTitle>{t.deleteTitle}</DialogTitle>
                    <DialogDescription>{t.deleteBody}</DialogDescription>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setConfirming(false)}>
                            {t.back}
                        </Button>
                        <Button
                            variant="danger"
                            loading={remove.isPending}
                            onClick={() => void onDelete()}
                        >
                            {t.deleteConfirm}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
