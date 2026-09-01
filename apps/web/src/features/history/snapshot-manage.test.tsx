// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateLabelMock, deleteMock, navigateMock, entitlement } = vi.hoisted(() => ({
    updateLabelMock: vi.fn(),
    deleteMock: vi.fn(),
    navigateMock: vi.fn(),
    entitlement: { data: undefined as { status: string } | undefined },
}));
vi.mock("@/entities/history/use-history", () => ({
    useUpdateLabel: () => ({ mutateAsync: updateLabelMock, isPending: false }),
    useDeleteSnapshot: () => ({ mutateAsync: deleteMock, isPending: false }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => entitlement }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }));

import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Toaster, useToastStore } from "@/shared/ui";

import { SnapshotManageActions } from "./snapshot-manage";

// 009/T021 (E4, PR-B, US6) — manage a snapshot: rename + delete, written FAILING-first.
//
// Two invariants: (1) the label is the ONE mutable field — nothing else on the document is editable
// (ADR-0019); (2) managing is a WRITE, so it is offered ONLY on an ACTIVE premium and ONLY for a
// SYNCED record (a pending record has no server id to PATCH/DELETE — it is removed via the outbox).

const t = messages.history;

function syncedItem(over: Partial<HistoryItem> = {}): HistoryItem {
    return {
        id: "s1",
        clientSnapshotId: "csid-1",
        kind: "SINGLE",
        label: "Cliente João",
        headlineTotal: "275.00",
        headlineBasis: "PRECO_VAREJO",
        deviceQuotedAt: "2026-07-12T19:30:00Z",
        syncState: "synced",
        snapshot: { id: "srv-1", clientSnapshotId: "csid-1", label: "Cliente João" },
        entry: null,
        ...over,
    } as HistoryItem;
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    entitlement.data = { status: "active" };
    updateLabelMock.mockResolvedValue({});
    deleteMock.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

function renderActions(item: HistoryItem = syncedItem()) {
    return render(
        <>
            <SnapshotManageActions item={item} />
            <Toaster />
        </>,
    );
}

describe("rename — the label, and only the label", () => {
    it("edits the label by SERVER id, prefilled with the current one", async () => {
        const user = setup();
        renderActions();

        await user.click(screen.getByRole("button", { name: t.editLabel }));
        const input = await screen.findByLabelText(t.labelField);
        expect(input).toHaveValue("Cliente João"); // prefilled
        await user.clear(input);
        await user.type(input, "Cliente Maria");
        await user.click(screen.getByRole("button", { name: t.editLabelSave }));

        await waitFor(() => expect(updateLabelMock).toHaveBeenCalledTimes(1));
        expect(updateLabelMock).toHaveBeenCalledWith({ id: "srv-1", label: "Cliente Maria" });
    });

    it("a cleared label is sent as null, never an empty string", async () => {
        const user = setup();
        renderActions();

        await user.click(screen.getByRole("button", { name: t.editLabel }));
        await user.clear(await screen.findByLabelText(t.labelField));
        await user.click(screen.getByRole("button", { name: t.editLabelSave }));

        await waitFor(() =>
            expect(updateLabelMock).toHaveBeenCalledWith({ id: "srv-1", label: null }),
        );
    });
});

describe("delete — confirmed, then gone", () => {
    it("confirms, deletes by SERVER id, and returns to the list", async () => {
        const user = setup();
        renderActions();

        await user.click(screen.getByRole("button", { name: t.deleteAction }));
        // A confirm step — never a one-tap destructive action.
        expect(await screen.findByText(t.deleteBody)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: t.deleteConfirm }));

        await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("srv-1"));
        expect(navigateMock).toHaveBeenCalledWith({ to: "/historico" });
    });
});

describe("the gate — a WRITE needs an active premium and a synced record", () => {
    it("is absent for a PENDING record (no server id to PATCH/DELETE)", () => {
        renderActions(syncedItem({ syncState: "pending", id: null, snapshot: null }));
        expect(screen.queryByRole("button", { name: t.editLabel })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: t.deleteAction })).not.toBeInTheDocument();
    });

    it("is absent on a lapsed premium (reading stays open; the banner explains renaming/deleting)", () => {
        entitlement.data = { status: "lapsed" };
        renderActions();
        expect(screen.queryByRole("button", { name: t.editLabel })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: t.deleteAction })).not.toBeInTheDocument();
    });
});
