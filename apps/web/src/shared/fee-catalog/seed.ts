import type { FeeCatalog } from "./fee-catalog";
import seedData from "./seed.data.json";

// Bundled seed (ADR-0010 R1) — a semente que garante o PRIMEIRO pré-preenchimento OFFLINE, antes de
// qualquer fetch chegar ao store.
//
// 017/T009 · P0-a (ADR-0029): ela deixou de ser DOCUMENTO e virou SAÍDA. O conteúdo agora mora em
// `seed.data.json`, gerado por `pnpm fee:build` a partir de `projetarSemente(servido)`
// (`packages/fee-ingest/src/seed-projection.ts`) — NUNCA editado à mão. O que mudou e por quê:
//
//   · Antes: um literal TS mantido à mão, cuja `catalogVersion` era reeditada a cada bump. Ela foi
//     reescrita DUAS VEZES EM DOIS DIAS (016/PR-F e o hotfix A2/A3), e um teste cravava a string —
//     então o primeiro PR mensal do robô nasceria vermelho com o dado CERTO.
//   · Agora: a paridade é RELACIONAL. `seed.data.json == projetarSemente(catalog.json)` é afirmado em
//     `packages/fee-ingest/src/seed-projection.artifact.test.ts` (byte a byte), e as relações de
//     rótulo/schema ficam no truth-gate ao lado deste arquivo. Nenhuma literal de versão sobrou.
//   · JSON e não TS porque um gerador que reescrevesse este arquivo destruiria os comentários
//     curatoriais — que são o único lugar em CÓDIGO onde vivem os verbatims da Shopee.
//
// A POLÍTICA da poda (medida, não inventada): uma seção cujo `determinantsSchema` declara o eixo
// `category` viaja SEM `categorySpine` e com `entries: []` — o mapa por categoria da Amazon são 78
// entradas + 38 nós, 94% do documento (45.858 → 2.720 bytes), e ele não cabe no orçamento de boot do
// SC-810. Marketplace category-INDEPENDENTE (Shopee) viaja inteiro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// VERBATIMS CURATORIAIS PRESERVADOS (RA4) — nota datada 2026-08-07.
//
// Estes textos eram os comentários deste arquivo e são a PROCEDÊNCIA dos números da Shopee. Eles
// ficam aqui porque a fatia que os transforma em ÂNCORAS EXECUTÁVEIS é a PR-C do 017 (T026:
// `packages/fee-ingest/data/shopee-art26839.baseline.json`, onde deixam de ser prosa num espelho e
// viram guarda que dispara). Enquanto essa migração não acontece, eles não podem simplesmente sumir
// junto com o literal — nenhum outro lugar do repositório os carrega.
//
//  1. Art. 26839 (T057, US18/FR-927) — a banda [0, 80) PARTE EM DUAS: "Para produtos com preço
//     abaixo de R$8, o adicional por item é a metade do preço do produto. Produtos acima de R$8
//     mantêm a comissão conforme a variação de valor do item" ⇒ a comissão de 20% CONTINUA
//     incidindo; o que vira função do preço é o ADICIONAL. Em L = R$ 8,00 as duas linhas cobram o
//     mesmo (metade de 8 = os R$ 4 constantes): a fonte é contínua no limiar e a partição não
//     inventa degrau nenhum.
//  2. Art. 26839 (T057, US17/FR-926) — o CPF que NÃO passa de 450 pedidos/90 dias paga exatamente a
//     tabela do catch-all: "a taxa adicional de R$3 … não será aplicada, ficando vigente apenas a
//     taxa por item vendido (R$4, R$16, R$20 ou R$26)". Logo DUAS entradas, não três. Um eixo
//     COMPOSTO e não dois: "CNPJ + alto volume" não existe publicado, e dois eixos criariam um
//     espaço cartesiano com buracos irrepresentáveis. A entrada CATCH-ALL (`determinants: null`) é o
//     regime CNPJ — e é isso que mantém byte-idêntico todo documento salvo antes do campo existir.
//  3. Art. 26839 (T057) — a REGRESSIVA que o app NÃO precifica: "um produto de R$10 tem uma taxa de
//     R$6,50, enquanto um de R$8 terá taxa de R$6". A fórmula não é publicada, então abaixo de
//     R$ 12 o nível fica sem referência (I9) em vez de mentir sob selo.
//  4. Art. 23431 (relido 2026-08-07, hotfix 016/A2) — o subsídio de frete é da SHOPEE, não do
//     vendedor: "Todos os vendedores têm os benefícios do Programa de Frete Grátis. A Shopee também
//     oferece subsídios de frete. … Para itens de até R$79,99: Cupons de frete grátis válidos para
//     fretes de até R$20; … R$30; … R$40." O valor é o TETO DE VALIDADE do cupom, e por isso
//     `freightSubsidyInfo` é INFORMAÇÃO que não entra em conta nenhuma (era `freight: BAND_VOUCHER`,
//     e o motor descontava os R$ 20 do líquido do vendedor — o achado A2).
//  5. Art. 3305 (016/US16, FR-923) — a taxa de manuseio de item volumoso é POR PEDIDO: num pedido de
//     vários itens ela é cobrada UMA vez.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O `as unknown as FeeCatalog` é deliberado, e a garantia NÃO se perdeu no caminho.
 *
 * Um `feeCatalogSchema.parse()` aqui devolveria a checagem em tempo de módulo — e derrubaria o app no
 * boot com tela branca se a semente viesse malformada, que é exatamente o que 014/FR-026 decidiu não
 * fazer. A validação continua onde ela sabe DEGRADAR em vez de morrer: `parseSeedResilient` em
 * `use-fee-catalog.ts`, que descarta o marketplace ofensor e loga alto. E o truth-gate ao lado prova,
 * a cada gate, que este documento parseia sob o mesmo schema do servido.
 */
export const FEE_CATALOG_SEED = seedData as unknown as FeeCatalog;
