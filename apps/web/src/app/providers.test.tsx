// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }));
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k: string) => idbStore.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    idbStore.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    idbStore.delete(k);
  }),
}));

import { historyOutboxKey } from "@/entities/history/outbox";
import { useSessionStore } from "@/shared/session/session-store";

import { AppProviders } from "./providers";

// 009 (E4, PR-A) — B3, written FAILING-first. The app-layer subscription sweeps uid-keyed stores on
// any transition to `anonymous`. That is a privacy guarantee for READ caches (rebuildable), but the
// OUTBOX is the ONLY copy of a quote that never reached the account — and this subscription ALSO
// fires on transitions the sign-out guard never mediated (a revoked token auto-signs-out the SDK).
// Purging the outbox here would silently destroy the seller's work (ADR-0018 §10). The uid key keeps
// it from leaking cross-account, so it is retained; only the guard's explicit discard purges it.

beforeEach(() => {
  vi.clearAllMocks();
  idbStore.clear();
  useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

describe("an INVOLUNTARY sign-out never destroys the only copy of a quote", () => {
  it("retains the uid-keyed outbox while still sweeping the rebuildable read caches", async () => {
    idbStore.set(historyOutboxKey("u1"), [{ clientSnapshotId: "a" }]);
    idbStore.set("entitlement:u1", { status: "active" });

    render(
      <AppProviders>
        <div />
      </AppProviders>,
    );

    // A token revocation flips the SDK to anonymous WITHOUT passing through requestSignOut/the guard.
    await act(async () => {
      useSessionStore.setState({ status: "anonymous", user: null });
      await Promise.resolve();
    });

    // The rebuildable read cache IS swept (privacy) — proof the sweep ran at all.
    await waitFor(() => expect(idbStore.has("entitlement:u1")).toBe(false));
    // The outbox — the ONLY copy of an unsynced quote — survives. Its uid key prevents any leak.
    expect(idbStore.has(historyOutboxKey("u1"))).toBe(true);
  });
});
