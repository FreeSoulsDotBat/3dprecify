// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STALENESS_DAYS } from "@/shared/fee-catalog";
import { useFeeSealDismissStore } from "@/shared/lib/fee-seal-dismiss-store";
import { messages } from "@/shared/i18n/messages.pt-br";

import { feeSealState } from "./fee-prefill";
import { FeeSeal, FixedFeeSourceBadge } from "./fee-seal";

// 019/PR-C (T052, prancheta "Selo de Procedencia") — REESCRITA: o selo principal ("Comissão" /
// "Taxa fixa") deixou de ser um `<Badge>` pílula e virou um `tf-alert--compact` denso (13a/13b),
// com "Ver fonte" (quando a entrada carrega `sourceUrl`) e "Dispensar" (até a fonte mudar, T058).
//
// DIVERGÊNCIA registrada (a prancheta é a autoridade de desenho, contra o texto literal do T052):
// os três estados curtos — `adjusted`/`estimate`/`none` — o T052 sugeria virarem `<Alert compact>`
// sem dispensa; a prancheta 13b (estados 4/5/6/7) diz que os três CONTINUAM pílula (`Badge`), e é
// isso que este arquivo testa. Só o bloco que respalda um NÚMERO (comissão/taxa fixa) virou `tf-alert`.

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

afterEach(() => cleanup());
beforeEach(() => {
    localStorage.clear();
    useFeeSealDismissStore.setState({ keys: [] });
});

const t = messages.calculator.seals;

describe("FeeSeal — os três qualificadores curtos continuam pílula (13b·4/5/6/7)", () => {
    it("ajustado por você — Badge, tom accent, sem dispensa (nada a lembrar)", () => {
        render(<FeeSeal state={{ kind: "adjusted" }} marketplace="AMAZON" />);
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.adjusted);
        expect(seal.tagName).toBe("SPAN"); // Badge, não Alert
        expect(seal.className).toContain("tf-badge--accent");
        expect(within(seal).queryByRole("button")).not.toBeInTheDocument();
    });

    it("a estimativa de frete (A4) — Badge, tom info", () => {
        render(<FeeSeal state={{ kind: "estimate" }} marketplace="MERCADO_LIVRE" />);
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.estimate);
        expect(seal.className).toContain("tf-badge--info");
    });

    it("sem referência — Badge, tom warning (nunca uma cor que pareça confirmada)", () => {
        render(<FeeSeal state={{ kind: "none" }} marketplace="OUTRO" />);
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.none);
        expect(seal.className).toContain("tf-badge--warning");
    });
});

describe("FeeSeal — a referência online (13b·1) é um tf-alert denso", () => {
    it("nomeia o NÚMERO ('Comissão'), não a natureza ('Referência') — 13a nota 1", () => {
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }}
                marketplace="SHOPEE"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.commissionLabel); // "Comissão"
        expect(seal).not.toHaveTextContent(t.reference); // "Referência" não aparece mais
        expect(seal).toHaveTextContent("Ajuda Shopee");
        expect(seal).toHaveTextContent("06/07/2026");
        expect(seal).not.toHaveTextContent(t.outdated);
        expect(seal.getAttribute("role")).toBe("status"); // Alert (não danger)
    });

    it("tom info quando a fonte é online (não embutida)", () => {
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }}
                marketplace="SHOPEE"
            />,
        );
        expect(screen.getByTestId("fee-seal").className).toContain("tf-alert--info");
    });

    it("uma stale reference soma a pílula 'pode estar desatualizada' (13c) — tom neutro, dentro do bloco", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Ajuda Shopee",
                    reviewedOn: "2026-01-01",
                    stale: true,
                }}
                marketplace="SHOPEE"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.outdated);
        // a pílula é neutra — nunca compete com o tom de quem respalda o número (13b·4 nota do dono).
        const pilula = within(seal).getByText(t.outdated);
        expect(pilula.className).toContain("tf-badge--neutral");
    });
});

describe("FeeSeal — 'Ver fonte' (13a·6) só existe quando a entrada carrega sourceUrl", () => {
    it("sem sourceUrl: nenhuma ação 'Ver fonte' — nada para abrir", () => {
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }}
                marketplace="SHOPEE"
            />,
        );
        expect(screen.queryByRole("button", { name: t.verFonte })).not.toBeInTheDocument();
    });

    it("com sourceUrl: 'Ver fonte' abre o diálogo com a citação inteira, a data e o link (13a·2)", async () => {
        const user = setup();
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Central de Educação do Vendedor Shopee — Política de Comissão 2026",
                    reviewedOn: "2026-08-06",
                    sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
                }}
                marketplace="SHOPEE"
            />,
        );
        expect(screen.queryByTestId("fee-seal-source-dialog")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: t.verFonte }));

        const dialog = await screen.findByTestId("fee-seal-source-dialog");
        expect(within(dialog).getByText(t.fonteTitle)).toBeInTheDocument();
        expect(dialog).toHaveTextContent(
            "Central de Educação do Vendedor Shopee — Política de Comissão 2026",
        );
        expect(dialog).toHaveTextContent(t.fonteConferida.replace("{data}", "06/08/2026"));
        expect(within(dialog).getByRole("link")).toHaveAttribute(
            "href",
            "https://seller.shopee.com.br/edu/article/26839",
        );
        expect(within(dialog).getByRole("link")).toHaveAttribute("target", "_blank");
        expect(within(dialog).getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
        expect(dialog).toHaveTextContent(t.fonteAviso.replace("{marketplace}", "Shopee"));
    });
});

describe("FeeSeal — Dispensar (T058) some até a fonte mudar (decisão do dono 2026-08-26)", () => {
    it("dispensar tira o selo da tela", async () => {
        const user = setup();
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }}
                marketplace="SHOPEE"
            />,
        );
        await user.click(screen.getByRole("button", { name: t.dispensar }));
        expect(screen.queryByTestId("fee-seal")).not.toBeInTheDocument();
    });

    it("a MESMA fonte+data continua oculta depois de remontar (reload)", async () => {
        const user = setup();
        const state = {
            kind: "reference" as const,
            source: "Ajuda Shopee",
            reviewedOn: "2026-07-06",
        };
        const { unmount } = render(<FeeSeal state={state} marketplace="SHOPEE" />);
        await user.click(screen.getByRole("button", { name: t.dispensar }));
        unmount();

        render(<FeeSeal state={state} marketplace="SHOPEE" />);
        expect(screen.queryByTestId("fee-seal")).not.toBeInTheDocument();
    });

    it("uma data diferente (a fonte mudou) volta a mostrar o selo", () => {
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }}
                marketplace="SHOPEE"
            />,
        );
        useFeeSealDismissStore.getState().dismiss("SHOPEE::Ajuda Shopee::2026-07-06");
        cleanup();
        render(
            <FeeSeal
                state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-08-01" }}
                marketplace="SHOPEE"
            />,
        );
        expect(screen.getByTestId("fee-seal")).toBeInTheDocument();
    });
});

// 014/T098 (SC-807 / A5) — o `embedded` é um MODIFICADOR do texto-base, não um `return` antecipado
// que engole o alarme de obsolescência e a categoria de origem (a lição continua valendo com o
// novo render — o que muda é ONDE o texto mora, não a regra).
describe("FeeSeal — embutida (offline, 13b·3): sem citação, sem 'Ver fonte'", () => {
    it("diz 'referência embutida (offline)', tom neutro, e NÃO oferece 'Ver fonte'", () => {
        const { container } = render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Ajuda Shopee",
                    reviewedOn: "2026-07-06",
                    embedded: true,
                }}
                marketplace="SHOPEE"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent("06/07/2026"); // a data sobrevive (SC-807)
        expect(seal.className).toContain("tf-alert--neutral");
        expect(screen.queryByRole("button", { name: t.verFonte })).not.toBeInTheDocument();
        // decisão do dono 28/08 (13b·3) — o ícone "como no design" para a referência embutida: `wifi`,
        // não o `info` padrão do tone `neutral`. Identificado pelo glifo (o DS não marca `data-icon`).
        const glyph = container.querySelector(".tf-alert__icon");
        expect(glyph?.innerHTML).toContain('d="M12 20h.01"');
    });

    it("embutida E vencida: o alarme de 45 dias dispara também na semente (SC-807)", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Ajuda Shopee",
                    reviewedOn: "2026-01-01",
                    embedded: true,
                    stale: true,
                }}
                marketplace="SHOPEE"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent(t.outdated);
    });

    it("embutida E herdada de ancestral: continua dizendo de qual categoria é o número", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Tabela Amazon",
                    reviewedOn: "2026-07-06",
                    embedded: true,
                    originCategoryName: "Celulares e Telefones",
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent("Celulares e Telefones");
    });
});

// R2 da homologação 014 — a categoria não é nomeada duas vezes quando a própria citação já a nomeia.
describe("FeeSeal — a categoria é nomeada UMA vez (R2 da homologação)", () => {
    const AMAZON_SOURCE =
        "Tabela de comissões da Amazon — Calçados (comissão sobre base que inclui frete)";

    it("fonte que já nomeia a categoria não ganha a linha 'para X' de novo", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: AMAZON_SOURCE,
                    reviewedOn: "2026-07-28",
                    originCategoryName: "Calçados",
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(AMAZON_SOURCE);
        expect(seal).not.toHaveTextContent(`${t.forCategory} Calçados`);
        expect((seal.textContent ?? "").split("Calçados").length - 1).toBe(1);
    });

    it("fonte que NÃO nomeia a categoria ganha a linha — é a disclosure do ancestral", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: "Central do Vendedor",
                    reviewedOn: "2026-07-28",
                    originCategoryName: "Celulares e Telefones",
                }}
                marketplace="AMAZON"
            />,
        );
        expect(screen.getByTestId("fee-seal")).toHaveTextContent(
            `${t.forCategory} Celulares e Telefones`,
        );
    });

    it("na semente o cabeçalho não cita fonte, então a linha é a única disclosure e permanece", () => {
        render(
            <FeeSeal
                state={{
                    kind: "reference",
                    source: AMAZON_SOURCE,
                    reviewedOn: "2026-07-28",
                    embedded: true,
                    originCategoryName: "Calçados",
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent(`${t.forCategory} Calçados`);
    });
});

// 019/PR-C (13b·5) — o catch-all vira LINHA do corpo, em laranja, com o ícone de alerta — nunca
// pílula (uma pílula de 58 caracteres estoura o cartão a 360px, a armadilha do 016/PR-B).
describe("FeeSeal — o catch-all (13b·5) é linha do corpo, nunca pílula", () => {
    it("mostra a citação da entrada + a linha 'categoria não informada — usando a maior alíquota'", () => {
        render(
            <FeeSeal
                state={{
                    kind: "catchAll",
                    source: "Tabela Amazon — Outros",
                    reviewedOn: "2026-07-28",
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent("Tabela Amazon — Outros");
        expect(seal).toHaveTextContent(`${t.catchAll} ${t.catchAllHighest}`);
        // nunca uma pílula própria para essa linha — o texto vive dentro do próprio alerta.
        expect(within(seal).queryByText(`${t.catchAll} ${t.catchAllHighest}`)?.tagName).not.toBe(
            "SPAN",
        );
    });

    it("catch-all embutido diz que é da semente (T055)", () => {
        render(
            <FeeSeal
                state={{
                    kind: "catchAll",
                    source: "Tabela Amazon",
                    reviewedOn: "2026-07-28",
                    embedded: true,
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent(`${t.catchAll} ${t.catchAllHighest}`);
    });

    it("catch-all do catálogo NÃO se diz embutido", () => {
        render(
            <FeeSeal
                state={{ kind: "catchAll", source: "Tabela Amazon", reviewedOn: "2026-07-28" }}
                marketplace="AMAZON"
            />,
        );
        expect(screen.getByTestId("fee-seal")).not.toHaveTextContent(t.embedded);
    });

    it("embutido E vencido: as duas coisas cabem, como no ramo `reference`", () => {
        render(
            <FeeSeal
                state={{
                    kind: "catchAll",
                    source: "Tabela Amazon",
                    reviewedOn: "2026-01-01",
                    embedded: true,
                    stale: true,
                }}
                marketplace="AMAZON"
            />,
        );
        const seal = screen.getByTestId("fee-seal");
        expect(seal).toHaveTextContent(t.embedded);
        expect(seal).toHaveTextContent(t.outdated);
    });
});

describe("a janela de obsolescência é de 45 dias (T052/FR-020b) — comentário do componente corrigido", () => {
    const dia = 24 * 60 * 60 * 1000;
    const lido = Date.parse("2026-08-01");
    const selo = (diasDepois: number) =>
        feeSealState({
            entry: {
                determinants: null,
                commissionPct: 14,
                fixedFee: 0,
                minPerItem: 0,
                priceBands: null,
                freight: { kind: "NONE" },
                source: "Tabela Amazon",
                sourceUrl: "https://x",
                effectiveDate: "2026-08-01",
                lastReviewed: "2026-08-01",
            } as never,
            source: "catalog",
            now: lido + diasDepois * dia,
            edited: false,
        });

    it("STALENESS_DAYS é 45, não 30", () => {
        expect(STALENESS_DAYS).toBe(45);
    });

    it("um ciclo mensal inteiro (31 dias) não alarma; passado ciclo+folga (46), alarma", () => {
        expect(selo(31)).toMatchObject({ stale: false });
        expect(selo(45)).toMatchObject({ stale: false });
        expect(selo(46)).toMatchObject({ stale: true });
    });
});

describe("FixedFeeSourceBadge (T057) — a procedência própria da taxa fixa, num tf-alert à parte", () => {
    it("mostra o rótulo 'Taxa fixa', a citação e 'vigente desde' (pt-BR) — nunca 'atualizada em'", () => {
        render(
            <FixedFeeSourceBadge
                source={{
                    source: "Amazon — Preços e planos de venda",
                    sourceUrl: "https://venda.amazon.com.br/precos",
                    effectiveDate: "2020-12-01",
                }}
                marketplace="AMAZON"
            />,
        );
        const badge = screen.getByTestId("fixed-fee-source-seal");
        expect(badge).toHaveTextContent(t.fixedFeeSource);
        expect(badge).toHaveTextContent("Amazon — Preços e planos de venda");
        expect(badge).toHaveTextContent(t.fixedFeeSourceSince);
        expect(badge).toHaveTextContent("01/12/2020");
        // separado do selo principal — nunca o mesmo nó.
        expect(screen.queryByTestId("fee-seal")).not.toBeInTheDocument();
    });

    it("'Ver fonte' abre o mesmo diálogo, com o link da procedência própria", async () => {
        const user = setup();
        render(
            <FixedFeeSourceBadge
                source={{
                    source: "Amazon — Preços e planos de venda",
                    sourceUrl: "https://venda.amazon.com.br/precos",
                    effectiveDate: "2020-12-01",
                }}
                marketplace="AMAZON"
            />,
        );
        await user.click(screen.getByRole("button", { name: t.verFonte }));
        const dialog = await screen.findByTestId("fee-seal-source-dialog");
        expect(within(dialog).getByRole("link")).toHaveAttribute(
            "href",
            "https://venda.amazon.com.br/precos",
        );
    });

    it("Dispensar tira o selo até a data mudar", async () => {
        const user = setup();
        const source = {
            source: "Amazon — Preços e planos de venda",
            sourceUrl: "https://venda.amazon.com.br/precos",
            effectiveDate: "2020-12-01",
        };
        render(<FixedFeeSourceBadge source={source} marketplace="AMAZON" />);
        await user.click(screen.getByRole("button", { name: t.dispensar }));
        expect(screen.queryByTestId("fixed-fee-source-seal")).not.toBeInTheDocument();
    });
});
