import { type ReactNode } from "react";

import { type PremiumGate } from "@/shared/billing/premium-gate";
import { type VazioFeature, VazioDidatico } from "@/shared/billing/vazio-didatico";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, EmptyState, Spinner } from "@/shared/ui";

// The non-list branches of `CatalogPanel`'s state router (T019/T022): loading, load error, the
// "active + genuinely empty" short empty, and the "not paying (or logged out)" honest-teaser empty
// (32a/32c/32g). Extracted verbatim from `catalog-panel.tsx` — same markup, same conditions, only
// named and moved so the router in the panel reads as a router.

const catalogo = messages.catalogo;

export function CatalogPanelLoading() {
    return (
        <div className="flex justify-center py-8">
            <Spinner />
        </div>
    );
}

export function CatalogPanelErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <Alert tone="danger" title={catalogo.loadError}>
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
                {catalogo.retry}
            </Button>
        </Alert>
    );
}

/** `active` e vazio de verdade: o vazio CURTO de sempre, sem convite nenhum. */
export function CatalogPanelShortEmpty({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action: ReactNode;
}) {
    return <EmptyState icon="package" title={title} description={description} action={action} />;
}

/**
 * 019/PR-B (T044) — não paga (ou deslogado, ou pausou): a lista está vazia porque nunca houve
 * leitura (403 honesto) ou porque de fato não há nada salvo — os dois casos leem IGUAL (prancheta
 * 32a/32c): o vazio didático, nunca a parede/crown de antes.
 *
 * `detail` presente (mesmo `null`) → o layout mestre-detalhe (32g): o vazio à esquerda, e a ficha
 * INERTE de criação à direita quando o Sheet mobile não está aberto (`detail` já vem computado como
 * `null` nesse caso, pelo chamador). `detail` ausente (`undefined`) → o layout simples (mobile, ou
 * produtos/kits que navegam em vez de usar `renderForm`): só o vazio, com o único convite.
 */
export function CatalogPanelGateEmpty({
    feature,
    gate,
    action,
    teaser,
    detail,
}: {
    feature: VazioFeature;
    gate: Exclude<PremiumGate, "active">;
    action: ReactNode;
    teaser: boolean;
    detail?: ReactNode;
}) {
    if (detail !== undefined) {
        return (
            <div className="tf-catalog-md">
                <div className="tf-catalog-md__master">
                    <VazioDidatico feature={feature} gate={gate} action={action} teaser={false} />
                </div>
                {detail}
            </div>
        );
    }
    return <VazioDidatico feature={feature} gate={gate} action={action} teaser={teaser} />;
}
