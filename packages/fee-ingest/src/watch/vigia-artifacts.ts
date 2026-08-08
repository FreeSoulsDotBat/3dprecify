import type { RelatoDeVigia, SecaoDeDecisao } from "../pr-body.ts";
import type { AmazonPrecosBaseline, VigiaAmazonPrecosResultado } from "./amazon-precos.ts";

// 017/T023 — a PONTE entre o que um `watch-*.mjs` escreve em disco (`artifacts/*.vigia.json`) e o
// que `compor` precisa (`vigias`/`decisao`) + o que o `build.mjs` precisa escrever de volta em
// `packages/fee-ingest/data/` (o baseline atualizado). PURA e testada — os `.mjs` só fazem I/O em
// volta dela, sob o mesmo princípio de `pr-artifacts.ts` (014/US4: nenhuma decisão em lugar isento).
//
// Hoje só existe UMA fonte de vigia (`amazon-precos`); o tipo já admite várias (o ML entra na
// PR-D). O nome do arquivo de baseline por fonte é a única coisa que este módulo INVENTA — o
// `.mjs` grava exatamente com esse nome dentro de `packages/fee-ingest/data/`.

/** Um resultado de vigia com ABORT — o parser falhou (âncora sumida, `absentAnchors` presente).
 *  Nunca vira relato: "consequência é parada, nunca corrupção" (o mesmo princípio dos coletores). */
export type VigiaAbortado = { kind: "ABORT"; reason: string };

export type ArtefatoDeVigia = {
  /** O nome da fonte — vira o nome do arquivo de baseline (`<fonte>.baseline.json`). */
  fonte: string;
  resultado: VigiaAmazonPrecosResultado | VigiaAbortado;
};

export type Composicao = {
  vigias: RelatoDeVigia[];
  decisao?: SecaoDeDecisao;
  /** Nome de arquivo (dentro de `packages/fee-ingest/data/`) → conteúdo a escrever. */
  baselinesParaEscrever: Record<string, AmazonPrecosBaseline>;
};

/**
 * Traduz os artefatos de vigia da run em argumentos para `compor` + baselines a persistir.
 *
 * Duas decisões póem de propósito, e ambas testadas por caso:
 *  · `ABORT` não produz relato nem escreve baseline — a leitura falhou, e nada muda por isso;
 *  · `SEM_NOTICIA` também não escreve baseline: o conteúdo não mudou, escrever de novo seria um
 *    no-op do git, mas um arquivo "tocado" sem motivo é ruído no diff que ninguém pediu.
 *  · duas `DECISAO` no mesmo mês (hoje impossível — só existe uma fonte) usam a PRIMEIRA: combinar
 *    duas decisões pendentes numa seção só apagaria uma delas em silêncio.
 */
export function paraComposicao(artefatos: readonly ArtefatoDeVigia[]): Composicao {
  const vigias: RelatoDeVigia[] = [];
  const baselinesParaEscrever: Record<string, AmazonPrecosBaseline> = {};
  let decisao: SecaoDeDecisao | undefined;

  for (const { fonte, resultado } of artefatos) {
    if (resultado.kind === "ABORT" || resultado.kind === "SEM_NOTICIA") continue;

    baselinesParaEscrever[`${fonte}.baseline.json`] = resultado.baselineAtualizado;

    if (resultado.kind === "DIVERGENCIA") {
      vigias.push(resultado.relato);
    } else if (resultado.kind === "DECISAO" && decisao === undefined) {
      decisao = resultado.decisao;
    }
  }

  return decisao === undefined
    ? { vigias, baselinesParaEscrever }
    : { vigias, decisao, baselinesParaEscrever };
}
