import { useState, type FormEvent } from "react";

import { useExportHistoryCsv, useExportQuote } from "@/entities/history/use-export";
import type { HistoryItem } from "@/entities/history/outbox";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import {
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    Switch,
    toast,
} from "@/shared/ui";

import "./export-sheet.css";

// ⚠ @doc DEC-019 — VISÍVEL e desabilitado, dizendo QUAL é o caso: offline e registro nunca
//   visto pelo servidor são ordinários neste app, não bordas. Detalhamento de custo é OPT-IN.

const t = messages.history;

type Format = "pdf" | "csv";

export function ExportButton({ item }: { item: HistoryItem }) {
    const { data } = useEntitlement();
    const online = useOnline();
    const [open, setOpen] = useState(false);

    const status = data?.status;
    // Free / signed-out / no server answer: no affordance at all (FR-516 — no artifact, ever). Never
    // assumed from silence: `useEntitlement` is the SERVER's last word (Principle IV / ADR-0015). A
    // free account has no snapshots to open anyway; the honest door is the Histórico teaser (US5).
    if (status !== "active" && status !== "lapsed") return null;

    // The server id exists iff the record reached the account — so it is exactly the "is there
    // anything to render?" question for THIS record, and it covers pending, blocked and failed alike.
    const serverId = item.snapshot?.id ?? null;
    // What blocks BOTH artifacts. The lapse outranks offline because it is the one the seller cannot
    // fix by waiting; offline outranks a pending record because it is WHY the record is pending, and
    // reconnecting is the single action that unblocks both.
    //
    // A pending record is deliberately NOT here (review PR-C): it blocks this record's quote, but the
    // CSV behind the same button is the whole ACCOUNT's ledger and does not depend on this record at
    // all. Disabling the button for it showed a reason that was true of one artifact and false of the
    // other — so the pending case is handled inside, on the option it actually applies to.
    const reason = status === "lapsed" ? t.exportLapsed : !online ? t.exportOffline : null;

    const reasonId = "tf-export-reason";

    return (
        <div className="tf-export">
            <Button
                variant="secondary"
                disabled={reason !== null}
                aria-describedby={reason ? reasonId : undefined}
                onClick={() => setOpen(true)}
            >
                {t.exportAction}
            </Button>
            {/* The reason is not a tooltip: a disabled control's explanation has to be READABLE, and on a
          touch device there is nothing to hover. It also NAMES the button for a screen reader. */}
            {reason && (
                <p id={reasonId} className="tf-export__reason">
                    {reason}
                </p>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
                {open && (
                    <SheetContent>
                        {/* The kind drives the opt-in warning: a kit's artifact carries ONE stored cost line,
                not the per-piece detail, so the single-piece wording would describe a document the
                seller is not about to receive (review PR-C). */}
                        <ExportForm
                            serverId={serverId}
                            isKit={item.kind === "KIT"}
                            // 019/PR-E (T135) — um orçamento exporta pelo MESMO caminho (nenhum ramo novo de
                            // formato); o que muda é só a razão da espera, que o nomeia.
                            isQuote={item.kind === "QUOTE"}
                            onDone={() => setOpen(false)}
                        />
                    </SheetContent>
                )}
            </Sheet>
        </div>
    );
}

function ExportForm({
    serverId,
    isKit,
    isQuote,
    onDone,
}: {
    /** null ⇒ this record has never reached the account, so it has no quote. The CSV still does. */
    serverId: string | null;
    isKit: boolean;
    isQuote: boolean;
    onDone: () => void;
}) {
    const quote = useExportQuote();
    const csv = useExportHistoryCsv();
    // A pending record cannot be quoted, so the seller lands on the artifact that IS available rather
    // than on a dead option they must first discover is dead.
    const [format, setFormat] = useState<Format>(serverId ? "pdf" : "csv");
    // OFF, and it starts off every time the Sheet opens — the decision to show a customer the cost
    // lines is per-quote, and a remembered "on" would leak the margin on the next one silently.
    const [includeCosts, setIncludeCosts] = useState(false);

    const busy = quote.isPending || csv.isPending;

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        try {
            if (format === "pdf") {
                if (!serverId) return; // unreachable: the option is disabled without a server row
                await quote.mutateAsync({
                    snapshotId: serverId,
                    includeCostBreakdown: includeCosts,
                });
            } else {
                await csv.mutateAsync();
            }
        } catch (error) {
            // Never a fake file, and never a generic shrug when we know better: a mid-flight lapse (the
            // server's 403) is reported as the lapse it is. The Sheet STAYS OPEN with the choices intact
            // — the seller loses nothing but the attempt.
            const lapsed = error instanceof ApiError && error.code === "ENTITLEMENT_REQUIRED";
            toast(lapsed ? t.exportLapsed : t.exportFailed, { tone: "danger" });
            return;
        }
        // No success toast: the file IS the feedback. A "pronto!" next to a download the browser already
        // announced would be noise — and would be a claim we cannot verify.
        onDone();
    }

    return (
        <form className="tf-export__form" onSubmit={(e) => void onSubmit(e)}>
            <SheetTitle>{t.exportAction}</SheetTitle>

            <fieldset className="tf-export__formats">
                <legend>{t.exportFormatField}</legend>
                {(
                    [
                        ["pdf", t.exportQuotePdf],
                        ["csv", t.exportHistoryCsv],
                    ] as const
                ).map(([value, label]) => {
                    // Only the QUOTE needs this record on the server. Disabling the whole Sheet for a pending
                    // record denied the account-wide CSV with a reason that was false of it (review PR-C).
                    const blocked = value === "pdf" && serverId === null;
                    return (
                        <div key={value}>
                            <label className="tf-export__option">
                                <input
                                    type="radio"
                                    name="export-format"
                                    value={value}
                                    checked={format === value}
                                    disabled={blocked}
                                    aria-describedby={blocked ? "tf-export-pdf-reason" : undefined}
                                    onChange={() => setFormat(value)}
                                />
                                <span>{label}</span>
                            </label>
                            {/* Outside the <label> on purpose: inside, it would fold into the radio's accessible
                  NAME and be announced twice (name + description). Here it is the description. */}
                            {blocked && (
                                <p id="tf-export-pdf-reason" className="tf-export__reason">
                                    {/* A espera é a mesma (o artefato é do SERVIDOR e precisa do id de lá); a frase
                      do orçamento diz isso com o nome que o vendedor deu ao documento. */}
                                    {isQuote ? messages.quote.pdfWaitsSync : t.exportPending}
                                </p>
                            )}
                        </div>
                    );
                })}
            </fieldset>

            {/* Quote-only. Rendering either of these over the CSV would offer a control with no effect —
          the seller would reasonably read it as a promise about the file they are about to get. */}
            {format === "pdf" && (
                <>
                    <div className="tf-export__optin">
                        <span id="tf-export-costs-label" className="tf-export__optin-label">
                            {t.exportIncludeCosts}
                        </span>
                        <Switch
                            aria-labelledby="tf-export-costs-label"
                            checked={includeCosts}
                            onCheckedChange={setIncludeCosts}
                        />
                    </div>
                    {/* The harm, said out loud, next to the switch that causes it — naming the lines THIS
              artifact carries, not the ones a seller might assume. "Margem" is never printed. */}
                    <p className="tf-export__warn">
                        {isKit ? t.exportIncludeCostsWarnKit : t.exportIncludeCostsWarn}
                    </p>
                    {/* What travels — including the personal e-mail (Q13). No surprises after the fact. */}
                    <SheetDescription>{t.exportContents}</SheetDescription>
                </>
            )}

            {format === "csv" && <SheetDescription>{t.exportCsvNote}</SheetDescription>}

            <Button type="submit" loading={busy}>
                {format === "pdf" ? t.exportGenerate : t.exportGenerateCsv}
            </Button>
        </form>
    );
}
