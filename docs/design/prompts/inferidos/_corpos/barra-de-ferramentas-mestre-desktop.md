# Barra de ferramentas da lista do Catálogo (desktop)

## O que desenhar
A faixa que fica no topo da COLUNA ESQUERDA do Catálogo no desktop (≥1280px), acima da lista de
cartões e ao lado da ficha do item selecionado. Ela existe nas quatro seções do Catálogo —
Filamentos, Impressoras, Produtos e Kits — e é o único caminho até um item quando o vendedor já
tem catálogo grande: é onde ele busca, onde ele lê quantos itens tem, e de onde ele cria um item
novo. Quem usa: o vendedor Premium, no meio do trabalho, procurando "aquele PLA azul" entre
dezenas. Origem no app: `apps/web/src/features/catalog/catalog-panel.tsx` (branch `isWide`) +
`catalog-master-detail.css` (`.tf-catalog-md__toolbar`).

## Por que este prompt existe
`autoridade: PROTOTIPO_PARCIAL`. O desenho de 2026-07-02 (canvas `Abas-Desktop.dc.html`) cobre
UM terço desta peça: a linha 102 desenha o campo de busca sozinho, `tf-inputwrap` com
`max-width:420px`, placeholder "Buscar no catálogo…" e `aria-label` "Buscar no catálogo" — e a
copy implementada bate exatamente. Os outros dois elementos o canvas colocou em OUTRO lugar: a
contagem é `tf-page-header__desc`, ao lado do título "Catálogo" (linha 73), e o botão primário
`{{ addLabel }}` fica grudado no `role="tablist"` das seções (linha 82). O código juntou os três
numa única `display:flex` sem `flex-wrap` — um arranjo que não existe em desenho nenhum. Além
disso o código CONTRARIA o canvas num ponto explícito: no canvas o botão de adicionar tem
`disabled="{{ writeBlocked }}"`; no app ele nunca desabilita — com Premium pausado ele abre uma
gaveta de criação em modo somente-leitura, sem botão Salvar, de onde só se sai fechando.

## O que já existe hoje (não invente do zero — corrija)
A barra tem três filhos, nesta ordem, numa linha só (`gap: 12px`, `align-items:center`):

| # | Elemento | Comportamento hoje |
|---|---|---|
| 1 | Campo de busca `tf-inputwrap` com ícone de lupa 18px | `flex:1; max-width:420px`; rótulo visualmente oculto "Buscar no catálogo"; placeholder "Buscar no catálogo…" |
| 2 | Contagem, em texto de legenda (`--fs-caption`, `--text-muted`) | empurrada para a direita por `margin-left:auto` |
| 3 | Botão primário pequeno com ícone `+` 16px | "Adicionar filamento" / "Adicionar impressora" / "Adicionar produto" / "Montar kit" |

→ **Sem `flex-wrap`.** A coluna esquerda mede ≈390px a 1280px com o menu aberto (1280 − 240 de
menu − recuos − 560 da ficha − 28 do vão). Três elementos, um deles com "Adicionar impressora"
escrito por extenso, se espremem nesses 390px em vez de quebrar: a busca — que tem 420px de largura
desenhada — encolhe para uns 120px. Com o menu recolhido (76px) sobram ≈550px; a 1920px sobram
≈1030px e aí a linha respira. O desenho precisa resolver os três casos, não só o folgado.
→ **A contagem muda de significado sem avisar.** Ela exibe `visible.length`, o resultado do FILTRO,
com o mesmo texto de sempre. Com 40 filamentos salvos e a busca "azul" ativa, lê-se
"3 filamento(s)" — e nada na tela diz que 37 estão escondidos por um filtro.
→ **A busca filtra a lista já carregada** (nome + resumo, sem acento-insensível, sem debounce,
nenhuma requisição nova). Não há botão de limpar DENTRO do campo: "Limpar busca" só aparece no
vazio de busca, dentro do estado vazio.
→ **A barra some quando o catálogo está vazio** (o estado vazio ocupa a coluna inteira, com o botão
de adicionar em bloco), e também durante o carregamento e no erro. Ela só existe com ≥1 item.

## Conteúdo e dados reais
- Contagem, textos literais: "{n} filamento(s)" · "{n} impressora(s)" · "{n} produto(s)" ·
  "{n} kit(s)". Exemplos reais para desenhar: "12 filamento(s)", "1 impressora(s)" (sim, o plural
  entre parênteses é a copy vigente), "128 produto(s)".
- Botões: "Adicionar filamento" (o mais largo junto de "Adicionar impressora"), "Adicionar produto",
  "Montar kit" (curto — a linha não pode depender do rótulo curto para caber).
- Busca: `type="search"`, sem limite de caracteres, sem contador próprio de resultados.
- Nada aqui é dinheiro. Os valores (ex.: "PLA Azul · R$ 129,90/kg") vivem nos cartões da lista,
  logo abaixo, e na ficha de 560px à direita — a barra não os mostra.

## Estados obrigatórios
- **Repouso**, com item selecionado na lista (o cartão selecionado tem borda de destaque).
- **Busca vazia (repouso)** vs **busca preenchida**: a segunda precisa de um jeito visível de
  limpar sem apagar caractere a caractere.
- **Foco no campo** (anel de foco medido contra o fundo real do cartão, não contra o fundo da
  página) · **hover** e **pressionado** no botão de adicionar.
- **Sem resultado**: a barra CONTINUA, a lista vira o vazio "Nada encontrado para essa busca" /
  "Tente outro termo, ou limpe a busca para ver tudo de novo." + botão secundário "Limpar busca".
  Desenhe a barra e esse vazio juntos — é aqui que a contagem "0 filamento(s)" mente sobre o
  catálogo do vendedor.
- **Offline (leitura degradada)**: acima da barra a página já mostra um alerta de tom informativo
  "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar
  precisam de conexão." e cada cartão ganha a legenda "pode estar desatualizada". A barra em si
  não muda hoje — decida no desenho o que acontece com o botão de adicionar nesse estado.
- **Premium pausado (`lapsed`)**: alerta informativo "Premium pausado" / "Seus itens continuam aqui
  e podem ser usados no cálculo. Para criar ou editar, reative o Premium.", cartões com a legenda
  "somente leitura", e a linha de reativação "Reative o Premium para voltar a criar e editar. Seus
  itens estão salvos." Hoje o botão de adicionar segue aceso e leva a uma gaveta sem Salvar.
- **Estados em que a barra NÃO aparece** (desenhe pelo menos um para contraste): carregando
  (spinner na coluna), erro "Não foi possível carregar seu catálogo." + "Tentar novamente",
  catálogo vazio, e sem direito de acesso (o teaser de Premium ocupa a área).

## Viewports
- **Desktop 1280px** — o caso apertado, e o mais importante: menu aberto (240px) e menu recolhido
  (76px), porque a diferença de 160px é justamente o que decide se os três elementos cabem.
- **Desktop 1920px** — o caso folgado, onde a lista vira duas colunas de cartões (a partir de
  1600px) e a barra tem ≈1030px.
- **Mobile 390px — não desenhar.** Esta peça não existe no mobile: abaixo de 1280px o painel
  renderiza outra árvore, com contagem + botão numa linha e **nenhuma busca**. Se o desenho sugerir
  levar a busca para o mobile, isso é decisão de produto — mande para as perguntas abaixo.

## Regras que o desenho não pode quebrar
- A contagem é um número sobre os DADOS do vendedor. Se ela passar a contar o resultado do filtro,
  o texto tem que dizer isso na própria frase — número sem procedência declarada é mentira barata.
- Falha de rede nunca vira falta de Premium, e Premium pausado nunca vira erro: os dois alertas são
  de tom informativo, calmos, e a barra não pode contradizê-los ficando "normal" demais.
- Frase honesta nunca mora em placeholder. O placeholder carrega "Buscar no catálogo…" e nada mais;
  qualquer explicação (filtro ativo, itens ocultos) é texto de verdade, em elemento de largura cheia.
- Alvo de toque/clique ≥44px em qualquer controle da barra, inclusive um eventual "limpar" dentro
  do campo.
- Contraste medido contra o fundo real (a coluna fica sobre `--bg-base`, os cartões sobre o fundo
  de card) — o texto de legenda em `--text-muted` é o mais frágil.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal se mede, não se estima.** Um nome de filamento colado sem espaço já gerou
  4.948px de rolagem horizontal a 1440px nesta mesma coluna; a correção foi `min-width:0` +
  `overflow-wrap`. Uma barra sem quebra é a mesma classe de defeito uma linha acima.
- **Texto ocluso passa em teste.** Um elemento espremido continua "visível" para asserção de texto
  e ilegível para o vendedor — por isso o arranjo tem que ser resolvido no desenho, com caixas.
- **Rótulo comprido estoura a coluna.** "Adicionar impressora" com ícone é o pior caso; não desenhe
  a barra com "Montar kit" e presuma que serve para todas as seções.
- **O contador que mentia.** Numa homologação anterior um contador anunciou "8 encontrados" com 31
  correspondências — invisível para toda asserção e óbvio na imagem.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class), reusando os primitivos existentes —
nada de componente novo:
1. 1280px, menu aberto, repouso com busca vazia — a prancheta que prova (ou nega) que os três
   elementos cabem em ≈390px.
2. 1280px, menu recolhido, busca preenchida com termo e resultado parcial.
3. 1920px, repouso, lista em duas colunas ao lado da ficha de 560px.
4. 1280px, sem resultado de busca (barra + estado vazio de busca juntos).
5. 1280px, offline e Premium pausado (pode ser uma prancheta com os dois alertas empilhados acima
   da barra).
Use `tf-inputwrap` + `tf-input` com o ícone de lupa para a busca, o botão primário `tf-btn
tf-btn--primary` (com o `+`) para adicionar, `tf-badge` se a contagem virar pastilha, `tf-card` /
`tf-card--interactive` para os cartões da lista ao redor, e o vazio de busca no mesmo padrão de
`tf-empty` já usado. Se a solução for quebrar a barra em duas linhas, mostre as duas linhas
desenhadas — não deixe implícito.

## Perguntas em aberto para o dono
1. Com filtro ativo, o que a contagem deve dizer? "3 de 40 filamento(s)", "3 filamento(s)
   encontrados" ou manter "{n} filamento(s)" e explicar noutro lugar? Muda o texto e a largura.
2. O botão "Adicionar…" fica na barra da lista (como está) ou volta para o cabeçalho da página, ao
   lado das abas de seção, como o canvas de 2026-07-02 desenhou? Não dá para ter os dois.
3. Com Premium pausado ou offline, o botão de adicionar desabilita (como o canvas mandava) ou
   continua aceso levando a uma gaveta somente-leitura (como o código faz)? Se desabilitar, qual a
   frase que explica o porquê, e onde ela mora?
4. A busca deve ignorar acentos ("acucar" achar "Açúcar")? Hoje não ignora.
5. A busca deve existir também no mobile, ou o mobile continua sem nenhum caminho de filtro?
