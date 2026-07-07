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
  | { kind: "reference"; source: string; reviewedOn: string; embedded?: boolean; stale?: boolean }
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
      if (state.embedded) return { text: t.embedded, tone: "neutral" };
      const base = `${t.reference}: ${state.source} · ${t.updatedOn} ${fmtDate(state.reviewedOn)}`;
      return state.stale
        ? { text: `${base} · ${t.outdated}`, tone: "neutral" }
        : { text: base, tone: "info" };
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
