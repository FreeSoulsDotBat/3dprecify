// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 010/T035 (E5, PR-C, US7) — the E4 bridge, written FAILING-first: recording from a scenario's LIVE
// result must produce a frozen E4 snapshot byte-identical to what is on screen, carrying the
// scenario as INFORMATIONAL provenance only ("originou-se do cenário X") — never a value source,
// never recomputed later, and the scenario ITSELF is untouched by recording (SC-611: same
// updatedAt/config — proven here by asserting no scenario write mutation ever fires).
//
// Two independent bases, because "the displayed computation" means something different for each:
//   * AD_HOC/PRODUCT: the ordinary single-piece calculator fields ARE the displayed computation —
//     the EXISTING `RecordSnapshotButton` (E4 US1) is reused verbatim, just handed the scenario's
//     provenance instead of `null`.
//   * KIT: the displayed computation is `KitBasisSummary`'s OWN read-only per-marketplace rollup —
//     the stale single-piece calculator fields are NOT what is on screen, so recording MUST freeze
//     the rollup, not the calculator (and the ordinary SINGLE record button must not offer to record
//     the wrong thing while a KIT scenario is loaded).

const { useEntitlementMock, useFilamentsMock, usePrintersMock, useScenariosMock, mutateAsync } =
    vi.hoisted(() => ({
        useEntitlementMock: vi.fn(),
        useFilamentsMock: vi.fn(),
        usePrintersMock: vi.fn(),
        useScenariosMock: vi.fn(),
        mutateAsync: vi.fn(),
    }));

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
vi.mock("@/entities/history/use-history", () => ({
    useRecordSnapshot: () => ({ mutateAsync, isPending: false }),
}));

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import type { SnapshotIn } from "@/shared/api/generated";
import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";

import { CalculatePage } from "./calculator-page";

const s = messages.scenarios;
const h = messages.history;

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

const AD_HOC_LASTKNOWN = {
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

const AD_HOC_SCENARIO = {
    id: "s1",
    name: "Comparativo ML x Shopee",
    note: null,
    config: {
        schemaVersion: 1,
        includeMarketplace: true,
        costBasis: { kind: "AD_HOC", ref: null, lastKnown: AD_HOC_LASTKNOWN },
        channels: [{ marketplace: "MERCADO_LIVRE", modality: "CLASSICO" }],
        otherCosts: [],
    },
    createdAt: "2026-07-19T10:00:00Z",
    updatedAt: "2026-07-19T10:00:00Z",
};

const KIT_SCENARIO = {
    id: "s2",
    name: "Kit sazonal — cenário",
    note: null,
    config: {
        schemaVersion: 1,
        includeMarketplace: true,
        costBasis: {
            kind: "KIT",
            ref: { id: "k1", name: "Kit sazonal" },
            lastKnown: {
                lines: [
                    { name: "Vaso G", quantity: 2, input: AD_HOC_LASTKNOWN },
                    { name: "Vaso P", quantity: 1, input: AD_HOC_LASTKNOWN },
                ],
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

async function openScenario(name: string) {
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
    useScenariosMock.mockReturnValue(listState([AD_HOC_SCENARIO, KIT_SCENARIO]));
    mutateAsync.mockResolvedValue({ clientSnapshotId: "csid-1", syncState: "synced" });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("recording an E4 snapshot from an AD_HOC/PRODUCT scenario (US7)", () => {
    it("carries the scenario as informational SCENARIO provenance — id, name, nothing else", async () => {
        renderPage();
        await openScenario(AD_HOC_SCENARIO.name);

        fireEvent.click(screen.getByRole("button", { name: h.saveAction }));
        fireEvent.click(await screen.findByRole("button", { name: h.saveSheetSubmit }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
        const payload = body.payload as unknown as FrozenSnapshotPayload;
        expect(payload.provenance).toEqual({
            kind: "SCENARIO",
            id: "s1",
            name: AD_HOC_SCENARIO.name,
        });
    });

    it("freezes exactly the displayed totals — byte-identical to what is on screen", async () => {
        renderPage();
        await openScenario(AD_HOC_SCENARIO.name);
        // 019/PR-F (T142, adoção) — o preço final agora quebra em spans (R$/inteiro/decimais) dentro
        // do cartão `price-hero`; `toHaveTextContent` concatena os nós descendentes, o que um
        // `getByText` de string única não faz mais.
        expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*30,90/);

        fireEvent.click(screen.getByRole("button", { name: h.saveAction }));
        fireEvent.click(await screen.findByRole("button", { name: h.saveSheetSubmit }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
        expect(body.headlineTotal).toBe("30.90");
    });

    it("the scenario itself is unchanged by recording — no scenario write mutation fires (SC-611)", async () => {
        renderPage();
        await openScenario(AD_HOC_SCENARIO.name);

        fireEvent.click(screen.getByRole("button", { name: h.saveAction }));
        fireEvent.click(await screen.findByRole("button", { name: h.saveSheetSubmit }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        // Recording never enables/uses "Salvar alterações" — the context bar stays exactly as loaded.
        // 019/PR-F (T099): dentro de `waitFor` — o diálogo Radix ainda pode estar fechando, e enquanto
        // o seu focus-guard existe o botão fica `aria-hidden` (vermelho INTERMITENTE só sob a carga da
        // suíte inteira; a lição do 016: o intermitente morre na causa, não no "roda de novo").
        await waitFor(() =>
            expect(screen.getByRole("button", { name: s.saveChanges })).toBeDisabled(),
        );
    });
});

describe("recording an E4 snapshot from a KIT-basis scenario (US7) — the rollup, not stale scalars", () => {
    it("the ordinary SINGLE record button is ABSENT while a KIT scenario is loaded (never the wrong freeze)", async () => {
        renderPage();
        await openScenario(KIT_SCENARIO.name);

        // Only the KIT record affordance exists — recording the untouched calculator fields instead of
        // the displayed rollup would freeze numbers the seller never saw.
        expect(screen.getAllByRole("button", { name: h.saveAction })).toHaveLength(1);
    });

    it("freezes the KIT rollup — provenance SCENARIO, itemized lines, per-marketplace totals", async () => {
        renderPage();
        await openScenario(KIT_SCENARIO.name);

        fireEvent.click(screen.getByRole("button", { name: h.saveAction }));
        fireEvent.click(await screen.findByRole("button", { name: h.saveSheetSubmit }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
        const payload = body.payload as unknown as FrozenSnapshotPayload;
        expect(body.kind).toBe("KIT");
        expect(payload.provenance).toEqual({
            kind: "SCENARIO",
            id: "s2",
            name: KIT_SCENARIO.name,
        });
        expect(payload.lines).toHaveLength(2);
        expect(payload.lines?.map((l) => l.name)).toEqual(["Vaso G", "Vaso P"]);
    });
});
