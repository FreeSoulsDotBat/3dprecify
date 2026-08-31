// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { BILLING_PLANS } from "./plans";

/** O NBSP do dado vira espaco comum, como o normalizador do RTL ja faz com o texto do DOM. */
const semNbsp = (v: string) => v.replaceAll(String.fromCharCode(160), " ");
import { teaserPriceLine } from "./price-line";
import { TEASER_UPGRADE_TARGET, TeaserUpgrade } from "./teaser-upgrade";

// E6 PR-C (T031/US7) — o acender dos teasers.
//
// Os quatro teasers hoje terminam num beco honesto: sem preço, sem compra, porque a cobrança não
// existia. Agora existe, e cada um ganha o preço REAL e um caminho para assinar — **sem quebrar o
// layout de aviso honesto a 390px**, que foi homologado com tamanhos adversariais.
//
// A regra que mais importa aqui é FR-710/SC-707: **uma só fonte de preço.** Dois preços diferentes
// renderizados no mesmo app é bloqueador de release, e ter uma fonte única é o que torna isso
// impossível em vez de meramente testado.

const t = messages.billing;

afterEach(cleanup);

describe("a linha de preço sai da MESMA fonte da oferta (FR-710/SC-707)", () => {
    it("cita os dois preços verbatim de `BILLING_PLANS`, sem redigitar nada", () => {
        const linha = teaserPriceLine();
        expect(linha).toContain(BILLING_PLANS.monthly.price);
        expect(linha).toContain(BILLING_PLANS.annual.equivalent);
    });

    it("nenhum número FABRICADO — só os três que o produto de fato pratica", () => {
        // A honestidade aqui é sobre o que NÃO aparece: qualquer outro valor na linha seria um preço
        // inventado, e nenhuma asserção de presença acima notaria.
        const numeros = teaserPriceLine().match(/\d+[.,]\d{2}/g) ?? [];
        for (const n of numeros) expect(["15,99", "12,99", "155,88"]).toContain(n);
    });

    it("nenhuma copy de urgência ou escassez", () => {
        // §0.2 e §7.2 proíbem. O texto é dado, então a asserção vale para sempre: se alguém acrescentar
        // um "só hoje", é este teste que fecha a porta.
        const tudo = teaserPriceLine().toLowerCase();
        for (const proibida of [
            "últimas",
            "só hoje",
            "acaba",
            "última chance",
            "aproveite",
            "de r$",
        ]) {
            expect(tudo).not.toContain(proibida);
        }
    });

    it("nenhum preço RISCADO — a proibição do de/por", () => {
        // R$ 191,88 (12 × 15,99) é um fato derivado honesto e pode fundamentar a economia, mas NUNCA
        // pode renderizar como um "de" riscado: isso fabrica um desconto que nunca existiu.
        expect(teaserPriceLine()).not.toContain("191,88");
    });
});

describe("o CTA leva à OFERTA, e não a um checkout que escolheu por ele", () => {
    it("aponta para a superfície onde o vendedor COMPARA os planos", () => {
        // O §7.1 nomeia `/assinatura`, que nunca foi construída — o PR-A entregou a oferta como um
        // Sheet dentro de `/conta`. O alvo é o que EXISTE, e o desalinhamento está registrado no
        // `tasks.md`. O que não pode acontecer é o teaser disparar um checkout com um período que
        // ninguém escolheu: mensal e anual têm preços diferentes, e escolher pelo vendedor é vender
        // por ele.
        expect(TEASER_UPGRADE_TARGET).toBe("/conta?assinar=1");
    });

    it("assinado: um botão Assinar e a linha de preço", () => {
        render(<TeaserUpgrade signedOut={false} />);
        expect(screen.getByRole("link", { name: t.subscribeAction })).toBeInTheDocument();
        expect(screen.getByText(semNbsp(teaserPriceLine()))).toBeInTheDocument();
    });

    it("deslogado: o caminho passa pelo sign-in E PRESERVA a intenção", () => {
        // Sem o `redirect`, quem entra pela oferta cai na home e perde o que veio fazer — o defeito de
        // retorno frio que o `951d714` já consertou uma vez nesta mesma jornada.
        render(<TeaserUpgrade signedOut />);
        const link = screen.getByRole("link", { name: t.subscribeAction });
        expect(link.getAttribute("href")).toContain("/sign-in");
        expect(link.getAttribute("href")).toContain(encodeURIComponent(TEASER_UPGRADE_TARGET));
    });

    it("a linha de preço aparece nos DOIS estados — o preço não é segredo de quem tem conta", () => {
        render(<TeaserUpgrade signedOut />);
        expect(screen.getByText(semNbsp(teaserPriceLine()))).toBeInTheDocument();
    });
});
