import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { canOpenOrigin, type ResolvedCostBasisMeta } from "@/entities/scenario/resolved-basis";
import {
    useDuplicateScenario,
    useRenameScenario,
    useUpdateScenario,
} from "@/entities/scenario/use-scenarios";
import { apiErrorMessage } from "@/shared/api/error-messages";
import type { ScenarioIn, ScenarioOut } from "@/shared/api/generated";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import {
    Alert,
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogTitle,
    Field,
    Sheet,
    SheetContent,
    SheetTitle,
    toast,
} from "@/shared/ui";

// 010/T023+T029 (E5, PR-B US3/US6) — the "cenário carregado" context bar (ux §4.1), extended past
// the PR-A minimal (name + live subtitle + Fechar) with: the D3/D6 honest caption (never
// "removido"), "Abrir origem" (only when the ref resolves), "Duplicar", "Salvar alterações" (PUT,
// with the unsaved-changes badge + discard-confirm on close), and Renomear — all gated by the SAME
// lapse/offline write-freeze the list Sheet uses (§0.1, VR-610).
//
// T030b: the name is a SINGLE truncated line (`truncate` + `min-w-0` on its flex container) so a
// 120-char name never pushes [Duplicar]/[Salvar alterações] off-screen (§0.4).

const t = messages.scenarios;
const pf = messages.productForm;

// 016/T072-A9 (2026-08-07): the non-`ApiError` fallback used to ALSO claim "precisa de conexão" —
// an unmeasured cause (see `shared/api/error-messages.ts:honestWriteError`, the canonical version
// of this same rule). `transport.ts` normalises every real request failure into a typed
// `ApiError`, so anything else is unexpected and gets the generic honest phrase instead.
export function honestWriteError(err: unknown): string {
    if (err instanceof ApiError) {
        return err.status === 0 ? t.writeOffline : apiErrorMessage(err);
    }
    return messages.apiError.unknown;
}

export interface ScenarioContextBarProps {
    scenario: { id: string; name: string; note: string | null };
    costBasis: ResolvedCostBasisMeta | null;
    dirty: boolean;
    lapsed: boolean;
    buildCurrentConfig: () => ScenarioConfig | null;
    onClose: () => void;
    onRenamed: (name: string) => void;
    onSavedChanges: () => void;
    onDuplicated: (
        config: ScenarioConfig,
        meta: { id: string; name: string; note: string | null },
    ) => void;
}

export function ScenarioContextBar({
    scenario,
    costBasis,
    dirty,
    lapsed,
    buildCurrentConfig,
    onClose,
    onRenamed,
    onSavedChanges,
    onDuplicated,
}: ScenarioContextBarProps) {
    const navigate = useNavigate();
    const online = useOnline();
    const writesDisabled = lapsed || !online;
    const writesReason = lapsed ? t.writeLapsed : !online ? t.writeOffline : undefined;

    const update = useUpdateScenario();
    const rename = useRenameScenario();
    const duplicate = useDuplicateScenario();

    const [actionError, setActionError] = useState<string | null>(null);
    const [confirmClose, setConfirmClose] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(scenario.name);

    const openOrigin = canOpenOrigin(costBasis);

    const goToOrigin = () => {
        if (!costBasis?.ref) return;
        if (costBasis.kind === "PRODUCT") {
            void navigate({
                to: "/catalogo",
                search: { produto: costBasis.ref.id },
            });
        } else if (costBasis.kind === "KIT") {
            void navigate({ to: "/kits", search: { id: costBasis.ref.id } });
        }
    };

    const saveChanges = async () => {
        setActionError(null);
        const config = buildCurrentConfig();
        if (!config) return;
        try {
            await update.mutateAsync({
                id: scenario.id,
                body: {
                    name: scenario.name,
                    note: scenario.note,
                    config: config as unknown as ScenarioIn["config"],
                },
            });
            toast(t.saveChangesDone, { tone: "success" }); // real 2xx only
            onSavedChanges();
        } catch (err) {
            setActionError(honestWriteError(err));
        }
    };

    const doDuplicate = async () => {
        setActionError(null);
        try {
            const copy: ScenarioOut = await duplicate.mutateAsync(scenario.id);
            toast(t.duplicated, { tone: "success" });
            onDuplicated(copy.config as unknown as ScenarioConfig, {
                id: copy.id,
                name: copy.name,
                note: copy.note,
            });
        } catch (err) {
            setActionError(honestWriteError(err));
        }
    };

    const submitRename = async () => {
        const trimmed = renameValue.trim();
        if (trimmed === "" || trimmed.length > 120) return;
        setActionError(null);
        try {
            await rename.mutateAsync({ id: scenario.id, body: { name: trimmed } });
            toast(t.renamed, { tone: "success" });
            onRenamed(trimmed);
            setRenaming(false);
        } catch (err) {
            setActionError(honestWriteError(err));
        }
    };

    const requestClose = () => {
        if (dirty) setConfirmClose(true);
        else onClose();
    };

    return (
        <Card padding="sm" className="flex flex-col gap-2" data-testid="scenario-context-bar">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {t.loadedLabel.replace("{nome}", scenario.name)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                        {t.loadedLive}
                        {dirty && (
                            <>
                                {" · "}
                                <Badge tone="neutral">{t.unsavedBadge}</Badge>
                            </>
                        )}
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={requestClose}>
                    {t.closeScenario}
                </Button>
            </div>

            {/* T023 — D6 honest degraded caption, NEVER "removido/excluído/deletado" (F1/K3). Reused
          verbatim from the E2/E3 catalog-degradation copy. */}
            {costBasis?.degraded && <Alert tone="info">{pf.manualValuesKept}</Alert>}

            {actionError && <Alert tone="danger">{actionError}</Alert>}

            <div className="flex flex-wrap items-center gap-2">
                {openOrigin && (
                    <Button variant="ghost" size="sm" onClick={goToOrigin}>
                        {t.openOrigin}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={writesDisabled}
                    onClick={() => {
                        setRenameValue(scenario.name);
                        setRenaming(true);
                    }}
                >
                    {t.rename}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={writesDisabled}
                    loading={duplicate.isPending}
                    onClick={() => void doDuplicate()}
                >
                    {t.duplicate}
                </Button>
                <Button
                    size="sm"
                    disabled={writesDisabled || !dirty}
                    loading={update.isPending}
                    onClick={() => void saveChanges()}
                >
                    {t.saveChanges}
                </Button>
                {writesDisabled && writesReason && (
                    <p className="w-full text-xs text-[var(--text-muted)]">{writesReason}</p>
                )}
            </div>

            <Sheet open={renaming} onOpenChange={setRenaming}>
                {renaming && (
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
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                        />
                                    </div>
                                )}
                            </Field>
                            <Button onClick={() => void submitRename()} loading={rename.isPending}>
                                {t.saveChanges}
                            </Button>
                        </div>
                    </SheetContent>
                )}
            </Sheet>

            <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
                <DialogContent variant="center">
                    <div className="flex flex-col gap-3">
                        <DialogTitle>{t.discardChangesTitle}</DialogTitle>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
                                {t.back}
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    setConfirmClose(false);
                                    onClose();
                                }}
                            >
                                {t.discardChanges}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
