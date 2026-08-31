import {
    type ChannelInput,
    type ChannelResult,
    computeCalculator,
    type OtherCostItem,
    type PriceInput,
    type PriceResult,
    ValidationError,
} from "@3dprecify/pricing-core";

import {
    type CalcFieldName,
    type CalcFormValues,
    type ChannelFieldName,
    type ChannelSlotForm,
    calculatorSchema,
} from "@/features/calculator/calculator-schema";
import {
    appliedBandFees,
    entryToChannelFees,
    feeSealState,
    type ResolvedChannelFees,
    resolveSlot,
    resolveSurcharges,
} from "@/features/calculator/fee-prefill";
import type { FeeSealState } from "@/features/calculator/fee-seal";
import type { CatalogSource, FeeCatalog, FeeEntry } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";

// Thin adapter for the E1 calculator. It is the ONLY seam between the pt-BR form strings and the
// canonical engine: parse + validate → computeCalculator (pricing-core, the single source of the
// formula — FR-036) → a view-ready outcome. The scalar cost fields gate the whole price (a bad
// denominator dooms the calc); each marketplace CHANNEL is parsed + gross-up'd in isolation so one
// bad slot (e.g. commission ≥ 100%) errors only itself while the siblings still compute (SC-107).

const t = messages.calculator;

// formatBRL moved to the shared pt-BR module (008 R7 — `features/bom` prints money through the
// same rule); re-exported here so every existing consumer keeps its import path.
export { formatBRL } from "@/shared/lib/decimal-ptbr";

export type CalcFieldErrors = Partial<Record<CalcFieldName, string>>;
export type ChannelSlotErrors = Partial<Record<ChannelFieldName, string>>;

/**
 * SC-817 / FR-014a — the engine priced this slot but REFUSED at least one level: that level's
 * announce falls outside every published band, so no rate covers it. `null` is the whole point —
 * pricing it off the neighbouring band would fill in the arithmetic the gap the source itself
 * leaves (the ML R$ 50,01–78,99 window), which FR-014a forbids filling in the catalog.
 */
export function isUnpriced(r: ChannelResult | null): boolean {
    return (
        r !== null &&
        r.error === null &&
        (r.precoAnuncioVarejo === null || r.precoAnuncioAtacado === null)
    );
}

/** One channel slot's outcome, aligned to `form.channels[i]`: inline pt-BR errors (empty when the
 *  slot is valid) + the engine's gross-up result (null when the slot has an error). `hasFee` is
 *  false while every fee is blank/0 — the UI then shows a hint instead of base==anúncio rows. `seal`
 *  is the honesty seal (where the fees came from); `freightIsEstimate` marks a subsidy-based freight. */
export interface ChannelSlotOutcome {
    errors: ChannelSlotErrors;
    result: ChannelResult | null;
    hasFee: boolean;
    seal: FeeSealState;
    freightIsEstimate: boolean;
    /** 010/T010 (E5) — which fee fields the seller EXPLICITLY typed into, and the number they typed
     *  (present regardless of whether the field currently validates). A field absent here was left
     *  blank and, when a catalog entry covers the slot, was pre-filled/re-resolved — never something
     *  the seller vouched for. This is the form-layer signal a scenario save maps 1:1 into
     *  `ScenarioChannelSlotState.{field}.overridden` (`entities/scenario/config-document.ts`); the
     *  feature layer never re-derives "did the user edit this" from the pt-BR strings itself. */
    editedFields: Partial<Record<ChannelFieldName, number>>;
    /** 015/A8 (`[F11a-007]`) — a alíquota/valor que o CATÁLOGO está aplicando num campo que o vendedor
     *  deixou em branco, para a UI mostrá-la como REFERÊNCIA em vez de um "0,00" que implica zero.
     *  Um campo ausente aqui NÃO tem valor único a mostrar (foi digitado, ou é governado por banda). */
    appliedFees: Partial<Record<ChannelFieldName, number>>;
    /** 016/PR-F homologação (A1) — true when `appliedFees.commissionPct`/`fixedFee` came from the price
     *  BAND that actually applied to this level (`appliedBandFees`, `fee-prefill.ts`) rather than a
     *  flat entry value. The UI adds a one-line disclosure ("tabela por faixa de preço…") only then —
     *  a flat reference needs no such caveat, and showing it there would be noise, not honesty. */
    appliedFeesFromBand: boolean;
    /** 016/PR-F homologação (A1) — the `fixedFeeRule.pct` `appliedFees.fixedFee` was RESOLVED from
     *  (Shopee "50% do preço" abaixo de R$ 8), or `null` for a plain constant fee. The UI appends an
     *  honest "(= {pct}% do preço)" suffix so the number is never read as a flat fee that happens not
     *  to move. */
    appliedFixedFeeRulePct: number | null;
    /** 016/PR-F (T057, FR-928 area) — a procedência PRÓPRIA da taxa fixa, quando a entrada carrega uma
     *  (Amazon INDIVIDUAL — a comissão sai de uma página, a tarifa por item de outra). `null` quando a
     *  entrada não carrega uma, ou quando as taxas não vieram do catálogo (manual/sem referência) — a
     *  procedência é do NÚMERO do catálogo, nunca do que o vendedor digitou. */
    fixedFeeSource: { source: string; sourceUrl: string; effectiveDate: string } | null;
}

/** The resolved fee catalog + where it came from + the clock, for the honesty seal + pre-fill. */
export interface CatalogContext {
    catalog: FeeCatalog;
    source: CatalogSource;
    now: number;
}

export interface CalcOutcome {
    /** True when every scalar field parsed/validated and the engine returned a price. */
    ok: boolean;
    /** Per-field pt-BR validation messages for the scalar inputs (empty when ok). */
    fieldErrors: CalcFieldErrors;
    /** The computed breakdown + prices, or null when a scalar input is invalid. */
    result: PriceResult | null;
    /** The EXACT engine input `result` was computed from, or null when invalid (008 R7): the BOM
     *  page reads it so a BOM line and the single-piece calculator derive from ONE `PriceInput`
     *  (`computeBom` then reproduces `result` per line byte-for-byte — SC-402 by construction). */
    input: PriceInput | null;
    /** Per-slot channel outcomes, aligned to `values.channels` (empty when the scalars are invalid). */
    channels: ChannelSlotOutcome[];
    /** Per-row "Outros custos" value errors (US5), aligned to `values.otherCosts`; `undefined` = ok.
     *  Empty when the scalars are invalid. A bad row errors only itself — the price still computes. */
    otherCostErrors: (string | undefined)[];
}

const CHANNEL_NUM_FIELDS: readonly ChannelFieldName[] = [
    "commissionPct",
    "fixedFee",
    "minPerItem",
    "freightCost",
];

/**
 * Parse ONE channel slot's pt-BR fee strings in isolation. A blank numeric field is an untouched
 * optional (→ 0). A non-numeric string, a negative value, or a commission ≥ 100% is an inline
 * per-field error (pt-BR) that fails ONLY this slot — never a silent clamp, never a NaN.
 * `hasManualInput` is true when the user typed into ANY fee field (the signal that they are entering
 * or overriding fees rather than accepting a catalog pre-fill).
 */
function parseManualFees(slot: ChannelSlotForm): {
    nums: Record<ChannelFieldName, number>;
    errors: ChannelSlotErrors;
    hasManualInput: boolean;
    editedFields: Partial<Record<ChannelFieldName, number>>;
} {
    const errors: ChannelSlotErrors = {};
    const nums: Record<ChannelFieldName, number> = {
        commissionPct: 0,
        fixedFee: 0,
        minPerItem: 0,
        freightCost: 0,
    };
    const editedFields: Partial<Record<ChannelFieldName, number>> = {};
    let hasManualInput = false;
    for (const f of CHANNEL_NUM_FIELDS) {
        const raw = (slot[f] ?? "").trim();
        if (raw === "") continue; // untouched optional → 0
        hasManualInput = true;
        // Affixes are stripped INSIDE `parseDecimal`, anchored to the ends (013/FA-05) — the local
        // unanchored strip that used to live here turned "5x3" into a valid "53".
        const n = parseDecimal(raw);
        if (!Number.isFinite(n)) {
            errors[f] = t.validation.invalid;
        } else if (n < 0) {
            errors[f] = t.validation.negative;
        } else {
            nums[f] = n;
            // Edited-but-unparseable is not a value a scenario save could persist; every OTHER typed
            // field still records the number the seller typed, even one that will go on to fail the
            // commission-ceiling check below (a saved override may legitimately be an out-of-range one —
            // FR-609's "same inline per-slot error on reopen" case, T014).
            editedFields[f] = n;
        }
    }
    // Upper bound gets its own pt-BR message (the gross-up denominator 1 − c/100 must stay > 0).
    if (errors.commissionPct === undefined && nums.commissionPct >= 100) {
        errors.commissionPct = t.validation.commissionMax;
    }
    return { nums, errors, hasManualInput, editedFields };
}

interface SlotProcessing {
    input: ChannelInput | null;
    errors: ChannelSlotErrors;
    hasFee: boolean;
    seal: FeeSealState;
    freightIsEstimate: boolean;
    editedFields: Partial<Record<ChannelFieldName, number>>;
    /** 015/A8 ([F11a-007]) — as taxas do catálogo aplicadas a campos em branco, quando únicas. */
    appliedFees: Partial<Record<ChannelFieldName, number>>;
    /** 016/PR-F (T057) — a procedência própria da taxa fixa, quando ela veio do catálogo. */
    fixedFeeSource: { source: string; sourceUrl: string; effectiveDate: string } | null;
}

/**
 * 013 / E1-02 — the override seam, as a SELECTIVE MERGE.
 *
 * Typing ONE fee on a covered slot used to drop the catalog entry WHOLESALE (`priceBands:
 * undefined, freightVoucherBands: undefined`): the price bands vanished from the calculation, so
 * the price was computed at 0% commission — silently, under a seal that only claimed the fees had
 * been adjusted. That defect (the F1 note at the bottom) is the reason the merge is selective.
 *
 * **CORREÇÃO 2026-08-07 (hotfix 016/A2).** This docstring used to justify preserving
 * `freightVoucherBands` by saying that losing it "overstated the recebido líquido by exactly the
 * voucher". That justification is now FALSE, and a false comment in a money seam is the debt the
 * next dev believes: the verbatim sources attribute the R$ 20/30/40 to SHOPEE, not to the seller
 * ("*A Shopee oferece subsídios de frete para todos os vendedores*", art. 26839/23431), so
 * deducting it was the defect, not preserving it the fix. The catalog no longer emits the voucher
 * (`freight: {kind: "NONE"}` on both Shopee entries), and the field is DEPRECATED in the engine.
 *
 * The selective-merge RULE is unchanged and still right — it exists for `priceBands`. The
 * unconditional carry-through of `freightVoucherBands` also stays, for a different and still valid
 * reason: a scenario document saved BEFORE the hotfix (ADR-0021) may carry the field, and dropping
 * it on an edit would change that document's number for a reason the seller never asked for.
 *
 * The override now overwrites ONLY the scalars the seller actually TYPED. The signal is
 * `editedFields` (which fields were typed), NEVER truthiness — a typed `0` is a real override and
 * must win over the entry's value. `freightIsEstimate` follows the same rule: the "estimativa"
 * label belongs to the entry's subsidy, so it is dropped the moment the seller types their own
 * freight.
 *
 * OVERRIDE RULE (owner decision 2026-07-23, corrected by the confirmation audit F1): a typed
 * `commissionPct` means "my commission is X, not the catalog's" → the price-band schedule DROPS and
 * the typed commission governs. Everything else — freight, minPerItem, AND a typed `fixedFee` — does
 * NOT drop the schedule: on a band entry `pricing-core/channels.ts` takes commissionPct+fixedFee from
 * the band containing the announce, so a typed fixedFee is simply inert there (the price stays
 * correct), and on a non-band entry (no schedule to drop) it overrides the scalar as expected.
 * `freightVoucherBands` (a freight dimension, orthogonal to commission) is preserved unconditionally
 * — DEPRECATED since the 016/A2 hotfix, carried only for documents saved before it (see above).
 *
 * WHY fixedFee must NOT trigger the drop (the F1 bug): Shopee's entry has NO top-level commissionPct
 * (`seed.ts` — it lives in the bands), so `entryToChannelFees` reads `null ?? 0`. Dropping the bands
 * on a fixedFee-only edit therefore fell back to commissionPct 0 → the gross-up charged 0% instead of
 * 14–20%, overstating the seller's net by the full commission. A silent-money defect: the exact class
 * E1-02 exists to kill. So only `commissionPct` drops the schedule.
 */
function resolveSlotFees(
    entry: FeeEntry | null,
    manual: ReturnType<typeof parseManualFees>,
): ResolvedChannelFees {
    if (entry === null) {
        return {
            ...manual.nums,
            priceBands: undefined,
            freightVoucherBands: undefined,
            freightIsEstimate: false,
        };
    }
    const base = entryToChannelFees(entry);
    if (!manual.hasManualInput) return base; // blank slot → the pre-fill, untouched
    const edited = manual.editedFields;
    // Only a typed commission drops the schedule (see the docstring's F1 note). A typed fixedFee must
    // NOT — on a band entry the band still governs fixedFee (typed value inert, price correct); on a
    // non-band entry there is no schedule, so the scalar override below applies normally.
    const commissionOverridden = edited.commissionPct !== undefined;
    // `bandMode` describes how a SCHEDULE combines, so it leaves with the schedule. Left behind it would
    // claim "progressive" over a flat typed commission — a label contradicting the number beside it.
    const { bandMode, ...withoutMode } = base;
    return {
        ...withoutMode,
        priceBands: commissionOverridden ? undefined : base.priceBands,
        ...(commissionOverridden || !bandMode ? {} : { bandMode }),
        commissionPct: edited.commissionPct ?? base.commissionPct,
        fixedFee: edited.fixedFee ?? base.fixedFee,
        minPerItem: edited.minPerItem ?? base.minPerItem,
        freightCost: edited.freightCost ?? base.freightCost,
        freightIsEstimate: edited.freightCost === undefined && base.freightIsEstimate,
    };
}

/**
 * Resolve ONE slot's effective fees + honesty seal. A covered marketplace+modality with NO typed
 * fees pre-fills from the catalog (reference seal); any typed fee is a manual override ("ajustado por
 * você" over a covered combo, else "sem referência"). A per-field error fails only this slot (SC-107).
 */
function processSlot(slot: ChannelSlotForm, ctx?: CatalogContext): SlotProcessing {
    const manual = parseManualFees(slot);
    // 014/US1: the category is a per-slot determinant, so it is read from THIS slot and never shared.
    // 016/PR-F (US17): sellerType/highVolume idem — per-slot, and only Shopee's plan asks them at all
    // (fee-prefill.ts:resolveShopeeSellerProfile ignores them on any other marketplace).
    const resolution = ctx
        ? resolveSlot(
              ctx.catalog,
              slot.marketplace,
              slot.modality,
              slot.category,
              slot.sellerType,
              slot.highVolume,
          )
        : { entry: null, originCategoryId: null, viaCatchAll: false };
    const entry = resolution.entry;

    if (Object.keys(manual.errors).length > 0) {
        return {
            input: null,
            errors: manual.errors,
            hasFee: false,
            seal: entry ? { kind: "adjusted" } : { kind: "none" },
            freightIsEstimate: false,
            editedFields: manual.editedFields,
            // slot com erro: nao ha taxa aplicada a exibir — o campo mostra o erro, nao referencia
            appliedFees: {},
            fixedFeeSource: null,
        };
    }

    // A blank slot accepts the catalog pre-fill wholesale (reference seal).
    const useCatalog = entry !== null && !manual.hasManualInput;
    const fees = resolveSlotFees(entry, manual);
    // The seal names the category the number is FOR — which may be an ANCESTOR of the chosen one,
    // because rates are piecewise-constant down the tree. Looked up from the spine that travels with
    // the catalog (D2), so there is no second artifact to fall out of sync with.
    const spine = ctx?.catalog.marketplaces.find(
        (m) => m.marketplace === slot.marketplace,
    )?.categorySpine;
    const originCategoryName =
        resolution.originCategoryId && spine
            ? (spine.find((n) => n.id === resolution.originCategoryId)?.name ?? null)
            : null;
    const seal: FeeSealState = useCatalog
        ? feeSealState({
              entry,
              source: ctx!.source,
              now: ctx!.now,
              edited: false,
              originCategoryName,
              viaCatchAll: resolution.viaCatchAll,
          })
        : entry
          ? { kind: "adjusted" }
          : { kind: "none" };
    // Provenance echoed onto the result — only when the fees actually came from the catalog (blank slot);
    // a manual override is not "from" the reference, so it carries no feeSource.
    const feeSource = useCatalog && entry ? entry.source : undefined;

    /**
     * 015/A8 (`[F11a-007]`, decisão do dono 2026-08-03) — a alíquota que ESTÁ sendo aplicada, para o
     * campo em branco mostrá-la como REFERÊNCIA em vez de "0,00".
     *
     * A tela media: com Amazon e sem categoria os quatro campos ficavam vazios com placeholder
     * "0,00" — lendo-se `Comissão 0,00 %` — enquanto "Preços por canal" mostrava um preço com 15%
     * já embutidos. O número que o vendedor procura primeiro estava em branco, e o selo que o
     * explicava era o elemento de menor peso visual do painel.
     *
     * TRÊS condições, e cada uma existe para não trocar uma mentira por outra:
     *   1. só quando as taxas vieram do CATÁLOGO (`useCatalog`) — o que o vendedor digitou ele já vê;
     *   2. só o campo que o vendedor NÃO digitou — senão a referência competiria com o número dele;
     *   3. só quando o valor é ÚNICO. Com `priceBands` a comissão varia por faixa e
     *      `entryToChannelFees` devolve `commissionPct ?? 0` — ou seja ZERO para uma entrada bandada.
     *      Publicar esse zero diria "Comissão 0,00%" com ar de verdade, que é exatamente o defeito.
     */
    const bandada = (fees.priceBands?.length ?? 0) > 0;
    const appliedFees: Partial<Record<ChannelFieldName, number>> = {};
    if (useCatalog) {
        const naoDigitou = (f: ChannelFieldName) => manual.editedFields[f] === undefined;
        // comissão e taxa fixa são governadas pela banda quando ela existe → sem valor único a mostrar
        if (!bandada && naoDigitou("commissionPct")) appliedFees.commissionPct = fees.commissionPct;
        if (!bandada && naoDigitou("fixedFee")) appliedFees.fixedFee = fees.fixedFee;
        if (naoDigitou("minPerItem")) appliedFees.minPerItem = fees.minPerItem;
        // o frete só tem valor único quando não há voucher por faixa (Shopee) governando
        if ((fees.freightVoucherBands?.length ?? 0) === 0 && naoDigitou("freightCost")) {
            appliedFees.freightCost = fees.freightCost;
        }
    }

    // 016/PR-F (US16, FR-923, ADR-0027 §3.2) — the surcharges the seller CHECKED for this slot,
    // resolved against the live catalog (RA5: not a value the form carries — the id is the intent, the
    // catalog owns the money, same contract as every other fee). Independent of `manual`/override
    // state: a checkbox is neither a typed fee nor a catalog pre-fill, so it survives both.
    const surcharges = ctx ? resolveSurcharges(ctx.catalog, slot.marketplace, slot.surcharges) : [];

    const hasFee =
        fees.commissionPct > 0 ||
        fees.fixedFee > 0 ||
        fees.minPerItem > 0 ||
        fees.freightCost > 0 ||
        (fees.priceBands?.length ?? 0) > 0 ||
        (fees.freightVoucherBands?.length ?? 0) > 0 ||
        surcharges.length > 0;

    return {
        input: {
            marketplace: slot.marketplace,
            feeDeterminants: slot.modality ? { modality: slot.modality } : undefined,
            feeSource,
            commissionPct: fees.commissionPct,
            fixedFee: fees.fixedFee,
            minPerItem: fees.minPerItem,
            priceBands: fees.priceBands,
            ...(fees.bandMode ? { bandMode: fees.bandMode } : {}),
            freightCost: fees.freightCost,
            freightVoucherBands: fees.freightVoucherBands,
            ...(surcharges.length > 0 ? { surcharges } : {}),
        },
        errors: {},
        hasFee,
        seal,
        freightIsEstimate: fees.freightIsEstimate,
        editedFields: manual.editedFields,
        appliedFees,
        // 016/PR-F (T057) — a procedência PRÓPRIA do fixo, só quando ela veio do CATÁLOGO (o mesmo
        // portão de `feeSource` acima) — um valor digitado não tem procedência de catálogo a mostrar.
        fixedFeeSource: useCatalog ? (entry?.fixedFeeSource ?? null) : null,
    };
}

/**
 * Parse the itemized "Outros custos" slot (US5). Each row's value is validated in isolation: a blank
 * value is an untouched row (contributes nothing, no engine item), a non-finite or negative value is
 * an inline per-row error that fails ONLY that row (never a NaN, FR-116). The name is free text — a
 * blank name is accepted (the UI shows a neutral placeholder). Returns the engine items (valid rows,
 * in order) alongside a per-row error array aligned to `forms`.
 */
function parseOtherCosts(forms: readonly { name: string; value: string }[]): {
    items: OtherCostItem[];
    errors: (string | undefined)[];
} {
    const items: OtherCostItem[] = [];
    const errors: (string | undefined)[] = [];
    for (const row of forms) {
        const raw = (row.value ?? "").trim();
        if (raw === "") {
            errors.push(undefined); // untouched row → 0, no engine item
            continue;
        }
        // Affixes are stripped INSIDE `parseDecimal`, anchored to the ends (013/FA-05) — the local
        // unanchored strip that used to live here turned "5x3" into a valid "53".
        const n = parseDecimal(raw);
        if (!Number.isFinite(n)) {
            errors.push(t.validation.invalid);
        } else if (n < 0) {
            errors.push(t.validation.negative);
        } else {
            errors.push(undefined);
            items.push({ name: (row.name ?? "").trim(), value: n });
        }
    }
    return { items, errors };
}

/**
 * Parse + validate the raw form strings, then compute. Returns per-field messages instead of ever
 * throwing or emitting a NaN/Infinity (SC-008). Valid channel slots are passed to the engine and
 * their gross-up results mapped back onto their form position; invalid slots carry inline errors.
 */
export function computeFromForm(values: CalcFormValues, ctx?: CatalogContext): CalcOutcome {
    const parsed = calculatorSchema.safeParse(values);
    if (!parsed.success) {
        const fieldErrors: CalcFieldErrors = {};
        for (const issue of parsed.error.issues) {
            const key = issue.path[0] as CalcFieldName | undefined;
            if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        return {
            ok: false,
            fieldErrors,
            result: null,
            input: null,
            channels: [],
            otherCostErrors: [],
        };
    }

    // US5 — the "Outros custos" slot is parsed outside the Zod object (like the channels): each named
    // sub-cost's value is validated per-row so one bad row errors only itself while the price computes.
    const { items: otherCosts, errors: otherCostErrors } = parseOtherCosts(values.otherCosts ?? []);

    try {
        // Map the flat form onto the 3.0.0 engine shape (ADR-0011): the itemized "Outros custos" rows
        // become `otherCosts[]` (each named sub-cost sums into custo_total + shows its own breakdown line,
        // FR-114/115); the channel slots become `channels[]` with catalog pre-fill applied per slot.
        const cost = parsed.data;
        // US4 — the master "Incluir marketplaces no preço" toggle (default on). When off, the marketplace
        // section is hidden and NO channel is computed (an empty channels[] → the headline is the direct
        // cost×markup exactly, with no fee ever folded into custo_total — SC-105).
        const includeMarketplace = values.includeMarketplace !== false;
        const slots = includeMarketplace ? (values.channels ?? []) : [];
        const processed = slots.map((slot) => processSlot(slot, ctx));
        const engineChannels = processed
            .map((p) => p.input)
            .filter((x): x is ChannelInput => x !== null);
        // Stamp the catalog version ONLY when at least one channel actually resolved its fees from the
        // catalog (a slot carries `feeSource` iff it used the pre-fill). An all-manual calc records no
        // catalog provenance — "null when all-manual" (ADR-0011), so a future saved quote isn't mislabelled.
        const usedCatalog = processed.some((p) => p.input?.feeSource != null);
        const input: PriceInput = {
            ...cost,
            otherCosts,
            channels: engineChannels,
            catalogVersion: usedCatalog ? ctx?.catalog.catalogVersion : undefined,
        };
        const result = computeCalculator(input);
        // Re-align engine results (valid slots only, in order) back onto every form slot.
        let ep = 0;
        const channels: ChannelSlotOutcome[] = processed.map((p) =>
            p.input === null
                ? {
                      errors: p.errors,
                      result: null,
                      hasFee: p.hasFee,
                      seal: p.seal,
                      freightIsEstimate: false,
                      editedFields: p.editedFields,
                      appliedFees: p.appliedFees,
                      appliedFeesFromBand: false,
                      appliedFixedFeeRulePct: null,
                      fixedFeeSource: p.fixedFeeSource,
                  }
                : (() => {
                      const slotInput = p.input;
                      const computed = result.channels[ep++] ?? null;
                      const priced = !isUnpriced(computed);

                      // 016/PR-F homologação (A1) — once the level is priced, back-fill `commissionPct`/
                      // `fixedFee` FROM THE BAND THE ENGINE ACTUALLY APPLIED (never a second price computed
                      // here — `appliedBandFees` re-derives only WHICH band, from the same `grossUp`). Only
                      // for a field the seller did NOT type (same discipline as every other applied-fee field,
                      // 015/A8) and only while the slot is priced (unpriced already clears `appliedFees`
                      // below — a band nobody can see behind is not a reference to vouch for).
                      let appliedFees = p.appliedFees;
                      let appliedFeesFromBand = false;
                      let appliedFixedFeeRulePct: number | null = null;
                      const wantsCommission = p.editedFields.commissionPct === undefined;
                      const wantsFixedFee = p.editedFields.fixedFee === undefined;
                      if (
                          priced &&
                          (slotInput.priceBands?.length ?? 0) > 0 &&
                          (wantsCommission || wantsFixedFee)
                      ) {
                          const band = appliedBandFees(slotInput, result.precoVarejo);
                          if (band) {
                              appliedFeesFromBand = true;
                              appliedFixedFeeRulePct = wantsFixedFee ? band.fixedFeeRulePct : null;
                              appliedFees = {
                                  ...appliedFees,
                                  ...(wantsCommission ? { commissionPct: band.commissionPct } : {}),
                                  ...(wantsFixedFee ? { fixedFee: band.fixedFee } : {}),
                              };
                          }
                      }

                      return {
                          errors: {},
                          result: computed,
                          hasFee: p.hasFee,
                          // SC-817 — a level the engine refused to price (its announce falls outside every
                          // published band) has no reference behind it, so the slot MUST NOT keep wearing the
                          // "Referência" seal: the seal would vouch for a number the screen is not showing.
                          // Degrading the whole slot to "sem referência" understates rather than overstates,
                          // which is the only safe direction here (Constitution II).
                          seal: priced ? p.seal : ({ kind: "none" } as const),
                          freightIsEstimate: p.freightIsEstimate,
                          editedFields: p.editedFields,
                          // 015/A8 — a referencia acompanha o SELO: quando a fatia deixa de ser precificada o
                          // selo cai para "sem referencia", e publicar uma aliquota "aplicada" ali vouchearia
                          // um numero que a tela nao esta mostrando (mesma razao do SC-817 acima).
                          appliedFees: priced ? appliedFees : {},
                          appliedFeesFromBand: priced && appliedFeesFromBand,
                          appliedFixedFeeRulePct: priced ? appliedFixedFeeRulePct : null,
                          // 016/PR-F — o mesmo argumento: um nível não precificado não tem procedência de fixo a
                          // mostrar (o selo principal já caiu para "sem referência").
                          fixedFeeSource: priced ? p.fixedFeeSource : null,
                      };
                  })(),
        );
        return { ok: true, fieldErrors: {}, result, input, channels, otherCostErrors };
    } catch (err) {
        if (err instanceof ValidationError) {
            const key = err.field as CalcFieldName | undefined;
            return {
                ok: false,
                fieldErrors: key ? { [key]: err.message } : {},
                result: null,
                input: null,
                channels: [],
                otherCostErrors: [],
            };
        }
        throw err;
    }
}
