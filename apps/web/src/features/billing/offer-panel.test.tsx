// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// E6/T014 (US1 — ux-billing.md §2/§0.2). FAILING-first: the offer surface renders EXACTLY the
// real prices from the ONE product constant, pre-highlights the annual plan without hiding the
// monthly one, never fabricates a "de/por" anchor, and its Assinar button hands off to checkout —
// honestly, including the 409/503 non-success paths.

const { useEntitlementMock, createCheckoutMock } = vi.hoisted(() => ({
    useEntitlementMock: vi.fn(),
    createCheckoutMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn(), useSearch: () => ({}) };
});
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/shared/api/generated", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/api/generated")>();
    return {
        ...actual,
        createCheckoutApiV1BillingCheckoutPost: (...a: unknown[]) => createCheckoutMock(...a),
    };
});

import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { OfferPanel } from "./offer-panel";

/** O NBSP do dado vira espaco comum, como o normalizador do RTL ja faz com o texto do DOM. */
const semNbsp = (v: string) => v.replaceAll(String.fromCharCode(160), " ");

const t = messages.billing;

function renderOffer() {
    useEntitlementMock.mockReturnValue({ data: { status: "none" }, isError: false });
    return render(<OfferPanel />);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("OfferPanel — real prices, honest discount (US1, ux §2/§0.2)", () => {
    it("renders EXACTLY the monthly and annual prices from the one product constant", () => {
        renderOffer();
        // T038/D1 — os precos carregam NBSP entre o simbolo e o valor (para a linha NUNCA quebrar
        // entre `R$` e o numero), e o normalizador do RTL converte o NBSP do DOM mas nao o do matcher.
        // A comparacao segue partindo da MESMA constante — so o separador e normalizado dos dois lados.
        expect(screen.getByText(semNbsp(t.planMonthlyPrice))).toBeInTheDocument();
        expect(screen.getByText(semNbsp(t.planAnnualPrice))).toBeInTheDocument();
        expect(screen.getByText(semNbsp(t.planAnnualEquiv))).toBeInTheDocument();
        expect(screen.getByText(t.planAnnualSaving)).toBeInTheDocument(); // ~19% de economia
    });

    it("NEVER renders a de/por anchor — R$ 191,88 (12× the monthly) never appears", () => {
        renderOffer();
        expect(screen.queryByText(/191,88/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\bde\b.*\bpor\b/i)).not.toBeInTheDocument();
        expect(document.querySelector("s, del")).toBeNull();
    });

    it("annual is pre-highlighted 'recomendado'; monthly is reachable in one tap", () => {
        renderOffer();
        const annualInput = screen.getByDisplayValue("annual") as HTMLInputElement;
        const monthlyInput = screen.getByDisplayValue("monthly") as HTMLInputElement;
        expect(annualInput.checked).toBe(true);
        expect(screen.getByText(t.planAnnualBadge)).toBeInTheDocument();

        fireEvent.click(monthlyInput);
        expect(monthlyInput.checked).toBe(true);
    });

    it("Assinar calls the checkout client with the SELECTED period and hands off to initPoint", async () => {
        useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
        createCheckoutMock.mockResolvedValue({
            status: 200,
            data: { initPoint: "https://mp.example/checkout/annual" },
        });
        const assign = vi.fn();
        vi.stubGlobal("location", { ...window.location, assign });

        renderOffer();
        fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

        await waitFor(() => expect(createCheckoutMock).toHaveBeenCalledWith({ period: "annual" }));
        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith("https://mp.example/checkout/annual"),
        );
        vi.unstubAllGlobals();
    });

    it("switching to monthly then Assinar calls checkout with period=monthly", async () => {
        useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
        createCheckoutMock.mockResolvedValue({
            status: 200,
            data: { initPoint: "https://mp.example/checkout/monthly" },
        });
        vi.stubGlobal("location", { ...window.location, assign: vi.fn() });

        renderOffer();
        fireEvent.click(screen.getByDisplayValue("monthly"));
        fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

        await waitFor(() => expect(createCheckoutMock).toHaveBeenCalledWith({ period: "monthly" }));
        vi.unstubAllGlobals();
    });

    it("409 (an open subscription already exists) renders the plain honest copy — NO status code", async () => {
        useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
        createCheckoutMock.mockRejectedValue(
            new ApiError({
                status: 409,
                code: "VALIDATION_ERROR",
                message: "an open subscription already exists",
                correlationId: null,
            }),
        );

        renderOffer();
        fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

        expect(await screen.findByText(t.checkoutInProgress)).toBeInTheDocument();
        expect(screen.queryByText(/409/)).not.toBeInTheDocument();
        expect(screen.queryByText(/VALIDATION_ERROR/)).not.toBeInTheDocument();
    });

    it("503 (MP unreachable) renders the honest unavailable copy — never a fake success", async () => {
        useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
        createCheckoutMock.mockRejectedValue(
            new ApiError({
                status: 503,
                code: "BILLING_UNAVAILABLE",
                message: "payment provider unreachable",
                correlationId: null,
            }),
        );

        renderOffer();
        fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));

        expect(await screen.findByText(t.offerUnavailable)).toBeInTheDocument();
        expect(screen.queryByText(t.returnSuccessTitle)).not.toBeInTheDocument();
    });

    it("already-active accounts see the honest 'já é Premium' guard, not a second sale", () => {
        useEntitlementMock.mockReturnValue({ data: { status: "active" }, isError: false });
        render(<OfferPanel />);
        expect(screen.getByText(t.alreadyPremium)).toBeInTheDocument();
        expect(screen.queryByText(semNbsp(t.planAnnualPrice))).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: t.subscribeAction })).not.toBeInTheDocument();
    });
});

describe("BillingCta (composed here) — signed-out routes through sign-in first (FR-702)", () => {
    it("a signed-out tap never calls checkout — it routes to sign-in with the return intent", () => {
        useSessionStore.setState({ status: "anonymous", user: null });
        renderOffer();
        fireEvent.click(screen.getByRole("button", { name: t.subscribeAction }));
        expect(createCheckoutMock).not.toHaveBeenCalled();
    });
});
