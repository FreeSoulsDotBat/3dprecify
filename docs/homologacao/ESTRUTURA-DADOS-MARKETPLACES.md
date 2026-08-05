# A estrutura de dados que cada marketplace exige

**Data**: 2026-08-05 · **Base**: `PESQUISA-MARKETPLACES.md` (workflow de 8 agentes com verificação
adversarial) medido contra o schema real em `apps/web/src/shared/fee-catalog/fee-catalog.ts`.

**Para que serve**: decidir (a) o que a tela mostra por marketplace, (b) o que o catálogo precisa
carregar, e (c) **o que o próximo workflow tem de descobrir como obter dinamicamente**.

---

## O que o schema de hoje modela

| campo | o que representa |
| --- | --- |
| `determinants` | eixos arbitrários `{chave: valor}` — é aqui que cabe modalidade, plano, categoria |
| `commissionPct` · `fixedFee` · `minPerItem` | os três escalares por entrada |
| `priceBands[]` + `bandMode` | tarifa por faixa de preço; `SELECTION` (a faixa define tudo) ou `PROGRESSIVE` (cada faixa sobre a sua fatia) — ADR-0024 |
| `freight` | `NONE` · `ESTIMATE` (limiar + subsídio) · `BAND_VOUCHER` (teto por faixa) |
| `categorySpine` | a árvore de categorias do marketplace |

**O schema é mais capaz do que a tela usa.** A grade de 4 campos fixos é decisão da UI, não limitação
do modelo — é por isso que "dirigir os campos pelo marketplace" não precisa de dado novo.

---

## FECHADO — o que a pesquisa resolveu e não precisa de mais nada

| # | fato | consequência imediata |
| --- | --- | --- |
| 1 | **O Mercado Livre TEM taxa fixa** (`fixed_fee` na API, separada do percentual) | derruba a premissa do relatório; o campo **fica** no ML |
| 2 | **A Shopee NÃO varia por categoria** — só por faixa de preço | o seletor de categoria **some** na Shopee; não é decoração aceitável |
| 3 | **A Amazon é PLANA**: 1 nível, sem herança, 37 linhas na página oficial | o seletor da Amazon **não precisa de árvore** — é uma lista |
| 4 | **A comissão da Shopee já contém a taxa de transação** (literal, em 3 artigos) | **não somar gateway por cima** — seria cobrar duas vezes |
| 5 | **O plano da Amazon não muda o percentual** — muda só a estrutura fixa (R$ 2/item vs R$ 19/mês) | `plan` continua determinante, mas só afeta `fixedFee` |
| 6 | **A Shopee não cobra comissão em cancelamento/devolução** | fora do escopo da calculadora (é pós-venda) |
| 7 | **O ML não tem geo-gate** (medido, dois arms) | a fatia US6 não precisa de máquina no Brasil |

---

## O QUE FALTA — por marketplace, e o que já cabe no schema

### Mercado Livre — **5 eixos**, e um deles não cabe no modelo atual

| eixo | cabe hoje? | como obter |
| --- | --- | --- |
| **Modalidade** (Clássico/Premium) | **sim** — `determinants.listingType` | público |
| **Categoria** | **sim** — `determinants.category` + `categorySpine` | `GET /sites/MLB/categories` + `/categories/{id}` — **exige credencial** (`Publicação e sincronização: Leitura`) |
| **Faixa de preço** (limiar do custo fixo) | **sim** — `priceBands` | limiar publicado: R$ 79. **Os valores em R$ das faixas abaixo NÃO são publicados** |
| **Tipo de logística** (Flex/ME1/ME2/custom) | **sim, como determinante** — mas **ninguém pergunta isso na tela hoje** | novo desde 02/03/2026 |
| **Reputação do vendedor** | **NÃO** — afeta frete, e frete real não é modelado | tabelas devolvem 403 |

**O buraco do ML é o frete.** O nosso modelo trata frete como escalar que o vendedor digita, ou teto
por faixa de preço. O frete real do ML depende de **peso, dimensões, distância, valor do carrinho,
método e reputação** — e o **divisor de peso cubado** decide o custo inteiro de uma peça 3D, que é
volumosa e leve. Isso é o item mais crítico da pesquisa, e não foi obtido.

### Amazon — **3 eixos**, todos cabem

| eixo | cabe hoje? | situação |
| --- | --- | --- |
| **Categoria** (37, plana) | **sim** | público, sem credencial — página JS-renderizada, exige navegador |
| **Plano** (Individual/Profissional) | **sim** — `determinants.plan` | afeta só o fixo |
| **Faixas dentro da categoria** (progressivo) | **sim** — `bandMode: PROGRESSIVE` (ADR-0024) | já modelado |

> ### ⚠ SUSPEITA SOBRE O NOSSO PRÓPRIO DADO — a conferir
>
> A pesquisa achou **dois pisos** de comissão mínima na Amazon (R$ 1,00 e R$ 2,00), com a tabela
> oficial partida em dois blocos — e escreveu que um "R$ 1,00 para todas as linhas" seria
> *"o resultado que um parser que lê só a primeira ocorrência produziria"*.
>
> **Medido no nosso catálogo: `minPerItem: 1` em 78 de 78 entradas.** A assinatura bate.
>
> A fronteira entre os blocos **não foi lida** pela pesquisa, então isto é suspeita, não veredito.
> **Impacto se confirmado**: item barato — chaveiro, brinde — que é segmento real de 3D. O piso só
> morde abaixo de ~R$ 6,67 (a 15%) ou R$ 10 (a 10%).
>
> Também divergente: nossa `categorySpine` tem **38 nós**; a página oficial tem **37 linhas**.

### Shopee — **1 eixo de produto, 2 de vendedor** — e os de vendedor NÃO cabem

| eixo | cabe hoje? | situação |
| --- | --- | --- |
| **Faixa de preço** | **sim** — `priceBands` | já modelado e conferido em 2026-08-03 |
| **Perfil CNPJ/CPF + volume** (>450 pedidos/90d = **+R$ 3/item**) | **NÃO** | é atributo do VENDEDOR, não do produto |
| **Regime de item barato** (< R$ 8 CNPJ: adicional = **metade do preço**) | **NÃO** | é `fixedFee` como **função do preço**, não constante |
| **Campanhas de Destaque** (**+3,5% sobre TODAS as vendas da loja**) | **NÃO** | opt-in, nível de loja |

---

## As três lacunas ESTRUTURAIS

Estas não são dados faltando — são formas que o modelo não tem.

### E1. O catálogo não conhece o VENDEDOR

`FeeEntry` descreve **o produto num marketplace**. Mas a Shopee cobra `+R$ 3/item` por perfil e
volume, e a Amazon cobra `R$ 19/mês` por plano. Nenhum dos dois é atributo do produto.

**Custo de não ter**: o vendedor CPF acima de 450 pedidos paga **R$ 3 a mais por item** do que a
calculadora diz. Numa peça de R$ 30, são **10%**.

**Formas possíveis** (a decidir): um bloco `sellerProfile` no formulário, alimentando determinantes;
ou um `surcharges[]` na entrada, condicionado a atributos do vendedor.

### E2. `fixedFee` é constante; a Shopee o faz FUNÇÃO do preço

Abaixo de R$ 8 (CNPJ), o adicional é **metade do preço do produto**. Abaixo de R$ 12 (CPF), é
regressivo — e a fórmula **não é publicada**; só dois pontos (R$ 10 → R$ 6,50; R$ 8 → R$ 6,00).

**Custo de não ter**: peça barata sai com taxa errada. Chaveiro é o caso mais comum de 3D.

### E3. Frete real não é modelado

Hoje: escalar digitado ou teto por faixa de preço. Real: **peso, dimensões, cubagem, distância,
reputação**. É o maior de todos para impressão 3D.

**Custo de não ter**: o vendedor de peça grande e leve descobre o frete no extrato, não na tela.

---

## O que o PRÓXIMO workflow precisa descobrir

Organizado por "qual dado, e qual a pergunta exata".

### Mercado Livre — 6 perguntas
1. A landing `/landing/costos-venta-producto` mostra alíquota por categoria **sem login**? (403 na
   coleta automatizada é bloqueio de bot, não 401 — a pergunta segue aberta)
2. Qual o **limiar TH** hoje, e ele varia por categoria ou por logística? *(resolver com
   `GET /sites/MLB/listing_prices?price=X&category_id=Y` variando X em 70/78/79/80)*
3. **Valores em R$** das faixas de custo fixo entre R$ 12,50 e R$ 79 — nenhuma fonte oficial publica
4. A regra dos **50% abaixo de R$ 12,50** vale após 02/03/2026?
5. **Existe piso de comissão?** Nenhuma fonte afirma nem nega — não gravar `existe: false`
6. **Tabela de frete por peso/reputação e o divisor de cubagem** — o mais crítico

### Amazon — 3 perguntas
1. **A fronteira entre os pisos de R$ 1,00 e R$ 2,00** — quais categorias caem em cada
2. **37 ou 38 categorias?** (nosso catálogo diz 38)
3. A **isenção promocional** ("comissão zero até R$ 500 mil") — texto, vigência, elegibilidade

### Shopee — 3 perguntas
1. A **fórmula regressiva** abaixo de R$ 12 (CPF) — só dois pontos publicados
2. **Existe piso de comissão?** Zero ocorrências de "mínimo/piso" em 4 artigos
3. A **cobrança adicional de frete** (peso/dimensões aferidos vs cadastrados) — sem tabela pública

### Transversal
1. Como obter cada um desses **dinamicamente**, e com que frequência mudam
2. Quais exigem credencial e qual a **permissão mínima**
3. Quais são JS-renderizados (exigem navegador) vs API

---

## Ordem recomendada

1. **Conferir o `minPerItem` da Amazon** — é o único que pode ser defeito de preço **no que já
   está servido**, e é uma leitura da página que já sabemos abrir.
2. **Decidir as três lacunas estruturais** — elas mudam o schema, e mudar schema depois de ter dado
   em produção é migração.
3. **Só então o workflow de obtenção dinâmica** — porque ele deve buscar o que a estrutura pede, e
   não o contrário.
