# Linha do detalhamento (`tf-brow`) — a linha que desconta e a linha que o vendedor batizou

## O que desenhar

A **linha do detalhamento**: rótulo à esquerda, valor em dinheiro à direita, empilhadas dentro de um
`tf-card` para mostrar de onde saiu o preço. É a peça que cumpre a promessa da marca ("a conta inteira
à mostra") e aparece em quatro lugares: no **Calcular** (o bloco "Como chegamos no preço", ~9 linhas +
"Custo total" + as linhas de cada canal de marketplace), no **detalhe do Orçamento congelado**
(Histórico), no **resumo do Kit** (barra "Total do kit" e "Preços por canal (kit)") e no rollup por
canal. O vendedor a lê depois de digitar os custos, para conferir se a conta fecha. Este prompt pede o
desenho de **duas variações que nunca foram desenhadas**: a linha de **ênfase negativa** (dinheiro que
sai / resultado negativo) e o **pior caso de dado real** — o rótulo que o próprio vendedor digitou.

## Por que este prompt existe

A pilha completa já está desenhada duas vezes (protótipo de 2026-07-02 e o canvas do dono do 018, que
monta o "Detalhamento" com as classes reais `tf-brow`/`__main`/`__label`/`__sub`/`__val`/`--total`).
O que ficou de fora dos dois: a ênfase **`negative`** — nenhum desenho a exercita; o protótipo pintou
até a *taxa de marketplace* como `muted`, cinza — e o **rótulo longo**. Sem desenho, o código decidiu
sozinho: pinta só o VALOR de vermelho e cola um **menos tipográfico `−` (U+2212)** no prefixo (`−R$
20,00`), e usa `--danger` cru no lugar do token de status-como-texto. **Isso contraria uma regra
explícita da casa**: os tokens `--danger-text`/`--success-text`/`--info-text` existem justamente porque
"status como texto usa o tom medido, nunca o matiz cru" (INV-3/INV-4). No tema escuro os dois coincidem;
**no tema claro `--danger` (#ef3340) sobre card branco lê ~3,7:1 — reprova AA** — enquanto
`--danger-text` (#c41f2b) lê ~6,0:1. A legenda de aviso logo abaixo da linha já usa o token certo: a
linha e sua própria legenda estão em vermelhos diferentes.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual (`apps/web/src/shared/ui/breakdown-row.{tsx,css}`), da esquerda para a direita:

| Parte | Hoje | Observação |
|---|---|---|
| bolinha de legenda | quadrado 10×10px, raio 3px, cor passada por fora | → **morta**: desde 016/US5 nenhuma tela passa cor. Foi removida do Calcular por ler como "cromo de legenda de gráfico" |
| rótulo | 13px, peso médio, cor de corpo, quebra em qualquer ponto | recebe o **nome que o vendedor digitou** em "Outros custos" |
| sublegenda (opcional) | 12px, cor `muted`, logo abaixo do rótulo | usada para `markup 60%`, contagem de peças, "contribuíram N linhas" |
| valor | Inter tabular, 13px, semibold, alinhado à direita, quebra em qualquer ponto | prefixo `R$` + vírgula decimal |
| separador | linha de 1px `--border-subtle` **entre** linhas (a primeira não tem) | |
| altura | mínimo 40px, respiro de 12px em cima e embaixo | linha **não é interativa** — não há alvo de toque a cumprir |

Ênfases que o código tem: **padrão** · **`muted`** (rótulo e valor cinza, peso normal) · **`accent`**
(só o valor em roxo) · **`negative`** (só o valor em vermelho) · **`total`** (margem extra em cima,
borda superior de **2px** `--border-strong`, rótulo bold 15px, valor bold 18px).

→ Problema 1: **`negative` só pinta o valor.** O rótulo continua cinza/normal. Ninguém desenhou se isso
basta ou se a linha inteira deveria mudar de tom (fundo `--danger-soft`? ícone?).
→ Problema 2: **`−R$ 20,00` sai colado** — o menos gruda no `R$` porque o prefixo é montado como
`− + "R$ " + valor`. Ninguém decidiu se é assim mesmo, se é `-R$ 20,00`, se é `R$ −20,00` ou se a
subtração deveria aparecer como cor + sinal.
→ Problema 3: **a mesma cara para duas coisas diferentes.** Hoje a linha "Frete" (dinheiro que SAI, um
desconto normal e esperado) é **`muted` cinza** com o menos; e "Recebido líquido" quando dá prejuízo é
**`negative` vermelho**. São semânticas distintas usando o mesmo sinal `−`, e só uma tem cor.
→ Problema 4: **a bolinha nunca foi desenhada como legenda de verdade** e hoje não é usada por ninguém.

## Conteúdo e dados reais

Textos literais, exatamente como aparecem hoje (não reescreva; se achar ruim, diga por quê):

- Detalhamento de custo: `"Material"` · `"Energia"` · `"Máquina"` · `"Falha / perdas"` ·
  `"Acabamento"` · `"Mão de obra"` · `"Custo total"` (linha `total`).
- Derivação de preço: `"Preço varejo"` (ênfase `accent`) e `"Preço atacado"`, ambas com sublegenda
  `"markup 60%"`.
- Linhas de canal: `"Preço para anunciar"` · `"Frete"` (a linha de desconto) · `"Recebido líquido"`.
- "Outros custos": o rótulo é **o nome digitado pelo vendedor** (placeholder do campo: `"Ex.: Embalagem"`);
  nome em branco cai no rótulo neutro `"Outros custos"`.
- Legenda de aviso logo abaixo da linha negativa, em vermelho, 12px, fora de qualquer placeholder:
  `"Canal não-lucrativo neste preço (frete maior que a margem)."`

Números verdadeiros para desenhar com (são os do canvas e da semente do app, não invente outros):
Material `R$ 3,78` · Energia `R$ 0,36` · Máquina `R$ 3,55` · Falha / perdas `R$ 0,77` · Acabamento
`R$ 4,69` · Mão de obra `R$ 6,19` · Embalagem `R$ 2,50` · **Custo total `R$ 21,84`**.
Caso negativo (Shopee com frete digitado): Preço para anunciar `R$ 24,24` · Frete `−R$ 20,00` ·
**Recebido líquido `−R$ 4,61`**.
Pior caso de largura: valor de 5 dígitos + centavos, `R$ 12.345,67` (já custou aperto no Kit).

## Estados obrigatórios

A linha **não é interativa**: não tem hover, foco, pressionado nem desabilitado, e nada nela recebe
clique. Não desenhe esses quatro — desenhe estes, que são os que existem de verdade:

1. **Repouso padrão** — rótulo + valor. Primeira da pilha, **sem** borda em cima.
2. **`muted`** — rótulo e valor cinza, peso normal: um custo opcional que ficou em `R$ 0,00` (ex.:
   `"Acabamento" R$ 0,00`) e a linha de desconto `"Frete" −R$ 20,00`.
3. **`accent`** — valor em roxo: `"Preço varejo"` com sublegenda `"markup 60%"`.
4. **`negative`** — `"Recebido líquido" −R$ 4,61`, com a legenda vermelha embaixo. **Este é o estado
   principal do prompt.** Mostre-o nos dois temas e diga qual vermelho usar em cada um.
5. **`total`** — `"Custo total" R$ 21,84`, borda de 2px em cima, tipografia maior.
6. **Com sublegenda** — duas linhas de texto à esquerda sem empurrar o valor.
7. **Rótulo hostil** — nome digitado de 300 caracteres **sem um espaço** (um código de produto colado).
   Hoje ele quebra em qualquer ponto e vira um parágrafo de 40 linhas com o valor pendurado no topo.
   Precisa de decisão de desenho: quantas linhas no máximo, e o que acontece com o resto.
8. **Valor hostil** — `R$ 12.345,67` na coluna estreita da ficha lateral do desktop.
9. **Com bolinha (legado)** — o quadradinho de 10px à esquerda. Desenhe **uma** prancheta dizendo se
   ela fica (e como fica: bolinha redonda? quadrado? de que tamanho?) ou se some do sistema.

Carregando, vazio, erro e offline **não moram nesta linha**: são do bloco que a contém (o card mostra
selo/legenda de procedência). Não desenhe casca de carregamento por linha.

## Viewports

- **390px (mobile)** — obrigatório: é onde a peça nasce e onde o aperto aparece. Rótulo e valor dividem
  ~326px úteis dentro do card. Mostre a pilha completa de 8 linhas + total.
- **1280px (desktop)** — obrigatório: no layout do 018 o "Detalhamento" vive numa das duas colunas de
  um grid, e no Kit vive na ficha lateral. A coluna é estreita, então o caso do valor de 5 dígitos e do
  rótulo longo é **pior** aqui do que a largura total sugere. 1920px não acrescenta nada: a coluna não
  cresce, só a página.

## Regras que o desenho não pode quebrar

- **Contraste medido contra o fundo real** — o vermelho do valor negativo é lido sobre `--surface-card`,
  que é **branco** no tema claro. O matiz cru reprova ali. Escolha e nomeie o tom por tema.
- **A cor não pode ser o único portador do sinal.** O `−` já cumpre esse papel; mantenha-o visível e
  diga onde ele fica em relação ao `R$`.
- **A conta tem que fechar.** As linhas somam exatamente o "Custo total" (o protótipo de 2026-07-02
  falhou nisso: 9,35 + 4,68 = 14,03 contra um total de 14,02). Use os números acima, que fecham.
- **Nunca `R$ 0,00` como "não sei".** Uma linha ausente é ausência honesta; zero é zero de verdade.
- **A frase honesta em elemento de largura total**, nunca em placeholder — vale para a legenda
  `"Canal não-lucrativo neste preço (frete maior que a margem)."`.
- **Nada de upsell nesta peça.** O detalhamento é grátis e ilimitado: nenhuma linha pode aparecer
  borrada, cadeada ou com selo de Premium.
- Dinheiro sempre em pt-BR com centavos e algarismos tabulares, para as colunas alinharem verticalmente.

## Armadilhas já pagas neste projeto

- **2.100px de rolagem horizontal a 1440px**, medidos na homologação automatizada, causados por um
  rótulo de 300 caracteres sem espaço. O culpado é um **nó de texto pintando fora da caixa** — nenhuma
  medição de retângulo de elemento o enxerga, e nenhum teste de "o texto está presente" o denuncia.
  O desenho precisa dar um teto explícito ao rótulo, não confiar em quebra automática.
- O mesmo já aconteceu com o **valor**: ele era "não quebra" e um número grande empurrou a página a 390px.
- No Kit, 89px por valor numa barra de duas colunas **não comportam `R$ 1.234,56`** em nenhuma
  tipografia — a saída foi empilhar, não encolher a fonte.
- Frase honesta dentro de placeholder é frase cortada (custou uma homologação inteira).

## Entregável

Pranchetas em `.dc.html` reutilizando `tf-card` como recipiente e `tf-brow` como a linha (com
`tf-brow__main` / `__label` / `__sub` / `__val` e os modificadores `--muted`, `--accent`, `--negative`,
`--total`); a legenda de aviso como parágrafo de 12px em `--danger-text`; se propuser um selo, use
`tf-badge --danger` em vez de inventar. **Não crie primitivo novo** — se a linha negativa precisar de
fundo tingido ou ícone, declare que é uma extensão do `tf-brow` e nomeie o modificador.

1. **Pilha canônica** (8 linhas + `--total`) a 390px e na coluna do 1280px — escuro e claro.
2. **Bloco de canal com prejuízo**: anúncio, frete `−R$ 20,00`, `Recebido líquido −R$ 4,61` e a legenda
   vermelha — escuro e claro, com o valor de contraste anotado ao lado de cada vermelho.
3. **Matriz das cinco ênfases** lado a lado, mesma largura, para comparar peso e cor.
4. **Casos hostis**: rótulo de 300 caracteres sem espaço e valor `R$ 12.345,67` na coluna estreita,
   com a solução de truncamento/quebra desenhada e anotada.
5. **A bolinha**: prancheta única com a decisão (fica, muda de forma, ou sai do sistema).

Tema escuro é o padrão; o claro é first-class e é onde o vermelho reprova hoje — desenhe os dois.

## Perguntas em aberto para o dono

1. **Vermelho significa "dinheiro saindo" ou "resultado ruim"?** Hoje a linha de frete (saída normal e
   esperada) é cinza e só o líquido negativo é vermelho. Se vermelho for "saída", toda dedução muda de
   cor; se for "resultado ruim", a regra atual está certa e precisa ser escrita.
2. **A linha negativa muda por inteiro ou só o valor?** Rótulo, fundo (`--danger-soft`) e um possível
   ícone estão sem decisão.
3. **A bolinha de legenda fica no sistema?** Nenhuma tela a usa desde 016/US5. Se ficar, para quê —
   amarrar linha a um gráfico que ainda não existe?
4. **O nome digitado em "Outros custos" tem limite de caracteres?** Se o produto limitar na entrada
   (ex.: 60), o pior caso do desenho encolhe muito. E: cada sub-custo deveria carregar a sublegenda
   `"Outros custos"` (como o canvas do 018 desenhou em "Embalagem") ou só o nome cru, como o app faz hoje?
