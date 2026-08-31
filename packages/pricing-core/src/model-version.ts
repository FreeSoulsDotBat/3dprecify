// O RÓTULO do modelo + os campos aposentados (ADR-0026) — o que data a fórmula e o que ela recusa.
// Movido de index.ts na divisão por responsabilidade (chore de legibilidade 2026-08-31); corpo
// verbatim, superfície pública inalterada (guarda: tests/public-surface.test.ts).

// 3.0.0 (ADR-0011): itemized admin (`otherCosts[]`) + the multi-channel result (`channels[]`) are
// breaking to the 2.0.0 result contract ⇒ MAJOR bump. The constant tracks the package.json major so
// a saved calc records which formula produced it.
// 3.1.0 (ADR-0016): E3 adds `computeBom` (assembly = independent per-piece sum + per-marketplace
// rollup) and exports `toMoney`/`sumMoney`/`Decimal` — additive public surface ⇒ MINOR bump.
// 4.0.0 (ADR-0026, 016/US10): `wasteGrams` SAI da entrada — o material passa de
// `custo/kg × (gramas + desperdício)` para `custo/kg × gramas`. Remoção de campo de entrada é
// quebra ⇒ MAJOR, e o rótulo é congelado dentro de um snapshot imutável (ADR-0019): ele precisa
// continuar respondendo QUAL fórmula produziu aquele número.
// 4.1.0 (ADR-0027, 016/PR-F): `PriceBand.fixedFeeRule` (a taxa fixa como FUNÇÃO do preço — Shopee
// abaixo de R$ 8) e `ChannelInput.surcharges` (custo opcional declarado pelo vendedor). As duas
// adições são OPCIONAIS e a ausência preserva o comportamento bit a bit ⇒ MINOR.
// 4.2.0 (ADR-0034, 019/PR-E): nasce `computeQuote` — o orçamento montado (N linhas × quantidade,
// desconto no TOTAL, piso de custo). É superfície pública NOVA; `computeCalculator` e `computeBom`
// não mudam de resultado em nenhum centavo ⇒ MINOR, no precedente da 4.0.0 → 4.1.0. E a afirmação
// não é de leitura: a varredura de igualdade `tests/version-equality-4.1-4.2.test.ts` recomputa 500
// casos de calculadora e 200 de BOM contra uma fixture gerada com o motor 4.1.0 INTOCADO.
// 2026-08-31 (chore de legibilidade, SEM bump deliberado): `bandContaining`/`bandFixedFee` passam a
// ser exportadas (eram reimplementadas em fee-prefill/fee-catalog). Zero cômputo novo, zero centavo
// diferente — e este rótulo é carimbado em snapshot imutável como "qual fórmula produziu o número",
// então ele NÃO se move quando a fórmula não se move.
export const PRICING_MODEL_VERSION = "4.2.0";

/**
 * Campos que já foram entrada do motor e **não são mais aceitos** (ADR-0026 §3.1).
 *
 * A recusa é NOMINAL e por CHAVE PRESENTE, não por valor: um `{...documentoAntigo}` carrega a chave,
 * e é assim que o campo voltaria na prática. Ignorar em silêncio era a alternativa rejeitada — é a
 * definição do defeito que a US10 existe para matar: um preço diferente sem nenhum sinal.
 */
export const RETIRED_INPUT_FIELDS = ["wasteGrams"] as const;

/** Um campo aposentado encontrado num documento gravado, com o valor que a tela vai declarar. */
export interface DiscardedField {
    field: (typeof RETIRED_INPUT_FIELDS)[number];
    /** Sempre texto: a folha é número numa entrada viva e string num documento gravado. Vazio quando
     *  a chave existia sem valor — a CHAVE é o fato a declarar, o valor é só o que dá para mostrar. */
    value: string;
}

/**
 * A porta documentada da recusa (ADR-0026 §3.2): tira os campos aposentados de um documento gravado
 * e devolve, junto, o que foi descartado — para que a tela possa DIZER (FR-913).
 *
 * Pura, determinística, offline e **genérica na folha**: o mesmo mapeamento serve ao documento de
 * cenário (folha string) e a uma entrada viva (folha número).
 *
 * Ela mora aqui, e não em `entities/`/`shared/`, porque "o `wasteGrams` existiu até a 3.x" é a mesma
 * informação que `PRICING_MODEL_VERSION` data. Dois lugares que precisam concordar viram um lugar
 * que fica para trás.
 */
export function stripRetiredFields<T extends Record<string, unknown>>(
    stored: T,
): { kept: Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>; discarded: DiscardedField[] } {
    // O espalhamento copia só as chaves PRÓPRIAS enumeráveis; o `delete` abaixo garante que nem uma
    // chave com `undefined` sobrevive. Atribuir `undefined` no lugar do `delete` devolveria um
    // documento que o próprio motor recusa — a porta cuspindo o que a porta existe para consertar.
    const kept: Record<string, unknown> = { ...stored };
    const discarded: DiscardedField[] = [];
    for (const field of RETIRED_INPUT_FIELDS) {
        if (!(field in stored)) continue;
        const value = stored[field];
        discarded.push({ field, value: value == null ? "" : String(value) });
        delete kept[field];
    }
    return { kept: kept as Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>, discarded };
}

/**
 * `major(modelVersion) < 4` — o sinal para um documento CONGELADO, que não tem a folha para
 * inspecionar (o desperdício já vem somado dentro de `material`, ADR-0026 §3.3).
 *
 * O 4 é literal de propósito: é o major em que a remoção aconteceu, um fato permanente. Derivá-lo de
 * `PRICING_MODEL_VERSION` faria a resposta mudar sozinha no dia de uma 5.0.0 que nada tem a ver com
 * o desperdício.
 */
export function isPreRemovalModel(modelVersion: string): boolean {
    return Number.parseInt(modelVersion.split(".")[0], 10) < 4;
}
