import { useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { dismissFeeSeal, useFeeSealDismissed } from "@/shared/lib/fee-seal-dismiss-store";
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

// US2 honesty seal (FR-107): states, per channel slot, where its fee numbers came from and how
// fresh they are — so a pre-filled number is never mistaken for something the user vouched for.
// Domain copy (pt-BR) lives here in the feature. NEVER asserts a fabricated value is exact
// (Constitution II) — an uncovered slot reads "sem referência".
//
// 019/PR-C (T052/T058, prancheta "Selo de Procedencia") — the block that backs a NUMBER (commission
// or the fixed fee) is a `tf-alert--compact` (shared/ui, 019/PR-A), not a `Badge` pill: it carries a
// two-line citation, a review date, "Ver fonte" and "Dispensar". The three SHORT qualifiers —
// `adjusted`/`estimate`/`none` — stay `Badge` pills per the design authority (13b·4/6/7), even though
// the task text that opened this slice suggested folding them into `Alert` too; the prancheta wins
// (research §A / Principle VIII), and this divergence from the task's own wording is deliberate.

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

/** ISO date ("2026-07-06" or a full timestamp) → pt-BR "06/07/2026"; raw string if unparseable. */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 13a·2 — "Ver fonte" aberto: a citação inteira, quando conferimos, e o link do catálogo (nunca
 *  mostrado antes desta fatia). Compartilhado entre o selo principal e o da taxa fixa — só existe
 *  UMA cópia transcrita de "Fonte da comissão" (messages.calculator.seals.fonteTitle), então os dois
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
        <DialogTitle>{t.fonteTitle}</DialogTitle>
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
        </a>
        <p className="fee-seal__source-notice">
          {t.fonteAviso.replace("{marketplace}", marketplaceLabel)}
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
        compact
        data-testid="fee-seal"
        dismissLabel={t.dispensar}
        onDismiss={() => dismissFeeSeal(key)}
        action={
          state.sourceUrl ? (
            <button type="button" onClick={() => setSourceOpen(true)}>
              {t.verFonte}
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
        <p className="fee-seal__date tf-tnum">{`${t.updatedOn} ${fmtDate(state.reviewedOn)}`}</p>
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
          dateLine={t.fonteConferida.replace("{data}", fmtDate(state.reviewedOn))}
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
 * 016/PR-F (T057) — the fixed fee's OWN provenance, when the catalog entry carries one (Amazon
 * Individual: the commission comes from the category table, the R$ 2,00 per-item charge comes from a
 * DIFFERENT official page — `venda.amazon.com.br/precos`). A SEPARATE block, never folded into the
 * main `FeeSeal`'s text: the main seal already names the commission's source, and citing a second
 * source inside the same sentence would blur which number it backs (Constitution II).
 *
 * 019/PR-C (13b·9) — also `tf-alert--compact`, always tone `neutral` (never `info`: it is not "the
 * live reference for the seller's category", just a second, separately-dated citation), and says
 * "vigente desde" — WHEN the fee took effect — never "atualizada em", which would claim it is the
 * date we last confirmed it (the entry has no second `lastReviewed` of its own — see `fee-catalog.ts`).
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

  const sinceLine = `${t.fixedFeeSourceSince} ${fmtDate(source.effectiveDate)}`;

  return (
    <>
      <Alert
        tone="neutral"
        compact
        data-testid="fixed-fee-source-seal"
        dismissLabel={t.dispensar}
        onDismiss={() => dismissFeeSeal(key)}
        action={
          <button type="button" onClick={() => setSourceOpen(true)}>
            {t.verFonte}
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
