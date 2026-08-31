import { Alert, Button, Spinner } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { messages } from "@/shared/i18n/messages.pt-br";

const t = messages.historico;

export function GateError({ onRetry }: { onRetry: () => void }) {
    return (
        <GateShell>
            <div className="flex flex-col items-center gap-3 py-8">
                <Alert tone="danger">{t.guardError}</Alert>
                <Button variant="secondary" onClick={onRetry}>
                    {t.guardRetry}
                </Button>
            </div>
        </GateShell>
    );
}

function GateShell({ children }: { children: React.ReactNode }) {
    return (
        <section className="tf-historico mx-auto flex w-full tf-page-wide flex-col gap-4">
            <PageHeader title={t.title} />
            {children}
        </section>
    );
}

export function GateChecking() {
    return (
        <GateShell>
            <div className="flex justify-center py-8">
                <Spinner />
            </div>
        </GateShell>
    );
}
