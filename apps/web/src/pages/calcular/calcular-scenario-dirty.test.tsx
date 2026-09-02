// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Defect A (coordinator, 2026-07-20, T030 e2e finding) — written FAILING-first: reopening a
// scenario and editing a channel fee override never flipped `dirty` (the badge/"Salvar alterações"
// stayed dead). Two independent bugs, both reproduced here:
//   1. `formSignature` never included the 17 scalar CalcFieldNames, though the comment claimed it
//      mirrored the SAME subset `applyScenarioConfig` patches.
//   2. The `useMemo` deps `[values.channels]` assumed a NEW array reference on every edit — RHF's
//      `watch()` does not guarantee that for a nested array-item field, so an override edit could
//      recompute nothing.

const { useEntitlementMock, useFilamentsMock, usePrintersMock, useScenariosMock } = vi.hoisted(
    () => ({
        useEntitlementMock: vi.fn(),
        useFilamentsMock: vi.fn(),
        usePrintersMock: vi.fn(),
        useScenariosMock: vi.fn(),
    }),
);
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
    return {
        ...actual,
        useFilaments: () => useFilamentsMock(),
        usePrinters: () => usePrintersMock(),
    };
});
vi.mock("@/entities/scenario/use-scenarios", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/scenario/use-scenarios")>();
    return { ...actual, useScenarios: () => useScenariosMock() };
});

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { CalculatePage } from "./calcular-page";

const s = messages.scenarios;
const t = messages.calculator;

function listState(items: unknown[]) {
    return {
        items,
        isLoading: false,
        isError: false,
        stale: false,
        refetch: vi.fn(),
        loadMore: vi.fn(),
        hasMore: false,
        isFetchingMore: false,
    };
}

// A saved AD_HOC scenario, one channel WITHOUT an override (so editing its commission is the
// first override — exactly the e2e repro: an edit after reopen, not a re-save of what was loaded).
const SCENARIO = {
    id: "s1",
    name: "ML Clássico",
    note: null,
    config: {
        schemaVersion: 1,
        includeMarketplace: true,
        costBasis: {
            kind: "AD_HOC",
            ref: null,
            lastKnown: {
                costPerRoll: "100",
                rollWeightKg: "1",
                printGrams: "100",
                wasteGrams: "0",
                printTimeHours: "5",
                avgPowerKw: "0.12",
                tariffPerKwh: "1",
                machineValue: "4000",
                machineLifetimeHours: "2000",
                maintenanceReservePerHour: "0",
                failurePct: "0",
                finishTimeHours: "0",
                finishRatePerHour: "0",
                laborHours: "0",
                laborRatePerHour: "0",
                markupVarejoPct: "50",
                markupAtacadoPct: "30",
            },
        },
        channels: [{ marketplace: "MERCADO_LIVRE", modality: "CLASSICO" }],
        otherCosts: [],
    },
    createdAt: "2026-07-19T10:00:00Z",
    updatedAt: "2026-07-19T10:00:00Z",
};

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CalculatePage />
        </QueryClientProvider>,
    );
}

async function openTheScenario() {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(s.navEntry) }));
    fireEvent.click(await screen.findByText(SCENARIO.name));
}

beforeEach(() => {
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
    useScenariosMock.mockReturnValue(listState([SCENARIO]));
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — dirty-tracking on a reopened scenario (Defect A)", () => {
    it("reopen: NOT dirty, 'Salvar alterações' disabled, no unsaved badge", async () => {
        renderPage();
        await openTheScenario();

        expect(screen.queryByText(s.unsavedBadge)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: s.saveChanges })).toBeDisabled();
    });

    it("editing a channel fee OVERRIDE after reopen flips dirty — the exact e2e repro (price 34,33→61,80)", async () => {
        renderPage();
        await openTheScenario();

        const commission = screen.getByRole("textbox", {
            name: `${t.channels.commission}opcional`,
        });
        fireEvent.change(commission, { target: { value: "25" } });
        fireEvent.blur(commission);

        await waitFor(() => expect(screen.getByText(s.unsavedBadge)).toBeInTheDocument());
        expect(screen.getByRole("button", { name: s.saveChanges })).toBeEnabled();
    });

    it("editing a SCALAR field (e.g. custo do rolo) after reopen also flips dirty", async () => {
        renderPage();
        await openTheScenario();

        const costPerRoll = screen.getByRole("textbox", { name: t.fields.costPerRoll });
        fireEvent.change(costPerRoll, { target: { value: "150" } });
        fireEvent.blur(costPerRoll);

        await waitFor(() => expect(screen.getByText(s.unsavedBadge)).toBeInTheDocument());
        expect(screen.getByRole("button", { name: s.saveChanges })).toBeEnabled();
    });
});
