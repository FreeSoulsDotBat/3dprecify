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

// ⚠ @doc DEC-028 — o listener não é anexado antes do `authStateReady()`: assim ele não CONSEGUE
//   reagir ao callback transitório que mandava um vendedor logado para /sign-in.
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
