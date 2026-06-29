import { type User, onIdTokenChanged } from "firebase/auth";
import { create } from "zustand";

import { auth } from "@/shared/lib/firebase";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "not-configured";

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

// Auth store fed by Firebase onIdTokenChanged (FR-C5.4). No product route consumes it yet.
export const useAuthStore = create<AuthState>(() => ({
  status: auth ? "loading" : "not-configured",
  user: null,
}));

export function initAuthListener(): void {
  if (!auth) return;
  onIdTokenChanged(auth, (user) => {
    useAuthStore.setState({ user, status: user ? "authenticated" : "anonymous" });
  });
}
