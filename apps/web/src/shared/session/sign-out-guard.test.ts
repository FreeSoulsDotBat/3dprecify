import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutUser = vi.fn(async () => {});
vi.mock("./session-store", () => ({ signOutUser }));

const { registerSignOutGuard, requestSignOut } = await import("./sign-out-guard");

// 009/T011 (E4, PR-A) — THE SIGN-OUT SEAM, written FAILING-first.
//
// Sign-out purges every uid-keyed store on the device, and from this slice on that INCLUDES the
// outbox — the only copy of a not-yet-synced quote. So sign-out is no longer a pure action: it can
// destroy the seller's data, and something must be able to stop it and ask.
//
// The seam lives in `shared/session` for one structural reason: FSD-Lite forbids `shared` importing
// `entities/history`, so the queue check CANNOT live inside the sign-out function itself. Instead
// `shared` exposes an interception point and the app shell — which may import features — registers
// what to do. The alternative (each call site checking the queue first) is exactly the hole this
// prevents: `signOutUser()` has TWO call sites today, and a third one added tomorrow would silently
// skip the check.

beforeEach(() => {
    vi.clearAllMocks();
    registerSignOutGuard(null);
});

describe("requestSignOut — the only sign-out entry point the UI may call", () => {
    it("signs out directly when no guard is registered", async () => {
        await requestSignOut();
        expect(signOutUser).toHaveBeenCalledTimes(1);
    });

    it("signs out when the guard allows it", async () => {
        registerSignOutGuard(async () => true);
        await requestSignOut();
        expect(signOutUser).toHaveBeenCalledTimes(1);
    });

    it("does NOT sign out when the guard refuses — the seller went back", async () => {
        registerSignOutGuard(async () => false);
        await requestSignOut();
        expect(signOutUser).not.toHaveBeenCalled();
    });

    it("asks the guard BEFORE signing out — never after the purge already ran", async () => {
        const order: string[] = [];
        signOutUser.mockImplementation(async () => {
            order.push("signOut");
        });
        registerSignOutGuard(async () => {
            order.push("guard");
            return true;
        });

        await requestSignOut();

        expect(order).toEqual(["guard", "signOut"]);
    });

    it("unregisters cleanly, so an unmounted guard never blocks sign-out forever", async () => {
        const unregister = registerSignOutGuard(async () => false);
        unregister();

        await requestSignOut();

        expect(signOutUser).toHaveBeenCalledTimes(1);
    });
});
