# Retorno do checkout — "Ainda não recebemos a confirmação"

## O que desenhar

A tela que o vendedor vê quando volta do Mercado Pago para o app e o app, depois de ~45 segundos
consultando o servidor, **ainda não sabe se houve cobrança**. Ela toma a página inteira da aba
**Conta** (o app volta do MP em `/conta?checkout=retorno`: cabeçalho "Conta" e, abaixo, só este
cartão — nenhuma outra seção da Conta aparece). É o terceiro e último desfecho de uma sequência de
três: *confirmando* → *Premium ativo* **ou** *não confirmado*. Quem chega aqui é sempre uma de duas
pessoas, e o produto **não consegue distingui-las por contrato**: quem pagou e cuja confirmação
ainda não chegou, e quem abriu o checkout e desistiu (nesse caso nada foi cobrado, e por decisão de
produto o abandono precisa ser indistinguível de "nunca comecei"). Desenhe o estado final, e também
os dois estados irmãos que levam até ele, porque a temperatura visual de um só faz sentido ao lado
da dos outros.

## Por que este prompt existe

Nenhuma das autoridades de desenho cobre o retorno do checkout — o canvas exclui o fluxo inteiro, e
uma busca por "confirmação / não recebemos / verificar" nele dá zero. O que existe hoje foi inferido
por IA direto do requisito: um **ícone de alerta** (`circle-alert`, 28px) para um estado que pode
significar "você não comprou nada", as duas leituras (paguei / desisti) **emendadas num parágrafo
só**, e **nenhum caminho de suporte** em lugar nenhum do componente. Existe no produto uma tela
on-brand de erro genérico ("Algo deu errado" + "Recarregar" + "Código de suporte: {correlationId}"),
mas ela é o *error boundary* de falha técnica — **não serve aqui**: aqui nada quebrou, o sistema
funcionou e a resposta honesta é "ainda não sei". Usar a linguagem de erro seria exatamente a
leitura falsa que este prompt vem corrigir.

## O que já existe hoje (não invente do zero — corrija)

Um único cartão (`Card`), conteúdo **centralizado**, coluna, respiro de 0,75rem entre blocos; os dois
botões empilhados em coluna com 0,5rem entre eles. Textos literais, todos já em produção:

| Estado | Ícone/indicador | Título | Corpo | Ações |
|---|---|---|---|---|
| Confirmando (0–45s) | `Spinner` | "Confirmando seu pagamento…" | "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada." | "Atualizar" (secundário) · "Voltar para a Conta" (fantasma) |
| Confirmado | `crown` 28px | "Premium ativo!" | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." | "Ir para a calculadora" (primário) |
| **Não confirmado** | `circle-alert` 28px | "Ainda não recebemos a confirmação" | "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado." | "Verificar de novo" (secundário) · "Voltar para a Conta" (fantasma) |

→ **O ícone de alerta é o problema central.** Para metade das pessoas que chegam aqui a resposta
certa é "nada aconteceu, está tudo bem" — e um triângulo/círculo de alerta grita erro sobre um
não-evento. Proponha a temperatura visual: neutra/paciente (espera), nunca vermelha de falha.

→ **As duas leituras dentro de um parágrafo único.** "Se você concluiu…" e "Se você não concluiu…"
são dois destinatários diferentes com duas ações diferentes, colados na mesma frase corrida. Separe-
as visualmente (dois blocos legíveis) sem reescrever a copy, que já foi homologada.

→ **Não há saída para quem pagou e não vê o Premium.** As duas ações são "tentar de novo" e "voltar".
Quem pagou de verdade e continua sem Premium sai daqui sem nenhum caminho. Desenhe o *lugar* dessa
saída (o conteúdo dela é pergunta ao dono, abaixo).

→ **"Verificar de novo" volta ao estado 1**: zera o contador e reabre os ~45 segundos de espera. Hoje
essa transição não é anunciada de forma nenhuma — a tela simplesmente vira o spinner.

## Conteúdo e dados reais

- A espera é **medida e limitada**: 15 tentativas de 3 em 3 segundos ≈ **45 segundos**, e então para.
  Nunca há consulta infinita e silenciosa. Se o desenho quiser mostrar progresso da espera, é aqui.
- Valores que a pessoa pode ter acabado de pagar (formatação exata, com **espaço fixo entre `R$` e o
  número**): **R$ 15,99/mês** ou **R$ 155,88/ano** ("equivalente a R$ 12,99/mês").
- O provedor de pagamento é nomeado sempre: **Mercado Pago** (Pix ou cartão). Frases já em uso na
  jornada anterior: "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso
  app.".
- O único identificador técnico que o app sabe exibir hoje, em outra tela, é o **"Código de suporte:"**
  seguido do id de correlação. Não existe e-mail, telefone ou canal de suporte em texto em lugar
  nenhum do produto.
- Nada nesta tela é derivado de cálculo; não há campo de entrada, não há número editável.

## Estados obrigatórios

1. **Não confirmado (o foco)** — ícone/indicador de espera esgotada, título "Ainda não recebemos a
   confirmação", as duas leituras separadas, "Verificar de novo" + "Voltar para a Conta".
2. **Confirmando** — spinner + "Confirmando seu pagamento…"; a conta **continua exatamente como
   estava** (nada de selo "Premium pendente" em canto nenhum).
3. **Confirmado** — coroa + "Premium ativo!" + "Ir para a calculadora"; é o único momento em que o
   Premium aparece ligado.
4. **Repouso / hover / foco / pressionado** dos dois botões, com o anel de foco visível sobre o fundo
   real do cartão nos dois temas.
5. **Reentrada** — o instante depois de tocar "Verificar de novo": a tela volta ao estado 2. Mostre
   como a pessoa entende que a espera recomeçou, e não que o botão não fez nada.
6. **Offline** — a consulta ao servidor não sai. É falha de rede, e **jamais** pode ser desenhada
   como "você não é premium" nem como "não pagou". Precisa de um recado próprio dizendo que é a
   conexão.
7. **Sessão expirada** — se a volta do MP cai numa sessão morta, a frase da casa é "Sua sessão
   expirou. Entre novamente." e precisa de um caminho de volta ao login, não de um beco.

## Viewports

- **390px (mobile)** — obrigatório: é a largura real da maioria e a que já custou defeitos medidos.
- **1280px (desktop)** — obrigatório: a Conta ganhou grade de três colunas no desktop, mas este
  estado é um *takeover* e continua sendo um cartão só. Mostre a largura máxima do cartão e onde ele
  se ancora; um cartão de 1200px com quatro palavras centralizadas é uma resposta errada.
- 1920px é opcional e só se a decisão de largura máxima mudar de comportamento lá.

## Regras que o desenho não pode quebrar

- **O app não sabe se houve cobrança.** Nada aqui pode sugerir sucesso: nem cor de sucesso, nem
  coroa, nem "processando seu Premium", nem selo de pendência.
- **Abandono = nunca comecei.** Quem desistiu não pode sair daqui achando que deve dinheiro, que tem
  algo "em aberto" ou que precisa cancelar alguma coisa.
- **A frase honesta "nada foi cobrado" nunca mora em texto de apoio apagado, em placeholder ou em
  linha cortada.** Ela é a informação mais importante da tela para metade do público.
- **Freemium é binário**: ou o Premium está ativo, ou não está. Não invente um terceiro nível
  ("parcial", "provisório", "liberado por 24h").
- Falha de rede nunca é vendida como falta de assinatura.
- Alvos de toque ≥ 44px; contraste medido contra o fundo real do cartão, nos dois temas.

## Armadilhas já pagas neste projeto

- **Quebra de linha entre `R$` e o valor** a 390px — já aconteceu ("…equivalente a R$" / "12,99/mês").
  Nenhuma asserção de teste vê isso; só a imagem. Se um valor aparecer nesta tela, ele não parte.
- **Transbordo horizontal medido**: a 390px já nasceu botão fora da viewport (100,5px de estouro) numa
  tela de billing. Botões empilhados, texto que quebra, zero rolagem lateral.
- **Aviso que existe no código e nunca aparece na tela**: já houve um recado escrito que nenhum
  usuário jamais viu. Todo recado desenhado aqui precisa de um lugar fixo e visível no cartão.
- **Frase honesta cortada por caber num elemento estreito** — a frase inteira precisa de largura
  cheia.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de primeira classe**:

1. Não confirmado — 390px e 1280px (a peça principal, com as duas leituras separadas).
2. A sequência dos três desfechos lado a lado a 390px (confirmando → confirmado / não confirmado),
   para julgar a temperatura visual relativa.
3. Os estados 5, 6 e 7 (reentrada, offline, sessão expirada) a 390px.
4. Detalhe dos botões em repouso, hover, foco e pressionado, nos dois temas.

Reutilize os primitivos existentes, sem criar novos: `Card` como recipiente; `Icon` para o
indicador do topo (o conjunto disponível hoje é `circle-alert`, `triangle-alert`, `circle-check`,
`circle-user`, `crown`, `arrow-left`, `chevron-*`, `log-out`, `panel-left` — se o desenho pedir um
símbolo de espera/paciência que não existe, diga qual é e por quê, em vez de improvisar um
desenho); `Spinner` no estado de espera; `Button` nas variantes `primary` / `secondary` / `ghost`;
`Alert` (tons disponíveis) para o recado de offline ou de sessão expirada; `Badge` só se houver de
fato um rótulo de estado a exibir. Marque, prancheta a prancheta, qual primitivo é cada parte.

## Perguntas em aberto para o dono

1. **Existe canal de suporte?** O produto não tem e-mail, WhatsApp nem formulário em lugar nenhum.
   Se quem pagou e não vê o Premium precisa de uma saída, qual é: um e-mail de contato, o próprio
   comprovante no app do Mercado Pago, ou nada por enquanto? Sem essa resposta o desenho só pode
   reservar o espaço, não preenchê-lo.
2. **Mostrar o "Código de suporte" aqui?** Ele já existe na tela de erro técnico. Ajuda quem vai
   pedir ajuda, mas é ruído (e cheiro de erro) para quem só desistiu do checkout.
3. **A tela deve lembrar qual plano a pessoa tentou assinar** (R$ 15,99/mês ou R$ 155,88/ano)? Ajuda
   quem pagou a se reconhecer, mas fala de dinheiro com quem talvez não tenha pago nada.
4. **Qual das duas leituras vem primeiro** — "se você concluiu" ou "se você não concluiu"? A ordem
   define quem o desenho trata como público principal.
5. **A espera pode ser esticada por escolha da pessoa** ("continuar aguardando" além dos 45s), ou o
   único caminho é sair e voltar depois?
