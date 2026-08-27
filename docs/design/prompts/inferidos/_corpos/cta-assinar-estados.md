# Botão "Assinar Premium" — os três estados que ninguém desenhou

## O que desenhar

O botão que leva o vendedor para fora do app, para pagar. Ele é a última linha do painel de oferta
(`tf-billing-offer`) da aba **Conta**: primeiro a promessa grátis, depois os dois cartões de plano
(anual pré-selecionado com selo "recomendado", mensal a um toque), depois **este botão**, e abaixo
dele os dois avisos de procedência ("Você paga no Mercado Pago (Pix ou cartão)." / "O cartão nunca
passa pelo nosso app."). No mobile o painel abre numa gaveta com o título "Assinar o Premium"; no
desktop ele já vive aberto, inline, num cartão da coluna da Conta. Quem toca é um vendedor que
decidiu pagar — o momento de maior confiança da jornada, e exatamente onde o app hoje só sabe
desenhar o sucesso. Desenhe o botão **e a região de mensagem que nasce junto dele**: repouso, carga,
"você já tem um pagamento aberto" e "o Mercado Pago não respondeu".

## Por que este prompt existe

O componente tem quatro estados tipados em código (`idle` · `pending` · `conflict` · `unavailable`)
e **só o de repouso existe em desenho**. O canvas 018 desenha o botão numa linha só, sem irmão de
erro e sem variante de carga (`<button class="tf-btn tf-btn--primary tf-btn--lg">Assinar Premium</button>`),
e a matriz de estados do próprio canvas confirma a lacuna: a linha "Upsell sheet" traz `loading —`,
`error —`, `disabled —`. O `PremiumScreen.jsx` do protótipo antigo idem — botão e "Agora não", nenhum
estado. A única regra herdada é de COPY ("erro sempre em frase pt-BR amigável, nunca stack"), que o
código obedece; **onde a frase aparece, com que tom e com que peso visual nunca foi decidido por
ninguém.** A auditoria registra "Missing states" como resíduo não resolvido e manda absorver no app.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/billing/billing-cta.tsx` · `offer-panel.tsx` · `billing.css` ·
`shared/i18n/messages.pt-br.ts` (namespace `billing`).

| Estado | O que o vendedor vê hoje | Diagnóstico |
|---|---|---|
| `idle` | Botão primário, tamanho **md** (o canvas desenhou `lg`), largura natural, alinhado à esquerda | → divergência canvas × código: decida o tamanho e a largura no desenho |
| `pending` | O MESMO botão com spinner à esquerda, desabilitado, rótulo continua "Assinar Premium" | → a frase "Abrindo o Mercado Pago…" **existe no bundle e nunca é renderizada** — o app afirma um aviso que nunca acontece |
| `conflict` (409) | Tarja **vermelha** empilhada 8px abaixo do botão: "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo." | → é informativo, não é falha: vermelho para "está tudo indo bem, só já começou" |
| `unavailable` (503, offline, resposta malformada) | Tarja **vermelha** idêntica: "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado." | → mesma cor, mesmo ícone, mesma posição que o caso acima: os dois casos são visualmente indistinguíveis |
| já Premium | O painel inteiro some e sobra a frase "Você já é Premium." — sem botão | é correto; desenhe para que não se perca |
| deslogado | O toque **não** mostra nada: navega direto para o login guardando a intenção de voltar | → transição sem aviso a partir de um botão que promete pagamento |

Comportamento que o desenho precisa respeitar: o `pending` **nunca volta ao repouso** — o navegador
está saindo do app, e um botão que reabilita antes da navegação piscaria "clique de novo" no pior
momento possível. Depois de `conflict`/`unavailable` o botão volta a ficar clicável e a tarja
**permanece na tela** até o próximo toque, quando some e o spinner entra.

## Conteúdo e dados reais

- Rótulo do botão: **"Assinar Premium"** (homologado, não parafraseie).
- Plano anual (pré-selecionado): "Plano anual" · selo "recomendado" · **R$ 155,88/ano** ·
  "equivalente a R$ 12,99/mês" · "~19% de economia frente ao mensal".
- Plano mensal: "Plano mensal" · **R$ 15,99/mês** · "cobrança todo mês, cancele quando quiser".
- O espaço entre `R$` e o número é **NBSP** — em 390px a linha já quebrou entre símbolo e valor numa
  homologação real; numa linha de preço essa é a única quebra proibida.
- Nunca existe preço riscado, "de/por", contagem regressiva ou escassez. R$ 191,88 (12 × mensal) é
  um número derivado que **nunca é renderizado**.
- Avisos que ficam ABAIXO do botão, sempre, em qualquer estado: "Você paga no Mercado Pago (Pix ou
  cartão)." e "O cartão nunca passa pelo nosso app."
- Frase de carga disponível e hoje órfã: **"Abrindo o Mercado Pago…"** (a verdade literal: está se
  criando a assinatura — não é "processando pagamento").
- O que vem DEPOIS, e é outra peça: a tela de retorno ("Confirmando seu pagamento…" / "Premium
  ativo!" / "Ainda não recebemos a confirmação"). Não desenhe aqui; apenas não conflite com ela.

## Estados obrigatórios

1. **Repouso** — botão primário, alvo real ≥44px de altura, sem tarja alguma.
2. **Foco por teclado** — anel visível no botão, medido contra o fundo do cartão E o fundo da gaveta.
3. **Hover** e **pressionado** — desktop e toque.
4. **Carregando (`pending`)** — spinner + botão bloqueado + a frase "Abrindo o Mercado Pago…"
   finalmente visível. Desenhe as duas leituras possíveis (a frase como rótulo do botão × a frase
   como legenda logo abaixo) para o dono escolher; nas duas, o vendedor precisa entender que o app
   está **saindo** e que ele não deve tocar de novo.
5. **Conflito (409)** — mensagem informativa, tom distinto do erro, com a frase literal acima.
   Precisa ainda ser anunciada por leitor de tela.
6. **Indisponível (503 / falha)** — mensagem de falha honesta, com o "nada foi cobrado." legível
   como parte da mesma frase (é a linha que acalma).
7. **Já Premium** — sem botão, só "Você já é Premium."
8. **Deslogado** — o mesmo botão em repouso; desenhe se há (ou não) uma legenda dizendo que o
   próximo passo é entrar.
9. **Desabilitado puro** — o app não usa hoje; desenhe o token para que ninguém invente depois.

## Viewports

- **390px** — obrigatório: é aqui que o painel vive numa gaveta, com o botão perto da borda inferior
  e a tarja empurrando os dois avisos de procedência para baixo. Mostre a coluna inteira, não o
  botão recortado: o que importa é o que a tarja desloca.
- **1280px** — obrigatório: o painel é inline num cartão da coluna da Conta (não é gaveta), e a
  largura maior faz a mensagem de erro virar uma faixa larga com muito ar à direita da frase.
- 1920px opcional, apenas se a decisão de largura máxima do botão/tarja mudar em relação a 1280.

## Regras que o desenho não pode quebrar

- **Nada pré-acende o Premium.** Nenhum estado do botão pode parecer sucesso antes de o servidor
  confirmar; nenhum "processando" que insinue pagamento aprovado.
- **Falha de rede nunca é vendida como "não é premium"** e — igualmente — não pode ser vendida como
  culpa do Mercado Pago se a origem foi o aparelho offline.
- **"nada foi cobrado."** é a informação mais importante do estado de falha e não pode ficar cortada,
  truncada, dentro de placeholder ou fora da primeira leitura.
- Nenhum código de status, nome de erro técnico ou jargão aparece — nem em legenda pequena.
- Alvo ≥44px, contraste medido contra o fundo REAL (cartão sobre fundo da Conta, e gaveta sobre
  overlay), nos dois temas.
- Se o tom do 409 deixar de ser vermelho, a mensagem ainda precisa ser lida em voz alta pelo leitor
  de tela — mudança de cor não pode virar mudança de urgência para quem não vê a cor.

## Armadilhas já pagas neste projeto

- **Copy no bundle que nunca renderiza** — já aconteceu com um toast de confirmação que sumia junto
  com o diálogo: o texto existia, o reconhecimento nunca. "Abrindo o Mercado Pago…" é o mesmo caso,
  ainda vivo.
- **Quebra entre `R$` e o valor a 390px** — invisível para qualquer asserção (não há corte nem
  transbordo); só a imagem denuncia.
- **Transbordo medido nos DOIS eixos** — headless não enxerga barra de rolagem clássica; a tarja de
  erro entrando na gaveta é exatamente o tipo de elemento que estoura a altura útil.
- **Texto ocluso passa em teste** — "visível" não é propriedade do texto: desenhe onde a tarja fica
  quando o teclado do celular está aberto e a gaveta encurtou.
- **Um controle que estica sozinho** — nesta mesma tela um radio virou uma barra de 292px por herdar
  o alinhamento do container. Diga a largura pretendida do botão e da tarja, não deixe implícita.

## Entregável

Pranchetas, tema **escuro** (padrão) e **claro** (first-class, mesmo conjunto):

1. 390px — painel completo em repouso (planos + botão + avisos).
2. 390px — `pending`, nas duas leituras da frase de carga.
3. 390px — `conflict`.
4. 390px — `unavailable`.
5. 390px — "Você já é Premium."
6. 1280px — o cartão inline da Conta com repouso, `conflict` e `unavailable` lado a lado.
7. Tira de estados do botão isolado: repouso · hover · foco · pressionado · carregando · desabilitado.

Reutilize os primitivos existentes, sem criar novos: **`tf-btn tf-btn--primary`** (com
`tf-btn--loading` + `tf-btn__spin` no estado de carga) para o botão; **`tf-alert`** para a mensagem —
`tf-alert--danger` para a indisponibilidade e a variante informativa que você julgar correta para o
409, sempre com ícone à esquerda e corpo em duas linhas no máximo a 390px; **`tf-badge`** tom
sucesso para o selo "recomendado"; o cartão/gaveta já existentes para o contêiner. Marque no desenho
o espaçamento entre botão e tarja e a distância até os avisos de procedência.

## Perguntas em aberto para o dono

1. Quando a falha é do **aparelho** (offline), o app pode dizer isso — "Você está sem conexão" — em
   vez de atribuir ao Mercado Pago? Hoje os dois casos usam a mesma frase, e uma delas culpa terceiro
   por algo que ele não fez.
2. O 409 ("você já tem um pagamento em andamento") deve ganhar uma **ação** — um caminho explícito
   para concluir no Mercado Pago — ou continua sendo só uma frase para reler e esperar?
3. Durante o `pending`, o rótulo do botão pode **trocar** de "Assinar Premium" para "Abrindo o
   Mercado Pago…", ou a frase entra como legenda separada abaixo, preservando o rótulo homologado?
4. Para quem não está logado, o toque deve **avisar** que o próximo passo é entrar, ou continua
   navegando direto para o login sem intermediação?
