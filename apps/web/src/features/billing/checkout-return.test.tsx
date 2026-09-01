// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// E6/T014 (US2 — ux-billing.md §3.2-§3.5). FAILING-first: the return surface NEVER pre-flips
// premium and NEVER shows a "processando" that implies success. It polls server truth
// (GET /entitlement) and settles to exactly one of pending / success / unconfirmed.

const { useEntitlementMock, navigateMock } = vi.hoisted(() => ({
    useEntitlementMock: vi.fn(),
    navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => navigateMock, useSearch: () => ({}) };
});
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => useEntitlementMock(),
}));

import { messages } from "@/shared/i18n/messages.pt-br";

import {
    CHECKOUT_RETURN_MAX_ATTEMPTS,
    CHECKOUT_RETURN_POLL_INTERVAL_MS,
    CheckoutReturnPanel,
} from "./checkout-return";

const t = messages.billing;

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe("CheckoutReturnPanel — pending (US2, §3.3)", () => {
    it("shows 'confirmando', never a 'processando' that implies success", () => {
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, refetch: vi.fn() });
        render(<CheckoutReturnPanel />);

        expect(screen.getByText(t.returnPendingTitle)).toBeInTheDocument();
        expect(screen.getByText(t.returnPendingBody)).toBeInTheDocument();
        expect(screen.queryByText(/processando/i)).not.toBeInTheDocument();
    });

    it("'Atualizar' calls refetch manually", () => {
        const refetch = vi.fn();
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, refetch });
        render(<CheckoutReturnPanel />);

        fireEvent.click(screen.getByRole("button", { name: t.returnRefresh }));
        expect(refetch).toHaveBeenCalled();
    });

    it("'Voltar para a Conta' is always an exit", () => {
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, refetch: vi.fn() });
        render(<CheckoutReturnPanel />);

        fireEvent.click(screen.getByRole("button", { name: t.returnBackToAccount }));
        expect(navigateMock).toHaveBeenCalledWith({ to: "/conta" });
    });
});

describe("CheckoutReturnPanel — success (US2, §3.4)", () => {
    it("fires ONLY off a verified source=payment active grant", () => {
        useEntitlementMock.mockReturnValue({
            data: { status: "active", source: "payment" },
            refetch: vi.fn(),
        });
        render(<CheckoutReturnPanel />);

        expect(screen.getByText(t.returnSuccessTitle)).toBeInTheDocument();
        expect(screen.getByText(t.returnSuccessBody)).toBeInTheDocument();
    });

    it("a beta/comp grant is NOT success here — the client shows server truth, not a guess", () => {
        useEntitlementMock.mockReturnValue({
            data: { status: "active", source: "beta" },
            refetch: vi.fn(),
        });
        render(<CheckoutReturnPanel />);

        expect(screen.queryByText(t.returnSuccessTitle)).not.toBeInTheDocument();
        expect(screen.getByText(t.returnPendingTitle)).toBeInTheDocument();
    });

    it("'Ir para a calculadora' navigates to /calcular", () => {
        useEntitlementMock.mockReturnValue({
            data: { status: "active", source: "payment" },
            refetch: vi.fn(),
        });
        render(<CheckoutReturnPanel />);

        fireEvent.click(screen.getByRole("button", { name: t.returnSuccessAction }));
        expect(navigateMock).toHaveBeenCalledWith({ to: "/calcular" });
    });
});

describe("CheckoutReturnPanel — unconfirmed/abandoned (US2.2, §3.5)", () => {
    it("after the bounded poll exhausts with no grant, settles to the honest unconfirmed state", async () => {
        const refetch = vi.fn();
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, refetch });
        render(<CheckoutReturnPanel />);

        for (let i = 0; i < CHECKOUT_RETURN_MAX_ATTEMPTS; i++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(CHECKOUT_RETURN_POLL_INTERVAL_MS);
            });
        }

        expect(screen.getByText(t.returnUnconfirmedTitle)).toBeInTheDocument();
        expect(screen.getByText(t.returnUnconfirmedBody)).toBeInTheDocument();
        // never claims failure — it might still confirm; never claims success either
        expect(screen.queryByText(t.returnSuccessTitle)).not.toBeInTheDocument();
        expect(refetch).toHaveBeenCalled();
    });

    it("'Verificar de novo' restarts the bounded poll", async () => {
        const refetch = vi.fn();
        useEntitlementMock.mockReturnValue({ data: { status: "none" }, refetch });
        render(<CheckoutReturnPanel />);

        for (let i = 0; i < CHECKOUT_RETURN_MAX_ATTEMPTS; i++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(CHECKOUT_RETURN_POLL_INTERVAL_MS);
            });
        }
        expect(screen.getByText(t.returnUnconfirmedTitle)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t.returnVerifyAgain }));
        expect(screen.getByText(t.returnPendingTitle)).toBeInTheDocument();
    });
});
