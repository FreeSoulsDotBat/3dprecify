import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Field, Sheet, SheetContent, SheetTitle } from "@/shared/ui";

// 019/Polish — moved verbatim out of history-ledger.tsx: the US6 período presets (types + the
// preset→bound mapper) travel WITH `HistoryFilterBar`, the only consumer of `periodRange`/
// `PERIOD_LABELS`. No state/effect restructured — `history-ledger.tsx` keeps owning search/period/
// custom as its own state, threaded down as props exactly as before.

const t = messages.history;

// ── US6 período presets ──────────────────────────────────────────────────────────────────────
// A preset maps to a device-date LOWER bound; "custom" carries an explicit [from, to] the seller
// picked. The bounds are ISO instants (what the server filter expects); an empty custom field is
// simply omitted, never sent as a blank the server would honour as a real bound.

export type PeriodKey = "all" | "30" | "90" | "custom";
export interface CustomRange {
    from: string;
    to: string;
}

const DAY_MS = 86_400_000;

// 019/Polish — o ternário de 3 níveis do rótulo do período vira lookup; as strings continuam
// verbatim (as mesmas `t.period30`/`t.period90` de sempre). "custom" e "all" seguem fora do mapa
// (o primeiro monta a faixa de datas, o segundo não tem rótulo) — não é fundido com `presets`.
export const PERIOD_LABELS: Partial<Record<PeriodKey, string>> = {
    "30": t.period30,
    "90": t.period90,
};

export function periodRange(
    period: PeriodKey,
    custom: CustomRange,
): { from?: string; to?: string } {
    if (period === "30") return { from: new Date(Date.now() - 30 * DAY_MS).toISOString() };
    if (period === "90") return { from: new Date(Date.now() - 90 * DAY_MS).toISOString() };
    if (period === "custom") {
        const out: { from?: string; to?: string } = {};
        if (custom.from) out.from = new Date(`${custom.from}T00:00:00`).toISOString();
        // Inclusive upper bound: the whole picked day, to its last millisecond.
        if (custom.to) out.to = new Date(`${custom.to}T23:59:59.999`).toISOString();
        return out;
    }
    return {};
}

export function HistoryFilterBar({
    search,
    onSearch,
    period,
    onPeriod,
    custom,
    onCustom,
}: {
    search: string;
    onSearch: (value: string) => void;
    period: PeriodKey;
    onPeriod: (period: PeriodKey) => void;
    custom: CustomRange;
    onCustom: (range: CustomRange) => void;
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [draft, setDraft] = useState<CustomRange>(custom);

    const presets: { key: PeriodKey; label: string }[] = [
        { key: "all", label: t.periodAll },
        { key: "30", label: t.period30 },
        { key: "90", label: t.period90 },
    ];
    const customActive = period === "custom" && Boolean(custom.from || custom.to);

    return (
        <div className="tf-historico__filters">
            <Field label={t.searchLabel}>
                {({ id, ...aria }) => (
                    <div className="tf-inputwrap">
                        <input
                            id={id}
                            {...aria}
                            className="tf-input"
                            type="search"
                            maxLength={120}
                            placeholder={t.searchPlaceholder}
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </div>
                )}
            </Field>

            <div className="tf-historico__chips" role="group" aria-label={t.periodCustom}>
                {presets.map((p) => (
                    <Button
                        key={p.key}
                        size="sm"
                        variant={period === p.key ? "primary" : "secondary"}
                        onClick={() => onPeriod(p.key)}
                    >
                        {p.label}
                    </Button>
                ))}
                <Button
                    size="sm"
                    variant={period === "custom" ? "primary" : "secondary"}
                    onClick={() => {
                        setDraft(custom);
                        setSheetOpen(true);
                    }}
                >
                    {t.periodCustom}
                </Button>
            </div>

            {customActive && (
                <span className="tf-historico__filterchip">
                    {t.filterActive
                        .replace("{de}", custom.from || "—")
                        .replace("{ate}", custom.to || "—")}
                    <Button size="sm" variant="ghost" onClick={() => onPeriod("all")}>
                        {t.filterClear}
                    </Button>
                </span>
            )}

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent showClose={false}>
                    <SheetTitle>{t.periodCustom}</SheetTitle>
                    <div className="flex flex-col gap-3">
                        <Field label={t.periodFrom}>
                            {({ id, ...aria }) => (
                                <div className="tf-inputwrap">
                                    <input
                                        id={id}
                                        {...aria}
                                        className="tf-input"
                                        type="date"
                                        value={draft.from}
                                        onChange={(e) =>
                                            setDraft((d) => ({ ...d, from: e.target.value }))
                                        }
                                    />
                                </div>
                            )}
                        </Field>
                        <Field label={t.periodTo}>
                            {({ id, ...aria }) => (
                                <div className="tf-inputwrap">
                                    <input
                                        id={id}
                                        {...aria}
                                        className="tf-input"
                                        type="date"
                                        value={draft.to}
                                        onChange={(e) =>
                                            setDraft((d) => ({ ...d, to: e.target.value }))
                                        }
                                    />
                                </div>
                            )}
                        </Field>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                                {t.back}
                            </Button>
                            <Button
                                onClick={() => {
                                    onCustom(draft);
                                    onPeriod("custom");
                                    setSheetOpen(false);
                                }}
                            >
                                {t.periodApply}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
