// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { CalculatePage } from "./calculator-page";

// 013/T013 (FA-03) — a visible per-field validation error must NOT survive a programmatic
// `setValue` (catalog prefill / scenario reopen): RHF only re-validates a field it is TOLD to
// (`shouldValidate: true`); without it the price silently recomputes correctly while the stale
// error message keeps lying to the seller until they manually touch the field. Regression guard
// for the catalog-prefill path (the cheapest repro of the 4 affected `setValue` call sites).

const { useFilamentsMock, usePrintersMock } = vi.hoisted(() => ({
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
    return {
        ...actual,
        useFilaments: () => useFilamentsMock(),
        usePrinters: () => usePrintersMock(),
    };
});

const t = messages.calculator;

const filament = {
    id: "f-1",
    name: "PLA Azul",
    material: "PLA",
    costPerRoll: "110.00",
    rollWeightKg: "1.000",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
};

function listState(items: unknown[]) {
    return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CalculatePage />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    useFilamentsMock.mockReturnValue(listState([filament]));
    usePrintersMock.mockReturnValue(listState([]));
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u-1", email: "a@b.dev" } as never,
    });
});

afterEach(() => {
    cleanup();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — stale validation error after a catalog prefill (FA-03)", () => {
    it("clears the rollWeight error the instant a valid filament is picked, no manual touch", async () => {
        renderPage();

        fireEvent.change(screen.getByRole("textbox", { name: t.fields.rollWeight }), {
            target: { value: "0" },
        });
        expect(await screen.findByText(t.rollWeightError)).toBeInTheDocument();

        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
            target: { value: "f-1" },
        });

        // The prefilled value (1,000) is valid — the stale error must be gone with NO further
        // interaction on the field itself (async resolver revalidation — await it).
        await waitFor(() => {
            expect(screen.queryByText(t.rollWeightError)).not.toBeInTheDocument();
        });
        expect(screen.getByRole("textbox", { name: t.fields.rollWeight })).toHaveValue("1,000");
    });
});
