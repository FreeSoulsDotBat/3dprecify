import {
  computeBom,
  stripRetiredFields,
  type BomResult,
  type DiscardedField,
  type PriceInput,
} from "@3dprecify/pricing-core";

import {
  serializeAdHocBasis,
  serializeProductBasis,
  serializeScenarioConfig,
  type ScenarioBasisRef,
  type ScenarioChannelSlotState,
  type ScenarioConfig,
} from "@/entities/scenario/config-document";
import { messages } from "@/shared/i18n/messages.pt-br";
import { wireToPtBr } from "@/shared/lib/decimal-ptbr";

import { type CatalogContext, type ChannelSlotOutcome, computeFromForm } from "./calculator-model";
import {
  type CalcFieldName,
  CALC_FIELD_NAMES,
  type CalcFormValues,
  defaultCalcValues,
  type ChannelFieldName,
  type ChannelSlotForm,
  type MarketplaceId,
  type Modality,
  type OtherCostForm,
} from "./calculator-schema";

// 010/T009+T010+T014 (E5, PR-A) — the ONE seam where the calculator's live form state meets the
// scenario entity's parameter shapes, in BOTH directions (save + reopen).
//
// It lives HERE, in `features/calculator`, and NOT in `features/scenarios` for a structural reason
// (FSD-Lite/ADR-0004, `eslint-boundaries`): a feature may import `entities/*` + `shared/*`, never a
// SIBLING feature. `features/scenarios` cannot import `features/calculator`'s `CalcFormValues` /
// `ChannelSlotOutcome` types — so the calculator feature (which already owns those types) is the one
// that knows how to translate them into `entities/scenario/config-document`'s plain parameter shapes.
// `features/scenarios` never sees a `CalcFormValues`; it only ever handles an already-built
// `ScenarioConfig` (save direction) or an already-applied form patch (reopen direction), both of
// which the PAGE wires by calling the functions below at the call site — exactly the seam
// `config-document.ts`'s header comment describes.
//
// `pricing-core` is NOT touched: SAVE reuses whatever `computeFromForm` already resolved
// (`ChannelSlotOutcome.editedFields`, T010's per-field tracking); REOPEN only produces pt-BR form
// STRINGS that flow back through the exact same `computeFromForm` → `fee-prefill.ts` path a fresh
// calculation takes — a non-overridden slot is left BLANK so it re-resolves live, an overridden slot
// is set to its saved value so it reads "ajustado por você", and the 005 honesty cases (uncovered
// slot → "sem referência"; commission ≥ 100% → the same inline error) fall out of the EXISTING code
// with zero new pricing logic (FR-609, T014).

/** A decimal-string leaf ("12.5", "0.1", "100") has AT MOST one '.', never a thousands separator (it
 *  comes from `Decimal#toString`) — so swapping '.' → ',' is a lossless, unambiguous conversion into
 *  the pt-BR string the calculator form's own parser (`parseDecimal`) expects. Never a re-round.
 *  013/FA-05: the swap itself now lives in `shared/lib/decimal-ptbr` (one home, premise under test);
 *  this local alias keeps the call sites reading in the scenario domain's own vocabulary. */
const decimalStringToPtBr = wireToPtBr;

/** An ABSENT `feeOverrides` leaf becomes a BLANK string (re-resolve live), a PRESENT one becomes its
 *  pt-BR value (the seller's override, "ajustado por você") — shared by the scalar-form reopen (T014)
 *  and the KIT-basis rollup (T024), the two places a `ScenarioChannelIntent[]` becomes form channels. */
function channelIntentToForm(c: ScenarioConfig["channels"][number]): ChannelSlotForm {
  const overrideOrBlank = (leaf: string | undefined): string =>
    leaf === undefined ? "" : decimalStringToPtBr(leaf);
  return {
    marketplace: c.marketplace as MarketplaceId,
    modality: (c.modality ?? "") as Modality,
    // T068 — ausente vira "", que e o estado "sem categoria" do formulario. Um cenario de antes do
    // 014 reabre identico ao que reabria (SC-809).
    category: c.category ?? "",
    // 016/PR-F (US17/US16) — mesma regra: ausente vira "" / [], o estado "nao respondido" do
    // formulario. Um cenario de antes deste eixo reabre identico ao que reabria (FR-926 ultima
    // clausula, US16-AC2).
    sellerType: (c.sellerType ?? "") as ChannelSlotForm["sellerType"],
    highVolume: (c.highVolume ?? "") as ChannelSlotForm["highVolume"],
    surcharges: c.surcharges ?? [],
    commissionPct: overrideOrBlank(c.feeOverrides?.commissionPct),
    fixedFee: overrideOrBlank(c.feeOverrides?.fixedFee),
    minPerItem: overrideOrBlank(c.feeOverrides?.minPerItem),
    freightCost: overrideOrBlank(c.feeOverrides?.freightCost),
  };
}

/** Everything AD-HOC-shaped a scenario save persists as the cost basis, stripped of the fields that
 *  live at the envelope's OWN root (`channels[]`, `otherCosts[]`) or are catalog provenance
 *  (`catalogVersion`) — those are never duplicated into `costBasis.lastKnown` (data-model §3). */
function stripBasisOnlyFields(input: PriceInput): PriceInput {
  const rest: PriceInput = { ...input };
  delete rest.channels;
  delete rest.otherCosts;
  delete rest.catalogVersion;
  return rest;
}

/**
 * SAVE direction (T009/T010). Builds the config document from the Calcular page's live state:
 * `values`/`channelOutcomes` come straight off `computeFromForm` — nothing is re-derived, re-parsed
 * or re-computed here. Returns `null` when there is nothing valid to save (an invalid form has no
 * `parsedInput` — `computeFromForm` only returns one on a fully valid pass), so the caller can
 * disable the save affordance rather than persist a broken intent.
 *
 * PR-A scope note (flagged, not inferred): the Calcular page has no persistent catalog-product
 * binding (unlike a BOM line), so every scenario saved from Calcular itself is `AD_HOC`.
 *
 * 010/T021b (PR-B) — `productRef`: when the caller (`ProdutoPage`, which mounts this SAME form body
 * over a SAVED product, T030) is editing a saved product, it hands its `{id, name}` here so the
 * captured basis is `PRODUCT` instead of `AD_HOC` — closing FR-606a on the UI side (the backend
 * D3/D6 lifecycle, T011/T022, was already live). A `KIT` basis is out of THIS function's scope
 * (Calcular/ProdutoPage are single-piece surfaces); Q12 kit-basis composition is T024.
 */
export function buildScenarioConfig(args: {
  values: CalcFormValues;
  channelOutcomes: readonly ChannelSlotOutcome[];
  parsedInput: PriceInput | null;
  productRef?: ScenarioBasisRef;
}): ScenarioConfig | null {
  const { values, channelOutcomes, parsedInput, productRef } = args;
  if (parsedInput === null) return null;

  const channels: ScenarioChannelSlotState[] = values.channels.map((slot, i) => {
    const edited = channelOutcomes[i]?.editedFields ?? {};
    const field = (name: ChannelFieldName) => {
      const v = edited[name];
      return { value: v ?? 0, overridden: v !== undefined };
    };
    return {
      marketplace: slot.marketplace,
      modality: slot.modality,
      category: slot.category,
      sellerType: slot.sellerType,
      highVolume: slot.highVolume,
      surcharges: slot.surcharges,
      commissionPct: field("commissionPct"),
      fixedFee: field("fixedFee"),
      minPerItem: field("minPerItem"),
      freightCost: field("freightCost"),
    };
  });

  return serializeScenarioConfig({
    includeMarketplace: values.includeMarketplace !== false,
    costBasis: productRef
      ? serializeProductBasis(productRef, stripBasisOnlyFields(parsedInput))
      : serializeAdHocBasis(stripBasisOnlyFields(parsedInput)),
    channels,
    // `parsedInput.otherCosts` is `computeFromForm`'s ALREADY-VALID, already-parsed rows (a bad row
    // never reaches it) — re-parsing the raw pt-BR strings here would duplicate validation the model
    // already did and could disagree with it.
    otherCosts: (parsedInput.otherCosts ?? []).map((c) => ({ name: c.name, value: c.value })),
  });
}

/** REOPEN direction (T014). What the page hands to `setValue`/`replace` to restore a scenario into
 *  the live calculator form — plain pt-BR strings, nothing computed. A non-overridden channel field
 *  (`feeOverrides` leaf absent) becomes a BLANK string, not a zero: blank is what the existing
 *  `computeFromForm`/`fee-prefill.ts` path reads as "re-resolve from today's catalog" — a zero would
 *  instead look like a real manual override of R$ 0,00 (the exact bug this must not reintroduce). */
export interface ScenarioFormPatch {
  scalars: Partial<Record<CalcFieldName, string>>;
  includeMarketplace: boolean;
  channels: ChannelSlotForm[];
  otherCosts: OtherCostForm[];
  /** 016/T036 (US10, FR-913) — retired leaves (`wasteGrams`) a pre-4.0.0 document still carries in
   *  `lastKnown`. Hydrated via `stripRetiredFields` (pricing-core, the ONE place that knows the
   *  field existed) instead of quietly dropping the key: the page reads this to DECLARE the
   *  discard where the simulation reopens, so the reader knows the recompute below excludes it
   *  instead of guessing why the price moved. Empty for a document that never carried it. */
  discarded: DiscardedField[];
}

export function applyScenarioConfig(config: ScenarioConfig): ScenarioFormPatch {
  // PR-A scope note: a KIT cost basis has no scalar `PriceInput` to hydrate the single-piece
  // calculator with (its `lastKnown` is a per-line list, not one input) — the Calcular page never
  // produces one to begin with (see `buildScenarioConfig`), so reopening one here is out of scope;
  // the scalar patch is simply empty and the seller's current fields are left as they are. Q12 kit
  // composition is PR-B/T024. A PRODUCT basis is treated exactly like AD_HOC: PR-A never re-resolves
  // it live (D3/D6 is the read-time resolver added in PR-B/T022) — `lastKnown` is what both carry.
  const lastKnown = config.costBasis.kind === "KIT" ? null : config.costBasis.lastKnown;
  const scalars: Partial<Record<CalcFieldName, string>> = {};
  let discarded: DiscardedField[] = [];
  if (lastKnown) {
    const stripped = stripRetiredFields(lastKnown);
    discarded = stripped.discarded;
    for (const name of CALC_FIELD_NAMES) {
      const leaf = stripped.kept[name];
      if (typeof leaf === "string") scalars[name] = decimalStringToPtBr(leaf);
    }
  }

  const channels: ChannelSlotForm[] = config.channels.map(channelIntentToForm);

  const otherCosts: OtherCostForm[] = config.otherCosts.map((c) => ({
    name: c.name,
    value: decimalStringToPtBr(c.value),
  }));

  return {
    scalars,
    includeMarketplace: config.includeMarketplace,
    channels,
    otherCosts,
    discarded,
  };
}

/**
 * 010/T024 (E5, PR-B US3, Q12 owner-decided) — the KIT-basis reopen. A single-piece scalar patch
 * cannot hydrate a multi-piece basis, so a KIT-basis scenario gets its OWN read-only recompute
 * instead of populating the calculator form: the scenario's ONE shared `channels[]` intent is
 * applied UNIFORMLY to every kit line's `lastKnown` input (Q12), each line goes through the SAME
 * `computeFromForm` path a scalar reopen uses (so the honesty cases — a non-overridden slot
 * re-resolving live, an uncovered slot's "sem referência", a saved ≥100% commission override —
 * fall out for free, FR-609), and the resulting `PriceInput`s are hard down `computeBom` for the
 * per-marketplace rollup. **No `pricing-core` change** (both `computeCalculator`/`computeBom` are
 * reused verbatim); this module orchestrates, it does not price.
 *
 * Returns `null` for a non-KIT basis (the caller's cue to render the ordinary scalar form instead).
 */
export interface ScenarioKitLineOutcome {
  name: string | null;
  quantity: number;
  /** `false` ⇒ this line's channels/scalars failed to parse — excluded from `bom`, never silently
   *  zeroed (mirrors the kit composer's own `excludedLineCount` convention). */
  ok: boolean;
}

export interface ScenarioKitRollup {
  lines: ScenarioKitLineOutcome[];
  excludedLineCount: number;
  /** `null` when EVERY line was excluded — never a fake all-zero rollup. */
  bom: BomResult | null;
  /** 010/T035+T036 (E5, PR-C, US7) — the freeze-ready twin of `bom.lines`, 1:1 (only the lines that
   *  actually reached the rollup; an excluded line has no numbers to itemize, mirroring the kit
   *  composer's own `frozenKitLines` convention). Lets the E4 bridge freeze EXACTLY what this rollup
   *  priced — no re-derivation, no second pass over the config. */
  frozenLines: readonly { input: PriceInput; quantity: number; name: string | null }[];
  /** 016/T036 (US10, FR-913) — retired leaves found across ANY line's `lastKnown`, deduped by
   *  field. A line that carries `wasteGrams` recomputes WITHOUT it (never `ok:false` for that
   *  reason alone — `stripRetiredFields` removes the leaf before the scalar form is built) and the
   *  discard is declared HERE instead, once, for the whole kit rollup. */
  discarded: DiscardedField[];
}

export function computeScenarioKitChannels(
  config: ScenarioConfig,
  ctx?: CatalogContext,
): ScenarioKitRollup | null {
  if (config.costBasis.kind !== "KIT") return null;
  const channels = config.channels.map(channelIntentToForm);
  const lineOutcomes: ScenarioKitLineOutcome[] = [];
  const bomLines: { input: PriceInput; quantity: number; name: string | null }[] = [];
  const discardedFields = new Set<DiscardedField["field"]>();
  const discarded: DiscardedField[] = [];

  for (const line of config.costBasis.lastKnown.lines) {
    const stripped = stripRetiredFields(line.input);
    for (const d of stripped.discarded) {
      if (!discardedFields.has(d.field)) {
        discardedFields.add(d.field);
        discarded.push(d);
      }
    }
    const scalars: Partial<Record<CalcFieldName, string>> = {};
    for (const name of CALC_FIELD_NAMES) {
      const leaf = stripped.kept[name];
      if (typeof leaf === "string") scalars[name] = decimalStringToPtBr(leaf);
    }
    const formValues: CalcFormValues = {
      ...defaultCalcValues,
      ...scalars,
      includeMarketplace: config.includeMarketplace,
      channels,
      otherCosts: [],
    };
    const outcome = computeFromForm(formValues, ctx);
    const ok = outcome.ok && outcome.input !== null;
    lineOutcomes.push({ name: line.name, quantity: line.quantity, ok });
    if (ok) bomLines.push({ input: outcome.input!, quantity: line.quantity, name: line.name });
  }

  return {
    lines: lineOutcomes,
    excludedLineCount: lineOutcomes.filter((l) => !l.ok).length,
    bom: bomLines.length > 0 ? computeBom(bomLines) : null,
    frozenLines: bomLines,
    discarded,
  };
}

/** 016/T036 (US10, FR-913) — the DECLARATION the page renders where a scenario reopens: names the
 *  pt-BR field ("Desperdício (g)"), never the wire key (`wasteGrams`). `null` when there is
 *  nothing to declare (the common case — a document saved under 4.0.0 never carries a retired
 *  leaf) so the caller can render nothing rather than an empty banner. Pure, no side effect. */
export function discardedFieldNotice(discarded: readonly DiscardedField[]): string | null {
  if (discarded.length === 0) return null;
  const labels = messages.scenarios.discardedFieldLabels;
  const names = discarded.map((d) => labels[d.field] ?? d.field).join(", ");
  return messages.scenarios.discardedFieldNotice.replace("{campo}", names);
}
