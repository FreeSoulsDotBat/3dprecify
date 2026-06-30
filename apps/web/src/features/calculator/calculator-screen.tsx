import { messages } from "@/shared/i18n/messages.pt-br";

// US1: the protected destination. The real material+markup calculation (consuming pricing-core)
// arrives in US2; this slice only proves the login gate reaches an authenticated screen. The
// "signed-in as / sign out" chrome lives in the app shell header, not here.
export function CalculatorScreen() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--accent-text)" }}>
        {messages.calculator.title}
      </h1>
      <p style={{ color: "var(--text-muted)" }}>{messages.calculator.placeholder}</p>
    </section>
  );
}
