# Orçamentos no desktop: a lista e o documento entre 1280 e 1440px

## O que desenhar
A tela **Orçamentos** (o registro congelado do que o vendedor já cotou) na composição de duas colunas do
desktop: à esquerda a lista de registros com seus filtros, à direita o documento aberto — claim, detalhamento
de custos, preços por canal, ficha técnica e as ações. Ela só existe acima de 1280px; abaixo disso a lista
ocupa a tela inteira e abrir um registro é uma navegação. O vendedor vive aqui depois de fechar uma venda ou
quando um cliente volta perguntando "quanto você me passou mês passado?" — ele varre a lista à esquerda e lê
o documento à direita, sem perder a lista de vista. Precisamos do desenho **na faixa 1280–1440px**, que é
exatamente onde fica o notebook comum (1366px) e onde hoje ninguém desenhou nada.

## Por que este prompt existe
O desenho de referência (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) tem **uma única largura: 1920px**
— nenhum `@media`, nenhum segundo artboard, nenhuma anotação de breakpoint. A prancheta fixa
`grid-template-columns: 520px minmax(0,1fr)`, e isso é verdade só a 1920. A 1280 essa mesma regra dava
**lista 520px × documento 432px**: a lista ficava MAIOR que o documento, invertendo a prioridade da tela
(quem precisa de espaço aqui é o registro, com sua tabela de detalhamento e os preços por canal). O código
então inventou uma segunda regra que o desenho não tem — `minmax(320px, 0.85fr) minmax(0, 1.15fr)` abaixo de
1440, com os 520px fixos voltando só em `@media (min-width:1440px)` — e mais: fez a coluna direita
`position: sticky` com scroll próprio e altura de janela, e fez o primeiro registro da lista abrir sozinho.
**Nada disso foi desenhado.** Foram achados de homologação do próprio agente que construiu, registrados em
comentário de CSS, nascidos depois do desenho e contra ele.

## O que já existe hoje (não invente do zero — corrija)

**Coluna esquerda (a lista), de cima para baixo:**
1. Cabeçalho da página: título "Orçamentos" + subtítulo "O que você cotou, com a data. Os valores ficam
   congelados como estavam no dia." (fica acima das duas colunas, largura cheia).
2. Faixas de aviso quando existem (Premium pausado, offline, fila pendente) — hoje ficam acima da grade.
3. Barra de filtros: campo de busca com rótulo "Buscar por rótulo" e placeholder "Cliente, pedido…"
   (máx. 120 caracteres); abaixo, chips "Tudo" · "30 dias" · "90 dias" · "Período…" — hoje **empilhados em
   coluna**, porque a regra foi escrita para 390px. → A 1280px isso gasta duas linhas verticais num espaço
   que já é o mais apertado da tela.
4. Cards de registro, um embaixo do outro: rótulo (uma linha, com reticências), badge de sincronização quando
   houver, "Cotado em 14/08/2026 · Kit · 3 peças", "Valor cotado" à esquerda e **R$ 1.234,56** à direita,
   e a legenda da base ("preço de varejo" / "preço de atacado"). A data vem SEMPRE antes do dinheiro.
5. Botão "Carregar mais" quando há mais páginas.

**Coluna direita (o documento aberto):** sem cabeçalho próprio e sem o link "Voltar" (a lista está ali ao
lado). Na ordem: badge de sincronização (se houver) · o card do claim ("Cotado em 14/08/2026 às 15:42",
"Valor cotado" + **R$ 1.234,56**, a base, "Validade da proposta: 15 dias") · avisos · rename/excluir ·
"Valores congelados em 14/08/2026" · "Peças do kit" com linhas "Suporte de fone · 3 un · R$ 405,00" ·
"Detalhamento" (material, energia, máquina, falhas, acabamento, mão de obra, outros custos) · o custo total ·
"Preços por canal" · "Ficha técnica" · "Comparar com hoje" · e por fim os botões "Recalcular hoje" e
"Exportar".

**A grade:** hoje, 1280–1439px → `minmax(320px, 0.85fr) minmax(0, 1.15fr)`; ≥1440px → `520px + resto`.
→ Isso produz um **salto de ~40px na largura da lista exatamente em 1440px** que ninguém desenhou nem viu.
→ A coluna direita é `sticky`, presa ao topo, com `max-height` de janela e **barra de rolagem própria**:
num notebook 1366×768 sobram ~700px de altura para um documento que tem sete blocos. Ninguém desenhou como
esse scroll interno se anuncia, nem onde as ações "Recalcular hoje"/"Exportar" ficam quando ele existe.
→ Quando a busca não acha nada, a coluna direita mostra o vazio **FRIO**: "Nenhum registro ainda" com o corpo
"Calcule uma peça ou um kit e toque em 'Salvar em Orçamentos' para guardar o preço com a data." — ao lado de
uma lista que tem registros e só está filtrada. É uma frase falsa naquele contexto.

## Conteúdo e dados reais
- Larguras aproximadas com a barra lateral de 240px e goteiras: a **1280px** sobram ~960px para as duas
  colunas; a **1366px**, ~1070px; a **1440px**, ~1140px. O gap entre colunas é de 24–28px.
- Dinheiro sempre em `R$ 1.234,56`, alinhado à direita, com algarismos tabulares. Valores plausíveis vão de
  R$ 16,16 (peça pequena) a R$ 9.876,54 (kit grande) — **desenhe pelo menos um card e um documento com o
  valor de 4 dígitos**, que é onde a coluna estoura.
- Rótulos de registro são texto livre do vendedor e chegam longos: use "Reposição bancada — Marcenaria
  Andrade / pedido 4471" como caso adverso na lista E no título do documento.
- Badges de sincronização, literais: "Pendente neste dispositivo" · "Envio pausado · precisa de Premium" ·
  "Envio pausado · sessão expirada" · "Não foi possível registrar".
- Faixa de fila, literal: "3 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora".
- Premium pausado, literal: "Premium pausado — seus registros continuam aqui e podem ser abertos. Para
  salvar, renomear, excluir ou exportar, reative o Premium."
- Offline, literal: título "Modo leitura offline", corpo "Seus registros continuam aqui. Novos registros
  ficam pendentes neste dispositivo até você voltar a ficar online."
- Busca sem resultado, literal: "Nenhum registro encontrado para “pedido 4471”." + botão "Limpar busca".
- O filtro de período customizado abre uma folha com "De" / "Até" / "Aplicar"; ativo, vira o chip
  "Período: 2026-07-01 – 2026-07-31" com "Limpar filtro" ao lado.

## Estados obrigatórios
Para a **grade** (o que este prompt existe para resolver): 1280px · ~1366px · 1439px · 1440px. Mostre a
proporção pretendida em cada um e o que acontece na virada.

Para a **coluna esquerda**: lista com registros (repouso) · card **aberto/selecionado** (hoje: borda e fundo
de acento — precisa ler como "é este que estou lendo à direita", e não como hover) · hover e foco de teclado
num card (são links) · carregando (spinner) · lista vazia FRIA · busca sem resultado · erro frio de leitura
("Não foi possível carregar seus orçamentos." + "Tentar novamente") · com fila pendente · Premium pausado.

Para a **coluna direita**: documento carregado · carregando · registro não encontrado ("Registro não
encontrado.") · erro frio com retry · **vazio porque nada está selecionado** (hoje é o vazio frio — precisa de
uma frase própria) · **vazio porque o filtro não achou nada** (idem) · documento com scroll interno (indique
como o corte se anuncia) · Premium pausado (as ações de escrita somem e a faixa explica) · offline
("Exportar precisa de conexão." aparece no lugar do botão) · registro ainda pendente ("Sincronize para
exportar.").

## Viewports
Desenhe **1280px** e **1366px** obrigatoriamente — é a faixa que nunca foi desenhada e onde o produto está
errado hoje. Desenhe também **1440px** só para mostrar a transição para a regra que já existe (lista de
520px). **1920px já está desenhado**: não refaça, use como âncora. **Não desenhe mobile**: abaixo de 1280px
esta composição não existe no código — a lista é tela cheia e o registro é outra tela.

## Regras que o desenho não pode quebrar
- **O documento tem prioridade sobre a lista.** Em nenhuma largura da faixa a lista pode ficar mais larga
  que o documento — foi exatamente esse o defeito.
- **A data vem antes do dinheiro**, no card e no documento. O card é uma linha de razão, não um preço vivo:
  nada de tratamento de preço-herói, nada de cor que leia como "atual".
- **"Valor cotado", nunca "Preço".** Preço é o que a calculadora diz hoje.
- **Vazio filtrado ≠ vazio frio.** A coluna direita não pode afirmar "Nenhum registro ainda" quando a lista
  tem registros e só o filtro não achou.
- **Falha de rede nunca vira "não é premium"**, e Premium pausado nunca esconde o registro: ele continua
  legível, só a escrita para.
- Frase honesta mora em elemento de largura cheia, **nunca em placeholder** (o placeholder corta).
- Alvos de toque/clique ≥44px nos cards e nas ações; contraste medido contra o fundo real do card
  selecionado (acento suave), não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: a coluna estreita da faixa 1280 é onde "R$ 9.876,54" ao lado
  de um rótulo longo estoura. Desenhe com o valor de 4 dígitos e o rótulo comprido juntos.
- **Texto ocluso passa em teste**: um elemento fora da área visível ou embaixo de outro continua "visível"
  para o código. O corte do scroll interno da coluna direita é exatamente esse risco.
- **Barra de rolagem clássica não aparece em captura headless**: o scroll interno precisa se anunciar
  visualmente (sombra, borda, corte de conteúdo), não só existir.
- **Marcação de seleção esquecida**: já aconteceu aqui — o registro abria à direita e nenhum card ficava
  marcado. O vendedor perdia o vínculo entre o que escolheu e o que lê.
- **Salto no breakpoint**: a mudança de regra em 1440 é uma descontinuidade real; ou o desenho a assume de
  propósito, ou ela é um defeito silencioso.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. 1280px — estado pleno: lista com 5 registros, o primeiro aberto à direita, faixa de fila no topo.
2. 1366px — o mesmo, com o rótulo longo e o valor de 4 dígitos.
3. 1440px — só a grade, para mostrar a virada para a lista de 520px.
4. 1280px — busca sem resultado à esquerda e a coluna direita no estado vazio correspondente.
5. 1280px — Premium pausado (ações de escrita ausentes) e offline.

Reutilize os primitivos existentes, sem criar nenhum novo: `tf-card` (com o modificador de card aberto) para
os registros, `tf-input` dentro de `tf-inputwrap` para a busca, `tf-btn` (`--sm`, `--secondary`, `--ghost`)
para chips e ações, `tf-badge` para o estado de sincronização, `tf-alert` (`--info` / `--danger`) para as
faixas, o bloco de detalhamento e o estado vazio já existentes. Anote na prancheta as larguras resultantes
de cada coluna em cada viewport — o número é o entregável tanto quanto a imagem.

## Perguntas em aberto para o dono
1. Na faixa 1280–1440, qual é a proporção certa entre lista e documento? Manter a lista em fração com piso de
   leitura (o que o código improvisou) ou fixá-la numa largura menor, por exemplo 420px, e dar todo o resto ao
   documento? E o salto de ~40px na largura da lista exatamente em 1440 é aceitável, ou você quer transição
   contínua até os 520px do desenho de 1920?
2. Quando a busca não acha nada, o que a coluna direita deve dizer? Ela hoje repete a frase do vazio frio
   ("Nenhum registro ainda"), que é falsa nesse contexto — mas não existe copy aprovada para o caso.
3. Num notebook 1366×768 o documento não cabe na altura. Deve rolar sozinho dentro da coluna (como hoje) ou a
   página inteira deve rolar junta? E se for scroll interno, "Recalcular hoje" e "Exportar" ficam no fim do
   conteúdo ou fixos no rodapé da coluna, sempre alcançáveis?
4. Abrir automaticamente o primeiro registro da lista é desejado a 1280px? A 1920 preenche a tela; a 1280 ele
   também consome a coluna mais estreita com um documento que o vendedor talvez não tenha pedido.
