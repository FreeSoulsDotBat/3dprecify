import { create } from "zustand";

// ⚠ @doc DEC-007 — um 401 NUNCA desloga o vendedor, e não por disciplina: esta store não importa
//   `sign-out-guard` nem `entities/history`, então daqui é impossível deslogar ou purgar.

interface SessionExpiryState {
    expired: boolean;
}

const useSessionExpiryStore = create<SessionExpiryState>(() => ({ expired: false }));

/** `transport.ts` calls this on a 401 whose code says the SESSION (not entitlement) is the problem. */
export function markSessionExpired(): void {
    useSessionExpiryStore.setState({ expired: true });
}

/** Any successful request, or `session-store` reporting `authenticated` again, clears the marker. */
export function clearSessionExpired(): void {
    useSessionExpiryStore.setState({ expired: false });
}

/** The banner (`app-shell`) reads this — the only consumer. */
export function useSessionExpired(): boolean {
    return useSessionExpiryStore((s) => s.expired);
}

/** Test-only direct read (mirrors the pattern other minimal stores in this module use). */
export function isSessionExpired(): boolean {
    return useSessionExpiryStore.getState().expired;
}
