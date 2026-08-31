import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";

import { TeaserUpgrade } from "./teaser-upgrade";

import "./premium-teaser.css";

// 016/US1 (T005, arquitetura-016 §E) — the ONE teaser pattern for the five premium surfaces
// (Simulações · "Usar do catálogo" · Catálogo · Kits · Orçamentos). It replaces four diverging
// components (`features/{catalog,history,scenarios,bom}/*-teaser.tsx` + `PremiumTeaserDialog`,
// all DELETED in this slice) that each grew their own subtitle, their own "No Premium…" block,
// their own dismiss/sign-in buttons — the divergence US1 exists to kill (SC-901).
//
// It lives in `shared/billing/`, not in any one feature: the five callers are FSD-Lite siblings
// (`feature → feature` is forbidden, ADR-0004/I8), and `TeaserUpgrade` — the "Assinar" element —
// was already elevated here for the same reason. This component ABSORBS `TeaserUpgrade` as-is;
// it is never bifurcated (the E6 homologation it carries — 100,5px of overflow, a toast that
// never rendered — is paid for once, not per teaser).
//
// The contract is CLOSED: four elements, fixed order, no text props. Content comes from
// `messages.premiumTeaser`, keyed by `PremiumFeatureId` — "same structure on five screens" is a
// property of the TYPE (one render path, one registry), not a result every caller has to get
// right on its own.

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
