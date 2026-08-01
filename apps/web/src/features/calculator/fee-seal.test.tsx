// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { STALENESS_DAYS } from "@/shared/fee-catalog";
import { feeSealState } from "./fee-prefill";
import { messages } from "@/shared/i18n/messages.pt-br";

import { FeeSeal } from "./fee-seal";

afterEach(() => cleanup());

const t = messages.calculator.seals;

describe("FeeSeal — honesty states (FR-107)", () => {
  it("a fresh reference shows the source + a pt-BR review date", () => {
    render(
      <FeeSeal state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }} />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.reference);
    expect(seal).toHaveTextContent("Ajuda Shopee");
    expect(seal).toHaveTextContent("06/07/2026"); // ISO → pt-BR dd/mm/yyyy
    expect(seal).not.toHaveTextContent(t.outdated);
  });

  it("a stale reference appends the desatualizada warning", () => {
    render(
      <FeeSeal
        state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-01-01", stale: true }}
      />,
    );
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.outdated);
  });

  it("an embedded (seed) reference says so — AND still carries its review date", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Ajuda Shopee",
          reviewedOn: "2026-07-06",
          embedded: true,
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    // The date used to be dropped here. Hiding it is what made the seed path unable to say how old
    // its number is — and the 30-day alarm below is computed from exactly this date.
    expect(seal).toHaveTextContent("06/07/2026");
  });

  it("an adjusted slot reads 'ajustado por você'", () => {
    render(<FeeSeal state={{ kind: "adjusted" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.adjusted);
  });

  it("an uncovered slot reads 'sem referência' — never a fabricated number", () => {
    render(<FeeSeal state={{ kind: "none" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.none);
  });

  it("the ML freight subsidy is marked as an estimate (A4)", () => {
    render(<FeeSeal state={{ kind: "estimate" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.estimate);
  });
});

// 014/T098 (SC-807 / A5) — o `embedded` era um `return` ANTECIPADO, e engolia duas coisas de uma vez.
//
// (a) O alarme de 30 dias: no caminho da SEMENTE ele nunca disparava. A semente é justamente a cópia
//     que mais envelhece — ela viaja no bundle e só muda quando um build novo sai —, então o único
//     caminho onde "pode estar desatualizada" era impossível era o que mais precisava dela. O
//     docstring do `feeSealState` declarava literalmente o contrato oposto ("marked 'embutida' ... e
//     'desatualizada' passado da janela de 30 dias"): documentação certa, código não.
// (b) O `originCategoryName`: uma alíquota herdada de ANCESTRAL aparecia sem dizer que não é a da
//     categoria escolhida — a disclosure que existe para o vendedor não confundir as duas.
//
// O ramo `catchAll` vizinho aplica `t.outdated` sem olhar `embedded`, o que mostra que a assimetria
// era acidental, não uma decisão. `embedded` virou MODIFICADOR do texto-base.
describe("FeeSeal — `embedded` é modificador, não um desvio que engole o resto (T098)", () => {
  it("embutida E vencida: o alarme de 30 dias dispara também na semente (SC-807)", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Ajuda Shopee",
          reviewedOn: "2026-01-01",
          embedded: true,
          stale: true,
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    expect(seal).toHaveTextContent(t.outdated);
  });

  it("embutida E herdada de ancestral: continua dizendo de QUAL categoria é o número", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Tabela Amazon",
          reviewedOn: "2026-07-06",
          embedded: true,
          originCategoryName: "Celulares e Telefones",
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    expect(seal).toHaveTextContent("Celulares e Telefones");
  });

  it("embutida, vencida E herdada: as três coisas cabem no mesmo selo", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Tabela Amazon",
          reviewedOn: "2026-01-01",
          embedded: true,
          stale: true,
          originCategoryName: "Relógios",
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    expect(seal).toHaveTextContent(t.outdated);
    expect(seal).toHaveTextContent("Relógios");
  });
});

// 014/R2 (homologação da Fase 6C, 2026-07-30) — MEDIDO na tela:
//   "Referência: Tabela de comissões da Amazon — Calçados (comissão sobre base que inclui frete)
//    (para Calçados) · atualizada em 28/07/2026"
//
// O nome sai duas vezes. A cláusula `(para X)` foi acrescentada por este incremento para revelar que
// a alíquota pode vir de um ANCESTRAL da categoria escolhida — e continua necessária para isso. O que
// faltava era notar que a fonte do catálogo da Amazon JÁ nomeia a categoria no próprio rótulo.
//
// A condição certa é sobre o que já foi IMPRESSO, não sobre qual marketplace é: no caminho da semente
// o cabeçalho não cita fonte nenhuma ("referência embutida (offline)"), e ali a cláusula volta a ser
// a única coisa que diz de qual categoria o número é.
describe("FeeSeal — a categoria é nomeada UMA vez (R2 da homologação)", () => {
  const AMAZON_SOURCE =
    "Tabela de comissões da Amazon — Calçados (comissão sobre base que inclui frete)";

  it("fonte que já nomeia a categoria não ganha a cláusula de novo", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: AMAZON_SOURCE,
          reviewedOn: "2026-07-28",
          originCategoryName: "Calçados",
        }}
      />,
    );
    const texto = screen.getByTestId("fee-seal").textContent ?? "";
    expect(texto).toContain(AMAZON_SOURCE); // a fonte inteira continua lá
    expect(texto).not.toContain(`(${t.forCategory} Calçados)`);
    // E o nome aparece exatamente uma vez, que é a asserção que a redundância viola.
    expect(texto.split("Calçados").length - 1).toBe(1);
  });

  it("fonte que NÃO nomeia a categoria continua ganhando a cláusula — é a disclosure do ancestral", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Central do Vendedor",
          reviewedOn: "2026-07-28",
          originCategoryName: "Celulares e Telefones",
        }}
      />,
    );
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(
      `(${t.forCategory} Celulares e Telefones)`,
    );
  });

  it("na semente o cabeçalho não cita fonte, então a cláusula é a única disclosure e permanece", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: AMAZON_SOURCE,
          reviewedOn: "2026-07-28",
          embedded: true,
          originCategoryName: "Calçados",
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    expect(seal).toHaveTextContent(`(${t.forCategory} Calçados)`);
  });
});

// 014/T052 (US5, FR-020b emendada 2026-08-01) — o alarme de obsolescencia tem de SIGNIFICAR alguma
// coisa. A janela era de 30 dias e o laco roda mensalmente, entao todo valor passava os ultimos dias
// do ciclo gritando "pode estar desatualizada" MESMO COM O ROBO FUNCIONANDO. Um alarme que dispara
// todo mes sobre valores corretos e reverificados nao avisa: ele treina o vendedor a ignorar
// exatamente o aviso que a US5 existe para dar.
//
// A decisao do dono (Clarification 2026-08-01) foi manter o relogio em `lastReviewed` — que e onde o
// RISCO mora, porque o perigo e a Amazon ter mudado a tarifa desde que conferimos — e dimensionar a
// JANELA pelo ciclo real. Mover o relogio para a entrega faria um numero nao-verificado ha meses
// parecer fresco ao chegar num aparelho novo: a mentira inversa, e maior.
describe("a janela de obsolescencia cobre o ciclo do laco (T052 / FR-020b emendada)", () => {
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

  it("um ciclo mensal INTEIRO nao alarma — era aqui que o falso positivo nascia", () => {
    // O laco le no dia 1 e volta a ler no dia 1 do mes seguinte: ate 31 dias e operacao normal.
    expect(selo(31)).toMatchObject({ stale: false });
  });

  it("a folga de entrega tambem nao alarma — revisao do PR + merge + corte + o cliente buscar", () => {
    expect(selo(44)).toMatchObject({ stale: false });
  });

  it("passado o ciclo MAIS a folga, alarma — e ai significa que algo falhou de verdade", () => {
    expect(selo(46)).toMatchObject({ stale: true });
  });

  // A propriedade, dita sobre a constante e nao sobre um numero magico: a janela nunca pode ser
  // menor que o ciclo, senao o alarme volta a disparar por construcao.
  it("a janela e MAIOR que o ciclo do laco — a garantia, nao a coincidencia", () => {
    expect(STALENESS_DAYS).toBeGreaterThan(31);
  });
});
