// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncMock, useSyncOutboxMock, useEntitlementMock } = vi.hoisted(() => ({
    syncMock: vi.fn(),
    useSyncOutboxMock: vi.fn(),
    useEntitlementMock: vi.fn(),
}));
vi.mock("@/entities/history/use-history", () => ({ useSyncOutbox: useSyncOutboxMock }));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));

import { useSessionStore } from "@/shared/session/session-store";

import { OutboxSyncer } from "./outbox-syncer";

// 009 (E4, PR-A) — the four event triggers of ADR-0018 §7. `focus`/`visibilitychange` were the two
// missing ones (review PR-A, M5): without them a captive-portal reconnection (navigator.onLine stays
// true, so no `online` event) never drains in-session, while the toast promises it syncs itself.

beforeEach(() => {
    vi.clearAllMocks();
    useSyncOutboxMock.mockReturnValue({ sync: syncMock, syncing: false });
    useEntitlementMock.mockReturnValue({ data: { status: "active" } });
    useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

afterEach(() => cleanup());

describe("OutboxSyncer drains on all four triggers", () => {
    it("drains on mount (boot / sign-in)", () => {
        render(<OutboxSyncer />);
        expect(syncMock).toHaveBeenCalled();
    });

    it("drains on `online` (reconnect)", () => {
        render(<OutboxSyncer />);
        syncMock.mockClear();
        window.dispatchEvent(new Event("online"));
        expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it("drains on window `focus` (review PR-A, M5)", () => {
        render(<OutboxSyncer />);
        syncMock.mockClear();
        window.dispatchEvent(new Event("focus"));
        expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it("drains when the tab becomes visible (review PR-A, M5)", () => {
        render(<OutboxSyncer />);
        syncMock.mockClear();
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it("does NOT drain while the tab is merely hidden", () => {
        render(<OutboxSyncer />);
        syncMock.mockClear();
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(syncMock).not.toHaveBeenCalled();
    });
});
