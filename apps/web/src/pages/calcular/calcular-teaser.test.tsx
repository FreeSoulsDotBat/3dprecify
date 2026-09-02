// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US7/T031 — the calculator's "usar do catálogo" slot for free/signed-out users. 016/US1
// (T006/T007): rewritten for the unified `PremiumTeaser` (feature=CATALOG_PICKER) — the old
// dialog is gone; the affordance itself now renders DISABLED and VISIBLE in place (US1-AC3),
// with the explanation of what the catalog is standing where "Salvar faz parte do Premium." did.

const { useEntitlementMock, useFilamentsMock, usePrintersMock } = vi.hoisted(() => ({
    useEntitlementMock: vi.fn(),
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
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

import { CalculatePage } from "./calcular-page";

const t = messages.calculator;
const pt = messages.premiumTeaser.CATALOG_PICKER;

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

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — free/signed-out teaser slot (US7/T031, rewritten 016/US1)", () => {
    it("signed-out: shows the honest teaser AND the disabled-but-visible 'Usar do catálogo' button", () => {
        useSessionStore.setState({ status: "anonymous", user: null });
        useEntitlementMock.mockReturnValue({ data: undefined, isLoading: false });
        useFilamentsMock.mockReturnValue(listState([]));
        usePrintersMock.mockReturnValue(listState([]));
        renderPage();

        expect(screen.getByText(pt.title)).toBeInTheDocument();
        expect(screen.getByText(pt.subtitle)).toBeInTheDocument();
        const button = screen.getByRole("button", { name: t.catalogPicker.title });
        expect(button).toBeVisible();
        expect(button).toBeDisabled();
        // The manual free calculator is untouched behind it (SC-310). 016/PR-C homologação B1 — the
        // seed's varejo is now R$ 24,24 (machine 4000/3600h). 019/PR-F (T142, adoção) — o valor agora
        // quebra em spans dentro do cartão `price-hero`; `toHaveTextContent` concatena os descendentes.
        expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*24,24/);
    });

    it("free signed-in (none): same disabled-and-visible affordance → same honest teaser", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, isLoading: false });
        useFilamentsMock.mockReturnValue(listState([]));
        usePrintersMock.mockReturnValue(listState([]));
        renderPage();

        expect(screen.getByText(pt.title)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.catalogPicker.title })).toBeDisabled();
    });

    it("premium keeps the REAL pickers — no teaser, no disabled affordance", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
        useFilamentsMock.mockReturnValue(
            listState([
                {
                    id: "f-1",
                    name: "PLA Azul",
                    costPerRoll: "110.00",
                    rollWeightKg: "1.000",
                },
            ]),
        );
        usePrintersMock.mockReturnValue(listState([]));
        renderPage();

        expect(
            screen.getByRole("combobox", { name: t.catalogPicker.filament }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: t.catalogPicker.title }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    });
});
