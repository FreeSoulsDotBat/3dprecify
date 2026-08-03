# A10 — conferência da tabela Shopee, 2026-08-03

**Para o dono ratificar.** Enquanto esta conferência não for ratificada, `lastReviewed` **não se
move** — a data significa "um humano conferiu", e movê-la sem isso seria exatamente a classe de
mentira que a auditoria passou 16 fases medindo.

## Por que agora

`[F06-001]`: o selo de frescor começa a avisar em **2026-08-21**, 45 dias depois do
`lastReviewed: 2026-07-07` da Shopee. A janela foi dimensionada para tolerar um ciclo mensal mais
folga de entrega, e o laço mensal não roda (o `fee-refresh.yml` está bloqueado nas 8 condições do
parecer de segurança). Sem conferência, um vendedor que acabou de pagar leria "esta tarifa pode
estar desatualizada" numa tela pela qual pagou.

## Como foi levantada

- **Fonte**: <https://seller.shopee.com.br/edu/article/26839> — "Confira a Política de Comissão para
  vendedores CNPJ e CPF para 2026", Centro de Educação do Vendedor Shopee BR. É a MESMA URL que o
  catálogo já registra em `sourceUrl`.
- **Sem credencial**: conteúdo público, como a Amazon (gate G2).
- **Browser headless obrigatório**: a página é JS-renderizada — `WebFetch` devolveu só a casca
  ("Seller Education Hub", sem tabela). Mesma condição da Amazon.
- **A tabela não é `<table>`**: o DOM tem uma `<table>` vazia; os números estão numa imagem/bloco
  estilizado. Foram lidos do **screenshot de página inteira**, não de extração de texto. É a lição
  da 014 aplicada ao sentido inverso: aqui a imagem é a única fonte legível.
- Evidência bruta: `shopee-raw.json` + `shopee-pagina.png` (no scratchpad da sessão — não
  versionados, pela mesma decisão que deixou os 208 screenshots da auditoria fora do histórico).

## O que a fonte diz, e o que o catálogo diz

### Comissão (vendedores CNPJ)

| faixa na fonte | fonte | catálogo (`priceBands`) | diferença |
| --- | --- | --- | --- |
| Até R$ 79,99 | 20% + R$ 4 | `[0, 80)` → 20% + R$ 4 | **nenhuma** |
| Acima de R$ 80 até R$ 99,99 | 14% + R$ 16 | `[80, 100)` → 14% + R$ 16 | **nenhuma** |
| Acima de R$ 100 até R$ 199,99 | 14% + R$ 20 | `[100, 200)` → 14% + R$ 20 | **nenhuma** |
| Acima de R$ 200 até R$ 499,99 | 14% + R$ 26 | `[200, ∞)` → 14% + R$ 26 | **nenhuma** |
| Acima de R$ 500 | 14% + R$ 26 | *(a mesma banda acima)* | **nenhuma** |

A fonte divide a última faixa em duas (200–499,99 e 500+) porque o **subsídio Pix** muda (5% → 8%).
A **comissão é idêntica** nas duas, então a banda única `[200, ∞)` do catálogo é equivalente para o
que o catálogo modela. O subsídio Pix não é modelado — ver §Limites.

### Frete Grátis (tetos de cupom)

| fonte | catálogo (`freight.bands`) | diferença |
| --- | --- | --- |
| itens até R$ 79,99 → até R$ 20 | `[0, 80)` → 20 | **nenhuma** |
| itens de R$ 80 a R$ 199,99 → até R$ 30 | `[80, 200)` → 30 | **nenhuma** |
| itens acima de R$ 200 → até R$ 40 | `[200, ∞)` → 40 | **nenhuma** |

### Vigência

A fonte diz "ajustada a partir de **1º de março**"; o catálogo tem `effectiveDate: 2026-03-01`.
**Nenhuma diferença.** O artigo está datado de 04-02-2026 e nada indica revisão posterior.

## Veredito

**Zero diferenças em 8 valores conferidos.** A tabela que o produto serve hoje é a que a Shopee
publica hoje. O que está velho é a DATA DA CONFERÊNCIA, não o dado.

Isto é o melhor resultado possível para o `[F06-001]` e vale dizer com clareza: o selo teria
começado a avisar sobre um dado **correto**. Ele não estaria mentindo — a janela de 45 dias mede
"há quanto tempo ninguém olha", que é uma pergunta legítima e diferente de "o número mudou".

## Limites do que foi conferido — leia antes de ratificar

1. **Só a tabela CNPJ.** A fonte tem uma segunda tabela para **CPF**, com `+ R$ 3 de taxa vendedor
   CPF` em cada faixa (para quem ultrapassa 450 pedidos em 90 dias). **O catálogo não modela isso** —
   um vendedor CPF acima desse volume paga R$ 3 a mais por item do que o produto calcula. É lacuna
   PRÉ-EXISTENTE, não algo que esta conferência mudou, e não é do escopo do A10. Registro porque é
   dinheiro do vendedor.
2. **Regras de valor baixo não modeladas**: abaixo de R$ 8 o adicional por item é metade do preço do
   produto (CNPJ); abaixo de R$ 12 a taxa é regressiva (CPF). Também pré-existentes.
3. **Subsídio Pix (5% a 8%)** não é modelado. Ele AUMENTA o que o vendedor recebe, então não
   modelá-lo é conservador — o produto nunca promete a mais.
4. **Uma única leitura, num único dia.** Não há histórico: não sei dizer se algo mudou entre
   2026-07-07 e hoje e voltou.

## O que acontece se você ratificar

`lastReviewed` da Shopee passa de `2026-07-07` para `2026-08-03`, o que empurra o aviso do selo de
**21/08** para **17/09**. O `catalogVersion` **não** muda: pelo `nextCatalogVersion`, ele só se move
quando o CONTEÚDO muda, e o conteúdo não mudou — esse rótulo é congelado em snapshot imutável e
precisa continuar respondendo "qual tabela precificou este registro".

Nada mais é tocado.
