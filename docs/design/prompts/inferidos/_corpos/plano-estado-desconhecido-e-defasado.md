# Linha do plano na Conta: "não consegui confirmar" e "esse dado é de antes"

## O que desenhar

A linha do **Plano** dentro da tela **Conta** (`/conta`), nos dois estados em que ela fala sobre a
própria leitura em vez de falar sobre o plano: (a) quando o servidor de direitos **não respondeu** e o
app não sabe qual é o plano; (b) quando o valor mostrado é a **última resposta guardada no aparelho**
(vendedor offline, ou a chamada falhou e existe um valor lembrado). É o cartão logo abaixo do de
identidade (avatar de 44px + e-mail) e, no desktop, o primeiro item da coluna mais larga de uma grade
de três colunas (identidade+plano · tema · privacidade+sair); abaixo dele, quando cabe assinar, abre o
cartão da oferta. Quem vê: o vendedor que abriu a Conta para conferir se ainda é Premium — em geral
porque desconfia de algo, e quase sempre com internet ruim na bancada da impressora.

## Por que este prompt existe

Estes dois estados nunca foram desenhados — foram compostos em código. O protótipo de 2026-07-02 só tem
os ramos `isFree` e `isPremium` da Conta: não há ramo de erro nem de cache, e a busca por "não foi
possível / defasado / offline / última informação" na prancheta da Conta dá **zero**. O protótipo tem
vocabulário de offline — a **faixa global do shell** em ciano, "Offline — o cálculo continua
funcionando" (11,96:1 medido no escuro) — mas isso é uma faixa sobre a REDE, não uma marca de
procedência colada num dado específico, que é o que falta aqui. E o "não sei" não tem precedente: o
erro de carga só foi desenhado para as **listas** de Catálogo e Histórico ("Não foi possível carregar.
Tente de novo." + botão), nunca para um **selo de estado**.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual do cartão (`conta-page.tsx` · `plan-panel.tsx`): rótulo "Plano" numa linha; abaixo, um
selo (pílula) e, ao lado dele, uma legenda em texto pequeno; abaixo, opcionalmente, uma segunda linha
de nota; à direita, as ações do plano e **sempre** um botão fantasma "Recarregar".

| Estado (código) | Selo | Legenda ao lado | Nota abaixo | Ações à direita |
|---|---|---|---|---|
| `unknown` (ledger falhou) | "Não foi possível confirmar seu plano." — tom neutro | — nenhuma | — nenhuma | só "Recarregar" |
| `free` | "Gratuito" — neutro | — nenhuma | — | "Assinar Premium" + "Recarregar" |
| `lapsed` | "Premium pausado" — neutro | "Seus itens salvos continuam disponíveis para leitura." | — | "Assinar novamente" + "Recarregar" |
| `subscription-active` | "Premium" — sucesso (verde) | "Plano mensal · renova em 31/12/2026" | — | "Gerenciar assinatura" · "Cancelar assinatura" · "Recarregar" |
| `grace` | "Premium" — **verde de propósito** | "pagamento pendente — regularize" (tom `info`) | "até 30/12/2026, senão o Premium pausa." | "Atualizar forma de pagamento" (primário) + "Recarregar" |
| leitura do cache (`stale`) | o selo do estado acima, inalterado | a legenda ganha o sufixo " · última informação do servidor" | inalterada | inalteradas |

→ **A frase inteira mora dentro da pílula.** "Não foi possível confirmar seu plano." tem 37 caracteres
num componente cuja regra é `white-space: nowrap`, altura mínima 24px, peso semibold, tamanho de
legenda: ela não quebra — ela empurra a linha. É o oposto do que uma pílula de status faz.

→ **"Não sei" está pintado como se fosse um plano.** O tom neutro é exatamente o mesmo de "Gratuito" e
de "Premium pausado". Para o vendedor offline, "não consegui confirmar" e "você não tem" têm os mesmos
pixels — e essa é a confusão cara.

→ **Carregando e falhou são o mesmo desenho.** A tela nunca consulta o estado "primeira leitura em
curso": enquanto a resposta não chega e o aparelho não tem nada lembrado, a Conta já mostra
"Não foi possível confirmar seu plano.". A frase mais alarmante da tela aparece antes de qualquer falha.

→ **O sufixo de procedência é texto, não elemento.** No `free` a legenda não existe, então sobra
"última informação do servidor" sozinha — fragmento sem sujeito colado num selo "Gratuito". Na
carência viram três frases seguidas no mesmo tamanho de legenda. E **"Recarregar" não se explica**: é
fantasma, existe em todos os estados, e no `unknown` é a única coisa acionável da linha.

## Conteúdo e dados reais

- Rótulo da linha: **"Plano"**. Título da tela: **"Conta"**.
- Textos literais já homologados, a reutilizar sem reescrever: "Gratuito" · "Premium" · "Premium
  pausado" · "Seus itens salvos continuam disponíveis para leitura." · "Não foi possível confirmar seu
  plano." · "última informação do servidor" · "Recarregar" · "Assinar Premium" · "Assinar novamente" ·
  "Gerenciar assinatura" · "Atualizar forma de pagamento" · "pagamento pendente — regularize" · "até
  {data}, senão o Premium pausa." · "Plano mensal"/"Plano anual" · "renova em" · "ativo até" · "não
  renova" · "cortesia"/"via programa beta" · "expira em".
- Datas são **fato do servidor** e aparecem em pt-BR curto: `31/12/2026`. Quando o servidor não manda
  data, a frase existe **sem** data — nunca com data inventada.
- Nesta peça **não há dinheiro**: preço só existe no cartão da oferta, abaixo. Não coloque valor aqui.
- Os dois estados desta peça são **mutuamente exclusivos** por construção: "não confirmado" só ocorre
  quando não há resposta nenhuma (nem fresca, nem lembrada); "defasado" só ocorre quando há uma
  resposta lembrada. Não desenhe os dois juntos.
- E-mail vizinho: `jonatan.fbossan@gmail.com` (trunca com reticências; nunca estoura a linha).

## Estados obrigatórios

1. **Não confirmado** (`unknown`): diz "Não foi possível confirmar seu plano." sem afirmar plano
   nenhum, sem ação de assinar (o app não sabe se ele já é Premium) e com o caminho de tentar de novo.
2. **Primeira leitura em curso**: o vendedor abriu a Conta e a resposta ainda não chegou. Precisa ser
   visivelmente diferente do item 1 — hoje não é.
3. **Recarregando com dado na tela**: o botão "Recarregar" em carregamento; o selo e a legenda que já
   estavam continuam legíveis (nada pisca para vazio).
4. **Defasado sobre "Gratuito"**: selo "Gratuito" + a marca de procedência. Este é o estado em que o
   risco de mentira é maior.
5. **Defasado sobre "Premium"**: "Plano mensal · renova em 31/12/2026" + a marca de procedência.
6. **Defasado sobre carência**: selo "Premium" **verde**, legenda "pagamento pendente — regularize" em
   tom informativo, nota "até 30/12/2026, senão o Premium pausa." e ainda a marca de procedência —
   quatro informações numa linha estreita. É o pior caso de densidade; desenhe-o de verdade.
7. **Defasado sobre "Premium pausado"**: selo + "Seus itens salvos continuam disponíveis para leitura."
   + procedência.
8. **Foco de teclado**, **hover** e **pressionado** do "Recarregar" (e de qualquer afordância nova).
9. **Offline global**: como a linha se comporta enquanto a faixa do shell "Offline — o cálculo continua
   funcionando" está na tela — a marca de procedência não pode virar eco redundante da faixa.
10. **Desabilitado**: hoje não existe (o botão só entra em carregamento). Se precisar de um, diga por quê.

## Viewports

- **Mobile 390px** (obrigatório): é onde a linha já estourou uma vez; confira o pior caso a **360px**,
  o piso que a homologação usa.
- **Desktop 1280px** (obrigatório): a Conta vira grade de três colunas e o cartão do plano ocupa a mais
  larga — ainda assim ~1,15/3 da página. **A pílula com a frase inteira é pior aqui do que no mobile.**
- **1920px**: opcional, mesma composição mais folgada — só desenhe se a sua solução mudar.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como plano.** "Não consegui confirmar" jamais pode ler como
  "Gratuito", e nunca pode oferecer "Assinar Premium" — vender a alguém o que ele talvez já pague é a
  mentira mais cara desta tela.
- **Nem o contrário**: um dado lembrado do aparelho não pode ser exibido como se fosse fresco. A
  procedência é dita, não escondida.
- **Freemium binário**: só existem Gratuito e Premium. Não invente "plano indefinido" como se fosse um
  terceiro plano.
- **O selo da carência continua verde.** O Premium ESTÁ ativo durante toda a carência; degradar o selo
  seria a mentira na direção oposta. Quem carrega a cautela é o texto.
- **Frase honesta nunca em placeholder nem cortada**: a procedência e o "não confirmado" moram em
  elementos que comportam a frase inteira, com quebra de linha permitida.
- **Zero transbordo horizontal** em qualquer viewport: quebra de linha, nunca barra de rolagem.
- **Alvo de toque ≥ 44px** para "Recarregar" e para qualquer afordância nova.
- **Contraste medido contra o fundo real do cartão** (não contra o fundo da página), nos dois temas.

## Armadilhas já pagas neste projeto

- **Transbordo medido nesta mesma linha**: a 390px ela mediu 453,5px contra 316px de conteúdo do
  cartão, a página foi a 491px (100,5px de transbordo) e o botão nasceu **inteiramente fora da
  viewport**, em x=396,3 — com o modal aberto sobrava uma faixa clara à direita, com o botão à mostra.
- **Pílula não quebra**: `white-space: nowrap` é regra do componente de selo; qualquer frase longa
  dentro dele vira largura mínima intransponível.
- **Texto ocluso passa em teste**: asserção de texto não enxerga colisão nem corte, e barra de rolagem
  clássica é invisível no headless — a quebra de cada frase longa se resolve no desenho.
- **Duas primeiras palavras iguais lado a lado**: "Atualizar" já teve de virar "Recarregar" porque
  ficava a 8px de "Atualizar forma de pagamento". Não reintroduza colisão de rótulos.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **390px — a matriz dos estados**: não confirmado · primeira leitura · defasado sobre Gratuito ·
   defasado sobre Premium · defasado sobre carência · defasado sobre Premium pausado.
2. **1280px — a coluna do plano** com os mesmos estados na largura real da grade de três colunas.
3. **Detalhe ampliado (2x)** da marca de procedência e do selo "não confirmado", com as medidas de
   altura, espaçamento e quebra de linha.
4. **Convivência** da linha com a faixa global de offline do shell.

Reaproveite os primitivos existentes, sem criar novos: **`tf-badge`** (tons neutro/info/sucesso) no
selo, **`tf-card`** no cartão da linha, **`tf-btn`** fantasma `sm` em "Recarregar" e `tf-btn` primário
nas ações de cobrança, **`tf-alert`** (`danger`/`info`) se o "não confirmado" pedir o mesmo tratamento
do erro do cartão de identidade — que já empilha alerta + "Tentar novamente". Ícones apenas do conjunto
do DS; se o pictograma que você quer não existir lá, **diga isso em vez de inventar um**.

## Perguntas em aberto para o dono

1. **O rótulo do "não sei"**: o selo passa a mostrar um rótulo curto (ex.: "Não confirmado") com a
   frase completa fora dele, ou a frase inteira continua sendo o selo? Rótulo novo é copy nova, e copy
   de cobrança é decisão do dono.
2. **Carregando é visível ou mudo?** Enquanto a primeira leitura corre, a Conta deve dizer algo
   ("Verificando seu plano...") ou ficar em esqueleto silencioso até haver resposta?
3. **A marca de dado defasado é elemento ou sufixo?** Vira chip/ícone na linha do plano, ou continua
   sufixo textual da legenda? E ela aparece junto com a faixa global de offline, ou uma suprime a outra?
4. **"Gratuito · última informação do servidor"**: no plano gratuito a legenda vira só o fragmento
   "última informação do servidor", sem sujeito. Aceita assim, ou quer uma frase completa (copy nova)?
