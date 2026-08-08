// 017/T007 (desenho §I.2, fecha 014/U4-f) — A lista de campos inertes. UMA, e num lugar só.
//
// Ela existia DUAS vezes com os mesmos três nomes: `refresh.ts:INERT`, que decide o que entra na
// tabela do corpo do PR, e `catalog-diff.ts:INERT_PATHS`, que decide `freshnessOnly` — de onde sai a
// elegibilidade à dispensa de revisão. Nada obrigava as duas a andarem juntas, e o dia em que
// divergissem produziria um PR que diz "sem mudança de tarifa" E é elegível a entrar sem ninguém
// ler; ou, pior, o contrário — um campo de dinheiro tratado como data de reverificação num dos dois
// lados. Com o 017 a lista ganha um terceiro leitor (a tabela do corpo do PR mensal, `pr-body.ts`),
// e três cópias de uma regra de dinheiro é uma a mais do que este repositório já provou não
// conseguir manter sincronizada.

/**
 * Campos que não carregam dinheiro nem cobertura — os únicos que uma execução do laço pode mexer
 * sozinha, sem que isso conte como notícia de tarifa.
 *
 * `effectiveDate` NÃO está aqui, e a ausência é deliberada: `lastReviewed` diz "alguém conferiu a
 * fonte"; `effectiveDate` diz "a partir de quando esta tarifa vale". A segunda muda dinheiro no
 * tempo, e uma mudança dela tem de aparecer na tabela do PR e derrubar a dispensa.
 */
export const INERT_FIELDS = ["lastReviewed", "catalogVersion", "generatedAt"] as const;

const INERTES = new Set<string>(INERT_FIELDS);

/** O campo mudou sem que nada de dinheiro tenha mudado? */
export function isInerte(campo: string): boolean {
  return INERTES.has(campo);
}
