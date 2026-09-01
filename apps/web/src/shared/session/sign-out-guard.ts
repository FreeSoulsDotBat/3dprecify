import { signOutUser } from "./session-store";

// ⚠ @doc DEC-038 — sair é INTERROMPÍVEL: o outbox é a única cópia de um orçamento que não
//   chegou à conta, e a purga por privacidade o destrói. A costura mora aqui porque `shared`
//   não pode importar `entities/history` — e checar em cada chamador seria o buraco.

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
