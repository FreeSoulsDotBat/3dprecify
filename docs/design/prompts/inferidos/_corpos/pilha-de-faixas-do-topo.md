# A região de avisos do topo do shell (quando são DUAS faixas)

## O que desenhar

A faixa de largura total que nasce no alto de **todas** as telas autenticadas do Precifica3D, acima da barra
superior e — no desktop — acima também da coluna do menu lateral. Hoje ela pode receber dois avisos
diferentes: a faixa de **offline** ("o cálculo continua funcionando") e a faixa de **sessão expirada**
("Entrar de novo"). Na maior parte do tempo a região não existe: as duas faixas renderizam `null` e a
altura é 0. O que precisa de desenho é o momento em que **uma** aparece, o momento em que **as duas
aparecem juntas** (offline + 401 é combinação real: o servidor recusa a sessão e a rede cai em seguida), e
o que acontece com o resto do shell — a barra superior, o menu lateral de altura de janela e o conteúdo —
quando o topo do documento é empurrado para baixo. Quem vê isso é o vendedor no meio de um orçamento,
tipicamente com a página rolada até o fim, onde mora "Salvar em Orçamentos".

## Por que este prompt existe

A ficha classifica a região como `PROTOTIPO_PARCIAL`: **uma** das faixas tem desenho, a **região** não. O
protótipo de 2026-07-02 cobre a faixa de offline sozinha e com autoridade forte (§D.2 "faixa discreta em
ciano de info", §E3, §E9 e a coluna offline da matriz §G), e ela já passou por duas rodadas de correção
(`role="status"`/`aria-live`, contraste no tema escuro — 11,96:1 medido no V3). O que ninguém desenhou:
onde as faixas moram quando são duas, qual vem primeiro, o fato de uma ser sticky (z-index 40) e a outra
rolar embora, e como um menu lateral de `height: 100dvh` convive com faixas que empurram o topo.
**O código contraria o desenho do desktop**: no canvas 018 a busca por "offline" dá 0 ocorrências e o
`<nav class="tf-nav tf-nav--sidebar">` nasce como primeiro filho do corpo do shell, sem nada acima dele —
ou seja, o desenho do desktop não prevê faixa alguma sobre o menu, e o produto põe duas.

## O que já existe hoje (não invente do zero — corrija)

As duas faixas são irmãs diretas dentro do shell, nesta ordem, **acima** do corpo da aplicação
(`apps/web/src/app/app-shell.tsx`):

| # | Faixa | Texto literal em pt-BR (não reescreva) | Comportamento de rolagem | Altura aproximada |
|---|-------|----------------------------------------|--------------------------|-------------------|
| 1 | Offline (`offline-banner.tsx`) | "Você está offline. O cálculo continua funcionando." | **rola embora** — sai da tela junto com o conteúdo | ~36–40px (uma linha) |
| 2 | Sessão expirada (`session-expiry-banner.tsx`) | título "Sua sessão expirou" · corpo "Entre de novo para continuar de onde parou." · botão "Entrar de novo" | **sticky no topo**, z-index 40 | ~110–140px (três blocos) |

- A faixa de offline é um bloco centralizado: ícone `info` 18px + texto, fundo `--tf-info-soft`, texto
  `--info-text`, corpo pequeno, peso médio, **sem movimento** (nada deve distrair de "o cálculo continua").
- A faixa de sessão é o primitivo `Alert` no tom `info` (ícone `info` 20px à esquerda, título, corpo e, no
  fim, um botão primário pequeno). O tom é **info e nunca perigo** de propósito: nada foi destruído — a fila
  de sincronização guarda os orçamentos não enviados —, então isso é convite, não alarme.
- → **Problema 1:** a soma das duas pode consumir ~120px do alto sem que ninguém tenha decidido o que fica
  visível. Nenhuma das duas pode ser fechada pelo vendedor.
- → **Problema 2 (desktop):** o menu lateral é uma coluna `sticky top:0` de `height: 100dvh` com o botão de
  recolher no **rodapé do menu**. Empurrada ~120px para baixo pelas faixas, essa coluna passa a terminar
  ~120px abaixo do fim da janela: o botão de recolher (e os últimos itens) saem de alcance. É a classe
  "elemento nascido fora da viewport" que este projeto já pagou duas vezes.
- → **Problema 3:** ao rolar, a faixa de sessão gruda no topo com z-index 40 e passa a cobrir o **topo do
  menu lateral** (logo e primeiros itens), que não tem z-index próprio. Ninguém desenhou essa sobreposição.
- → **Problema 4:** a faixa de offline não é sticky. No instante do 401 o vendedor está no fim da página; a
  faixa de sessão foi feita sticky justamente por isso (media-se 1.746px fora da viewport a 1440px e
  3.608px a 360px antes do conserto). A de offline continua nascendo fora de alcance.
- → **Problema 5 (copy):** o protótipo dizia "Offline — o cálculo continua funcionando"; o produto diz
  "Você está offline. O cálculo continua funcionando." Use **a frase do produto** (é a homologada); só
  registre que as duas autoridades divergem.

## Conteúdo e dados reais

- A região não tem dados numéricos: é 100% texto de sistema. Nenhum valor em R$ aparece aqui.
- Larguras do shell que a região atravessa: menu lateral **240px** expandido, **76px** recolhido; abaixo de
  600px o menu recolhe por necessidade; o interruptor de recolher só existe a partir de 1280px. No mobile
  (≤425px) não há menu lateral — há barra inferior fixa.
- O botão "Entrar de novo" é um link real (leva ao login preservando a tela em que o vendedor estava).
- Estado normal do produto: **nenhuma faixa**. A região tem altura 0 e o menu lateral encosta no pixel 0.
  Desenhe esse estado também — é o que 99% do tempo aparece, e é a régua contra a qual os outros deslocam.

## Estados obrigatórios

1. **Ausente** (online, sessão válida) — altura 0; o topo do shell é a barra superior (mobile) ou o menu
   lateral encostado no topo (desktop). Serve de linha de base.
2. **Só offline** — faixa 1, uma linha, ciano de info, centralizada, largura total. Texto: "Você está
   offline. O cálculo continua funcionando."
3. **Só sessão expirada** — faixa 2, o `Alert` info com "Sua sessão expirou" / "Entre de novo para
   continuar de onde parou." / botão "Entrar de novo".
4. **As duas juntas** — o estado que este prompt existe para resolver. Mostre a pilha completa e o efeito
   sobre a barra superior e sobre o menu lateral.
5. **Rolado** — o mesmo estado 4 com a página rolada: hoje a faixa 1 sumiu, a faixa 2 gruda e cobre o topo
   do menu. Desenhe o que **deveria** acontecer.
6. **Botão "Entrar de novo"**: repouso, hover, foco visível (anel), pressionado — alvo mínimo de 44px de
   altura tocável mesmo sendo o tamanho pequeno do botão.
7. **Offline + sessão expirada com a ação impossível** — offline, o login não funciona (o próprio produto
   já diz noutra tela: "O login precisa de internet"). O desenho precisa de uma resposta visível para isso:
   botão desabilitado com motivo dito, ou ordem/supressão entre as faixas. Ver perguntas ao dono.

## Viewports

- **Mobile 390px** — obrigatório: as faixas nascem aqui e a de sessão tem três blocos de texto que quebram
  em várias linhas; é onde a pilha come mais proporção de tela.
- **Desktop 1280px** — obrigatório: é o primeiro ponto em que o menu lateral de 240px pode ser recolhido
  pelo vendedor. Desenhe **duas variantes**: menu expandido (240px) e menu recolhido (76px).
- **Desktop 1920px** — a largura em que o dono redesenhou as abas no canvas 018; a faixa fica muito larga e
  o texto centralizado vira uma linha solta no meio de um vão enorme. Precisa de decisão de largura máxima.
- **480px** (opcional, uma prancheta) — a faixa 426–599px, em que o menu lateral já existe mas está
  recolhido à força em 76px: é a combinação mais apertada que o produto tem.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de premium**: a faixa de offline afirma que o cálculo continua
  funcionando, e essa é a promessa central do produto. Nada no desenho pode sugerir bloqueio de recurso.
- **Degradação dita, não escondida**: se uma faixa suprimir a outra, o que sumiu precisa continuar
  legível em algum lugar — não pode simplesmente desaparecer.
- **A frase honesta vive em elemento de largura inteira**, nunca truncada e nunca dentro de um placeholder.
- **Sem alarme falso**: sessão expirada é tom de **info**, não de perigo — nada foi perdido.
- **Contraste medido contra o fundo real da faixa** (o ciano suave), nos dois temas; o valor de referência
  já conquistado é 11,96:1 no tema escuro. Não regrida.
- **Alvo tocável ≥44px** para "Entrar de novo".
- **Sem movimento** na faixa de offline (nada de pulsar/deslizar): ela informa, não alarma.
- Nenhuma faixa pode empurrar o menu lateral de forma que o botão de recolher, no rodapé do menu, saia da
  janela.

## Armadilhas já pagas neste projeto

- **Botão nascido fora da viewport** (E6/T028: 100,5px de transbordo, botão fora da tela). Foi exatamente
  isso que tornou a faixa de sessão sticky. A faixa de offline ainda tem o defeito.
- **Coluna que estica com o conteúdo**: o menu lateral já nasceu com o botão de recolher no pixel 2.803 de
  uma página cheia antes de ganhar `height: 100dvh`. Empurrar o topo reintroduz o mesmo sintoma por outra
  porta.
- **Texto ocluso passa em teste**: sobreposição não é propriedade de texto; um elemento coberto por outro
  continua "visível" para asserções de conteúdo. Este desenho precisa mostrar as caixas, não só as frases.
- **Transbordo horizontal**: faixa de largura total com ícone + texto + botão estoura 390px com facilidade.
- **Placeholder que corta a frase honesta** (016): frase de honestidade nunca em elemento estreito.

## Entregável

Pranchetas, tema **escuro como padrão** e tema **claro como cidadão de primeira classe** (as duas versões
de cada prancheta que envolver cor de faixa):

1. Mobile 390px — os quatro estados de conteúdo (ausente · só offline · só sessão · as duas) em coluna.
2. Mobile 390px — o estado rolado, mostrando o que fica preso no topo.
3. Desktop 1280px, menu expandido — as duas faixas juntas, com o menu lateral inteiro visível e o botão de
   recolher dentro da janela.
4. Desktop 1280px, menu recolhido (76px) — mesmo estado.
5. Desktop 1280px — o estado rolado, resolvendo a sobreposição faixa × topo do menu.
6. Desktop 1920px — a decisão de largura do texto na faixa larga.
7. Detalhe: os quatro estados do botão "Entrar de novo" (repouso/hover/foco/pressionado) e o estado em que
   ele é impossível (offline).

Reutilize os primitivos existentes, sem criar novos: a faixa de sessão é o `Alert` no tom `info` (ícone
`info`, título, corpo, ação); a ação é o botão primário no tamanho pequeno; o ícone da faixa de offline é o
mesmo `info` em 18px; a cor de fundo é o token suave de info e o texto é o token de texto de info. Se o
desenho precisar de uma faixa mais compacta que o `Alert`, diga isso explicitamente como variante do
`Alert`, não como componente novo.

## Perguntas em aberto para o dono

1. **Quando as duas aparecem juntas, empilha ou uma suprime a outra?** Offline + sessão expirada é a
   combinação em que o botão "Entrar de novo" **não funciona** (o login exige internet). Empilhar as duas é
   honesto mas soma ~120px; suprimir a de sessão enquanto offline é mais limpo, mas esconde o motivo real
   pelo qual as ações pararam de responder.
2. **A faixa de offline deve virar sticky também?** Hoje ela rola embora — o vendedor no fim da página não
   descobre que está offline. Sticky resolve, ao custo de mais altura permanente.
3. **No desktop, as faixas atravessam por cima do menu lateral ou começam depois dele** (só na coluna de
   conteúdo, à direita)? O canvas 018 desenhou o menu começando no pixel 0 do artboard, o que sugere a
   segunda opção — mas isso nunca foi decidido.
4. **O vendedor pode dispensar alguma das faixas?** Hoje nenhuma das duas tem fechar. Se puder, ela volta a
   aparecer quando?
5. **Existe teto de faixas simultâneas?** Se amanhã entrar um terceiro aviso (plano pausado, cobrança em
   atraso), a região precisa de uma regra de prioridade ou vira uma pilha sem limite.
