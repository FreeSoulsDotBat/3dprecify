// `PriceResults` — US1 hero price + US2 transparent breakdown, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import { useState } from "react";

import type { ChannelSlotOutcome } from "@/features/calculator/calculator-model";
import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, BreakdownRow, Card, PriceHero, Segmented } from "@/shared/ui";
import type { PriceResult } from "@3dprecify/pricing-core";

import { captionText, kickerLabel } from "../form-atoms/form-styles";
import { SectionTitle } from "../form-atoms/section-title";
import { AvisoDeResultado } from "../form-molecules/aviso-de-resultado";
import { CostProportionBar } from "../form-molecules/cost-proportion-bar";
import { HERO_TONE, heroSizeFor, type PriceLevel } from "../form-logic/price-level";
import { ChannelPriceBlocks } from "./channel-price-blocks";

const t = messages.calculator;

// `PriceLevel` is the domain enum ("varejo"/"atacado", pricing-core wire vocabulary — out of the
// i18n rename's scope); the message catalog keys are English (`retail`/`wholesale`). This maps one
// to the other at the one boundary that indexes message objects by the domain value.
const CAPTION_KEY: Record<PriceLevel, "retail" | "wholesale"> = {
    varejo: "retail",
    atacado: "wholesale",
};

/** US1 hero price (um nível por vez) + US2 transparent breakdown. Rendered only for a fully
 *  valid form.
 *
 *  019/PR-F (T142, prancheta 10, decisão do dono 28/08): a conta agora TERMINA no custo total —
 *  "Preço varejo"/"Preço atacado" saem do detalhamento e o markup sobe para o cabeçalho da seção
 *  (`markupHeader`). "Preços por marketplace" vira seção PRÓPRIA, antes dos cartões finais (não
 *  mais dobrada dentro do mesmo Card do detalhamento — a inversão de FR-907 que o 016 tinha feito
 *  para reduzir seções agora abre de novo, porque o segmented precisa de um lugar visível entre
 *  os dois). `<Segmented split>` (já existe desde a PR-A) governa o cartão grande, a linha-resumo
 *  do outro nível e os números de cada marketplace — um único `level` para os três. */
export function PriceResults({
    result,
    values,
    channelOutcomes = [],
}: {
    result: PriceResult;
    values: CalcFormValues;
    channelOutcomes?: ChannelSlotOutcome[];
}) {
    const [level, setLevel] = useState<PriceLevel>("varejo");
    const line = (value: number, optional: boolean) =>
        optional && value === 0 ? ("muted" as const) : ("default" as const);

    // As MESMAS linhas alimentam o detalhamento E a barra de proporção (fonte única — se um dia
    // divergirem, é a barra que erra, nunca o detalhamento; ver o comentário de CostProportionBar).
    const proportionRows = [
        {
            label: t.results.material,
            value: result.material,
            color: "var(--tf-purple)",
            emphasis: "default" as const,
        },
        {
            label: t.results.energy,
            value: result.energy,
            color: "var(--tf-cyan)",
            emphasis: "default" as const,
        },
        {
            label: t.results.machine,
            value: result.machine,
            color: "var(--tf-orange)",
            emphasis: "default" as const,
        },
        {
            label: t.results.failure,
            value: result.falha,
            color: "var(--tf-purple-deep)",
            emphasis: line(result.falha, true),
        },
        {
            label: t.results.finishing,
            value: result.finishing,
            color: "var(--tf-teal-deep)",
            emphasis: line(result.finishing, true),
        },
        {
            label: t.results.labor,
            value: result.labor,
            color: "var(--tf-amber-deep)",
            emphasis: line(result.labor, true),
        },
        // US5 (FR-115): each named "Outros custos" sub-cost is its own breakdown line (a blank name
        // falls back to a neutral label); every one reads the SAME muted dot as "Embalagem" in 10a's
        // example (the prancheta names one example cost — the colour is generic for the whole slot).
        ...result.otherCosts.map((c) => ({
            label: c.name.trim() || t.otherCosts.lineFallback,
            value: c.value,
            color: "var(--text-muted)",
            emphasis: "default" as const,
        })),
    ];

    const heroPrice = level === "varejo" ? result.precoVarejo : result.precoAtacado;
    const heroMarkupPct =
        (level === "varejo" ? values.markupVarejoPct : values.markupAtacadoPct) || "0";
    const otherLevel: PriceLevel = level === "varejo" ? "atacado" : "varejo";
    const summaryPrice = otherLevel === "varejo" ? result.precoVarejo : result.precoAtacado;
    const summaryMarkupPct =
        (otherLevel === "varejo" ? values.markupVarejoPct : values.markupAtacadoPct) || "0";
    const summaryText = t.sections.summaryLine
        .replace("{nivel}", t.captions[CAPTION_KEY[otherLevel]])
        .replace("{pct}", summaryMarkupPct);

    return (
        <>
            {/* (4) Transparent breakdown — every R$ line sums to custo_total; the markup that turns it
          into a price now reads in the section header (10a), not as a derivation row here. */}
            <div className="flex flex-col gap-1">
                <SectionTitle title={t.sections.breakdown} info={t.sectionInfo.breakdown} />
                <p style={captionText} className="tf-tnum">
                    {t.sections.markupHeader
                        .replace("{varejo}", values.markupVarejoPct || "0")
                        .replace("{atacado}", values.markupAtacadoPct || "0")}
                </p>
            </div>
            <div className="flex flex-col gap-2">
                {/* Homologação automatizada (CF-001-LEIGO-D-P5) — a persona que "zera o que não entende"
            chega a custo R$ 0,00 e preço de venda R$ 0,00, e o produto entregava isso calado. Cada
            campo em 0 é perfeitamente válido isolado: só o RESULTADO denuncia. Por isso este aviso
            é o único que não mora num campo — não há um campo culpado. */}
                <AvisoDeResultado result={result} />
                <Card padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-col">
                        {proportionRows.map((row, i) => (
                            <BreakdownRow
                                key={i}
                                label={row.label}
                                value={row.value}
                                color={row.color}
                                emphasis={row.emphasis}
                            />
                        ))}
                        <BreakdownRow
                            label={t.results.totalCost}
                            value={result.custoTotal}
                            emphasis="total"
                        />
                    </div>
                    <CostProportionBar rows={proportionRows} custoTotal={result.custoTotal} />
                </Card>
            </div>

            {/* 019/PR-F (10a/10e) — o primitivo que faltava construir (research §I): a bandeja
          Varejo|Atacado governa o cartão grande, a linha-resumo do outro nível e os números de
          cada marketplace. `radiogroup`, não `tablist`: a escolha é um VALOR que troca o que os
          cartões abaixo mostram, não um painel controlado por `aria-controls` — o mesmo padrão já
          usado pelo `Segmented` de tema/modo-de-máquina neste arquivo (a prancheta transcreve
          `role="tablist"` na marcação estática, mas a semântica a11y não é copy; ver docstring do
          próprio `Segmented`). */}
            <Segmented<PriceLevel>
                options={[
                    { id: "varejo", label: t.captions.retail },
                    { id: "atacado", label: t.captions.wholesale },
                ]}
                value={level}
                onChange={setLevel}
                ariaLabel={t.sections.priceLevelLabel}
                role="radiogroup"
                split
                data-testid="price-level-segmented"
            />

            {/* 019/PR-F (10a/10c) — "Preços por marketplace" agora é seção PRÓPRIA, ANTES dos cartões
          finais (o cartão é o fim da leitura). Ausente por completo sem canal ativo (toggle OFF /
          nenhum slot) OU sem Premium (`channelOutcomes=[]` que a page já passa) — nunca um
          contêiner borrado ou vazio: a seção simplesmente não existe no DOM (10c, "Sem Premium"). */}
            {channelOutcomes.length > 0 && (
                <div className="flex flex-col gap-3" data-testid="marketplace-prices-section">
                    <span style={kickerLabel}>{t.channels.pricesTitle}</span>
                    <div className="tf-marketplace-cards">
                        <ChannelPriceBlocks
                            values={values}
                            channelOutcomes={channelOutcomes}
                            level={level}
                        />
                    </div>
                    <p style={captionText}>{t.sections.marketplaceLevelHint}</p>
                </div>
            )}

            {/* 015/A8 ([F03a-003], decisão do dono 2026-08-03) — atacado acima do varejo é ENTRADA
          VÁLIDA: o motor calcula, nada é recusado, e a UI avisa. A comparação é sobre os PREÇOS
          resultantes, não sobre as strings de markup: é a consequência que o vendedor vê na tela,
          e ela sobrevive a qualquer mudança na forma como o markup é digitado.

          O tom é `info`, deliberadamente, e não `danger`: um aviso escrito como erro faz o
          vendedor concluir que o produto RECUSOU — e o produto não recusou. Isto também é o que o
          separa visualmente de `.tf-field__error`, que é onde uma validação de verdade aparece. */}
            {result.precoAtacado > result.precoVarejo && (
                <Alert tone="info">{t.wholesaleAboveRetailWarning}</Alert>
            )}

            {/* (5) The suggested price — the user's final takeaway, so they close the screen.
          019/PR-F (10a/10d/10e, decisão do dono 28/08): um preço grande por vez agora — o par de
          cartões de peso igual (015/A6) SAI; o outro nível vira a linha-resumo abaixo, no MESMO
          tamanho de texto que o detalhamento usa (BreakdownRow), nunca escondido. */}
            <div className="flex flex-col gap-3">
                {/* T016 — final price card reads centered (label/amount/caption), not left-aligned. */}
                <PriceHero
                    label={t.results[CAPTION_KEY[level]]}
                    value={heroPrice}
                    caption={`${t.captions.markup} ${heroMarkupPct}%`}
                    tone={HERO_TONE[level]}
                    size={heroSizeFor(heroPrice)}
                    center
                    data-testid="price-hero"
                />
                <BreakdownRow
                    label={summaryText}
                    value={summaryPrice}
                    data-testid="price-summary-line"
                />
            </div>
        </>
    );
}
