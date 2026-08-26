import { CANARIES, type ParsedCategory } from "./amazon-parse.ts";
import {
  AMAZON_SOURCE_URL,
  amazonEntries,
  amazonSpine,
  effectiveDatesOf,
} from "./amazon-to-catalog.ts";
import {
  MIN_PARSE_ROWS,
  checkBandCoverage,
  checkCategoryIdCollisions,
  checkParseSanity,
} from "./guardrails.ts";
import type { CatalogSlice, LeafWrite } from "./slice.ts";
import type { CollectorVerdict } from "./verdict.ts";

// 017/T014 (ADR-0028 §3) — o coletor Amazon como EMISSOR DE FATIA, e não mais como writer.
//
// O modelo antigo está medido em `build-amazon.mjs`: ele lia e ESCREVIA o `catalog.json` inteiro,
// carregando os outros marketplaces intocados. Isso funciona com um coletor serial; com jobs
// independentes em VMs isoladas (decisão A) o último a escrever vence e a curadoria do outro some,
// em silêncio, sobre dinheiro.
//
// Esta função é a DECISÃO, e por isso mora aqui e não no `.mjs`: os CLIs são isentos do ratchet de
// cobertura de propósito, e a lição de 015/A5 (o piso de linhas que estava coberto como FUNÇÃO e
// descoberto como VALOR) é que nenhuma regra de dinheiro pode morar num lugar isento. O `.mjs` fica
// com rede, disco e `process.exit`.

/** O que a Amazon lê por INTEIRO quando lê: a tabela é uma página só, e ou ela veio toda ou não veio.
 *
 *  A espinha entra junto porque é ela que faz `removedCategories` e `reparented` existirem — sem
 *  declará-la, uma categoria sumiria das entradas e continuaria na espinha, e o corpo do PR
 *  descreveria meia remoção. */
export const AMAZON_EXHAUSTIVE = ["entries", "categorySpine"] as const;

export type ColetaAmazon = {
  categorias: readonly ParsedCategory[];
  /** A data da releitura REAL — vem de `collectedAtFor`, nunca de `new Date()` no chamador. */
  collectedAt: string;
  /** A MEMÓRIA da vigência anterior (T101). Sem ela, regerar carimba a data da execução em toda
   *  entrada e o laço nasce incapaz de dizer "nada mudou" — `effectiveDate` não é inerte. */
  previousEffectiveDates: ReadonlyMap<string, string>;
};

/**
 * As guardas da fonte, conjuntivas, ANTES de existir fatia (§C.2-bis regra 3).
 *
 * A ordem importa menos que o fato de serem PRÉ-CONDIÇÃO: uma fatia que não existe não remove nada.
 * Página quebrada, casca de SPA ou 403 abortam aqui, e o artefato fica byte a byte intocado (I2).
 */
export function avaliarColetaAmazon(categorias: readonly ParsedCategory[]): {
  ok: boolean;
  reason: string;
} {
  // O piso de linhas e as canárias — a leitura que trocou de COLUNA devolve números plausíveis e
  // passaria por qualquer contagem; só o par (categoria, %, mínimo) a pega (014/T102).
  const sanidade = checkParseSanity(categorias, {
    minRows: MIN_PARSE_ROWS,
    canaries: CANARIES,
  });
  if (!sanidade.ok) return { ok: false, reason: sanidade.reason };

  for (const c of categorias) {
    if (!c.bands) continue;
    const cobertura = checkBandCoverage(c.bands);
    if (!cobertura.ok) return { ok: false, reason: `"${c.name}" — ${cobertura.reason}` };
  }

  // Dois nomes que colapsam no mesmo `categoryId` derrubam o marketplace INTEIRO no cliente: um par
  // de acentos apaga a Amazon do app.
  const colisao = checkCategoryIdCollisions(categorias);
  if (!colisao.ok) return { ok: false, reason: colisao.reason };

  return { ok: true, reason: "" };
}

/**
 * A leitura da Amazon como FATIA — folhas por entrada + a espinha, e a declaração de exaustividade.
 *
 * PONTO FIXO (FR-1011): a mesma fixture produz a mesma fatia, byte a byte, e `collectedAt` só avança
 * quando quem chamou provou uma releitura real (`collectedAtFor` recusa carimbar hoje sobre um
 * arquivo capturado). Esta função não conhece "hoje" — ela não tem como inventar uma data.
 */
export function fatiaAmazon(coleta: ColetaAmazon): CatalogSlice {
  const entradas = amazonEntries(coleta.categorias, {
    collectedAt: coleta.collectedAt,
    effectiveDate: coleta.collectedAt,
    previousEffectiveDates: coleta.previousEffectiveDates,
  });

  const leaves: LeafWrite[] = [];
  for (const e of entradas) {
    const { determinants, ...folhas } = e as Record<string, unknown> & {
      determinants: Record<string, string>;
    };
    for (const [field, value] of Object.entries(folhas)) {
      leaves.push({ level: "ENTRY", determinants, field, value });
    }
  }
  // A espinha é folha de nível de marketplace, e só pode ser escrita porque a fatia declara
  // `categorySpine` exaustiva — `aplicarFatia` recusa o contrário (§C.2-bis regra 4).
  leaves.push({
    level: "MARKETPLACE",
    field: "categorySpine",
    value: amazonSpine(coleta.categorias),
  });

  return {
    marketplace: "AMAZON",
    collectedAt: coleta.collectedAt,
    sourceUrl: AMAZON_SOURCE_URL,
    exhaustive: [...AMAZON_EXHAUSTIVE],
    leaves,
  };
}

/**
 * O veredito do coletor — o que ele tem permissão de dizer, e o único jeito de dizer.
 *
 * Uma leitura que falhou sai ABORTADO com motivo NOMEADO, nunca como uma tabela pequena que o
 * compositor aceitaria: "0 categorias" jamais pode ser lido como "as taxas caíram" (SC-806).
 */
export function veredictoAmazon(coleta: ColetaAmazon): CollectorVerdict {
  const guardas = avaliarColetaAmazon(coleta.categorias);
  if (!guardas.ok) {
    return {
      kind: "ABORTADO",
      marketplace: "AMAZON",
      reason: guardas.reason,
      sourceUrl: AMAZON_SOURCE_URL,
    };
  }
  return {
    kind: "LIDO",
    marketplace: "AMAZON",
    collectedAt: coleta.collectedAt,
    sourceUrl: AMAZON_SOURCE_URL,
    slice: fatiaAmazon(coleta),
  };
}

/** As vigências anteriores lidas do artefato — o insumo do T101, sem que este módulo abra arquivo. */
export function vigenciasAnteriores(secaoAmazon: {
  entries?: unknown;
}): ReadonlyMap<string, string> {
  const entries = Array.isArray(secaoAmazon.entries) ? secaoAmazon.entries : [];
  return effectiveDatesOf(
    entries as { determinants: { plan: string; category?: string }; effectiveDate: string }[],
  );
}
