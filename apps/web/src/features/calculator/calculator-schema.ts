import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";

import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import type { SelectOption } from "@/shared/ui";

// RHF + Zod schema for the E1 calculator form. It parses the raw pt-BR/BRL form strings into
// the numbers `pricing-core` expects and rejects bad input with a per-field pt-BR message —
// the fix TD-020 asked for (never silently coerce a bad string to 0). It surfaces the mandatory
// inputs (FR-001..003,005..009,017,018), the optional-core ones (FR-004,010..013) and the US4
// labor cost (laborHours/laborRatePerHour — optional, default 0). All optionals default to 0/null
// in the engine. The US1 multi-channel marketplace fees and the US5 "Outros custos" sub-costs are
// NOT in this Zod object: each channel slot and each named sub-cost is parsed + validated per-item
// in the model so one bad item (e.g. commission ≥ 100%) errors only itself without hiding the rest.

const t = messages.calculator;

/** The 20 calculator fields — names mirror `pricing-core`'s `PriceInput` so a thrown
 *  `ValidationError.field` maps straight back to a form field. */
export const CALC_FIELD_NAMES = [
  "costPerRoll",
  "rollWeightKg",
  "printGrams",
  "printTimeHours",
  "avgPowerKw",
  "tariffPerKwh",
  "machineValue",
  "machineLifetimeHours",
  "maintenanceReservePerHour",
  "failurePct",
  "finishTimeHours",
  "finishRatePerHour",
  "laborHours",
  "laborRatePerHour",
  "markupVarejoPct",
  "markupAtacadoPct",
] as const;

export type CalcFieldName = (typeof CALC_FIELD_NAMES)[number];

// US1 — a channel slot: a marketplace + optional modality (ML Clássico/Premium, Amazon
// Profissional/Individual; Shopee/Outro have none) plus its manual fees. Values are pt-BR
// strings like the scalar fields; the model parses + gross-ups each slot in isolation.
export type MarketplaceId = "MERCADO_LIVRE" | "SHOPEE" | "AMAZON" | "OUTRO";
export type Modality = "CLASSICO" | "PREMIUM" | "PROFISSIONAL" | "INDIVIDUAL" | "";

/** 016/PR-F (US17, FR-926) — the Shopee seller-profile axis, asked as TWO questions (clarify Q6). Empty
 *  string = "not answered", which is the catch-all — the SAME behaviour every slot has today (byte-
 *  identical, FR-926's last clause). `highVolume` only means something when `sellerType === "CPF"`. */
export type SellerType = "CPF" | "CNPJ" | "";
export type HighVolume = "SIM" | "NAO" | "";

export interface ChannelSlotForm {
  marketplace: MarketplaceId;
  modality: Modality;
  /** 014/US1 — the marketplace category the piece is listed under. OPTIONAL as a gate (it never
   *  blocks a calculation) and PER SLOT: a category chosen for ML must not become the Amazon one.
   *  Empty string = not informed, which is a valid and permanent state (SC-809). */
  category?: string;
  /** 016/PR-F (US17, FR-926) — "Você vende como" (CPF/CNPJ). Absent/"" = not answered → catch-all. */
  sellerType?: SellerType;
  /** 016/PR-F (US17, FR-926) — "mais de 450 pedidos nos últimos 90 dias?", only asked when
   *  `sellerType === "CPF"`. Absent/"" = not answered → catch-all. */
  highVolume?: HighVolume;
  /** 016/PR-F (US16, FR-923, ADR-0027 §3.2) — ids of the catalog's `optionalSurcharges` the seller
   *  checked for THIS slot (e.g. Shopee `MANUSEIO_VOLUMOSO`). Empty/absent = none checked, which is
   *  byte-identical to every slot before this axis existed (US16-AC2). */
  surcharges?: string[];
  commissionPct: string;
  fixedFee: string;
  minPerItem: string;
  freightCost: string;
}

/** The channel numeric fields the model validates per-slot (keys of the inline error map). */
export type ChannelFieldName = "commissionPct" | "fixedFee" | "minPerItem" | "freightCost";

// US5 — one "Outros custos" sub-cost: a free-text name + a pt-BR value string. 0..N of these replace
// 004's single `adminTotal`; their sum flows into custo_total exactly as the single field did.
export interface OtherCostForm {
  name: string;
  value: string;
}

/** The form's live value shape: one controlled pt-BR string per scalar field + N channel slots +
 *  the master "include marketplaces" toggle (US4) + the "Outros custos" named sub-costs (US5). */
export interface CalcFormValues extends Record<CalcFieldName, string> {
  channels: ChannelSlotForm[];
  includeMarketplace: boolean;
  otherCosts: OtherCostForm[];
}

type FieldKind = "required" | "prefilled" | "optional";

interface NumRule {
  kind: FieldKind;
  /** Must be strictly > 0 (a denominator, e.g. roll weight / machine lifetime). */
  positive?: boolean;
  /** Field-specific "> 0" message (defaults to the generic one). */
  positiveMessage?: string;
  /** Exclusive upper bound (n must be strictly < this, e.g. marketplace commission < 100%). */
  ltExclusive?: number;
  /** Message shown when the exclusive upper bound is hit (defaults to the generic one). */
  ltExclusiveMessage?: string;
}

/**
 * One reusable pt-BR/BRL number parser+validator. Distinguishes a truly BLANK field
 * (optional → 0; required → "obrigatório") from a NON-EMPTY but unparseable string
 * ("abc", "--" → "número válido"): a bad string is rejected, never coerced to 0.
 */
function numField(rule: NumRule) {
  return z.string().transform((raw, ctx): number => {
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") {
      if (rule.kind === "optional") return 0; // FR-023: untouched optional contributes 0
      ctx.addIssue({ code: "custom", message: t.validation.required });
      return z.NEVER;
    }
    // Visual affixes the user may type (R$, unit letters, spaces) are stripped by `parseDecimal`
    // itself — ANCHORED to the ends only (013/FA-05: the local unanchored strip that used to live
    // here concatenated across interior garbage, turning "5x3" into a valid "53").
    const n = parseDecimal(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: t.validation.invalid });
      return z.NEVER;
    }
    if (rule.positive) {
      if (n <= 0) {
        ctx.addIssue({ code: "custom", message: rule.positiveMessage ?? t.rollWeightError });
        return z.NEVER;
      }
    } else if (n < 0) {
      ctx.addIssue({ code: "custom", message: t.validation.negative });
      return z.NEVER;
    }
    if (rule.ltExclusive !== undefined && n >= rule.ltExclusive) {
      ctx.addIssue({ code: "custom", message: rule.ltExclusiveMessage ?? t.validation.invalid });
      return z.NEVER;
    }
    return n;
  });
}

/** The Zod object: raw `CalcFormValues` (strings) → validated numeric MVP input. */
export const calculatorSchema = z.object({
  costPerRoll: numField({ kind: "required" }),
  rollWeightKg: numField({ kind: "required", positive: true, positiveMessage: t.rollWeightError }),
  printGrams: numField({ kind: "required" }),
  printTimeHours: numField({ kind: "required" }),
  avgPowerKw: numField({ kind: "prefilled" }),
  tariffPerKwh: numField({ kind: "required" }),
  machineValue: numField({ kind: "required" }),
  machineLifetimeHours: numField({
    kind: "required",
    positive: true,
    positiveMessage: t.validation.machineLifetimePositive,
  }),
  maintenanceReservePerHour: numField({ kind: "optional" }),
  failurePct: numField({ kind: "optional" }),
  finishTimeHours: numField({ kind: "optional" }),
  finishRatePerHour: numField({ kind: "optional" }),
  laborHours: numField({ kind: "optional" }),
  laborRatePerHour: numField({ kind: "optional" }),
  markupVarejoPct: numField({ kind: "prefilled" }),
  markupAtacadoPct: numField({ kind: "prefilled" }),
});

/** Validated numeric MVP input (a subset of `pricing-core`'s `PriceInput`). */
export type CalcParsedInput = z.infer<typeof calculatorSchema>;

/**
 * RHF resolver built from `calculatorSchema` — the RHF↔Zod integration point. It keeps the
 * raw string `values` (the form stays a string form) and maps each Zod issue to the first
 * per-field message so inline errors wire up the standard RHF way.
 */
export const calculatorResolver: Resolver<CalcFormValues> = (values) => {
  const parsed = calculatorSchema.safeParse(values);
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<CalcFormValues> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as CalcFieldName | undefined;
    if (key && !errors[key]) errors[key] = { type: "validation", message: issue.message };
  }
  return { values: {}, errors };
};

// US1: the marketplace channel slot — a marketplace picker, its modality (when it has one) and
// the manual fees fed into the per-channel gross-up. The determinant selectors key the catalog
// pre-fill in US2; here they identify the channel and choose the modality-specific fee. Defined
// before `defaultCalcValues` so its `defaultChannelSlot()` reads a fully-initialized DEFAULT_MODALITY_ORDER.
export const MARKETPLACE_OPTIONS: readonly SelectOption[] = [
  { value: "MERCADO_LIVRE", label: t.marketplaceNames.MERCADO_LIVRE },
  { value: "SHOPEE", label: t.marketplaceNames.SHOPEE },
  { value: "AMAZON", label: t.marketplaceNames.AMAZON },
  { value: "OUTRO", label: t.marketplaceNames.OUTRO },
];

/**
 * 016/US12 (T052, FR-918, arquitetura-016 §F.2) — the RENDER-facing modality options are no longer a
 * table here: `channel-field-plan.ts:channelFieldPlan` derives them live from the catalog's
 * `determinantsSchema`, which is what "dirigido pelo schema" means (a marketplace that changes its
 * declared axes changes the form with no code edit).
 *
 * This table SURVIVES, privately, for exactly one job: which modality a BRAND NEW slot starts on
 * (`defaultChannelSlot`/`slotResetOnMarketplaceChange`, below) — a UX default, not a rendered choice
 * list. Measured, deliberate deviation from deriving it too: the catalog's own `determinantsSchema`
 * order for Amazon is `["INDIVIDUAL", "PROFISSIONAL"]` (`seed.ts`/`catalog.json`), and Amazon's ONLY
 * catch-all fee entry is keyed to `plan: "PROFISSIONAL"` — deriving the default from catalog order
 * would flip the seed's default modality to INDIVIDUAL, for which no catch-all entry exists, and
 * silently change the seed price every test in this codebase pins (015/A11's own comment names this
 * exact dependency). FR-919 asks for byte-identical results on today's supported combinations; this
 * table is what keeps the DEFAULT one of them from moving.
 */
const DEFAULT_MODALITY_ORDER: Record<MarketplaceId, readonly SelectOption[]> = {
  MERCADO_LIVRE: [
    { value: "CLASSICO", label: t.modalityNames.CLASSICO },
    { value: "PREMIUM", label: t.modalityNames.PREMIUM },
  ],
  AMAZON: [
    { value: "PROFISSIONAL", label: t.modalityNames.PROFISSIONAL },
    { value: "INDIVIDUAL", label: t.modalityNames.INDIVIDUAL },
  ],
  SHOPEE: [],
  OUTRO: [],
};

/**
 * A fresh channel slot — defaults to the marketplace's first modality (or none) + blank fees.
 *
 * 015/A11 (`[F11a-006]`, decisão do dono 2026-08-03) — o padrão era `MERCADO_LIVRE`, e o catálogo
 * servido devolve `entries: []` para ele enquanto a fatia ML (US6) não existir. A primeira
 * impressão do recurso, sem o vendedor tocar em nada, era um painel dizendo "sem referência —
 * informe as taxas" e **nenhum preço** — justamente sobre o canal mais usado no Brasil.
 *
 * Isto entra JUNTO com o `[F11a-007]`, e a ordem importa: sozinha, esta troca levaria o produto
 * para a metade PIOR do par — a Amazon sem categoria aplica "a maior alíquota da tabela", e o campo
 * "Comissão" ficaria em branco ao lado de um preço já descontado. Com o `[F11a-007]`, o campo passa
 * a mostrar a alíquota aplicada como referência, e aí a troca é ganho puro.
 *
 * É MITIGAÇÃO, não conserto: o ML continua sem tabela, e quem o escolher continua vendo a mensagem
 * honesta de sempre. O conserto é a US6. Quando houver tarifa, o padrão volta — é uma linha.
 */
export function defaultChannelSlot(marketplace: MarketplaceId = "AMAZON"): ChannelSlotForm {
  return {
    marketplace,
    modality: (DEFAULT_MODALITY_ORDER[marketplace][0]?.value ?? "") as Modality,
    sellerType: "",
    highVolume: "",
    surcharges: [],
    commissionPct: "",
    fixedFee: "",
    minPerItem: "",
    freightCost: "",
  };
}

/**
 * What a slot's marketplace-dependent fields become when the seller changes its marketplace
 * (014/T097).
 *
 * The category is PER MARKETPLACE — Amazon's "relogios" means nothing on Mercado Livre — so it must
 * go with the modality, not survive it. It used to survive, and INVISIBLY: the picker renders its
 * empty-spine branch before its chosen-value branch, so the stale id had no chip and no "Limpar" for
 * the seller to undo something they could not see, while it kept being sent as a determinant.
 *
 * One place decides this, because three copies of the same rule is how one of them gets left
 * behind — which is precisely what happened to the category in all three change handlers.
 */
export function slotResetOnMarketplaceChange(marketplace: MarketplaceId): {
  modality: Modality;
  category: string;
  sellerType: SellerType;
  highVolume: HighVolume;
  surcharges: string[];
} {
  return {
    modality: (DEFAULT_MODALITY_ORDER[marketplace][0]?.value ?? "") as Modality,
    category: "",
    // 016/PR-F — the same argument as `category`: "CPF_ALTO_VOLUME" means nothing outside Shopee, and
    // a catalog id checked on Shopee (`MANUSEIO_VOLUMOSO`) means nothing on another marketplace either.
    sellerType: "",
    highVolume: "",
    surcharges: [],
  };
}

/** A fresh, blank "Outros custos" row (US5). Blank name is accepted — the UI shows a neutral
 *  placeholder and the breakdown falls back to a generic label (FR-116). */
export function defaultOtherCost(): OtherCostForm {
  return { name: "", value: "" };
}

/** The channel numeric fields shown as a compact 2-col grid, with pt-BR labels + affixes. */
export const CHANNEL_FEE_FIELDS: readonly {
  name: ChannelFieldName;
  label: string;
  currency?: boolean;
  unit?: string;
}[] = [
  { name: "commissionPct", label: t.channels.commission, unit: "%" },
  { name: "fixedFee", label: t.channels.fixedFee, currency: true },
  { name: "minPerItem", label: t.channels.minPerItem, currency: true },
  { name: "freightCost", label: t.channels.freight, currency: true },
];

/** UX starting values (pt-BR strings). Required/prefilled ship an editable value so the
 *  page renders a coherent price on load; optional-core fields start at 0 (de-emphasized,
 *  contribute nothing until touched — FR-023). */
export const defaultCalcValues: CalcFormValues = {
  costPerRoll: "100,00",
  rollWeightKg: "1",
  printGrams: "100",
  printTimeHours: "5",
  avgPowerKw: "0,12",
  tariffPerKwh: "1,00",
  // 016/T030-reverify — semente já agrupada: a máscara de milhar (B2) formata no BLUR, então uma
  // semente crua exibia "R$ 4000,00" até o primeiro toque. parseDecimal lê as duas formas igual
  // (provado na re-verificação: pós-blur o campo vira "4.000,00" e o custo segue R$ 16,16). É o
  // único campo currency da semente com 4+ dígitos.
  machineValue: "4.000,00",
  // 016/PR-C homologação (B1) — 2000h não é produto de RITMO × payback nenhum, então a primeira
  // visita nascia no modo "ajustar" mostrando o campo que o dono aposentou (US8). 3600 = 1200
  // h/ano ("quase todo dia") × 3 anos — o próprio exemplo da spec/tooltip — nasce no modo ritmo,
  // com "Quase todo dia" + 3 anos selecionados e "≈ R$ 1,11 por hora" dito em voz alta.
  // CONSEQUÊNCIA ASSUMIDA: o preço-semente muda (máquina R$ 2,00/h → R$ 1,11/h; custo total
  // R$ 20,60 → R$ 16,16; varejo R$ 30,90 → R$ 24,24; atacado R$ 26,78 → R$ 21,01 — conferido
  // rodando computeCalculator com este seed, não chutado).
  machineLifetimeHours: "3600",
  maintenanceReservePerHour: "0",
  failurePct: "0",
  finishTimeHours: "0",
  finishRatePerHour: "0",
  laborHours: "0",
  laborRatePerHour: "0",
  markupVarejoPct: "50",
  markupAtacadoPct: "30",
  channels: [defaultChannelSlot()],
  includeMarketplace: true,
  // Starts empty — 0 sub-costs is behaviourally identical to 004's `adminTotal: 0` (admin = 0).
  otherCosts: [],
};

/** Render metadata (label, unit, requiredness) so the page maps fields → DS controls. */
export interface CalcFieldMeta {
  name: CalcFieldName;
  label: string;
  /** Show the R$ prefix. */
  currency?: boolean;
  /** Unit suffix, e.g. "kg", "g", "h", "kW", "%", "/kWh". */
  unit?: string;
  /** Always-visible clarifying hint (e.g. the avgPower tooltip). */
  hint?: string;
  /** 016/US6 (FR-908) — the didactic ⓘ tooltip (label for the trigger + explanatory body). Never
   *  present for a field outside the 9 researched in `conteudo-tooltips.md`. */
  tip?: { label: string; body: string };
  /** True for the mandatory + pre-filled inputs (marked required); false for optional-core. */
  required: boolean;
  /** 019/PR-C (T060) — casas decimais que a máscara de blur preserva; só a tarifa (4). */
  precision?: number;
}

/**
 * 016/US9 (FR-911, US9-AC2) — "Custos da peça": the old MANDATORY_FIELDS + OPTIONAL_FIELDS fused
 * into ONE section (the "Ajustes opcionais" title is retired). `printTimeHours` (US7 h+min) and
 * `machineValue`/`machineLifetimeHours` (US8 machine-cost question) are NOT here — they render
 * through their own dedicated controls (`TimeHmField`/`MachineCostFields` in calculator-form.tsx)
 * inside the SAME "Custos da peça" card, since neither fits the plain label+NumberField grid.
 */
export const COST_FIELDS: readonly CalcFieldMeta[] = [
  { name: "costPerRoll", label: t.fields.costPerRoll, currency: true, required: true },
  { name: "rollWeightKg", label: t.fields.rollWeight, unit: "kg", required: true },
  {
    name: "printGrams",
    label: t.fields.grams,
    unit: "g",
    tip: t.fieldTips.grams,
    required: true,
  },
  {
    name: "avgPowerKw",
    label: t.fields.avgPower,
    unit: "kW",
    hint: t.hints.avgPower,
    tip: t.fieldTips.avgPower,
    required: true,
  },
  {
    name: "tariffPerKwh",
    label: t.fields.tariff,
    currency: true,
    unit: "/kWh",
    precision: 4,
    tip: t.fieldTips.tariff,
    required: true,
  },
  {
    name: "maintenanceReservePerHour",
    label: t.fields.maintenance,
    currency: true,
    unit: "/h",
    tip: t.fieldTips.maintenance,
    required: false,
  },
  {
    name: "failurePct",
    label: t.fields.failure,
    unit: "%",
    tip: t.fieldTips.failure,
    required: false,
  },
] as const;

/** The subset of `COST_FIELDS` that is always required — `widgets/bom-line-editor` keeps only
 *  these (+ TimeHmField + MachineCostFields) ALWAYS visible, and folds the rest (below) under its
 *  own secondary disclosure (ux §1.3) alongside the labor/finish fields — the line-density UX
 *  US9 does not touch, only the field TAXONOMY it draws from. */
export const COST_REQUIRED_FIELDS: readonly CalcFieldMeta[] = COST_FIELDS.filter((f) => f.required);

/** The optional remainder of `COST_FIELDS` (maintenance/failure) — bom-line-editor's
 *  own secondary-disclosure grouping (see `COST_REQUIRED_FIELDS`). */
export const COST_OPTIONAL_FIELDS: readonly CalcFieldMeta[] = COST_FIELDS.filter(
  (f) => !f.required,
);

export const MARKUP_FIELDS: readonly CalcFieldMeta[] = [
  {
    name: "markupVarejoPct",
    label: t.fields.markupVarejo,
    unit: "%",
    hint: t.hints.markup,
    required: true,
  },
  { name: "markupAtacadoPct", label: t.fields.markupAtacado, unit: "%", required: true },
] as const;

/**
 * 016/US9 (FR-911, US9-AC2) — "Mão de obra e custos": labor (unchanged) + Tempo/Valor do
 * acabamento, migrated in from the old OPTIONAL_FIELDS. The "Outros custos" slot (US5) lives
 * alongside these fields on the page but is a named-sub-cost array, not a scalar field.
 */
export const LABOR_AND_FINISH_FIELDS: readonly CalcFieldMeta[] = [
  {
    name: "finishTimeHours",
    label: t.fields.finishTime,
    unit: "h",
    tip: t.fieldTips.finishTime,
    required: false,
  },
  {
    name: "finishRatePerHour",
    label: t.fields.finishRate,
    currency: true,
    unit: "/h",
    tip: t.fieldTips.finishRate,
    required: false,
  },
  {
    name: "laborHours",
    label: t.fields.laborHours,
    unit: "h",
    tip: t.fieldTips.laborHours,
    required: false,
  },
  {
    name: "laborRatePerHour",
    label: t.fields.laborRate,
    currency: true,
    unit: "/h",
    tip: t.fieldTips.laborRate,
    required: false,
  },
] as const;

/** The plain labor-only subset — bom-line-editor's secondary-disclosure grouping keeps the same
 *  member fields as `LABOR_AND_FINISH_FIELDS` (it renders the whole array; kept as a named alias
 *  so a future split does not have to touch three call sites at once). */
export const LABOR_FIELDS: readonly CalcFieldMeta[] = LABOR_AND_FINISH_FIELDS;

// 016/T072-R5 (2026-08-07) — the SAME "which scalar/channel field is currency" knowledge
// `NumberField`'s on-blur thousands mask reads via `meta.currency`/`CHANNEL_FEE_FIELDS[].currency`,
// re-exposed as plain name sets so `scenario-bridge.ts` can apply the identical formatter at
// RESTORE time (a reopened scenario used to write the raw wire string straight in — no mask, so a
// value ≥1000 lost its thousands separator on reopen even though the SAME field masks correctly on
// a normal blur). `machineValue` renders through its own dedicated control (`MachineCostFields`,
// not `COST_FIELDS`), so it is added explicitly — the one currency scalar with no `CalcFieldMeta`
// entry anywhere.
export const CURRENCY_FIELD_NAMES: ReadonlySet<CalcFieldName> = new Set([
  ...[...COST_FIELDS, ...LABOR_AND_FINISH_FIELDS].filter((f) => f.currency).map((f) => f.name),
  "machineValue",
]);

export const CHANNEL_CURRENCY_FIELD_NAMES: ReadonlySet<ChannelFieldName> = new Set(
  CHANNEL_FEE_FIELDS.filter((f) => f.currency).map((f) => f.name),
);

/** 016/US8 (FR-910) — "com que frequência ela roda": 3 options, none typed (SC-906). */
export const RITMO_OPTIONS: readonly SelectOption[] = [
  { value: "0", label: t.machineCost.ritmoOptions.few },
  { value: "1", label: t.machineCost.ritmoOptions.daily },
  { value: "2", label: t.machineCost.ritmoOptions.always },
];

/** 016/US8 (FR-910) — "em quantos anos quer que ela se pague": 1–5 anos, sem digitar. */
export const PAYBACK_YEAR_OPTIONS: readonly SelectOption[] = [1, 2, 3, 4, 5].map((years) => ({
  value: String(years),
  label: (years === 1 ? t.machineCost.paybackYearLabel : t.machineCost.paybackYearsLabel).replace(
    "{n}",
    String(years),
  ),
}));
