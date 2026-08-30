# A oferta Premium dentro da gaveta "Minhas simulações"

## O que desenhar
A gaveta lateral que abre quando o vendedor toca em "Minhas simulações" na calculadora (`/calcular`) — só que
no caso de quem **ainda não tem Premium**. Para quem tem, essa gaveta é a lista de simulações salvas; para
quem não tem (deslogado, ou logado sem nenhuma assinatura), o mesmo painel mostra, no lugar da lista, a oferta
completa: título, promessa, preço real e o botão "Assinar Premium". É um painel sobreposto, ancorado à direita,
que ocupa a altura inteira da tela e escurece a calculadora atrás. O momento é o mais quente da jornada: o
vendedor acabou de calcular um preço, gostou, e foi procurar onde isso fica salvo. Descubra ali que a coisa é
paga. Precisa ser uma porta honesta, não uma parede.

## Por que este prompt existe
O bloco de teaser (`tf-premium-teaser`) está desenhado no canvas do 018 — três vezes. O que **nunca** foi
desenhado é ele **dentro de uma gaveta sobreposta**, nem o conteúdo específico de Simulações: o canvas cobre
Catálogo, Kits, Orçamentos e Conta, e não tem prancheta de Simulações. Motivo cronológico simples: o protótipo
de 2026-07-02 é dezoito dias anterior à E5, que criou as simulações salvas. Faltam três decisões que hoje são
código e não desenho: **a altura** (um bloco de ~220px de conteúdo dentro de um painel de altura total),
**a âncora do CTA** (ele fica colado no texto, no topo, com um vazio enorme embaixo) e **a regra do CTA único**
— hoje uma guarda em código (`showTeaserSlot && !scenariosOpen`) que apaga a outra oferta da página atrás.
Dois CTAs de compra empilhados na mesma tela já aconteceram **duas vezes** (E6/T038-D4 e 016/T010-A3), e as
duas foram consertadas por `if`, não por composição.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`, `apps/web/src/shared/billing/premium-teaser.tsx`,
`teaser-upgrade.tsx`, `apps/web/src/pages/calcular/calcular-page.tsx`.

Ordem exata dos elementos renderizados hoje, de cima para baixo, tudo centralizado:

| # | Elemento | Texto literal (pt-BR, homologado) |
|---|---|---|
| 1 | Título da gaveta | "Minhas simulações" |
| 2 | Título do teaser (h2, `--fs-lg`) | "Salve suas simulações" |
| 3 | Subtítulo (`--fs-body-sm`, texto suave) | "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." |
| 4 | Faixa de compra (topo com linha divisória) | preço + botão, ver abaixo |
| 5 | Legenda (`--fs-caption`, texto suave) | "A calculadora continua grátis." |

A faixa de compra (4) é: a linha de preço `"Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês"`
como texto pequeno e suave, e ao lado (ou abaixo, quando não cabe) o botão primário **"Assinar Premium"**.
No painel os dois ficam **centralizados**, e a faixa tem uma **linha divisória acima**.

→ **Problema 1 — a ordem contradiz a própria regra escrita.** A faixa de compra foi especificada para entrar
*entre* a nota "continua grátis" e as ações; no que roda, a legenda honesta "A calculadora continua grátis."
cai **abaixo** do botão de compra, isolada sob a linha divisória, virando rodapé de um bloco de venda. Decida
no desenho onde a frase honesta pertence — ela é a metade da verdade que segura o vendedor que não vai comprar.

→ **Problema 2 — o vazio.** O painel tem altura total (100% da tela); o conteúdo tem ~5 elementos curtos.
Hoje tudo fica grudado no topo e sobra meia tela vazia embaixo. Ninguém desenhou o que acontece nesse espaço.

→ **Problema 3 — a descrição da lista some.** No estado de teaser, a frase "Estratégias salvas. Cada uma
recalcula com os preços de hoje quando você abre." **não** é renderizada (foi removida em 016/T010-A1 porque
duplicava a promessa do subtítulo). O painel do não-assinante fica, portanto, com título e nada entre título e
teaser. Confirme se essa é a hierarquia que você quer ver.

→ **Problema 4 — a regra do CTA único é invisível.** Enquanto esta gaveta está aberta, o card de teaser do
seletor de catálogo, que vive na página atrás, é **removido da página**. Quando a gaveta fecha, ele volta — e o
conteúdo atrás pula. Isso precisa ser uma decisão de composição desenhada, não um `if`.

## Conteúdo e dados reais
- Preço mensal: **R$ 15,99/mês**. Anual: **R$ 155,88/ano**, apresentado sempre pelo **equivalente mensal
  R$ 12,99/mês**. O R$ 191,88 (12 × mensal) **nunca** aparece riscado — um "de/por" fabricaria um desconto que
  não existe. A linha inteira é uma só string, não dois campos.
- Botão: "Assinar Premium" — leva à oferta dentro de `/conta`, **não** a um checkout direto (mensal e anual têm
  preços diferentes; disparar a compra de um período que o vendedor não escolheu é escolher por ele). Para quem
  está deslogado, o mesmo botão passa antes pelo sign-in preservando a intenção.
- Não há campos de entrada nesta peça. Nenhum número do vendedor aparece aqui.
- Geometria real do painel: ancorado à **direita**, largura `min(92vw, 26rem)` — ou seja **359px a 390px de
  viewport** e no máximo **416px no desktop** —, altura total, com rolagem própria. O bloco do teaser tem
  largura máxima `min(28rem, 100%)` centralizada, então dentro deste painel ele ocupa a largura inteira.

## Estados obrigatórios
1. **Repouso — deslogado.** Teaser completo, botão "Assinar Premium" ativo. O caminho passa pelo sign-in.
2. **Repouso — logado, nunca assinou** (`status: "none"`). Visualmente idêntico ao anterior; o botão vai direto
   à oferta. Desenhe o par para confirmar que são mesmo iguais — se não devem ser, diga por quê.
3. **Foco por teclado no botão** — anel visível contra o fundo do painel (não contra o fundo da página).
4. **Hover e pressionado** do botão primário.
5. **Verificando o plano.** Hoje, enquanto a resposta do plano não chega, a gaveta **não** mostra o teaser —
   ela mostra o corpo da lista (vazio), e o teaser aparece depois. É um piscar de conteúdo errado. Desenhe o
   estado de espera do painel (esqueleto ou frase curta), ele não existe.
6. **Falha ao verificar o plano.** Uma rede que caiu **não pode** ser desenhada como "você não é Premium".
   Precisa de um estado próprio; o vocabulário honesto já usado no produto é "Não foi possível verificar seu
   plano." + "Tentar novamente".
7. **Premium pausado** (`lapsed`) — **este estado NÃO é o teaser**: a gaveta mostra a lista com o aviso
   "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar,
   renomear, duplicar ou excluir, reative o Premium." Desenhe-o lado a lado com o teaser só para provar que as
   duas superfícies não se confundem.
8. **Offline com teaser na tela** — o botão continua visível (a compra é uma intenção, não uma escrita local),
   mas o painel precisa dizer o que está acontecendo; a frase existente do módulo é "Modo leitura offline".
9. **Fechamento** — como o painel sai e o que acontece com a página atrás (ver Problema 4).

## Viewports
- **Mobile 390px** — obrigatório: é onde a peça mais aparece e onde o painel come 92% da largura. A linha de
  preço e o botão **não cabem lado a lado** nessa largura; desenhe o empilhamento explicitamente.
- **Desktop 1280px** — obrigatório: é o corte do 018, o painel fica em 416px sobre a calculadora de duas
  colunas, e a decisão do vazio vertical (Problema 2) só fica visível aqui.
- **Largura estreita ~430px** — desenhe ao menos o bloco isolado nessa medida. É a faixa em que o layout já
  virou desktop mas a barra lateral ainda come 240px, e é exatamente onde este teaser já transbordou 131px.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto**: ou a pessoa tem Premium, ou vê a oferta inteira, com preço. Nada de lista
  quebrada fingindo que a funcionalidade está ligada, nada de contagem de "3 grátis".
- **Uma única superfície de compra por tela.** Com esta gaveta aberta, nenhuma outra linha de preço/"Assinar"
  pode estar visível — inclusive atrás do escurecimento. Isso é composição, não guarda.
- **Falha de rede nunca é vendida como "não é Premium"** (estado 6).
- **A frase honesta nunca mora dentro de um placeholder** nem num elemento que corte texto: "A calculadora
  continua grátis." precisa de elemento de largura inteira e altura livre.
- **Alvo de toque ≥ 44px** no botão e no fechar da gaveta.
- **Contraste medido contra o fundo real do painel** (que é sobreposto a um fundo escurecido), não contra o
  fundo da página.
- O preço é **um** texto único; nunca um preço "a partir de", nunca desconto fabricado.

## Armadilhas já pagas neste projeto
- **100,5px de transbordo com um botão nascendo fora da viewport** (E6/T028) — a faixa preço+botão é a peça
  exata que causou isso. Ela quebra linha desde sempre por causa desse defeito.
- **131px fora da tela a 426px de largura** (CF-043-UI-03): a largura máxima do bloco não encolhia dentro do
  container. Qualquer largura fixa que você desenhar precisa vir com a instrução de encolher.
- **Texto ocluso passa em teste**: elemento sobreposto ou cortado continua "visível" para o teste automatizado.
  Layout aqui se verifica por caixa, não por texto.
- **Rolagem no eixo vertical que o headless não vê** (016/PR-B): o painel rola sozinho; diga onde a rolagem
  começa e o que fica fixo, se algo ficar.
- **Legenda cortada por sufixo de placeholder** (016/PR-F): frases de honestidade vivem em elementos de largura
  inteira, nunca coladas em campos.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como primeira classe (as duas versões de cada uma):
1. Gaveta em 390px — teaser completo, deslogado (estado 1), com a página atrás visível e escurecida.
2. Gaveta em 1280px — o mesmo, mostrando explicitamente a decisão sobre o vazio vertical e a âncora do CTA.
3. Estados do painel em 390px: verificando o plano, falha ao verificar, offline.
4. Comparativo lado a lado: teaser (sem Premium) × painel "Premium pausado" (com dados), para provar que as
   duas leituras não se confundem.
5. O bloco isolado em ~430px de largura, com anotação de encolhimento.
6. Uma prancheta de composição mostrando a página atrás **com** e **sem** a gaveta, marcando onde a outra
   oferta desaparece e o que ocupa esse lugar.

Reutilize os primitivos existentes, sem criar novos: o painel é o `Sheet` lateral (`tf-dialog--sheet-right`);
o título é o título da gaveta; o bloco é o `tf-premium-teaser` (título / subtítulo / faixa / legenda), com a
faixa `tf-teaser-upgrade` na variante centralizada; o botão é o `tf-btn--primary`; avisos usam `Alert` nos tons
`info`/`danger`; o estado de pausado usa o mesmo `Alert` de tom informativo já usado no produto.

## Perguntas em aberto para o dono
1. **A âncora do CTA**: "Assinar Premium" fica logo abaixo do texto (topo do painel) ou fixado no rodapé do
   painel, sempre à mão? As duas leituras vendem coisas diferentes e ninguém decidiu.
2. **O vazio vertical**: sobra meia tela abaixo do teaser no desktop. Ele fica vazio, ganha uma prova de valor
   (um exemplo do que uma simulação salva mostra), ou o painel encolhe e deixa de ter altura total no estado
   de teaser?
3. **A regra do CTA único**: a oferta deve viver **só** aqui enquanto a gaveta está aberta (é o que o código
   faz hoje, apagando o card atrás), ou a página atrás deve manter o card e a gaveta é que abre sem oferta?
4. **O que a gaveta mostra enquanto o plano é verificado** — hoje ela mostra a lista vazia por um instante e
   depois troca pelo teaser. Esqueleto, painel em branco, ou abrir só depois de saber?
