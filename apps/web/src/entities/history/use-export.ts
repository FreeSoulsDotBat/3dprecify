import { useMutation } from "@tanstack/react-query";

import {
  getExportHistoryCsvApiV1HistoryExportCsvGetUrl,
  getExportQuotePdfApiV1HistorySnapshotIdQuotePdfGetUrl,
} from "@/shared/api/generated";
import { apiFetchFile } from "@/shared/api/transport";
import { saveFile } from "@/shared/lib/save-file";

// 009/T028 (E4, PR-C, US4) — fetch the artifact the SERVER rendered and hand it to the device.
//
// Nothing here builds a document. The renderer lives on the server (ADR-0020) precisely so the
// entitlement gate is real: a lapsed or free caller never reaches it, so "denied, and no partial
// artifact" (FR-515/516) holds by construction rather than by a client-side `if`. This module's
// whole job is the two steps that cannot happen on the server: authenticate the request, and put
// the resulting bytes somewhere the seller can find them.
//
// The paths come from the GENERATED url builders, so the contract stays the single source of truth
// (a renamed route breaks the build here, not in production). The transport is `apiFetchFile`
// because only it reads the `Content-Disposition` the server sets — and because these are
// `useMutation`, not `useQuery`, on purpose: an export is an ACTION the seller takes, with a side
// effect on their device. The generated hooks are `useQuery`, which would cache the bytes, refetch
// them on window focus, and re-download a file nobody asked for.
//
// (The contract declares `application/pdf` / `text/csv` and the transport returns a real Blob for a
// non-JSON 2xx, so the generated client is no longer a trap either — it just is not what an action
// wants. Both were true the other way round before the PR-C review: the routes declared no content,
// Orval typed them `data: void`, and the mutator `res.text()`d the bytes into a corrupted string.)

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
