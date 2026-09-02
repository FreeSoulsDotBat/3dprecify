// `AvisoDeResultado` — the two RESULT-level plausibility warnings with no guilty field, extracted
// verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import type { PriceResult } from "@3dprecify/pricing-core";

import { plausibilityWarnings } from "@/shared/lib/plausibility";
import { Notice } from "@/shared/ui";

/**
 * Homologação automatizada — os dois avisos que NÃO têm campo culpado, porque só o RESULTADO os
 * denuncia:
 *
 * - **preço zero** (CF-001-LEIGO-D-P5): a persona que zera o que não entende chega a custo R$ 0,00
 *   e preço de venda R$ 0,00. Cada campo em 0 é perfeitamente válido isolado.
 * - **custo absurdo** (CF-001-LEIGO-D-P6): erros de casa decimal em vários campos ao mesmo tempo
 *   compõem R$ 6.000.061,60 sem que nenhum limiar POR CAMPO seja atingido.
 *
 * `printGrams: 1` declara ao módulo puro que a peça existe — a tela só chega aqui com um resultado
 * calculado, então a guarda "formulário recém-aberto" já foi satisfeita pelo próprio render.
 */
export function ResultNotice({ result }: { result: PriceResult }) {
    const notices = plausibilityWarnings(
        { printGrams: 1 },
        { custoTotal: result.custoTotal, precoVarejo: result.precoVarejo },
    );
    if (notices.length === 0) return null;
    // 019/PR-C (T056, prancheta 14d) — vira `<Aviso>`, sem "Entendi": não há campo para corrigir, e
    // um botão que não dispensa nada é botão vazio. Duas frases juntas param de ser um `join(" ")` —
    // são dois fatos, e cada um pede seu próprio `<p>`.
    return <Notice data-testid="aviso-resultado" lines={notices.map((a) => a.text)} />;
}
