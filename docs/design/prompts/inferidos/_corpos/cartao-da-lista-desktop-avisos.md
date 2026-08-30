# Cartão do item na lista do Catálogo (desktop) e seus avisos

## O que desenhar
O cartão de um item salvo dentro da lista da esquerda do mestre-detalhe do Catálogo no desktop
(≥1280px), nas quatro seções da aba: Filamentos, Impressoras, Produtos e Kits. É o objeto que o
vendedor varre com os olhos e clica para trazer o item para a ficha de 560px à direita — ele
carrega nome, resumo do item e, quando existe, um ou mais **avisos honestos** sobre o estado
daquele item ou daquela lista (item degradado, catálogo possivelmente desatualizado, conta com
Premium pausado). Desenhe o cartão em todos os seus estados e, sobretudo, **a hierarquia dos
avisos** — inclusive quando mais de um aparece ao mesmo tempo.

## Por que este prompt existe
O cartão FOI desenhado no canvas de 018 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`,
linhas 104–114): nome em negrito, um `tf-badge` no canto superior direito e uma linha de meta
abaixo. O canvas prova os dois rótulos: `badge: "somente leitura", tone: "neutral"` no TPU Flex e
`badge: "precisa de atenção", tone: "danger"` na Base hexagonal. **O que foi construído não é
isso**: o cartão implementado empilha até quatro `<span>` com o MESMO estilo cinza de legenda —
resumo, nota do item, aviso de desatualizado e aviso de somente leitura — sem badge nenhum e sem
hierarquia. O aviso mais importante desce para a quarta linha, com o mesmo peso do resumo. Então
aqui não se desenha do zero: **executa-se o desenho que existe e resolve-se o que ele não cobre** —
a coexistência de DOIS ou TRÊS avisos no mesmo cartão (o canvas só mostra um badge por vez), e a
linha de dinheiro que o canvas inventou para Produtos, que **contraria FR-310** (ver abaixo).

## O que já existe hoje (não invente do zero — corrija)
O cartão é um `tf-card tf-card--interactive`, coluna, `gap` de 4px, largura total, `text-align:
left`, `overflow-wrap: anywhere`. Ordem atual de dentro para fora:

| # | Conteúdo | Estilo hoje | Observação |
|---|---|---|---|
| 1 | Nome do item | semibold, `--text-strong` | livre, digitado pelo vendedor |
| 2 | Resumo do item | caption, `--text-muted` | varia por seção (tabela abaixo) |
| 3 | Nota do item — `"Vincule um filamento e uma impressora salvos"` | **idêntico ao 2** | só Produtos; derivada, nunca armazenada |
| 4 | `"pode estar desatualizada"` | **idêntico ao 2** | flag da LISTA, não do item |
| 5 | `"somente leitura"` | **idêntico ao 2** | flag da CONTA, não do item |

→ **Problema central:** 3, 4 e 5 são indistinguíveis do resumo. O canvas resolve com badge no
canto superior direito; o código não tem badge nenhum.
→ **Problema 2:** 4 e 5 vêm de estado de LISTA/CONTA e são repetidos em CADA cartão — com 40
filamentos, "somente leitura" aparece 40 vezes. Ninguém desenhou se isso é por cartão ou uma
faixa única acima da lista.
→ **Problema 3:** o canvas desenha, para Produtos, `money: "custo R$ 21,84 · varejo R$ 65,52"`.
**Aqui o desenho é que está errado**: `product-summary.ts` proíbe preço na linha de um produto
("a row price would imply a stored snapshot", FR-310). Produto na lista mostra procedência
(nomes do filamento e da impressora), nunca preço.
→ **Problema 4:** hoje o cartão não tem badge, não tem canto superior direito e não tem linha de
dinheiro própria; para Filamentos e Impressoras o dinheiro já vive *dentro* do resumo cinza.

Ao redor: acima da lista há a barra com busca (`"Buscar no catálogo…"`), a contagem
(`"{n} filamento(s)"`) e o botão `Adicionar filamento`; à direita, colada no topo, a ficha de
560px do item selecionado. A lista é **1 coluna** entre 1280 e 1599px e **2 colunas** a partir de
1600px.

## Conteúdo e dados reais
Resumo (linha 2) por seção, com valores verdadeiros de como o app formata hoje:

| Seção | Resumo real | Exemplo |
|---|---|---|
| Filamentos | `{material} · R$ {custo} / {peso} kg` | `PLA · R$ 89,90 / 1 kg` |
| Impressoras | `R$ {valor} · {vida} h · {potência} kW` | `R$ 2.400,00 · 4680 h · 0,12 kW` |
| Produtos | `{filamento} · {impressora}` | `PLA Prata 1kg · Ender 3 V3` · degradado: `manual · manual` · carregando: `carregando… · carregando…` |
| Kits | `{n} peça(s)` | `3 peça(s)` |

- Dinheiro sempre com máscara de milhar (`R$ 2.400,00`). → **Grandezas não-monetárias hoje saem
  sem máscara** (`4680 h`); trate isso como problema a resolver no desenho da linha de meta.
- Nome do item é texto livre do vendedor: pode ser `PLA Prata 1kg` ou 500 caracteres sem espaço.
- Rótulos literais dos avisos, homologados, **use exatamente estes**: `"Vincule um filamento e uma
  impressora salvos"` · `"pode estar desatualizada"` · `"somente leitura"`. Os rótulos de badge do
  canvas: `"somente leitura"` (neutro) e `"precisa de atenção"` (danger).
  → `"precisa de atenção"` (badge do canvas) e `"Vincule um filamento e uma impressora salvos"`
  (frase do código) são o MESMO estado: o badge nomeia, a frase instrui. Desenhe os dois juntos e
  diga onde cada um vive.

## Estados obrigatórios
1. **Repouso** — nome + resumo. Sem badge.
2. **Selecionado** — hoje: borda `--accent` e fundo `--accent-soft`. É o item que está na ficha à
   direita; precisa ser inequívoco a três metros e não pode depender só de cor.
3. **Hover** e **pressionado** — o cartão inteiro é o alvo clicável (não há botão dentro dele no
   desktop; editar/duplicar/excluir vivem no cabeçalho da ficha).
4. **Foco de teclado** — o cartão é um `<button>`; o anel precisa aparecer inteiro, incluindo no
   cartão selecionado, onde a borda já é `--accent`.
5. **Precisa de atenção** (só Produtos) — badge danger `"precisa de atenção"` + a frase
   `"Vincule um filamento e uma impressora salvos"`. O resumo desse item lê `manual · manual`.
6. **Lista desatualizada** — `"pode estar desatualizada"`. A leitura online falhou e o cache do
   aparelho respondeu: os dados são reais, só possivelmente velhos. Tom informativo, nunca danger.
7. **Referências carregando** — resumo `carregando… · carregando…`. Nunca cair para `manual`
   enquanto carrega: `manual` é uma afirmação sobre a procedência do dado, não um spinner.
8. **Premium pausado** — badge/aviso `"somente leitura"`. O item continua clicável e a ficha abre
   completa: o que some é criar/editar/excluir. **Não desabilite o cartão.**
9. **Dois e três avisos juntos** — Produto degradado, em lista desatualizada, com Premium pausado.
   Este é o caso que ninguém desenhou e é o que este prompt precisa resolver.
10. **Nome extremo** — 500 caracteres sem espaço, e nome de 3 caracteres.
11. Fora do cartão, mas na mesma prancheta para contexto: **carregando** (spinner no lugar da
    lista), **erro** (`"Não foi possível carregar seu catálogo."` + `Tentar novamente`) e
    **busca sem resultado** (`"Nada encontrado para essa busca"` / `"Tente outro termo, ou limpe a
    busca para ver tudo de novo."` / `Limpar busca`).

## Viewports
- **1280px** — lista em 1 coluna, ficha de 560px à direita. O cartão fica largo e baixo; é aqui
  que o badge no canto superior direito tem mais espaço e mais risco de parecer solto.
- **1920px** — lista em 2 colunas (regra ativa a partir de 1600px). O cartão fica estreito; teste
  aqui a convivência de badge + nome longo + linha de meta na mesma largura.
Mobile 390px **não** entra: abaixo de 1280px o app monta outra árvore e este componente nem existe.
O cartão da lista mobile tem o mesmo empilhamento cinza, mas **o mobile não se mexe neste
incremento** — se a solução for portável, diga; não redesenhe o mobile.

## Regras que o desenho não pode quebrar
- **Produto na lista não mostra preço** (FR-310). Preço de produto só existe onde há orçamento
  salvo; uma linha de dinheiro no cartão sugere um snapshot que não existe.
- **Degradação dita, não escondida**: `manual · manual` e `"precisa de atenção"` são informação
  honesta, não erro do usuário — tom firme, sem alarme vermelho piscante.
- **Falha de rede nunca vendida como falta de Premium**: `"pode estar desatualizada"` e
  `"somente leitura"` são estados diferentes e não podem compartilhar cor, ícone ou posição.
- **Premium pausado é calmo, não punitivo**: os itens continuam ali e continuam servindo ao
  cálculo.
- Frase honesta em elemento de largura cheia — nunca dentro de um placeholder nem cortada por
  ellipsis. Se um aviso não couber, o cartão cresce.
- Contraste medido contra o fundo REAL do cartão (que muda no estado selecionado, `--accent-soft`)
  — não contra o fundo da página.

## Armadilhas já pagas neste projeto
- Um nome de filamento com 500 caracteres sem espaço gerou **4.948px de rolagem horizontal a
  1440px** no cartão da lista (a ficha à direita já quebrava, o cartão não). Qualquer coisa nova
  no cartão — badge inclusive — precisa quebrar linha, não empurrar a grade.
- Texto ocluso passa em teste: `toBeVisible` é verdadeiro para um elemento inteiramente coberto.
  Se o badge sobrepuser o nome, nenhum teste pega — só o desenho.
- Valor grande estoura a coluna: `R$ 2.400,00 · 4680 h · 0,12 kW` já é longo; some a máscara de
  milhar e um nome de impressora comprido e a linha de meta precisa de plano de quebra.
- Máscara de milhar perdida (016) — o número não-monetário sai cru hoje.
- "Desenhado e não executado" é o defeito desta própria peça: entregue o desenho com o
  comportamento de cada aviso explícito o bastante para não sobrar espaço para inferência.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como first-class**:
1. O cartão em repouso, hover, foco, pressionado e selecionado — 1280px e 1920px.
2. Os três avisos isolados: precisa de atenção · pode estar desatualizada · somente leitura.
3. **A pilha**: dois avisos juntos e os três juntos, com a hierarquia proposta e uma legenda de uma
   linha explicando qual vence e por quê.
4. O cartão de cada seção com seu resumo real (Filamento, Impressora, Produto, Kit).
5. A lista completa em 1280px e 1920px com um cartão selecionado, mostrando o cartão dentro do
   mestre-detalhe (busca + contagem + botão adicionar acima, ficha de 560px à direita).
6. Nome extremo (500 caracteres sem espaço) em 1920px, duas colunas.
Reutilize os primitivos existentes: `tf-card` / `tf-card--interactive` para o cartão, `tf-badge`
(`--neutral`, `--info`, `--danger`) para os avisos, `tf-tnum` para qualquer número tabular, o anel
de foco padrão, e o `Alert` do DS apenas se a solução for uma faixa acima da lista em vez de marca
por cartão. Não crie primitivo novo — se precisar de um, diga qual e por quê.

## Perguntas em aberto para o dono
1. **Dois avisos no mesmo cartão**: um Produto degradado dentro de uma lista desatualizada e com
   Premium pausado tem três avisos. Um badge só, com precedência (qual vence?), dois badges, ou
   badge para o estado do ITEM e faixa única acima da lista para os estados de LISTA/CONTA?
2. **Repetição**: `"pode estar desatualizada"` e `"somente leitura"` são verdadeiros para a lista
   inteira e hoje se repetem em cada cartão. Devem sair do cartão para uma faixa única?
3. **Kits**: o canvas dá ao kit uma linha `custo R$ 52,34 · varejo R$ 157,02`. FR-310 fala de
   Produtos. Kit mostra dinheiro no cartão da lista, ou segue a mesma regra do produto?
4. **`"precisa de atenção"` vs `"Vincule um filamento e uma impressora salvos"`**: mantemos os dois
   textos (badge nomeia, frase instrui) ou a frase some do cartão e fica só na ficha à direita,
   onde já aparece como `Alert` informativo?
