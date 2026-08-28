# Barra de contexto da simulação carregada ("Simulação: {nome}")

## O que desenhar
A faixa que aparece no topo da calculadora (aba **Calcular**) quando o vendedor abre uma simulação salva — o único sinal na tela inteira de que os campos abaixo não são um cálculo avulso, e sim uma estratégia salva sendo reeditada. Ela vive entre o cabeçalho da página ("Calcular" + a frase de freemium + o botão fantasma "Minhas simulações") e os campos de custo que ela governa. Quem a usa: o vendedor premium que reabriu uma simulação pela folha "Minhas simulações" e agora mexe em preços, canais e taxas — e precisa saber, a qualquer momento, **qual** simulação está aberta, **se** o que ele mexeu já foi salvo, e como salvar, duplicar, renomear, abrir a origem ou fechar. É a peça que carrega toda a gestão do objeto aberto.

## Por que este prompt existe
Nunca houve desenho desta peça. O protótipo de 2026-07-02 **não tem o conceito de simulação**: a tela `CalculatorScreen.jsx` é `TopBar` → dois `PriceHero` (varejo/atacado) → alerta de peso → card de entradas, e nada acima dos inputs. O canvas 018 exclui Calcular por escrito. A barra foi inferida de texto de spec por uma IA, e o resultado **contraria a spec em dois pontos verificados**: (1) a spec pede a barra "pinned at the top" e o que existe é um `Card` no fluxo, que rola para fora da tela junto com o resto; (2) a spec previa um menu "⋯" e a implementação achatou tudo em **cinco affordances soltas** na mesma faixa, com pesos visuais diferentes e ordem nunca decidida. Além disso, a linha "Base de custo: {…}" que o wireframe da spec traz **não existe** na barra construída — o `costBasis` só serve, hoje, para decidir o alerta de degradação e para habilitar "Abrir origem". A `ux §10.1` classifica esta barra como o item #1 "Highest" a prototipar; nunca foi.

## O que já existe hoje (não invente do zero — corrija)
Um `Card` de padding pequeno, coluna, `gap` de 8px, em quatro blocos empilhados:

| Bloco | Conteúdo atual | Observação |
| --- | --- | --- |
| Linha 1 (esq.) | `"Simulação: {nome}"` em 14px semibold, **uma linha só**, truncada com reticências | O truncamento é deliberado (defeito já pago: um nome de 120 caracteres empurrava "Duplicar"/"Salvar alterações" para fora da tela) |
| Linha 1 (dir.) | Botão fantasma **"Fechar simulação"** | → é a ação de saída, mas está no lugar de maior destaque da faixa, colada no nome |
| Linha 2 | `"Recalculado com os preços de hoje"` em 12px muted; quando há edição pendente, acrescenta `" · "` + `Badge` neutra **"Alterações não salvas"** | → o badge é injetado **dentro do parágrafo**, separado por um ponto médio: um selo de estado disfarçado de continuação de frase |
| Alertas condicionais | `Alert` info com `"Os valores atuais foram mantidos e continuam editáveis."` (base degradada) e/ou `Alert` perigo com o erro da última ação | |
| Linha de ações | `flex flex-wrap gap-2`, nesta ordem: **"Abrir origem"** (fantasma, condicional) · **"Renomear"** (fantasma) · **"Duplicar"** (secundário) · **"Salvar alterações"** (primário); e, quando as escritas estão travadas, uma linha de 12px muted ocupando a largura toda com o motivo | → quatro pesos diferentes numa fileira que **quebra em duas linhas a 390px**; a ordem coloca a ação primária na ponta direita, onde o wrap a joga sozinha para a segunda linha |

Vizinhos imediatos, fora do card (não redesenhar, mas prever no layout): logo abaixo pode aparecer um `Alert` info persistente `"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."`, e, quando a base é um **kit**, o bloco somente-leitura `"Kit: {nome}"` + `"Preços por canal do kit, recalculados com os preços de hoje."`.

## Conteúdo e dados reais
- **Nome da simulação** — obrigatório, texto livre, 1 a 120 caracteres. Exemplos verdadeiros para as pranchetas: `"Vaso hexagonal — Shopee"` (curto), `"Suporte de headset com pé reforçado — comparação Shopee x Mercado Livre x loja própria (agosto)"` (longo, para provar o truncamento).
- **Nota** — opcional, até 500 caracteres. Existe no objeto salvo e **não é mostrada** na barra hoje.
- **Base de custo** — três tipos, com os rótulos em pt-BR que já existem na folha de salvar: `"avulsa"`, `"referência do catálogo"`, `"kit do catálogo"`; a frase-molde é `"Base de custo: {nome}"`. Só é exibida ao salvar; a barra a esconde.
- **Derivado, nunca digitado**: o subtítulo `"Recalculado com os preços de hoje"` — regra dura: **nenhuma data em lugar nenhum** desta barra. Não existe "salvo em 12/08"; a promessa é o recálculo vivo.
- **Estado de edição pendente** — booleano derivado de comparar o formulário com a assinatura da última gravação. Governa o badge e o botão "Salvar alterações".
- **Renomear** abre uma folha com título `"Renomear simulação"`, campo `"Nome"` (obrigatório) e botão `"Salvar alterações"`; o campo aceita digitar até 121 caracteres para que o 121º dispare a recusa.
- Toasts de sucesso (só em resposta real do servidor): `"Simulação atualizada."`, `"Simulação duplicada."`, `"Simulação renomeada."`.
- Copy órfã encontrada no dicionário e **nunca renderizada**: `"Salvar como novo"` — ver Perguntas em aberto.

## Estados obrigatórios
1. **Repouso, sem alterações** — nome + subtítulo vivo; "Salvar alterações" **desabilitado**; sem badge.
2. **Com alterações pendentes** — badge `"Alterações não salvas"` visível; "Salvar alterações" habilitado e é o único elemento primário da faixa.
3. **Salvando** / **Duplicando** — o botão correspondente em carregamento (rótulo permanece legível, largura não pode saltar); os demais permanecem operáveis.
4. **Base degradada** (a referência de produto/kit não resolve mais) — `Alert` info `"Os valores atuais foram mantidos e continuam editáveis."` e o botão **"Abrir origem" some**. Nunca a palavra "removido", "excluído" ou "deletado".
5. **Base avulsa** — sem "Abrir origem": desenhe a fileira com três botões, não com um buraco.
6. **Erro de ação** — `Alert` perigo dentro do card, com a mensagem do servidor ou `"Algo deu errado. Tente novamente."`.
7. **Offline** — "Renomear", "Duplicar" e "Salvar alterações" desabilitados + a linha `"Esta ação precisa de conexão."`. "Abrir origem" e "Fechar simulação" continuam ativos.
8. **Premium pausado** — os mesmos três desabilitados + `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` A simulação **continua aberta e recalculando**: nada aqui pode sugerir que o cálculo parou.
9. **Fechar com alterações pendentes** — diálogo centrado: título `"Descartar as alterações não salvas desta simulação?"`, botão fantasma `"Voltar"` (nunca "Cancelar") e botão de perigo `"Descartar"`.
10. **Foco visível, hover e pressionado** em cada um dos cinco alvos — inclusive nos fantasmas, que hoje são os menos evidentes da faixa.
11. **Nome longo** — truncado em uma linha; o nome completo precisa continuar acessível de alguma forma (proponha).

## Viewports
- **390px (obrigatório)** — é onde o defeito dói: a fileira quebra em duas linhas, e o motivo do travamento ocupa uma terceira. Desenhe a barra com nome longo + badge + quatro ações + linha de motivo, e mostre a altura total resultante.
- **1280px (obrigatório)** — a página da calculadora sai de 460px e vai a 1120px a partir de 1024px. A barra vira uma faixa larga com quatro botões pequenos amontoados à esquerda e "Fechar simulação" isolado na outra ponta, com ~800px de vazio no meio. Resolva essa faixa, não a copie.
- **1920px** — o conteúdo continua limitado a 1120px centralizado; só desenhe se a solução de 1280px mudar de comportamento.

## Regras que o desenho não pode quebrar
- **Nenhuma data.** O subtítulo afirma o recálculo vivo; qualquer carimbo temporal aqui é uma alegação que o produto não pode sustentar.
- **Degradação dita, não escondida.** A base que não resolve mais gera a frase calma e a remoção do link — nunca um link quebrado, nunca "removido".
- **Falha de rede nunca vendida como falta de premium**, e vice-versa: as duas frases travadas são diferentes de propósito e não podem colapsar numa só.
- **Frase honesta fora de placeholder** — o motivo do travamento e o alerta de degradação vivem em elemento próprio de largura total, nunca dentro de um campo ou como sufixo cortável.
- **Premium pausado não pausa o cálculo**: o badge/estado da barra não pode ser degradado visualmente a ponto de sugerir que o preço abaixo é falso.
- **Toque ≥44px** em todos os cinco alvos, inclusive nos fantasmas de 390px depois do wrap.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — o card é uma superfície elevada.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não estimado**: já houve 100,5px de estouro com botão nascendo fora da viewport nesta base de código. A faixa de ações a 390px é exatamente essa geometria.
- **Nome longo empurrando ações para fora da tela** — o motivo do truncamento de uma linha. Qualquer proposta que devolva o nome a duas linhas precisa dizer o que impede a reincidência.
- **Selo enfiado em parágrafo**: o badge separado por `" · "` sobrevive a qualquer teste de texto e é ilegível como estado. Trate-o como estado.
- **Barra que rola para fora** — o único indicador de "você está editando um objeto salvo" desaparece assim que o vendedor rola até os campos que está editando; ele salva ou não salva às cegas.
- **Ação destrutiva/de saída no ponto de maior peso**: "Fechar simulação" ocupa hoje o canto superior direito, o mesmo lugar que, na ficha de Orçamentos do canvas, é reservado à edição de rótulo — lá a ação destrutiva é deslocada de propósito.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. **390px — repouso limpo** e **390px — com alterações pendentes** (nome longo truncado, badge, fileira completa).
2. **390px — travado**, uma prancheta cobrindo offline e outra premium pausado, com a frase correspondente.
3. **390px — base degradada** (alerta info, sem "Abrir origem") e **390px — erro de ação** (alerta perigo).
4. **1280px — repouso e com alterações pendentes**, resolvendo a faixa larga.
5. **Diálogo de descarte** (390px e 1280px) e **folha "Renomear simulação"** (390px).
6. Uma prancheta de **anatomia**: hierarquia proposta das cinco affordances (quais ficam expostas, quais colapsam), com a justificativa em uma linha ao lado de cada.

Reutilize os primitivos existentes, sem criar novos: `Card` com padding pequeno como casca; `Badge` neutro para "Alterações não salvas"; `Button` nas variantes fantasma/secundário/primário/perigo já existentes, tamanho pequeno; `Alert` tom info para degradação e tom perigo para erro; `Dialog` centrado para o descarte; `Sheet` para renomear, com `Field` + `tf-input`. Se a solução exigir um menu de ações secundárias, use o padrão de menu já presente no DS em vez de inventar um novo controle.

## Perguntas em aberto para o dono
1. **A barra deve ficar fixa no topo enquanto o vendedor rola os campos** (como a spec pediu) ou continuar rolando junto? Fixa custa altura permanente no celular; rolando, o vendedor edita sem ver qual simulação está aberta.
2. **A linha "Base de custo: {nome}" entra na barra?** Ela existe na folha de salvar e sumiu aqui; se entrar, mostra o nome da referência, o tipo (`"avulsa"` / `"referência do catálogo"` / `"kit do catálogo"`), ou os dois?
3. **Quais das cinco ações continuam expostas e quais colapsam num menu?** A decisão muda a peça inteira e ninguém a tomou — a implementação achatou o "⋯" por conta própria.
4. **Ao fechar com alterações pendentes, existe uma terceira saída "Salvar e fechar"?** Hoje só há "Voltar" e "Descartar".
5. **"Salvar como novo" deve existir nesta barra?** A copy está escrita e nunca foi renderizada em lugar nenhum — é funcionalidade planejada e esquecida, ou copy morta a remover?
6. **A nota (até 500 caracteres) aparece na barra?** Ela é salva e nunca mostrada depois; quem escreve uma nota provavelmente espera relê-la ao reabrir.
