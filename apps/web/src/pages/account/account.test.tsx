// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Conta page reads server-confirmed identity from the /api/v1/me RESPONSE (A23) —
// NEVER from the client session object — via the T067 transport wrapper (T068 wiring).
// We stub the GLOBAL fetch the wrapper uses (no backend, no MSW), mirroring the T036
// guards test. signOutUser is mocked to flip the REAL session store to `anonymous` so we
// can assert the sign-out + re-guard behaviour without a live Firebase.
vi.mock("@/shared/session/session-store", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/session/session-store")>();
    return {
        ...actual,
        signOutUser: vi.fn(async () => {
            actual.useSessionStore.setState({ status: "anonymous", user: null });
        }),
    };
});
// E6/T015 — ContaPage now reads the router (checkout=retorno takeover); stub it so the page
// renders outside a RouterProvider (the house pattern, bom-teaser.test).
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn(), useSearch: () => ({}) };
});

import { messages } from "@/shared/i18n/messages.pt-br";
import { signOutUser, useSessionStore } from "@/shared/session/session-store";
import { THEME_STORAGE_KEY, useThemeStore } from "@/shared/ui";

import { AccountPage } from "./account-page";

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function renderAccount() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(
        <QueryClientProvider client={client}>
            <AccountPage />
        </QueryClientProvider>,
    );
}

type MeBody = { uid: string; email?: string | null };
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubMeSuccess(body: MeBody) {
    const fetchMock = vi.fn<FetchFn>(() =>
        Promise.resolve(
            new Response(JSON.stringify(body), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function stubMeStatus(status: number, envelope: unknown) {
    const fetchMock = vi.fn<FetchFn>(() =>
        Promise.resolve(
            new Response(JSON.stringify(envelope), {
                status,
                headers: { "content-type": "application/json", "X-Correlation-Id": "corr-conta" },
            }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function stubMeNetworkError() {
    const fetchMock = vi.fn<FetchFn>(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "dark";
    useThemeStore.setState({ theme: "dark" });
    // Authenticated session whose CLIENT email deliberately differs from the /me email,
    // so a passing identity assertion can only come from the server response (A23). A `uid`
    // is present because the /me query is now keyed by it (D1) and stays disabled without one.
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "session-uid", email: "old-session@client.invalid" } as never,
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

// ---- T056 / US5 — server-confirmed identity + static plan ------------------------
describe("ContaPage identity from /api/v1/me (T056 / A23)", () => {
    it("renders the email + avatar initial from the SERVER response, not the client session", async () => {
        const fetchMock = stubMeSuccess({ uid: "srv-uid-123", email: "zeca@precifica.dev" });
        renderAccount();

        expect(await screen.findByText("zeca@precifica.dev")).toBeInTheDocument();
        // avatar initial derived from the server identity label
        expect(screen.getByText("Z", { exact: true })).toBeInTheDocument();
        // proof the identity came off the wire (/me), not a hardcoded/session value
        expect(fetchMock).toHaveBeenCalled();
        expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/v1/me");
        expect(screen.queryByText("old-session@client.invalid")).not.toBeInTheDocument();
    });

    it("shows a static, display-only 'Gratuito' plan indicator", async () => {
        stubMeSuccess({ uid: "srv-uid-123", email: "zeca@precifica.dev" });
        renderAccount();

        await screen.findByText("zeca@precifica.dev");
        expect(screen.getByText(messages.account.planFree)).toBeInTheDocument();
    });
});

// ---- T068 / A23 — identity failure routing ---------------------------------------
describe("ContaPage identity failure states (T068 / A23)", () => {
    it("routes a 401/expired session through the ErrorCode→pt-BR session message", async () => {
        stubMeStatus(401, {
            error: { code: "TOKEN_EXPIRED", message: "expired", correlationId: "corr-conta" },
        });
        renderAccount();

        expect(await screen.findByText(messages.apiError.tokenExpired)).toBeInTheDocument();
    });

    it("shows an identity error state with 'Tentar novamente' on a network/server failure", async () => {
        const fetchMock = stubMeNetworkError();
        renderAccount();

        const retry = await screen.findByRole("button", { name: messages.account.retry });
        expect(retry).toBeInTheDocument();
        // it does NOT fabricate a fallback identity
        expect(screen.queryByText("zeca@precifica.dev")).not.toBeInTheDocument();

        const calls = fetchMock.mock.calls.length;
        await setup().click(retry);
        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
    });
});

// ---- T057 / US5 — theme Switch + sign-out re-guard -------------------------------
describe("ContaPage theme Switch + sign-out (T057)", () => {
    it("toggles the theme via the labelled Switch and persists the choice", async () => {
        stubMeSuccess({ uid: "srv-uid-123", email: "zeca@precifica.dev" });
        renderAccount();
        await screen.findByText("zeca@precifica.dev");

        const sw = screen.getByRole("switch");
        // dark is the default → the "dark theme" switch is on
        expect(sw).toBeChecked();

        await setup().click(sw);

        expect(useThemeStore.getState().theme).toBe("light");
        expect(document.documentElement.dataset.theme).toBe("light");
        await waitFor(() => {
            const raw = localStorage.getItem(THEME_STORAGE_KEY);
            expect(raw).toBeTruthy();
            expect(JSON.parse(raw!).state.theme).toBe("light");
        });
    });

    it("signs the user out (back to anonymous) and re-guards the saving tabs", async () => {
        stubMeSuccess({ uid: "srv-uid-123", email: "zeca@precifica.dev" });
        renderAccount();
        await screen.findByText("zeca@precifica.dev");

        await setup().click(screen.getByRole("button", { name: messages.account.signOut }));

        expect(signOutUser).toHaveBeenCalled();
        // Sign-out returns the app to the signed-out state. That `anonymous` status is what
        // re-guards the saving tabs: GC-2 (anonymous → /sign-in for /catalogo, /historico,
        // /conta) is proven end to end in `app/router.guards.test.tsx` (T034) — asserting it
        // here would require a forbidden pages→app import (FSD boundary).
        expect(useSessionStore.getState().status).toBe("anonymous");
    });
});

// ---- D1 — identity isolation across users on a SHARED QueryClient --------------------
// Regression for the cross-user identity leak: the real app has ONE QueryClient (app/
// providers) whose cache survives navigation across sign-out/sign-in. With a constant
// ["me"] key, a re-login as user B within staleTime would read user A's cached identity.
// The /me query is now keyed by the signed-in uid, so B gets a distinct cache entry.
describe("ContaPage identity isolation across users (D1)", () => {
    it("shows B's email after A→logout→B on a shared client, never A's cached identity", async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const renderShared = () =>
            render(
                <QueryClientProvider client={client}>
                    <AccountPage />
                </QueryClientProvider>,
            );

        // The /me email is tied to the signed-in user; the mock answers with the CURRENT body,
        // which we swap between the two sign-ins (uid drives the query key, not the response).
        let meBody: MeBody = { uid: "uid-A", email: "ana@precifica.dev" };
        const fetchMock = vi.fn<FetchFn>(() =>
            Promise.resolve(
                new Response(JSON.stringify(meBody), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        // --- User A signs in ---
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "uid-A", email: "ana@client.invalid" } as never,
        });
        const a = renderShared();
        expect(await screen.findByText("ana@precifica.dev")).toBeInTheDocument();
        a.unmount(); // navigate away — the shared cache survives (default gcTime)

        // --- Sign out ---
        useSessionStore.setState({ status: "anonymous", user: null });

        // --- User B signs in (different uid + email) ---
        meBody = { uid: "uid-B", email: "bruno@precifica.dev" };
        useSessionStore.setState({
            status: "authenticated",
            user: { uid: "uid-B", email: "bruno@client.invalid" } as never,
        });
        renderShared();

        expect(await screen.findByText("bruno@precifica.dev")).toBeInTheDocument();
        // NEVER A's identity — and a fresh fetch fired for B (not served from A's stale cache).
        expect(screen.queryByText("ana@precifica.dev")).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
