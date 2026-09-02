import type { CatalogJson } from "./slice.ts";

// ⚠ @doc DEC-049 — a semente NÃO é cópia do servido: é projeção PODADA, e a poda vale 94% do
//   documento (45.858 → 2.720 bytes, orçamento de boot SC-810). Política declarada, não
//   acidente curatorial — um comentário não impede alguém de copiar o servido inteiro.

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
export function projectSeed(servido: CatalogJson): CatalogJson {
    const marketplaces = Array.isArray(servido.marketplaces)
        ? (servido.marketplaces as CatalogJson[])
        : [];
    return {
        ...servido,
        marketplaces: marketplaces.map((m) => {
            if (!ehPodada(m)) return m;
            // A espinha SAI (é o mapa por categoria que não cabe no bundle) e as entradas viram lista
            // vazia; o resto da seção viaja com as chaves na ordem original, para o JSON ser estável.
            const withoutSpine = Object.entries(m).filter(([k]) => k !== "categorySpine");
            return { ...Object.fromEntries(withoutSpine), entries: [] };
        }),
    };
}

/** O texto exato que vai para o disco — o MESMO formato do artefato servido (2 espaços + \n final),
 *  porque um diff de formatação num PR mensal de dinheiro é ruído que treina o revisor a não olhar. */
export function serializeSeed(seed: CatalogJson): string {
    return `${JSON.stringify(seed, null, 2)}\n`;
}
