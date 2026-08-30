# Retorno do checkout — a única confirmação de compra do produto

## O que desenhar

A tela que o vendedor vê ao voltar do Mercado Pago depois de pagar. O Mercado Pago devolve o navegador
para `/conta?checkout=retorno`, e essa rota **toma a página Conta inteira**: some o painel de plano, some
o tema, some a privacidade, some o "Sair" — fica apenas o cabeçalho "Conta" e um único cartão centralizado.
Esse cartão assume um de **três estados**, decididos por consulta ao servidor (o app **não sabe**, na volta,
se o pagamento passou — quem escreve o direito é o webhook verificado). É o único momento de confirmação de
compra do produto inteiro: quem chega aqui é um vendedor autônomo que acabou de tirar R$ 155,88 (anual) ou
R$ 15,99 (mensal) do bolso, provavelmente no celular, provavelmente com pressa.

## Por que este prompt existe

Nunca houve desenho desta tela. O protótipo de 2026-07-02 termina na "Tela de planos Free × Premium" com
preços "R$ —" e **sem checkout** — o `onSubscribe` do `PremiumScreen` literalmente cai no `onClose`: o
protótipo FECHA a tela no clique de assinar e não desenha nada depois. O canvas 018 também não tem artboard
de confirmação (a prop `plano` já nasce `premium` ou `free`, sem transição). Autoridade de desenho: NENHUMA.
O que existe hoje foi composto por inferência: coroa de 28px + título + uma frase + um botão. Sem valor pago,
sem plano contratado, sem data da próxima cobrança, sem link para o comprovante do Mercado Pago. E o botão
manda para a calculadora — descartando a intenção que o app carregou até aqui (o teaser que originou a
compra sempre aponta para `/conta?assinar=1`, e a superfície onde o vendedor bateu no teaser é esquecida
exatamente no momento em que ele finalmente pode usá-la).

## O que já existe hoje (não invente do zero — corrija)

Um cartão só (`Card`), coluna, `gap` 0.75rem, **texto centralizado**, dentro de uma página de largura ampla.

**Estado SUCESSO** (o servidor confirmou: direito `active` com origem `payment`):

| elemento | conteúdo literal hoje |
|---|---|
| ícone | coroa (`crown`), 28px, decorativa |
| título (h2) | "Premium ativo!" |
| corpo | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." |
| ação única | "Ir para a calculadora" (botão primário) → `/calcular` |

→ **Problema 1:** não há recibo. Nenhum valor, nenhum plano ("Plano anual"/"Plano mensal"), nenhuma data de
próxima cobrança, nenhum caminho para o comprovante. O vendedor não tem onde conferir o que comprou.
→ **Problema 2:** a coroa de 28px carrega sozinha toda a celebração de uma compra — é menor que o título.
→ **Problema 3:** o único destino é a calculadora, que já era grátis e não é o que ele acabou de comprar.
→ **Problema 4:** no desktop esse cartão fica sozinho num container largo — desenhe a largura máxima dele.

**Estado CONFIRMANDO** (padrão ao chegar; consulta o servidor a cada 3s, no máximo 15 vezes ≈ 45s):
`Spinner` + h2 "Confirmando seu pagamento…" + "Estamos verificando com o Mercado Pago. Assim que confirmar,
o Premium liga sozinho — você não precisa fazer mais nada." + dois botões empilhados: "Atualizar"
(secundário) e "Voltar para a Conta" (fantasma).

**Estado NÃO CONFIRMADO** (a paciência de ~45s acabou): ícone `circle-alert` 28px + h2 "Ainda não recebemos
a confirmação" + "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se
você não concluiu, nada foi cobrado." + "Verificar de novo" (secundário) e "Voltar para a Conta" (fantasma).

→ **Problema 5:** os três estados são visualmente quase o mesmo cartão — só troca o glifo de 28px. A compra
bem-sucedida não tem peso visual nenhum a mais que a espera.

Copy que **não** deve ser reinventada: as três frases de estado acima são deliberadas e já ratificadas —
elas existem para nunca vender um "processando" como sucesso e para tornar o abandono indistinguível de
"nunca comecei" ("Se você não concluiu, nada foi cobrado"). Mantenha-as verbatim.

## Conteúdo e dados reais

Preços literais do catálogo de planos (fonte única; o espaço entre `R$` e o número é NBSP):
"R$ 155,88/ano" · "equivalente a R$ 12,99/mês" · "~19% de economia frente ao mensal" · "R$ 15,99/mês" ·
"cobrança todo mês, cancele quando quiser". Rótulos de plano existentes: "Plano mensal" / "Plano anual".

O que o servidor **já tem** e a tela hoje ignora — desenhe espaço para isso:
- direito: `status` (`none` | `active` | `lapsed`), `source` (aqui: `payment`), `expiresAt` (data ISO);
- espelho do Mercado Pago: `plan` (`monthly` | `annual`), `currentPeriodEnd`, `cancelAtPeriodEnd`, `graceUntil`.

Exemplo concreto para as pranchetas: **Plano anual · R$ 155,88 · próxima cobrança em 20/08/2027**. Faça
também uma variante mensal: **Plano mensal · R$ 15,99 · próxima cobrança em 20/09/2026** — a data é o campo
que mais estica a linha. Frases já existentes que servem de vocabulário: "renova em", "ativo até".

## Estados obrigatórios

1. **Sucesso** — a peça principal. Coroa/celebração + "Premium ativo!" + o corpo verbatim + o bloco de
   recibo (plano, valor, próxima cobrança) + as ações.
2. **Confirmando (carregando)** — spinner + a frase de espera verbatim. Nunca insinua que a cobrança passou.
   Mostre também que a espera é **limitada** (é ~45s de consulta, não um giro infinito).
3. **Não confirmado** — alerta + a frase verbatim + "Verificar de novo".
4. **Offline / sem resposta do servidor** — **hoje esse estado não existe no código**: uma falha de leitura
   é indistinguível da espera e desemboca, 45s depois, em "Ainda não recebemos a confirmação". Desenhe-o
   separado: a rede falhou, a cobrança **não** está em questão, e nada é vendido como "não é premium".
5. **Foco (teclado)** — anel visível em cada botão, dentro da caixa do próprio botão.
6. **Repouso · hover · pressionado · desabilitado** dos botões; "Atualizar"/"Verificar de novo"
   desabilitados/ocupados enquanto a consulta está em voo.

## Viewports

- **Mobile 390px** — obrigatório, é o caso real: o retorno do Mercado Pago acontece no celular. Cartão de
  largura total, ações empilhadas, cada uma com altura de alvo ≥44px.
- **Desktop 1280px** — obrigatório: a Conta tem layout desktop e essa rota toma a página inteira. Defina a
  largura máxima do cartão e o alinhamento horizontal; hoje ele herda um container amplo e fica órfão.
- 1920px opcional, só se a decisão de largura máxima mudar nessa faixa.

## Regras que o desenho não pode quebrar

- **Nada de premium antecipado.** Só o estado 1 pode ter coroa, verde ou qualquer sinal de "ativo". Os
  estados 2, 3 e 4 são neutros.
- **Falha de rede nunca é "você não é premium"** — o estado 4 diz "não consegui perguntar", não "não tem".
- **Procedência do número:** todo valor mostrado no recibo é o que o servidor/PSP respondeu, não um valor
  que a tela lembra do momento da oferta. Se um dado não vier, o desenho mostra a linha **ausente**, não um
  número plausível.
- **Frase honesta nunca em placeholder** nem em elemento que possa ser cortado — "Se você não concluiu, nada
  foi cobrado" precisa de largura inteira e quebra em quantas linhas precisar.
- **Alvo ≥44px** em todos os botões; contraste medido contra o fundo real do cartão nos dois temas.
- **Freemium binário:** não invente "premium parcial", "ativando", "pendente premium". São três estados e
  o quarto é rede.

## Armadilhas já pagas neste projeto

- **Quebra de linha entre `R$` e o valor a 390px** — já aconteceu num teaser: a linha terminou em
  "equivalente a R$" e a próxima começou em "12,99/mês". Nenhuma asserção de texto ou geometria vê isso
  (não há corte nem transbordo), só a imagem. Linha de preço não separa símbolo de número.
- **Transbordo horizontal medido nos dois eixos** — um botão já nasceu 100px fora da viewport nesta mesma
  área de billing; o headless não vê barra de rolagem clássica.
- **Texto ocluso passa em teste** — um elemento pode estar "visível" para a asserção e coberto na tela;
  o desenho precisa de folga real entre o cartão e o cabeçalho da página.
- **Data longa estica a linha** — "próxima cobrança em 20/08/2027" ao lado de "Plano anual" é o par que
  estoura primeiro no 390px; desenhe a versão empilhada.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Sucesso · 390px — com o bloco de recibo (variante anual).
2. Sucesso · 390px — variante mensal (a data curta vs. longa muda o empilhamento).
3. Sucesso · 1280px — com a largura máxima do cartão resolvida.
4. Confirmando · 390px.
5. Não confirmado · 390px.
6. Offline · 390px (estado novo).
7. Um detalhe em close das ações mostrando repouso/hover/foco/ocupado.

Reaproveite os primitivos existentes, sem criar novos: `Card` para o contêiner; `Icon` (`crown`,
`circle-alert`) para o glifo — se a celebração precisar de mais peso, diga o **tamanho** da coroa em vez de
inventar uma ilustração; `Spinner` no estado 2; `Button` nas variantes primária/secundária/fantasma;
`Badge` para o rótulo de plano ("Plano anual"); `Alert` para o estado offline; e as linhas do recibo com
o mesmo par rótulo/valor que a Conta já usa. O valor pago, se aparecer com destaque, usa a escala de preço
já existente — não uma tipografia nova.

## Perguntas em aberto para o dono

1. **A confirmação vira recibo?** Mostrar plano + valor pago + data da próxima cobrança nesta tela é uma
   decisão de produto (exige consultar o espelho do PSP no retorno, além do direito). Se sim: os três dados
   ou só plano + próxima cobrança?
2. **Link para o comprovante do Mercado Pago** — abrir o comprovante do PSP em nova aba é desejado, ou o
   comprovante fica exclusivamente por e-mail do MP?
3. **Para onde vai o botão principal?** Hoje é sempre "Ir para a calculadora". O app carrega, até o momento
   do pagamento, a intenção de onde o vendedor bateu no teaser (catálogo, kits, orçamentos, simulações).
   Deve voltar para lá? E se não houver intenção guardada, o destino padrão é a calculadora ou a Conta?
4. **Quantas ações no sucesso?** Uma só, ou uma primária de destino + uma secundária "Ver minha assinatura"
   levando ao painel de plano na Conta?
5. **A espera de ~45s deve ser visível?** Mostrar que a verificação é limitada no tempo (contagem, barra,
   ou "verificando há alguns segundos") é honestidade a mais ou ansiedade a mais?
