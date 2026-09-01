import type { ParsedCategory } from "./amazon-parse.ts";
import { categoryId } from "./amazon-to-catalog.ts";

// The fail-safe, as testable logic rather than `if` statements buried in a CLI (FR-018a/SC-806).
//
// The failure this exists for is NOT "the table disappeared" — that one is obvious. It is a parser
// that reads the WRONG COLUMN and returns a full set of plausible numbers, which then sails through
// a human's review of the monthly PR because nothing looks wrong. Row count alone cannot catch that;
// pinned canaries can.

export interface SanityOptions {
    /** Below this many parsed rows, treat the run as a source-shape failure. */
    minRows: number;
    /** Valores fixados de uma leitura sabidamente boa: `[categoria, comissão %, mínimo por item]`.
     *
     *  014/T102 — era só `[categoria, comissão]`, e a lacuna era exatamente do tamanho do defeito que
     *  esta guarda existe para pegar: a leitura das colunas é POSICIONAL, então uma coluna inserida na
     *  fonte desloca o `minPerItem` sem tocar no percentual — e a canária dizia `ok: true` sobre uma
     *  tabela em que todo mínimo por item virou zero. Números plausíveis, todos errados, sob selo de
     *  referência. O PAR é o que torna o deslocamento visível. */
    canaries: ReadonlyArray<readonly [string, number, number]>;
}

export type SanityVerdict = { ok: true } | { ok: false; reason: string };

// ⚠ @doc DEC-032 — o piso mora AQUI e não no `.mjs` isento da cobertura: a função estava coberta e
//   o VALOR não, então trocar 28 por 2 não derrubava teste nenhum. 38 linhas na leitura de 28/07.
export const MIN_PARSE_ROWS = 28;

/**
 * Decide se um parse é confiável o bastante para publicar. Devolve VEREDITO em vez de lançar: o
 * chamador tem de poder reagir deixando o artefato intocado e alertando, nunca escrevendo um mapa
 * parcial (SC-806).
 */
export function checkParseSanity(
    categories: readonly ParsedCategory[],
    opts: SanityOptions,
): SanityVerdict {
    if (categories.length < opts.minRows) {
        return {
            ok: false,
            reason: `parsed ${categories.length} categories, below the ${opts.minRows} floor — source shape changed, not a fee change`,
        };
    }
    for (const [name, expectedPct, expectedMin] of opts.canaries) {
        const hit = categories.find((c) => c.name === name);
        if (!hit) return { ok: false, reason: `canary "${name}" is missing from the parse` };
        if (hit.commissionPct !== expectedPct) {
            return {
                ok: false,
                reason: `canary "${name}" expected ${expectedPct}%, got ${hit.commissionPct} — the parser is likely reading the wrong column`,
            };
        }
        if (hit.minPerItem !== expectedMin) {
            return {
                ok: false,
                reason: `canary "${name}" expected a per-item minimum of ${expectedMin}, got ${hit.minPerItem} — the parser is likely reading the wrong column`,
            };
        }
    }
    return { ok: true };
}

/** The band shape the coverage check needs — structurally what the catalog carries. */
export interface CoverableBand {
    minPrice: number;
    maxPrice: number | null;
}

/**
 * ⚠ @doc DEC-051 — um BURACO entre bandas é dado legítimo e passa; o que se recusa é a forma
 *   que o disfarça — sobreposição (a taxa passaria a depender da ordem das linhas raspadas),
 *   limite invertido, e uma segunda banda sem teto. Veredito, nunca throw (SC-806).
 */
export function checkBandCoverage(bands: readonly CoverableBand[]): SanityVerdict {
    const sorted = [...bands].sort((a, b) => a.minPrice - b.minPrice);
    for (const [i, band] of sorted.entries()) {
        if (band.maxPrice !== null && band.maxPrice <= band.minPrice) {
            return {
                ok: false,
                reason: `band [${band.minPrice}, ${band.maxPrice}) cannot contain a price`,
            };
        }
        const next = sorted[i + 1];
        if (!next) continue;
        if (band.maxPrice === null) {
            return {
                ok: false,
                reason: `only the terminal band may be unbounded — [${band.minPrice}, ∞) is followed by [${next.minPrice}, …)`,
            };
        }
        if (next.minPrice < band.maxPrice) {
            return {
                ok: false,
                reason: `bands overlap at ${next.minPrice}: [${band.minPrice}, ${band.maxPrice}) and [${next.minPrice}, …)`,
            };
        }
    }
    return { ok: true };
}

/**
 * A próxima `catalogVersion` ("YYYY-MM-DD.n"): a data da LEITURA mais uma sequência INTEIRA.
 *
 * ⚠ @doc DEC-073 — o rótulo nomeia o DADO, não a execução, e é congelado em payload imutável:
 *   conteúdo diferente sob rótulo idêntico deixa "qual tabela produziu este número" sem
 *   resposta possível, porque o registro não pode ser reescrito.
 */
export function nextCatalogVersion(
    // Exigido, não `string | null`: o artefato SEMPRE carrega um rótulo, e um artefato sem ele é uma
    // falha de forma que `build-amazon.mjs` deve recusar em voz alta — como já recusa um artefato sem
    // o marketplace AMAZON (T091). Aceitar a ausência aqui criava um ramo que nenhum caminho alcança,
    // e o ratchet de 100% o encontrou. Rótulo ILEGÍVEL continua tratado: esse é representável.
    previous: string,
    collectedAt: string,
    changed: boolean,
): string {
    if (!changed) return previous;
    const parsed = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(previous);
    return parsed && parsed[1] === collectedAt
        ? `${collectedAt}.${Number(parsed[2]) + 1}`
        : `${collectedAt}.0`;
}

/**
 * 014/T106 — dois nomes da fonte que colapsam no MESMO `categoryId`.
 *
 * `categoryId` dobra acentos e caixa, o que é o que dá identidade estável a um marketplace que
 * publica só nomes — e é também o que permite a colisão: "Óculos" e "Oculos" viram `oculos`. O
 * gerador não conferia, então isso saía com exit 0 e "sucesso" impresso, enquanto o artefato com ids
 * duplicados derruba o marketplace INTEIRO no cliente (`categorySpineSchema` recusa id duplicado, e
 * `parseSeedResilient` responde descartando o marketplace — um par de acentos apaga a Amazon).
 *
 * O `gate:all` já pegaria o artefato inválido pelo truth-gate de `fee-catalog.test.ts`, então isto
 * não é a última linha de defesa. É a primeira, e é a única que fala com quem rodou o script: a
 * razão nomeia os dois colidentes e o id que eles disputam, porque "colisão" sem nomes não é
 * acionável.
 */
export function checkCategoryIdCollisions(categories: readonly { name: string }[]): SanityVerdict {
    const byId = new Map<string, string[]>();
    for (const c of categories) {
        const id = categoryId(c.name);
        byId.set(id, [...(byId.get(id) ?? []), c.name]);
    }
    const colliding = [...byId].filter(([, names]) => names.length > 1);
    if (colliding.length === 0) return { ok: true };
    return {
        ok: false,
        reason: colliding
            .map(
                ([id, names]) =>
                    `category id "${id}" is claimed by ${names.map((n) => `"${n}"`).join(" and ")}`,
            )
            .join("; "),
    };
}

/** A data de coleta a usar, ou a recusa quando ela nao pode ser afirmada. */
export type CollectedAtVerdict = { ok: true; date: string } | { ok: false; reason: string };

/**
 * 014/T053 (SC-807) — `lastReviewed` so avanca por RELEITURA REAL da fonte.
 *
 * `build-amazon.mjs --from <arquivo>` le uma tabela CAPTURADA, e o `collectedAt` caia no padrao
 * `new Date()`. Reprocessar um arquivo de meses atras carimbava a data de HOJE em todas as entradas:
 * o selo passaria a dizer "atualizada em <hoje>" sobre numeros que ninguem conferiu contra a Amazon.
 * E o pior tipo de mentira que este selo pode contar, porque ela vem carimbada de fresca.
 *
 * Uma tabela capturada tem uma data de captura que SO QUEM CHAMA sabe — entao a resposta honesta e
 * exigi-la e recusar sem ela, em vez de inventar a de hoje.
 */
export function collectedAtFor(opts: {
    fromFixture: boolean;
    envDate?: string | undefined;
    today: string;
}): CollectedAtVerdict {
    if (opts.envDate) return validarData(opts.envDate, opts.today);
    if (opts.fromFixture) {
        return {
            ok: false,
            reason:
                "reading a CAPTURED table (--from) requires COLLECTED_AT: stamping today would advance " +
                "lastReviewed without anyone having re-verified against the source (SC-807)",
        };
    }
    return { ok: true, date: opts.today };
}

/**
 * Uma data de coleta tem de ser uma DATA — achado da revisao adversarial de 2026-08-01, medido
 * executando o gerador: `COLLECTED_AT=banana` saia com exit 0 e escrevia `catalogVersion "banana.0"`,
 * `generatedAt "bananaT00:00:00.000Z"` e `lastReviewed "banana"` nas 78 entradas.
 *
 * O que torna isso DINHEIRO e nao tipografia: o schema aceita (`z.string().min(1)` nos tres campos),
 * a suite inteira passa sobre o artefato envenenado, e `isStale` devolve FALSE numa data ilegivel
 * ("never cry wolf"). O selo declara aqueles valores frescos PARA SEMPRE.
 *
 * O vetor e HERDADO — o gerador ja fazia `process.env.COLLECTED_AT ?? hoje` sem validar. A T053 o
 * ALARGOU ao tornar a variavel obrigatoria no caminho `--from`, promovendo uma string digitada a mao
 * a fluxo normal. Por isso a validacao vale para TODOS os caminhos, e nao so para o capturado.
 *
 * O futuro tambem e recusado: um `lastReviewed` amanha nunca envelhece, entao o selo ficaria fresco
 * por tempo indeterminado — o mesmo dano, por outra porta.
 */
function validarData(valor: string, today: string): CollectedAtVerdict {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return { ok: false, reason: `COLLECTED_AT="${valor}" is not a date in YYYY-MM-DD form` };
    }
    const t = Date.parse(`${valor}T00:00:00.000Z`);
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== valor) {
        return { ok: false, reason: `COLLECTED_AT="${valor}" is not a real calendar date` };
    }
    if (valor > today) {
        return {
            ok: false,
            reason: `COLLECTED_AT="${valor}" is in the future — a re-read cannot have happened tomorrow`,
        };
    }
    return { ok: true, date: valor };
}
