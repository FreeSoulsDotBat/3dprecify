# "Não dá para calcular" — o rodapé de resultado quando o formulário está inválido

## O que desenhar

O estado da tela **Calcular preço** (aba Calculadora) no momento em que um campo obrigatório fica vazio,
com letra ou com um valor que a regra recusa (peso do rolo = 0, vida útil = 0, número negativo). Quem usa é
o vendedor no meio da digitação — ele veio à tela por causa da metade de baixo (o detalhamento "Como
chegamos no preço" e os dois cartões de preço), e é exatamente essa metade que muda de estado. A peça é o
bloco de rodapé inteiro (`.tf-calc-footer`), que atravessa as duas colunas no desktop e fecha a página no
mobile. O mesmo estado aparece em mais três lugares com o mesmo texto: a página cheia do produto, o editor
de linha de kit e o resumo de kit — o desenho vale para os quatro.

## Por que este prompt existe

Ninguém desenhou este estado: uma IA decidiu que a resposta a um input inválido é **apagar o resultado
inteiro** e pôr no lugar um único alerta vermelho. Pior, o desenho já tinha decidido o contrário e isso foi
verificado em render: o item 9 do `claude-design-prototype-fixes.md` manda "além do alerta, **zere TODAS as
linhas do breakdown**", e o `prototype-audit-2026-07-02.md` §V2 lista esse item entre os 20 corrigidos e
medidos ("peso=0 zeroes breakdown") — o protótipo `CalculatorScreen.jsx` mantinha os cartões de preço e as
linhas do detalhamento em 0,00 **com o alerta junto**. O código de hoje remove o bloco. Duas ressalvas
honestas: o protótipo só desenhou o caso peso do rolo = 0, e o código de hoje cobre qualquer invalidez do
formulário — então o desenho precisa decidir a regra geral, não só aquele caso.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual da tela, de cima para baixo: cabeçalho "Calcular preço" → o formulário em grade (uma coluna até
1024px, duas acima) com as seções "Custos da peça", "Mão de obra e custos", "Markup" e "Marketplace" → o
rodapé de resultado.

Rodapé no estado **válido** (o que existe e o que some):

| Bloco | Conteúdo real |
| --- | --- |
| Título de seção | "Como chegamos no preço" + botão ⓘ "Sobre o cálculo do preço" |
| Aviso de resultado | avisos de plausibilidade (ex.: "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado.") |
| Card do detalhamento | linhas "Material", "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra", cada item de "Outros custos" pelo nome, depois "Custo total" (ênfase total), "Preço varejo — markup 50%" (ênfase accent) e "Preço atacado — markup 30%" |
| Preços por canal | dentro do mesmo card, sob a legenda "Preços por canal": "Preço para anunciar" e "Recebido líquido" por canal |
| Dois cartões de preço | "Preço varejo" R$ 24,24 (tom accent) e "Preço atacado" R$ 21,01 (tom energy), rótulo/valor/legenda centralizados |
| Ações | "Salvar cenário" e o botão de gravar orçamento (ambos Premium; ausentes no plano gratuito) |

Rodapé no estado **inválido**, hoje: tudo isso acima é substituído por **um** alerta de tom `danger` com a
frase `"Confira os campos destacados para ver o preço."` — e só. O botão "Salvar cenário" continua ali,
desabilitado; o botão de gravar orçamento desaparece por completo.

→ **Problema 1**: o alerta promete "campos destacados", mas ele mora no fim da página e não aponta,
não lista e não leva a campo nenhum. No mobile o campo culpado costuma estar fora da tela, acima.
→ **Problema 2**: a tela inteira encolhe de repente (o rodapé passa de ~700px de conteúdo para uma tarja de
~60px) — o vendedor lê isso como "travou/quebrou", não como "falta preencher".
→ **Problema 3**: os avisos de plausibilidade moram DENTRO do bloco que some, então uma tela inválida
perde também os avisos honestos que ela mais precisaria mostrar.
→ **Problema 4**: a mesma frase aparece com tom `danger` em três telas e com tom `info` no resumo de kit —
um mesmo fato com duas temperaturas diferentes.

## Conteúdo e dados reais

Campos que podem derrubar o resultado inteiro (obrigatórios ou pré-preenchidos; em branco já é erro):
"Custo do rolo" (R$, ex.: R$ 100,00), "Peso do rolo" (kg, ex.: 1), "Gramas usadas" (g, ex.: 100), "Tempo de
impressão" (h/min, ex.: 5 h), "Consumo médio" (kW, ex.: 0,12), "Tarifa de energia" (R$/kWh, ex.: R$ 1,00),
"Valor da máquina" (R$, ex.: R$ 4.000,00), "Vida útil da máquina" (h, ex.: 3.600), "Markup varejo" (%,
ex.: 50) e "Markup atacado" (%, ex.: 30).

Campos **opcionais** — em branco valem 0 e nunca derrubam nada: "Reserva de manutenção", "Taxa de falha",
"Tempo de acabamento", "Valor do acabamento", "Mão de obra (horas)", "Valor da hora", "Outros custos".

Mensagens de erro literais, que aparecem sob o campo e **substituem a dica** dele: `"Campo obrigatório."`,
`"Informe um número válido."`, `"Não pode ser negativo."`, `"O peso do rolo deve ser maior que zero."`,
`"A vida útil deve ser maior que zero."`.

Contraste importante: um erro num **canal de marketplace** NÃO derruba o preço — aquele canal mostra
`"Corrija os campos deste canal para ver os preços."` e o resto da tela continua calculando. A mesma
degradação local existe para "Outros custos" (uma linha ruim erra sozinha). Só os campos de custo/markup
acima apagam tudo.

Números da semente (conferidos rodando o motor, não chutados): custo total **R$ 16,16**, varejo
**R$ 24,24**, atacado **R$ 21,01**. Use exatamente esses no estado válido de referência, e mostre o mesmo
cenário quebrado — por exemplo "Peso do rolo" apagado — no estado inválido.

## Estados obrigatórios

- **Válido (referência)** — o rodapé completo com R$ 24,24 / R$ 21,01, para comparação lado a lado.
- **Inválido, um campo** — o estado central deste prompt: o que fica visível no lugar do resultado, o que
  o alerta diz e como ele aponta o campo. Frase de hoje: "Confira os campos destacados para ver o preço."
- **Inválido, vários campos** — desenhe com 3 campos errados ao mesmo tempo; se a solução for listar os
  culpados, ela precisa aguentar 3 nomes sem virar parágrafo.
- **Campo em erro** — rótulo + controle + a mensagem literal ocupando o lugar da dica; e o mesmo campo em
  foco enquanto ainda está errado (anel de foco visível sobre a borda de erro).
- **Recuperação** — o instante em que o campo volta a ser válido: o resultado reaparece. Diga se ele
  reaparece inteiro de uma vez ou se há transição.
- **Premium pausado / plano gratuito** — no gratuito não existem "Salvar cenário" nem gravar orçamento;
  desenhe o rodapé inválido sem essas ações, para provar que ele não fica com um vazio pendurado.
- **"Salvar cenário" desabilitado** — é o estado real de hoje enquanto o formulário está inválido: um botão
  Premium desabilitado ao lado de um alerta vermelho, sem uma linha dizendo por quê.

## Viewports

- **Mobile 390px** — é onde o dano é maior: o rodapé é o fim de uma página longa, e o campo culpado está
  fora da tela. Desenhe com o teclado fora e o rodapé visível.
- **Desktop 1280px** — a partir de 1024px o formulário tem duas colunas e o rodapé atravessa as duas,
  centralizado e limitado a 720px de largura. É o corte do redesenho 018, então é o desktop que vale.

## Regras que o desenho não pode quebrar

- **Nenhum número inventado.** Se o desenho mantiver o detalhamento no lugar (item 9), cada linha precisa
  deixar claro que aquilo é um esqueleto sem cálculo — um "R$ 0,00" cheio de aparência de resultado é uma
  mentira pior que o sumiço. Zerar e **dizer que está zerado** é a única leitura aceitável.
- **Falha de preenchimento não é falha de rede nem de plano.** Nada aqui pode parecer "sem internet",
  "assine o Premium" ou "deu erro no servidor" — nada foi recusado por nós; falta um dado.
- **A frase honesta mora em elemento de largura cheia**, nunca dentro de um placeholder e nunca cortada.
- **O alerta tem que cumprir o que promete**: se o texto diz "campos destacados", o destaque tem que existir
  e ser alcançável a partir dali.
- **Alvo de toque ≥ 44px** em qualquer coisa clicável dentro do alerta; contraste medido contra o fundo real
  do card, nos dois temas.
- Precedente de tom já ratificado neste produto: o aviso de atacado acima do varejo é `info`, e a razão foi
  escrita em código — "quem lê um aviso escrito como erro conclui que o produto recusou". Aqui o produto de
  fato não calculou, mas a mesma leitura precisa ser considerada antes de pintar tudo de vermelho.

## Armadilhas já pagas neste projeto

- **Sumiço lido como quebra**: já aconteceu nesta mesma tela — a persona que acha que travou recarrega a
  página. O desenho precisa ocupar o espaço com algo que explique, não deixar um buraco.
- **Overflow horizontal medido, não olhado**: os cartões de preço já quebraram um número no meio do dígito
  a 360px; qualquer lista de campos culpados precisa quebrar linha, nunca empurrar a página.
- **Texto ocluso passa em teste**: um alerta correto atrás de um cabeçalho fixo, ou fora da viewport no
  momento em que aparece, é indistinguível de "certo" para qualquer asserção de texto — desenhe onde ele
  fica visível sem rolagem no mobile.
- **Frase cortada em placeholder**: nunca resolver o "qual campo" escrevendo a explicação dentro do campo.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de primeira classe**:

1. `390 · rodapé válido` (referência, R$ 24,24 / R$ 21,01).
2. `390 · rodapé inválido, um campo` — a proposta central.
3. `390 · rodapé inválido, três campos`.
4. `390 · campo em erro + foco` (recorte do formulário, mostrando o vínculo com o alerta).
5. `1280 · rodapé inválido` no rodapé centralizado de 720px, com o formulário de duas colunas acima.
6. `1280 · rodapé inválido, plano gratuito` (sem as ações Premium).

Reutilize os primitivos existentes, sem criar novos: `Alert` para a tarja (tom a decidir, ver perguntas),
`Card padding="md"` para o detalhamento mantido/zerado, a linha de detalhamento existente para
"Material/Energia/Máquina/Custo total", o cartão de preço existente para "Preço varejo"/"Preço atacado",
`Field` para os campos em erro (a mensagem entra no slot de erro que substitui a dica) e `Button` para
qualquer ação dentro do alerta. Marque em cada prancheta o que é novo em relação ao código de hoje.

## Perguntas em aberto para o dono

1. **Mantém o bloco zerado (item 9 do protótipo) ou mantém o sumiço de hoje?** O item 9 foi ratificado e
   verificado em render, mas só para "peso do rolo = 0". Zerar todo o detalhamento quando falta o "Custo do
   rolo" mostra "Material R$ 0,00" — um número que o motor nunca calculou. Vale para qualquer invalidez, só
   para as que zeram de verdade, ou o esqueleto aparece com traços ("—") no lugar dos valores?
2. **O tom é `danger` (vermelho) ou `info`?** Faltar preencher um campo é erro do vendedor ou etapa normal
   de digitação? O precedente do aviso de atacado escolheu `info` de propósito.
3. **O alerta deve nomear os campos culpados** ("Peso do rolo", "Tarifa de energia") e levar até eles ao
   toque? Se sim, qual a frase — a atual ("Confira os campos destacados para ver o preço.") deixa de ser
   verdade quando os campos passam a ser nomeados.
4. **"Salvar cenário" desabilitado continua visível** enquanto não há preço, ou some junto com o botão de
   gravar orçamento (que já some hoje)? Hoje os dois se comportam de formas diferentes sem motivo escrito.
