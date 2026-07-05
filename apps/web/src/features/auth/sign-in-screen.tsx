import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { signInWithGoogle, useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, Card, Logo } from "@/shared/ui";

type SignInState = "idle" | "submitting" | "error" | "offline";

// A33 Phase 1: Firebase raises `auth/network-request-failed` when the network is
// unreachable. We surface a specific offline line for that case; every other failure
// keeps the generic retry message.
function isOfflineAuthError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "auth/network-request-failed"
  );
}

/**
 * Google sign-in feature (001 logic reused, re-skinned with DS primitives for US2/T040:
 * Logo/Card/Button/Alert). Anonymous users reach it via the router guard (GC-2). On
 * success the session listener flips the status; main.tsx re-invalidates and the
 * `/sign-in` guard (GC-4) carries the user to their return-to-intent (or Calcular) —
 * so this screen never navigates by hand. Calcular is public: sign-in only unlocks the
 * guarded sections (Catálogo/Histórico/Conta).
 */
export function SignInScreen() {
  const status = useSessionStore((s) => s.status);
  const [state, setState] = useState<SignInState>("idle");
  const configured = status !== "not-configured";
  const t = messages.signIn;

  async function handleSignIn(): Promise<void> {
    setState("submitting");
    try {
      await signInWithGoogle();
    } catch (err) {
      setState(isOfflineAuthError(err) ? "offline" : "error");
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-8">
      <Logo variant="full" alt={messages.appName} />

      <Card padding="lg" className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="tf-title" style={{ margin: 0 }}>
            {t.title}
          </h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>{t.subtitle}</p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => void handleSignIn()}
          disabled={!configured}
          loading={state === "submitting"}
        >
          {t.google}
        </Button>

        {!configured && <Alert tone="info">{t.notConfigured}</Alert>}
        {state === "offline" && <Alert tone="info">{t.offline}</Alert>}
        {state === "error" && <Alert tone="danger">{t.error}</Alert>}
      </Card>
    </section>
  );
}
