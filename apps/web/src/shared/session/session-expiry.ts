import { create } from "zustand";

// hotfix 016/A3 (H5, 2026-08-07) — THE CAMINHO DE VOLTA when the SERVER refuses a live client
// session (a 401 with a real session-expired code) — the second half of the diagnosis the outbox's
// `unauthenticated` state (H4) already covers on its own surface. `router.tsx` already redirects to
// `/sign-in` when the CLIENT (Firebase) session dies; a 401 with a client session that is still
// alive moves no screen at all — that is the "nenhuma tela oferece caminho de volta" the T072
// homologação found.
//
// A store this small and this dumb is the whole point: it knows ONE bit (expired or not) and NOTHING
// about auth. It cannot call `requestSignOut` because it never imports `shared/session/sign-out-guard`
// — and it cannot call `purgeOutbox` because `shared` is FORBIDDEN from importing `entities/history`
// (FSD-Lite boundary, enforced by eslint-boundaries). The non-negotiable property of this hotfix slice
// — **a 401 NEVER signs the seller out** — is not a promise this file keeps by discipline; it is a
// promise the import graph makes impossible to break from here.
//
// Marked by `transport.ts` on a 401 whose `code` is a genuine session-expiry code (never a bare 401 —
// ENTITLEMENT_REQUIRED is also a 401-adjacent-but-different-story 403, and even within 401 the wire
// could in principle carry an unrelated code some day). Cleared on the first request that succeeds
// again, or the instant the session-store itself reports `authenticated` (the seller signed back in
// through a DIFFERENT tab/flow) — whichever comes first.

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
