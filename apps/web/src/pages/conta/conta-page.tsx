import { messages } from "@/shared/i18n/messages.pt-br";
import { PageHeader } from "@/widgets/page-header/page-header";

// Foundational page stub (T024), now titled through the focusable PageHeader (T030)
// for shell consistency. The real Conta — server-confirmed identity (entities/user),
// static "Gratuito" indicator, theme Switch, sign-out — is built in US5 (T060). The
// guard that makes it auth-only lands in US2 (T037).
export function ContaPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col">
      <PageHeader title={messages.conta.title} />
    </section>
  );
}
