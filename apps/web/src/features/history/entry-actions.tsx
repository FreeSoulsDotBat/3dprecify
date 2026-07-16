import { useState, type MouseEvent } from "react";

import type { HistoryItem } from "@/entities/history/outbox";
import { useEntryActions } from "@/entities/history/use-history";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui";

// 009 (E4, PR-A) — [Tentar novamente] / [Descartar] for a stuck record (review PR-A, B2; ADR-0018
// §9, ux-history §1.1). A blocked/failed entry with no way out is a dead end: it can never sync and
// can never be dropped, so it poisons EVERY future sign-out (the guard reappears forever, and the
// only escape is "Sair e descartar" — which purges the whole queue).
//
// Rendered inside the list card (a `<Link>`) AND in the detail Alert, so every button STOPS
// propagation: a tap on "Descartar" must not also navigate into the snapshot. Discard is destructive
// and ALWAYS confirmed (§1.5). A `pending` retry is online-only (a retry offline cannot work); a
// blocked/failed retry is always offered (blocked resumes on the next `active`; failed is the
// seller's call).

const t = messages.historico;

/** Swallow the click so the surrounding `<Link>` card never navigates when a button is tapped. */
function stop(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function EntryActions({ item }: { item: HistoryItem }) {
  const { retry, discard, retrying, discarding } = useEntryActions();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);

  if (item.syncState === "synced") return null;

  const pending = item.syncState === "pending";
  // A pending retry needs the network to do anything; blocked/failed retries are always offered.
  const canRetry = !pending || online;
  const retryLabel = pending ? t.retryNow : t.retryAgain;

  return (
    <div className="tf-historico__actions" onClick={stop}>
      {canRetry && (
        <Button
          size="sm"
          variant="secondary"
          loading={retrying}
          onClick={(e) => {
            stop(e);
            retry(item.clientSnapshotId);
          }}
        >
          {retryLabel}
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
      >
        {t.discard}
      </Button>

      <Dialog open={confirming} onOpenChange={(next) => !next && setConfirming(false)}>
        <DialogContent showClose={false}>
          <DialogTitle>{t.discardConfirmTitle}</DialogTitle>
          <DialogDescription>{t.discardConfirmBody}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2" onClick={stop}>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t.back}
            </Button>
            <Button
              variant="danger"
              loading={discarding}
              onClick={() => {
                discard(item.clientSnapshotId);
                setConfirming(false);
              }}
            >
              {t.discard}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
