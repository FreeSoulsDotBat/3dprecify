// `MarketplaceSection` — US1 multi-channel marketplace pricing (the toggle + channel slots),
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import type { Control } from "react-hook-form";

import type { ChannelSlotOutcome } from "@/features/calculator/calculator-model";
import {
    type CalcFormValues,
    type ChannelSlotForm,
    defaultChannelSlot,
    type MarketplaceId,
} from "@/features/calculator/calculator-schema";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";
import type { CategoryNode, FeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, Switch } from "@/shared/ui";

import { captionText } from "../form-atoms/form-styles";
import { SectionTitle } from "../form-atoms/section-title";
import { ChannelSlot } from "./channel-slot";

const t = messages.calculator;

/**
 * US1 multi-channel marketplace pricing. Starts with one Mercado Livre slot; the user adds/removes
 * slots, picks each marketplace + modality, enters (or, in US2, pre-fills) its fees, and reads every
 * channel's grossed-up anúncio + líquido (varejo e atacado) together in "Preços por canal". Each
 * slot validates in isolation — commission ≥ 100% errors only its slot (SC-107).
 */
export function MarketplaceSection({
    control,
    values,
    fields,
    channelOutcomes,
    included,
    onToggleInclude,
    onAppend,
    onRemove,
    onMarketplaceChange,
    refreshFailed,
    refreshing,
    onRetryCatalog,
    spineFor,
    catalog,
    entitled,
    signedOut,
}: {
    control: Control<CalcFormValues>;
    values: CalcFormValues;
    fields: { id: string }[];
    channelOutcomes: ChannelSlotOutcome[];
    included: boolean;
    onToggleInclude: (included: boolean) => void;
    onAppend: (slot: ChannelSlotForm) => void;
    onRemove: (index: number) => void;
    onMarketplaceChange: (index: number, marketplace: MarketplaceId) => void;
    refreshFailed: boolean;
    refreshing: boolean;
    onRetryCatalog: () => void;
    /** Category spine per marketplace, from the catalog that already travels with the fees (D2). */
    spineFor: (marketplace: MarketplaceId) => readonly CategoryNode[];
    /** 016/US12 — feeds `channelFieldPlan` (RA5: the same plan that decides what renders here also
     *  decides what is SENT as a determinant, in `fee-prefill.ts:slotDeterminants`). */
    catalog: FeeCatalog;
    /**
     * 016/US11 (T048, FR-915) — is THIS account entitled to price a channel? `true` on the two
     * always-premium surfaces (kit lines, the product page — both mount only behind their own
     * page-level entitlement gate already); on the free calculator it is the server-derived
     * `entitlement.data?.status === "active"` (ADR-0012 — the UI gate is convenience, never the
     * authority; a checking/error state degrades to "not entitled", never a guessed "yes").
     */
    entitled: boolean;
    /** Where `TeaserUpgrade` sends a signed-out visitor (through sign-in, preserving intent). */
    signedOut: boolean;
}) {
    return (
        <div className="flex flex-col gap-3">
            {/* US4: the "Incluir marketplaces no preço" master toggle stays OUTSIDE the collapsible body so
          the section is always re-enableable. It is pure visibility — off hides every channel row and
          stops computing the channels (SC-105); the direct varejo/atacado headline is untouched.
          The toggle sits on its OWN full-width row (label left, switch right) so the label never gets
          squeezed into a 2-line wrap beside the switch at 390px (homologation nit). */}
            <SectionTitle title={t.sections.marketplace} info={t.sectionInfo.marketplace} />
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
                <span>{t.channels.includeToggle}</span>
                {/* 016/US11 (T048, FR-915) — for a non-entitled account the switch is DISABLED and FALSE,
            unconditionally: never the form's own `included` value, which would let a stale
            `includeMarketplace: true` (the default) read as "on" the instant entitlement resolves
            momentarily false (checking/error). Nenhum número de canal, parcial ou fake. */}
                <Switch
                    checked={entitled && included}
                    disabled={!entitled}
                    onCheckedChange={onToggleInclude}
                    aria-label={t.channels.includeToggle}
                />
            </label>
            {!entitled ? (
                // 016/T055-reverify — na faixa full-width do grátis, o "Assinar" sem align ficava a
                // ~950px da legenda que o motiva (o MESMO órfão de 149,6px que fez a prop `align`
                // nascer no E6/T038-D2). Centrado, texto e CTA leem como uma unidade.
                <div
                    className="flex flex-col gap-2"
                    style={{ textAlign: "center" }}
                    data-testid="marketplace-premium-gate"
                >
                    <p style={captionText}>{t.channels.premiumOnly}</p>
                    <TeaserUpgrade signedOut={signedOut} align="center" />
                </div>
            ) : (
                included && (
                    <>
                        {/* US3: a failed online fee refresh is NON-BLOCKING — the saved/seed reference still pre-fills
                and every price computes; this only offers a retry (tone "info", role="status" — no alarm).
                `refreshFailed` is STICKY (see the hook) so the notice doesn't blink out during a retry's
                transient pending window; `refreshing` then drives the button's in-flight spinner. */}
                        {refreshFailed && (
                            <Alert tone="info" title={t.channels.refreshErrorTitle}>
                                <p>{t.channels.refreshErrorBody}</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onRetryCatalog}
                                    loading={refreshing}
                                    className="mt-2"
                                >
                                    {t.channels.refreshRetry}
                                </Button>
                            </Alert>
                        )}
                        <div className="flex flex-col gap-3">
                            {fields.map((f, i) => (
                                <ChannelSlot
                                    key={f.id}
                                    control={control}
                                    index={i}
                                    slot={values.channels[i]}
                                    outcome={channelOutcomes[i]}
                                    spine={spineFor(values.channels[i].marketplace)}
                                    catalog={catalog}
                                    onRemove={onRemove}
                                    onMarketplaceChange={onMarketplaceChange}
                                />
                            ))}
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onAppend(defaultChannelSlot())}
                        >
                            {t.channels.addChannel}
                        </Button>
                        {/* 016/US5 — "Preços por canal" no longer renders here: it folded into `PriceResults`'
                "Como chegamos no preço" Card (FR-907), so this section stays purely the channel
                INPUT editing UI (marketplace/modality/category/fees + the honesty seal). */}
                    </>
                )
            )}
        </div>
    );
}
