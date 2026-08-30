# Quando o canal não tem preço: as quatro recusas de "Preços por canal"

## O que desenhar
Dentro da calculadora, no fim do cartão "Como chegamos no preço", existe o bloco **"Preços por canal"**: um
bloco por marketplace ativo (Mercado Livre · Shopee · Amazon · Outro), cada um mostrando duas seções —
"Varejo" e "Atacado" — com as linhas "Preço para anunciar" e "Recebido líquido". Esta peça é o que aparece
**no lugar desses números quando o produto se recusa a dar um preço**: (a) faixa de preço sem tarifa
publicada, (b) líquido negativo, (c) canal válido mas sem comissão informada, (d) canal com campo inválido.
Quem lê é o vendedor logo depois de preencher os custos, no momento em que ele desce a tela procurando o
número que vai colar no anúncio — e encontra uma frase. Hoje as quatro são parágrafos soltos, sem ícone,
sem moldura e sem hierarquia própria, escolhidos por um agente sem desenho.

## Por que este prompt existe
A matriz §G do protótipo de 2026-07-02 (linha 317) cobre "Resultado/breakdown" com cinco estados —
loading=skeleton, empty=**zerado (0,00)**, error=—, success=preço+breakdown, offline=mantém cálculo. Ela
**não prevê recusa de precificação; prevê o oposto**. E o "zerado 0,00" que ela manda desenhar é exatamente
o que o produto hoje **proíbe** (SC-817: imprimir R$ 0,00 sob selo de "Referência" custaria uma venda ao
vendedor). Ou seja: o código contraria a única regra de desenho explícita que existe sobre este espaço, e
está certo em contrariar — o que falta é o desenho da recusa. O `-fixes.md` item 11 ("se comissão ≥ 100%,
mostre erro amigável em vez de calcular") chega perto, mas é um caso só e é ERRO, não recusa honesta.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro de um bloco de canal:

1. Cabeçalho do canal: nome forte + modalidade em peso normal e cor apagada, separados por " · "
   (ex.: **"Mercado Livre** · Clássico"). Blocos empilhados são separados por uma linha de 1px no topo.
2. Legenda "Varejo" → linhas do nível → legenda "Atacado" → linhas do nível.
3. Selos de procedência do canal ("Referência atualizada em…", "estimativa de frete", "Taxa fixa vigente
   desde…") e, na Shopee, os dois avisos informativos.

Os quatro estados, literais:

| Estado | O que substitui | Texto pt-BR exato hoje | Como está pintado |
|---|---|---|---|
| (a) Faixa sem tarifa publicada | As duas linhas do NÍVEL (só do nível atingido) | "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do canal para precificar." | parágrafo de 12px em `--danger-text`, logo abaixo da legenda "Varejo"/"Atacado" |
| (b) Líquido negativo | Nada — o número aparece, negativo | "Canal não-lucrativo neste preço (frete maior que a margem)." | linha "Recebido líquido" com valor em `--danger` + parágrafo 12px em `--danger-text` |
| (c) Sem comissão informada | O bloco inteiro (varejo + atacado) | "Informe a comissão do canal para ver os preços." | parágrafo 12px em `--text-muted` |
| (d) Canal com erro | O bloco inteiro (varejo + atacado) | "Corrija os campos deste canal para ver os preços." | parágrafo 12px em `--text-muted` |

→ **Problema 1 — (a) e (c) terminam pedindo a mesma coisa e não são a mesma coisa.** "informe a comissão do
canal para precificar" (recusa por lacuna na tabela publicada, culpa do marketplace) vs. "Informe a comissão
do canal para ver os preços" (falta um dado que o vendedor ainda não digitou). O vendedor lê duas vezes a
mesma instrução para dois mundos diferentes. O desenho precisa separá-los visualmente mesmo que a copy fique.

→ **Problema 2 — (a) é o único em vermelho, e não é um erro do vendedor.** Vermelho aqui acusa quem não errou.

→ **Problema 3 — (c) e (d) são visualmente idênticos** (mesmo tamanho, mesma cor, mesma posição): "falta
preencher" e "tem campo inválido" pedem ações diferentes e não se distinguem.

→ **Problema 4 — nenhum dos quatro tem âncora visual.** São parágrafos de 12px onde antes havia números de
16–18px em fonte tabular; o olho que desce a tela procurando dinheiro pode simplesmente não parar ali.

→ **Problema 5 — (b) afirma uma causa.** "(frete maior que a margem)" só é verdade quando o vendedor digitou
frete; a linha "Frete" só existe quando ele digitou. Ver Perguntas em aberto.

## Conteúdo e dados reais
- Legendas de nível: "Varejo" e "Atacado". Linhas: "Preço para anunciar" e "Recebido líquido"; a linha
  opcional "Frete" aparece só quando declarada, com valor negativo e tom apagado (ex.: "Frete  − R$ 21,00"),
  seguida da legenda "Descontado do valor recebido (não é embutido no anúncio)."
- Dinheiro em pt-BR com fonte tabular, sinal de menos tipográfico: **R$ 24,24**, **R$ 1.234,56**, **− R$ 3,80**.
  Exemplo real do seed: varejo R$ 24,24, atacado R$ 21,01, custo total R$ 16,16.
- Um canal pode ter **um nível precificado e o outro não**: o desenho tem de mostrar, no mesmo cartão,
  "Varejo · Preço para anunciar R$ 24,24 / Recebido líquido R$ 18,90" e, logo abaixo, "Atacado · Sem tarifa
  publicada…". Esse é o caso que ninguém desenhou e é o mais importante.
- Na Shopee, quando o vendedor é CPF com mais de 450 pedidos em 90 dias e o nível cai sem tarifa, entra
  ACIMA de tudo um aviso informativo com título "A Shopee não publica a fórmula completa desta taxa" — ou
  seja, o estado (a) e um alerta informativo convivem no mesmo cartão e precisam não competir.
- Nomes de canal: "Mercado Livre", "Shopee", "Amazon", "Outro" (fallback: "Canal").

## Estados obrigatórios
- **Repouso precificado** (referência de contraste): duas linhas por nível, valores tabulares alinhados à direita.
- **(a) Sem tarifa publicada, um nível** — legenda do nível + a frase; o outro nível continua com números.
- **(a') Sem tarifa publicada, os dois níveis** — o cartão inteiro sem um número sequer.
- **(b) Líquido negativo** — "Recebido líquido" em tom de perigo com o valor **verdadeiro** (ex.: − R$ 3,80,
  nunca zerado) + "Canal não-lucrativo neste preço (frete maior que a margem)."
- **(c) Sem comissão informada** — "Informe a comissão do canal para ver os preços." no lugar do bloco.
- **(d) Canal com erro** — "Corrija os campos deste canal para ver os preços."; o campo culpado está acima,
  no formulário do canal, e o desenho pode (proposta sua) apontar para lá.
- **Carregando** — o cálculo é local e instantâneo; o que carrega é o catálogo de tarifas. Desenhe o bloco
  com skeleton apenas se você julgar que existe janela perceptível; diga qual escolheu.
- **Offline / catálogo desatualizado** — o cálculo continua e o selo muda ("referência embutida (offline)",
  "pode estar desatualizada"); os quatro estados acima continuam válidos por baixo do selo.
- **Premium pausado / sem permissão** — a seção inteira de marketplaces some (o interruptor "Incluir
  marketplaces no preço" fica desligado e desabilitado, com "Vender em marketplaces faz parte do Premium.");
  este bloco não renderiza. Não desenhe uma versão borrada dos números.

## Viewports
- **Mobile 390px** — obrigatório: é a tela onde o produto nasceu e onde a frase de (a), com 92 caracteres,
  quebra em 3 linhas dentro de um cartão já longo.
- **Desktop 1280px** — obrigatório: a calculadora tem layout largo desde 018 e a mesma frase, esticada, vira
  uma linha órfã de 12px perdida num cartão largo. Mostre como ela se ancora.
- 1920px não é necessário se 1280 resolver a ancoragem; diga se resolver.

## Regras que o desenho não pode quebrar
- **Nunca imprimir R$ 0,00 no lugar de um preço que não existe** (SC-817). Zero é um número e o vendedor
  usa números.
- **A recusa é dita em palavras, e só para o nível atingido** — varejo e atacado caem em lados diferentes da
  lacuna e o desenho não pode apagar os dois quando só um falhou.
- **Nenhuma frase honesta dentro de placeholder** (lição já paga em 016): estas quatro vivem em elementos de
  largura cheia, nunca dentro de um campo.
- **Falha de rede nunca vira "não é premium"** e nunca vira estes quatro estados: catálogo que não atualizou
  tem seu próprio aviso não-bloqueante ("Não foi possível atualizar as taxas" / "Usando a referência salva no
  dispositivo — o cálculo continua funcionando.").
- **Líquido negativo é mostrado, não corrigido nem clampado.**
- Contraste medido contra o fundo real do cartão (não contra o fundo da página) nos dois temas; qualquer
  alvo tocável ≥ 44px.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não presumido**: neste mesmo bloco, um rótulo longo sem espaços gerou 2.100px
  de rolagem a 1440px — e o culpado era um nó de texto pintando fora da caixa, invisível a qualquer medição
  de elemento. Nome de canal longo + frase de 92 caracteres em coluna estreita é o caso a desenhar.
- **Texto ocluso passa em teste**: um aviso empurrado para fora do cartão continua "presente". Mostre o
  cartão inteiro, com o aviso Shopee e os selos juntos, na altura real.
- **Valor grande estoura a coluna**: desenhe pelo menos uma linha com R$ 1.234,56 e uma com − R$ 1.234,56.
- **Seção Shopee mediu 1.248px de altura a 360px** e teve de colapsar um aviso para uma linha com ⓘ — não
  reintroduza blocos altos empilhados.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como first-class**, reutilizando os primitivos existentes —
`tf-card` para o cartão, `tf-brow` (com suas variantes `--muted`, `--negative`, `--total`) para as linhas de
dinheiro, `tf-alert--info`/`--compact` para os avisos Shopee, `tf-badge` para os selos de procedência,
`tf-info-tip` se algum estado precisar de detalhe sob demanda. Não crie primitivo novo; se um estado pedir
uma forma que não existe, componha-a com os que existem e diga o que compôs.
1. Bloco de canal precificado (referência) — 390 e 1280.
2. (a) um nível sem tarifa + o outro com números, no mesmo cartão — 390 e 1280.
3. (a') os dois níveis sem tarifa, na Shopee, com o aviso informativo acima — 390.
4. (b) líquido negativo com frete declarado — 390 e 1280.
5. (c) e (d) lado a lado, provando que se distinguem — 390.
6. Uma prancheta de comparação dos quatro estados fora de contexto, com a proposta de hierarquia
   (ícone? moldura? peso? cor?) explicada em uma linha cada.

## Perguntas em aberto para o dono
1. **(b) pode acontecer sem frete digitado?** A frase afirma "frete maior que a margem" como causa. Se o
   líquido puder ficar negativo por comissão + taxa fixa apenas, a frase mente nesse caso e precisa de duas
   redações — ou de uma redação que não afirme causa.
2. **(a) é aviso ou erro?** Ela hoje é vermelha, mas o vendedor não errou nada — quem não publicou a tarifa
   foi o marketplace. Ela vira tom neutro/atenção, ou o vermelho é intencional para travar a venda?
3. **(d) deve levar o vendedor ao campo culpado** (link/rolagem até o campo inválido do canal), ou continua
   uma frase passiva?
