# NumberField — o campo de dinheiro e o instante em que ele reescreve o próprio texto

## O que desenhar

O `NumberField` é o campo mais tocado do Precifica3D: é ele que recebe custo do rolo, tarifa de energia,
valor da máquina, valor da hora, taxa fixa do marketplace, frete, "outros custos" e a quantidade de cada
peça do kit. Ele vive dentro da calculadora (aba **Simulações**), dentro do editor de linha de kit e nas
fichas de catálogo — sempre embrulhado por um rótulo, uma dica e um espaço de erro. O que este prompt pede
não é só a aparência em repouso: é a **anatomia completa + a matriz de estados + a sequência temporal da
máscara de milhar**, isto é, os quadros de antes/depois do instante em que o vendedor sai do campo e o texto
que ele digitou é reescrito na frente dele.

## Por que este prompt existe

O comportamento nasceu no código, datado no próprio arquivo: *"016/PR-C homologação (B2) — todos os campos
currency ganham, consistência"*. Ninguém desenhou o momento. O canvas do dono cobre o componente **nominal**
e até o pior caso de afixos (prefixo `R$` **e** sufixo `/h` na mesma moldura, em "Reserva de manutenção"), e
a especificação §D.1 fala de vírgula decimal, `inputmode`, placeholder e figuras tabulares — **nunca de
separador de milhar nem de reescrita no blur**. Um desenho estático não mostra um instante, e o protótipo
clicável não exercita esse instante. Também foram decididos sem desenho: o piso `min-width: 8rem` da moldura
(defesa contra transbordo em grade de 2 colunas) e o alinhamento **à direita** com figuras tabulares.

## O que já existe hoje (não invente do zero — corrija)

Moldura única (`tf-inputwrap`, altura de controle) com, na ordem: prefixo opcional `R$` → input numérico
alinhado à direita → sufixo opcional. Fora dela, acima, a linha de rótulo (rótulo + `*` obrigatório ou a
etiqueta muda **"opcional"** à direita + o gatilho `?` do InfoTip como irmão do rótulo, nunca dentro dele);
abaixo, a dica **ou** o erro (o erro substitui a dica).

| Campo real | Prefixo | Sufixo | Placeholder | Exemplo verdadeiro |
|---|---|---|---|---|
| "Custo do rolo" (obrigatório) | `R$` | — | `0,00` | `100,00` |
| "Valor da máquina" (obrigatório) | `R$` | — | `0,00` | `4.000,00` (semente já agrupada) |
| "Tarifa de energia" (obrigatório) | `R$` | `/kWh` | `0,00` | `1,00` |
| "Reserva de manutenção" (opcional) | `R$` | `/h` | `0,00` | `1,11` |
| "Valor da hora" / "Valor do acabamento" (opcional) | `R$` | `/h` | `0,00` | `18,75` |
| "Taxa fixa" · "Comissão mínima/item" · "Frete" (canal) | `R$` | — | `0,00` | `4,00` |
| "Comissão" (canal) | — | `%` | `0,00` | `12` |
| "Peso do rolo" · "Gramas usadas" · "Consumo médio" | — | `kg` · `g` · `kW` | `0,00` | `1` · `100` · `0,12` |
| Quantidade da linha de kit (tamanho `sm`) | — | unidade | `1` | `2` |

→ **Problema a resolver:** o rótulo reserva **duas linhas** de altura sempre, só para que "Reserva de
manutenção" (que quebra) não desalinhe a moldura vizinha numa grade de 2 colunas. Desenhe uma solução que
alinhe as molduras sem pagar esse buraco branco em todo campo de rótulo curto.
→ **Problema a resolver:** "Tarifa de energia" com `R$` **e** `/kWh` já espremeu o input até ~1px de largura
visível a 390px. A grade hoje reflui para 1 coluna nesse caso; o desenho precisa dizer **quando** reflui.

## Conteúdo e dados reais

Tudo em pt-BR: vírgula decimal, ponto de milhar, dinheiro como `R$ 1.234,56`. O valor é uma **string**
digitável — a leitura aceita `12345,67`, `12.345,67`, `1500` e `0,12` como o mesmo número, e recusa
`1,234,56`, `5x3`, `10-5`. O teclado móvel abre no modo decimal. Dicas literais que já existem: "Consumo
médio real da impressora, não a potência de placa (~0,12 kW).", "Margem sobre o custo total (não sobre o
preço de venda).", "Descontado do valor recebido (não é embutido no anúncio).", "Embalagem, etiqueta, taxas,
etc. Cada item soma ao custo total.". Erros literais: **"Informe um número válido."**, **"Não pode ser
negativo."**, **"Campo obrigatório."**, **"O peso do rolo deve ser maior que zero."**, **"A comissão deve ser
menor que 100%."**, **"Valor muito alto."**.

## Estados obrigatórios

- **Repouso** — borda neutra, valor à direita em figuras tabulares, afixos em tom apagado (o `R$` um pouco
  mais forte que o sufixo, como é hoje).
- **Vazio** — só o placeholder `0,00` no tom mais fraco; os afixos continuam visíveis.
- **Hover** — borda um passo mais forte, cursor de texto em toda a moldura (a moldura inteira é clicável).
- **Foco** — borda **e** anel na mesma cor, lidos como **um traço só**: um anel de cor diferente da borda já
  apareceu como contorno duplo neste produto, é defeito conhecido.
- **Erro** — borda vermelha que **permanece vermelha mesmo em foco** (com o halo tingido de vermelho), e a
  mensagem literal abaixo, substituindo a dica.
- **Aviso de plausibilidade** (número aceito, provavelmente com outro significado) — tom **informativo**,
  nunca vermelho, dentro do espaço da dica, abaixo dela: *"Confira a reserva de manutenção: R$ 3.600,00 por
  HORA. Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Nada foi recusado."*
  Se houver erro, o aviso some — o produto não avisa sobre a plausibilidade de um número que recusou.
- **Desabilitado** — fundo abafado, opacidade reduzida, cursor bloqueado; afixos junto.
- **Tamanhos** — `sm` (linha de kit), `md` (padrão), `lg`.
- **A sequência da máscara** (o coração deste prompt), em quatro quadros lado a lado com legenda:
  1. foco, digitando: `12345,67` — **sem** ponto de milhar, cursor visível (a máscara nunca roda durante a
     digitação: brigaria com o cursor);
  2. saída do campo: o texto vira `12.345,67`, silenciosamente, sem toast e sem badge;
  3. saída com texto ilegível (`12,34,56`): o texto fica **exatamente como foi digitado** e quem explica é o
     erro "Informe um número válido." — nunca uma reescrita silenciosa;
  4. saída com o campo em branco: nada acontece, o placeholder volta.

## Viewports

- **390px (mobile)** — obrigatório: é onde o vendedor precifica de fato, e é onde a moldura com prefixo +
  sufixo já quebrou. Inclua na mesma prancheta a grade de 2 colunas ("Tarifa de energia" ao lado de "Consumo
  médio") e mostre o ponto em que ela reflui para 1 coluna.
- **1280px (desktop)** — obrigatório: o redesenho 018 coloca esses campos dentro de uma ficha lateral direita
  de ~560px, que é mais estreita que a página; a grade de 2 colunas ali é o caso real, não o de 1920.
- 1920px é dispensável: o comportamento não muda e o canvas do dono já cobre a moldura larga.

## Regras que o desenho não pode quebrar

- A máscara **nunca** altera o significado do número, só a grafia — e nunca "conserta" um valor que o produto
  não entendeu.
- Nada de vermelho para o aviso de plausibilidade: quem lê um aviso escrito como erro conclui que o produto
  recusou, e o produto não recusou. Toda frase de aviso termina em "Nada foi recusado."
- Frase honesta nunca mora em placeholder: o placeholder carrega **só números** (`0,00`, `1`); explicação vai
  na dica ou no erro, que são de largura cheia e não cortam.
- Alvo tocável ≥ 44px de altura na moldura `md`; os afixos não roubam área de toque do input.
- Contraste medido do afixo e do placeholder **contra o fundo real do card**, nos dois temas — o placeholder
  é o texto mais fraco da tela e é o primeiro a falhar.
- O erro é anunciado por leitor de tela; o desenho precisa reservar o espaço dele sem fazer a página pular.

## Armadilhas já pagas neste projeto

- Um valor de 4+ dígitos **sem** máscara aparecendo até o primeiro toque (`R$ 4000,00` na semente) foi
  achado de homologação; hoje a semente já nasce agrupada. Desenhe assumindo que valores grandes existem
  desde o primeiro paint.
- Máscara perdida ao **reabrir uma simulação salva** — o valor voltava cru enquanto o mesmo campo mascarava
  corretamente num blur normal. O desenho deve mostrar o campo restaurado idêntico ao campo pós-blur.
- Transbordo horizontal medido: o piso de largura da moldura evita que ela encolha atrás do conteúdo, mas
  **não** salva o pior caso prefixo+sufixo — esse exige refluxo.
- Texto ocluso passa em teste automatizado: o valor `1.234.567,89` dentro da coluna estreita precisa ser
  desenhado, não presumido.
- Um `?` de ajuda na **mesma linha** do input disputa espaço com o sufixo `/kWh` e come o campo; o gatilho
  fica na linha do rótulo.

## Entregável

Quatro pranchetas, cada uma em **tema escuro (padrão) e claro (first-class)**: (1) **Anatomia** — moldura com
prefixo, sufixo, prefixo+sufixo juntos, e os três tamanhos `sm`/`md`/`lg`; (2) **Matriz de estados** — repouso,
vazio, hover, foco, erro, erro+foco, aviso, desabilitado, com o rótulo obrigatório (`*`) e o opcional
("opcional") lado a lado; (3) **A fita da máscara** — os quatro quadros descritos acima, com legenda curta sob
cada um; (4) **Contexto real** — a grade de "Custos da peça" a 390px e dentro da ficha de 560px a 1280px, com
"Custo do rolo", "Tarifa de energia" e "Reserva de manutenção" preenchidos com números verdadeiros. Reutilize
os primitivos existentes em vez de criar novos: `tf-inputwrap` (moldura, com as variantes `--sm`/`--lg`/
`--error`/`--disabled`), `tf-input--num` (o campo alinhado à direita com figuras tabulares),
`tf-inputwrap__affix` e `tf-inputwrap__affix--strong` (sufixo e prefixo `R$`), `tf-field__label-row`,
`tf-field__req`, `tf-field__optional`, `tf-field__hint`, `tf-field__error`, `tf-field__aviso` (o tom
informativo) e o `InfoTip` já existente para o `?`.

## Perguntas em aberto para o dono

1. A máscara de milhar vale **só** para campos de dinheiro (é o que o código faz hoje) ou também para os
   numéricos grandes sem `R$` — "Vida útil da máquina" com `3600` h e "Gramas usadas"? Hoje eles ficam sem
   ponto, e a mesma tela mostra `4.000,00` ao lado de `3600`.
2. Ao voltar o foco a um campo já mascarado, o texto deve **desagrupar** (`12345,67`, mais fácil de editar
   com o cursor) ou permanecer `12.345,67`? Hoje permanece, e ninguém decidiu isso.
3. A reescrita deve ficar totalmente silenciosa (como hoje) ou merece uma microtransição de ~150ms que dê ao
   vendedor o sinal de que **o produto** mudou o texto e não ele?
