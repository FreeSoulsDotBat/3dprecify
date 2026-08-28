# A pilha de avisos no topo da tela de Kits (e o aviso de tarifas não atualizadas)

## O que desenhar

A faixa de avisos que fica entre o cabeçalho "Monte seus kits" e a primeira peça do kit, na tela
`/kits` do Precifica3D — e, dentro dela, o aviso "Não foi possível atualizar as taxas", que hoje é o
único dos três que tem título, corpo e um botão de ação. Quem vê é um vendedor Premium montando ou
reabrindo um kit (várias peças impressas vendidas como um anúncio só). Os três avisos aparecem antes
de qualquer conteúdo real: são a primeira coisa que ele lê quando abre o app com internet ruim, com o
plano ainda sendo reconferido, ou com o Premium pausado. Desenhe a PILHA (ordem, densidade, quanto ela
pode ocupar) e o aviso de tarifas como peça detalhada dentro dela.

## Por que este prompt existe

Nada disso foi desenhado. O aviso de tarifas foi inferido por uma IA a partir de requisito textual:
alguém decidiu sozinho que ele seria um alerta de tom informativo, no topo, uma vez para o kit inteiro
(não por peça), não bloqueante, com botão e indicador de espera. No canvas de 1920px do 018 o bloco
Kits tem exatamente UM alerta, e ele é o de peça inválida DENTRO do card da peça — não existe nenhum
alerta no topo da página de Kits, logo não existe pilha desenhada. No protótipo de 2026-07 (§E9) há um
"banner offline" no shell e um erro global, mas o catálogo de tarifas nem existia então. O único
alerta de topo já desenhado em qualquer lugar está em Orçamentos e é sobre outra coisa (ver abaixo) —
é a referência de forma mais próxima que temos, e ela contradiz o que o código de Kits faz.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/bom/bom-page.tsx` (três alertas em sequência, linhas 447/452/459) e
`apps/web/src/shared/i18n/messages.pt-br.ts`. Ordem atual, de cima para baixo, dentro da mesma coluna
com 16px entre os blocos:

| # | Aviso | Quando aparece | Texto literal hoje | Ação |
|---|-------|----------------|--------------------|------|
| 1 | Plano não conferido | a reconsulta do plano falhou, mas a última resposta do servidor dizia ativo | "Não foi possível verificar seu plano." (sem título, sem corpo) | nenhuma |
| 2 | Premium pausado | conta com Premium pausado reabrindo um kit salvo | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." | nenhuma |
| 3 | Tarifas não atualizadas | a busca online da tabela de tarifas falhou (fica ligado até um sucesso) | título "Não foi possível atualizar as taxas" + corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." | botão secundário pequeno "Tentar novamente", empilhado abaixo do corpo |

→ Os três usam o MESMO tom informativo, o mesmo ícone (ⓘ) e o mesmo fundo. Três blocos idênticos
empilhados leem como um bloco só de três parágrafos — nada indica que são três assuntos diferentes,
nem qual deles pede ação.
→ Não há ordem pensada: a ordem de hoje é a ordem em que o código foi escrito. O único com botão é o
último, ou seja, o mais longe do polegar e o mais provável de ficar fora da primeira dobra.
→ Em Orçamentos o alerta de topo equivalente já é COMPACTO: uma linha só, título e botão
"Sincronizar agora" lado a lado, verticalmente centralizados. Em Kits a mesma função virou bloco alto
com o botão embaixo. Duas formas para a mesma coisa no mesmo app.
→ O aviso de tarifas aparece mesmo com o kit VAZIO (acima do estado vazio "Monte seu kit peça por
peça") e mesmo quando nenhuma peça vende em marketplace — ele fala de um número que o vendedor ainda
não usou. Na calculadora o mesmo aviso só aparece dentro da seção de marketplaces, quando ela está
ligada.
→ Acima de tudo isso ainda pode existir a faixa offline do shell, em largura cheia: "Você está
offline. O cálculo continua funcionando." E acima da pilha vem o cabeçalho da página: título "Monte
seus kits" + descrição "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos
cadastrados ou peças avulsas".

## Conteúdo e dados reais

- Os textos acima são literais e já homologados: **não reescreva**. Se algum for ruim, aponte no
  entregável em vez de trocar.
- O aviso de tarifas fala da tabela de comissões de marketplace (Mercado Livre, Shopee, Amazon) que
  alimenta os preços por canal do kit — hoje 79+ entradas, versão datada (`2026-08-06.1`). Quando a
  atualização falha, o app usa a cópia salva no aparelho ou a semente que veio no build; **nenhum
  preço deixa de ser calculado**.
- Escala dos números que aparecem logo abaixo da pilha, para dimensionar o desenho: "Total do kit"
  com custo total e preços por canal, na casa de `R$ 24,24` / `R$ 21,01` / `R$ 16,16`; quantidade por
  peça com sufixo "un".
- O aviso não tem contador, nem data, nem "última atualização" — esse dado não existe na tela hoje.
  Mostrar a data da referência salva é decisão de produto (ver perguntas ao final).
- O botão "Tentar novamente" tem 44px de altura real (o mínimo de toque vence a altura nominal de 36px
  do tamanho pequeno) — não desenhe um botão de 36px.

## Estados obrigatórios

- **Repouso, um aviso só** — o caso comum: apenas "Não foi possível atualizar as taxas".
- **Repouso, pilha de dois e de três** — desenhe as duas combinações reais: (plano + tarifas) e
  (plano + Premium pausado + tarifas). É o estado que ninguém nunca desenhou e é o motivo deste prompt.
- **Foco de teclado no "Tentar novamente"** — anel de foco visível sobre o fundo tingido do alerta,
  não sobre o fundo da página.
- **Hover e pressionado do botão** — sutis; nada aqui é urgente.
- **Tentando de novo (carregando)** — o botão em espera com indicador; o aviso **continua visível
  durante a tentativa** (ele é fixo de propósito: já piscou e sumiu no meio do retry, e isso foi
  corrigido). O texto não muda.
- **Sucesso** — o aviso simplesmente desaparece; não há mensagem de "atualizado".
- **Offline de verdade** — a faixa offline do shell aparece ACIMA de tudo; desenhe a convivência das
  duas, porque dizem coisas parecidas com palavras diferentes.
- **Premium pausado** — aviso 2 presente; note que nesse estado o botão "Salvar kit" continua visível
  e responde com honestidade quando tocado, nunca desabilitado e mudo.
- **Kit vazio** — a pilha acima do estado vazio "Monte seu kit peça por peça".

## Viewports

- **Mobile 390px** — obrigatório, e é o viewport que dói: é onde a pilha empurra a primeira peça para
  fora da dobra. Estimativa a partir dos tokens (16px de padding, texto de 14px, ~294px de largura útil
  de texto): aviso de tarifas ~180px, Premium pausado ~92px, plano ~52px, mais 32px de folgas ≈ 356px;
  somando o cabeçalho da página (~85px) e a barra superior, passa de metade dos ~724px de área útil
  antes da primeira peça. **Meça no desenho e marque a dobra** — a estimativa é minha, a medida é sua.
- **Desktop 1280px** — o corte em que a tela vira duas colunas (peças à esquerda, resumo fixo de 480px
  à direita). Hoje a pilha fica ACIMA das duas colunas, em largura cheia: mostre se ela deve continuar
  assim ou entrar na coluna das peças.
- **Desktop 1920px** — a página vai até 1720px de largura; um alerta de uma frase esticado por 1720px
  vira uma linha de texto de dois metros. Resolva.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é "você não é Premium".** Os três avisos falam de coisas diferentes: rede,
  plano em reconferência, plano pausado. O desenho tem que deixar isso legível sem obrigar a ler o
  parágrafo inteiro.
- **Não bloqueante é não bloqueante.** Nada de modal, de sobreposição, de qualquer coisa que impeça
  montar o kit. O preço continua saindo com a referência salva — a frase já diz isso e ela precisa
  aparecer inteira, nunca cortada e nunca dentro de um placeholder de campo.
- **Degradação dita, não escondida.** É legítimo compactar, mas se a frase "o cálculo continua
  funcionando" sair da tela ela precisa continuar alcançável (um ⓘ, um expandir) — não pode
  simplesmente sumir.
- **Alvo de toque ≥44px** para "Tentar novamente", inclusive no formato compacto de uma linha.
- **Contraste medido contra o fundo real do alerta** (a superfície tingida), nos dois temas — não
  contra o fundo da página.
- **A ordem tem que ser defensável.** Proponha uma ordem e escreva o critério em uma linha (ex.: o que
  pede ação primeiro; o que fala de dinheiro antes do que fala de plano).

## Armadilhas já pagas neste projeto

- **Overflow se mede, não se olha.** Um botão que nasceu fora da viewport já custou 100,5px de estouro
  nesta app, e teste de texto passa em elemento estourado. Mostre a caixa.
- **Frase honesta em lugar apertado se perde.** Já aconteceu aqui: a parte honesta de uma frase ficou
  dentro de um campo e foi cortada. Frase de honestidade mora em elemento de largura cheia.
- **Aviso que pisca durante o retry** — já corrigido no código; o desenho não pode reintroduzir um
  "some enquanto tenta".
- **Empilhamento sem ordem empurra o conteúdo real para fora da dobra** — é exatamente o impacto que a
  auditoria registrou nesta peça.

## Entregável

Pranchetas em tema escuro (padrão) e tema claro, ambos completos:

1. Mobile 390px — pilha de três avisos, com a linha da dobra marcada e a altura de cada bloco anotada.
2. Mobile 390px — a mesma pilha na sua proposta compactada, com a mesma medição, para comparar.
3. Mobile 390px — o aviso de tarifas em repouso / tentando de novo / com foco no botão.
4. Desktop 1280px — a pilha no contexto das duas colunas (peças + resumo fixo à direita).
5. Desktop 1920px — o mesmo, resolvendo a largura de 1720px.
6. Mobile 390px — a pilha sobre o kit vazio, com a faixa offline do shell presente.

Reutilize os primitivos existentes, sem criar novos: o bloco de alerta (`tf-alert`, tom informativo) e
a variante compacta que já existe — a mesma que Orçamentos usa no "Sincronizar agora"; o botão
secundário pequeno (`tf-btn--secondary tf-btn--sm`) para "Tentar novamente", com o estado de espera do
próprio botão; o ícone informativo do conjunto do DS; e o cabeçalho de página existente acima da pilha.
Se o desenho precisar de um agrupamento novo (um "acordeão de avisos", por exemplo), descreva-o com os
primitivos existentes e diga por que a variante compacta não bastou.

## Perguntas em aberto para o dono

1. **Ordem dos três avisos** — qual a prioridade quando coexistem? Ninguém decidiu; a de hoje é
   acidental.
2. **O aviso de tarifas deve aparecer com o kit vazio, ou só quando existir ao menos uma peça?** Na
   calculadora ele só aparece dentro da seção de marketplaces, quando ligada; em Kits aparece sempre.
3. **Compactar para uma linha custa esconder "o cálculo continua funcionando" e "você pode informar as
   taxas manualmente".** Pode ir para um ⓘ, ou essa frase precisa ficar sempre visível?
4. **Mostrar a data da referência salva** (ex.: "referência de 06/08") deixaria o aviso mais honesto,
   mas é dado novo na tela. Vale?
5. **Confirmar o sucesso do "Tentar novamente"** — hoje o bloco só some, sem nenhuma confirmação. O
   vendedor precisa ser avisado de que deu certo?
