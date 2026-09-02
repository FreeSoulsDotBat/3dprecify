// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEE_CATALOG_SEED, type UseFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CalculatePage } from "./calculator-page";

// US3 (SC-104): the online catalog refresh is non-blocking — a failure must surface a RETRY without
// ever blocking the calculator (seed/store keep it live). We mock ONLY the store hook so we can drive
// isError/isRefetching/refetch deterministically; the seed, schema and pricing model stay real.
const { useFeeCatalogMock } = vi.hoisted(() => ({ useFeeCatalogMock: vi.fn() }));
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
    return { ...actual, useFeeCatalog: () => useFeeCatalogMock() };
});
// 016/US11 (T048, FR-915) — marketplace pricing is Premium now; this file's retry notice lives
// INSIDE the entitled branch of `MarketplaceSection`, so the mechanics it tests need an entitled
// account. Free-tier proof lives in `apps/web/tests/e2e/marketplace-premium.spec.ts`.
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({
        data: { status: "active" },
        isError: false,
        isLoading: false,
        stale: false,
        isFetching: false,
        refetch: () => {},
    }),
}));

afterEach(() => cleanup());
const t = messages.calculator;

function catalogState(over: Partial<UseFeeCatalog> = {}): UseFeeCatalog {
    return {
        catalog: FEE_CATALOG_SEED,
        source: "seed",
        refreshFailed: false,
        refreshing: false,
        refetch: vi.fn(),
        ...over,
    };
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CalculatePage />
        </QueryClientProvider>,
    );
}

describe("US3 — non-blocking catalog refresh retry (SC-104)", () => {
    it("surfaces a retry notice on a failed refresh WHILE the calculator still computes (no blank grid)", () => {
        useFeeCatalogMock.mockReturnValue(catalogState({ refreshFailed: true }));
        renderPage();

        // The non-blocking notice + a retry affordance are shown.
        expect(screen.getByText(t.channels.refreshErrorTitle)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.channels.refreshRetry })).toBeInTheDocument();

        // Non-blocking: the price still computes from the entered costs (never blocked on the network).
        fireEvent.change(screen.getByRole("textbox", { name: t.fields.costPerRoll }), {
            target: { value: "100" },
        });
        fireEvent.change(screen.getByRole("textbox", { name: t.fields.rollWeight }), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByRole("textbox", { name: t.fields.grams }), {
            target: { value: "100" },
        });
        expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
    });

    it("clicking 'Tentar novamente' calls refetch", () => {
        const refetch = vi.fn();
        useFeeCatalogMock.mockReturnValue(catalogState({ refreshFailed: true, refetch }));
        renderPage();

        fireEvent.click(screen.getByRole("button", { name: t.channels.refreshRetry }));
        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("shows NO retry notice when the catalog is healthy", () => {
        useFeeCatalogMock.mockReturnValue(catalogState({ refreshFailed: false }));
        renderPage();

        expect(screen.queryByText(t.channels.refreshErrorTitle)).not.toBeInTheDocument();
    });

    // Regression (homologação US3): a bare `refetch()` of a no-data errored query re-enters 'pending', so
    // the raw isError drops to false mid-retry. The hook's `refreshFailed` is STICKY, so the page must
    // keep the notice on `refreshFailed` alone (never blinking out) while `refreshing` drives the spinner.
    it("keeps the notice mounted and shows the button loading WHILE a retry is in flight", () => {
        useFeeCatalogMock.mockReturnValue(catalogState({ refreshFailed: true, refreshing: true }));
        renderPage();

        // The notice persists (refreshFailed is sticky through the retry's transient pending window)…
        expect(screen.getByText(t.channels.refreshErrorTitle)).toBeInTheDocument();
        // …and the retry button reflects the in-flight state (Button loading → aria-busy + disabled). Its
        // accessible name now also carries the Spinner's "Carregando…" SR label, so match by substring.
        const retry = screen.getByRole("button", { name: new RegExp(t.channels.refreshRetry) });
        expect(retry).toHaveAttribute("aria-busy", "true");
        expect(retry).toBeDisabled();
    });

    // The initial load is fetching but has NOT failed → refreshFailed is false, so no notice appears (the
    // notice must never flash during the first fetch, only after a real failure).
    it("shows NO notice during the initial load (fetching, not yet failed)", () => {
        useFeeCatalogMock.mockReturnValue(catalogState({ refreshFailed: false, refreshing: true }));
        renderPage();

        expect(screen.queryByText(t.channels.refreshErrorTitle)).not.toBeInTheDocument();
    });
});
