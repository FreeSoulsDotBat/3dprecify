import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { dismissFeeSeal, useFeeSealDismissed } from "@/shared/lib/fee-seal-dismiss-store";
import { formatDatePtBr } from "@/shared/lib/format-date";
import {
    Alert,
    type AlertTone,
    Badge,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    Icon,
} from "@/shared/ui";

import type { MarketplaceId } from "./calculator-schema";

import "./fee-seal.css";

// ⚠ @doc DEC-107 — o bloco que sustenta um NÚMERO é `Alert` (citação + data + fonte + dispensar);
//   os três qualificadores curtos seguem `Badge`, por autoridade da prancheta.

const t = messages.calculator.seals;
const marketplaceNames = messages.calculator.marketplaceNames;

/** What backs a slot's fee numbers. `reference` carries provenance; `embedded` = the bundled seed
 *  (offline); `stale` = past the STALENESS_DAYS window (45 — the loop's monthly cycle + delivery
 *  slack, `shared/fee-catalog`'s `isStale` is the source of truth); `adjusted` = the user edited a
 *  pre-fill; `none` = uncovered (manual); `estimate` = the labelled ML freight subsidy (A4). */
export type FeeSealState =
    | {
          kind: "reference";
          source: string;
          reviewedOn: string;
          /** 019/PR-C — reaches "Ver fonte". Absent on the embedded (seed) path on purpose (13b·3): the
           *  seed cites no page at all, so there is nothing "Ver fonte" could open. */
          sourceUrl?: string;
          embedded?: boolean;
          stale?: boolean;
          /** The category this number belongs to — may be an ANCESTOR of the one the seller chose. */
          originCategoryName?: string | null;
      }
    | {
          // 014/Q5: the marketplace's OWN published catch-all, used because no category was chosen. A
          // separate state on purpose — "the rate for uncategorised" is not "the rate for your category".
          kind: "catchAll";
          source: string;
          reviewedOn: string;
          sourceUrl?: string;
          embedded?: boolean;
          stale?: boolean;
      }
    | { kind: "adjusted" }
    | { kind: "estimate" }
    | { kind: "none" };

/** 13a·2 — "Ver fonte" aberto: a citação inteira, quando conferimos, e o link do catálogo (nunca
 *  mostrado antes desta fatia). Compartilhado entre o selo principal e o da taxa fixa — só existe
 *  UMA cópia transcrita de "Fonte da comissão" (messages.calculator.seals.sourceTitle), então os dois
 *  diálogos usam o mesmo título; ver o relatório da task sobre essa divergência de conteúdo. */
function FeeSourceDialog({
    open,
    onOpenChange,
    citation,
    dateLine,
    sourceUrl,
    marketplaceLabel,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    citation: string;
    dateLine: string;
    sourceUrl: string;
    marketplaceLabel: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="center" data-testid="fee-seal-source-dialog">
                <DialogTitle>{t.sourceTitle}</DialogTitle>
                <DialogDescription>{citation}</DialogDescription>
                <p className="fee-seal__source-date tf-tnum">{dateLine}</p>
                {/* 13a·2 — o link sem o esquema ("seller.shopee.com.br/…"), e QUEBRÁVEL: a screenshot da
            T061 mostrou a URL inquebrável transbordando o diálogo a 390px (a lição de sempre —
            geometria só aparece na imagem). */}
                <a
                    className="fee-seal__source-link"
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {sourceUrl.replace(/^https?:\/\//, "")}
                    {/* 019/PR-C — decisão do dono 28/08: mesmo chevron do botão "Ver fonte" (13a·2). */}
                    <Icon name="chevron-down" size={16} style={{ transform: "rotate(-90deg)" }} />
                </a>
                <p className="fee-seal__source-notice">
                    {t.sourceDisclaimer.replace("{marketplace}", marketplaceLabel)}
                </p>
            </DialogContent>
        </Dialog>
    );
}

/** 13a/13b·1·2·3 — the commission block: `tf-alert--compact`, tone `info` online or `neutral`
 *  embedded, with the label naming the NUMBER ("Comissão"), the citation, the origin-category line
 *  (13a·3, deduped against the citation — R2 da homologação 014), the review date, the catch-all
 *  warning line (13b·5) when it applies, and the "desatualizada" pill (13b·4, still neutral, still a
 *  pill — a body LINE of 58 chars becomes the card's minimum width and overflows at 360px, the
 *  016/PR-B trap the prancheta names verbatim). */
function FeeReferenceAlert({
    state,
    marketplace,
}: {
    state: Extract<FeeSealState, { kind: "reference" | "catchAll" }>;
    marketplace: MarketplaceId;
}) {
    const key = `${marketplace}::${state.source}::${state.reviewedOn}`;
    const dismissed = useFeeSealDismissed(key);
    const [sourceOpen, setSourceOpen] = useState(false);
    if (dismissed) return null;

    const tone: AlertTone = state.embedded ? "neutral" : "info";
    const citation = state.embedded ? t.embedded : state.source;
    const showForCategory =
        state.kind === "reference" &&
        !!state.originCategoryName &&
        !citation.includes(state.originCategoryName);

    return (
        <>
            <Alert
                tone={tone}
                // 019/PR-C (prancheta 13b·3, decisão do dono 28/08) — a referência embutida (offline, sem
                // internet) troca o ícone padrão do tone `neutral` pelo `wifi`, "como no design".
                icon={state.embedded ? "wifi" : undefined}
                compact
                data-testid="fee-seal"
                dismissLabel={t.dismiss}
                onDismiss={() => dismissFeeSeal(key)}
                action={
                    state.sourceUrl ? (
                        <button type="button" onClick={() => setSourceOpen(true)}>
                            {t.viewSource}
                            {/* 019/PR-C — decisão do dono 28/08: chevron "como no design" (13a·2), decorativo. */}
                            <Icon
                                name="chevron-down"
                                size={16}
                                style={{ transform: "rotate(-90deg)" }}
                            />
                        </button>
                    ) : undefined
                }
            >
                <p className="fee-seal__label">{t.commissionLabel}</p>
                <p className="fee-seal__cite">{citation}</p>
                {showForCategory && (
                    <p className="fee-seal__for-category">
                        {t.forCategory} <strong>{state.originCategoryName}</strong>
                    </p>
                )}
                <p className="fee-seal__date tf-tnum">{`${t.updatedOn} ${formatDatePtBr(state.reviewedOn)}`}</p>
                {state.kind === "catchAll" && (
                    <p className="fee-seal__catch-all-warning">
                        <Icon name="triangle-alert" size={14} />
                        {`${t.catchAll} ${t.catchAllHighest}`}
                    </p>
                )}
                {state.stale && (
                    <div className="fee-seal__pills">
                        <Badge tone="neutral" className="tf-badge--sm">
                            {t.outdated}
                        </Badge>
                    </div>
                )}
            </Alert>
            {state.sourceUrl && (
                <FeeSourceDialog
                    open={sourceOpen}
                    onOpenChange={setSourceOpen}
                    citation={state.source}
                    dateLine={t.sourceCheckedOn.replace("{data}", formatDatePtBr(state.reviewedOn))}
                    sourceUrl={state.sourceUrl}
                    marketplaceLabel={marketplaceNames[marketplace]}
                />
            )}
        </>
    );
}

/** The honesty seal for one channel slot (or the ML freight field). */
export function FeeSeal({
    state,
    marketplace,
}: {
    state: FeeSealState;
    marketplace: MarketplaceId;
}) {
    switch (state.kind) {
        case "adjusted":
            return (
                <Badge tone="accent" className="tf-badge--sm" data-testid="fee-seal">
                    {t.adjusted}
                </Badge>
            );
        case "estimate":
            return (
                <Badge tone="info" className="tf-badge--sm" data-testid="fee-seal">
                    {t.estimate}
                </Badge>
            );
        case "none":
            return (
                <Badge tone="warning" className="tf-badge--sm" data-testid="fee-seal">
                    {t.none}
                </Badge>
            );
        case "reference":
        case "catchAll":
            return <FeeReferenceAlert state={state} marketplace={marketplace} />;
    }
}

/**
 * ⚠ @doc DEC-092 — bloco SEPARADO e tom `neutral`: citar a segunda fonte dentro da frase do selo
 *   principal borraria QUAL número ela sustenta. Diz "vigente desde", nunca "atualizada em".
 */
export function FixedFeeSourceBadge({
    source,
    marketplace,
}: {
    source: { source: string; sourceUrl: string; effectiveDate: string };
    marketplace: MarketplaceId;
}) {
    const key = `${marketplace}::${source.source}::${source.effectiveDate}`;
    const dismissed = useFeeSealDismissed(key);
    const [sourceOpen, setSourceOpen] = useState(false);
    if (dismissed) return null;

    const sinceLine = `${t.fixedFeeSourceSince} ${formatDatePtBr(source.effectiveDate)}`;

    return (
        <>
            <Alert
                tone="neutral"
                compact
                data-testid="fixed-fee-source-seal"
                dismissLabel={t.dismiss}
                onDismiss={() => dismissFeeSeal(key)}
                action={
                    <button type="button" onClick={() => setSourceOpen(true)}>
                        {t.viewSource}
                        {/* 019/PR-C — decisão do dono 28/08: chevron "como no design" (13a·2), decorativo. */}
                        <Icon
                            name="chevron-down"
                            size={16}
                            style={{ transform: "rotate(-90deg)" }}
                        />
                    </button>
                }
            >
                <p className="fee-seal__label">{t.fixedFeeSource}</p>
                <p className="fee-seal__cite">{source.source}</p>
                <p className="fee-seal__date tf-tnum">{sinceLine}</p>
            </Alert>
            <FeeSourceDialog
                open={sourceOpen}
                onOpenChange={setSourceOpen}
                citation={source.source}
                dateLine={sinceLine}
                sourceUrl={source.sourceUrl}
                marketplaceLabel={marketplaceNames[marketplace]}
            />
        </>
    );
}
