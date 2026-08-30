# “Como chegamos no preço” + os dois cartões de preço final

## O que desenhar
O rodapé de resultado da calculadora (`apps/web/src/features/calculator/calculator-form.tsx`,
componente `PriceResults`, renderizado dentro de `.tf-calc-footer` na aba **Calcular**). É a última
coisa que o vendedor lê antes de fechar a tela: a conta item a item que soma até o custo total, os
preços derivados por markup, os preços por canal de marketplace (quando Premium e com canal ativo) e,
no fim, os dois cartões grandes — varejo e atacado — que o vendedor tira foto e manda pro cliente.
Vive sempre abaixo do formulário; no desktop atravessa as duas colunas do grid, centralizado e limitado
a 720px de largura. Depois dele só vêm os botões “Salvar cenário” e “Registrar orçamento” (ambos
Premium, ausentes sem assinatura) e a frase freemium.

## Por que este prompt existe
Autoridade: **PROTÓTIPO PARCIAL**. O protótipo de 2026-07-02 (`CalculatorScreen.jsx` §E4/§F.3)
desenhou o breakdown itemizado e mandou, com todas as letras: “Varejo × Atacado: desktop = 2 colunas
lado a lado; **mobile = segmented control (Varejo|Atacado) + linha-resumo**”; §D.2 chegou a **criar** o
primitivo “Segmented control — pill” só para isso. **O app nunca construiu esse controle.** O que
existe hoje foi ajustado por medição de overflow, não por desenho: uma grade `auto-fit` que empilha os
dois cartões a 360px. O protótipo também mostrava bolinhas de cor nas linhas do breakdown; elas foram
removidas em 016 (FR-907-AC2, decisão registrada). E o breakdown ganhou linhas que o protótipo não
tinha (acabamento, mão de obra, N linhas de “Outros custos”) mais uma cauda inteira — “Preços por
canal” — dentro do mesmo cartão. Ou seja: o código **contraria** uma regra de desenho explícita em três
pontos verificáveis, e ninguém desenhou a peça que ele virou.

## O que já existe hoje (não invente do zero — corrija)
Ordem exata na tela, de cima para baixo:

1. Título de seção **“Como chegamos no preço”** com um ⓘ ao lado (rótulo assistivo “Sobre o cálculo do
   preço”, corpo “Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total ×
   markup.”).
2. Um alerta tom `info`, só quando dispara a checagem de plausibilidade do RESULTADO. O caso real:
   “O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender.
   Confira os campos de custo que ficaram zerados. Nada foi recusado.”
3. Um `Card` com as linhas (`tf-brow`), rótulo à esquerda, valor tabular à direita:

| Linha | Rótulo literal | Ênfase hoje | Observação |
|---|---|---|---|
| 1 | “Material” | normal | sempre presente |
| 2 | “Energia” | normal | sempre presente |
| 3 | “Máquina” | normal | sempre presente |
| 4 | “Falha / perdas” | `muted` quando 0,00 | opcional |
| 5 | “Acabamento” | `muted` quando 0,00 | opcional |
| 6 | “Mão de obra” | `muted` quando 0,00 | opcional |
| 7..N | nome digitado pelo vendedor (“Embalagem”, “Etiqueta”…) ou “Outros custos” se em branco | normal | 0..N linhas |
| N+1 | “Custo total” | `total` | soma exata das anteriores |
| N+2 | “Preço varejo” + sub-rótulo “markup 50%” | `accent` | derivado |
| N+3 | “Preço atacado” + sub-rótulo “markup 30%” | normal | derivado |

4. → Ainda **dentro do mesmo cartão**, separada por um divisor: a legenda “Preços por canal” e, por
   canal ativo, o nome do marketplace + “· modalidade”, e para cada nível (legendas “Varejo” e
   “Atacado”): “Preço para anunciar”, “Frete” (valor negativo, `muted`, só quando > 0) e “Recebido
   líquido”. Se o líquido for negativo ele fica em tom negativo e ganha a frase “Canal não-lucrativo
   neste preço (frete maior que a margem).”. Quando há frete: “Descontado do valor recebido (não é
   embutido no anúncio).”. Esse bloco some inteiro sem canal ativo / sem Premium.
5. Alerta `info` quando atacado > varejo: “O preco de atacado ficou acima do varejo. Nada foi recusado
   — so confira se e isso mesmo.” → **esta frase está sem acentos no produto** (“preco”, “so”, “e”).
   É defeito de texto, não de desenho, mas o desenho deve mostrá-la já corrigida: “O preço de atacado
   ficou acima do varejo. Nada foi recusado — só confira se é isso mesmo.”
6. Os dois cartões finais, em grade `repeat(auto-fit, minmax(210px, 1fr))`: **“Preço varejo”** (fundo
   accent) e **“Preço atacado”** (fundo energy), ambos no MESMO tamanho (`md`), ambos centralizados,
   cada um com legenda “markup 50%” / “markup 30%”. Lado a lado a partir de ~450px, empilhados a 360px.

→ Problemas a resolver no desenho: **(a)** os dois cartões têm peso visual idêntico — o produto não diz
qual preço é o principal, e o canvas do 018 (aba Kits) mostra a opinião posterior do dono: varejo grande
em accent, atacado menor e apagado; **(b)** “Preço varejo” e “Preço atacado” aparecem **duas vezes** com
o mesmo número a menos de uma rolagem de distância (linhas do breakdown + cartões); **(c)** não existe o
segmented control Varejo|Atacado em lugar nenhum; **(d)** a cauda “Preços por canal” pendurada no mesmo
cartão faz a distância entre “Custo total” e os cartões finais crescer com o número de canais.

## Conteúdo e dados reais
Use os números da semente do produto, que fecham de verdade (custo × markup):

- Material R$ 8,40 · Energia R$ 0,54 · Máquina R$ 1,82 · Falha / perdas R$ 0,20 · Acabamento R$ 2,00 ·
  Mão de obra R$ 3,00 · Embalagem R$ 0,20 → **Custo total R$ 16,16**.
- **Preço varejo R$ 24,24** (markup 50%) · **Preço atacado R$ 21,01** (markup 30%).
- Canal de exemplo: “Mercado Livre · Clássico” → “Preço para anunciar R$ 34,36”, “Recebido líquido
  R$ 24,24”. Caso frete: “Shopee · Frete grátis” → “Frete −R$ 20,00” e líquido “−R$ 3,80” em tom
  negativo com a frase do canal não-lucrativo.
- Todo dinheiro em pt-BR com dois decimais e milhar por ponto: `R$ 1.234,56`. Números em fonte tabular.
- Caso de estresse obrigatório: **R$ 950.096,00** num cartão a 360px (é o valor que já quebrou
  no meio do dígito neste projeto).
- O sub-rótulo do markup é a string minúscula “markup” + o percentual digitado; com o campo vazio o
  produto imprime “markup 0%”.

## Estados obrigatórios
- **Repouso** — tudo válido, com e sem canais, com e sem linhas opcionais.
- **Formulário inválido** — `PriceResults` não renderiza NADA; no lugar dele um alerta `danger`:
  “Confira os campos destacados para ver o preço.” Desenhe esse estado.
- **Linhas opcionais em zero** — “Falha / perdas”, “Acabamento”, “Mão de obra” em R$ 0,00 aparecem
  apagadas, não somem. Mostre a diferença entre apagado e normal.
- **Aviso de resultado** (`info`) — custo/preço zerados, com a frase inteira acima.
- **Atacado acima do varejo** (`info`) — nunca em vermelho: nada foi recusado.
- **Canal sem tarifa da faixa** — “Sem tarifa publicada para a faixa de preço deste anúncio — informe a
  comissão do canal para precificar.” no lugar dos números daquele nível.
- **Canal sem comissão informada** — “Informe a comissão do canal para ver os preços.”
- **Canal com campo errado** — “Corrija os campos deste canal para ver os preços.” (nunca preço velho).
- **Sem Premium / deslogado** — o bloco “Preços por canal” está **ausente inteiro**; o breakdown e os
  dois cartões continuam completos e gratuitos. Não desenhe cadeado nem número borrado aqui.
- **Foco de teclado** no ⓘ do título e nos botões abaixo; **hover/pressionado** só existe nesses
  mesmos elementos — as linhas e os cartões não são clicáveis hoje.

## Viewports
- **390px** (mobile de referência) e **360px** (o estresse medido: é onde a grade empilha e onde o
  valor de seis dígitos já quebrou). Ambos obrigatórios — a peça nasceu no mobile.
- **1280px** — a peça atravessa as duas colunas do formulário, centralizada, com no máximo 720px de
  largura útil; os dois cartões cabem lado a lado com folga. Desenhe também aqui, porque é onde o
  protótipo pedia “2 colunas lado a lado” e é onde a hierarquia entre varejo e atacado fica mais visível.

## Regras que o desenho não pode quebrar
- **Toda linha em reais soma exatamente ao custo total** — a soma é a promessa da seção; nenhuma linha
  decorativa, nenhum arredondamento inventado.
- **Freemium é binário**: calcular custo, markup e ver a conta é grátis e completo; marketplace, salvar
  e exportar são Premium. O que é Premium **está ausente**, nunca borrado ou falso.
- **Falha de rede nunca é vendida como “não é premium”** — se o catálogo de tarifas falhou, a mensagem
  fala de tarifa, não de assinatura.
- **Aviso nunca vira validação**: tom `info`, texto descritivo (“ficou acima”, “confira”), nunca
  corretivo, e sempre termina em “Nada foi recusado.”.
- **Frase honesta nunca dentro de placeholder** — ela ocupa elemento próprio de largura total.
- Alvos de toque ≥ 44px (o ⓘ do título inclusive) e contraste medido contra o fundo REAL dos cartões
  (accent e energy são fundos cheios, com texto sobre eles), em tema escuro **e** claro.
- Procedência do número: quando o preço do canal vem de tabela de referência, o selo/legenda que diz
  isso não pode ser cortado.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não estimado**: a grade fixa de duas colunas dava 108px a um valor que
  precisava de 124px e o número quebrava no meio (`950.096` em duas linhas). Qualquer proposta precisa
  sobreviver a seis dígitos a 360px.
- **Scroll no eixo vertical dentro do cartão de preço**: a altura do número com `line-height: 1`
  produzia barra clássica de 15px que deslocava o valor do centro. Não aperte a caixa do valor.
- **Texto ocluso passa em teste**: a legenda “markup 50%” e as frases de canal precisam caber por
  geometria, não por sorte.
- **Placeholder que corta a frase**: já aconteceu com um sufixo de honestidade cortado dentro de um
  campo; frases explicativas moram fora de inputs.
- **Duas fontes para o mesmo número**: hoje varejo e atacado aparecem no breakdown e nos cartões. Se o
  desenho mantiver os dois, eles têm que se ler como “derivação” e “resultado”, não como repetição.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **390px — repouso completo**, com canal ativo, uma linha de “Outros custos” e os dois cartões finais.
2. **360px — estresse**, com R$ 950.096,00 e o valor mais longo de canal.
3. **390px — estados**, empilhados numa prancheta: formulário inválido, aviso de resultado zerado,
   atacado acima do varejo, canal não-lucrativo, canal sem tarifa da faixa, sem Premium.
4. **1280px — repouso**, mostrando a hierarquia entre varejo e atacado que o mobile também vai herdar.
5. **Proposta do segmented control Varejo|Atacado** (o que o protótipo criou e o app nunca construiu):
   pílula com dois segmentos + linha-resumo, no mobile — desenhada ao lado da alternativa atual
   (dois cartões empilhados), para o dono escolher.

Reutilize os primitivos existentes, sem criar novos: `tf-brow` (linha do breakdown, com suas ênfases
`muted` / `total` / `accent` / `negative`) para cada linha da conta; `tf-price` nos dois cartões finais
(`--md` hoje, `--lg` se o varejo virar o principal; tons `--accent` e `--energy`); `tf-card` como
recipiente do breakdown; `tf-alert` (`info` / `danger`) para os avisos; o `tf-infotip` no título. Se
propuser o segmented control, apresente-o como um primitivo novo do DS, nomeado e com todos os estados.

## Perguntas em aberto para o dono
1. **Qual dos dois preços é o principal?** Hoje varejo e atacado têm exatamente o mesmo peso; o canvas
   do 018 (Kits) sugere varejo grande em accent e atacado menor/apagado. Isso vale para a calculadora?
2. **O segmented control Varejo|Atacado do protótipo entra ou é abandonado formalmente?** E se entrar,
   ele também governa “Preços por canal” (que hoje mostra os DOIS níveis de cada canal ao mesmo tempo)?
3. **As linhas “Preço varejo” e “Preço atacado” continuam no breakdown**, mesmo com os cartões logo
   abaixo? Elas existem para mostrar a derivação pelo markup — mas repetem o número.
4. **“Preços por canal” continua dentro do mesmo cartão** ou volta a ser seção própria? Com 3 canais a
   distância entre “Custo total” e os cartões finais passa de uma tela inteira no mobile.
5. **As bolinhas de cor voltam?** Foram removidas em 016 por lerem como “chrome de gráfico”; se o
   desenho introduzir comparação visual, a decisão precisa ser reaberta explicitamente.
