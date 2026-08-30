import { type CurrentUser } from "@/shared/api/generated";

// Read-only identity view-model (decision A23). Its source of truth is the
// server-confirmed `/api/v1/me` RESPONSE (`CurrentUser` in the generated client),
// NOT the client Firebase session object — so the shell renders identity the
// server actually acknowledged. It carries NO `plan`/entitlement field in this
// slice (Principle IV; the Conta plan indicator is a static "Gratuito" label).
//
// This module defines the types + selectors now; the live fetch through the T067
// transport wrapper is wired in T068 (US5). The `/me` wire shape currently carries
// only `uid` + `email` (no `displayName`), so the display label falls back to the
// email — see data-model E1.

export interface UserIdentity {
  uid: string;
  email: string | null;
}

/** Map the server `/me` response onto the read-only identity view-model. */
export function toUserIdentity(me: CurrentUser): UserIdentity {
  return { uid: me.uid, email: me.email ?? null };
}

/** Short, safe label for account chrome / Conta (email, else the opaque uid). */
export function identityLabel(identity: UserIdentity): string {
  return identity.email ?? identity.uid;
}
