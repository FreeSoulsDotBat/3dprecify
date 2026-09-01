import type { SnapshotInHeadlineBasis } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";

import type { FrozenSnapshotPayload } from "./frozen-payload";
import type { HistoryItem, SyncState } from "./outbox";

// 009 (E4, PR-A) — Histórico DOMAIN formatting. Lives in `entities/history` (not the page slice)
// so `features/history` (PR-B/PR-C) may import it too — FSD-Lite forbids a feature reaching into a
// page. Precedent: `entities/catalog/product-summary.ts` (E2). Review PR-A, Minor (history-format
// in a page slice).

const t = messages.history;

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
export function formatFrozenBRL(value: string): string {
    return formatBRL(Number(value));
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * The date AS THE SELLER SAW IT. The snapshot carries the device's captured UTC offset precisely so
 * a quote made at 19:30 in São Paulo never re-renders as "20/07" for a reader in another timezone —
 * the date is part of the claim, not a rendering detail.
 */
export function quotedDate(iso: string, offsetMinutes: number | undefined): string {
    const shifted = new Date(new Date(iso).getTime() + (offsetMinutes ?? 0) * MS_PER_MINUTE);
    return shifted.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function quotedTime(iso: string, offsetMinutes: number | undefined): string {
    const shifted = new Date(new Date(iso).getTime() + (offsetMinutes ?? 0) * MS_PER_MINUTE);
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

// 019/PR-E (T135) — a legenda por BASE, como Record: a base nova do orçamento entrou por aqui, e a
// forma anterior (um ternário `=== "PRECO_ATACADO" ? … : varejo`) teria etiquetado todo orçamento
// como "Preço de varejo" — silenciosamente, sem quebrar nada, num registro imutável. Um Record
// sobre a união do contrato faz o compilador cobrar a decisão quando surgir a quarta base.
const BASIS_CAPTION: Record<SnapshotInHeadlineBasis, string> = {
    PRECO_VAREJO: t.basisRetailCaption,
    PRECO_ATACADO: t.basisWholesaleCaption,
    // Prancheta 18e — o total de um orçamento ENVIADO. Não é varejo nem atacado: é o que o vendedor
    // mandou para o cliente, já com o desconto que ele decidiu dar.
    PRECO_ORCAMENTO: messages.quote.totalSent,
};

/** An unlabelled total is an ambiguous claim — the basis is spelled out on every surface. */
export function basisCaption(basis: string): string {
    // Um documento gravado por uma versão futura pode trazer uma base que este cliente não conhece;
    // aí a leitura cai no varejo, como sempre caiu — o que muda é que as bases CONHECIDAS não caem.
    return BASIS_CAPTION[basis as SnapshotInHeadlineBasis] ?? t.basisRetailCaption;
}

/**
 * 019/PR-E (T135) — o que a linha da lista DIZ que o registro é. Mesmo motivo do Record acima: o
 * ternário `kind === "KIT" ? … : "Peça única"` chamaria todo orçamento de peça única.
 * Um QUOTE conta ITENS (a cópia da prancheta 18b), que é o que ele tem.
 */
export function kindLabel(item: HistoryItem): string {
    const lines = frozenPayloadOf(item)?.lines?.length ?? 0;
    if (item.kind === "QUOTE") {
        return lines === 1
            ? messages.quote.itemCountOne
            : messages.quote.itemCount.replace("{n}", String(lines));
    }
    return item.kind === "KIT" ? t.kindKit.replace("{n}", String(lines)) : t.kindSingle;
}

/**
 * "Válido até" — TEXTO derivado da coluna `quoteValidityDays` (Q7, ADR-0034 §2). Não existe estado
 * de vencimento: nada some da lista sozinho, nenhum job expira nada. Um vencimento de verdade
 * precisaria de autoridade de relógio, e `deviceQuotedAt` é, por decisão do E4, um carimbo do
 * aparelho que o servidor não verifica.
 */
export function validUntil(item: HistoryItem, days: number): string {
    const at = new Date(item.deviceQuotedAt).getTime() + days * MS_PER_DAY;
    return quotedDate(new Date(at).toISOString(), offsetOf(item));
}

/** The label, or the CAPTURED origin name, or an honest neutral — never an invented one. */
export function cardTitle(item: HistoryItem): string {
    if (item.label) return item.label;
    return frozenPayloadOf(item)?.provenance?.name ?? t.adhocFallback;
}

export const SYNC_BADGE: Record<Exclude<SyncState, "synced">, string> = {
    pending: t.syncPendingBadge,
    blocked: t.syncBlockedBadge,
    // hotfix 016/A3 (H4b) — its own badge, never the pending/blocked text: the reason is a dead
    // session, and the card must say that, not "pendente" or "precisa de Premium".
    unauthenticated: t.syncUnauthenticatedBadge,
    failed: t.syncFailedBadge,
};
