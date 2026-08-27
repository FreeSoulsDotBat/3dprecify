# Busca sem resultado na aba Orçamentos

## O que desenhar
O estado que a lista de **Orçamentos** (os registros congelados de preço) mostra quando o vendedor busca por um rótulo — "Cliente, pedido…" — ou aperta um filtro de período e **a lista volta vazia**. Quem usa é um vendedor que tem histórico, está procurando um orçamento específico para reenviar a um cliente, e precisa entender em dois segundos que *a busca* não achou — e não que *o histórico dele sumiu*. A peça vive dentro da lista, logo abaixo da barra de filtros (que continua visível, com o termo ainda digitado no campo), tanto no mobile quanto na coluna esquerda do mestre-detalhe do desktop.

## Por que este prompt existe
Nenhum protótipo desenhou busca em Orçamentos, então o vazio-de-busca também nunca foi desenhado. O que foi desenhado e homologado é o **vazio frio** ("Seus cálculos salvos aparecem aqui" + CTA, item 18 dos fixes do protótipo). O vazio de busca foi decidido **em cima dele, em código**: mesmo componente, mesmo ícone `history`, a frase inteira empurrada para o título e sem corpo. E o próprio código registra que essa confusão já custou um bug: ler o campo cru em vez do valor com debounce "flashava a tela fria de você-não-tem-histórico durante os 250 ms". O desenho tem que resolver o que o debounce só remendou — as duas telas continuam com a mesma arte.

## O que já existe hoje (não invente do zero — corrija)

A barra de filtros, que permanece visível durante o vazio:

| Elemento | Texto literal hoje | Observação |
| --- | --- | --- |
| Campo de busca | rótulo "Buscar por rótulo", placeholder "Cliente, pedido…" | `type=search`, limite de 120 caracteres, debounce de 250 ms |
| Chips de período | "Tudo" · "30 dias" · "90 dias" · "Período…" | o ativo vira botão primário; quebram em várias linhas em 390px |
| Chip do período custom | "Período: {de} – {ate}" + "Limpar filtro" | aparece só quando há intervalo escolhido |

O estado vazio de busca, hoje:

- Ícone `history` (**o mesmo do vazio frio** → problema central: o vendedor vê a mesma arte para "você não tem nada" e "sua busca não achou").
- Título: **"Nenhum registro encontrado para “{termo}”."** — frase inteira, com ponto final, no lugar do título → problema: título comprido, sem corpo, e o Catálogo do mesmo app faz o oposto ("Nada encontrado para essa busca" + "Tente outro termo, ou limpe a busca para ver tudo de novo.").
- Botão secundário **"Limpar busca"**, colocado **fora** do bloco vazio (no Catálogo ele fica dentro, como ação do próprio estado) → problema: duas telas irmãs com anatomias diferentes.
- Não mostra **quais filtros estão em vigor** — se a busca está vazia e só o período filtra, o `{termo}` vira o rótulo do período.

Comparação obrigatória — o vazio frio, que **não é** esta peça: ícone `history`, título "Nenhum registro ainda", corpo "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data.", botão "Ir para a calculadora".

→ **Defeito real a corrigir no desenho do desktop:** no mestre-detalhe (≥1280px), quando a busca não acha nada a coluna esquerda mostra o vazio de busca **e a coluna direita mostra o vazio FRIO** ("Nenhum registro ainda" + "Calcule uma peça…"). Metade da tela afirma exatamente a mentira que o debounce existiu para evitar.

## Conteúdo e dados reais
- `{termo}` é o texto **efetivamente buscado** (o valor com debounce), entre aspas curvas: `Nenhum registro encontrado para “Loja do Marcos”.` Pode ter até 120 caracteres — desenhe com um termo longo de verdade, colado sem espaços, além do exemplo curto.
- Quando a busca está vazia e o filtro é só de período, `{termo}` vira o rótulo do período: `“30 dias”`, `“90 dias”` ou o intervalo custom. → **O intervalo custom sai hoje no formato do campo de data (“2026-07-01 – 2026-07-31”), não em pt-BR** — a ficha da auditoria supôs "01/07/2026 – 31/07/2026", que é o que deveria aparecer.
- Quando os dois filtros estão ativos (termo + período), a frase nomeia **só o termo** — o período em vigor fica invisível para quem lê o vazio.
- Os registros que a busca não achou são orçamentos congelados: cada card traz a data acima do dinheiro ("Cotado em 14/07/2026"), o rótulo do vendedor, "Valor cotado" **R$ 1.234,56** e a legenda da base ("preço de varejo" / "preço de atacado"). Nada disso aparece no vazio — mas é o vocabulário do entorno.
- Registros ainda **não sincronizados nunca são filtrados**: eles continuam na lista mesmo sob busca. Ou seja, "vazio de busca" só existe quando não há nem fila pendente casando.

## Estados obrigatórios
1. **Repouso (busca por termo)** — a frase com o termo, a ação de limpar, a barra de filtros acima ainda mostrando o que foi digitado.
2. **Repouso (só período)** — mesma peça nomeando o período; o chip do período segue ativo/primário acima.
3. **Termo + período juntos** — o desenho precisa dizer os dois filtros em vigor, não só um.
4. **Termo longo (120 caracteres)** — o pior caso do título, sem estourar a coluna de 520px do desktop nem os 390px do mobile.
5. **Carregando (250 ms de debounce e a leitura seguinte)** — hoje entra um spinner centralizado e o vazio some; desenhe o que o vendedor vê entre a tecla e a resposta, sem piscar o vazio frio.
6. **Foco / hover / pressionado / desabilitado do botão "Limpar busca"** — alvo ≥ 44px, foco visível contra o fundo real do bloco.
7. **Vazio frio (contraste explícito)** — desenhe-o lado a lado com o de busca **na mesma prancheta**, para provar que os dois não se confundem: se só a frase muda, o desenho falhou.
8. **Offline com filtro ativo** — hoje a busca é uma leitura no servidor e o cache do aparelho é só o histórico **sem filtro**; offline, a lista filtrada não cai no cache e a tela mostra o muro vermelho "Não foi possível carregar seus orçamentos." + "Tentar novamente". → Desenhe o estado honesto que falta: *buscar precisa de conexão; seus registros continuam aqui sem filtro*.
9. **Premium pausado** — o banner informativo "Premium pausado — seus registros continuam aqui e podem ser abertos..." fica acima; o vazio de busca não muda de tom por causa disso.
10. **Coluna direita do desktop sem registro escolhido** — o que ela mostra quando a busca não achou nada (ver defeito acima).

## Viewports
- **Mobile 390px** — é onde a peça nasceu: filtros empilhados, chips quebrando em duas linhas, o vazio ocupando a largura toda.
- **Desktop 1280px** — o mestre-detalhe: lista de largura fixa **520px** à esquerda, registro à direita. É o corte em que o vazio de busca e o vazio frio aparecem **ao mesmo tempo** na tela, cada um numa coluna. Desenhar este é obrigatório.
- **Desktop 1920px** — só se a proporção mudar algo; a coluna da lista continua 520px, então o que cresce é o registro.

## Regras que o desenho não pode quebrar
- **Uma busca que não acha nunca pode parecer perda de dados.** Arte, ícone e tom precisam separar "não achei com esse filtro" de "você não tem nada".
- **Falha de rede não é resultado vazio.** Offline/erro nunca podem ser desenhados como "nenhum registro encontrado".
- **A frase honesta mora em elemento de largura cheia**, nunca em placeholder e nunca truncada — placeholder carrega número, não explicação.
- **O caminho de volta é sempre alcançável**: limpar a busca (e o período) sem ter que adivinhar; alvo ≥ 44px.
- **Nada de inventar registro para preencher** a coluna direita do desktop.
- Contraste medido contra o fundo real do card/coluna, em tema escuro **e** claro.

## Armadilhas já pagas neste projeto
- **Texto ocluso ou estourado passa em teste**: `toContainText` aprova um título que vazou da coluna. O termo de 120 caracteres é o caso adversarial obrigatório — meça a caixa, não a string.
- **Overflow horizontal medido nos dois eixos** (o headless não enxerga barra clássica; o item 9 do 016 morreu no eixo vertical).
- **Divergência entre telas irmãs**: Catálogo e Orçamentos resolvem o mesmo problema de duas formas; escolha uma anatomia e diga qual, sem inventar copy nova para o Catálogo aqui.
- **Piscar o estado errado durante o debounce** foi bug real; o desenho da transição é parte da entrega.

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (first-class)**:
1. Mobile 390px — vazio de busca por termo, com a barra de filtros acima.
2. Mobile 390px — vazio por período e vazio com termo+período (pode ser uma prancheta com dois blocos).
3. Mobile 390px — comparação vazio de busca × vazio frio, lado a lado.
4. Mobile 390px — offline/erro com filtro ativo (o estado honesto proposto).
5. Desktop 1280px — mestre-detalhe inteiro com a busca sem resultado: coluna esquerda **e** o que a direita passa a dizer.
6. Estados do botão "Limpar busca": repouso, hover, foco, pressionado.

Reutilize os primitivos existentes, sem criar novos: o bloco vazio é o `EmptyState` (ícone + título + descrição + ação — use a **descrição** e o slot de **ação**, hoje ignorados nesta tela); o botão de limpar é `Button variant="secondary"`; os chips de período são `Button size="sm"` primário/secundário; o campo é `tf-input` dentro de `Field`; o aviso de offline/pausado é `Alert` (tom `info` para offline, `danger` só para falha real); o carregando é `Spinner`. Se o ícone `history` precisar de um irmão para "busca sem resultado", proponha-o como variante do conjunto de ícones da DS, não como ilustração avulsa.

## Perguntas em aberto para o dono
1. O vazio de busca deve **listar os filtros em vigor** (termo + período) ou só nomear o termo? Hoje só o termo aparece, e um período ativo fica invisível.
2. O estado deve oferecer **limpar só a busca** e **limpar tudo** como duas ações, ou um único "Limpar busca" que já zera o período (o que ele faz hoje, apesar do rótulo dizer só "busca")?
3. Offline com filtro ativo: mostrar a lista **sem filtro** com um aviso ("buscar precisa de conexão"), ou não mostrar lista nenhuma e só o aviso?
4. Orçamentos e Catálogo devem convergir para a **mesma frase** de busca vazia ("Nada encontrado para essa busca" + corpo), ou o Orçamentos mantém a frase com o termo citado?
