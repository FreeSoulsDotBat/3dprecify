import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState, type IconName } from "@/shared/ui";

import type { PremiumGate } from "./premium-gate";
import { TeaserUpgrade } from "./teaser-upgrade";

// @doc DEC-046 — a lista não vira parede: está vazia porque nunca houve o que salvar, e o
//   vazio EXPLICA a feature. Sem coroa, sem preço no título, um convite só por tela.

export type DidacticEmptyFeature =
    "filaments" | "printers" | "products" | "kits" | "quotes" | "scenarios";

interface DidacticEmptyCopy {
    icon: IconName;
    title: string;
    body: string;
}

const c = messages.catalog;

function copyOf(feature: DidacticEmptyFeature): DidacticEmptyCopy {
    switch (feature) {
        case "filaments":
            return {
                icon: "package",
                title: c.emptyFilamentsTitle,
                body: c.educationalFilamentsBody,
            };
        case "printers":
            return {
                icon: "package",
                title: c.emptyPrintersTitle,
                body: c.educationalPrintersBody,
            };
        case "products":
            return {
                icon: "package",
                title: c.emptyProductsTitle,
                body: c.educationalProductsBody,
            };
        case "kits":
            return { icon: "package", title: c.emptyKitsTitle, body: c.educationalKitsBody };
        case "quotes":
            return {
                icon: "history",
                title: messages.history.educationalTitle,
                body: messages.history.educationalBody,
            };
        case "scenarios":
            return {
                icon: "boxes",
                title: messages.scenarios.emptyTitle,
                body: messages.scenarios.educationalBody,
            };
    }
}

export interface DidacticEmptyProps {
    feature: DidacticEmptyFeature;
    /** O estado que a tela leu de `premiumGate(...)`. Só decide DUAS coisas aqui: se o convite é
     *  "Assinar" (nunca teve / deslogado) ou "Reativar" (teve e venceu), e para onde o deslogado vai. */
    gate: Exclude<PremiumGate, "active">;
    /** O botão do vazio — "Adicionar filamento" (abre o formulário inerte) ou "Fazer um cálculo". */
    action: ReactNode;
    /** `false` enquanto o formulário inerte está aberto: o rodapé dele é o único convite da tela. */
    teaser?: boolean;
}

export function DidacticEmpty({ feature, gate, action, teaser = true }: DidacticEmptyProps) {
    const copy = copyOf(feature);
    // `unknown` (logado sem resposta do servidor) NÃO recebe convite: convidar a assinar quem talvez
    // já pague é presumir — o precedente é o `PlanState` do E6, e o CF-045 da homologação vigia
    // exatamente isso ("falha de rede nunca é vendida como 'você não é premium'").
    const convida = teaser && gate !== "unknown";
    return (
        <EmptyState
            icon={copy.icon}
            title={copy.title}
            description={copy.body}
            data-testid="vazio-didatico"
            data-feature={feature}
            action={
                <div className="flex flex-col items-center gap-3">
                    {action}
                    {convida && (
                        <TeaserUpgrade
                            signedOut={gate === "signed-out"}
                            align="center"
                            label={
                                gate === "lapsed" ? messages.billing.reactivateAction : undefined
                            }
                        />
                    )}
                </div>
            }
        />
    );
}
