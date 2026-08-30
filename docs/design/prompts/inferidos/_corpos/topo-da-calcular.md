# Topo da Calcular — título, promessa freemium e a porta “Minhas simulações”

## O que desenhar

A primeira dobra da aba **Calcular**, a tela que abre o app e onde o vendedor de peças 3D passa a
maior parte do tempo. São três elementos empilhados acima do primeiro cartão de campos: o título da
página, a frase que diz o que é grátis e o que é Premium, e a porta de entrada para as simulações
salvas. É o que a pessoa lê nos primeiros dois segundos — antes de digitar qualquer número, antes de
ver preço nenhum. Abaixo desse bloco vêm, condicionalmente, a barra da simulação carregada, avisos
informativos, o resumo de kit, o teaser Premium e só então os cartões de custo/markup.

## Por que este prompt existe

Este topo nunca foi desenhado: foi montado a partir de requisito textual. O protótipo de 2026-07-02
(§E3, `CalculatorScreen.jsx`) desenhava outra coisa — uma `TopBar` com logo à esquerda, título e dois
IconButtons, e a frase freemium no **rodapé** da tela. Em 015/A8 o dono mediu que essa frase vivia a
3.413px de 3.529 (97% da altura, 4,6 telas de rolagem a 360px) e mandou subi-la para a primeira
dobra — decisão medida, correta, e **só de posição: a forma nunca foi desenhada**. Hoje ela é uma
legenda cinza de 12px. Pior: o canvas 018 do dono desenha o cabeçalho das quatro abas irmãs
(Catálogo · Kits · Orçamentos · Conta) como `tf-page-header` **alinhado à esquerda**, com título +
descrição em `max-width:760px` e a ação primária na **direita da mesma linha**. A Calcular contraria
essa convenção em duas frentes: centraliza o título e joga a porta numa linha própria abaixo.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo (`apps/web/src/pages/calcular/calcular-page.tsx`):

| # | Elemento | Como está hoje | Texto literal |
|---|---|---|---|
| 1 | Título `h1` | `tf-page-header` + modificador `--center`, `font-size: var(--fs-lg)`, **centralizado**, sem descrição | “Calcular preço” |
| 2 | Promessa freemium | parágrafo solto, `--fs-caption` (12px), cor `--text-muted`, centralizado | “Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.” |
| 3 | Porta das simulações | linha própria `flex justify-end`, botão **ghost sm** com ícone `boxes` 16px | “Minhas simulações” |

→ **Problema 1 — hierarquia invertida.** A frase mais importante do produto é o **menor e mais claro**
texto da dobra (12px, `--text-muted`), enquanto “Calcular preço” — que o vendedor já sabe, porque a
aba está marcada na navegação — é o maior. O desenho precisa resolver quem é o protagonista da dobra.

→ **Problema 2 — a porta não pertence a essa região visual.** “Minhas simulações” é navegação, não
uma ação do formulário. Hoje flutua sozinha entre o título e o primeiro cartão, num alinhamento à
direita que não conversa com nada. O canvas 018 já resolveu isso nas abas irmãs: título à esquerda,
ação na direita da mesma linha.

→ **Problema 3 — centralização isolada.** `tf-page-header--center` existe **só** para esta tela. Ou o
desenho justifica por que a Calcular é a exceção, ou alinha à esquerda como as outras quatro.

→ **Problema 4 — o `h1` não tem descrição.** As abas irmãs têm `tf-page-header__desc`. Aqui a
promessa freemium ocupa esse lugar sem ser esse elemento — mesmo papel, forma diferente.

## Conteúdo e dados reais

- **Título:** “Calcular preço”. É `h1`, é o único heading de nível 1 da página e recebe **foco
  programático** ao navegar entre abas (leitores de tela anunciam a seção nova) — precisa de um anel
  de foco visível quando alcançado pelo teclado, e nada visível no foco programático.
- **Promessa freemium (texto homologado, não parafrasear):** “Calcular custo e markup é grátis, sem
  limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.” São **duas afirmações
  numa frase**: o que é grátis e o que é pago. As duas metades são verdade e nenhuma pode sumir.
- **Porta:** “Minhas simulações”, ícone de caixas, **sempre visível e sempre habilitada** — inclusive
  para quem está deslogado ou no plano grátis. É a porta honesta: quem clica sem Premium vê a oferta
  dentro da folha, não uma porta trancada nem uma porta invisível.
- **O que vem logo abaixo do bloco** (não é objeto deste desenho, mas define o espaço até o primeiro
  cartão): barra de contexto da simulação reaberta, avisos `info`, resumo de kit e o teaser Premium
  “Preencha o cálculo com um toque” com a legenda “O cálculo de custo e markup continua grátis.”
  Desenhe o topo sabendo que **frases sobre grátis/Premium podem aparecer duas vezes na mesma dobra**
  quando o teaser está presente — o desenho precisa evitar que soem como a mesma coisa repetida.

## Estados obrigatórios

1. **Repouso, plano grátis / deslogado** — os três elementos, porta habilitada.
2. **Repouso, Premium ativo** — idêntico; a promessa freemium **continua na tela** (ela também explica
   o que a assinatura cobre). Se o desenho achar que ela deve mudar para quem já assina, isso é
   pergunta ao dono, não decisão do desenho.
3. **Foco de teclado no título** — anel visível no `h1` (alvo de foco na troca de aba).
4. **Porta: repouso / hover / foco / pressionado** — os quatro estados do botão ghost, alvo ≥44px de
   altura clicável mesmo em tamanho `sm`.
5. **Simulação carregada** — logo abaixo do bloco entra a barra de contexto com o nome da simulação;
   desenhe como o topo convive com ela (espaçamento e continuidade visual), não a barra em si.
6. **Premium pausado (`lapsed`) e offline** — o topo **não muda**: a porta continua aberta e a leitura
   continua permitida; quem bloqueia escrita é a folha. Mostre essa prancheta justamente para provar
   que nada aqui some — nunca vender falha de rede como “não é premium”.
7. **Título longo/quebra** — o `h1` quebra em qualquer ponto (`overflow-wrap: anywhere`) porque em
   outras telas ele carrega nome de registro. Aqui o texto é fixo, mas o desenho não pode depender de
   uma linha só.

## Viewports

- **Mobile 390px** — obrigatório: é a superfície principal e a dobra medida em 015/A8. A largura útil
  do corpo é ~460px no máximo, coluna única.
- **Desktop 1280px** — obrigatório: é o corte do 018, e é onde a divergência com as quatro abas irmãs
  aparece. A partir de 1024px o corpo da calculadora se alarga para o `--content-max` (~1120px) e os
  campos viram duas colunas — o topo precisa parecer o cabeçalho dessa largura maior, não um bloco de
  460px centralizado num vazio.
- **Desktop 1920px** opcional, só se a solução mudar de forma acima de 1280px.

## Regras que o desenho não pode quebrar

- **Freemium é binário e dito na cara.** Grátis é grátis sem limite; Premium é Premium. Nada de
  “experimente”, “desbloqueie” ou promessa que não se cumpre.
- **A frase honesta nunca vive em placeholder nem em elemento que pode ser cortado.** Ela é conteúdo
  de largura total; se não couber, quebra em duas linhas — nunca reticências.
- **A porta “Minhas simulações” fica visível para todo mundo.** Esconder a porta de quem não assina é
  o oposto da honestidade; trancar com cadeado sem explicar, também.
- **Contraste medido contra o fundo real**, nos dois temas. `--text-muted` a 12px é justamente o que
  está em xeque aqui: se a frase continuar em muted, prove que o contraste passa; se subir de peso,
  diga qual token usa.
- **Alvo de toque ≥44px** para a porta, mesmo com o botão em tamanho `sm`.
- **Zero rolagem horizontal em 390px**, medida nos dois eixos.

## Armadilhas já pagas neste projeto

- **Rolagem horizontal medida, não olhada** — em 016/PR-B um item vazou no eixo vertical e o headless
  não viu a barra clássica. Qualquer solução que aproxime título e ação numa mesma linha precisa
  provar que a 390px ela empilha em vez de espremer.
- **Texto ocluso passa em teste** — `toBeVisible` aprova elemento totalmente sobreposto. A frase
  freemium é exatamente o tipo de elemento que “existe” e ninguém lê. O desenho precisa dar a ela um
  lugar que não dependa de fé.
- **Sufixo cortado em elemento estreito** (016/PR-F): frase honesta em caixa apertada some pela
  direita. Duas linhas confortáveis valem mais que uma linha elegante que corta.
- **Dois CTAs de compra na mesma tela** (E6/T038-D4 e 016/T010-A3, a mesma classe duas vezes): se o
  topo ganhar qualquer chamada para o Premium, ela vai coexistir com o teaser logo abaixo. Desenhe
  contando com essa vizinhança.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. Mobile 390px — repouso, plano grátis.
2. Mobile 390px — com simulação carregada (mostrando o encontro com a barra de contexto abaixo).
3. Desktop 1280px — repouso, com o bloco na largura real do conteúdo.
4. Desktop 1280px — hover/foco na porta “Minhas simulações”.
5. Uma prancheta de comparação lado a lado: **o topo de Orçamentos (convenção 018)** vs. **o topo da
   Calcular proposto**, para o dono julgar se a Calcular vira exceção ou entra na convenção.

Reutilize os primitivos existentes, sem criar novos: `tf-page-header` + `tf-page-header__title` para o
`h1` (e `tf-page-header__desc` se a promessa passar a ocupar esse papel), `tf-btn` com a variante
fantasma em tamanho pequeno para “Minhas simulações”, e o ícone de caixas já usado. Se a promessa
freemium precisar de tratamento próprio (fundo, borda, peso), descreva-o com os tokens existentes e
diga qual primitivo está sendo estendido — não invente um componente novo sem dizer.

## Perguntas em aberto para o dono

1. **A Calcular entra na convenção 018 (título à esquerda + ação na direita da mesma linha) ou fica
   deliberadamente centralizada como exceção?** Isso muda o desenho inteiro e é decisão sua — o
   modificador `--center` existe só para esta tela.
2. **A promessa freemium sobe para `tf-page-header__desc`** (descrição normal da página, mesmo lugar
   das abas irmãs) **ou vira um elemento de destaque próprio** acima do formulário? Você mandou ela
   subir para a primeira dobra em 015/A8, mas a forma nunca foi decidida.
3. **Quem já assina Premium continua lendo a frase?** Hoje sim, sempre. Ela é meia verdade útil para
   o assinante (“marketplaces, salvar e exportar fazem parte do Premium” = o que você já tem) e pode
   soar como oferta repetida.
4. **“Minhas simulações” pertence ao topo da Calcular ou à navegação do app?** É a única aba que
   carrega uma porta de navegação dentro do próprio conteúdo.
