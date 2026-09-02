// `MachineCostReadout` (+ its `fmtHoras` formatter, reused by MachineCostFields) — extracted
// verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { formatBRL } from "@/features/calculator/calculator-model";
import { messages } from "@/shared/i18n/messages.pt-br";

import { captionText } from "../form-atoms/form-styles";

const t = messages.calculator;

// 019/PR-C (T057, prancheta 15) — pt-BR só de agrupamento (sem casas), para a divisão do readout
// ("de R$ 4.000,00 ÷ 3.600 h") e para os números da confirmação ("2.000 h" / "3.600 h").
export function formatHours(n: number): string {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

/** 019/PR-C (T057, prancheta 15a/15b/15d) — o custo/hora deixa de ser legenda solta e vira
 *  READOUT, com a divisão que o produziu escrita embaixo — existe nos DOIS modos agora (15b: hoje
 *  só existia em "estimar"). `machineValueNum===0` mantém o número (é literalmente R$ 0,00, não
 *  uma mentira), mas com peso de tinta menor + a ressalva ao lado (15d). `currentHours<=0` não tem
 *  o que dividir — NADA renderiza (15c: "não há divisão por zero" é a terceira afirmação falsa que
 *  um R$ 0,00 em destaque seria). */
export function MachineCostReadout({
    perHour,
    machineValueNum,
    currentHours,
}: {
    perHour: number;
    machineValueNum: number;
    currentHours: number;
}) {
    if (!(currentHours > 0)) return null;
    const semValor = machineValueNum === 0;
    return (
        <div className="calc-machine-readout" data-testid="machine-readout">
            <span style={captionText}>{t.machineCost.readoutLabel}</span>
            <div className="flex items-baseline gap-2" style={{ flexWrap: "wrap" }}>
                <span
                    className="tf-tnum"
                    style={{
                        fontSize: "var(--fs-xl)",
                        fontWeight: "var(--fw-bold)",
                        color: semValor ? "var(--text-muted)" : "var(--text-strong)",
                        lineHeight: 1.1,
                    }}
                >
                    {formatBRL(perHour)}
                </span>
                {semValor && (
                    <span style={{ fontSize: "var(--fs-caption)", color: "var(--warning-text)" }}>
                        {t.machineCost.missingValueCaveat}
                    </span>
                )}
            </div>
            <span className="tf-tnum" style={captionText}>
                {t.machineCost.readoutDivision
                    .replace("{valor}", formatBRL(machineValueNum))
                    .replace("{horas}", formatHours(currentHours))}
            </span>
        </div>
    );
}
