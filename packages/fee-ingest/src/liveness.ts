import { MARKETPLACE_COVERAGE } from "./verdict.ts";

// 017/T022 (US7 · `arquitetura-017.md` §G, `contracts/workflow-yaml.md`) — a DECISÃO do
// `ci.yml`/`loop-liveness`, testada aqui sob o ratchet de 100%; o `.mjs` (isento de propósito) só
// lê disco e imprime.
//
// G.2: mede a idade do DADO (`lastReviewed`), nunca a idade do RUN. Um mês em que o laço rodou e
// ABORTOU teria histórico de execução "recente" — e é exatamente o dano que este job existe para
// não deixar dormir (G.1, opção G1 descartada por essa razão).

/** O ciclo nominal do laço mensal (cron `0 6 1 * *`). */
export const LOOP_CYCLE_DAYS = 31;

/** 35 = 31 + 4 de folga de fila. 35 < 45: o dono é avisado ANTES do selo dizer "atualizada há mais
 *  de 45 dias" para o vendedor — o mesmo `31 + 14` do Adendo A14, com a folga MENOR porque este
 *  aviso é não-bloqueante e cedo é sempre melhor que tarde. */
export const LIVENESS_WARNING_DAYS = LOOP_CYCLE_DAYS + 4;

export type LivenessResultado =
  | { kind: "OK"; idadeDias: number }
  | { kind: "AVISO"; idadeDias: number; maisRecente: string }
  | { kind: "NUNCA_COLETADO" };

/**
 * `hoje − max(lastReviewed)`, restrito aos marketplaces que `MARKETPLACE_COVERAGE` declara
 * cobertos — a MESMA tabela do corpo do PR e da composição (§A do desenho): um marketplace que
 * entre ali passa a ser cobrado nos três de uma vez.
 *
 * Usa o MAIS RECENTE entre os marketplaces cobertos, de propósito: este job não audita cada
 * marketplace (o corpo do PR mensal já faz isso, honestamente, todo mês) — ele só pergunta "alguém
 * rodou o laço recentemente", e um único coletor vivo já responde que sim.
 */
export function avaliarLiveness(
  catalogo: { marketplaces?: unknown },
  hoje: string,
): LivenessResultado {
  const marketplaces = Array.isArray(catalogo.marketplaces)
    ? (catalogo.marketplaces as Record<string, unknown>[])
    : [];

  const datas: string[] = [];
  for (const mk of MARKETPLACE_COVERAGE) {
    const secao = marketplaces.find((m) => m.marketplace === mk);
    const entries = Array.isArray(secao?.entries)
      ? (secao.entries as Record<string, unknown>[])
      : [];
    for (const e of entries) {
      if (typeof e.lastReviewed === "string") datas.push(e.lastReviewed);
    }
  }

  if (datas.length === 0) return { kind: "NUNCA_COLETADO" };

  const maisRecente = datas.reduce((a, b) => (a > b ? a : b));
  const idadeDias = Math.round(
    (Date.parse(`${hoje}T00:00:00.000Z`) - Date.parse(`${maisRecente}T00:00:00.000Z`)) / 86_400_000,
  );

  if (idadeDias > LIVENESS_WARNING_DAYS) return { kind: "AVISO", idadeDias, maisRecente };
  return { kind: "OK", idadeDias };
}
