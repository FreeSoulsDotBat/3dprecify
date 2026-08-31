import type { CatalogJson } from "./slice.ts";

// 017/T009 · P0-a (ADR-0029, desenho §B/§C.2.4) — a SEMENTE como PROJEÇÃO GERADA do artefato servido.
//
// O defeito é MEDIDO e já custou duas edições à mão em dois dias: `fee-catalog.test.ts` cravava
// `catalogVersion` numa literal, e todo bump de conteúdo obrigava alguém a reescrever uma string
// dentro de um teste. O primeiro PR mensal nasceria VERMELHO por construção — com o dado CERTO.
//
// A tentação seria "paridade estrita = igualdade de documento". MEDIDO hoje, e ela é falsa: a
// semente NÃO é cópia do servido. No servido a Amazon tem 78 entradas e uma espinha de 38
// categorias; na semente, `entries: []` e nenhuma espinha. Ela é uma projeção PODADA, e a poda vale
// 94% do documento — 45.858 bytes servidos viram 2.720 (orçamento de boot SC-810).
//
// O que este módulo faz é transformar essa poda de ACIDENTE CURATORIAL em POLÍTICA DECLARADA. Até
// aqui ela era um comentário no `seed.ts` ("ML + Amazon stay empty pending their category-specific
// rates") que nenhum guarda verificava — e um comentário não impede o mês em que alguém copie o
// servido inteiro para dentro do bundle.

/**
 * A regra da poda, e ela é uma só: **uma seção cujo `determinantsSchema` declara o eixo `category`
 * não viaja no bundle** — perde a `categorySpine` e sai com `entries: []`.
 *
 * O critério não é "Amazon e ML": é a FORMA da tabela. Um marketplace cujas tarifas dependem da
 * categoria não tem como pré-preencher nada offline sem carregar a árvore inteira de categorias mais
 * uma entrada por categoria — que é exatamente o custo que o SC-810 recusa. Um marketplace cujas
 * tarifas são category-independentes (a Shopee, que publica por faixa de preço) cabe inteiro e viaja
 * inteiro, `freightSubsidyInfo` e `optionalSurcharges` incluídos.
 *
 * MEDIDO 2026-08-07: esta regra reproduz a semente curada à mão, campo a campo, sem exceção. Ela é
 * descrição do que existe, não uma regra nova imposta ao dado.
 */
export function ehPodada(marketplace: CatalogJson): boolean {
    const ds = marketplace.determinantsSchema;
    return typeof ds === "object" && ds !== null && "category" in ds;
}

/**
 * A semente que o app empacota, derivada do artefato servido.
 *
 * Metadados (`catalogVersion`, `schemaVersion`, `generatedAt`) viajam INTACTOS: é o que faz o rótulo
 * dos dois documentos ser o mesmo sem ninguém digitá-lo, e é a relação (ii)/(iii) da decisão B.
 *
 * Idempotente por construção — projetar uma projeção devolve a mesma projeção. Sem isso o
 * `pnpm fee:build` não teria ponto fixo e abriria um PR novo todo mês sobre a mesma tabela.
 */
export function projetarSemente(servido: CatalogJson): CatalogJson {
    const marketplaces = Array.isArray(servido.marketplaces)
        ? (servido.marketplaces as CatalogJson[])
        : [];
    return {
        ...servido,
        marketplaces: marketplaces.map((m) => {
            if (!ehPodada(m)) return m;
            // A espinha SAI (é o mapa por categoria que não cabe no bundle) e as entradas viram lista
            // vazia; o resto da seção viaja com as chaves na ordem original, para o JSON ser estável.
            const semEspinha = Object.entries(m).filter(([k]) => k !== "categorySpine");
            return { ...Object.fromEntries(semEspinha), entries: [] };
        }),
    };
}

/** O texto exato que vai para o disco — o MESMO formato do artefato servido (2 espaços + \n final),
 *  porque um diff de formatação num PR mensal de dinheiro é ruído que treina o revisor a não olhar. */
export function serializarSemente(semente: CatalogJson): string {
    return `${JSON.stringify(semente, null, 2)}\n`;
}
