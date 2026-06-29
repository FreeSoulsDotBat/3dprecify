import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { signInWithGoogle, useSessionStore } from "@/shared/session/session-store";

// US1 sign-in screen: Google sign-in is the only entry point. Anonymous users land here via the
// router guard; on success, the session listener flips status to "authenticated" and the guard on
// /sign-in redirects them to the calculator.
export function SignInScreen() {
  const status = useSessionStore((s) => s.status);
  const [error, setError] = useState(false);
  const configured = status !== "not-configured";

  async function handleSignIn() {
    setError(false);
    try {
      await signInWithGoogle();
    } catch {
      setError(true);
    }
  }

  return (
    <section className="mx-auto flex max-w-sm flex-col gap-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--color-accent)" }}>
        {messages.signIn.title}
      </h1>
      <p style={{ color: "var(--color-muted)" }}>{messages.signIn.subtitle}</p>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={!configured}
        className="rounded border px-4 py-2 font-medium disabled:opacity-50"
      >
        {messages.signIn.google}
      </button>
      {!configured && (
        <p role="note" style={{ color: "var(--color-muted)" }}>
          {messages.signIn.notConfigured}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--color-danger)" }}>
          {messages.signIn.error}
        </p>
      )}
    </section>
  );
}
