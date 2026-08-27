# Retorno do checkout — a espera "Confirmando seu pagamento…"

## O que desenhar
A tela inteira que o vendedor encontra quando volta do checkout hospedado do Mercado Pago para o app,
na rota `/conta?checkout=retorno`. É uma tela só, com **três desfechos mutuamente exclusivos**:
(1) **aguardando** — o app pergunta ao servidor, a cada 3 segundos, até 15 vezes (≈45 s), se o Premium
já foi liberado; (2) **confirmado** — o servidor confirmou o pagamento; (3) **não confirmado** — a
paciência acabou sem resposta positiva. Ela toma a página da Conta por completo: acima dela sobra
apenas o cabeçalho "Conta", e a grade de três colunas da Conta (identidade+plano · tema · privacidade)
não é renderizada. É o instante de maior ansiedade da jornada inteira: o cartão pode ter sido cobrado
e o app honestamente ainda não sabe.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho cobre isto. O protótipo de 2026-07-02 **exclui o assunto por
escrito duas vezes** (a seção se chama "Upsell (sem checkout — E6 fora de escopo)" e o §J repete que o
fluxo de upsell termina na tela de planos); o `Abas-Desktop.dc.html` do 018 trata `plano` como enum
binário `"premium" | "free"` e não tem nenhuma ocorrência de checkout/retorno; o kit de UI diz no
cabeçalho do arquivo "Pagamento (Mercado Pago) integra depois — só a tela". Ou seja: a peça que decide
a confiança do vendedor no momento em que ele acabou de pagar foi inteiramente inferida por IA a partir
de requisito textual. O que existe hoje é um cartão centralizado com spinner, título, parágrafo e dois
botões — e **nenhuma representação da passagem do tempo**, o que é justamente o que falta em 45 segundos
de silêncio.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/checkout-return.tsx`, `billing.css` (`.tf-billing-return`),
`pages/conta/conta-page.tsx`, textos em `shared/i18n/messages.pt-br.ts` (`messages.billing`).

| Desfecho | Ícone / indicador | Título (h2) | Corpo (p) | Ações (nesta ordem) |
|---|---|---|---|---|
| Aguardando | `Spinner` (indeterminado, rótulo de leitor de tela "Carregando…") | "Confirmando seu pagamento…" | "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada." | "Atualizar" (secundário) · "Voltar para a Conta" (fantasma) |
| Confirmado | ícone `crown`, 28 px | "Premium ativo!" | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." | "Ir para a calculadora" (primário, sozinho) |
| Não confirmado | ícone `circle-alert`, 28 px | "Ainda não recebemos a confirmação" | "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado." | "Verificar de novo" (secundário) · "Voltar para a Conta" (fantasma) |

Estrutura visual atual: um `Card` em coluna, `gap` de 0,75 rem, **tudo centralizado** (`text-align:
center`), e os botões empilhados em coluna com 0,5 rem entre eles. O cartão **não tem largura máxima
própria** — herda a da página, que no 018 vai a 1720 px a partir de 1280 px.

→ **Problema 1 — o tempo é invisível.** 15 tentativas × 3 s ≈ 45 s sem contador, barra, tique ou
qualquer sinal de progresso. O spinner de hoje gira igual no segundo 2 e no segundo 44.
→ **Problema 2 — falha de rede é vendida como "pagamento não confirmado".** O componente lê apenas
"o Premium ficou ativo?"; ele ignora os estados que a fonte de dados oferece (erro sem resposta
alguma, resposta lembrada/vencida do cache do aparelho). Sem internet, o vendedor vê 45 s de spinner e
depois "Ainda não recebemos a confirmação" — uma frase que culpa o pagamento por um problema de
conexão. Isto contraria a regra da casa de nunca vender falha de rede como outra coisa.
→ **Problema 3 — a troca de estado é muda.** O cartão inteiro é substituído sozinho, sem região de
anúncio para leitor de tela e sem levar o foco para o novo conteúdo.
→ **Problema 4 — "Verificar de novo" reinicia silenciosamente outros ≈45 s.** Nada no desenho diz isso.
→ **Problema 5 — "Atualizar" contradiz o corpo**, que acabou de prometer "você não precisa fazer mais
nada". E o nome colide com o botão do próprio Mercado Pago no fluxo vizinho (no painel de plano, o
mesmo gesto foi renomeado "Recarregar" por ratificação do dono, exatamente para não colidir).
→ **Problema 6 — a composição foi pensada só para telefone.** Um cartão centralizado de largura livre e
botões empilhados em coluna a 1720 px é uma faixa de texto centralizado no vazio.

## Conteúdo e dados reais
- Preços que o vendedor acabou de ver na tela anterior (para coerência de tom, não para repetir aqui
  sem decisão do dono): "R$ 15,99/mês" ("cobrança todo mês, cancele quando quiser") e "R$ 155,88/ano".
- Antes desta tela: o botão "Assinar Premium" leva ao aviso honesto "Abrindo o Mercado Pago…" e o app
  entrega o vendedor ao checkout do MP (o cartão nunca passa pelo app — a Conta afirma isso com "O
  cartão nunca passa pelo nosso app.").
- Janela de sondagem: **3 s entre tentativas, 15 tentativas, ≈45 s no total** — números reais do código,
  não estimativa.
- O Premium só é ligado por confirmação verificada no servidor (webhook/reconciliação). O app **não
  tem** um estado "pagamento pendente" para exibir como selo: o caso "desisti no meio" tem que ficar
  indistinguível de "nunca comecei", e em nenhum lugar da Conta pode aparecer um "pendente premium".
- Nada nesta tela é editável. Não há campo, valor monetário calculado, nem número derivado.
- Depois desta tela: "Ir para a calculadora" (sucesso) ou de volta à Conta (demais casos).

## Estados obrigatórios
1. **Aguardando (repouso)** — spinner + "Confirmando seu pagamento…" + o corpo acima. Precisa mostrar
   que o tempo passa e que a espera é limitada (a forma é decisão do desenho: tique de tentativas,
   barra determinada de ~45 s, ou uma legenda de duração).
2. **Aguardando, com verificação manual em curso** — o vendedor tocou em "Atualizar": o botão precisa
   de um estado ocupado próprio (o dado de "consulta em voo" existe e hoje não é usado) e continuar
   com alvo ≥44 px.
3. **Confirmado** — coroa + "Premium ativo!" + corpo + ação única. Este é o único momento em que o app
   pode afirmar Premium; nada antes dele.
4. **Não confirmado (paciência esgotada)** — alerta + "Ainda não recebemos a confirmação" + corpo, com
   as duas ações. Deve deixar claro que "Verificar de novo" abre uma nova rodada de espera.
5. **Sem conexão / servidor sem resposta** — estado que hoje NÃO existe e precisa existir: texto próprio
   dizendo que não foi possível verificar agora, sem afirmar nem negar o pagamento (copy a ratificar
   pelo dono, ver perguntas).
6. **Sessão expirada durante o retorno** — o app já tem o caminho de volta "Entrar de novo" (padrão da
   correção A3); desenhe como ele aparece aqui sem parecer que o pagamento falhou.
7. **Já era Premium ao voltar** — a Conta tem a frase "Você já é Premium."; decida como esta tela se
   comporta se o vendedor cair aqui já com plano ativo por outra origem.
8. **Foco, hover, pressionado e desabilitado** dos dois botões, nos dois temas.
9. **Anúncio da mudança automática** — mostre no desenho onde vive a região que anuncia a troca de
   estado e para onde o foco vai quando o cartão é substituído sozinho.

## Viewports
- **Mobile 390 px** — obrigatório e prioritário: o retorno do checkout do MP acontece majoritariamente
  no telefone, e é onde o vendedor está enquanto espera.
- **Desktop 1280 px** — o corte do 018; aqui a página passa a usar largura larga e o cartão de hoje
  fica solto. Defina largura máxima da peça e o alinhamento dos botões (lado a lado ou empilhados).
- **Desktop 1920 px** — só para provar que a peça não vira uma linha de texto perdida em 1720 px de
  página. Um artboard basta.

## Regras que o desenho não pode quebrar
- **Nunca antecipar o Premium.** Enquanto o servidor não confirmar, nada de coroa, nada de badge verde,
  nada de "processando seu Premium" — o app realmente não sabe se houve cobrança.
- **Falha de rede jamais é vendida como pagamento não confirmado** (nem o contrário).
- **Abandonar o checkout é indistinguível de nunca ter começado**: a frase "Se você não concluiu, nada
  foi cobrado" é a promessa; nenhum resíduo de "pendente" pode sobrar na Conta.
- **Frase honesta nunca dentro de placeholder** nem em elemento que corta: as três frases acima são
  longas e precisam de bloco de largura inteira.
- **Freemium binário**: ou é Premium, ou não é. Não invente um terceiro selo de plano.
- Alvo de toque **≥44 px** nos dois botões, inclusive no fantasma.
- Contraste medido contra o fundo real do cartão, nos dois temas — o texto secundário do corpo é o de
  maior risco.

## Armadilhas já pagas neste projeto
- **O aviso que nunca apareceu**: no billing PR-B uma confirmação existia no código e nunca renderizou
  porque o diálogo desmontava antes do retorno da chamada — aqui há troca automática de estado, então
  desenhe a confirmação como **conteúdo permanente da tela**, nunca como aviso efêmero pós-ação.
- **100,5 px de estouro horizontal com um botão nascido fora da viewport** (mesma tela de billing).
  Meça a largura da peça a 390 px com os botões nos rótulos reais.
- **Estouro vertical que o headless não vê**: barra de rolagem clássica não aparece em teste; meça os
  dois eixos com o cartão no seu estado mais alto (não confirmado + aviso de rede).
- **Texto ocluso passa em teste**: título e corpo precisam de caixa medida, não só de presença.
- **Sufixo cortado em placeholder** (016): qualquer contagem ou legenda de tempo vive em elemento
  próprio de largura inteira, não pendurada no fim de outra frase.

## Entregável
Pranchetas, tema **escuro como padrão e claro como primeira classe** (ambos desenhados, não derivados):
390 px × {aguardando, aguardando com verificação manual em curso, confirmado, não confirmado, sem
conexão}; 1280 px × {aguardando, não confirmado}; 1920 px × {aguardando}. Mais uma prancheta de detalhe
com os estados de foco/hover/pressionado/desabilitado dos dois botões e a marcação de para onde vai o
foco na troca automática.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o **card** da casa; o indicador de
espera é o **spinner** (tamanhos sm/md/lg já existentes); os ícones são **`crown`** (confirmado) e
**`circle-alert`** (não confirmado), 28 px; as ações são o **botão secundário** ("Atualizar" /
"Verificar de novo"), o **botão fantasma** ("Voltar para a Conta") e o **botão primário** ("Ir para a
calculadora"); o aviso de rede usa o mesmo bloco de alerta que a oferta de planos já usa; o título
"Conta" acima da peça é o **cabeçalho de página** padrão. Indique no desenho o que muda e o que
permanece entre os três desfechos — é uma tela, três desfechos, e a continuidade visual entre eles é
parte do que precisa ser desenhado.

## Perguntas em aberto para o dono
1. **Mostrar a passagem do tempo como quê?** Contador de tentativas, barra determinada de ~45 s, ou
   apenas uma legenda ("costuma levar menos de um minuto")? E qual a frase exata — copy nova precisa da
   sua ratificação.
2. **"Atualizar" continua existindo?** O corpo promete que nada é preciso, e o mesmo gesto já foi
   renomeado "Recarregar" no painel de plano para não colidir com o botão do Mercado Pago.
3. **O trilho de navegação e as abas continuam visíveis e clicáveis durante a espera**, ou a tela é
   focada, sem navegação lateral, até haver um desfecho?
4. **Sem conexão: qual é a frase?** Precisa ser distinta de "Ainda não recebemos a confirmação" e não
   pode afirmar nada sobre a cobrança.
5. **Depois do "não confirmado", existe um caminho de suporte** (falar com a gente, consultar o
   comprovante no Mercado Pago), ou o único destino continua sendo voltar para a Conta?
6. **"Verificar de novo" deve abrir outra rodada de ≈45 s** com a mesma tela de espera, ou uma
   verificação única com resposta imediata?
