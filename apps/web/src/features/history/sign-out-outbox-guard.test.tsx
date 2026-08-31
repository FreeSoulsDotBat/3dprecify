// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` is load-bearing: the static import of the sign-out seam below pulls in the mocked
// session-store during module init, i.e. BEFORE plain top-level consts have been assigned.
const { signOutUser, listOutbox, purgeOutbox, drainOutbox } = vi.hoisted(() => ({
    signOutUser: vi.fn(async () => {}),
    listOutbox: vi.fn(),
    purgeOutbox: vi.fn(async () => {}),
    drainOutbox: vi.fn(async () => {}),
}));

vi.mock("@/shared/session/session-store", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/session/session-store")>();
    return { ...actual, signOutUser };
});

vi.mock("@/entities/history/outbox", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/history/outbox")>();
    return { ...actual, listOutbox, purgeOutbox, drainOutbox };
});

import type { OutboxEntry } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { requestSignOut } from "@/shared/session/sign-out-guard";
import { useSessionStore } from "@/shared/session/session-store";

import { SignOutOutboxGuard } from "./sign-out-outbox-guard";

// 009/T011 (E4, PR-A) — the sign-out guard, written FAILING-first (ADR-0018 §10).
//
// Sign-out purges the uid-keyed stores, and the outbox is now one of them. That purge is a PRIVACY
// guarantee we already shipped (a shared device must not keep the previous account's data), so it
// cannot simply be dropped — but it now destroys the ONLY copy of a quote that never reached the
// account. Both things are true at once, so the seller has to be the one who decides.
//
// The dialog is BLOCKING and states the count. Never a toast after the fact — that is a silent drop
// with a receipt.

const entry = (id: string): OutboxEntry =>
    ({
        clientSnapshotId: id,
        body: { clientSnapshotId: id, kind: "SINGLE" },
        syncState: "pending",
        attempts: 0,
    }) as OutboxEntry;

function setOnline(online: boolean) {
    Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

// The guard now reads `useQueryClient` (M10 — it invalidates the merged list after a drain), so it
// must render inside a provider. `client` is exposed so the M10 test can spy on `invalidateQueries`.
let client: QueryClient;
function renderGuard() {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <SignOutOutboxGuard />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    listOutbox.mockResolvedValue([]);
    useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

afterEach(() => cleanup());

describe("an EMPTY queue never gets in the way", () => {
    it("signs out straight away, with no dialog", async () => {
        renderGuard();

        await requestSignOut();

        expect(signOutUser).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});

describe("a NON-EMPTY queue blocks sign-out and says exactly what is at stake", () => {
    beforeEach(() => {
        listOutbox.mockResolvedValue([entry("a"), entry("b")]);
    });

    it("stops the sign-out and states the count", async () => {
        renderGuard();

        void requestSignOut();

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText(/2 registro/)).toBeInTheDocument();
        expect(screen.getByText(messages.historico.signOutQueueBody)).toBeInTheDocument();
        expect(signOutUser).not.toHaveBeenCalled();
    });

    it("Voltar keeps the seller signed in — and keeps every record", async () => {
        const user = setup();
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        await user.click(screen.getByRole("button", { name: messages.historico.back }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(signOutUser).not.toHaveBeenCalled();
        expect(purgeOutbox).not.toHaveBeenCalled();
    });

    it("discarding is DESTRUCTIVE and asks a second time before it happens", async () => {
        const user = setup();
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        await user.click(screen.getByRole("button", { name: messages.historico.signOutDiscard }));

        // Not yet — the first click only escalates to the explicit confirm.
        expect(signOutUser).not.toHaveBeenCalled();
        expect(purgeOutbox).not.toHaveBeenCalled();
        expect(
            await screen.findByText(messages.historico.signOutDiscardConfirmBody),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: messages.historico.signOutDiscardConfirm }),
        );

        await waitFor(() => expect(signOutUser).toHaveBeenCalledTimes(1));
        expect(purgeOutbox).toHaveBeenCalledWith("u1");
    });

    it("OFFLINE: 'Sincronizar agora' is disabled, with the reason on screen — never a button that pretends", async () => {
        setOnline(false);
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        expect(
            screen.getByRole("button", { name: messages.historico.signOutSyncNow }),
        ).toBeDisabled();
        expect(screen.getByText(messages.historico.signOutSyncOffline)).toBeInTheDocument();
    });

    it("'Sincronizar agora' drains, and signs out once the queue is really empty", async () => {
        const user = setup();
        drainOutbox.mockImplementation(async () => {
            listOutbox.mockResolvedValue([]);
        });
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        await user.click(screen.getByRole("button", { name: messages.historico.signOutSyncNow }));

        await waitFor(() => expect(signOutUser).toHaveBeenCalledTimes(1));
        expect(drainOutbox).toHaveBeenCalledTimes(1);
        // Nothing was discarded — every record reached the account.
        expect(purgeOutbox).not.toHaveBeenCalled();
    });

    it("a PARTIAL sync says so and keeps the seller in — it never signs out over records left behind", async () => {
        const user = setup();
        drainOutbox.mockImplementation(async () => {
            listOutbox.mockResolvedValue([entry("b")]);
        });
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        await user.click(screen.getByRole("button", { name: messages.historico.signOutSyncNow }));

        expect(
            await screen.findByText(messages.historico.signOutPartial.replace("{n}", "1")),
        ).toBeInTheDocument();
        expect(signOutUser).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("M10 — syncNow invalidates the merged list so a partial sync stops stamping 'Pendente' (review PR-A)", async () => {
        const user = setup();
        drainOutbox.mockImplementation(async () => {
            listOutbox.mockResolvedValue([entry("b")]);
        });
        renderGuard();
        const spy = vi.spyOn(client, "invalidateQueries");
        void requestSignOut();
        await screen.findByRole("dialog");

        await user.click(screen.getByRole("button", { name: messages.historico.signOutSyncNow }));

        await waitFor(() => expect(spy).toHaveBeenCalled());
        const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey ?? []));
        expect(keys.some((k) => k.includes("snapshots"))).toBe(true);
        expect(keys.some((k) => k.includes("outbox"))).toBe(true);
    });

    it("C6 — a dialog opened OFFLINE re-enables Sincronizar when the network returns (review PR-A)", async () => {
        setOnline(false);
        renderGuard();
        void requestSignOut();
        await screen.findByRole("dialog");

        // Frozen `navigator.onLine` would leave this disabled forever, with only "Sair e descartar".
        expect(
            screen.getByRole("button", { name: messages.historico.signOutSyncNow }),
        ).toBeDisabled();

        await waitFor(() => {
            setOnline(true);
            window.dispatchEvent(new Event("online"));
            expect(
                screen.getByRole("button", { name: messages.historico.signOutSyncNow }),
            ).toBeEnabled();
        });
    });
});
