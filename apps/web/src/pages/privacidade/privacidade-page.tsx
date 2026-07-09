import { messages } from "@/shared/i18n/messages.pt-br";
import { Card } from "@/shared/ui";

// FR-214 (006) — the minimal honest privacy notice, owner-decided Option A: a public content page
// (no guard, reachable signed-out) stating the four honest facts. Composes existing DS primitives —
// no new component, no consent library (full LGPD deferred to E2). The sign-in screen links here.
export function PrivacidadePage() {
  const t = messages.privacy;
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-4">
      <h1 className="tf-title" style={{ margin: 0 }}>
        {t.title}
      </h1>
      <Card padding="lg" className="flex flex-col gap-3">
        <p style={{ margin: 0 }}>{t.google}</p>
        <p style={{ margin: 0 }}>{t.monitoring}</p>
        <p style={{ margin: 0 }}>{t.noSale}</p>
        <p style={{ margin: 0 }}>{t.calculatorFree}</p>
      </Card>
    </section>
  );
}
