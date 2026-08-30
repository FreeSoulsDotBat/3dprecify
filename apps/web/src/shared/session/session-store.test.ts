// @vitest-environment jsdom
import { type Auth, type User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// E6/T016 (coordinator-reported HIGH defect, root cause #2). Firebase can emit a TRANSIENT
// pre-restore callback before the persisted session finishes loading (measured against the Auth
// emulator) — the OLD `initSessionListener` subscribed `onIdTokenChanged` immediately and let that
// first callback (however premature) flip `status` straight to "anonymous"/"authenticated",
// exiting `main.tsx`'s "loading" gate before Firebase genuinely knew the answer. A cold navigation
// to a guarded route during that window then bounced to /sign-in and back — for an already
// signed-in seller.
//
// Fix under test: `status` MUST NOT leave "loading" until `auth.authStateReady()` resolves — the
// listener attaches (and any status flip happens) only after persistence has genuinely settled.
// `bootFromAuth` takes the `Auth` handle as a parameter (session-store.ts), so this suite drives it
// with a fake handle directly — no need to mock the `@/shared/lib/firebase` module-init singleton.

const { onIdTokenChangedMock } = vi.hoisted(() => ({ onIdTokenChangedMock: vi.fn() }));
vi.mock("firebase/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/auth")>();
  return {
    ...actual,
    onIdTokenChanged: (...args: Parameters<typeof actual.onIdTokenChanged>) =>
      onIdTokenChangedMock(...args),
  };
});

import { bootFromAuth, initSessionListener, useSessionStore } from "./session-store";

const fakeUser = { uid: "u1", email: "u1@example.dev" } as unknown as User;

function makeFakeAuth() {
  let resolveReady: () => void = () => {};
  const readyPromise = new Promise<void>((res) => {
    resolveReady = res;
  });
  const fakeAuth = {
    currentUser: null as User | null,
    authStateReady: vi.fn(() => readyPromise),
  } as unknown as Auth;
  return { fakeAuth, settleReady: () => resolveReady() };
}

beforeEach(() => {
  useSessionStore.setState({ status: "loading", user: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("bootFromAuth — boot gate on authStateReady() (E6/T016)", () => {
  it("status stays 'loading' until authStateReady() resolves, even with a real persisted user", async () => {
    const { fakeAuth, settleReady } = makeFakeAuth();

    const booting = bootFromAuth(fakeAuth);

    // Still loading — authStateReady() has not resolved, and (the fix) the listener has not
    // even attached yet, so no premature callback can flip the status.
    expect(useSessionStore.getState().status).toBe("loading");
    expect(onIdTokenChangedMock).not.toHaveBeenCalled();

    // Firebase finishes restoring the persisted session — currentUser is now the real seller.
    (fakeAuth as unknown as { currentUser: User | null }).currentUser = fakeUser;
    settleReady();
    await booting;

    expect(useSessionStore.getState().status).toBe("authenticated");
    expect(useSessionStore.getState().user).toBe(fakeUser);
    // The listener DOES attach once ready, for future sign-in/out transitions.
    expect(onIdTokenChangedMock).toHaveBeenCalledTimes(1);
  });

  it("settles to 'anonymous' (not stuck loading) when there truly is no persisted session", async () => {
    const { fakeAuth, settleReady } = makeFakeAuth();

    const booting = bootFromAuth(fakeAuth);
    settleReady();
    await booting;

    expect(useSessionStore.getState().status).toBe("anonymous");
    expect(useSessionStore.getState().user).toBeNull();
  });

  it("a later onIdTokenChanged callback (real sign-out) still updates status normally", async () => {
    const { fakeAuth, settleReady } = makeFakeAuth();
    (fakeAuth as unknown as { currentUser: User | null }).currentUser = fakeUser;

    const booting = bootFromAuth(fakeAuth);
    settleReady();
    await booting;
    expect(useSessionStore.getState().status).toBe("authenticated");

    // Simulate a real subsequent sign-out via the (now-attached) listener callback.
    const callback = onIdTokenChangedMock.mock.calls[0]![1] as (u: User | null) => void;
    callback(null);
    expect(useSessionStore.getState().status).toBe("anonymous");
  });
});

describe("initSessionListener — no-op when Firebase is not configured (E6/T016)", () => {
  it("never touches the listener or the store when `auth` is null (the vitest env has no Firebase config)", async () => {
    await initSessionListener();
    // Unconfigured in this environment (no VITE_FIREBASE_* set) — the guard exits before
    // touching authStateReady/onIdTokenChanged; status is left exactly as the caller set it.
    expect(onIdTokenChangedMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("loading");
  });
});
