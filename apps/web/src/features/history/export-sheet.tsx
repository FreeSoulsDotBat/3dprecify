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

// 009/T028 (E4, PR-C, US4) — the export affordance on a snapshot detail (FR-512..516; copy = ux §6).
//
// The document is rendered by the SERVER (ADR-0020), and every rule on this surface follows from
// that one fact:
//
//   * It cannot work OFFLINE, and it cannot work for a record the server has never seen. This app
//     records offline by design, so both are ordinary — not edge cases. The affordance therefore
//     stays VISIBLE and DISABLED and says WHICH one is true, right where the seller taps. Hiding it
//     would send them hunting for a button that used to be there; a button that spins into nothing
//     would be worse.
//   * The cost breakdown is OPT-IN and stays off (Q4/FR-512, SC-506). The default artifact goes to
//     the seller's CUSTOMER, and a customer who can read material/energy/machine/falha can compute
//     the margin they are negotiating against. The copy above the switch names that harm rather than
//     leaving a neutral label — an unexplained switch gets flipped "to see what it does".
//   * On a LAPSE the export is refused by the server anyway (`require_entitlement`), so the client
//     never has to be trusted with the gate; it only has to be honest about it.
//
// Deviation flagged for T030 (ux §6 says lapsed ⇒ "visible → reactivation panel"): the affordance is
// visible + disabled + `exportLapsed` instead, matching the reason-pattern of the two cases beside
// it and the shipped PR-B siblings (rename/delete/recalc are simply absent, explained by the page's
// lapse banner). A "reactivation panel" would open a dialog whose only content is the sentence
// already shown here — and there is no reactivation FLOW to offer before E6 (billing), so a panel
// would promise a door that does not exist (Principle II).

const t = messages.historico;

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
  // anything to render?" question, and it covers pending, blocked and failed alike.
  const serverId = item.snapshot?.id ?? null;
  // Order matters: offline is the ROOT cause when a record is also still queued (it is why it is
  // queued), and reconnecting is the one action that unblocks both. The lapse outranks both because
  // it is the only one the seller cannot fix by waiting.
  const reason =
    status === "lapsed"
      ? t.exportLapsed
      : !online
        ? t.exportOffline
        : serverId === null
          ? t.exportPending
          : null;

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
        {open && serverId && (
          <SheetContent>
            <ExportForm serverId={serverId} onDone={() => setOpen(false)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function ExportForm({ serverId, onDone }: { serverId: string; onDone: () => void }) {
  const quote = useExportQuote();
  const csv = useExportHistoryCsv();
  const [format, setFormat] = useState<Format>("pdf");
  // OFF, and it starts off every time the Sheet opens — the decision to show a customer the cost
  // lines is per-quote, and a remembered "on" would leak the margin on the next one silently.
  const [includeCosts, setIncludeCosts] = useState(false);

  const busy = quote.isPending || csv.isPending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      if (format === "pdf") {
        await quote.mutateAsync({ snapshotId: serverId, includeCostBreakdown: includeCosts });
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
        ).map(([value, label]) => (
          <label key={value} className="tf-export__option">
            <input
              type="radio"
              name="export-format"
              value={value}
              checked={format === value}
              onChange={() => setFormat(value)}
            />
            <span>{label}</span>
          </label>
        ))}
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
          {/* The harm, said out loud, next to the switch that causes it. */}
          <p className="tf-export__warn">{t.exportIncludeCostsWarn}</p>
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
