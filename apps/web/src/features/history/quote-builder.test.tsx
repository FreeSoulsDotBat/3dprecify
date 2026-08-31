// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const record = { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };
vi.mock("@/entities/history/use-history", () => ({
    useRecordSnapshot: () => record,
}));

const onlineRef = { value: true };
vi.mock("@/shared/lib/use-online", () => ({ useOnline: () => onlineRef.value }));

const entitlement = { data: { status: "active" } as { status: string } | undefined };
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => entitlement }));

import { computeQuote, type PriceInput, type QuoteDiscount } from "@3dprecify/pricing-core";

import { buildQuotePayload } from "@/entities/history/frozen-payload";
import type { BomOut, ProductOut, SnapshotIn } from "@/shared/api/generated";
import type { FeeCatalog } from "@/shared/fee-catalog/fee-catalog";
import type { CatalogSource } from "@/shared/fee-catalog/use-fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { Toaster } from "@/shared/ui";

import { QuoteBuilder, type QuoteCatalogItem, type QuoteLineInputResult } from "./quote-builder";

// 019/PR-E · T083 (US6/US16, ADR-0034) — o CONSTRUTOR de orçamento, escrito VERMELHO primeiro.
//
// Este arquivo é o contrato de `quote-builder.tsx`: ele existe ANTES do componente e falha por
// AUSÊNCIA do módulo. O que ele fixa não é layout — é o punhado de coisas que, se saírem erradas,
// fazem o produto MENTIR sobre dinheiro:
//
//   1. IGUALDADE, NÃO ESPIONAGEM. O total da tela é comparado com `computeQuote` rodado FORA da
//      tela, no próprio teste, com as mesmas entradas. Espiar a chamada (`vi.spyOn` num export ESM
//      do pacote não tem nem precedente aqui) provaria que a função foi chamada, e é exatamente a
//      pergunta errada: o defeito que interessa é a tela somar/arredondar por conta própria e
//      exibir um centavo diferente do que o motor produziu (FR-1916).
//   2. AVISA, NUNCA BLOQUEIA (Q10). Um orçamento abaixo do custo é decisão legítima do vendedor —
//      promoção, cliente antigo, desovar estoque. O aviso aparece; o botão Enviar continua vivo.
//   3. ANTES DE ENVIAR, NADA CONGELA. O construtor acompanha o preço de HOJE; congelar é o ato de
//      Enviar, e um congelamento antecipado gravaria — numa tabela imutável por gatilho, ADR-0019 —
//      um documento que o vendedor nunca mandou.
//   4. O PREÇO É DO MOTOR, sempre. Um produto com preço FIXADO pelo vendedor (ADR-0033 §3) entra
//      no orçamento pelo número que o motor calcula, não pela declaração — o fixado é observação de
//      catálogo, não uma segunda fonte de verdade de preço.
//   5. OFFLINE, ENVIAR NÃO EXISTE (decisão 4 do dono, 27/08): montar funciona, Enviar fica
//      desabilitado COM a razão, e NADA entra na fila — porque o PDF depende do id do servidor.

const t = messages.quote;

// ── Fixtures do catálogo ────────────────────────────────────────────────────────────────────────
// Os valores de fio vêm em decimal de fio (ponto, sem milhar), então o `PriceInput` esperado é o
// mesmo número, sem ambiguidade de separador — é o que permite comparar com o motor sem reusar o
// mapeador de `features/calculator` (que esta camada não pode importar: fronteira FSD).

interface PieceNumbers {
    costPerRoll: number;
    rollWeightKg: number;
    printGrams: number;
    printTimeHours: number;
    avgPowerKw: number;
    tariffPerKwh: number;
    machineValue: number;
    machineLifetimeHours: number;
    markupVarejoPct: number;
    markupAtacadoPct: number;
}

const VASO_NUMBERS: PieceNumbers = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 150,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
};

const PRATO_NUMBERS: PieceNumbers = { ...VASO_NUMBERS, printGrams: 40, printTimeHours: 2 };
const PECA_KIT_NUMBERS: PieceNumbers = { ...VASO_NUMBERS, printGrams: 90, printTimeHours: 3 };

/** O `PriceInput` que aquelas peças são — a referência com que o total da tela é comparado. */
function inputOf(n: PieceNumbers): PriceInput {
    return {
        costPerRoll: n.costPerRoll,
        rollWeightKg: n.rollWeightKg,
        printGrams: n.printGrams,
        printTimeHours: n.printTimeHours,
        avgPowerKw: n.avgPowerKw,
        tariffPerKwh: n.tariffPerKwh,
        machineValue: n.machineValue,
        machineLifetimeHours: n.machineLifetimeHours,
        markupVarejoPct: n.markupVarejoPct,
        markupAtacadoPct: n.markupAtacadoPct,
    };
}

function productOf(
    id: string,
    name: string,
    n: PieceNumbers,
    over: Partial<ProductOut> = {},
): ProductOut {
    return {
        id,
        name,
        filamentId: `fil-${id}`,
        printerId: `prn-${id}`,
        filamentValues: {
            material: "PLA",
            costPerRoll: String(n.costPerRoll),
            rollWeightKg: String(n.rollWeightKg),
        },
        printerValues: {
            machineValue: String(n.machineValue),
            machineLifetimeHours: String(n.machineLifetimeHours),
            avgPowerKw: String(n.avgPowerKw),
            maintenanceReservePerHour: "0",
        },
        pieceInputs: {
            printGrams: String(n.printGrams),
            printTimeHours: String(n.printTimeHours),
            failurePct: "0",
            finishTimeHours: "0",
            finishRatePerHour: "0",
            laborHours: "0",
            laborRatePerHour: "0",
            markupVarejoPct: String(n.markupVarejoPct),
            markupAtacadoPct: String(n.markupAtacadoPct),
        },
        tariffPerKwh: String(n.tariffPerKwh),
        includeMarketplace: false,
        channels: [],
        otherCosts: [],
        sellerFixedPrice: null,
        sellerFixedAt: null,
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
        ...over,
    } as unknown as ProductOut;
}

function kitOf(
    id: string,
    name: string,
    lines: { n: PieceNumbers; qty: number; degraded?: boolean; pieceName?: string | null }[],
): BomOut {
    return {
        id,
        name,
        createdAt: "2026-08-01T12:00:00Z",
        updatedAt: "2026-08-01T12:00:00Z",
        lines: lines.map((l, i) => ({
            id: `${id}-l${i}`,
            position: i,
            quantity: l.qty,
            productId: l.degraded ? null : `p-${id}-${i}`,
            pieceName: l.pieceName === undefined ? `Peça ${i + 1}` : l.pieceName,
            degraded: l.degraded ?? false,
            pieceInputs: {
                printGrams: String(l.n.printGrams),
                printTimeHours: String(l.n.printTimeHours),
                failurePct: "0",
                finishTimeHours: "0",
                finishRatePerHour: "0",
                laborHours: "0",
                laborRatePerHour: "0",
                markupVarejoPct: String(l.n.markupVarejoPct),
                markupAtacadoPct: String(l.n.markupAtacadoPct),
            },
            filamentValues: {
                material: "PLA",
                costPerRoll: String(l.n.costPerRoll),
                rollWeightKg: String(l.n.rollWeightKg),
            },
            printerValues: {
                machineValue: String(l.n.machineValue),
                machineLifetimeHours: String(l.n.machineLifetimeHours),
                avgPowerKw: String(l.n.avgPowerKw),
                maintenanceReservePerHour: "0",
            },
            tariffPerKwh: String(l.n.tariffPerKwh),
            includeMarketplace: false,
            channels: [],
            otherCosts: [],
        })),
    } as unknown as BomOut;
}

const VASO = productOf("p-vaso", "Vaso", VASO_NUMBERS);
const PRATO = productOf("p-prato", "Prato", PRATO_NUMBERS);
/** ADR-0033 §3 — o vendedor declarou um preço; o orçamento continua saindo do MOTOR. */
const FIXADO = productOf("p-fixado", "Fixado", PRATO_NUMBERS, {
    sellerFixedPrice: "999.00",
    sellerFixedAt: "2026-08-10T12:00:00Z",
} as Partial<ProductOut>);
/** K3 — referência ausente: preço PARADO. Não dá para orçar o que não recalcula hoje (18b). */
const PARADO = productOf("p-parado", "Parado", VASO_NUMBERS, {
    filamentId: null,
    printerId: null,
} as Partial<ProductOut>);
/** D6 (ADR-0017 §6) — a linha degradada do kit entra, com a legenda que o produto já tem. */
const KIT = kitOf("k-1", "Kit Festa", [
    { n: PECA_KIT_NUMBERS, qty: 2 },
    { n: PRATO_NUMBERS, qty: 1, degraded: true, pieceName: null },
]);

const CATALOG = { catalogVersion: "2026-08-06.1", marketplaces: [] } as unknown as FeeCatalog;

const OBSERVATIONS = new Map([
    ["p-parado", { observedPrice: 42.98, observedAt: "2026-07-30T12:00:00Z" }],
]);

// ── ADAPTAÇÃO DO CONTRATO (T088, decisão de fronteira registrada no dispatch) ──────────────────
//
// `quote-builder.tsx` não importa `features/calculator` (eslint-boundaries) — quem sabe traduzir um
// PRODUCT/KIT do Catálogo num `PriceInput` é a PAGE, injetada via `toLineInput`. O contrato original
// não previa essa prop porque o componente ainda não existia; este é o ÚNICO ajuste permitido no
// arquivo (ver dispatch T088). O mock abaixo NÃO reimplementa `productToForm`/`computeFromForm` (que
// violaria a mesma fronteira dentro do teste) — ele lê os campos de fio já em `PieceNumbers` que
// `productOf`/`kitOf` gravaram no wire, exatamente como `inputOf()` já faz, sem precisar de um mapa
// externo id→números.
function wireToInput(
    fv: { costPerRoll: string; rollWeightKg: string },
    pv: { machineValue: string; machineLifetimeHours: string; avgPowerKw: string },
    pi: {
        printGrams: string;
        printTimeHours: string;
        markupVarejoPct: string;
        markupAtacadoPct: string;
    },
    tariffPerKwh: string,
): PriceInput {
    return {
        costPerRoll: Number(fv.costPerRoll),
        rollWeightKg: Number(fv.rollWeightKg),
        printGrams: Number(pi.printGrams),
        printTimeHours: Number(pi.printTimeHours),
        avgPowerKw: Number(pv.avgPowerKw),
        tariffPerKwh: Number(tariffPerKwh),
        machineValue: Number(pv.machineValue),
        machineLifetimeHours: Number(pv.machineLifetimeHours),
        markupVarejoPct: Number(pi.markupVarejoPct),
        markupAtacadoPct: Number(pi.markupAtacadoPct),
    };
}

function testToLineInput(item: QuoteCatalogItem): QuoteLineInputResult {
    if (item.kind === "PRODUCT") {
        const p = item.product;
        // K3 — mesma detecção de `entities/catalog/product-summary.ts` `productNeedsAttention`.
        if (p.filamentId === null || p.printerId === null) {
            return {
                lines: [],
                origin: { kind: "PRODUCT", id: p.id, name: p.name },
                degraded: false,
                stopped: true,
            };
        }
        // ADR-0033 §3 — `sellerFixedPrice` nunca é lido aqui: o motor é a única fonte de preço.
        const input = wireToInput(p.filamentValues, p.printerValues, p.pieceInputs, p.tariffPerKwh);
        return {
            lines: [{ input, quantity: 1, name: p.name }],
            origin: { kind: "PRODUCT", id: p.id, name: p.name },
            degraded: false,
            stopped: false,
        };
    }
    const k = item.kit;
    const lines = k.lines.map((line) => ({
        input: wireToInput(
            line.filamentValues,
            line.printerValues,
            line.pieceInputs,
            line.tariffPerKwh,
        ),
        quantity: line.quantity,
        name: line.pieceName ?? undefined,
    }));
    return {
        lines,
        origin: { kind: "KIT", id: k.id, name: k.name },
        degraded: k.lines.some((l) => l.degraded),
        stopped: false,
    };
}

function renderBuilder(props: Partial<Parameters<typeof QuoteBuilder>[0]> = {}) {
    return render(
        <>
            <QuoteBuilder
                products={[VASO, PRATO]}
                kits={[KIT]}
                filaments={[]}
                printers={[]}
                catalog={CATALOG}
                source={"catalog" satisfies CatalogSource}
                observations={OBSERVATIONS}
                toLineInput={testToLineInput}
                onSent={vi.fn()}
                {...props}
            />
            <Toaster />
        </>,
    );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

/** Escolher itens + quantidades e ir para a etapa do desconto/total (18b → 18d). */
async function pick(user: ReturnType<typeof setup>, picks: [string, number][]) {
    for (const [id, qty] of picks) {
        await user.click(screen.getByTestId(`quote-line-${id}`));
        const field = screen.getByTestId(`quote-qty-${id}`);
        await user.clear(field);
        await user.type(field, String(qty));
    }
    await user.click(screen.getByRole("button", { name: t.continueAction }));
}

const money = (el: HTMLElement) => el.textContent?.replace(/\s+/g, " ").trim() ?? "";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

beforeEach(() => {
    onlineRef.value = true;
    entitlement.data = { status: "active" };
    record.mutateAsync.mockResolvedValue({ clientSnapshotId: "csid-1", syncState: "synced" });
});

describe("o total é o do MOTOR — igualdade, nunca espionagem (FR-1916)", () => {
    it("N itens × quantidade: bruto e total batem com computeQuote rodado fora da tela", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [
            ["p-vaso", 2],
            ["p-prato", 3],
        ]);

        const expected = computeQuote({
            lines: [
                { input: inputOf(VASO_NUMBERS), quantity: 2, name: "Vaso" },
                { input: inputOf(PRATO_NUMBERS), quantity: 3, name: "Prato" },
            ],
        });

        expect(money(screen.getByTestId("quote-gross"))).toContain(formatBRL(expected.grossTotal));
        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
        expect(money(screen.getByTestId("quote-cost-floor"))).toContain(
            formatBRL(expected.costFloor),
        );
    });

    it("um KIT entra como UM item, e o subtotal é o das peças × quantidade", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["k-1", 1]]);

        const expected = computeQuote({
            lines: [
                { input: inputOf(PECA_KIT_NUMBERS), quantity: 2, name: "Peça 1" },
                // A peça degradada não tem nome vinculado — o motor não inventa rótulo (`name` ausente).
                { input: inputOf(PRATO_NUMBERS), quantity: 1 },
            ],
        });

        // O kit é UM item do orçamento (o vendedor vende o kit), e o número é a soma das peças.
        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
    });

    it("a peça DEGRADADA do kit entra, com a legenda que o produto já tem (D6, ADR-0017 §6)", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["k-1", 1]]);

        // Nem erro, nem exclusão silenciosa: a linha sem vínculo é uma peça avulsa, e diz isso.
        expect(within(screen.getByTestId("quote-line-k-1")).getByText(/\(avulsa\)/)).toBeVisible();
    });

    it("um produto com preço FIXADO entra pelo preço do MOTOR, nunca pelo fixado (ADR-0033 §3)", async () => {
        const user = setup();
        renderBuilder({ products: [FIXADO] });
        await pick(user, [["p-fixado", 1]]);

        const expected = computeQuote({
            lines: [{ input: inputOf(PRATO_NUMBERS), quantity: 1, name: "Fixado" }],
        });

        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
        // A declaração do vendedor é observação de catálogo — não é uma segunda fonte de preço.
        expect(money(screen.getByTestId("quote-net"))).not.toContain(formatBRL(999));
    });

    it("um item do catálogo com marketplaces marcados NÃO embute comissão (Q6: venda direta)", async () => {
        const user = setup();
        const comCanal = productOf("p-canal", "Com canal", PRATO_NUMBERS, {
            includeMarketplace: true,
            channels: [{ marketplace: "shopee", modality: "", commissionPct: "20" }],
        } as unknown as Partial<ProductOut>);
        renderBuilder({ products: [comCanal] });
        await pick(user, [["p-canal", 1]]);

        const expected = computeQuote({
            lines: [{ input: inputOf(PRATO_NUMBERS), quantity: 1, name: "Com canal" }],
        });
        // `computeQuote` recusa `channels` em runtime — se o construtor os repassasse, isto explodiria
        // antes de renderizar. O número tem de ser o da venda direta, e a tela tem de existir.
        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
    });
});

describe("o produto PARADO não pode ser orçado (18b)", () => {
    it("não entra no orçamento, e a linha DIZ por quê", async () => {
        const user = setup();
        renderBuilder({ products: [VASO, PARADO] });

        const row = screen.getByTestId("quote-line-p-parado");
        expect(within(row).getByText(/preço parado desde/)).toBeVisible();
        await user.click(row);
        // Clicar não o adiciona: não há campo de quantidade para um preço que não recalcula hoje.
        expect(screen.queryByTestId("quote-qty-p-parado")).not.toBeInTheDocument();
    });
});

describe("o desconto incide no TOTAL, uma vez (ADR-0034 §1.2)", () => {
    it("percentual: o líquido é o do motor com o mesmo desconto", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 2]]);

        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "PCT");
        await user.clear(screen.getByTestId("quote-discount-value"));
        await user.type(screen.getByTestId("quote-discount-value"), "10");

        const discount: QuoteDiscount = { mode: "PCT", value: 10 };
        const expected = computeQuote({
            lines: [{ input: inputOf(VASO_NUMBERS), quantity: 2, name: "Vaso" }],
            discount,
        });

        expect(money(screen.getByTestId("quote-discount-amount"))).toContain(
            formatBRL(expected.discountAmount),
        );
        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
    });

    it("em reais: o mesmo caminho, o mesmo motor", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 2]]);

        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "AMOUNT");
        await user.clear(screen.getByTestId("quote-discount-value"));
        await user.type(screen.getByTestId("quote-discount-value"), "10");

        const expected = computeQuote({
            lines: [{ input: inputOf(VASO_NUMBERS), quantity: 2, name: "Vaso" }],
            discount: { mode: "AMOUNT", value: 10 },
        });

        expect(money(screen.getByTestId("quote-net"))).toContain(formatBRL(expected.netTotal));
    });
});

describe("abaixo do custo AVISA, nunca bloqueia (Q10, ADR-0034 §1.5)", () => {
    it("mostra o aviso E mantém o Enviar habilitado", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 1]]);

        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "PCT");
        await user.clear(screen.getByTestId("quote-discount-value"));
        await user.type(screen.getByTestId("quote-discount-value"), "90");

        const aviso = screen.getByTestId("quote-below-cost");
        expect(aviso).toBeVisible();
        // A frase é a da prancheta, com o quanto falta — nunca um "não pode" genérico.
        expect(aviso.textContent).toContain(t.belowCost.split("{valor}")[0]?.trim());
        // O que esta fatia NÃO faz: bloquear. Vender abaixo do custo é decisão do vendedor.
        expect(screen.getByTestId("quote-send")).toBeEnabled();
    });

    it("empate NÃO é 'abaixo': vender exatamente no custo não é vender abaixo dele", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 1]]);

        const base = computeQuote({
            lines: [{ input: inputOf(VASO_NUMBERS), quantity: 1, name: "Vaso" }],
        });
        // Desconto EXATO até o piso: líquido == custo.
        const exato = base.grossTotal - base.costFloor;
        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "AMOUNT");
        await user.clear(screen.getByTestId("quote-discount-value"));
        await user.type(
            screen.getByTestId("quote-discount-value"),
            exato.toFixed(2).replace(".", ","),
        );

        expect(screen.queryByTestId("quote-below-cost")).not.toBeInTheDocument();
    });
});

describe("'Válido até' é TEXTO, nunca estado (Q7, ADR-0034 §2)", () => {
    it("ecoa os dias que o vendedor escolheu — não nasce ciclo de vida nenhum", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 1]]);

        const validade = screen.getByTestId("quote-valid-until");
        expect(validade).toBeVisible();
        expect(validade.textContent).toContain(t.validUntil);
    });
});

describe("antes de Enviar, NADA congela (FR-1916)", () => {
    it("montar, mudar quantidade e dar desconto não grava um único snapshot", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [
            ["p-vaso", 2],
            ["p-prato", 1],
        ]);
        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "PCT");
        await user.type(screen.getByTestId("quote-discount-value"), "5");

        expect(record.mutateAsync).not.toHaveBeenCalled();
        expect(record.mutate).not.toHaveBeenCalled();
    });
});

describe("Enviar exige conexão (decisão 4 do dono, 27/08)", () => {
    it("offline: o botão está desabilitado COM a razão, e NADA entra na fila", async () => {
        onlineRef.value = false;
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 1]]);

        expect(screen.getByTestId("quote-send")).toBeDisabled();
        expect(screen.getByTestId("quote-send-reason")).toHaveTextContent(t.sendOffline);
        // A razão é de CONEXÃO, nunca "não é premium" — o construtor funciona offline por desenho.
        await user.click(screen.getByTestId("quote-send"));
        expect(record.mutateAsync).not.toHaveBeenCalled();
    });
});

describe("Enviar congela — UMA requisição, o documento do T133", () => {
    it("online: uma chamada, com o payload que buildQuotePayload produz", async () => {
        const user = setup();
        const onSent = vi.fn();
        renderBuilder({ onSent });
        await pick(user, [
            ["p-vaso", 2],
            ["p-prato", 1],
        ]);
        await user.selectOptions(screen.getByTestId("quote-discount-mode"), "PCT");
        await user.clear(screen.getByTestId("quote-discount-value"));
        await user.type(screen.getByTestId("quote-discount-value"), "10");
        await user.click(screen.getByTestId("quote-send"));

        expect(record.mutateAsync).toHaveBeenCalledTimes(1);
        const body = record.mutateAsync.mock.calls[0]?.[0] as SnapshotIn;

        const expected = computeQuote({
            lines: [
                { input: inputOf(VASO_NUMBERS), quantity: 2, name: "Vaso" },
                { input: inputOf(PRATO_NUMBERS), quantity: 1, name: "Prato" },
            ],
            discount: { mode: "PCT", value: 10 },
        });
        const payload = buildQuotePayload(expected, {
            lines: [
                { kind: "PRODUCT", id: "p-vaso", name: "Vaso" },
                { kind: "PRODUCT", id: "p-prato", name: "Prato" },
            ],
            discount: { mode: "PCT", value: 10 },
        });

        expect(String(body.kind)).toBe("QUOTE");
        expect(String(body.headlineBasis)).toBe("PRECO_ORCAMENTO");
        expect(body.modelVersion).toBe(expected.modelVersion);
        // O card e o documento são o MESMO número (VR-503) — é o que o CHECK do banco amarra.
        expect(String(body.headlineTotal)).toBe(payload.totals.precoOrcamento);
        expect(body.payload).toEqual(payload as unknown as SnapshotIn["payload"]);
        expect(body.quoteValidityDays).toBeGreaterThan(0);
        expect(onSent).toHaveBeenCalledTimes(1);
    });

    it("um Enviar é UMA requisição — dois cliques não geram dois orçamentos", async () => {
        const user = setup();
        renderBuilder();
        await pick(user, [["p-vaso", 1]]);
        const send = screen.getByTestId("quote-send");
        await user.click(send);
        await user.click(send);

        expect(record.mutateAsync).toHaveBeenCalledTimes(1);
    });
});
