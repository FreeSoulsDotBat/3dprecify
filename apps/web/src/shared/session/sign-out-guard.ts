import { signOutUser } from "./session-store";

// 009/T011 (E4, PR-A) — THE SIGN-OUT SEAM (ADR-0018 §10).
//
// Until E4, signing out was a pure action: it dropped uid-keyed READ caches, and a read cache can
// always be rebuilt from the server. The outbox breaks that: it is the ONLY copy of a quote that
// never reached the account, and the purge-on-sign-out privacy guarantee (a shared device must not
// keep the previous account's data) destroys it. Both properties are right; only the seller can
// decide between them, so sign-out has to become interruptible.
//
// The interception point lives HERE, in `shared`, for a structural reason: FSD-Lite forbids `shared`
// importing `entities/history`, so the queue check cannot live inside the sign-out function itself.
// `shared` therefore exposes the seam and the app shell — the one layer allowed to see features —
// registers what to ask. The alternative (each call site checking the queue before signing out) is
// precisely the hole this closes: `signOutUser()` has two call sites today, and the third one added
// next month would silently skip the check.

/** Runs before sign-out. `true` ⇒ proceed; `false` ⇒ the seller went back, stay signed in. */
export type SignOutGuard = () => Promise<boolean>;

let guard: SignOutGuard | null = null;

/** Install the guard (app shell, on mount). Returns its unregister — an unmounted guard must never
 *  keep blocking sign-out. */
export function registerSignOutGuard(next: SignOutGuard | null): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}

/**
 * The ONLY sign-out entry point the UI may call. `signOutUser()` is the raw Firebase call and is
 * now reserved for the guard's own "yes, sign out" path.
 */
export async function requestSignOut(): Promise<void> {
  if (guard && !(await guard())) return;
  await signOutUser();
}
