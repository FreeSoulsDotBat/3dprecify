import { createHash } from "node:crypto";

import {
  AMAZON_INDIVIDUAL_FEE_SOURCE,
  AMAZON_INDIVIDUAL_PER_ITEM_FEE,
} from "../amazon-to-catalog.ts";
import type { RelatoDeVigia, SecaoDeDecisao } from "../pr-body.ts";

// 017/T021 (US4 · ADR-0028 §E, `arquitetura-017.md` §E) — o vigia da `/precos` da Amazon.
//
// A SEPARAÇÃO ESTRUTURAL do D7 (§E.2): este módulo devolve `WatchReading` — um tipo que NÃO tem
// construtor para `FeeEntry`, e não existe, em módulo nenhum daqui, uma função que receba uma
// leitura e devolva fatia de catálogo. O robô não "escolhe" não escrever `minPerItem`: não existe
// a função que o escreveria (a mesma família de prova da FR-020a). `amazon-collector.artifact.test.ts`
// já prova essa forma para o coletor real (T014); `amazon-precos.test.ts` prova a mesma coisa aqui.
//
// MEDIDO 2026-08-08 (`curl -s https://venda.amazon.com.br/precos`, HTTP 200, 647813 bytes, sem
// navegador — G do brief): a hipótese do brief ("~11 categorias a R$ 2,00 contra o R$ 1,00 uniforme
// da tabela vigente") NÃO bate com a página de HOJE. A página não fala em mínimo POR CATEGORIA — ela
// declara UMA comissão mínima, uniforme, "equivalente a R$ 1,00 (um real)": o MESMO valor da tabela
// vigente (D7). Os dois planos batem exatamente com o brief: Individual R$ 2,00/item, Profissional
// R$ 19,00/mês. Este achado está registrado também em `dod-evidence.md` — não é uma correção
// silenciosa da spec, é o "PARE e reporte os valores REAIS" que a T020 pediu antes de fixar número.
//
// Por isso o vigia aqui compara a leitura contra DUAS coisas, e SÓ essas duas (nenhuma comparação
// contra `minPerItem` por categoria do artefato servido, que este módulo não lê e nunca escreveria):
//   1. o BASELINE do mês anterior (qualquer mudança, de qualquer lado, é notícia);
//   2. a constante `AMAZON_INDIVIDUAL_PER_ITEM_FEE` — o número já mora num lugar só (016/PR-F), e
//      uma discordância entre a página e essa constante é o alerta que a decisão E.2 pede.

const NBSP = new RegExp(String.fromCharCode(0xa0), "g");
const normalise = (s: string) => s.replace(NBSP, " ").replace(/\s+/g, " ").trim();

/** O que UMA leitura da `/precos` carrega. Sem caminho para `FeeEntry`/`CatalogSlice`. */
export type WatchReading = {
  sourceUrl: string;
  collectedAt: string;
  selfDatedAs: string | null;
  /** A comissão mínima UNIFORME que a página declara — medida em 2026-08-08 como R$ 1,00. */
  comissaoMinima: number;
  /** O custo por item do plano Individual. */
  individualPerItem: number;
  /** A mensalidade do plano Profissional. */
  profissionalMensal: number;
};

/** A forma comum do baseline (data-model §3), especializada para esta fonte. */
export type AmazonPrecosBaseline = {
  sourceUrl: string;
  collectedAt: string;
  selfDatedAs: string | null;
  shape: { rows: number; cols: number };
  anchors: readonly string[];
  absentAnchors: readonly string[];
  values: {
    comissaoMinima: number;
    individualPerItem: number;
    profissionalMensal: number;
  };
  contentHash: string;
};

/** As âncoras VERBATIM OBRIGATÓRIAS (sem o número, de propósito — o número é dado, a frase é forma).
 *  Ausência de qualquer uma delas é falha de FORMA da fonte, não uma tarifa que sumiu — vira ABORT.
 *
 *  "atualizadas em" (a auto-datação) fica DE FORA desta lista de propósito: o data-model (§3) admite
 *  `selfDatedAs: null` como valor legítimo — uma página que pare de se auto-datar não é uma falha de
 *  forma das seções que o vigia lê, é uma fonte que deixou de classificar a própria vigência. */
export const ANCHORS = [
  "a comissão mínima, equivalente a R$",
  "por produto vendido",
  "mensais",
] as const;

/** Frases OPCIONAIS: ausência não aborta, só faz `selfDatedAs` sair `null`. */
export const OPTIONAL_ANCHORS = ["atualizadas em"] as const;

/** O que NUNCA pode aparecer: a página migrando de "mínimo uniforme" para "mínimo por categoria"
 *  invalidaria silenciosamente a leitura de UM valor só — a lição 014/US4 virada em dado (E.1). */
export const ABSENT_ANCHORS = [
  "mínimo por categoria",
  "mínima por categoria",
  "comissão mínima varia",
] as const;

const MIN_RE = /a comiss(?:ã|a)o m(?:í|i)nima, equivalente a R\$ (\d+,\d{2}) \(um real\)/i;
const INDIVIDUAL_RE = /custo (?:é|e) de R\$ (\d+,\d{2}) por produto vendido/i;
const PROFISSIONAL_RE = /pre(?:ç|c)o do plano (?:é|e) de R\$ (\d+,\d{2}) mensais/i;
const SELF_DATED_RE = /atualizadas em (\d{2}\/\d{2}\/\d{4})/i;

const parseBr = (digits: string): number => Number(digits.replace(",", "."));

export type ParseResultado = { ok: true; reading: WatchReading } | { ok: false; reason: string };

/**
 * Parser determinístico e PURO: nenhuma rede, nenhum `new Date()`. `collectedAt`/`sourceUrl` chegam
 * do chamador (o CLI `.mjs`, sob o mesmo princípio de `collectedAtFor` — a data é insumo, não relógio).
 */
export function parseAmazonPrecos(
  html: string,
  opts: { sourceUrl: string; collectedAt: string },
): ParseResultado {
  const texto = normalise(html);

  for (const proibida of ABSENT_ANCHORS) {
    if (texto.toLowerCase().includes(proibida.toLowerCase())) {
      return {
        ok: false,
        reason:
          `absentAnchor "${proibida}" está PRESENTE na página — a forma que este vigia assume ` +
          "(mínimo UNIFORME, não por categoria) pode não valer mais; confira antes de seguir",
      };
    }
  }

  const min = MIN_RE.exec(texto);
  if (!min) {
    return {
      ok: false,
      reason: `âncora ausente: a frase da comissão mínima uniforme não foi encontrada`,
    };
  }
  const individual = INDIVIDUAL_RE.exec(texto);
  if (!individual) {
    return {
      ok: false,
      reason: `âncora ausente: a frase do custo por item do plano Individual não foi encontrada`,
    };
  }
  const profissional = PROFISSIONAL_RE.exec(texto);
  if (!profissional) {
    return {
      ok: false,
      reason: `âncora ausente: a frase da mensalidade do plano Profissional não foi encontrada`,
    };
  }
  const selfDated = SELF_DATED_RE.exec(texto);

  return {
    ok: true,
    reading: {
      sourceUrl: opts.sourceUrl,
      collectedAt: opts.collectedAt,
      selfDatedAs: selfDated ? selfDated[1]! : null,
      comissaoMinima: parseBr(min[1]!),
      individualPerItem: parseBr(individual[1]!),
      profissionalMensal: parseBr(profissional[1]!),
    },
  };
}

/** Constrói o PRIMEIRO baseline a partir de uma leitura — usado só na primeira execução (bootstrap)
 *  ou por quem precisa de um baseline sintético em teste. Não é o caminho normal de atualização: esse
 *  é `baselineAtualizado`, devolvido por `avaliarVigiaAmazonPrecos`. */
export function baselineFromReading(reading: WatchReading): AmazonPrecosBaseline {
  return {
    sourceUrl: reading.sourceUrl,
    collectedAt: reading.collectedAt,
    selfDatedAs: reading.selfDatedAs,
    shape: { rows: ANCHORS.length, cols: 1 },
    anchors: ANCHORS,
    absentAnchors: ABSENT_ANCHORS,
    values: {
      comissaoMinima: reading.comissaoMinima,
      individualPerItem: reading.individualPerItem,
      profissionalMensal: reading.profissionalMensal,
    },
    contentHash: contentHashOf(reading),
  };
}

function contentHashOf(reading: WatchReading): string {
  const payload = JSON.stringify({
    comissaoMinima: reading.comissaoMinima,
    individualPerItem: reading.individualPerItem,
    profissionalMensal: reading.profissionalMensal,
    selfDatedAs: reading.selfDatedAs,
  });
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export type VigiaAmazonPrecosResultado =
  | { kind: "SEM_NOTICIA"; baselineAtualizado: AmazonPrecosBaseline }
  | { kind: "DIVERGENCIA"; relato: RelatoDeVigia; baselineAtualizado: AmazonPrecosBaseline }
  | { kind: "DECISAO"; decisao: SecaoDeDecisao; baselineAtualizado: AmazonPrecosBaseline };

/**
 * O vigia: compara `leitura` contra `baseline` (mudança de qualquer lado é notícia) E contra
 * `AMAZON_INDIVIDUAL_PER_ITEM_FEE` (a constante que já é a fonte do número servido — E.2).
 *
 * NUNCA escreve `minPerItem`, e não tem como: o tipo de retorno não carrega `CatalogSlice` em
 * NENHUM dos três casos (FR-020a em nível de tipo, a mesma técnica de `compose.ts`/`RunOutcome`).
 *
 * Convergência (Q2) — quando a leitura DEIXA de divergir da constante, tendo divergido no baseline —
 * vira `DECISAO`: o dado não muda, e é o `pr-body.ts`/`compose.ts` que forçam a dispensa a NÃO e o
 * título a `DECISÃO — ` a partir daqui (este módulo só produz a seção; quem monta o PR decide o resto).
 */
export function avaliarVigiaAmazonPrecos(args: {
  leitura: WatchReading;
  baseline: AmazonPrecosBaseline;
}): VigiaAmazonPrecosResultado {
  const { leitura, baseline } = args;

  const mudou =
    leitura.comissaoMinima !== baseline.values.comissaoMinima ||
    leitura.individualPerItem !== baseline.values.individualPerItem ||
    leitura.profissionalMensal !== baseline.values.profissionalMensal ||
    leitura.selfDatedAs !== baseline.selfDatedAs;

  const baselineAtualizado: AmazonPrecosBaseline = {
    ...baseline,
    sourceUrl: leitura.sourceUrl,
    collectedAt: leitura.collectedAt,
    selfDatedAs: leitura.selfDatedAs,
    values: {
      comissaoMinima: leitura.comissaoMinima,
      individualPerItem: leitura.individualPerItem,
      profissionalMensal: leitura.profissionalMensal,
    },
    contentHash: contentHashOf(leitura),
  };

  if (!mudou) return { kind: "SEM_NOTICIA", baselineAtualizado: baseline };

  const individualDivergeAgora = leitura.individualPerItem !== AMAZON_INDIVIDUAL_PER_ITEM_FEE;
  const individualDivergiaAntes =
    baseline.values.individualPerItem !== AMAZON_INDIVIDUAL_PER_ITEM_FEE;

  if (!individualDivergeAgora && individualDivergiaAntes) {
    return {
      kind: "DECISAO",
      decisao: {
        titulo:
          "Amazon: a /precos e a constante servida deixaram de discordar sobre a tarifa do plano Individual",
        fonteA: {
          rotulo: "/precos (página)",
          valor: formatBRL(leitura.individualPerItem),
          url: leitura.sourceUrl,
        },
        fonteB: {
          rotulo: "AMAZON_INDIVIDUAL_PER_ITEM_FEE (servido)",
          valor: formatBRL(AMAZON_INDIVIDUAL_PER_ITEM_FEE),
          url: AMAZON_INDIVIDUAL_FEE_SOURCE.sourceUrl,
        },
        autoDatacao: leitura.selfDatedAs,
      },
      baselineAtualizado,
    };
  }

  const partes: string[] = [];
  if (leitura.individualPerItem !== baseline.values.individualPerItem) {
    partes.push(
      `tarifa do plano Individual publicada como ${formatBRL(leitura.individualPerItem)} ` +
        `(constante servida: ${formatBRL(AMAZON_INDIVIDUAL_PER_ITEM_FEE)})`,
    );
  } else if (individualDivergeAgora) {
    partes.push(
      `tarifa do plano Individual segue divergindo da constante servida — página: ` +
        `${formatBRL(leitura.individualPerItem)}, constante: ${formatBRL(AMAZON_INDIVIDUAL_PER_ITEM_FEE)}`,
    );
  }
  if (leitura.comissaoMinima !== baseline.values.comissaoMinima) {
    partes.push(
      `comissão mínima uniforme: ${formatBRL(baseline.values.comissaoMinima)} → ${formatBRL(leitura.comissaoMinima)}`,
    );
  }
  if (leitura.profissionalMensal !== baseline.values.profissionalMensal) {
    partes.push(
      `mensalidade do plano Profissional: ${formatBRL(baseline.values.profissionalMensal)} → ${formatBRL(leitura.profissionalMensal)}`,
    );
  }
  if (leitura.selfDatedAs !== baseline.selfDatedAs) {
    partes.push(
      `auto-datação: ${baseline.selfDatedAs ?? "(ausente)"} → ${leitura.selfDatedAs ?? "(ausente)"}`,
    );
  }

  return {
    kind: "DIVERGENCIA",
    relato: {
      fonte: "Amazon /precos",
      sourceUrl: leitura.sourceUrl,
      resumo: partes.join("; "),
      diffBaseline:
        `- ${JSON.stringify(baseline.values)} (auto-datação: ${baseline.selfDatedAs ?? "null"})\n` +
        `+ ${JSON.stringify(baselineAtualizado.values)} (auto-datação: ${leitura.selfDatedAs ?? "null"})`,
    },
    baselineAtualizado,
  };
}
