// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// US2/T025b (FR-304) — the honest Conta plan line: none/active/lapsed straight from
// GET /api/v1/entitlement (never fabricated), plus the ≤1-refresh helper ("Atualizar") for
// the just-granted window. Hooks are mocked; the states are driven directly.

const { useEntitlementMock, useIdentityMock } = vi.hoisted(() => ({
    useEntitlementMock: vi.fn(),
    useIdentityMock: vi.fn(),
}));
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/user/use-identity", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/user/use-identity")>();
    return { ...actual, useIdentity: () => useIdentityMock() };
});
// E6/T015 — ContaPage now reads the router (checkout=retorno takeover) and the offer Sheet's
// Assinar CTA navigates on sign-out. Neither is exercised by this suite's plan-line assertions;
// stub both hooks so the page renders outside a RouterProvider (the house pattern, bom-teaser.test).
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn(), useSearch: () => ({}) };
});

import { messages } from "@/shared/i18n/messages.pt-br";

import { ContaPage } from "./conta-page";

const t = messages.conta;

function queryState(over: Record<string, unknown>) {
    return { data: undefined, isError: false, isFetching: false, refetch: vi.fn(), ...over };
}

function renderConta() {
    useIdentityMock.mockReturnValue(
        queryState({ data: { uid: "u1", email: "a@b.dev", label: "a@b.dev" } }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ContaPage />
        </QueryClientProvider>,
    );
}

afterEach(() => cleanup());

describe("ContaPage — honest plan line (T025b / FR-304)", () => {
    it("none → Gratuito (as before)", () => {
        useEntitlementMock.mockReturnValue(queryState({ data: { status: "none" } }));
        renderConta();
        expect(screen.getByText(t.planFree)).toBeInTheDocument();
    });

    it("active → Premium with source, never the grantor", () => {
        useEntitlementMock.mockReturnValue(
            queryState({
                data: { status: "active", source: "beta", expiresAt: "2026-12-31T00:00:00Z" },
            }),
        );
        renderConta();
        expect(screen.getByText(t.planPremium)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(t.planSources.beta))).toBeInTheDocument();
    });

    it("lapsed → honest expired state with the read-only reassurance", () => {
        useEntitlementMock.mockReturnValue(queryState({ data: { status: "lapsed" } }));
        renderConta();
        expect(screen.getByText(t.planLapsed)).toBeInTheDocument();
        expect(screen.getByText(t.planLapsedHint)).toBeInTheDocument();
    });

    it("refresh helper calls refetch (the ≤1-refresh honest window)", () => {
        const refetch = vi.fn();
        useEntitlementMock.mockReturnValue(queryState({ data: { status: "none" }, refetch }));
        renderConta();
        fireEvent.click(screen.getByRole("button", { name: t.planRefresh }));
        expect(refetch).toHaveBeenCalled();
    });

    it("query error → honest unknown state, never a fabricated plan", () => {
        useEntitlementMock.mockReturnValue(queryState({ isError: true }));
        renderConta();
        expect(screen.getByText(t.planUnknown)).toBeInTheDocument();
        expect(screen.queryByText(t.planFree)).not.toBeInTheDocument();
        expect(screen.queryByText(t.planPremium)).not.toBeInTheDocument();
    });
});
