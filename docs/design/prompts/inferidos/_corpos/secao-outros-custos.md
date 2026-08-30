# Seção "Outros custos" da Calcular — lista de itens nomeados

## O que desenhar
O bloco da aba **Calcular** onde o vendedor acrescenta 0..N custos nomeados que somam ao custo total da
peça — embalagem, etiqueta, taxas, overhead. É um editor de lista: um título com ⓘ, uma legenda, as
linhas já criadas (cada uma = nome livre + valor em R$ + remover) e um botão de adicionar. Aparece no meio
do formulário, depois dos campos de custo da peça e da mão de obra, e antes do rodapé "Como chegamos no
preço", onde **cada item vira uma linha própria do detalhamento**. Quem usa é o vendedor de peças 3D no
momento em que está montando o custo — normalmente a última coisa que ele lembra de incluir, e o motivo
pelo qual o produto existe.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. A busca por "outros custos" nas quatro autoridades de protótipo
(`claude-design-prototype.md`, `-fixes.md`, `-fixes-r2.md`, `prototype-audit-2026-07-02.md`) deu zero, e a
`CalculatorScreen.jsx` só tinha um breakdown fixo, sem sub-custos. O único desenho existente com a string
é o `Abas-Desktop.dc.html` (linha 330), e ali é uma **linha de LEITURA** num orçamento congelado, na aba
Orçamentos (`Embalagem` / sub-rótulo `Outros custos` / R$ 2,50) — desenha como um outro-custo é lido depois
de salvo, não o editor. Portanto: a supressão dos rótulos por linha, a proporção 3:2, o "✕" tipográfico como
botão de remoção, a ausência total de estado vazio educativo e a **migração de coluna conforme o plano** foram
todas decididas em código, sem desenho.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`OtherCostsSection` / `OtherCostRow`) e
`apps/web/src/pages/calcular/calcular-page.tsx`.

Ordem atual, de cima para baixo:

1. Título **"Outros custos"** + ícone ⓘ colado à direita. O tooltip tem rótulo "Sobre outros custos" e o
   corpo: *"Itens nomeados que somam ao custo total: embalagem, etiqueta, taxas, overhead. A soma entra no
   custo total exatamente como um valor único faria, e cada item aparece na sua própria linha do
   detalhamento."*
2. Legenda em texto apagado: **"Embalagem, etiqueta, taxas, etc. Cada item soma ao custo total."**
3. As linhas (0..N). Cada linha é uma faixa horizontal alinhada pela base, com três controles:

| Controle | Proporção | Texto visível hoje | Nome acessível | Observação |
|---|---|---|---|---|
| Nome do custo | flex 3 | *só* o placeholder "Ex.: Embalagem" | "Nome do custo" | texto livre; pode ficar em branco |
| Valor | flex 2 | afixo R$ do campo de moeda | "Valor" | moeda pt-BR, aceita vazio |
| Remover | automática | o caractere **"✕"** | "Remover custo" | botão fantasma, tamanho `sm` |

4. Botão secundário `sm` **"Adicionar custo"**, sempre no fim da lista.

→ **Problema 1:** nenhuma linha tem rótulo visível. O significado dos dois campos mora inteiro no
placeholder "Ex.: Embalagem" e no afixo R$ — e o placeholder some no instante em que a pessoa digita.
→ **Problema 2:** o estado vazio é literalmente título + legenda + botão. Nada ensina o que entra ali,
justamente no bloco que existe para lembrar do custo esquecido.
→ **Problema 3:** o "✕" é um glifo tipográfico dentro de um botão fantasma pequeno, na borda direita da
linha — o alvo mais destrutivo do bloco é o menor e o mais discreto dele.
→ **Problema 4:** a linha alinha pela base; quando o erro aparece embaixo do campo de valor, os três
controles se deslocam na vertical.
→ **Problema 5 (posição por plano):** a seção **não é premium** — ela existe para todo mundo. Mas no
desktop ela troca de coluna: com marketplace liberado fica na coluna **esquerda** (abaixo de mão de obra);
sem marketplace, migra para a **direita** (abaixo do markup) para tapar o buraco deixado pelo gate — 1.671px
de vão medidos a 1440px antes dessa correção. O bloco é o único da tela cuja posição depende do plano.

## Conteúdo e dados reais
- **Nome**: texto livre, opcional, sem limite declarado. Exemplos verdadeiros do produto: `Embalagem`,
  `Etiqueta`, `Taxa de emissão`, `Overhead`. Um nome longo real de estresse: `Frete até a transportadora`.
- **Valor**: moeda em reais, formato pt-BR, `R$ 0,00`. Faixa plausível de um item: `R$ 0,35` (etiqueta) a
  `R$ 12,00` (caixa grande). Valor de estresse para largura: **`R$ 1.234,56`**.
- **Vazio ≠ erro**: valor em branco = linha não tocada — não entra na conta, não gera item, não acusa nada.
- **Nome em branco é aceito**: no detalhamento a linha aparece com o rótulo neutro **"Outros custos"**.
- **Derivado**: cada item vira uma linha do card "Como chegamos no preço", com o nome digitado e o valor em
  R$, logo antes da linha **"Custo total"**. Não existe subtotal da seção em lugar nenhum hoje.
- Sem aviso de plausibilidade: nenhum valor desta seção dispara os avisos "Nada foi recusado." que outros
  campos têm.
- Atenção à copy: o exemplo *"frete até a transportadora"* foi **removido de propósito** (016/US12) —
  o frete tem campo próprio dentro do canal de marketplace e citá-lo aqui sugeria dois lugares para o mesmo
  custo. **Não reintroduza frete como exemplo no desenho.**

## Estados obrigatórios
- **Vazio** (nenhuma linha): título, ⓘ, legenda e "Adicionar custo". Desenhe o que ele deveria ser além disso.
- **Repouso** com 1, 2 e 4 linhas preenchidas.
- **Foco** no campo de nome e no campo de valor (anel de foco visível sobre o fundo real da seção).
- **Hover** e **pressionado** em "Adicionar custo" e no botão de remover.
- **Erro por linha — valor inválido**: mensagem **"Informe um número válido."** sob o campo de valor.
- **Erro por linha — negativo**: **"Não pode ser negativo."** sob o campo de valor. Nas duas, as outras
  linhas continuam válidas e o preço continua sendo calculado com elas; a linha ruim falha sozinha.
- **Nome em branco com valor preenchido**: linha válida; mostre no desenho como o detalhamento lê
  "Outros custos".
- **Estresse**: linha com `Frete até a transportadora` + `R$ 1.234,56` a 390px.
- Não existem, nesta peça: carregando, offline, degradado, premium pausado, sem permissão — a seção é
  local, síncrona e não é gateada. Não invente nenhum deles.

## Viewports
- **Mobile 390px** — obrigatório: é a coluna única, onde os três controles dividem a mesma faixa e onde a
  proporção 3:2 aperta mais. Inclua a versão com erro e a versão de estresse.
- **Desktop 1280px** — a grade de duas colunas do formulário liga em **1024px** (não em 1280; registre isso).
  Desenhe as **duas posições**: dentro da coluna esquerda (conta com marketplace) e dentro da coluna direita
  (conta grátis, ao lado do markup). São larguras de coluna diferentes, e é onde a linha 3:2 quebra ou não.
- **1920px** — só se a decisão de largura máxima da linha mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- Frase honesta **nunca** dentro de placeholder: o que explica o campo tem de existir com o campo preenchido.
- Alvo de toque **≥44px** para remover e para adicionar — inclusive a 390px, e sem encostar no campo de valor.
- Contraste medido contra o fundo real da seção, nos dois temas.
- O erro pertence à **linha**, não à seção: nunca um banner no topo dizendo que "há erros".
- Zero overflow horizontal a 390px com o nome longo e o valor de seis dígitos — medido, não presumido.
- Nada nesta seção pode parecer bloqueado por plano: ela é igual para grátis e premium; só a posição muda.
- O total mostrado no rodapé é a soma exata das linhas — o desenho não pode sugerir taxa, arredondamento
  ou item automático que o produto não cria.

## Armadilhas já pagas neste projeto
- **Placeholder cortado** (016/PR-F): frase de sentido dentro de placeholder desaparece ou é clipada;
  placeholder carrega número/exemplo, não significado.
- **Overflow medido, não assumido** (016/PR-B e 014): `toBeVisible` passa em elemento ocluso e em coluna
  estourada — a largura da linha precisa fechar por geometria, com o valor grande dentro.
- **Coluna curta ao lado do gate** (016/US11): foi exatamente o buraco que jogou esta seção para a direita;
  o desenho tem de funcionar nas duas larguras de coluna, não numa só.
- **Tooltip que compete pela linha do controle** (016/US6): o ⓘ vive na linha do TÍTULO, nunca dentro da
  faixa de inputs — quando dividiu a faixa, sobrou 1px de campo visível a 360px.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro como primeira classe** (as duas versões de cada estado
principal):
1. `390 — vazio` (a proposta de estado vazio educativo)
2. `390 — três linhas em repouso`
3. `390 — erro em uma linha + estresse (nome longo, R$ 1.234,56)`
4. `1280 — coluna esquerda (premium)` e `1280 — coluna direita (grátis)`, lado a lado para comparar
5. `Anatomia da linha` — foco, hover, pressionado e o botão de remover em tamanho de alvo real

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap`/`tf-input` para o nome, o campo de
moeda com afixo R$ para o valor, botão **fantasma** para remover e botão **secundário `sm`** para
"Adicionar custo", o `InfoTip` já existente para o ⓘ e o estilo de rótulo de seção para o título. Se a sua
proposta de remoção substituir o "✕" tipográfico, use o ícone do conjunto do DS e diga qual.

## Perguntas em aberto para o dono
1. **Rótulos por linha**: mostrar "Nome do custo" e "Valor" visíveis (repetidos em cada linha), mostrar só
   na primeira linha como cabeçalho da lista, ou manter só o placeholder? Muda a altura de cada linha.
2. **Estado vazio**: ele deve apenas explicar, ou oferecer atalhos de um toque para os itens mais comuns
   (Embalagem, Etiqueta)? Sugestão pré-preenchida é decisão de produto, não de layout.
3. **Subtotal da seção**: mostrar "Soma dos outros custos: R$ 8,50" dentro do bloco, ou deixar a soma só no
   detalhamento do rodapé, como é hoje?
4. **Posição por plano**: a migração de coluna conforme entitlement continua? Ela é a única na tela e faz o
   mesmo bloco morar em lugares diferentes para dois usuários; se o gate for redesenhado, isso some.
5. **Limite de linhas**: existe um número máximo de itens, e o que acontece na lista longa (rolagem própria,
   nada)? Hoje não há limite.
6. **Nomes repetidos**: dois itens chamados "Embalagem" são um erro a avisar ou comportamento aceito?
