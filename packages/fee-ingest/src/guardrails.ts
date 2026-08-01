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

/**
 * Decide whether a parse is trustworthy enough to publish.
 *
 * Deliberately returns a verdict instead of throwing: the caller must be able to react by leaving
 * the artifact untouched and alerting — never by writing a partial map (SC-806).
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
 * Is a parsed band set well-formed enough to publish? (014/T114, SC-817.)
 *
 * A GAP is legitimate data and is NOT rejected here — FR-014a is explicit that the window the source
 * leaves unpriced stays unpriced, and `pricing-core` now refuses to price inside one instead of
 * borrowing the neighbour's rate. What this catches is the shapes that make a gap INDISTINGUISHABLE
 * from a parse error:
 *
 * - OVERLAP — two bands claiming the same price. The engine's lower-inclusive lookup would silently
 *   pick whichever came first, so which rate the seller pays would depend on the row order of a
 *   scraped table.
 * - OUT OF ORDER / inverted bounds — a `maxPrice` at or below its own `minPrice` is a band that can
 *   never contain a price, which is a reading error wearing the shape of data.
 * - A SECOND unbounded band — only the terminal band may be open-ended.
 *
 * A verdict, not a throw, for the same reason `checkParseSanity` returns one: the caller must be able
 * to leave the published artifact untouched rather than replace it with something malformed (SC-806).
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
 * A próxima `catalogVersion` ("YYYY-MM-DD.n") — a data da LEITURA mais uma sequência dentro dela.
 *
 * 014 (revisão final adversarial, 2026-07-31): `build-amazon.mjs` cravava `${collectedAt}.0`, então
 * regerar na mesma data de coleta reescrevia conteúdo DIFERENTE sob rótulo IDÊNTICO. Foi o que
 * aconteceu nesta branch — o artefato foi de 77 para 79 entradas com `catalogVersion` parado em
 * `2026-07-28.0`.
 *
 * Isso não é higiene de versionamento: o rótulo é congelado dentro do payload que o ADR-0019 torna
 * IMUTÁVEL. Dois registros dizendo o mesmo nome descreviam tabelas diferentes, e a pergunta que o
 * campo existe para responder — QUAL tabela produziu este número — deixava de ter resposta, sem
 * conserto posterior possível, porque o registro não pode ser reescrito.
 *
 * Duas regras, e a segunda é a que evita o ruído: a sequência é INTEIRA (a mesma armadilha que
 * `freshest` pagou — texto faria ".9" perder para ".10"), e o rótulo só se move quando o CONTEÚDO
 * mudou. Ele nomeia o dado, não a execução: reler a mesma tabela não a torna uma tabela nova.
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
  if (opts.envDate) return { ok: true, date: opts.envDate };
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
