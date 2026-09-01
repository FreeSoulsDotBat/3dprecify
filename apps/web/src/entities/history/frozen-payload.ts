import {
    type BomResult,
    Decimal,
    type PriceInput,
    type PriceResult,
    type QuoteResult,
} from "@3dprecify/pricing-core";

import { stringifyLeaf, type DecimalLeafValue } from "@/shared/lib/decimal-leaf";

// 009/T003 (E4, PR-A) — THE FROZEN DOCUMENT (data-model D1, ADR-0008, ADR-0020 §1).
//
// A snapshot CONTAINS its values; it never REFERENCES the catalog for them. That is the whole
// two-shelf rule, and this module is where it becomes true: everything the detail UI or the export
// renderer will ever print must be inside this document, forever.
//
// Three rules encoded here, each of which prevents a LIE (not a crash):
//
//   1. MONEY IS A STRING. Postgres keeps a JSON number as `numeric` losslessly — but `json.loads`
//      and `JSON.parse` hand it back as a FLOAT. The precision dies in the serializer, silently,
//      app-side. So every money/quantity/rate leaf is a decimal string; the only JSON numbers are
//      integer counts (FR-525).
//
//   2. THE TYPES ARE STRUCTURALLY INDEPENDENT OF `PriceResult`, and every breakdown line is
//      OPTIONAL. This is not stylistic. If the frozen document were typed with the LIVE result, a
//      future pricing-core field would make TypeScript *assert* that a 2026 snapshot carries it —
//      the renderer would reach for `?? 0` and print a zero that was never recorded. FR-507's
//      fabricated zero, produced by the type system itself. Here, absent is a first-class value.
//
//   3. THE DOCUMENT IS SELF-SUFFICIENT. Kit lines carry their NAME, their QUANTITY and their
//      quantity-SCALED money, so the server-side quote renderer can PRINT instead of CALCULATE —
//      which is precisely why the export does not fork the pricing engine, and why "the backend
//      never recomputes" (ADR-0008) survives E4 intact.

/** Bumped only when the ENVELOPE changes shape — never when the formula does (those are two
 *  different versions, and conflating them is how old snapshots start lying). */
export const FROZEN_PAYLOAD_SCHEMA_VERSION = 1;

/** A decimal number as an exact string, e.g. "187.35". Never a float. */
export type MoneyString = string;

/** Settled money: exactly 2dp, ROUND_HALF_UP (ADR-0008 / ADR-0004 — one money story end-to-end).
 *  B8 (aprovado pelo dono 2026-08-31): o modo é EXPLÍCITO — o `toFixed(2)` puro dependia do
 *  `Decimal.rounding` GLOBAL da lib, que coincide com o ADR-0008 por default e não por declaração;
 *  um `Decimal.set({rounding})` em qualquer lugar mudaria o documento imutável em silêncio. */
export function toMoneyString(value: number): MoneyString {
    return new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP);
}

export interface FrozenOtherCost {
    name: string;
    value: MoneyString;
}

/**
 * The recorded breakdown. EVERY line is optional — a snapshot renders only what it recorded, so a
 * line invented by a later formula is simply an ABSENT KEY here, never a zero (FR-507).
 */
export interface FrozenBreakdown {
    material?: MoneyString;
    energy?: MoneyString;
    machine?: MoneyString;
    falha?: MoneyString;
    finishing?: MoneyString;
    labor?: MoneyString;
    admin?: MoneyString;
    otherCosts?: FrozenOtherCost[];
}

export interface FrozenTotals {
    custoTotal?: MoneyString;
    precoVarejo?: MoneyString;
    precoAtacado?: MoneyString;
    // 019/PR-E (T133, ADR-0034 §2) — o total do ORÇAMENTO: `netTotal` (bruto − desconto), e o mesmo
    // número do `headline_total` da coluna (VR-503, `CASE … WHEN 'PRECO_ORCAMENTO'`). Opcional como
    // todas as outras: um documento SINGLE/KIT de ontem não passa a ter um total de orçamento — ele
    // simplesmente não tem a chave, e `readFrozenMoney` a lê como null, nunca como "0,00" (FR-507).
    precoOrcamento?: MoneyString;
}

/** One recorded channel. Serves BOTH a single piece (per-slot, may carry `error`) and a kit rollup
 *  (which additionally carries the honest line counts) — optional fields, one shape. */
export interface FrozenChannel {
    marketplace: string | null;
    precoAnuncioVarejo?: MoneyString | null;
    recebidoLiquidoVarejo?: MoneyString | null;
    precoAnuncioAtacado?: MoneyString | null;
    recebidoLiquidoAtacado?: MoneyString | null;
    freightCostVarejo?: MoneyString;
    freightCostAtacado?: MoneyString;
    /** Kit rollup only — integer counts are the ONLY legal JSON numbers in this document. */
    contributingLines?: number;
    skippedLines?: number;
    /** Single-piece slot only — an honest per-slot failure, echoed as recorded. */
    error?: string | null;
}

/**
 * A frozen INPUT value: every numeric leaf is an exact decimal STRING (inputs are stringified
 * WITHOUT rounding — 0.125 kW is not 0.13 kW); strings and null pass through; arrays and nested
 * objects (a channel's `priceBands`, `freightVoucherBands`, `feeDeterminants`) are frozen
 * RECURSIVELY. The one-level-deep freeze that first shipped froze channel-band leaves as floats
 * inside the immutable document (review PR-A, finding I1) — a recursive value type forbids that.
 * A serialização vive em `shared/lib/decimal-leaf.ts` (casa única); o ENVELOPE segue daqui.
 */
export type FrozenInputValue = DecimalLeafValue;

/** The fully RESOLVED inputs (filament/printer values inlined, never references) — so a snapshot
 *  reproduces with nothing but itself, and "Recalcular hoje" has something to fall back on when the
 *  origin no longer resolves. */
export type FrozenPriceInput = { [field: string]: FrozenInputValue };

/** One frozen channel is just a frozen input object — kept as a name for readability. */
export type FrozenChannelInput = { [field: string]: FrozenInputValue };

export interface FrozenKitLine {
    /** The piece's name as captured — a kit quote itemizes its pieces (SC-515), and the renderer must
     *  not have to look it up. */
    name: string | null;
    quantity: number;
    input: FrozenPriceInput;
    /** Per-UNIT breakdown, exactly as displayed. */
    breakdown: FrozenBreakdown;
    /** Quantity-SCALED money — stored, never derived at print time. */
    totals: FrozenTotals;
}

/**
 * Where this snapshot came from — INFORMATIONAL ONLY, never a value source, and deliberately NOT a
 * foreign key (ADR-0019 §5). The id may dangle harmlessly; the captured `name` is what the origin
 * was called then, which is always true. When the id no longer resolves, the "abrir origem"
 * affordance is simply absent — no broken link, no "produto excluído" claim, no degraded caption.
 */
export interface FrozenProvenance {
    // 010/T035 (E5, PR-C, US7) — "SCENARIO" is the E4 bridge: recording from a saved scenario's live
    // result captures the SAME informational triad as PRODUCT/KIT (id + the name AS CAPTURED), never a
    // foreign key, never a value source. The scenario keeps changing after this; the snapshot does not.
    kind: "PRODUCT" | "KIT" | "SCENARIO";
    id: string;
    name: string;
}

// ── 019/PR-E (T133) — o ORÇAMENTO dentro do MESMO envelope (ADR-0034 §2, data-model §4) ──────────
//
// Um `kind: "QUOTE"` não ganha tabela, rota nem mecanismo: ganha um valor a mais na união e três
// campos OPCIONAIS. A `FrozenKitLine` (:111) NÃO é reaproveitada, e isso é decisão, não estilo: ela
// carrega `input`/`breakdown`/`totals` (a peça inteira, para "Recalcular hoje" ter de que partir), e
// um orçamento não recalcula — ele imprime nome, quantidade, unitário e subtotal. Reusá-la faria o
// documento de orçamento AFIRMAR uma decomposição de custo que ninguém orçou.

/** O desconto como o documento o DECLARA — modo, o que o vendedor digitou, quanto deu, e o bruto de
 *  onde saiu. Um documento que mostra só o líquido esconde a conta que o vendedor fez (ADR-0034 §2).
 *  `value` também é STRING: `validation.py:106-110` rejeita float em posição de dinheiro. */
export interface FrozenQuoteDiscount {
    mode: "PCT" | "AMOUNT";
    /** % (modo `PCT`) ou R$ (modo `AMOUNT`), como digitado — quantizado às duas casas da casa. */
    value: MoneyString;
    amount: MoneyString;
    grossTotal: MoneyString;
}

/** Uma linha do orçamento congelado. `quantity` é o único número JSON legal aqui (contagem
 *  inteira); o dinheiro já vem ESCALADO, para o renderizador imprimir sem multiplicar nada. */
export interface FrozenQuoteLine {
    /** O nome como foi orçado — inclusive a legenda de degradação do E3/D6 quando for o caso. */
    name: string | null;
    quantity: number;
    unitPrice: MoneyString;
    subtotal: MoneyString;
    /** De onde a linha veio — a MESMA tríade informativa da proveniência do documento (id + nome de
     *  então), nunca chave estrangeira (ADR-0019 §5); `null` quando a linha não veio do catálogo. */
    origin: FrozenProvenance | null;
}

export interface FrozenSnapshotPayload {
    schemaVersion: number;
    kind: "SINGLE" | "KIT" | "QUOTE";
    /** The formula that produced these numbers (`PRICING_MODEL_VERSION`) — closes A29. */
    modelVersion: string;
    /** The fee-catalog version that priced the channels (ADR-0010) — root-level provenance, captured
     *  so a snapshot records WHICH tariff table it used; `null` when every channel used manual fees.
     *  Owner decision I2/Option A: a first-class root field, not buried inside `inputs`. */
    catalogVersion: string | null;
    /** SINGLE only. */
    inputs?: FrozenPriceInput;
    /** SINGLE only. */
    breakdown?: FrozenBreakdown;
    /** KIT (peças, com input+breakdown) ou QUOTE (itens, só o que se imprime). A união é de ARRAY, de
     *  propósito: um documento tem UMA das duas formas, e quem lê tem de estreitar pelo `kind` — um
     *  `FrozenKitLine[] & FrozenQuoteLine[]` deixaria a tela alcançar `line.totals` num orçamento e
     *  imprimir `undefined` (019/PR-E T133/T135). */
    lines?: FrozenKitLine[] | FrozenQuoteLine[];
    /** QUOTE only — o desconto DECLARADO. Ausente = orçamento sem desconto (nunca zero fabricado). */
    discount?: FrozenQuoteDiscount;
    /** QUOTE only — `bom.custoTotal`: o custo somado dos itens × quantidade (ADR-0034 §1.4), o piso
     *  que o aviso "Abaixo do custo" compara. Congelado porque o documento é auto-suficiente. */
    costFloor?: MoneyString;
    totals: FrozenTotals;
    channels?: FrozenChannel[];
    provenance: FrozenProvenance | null;
    /**
     * 014/SC-818 — set ONLY when "Recalcular hoje" could not reprice from the catalog and re-emitted
     * the FROZEN document instead (the origin was deleted or unresolvable). ABSENT means an ordinary
     * record: every payload written before this field existed keeps meaning exactly what it meant,
     * which is why the flag is additive and one-sided (the same discipline as `bandMode`, ADR-0024).
     *
     * It has to be decided AT WRITE TIME. The dialog already warns before confirming, but that warning
     * dies with the dialog: without this, the stored record is indistinguishable from a genuine reprice
     * while carrying today's `deviceQuotedAt`. And a snapshot is IMMUTABLE by DB trigger (ADR-0019) —
     * an ambiguous record stays ambiguous forever, so there is no later place to add the truth.
     */
    repricedFromFrozen?: true;
}

// 019/PR-E (T133/T135) — `lines` passou a ser união de ARRAYS, e o compilador passou a exigir o
// estreitamento em cada leitor. Estes dois são a ÚNICA porta: a asserção mora aqui, atrás de um
// teste de `kind`, em vez de virar um `as` espalhado por oito consumidores (onde um `as` errado lê
// `line.totals` de um orçamento e imprime `undefined`). Um `kind` que não é o pedido devolve lista
// VAZIA — a tela não renderiza peça nenhuma, que é a verdade, em vez de arriscar campo inexistente.

/** As peças de um KIT. Vazio para qualquer outro `kind`. */
export function frozenKitLines(payload: FrozenSnapshotPayload): FrozenKitLine[] {
    return payload.kind === "KIT" ? ((payload.lines ?? []) as FrozenKitLine[]) : [];
}

/** Os itens de um ORÇAMENTO. Vazio para qualquer outro `kind`. */
export function frozenQuoteLines(payload: FrozenSnapshotPayload): FrozenQuoteLine[] {
    return payload.kind === "QUOTE" ? ((payload.lines ?? []) as FrozenQuoteLine[]) : [];
}

/** Read a recorded money line. An ABSENT line reads as `null` — never as "0.00" (FR-507). A line
 *  that was genuinely recorded as zero still reads as zero, because it really happened. */
export function readFrozenMoney(value: MoneyString | null | undefined): MoneyString | null {
    return value ?? null;
}

function freezeOtherCosts(items: readonly { name: string; value: number }[]): FrozenOtherCost[] {
    return items.map((item) => ({ name: item.name, value: toMoneyString(item.value) }));
}

function freezeBreakdown(result: PriceResult): FrozenBreakdown {
    return {
        material: toMoneyString(result.material),
        energy: toMoneyString(result.energy),
        machine: toMoneyString(result.machine),
        falha: toMoneyString(result.falha),
        finishing: toMoneyString(result.finishing),
        labor: toMoneyString(result.labor),
        admin: toMoneyString(result.admin),
        otherCosts: freezeOtherCosts(result.otherCosts),
    };
}

function freezeTotals(totals: {
    custoTotal: number;
    precoVarejo: number;
    precoAtacado: number;
}): FrozenTotals {
    return {
        custoTotal: toMoneyString(totals.custoTotal),
        precoVarejo: toMoneyString(totals.precoVarejo),
        precoAtacado: toMoneyString(totals.precoAtacado),
    };
}

function freezeSlotChannels(result: PriceResult): FrozenChannel[] {
    return result.channels.map((channel) => ({
        marketplace: channel.marketplace,
        precoAnuncioVarejo:
            channel.precoAnuncioVarejo === null ? null : toMoneyString(channel.precoAnuncioVarejo),
        recebidoLiquidoVarejo:
            channel.recebidoLiquidoVarejo === null
                ? null
                : toMoneyString(channel.recebidoLiquidoVarejo),
        precoAnuncioAtacado:
            channel.precoAnuncioAtacado === null
                ? null
                : toMoneyString(channel.precoAnuncioAtacado),
        recebidoLiquidoAtacado:
            channel.recebidoLiquidoAtacado === null
                ? null
                : toMoneyString(channel.recebidoLiquidoAtacado),
        freightCostVarejo: toMoneyString(channel.freightCostVarejo),
        freightCostAtacado: toMoneyString(channel.freightCostAtacado),
        error: channel.error,
    }));
}

function freezeRollupChannels(bom: BomResult): FrozenChannel[] {
    return bom.channels.map((rollup) => ({
        marketplace: rollup.marketplace,
        precoAnuncioVarejo:
            rollup.precoAnuncioVarejo === null ? null : toMoneyString(rollup.precoAnuncioVarejo),
        recebidoLiquidoVarejo:
            rollup.recebidoLiquidoVarejo === null
                ? null
                : toMoneyString(rollup.recebidoLiquidoVarejo),
        precoAnuncioAtacado:
            rollup.precoAnuncioAtacado === null ? null : toMoneyString(rollup.precoAnuncioAtacado),
        recebidoLiquidoAtacado:
            rollup.recebidoLiquidoAtacado === null
                ? null
                : toMoneyString(rollup.recebidoLiquidoAtacado),
        freightCostVarejo: toMoneyString(rollup.freightCostVarejo),
        freightCostAtacado: toMoneyString(rollup.freightCostAtacado),
        contributingLines: rollup.contributingLines,
        skippedLines: rollup.skippedLines,
    }));
}

/** Stringify every numeric leaf of a resolved `PriceInput`, at any depth (a folha recursiva —
 *  review PR-A I1 — vive em `shared/lib/decimal-leaf.ts`; um `PriceInput` resolvido não tem folha
 *  inteira/booleana, então todo número legitimamente vira string aqui). */
function freezeInput(input: PriceInput): FrozenPriceInput {
    const frozen: FrozenPriceInput = {};
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        frozen[key] = stringifyLeaf(value);
    }
    return frozen;
}

/** Freeze a single-piece calculation into the immutable document. */
export function freezePriceResult(
    input: PriceInput,
    result: PriceResult,
    provenance: FrozenProvenance | null,
): FrozenSnapshotPayload {
    return {
        schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
        kind: "SINGLE",
        modelVersion: result.modelVersion,
        catalogVersion: result.catalogVersion,
        inputs: freezeInput(input),
        breakdown: freezeBreakdown(result),
        totals: freezeTotals(result),
        channels: freezeSlotChannels(result),
        provenance,
    };
}

/** Freeze a kit into the immutable document. The piece names ride along because a kit quote
 *  itemizes its pieces (SC-515) and the renderer may not go looking them up. */
export function freezeBomResult(
    lines: readonly { input: PriceInput; quantity: number; name: string | null }[],
    bom: BomResult,
    provenance: FrozenProvenance | null,
    // `BomResult` carries no catalogVersion (every line resolves from the same catalog); the call
    // site supplies it explicitly (I2/Option A) rather than bumping pricing-core to add it.
    catalogVersion: string | null,
): FrozenSnapshotPayload {
    return {
        schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
        kind: "KIT",
        modelVersion: bom.modelVersion,
        catalogVersion,
        lines: bom.lines.map((lineResult, index) => ({
            name: lines[index]?.name ?? null,
            quantity: lineResult.quantity,
            input: freezeInput(lines[index]?.input ?? ({} as PriceInput)),
            breakdown: freezeBreakdown(lineResult.line),
            totals: freezeTotals(lineResult),
        })),
        totals: freezeTotals(bom),
        channels: freezeRollupChannels(bom),
        provenance,
    };
}

/**
 * 019/PR-E (T133) — a FRONTEIRA entre o número do motor e a string do documento.
 *
 * `computeQuote` devolve NÚMEROS (o regime de `toMoney` do pacote, ADR-0008); o documento congelado
 * só aceita STRING decimal, e não por gosto: `validation.py:106-110` rejeita float em posição de
 * dinheiro, e um float que passasse viraria imprecisão gravada para sempre numa tabela que um
 * gatilho impede de reescrever (ADR-0019). A conversão mora AQUI e em lugar nenhum mais — nenhuma
 * tela formata dinheiro para dentro do documento.
 *
 * O que ela NÃO faz: não calcula nada. Todo número vem do `QuoteResult`; `meta` só acrescenta o que
 * o motor legitimamente não sabe — de onde veio cada linha e o desconto COMO FOI DIGITADO (o motor
 * devolve quanto deu, não em que modo foi pedido).
 */
export function buildQuotePayload(
    result: QuoteResult,
    meta: {
        /** A origem de cada linha, na MESMA ordem de `result.lines`. Uma posição ausente é `null` — o
         *  documento não adivinha catálogo. */
        lines: readonly (FrozenProvenance | null)[];
        /** O desconto como entrou no motor. Ausente = sem desconto, e o bloco simplesmente não nasce. */
        discount?: { mode: "PCT" | "AMOUNT"; value: number };
    },
): FrozenSnapshotPayload {
    const lines: FrozenQuoteLine[] = result.lines.map((line, index) => ({
        name: line.name,
        quantity: line.quantity,
        unitPrice: toMoneyString(line.unitPrice),
        subtotal: toMoneyString(line.subtotal),
        origin: meta.lines[index] ?? null,
    }));

    return {
        schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
        kind: "QUOTE",
        modelVersion: result.modelVersion,
        // Um orçamento é venda DIRETA: nem canal, nem banda, nem tarifa entram no motor (ADR-0034 §1.7),
        // então não há versão de catálogo a capturar. `null` DECLARADO, jamais chave ausente (I2).
        catalogVersion: null,
        lines,
        ...(meta.discount === undefined
            ? {}
            : {
                  discount: {
                      mode: meta.discount.mode,
                      value: toMoneyString(meta.discount.value),
                      amount: toMoneyString(result.discountAmount),
                      grossTotal: toMoneyString(result.grossTotal),
                  },
              }),
        costFloor: toMoneyString(result.costFloor),
        // SÓ o total do orçamento. Gravar o líquido em `precoVarejo` — a "simplificação" que o ADR-0034
        // nomeia como o risco desta fatia — faria o documento afirmar que o MOTOR produziu aquele
        // número, com o desconto embutido: uma mentira dentro de um registro imutável.
        totals: { precoOrcamento: toMoneyString(result.netTotal) },
        // Um orçamento tem N origens, uma por linha (`lines[].origin`) — não UMA no documento.
        provenance: null,
    };
}

/** Is this frozen channel INPUT carrying a fee at all? The six fields are the same ones the live
 *  calculator's `hasFee` reads (`calculator-model.ts`) — kept in sync by the shared meaning, not by
 *  a shared call, because this side reads exact decimal STRINGS out of an immutable document. */
function feeBearing(slot: FrozenInputValue | undefined): boolean {
    if (slot === null || typeof slot !== "object" || Array.isArray(slot)) return false;
    const positive = (key: string): boolean => Number(slot[key] ?? 0) > 0;
    const filled = (key: string): boolean => Array.isArray(slot[key]) && slot[key].length > 0;
    return (
        positive("commissionPct") ||
        positive("fixedFee") ||
        positive("minPerItem") ||
        positive("freightCost") ||
        filled("priceBands") ||
        filled("freightVoucherBands")
    );
}

/**
 * 014/T120 — did the channel at `index` of `payload.channels` stand on a fee?
 *
 * With a commission of 0 the engine returns anúncio == base and líquido == base: real numbers, but
 * NOT a marketplace price. The calculator already refuses to show them ("Informe a comissão do canal
 * para ver os preços"); the frozen detail printed all four lines and so asserted what its own origin
 * had denied (Princípio II). This is the read-time half of that refusal.
 *
 * READ-time and not write-time on purpose. The fee inputs travel inside the document already
 * (`inputs.channels` for a SINGLE, `lines[].input.channels` for a KIT), so the fact is recoverable
 * from every record ever written — including the ones already frozen, which a DB trigger makes
 * unrewritable anyway (ADR-0019). Freezing nulls instead would have fixed only future records and
 * left the existing ones asserting the same thing forever.
 *
 * It answers `true` whenever the absence of a fee cannot be PROVEN from the document — a payload
 * with no channel inputs at all, or a rollup with no matching slot. Suppressing a line on a guess
 * would be the same fabrication in the other direction (SC-815).
 */
export function frozenChannelHasFee(payload: FrozenSnapshotPayload, index: number): boolean {
    const rendered = payload.channels?.[index];
    if (!rendered) return true;

    if (payload.kind === "SINGLE") {
        const slots = payload.inputs?.["channels"];
        if (!Array.isArray(slots) || slots[index] === undefined) return true;
        return feeBearing(slots[index]);
    }

    // A KIT channel is a ROLLUP over the lines, so it is matched by marketplace, never by index. If
    // ANY contributing line carried a fee for that marketplace, the rolled-up number means something.
    // 019/PR-E: só um KIT tem linhas COM entrada de canal — um QUOTE é venda direta e nem chega aqui
    // (não tem `channels` a renderizar), e `frozenKitLines` devolve vazio para ele por construção.
    let matched = false;
    for (const line of frozenKitLines(payload)) {
        const slots = line.input["channels"];
        if (!Array.isArray(slots)) continue;
        for (const slot of slots) {
            if (slot === null || typeof slot !== "object" || Array.isArray(slot)) continue;
            if (slot["marketplace"] !== rendered.marketplace) continue;
            matched = true;
            if (feeBearing(slot)) return true;
        }
    }
    return !matched;
}
