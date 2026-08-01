import { type CatalogDiff, diffCatalogs, mayAutoMerge } from "./catalog-diff.ts";
import type { SanityVerdict } from "./guardrails.ts";

// 014/US4 — o ORQUESTRADOR do laço mensal, como decisão pura. O `.mjs` que roda no CI junta rede e
// disco em volta disto; tudo que DECIDE mora aqui, onde é testável e cai sob o ratchet de 100%.
//
// A propriedade que governa o módulo é estrutural, não uma checagem que se possa esquecer: a FR-020a
// manda o job SEMPRE abrir PR e NUNCA escrever no branch de integração, então o resultado é uma união
// de dois casos — abortar ou abrir PR. Não existe um terceiro que escreva, e um `if` esquecido não
// pode criar um caminho que o tipo não tem.

type Json = Record<string, unknown>;

/**
 * Acima desta fração de entradas MATERIALMENTE alteradas numa única execução, o desfecho é falha de
 * forma, não notícia de tarifa.
 *
 * O raciocínio é o mesmo do piso de linhas (SC-806): uma leitura de coluna errada que escape das
 * canárias ainda move quase TODAS as linhas de uma vez, e nenhuma tabela publicada muda assim num
 * mês. Meio a meio é folgado de propósito — o alarme existe para a mudança em bloco, e um alarme
 * apertado demais treina quem revisa a ignorá-lo, que é o defeito que a US5 nomeia.
 */
export const CHANGED_ROWS_CEILING = 0.5;

/**
 * Abaixo de tantas entradas o teto acima NÃO se aplica.
 *
 * Um percentual sobre um punhado de linhas não significa nada: numa tabela de duas entradas, mudar
 * uma é 50% e é perfeitamente normal. O alarme existe para a mudança EM BLOCO de uma tabela real —
 * a Amazon publica 38 linhas, que viram 78 entradas —, e dispará-lo sobre tabelas minúsculas o
 * transformaria no falso positivo mensal que a US5 nomeia como o jeito de treinar quem revisa a
 * ignorar o alarme.
 */
export const CEILING_MIN_ENTRIES = 10;

/** Campos que não carregam dinheiro nem cobertura — os únicos que uma execução pode mexer sozinha. */
const INERT = new Set(["lastReviewed", "catalogVersion", "generatedAt"]);

export type RefreshOutcome =
  | { kind: "ABORT"; reason: string }
  | { kind: "PR"; title: string; body: string; mayAutoMerge: boolean };

/** As entradas cuja mudança NÃO é só data de reverificação. É o que o revisor precisa ler. */
function materialEntries(diff: CatalogDiff) {
  return diff.changedEntries
    .map((e) => ({ ...e, changes: e.changes.filter((c) => !INERT.has(c.path)) }))
    .filter((e) => e.changes.length > 0);
}

/**
 * O diff não traz notícia NENHUMA — nem tabela, nem seção. É a condição da prova-de-vida.
 *
 * Enumerada campo a campo de propósito, e não derivada de `freshnessOnly`: os dois querem dizer
 * coisas parecidas hoje, e no dia em que divergirem é o CORPO do PR que precisa estar certo, porque
 * é ele que o humano lê. Um campo novo no `CatalogDiff` que ninguém acrescente aqui volta a produzir
 * a contradição — por isso a lista está à vista, e não escondida atrás de uma flag.
 */
function semNoticia(diff: CatalogDiff): boolean {
  return (
    diff.addedCategories.length === 0 &&
    diff.removedCategories.length === 0 &&
    diff.removedEntries.length === 0 &&
    diff.reparented.length === 0 &&
    diff.addedMarketplaces.length === 0 &&
    diff.removedMarketplaces.length === 0
  );
}

const label = (e: { categoryName: string | null; categoryId: string | null }) =>
  e.categoryName ?? e.categoryId ?? "(sem categoria)";

/** `undefined` vira vazio em vez da string "undefined" — um campo que não existia antes é ausência. */
const cell = (v: unknown) => (v === undefined ? "—" : String(v));

/**
 * O corpo do PR mensal (§C3). É a INTERFACE do laço com o humano que revisa, e um diff que ele não
 * consegue ler é um diff que ele aprova sem conferir.
 *
 * A tabela lista só as mudanças MATERIAIS. As inertes viram uma linha de prosa: listar 78 avanços de
 * `lastReviewed` afogaria a única linha que importa quando uma tarifa muda de verdade.
 */
export function prBody(args: {
  marketplace: string;
  collectedAt: string;
  sourceUrl: string;
  diff: CatalogDiff;
}): string {
  const { marketplace, collectedAt, sourceUrl, diff } = args;
  const material = materialEntries(diff);
  const out = [`## Tarifas — ${marketplace} — coletado em ${collectedAt} de ${sourceUrl}`, ""];

  if (material.length > 0) {
    out.push("| categoria | campo | antes | depois |", "|---|---|---|---|");
    for (const e of material) {
      for (const c of e.changes) {
        out.push(`| ${label(e)} | ${c.path} | ${cell(c.before)} | ${cell(c.after)} |`);
      }
    }
    out.push("");
  } else if (semNoticia(diff)) {
    // A execução sem novidade é a PROVA MENSAL de que o robô está vivo (Q7). Dizer isso em palavras
    // é o que a distingue de uma execução que falhou em silêncio.
    //
    // A condição olha o diff INTEIRO, e não só a tabela. Ela dependia apenas de `material.length`, e
    // o resultado era um corpo que dizia "Sem mudança de tarifa nesta leitura" LOGO ACIMA da seção
    // "Categorias removidas da fonte" — duas afirmações contraditórias no mesmo PR, uma delas a
    // prova-de-vida do robô. Uma prova-de-vida que mente é pior do que nenhuma: ela é lida rápido,
    // por definição, e é ela que autoriza o revisor a não olhar o resto.
    out.push("Sem mudança de tarifa nesta leitura — apenas `lastReviewed` avançou.", "");
  }

  if (diff.addedCategories.length > 0) {
    out.push("### Categorias novas na fonte");
    for (const c of diff.addedCategories) out.push(`- ${c.name} (\`${c.categoryId}\`)`);
    out.push("");
  }
  if (diff.removedCategories.length > 0) {
    out.push("### Categorias removidas da fonte (decisão humana necessária)");
    for (const c of diff.removedCategories) {
      out.push(`- ${c.name} — presente na leitura anterior, ausente hoje`);
    }
    out.push("");
  }
  if (diff.removedEntries.length > 0) {
    out.push("### Entradas que deixaram de existir (decisão humana necessária)");
    for (const e of diff.removedEntries) {
      out.push(`- \`${JSON.stringify(e.determinants)}\` — o slot correspondente deixa de resolver`);
    }
    out.push("");
  }
  if (diff.reparented.length > 0) {
    // FR-019a — muda a alíquota EFETIVA sem nenhum campo diferir, então sem esta seção o PR
    // publicaria uma mudança de preço sem uma linha que a descrevesse.
    out.push("### Categorias que mudaram de pai (muda a alíquota efetiva)");
    for (const r of diff.reparented) {
      out.push(`- ${r.name}: ${r.parentBefore ?? "(raiz)"} → ${r.parentAfter ?? "(raiz)"}`);
    }
    out.push("");
  }
  return out.join("\n");
}

/**
 * O desfecho de uma execução do laço.
 *
 * ABORT deixa o artefato INTOCADO e não avança `lastReviewed` para valor nenhum: uma leitura que
 * falhou não é "as taxas caíram" (SC-806/FR-020a), e publicar meia leitura é pior do que não publicar.
 */
export function decideRefresh(args: {
  marketplace: string;
  collectedAt: string;
  sourceUrl: string;
  sanity: SanityVerdict;
  before: Json;
  after: Json;
}): RefreshOutcome {
  const { marketplace, collectedAt, sourceUrl, sanity, before, after } = args;
  // Falha de leitura e parse encolhido saem pelo MESMO buraco, de propósito: quem chama não precisa
  // saber distinguir as duas para reagir certo.
  if (!sanity.ok) return { kind: "ABORT", reason: sanity.reason };

  const diff = diffCatalogs(before, after);
  // U4-a — numerador e denominador do MESMO marketplace. `entryCount` somava TODOS eles enquanto o
  // numerador so contava o que mudou no marketplace regenerado: hoje da no mesmo por acidente (so a
  // Amazon e regerada), e no dia em que o ML entrar o denominador cresce e o teto MORRE CALADO. Uma
  // leitura que mudasse a tabela inteira da Amazon passaria, diluida pelas entradas do ML. Um alarme
  // que se desliga sozinho quando o sistema cresce e pior que nenhum: ninguem nota o desligamento.
  const total = entryCount(before, marketplace);
  const changed = materialEntries(diff).filter((e) => e.marketplace === marketplace).length;
  if (total >= CEILING_MIN_ENTRIES && changed / total > CHANGED_ROWS_CEILING) {
    const pct = Math.round((changed / total) * 100);
    return {
      kind: "ABORT",
      reason:
        `${changed} de ${total} linhas mudaram (${pct}%), acima do teto de ` +
        `${Math.round(CHANGED_ROWS_CEILING * 100)}% — mudança em bloco é falha de forma da fonte, ` +
        `não notícia de tarifa`,
    };
  }

  return {
    kind: "PR",
    title: `Tarifas ${marketplace} — leitura de ${collectedAt}`,
    body: prBody({ marketplace, collectedAt, sourceUrl, diff }),
    mayAutoMerge: mayAutoMerge(diff),
  };
}

/** Quantas entradas o artefato ANTERIOR tinha NESTE marketplace — o denominador do teto. */
function entryCount(cat: Json, marketplace: string): number {
  const mks = Array.isArray(cat.marketplaces) ? (cat.marketplaces as Json[]) : [];
  return mks
    .filter((m) => m.marketplace === marketplace)
    .reduce((n, m) => n + (Array.isArray(m.entries) ? m.entries.length : 0), 0);
}
