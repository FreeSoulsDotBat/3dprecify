# A faixa intermediária: o shell entre 600px e 1023px

## O que desenhar

O quadro do aplicativo (menu lateral + barra de topo + área de conteúdo) nas larguras de tablet e de
janela de navegador meia-tela — de 600px a 1023px. É o mesmo shell que já existe no telefone e no
desktop, mas nessa faixa ele monta uma combinação que ninguém desenhou: o menu lateral **expandido**
de 240px ao lado de uma coluna de conteúdo travada em 460px (a largura do telefone). Quem vive aqui é
o vendedor que abre o Precifica3D no tablet em cima da bancada, ao lado da impressora, ou que deixa o
navegador em meia tela num monitor comum. Ele vê as mesmas quatro telas de sempre — Catálogo, Kits,
Orçamentos, Conta — e a de Calcular, só que num quadro que não foi pensado para essa largura.

## Por que este prompt existe

Nenhuma autoridade de desenho cobre esta faixa. O §H entrega "**todas as telas** (E1–E9) em **mobile
(~390px)** e **desktop**" — dois pontos, sem meio. O §C.5 declara só duas larguras de referência
(460px mobile, 1120px desktop), e é exatamente esse par que o CSS usa: o que existe entre elas é
**interpolação de código**, não decisão de produto. O canvas do 018 tem um único artboard, de 1920px,
e o próprio corte de 1280px é a fronteira declarada dele. A auditoria só encostou no assunto pelo teto
e o item ficou NÃO CORRIGIDO em duas rodadas, com a recomendação final "absorva os resíduos no app" —
ou seja, a decisão foi explicitamente delegada ao código.

## O que já existe hoje (não invente do zero — corrija)

O quadro, de fora para dentro, na faixa:

| Peça | Comportamento hoje | Observação |
|---|---|---|
| Menu lateral | **Expandido, 240px**, ícone + rótulo, fundo de cartão, borda à direita | Fixo no topo, altura da janela, rola sozinho |
| Botão "Recolher" | **Não existe nesta faixa** — só aparece a partir de 1280px | → o vendedor não tem como devolver os 164px |
| Barra de topo | Começa **depois** do menu, logo horizontal completo (40px de altura) à esquerda, ações à direita | E-mail da conta só aparece a partir de 640px |
| Coluna de conteúdo | `max-width: 460px`, **centralizada** na área restante (`mx-auto`) | → a ficha da auditoria diz "encostada à esquerda"; **está errado, ela é centralizada** |
| Goteira da área principal | 32px de cada lado (a goteira "desktop") | Mobile usa 16px |
| Composição mestre-detalhe | **Desligada** — as telas do 018 só existem a partir de 1280px | Aqui o card do catálogo **navega**, não seleciona |
| Barra inferior de abas | Não existe (só até 425px) | |

O número que decide este desenho — a **descontinuidade dos 600px**:

| Largura da janela | Menu | Largura útil do conteúdo | Sobra vazia |
|---|---|---|---|
| 390px (telefone) | nenhum | **358px** | 0 |
| 599px | rail de 76px | **459px** | 0 |
| **600px** | **expandido, 240px** | **296px** | 0 |
| 768px (tablet retrato) | 240px | 460px (teto) | ~4px |
| 834px | 240px | 460px (teto) | ~70px (35 de cada lado) |
| 1023px | 240px | 460px (teto) | **~259px** — 64% da área usada |
| 1024px | 240px | 719px (teto sobe para 1120) | 0 |

→ **Ao ganhar 1 pixel de largura, a janela perde 163px de conteúdo.** De 599px para 600px o menu
deixa de ser um rail de 76px e vira uma coluna de 240px, e a coluna de trabalho cai de 459px para
296px — 62px **mais estreita do que num telefone de 390px**. Esse é o pior ponto da faixa e é
puramente acidental: os dois limiares (425px do mobile, 599px do rail forçado, 1024px do teto de
conteúdo, 1280px do mestre-detalhe) foram decididos em momentos diferentes e nunca conferidos juntos.

→ No outro extremo, a 1023px, sobram 259px de vazio simétrico ao redor de uma coluna de telefone
esticada ao lado de um menu grande demais. É a mesma classe de desperdício que a homologação do 016
mediu a 1440px ("~39% usado") antes de criar a coluna larga.

## Conteúdo e dados reais

- Itens do menu, na ordem e com o texto exato: **"Calcular"**, **"Catálogo"**, **"Kits"**,
  **"Orçamentos"**, **"Conta"**. Rótulo de acessibilidade do bloco: "Navegação principal". O item da
  seção atual tem fundo de realce (accent suave).
- Botão do rodapé do menu (hoje só ≥1280px): diz o que **vai acontecer**, não o estado — "Recolher"
  quando expandido, "Expandir" quando recolhido.
- Barra de topo: logo horizontal completo, botão de tema, e-mail da conta e "Sair". O e-mail é
  truncado com reticências a partir de 220px de largura.
- Banners do quadro, com o texto literal (aparecem acima de tudo, empurrando o conteúdo):
  - offline: "Você está offline. O cálculo continua funcionando."
  - fila pendente: "Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos
    quando você voltar a ficar online."
  - sessão: título "Sua sessão expirou", corpo "Entre de novo para continuar de onde parou.", ação
    "Entrar de novo".
- Conteúdo real para preencher as pranchetas (não use texto genérico): a lista de **Orçamentos**, com
  subtítulo "O que você cotou, com a data. Os valores ficam congelados como estavam no dia." e linhas
  com valores de verdade — R$ 16,16 · R$ 24,24 · R$ 21,01 · R$ 1.234,56 para testar o número longo.
- Alturas fixas: barra de topo 56px; alvo mínimo de toque 44px; grade de 4px.

## Estados obrigatórios

- **Repouso** na faixa, com a seção atual realçada no menu.
- **Foco por teclado** num item do menu — o menu é um conjunto só: as setas movem entre os itens e
  existe um único ponto de parada de tabulação. O anel de foco tem de ser visível sobre o fundo do
  menu, que é o fundo de cartão e não o fundo da página.
- **Passagem do mouse** e **pressionado** num item do menu.
- **Menu recolhido** (rail de 76px, só ícones): é o que acontece abaixo de 600px hoje. Desenhe-o
  também dentro da faixa, porque é a alternativa mais óbvia para a descontinuidade. O rótulo **some da
  tela mas continua sendo lido em voz alta** — nunca desenhe como se o nome deixasse de existir; e o
  nome volta ao mouse como dica.
- **Rolagem longa**: o menu fica preso no topo com a altura da janela e rola por dentro; o conteúdo
  rola por fora. Mostre uma prancheta com a página comprida para provar que o rodapé do menu fica
  alcançável sem rolar a página inteira.
- **Offline** e **sessão expirada**: o banner ocupa a largura toda acima do quadro; mostre como ele
  convive com o menu à esquerda.
- **Lista vazia** e **carregando** de uma das telas dentro da coluna estreita de 296px — é onde o
  texto quebra pior.
- **Valor grande**: R$ 1.234,56 e um nome de produto longo na coluna de 296px.

## Viewports

Só desktop-shell: esta peça **não existe no telefone** (abaixo de 426px não há menu lateral nenhum), e
acima de 1280px ela é substituída pela composição mestre-detalhe do 018, que já tem desenho. Desenhe:

- **599px e 600px lado a lado** — o par que expõe a descontinuidade. É a prancheta mais importante.
- **768px** (tablet em retrato) — a largura mais comum da faixa.
- **1023px** — o pior desperdício, imediatamente antes do teto de conteúdo subir.

## Regras que o desenho não pode quebrar

- **Zero rolagem horizontal em qualquer largura da faixa**, medida nos dois eixos.
- A coluna de trabalho **nunca pode ser mais estreita do que num telefone de 390px**. Se a solução for
  manter o menu expandido a 600px, ela precisa render pelo menos 358px de conteúdo.
- Alvos de toque de 44px no menu e na barra de topo — no tablet o dedo é o ponteiro.
- O menu não é conteúdo: se ele ocupa mais de um terço da largura da janela, está errado.
- Contraste medido contra o fundo real de cada peça (menu = fundo de cartão; conteúdo = fundo base).
- O rótulo escondido continua existindo para leitor de tela — o desenho pode ocultar visualmente, mas
  não pode ser desenhado como "sem nome".
- Nada de nova primitiva: o menu, a barra de topo e os cartões já existem.

## Armadilhas já pagas neste projeto

- **131px de transbordo medidos** na faixa logo abaixo desta (426–599px) com o menu expandido — a
  medição acusou a página inteira, não um elemento. Foi o que obrigou o rail forçado. Repetir o menu
  de 240px sobre uma coluna estreita repete o defeito.
- **O headless não enxerga barra de rolagem clássica**: transbordo vertical no tablet é invisível a
  teste automático. Desenhe contando que a régua é o olho.
- **Texto ocluso passa em teste**: um rótulo cortado pelo menu ou pela borda da coluna continua
  "visível" para o teste. As colisões desta faixa só aparecem na imagem.
- **~39% da área usada a 1440px** foi o que gerou a coluna larga do 016; a faixa 600–1023 nunca
  recebeu o mesmo tratamento e hoje chega a 64%.
- **Frase honesta nunca dentro de campo vazio**: os textos de offline/sessão vivem em elementos de
  largura inteira, e nessa faixa a largura inteira é menor do que se imagina.

## Entregável

Pranchetas em tema **escuro (padrão)** e as duas mais decisivas — o par 599/600 e a de 1023px —
repetidas em tema **claro**. Em cada uma, o quadro completo: menu, barra de topo, banners quando o
estado pedir, e uma tela real dentro (use Orçamentos com dados de verdade). Reaproveite os primitivos
existentes: o cartão para o painel do menu e para as linhas da lista, o botão fantasma para "Recolher"
e para o botão de tema, o rótulo de estado para o banner de offline, o preço grande para o valor da
linha. Marque na prancheta, com cota numérica, a largura do menu, a largura da coluna de conteúdo e a
sobra de cada lado — é a cota que resolve esta peça, não a estética.

## Perguntas em aberto para o dono

1. **Na faixa 600–1023px o menu deve nascer recolhido (rail de 76px) ou expandido?** Recolher devolve
   164px de conteúdo e elimina a descontinuidade dos 600px; expandir mostra os rótulos. Não há
   decisão registrada.
2. **Deve existir o botão "Recolher"/"Expandir" nesta faixa?** Hoje ele é exclusivo de ≥1280px, onde
   recolher é preferência. Aqui seria espaço — e se o menu nascer recolhido, expandir pode voltar a
   apertar o conteúdo.
3. **A coluna de conteúdo deve continuar travada em 460px até 1024px, ou crescer junto com a janela?**
   Se crescer, a partir de que largura e com que teto?
4. **Vale antecipar alguma composição de duas colunas antes dos 1280px** (por exemplo, lista + ficha
   mais estreita a partir de 1024px), ou a faixa toda é coluna única por decisão?
5. **O tablet em paisagem (1024–1279px) fica com o desenho desta faixa ou com o do desktop?** Hoje ele
   fica no meio: coluna larga de 1120px, mas sem mestre-detalhe.
