// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestSignOut } = vi.hoisted(() => ({ requestSignOut: vi.fn(async () => {}) }));
vi.mock("@/shared/session/sign-out-guard", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/session/sign-out-guard")>();
    return { ...actual, requestSignOut };
});
// E6/T015 — `renderConta()` below mounts ContaPage OUTSIDE a RouterProvider (it only needs the
// QueryClient for this seam check); ContaPage now also reads the router (checkout=retorno
// takeover). Stub it, same house pattern as bom-teaser.test.tsx — `renderTopBar()` keeps its OWN
// real RouterProvider below, unaffected by this module-level mock.
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useSearch: () => ({}) };
});

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { AccountPage } from "@/pages/account/account-page";
import { TopBar } from "@/widgets/top-bar/top-bar";

// 009/T011 (E4, PR-A) — EVERY sign-out entry point goes through the seam.
//
// This test exists because the hole is invisible by inspection: `signOutUser()` is called from TWO
// places (the top bar and the Conta page), and guarding only the one you happened to open leaves
// the other silently destroying an unsynced queue. The check is enforced HERE, at the app layer,
// because it is the only layer allowed to see both call sites at once.
//
// If a third sign-out button is ever added, this file is where it must be added too.

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u1", email: "vendedor@exemplo.com", displayName: "Vendedor" } as never,
    });
    vi.stubGlobal(
        "fetch",
        vi.fn(() =>
            Promise.resolve(
                new Response(JSON.stringify({ uid: "u1", email: "vendedor@exemplo.com" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            ),
        ),
    );
});

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function renderTopBar() {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                <TopBar isMobile={false} />
                <Outlet />
            </>
        ),
    });
    const child = createRoute({
        getParentRoute: () => rootRoute,
        path: "/calcular",
        component: () => <main>calcular</main>,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([child]),
        history: createMemoryHistory({ initialEntries: ["/calcular"] }),
    });
    return render(<RouterProvider router={router} />);
}

function renderAccount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
        <QueryClientProvider client={client}>
            <AccountPage />
        </QueryClientProvider>,
    );
}

describe("both sign-out entry points route through requestSignOut (never signOutUser directly)", () => {
    it("the top bar's Sair goes through the seam", async () => {
        const user = setup();
        renderTopBar();
        await screen.findByText("calcular");

        await user.click(screen.getByRole("button", { name: messages.account.signOut }));

        await waitFor(() => expect(requestSignOut).toHaveBeenCalledTimes(1));
    });

    it("the Conta page's Sair goes through the seam", async () => {
        const user = setup();
        renderAccount();

        await user.click(
            screen.getByRole("button", { name: new RegExp(messages.account.signOut) }),
        );

        await waitFor(() => expect(requestSignOut).toHaveBeenCalledTimes(1));
    });
});
