// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
// `@vitest-environment jsdom` (below) shadows the global `URL` with jsdom's own implementation,
// which Node's `fileURLToPath` rejects (it expects ITS OWN `URL` class) — import Node's explicitly.
import { fileURLToPath, URL as NodeURL } from "node:url";

import { grossUp } from "@3dprecify/pricing-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { entryToChannelFees } from "./fee-prefill";
import { ShopeeMeasuredFreightWarning, ShopeeRegressiveFeeWarning } from "./shopee-warnings";

// 016/PR-F homologação (A5) — Radix Popover ships no ResizeObserver in jsdom (see
// shared/ui/info-tip.test.tsx); same no-op stub as calculator-tooltips.test.tsx.
beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});
afterEach(() => cleanup());

const t = messages.calculator.shopeeWarnings;

// 016/PR-F (T061, US17) — os dois avisos honestos, test-first. AC1: CPF < R$12 mostra os dois pontos
// oficiais (verbatim art. 26839) + o contexto; a hipótese linear NÃO é aplicada em cálculo nenhum.
// AC3: o aviso de frete aferido é informativo (não bloqueia, não fabrica número, não some ao editar).

describe("ShopeeRegressiveFeeWarning — US17-AC1 (os dois pontos oficiais, nunca uma fórmula)", () => {
    it("é uma região de status (role=status), acessível", () => {
        render(<ShopeeRegressiveFeeWarning />);
        const alert = screen.getByRole("status");
        expect(alert).toBeInTheDocument();
    });

    it("cita os DOIS pontos oficiais VERBATIM (art. 26839, T057)", () => {
        render(<ShopeeRegressiveFeeWarning />);
        const alert = screen.getByTestId("shopee-regressive-fee-warning");
        expect(alert).toHaveTextContent("R$10 tem uma taxa de R$6,50");
        expect(alert).toHaveTextContent("R$8 terá taxa de R$6");
    });

    it("diz o contexto (CPF acima de 450 pedidos/90 dias) e que a fórmula não é publicada", () => {
        render(<ShopeeRegressiveFeeWarning />);
        const alert = screen.getByTestId("shopee-regressive-fee-warning");
        expect(alert).toHaveTextContent("450 pedidos");
        expect(alert).toHaveTextContent(t.regressiveTitle);
    });
});

describe("ShopeeMeasuredFreightWarning — US17-AC3 (informativo, nunca bloqueia)", () => {
    it("é uma região de status (role=status), acessível", () => {
        render(<ShopeeMeasuredFreightWarning />);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("é estático — não depende de nenhum campo, então nunca some ao editar o formulário", () => {
        const { rerender } = render(<ShopeeMeasuredFreightWarning />);
        expect(screen.getByTestId("shopee-measured-freight-warning")).toBeInTheDocument();
        rerender(<ShopeeMeasuredFreightWarning />);
        expect(screen.getByTestId("shopee-measured-freight-warning")).toBeInTheDocument();
    });

    // 016/PR-F homologação (A5) — a seção Shopee media 1248px a 360px, com os dois avisos somando
    // 48% disso; este era o aviso ESTÁTICO (US17-AC3: sempre presente). Colapsa para UMA linha
    // (título curto + ⓘ InfoTip) — o corpo completo continua acessível, só não ocupa espaço até
    // pedido. O aviso da REGRESSIVA (condicional, com os dois pontos oficiais) fica como está.
    it("[A5] colapsa para uma linha compacta — título sempre visível, corpo completo dentro do InfoTip", async () => {
        const user = userEvent.setup();
        render(<ShopeeMeasuredFreightWarning />);
        const warning = screen.getByTestId("shopee-measured-freight-warning");
        expect(warning).toHaveTextContent(t.measuredFreightTitle);
        // O corpo completo NÃO ocupa a tela até o InfoTip abrir (é isso que compacta a linha).
        expect(screen.queryByText(t.measuredFreightBody)).not.toBeInTheDocument();
        const trigger = screen.getByRole("button", { name: t.measuredFreightTipLabel });
        await user.click(trigger);
        expect(await screen.findByText(t.measuredFreightBody)).toBeInTheDocument();
    });

    it("[A5] continua uma região de status ACESSÍVEL por teclado (foco + Enter, sem clique)", async () => {
        const user = userEvent.setup();
        render(<ShopeeMeasuredFreightWarning />);
        const trigger = screen.getByRole("button", { name: t.measuredFreightTipLabel });
        trigger.focus();
        expect(trigger).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(await screen.findByText(t.measuredFreightBody)).toBeInTheDocument();
    });
});

// US17-AC2 — a hipótese linear (R$ 4 + 0,25 × preço) é colinear com os dois pontos publicados, mas
// NÃO é fato: nenhum caminho de código a computa. Duas provas independentes:
//
//   1. FUNCIONAL — para QUALQUER preço abaixo de R$ 12 na entrada CPF_ALTO_VOLUME, o motor devolve
//      "sem referência" (null), nunca um preço; se alguém colasse a fórmula linear num caminho, este
//      teste pegaria a MUDANÇA (um `anuncio` deixaria de ser null).
//   2. ESTÁTICA — o literal numérico `0.25` (o coeficiente da hipótese) não aparece em NENHUM arquivo
//      de produção do motor/formulário — nem como número JS, nem colado por engano.
describe("US17-AC2 — a hipótese linear NÃO é aplicada em cálculo nenhum", () => {
    const cpfAltoVolumeBands = [
        { minPrice: 12, maxPrice: 80, commissionPct: 20, fixedFee: 7 },
        { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 19 },
        { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 29 },
    ];

    // O piso é sobre o ANÚNCIO (o motor grossUp resolvido), não sobre a base pedida: uma base baixa
    // com fixo de R$ 7 ainda pode grossUp para um anúncio ≥ R$ 12 (ex.: base 3 → anúncio 12,50, dentro
    // da banda). A faixa REALMENTE sem referência é a que o próprio motor recusa — medida abaixo, não
    // adivinhada — e é exatamente essa faixa que o gatilho da tela usa (`isUnpriced`, calculator-model).
    it("toda base cujo grossUp cairia ABAIXO do piso da tabela fica SEM REFERÊNCIA — nunca um anúncio inventado", () => {
        for (let base = 0; base < 2.6; base += 0.5) {
            const r = grossUp(base, { commissionPct: 0, priceBands: cpfAltoVolumeBands });
            expect(r.anuncio, `base=${base}`).toBeNull();
            expect(r.liquido, `base=${base}`).toBeNull();
        }
    });

    it("uma base cujo grossUp alcança o piso passa a precificar normalmente — nunca empurrada até a borda por uma fórmula", () => {
        // (3 + 7) / 0,80 = 12,50 — dentro da banda [12,80): o motor resolve isso pela BANDA publicada,
        // não por interpolar entre os dois pontos oficiais.
        const r = grossUp(3, { commissionPct: 0, priceBands: cpfAltoVolumeBands });
        expect(r.anuncio).toBe(12.5);
        expect(r.appliedBand).toEqual([12, 80]);
    });

    it("entryToChannelFees não inventa fixedFee/commissionPct para preços fora de banda — a decisão é do motor, não de uma fórmula aqui", () => {
        // Regressão de forma: garante que a função de mapeamento não ganhou um ramo condicional por
        // preço (o que seria o primeiro sintoma de uma hipótese linear entrando pela porta dos fundos).
        const fees = entryToChannelFees({
            determinants: { sellerProfile: "CPF_ALTO_VOLUME" },
            commissionPct: null,
            fixedFee: null,
            priceBands: cpfAltoVolumeBands,
            freight: { kind: "NONE" },
            source: "x",
            sourceUrl: "https://x",
            effectiveDate: "2026-03-01",
            lastReviewed: "2026-08-06",
        } as never);
        expect(fees.priceBands).toEqual(cpfAltoVolumeBands);
    });

    it("o literal 0.25 não aparece em nenhum arquivo de produção do motor/formulário (grep estático)", () => {
        const roots = [
            fileURLToPath(new NodeURL("../../../../../packages/pricing-core/src", import.meta.url)),
            fileURLToPath(new NodeURL(".", import.meta.url)),
            fileURLToPath(new NodeURL("../../shared/fee-catalog", import.meta.url)),
        ];
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                const st = statSync(p);
                if (st.isDirectory()) {
                    walk(p);
                    continue;
                }
                if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
                const text = readFileSync(p, "utf8");
                // O literal JS `0.25` (ponto, não vírgula) — a comment em pt-BR que CITA a hipótese usa
                // vírgula ("0,25") de propósito, para não colidir com esta varredura.
                if (/\b0\.25\b/.test(text)) offenders.push(p);
            }
        };
        for (const root of roots) walk(root);
        expect(offenders).toEqual([]);
    });
});
