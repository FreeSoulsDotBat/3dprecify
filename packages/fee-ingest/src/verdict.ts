import type { CatalogSlice } from "./slice.ts";

// 017/T005 (ADR-0028 §2, decisão A do desenho) — os TRÊS ESTADOS como DADO.
//
// A US2/AC3 exige que o corpo do PR declare LIDO / ABORTADO / NÃO LIDO para TODOS os marketplaces
// cobertos, em 100% das execuções (SC-1003). O jeito frágil de fazer isso é listar os artefatos de
// veredito que apareceram no disco — e ele falha exatamente no caso que importa: **ausência de
// artefato e job que nunca começou são indistinguíveis no sistema de arquivos**. Um `ls` sobre um
// diretório vazio produz um relatório silencioso, e um marketplace calado num relatório de dinheiro
// lê-se como "está tudo bem por lá".
//
// Por isso a VERDADE é esta tabela, e a resolução é uma função TOTAL sobre ela.

/**
 * Os marketplaces que o laço mensal declara COBRIR.
 *
 * Uma lista, um lugar (o espírito do 014/U4-f): a mesma tabela alimenta o corpo do PR (§5 do
 * contrato), a composição (§C.2) e a checagem de idade do dado do `ci.yml` (decisão G). Um
 * marketplace que entre aqui passa a ser cobrado em todos os três de uma vez.
 *
 * ORDEM ALFABÉTICA, e isso é load-bearing: `compor` aplica as fatias nesta ordem para que o artefato
 * de saída não dependa da ordem em que os jobs terminaram.
 */
export const MARKETPLACE_COVERAGE = ["AMAZON", "MERCADO_LIVRE", "SHOPEE"] as const;

/**
 * O identificador de marketplace, DERIVADO da tabela de cobertura e não declarado ao lado dela.
 *
 * Se fossem duas declarações independentes, `Record<Mk, …>` poderia ficar incompleto sem que o tipo
 * reclamasse — a exaustividade viraria disciplina. Derivando, ela é construção.
 *
 * (`AMAZON_PRECOS` NÃO entra aqui: a `/precos` é FONTE DE VIGIA, não marketplace — ela não tem
 * caminho até folha de catálogo, e é o D7 expresso por tipo. Ela entra na PR-B com tipo próprio.)
 */
export type Mk = (typeof MARKETPLACE_COVERAGE)[number];

/**
 * O que um coletor tem permissão de dizer — três casos, e nenhum quarto que escreva calado.
 *
 * `LIDO` carrega a FATIA (folhas que o coletor declarou ter lido), nunca o artefato: a única coisa
 * que escreve o `catalog.json` é a composição, depois de validar (ADR-0028 §3).
 */
export type CollectorVerdict =
  | { kind: "LIDO"; marketplace: Mk; collectedAt: string; sourceUrl: string; slice: CatalogSlice }
  | { kind: "ABORTADO"; marketplace: Mk; reason: string; sourceUrl: string }
  | { kind: "NAO_LIDO"; marketplace: Mk; reason: string };

/** O motivo literal de um marketplace que não deixou veredito no disco. */
export const SEM_VEREDITO = "o job não produziu veredito";

/**
 * Os vereditos lidos do disco, resolvidos contra a COBERTURA — total por construção.
 *
 * Duas ausências viram o mesmo estado honesto, e é de propósito: um job que não rodou e um job que
 * rodou e não escreveu nada são, do ponto de vista de quem revisa, a mesma notícia — "ninguém releu
 * essa fonte neste mês". A distinção entre eles é diagnóstico de CI, e o lugar dela é o log da run.
 *
 * Duplicidade falha FECHADO. Dois artefatos para a mesma fonte (job reexecutado, upload duplicado,
 * dois jobs escrevendo o mesmo nome) não podem eleger um vencedor em silêncio: "o último a escrever
 * vence" é literalmente o defeito que o §C.1 do desenho nomeia como razão de existir da composição,
 * e sobre dinheiro ele apaga curadoria sem deixar rastro. Sem saber QUAL das duas leituras vale, a
 * resposta honesta é não usar nenhuma.
 */
export function resolverVereditos(
  disco: readonly CollectorVerdict[],
): Record<Mk, CollectorVerdict> {
  const porMarketplace = new Map<Mk, CollectorVerdict[]>();
  for (const v of disco) {
    porMarketplace.set(v.marketplace, [...(porMarketplace.get(v.marketplace) ?? []), v]);
  }

  const saida = {} as Record<Mk, CollectorVerdict>;
  for (const mk of MARKETPLACE_COVERAGE) {
    const achados = porMarketplace.get(mk) ?? [];
    const unico = achados.length === 1 ? achados[0] : undefined;
    saida[mk] = unico ?? {
      kind: "NAO_LIDO",
      marketplace: mk,
      reason:
        achados.length === 0
          ? SEM_VEREDITO
          : `dois vereditos para o mesmo marketplace (${achados.length}) — nenhum é confiável`,
    };
  }
  return saida;
}
