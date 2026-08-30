# Teaser do "Usar do catálogo" na calculadora — com o controle trancado à vista

## O que desenhar
O bloco que o vendedor **grátis ou deslogado** encontra na aba **Calcular**, no lugar exato onde o assinante
vê o cartão "Usar do catálogo" (dois seletores que preenchem os campos do cálculo a partir do catálogo
salvo). É a tela central do produto — a primeira que abre e a única que o usuário grátis usa todo dia. O
bloco aparece logo abaixo da frase de promessa e do botão "Meus cenários", e imediatamente **acima** do
formulário de custo. Ele precisa dizer, na mesma respiração: este atalho existe, ele é Premium, e o cálculo
que você veio fazer continua grátis logo abaixo.

## Por que este prompt existe
O desenho de 2026-07-02 (`claude-design-prototype-fixes.md`, item 1) especificou esta superfície com
precisão: **substituir** os selects por um "card compacto de teaser" com a frase "Preencha direto do seu
catálogo — recurso Premium" e um **link discreto** "Ver Premium". O que foi construído inverteu a decisão:
mostra o **controle morto** (um botão secundário desabilitado, rótulo "Usar do catálogo") **abaixo** de um
CTA primário de compra com preço real. Ninguém ratificou a inversão — o canvas do 018 não cobre Calcular
(o artboard é um ponteiro para um arquivo que **não existe** no repositório). Logo: o arranjo "botão morto
sob botão de compra" é inferência de IA, não desenho. É isso que este prompt vem resolver.

## O que já existe hoje (não invente do zero — corrija)
Um `Card` (padding médio) contendo, **nesta ordem fixa** (o componente é fechado: quatro elementos + a
exceção nomeada):

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título (h2, `--fs-lg`, centrado) | "Preencha o cálculo com um toque" |
| 2 | Subtítulo (`--fs-body-sm`, mudo) | "O catálogo guarda seus filamentos e impressoras salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis." |
| 3 | Faixa de preço + CTA (topo com filete `--border-subtle`, centrada, com quebra de linha permitida) | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário "Assinar Premium" |
| 4 | Legenda (`--fs-caption`, muda) | "O cálculo de custo e markup continua grátis." |
| 5 | **A exceção**: bloco de largura 100%, colado abaixo da legenda | botão **secundário desabilitado** com o rótulo "Usar do catálogo" |

O bloco inteiro é centrado, com `max-width` de 448px, dentro de um cartão que a partir de 1024px pode ter
até 1120px de largura.

→ **Problema 1 — dois botões empilhados, e o de baixo é morto.** O último elemento visual da peça é um
controle que não faz nada; ele compete visualmente com "Assinar Premium" e é o que o olho pousa por último.
→ **Problema 2 — o controle trancado não está onde o controle real vive.** No Premium, "Usar do catálogo" é
um cartão com dois seletores rotulados; aqui virou um único botão genérico, deslocado para o rodapé do
teaser. Quem vê isso não aprende o que vai ganhar.
→ **Problema 3 — o botão desabilitado não explica nada.** Não tem cadeado, não tem dica, e um botão
desabilitado não recebe foco de teclado: para leitor de tela e para navegação por teclado, ele simplesmente
não existe.
→ **Problema 4 — o bloco de 448px centrado dentro de um cartão de até 1120px** deixa uma faixa vazia larga
nos dois lados no desktop, sem que nada ocupe o espaço.

## Conteúdo e dados reais
- **Preço**: mensal `R$ 15,99/mês`; anual `R$ 155,88/ano` exibido **apenas** como equivalente mensal
  `equivalente a R$ 12,99/mês`. O R$ 191,88 **nunca** aparece riscado — não existe desconto "de/por".
- **CTA**: "Assinar Premium" leva à oferta dentro de `/conta` (nunca direto ao checkout: mensal e anual são
  escolhas do vendedor). Deslogado, o mesmo botão passa pelo sign-in preservando a intenção — **o rótulo e
  a copy não mudam** entre deslogado e grátis.
- **O que o controle trancado destrancaria** (o cartão Premium real, para você desenhar a promessa com
  fidelidade): rótulo de seção "Usar do catálogo"; dica "Preenche os campos com o item salvo — você ainda
  pode editar tudo."; dois campos lado a lado — "Filamento salvo" e "Impressora salva" — cada um um seletor
  com o placeholder "Escolher…" e nomes reais de itens (ex.: "PLA Azul", "Ender 3").
- **Contexto imediato acima** (já existe, não redesenhar, mas compor com): a promessa da primeira dobra,
  centrada — "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem
  parte do Premium." O teaser não pode repetir essa frase com outras palavras.
- **Contexto imediato abaixo**: os campos de custo do cálculo (gramas, tempo, energia…), sempre livres.

## Estados obrigatórios
1. **Repouso, grátis logado** — os cinco elementos acima; é o estado principal.
2. **Repouso, deslogado** — visualmente idêntico; só o destino do CTA muda. Desenhe-o para provar que a copy
   não muda (e diga isso na prancheta).
3. **Foco de teclado no "Assinar Premium"** — anel de foco visível contra o fundo do cartão.
4. **Hover / pressionado do "Assinar Premium"**.
5. **Controle trancado (o estado que este prompt existe para resolver)** — mostre o que ele mostra: o rótulo
   "Usar do catálogo", o sinal de que está trancado, e por quê. Se a sua solução mantiver um controle
   visível, ele **não pode** ler como um segundo botão clicável.
6. **Ausente por sobreposição** — com a folha "Meus cenários" aberta, o teaser some (dois CTAs de compra na
   mesma tela já foi defeito uma vez). Basta indicar na anotação, não precisa prancheta.
7. **Estado vizinho — falha de leitura do catálogo (assinante)**: cartão com alerta de perigo
   "Não foi possível carregar seus itens salvos agora." + botão secundário "Tentar novamente". Desenhe-o
   como referência de contraste: **falha de rede nunca pode parecer "você não é Premium"**.
8. **Premium pausado** — hoje esta peça **não** aparece para quem está pausado (esse usuário continua vendo
   o seletor real, porque os itens salvos seguem utilizáveis no cálculo). Não desenhe teaser para pausado;
   registre a regra na prancheta.

## Viewports
- **390px (obrigatório)** — é onde o produto vive. O cartão ocupa a largura da coluna (máx. 460px); o preço
  e o "Assinar Premium" **não cabem lado a lado** e quebram em duas linhas.
- **1280px** — a página da calculadora é coluna única e vai até 1120px de largura; o bloco de teaser fica
  centrado. Resolva a faixa vazia dos lados: ou o bloco ganha uma composição horizontal (promessa à
  esquerda, controle trancado à direita), ou o cartão deixa de ser largo aqui. Diga qual escolheu e por quê.
- **Faixa 426–600px** — anote o comportamento: já houve 131px de conteúdo fora da viewport quando o bloco
  reivindicava 448px numa coluna menor. O bloco tem de encolher, nunca empurrar.

## Regras que o desenho não pode quebrar
- **Freemium é binário e honesto**: ou o recurso é Premium, ou é grátis. Nada de "amostra grátis" ou
  contador de usos.
- **A frase honesta "O cálculo de custo e markup continua grátis." não pode ser cortada, virar tooltip nem
  viver dentro de placeholder** — ela mora em elemento de largura total, sempre inteira.
- **Preço sempre com procedência**: R$ 15,99/mês e o equivalente anual de R$ 12,99/mês, juntos, sem preço
  riscado.
- **Falha de rede nunca é vendida como falta de Premium** (regra 7 acima).
- **Alvo tocável ≥ 44px** para qualquer coisa clicável; contraste medido contra o fundo real do cartão, não
  contra o fundo da página.
- **O elemento desabilitado ainda precisa ser legível** — desabilitado não é invisível; mas também não pode
  convidar ao clique.
- O contrato do teaser é fechado: **título, subtítulo, preço+CTA, legenda** nesta ordem. Se o seu desenho
  precisar mudar a ordem ou reposicionar a exceção, marque isso explicitamente como proposta de mudança de
  contrato — não como detalhe visual.

## Armadilhas já pagas neste projeto
- Um botão de compra **nascendo fora da viewport**: 100,5px de transbordo horizontal medido a 390px. Qualquer
  linha com preço + botão tem de quebrar antes de estourar.
- Um bloco com `max-width` fixo que **não encolhe** dentro de coluna estreita: 131px fora da tela a 426px.
- Texto que passa em teste automatizado e está **ocluso ou cortado na imagem** — homologa-se por geometria,
  não por presença de string.
- Frase honesta que só aparecia como sufixo de placeholder e era **cortada** no campo.
- Dois CTAs de compra visíveis ao mesmo tempo na mesma tela (o teaser atrás de uma folha aberta).

## Entregável
Pranchetas, tema **escuro** (padrão) e **claro** (first-class, não um "modo alternativo"):
1. 390px — repouso, grátis logado (a peça inteira, dentro do cartão, com a frase da primeira dobra acima e o
   primeiro campo do formulário abaixo, para provar o encaixe).
2. 390px — deslogado (idêntica; anotar o único delta).
3. 390px — detalhe ampliado do **controle trancado**, com foco/hover/pressionado do "Assinar Premium".
4. 1280px — a composição desktop resolvida.
5. 390px — o vizinho de falha de leitura ("Não foi possível carregar seus itens salvos agora." +
   "Tentar novamente"), como referência de contraste.
6. 390px — o cartão Premium real ("Usar do catálogo" com os dois seletores), como referência do que é
   prometido.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o cartão padrão com padding médio; o CTA
é o botão primário; o controle trancado parte do botão secundário em estado desabilitado (ou, se você propor
outra forma, use campo/seletor desabilitado + ícone de cadeado do conjunto de ícones existente); a falha usa
o alerta em tom de perigo com botão secundário pequeno; a faixa de preço usa a tipografia de legenda com o
filete sutil já definido.

## Perguntas em aberto para o dono
1. **Qual decisão vale?** O desenho de 2026-07-02 mandava *esconder* o controle e oferecer um **link
   discreto** "Ver Premium"; o código mostra o **controle morto + CTA de compra com preço**. São duas
   estratégias opostas de conversão e nenhuma foi ratificada depois da inversão. Qual fica?
2. Se o controle trancado fica: ele deve aparecer **no lugar onde o seletor real vive** (acima da promessa,
   com a forma dos dois campos "Filamento salvo" / "Impressora salva") em vez de abaixo do botão de compra?
3. O controle trancado deve mostrar a **forma do recurso** (dois seletores desabilitados, com nomes de
   exemplo) ou continuar como um único botão genérico?
4. Clicar/tocar no controle trancado deve fazer alguma coisa (levar à oferta, abrir explicação) ou continuar
   inerte? Hoje é inerte e invisível ao teclado.
5. No desktop (até 1120px), o teaser deve ganhar uma composição de duas colunas ou o cartão deve ficar
   estreito e centrado como no mobile?
