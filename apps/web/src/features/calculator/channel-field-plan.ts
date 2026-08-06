import type { FeeCatalog, Marketplace } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import type { ChannelFieldName, MarketplaceId } from "./calculator-schema";

// 016/US12 (FR-918, arquitetura-016 §F) — the ONE pure function that decides what a channel slot's
// section renders. It replaces the inference `calculator-form.tsx` used to make from
// `modalityOptions.length > 0` deciding BOTH the modality select AND the category picker (the F1
// defect the arquiteto measured: it works today only because Shopee has neither axis and ML/Amazon
// have both — the first marketplace with one but not the other would break silently).
//
// RA5 (arquitetura-016 §10): this SAME function feeds `slotDeterminants` (fee-prefill.ts) — one
// plan decides both what renders and what is SENT as a determinant, so the two can never drift.

const t = messages.calculator;

export interface ChannelFieldPlanDeterminant {
  key: string;
  kind: "SELECT" | "CATEGORY_PICKER";
  label: string;
  /** Absent for CATEGORY_PICKER (its options are the category spine, not a closed list). */
  options?: { value: string; label: string }[];
}

export interface ChannelFieldPlan {
  determinants: ChannelFieldPlanDeterminant[];
  /** Which of the 4 numeric fee fields render, IN THE CANONICAL ORDER (calculator-schema's
   *  CHANNEL_FEE_FIELDS order) — never the catalog's own array order, which is curation detail. */
  feeFields: readonly ChannelFieldName[];
}

/** The 4 fee fields, in the fixed display order — the plan filters this list, never reorders it. */
const ALL_FEE_FIELDS: readonly ChannelFieldName[] = [
  "commissionPct",
  "fixedFee",
  "minPerItem",
  "freightCost",
];

/**
 * Label registry for the determinant keys the catalog publishes today (`listingType` — ML,
 * `plan` — Amazon). Both read as "Modalidade" in the UI (the copy is about the axis's ROLE, not its
 * wire name) with option labels from `t.modalityNames`. `category` is deliberately NOT here — it is
 * governed by its own rule (categorySpine, not determinantsSchema options) per arquitetura-016 §F.2
 * rule 1, and is appended separately, always last, matching the UI order that existed before this
 * plan (modality selector before the category picker).
 */
const DETERMINANT_LABELS: Record<
  string,
  { label: string; optionLabel: (value: string) => string }
> = {
  listingType: {
    label: t.channels.modality,
    optionLabel: (v) => t.modalityNames[v as keyof typeof t.modalityNames] ?? v,
  },
  plan: {
    label: t.channels.modality,
    optionLabel: (v) => t.modalityNames[v as keyof typeof t.modalityNames] ?? v,
  },
};

const CATALOG_MARKETPLACES: readonly string[] = ["MERCADO_LIVRE", "AMAZON", "SHOPEE"];

/**
 * Derive what the section for `marketplace` should render, purely from the catalog it was handed.
 * `OUTRO` (and any id the catalog does not carry, e.g. a marketplace absent from an older cached
 * catalog) has no entry at all — the honest answer is "no determinants, the four fields" — which is
 * IDENTICAL to what the calculator has always shown for it (I4: absence = today's behaviour).
 */
export function channelFieldPlan(
  catalog: FeeCatalog,
  marketplace: MarketplaceId,
): ChannelFieldPlan {
  if (!CATALOG_MARKETPLACES.includes(marketplace)) {
    return { determinants: [], feeFields: ALL_FEE_FIELDS };
  }
  const mk = catalog.marketplaces.find((m) => m.marketplace === (marketplace as Marketplace));
  if (!mk) return { determinants: [], feeFields: ALL_FEE_FIELDS };

  // Rule 1: a determinant key appears sse `determinantsSchema` declares it with a NON-EMPTY option
  // list. `category` is excluded here even when the schema echoes it (the seed ships
  // `category: []`) — it is governed entirely by rule below, not by this generic loop.
  const determinants: ChannelFieldPlanDeterminant[] = [];
  const schema = mk.determinantsSchema as Record<string, unknown> | null | undefined;
  if (schema) {
    for (const [key, raw] of Object.entries(schema)) {
      if (key === "category") continue;
      if (!Array.isArray(raw) || raw.length === 0) continue;
      const options = raw.filter((v): v is string => typeof v === "string");
      if (options.length === 0) continue;
      const meta = DETERMINANT_LABELS[key];
      determinants.push({
        key,
        kind: "SELECT",
        label: meta?.label ?? key,
        options: options.map((value) => ({ value, label: meta?.optionLabel(value) ?? value })),
      });
    }
  }

  // Rule 1 (category clause): sse the marketplace publishes a non-empty categorySpine.
  if (mk.categorySpine != null && mk.categorySpine.length > 0) {
    determinants.push({ key: "category", kind: "CATEGORY_PICKER", label: t.categoryPicker.label });
  }

  // Rule 2: fee fields — sse the catalog declares `feeAxes` explicitly; ABSENT = the four fields
  // (I4 — a cached catalog from before this axis existed renders exactly as it always did).
  const feeAxes = (mk as { feeAxes?: readonly string[] | null }).feeAxes;
  const feeFields =
    feeAxes == null ? ALL_FEE_FIELDS : ALL_FEE_FIELDS.filter((f) => feeAxes.includes(f));

  return { determinants, feeFields };
}

/**
 * 016/US11 (T044 homologação PR-E, bloqueador) — closes the OTHER half of RA5 that the render-only
 * plan left open: `channelFieldPlan` decides what SHOWS, never what CHARGES. Switching a slot's
 * marketplace on an already-filled field (e.g. a typed "Frete" on ML) used to leave the value alone
 * — the field simply stopped rendering on the new marketplace (Amazon, `freightCost` outside its
 * `feeAxes`), and the number kept discounting the líquido with no control on screen naming it
 * (measured: −R$ 50, "Canal não-lucrativo", seal "ajustado por você", zero visible field).
 *
 * Returns ONLY the fields that must be blanked — every field the new plan still shows is left
 * untouched (its value, if any, keeps meaning what the seller typed). The caller (the marketplace
 * CHANGE handler) applies these onto the live form; a field with a value that survives a marketplace
 * switch because the NEW plan also shows it is not a leak, it is the seller's own number carrying
 * over on an axis that still exists.
 */
export function feeFieldsToBlankOnMarketplaceChange(
  catalog: FeeCatalog,
  marketplace: MarketplaceId,
): Partial<Record<ChannelFieldName, string>> {
  const plan = channelFieldPlan(catalog, marketplace);
  const blanked: Partial<Record<ChannelFieldName, string>> = {};
  for (const field of ALL_FEE_FIELDS) {
    if (!plan.feeFields.includes(field)) blanked[field] = "";
  }
  return blanked;
}
