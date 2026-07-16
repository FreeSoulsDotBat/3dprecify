import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";

import type { FrozenSnapshotPayload } from "./frozen-payload";
import type { HistoryItem, SyncState } from "./outbox";

// 009 (E4, PR-A) — Histórico DOMAIN formatting. Lives in `entities/history` (not the page slice)
// so `features/history` (PR-B/PR-C) may import it too — FSD-Lite forbids a feature reaching into a
// page. Precedent: `entities/catalog/product-summary.ts` (E2). Review PR-A, Minor (history-format
// in a page slice).

const t = messages.historico;

/**
 * The frozen document, wherever the record currently lives — on the server or still in the queue.
 * A pending record must render EXACTLY like a synced one: it is the same document, and the only
 * difference is who else knows about it yet.
 */
export function frozenPayloadOf(item: HistoryItem): FrozenSnapshotPayload | null {
  const raw = item.snapshot?.payload ?? item.entry?.body.payload;
  return (raw as FrozenSnapshotPayload | undefined) ?? null;
}

/** Format a stored money STRING. The string is the record; the number exists only to be printed. */
export function money(value: string): string {
  return formatBRL(Number(value));
}

/**
 * The date AS THE SELLER SAW IT. The snapshot carries the device's captured UTC offset precisely so
 * a quote made at 19:30 in São Paulo never re-renders as "20/07" for a reader in another timezone —
 * the date is part of the claim, not a rendering detail.
 */
export function quotedDate(iso: string, offsetMinutes: number | undefined): string {
  const shifted = new Date(new Date(iso).getTime() + (offsetMinutes ?? 0) * 60_000);
  return shifted.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function quotedTime(iso: string, offsetMinutes: number | undefined): string {
  const shifted = new Date(new Date(iso).getTime() + (offsetMinutes ?? 0) * 60_000);
  return shifted.toLocaleTimeString("pt-BR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The offset the record was made at, wherever it currently lives. */
export function offsetOf(item: HistoryItem): number | undefined {
  return item.snapshot?.deviceUtcOffsetMinutes ?? item.entry?.body.deviceUtcOffsetMinutes;
}

/** An unlabelled total is an ambiguous claim — the basis is spelled out on every surface. */
export function basisCaption(basis: string): string {
  return basis === "PRECO_ATACADO" ? t.basisWholesaleCaption : t.basisRetailCaption;
}

/** The label, or the CAPTURED origin name, or an honest neutral — never an invented one. */
export function cardTitle(item: HistoryItem): string {
  if (item.label) return item.label;
  return frozenPayloadOf(item)?.provenance?.name ?? t.adhocFallback;
}

export const SYNC_BADGE: Record<Exclude<SyncState, "synced">, string> = {
  pending: t.syncPendingBadge,
  blocked: t.syncBlockedBadge,
  failed: t.syncFailedBadge,
};
