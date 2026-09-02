// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 010/T015 (E5, PR-A US5) — the honest teaser + the SC-109 button-absence rule, written
// FAILING-first (the "Meus cenários" entry + "Salvar cenário" did not exist on the page).
//
// The 2026-07-19 SC-109 ratification (ux-scenarios.md §0.1/§11-F2): the FREE calculator has NO
// inline "Salvar cenário" button, for free OR signed-out — the honest door is the "Meus cenários"
// entry (a navigation affordance, visible for everyone), never a save button on the free calc.

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

const s = messages.scenarios;
const tb = messages.billing;

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

function setupFreeOrSignedOut(entitlementData: { status: string } | undefined) {
    useEntitlementMock.mockReturnValue({ data: entitlementData, isLoading: false });
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
}

describe("CalcularPage — the free 005 calculator is byte-untouched by E5 (SC-109)", () => {
    it("signed-out: NO inline 'Salvar cenário' button anywhere on the page", () => {
        useSessionStore.setState({ status: "anonymous", user: null });
        setupFreeOrSignedOut(undefined);
        renderPage();

        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
        expect(screen.queryByText(s.saveAction)).not.toBeInTheDocument();
    });

    it("free signed-in (none): also NO inline 'Salvar cenário' button", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        setupFreeOrSignedOut({ status: "none" });
        renderPage();

        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("lapsed premium: also NO inline button (a scenario write needs ACTIVE, not merely readable)", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        setupFreeOrSignedOut({ status: "lapsed" });
        renderPage();

        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("the free calculator still renders the untouched price (SC-310 lineage)", () => {
        setupFreeOrSignedOut(undefined);
        renderPage();
        // 016/PR-C homologação B1 — the seed's varejo is now R$ 24,24 (machine 4000/3600h).
        // 019/PR-F (T142, adoção) — o valor agora quebra em spans (R$/inteiro/decimais) dentro do
        // cartão `price-hero`; `toHaveTextContent` concatena os nós descendentes.
        expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*24,24/);
    });
});

describe('CalcularPage — "Minhas simulações" is the honest door (visible for EVERYONE)', () => {
    it("signed-out: the nav entry is visible; tapping it shows the honest unified teaser (016/US1)", () => {
        useSessionStore.setState({ status: "anonymous", user: null });
        setupFreeOrSignedOut(undefined);
        renderPage();

        const entry = screen.getByRole("button", { name: new RegExp(s.navEntry) });
        fireEvent.click(entry);

        // 019/PR-B (T046, prancheta 32c/32f) — a parede caiu: a folha "Meus cenários" mostra o VAZIO
        // DIDÁTICO no lugar do `PremiumTeaser` de página inteira (mesma folha para todo mundo).
        expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
        expect(screen.getByText(s.emptyTitle)).toBeInTheDocument();
        expect(screen.getByText(s.educationalBody)).toBeInTheDocument();
        // Never a fabricated sample scenario row on the door surface (SC-607) — no card/list item.
        expect(screen.queryByTestId("scenario-card")).not.toBeInTheDocument();
    });

    it("free signed-in (none): the SAME honest door (not a broken empty list)", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        setupFreeOrSignedOut({ status: "none" });
        renderPage();

        fireEvent.click(screen.getByRole("button", { name: new RegExp(s.navEntry) }));
        expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    });

    it("signed-out: the CTA's own href carries the sign-in + redirect intent, no separate 'Entrar'", () => {
        useSessionStore.setState({ status: "anonymous", user: null });
        setupFreeOrSignedOut(undefined);
        renderPage();

        fireEvent.click(screen.getByRole("button", { name: new RegExp(s.navEntry) }));
        const cta = screen.getByRole("link", { name: tb.subscribeAction });
        expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");
    });
});

describe("CalcularPage — active premium meets the real inline affordance", () => {
    it("the 'Salvar cenário' trigger IS present for an active entitlement", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        setupFreeOrSignedOut({ status: "active" });
        renderPage();

        expect(screen.getByTestId("save-scenario-trigger")).toBeInTheDocument();
    });

    it("the header 'Meus cenários' entry is ALSO present for premium (visible for everyone)", () => {
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "u-1", email: "u@x.dev" } as never,
        });
        setupFreeOrSignedOut({ status: "active" });
        renderPage();

        expect(screen.getByRole("button", { name: new RegExp(s.navEntry) })).toBeInTheDocument();
    });
});
