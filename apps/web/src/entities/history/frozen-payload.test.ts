import {
    type BomResult,
    computeCalculator,
    computeQuote,
    type PriceInput,
    PRICING_MODEL_VERSION,
    type PriceResult,
    type QuoteDiscount,
    type QuoteResult,
    stripRetiredFields,
    ValidationError,
} from "@3dprecify/pricing-core";

import PRE_ADR_0024 from "./__fixtures__/frozen-payload-pre-adr-0024.json";
// 019/PR-E (T133) — o molde do documento PRÉ-019: gravado sob a mesma versão de envelope (1), é o
// que prova que alargar a união não moveu o passado.
import PRE_016 from "./__fixtures__/frozen-payload-pre-016.json";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
    buildQuotePayload,
    FROZEN_PAYLOAD_SCHEMA_VERSION,
    freezeBomResult,
    freezePriceResult,
    type FrozenBreakdown,
    frozenChannelHasFee,
    frozenKitLines,
    type FrozenProvenance,
    type FrozenQuoteLine,
    type FrozenSnapshotPayload,
    type MoneyString,
    readFrozenMoney,
    toMoneyString,
} from "./frozen-payload";

// 009/T002 (E4, PR-A) — the frozen document, written FAILING-first.
//
// Two traps this suite exists to pin, both of which produce a LIE rather than a crash:
//
//   1. THE FLOAT TRAP. Postgres stores a JSON number as `numeric` without precision loss — but
//      `json.loads` (Python) and `JSON.parse` (JS) hand it back as a FLOAT. The loss happens in the
//      serializer, app-side, silently. So every money/quantity/percentage leaf in the payload is a
//      decimal STRING; the only JSON numbers are integer counts (FR-525, data-model D1).
//
//   2. THE FABRICATED ZERO. A snapshot renders ONLY the lines it recorded (FR-507). If a future
//      formula adds a breakdown line, an older snapshot must render WITHOUT it — never as "0,00".
//      The subtle way to get this wrong is through the TYPE SYSTEM: type the frozen payload with the
//      LIVE `PriceResult` and a future field makes TypeScript *assert* that a 2026 snapshot has it,
//      so the renderer reaches for `payload.newLine ?? 0` and prints a zero that was never recorded.
//      Hence: the frozen types are structurally independent of `PriceResult`, and every breakdown
//      line is OPTIONAL — absent is a first-class value, distinct from zero.

function priceResult(over: Partial<PriceResult> = {}): PriceResult {
    return {
        material: 18.75,
        energy: 1.2,
        machine: 5.0,
        falha: 0.5,
        finishing: 0,
        labor: 0,
        admin: 0,
        otherCosts: [],
        custoTotal: 25.45,
        precoVarejo: 38.18,
        precoAtacado: 33.09,
        channels: [],
        catalogVersion: null,
        modelVersion: "3.1.0",
        ...over,
    };
}

function priceInput(over: Partial<PriceInput> = {}): PriceInput {
    return {
        costPerRoll: 100,
        rollWeightKg: 1,
        printGrams: 150,
        printTimeHours: 5,
        avgPowerKw: 0.1,
        tariffPerKwh: 1.0,
        machineValue: 4000,
        machineLifetimeHours: 2000,
        markupVarejoPct: 50,
        markupAtacadoPct: 30,
        ...over,
    };
}

describe("toMoneyString — the float dies here (FR-525)", () => {
    it("emits an exact 2dp decimal string, never a float", () => {
        expect(toMoneyString(187.35)).toBe("187.35");
        expect(toMoneyString(0)).toBe("0.00");
        expect(toMoneyString(1)).toBe("1.00");
    });

    it("does not leak binary-float noise into the string", () => {
        // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754. Whatever we store must not carry that tail.
        expect(toMoneyString(0.1 + 0.2)).toBe("0.30");
    });
});

describe("the frozen payload carries NO JSON numbers for money (the serializer trap)", () => {
    it("every money leaf survives a JSON round-trip as the SAME string", () => {
        const payload = freezePriceResult(priceInput(), priceResult(), null);
        const roundTripped = JSON.parse(JSON.stringify(payload)) as typeof payload;

        expect(roundTripped.totals.custoTotal).toBe("25.45");
        expect(roundTripped.totals.precoVarejo).toBe("38.18");
        // The point: a string round-trips byte-identically. A number would come back as a float.
        expect(typeof roundTripped.totals.custoTotal).toBe("string");
        expect(roundTripped).toEqual(payload);
    });

    it("no money field anywhere in the document is a JSON number", () => {
        const payload = freezePriceResult(
            priceInput(),
            priceResult({
                otherCosts: [{ name: "Embalagem", value: 3.5 }],
                channels: [
                    {
                        marketplace: "Mercado Livre",
                        feeDeterminants: null,
                        feeSource: null,
                        precoAnuncioVarejo: 61.9,
                        recebidoLiquidoVarejo: 38.18,
                        precoAnuncioAtacado: 52.4,
                        recebidoLiquidoAtacado: 33.09,
                        freightCostVarejo: 0,
                        freightCostAtacado: 0,
                        // 016/PR-F (ADR-0027 §3.2) — o eco é OBRIGATÓRIO e lista vazia quando não há nenhuma:
                        // uma forma só para o consumidor, em vez de um `undefined` que cada tela trataria à sua
                        // maneira. O congelado NÃO ganha folha nova por isso (I3): a sobretaxa resolvida viaja
                        // em `inputs.channels[].surcharges`, e `FrozenChannel` continua sendo só preço.
                        surcharges: [],
                        error: null,
                    },
                ],
            }),
            null,
        );

        const numericLeaves: string[] = [];
        const walk = (node: unknown, path: string): void => {
            if (typeof node === "number") {
                // Integer counts are the ONLY legal JSON numbers (quantity, contributingLines, …).
                if (!Number.isInteger(node)) numericLeaves.push(path);
                return;
            }
            if (Array.isArray(node)) {
                node.forEach((child, i) => walk(child, `${path}[${i}]`));
                return;
            }
            if (node && typeof node === "object") {
                for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
            }
        };
        walk(JSON.parse(JSON.stringify(payload)), "$");

        expect(numericLeaves).toEqual([]);
    });
});

describe("no fabricated zero — absent is not zero (FR-507)", () => {
    it("readFrozenMoney returns null for an absent line, and never '0.00'", () => {
        expect(readFrozenMoney(undefined)).toBeNull();
        // A line that WAS recorded as zero is a real, recorded zero — it must still read as zero.
        expect(readFrozenMoney("0.00")).toBe("0.00");
    });

    it("a payload recorded by an older formula renders only the lines it recorded", () => {
        // Simulate a 2026 snapshot: the document simply has no key for a line invented later.
        const older = { material: "18.75", energy: "1.20" } as FrozenBreakdown;

        expect(readFrozenMoney(older.material)).toBe("18.75");
        // `finishing` was never recorded here. It must be ABSENT — not a zero the renderer invented.
        expect(readFrozenMoney(older.finishing)).toBeNull();
    });

    it("every breakdown line is OPTIONAL at the type level — the type system cannot assert a line exists", () => {
        // This is the guard against the fabricated zero being produced by TypeScript itself: if these
        // fields were required (as they are on the live `PriceResult`), a future pricing-core field would
        // make the compiler promise that a 2026 snapshot carries it.
        expectTypeOf<FrozenBreakdown["material"]>().toEqualTypeOf<MoneyString | undefined>();
        expectTypeOf<FrozenBreakdown["finishing"]>().toEqualTypeOf<MoneyString | undefined>();
    });
});

describe("the document is self-sufficient — the export PRINTS, it never CALCULATES (ADR-0020 §1)", () => {
    it("a kit payload carries each line's quantity-scaled money and the channel rollup", () => {
        const bom: BomResult = {
            lines: [
                {
                    line: priceResult(),
                    quantity: 3,
                    custoTotal: 76.35,
                    precoVarejo: 114.54,
                    precoAtacado: 99.27,
                },
            ],
            custoTotal: 76.35,
            precoVarejo: 114.54,
            precoAtacado: 99.27,
            channels: [
                {
                    marketplace: "Shopee",
                    precoAnuncioVarejo: 185.7,
                    recebidoLiquidoVarejo: 114.54,
                    precoAnuncioAtacado: 157.2,
                    recebidoLiquidoAtacado: 99.27,
                    freightCostVarejo: 0,
                    freightCostAtacado: 0,
                    contributingLines: 1,
                    skippedLines: 0,
                },
            ],
            modelVersion: "3.1.0",
        };

        const payload = freezeBomResult(
            [{ input: priceInput(), quantity: 3, name: "Vaso G" }],
            bom,
            null,
            null,
        );

        expect(payload.kind).toBe("KIT");
        // The piece's NAME and QUANTITY must be in the document — a kit quote itemizes its pieces
        // (SC-515), and the server renderer may not go looking them up.
        expect(frozenKitLines(payload)[0]?.name).toBe("Vaso G");
        expect(frozenKitLines(payload)[0]?.quantity).toBe(3);
        // The quantity-scaled money must be STORED, not derived at print time.
        expect(frozenKitLines(payload)[0]?.totals.precoVarejo).toBe("114.54");
        expect(payload.channels?.[0]?.precoAnuncioVarejo).toBe("185.70");
        // Counts are the only legal JSON numbers.
        expect(payload.channels?.[0]?.contributingLines).toBe(1);
    });

    it("stamps the schema version and the formula version it was recorded under", () => {
        const payload = freezePriceResult(priceInput(), priceResult(), null);
        expect(payload.schemaVersion).toBe(FROZEN_PAYLOAD_SCHEMA_VERSION);
        expect(payload.modelVersion).toBe("3.1.0");
    });
});

describe("provenance is captured, never referenced (ADR-0019 §5)", () => {
    it("captures the origin's id AND its name, so a dangling id still renders honestly", () => {
        const payload = freezePriceResult(priceInput(), priceResult(), {
            kind: "PRODUCT",
            id: "p1",
            name: "Vaso G",
        });

        expect(payload.provenance).toEqual({ kind: "PRODUCT", id: "p1", name: "Vaso G" });
    });

    it("a snapshot with no origin (an ad-hoc calculation) has null provenance, never a fake one", () => {
        expect(freezePriceResult(priceInput(), priceResult(), null).provenance).toBeNull();
    });

    // 010/T035 (E5, PR-C, US7) — the E4 bridge: a scenario is a THIRD, purely informational provenance
    // kind, exactly like PRODUCT/KIT — captured id+name, never a value source, never a foreign key.
    it("captures a SCENARIO origin the same honest way as PRODUCT/KIT (US7, the E4 bridge)", () => {
        const payload = freezePriceResult(priceInput(), priceResult(), {
            kind: "SCENARIO",
            id: "s1",
            name: "Comparativo ML x Shopee",
        });

        expect(payload.provenance).toEqual({
            kind: "SCENARIO",
            id: "s1",
            name: "Comparativo ML x Shopee",
        });
    });
});

// 009 — review PR-A, finding I1. The ORIGINAL `freezeInput` only stringified TOP-LEVEL numbers and
// each channel's scalar fields; a channel's `priceBands`/`freightVoucherBands` (arrays of objects)
// fell through untouched and their numeric leaves (commissionPct, fixedFee, voucherCeiling, …) were
// FROZEN AS FLOATS inside the immutable document. Any real Shopee/ML quote would corrupt permanently.
describe("I1 — every numeric leaf of a channel band is frozen too (no float survives, FR-525)", () => {
    it("stringifies the leaves inside priceBands and freightVoucherBands", () => {
        const payload = freezePriceResult(
            priceInput({
                channels: [
                    {
                        marketplace: "Shopee",
                        commissionPct: 14,
                        fixedFee: 4,
                        priceBands: [
                            { minPrice: 0, maxPrice: 79.9, commissionPct: 12.5, fixedFee: 5.99 },
                            { minPrice: 79.9, maxPrice: null, commissionPct: 14.5, fixedFee: 6.5 },
                        ],
                        freightVoucherBands: [{ minPrice: 0, maxPrice: null, voucherCeiling: 6.5 }],
                    },
                ],
            }),
            priceResult(),
            null,
        );

        const numericLeaves: string[] = [];
        const walk = (node: unknown, path: string): void => {
            if (typeof node === "number") {
                if (!Number.isInteger(node)) numericLeaves.push(path);
                return;
            }
            if (Array.isArray(node)) {
                node.forEach((child, i) => walk(child, `${path}[${i}]`));
                return;
            }
            if (node && typeof node === "object") {
                for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
            }
        };
        walk(JSON.parse(JSON.stringify(payload)), "$");
        expect(numericLeaves).toEqual([]);

        // Every band leaf — integer or not — is an exact decimal STRING (inputs are never rounded).
        const channels = payload.inputs?.channels as unknown as Record<string, unknown>[];
        const band0 = (channels[0].priceBands as Record<string, unknown>[])[0];
        expect(band0.minPrice).toBe("0");
        expect(band0.maxPrice).toBe("79.9");
        expect(band0.commissionPct).toBe("12.5");
        expect(band0.fixedFee).toBe("5.99");
        const voucher0 = (channels[0].freightVoucherBands as Record<string, unknown>[])[0];
        expect(voucher0.voucherCeiling).toBe("6.5");
        // A null band ceiling (maxPrice: ∞) stays null, never "0".
        const band1 = (channels[0].priceBands as Record<string, unknown>[])[1];
        expect(band1.maxPrice).toBeNull();
    });
});

// 009 — review PR-A, finding I2 (owner decision: Option A — flattened envelope + catalogVersion at
// the root). The fee-catalog provenance (ADR-0010) must be a first-class root field of the frozen
// document, or every v1 snapshot freezes forever without knowing which tariff table priced it.
describe("I2 — catalogVersion is captured at the document root (fee provenance, ADR-0010)", () => {
    it("SINGLE carries the result's catalogVersion", () => {
        const payload = freezePriceResult(
            priceInput(),
            priceResult({ catalogVersion: "2026-07-05" }),
            null,
        );
        expect(payload.catalogVersion).toBe("2026-07-05");
    });

    it("SINGLE with all-manual fees records a null catalogVersion — never an absent key", () => {
        const payload = freezePriceResult(
            priceInput(),
            priceResult({ catalogVersion: null }),
            null,
        );
        expect(payload.catalogVersion).toBeNull();
        expect("catalogVersion" in payload).toBe(true);
    });

    it("KIT carries the catalogVersion passed from the call site (BomResult has none)", () => {
        const bom: BomResult = {
            lines: [
                {
                    line: priceResult(),
                    quantity: 1,
                    custoTotal: 25.45,
                    precoVarejo: 38.18,
                    precoAtacado: 33.09,
                },
            ],
            custoTotal: 25.45,
            precoVarejo: 38.18,
            precoAtacado: 33.09,
            channels: [],
            modelVersion: "3.1.0",
        };

        const withCatalog = freezeBomResult(
            [{ input: priceInput(), quantity: 1, name: "Vaso G" }],
            bom,
            null,
            "2026-07-05",
        );
        expect(withCatalog.catalogVersion).toBe("2026-07-05");

        const allManual = freezeBomResult(
            [{ input: priceInput(), quantity: 1, name: "Vaso G" }],
            bom,
            null,
            null,
        );
        expect(allManual.catalogVersion).toBeNull();
        expect("catalogVersion" in allManual).toBe(true);
    });
});

// 014/T120 — a recusa que a Calcular já aplica, herdada em tempo de LEITURA. Com comissão 0 o motor
// devolve anúncio == base: um número real que não é um preço de marketplace. O detalhe congelado
// imprimia as quatro linhas e passava a afirmar o que a própria origem tinha negado (Princípio II).
//
// Leitura e não escrita de propósito: as entradas de taxa já viajam dentro do documento, então o
// fato é recuperável de TODO registro já gravado — que um gatilho de banco torna irregravável.
describe("frozenChannelHasFee — o congelado não afirma o que a origem negou (T120)", () => {
    const semTaxa = (marketplace: string) => ({
        marketplace,
        commissionPct: "0.00",
        fixedFee: "0.00",
        minPerItem: "0.00",
        freightCost: "0.00",
    });

    function single(slots: unknown[]): FrozenSnapshotPayload {
        return {
            schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
            kind: "SINGLE",
            modelVersion: "3.1.0",
            catalogVersion: null,
            inputs: { channels: slots } as never,
            totals: { custoTotal: "10.00", precoVarejo: "15.00", precoAtacado: "13.00" },
            channels: slots.map((s) => ({
                marketplace: (s as { marketplace: string }).marketplace,
                precoAnuncioVarejo: "15.00" as MoneyString,
            })),
            provenance: null,
        };
    }

    it("um slot sem NENHUMA taxa não tem preço de canal", () => {
        expect(frozenChannelHasFee(single([semTaxa("MERCADO_LIVRE")]), 0)).toBe(false);
    });

    it("basta UMA das sete entradas para o número significar alguma coisa", () => {
        const casos = [
            { commissionPct: "12.00" },
            { fixedFee: "6.00" },
            { minPerItem: "1.00" },
            { freightCost: "19.90" },
            { priceBands: [{ minPrice: "0.00", maxPrice: null, commissionPct: "14.00" }] },
            {
                freightVoucherBands: [
                    { minPrice: "0.00", maxPrice: null, voucherCeiling: "10.00" },
                ],
            },
            // B5 (2026-09-01) — o caso que faltava aqui: um canal cuja ÚNICA cobrança é uma
            // sobretaxa (Shopee "Manuseio de item volumoso", art. 3305, R$ 50) lia "sem taxa" antes
            // do fix (`feeBearing` não olhava `surcharges`), enquanto o lado VIVO
            // (`calculator-model.ts`'s `hasFee`) já contava desde 016/PR-F — a mesma pergunta, duas
            // respostas. Caracterização: revertendo `feeBearing` para a versão anterior ao B5, este
            // `it` fica VERMELHO só neste caso (os outros seis continuam verdes) — a prova de que a
            // correção não moveu nenhum caso já coberto, só fechou o que faltava.
            {
                surcharges: [{ label: "Manuseio de item volumoso", value: "50.00" }],
            },
        ];
        for (const extra of casos) {
            const slot = { ...semTaxa("SHOPEE"), ...extra };
            expect(frozenChannelHasFee(single([slot]), 0), JSON.stringify(extra)).toBe(true);
        }
    });

    // SC-815: esconder uma linha por PALPITE é a mesma fabricação na direção contrária. Só se
    // suprime o que o documento PROVA — um payload sem entradas de canal não prova nada.
    it("sem entradas de canal no documento, o preço permanece — a ausência não é provável", () => {
        const antigo = { ...single([semTaxa("MERCADO_LIVRE")]) };
        delete antigo.inputs;
        expect(frozenChannelHasFee(antigo, 0)).toBe(true);
        expect(frozenChannelHasFee(single([]), 0)).toBe(true); // índice fora da lista
    });

    it("num KIT o canal é um ROLLUP: casa por marketplace, nunca por índice", () => {
        const kit = (linhas: unknown[][]): FrozenSnapshotPayload => ({
            schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
            kind: "KIT",
            modelVersion: "3.1.0",
            catalogVersion: null,
            lines: linhas.map((slots) => ({
                name: null,
                quantity: 1,
                input: { channels: slots } as never,
                breakdown: {
                    material: "1.00",
                    energy: "0.00",
                    machine: "0.00",
                    falha: "0.00",
                    finishing: "0.00",
                    labor: "0.00",
                    admin: "0.00",
                    otherCosts: [],
                } as FrozenBreakdown,
                totals: { custoTotal: "1.00", precoVarejo: "2.00", precoAtacado: "2.00" },
            })),
            totals: { custoTotal: "2.00", precoVarejo: "4.00", precoAtacado: "4.00" },
            channels: [{ marketplace: "MERCADO_LIVRE", precoAnuncioVarejo: "4.00" as MoneyString }],
            provenance: null,
        });

        // Nenhuma linha pagou comissão no ML → o rollup não é um preço.
        expect(
            frozenChannelHasFee(kit([[semTaxa("MERCADO_LIVRE")], [semTaxa("MERCADO_LIVRE")]]), 0),
        ).toBe(false);
        // UMA linha pagou → o número somado significa alguma coisa, e fica.
        expect(
            frozenChannelHasFee(
                kit([
                    [semTaxa("MERCADO_LIVRE")],
                    [{ ...semTaxa("MERCADO_LIVRE"), commissionPct: "14.00" }],
                ]),
                0,
            ),
        ).toBe(true);
        // Uma taxa em OUTRO marketplace não empresta significado a este.
        expect(
            frozenChannelHasFee(
                kit([[semTaxa("MERCADO_LIVRE"), { ...semTaxa("SHOPEE"), commissionPct: "20.00" }]]),
                0,
            ),
        ).toBe(false);
    });
});

// 014/T083 (SC-815) — RETROCOMPATIBILIDADE com o passado de verdade.
//
// O ADR-0024 acrescentou `bandMode` e definiu que a AUSÊNCIA dele significa seleção. `pricing-core`
// já provava essa regra em si mesma; o que faltava é o que esta suíte faz: pegar documentos
// congelados que ninguém escreveu à mão hoje — gerados pelo código de `1212a16`, a base desta branch,
// ANTES do ADR-0024 — e mostrar que o motor de hoje os reproduz ao centavo.
//
// A diferença não é cerimônia. Um fixture escrito hoje prova a INTENÇÃO de hoje: eu escolheria os
// números que o código atual produz, e o teste passaria por construção. Só o artefato antigo prova
// que o passado não se moveu.
//
// 016/US10 (FR-912/913, ADR-0026) — o fixture é TAMBÉM pré-4.0.0 (carrega `wasteGrams` DE
// PROPÓSITO — não muda; §3.3 da arquitetura). A premissa original desta suíte ("sob uma fórmula
// inalterada, reprecificar as entradas congeladas devolve exatamente os valores congelados")
// deixou de valer: a fórmula MUDOU (o desperdício saiu). O motor de hoje agora RECUSA a entrada
// crua — a recusa nominal é o mecanismo estrutural que impede a mentira silenciosa (T035) — e
// `recalc-today.tsx` nunca a alimenta bruta: ele re-resolve da ORIGEM viva, ou, sem origem,
// reemite o documento congelado intacto (nunca recomputa as entradas congeladas puras). O que
// esta suíte prova agora é exatamente essa fronteira: recusa nominal por padrão, e a porta
// documentada (`stripRetiredFields`) produz um resultado HONESTAMENTE diferente, não o mesmo
// centavo — porque o material não soma mais o desperdício.
describe("SC-815 — um congelado de ANTES do ADR-0024/4.0.0 (T083 + 016/US10)", () => {
    /** Descongela um valor de entrada: string numérica vira número, o resto passa intacto.
     *  `null` PERMANECE null — `maxPrice: null` é a banda sem teto, não um campo ausente. */
    function thaw(value: unknown): unknown {
        if (value === null) return null;
        if (Array.isArray(value)) return value.map(thaw);
        if (typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, thaw(v)]));
        }
        const n = Number(value);
        return value !== "" && Number.isFinite(n) ? n : value;
    }

    const antigos = PRE_ADR_0024 as unknown as FrozenSnapshotPayload[];

    it("os documentos do fixture são mesmo ANTERIORES: nenhum carrega `bandMode`", () => {
        expect(antigos).toHaveLength(3);
        expect(JSON.stringify(antigos)).not.toContain("bandMode");
        // E são bandados — senão o teste não tocaria no caminho que o ADR-0024 mudou.
        expect(JSON.stringify(antigos)).toContain("priceBands");
    });

    for (const [i, antigo] of antigos.entries()) {
        it(`documento #${i + 1}: o motor de hoje RECUSA a entrada crua (FR-912) — nomeia o campo`, () => {
            const input = thaw(antigo.inputs) as PriceInput;
            expect(() => computeCalculator(input)).toThrow(ValidationError);
            try {
                computeCalculator(input);
            } catch (e) {
                expect((e as ValidationError).field).toBe("wasteGrams");
            }
        });

        it(`documento #${i + 1}: pela porta documentada, o resultado diverge HONESTAMENTE (nunca o mesmo centavo)`, () => {
            const input = thaw(antigo.inputs) as Record<string, unknown>;
            const { kept, discarded } = stripRetiredFields(input);
            expect(discarded).toEqual([{ field: "wasteGrams", value: String(input.wasteGrams) }]);
            const keptInput = kept as unknown as PriceInput;
            const hoje = freezePriceResult(keptInput, computeCalculator(keptInput), null);
            // A divergência é o PONTO — sem desperdício, o material sai menor. `recalc-today.tsx` nunca
            // apresenta este resultado como se fosse o congelado: ou reprecifica da origem viva, ou
            // reemite `antigo` intacto (fromFrozen), nunca este recompute cru.
            expect(hoje.totals.custoTotal).not.toBe(antigo.totals.custoTotal);
            // O que esta linha afirma é "o recompute carimba a versão de HOJE, não a do documento".
            // Era o literal "4.0.0", e a MINOR de PR-F (4.1.0) o reprovou — provando que o literal
            // respondia "qual versão era" em vez da pergunta. Contra a constante ela sobrevive a cada
            // bump; a comparação com `antigo` abaixo é o que a mantém não-vacuosa.
            expect(hoje.modelVersion).toBe(PRICING_MODEL_VERSION);
            expect(hoje.modelVersion).not.toBe(antigo.modelVersion);
        });
    }

    // Os três anúncios Shopee caem em bandas publicadas DIFERENTES — é onde seleção e parcela
    // divergem, e é por isso que um único documento não bastaria.
    it("as três escalas atravessam bandas diferentes, não a mesma três vezes", () => {
        const anuncios = antigos.map((p) => p.channels?.[0]?.precoAnuncioVarejo);
        expect(anuncios).toEqual(["58.73", "97.36", "149.98"]);
        expect(new Set(anuncios).size).toBe(3);
    });
});

// 016/PR-F (US16, ADR-0027 §3.2) — o congelado existente (`freezeInput`) já é genérico o bastante
// para carregar `ChannelInput.surcharges` sem NENHUMA mudança: o comentário do executor do dado
// pediu exatamente este teste de snapshot — gravar com volumoso marcado congela o valor DENTRO de
// `inputs`, não como um campo à parte que alguém teria de lembrar de adicionar aqui.
describe("congelado — o volumoso (surcharges) viaja dentro de inputs.channels (US16, RA5)", () => {
    it("um cenário salvo com o volumoso marcado congela {label, value} dentro de inputs.channels[0].surcharges", () => {
        const input = priceInput({
            channels: [
                {
                    marketplace: "SHOPEE",
                    commissionPct: 20,
                    fixedFee: 4,
                    surcharges: [{ label: "Manuseio de item volumoso", value: 50 }],
                },
            ],
        });
        const result = computeCalculator(input);
        const frozen = freezePriceResult(input, result, null);

        const frozenChannels = frozen.inputs?.channels as unknown as Array<{
            surcharges: Array<{ label: string; value: string }>;
        }>;
        expect(frozenChannels[0]?.surcharges).toEqual([
            { label: "Manuseio de item volumoso", value: "50" },
        ]);
        // E o resultado ECOADO (não só a entrada) também carrega — o motor devolve `surcharges` em
        // `ChannelResult`, e o congelamento dos canais preserva o que foi realmente cobrado.
        expect(result.channels[0]?.surcharges).toEqual([
            { label: "Manuseio de item volumoso", value: 50 },
        ]);
    });

    it("sem surcharges (o caso de hoje), a chave nem aparece no congelado — byte-idêntico", () => {
        const input = priceInput({
            channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4 }],
        });
        const frozen = freezePriceResult(input, computeCalculator(input), null);
        const frozenChannels = frozen.inputs?.channels as unknown as Array<Record<string, unknown>>;
        expect("surcharges" in frozenChannels[0]!).toBe(false);
    });
});

// ── 019/PR-E · T133 — o ORÇAMENTO congelado (ADR-0034 §2, data-model §4) ─────────────────────────
//
// Um `kind: "QUOTE"` não ganha mecanismo: ganha um valor a mais na união e um bloco de dinheiro NOVO
// dentro do mesmo documento plano (`lines[].unitPrice/subtotal`, `discount`, `costFloor`,
// `totals.precoOrcamento`). Duas coisas precisam ser verdadeiras ao mesmo tempo, e uma delas é sobre
// o PASSADO:
//
//   1. O ENVELOPE NÃO MUDA DE FORMA. `FROZEN_PAYLOAD_SCHEMA_VERSION` continua **1** — alargar uma
//      união e acrescentar campos OPCIONAIS não invalida nenhum documento já gravado, e uma tabela
//      imutável (ADR-0019) não tem onde consertar um envelope que mudou de significado.
//   2. O MOTOR DEVOLVE NÚMEROS (T079, regime `toMoney(): number`); o DOCUMENTO só aceita STRING
//      decimal (`validation.py:106-110` rejeita float — um float ali é uma mentira gravada para
//      sempre). A fronteira mora AQUI, em `buildQuotePayload`, e em lugar nenhum mais.

/** As FOLHAS de dinheiro do documento de orçamento — a marca é de folha, nunca de subárvore
 *  (`lines`/`discount` marcariam `quantity`/`value` percentual: `validation.py:96-99`). */
const QUOTE_MONEY_LEAVES = new Set([
    "unitPrice",
    "subtotal",
    "costFloor",
    "amount",
    "grossTotal",
    "value",
    "precoOrcamento",
]);

/** Todo caminho cuja FOLHA está em posição de dinheiro e voltou do JSON como número. */
function numbersInMoneyPosition(node: unknown, path = "$", key = ""): string[] {
    if (Array.isArray(node))
        return node.flatMap((child, i) => numbersInMoneyPosition(child, `${path}[${i}]`, key));
    if (node && typeof node === "object") {
        return Object.entries(node).flatMap(([field, value]) =>
            numbersInMoneyPosition(value, `${path}.${field}`, field),
        );
    }
    return typeof node === "number" && QUOTE_MONEY_LEAVES.has(key) ? [path] : [];
}

/** Um orçamento REAL: duas linhas × quantidade, pelo motor de verdade (nada de mock — o que se
 *  prova aqui é a fronteira entre o número do motor e a string do documento). */
function quoteFixture(discount?: QuoteDiscount): QuoteResult {
    return computeQuote({
        lines: [
            { input: priceInput(), quantity: 2, name: "Vaso" },
            { input: priceInput({ printGrams: 40 }), quantity: 1, name: "Prato (avulsa)" },
        ],
        discount,
    });
}

const QUOTE_ORIGINS: readonly (FrozenProvenance | null)[] = [
    { kind: "PRODUCT", id: "p1", name: "Vaso" },
    null,
];

describe("019/PR-E — o orçamento congelado (T133)", () => {
    it("o envelope continua na versão 1 — alargar a união não é mudar de forma", () => {
        expect(FROZEN_PAYLOAD_SCHEMA_VERSION).toBe(1);
        expect(buildQuotePayload(quoteFixture(), { lines: QUOTE_ORIGINS }).schemaVersion).toBe(1);
    });

    it("os documentos PRÉ-019 leem idêntico — o passado não se moveu", () => {
        // Se este teste reprova, é o código de hoje que precisa de conserto, nunca o fixture
        // (`__fixtures__/README.md`): um documento gravado é imutável por gatilho (ADR-0019).
        const pre016 = PRE_016 as unknown as FrozenSnapshotPayload;
        expect(pre016.schemaVersion).toBe(FROZEN_PAYLOAD_SCHEMA_VERSION);
        expect(pre016.kind).toBe("SINGLE");
        expect(readFrozenMoney(pre016.totals.custoTotal)).toBe("28.65");
        expect(readFrozenMoney(pre016.totals.precoVarejo)).toBe("42.98");
        expect(readFrozenMoney(pre016.totals.precoAtacado)).toBe("37.25");
        // Um total de orçamento em documento que não é orçamento é ABSENTE, jamais "0,00" (FR-507).
        expect(readFrozenMoney(pre016.totals.precoOrcamento)).toBeNull();
        expect(pre016.provenance).toBeNull();

        for (const doc of PRE_ADR_0024 as unknown as FrozenSnapshotPayload[]) {
            expect(doc.schemaVersion).toBe(FROZEN_PAYLOAD_SCHEMA_VERSION);
            expect(readFrozenMoney(doc.totals.precoOrcamento)).toBeNull();
            expect(doc.discount).toBeUndefined();
            expect(doc.costFloor).toBeUndefined();
        }
    });

    it("um QUOTE construído com o motor REAL não tem UM número em posição de dinheiro", () => {
        const payload = buildQuotePayload(quoteFixture({ mode: "PCT", value: 10 }), {
            lines: QUOTE_ORIGINS,
            discount: { mode: "PCT", value: 10 },
        });
        const roundTripped: unknown = JSON.parse(JSON.stringify(payload));

        expect(numbersInMoneyPosition(roundTripped)).toEqual([]);
        // E os ÚNICOS números que sobram são contagens inteiras (quantidade, schemaVersion).
        const nonIntegers: string[] = [];
        const walk = (node: unknown, path: string): void => {
            if (typeof node === "number") {
                if (!Number.isInteger(node)) nonIntegers.push(path);
                return;
            }
            if (Array.isArray(node)) {
                node.forEach((child, i) => walk(child, `${path}[${i}]`));
                return;
            }
            if (node && typeof node === "object")
                for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
        };
        walk(roundTripped, "$");
        expect(nonIntegers).toEqual([]);
    });

    it("totals.precoOrcamento É o líquido do motor, com as duas casas da casa (ADR-0008)", () => {
        const result = quoteFixture({ mode: "PCT", value: 10 });
        const payload = buildQuotePayload(result, {
            lines: QUOTE_ORIGINS,
            discount: { mode: "PCT", value: 10 },
        });

        expect(payload.kind).toBe("QUOTE");
        expect(payload.modelVersion).toBe(PRICING_MODEL_VERSION);
        expect(payload.totals.precoOrcamento).toBe(result.netTotal.toFixed(2));
        // O card e o documento nunca divergem (VR-503): é este número que vira `headlineTotal`.
        expect(payload.totals.precoOrcamento).toBe(toMoneyString(result.netTotal));
        // Um orçamento é venda DIRETA: nem canal, nem tarifa, nem `catalogVersion` (ADR-0034 §1.7).
        expect(payload.channels).toBeUndefined();
        expect(payload.catalogVersion).toBeNull();
        // Os totais de kit/peça NÃO aparecem: o documento não afirma o que não é a conta dele.
        expect(payload.totals.precoVarejo).toBeUndefined();
        expect(payload.totals.precoAtacado).toBeUndefined();
        expect(payload.totals.custoTotal).toBeUndefined();
    });

    it("o desconto é DECLARADO, nunca embutido — modo, valor, quanto e o bruto de onde saiu", () => {
        const result = quoteFixture({ mode: "AMOUNT", value: 10 });
        const payload = buildQuotePayload(result, {
            lines: QUOTE_ORIGINS,
            discount: { mode: "AMOUNT", value: 10 },
        });

        expect(payload.discount).toEqual({
            mode: "AMOUNT",
            value: "10.00",
            amount: toMoneyString(result.discountAmount),
            grossTotal: toMoneyString(result.grossTotal),
        });
        expect(payload.costFloor).toBe(toMoneyString(result.costFloor));
        // A conta fecha DENTRO do documento — é o que o servidor confere (T131) e o PDF imprime.
        expect(Number(payload.discount?.grossTotal) - Number(payload.discount?.amount)).toBeCloseTo(
            Number(payload.totals.precoOrcamento),
            2,
        );
    });

    it("sem desconto o documento não INVENTA o bloco (ausente ≠ zero, FR-507)", () => {
        const payload = buildQuotePayload(quoteFixture(), { lines: QUOTE_ORIGINS });
        expect(payload.discount).toBeUndefined();
        expect("discount" in payload).toBe(false);
    });

    it("cada linha carrega nome, quantidade e o dinheiro JÁ escalado — o PDF imprime, não calcula", () => {
        const result = quoteFixture();
        const payload = buildQuotePayload(result, { lines: QUOTE_ORIGINS });

        expect(payload.lines).toHaveLength(2);
        const [first, second] = payload.lines as FrozenQuoteLine[];
        expect(first).toEqual({
            name: "Vaso",
            quantity: 2,
            unitPrice: toMoneyString(result.lines[0]!.unitPrice),
            subtotal: toMoneyString(result.lines[0]!.subtotal),
            // A origem é CAPTURADA (id + nome de então), nunca chave estrangeira (ADR-0019 §5).
            origin: { kind: "PRODUCT", id: "p1", name: "Vaso" },
        });
        // Uma peça sem origem no catálogo é `null` — não um id que não resolve, não um nome inventado.
        expect(second?.origin).toBeNull();
        expect(second?.name).toBe("Prato (avulsa)");
    });

    it("FrozenQuoteLine NÃO é FrozenKitLine: nem input, nem breakdown, nem totals", () => {
        const [line] = buildQuotePayload(quoteFixture(), { lines: QUOTE_ORIGINS })
            .lines as FrozenQuoteLine[];
        expect(line).toBeDefined();
        expect(Object.keys(line!).sort()).toEqual([
            "name",
            "origin",
            "quantity",
            "subtotal",
            "unitPrice",
        ]);
    });

    it("uma linha sem origem declarada no meta é null — o construtor não adivinha", () => {
        const payload = buildQuotePayload(quoteFixture(), { lines: [] });
        expect((payload.lines as FrozenQuoteLine[]).every((l) => l.origin === null)).toBe(true);
    });
});
