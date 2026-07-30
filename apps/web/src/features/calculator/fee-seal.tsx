import { messages } from "@/shared/i18n/messages.pt-br";
import { Badge, type BadgeTone } from "@/shared/ui";

import "./fee-seal.css";

// US2 honesty seal (FR-107): a small pill that states, per channel slot, where its fee numbers came
// from and how fresh they are — so a pre-filled number is never mistaken for something the user
// vouched for. Domain copy (pt-BR) lives here in the feature, built on the generic shared Badge; it
// NEVER asserts a fabricated value is exact (Constitution II) — an uncovered slot reads "sem referência".

const t = messages.calculator.seals;

/** What backs a slot's fee numbers. `reference` carries provenance; `embedded` = the bundled seed
 *  (offline); `stale` = past the 30-day window; `adjusted` = the user edited a pre-fill; `none` =
 *  uncovered (manual); `estimate` = the labelled ML freight subsidy (A4). */
export type FeeSealState =
  | {
      kind: "reference";
      source: string;
      reviewedOn: string;
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

function textAndTone(state: FeeSealState): { text: string; tone: BadgeTone } {
  switch (state.kind) {
    case "reference": {
      // `embedded` is a MODIFIER of the head, never an early return. It used to be one, and that
      // return swallowed both clauses below: on the seed path the 30-day alarm could not fire (SC-807
      // — and the seed is the copy that ages MOST, since it only moves when a new bundle ships), and
      // an ancestor-inherited rate lost the clause naming which category it actually belongs to. The
      // neighbouring `catchAll` case applies `t.outdated` without consulting `embedded` at all, which
      // is what gives the asymmetry away as an accident rather than a decision.
      const head = state.embedded ? t.embedded : `${t.reference}: ${state.source}`;
      // Naming the ORIGIN category costs one clause and closes a real gap: with sparse entries the
      // number may come from an ANCESTOR of the chosen category, and "Referência: <fonte>" alone
      // would let the seller read it as his own category's rate.
      const forCat = state.originCategoryName
        ? ` (${t.forCategory} ${state.originCategoryName})`
        : "";
      const base = `${head}${forCat} · ${t.updatedOn} ${fmtDate(state.reviewedOn)}`;
      return state.stale || state.embedded
        ? { text: state.stale ? `${base} · ${t.outdated}` : base, tone: "neutral" }
        : { text: base, tone: "info" };
    }
    case "catchAll": {
      // 014/T099 — this used to interpolate a `catchAllName`, a field NO production path ever set:
      // only a test did, so the seal shipped a decorative slot that could never fill. The published
      // row's name is already inside `source` ("… — Outros (…)"), so nothing was lost by removing it,
      // and one less always-empty branch is one less place where a seal can quietly say less than it
      // appears to (Princípio V).
      const base = `${t.catchAll} ${t.catchAllHighest}`;
      // Deliberately NOT "info": this is not a confirmed rate for the seller's category, and giving
      // it the same tone as one is what makes a plausible number stop the seller from choosing.
      return { text: state.stale ? `${base} · ${t.outdated}` : base, tone: "neutral" };
    }
    case "adjusted":
      return { text: t.adjusted, tone: "neutral" };
    case "estimate":
      return { text: t.estimate, tone: "info" };
    case "none":
      return { text: t.none, tone: "neutral" };
  }
}

/** The honesty seal for one channel slot (or the ML freight field). */
export function FeeSeal({ state }: { state: FeeSealState }) {
  const { text, tone } = textAndTone(state);
  return (
    <Badge tone={tone} className="fee-seal" data-testid="fee-seal">
      {text}
    </Badge>
  );
}
