// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { MarketplaceSection, PriceResults } from "@/features/calculator/calculator-form";
import { type CalcFormValues, defaultCalcValues, defaultChannelSlot } from "./calculator-schema";
import { computeFromForm } from "./calculator-model";

import type { FeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

afterEach(() => cleanup());

const t = messages.calculator;

// Hotfix 016/A2 (2026-08-07) — FR-111b, finalmente cumprida.
//
// A regra: NENHUM valor entra na conta sem um controle na tela que o nomeie. O rótulo antigo
// "Frete / cupom" nomeava um cupom que só existia na cabeça do modelo (o BAND_VOUCHER agora
// DEPRECATED/removido do catálogo servido — ver `freight-declared.test.ts`); o desconto real,
// se existir, SÓ pode vir do campo "Frete" que o vendedor digitou no slot Shopee.
//
// (a) campo vazio ⇒ nenhuma linha de frete e líquido == base
// (b) digitar 12,00 ⇒ exatamente uma linha de −12,00
// (c) valor da linha === valor do campo

const canonical: CalcFormValues = {
    ...defaultCalcValues,
    costPerRoll: "100,00",
    rollWeightKg: "1",
    printGrams: "100",
    printTimeHours: "5",
    avgPowerKw: "0,10",
    tariffPerKwh: "1,00",
    machineValue: "4000,00",
    machineLifetimeHours: "2000",
    maintenanceReservePerHour: "0",
    failurePct: "10",
    finishTimeHours: "0,5",
    finishRatePerHour: "10,00",
    laborHours: "0",
    laborRatePerHour: "0",
    markupVarejoPct: "50",
    markupAtacadoPct: "30",
    includeMarketplace: true,
    otherCosts: [],
};

function renderShopeeSlot(freightCost: string) {
    const values: CalcFormValues = {
        ...canonical,
        channels: [
            {
                ...defaultChannelSlot("SHOPEE"),
                modality: "",
                commissionPct: "20",
                fixedFee: "4",
                freightCost,
            },
        ],
    };
    const outcome = computeFromForm(values);
    expect(outcome.ok).toBe(true);
    render(
        <PriceResults
            result={outcome.result!}
            values={values}
            channelOutcomes={outcome.channels}
        />,
    );
    return outcome;
}

describe("hotfix 016/A2 (H2) — a linha de frete nomeia o controle que a produz", () => {
    it('o rótulo é "Frete", nunca "Frete / cupom"', () => {
        renderShopeeSlot("12,00");
        // 019/PR-F (T142, adoção) — o `<Segmented split>` Varejo|Atacado agora governa qual nível o
        // marketplace mostra; o cartão vem UMA linha por vez (default varejo), não mais as duas juntas.
        expect(screen.getAllByText(t.channels.freightLine)).toHaveLength(1);
        expect(t.channels.freightLine).toBe("Frete");
        expect(screen.queryByText("Frete / cupom")).not.toBeInTheDocument();
    });

    it("(a) campo Frete vazio ⇒ nenhuma linha de frete e líquido == base (nenhum desconto fabricado)", () => {
        const outcome = renderShopeeSlot("");
        expect(screen.queryByText(t.channels.freightLine)).not.toBeInTheDocument();
        const r = outcome.channels[0].result!;
        expect(r.freightCostVarejo).toBe(0);
        expect(r.freightCostAtacado).toBe(0);
        // O gross-up devolve exatamente a base (o preço varejo/atacado ANTES do canal) quando não há
        // frete a descontar — nenhum número fabricado sai do líquido.
        expect(r.recebidoLiquidoVarejo).toBeCloseTo(outcome.result!.precoVarejo, 2);
        expect(r.recebidoLiquidoAtacado).toBeCloseTo(outcome.result!.precoAtacado, 2);
    });

    it("(b)+(c) digitar 12,00 no campo ⇒ uma linha de −R$ 12,00 por nível, igual ao campo — nunca outro número", () => {
        const outcome = renderShopeeSlot("12,00");
        const r = outcome.channels[0].result!;
        expect(r.freightCostVarejo).toBe(12);
        expect(r.freightCostAtacado).toBe(12);
        // 019/PR-F (T142, adoção) — uma linha por vez agora (o nível selecionado, default varejo); o
        // valor mostrado é o MESMO do campo — nunca um desconto de banda/voucher que ele não carrega.
        expect(screen.getAllByText("−R$ 12,00")).toHaveLength(1);
    });
});

// hotfix 016/A2 (H2c) — o subsídio como INFORMAÇÃO, sob o campo "Frete", zero número no código.
const catalogWithSubsidy: FeeCatalog = {
    catalogVersion: "test",
    schemaVersion: "1",
    generatedAt: "2026-08-07T00:00:00.000Z",
    marketplaces: [
        {
            marketplace: "MERCADO_LIVRE",
            determinantsSchema: null,
            categorySpine: null,
            entries: [],
        },
        {
            marketplace: "AMAZON",
            determinantsSchema: null,
            categorySpine: null,
            entries: [],
        },
        {
            marketplace: "SHOPEE",
            determinantsSchema: null,
            categorySpine: null,
            feeAxes: ["commissionPct", "fixedFee", "freightCost"],
            freightSubsidyInfo: {
                bands: [
                    { minPrice: 0, maxPrice: 80, ceiling: 20 },
                    { minPrice: 80, maxPrice: 200, ceiling: 30 },
                    { minPrice: 200, maxPrice: null, ceiling: 40 },
                ],
                source: "Shopee, Centro de Educação do Vendedor, art. 23431",
                sourceUrl: "https://seller.shopee.com.br/edu/article/23431",
                effectiveDate: "2026-03-01",
                lastReviewed: "2026-08-07",
            },
            entries: [],
        },
    ],
};

function Harness({ catalog }: { catalog: FeeCatalog }) {
    const values: CalcFormValues = {
        ...canonical,
        channels: [
            { ...defaultChannelSlot("SHOPEE"), modality: "", commissionPct: "20", fixedFee: "4" },
        ],
    };
    const { control, watch } = useForm<CalcFormValues>({ defaultValues: values });
    const outcome = computeFromForm(watch());
    return (
        <MarketplaceSection
            control={control}
            values={watch()}
            fields={[{ id: "0" }]}
            channelOutcomes={outcome.channels}
            included
            onToggleInclude={() => {}}
            onAppend={() => {}}
            onRemove={() => {}}
            onMarketplaceChange={() => {}}
            refreshFailed={false}
            refreshing={false}
            onRetryCatalog={() => {}}
            spineFor={() => []}
            catalog={catalog}
            entitled
            signedOut={false}
        />
    );
}

describe("hotfix 016/A2 (H2c) — o subsídio de frete da Shopee é INFORMAÇÃO sob o campo Frete", () => {
    it("o catálogo declara freightSubsidyInfo ⇒ a legenda aparece com o teto RESOLVIDO da faixa (dado, não código)", () => {
        render(<Harness catalog={catalogWithSubsidy} />);
        const legend = screen.getByTestId("freight-subsidy-info");
        // anúncio Shopee 20%+R$4 sobre a base do canonical cai na primeira faixa (< R$80) — teto R$20.
        expect(legend).toHaveTextContent("R$ 20,00");
        expect(legend).toHaveTextContent("Shopee, Centro de Educação do Vendedor, art. 23431");
        expect(legend).toHaveTextContent("01/03/2026");
    });

    it("nenhum número de subsídio hardcoded — mudar o dado muda a tela sem tocar código", () => {
        const mutante: FeeCatalog = structuredClone(catalogWithSubsidy);
        const shopee = mutante.marketplaces.find((m) => m.marketplace === "SHOPEE")!;
        shopee.freightSubsidyInfo!.bands[0]!.ceiling = 999;
        render(<Harness catalog={mutante} />);
        expect(screen.getByTestId("freight-subsidy-info")).toHaveTextContent("R$ 999,00");
    });

    it("catálogo SEM freightSubsidyInfo (ML, Amazon) ⇒ nenhuma legenda — dirigido por dado", () => {
        const semCampo: FeeCatalog = structuredClone(catalogWithSubsidy);
        const shopee = semCampo.marketplaces.find((m) => m.marketplace === "SHOPEE")!;
        delete shopee.freightSubsidyInfo;
        render(<Harness catalog={semCampo} />);
        expect(screen.queryByTestId("freight-subsidy-info")).not.toBeInTheDocument();
    });

    it("i18n: nenhuma string de mensagem contém 20/30/40 de subsídio hardcoded (guarda H3)", () => {
        // As mensagens carregam SÓ os placeholders `{ceiling}`/`{source}`/`{date}` — o número vem do
        // dado em runtime, nunca do arquivo de i18n.
        expect(t.channels.freightSubsidy.caption).not.toMatch(/\b(20|30|40)\b/);
    });
});
