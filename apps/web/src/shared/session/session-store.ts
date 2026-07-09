import {
  GoogleAuthProvider,
  type User,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { create } from "zustand";

import { auth } from "@/shared/lib/firebase";

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

export function initSessionListener(): void {
  if (!auth) return;
  onIdTokenChanged(auth, (user) => {
    useSessionStore.setState({ user, status: user ? "authenticated" : "anonymous" });
  });
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
