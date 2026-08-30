# Editor da peça, aberto dentro da linha do kit

## O que desenhar
A gaveta que se abre DENTRO do card de uma peça, na aba **Kits** (`/bom`, "Monte seus kits"), quando o
vendedor toca em **"Editar esta peça"**. Ela não é um resumo: é a calculadora inteira — os mesmos campos,
as mesmas seções e o mesmo motor da tela *Calcular* — hospedada dentro de uma linha de uma lista que pode
ter 3, 5 ou 10 peças. Quem usa é o vendedor montando um anúncio de kit e digitando, peça por peça, o custo
de cada uma; ele entra aqui várias vezes na mesma sessão, alternando entre peças. Só uma peça fica aberta
por vez (abrir a segunda fecha a primeira). Precisamos das pranchetas do card ABERTO — o card fechado já
tem desenho, o que ele abre nunca teve.

## Por que este prompt existe
Nada disto foi desenhado. O protótipo de 2026-07-02 cobre a calculadora **como tela solta** (§E4) e não
serve nem de versão anterior: lá a divulgação progressiva são QUATRO seções coláveis nomeadas
(Energia · Máquina/Depreciação · Falha · Marketplace) com a regra "1 aberta + 1 fechada, nunca tudo aberto";
o que está no ar é UMA divulgação única cujo rótulo nasceu de um `join(" · ")` de três títulos de seção que
já existiam — para não escrever copy nova — e os campos obrigatórios sempre visíveis. O desenho de desktop
de 2026-08 (`Abas-Desktop.dc.html`, linha 198) desenha o card fechado e o botão "Editar esta peça", e para
ali: percorrendo as 646 linhas não há nenhum quadro do estado aberto. A autoridade textual (`ux-bom.md`
§1.3/§1.4 e §6.1 item 2) pedia este protótipo exatamente para *"confirm the secondary disclosure keeps the
line short"*, marcado **High** — e ele nunca foi produzido. Ou seja: a única regra de desenho escrita sobre
esta peça é "mantenha a linha curta", e ninguém mediu se ela foi cumprida.

## O que já existe hoje (não invente do zero — corrija)
Ordem exata do que aparece dentro do card aberto, de cima para baixo:

| # | Bloco | Conteúdo real |
|---|---|---|
| 1 | Card do seletor de produto | Rótulo "Usar produto salvo", um select cujo primeiro item é "— Manual —"; abaixo, quando há produto ligado, a legenda "do catálogo: {nome}" ou "do catálogo: {nome} · ajustado por você" |
| 2 | Título de seção | "Custos da peça" + ⓘ ("Sobre os custos da peça") |
| 3 | Card com grade de campos obrigatórios | 5 campos em `tf-costs-grid` (colunas de no mínimo 170px) |
| 4 | Tempo de impressão | Dois campos lado a lado: horas ("h") e minutos ("min") |
| 5 | Pergunta de custo de máquina | "Valor da máquina" + dois selects: "Com que frequência ela roda?" e "Em quantos anos quer que ela se pague?", com a legenda derivada "≈ R$ 0,83 por hora de impressão" e o link "Ajustar horas direto" |
| 6 | Seção Markup | "Markup" + ⓘ, dois campos ("Markup varejo", "Markup atacado") |
| 7 | **O botão de divulgação** | Uma linha de texto secundário com chevron e o rótulo **"Mão de obra · Outros custos · Marketplace"** |
| 8 | (quando aberto) | Card com "Reserva de manutenção" e "Taxa de falha" — **sem título nenhum** · seção "Mão de obra e custos" (4 campos) · seção "Outros custos" (lista 0..N, "Adicionar custo") · seção "Marketplace" com o interruptor "Incluir marketplaces no preço" e os canais |
| 9 | Resultado da peça | "Como chegamos no preço" + card de detalhamento (Material · Energia · Máquina · Falha / perdas · Acabamento · Mão de obra · cada "outro custo" · **Custo total** · **Preço varejo** · Preço atacado) — ou, se algo estiver inválido, um alerta de perigo com "Confira os campos destacados para ver o preço." |
| 10 | (depois do editor, ainda no card) | O campo "Nome da peça no catálogo" quando a peça vai virar item do catálogo, precedido de "Você ajustou esta peça — ela será salva como uma peça nova no catálogo." |

→ **O rótulo do item 7 é o problema central deste prompt.** "Mão de obra · Outros custos · Marketplace"
não é um nome, é uma lista de três nomes; e ele mente por omissão, porque também esconde "Reserva de
manutenção" e "Taxa de falha", que não aparecem no rótulo. Desenhe a alternativa (veja as perguntas ao
dono).
→ **Profundidade**: hoje é Card (a linha) → Card (o seletor) / Card (custos) / Card (markup) / Card
(detalhamento). Quatro molduras aninhadas, todas com a mesma borda e o mesmo fundo. Precisa de hierarquia
visual — não de mais bordas.
→ **Altura**: com a divulgação aberta e dois canais, este bloco passa de duas telas de 390px. Nada segura
o topo: ao rolar, o vendedor perde de vista de qual peça se trata.
→ **O resultado da peça não se distingue do total do kit**: os dois usam "Custo total" e "Preço varejo",
com a mesma tipografia, na mesma tela.
→ **Os canais de marketplace são preenchidos aqui e não devolvem preço aqui**: o bloco "Preços por canal"
não é renderizado dentro da linha (só o rollup do kit, na coluna da direita, mostra "Preços por canal
(kit)"). O vendedor digita comissão, taxa fixa e frete de um canal e não vê o anúncio daquela peça em
lugar nenhum.

## Conteúdo e dados reais
Campos obrigatórios sempre visíveis (item 3), com unidade e exemplo verdadeiro:
"Custo do rolo" `R$ 120,00` · "Peso do rolo" `1` kg · "Gramas usadas" `45` g · "Consumo médio" `0,12` kW
(dica sob o campo: "Consumo médio real da impressora, não a potência de placa (~0,12 kW).") ·
"Tarifa de energia" `R$ 0,85` /kWh. Cada um tem um ⓘ no fim da linha do RÓTULO — nunca dentro da linha do
input (a dica competindo com o sufixo "/kWh" já espremeu "Tarifa de energia" a 1px de campo visível).
Tempo: "Tempo de impressão" = `3` h + `40` min. Máquina: "Valor da máquina" `R$ 2.500,00`.
Markup: "Markup varejo" `100` % (dica "Margem sobre o custo total (não sobre o preço de venda).") e
"Markup atacado" `60` %. Opcionais escondidos: "Reserva de manutenção" `R$ 0,50` /h · "Taxa de falha" `8` %
· "Tempo de acabamento" `0,25` h · "Valor do acabamento" `R$ 20,00` /h · "Mão de obra (horas)" `0,33` h ·
"Valor da hora" `R$ 18,75` /h. "Outros custos": itens nomeados, placeholder "Ex.: Embalagem", valor
`R$ 3,50`. Resultado de exemplo de uma peça: Material `R$ 5,40` · Energia `R$ 0,37` · Máquina `R$ 3,04` ·
Falha / perdas `R$ 0,71` · Acabamento `R$ 5,00` · Mão de obra `R$ 6,19` · **Custo total `R$ 24,21`** ·
**Preço varejo `R$ 48,42`** (legenda "markup 100%") · Preço atacado `R$ 38,74` (legenda "markup 60%").
No cabeçalho da linha, que continua visível com a peça aberta: "Peça 1 · Suporte de celular", campo
"Quantidade" com sufixo "un", e a legenda "R$ 24,21 /un · Total da linha (2×) R$ 48,42".

## Estados obrigatórios
- **Fechado** (referência): a linha resumida com o botão "Editar esta peça"; aberto, o rótulo vira
  "Recolher" e o chevron aponta para cima.
- **Divulgação fechada** (padrão ao abrir) e **divulgação aberta** — as duas pranchetas, para se poder
  medir a altura de cada uma.
- **Repouso / foco / hover / pressionado** nos dois botões-linha (o cabeçalho da peça e o da divulgação):
  ambos são áreas de toque de largura inteira, mínimo 44px de altura, e o foco precisa de anel visível
  contra o fundo do CARD, não o da página.
- **Peça inválida**: o resultado vira alerta de tom perigo com "Confira os campos destacados para ver o
  preço."; no cabeçalho aparece "Confira os campos desta peça — ela não entra no total até ser corrigida."
- **Aviso de plausibilidade** (não é erro; nada foi recusado): sob o campo, ex. "Confira o consumo: 120 kW.
  Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma
  trazer watts: 120 W são 0,12 kW. Nada foi recusado." Precisa de tom próprio, distinto do erro vermelho de
  validação, e o campo continua editável.
- **Peça vinda do catálogo** e **peça ajustada depois de vinda do catálogo**: as legendas do item 1, mais
  "Você ajustou esta peça — ela será salva como uma peça nova no catálogo."
- **Peça degradada** (o produto de origem sumiu do catálogo): legenda calma, valores mantidos e editáveis;
  a frase NUNCA diz "removido" nem "excluído".
- **Quantidade 0**: "Quantidade 0 — não entra no total."
- **Taxas desatualizadas / falha de rede**: o alerta vive no topo da PÁGINA, não dentro da linha ("Não foi
  possível atualizar as taxas" + "Usando a referência salva no dispositivo — o cálculo continua
  funcionando. Você também pode informar as taxas manualmente." + "Tentar novamente"). Desenhe a linha
  sabendo que esse bloco pode estar acima dela, empurrando tudo para baixo.
- **Sem estado premium aqui**: o portão do Premium é da página inteira, antes desta peça existir. Não
  desenhe cadeado, borrão nem teaser dentro da linha.

## Viewports
**390px** (obrigatório, é onde dói): a grade de custos cai para uma coluna e é aqui que a altura do card
aberto precisa ser medida em telas. **1280px**: a página vira duas colunas — peças à esquerda, resumo do
kit à direita numa coluna de 480px que gruda ao rolar; o card da peça passa a ter ~700–800px de largura e a
grade de custos ganha 3–4 colunas. Desenhe as duas larguras da MESMA peça aberta, com os MESMOS dados, para
se poder comparar a altura resultante. 1920px pode ser derivado de 1280px (a coluna do resumo não cresce).

## Regras que o desenho não pode quebrar
- O número tem de dizer **de onde veio**: "do catálogo: {nome}" e "· ajustado por você" são selo de
  procedência, não decoração — não podem virar um ícone mudo.
- **Aviso nunca vira erro**: toda frase de plausibilidade termina em "Nada foi recusado." e o desenho tem de
  sustentar isso — se ela ficar vermelha ao lado de uma validação vermelha, o vendedor conclui que o
  produto recusou, e o produto não recusou.
- **Falha de rede nunca é vendida como "não é premium"** e nunca bloqueia: o cálculo segue com a referência
  salva no aparelho.
- Frase honesta mora em elemento de largura inteira, **nunca em placeholder** (placeholder carrega só
  número) — as legendas do item 5 e da seção de marketplace são compridas de propósito.
- Alvo de toque ≥44px nos dois botões-linha e no "x" de remover peça; contraste medido contra o fundo do
  card, que já é mais claro/escuro que o fundo da página.
- Uma peça aberta por vez: o desenho não pode depender de duas abertas para fazer sentido.

## Armadilhas já pagas neste projeto
- **Rolagem medida nos DOIS eixos**: uma versão anterior desta área vazou no eixo vertical interno e o
  navegador headless não enxerga barra clássica. Nada aqui pode transbordar em 390px.
- **Valor grande estoura a coluna**: `R$ 1.234.567,89` num campo ou numa linha de detalhamento já quebrou
  layout antes — entregue pelo menos uma prancheta com um valor de 7 dígitos.
- **Texto ocluso passa em teste**: um rótulo coberto ou cortado continua "visível" para o teste. O ⓘ ao
  lado de "Tarifa de energia" é exatamente esse caso.
- **Rótulo cortado**: "Poucas horas por semana" mede ~197px e é a opção mais larga do select de ritmo;
  "Em quantos anos quer que ela se pague?" quebra em duas linhas e desalinha o select vizinho se os dois
  rótulos não reservarem a mesma altura.
- **Prefixo duplicado**: o nome da peça já pode conter "Peça 1 · " — o cabeçalho não repete o prefixo.

## Entregável
Pranchetas em tema **escuro** (padrão) e **claro** (first-class — as duas, não uma amostra):
1. Card aberto com a divulgação fechada, 390px. 2. Card aberto com a divulgação aberta e um canal de
marketplace preenchido, 390px (é a prancheta que mede a altura real). 3. Card aberto com a divulgação
fechada, 1280px, com o resumo do kit visível à direita. 4. Card aberto em estado inválido + um aviso de
plausibilidade, 390px. 5. Detalhe do botão de divulgação nos quatro estados
(repouso/hover/foco/pressionado), com o rótulo que você propuser. 6. Detalhe do bloco de resultado da peça,
mostrando como ele se distingue visualmente do total do kit.
Reutilize os primitivos existentes, sem criar novos: `tf-card` para as molduras (e proponha qual nível
perde a borda), `tf-field`/`tf-inputwrap`/`tf-input` para cada campo com seu sufixo de unidade,
`tf-costs-grid` para a grade de custos, `tf-brow` para cada linha do detalhamento, `tf-price` para
varejo/atacado, `tf-alert` (`--danger` no inválido, `--info` nos avisos), `tf-btn--ghost tf-btn--sm` para o
cabeçalho e o remover, `tf-badge` se precisar marcar procedência, `tf-tnum` em todo número.

## Perguntas em aberto para o dono
1. **Como esse botão deve se chamar?** Hoje é "Mão de obra · Outros custos · Marketplace" — três títulos
   colados — e ele esconde também manutenção e taxa de falha. Um nome único ("Mais ajustes desta peça"?)
   ou a volta às seções nomeadas separadas do protótipo de 2026-07?
2. **Uma divulgação ou várias?** O protótipo antigo mandava "1 aberta + 1 fechada, nunca tudo aberto".
   Vale a mesma regra dentro de uma linha de kit, ou aqui a divulgação única é a decisão certa?
3. **O que fica aberto por padrão quando a peça vem do catálogo?** Ela já chega preenchida — abrir os
   campos obrigatórios pode ser ruído.
4. **O vendedor precisa ver o preço de canal POR PEÇA?** Hoje só existe o total por canal do kit; ele
   digita as taxas na peça e o retorno aparece a uma coluna de distância.
5. **Marketplace deveria estar dentro da peça?** É o único bloco aqui que fala do ANÚNCIO (que é do kit
   inteiro), não do custo da peça.
