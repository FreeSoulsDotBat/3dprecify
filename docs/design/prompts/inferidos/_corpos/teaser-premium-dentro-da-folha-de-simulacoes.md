# Porta honesta do Premium dentro da folha "Minhas simulações"

## O que desenhar

O painel lateral "Minhas simulações" é aberto pela calculadora (botão no cabeçalho da tela Calcular:
ícone `boxes` + "Minhas simulações"). Ele é visível para TODO MUNDO — inclusive quem nunca pagou e quem
nem entrou. Para o vendedor grátis ou deslogado, essa MESMA folha não mostra lista nenhuma: o conteúdo
inteiro vira uma porta de venda honesta — título, promessa, linha de preço, "Assinar Premium" e a legenda
que garante que a calculadora continua grátis. É a vitrine mais importante da funcionalidade de
Simulações, e ela vive espremida dentro de um painel deslizante à direita, sobre a calculadora que o
vendedor estava usando. Desenhe esse painel inteiro — a folha e o bloco de venda dentro dela.

## Por que este prompt existe

O bloco de venda foi desenhado no canvas 018, mas só para PÁGINAS de aba a 1920px: dentro de um `tf-card`
com padding 56/40 e com um ícone (troféu/relógio, 26px) acima do título. Nada disso existe aqui. O
componente construído é um contrato fechado de 4 elementos, SEM ícone e SEM card, e o canvas 018 não cobre
nem Calcular nem Simulações — logo, ninguém desenhou como esse bloco se comporta dentro de um painel
lateral de ~416px de largura, nem a 390px. Foi inferido também: a supressão condicional do subtítulo da
folha e a ausência de qualquer amostra do que o Premium destrava aqui.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo, dentro da folha (`SheetContent`, ancorada à DIREITA, largura
`min(92vw, 26rem)` = no máximo **416px** — a mesma no mobile e no 1920, ocupando a altura toda da tela):

| Elemento | Texto literal hoje | Observação |
| --- | --- | --- |
| Título da folha | "Minhas simulações" | maiúsculas, fonte de título, com o "X" de fechar (44×44px) no canto |
| Subtítulo da folha | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | → **NÃO renderiza para grátis/deslogado** (supressão da correção 016/T010-A1, porque repetia a promessa do subtítulo do teaser logo abaixo) |
| Título do teaser | "Salve suas simulações" | texto aprovado pelo dono, não parafrasear |
| Subtítulo do teaser | "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." | texto EXATO homologado (016 US1-AC5) |
| Linha de preço | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" | tamanho de legenda, cor apagada, sobre um filete separador; quebra em duas linhas quando não cabe |
| Botão | "Assinar Premium" | primário; deslogado passa por entrar antes de chegar na oferta |
| Legenda final | "A calculadora continua grátis." | tamanho de legenda, cor apagada |

Tudo centralizado, largura máxima `min(28rem, 100%)`, espaçamento uniforme entre os quatro elementos.

→ **Problema 1:** sem ícone e sem card, o bloco fica como texto solto no meio de um painel alto e vazio —
o vendedor grátis vê um painel de altura inteira com um punhado de linhas centralizadas no topo.
→ **Problema 2:** não há NENHUMA amostra do que o Premium destrava. A folha promete "reabrir e comparar"
e mostra zero exemplo de como uma simulação salva se parece.
→ **Problema 3:** o botão "Assinar Premium" fica lado a lado com a linha de preço quando cabe, e cai para
baixo quando não cabe — a hierarquia muda sozinha conforme o texto, sem ninguém ter desenhado as duas.
→ **Problema 4 (buraco real de estado):** a folha só decide entre teaser e lista depois que o plano
carrega. Enquanto carrega, um vendedor grátis vê a LISTA (spinner, depois vazio/erro) e só então a porta
aparece. E se a verificação do plano falhar, não existe estado nenhum aqui — o Kits já tem as frases
"Verificando seu plano…" e "Não foi possível verificar seu plano." + "Tentar novamente"; Simulações não.

## Conteúdo e dados reais

- Preços verdadeiros e de fonte única: mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, apresentado
  apenas pelo equivalente **R$ 12,99/mês**. **R$ 191,88 nunca aparece riscado** — não existe "de/por".
- Destinos: assinar leva à oferta dentro de Conta (`/conta?assinar=1`), nunca direto a um checkout —
  mensal e anual têm preços diferentes e a escolha é do vendedor. Deslogado passa pelo entrar
  preservando a intenção (volta para a oferta, não para a home).
- O que a lista mostraria se o vendedor fosse Premium (útil como base de uma amostra, se o dono aprovar):
  cartões com nome da simulação (uma linha, com reticências), nota opcional (2 linhas, com marcador de
  corte), e "Atualizado há 2 dias" — NUNCA uma data-alegação. Acima da lista, um campo de busca com
  placeholder "Buscar por nome…".
- Nada nesta peça mostra dinheiro calculado. Se a amostra for aprovada, o número plausível de um preço
  sugerido nesta base é **R$ 24,24**.

## Estados obrigatórios

1. **Deslogado (repouso)** — os 4 elementos acima; o botão leva a entrar e depois à oferta. Sem subtítulo
   da folha.
2. **Grátis / nunca assinou (repouso)** — visualmente idêntico ao anterior; o botão vai direto à oferta.
   Esses dois casos NÃO se distinguem hoje na tela — desenhe assumindo que continuam iguais.
3. **Verificando o plano** — hoje inexistente e necessário. Mostre um estado calmo, com a frase que já
   existe no produto: "Verificando seu plano…". Nunca a lista vazia nesse intervalo.
4. **Falha ao verificar o plano** — "Não foi possível verificar seu plano." + "Tentar novamente".
   Falha de rede JAMAIS pode aparecer como "você não é Premium".
5. **Foco de teclado** no botão "Assinar Premium" e no "X" de fechar — anel visível sobre o fundo do
   painel, não sobre o fundo da página.
6. **Hover e pressionado** do botão primário.
7. **Offline** — o teaser continua legível; se o botão "Assinar Premium" não puder funcionar sem conexão,
   isso precisa ser DITO, não descoberto no toque (ver Perguntas em aberto).
8. **Premium ativo** (contraste, uma prancheta só) — a mesma folha com subtítulo "Estratégias salvas.
   Cada uma recalcula com os preços de hoje quando você abre.", busca e 3 cartões. Serve para provar que
   a porta e a lista têm o mesmo esqueleto e o mesmo respiro.
9. **Premium pausado** (contraste, opcional) — alerta informativo "Premium pausado" com o corpo "Suas
   simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou
   excluir, reative o Premium." Este NÃO é o teaser: pausado vê a lista.

## Viewports

- **Mobile 390px** — o painel ocupa `92vw` (~359px) e desce a altura inteira. É o caso em que a linha de
  preço + botão não cabem lado a lado.
- **Desktop 1280px** — o painel continua com os mesmos **416px**, agora ancorado à direita sobre a
  calculadora, com muito espaço vazio embaixo. É exatamente o caso que ninguém desenhou.
- **Desktop 1920px** — inclua uma prancheta só para mostrar a proporção: o painel NÃO cresce, e é essa
  desproporção (vitrine de venda de 416px numa tela de 1920) que o desenho precisa resolver ou justificar.

## Regras que o desenho não pode quebrar

- Freemium é binário: ou é grátis, ou é Premium. Nada de "3 grátis por mês", contadores, prazos ou
  urgência ("últimas horas", "oferta acaba") — não existe promoção neste produto.
- A legenda "A calculadora continua grátis." é uma frase de honestidade: ela vive em elemento de largura
  cheia, **nunca dentro de um placeholder** e nunca truncada.
- Nenhum número inventado. Só R$ 15,99/mês e o equivalente R$ 12,99/mês; nada riscado.
- Falha de rede nunca é vendida como "não é premium".
- Se houver amostra do que o Premium destrava, ela precisa ser visivelmente uma AMOSTRA (rotulada como
  exemplo) — nunca um cartão que pareça um dado real do vendedor.
- Alvo de toque ≥44px no "Assinar Premium" e no "X".
- Contraste medido contra o fundo REAL do painel (superfície de card sobre o scrim), não contra o fundo
  da página.

## Armadilhas já pagas neste projeto

- **Transbordo horizontal medido:** este mesmo bloco já reivindicou ~506px numa faixa de 426px, jogando
  131px para fora da tela — a largura máxima precisa poder ENCOLHER, nunca só limitar.
- **Botão nascendo fora da viewport:** 100,5px de transbordo numa superfície de cobrança, com o botão
  fora da tela. A linha preço+botão precisa ser desenhada nas DUAS formas (lado a lado e empilhada).
- **Texto ocluso passa em teste:** um elemento pode estar visível para o teste e coberto/cortado na tela.
  Desenhe as caixas, não só o texto.
- **Placeholder que corta a frase honesta:** frase honesta nunca em placeholder.
- **Promessa colada duas vezes:** foi por isso que o subtítulo da folha some no grátis. Se o desenho
  trouxer o subtítulo de volta, ele precisa dizer coisa DIFERENTE do subtítulo do teaser.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. Painel completo, deslogado/grátis, **390px**.
2. Painel completo, deslogado/grátis, **1280px** (com a calculadora atrás e o scrim).
3. Proporção a **1920px**.
4. Estados "Verificando seu plano…" e "Não foi possível verificar seu plano.".
5. Detalhe da linha de preço + botão nas duas formas (lado a lado e empilhada) com foco, hover e
   pressionado.
6. Contraste: a mesma folha com Premium ativo (subtítulo + busca + 3 cartões).

Reutilize os primitivos existentes, sem criar novos: a folha é o `tf-dialog--sheet-right` com
`tf-dialog__title` e `tf-dialog__desc`; o bloco de venda é o `tf-premium-teaser`
(`__title` / `__subtitle` / `__caption`) com a faixa `tf-teaser-upgrade` (`__price` + `tf-btn tf-btn--primary`);
o ícone, se entrar, é o `tf-empty__icon` (56px, fundo de acento) já usado no canvas 018; os estados de
verificação usam `tf-alert`; os cartões da folha Premium usam `tf-card` com padding pequeno. Se o desenho
precisar do card em volta do teaser (como no canvas 018), use `tf-card` — e diga qual padding vale a
416px, já que 56/40 foi desenhado para coluna larga.

## Perguntas em aberto para o dono

1. O bloco de venda dentro da folha deve ganhar o **ícone** e o **card** do canvas 018, ou o painel
   estreito pede uma forma própria (sem card, texto solto)? Isso decide se o componente fechado de 4
   elementos muda.
2. Vale mostrar uma **amostra do que o Premium destrava** (ex.: dois cartões de simulação de exemplo,
   apagados e rotulados "exemplo")? É acréscimo de produto, não de layout — e hoje não existe nada.
3. No **desktop**, "Minhas simulações" deve continuar sendo um painel de 416px à direita, ou virar uma
   superfície mais larga (o canvas 018 desenhou as outras abas em página)? A porta de venda ficar em
   416px numa tela de 1920 é escolha ou herança?
4. **Deslogado e grátis** devem continuar vendo exatamente a mesma tela, ou o deslogado merece um
   "Entrar" separado do "Assinar Premium"?
5. **Offline**: o "Assinar Premium" deve aparecer desabilitado com motivo dito, ou permanecer ativo e
   falhar honestamente depois?
