import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// Placeholder page (T032): the section title through the focusable PageHeader (T030)
// plus an on-brand empty state — no CRUD/list. Honest copy (no price/date). The guard
// that makes it auth-only lands in US2 (T037).
export function CatalogoPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col">
      <PageHeader title={messages.nav.catalogo} />
      <EmptyState
        icon="package"
        title={messages.catalogo.emptyTitle}
        description={messages.catalogo.emptyBody}
      />
    </section>
  );
}
