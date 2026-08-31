// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchFile, saveFile } = vi.hoisted(() => ({ apiFetchFile: vi.fn(), saveFile: vi.fn() }));

// Only the file entry is stubbed: the generated client imports `orvalFetch` from this same module,
// so a bare factory would blank the transport out from under it.
vi.mock("@/shared/api/transport", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/shared/api/transport")>()),
    apiFetchFile,
}));
vi.mock("@/shared/lib/save-file", () => ({ saveFile }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useExportHistoryCsv, useExportQuote } from "./use-export";

// 009/T028 (E4, PR-C, US4) — the export request itself.
//
// This module is a courier, so what is worth pinning is exactly what a courier can get wrong: the
// ADDRESS it delivers to. `includeCostBreakdown` is the seller's margin decision (Q4/FR-512) and it
// only means anything if the server READS it — a param the backend ignores would silently ship the
// cost lines to a customer while the UI showed the switch off. The wire name comes from the
// generated url builder (the contract), never from a string typed here.

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
    vi.clearAllMocks();
    apiFetchFile.mockResolvedValue({ blob: new Blob(["x"]), filename: null });
});

describe("the quote (PDF)", () => {
    it("asks the CONTRACT's route, and carries the opt-in as the wire param the server reads", async () => {
        const { result } = renderHook(() => useExportQuote(), { wrapper });

        await result.current.mutateAsync({ snapshotId: "srv-1", includeCostBreakdown: true });

        const url = apiFetchFile.mock.calls[0]?.[0] as string;
        expect(url).toContain("/api/v1/history/srv-1/quote.pdf");
        // camelCase on the wire (the backend's Query alias) — snake_case here would be silently ignored
        // by FastAPI and default to false, i.e. the seller's opt-in would vanish without an error.
        expect(url).toContain("includeCostBreakdown=true");
    });

    it("the default asks for NO cost lines — explicitly, never by omission", async () => {
        const { result } = renderHook(() => useExportQuote(), { wrapper });

        await result.current.mutateAsync({ snapshotId: "srv-1", includeCostBreakdown: false });

        expect(apiFetchFile.mock.calls[0]?.[0]).toContain("includeCostBreakdown=false");
    });

    it("saves under the name the SERVER chose; falls back only when it sent none", async () => {
        apiFetchFile.mockResolvedValue({ blob: new Blob(["x"]), filename: "orçamento-julho.pdf" });
        const { result } = renderHook(() => useExportQuote(), { wrapper });

        await result.current.mutateAsync({ snapshotId: "srv-1", includeCostBreakdown: false });
        expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "orçamento-julho.pdf");

        apiFetchFile.mockResolvedValue({ blob: new Blob(["x"]), filename: null });
        await result.current.mutateAsync({ snapshotId: "srv-1", includeCostBreakdown: false });
        expect(saveFile).toHaveBeenLastCalledWith(expect.any(Blob), "orcamento.pdf");
    });

    it("a failed request saves NOTHING — never a zero-byte file named like a quote", async () => {
        apiFetchFile.mockRejectedValue(new Error("403"));
        const { result } = renderHook(() => useExportQuote(), { wrapper });

        await expect(
            result.current.mutateAsync({ snapshotId: "srv-1", includeCostBreakdown: false }),
        ).rejects.toThrow();

        expect(saveFile).not.toHaveBeenCalled();
    });
});

describe("the history CSV", () => {
    it("asks the ledger route", async () => {
        const { result } = renderHook(() => useExportHistoryCsv(), { wrapper });

        await result.current.mutateAsync();

        await waitFor(() =>
            expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "historico.csv"),
        );
        expect(apiFetchFile.mock.calls[0]?.[0]).toBe("/api/v1/history/export.csv");
    });
});
