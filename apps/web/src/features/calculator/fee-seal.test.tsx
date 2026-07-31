// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
