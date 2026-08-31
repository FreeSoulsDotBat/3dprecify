// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 016/T036 (US10, FR-913) — written FAILING-first: a scenario saved BEFORE pricing-core 4.0.0 still
// carries `wasteGrams` in its `lastKnown` (nothing purges the old row). Reopening it must recompute
// WITHOUT the retired leaf (the engine refuses the key) AND DECLARE the discard where the seller can
// see it — a PERSISTENT info notice, not a toast, naming the pt-BR field ("Desperdício (g)"), never
// the wire key. A document with nothing retired (the common case) shows nothing.

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

import { CalcularPage } from "./calcular-page";

const s = messages.scenarios;

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

const LAST_KNOWN_CLEAN = {
    costPerRoll: "100",
    rollWeightKg: "1",
    printGrams: "100",
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
};

function scenario(id: string, name: string, lastKnown: Record<string, string>) {
    return {
        id,
        name,
        note: null,
        config: {
            schemaVersion: 1,
            includeMarketplace: true,
            costBasis: { kind: "AD_HOC", ref: null, lastKnown },
            channels: [{ marketplace: "MERCADO_LIVRE", modality: "CLASSICO" }],
            otherCosts: [],
        },
        createdAt: "2026-07-19T10:00:00Z",
        updatedAt: "2026-07-19T10:00:00Z",
    };
}

const PRE_4_0_0 = scenario("s1", "Simulação antiga", { ...LAST_KNOWN_CLEAN, wasteGrams: "10.000" });
const CLEAN = scenario("s2", "Simulação nova", LAST_KNOWN_CLEAN);

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CalcularPage />
        </QueryClientProvider>,
    );
}

async function openTheScenario(name: string) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(s.navEntry) }));
    fireEvent.click(await screen.findByText(name));
}

beforeEach(() => {
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — reopening a pre-4.0.0 scenario declares the discard (016/T036, FR-913)", () => {
    it("a lastKnown carrying wasteGrams shows a PERSISTENT notice naming the pt-BR field", async () => {
        useScenariosMock.mockReturnValue(listState([PRE_4_0_0]));
        renderPage();
        await openTheScenario(PRE_4_0_0.name);

        // role=status via Alert(tone="info") — an accessible, persistent region (never a toast).
        const notice = await screen.findByText(/Desperdício \(g\)/);
        expect(notice.closest('[role="status"]')).toBeInTheDocument();
        expect(screen.getByText(/modelo de preço atual não usa mais/)).toBeInTheDocument();
        // Never the raw wire key on screen.
        expect(screen.queryByText(/wasteGrams/)).not.toBeInTheDocument();
    });

    it("a clean (4.0.0) document reopens with NO discard notice — absence is the common case", async () => {
        useScenariosMock.mockReturnValue(listState([CLEAN]));
        renderPage();
        await openTheScenario(CLEAN.name);

        expect(screen.queryByText(/Desperdício \(g\)/)).not.toBeInTheDocument();
    });
});
