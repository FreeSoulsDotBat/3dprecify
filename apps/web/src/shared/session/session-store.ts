import {
    type Auth,
    GoogleAuthProvider,
    type User,
    onIdTokenChanged,
    signInWithPopup,
    signOut,
} from "firebase/auth";
import { create } from "zustand";

import { auth } from "@/shared/lib/firebase";
import { clearSessionExpired } from "@/shared/session/session-expiry";

// Cross-cutting auth session (FR-C5.4). Lives in `shared` because the router guard, the sign-in
// feature, and the app shell all read it; feature screens depend on it via shared, never via each
// other (FSD-Lite boundary). The auth *feature* owns only the sign-in UI.
export type SessionStatus = "loading" | "authenticated" | "anonymous" | "not-configured";

interface SessionState {
    status: SessionStatus;
    user: User | null;
}

export const useSessionStore = create<SessionState>(() => ({
    status: auth ? "loading" : "not-configured",
    user: null,
}));

// E6/T016 (coordinator-reported HIGH defect): Firebase can emit a TRANSIENT pre-restore callback
// (`onIdTokenChanged(null)`) before a persisted session finishes loading from IndexedDB (measured
// against the Auth emulator). Subscribing immediately — the old behaviour — let that premature
// callback flip `status` straight to "anonymous", which satisfies `main.tsx`'s "loading" gate and
// lets a route guard redirect a REAL signed-in seller to /sign-in before Firebase genuinely knows
// the answer (a cold navigation, exactly what an external redirect-back does).
//
// The fix: never leave "loading" until `auth.authStateReady()` — which resolves ONLY once
// persistence has genuinely settled — has returned. The listener itself is not even attached
// until then, so it structurally cannot react to the transient callback; `authStateReady()`'s own
// promise settling is what supplies the FIRST honest answer, read straight off `auth.currentUser`.
//
// `bootFromAuth` takes the `Auth` handle as a parameter (rather than reading the module-level
// `auth` singleton) purely for testability — `session-store.test.ts` drives it with a fake handle
// with no need to mock `@/shared/lib/firebase`'s module-init-time singleton. Production code only
// ever calls it through `initSessionListener()`.
export async function bootFromAuth(authInstance: Auth): Promise<void> {
    await authInstance.authStateReady();
    const initialUser = authInstance.currentUser;
    useSessionStore.setState({
        user: initialUser,
        status: initialUser ? "authenticated" : "anonymous",
    });
    onIdTokenChanged(authInstance, (user) => {
        useSessionStore.setState({ user, status: user ? "authenticated" : "anonymous" });
        // hotfix 016/A3 (H5) — the seller signing back in (even through a different tab/flow) is the
        // OTHER way the session-expired marker clears, mirroring `transport.ts`'s "first success" clear.
        if (user) clearSessionExpired();
    });
}

export async function initSessionListener(): Promise<void> {
    if (!auth) return;
    await bootFromAuth(auth);
}

// Google sign-in (One Tap / popup on web). No-op when Firebase is not configured.
export async function signInWithGoogle(): Promise<void> {
    if (!auth) return;
    await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
    if (!auth) return;
    await signOut(auth);
}
