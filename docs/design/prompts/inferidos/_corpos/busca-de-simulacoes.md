# Busca dentro de "Minhas simulações" (campo + "nada encontrado")

## O que desenhar
O campo de busca por nome que fica no topo da folha **"Minhas simulações"** — o painel lateral que o
vendedor abre pelo cabeçalho da tela Calcular para reabrir uma estratégia salva (canais, taxas
ajustadas, base de custo) — e o estado **"nada encontrado"** que aparece quando a busca não devolve
nenhuma linha. Quem usa: um vendedor Premium que já acumulou dezenas de simulações e precisa achar
"Camiseta Shopee 3 canais" sem rolar a lista inteira. O momento é sempre de pressa: ele está com a
calculadora aberta, quer trocar de cenário e voltar. A peça é pequena (um campo + um vazio), mas é a
única porta de entrada para uma lista que cresce sem limite.

## Por que este prompt existe
Ninguém desenhou esta busca. Ela foi inferida a partir de requisito textual e saiu **sem lupa, sem
rótulo visível, sem "x" de limpar e sem contador de resultados** — enquanto o dono desenhou o MESMO
componente duas vezes no canvas de 018, e nas duas **com a lupa dentro do `tf-inputwrap`** (Catálogo,
`placeholder="Buscar no catálogo…"`; Orçamentos, `placeholder="Cliente, pedido…"`). Ou seja: o código
contraria uma regra de desenho explícita do próprio produto. O canvas exclui a aba Calcular por
escrito, então a busca DESTE painel nunca teve prancheta. Registro corroborante de que ninguém olhou:
o campo chegou a ser publicado **1×1px, invisível**, e só foi descoberto depurando no navegador real
(o comentário está no próprio arquivo). Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`.

## O que já existe hoje (não invente do zero — corrija)
A folha, de cima para baixo: título "Minhas simulações" · subtítulo "Estratégias salvas. Cada uma
recalcula com os preços de hoje quando você abre." · **campo de busca** · alertas (offline / premium
pausado) · lista de cards · "Carregar mais".

| Peça | Como está hoje | Problema |
|---|---|---|
| Rótulo do campo | Nenhum visível. O `aria-label` é a própria frase do placeholder | → o placeholder some ao digitar e o campo fica anônimo |
| Placeholder | "Buscar por nome…" | → é a única pista de que aquilo é uma busca |
| Ícone | **nenhum** | → o desenho do dono tem lupa em toda busca deste produto |
| Limpar | só o botão "Limpar busca" DENTRO do vazio | → com resultados na tela não há como limpar sem apagar à mão |
| Contador | não existe | → o Catálogo mostra a contagem ao lado do campo; aqui não |
| Feedback ao digitar | debounce de 250ms e a busca vai ao **servidor** | → ver "Estados obrigatórios": hoje isso apaga o campo da tela |
| Vazio da busca | `EmptyState` ícone `boxes`, título "Nenhuma simulação encontrada para “{termo}”.", botão "Limpar busca" | → **mesmo ícone** do vazio geral; sem descrição de saída |
| Vazio geral | `EmptyState` ícone `boxes`, "Nenhuma simulação salva ainda" + "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a calculadora" | → indistinguível do vazio de busca à primeira vista |

Para comparação, o Catálogo (desenhado) usa: lupa + rótulo `sr-only` "Buscar no catálogo" + contagem
ao lado + vazio de busca com ícone PRÓPRIO (`package`), título "Nada encontrado para essa busca" e
descrição "Tente outro termo, ou limpe a busca para ver tudo de novo."

## Conteúdo e dados reais
- **Termo de busca**: texto livre, sem mínimo de caracteres, casado contra o **nome** da simulação
  (nome: obrigatório, até 120 caracteres). A busca roda no servidor a cada 250ms parados.
- **Card de resultado** (o que a busca devolve): nome em 1 linha com reticências · nota opcional em 2
  linhas com reticências (até 500 caracteres) · legenda "Atualizado há 2 dias" (nunca uma data — as
  formas reais são "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas") · três botões
  fantasma em linha à direita: renomear (lápis), duplicar (cópia), excluir (lixeira), 18px cada.
- **Eco do termo** no vazio: o título repete literalmente o que foi digitado, entre aspas curvas.
  Exemplo real de estouro: buscar `Camiseta preta estampada personalizada Shopee frete grátis` produz
  um título de mais de 60 caracteres dentro de um painel de no máximo 416px.
- **Sem total conhecido**: a lista é paginada por cursor ("Carregar mais"), então só existe a
  quantidade **já carregada** — um contador não pode prometer "de X".

## Estados obrigatórios
1. **Repouso, vazio**: lupa + placeholder "Buscar por nome…", rótulo legível (não só para leitor de tela).
2. **Foco**: borda e anel na cor de foco lidos como UM traço só (o produto já teve borda dupla aqui).
3. **Hover** do campo e dos botões de ação do card.
4. **Preenchido com resultados**: o termo visível, o "x" de limpar disponível, e a contagem do que está
   na tela (ver perguntas ao dono para a copy exata).
5. **Buscando (o estado que hoje não existe e é o principal pedido)**: como a busca vai ao servidor e a
   consulta filtrada não tem cache, hoje a tela inteira é substituída por um `Spinner` — **o campo
   desaparece e o foco se perde no meio da digitação**. Desenhe um carregamento que mantenha o campo
   montado e no lugar: indicador dentro/ao lado do campo e a área de resultados em espera.
6. **Vazio de busca**: "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca" — com ícone
   DIFERENTE do vazio geral e uma descrição que diga a saída ("Tente outro termo…").
7. **Vazio geral (para contraste, na mesma prancheta)**: "Nenhuma simulação salva ainda" + o corpo e o
   botão "Voltar para a calculadora".
8. **Offline**: hoje, com termo digitado, cai na parede vermelha "Não foi possível carregar suas
   simulações." + "Tentar novamente" — sem dizer que a causa é conexão e sem oferecer a lista guardada.
   Sem termo, aparece o alerta informativo "Modo leitura offline" / "Suas simulações continuam aqui e
   podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." Desenhe o estado
   honesto da BUSCA offline (a copy depende da decisão do dono, abaixo).
9. **Erro de carga**: alerta de perigo "Não foi possível carregar suas simulações." + "Tentar novamente".
10. **Premium pausado**: alerta informativo "Premium pausado" / "Suas simulações continuam aqui e podem
    ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." A busca
    e o abrir continuam funcionando; os três botões do card ficam desabilitados com a legenda "Premium
    pausado — reative para renomear, duplicar, editar ou excluir." (offline a legenda é "Esta ação
    precisa de conexão.").
11. **Sem permissão / grátis**: o campo NÃO existe — o painel inteiro vira o teaser de Premium. Não
    desenhe uma busca desabilitada aqui; a porta é binária.

## Viewports
- **Mobile 390px** — é onde o vendedor mais usa; o painel ocupa 92vw (≈359px) e o campo divide a linha
  com um eventual contador.
- **Desktop 1280px** — a mesma folha, ancorada na borda e limitada a 26rem (≈416px). O redesenho
  desktop de 018 não cobre a aba Calcular, então este painel é hoje idêntico nos dois tamanhos:
  desenhe os dois e diga explicitamente se o contador cabe na mesma linha do campo em 359px ou desce.

## Regras que o desenho não pode quebrar
- **A frase honesta nunca mora num placeholder.** O rótulo do campo precisa existir como texto, não
  como texto que evapora ao primeiro caractere.
- **Falha de rede nunca é vendida como "você não tem nada"** nem como "não é premium": um vazio de
  busca offline tem de dizer que a causa é conexão.
- **O vazio de busca não pode parecer o vazio de "você nunca salvou nada"** — o vendedor tem dados; dizer
  o contrário é mentir sobre os dados dele (regra já escrita no Catálogo, palavra por palavra).
- **Alvo ≥44px** para o "x" de limpar e para os três botões de ação do card, inclusive dentro de um
  campo de altura padrão.
- **Contraste medido contra o fundo real do campo** (superfície de card dentro de painel sobre overlay),
  não contra o fundo da página.
- Freemium binário: sem Premium, teaser inteiro — nunca uma busca "quase funcionando".

## Armadilhas já pagas neste projeto
- **O campo 1×1px**: esconder o rótulo escondeu o controle inteiro, e nenhum teste viu. Se o rótulo for
  visualmente oculto, mostre na prancheta que o campo permanece com altura e largura de verdade.
- **Ocluso passa no teste**: elemento coberto ou estourado continua "visível" para asserção de texto.
  Meça as caixas, e meça **os dois eixos** — o eixo vertical já escondeu um scroll neste produto.
- **Tamanho adversarial**: o eco “{termo}” no título do vazio, um nome de 120 caracteres e uma nota
  colada sem espaços (500 caracteres de um token só) têm de truncar com reticências VISÍVEIS dentro de
  416px, sem empurrar o painel para o lado.
- **Placeholder que corta a frase**: números cabem em placeholder; explicação, não.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**, nos dois viewports:
1. Campo em repouso · foco · preenchido com "x" de limpar · buscando (com o campo ainda na tela).
2. Painel com resultados: campo + contador + 3 cards (um com nota longa truncada).
3. Vazio de busca com termo curto e vazio de busca com termo longo (o teste de estouro).
4. Vazio geral, lado a lado com o vazio de busca, para provar que são distinguíveis.
5. Offline com termo digitado · premium pausado (cards com ações desabilitadas e a legenda).

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap` + `tf-input` para o campo (com o
mesmo SVG de lupa dos artboards de Catálogo e Orçamentos, 18px, cor de texto suave); `tf-btn--ghost`
`tf-btn--sm` para o "x" de limpar e para lápis/cópia/lixeira; `tf-empty` (com `tf-empty__icon`) para os
dois vazios; `tf-btn--secondary` para "Limpar busca", "Tentar novamente" e "Carregar mais";
`tf-alert--info` e `tf-alert--danger` para offline/pausado/erro; `tf-card` `padding="sm"` para cada
resultado; o spinner do DS para o carregamento. A contagem é legenda em texto suave, não `tf-badge`,
a menos que você mostre por que o badge lê melhor.

## Perguntas em aberto para o dono
1. **Busca offline**: hoje ela só existe no servidor, e sem conexão vira parede de erro. Deve buscar no
   que já está guardado no aparelho (e então a lista filtrada offline é confiável), ou dizer "a busca
   precisa de conexão" e devolver a lista completa guardada?
2. **Contador**: mostrar sempre (como no Catálogo) ou só durante a busca? E qual a frase, já que o total
   não é conhecido — "3 encontradas" pode virar mentira quando "Carregar mais" trouxer mais.
3. **Copy do vazio de busca**: manter o eco do termo ("Nenhuma simulação encontrada para “X”.") ou
   unificar com a frase já homologada do Catálogo ("Nada encontrado para essa busca" + "Tente outro
   termo, ou limpe a busca para ver tudo de novo.")?
4. **Mínimo de caracteres** antes de disparar a busca no servidor (hoje 1 caractere já dispara), e a
   busca deve casar também a **nota**, ou só o nome?
