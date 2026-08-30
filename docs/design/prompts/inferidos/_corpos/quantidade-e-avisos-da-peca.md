# Quantidade da peça e a pilha de avisos do card (Kits)

## O que desenhar

O controle de **quantidade** que vive no cabeçalho de cada card de peça do compositor de kits (aba
**Kits**, título "Monte seus kits") — e, principalmente, **a pilha de legendas e avisos que nasce
logo abaixo dele, dentro do mesmo card**. O cabeçalho tem três coisas na mesma linha: o botão que
expande a peça ("Peça 1 · Suporte de celular"), o campo de quantidade com sufixo `un`, e o botão de
remover. Abaixo, em fluxo, aparecem até três parágrafos ao mesmo tempo: o custo da linha, um aviso
sobre a própria quantidade, e a legenda de peça degradada. Quem usa é o vendedor montando um anúncio
combinado — a quantidade é **o controle que ele mexe a cada ajuste**, mais do que qualquer outro
campo do kit. Kits é Premium: esta peça nunca é vista por quem está no plano grátis.

## Por que este prompt existe

O canvas de desktop (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linha 190) **desenhou o
controle** — rótulo textual "Quantidade" visível à esquerda, campo de `104px` com afixo `un`, e um
botão de **lixeira** para remover. O que está no ar (`apps/web/src/features/bom/bom-line-card.tsx`)
diverge do desenho em três pontos: o rótulo sumiu para dentro de um `aria-label` (nenhuma palavra
visível), a largura virou `96px`, e a lixeira virou um "x". **Aqui o código contraria um desenho
explícito — não é lacuna, é divergência.** Já os **avisos não têm desenho nenhum**: procurar por
"Quantidade 0" no canvas dá zero, e o único alerta desenhado dentro do card é o de peça inválida. O
aviso do teto do banco nasceu de um achado de homologação automatizada (CF-021-UI-03), não de
desenho, e foi colado como mais um parágrafo cinza no meio dos outros.

## O que já existe hoje (não invente do zero — corrija)

Cabeçalho do card, da esquerda para a direita:

| Elemento | Como está | Origem |
|---|---|---|
| Botão de expandir | chevron 16px + "Peça 1 · Suporte de celular" (ou "Peça 1 · (avulsa)") | `bom-line-card.tsx` |
| Campo de quantidade | `tf-inputwrap--sm`, **96px**, altura **36px**, afixo `un`, placeholder `1`, teclado numérico | idem |
| Rótulo "Quantidade" | **só no `aria-label`** → invisível na tela | idem |
| Botão de remover | `tf-btn--ghost --sm`, ícone **`x`** de 16px | idem |

→ **O rótulo invisível é o problema principal**: o desenho pediu a palavra "Quantidade" e ela não
existe. O `un` sozinho não diz que aquilo é quantidade — pode ser lido como "unidade de medida".
→ **96px com 36px de altura** fere o alvo de ≥44px e não cabe um número longo com o afixo.
→ O ícone `x` lê como "fechar/recolher" ao lado de um chevron que faz exatamente isso; a **lixeira**
desenhada era mais clara.

Parágrafos abaixo do cabeçalho, na ordem em que o código os empilha — **todos `text-sm`, todos em
`--text-muted`, exceto um**:

1. Custo da linha: `"R$ 12,34 /un · Total da linha (3×) R$ 37,02"`
2. `"Quantidade 0 — não entra no total."`
3. Aviso de plausibilidade, o único com cor (`--info-text`): `"Confira a quantidade: 3.000.000.000.
   O máximo por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."`
4. `"Confira os campos desta peça — ela não entra no total até ser corrigida."`
5. `"Os valores atuais foram mantidos e continuam editáveis."` (peça degradada)

→ **Medi as combinações reais** (a ficha da auditoria fala em cinco parágrafos simultâneos; não são
cinco). 1 e 4 são mutuamente exclusivos, 2 e 3 também. O máximo real é **três ao mesmo tempo**:
`1 + (2 ou 3) + 5`, ou `4 + 5`. É esse trio que precisa de hierarquia — não uma pilha de cinco.
→ **A quantidade dentro da legenda 1 não é formatada**: hoje sai `"Total da linha (3000000000×)"`,
sem separador de milhar, contra a regra pt-BR do preâmbulo, e é o que estoura a linha.
→ **Contradição medida**: digitar `3.000.000.000` (com os pontos que o próprio pt-BR pede) faz
aparecer o aviso 3, que termina em "Nada foi recusado", **e** o parágrafo 4, que diz que a peça não
entra no total até ser corrigida. As duas frases se contradizem no mesmo card.
→ A quantidade só aceita **inteiro sem pontuação**. `1,5`, `-1`, campo vazio e `3.000` caem todos no
parágrafo 4, genérico, que **não nomeia a quantidade** — o vendedor vai procurar o erro nos campos
de dentro da peça, que estão certos.
→ O canvas desenhou o estado inválido como `tf-alert--danger` com ícone; o código entrega um
parágrafo cinza. Decida qual vale e desenhe uma forma só.

## Conteúdo e dados reais

- **Quantidade**: inteiro, obrigatório, unidade `un`, placeholder `1`. Faixa plausível do negócio:
  **1 a 500**. Teto duro: **2.147.483.647** (limite da coluna `int4` do banco). O `0` é **aceito e
  válido** — a peça fica no kit e soma zero, com legenda própria.
- **Custo unitário** e **total da linha**: dinheiro pt-BR, `R$ 12,34` e `R$ 37,02`. Derivados —
  nunca digitados. Numerais tabulares.
- Exemplos verdadeiros para as pranchetas: `3` (normal), `250` (lote), `0` (o caso captionado),
  `2147483647` (o limite exato), `3000000000` (o que dispara o aviso).
- Rótulos vizinhos que existem e vale citar: "Adicionar peça", "Editar esta peça", "Recolher",
  "Remover peça", "Usar produto salvo", e o resumo do kit dizendo `"{n} peça(s) fora do total —
  confira os avisos nas peças acima."`

## Estados obrigatórios

- **Repouso vazio** — campo sem valor, placeholder `1` em `--text-faint`, rótulo visível ao lado.
- **Repouso preenchido** — `3`, alinhado à direita, tabular.
- **Hover** — borda em `--border-strong`.
- **Foco** — anel roxo de 3px que **não pode ser cortado** pelo card nem pelo botão vizinho.
- **Pressionado** (botão de remover) — escala 0.97.
- **Quantidade 0** — o campo continua normal (não é erro); abaixo, o custo da linha em `R$ 0,00`
  com `"Quantidade 0 — não entra no total."`. Nada de vermelho: zero é uma escolha legítima.
- **Aviso de teto** — campo **sem** estado de erro (a regra do projeto é "aviso nunca vira
  validação"), parágrafo em tom `info`, largura total, com o texto completo do item 3 acima.
- **Linha inválida** — quantidade vazia, fracionária ou pontuada: precisa de um sinal **no campo** e
  de uma frase que nomeie a quantidade, não a peça inteira.
- **Peça degradada** — o produto de catálogo foi apagado depois de salvo: legenda calma "Os valores
  atuais foram mantidos e continuam editáveis.", com o campo de quantidade **totalmente editável**.
- **Desabilitado** — não existe hoje neste campo; desenhe mesmo assim, para o DS (`--disabled`).
- Não há carregando/offline/vazio **neste controle**: eles vivem antes, no portão de plano da aba
  ("Verificando seu plano…" / "Não foi possível verificar seu plano." + "Tentar novamente"). Não os
  desenhe aqui — só não deixe o card assumir que a rede respondeu.

## Viewports

- **390px** — é onde a peça dói: cabeçalho com botão flexível + campo + botão de remover na mesma
  linha, e o nome da peça pode ser longo ("Peça 1 · Suporte de celular articulado preto"). Mostre o
  que acontece quando o nome quebra e quando a quantidade tem 10 dígitos.
- **1280px** — o compositor vira duas colunas (peças à esquerda, resumo do kit fixo à direita, com
  ~480px). A coluna de peças fica em torno de 700px: o cabeçalho respira e o rótulo "Quantidade"
  cabe à esquerda do campo, como o canvas desenhou. Desenhe o card nessa largura. 1920px não precisa
  de prancheta própria — a coluna de peças não cresce o bastante para mudar decisão alguma.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O número acima do teto continua no campo, continua editável, e a
  peça continua no kit. Nada de vermelho, nada de borda de erro, nada de botão bloqueado por ele.
- **Zero é verdade, não falha.** `R$ 0,00` com legenda é honesto; `R$ 0,00` sem legenda é mentira.
- **Degradação é dita.** A legenda da peça degradada nunca diz "removido" ou "excluído".
- **A frase honesta é sempre elemento de largura total** — nenhuma delas pode virar `title`,
  tooltip ou placeholder.
- **Alvo ≥44px** para o campo e para o botão de remover (hoje ambos têm 36px de altura).
- Contraste do texto de aviso medido contra o **fundo do card** (`--surface-card`), não contra
  `--bg-base`.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não estimado.** `2.147.483.647` mais o afixo `un` num campo de 96px é
  overflow certo; e a legenda "Total da linha (3000000000×) R$ 36.996.000.000,00" é a linha mais
  longa que este card consegue produzir. Desenhe com ESSES números, não com `3`.
- **Texto ocluso passa em teste.** Uma legenda espremida contra o botão de remover continua
  "visível" para qualquer asserção de texto. A hierarquia tem que ser legível na imagem.
- **Placeholder corta frase** — mais uma razão para o rótulo "Quantidade" ser texto.
- **Três parágrafos cinzas idênticos não são hierarquia**: hoje o único diferenciado é o aviso de
  teto, e ele é justamente o mais raro dos três.

## Entregável

Pranchetas, tema **escuro** primeiro e as duas primeiras repetidas no **claro**:

1. **Cabeçalho do card, 390px** — quatro variações lado a lado: repouso vazio · preenchido com `3` ·
   foco · quantidade de 10 dígitos. Rótulo "Quantidade" visível, campo `tf-inputwrap--sm` de ao
   menos 104px, botão de remover `tf-btn--ghost` com ícone de lixeira e alvo de 44px.
2. **Pilha de avisos, 390px** — as três combinações reais (`custo + qtd 0 + degradada`,
   `custo + aviso de teto + degradada`, `inválida + degradada`), com a hierarquia que você propõe.
   Use `tf-alert--danger` para o inválido **ou** justifique por que ele fica parágrafo; o aviso de
   teto fica em tom `info`, nunca `danger`.
3. **Card completo recolhido, 1280px**, na coluna de peças, ao lado do resumo do kit.
4. **Estados do campo** em linha: repouso · hover · foco · pressionado · desabilitado · com aviso.

Componha com os primitivos existentes: `tf-card` (o card da peça), `tf-inputwrap--sm` +
`tf-input--num` (o campo), `tf-btn--ghost --sm` (remover e expandir), `tf-alert--danger` /
`tf-alert--info` (se a pilha virar alerta), `tf-tnum` (os números das legendas), `tf-badge` se
precisar marcar a peça degradada. **Não crie primitivo novo sem dizer que é novo e por quê** — em
especial: se a resposta for um stepper `−/+`, ele é um primitivo que o DS não tem.

## Perguntas em aberto para o dono

1. **Stepper ou campo livre?** A quantidade é o controle mais mexido do kit e quase todo ajuste é
   ±1, o que pede `−/+` com alvos de 44px; mas digitar `250` num stepper é ruim. Ninguém decidiu, e
   a decisão muda a largura do cabeçalho inteiro.
2. **Quantidade 0 continua sendo um estado válido de permanência?** Hoje a peça fica no kit somando
   zero. A alternativa seria oferecer remover. Se o 0 fica, a legenda atual basta.
3. A frase do teto termina em **"Acima disso o kit não consegue ser salvo. Nada foi recusado."** — o
   fecho de família ("Nada foi recusado") é verdade na digitação e meia-verdade no salvamento.
   Mantém como está, ou esta frase específica ganha outro fecho?
4. **Quantidade vazia / fracionária / com pontos merece mensagem própria?** Hoje cai na frase
   genérica da peça inteira, que manda o vendedor procurar o erro no lugar errado.
