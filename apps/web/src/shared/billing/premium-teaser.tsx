import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";

import { TeaserUpgrade } from "./teaser-upgrade";

import "./premium-teaser.css";

// @doc DEC-030 — contrato FECHADO: quatro elementos, ordem fixa, nenhuma prop de texto. "Mesma
//   estrutura em cinco telas" é propriedade do TIPO, não acerto de cada chamador.

export type PremiumFeatureId = "SCENARIOS" | "CATALOG" | "CATALOG_PICKER" | "KITS" | "QUOTES";

export interface PremiumTeaserProps {
    feature: PremiumFeatureId;
    signedOut: boolean;
    /**
     * The ONE named exception (US1-AC3): the "Usar do catálogo" affordance on the calculator's
     * catalog-picker slot renders DISABLED and VISIBLE — never hidden — in place of the removed
     * "Salvar faz parte do Premium." caption. A generic `children` slot would reopen exactly the
     * divergence this component exists to close, so the exception is named, not general-purpose.
     */
    disabledAffordance?: ReactNode;
}

const t = messages.premiumTeaser;

export function PremiumTeaser({ feature, signedOut, disabledAffordance }: PremiumTeaserProps) {
    const copy = t[feature];
    return (
        <div className="tf-premium-teaser" data-testid="premium-teaser">
            <h2 className="tf-premium-teaser__title" data-testid="premium-teaser-title">
                {copy.title}
            </h2>
            <p className="tf-premium-teaser__subtitle" data-testid="premium-teaser-subtitle">
                {copy.subtitle}
            </p>
            <TeaserUpgrade signedOut={signedOut} align="center" />
            <p className="tf-premium-teaser__caption" data-testid="premium-teaser-caption">
                {copy.caption}
            </p>
            {disabledAffordance && (
                <div
                    className="tf-premium-teaser__disabled"
                    data-testid="premium-teaser-disabled-affordance"
                >
                    {disabledAffordance}
                </div>
            )}
        </div>
    );
}
