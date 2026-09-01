import { useMutation } from "@tanstack/react-query";

import {
    getExportHistoryCsvApiV1HistoryExportCsvGetUrl,
    getExportQuotePdfApiV1HistorySnapshotIdQuotePdfGetUrl,
} from "@/shared/api/generated";
import { apiFetchFile } from "@/shared/api/transport";
import { saveFile } from "@/shared/lib/save-file";

// ⚠ @doc DEC-054 — `useMutation` e NÃO `useQuery`: exportar é ação com efeito no aparelho, e um
//   `useQuery` rebaixaria o arquivo de novo no foco da janela. Nada aqui monta documento.

/** Fallbacks only — the server names the file via `Content-Disposition`; these cover its absence. */
const QUOTE_FILENAME = "orcamento.pdf";
const HISTORY_FILENAME = "historico.csv";

export interface ExportQuoteVars {
    /** The SERVER's snapshot id. A pending record has none — and cannot be exported (FR-513 note). */
    snapshotId: string;
    /** Q4/FR-512 — off unless the seller explicitly asked; the default artifact goes to a customer. */
    includeCostBreakdown: boolean;
}

/** The customer-facing quote for ONE snapshot. Throws a typed `ApiError` (the call site maps a
 *  403 `ENTITLEMENT_REQUIRED` to the lapse copy) — it never resolves with a broken file. */
export function useExportQuote() {
    return useMutation({
        mutationFn: async ({ snapshotId, includeCostBreakdown }: ExportQuoteVars) => {
            const url = getExportQuotePdfApiV1HistorySnapshotIdQuotePdfGetUrl(snapshotId, {
                includeCostBreakdown,
            });
            const file = await apiFetchFile(url, { headers: { Accept: "application/pdf" } });
            saveFile(file.blob, file.filename ?? QUOTE_FILENAME);
        },
    });
}

/** The seller's own ledger (FR-513) — rendered from the ACCOUNT, so queued records are not in it. */
export function useExportHistoryCsv() {
    return useMutation({
        mutationFn: async () => {
            const url = getExportHistoryCsvApiV1HistoryExportCsvGetUrl();
            const file = await apiFetchFile(url, { headers: { Accept: "text/csv" } });
            saveFile(file.blob, file.filename ?? HISTORY_FILENAME);
        },
    });
}
