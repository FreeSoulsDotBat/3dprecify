import { useMemo, useState } from "react";

import { type PriceInput } from "@3dprecify/pricing-core";

import {
  freezeBomResult,
  freezePriceResult,
  type FrozenSnapshotPayload,
} from "@/entities/history/frozen-payload";
import type { HistoryItem } from "@/entities/history/outbox";
import { useRecordSnapshot } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { composeBom } from "@/features/bom/bom-compute";
import { computeFromForm, type CatalogContext } from "@/features/calculator/calculator-model";
import { productToForm } from "@/features/calculator/product-mapping";
import type {
  BomOut,
  ProductOut,
  SnapshotIn,
  SnapshotInHeadlineBasis,
} from "@/shared/api/generated";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, toast } from "@/shared/ui";

import { frozenPayloadOf } from "@/entities/history/history-format";

// 009/T020 (E4, PR-B, US3) — "Recalcular hoje" (FR-505). It lives at the PAGE layer, like pages/bom
// `kit-save`: the recompute needs `features/calculator`, and FSD-Lite forbids a feature importing
// another feature (eslint-boundaries) — the page is where the two meet.
//
// The action creates a NEW record and leaves the original untouched (a snapshot is immutable —
// ADR-0019). It RE-RESOLVES the origin and reprices from TODAY's catalog values (product/filament/
// printer as they are now), because "meu custo subiu desde que cotei?" is the question the seller is
// actually asking — repricing the frozen inputs could never answer "sim" to a filament price rise.
// Where the origin no longer resolves, it reprices the frozen inputs under the current formula and
// SAYS SO — it must never present a frozen reprice as catalog-current.

const t = messages.historico;

/** Which leaf of `payload.totals` the recorded basis points at. Exported because `compare-today`
 *  reads the same leaf to answer "and what would it cost today?" — two copies of this map is two
 *  chances to point a wholesale quote at the retail number. */
export const BASIS_TOTAL: Record<SnapshotInHeadlineBasis, "precoVarejo" | "precoAtacado"> = {
  PRECO_VAREJO: "precoVarejo",
  PRECO_ATACADO: "precoAtacado",
};

export interface RecalcedPayload {
  payload: FrozenSnapshotPayload;
  /** true ⇒ repriced from the FROZEN inputs (origin gone) — NOT catalog-current; the UI must say so. */
  fromFrozen: boolean;
}

/** Mirror of pages/bom `lineToForm` kept local (a feature/page may not import another page): a saved
 *  kit line's server-resolved values ARE a ProductOut value surface, so `productToForm` maps it. The
 *  server already applied D3 (a linked line resolves from its live product), so a freshly-fetched
 *  kit's line values are TODAY's catalog values. */
function bomLineToInput(line: BomOut["lines"][number], ctx: CatalogContext): PriceInput | null {
  const { values } = productToForm({
    id: line.productId ?? "",
    name: line.pieceName ?? "",
    filamentId: null,
    printerId: null,
    filamentValues: line.filamentValues,
    printerValues: line.printerValues,
    pieceInputs: line.pieceInputs,
    tariffPerKwh: line.tariffPerKwh,
    includeMarketplace: line.includeMarketplace,
    channels: line.channels,
    otherCosts: line.otherCosts,
    createdAt: "",
    updatedAt: "",
  } as ProductOut);
  return computeFromForm(values, ctx).input;
}

/** Recompute a snapshot's document "today". When the origin RESOLVES, reprice from the live
 *  product/kit at today's catalog (FR-505, `fromFrozen: false`). Otherwise re-emit the frozen
 *  document — under an UNCHANGED formula (pricing-core is 3.1.0 this epic), repricing the frozen
 *  inputs yields exactly the frozen values — and flag it `fromFrozen: true` so the caller can say
 *  plainly that it does not reflect today's catalog. */
export function recalcToday(
  frozen: FrozenSnapshotPayload,
  origin: { product?: ProductOut; kit?: BomOut },
  ctx: CatalogContext,
): RecalcedPayload {
  const provenance = frozen.provenance;
  if (frozen.kind === "SINGLE" && origin.product && provenance) {
    const { values } = productToForm(origin.product);
    const { result, input } = computeFromForm(values, ctx);
    if (result && input) {
      return { payload: freezePriceResult(input, result, provenance), fromFrozen: false };
    }
  }
  if (frozen.kind === "KIT" && origin.kit && provenance) {
    const mapped = origin.kit.lines.map((line) => ({
      input: bomLineToInput(line, ctx),
      quantity: line.quantity,
      name: line.pieceName,
    }));
    const lines = mapped.filter(
      (l): l is { input: PriceInput; quantity: number; name: string | null } => l.input !== null,
    );
    // ALL pieces must recompute, or we do NOT claim a today's-catalog price: dropping the pieces
    // that failed and repricing only the survivors would record a partial kit as if it were the
    // whole one. Any failure ⇒ fall through to re-emitting the frozen document (fromFrozen: true).
    if (lines.length > 0 && lines.length === mapped.length) {
      const { bom } = composeBom(lines.map((l) => ({ input: l.input, quantity: l.quantity })));
      return {
        payload: freezeBomResult(lines, bom, provenance, ctx.catalog.catalogVersion ?? null),
        fromFrozen: false,
      };
    }
  }
  return { payload: frozen, fromFrozen: true };
}

/**
 * The "Recalcular hoje" affordance on a snapshot detail. A confirm dialog (never a silent write) →
 * a new record at today's values. Gated on an ACTIVE server entitlement, because it is a WRITE
 * (Principle IV / ADR-0015): on lapse the ledger stays readable, but re-quoting needs Premium — the
 * lapsed banner already explains why, so here the action is simply absent.
 */
export function RecalcTodayButton({
  item,
  product,
  kit,
}: {
  item: HistoryItem;
  product?: ProductOut;
  kit?: BomOut;
}) {
  const { data } = useEntitlement();
  // Gate the WRITE on an ACTIVE server entitlement before any recompute hooks run (rules-of-hooks:
  // the recompute lives in a child so this early return never skips a hook).
  if (data?.status !== "active") return null;

  const frozen = frozenPayloadOf(item);
  if (!frozen) return null;

  return <RecalcDialog item={item} frozen={frozen} product={product} kit={kit} />;
}

function RecalcDialog({
  item,
  frozen,
  product,
  kit,
}: {
  item: HistoryItem;
  frozen: FrozenSnapshotPayload;
  product?: ProductOut;
  kit?: BomOut;
}) {
  const online = useOnline();
  const { catalog, source } = useFeeCatalog();
  const record = useRecordSnapshot();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reprice ONCE when the dialog opens, and let the ACTUAL outcome — not a proxy — drive BOTH the
  // copy and what gets recorded. `recalcToday` sets `fromFrozen: true` whenever it could NOT reprice
  // from the live origin (the origin is not resolvable locally — which may just be offline, not
  // deleted — OR a kit piece failed to recompute). Deriving the copy from a separate `!!product`
  // check let the dialog promise "today's catalog" while re-emitting frozen values, and assert a
  // deletion that may not have happened. One source of truth closes both gaps.
  const recalced = useMemo(
    () =>
      open ? recalcToday(frozen, { product, kit }, { catalog, source, now: Date.now() }) : null,
    // `now`/catalog captured at open; recompute when the dialog opens or the resolved origin moves.
    [open, product, kit, frozen, catalog, source],
  );
  const repriced = recalced !== null && !recalced.fromFrozen;
  const quotedDate = new Date(item.deviceQuotedAt).toLocaleDateString("pt-BR");

  async function onConfirm() {
    if (!recalced) return;
    setBusy(true);
    try {
      // `fromFrozen` used to be dropped here, and dropping it was the defect: the document written
      // was the OLD one, stamped with today's `deviceQuotedAt`, so nothing in the record separated
      // "repriced today" from "reused a previous freeze". The dialog warns, but a dialog is a moment
      // and the snapshot is forever — ADR-0019 makes it immutable, so the distinction survives only
      // if it is written now (SC-818). Additive and one-sided: absent = an ordinary reprice.
      const { payload, fromFrozen } = recalced;
      const storedPayload: FrozenSnapshotPayload = fromFrozen
        ? { ...payload, repricedFromFrozen: true }
        : payload;
      const basis = item.headlineBasis as SnapshotInHeadlineBasis;
      const total = payload.totals[BASIS_TOTAL[basis]];
      if (!total) {
        toast(t.saveDeviceFailed, { tone: "danger" });
        return;
      }
      const now = new Date();
      const body: SnapshotIn = {
        // A NEW id — the recalc is a distinct quote, never an edit of the original (FR-505/ADR-0019).
        clientSnapshotId: crypto.randomUUID(),
        kind: payload.kind === "KIT" ? "KIT" : "SINGLE",
        // Inherit the original's label (owner decision, 2026-07-17): the recalc is the SAME customer
        // re-quoted today, so it belongs under the same name — and that is what makes the US7
        // "then vs now" comparison legible. Validity does NOT carry: a new quote starts a fresh
        // validity window, and the seller sets it when they send.
        label: item.label,
        quoteValidityDays: null,
        deviceQuotedAt: now.toISOString(),
        deviceUtcOffsetMinutes: -now.getTimezoneOffset(),
        modelVersion: payload.modelVersion,
        headlineTotal: total,
        headlineBasis: basis, // the same basis the seller originally quoted
        payload: storedPayload as unknown as SnapshotIn["payload"],
      };
      let outcome;
      try {
        outcome = await record.mutateAsync(body);
      } catch {
        toast(t.saveDeviceFailed, { tone: "danger" });
        return;
      }
      setOpen(false);
      if (outcome.syncState === "synced") toast(t.saved, { tone: "success" });
      else if (outcome.syncState === "pending") toast(t.syncPendingToast, { tone: "info" });
      else if (outcome.syncState === "blocked") toast(t.syncBlockedToast, { tone: "info" });
      else toast(t.syncFailedToast, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t.recalcAction}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent showClose={false}>
          <DialogTitle>{t.recalcTitle}</DialogTitle>
          <DialogDescription>
            {repriced ? t.recalcBody.replace("{data}", quotedDate) : t.recalcNoOriginBody}
          </DialogDescription>
          {/* F3 — offline, "today's catalog" is the cached catalog; say it may be stale. */}
          {!online && <p className="tf-historico__meta">{t.recalcOfflineNote}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t.back}
            </Button>
            <Button loading={busy} onClick={() => void onConfirm()}>
              {t.recalcConfirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
