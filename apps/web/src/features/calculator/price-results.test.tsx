// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { ChannelResult, PriceResult } from "@3dprecify/pricing-core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceResults } from "@/features/calculator/calculator-form";
import {
  type ChannelSlotOutcome,
  computeFromForm,
  formatBRL,
} from "@/features/calculator/calculator-model";
import { type CalcFormValues, defaultCalcValues, defaultChannelSlot } from "./calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";

afterEach(() => cleanup());

const t = messages.calculator;

// 019/PR-F (T142, prancheta 10 — "Calculadora - A Conta e os Preços", cópia congelada em
// `specs/019-porte-design/design/`). `PriceResults` isolado (sem a página `Calcular`): o mesmo
// harness de `freight-line-names-its-control.test.tsx` (a fatia 016/A2), estendido para os
// cinco `data-testid`s novos + os seis estados da 10c.

function renderWithForm(values: CalcFormValues) {
  const outcome = computeFromForm(values);
  expect(outcome.ok).toBe(true);
  render(
    <PriceResults result={outcome.result!} values={values} channelOutcomes={outcome.channels} />,
  );
  return outcome;
}

/** A hand-built `PriceResult` — for the states no valid form seed reaches (custo zerado, um
 *  preço já embutindo um valor de seis dígitos). Every field the component reads is present. */
function priceResult(overrides: Partial<PriceResult>): PriceResult {
  return {
    material: 8.4,
    energy: 0.54,
    machine: 1.82,
    falha: 0.2,
    finishing: 2,
    labor: 3,
    admin: 0,
    otherCosts: [],
    custoTotal: 15.96,
    precoVarejo: 23.94,
    precoAtacado: 20.75,
    channels: [],
    catalogVersion: null,
    modelVersion: "test",
    ...overrides,
  };
}

/** A hand-built channel slot outcome — for the marketplace-card states the fee catalog/band
 *  resolution would take real fixtures to reach (SC-817 unpriced band, no fee typed yet). */
function channelOutcome(overrides: {
  result?: Partial<ChannelResult> | null;
  hasFee?: boolean;
}): ChannelSlotOutcome {
  const base: ChannelResult = {
    marketplace: null,
    feeDeterminants: null,
    feeSource: null,
    precoAnuncioVarejo: 34.36,
    recebidoLiquidoVarejo: 24.24,
    precoAnuncioAtacado: 30.01,
    recebidoLiquidoAtacado: 21.01,
    freightCostVarejo: 0,
    freightCostAtacado: 0,
    surcharges: [],
    error: null,
  };
  return {
    errors: {},
    result: overrides.result === null ? null : { ...base, ...overrides.result },
    hasFee: overrides.hasFee ?? true,
    seal: { kind: "none" },
    freightIsEstimate: false,
    editedFields: {},
    appliedFees: {},
    appliedFeesFromBand: false,
    appliedFixedFeeRulePct: null,
    fixedFeeSource: null,
  };
}

const oneAmazonSlot: CalcFormValues = {
  ...defaultCalcValues,
  channels: [{ ...defaultChannelSlot("AMAZON"), modality: "", commissionPct: "20", fixedFee: "4" }],
};

describe("PriceResults — T142, prancheta 10a: a conta termina no custo total", () => {
  it('não tem mais as linhas "Preço varejo"/"Preço atacado" no cartão do detalhamento', () => {
    renderWithForm({ ...defaultCalcValues, channels: [] });

    const custoTotalRow = screen.getByText(t.results.custoTotal);
    const card = custoTotalRow.closest(".tf-card");
    expect(card).not.toBeNull();
    // Ausência DENTRO da conta — "Preço varejo" ainda existe (o cartão final), "Preço atacado" não
    // existe em lugar NENHUM da tela (a linha-resumo usa a copy combinada `summaryLine`).
    expect(within(card as HTMLElement).queryByText(t.results.varejo)).not.toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText(t.results.atacado)).not.toBeInTheDocument();
    expect(screen.queryByText(t.results.atacado)).not.toBeInTheDocument();
  });

  it("mostra os dois percentuais reais no cabeçalho da seção (markupHeader)", () => {
    renderWithForm({
      ...defaultCalcValues,
      channels: [],
      markupVarejoPct: "50",
      markupAtacadoPct: "30",
    });

    expect(
      screen.getByText(
        t.sections.markupHeader.replace("{varejo}", "50").replace("{atacado}", "30"),
      ),
    ).toBeInTheDocument();
  });
});

describe("PriceResults — T142, prancheta 10a: a barra de proporção dos custos", () => {
  it("tem um segmento por linha > 0, larguras somando 100% (±1) e as cores das bolinhas", () => {
    renderWithForm({ ...defaultCalcValues, channels: [] });

    const bar = screen.getByTestId("cost-proportion-bar");
    const segments = Array.from(bar.children) as HTMLElement[];
    // O seed default (016/PR-C B1) tem 6 linhas > 0: material/energy/machine/falha/finishing/labor
    // (falha e finishing são 0 no seed — ainda contam como segmento, largura 0) + 0 otherCosts.
    expect(segments).toHaveLength(6);

    const widths = segments.map((s) => parseFloat(s.style.width));
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);

    // Material é a maior fatia do seed (R$ 8,40 de R$ 16,16) e usa a cor roxa da marca — a MESMA
    // bolinha que a linha de "Material" no detalhamento (revert 016/US5 FR-907-AC2).
    expect(segments[0].style.background).toContain("--tf-purple");
    const materialDot = screen
      .getByText(t.results.material)
      .closest(".tf-brow")!
      .querySelector(".tf-brow__dot") as HTMLElement;
    expect(materialDot.style.background).toContain("--tf-purple");
  });

  it("não renderiza sem custo total positivo (10c, resultado zerado)", () => {
    render(
      <PriceResults
        result={priceResult({
          material: 0,
          energy: 0,
          machine: 0,
          falha: 0,
          finishing: 0,
          labor: 0,
          custoTotal: 0,
          precoVarejo: 0,
          precoAtacado: 0,
        })}
        values={{ ...defaultCalcValues, channels: [] }}
        channelOutcomes={[]}
      />,
    );
    expect(screen.queryByTestId("cost-proportion-bar")).not.toBeInTheDocument();
  });

  it("soma as parcelas de 'Outros custos' nomeados como segmentos extra (cor neutra)", () => {
    renderWithForm({
      ...defaultCalcValues,
      channels: [],
      otherCosts: [{ name: "Embalagem", value: "3,00" }],
    });

    const bar = screen.getByTestId("cost-proportion-bar");
    expect(bar.children).toHaveLength(7);
    const last = bar.children[6] as HTMLElement;
    expect(last.style.background).toContain("--text-muted");
  });
});

describe("PriceResults — T142, prancheta 10a/10e: o Segmented Varejo|Atacado", () => {
  it("nasce em Varejo: cartão grande = varejo accent, linha-resumo = Atacado", () => {
    renderWithForm({ ...defaultCalcValues, channels: [] });

    const segmented = screen.getByTestId("price-level-segmented");
    expect(segmented).toHaveAttribute("role", "radiogroup");
    const varejoOption = within(segmented).getByRole("radio", { name: t.captions.varejo });
    expect(varejoOption).toHaveAttribute("aria-checked", "true");

    const hero = screen.getByTestId("price-hero");
    expect(hero).toHaveTextContent(t.results.varejo);
    expect(hero.className).toContain("tf-price--accent");
    expect(hero).toHaveTextContent(/R\$\s*24,24/);

    const summary = screen.getByTestId("price-summary-line");
    expect(summary).toHaveTextContent(
      t.sections.summaryLine.replace("{nivel}", t.captions.atacado).replace("{pct}", "30"),
    );
    expect(summary).toHaveTextContent(/R\$\s*21,01/);
  });

  it("trocar para Atacado troca o cartão (superfície neutra), a linha-resumo e os números de cada marketplace", () => {
    renderWithForm(oneAmazonSlot);

    const hero = screen.getByTestId("price-hero");
    expect(hero).toHaveTextContent(t.results.varejo);
    const channelBefore = screen.getByTestId("channel-price").textContent;

    fireEvent.click(
      within(screen.getByTestId("price-level-segmented")).getByRole("radio", {
        name: t.captions.atacado,
      }),
    );

    expect(hero).toHaveTextContent(t.results.atacado);
    // 10a/10d — o cartão do nível ESCOLHIDO que não é accent fica em superfície neutra (nunca o
    // `tone="energy"` cheio que os dois cartões de peso igual usavam antes desta fatia).
    expect(hero.className).toContain("tf-price--neutral");
    expect(hero.className).not.toContain("tf-price--accent");

    const summary = screen.getByTestId("price-summary-line");
    expect(summary).toHaveTextContent(
      t.sections.summaryLine.replace("{nivel}", t.captions.varejo).replace("{pct}", "50"),
    );

    // O cartão do marketplace lia o varejo antes e o atacado agora — os números realmente mudam,
    // não é só o rótulo do topo (compara com o `PricingResult`, não com uma string fixa).
    const channelAfter = screen.getByTestId("channel-price").textContent;
    expect(channelAfter).not.toEqual(channelBefore);
  });
});

describe("PriceResults — T142, prancheta 10a/10c: 'Preços por marketplace' como seção própria", () => {
  it("vem ANTES do cartão final, com o marketplaceLevelHint embaixo", () => {
    renderWithForm(oneAmazonSlot);

    const section = screen.getByTestId("marketplace-prices-section");
    expect(within(section).getByText(t.channels.pricesTitle)).toBeInTheDocument();
    expect(within(section).getByText(t.sections.marketplaceLevelHint)).toBeInTheDocument();

    const hero = screen.getByTestId("price-hero");
    const rel = section.compareDocumentPosition(hero);
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("10c — sem Premium: a seção NÃO EXISTE no DOM (não hidden, não borrada)", () => {
    // A page já entrega `channelOutcomes=[]` sem entitlement ativo (calcular-page.tsx); aqui o
    // contrato é o mesmo que `MarketplaceSection` usa: prop vazia ⇒ nada renderiza.
    renderWithForm({ ...defaultCalcValues, channels: [] });

    expect(screen.queryByTestId("marketplace-prices-section")).not.toBeInTheDocument();
    expect(screen.queryByText(t.channels.pricesTitle)).not.toBeInTheDocument();
    // A conta e os dois preços continuam inteiros (10c: "nem cadeado, nem número borrado").
    expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*24,24/);
  });
});

describe("PriceResults — T142, prancheta 10c: os seis estados", () => {
  it("resultado zerado: custo total e preço em R$ 0,00, sem preço negado (o AvisoDeResultado cobre isto)", () => {
    render(
      <PriceResults
        result={priceResult({
          material: 0,
          energy: 0,
          machine: 0,
          falha: 0,
          finishing: 0,
          labor: 0,
          custoTotal: 0,
          precoVarejo: 0,
          precoAtacado: 0,
        })}
        values={{ ...defaultCalcValues, channels: [] }}
        channelOutcomes={[]}
      />,
    );
    expect(screen.getByTestId("aviso-resultado")).toBeInTheDocument();
    expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*0,00/);
  });

  it("atacado acima do varejo: o Alert info aparece (015/A8, acentos corrigidos)", () => {
    render(
      <PriceResults
        result={priceResult({ precoVarejo: 20, precoAtacado: 25 })}
        values={{ ...defaultCalcValues, channels: [] }}
        channelOutcomes={[]}
      />,
    );
    expect(screen.getByText(t.avisoAtacadoAcimaDoVarejo)).toBeInTheDocument();
    // O texto verbatim da prancheta 10c — acentuado ("está", "é", "só").
    expect(t.avisoAtacadoAcimaDoVarejo).toContain("Nada foi recusado");
  });

  it("marketplace não-lucrativo com frete: líquido negativo, aviso e o sublabel do frete na própria linha", () => {
    const values: CalcFormValues = {
      ...defaultCalcValues,
      channels: [{ ...defaultChannelSlot("SHOPEE"), modality: "" }],
    };
    render(
      <PriceResults
        result={priceResult({})}
        values={values}
        channelOutcomes={[
          channelOutcome({
            result: {
              precoAnuncioVarejo: 34.36,
              recebidoLiquidoVarejo: -3.8,
              freightCostVarejo: 20,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText(t.channels.negativeLiquido)).toBeInTheDocument();
    const freteRow = screen.getByText(t.channels.freightLine).closest(".tf-brow") as HTMLElement;
    expect(within(freteRow).getByText(t.channels.freightHint)).toBeInTheDocument();
    expect(freteRow).toHaveTextContent(`−${formatBRL(20)}`);
  });

  it("marketplace sem tarifa da faixa (SC-817) — a mensagem substitui os números, não um R$ 0,00", () => {
    const values: CalcFormValues = {
      ...defaultCalcValues,
      channels: [{ ...defaultChannelSlot("AMAZON"), modality: "" }],
    };
    render(
      <PriceResults
        result={priceResult({})}
        values={values}
        channelOutcomes={[
          channelOutcome({ result: { precoAnuncioVarejo: null, recebidoLiquidoVarejo: null } }),
        ]}
      />,
    );
    expect(screen.getByTestId("unpriced-level")).toHaveTextContent(t.channels.unpricedBand);
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("marketplace sem comissão informada — o hint de 'informe a comissão', nunca um preço fabricado", () => {
    const values: CalcFormValues = {
      ...defaultCalcValues,
      channels: [{ ...defaultChannelSlot("MERCADO_LIVRE"), modality: "" }],
    };
    render(
      <PriceResults
        result={priceResult({})}
        values={values}
        channelOutcomes={[channelOutcome({ hasFee: false })]}
      />,
    );
    expect(screen.getByText(t.channels.noFeeHint)).toBeInTheDocument();
  });
});

describe("PriceResults — T142, prancheta 10b: 360px, o estresse de seis dígitos", () => {
  it("um preço de 4 dígitos usa o corpo grande (lg); um de 6 dígitos usa o médio (md)", () => {
    const { unmount } = render(
      <PriceResults
        result={priceResult({ precoVarejo: 24.24, precoAtacado: 21.01 })}
        values={{ ...defaultCalcValues, channels: [] }}
        channelOutcomes={[]}
      />,
    );
    expect(screen.getByTestId("price-hero").className).toContain("tf-price--lg");
    unmount();

    render(
      <PriceResults
        result={priceResult({
          material: 950096,
          energy: 0,
          machine: 0,
          falha: 0,
          finishing: 0,
          labor: 0,
          custoTotal: 950096,
          precoVarejo: 950096,
          precoAtacado: 823416.53,
        })}
        values={{ ...defaultCalcValues, channels: [] }}
        channelOutcomes={[]}
      />,
    );
    const hero = screen.getByTestId("price-hero");
    expect(hero.className).toContain("tf-price--md");
    expect(hero.className).not.toContain("tf-price--lg");
    expect(hero).toHaveTextContent(/R\$\s*950\.096,00/);
  });
});
