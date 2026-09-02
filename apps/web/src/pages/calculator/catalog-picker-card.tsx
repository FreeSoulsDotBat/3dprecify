import { useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { type CatalogListState } from "@/entities/catalog/use-catalog";
import {
    applyFilamentFields,
    applyPrinterFields,
} from "@/features/calculator/catalog-prefill-apply";
import { captionText, gridCard, sectionLabel } from "@/features/calculator/calculator-form";
import { type CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, Card, Field, Select } from "@/shared/ui";
import type { FilamentOut, PrinterOut } from "@/shared/api/generated";

const t = messages.calculator;

// 019/Polish — moved verbatim out of calcular-page.tsx: US5 (E2/T024) catalog pickers, plus the
// 016/T072-A8 honest read-failure card. Local state (picked ids) is entirely self-contained; no
// interaction with the form's dirty/signature tracking (that stays in calcular-page.tsx).

/**
 * US5 (E2/T024) — the catalog pickers. Rendered ONLY for authenticated accounts WITH saved
 * items, so the free manual flow is untouched (SC-310); the read hooks are uid-gated and
 * answer from the offline cache after one online load (Q2). Picking pre-fills via setValue —
 * fields stay ordinary editable inputs (pre-fill, never lock; byte-identity by construction,
 * SC-305/catalog-prefill.ts).
 */
export function CatalogPickerCard({
    sessionStatus,
    filamentsList,
    printersList,
    setValue,
}: {
    sessionStatus: string;
    filamentsList: CatalogListState<FilamentOut>;
    printersList: CatalogListState<PrinterOut>;
    setValue: UseFormSetValue<CalcFormValues>;
}) {
    const { items: filaments } = filamentsList;
    const { items: printers } = printersList;
    const [pickedFilamentId, setPickedFilamentId] = useState("");
    const [pickedPrinterId, setPickedPrinterId] = useState("");
    const applyFilament = (id: string) => {
        setPickedFilamentId(id);
        const picked = filaments.find((f) => f.id === id);
        if (!picked) return;
        applyFilamentFields(setValue, picked, { shouldValidate: true });
    };
    const applyPrinter = (id: string) => {
        setPickedPrinterId(id);
        const picked = printers.find((p) => p.id === id);
        if (!picked) return;
        applyPrinterFields(setValue, picked, { shouldValidate: true });
    };
    const showFilamentPicker = sessionStatus === "authenticated" && filaments.length > 0;
    const showPrinterPicker = sessionStatus === "authenticated" && printers.length > 0;
    // 016/T072-A8 — a genuine READ FAILURE with no cache (never "you have none yet", which is
    // silent on purpose): `isError` already excludes the entitlement gate (a free/lapsed account's
    // 403 is not a failure to explain here — that account never had catalog access to lose). Only
    // fires when there is nothing to show at all — a `stale`-but-served list already renders its
    // own honest "may be outdated" state inside the picker's own card (US5/T024).
    const catalogPickerLoadError =
        sessionStatus === "authenticated" &&
        ((filamentsList.isError && filamentsList.error?.code !== "ENTITLEMENT_REQUIRED") ||
            (printersList.isError && printersList.error?.code !== "ENTITLEMENT_REQUIRED"));

    return (
        <>
            {/* 016/T072-A8 — the picker card simply VANISHED on a real read failure with no cache (empty
          `items`, indistinguishable from "you have none yet"). This is the honest replacement:
          shown only when there IS a failure to explain, never for a genuinely empty catalog. */}
            {!showFilamentPicker && !showPrinterPicker && catalogPickerLoadError && (
                <Card padding="md" className="flex flex-col gap-3">
                    <Alert tone="danger" title={t.catalogPicker.loadError}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                                filamentsList.refetch();
                                printersList.refetch();
                            }}
                        >
                            {t.catalogPicker.retry}
                        </Button>
                    </Alert>
                </Card>
            )}

            {(showFilamentPicker || showPrinterPicker) && (
                <Card padding="md" className="flex flex-col gap-3">
                    <p style={sectionLabel}>{t.catalogPicker.title}</p>
                    <p style={captionText}>{t.catalogPicker.hint}</p>
                    <div style={gridCard}>
                        {showFilamentPicker && (
                            <Field label={t.catalogPicker.filament} tightLabel>
                                {(p) => (
                                    <Select
                                        {...p}
                                        options={[
                                            { value: "", label: t.catalogPicker.placeholder },
                                            ...filaments.map((f) => ({
                                                value: f.id,
                                                label: f.name,
                                            })),
                                        ]}
                                        value={pickedFilamentId}
                                        onChange={(e) => applyFilament(e.target.value)}
                                    />
                                )}
                            </Field>
                        )}
                        {showPrinterPicker && (
                            <Field label={t.catalogPicker.printer} tightLabel>
                                {(p) => (
                                    <Select
                                        {...p}
                                        options={[
                                            { value: "", label: t.catalogPicker.placeholder },
                                            ...printers.map((pr) => ({
                                                value: pr.id,
                                                label: pr.name,
                                            })),
                                        ]}
                                        value={pickedPrinterId}
                                        onChange={(e) => applyPrinter(e.target.value)}
                                    />
                                )}
                            </Field>
                        )}
                    </div>
                </Card>
            )}
        </>
    );
}
