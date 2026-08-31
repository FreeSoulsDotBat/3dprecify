// `CostProportionBar` — the thin cost-proportion bar under the breakdown, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import { messages } from "@/shared/i18n/messages.pt-br";

import { captionText, proportionTrack } from "../form-atoms/form-styles";

const t = messages.calculator;

/** 019/PR-F (10a) — a barra fina de proporção dos custos, sob a conta: as MESMAS linhas e cores
 *  do detalhamento acima, como largura. Reverte 016/US5 FR-907-AC2 (as bolinhas de cor tinham
 *  sido removidas do detalhamento como "chrome de legenda"; a prancheta 10a as traz de volta —
 *  agora como a própria chave de cor da barra, registrando a reversão aqui e no relatório da
 *  fatia). As parcelas somam exatamente `custoTotal` por construção (mesmos valores arredondados
 *  que compõem `PriceResult.custoTotal`, packages/pricing-core); sem custo total positivo a barra
 *  não ensina nada — não renderiza. */
export function CostProportionBar({
    rows,
    custoTotal,
}: {
    rows: { label: string; value: number; color: string }[];
    custoTotal: number;
}) {
    if (custoTotal <= 0 || rows.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            <div style={proportionTrack} data-testid="cost-proportion-bar">
                {rows.map((row, i) => (
                    <span
                        key={i}
                        aria-hidden="true"
                        style={{
                            display: "block",
                            height: "100%",
                            width: `${(row.value / custoTotal) * 100}%`,
                            background: row.color,
                        }}
                    />
                ))}
            </div>
            {/* A frase da prancheta continua em "…metade do seu custo é material.": essa segunda parte
          é o EXEMPLO do desenho (50% = material neste conjunto de dados), não copy fixa — T141
          já registrou a decisão; só a parte fixa é exibida até o dono decidir sobre o exemplo. */}
            <p style={captionText}>{t.sections.proportionCaption}</p>
        </div>
    );
}
