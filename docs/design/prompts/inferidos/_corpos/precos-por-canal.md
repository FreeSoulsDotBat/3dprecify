# Preços por canal — a comparação que hoje é uma pilha

## O que desenhar

O bloco **"Preços por canal"**, que vive hoje na CAUDA do card da seção **"Como chegamos no preço"**, na
tela Calcular (e nas mesmas seções reaproveitadas em Produto e em Kits). É o último número que o vendedor
lê antes de decidir: depois de ver o custo se formar linha a linha e o preço de venda sair do markup, ele
precisa saber **por quanto anunciar em cada marketplace e quanto sobra em cada um**. Quem usa: o vendedor
que já cadastrou 1 a N canais (Mercado Livre, Shopee, Amazon, Outro) com suas taxas, no momento em que
compara onde vale a pena anunciar. Desenhe o bloco e a sua relação com o card do detalhamento que o
antecede e com os dois cards de preço final que o sucedem.

## Por que este prompt existe

A forma atual foi inferida por IA, não desenhada: até 016/US5 o bloco era uma **seção titulada própria**;
a implementação a fundiu DENTRO do card do detalhamento, empilhou os canais separados por uma linha de
1px, e repetiu o par varejo+atacado dentro de cada canal. O protótipo de 2026-07-02 (`CalculatorScreen.jsx`,
§E4) desenha "taxa de marketplace (negativa) → líquido" como duas linhas de um breakdown ÚNICO, **para um
canal só** — ele nunca resolveu multicanal. E o próprio dono, quando desenhou este conteúdo no canvas
desktop de 018 (aba Orçamentos e aba Kits), o fez como **card SEPARADO ao lado do "Detalhamento"**, com
nome do canal + anúncio + líquido, **sem** o par varejo/atacado. Ou seja: existe forma desenhada para este
conteúdo, em outra aba, e a Calcular não a segue. Este prompt existe para resolver essa contradição.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual dentro do único card de "Como chegamos no preço":

1. Linhas de custo: "Material", "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra",
   0..N linhas de "Outros custos" nomeadas pelo usuário (fallback "Outros custos").
2. "Custo total" (ênfase `total`).
3. "Preço varejo" (ênfase `accent`, sublinha "markup 100%") e "Preço atacado" (sublinha "markup 50%").
4. **→ Aqui, colado, sem respiro:** um divisor `borderTop 1px` e o rótulo pequeno **"Preços por canal"**
   (mesmo peso/tamanho de um rótulo de canal — não parece um título de bloco).
5. Para cada canal, em pilha vertical, separados por outro `borderTop 1px`:
   - Cabeçalho: **"Mercado Livre · Clássico"** — nome em `--fw-semibold`/`--text-strong`, modalidade em
     peso regular e `--text-muted`, coladas por " · ".
   - Legenda **"Varejo"**, depois as linhas "Preço para anunciar", opcionalmente "Frete" (negativa, só
     se o vendedor digitou frete), "Recebido líquido".
   - Legenda **"Atacado"**, com as mesmas três linhas.
   - Se houve frete: a legenda "Descontado do valor recebido (não é embutido no anúncio)."

**→ Problemas a resolver no desenho:**

- **→ Não há comparação.** Três canais viram três pilhas idênticas de 6–8 linhas; o vendedor precisa
  varrer verticalmente ~50 linhas para responder "onde recebo mais?". O take-away do multicanal não tem
  forma.
- **→ O bloco está dentro de um card que já carrega 10+ linhas de custo**, com a mesma tipografia de
  linha (`tf-brow`), então "Recebido líquido" pesa visualmente o mesmo que "Energia".
- **→ O rótulo "Preços por canal" não se distingue** do rótulo de cada canal logo abaixo — mesmo estilo.
- **→ A procedência mora longe do número:** os selos de honestidade ("Referência", "atualizada em…",
  "ajustado por você", "estimativa de frete") ficam no card de ENTRADA do canal, acima; a linha de preço
  aparece sem nenhuma marca de onde veio a taxa.

## Conteúdo e dados reais

| Elemento | Rótulo literal | Tipo / formato | Observação |
|---|---|---|---|
| Título do bloco | "Preços por canal" | texto | hoje minúsculo demais |
| Canal | "Mercado Livre" · "Shopee" · "Amazon" · "Outro" | texto | fallback: "Canal" |
| Modalidade | "Clássico" · "Premium" · "Profissional" · "Individual" | texto, opcional | pode não existir (Shopee) |
| Nível | "Varejo" / "Atacado" | legenda | sempre os dois |
| Anúncio | "Preço para anunciar" | R$ pt-BR, 2 casas | ex.: R$ 34,63 |
| Frete | "Frete" | R$ negativo, ênfase `muted` | **só existe se o vendedor digitou frete** |
| Líquido | "Recebido líquido" | R$ pt-BR | ex.: R$ 24,24; pode ser NEGATIVO |

Exemplo verdadeiro e completo para as pranchetas (custo total R$ 12,12, markup varejo 100% ⇒ preço varejo
R$ 24,24, atacado 50% ⇒ R$ 18,18):

- **Mercado Livre · Clássico** — Varejo: anunciar R$ 34,63 · Recebido líquido R$ 24,24. Atacado:
  anunciar R$ 26,44 · Recebido líquido R$ 18,18.
- **Shopee** — Varejo: anunciar R$ 31,50 · Frete −R$ 12,00 · Recebido líquido R$ 12,24. Atacado:
  anunciar R$ 24,90 · Frete −R$ 12,00 · **Recebido líquido −R$ 1,20** (caso real e obrigatório).
- **Amazon · Individual** — Varejo sem tarifa publicada para a faixa (estado abaixo).

Caso extremo que precisa caber: **R$ 6.000.061,60** (o produto já produz esse número — há aviso próprio
para custo absurdo). Desenhe a coluna de valor com esse comprimento em mente.

## Estados obrigatórios

- **Canal precificado (repouso)** — as linhas acima.
- **Canal sem comissão informada** — nada de números; a frase exata: *"Informe a comissão do canal para
  ver os preços."*
- **Canal com erro nos campos** — *"Corrija os campos deste canal para ver os preços."* (o canal irmão
  continua mostrando preços; um canal ruim nunca apaga os outros).
- **Nível sem tarifa publicada** (só varejo, só atacado, ou os dois — eles caem em faixas diferentes) —
  em tom de alerta: *"Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do
  canal para precificar."* **Jamais R$ 0,00 no lugar.**
- **Líquido negativo** — o valor em `--danger-text` com o sinal "−", e abaixo: *"Canal não-lucrativo neste
  preço (frete maior que a margem)."*
- **Com frete digitado** — a linha "Frete" negativa em `muted` + a legenda *"Descontado do valor recebido
  (não é embutido no anúncio)."*
- **Bloco ausente** — sem canal ativo (toggle desligado ou nenhum slot) o bloco e seu título **somem por
  inteiro**; nada de card vazio.
- **Sem permissão (free)** — o vendedor sem Premium não chega aqui: o toggle "Incluir marketplaces no
  preço" fica desabilitado com a razão ao lado, *"Vender em marketplaces faz parte do Premium."*.
  Desenhe esse estado do bloco: ausência total, não números borrados/censurados.
- **Referência desatualizada / offline** — a taxa vem do catálogo salvo no aparelho; o número existe e é
  honesto. Desenhe onde a marca de procedência ("Referência · atualizada em 06/08/2026", "referência
  embutida (offline)", "ajustado por você", "estimativa de frete") aparece **perto do preço**, não só no
  campo de entrada.
- **Aviso irmão logo abaixo do card** — quando atacado > varejo: *"O preço de atacado ficou acima do
  varejo. Nada foi recusado — só confira se é isso mesmo."* (tom `info`, nunca erro).

## Viewports

- **390px** — obrigatório: é a tela primária do produto e onde a pilha dói mais. Mostre 3 canais.
- **1280px** — obrigatório: a Calcular também roda no desktop, e é onde a comparação lado a lado se torna
  possível; concilie com a forma que o dono já desenhou em 018 (card "Preços por canal" **ao lado** do
  card "Detalhamento", numa grade 1fr-1fr).
- **1920px** opcional, só se a solução de 1280 mudar de forma.

## Regras que o desenho não pode quebrar

- **Freemium é binário:** ou o bloco existe inteiro, ou não existe. Nada de preview desfocado.
- **Procedência do número:** todo preço de canal nasce de uma taxa que tem origem e data; se a origem é
  fraca (referência embutida, estimativa, ajustado pelo usuário), isso é dito por escrito.
- **Degradação dita, nunca escondida:** faixa sem tarifa publicada vira frase, nunca R$ 0,00.
- **Falha de rede nunca vira "não é premium":** catálogo desatualizado continua calculando.
- **Frase honesta nunca em placeholder** e nunca em elemento estreito que a corte — elas vivem em
  elementos de largura total.
- **Alvo ≥44px** para qualquer coisa clicável (um seletor/aba de canal, se você propuser um).
- **Contraste medido contra o fundo real do card**, incluindo o `muted` da modalidade e da linha de frete.

## Armadilhas já pagas neste projeto

- **Grade fixa 1fr-1fr estourou preço de 6 dígitos** em 360px: o número quebrou no meio do dígito para a
  página não rolar. Qualquer coluna de valor precisa de piso medido, não chutado.
- **Overflow horizontal medido:** o eixo Y também — headless não enxerga scrollbar clássica. Nada pode
  criar rolagem lateral em 390px.
- **Texto ocluso passa em teste**: `toBeVisible` não vê elemento coberto; a legibilidade aqui é geometria,
  não string.
- **Divisor de 1px como única hierarquia** já produziu leituras erradas: o rótulo "Preços por canal" hoje
  é indistinguível de um nome de canal.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como first-class** (o mesmo conjunto nos dois):

1. **390px — repouso**, 3 canais precificados, incluindo um com frete e um com líquido negativo.
2. **390px — estados**: canal sem comissão, canal com erro, nível sem tarifa publicada.
3. **1280px — a comparação**: o bloco como card próprio ao lado do "Detalhamento", coerente com o canvas
   018; mostre como 3 canais se comparam sem varredura vertical.
4. **1280px — bloco ausente** (free / toggle desligado) mostrando o que o card do detalhamento vira.

Reutilize os primitivos existentes, sem criar novos: `Card` para o contêiner, `tf-brow` (`BreakdownRow`)
com `label`/`sublabel`/`value` e as ênfases que já existem — `muted` para o frete, `negative` para o
líquido negativo, `accent`/`total` reservadas ao que já as usa —, `Alert tone="info"` para o aviso de
atacado acima do varejo, e o selo de taxa (`FeeSeal`) para a procedência. Se propuser uma nova forma de
comparação (tabela, abas de canal, colunas), construa-a com esses mesmos primitivos e explique em uma
linha por que a pilha atual não serve.

## Perguntas em aberto para o dono

1. **Varejo + atacado por canal, ou só um nível?** O canvas 018 (Orçamentos e Kits) mostra por canal
   apenas "anúncio" e "líquido" — sem o par varejo/atacado. A Calcular mostra os dois. Qual é a verdade?
   (Se for só um nível, qual: o varejo?)
2. **Card próprio ao lado do "Detalhamento" também na Calcular**, como no canvas 018, ou o bloco continua
   fundido na cauda do mesmo card (decisão de 016/US5)?
3. **Existe canal "vencedor"?** Marcar visualmente o de maior líquido ajudaria a decisão — mas é uma
   recomendação do produto, e "maior líquido" pode não ser o melhor canal (volume, prazo, risco). O dono
   quer que o produto aponte, ou apenas apresente?
