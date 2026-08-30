# Diálogo de descarte ao fechar uma simulação com alterações não salvas

## O que desenhar
A caixa modal que aparece quando o vendedor toca em **"Fechar simulação"** na barra de contexto da calculadora (aba **Calcular**) **e existem alterações pendentes** — ou seja, ele mexeu em canais, taxas, custos ou base desde que reabriu a simulação salva e ainda não gravou. Se não há alteração pendente, o diálogo não aparece: fecha direto. É a única barreira do produto inteiro entre o trabalho do vendedor e o desaparecimento dele, e dura dois toques: [Voltar] volta para a calculadora com tudo intacto; [Descartar] fecha a simulação e joga fora as edições. Não há rede envolvida, não há espera: a decisão é local e instantânea.

## Por que este prompt existe
Nunca houve desenho de nenhuma confirmação destrutiva neste projeto. O protótipo de 2026-07-02 cobre banner offline, erro global e 404 (E9 Transversais), e a rodada 1 acrescentou a tela genérica de erro 500 — nenhuma confirmação; a matriz §G não tem essa linha; o `.design-import/` exporta só `PriceHero.jsx` e `IconButton.jsx`. O canvas 018 desenha botões "Excluir" em duas fichas mas **nenhum artboard do diálogo que eles abrem**. A única autoridade é textual (ux §4.1 define a frase e o par [Voltar][Descartar]; §10.2/G3 manda "compor com Dialog + Button danger sem inventar primitiva" — instrução de composição, não desenho). O que a IA inferiu sozinha: a **ausência de corpo** (não há `DialogDescription`, então a caixa não diz o que se perde), a ausência de uma terceira saída, o alinhamento à direita, a ordem dos botões e o tamanho. E há uma incoerência interna que ninguém decidiu: **o diálogo de EXCLUIR, no mesmo épico, TEM corpo** ("Esta ação não pode ser desfeita.") — duas confirmações destrutivas com anatomias diferentes, e a mais explicativa é a do risco menor.

## O que já existe hoje (não invente do zero — corrija)
Um `Dialog variant="center"` com scrim sobre a tela inteira, cartão centralizado de `min(92vw, 32rem)`, padding de 24px, raio `xl`, borda sutil e sombra grande. Dentro, uma coluna com `gap` de 12px e **dois** elementos:

| Ordem | Elemento | Conteúdo literal | Observação |
| --- | --- | --- | --- |
| 1 | `DialogTitle` | `"Descartar as alterações não salvas desta simulação?"` | → o estilo de título do DS é **caixa alta + fonte de título + `letter-spacing` largo, 18px**: a pergunta renderiza como `DESCARTAR AS ALTERAÇÕES NÃO SALVAS DESTA SIMULAÇÃO?` — 51 caracteres gritados, que a 390px ocupam 3 linhas. Uma pergunta em versalete não se lê como pergunta. |
| 2 | Linha de botões | `[Voltar]` fantasma · `[Descartar]` perigo, justificados **à direita**, `gap` de 8px | → tamanho padrão (o resto da barra de contexto usa `sm`); nenhum estado de carregamento existe nem faz sentido aqui |
| — | **Corpo** | **não existe** | → o buraco central deste prompt: a caixa não diz **o que** se perde nem **o que sobrevive** |
| — | `X` de fechar | `aria-label` "Fechar", canto superior direito, alvo ≥44×44px, ativo por padrão no primitivo | → uma **terceira** afordância que ninguém desenhou e que faz exatamente o mesmo que [Voltar]; o título já reserva 40px de recuo à direita por causa dela |

Comportamento herdado do primitivo: `Esc` e clique no scrim fecham o diálogo = mesmo efeito de [Voltar] (nunca descartam), foco preso dentro da caixa, foco devolvido ao botão "Fechar simulação" ao sair.

Para comparação direta, o **diálogo de excluir** da folha "Minhas simulações": título `"Excluir a simulação “{nome}”?"` + corpo `"Esta ação não pode ser desfeita."` + `[Voltar]` `[Excluir]` — mesmíssima geometria, mesma cor de botão, e é o único dos dois que explica.

## Conteúdo e dados reais
- **Gatilho**: botão fantasma `"Fechar simulação"` na barra de contexto; o diálogo só existe quando o selo `"Alterações não salvas"` está aceso naquela barra.
- **Rótulos fixos**: `"Voltar"` — nunca "Cancelar" (FR-014, regra escrita do produto) — e `"Descartar"`.
- **O que realmente se perde** (verificado no código, e é isto que precisa virar corpo): apenas as edições feitas desde que a simulação foi aberta. **A simulação salva continua existindo, com o conteúdo da última gravação.** Nada é excluído, nada é irreversível no sentido do outro diálogo. Não escreva o texto final por conta própria — a frase exata é pergunta para o dono; desenhe o bloco com um texto de trabalho e marque-o como provisório.
- **Nome da simulação**: 1 a 120 caracteres. Hoje o diálogo **não** o cita; o de excluir cita. Use nas pranchetas `"Vaso hexagonal — Shopee"` e `"Suporte de headset com pé reforçado — comparação Shopee x Mercado Livre x loja própria (agosto)"` se decidir mostrar o nome — o segundo prova que a linha aguenta 96 caracteres.
- **Nenhuma data, em lugar nenhum**: a promessa da simulação é "Recalculado com os preços de hoje"; a caixa não pode dizer "salvo em 12/08".
- Nenhum valor em dinheiro aparece aqui. Não invente um resumo de preço no corpo.

## Estados obrigatórios
1. **Repouso** — a caixa aberta sobre a calculadora escurecida pelo scrim; a simulação por trás continua visível o suficiente para o vendedor lembrar o que estava fazendo.
2. **Foco em [Voltar]** e **foco em [Descartar]** — anel de foco medido contra a superfície do cartão, não contra o fundo da página. Diga qual dos dois recebe o foco inicial: é a decisão de segurança mais barata desta peça.
3. **Hover e pressionado** nos dois botões e no `X`.
4. **Escritas travadas — o estado que hoje é invisível e importa mais que todos**: quando o vendedor está **offline** (`"Esta ação precisa de conexão."`) ou com **Premium pausado** (`"Premium pausado — reative para renomear, duplicar, editar ou excluir."`), o botão "Salvar alterações" da barra está **desabilitado**. Nessa situação o descarte é a única saída possível e o trabalho vai embora sem recurso — e a caixa atual não diz uma palavra sobre isso. Desenhe a variante que reconhece a trava, com o motivo em texto de corpo (nunca em `placeholder`, nunca só cor).
5. **Sem alterações pendentes** — desenhe o "não-estado" só para deixar registrado: a caixa **não abre**, o fechamento é imediato e silencioso.
6. **Título longo em 390px** — a pergunta em três linhas com o recuo do `X` respeitado, para provar que o cabeçalho não colide com o botão de fechar.

Sem estados de carregamento, vazio, erro ou degradado: esta peça não fala com a rede.

## Viewports
- **390px (mobile)** — obrigatória e é a mais crítica: o cartão vira 92vw ≈ 358px, sobram ~310px de conteúdo, e é onde a pergunta em caixa alta explode em três linhas e a dupla de botões justificada à direita fica espremida. Mostre a alternativa de botões em largura total empilhados, se ela ler melhor, e diga qual você recomenda.
- **1280px (desktop)** — o cartão fixa em 512px centrado; o problema muda de figura: uma caixa de 512px com duas linhas de texto e dois botões no canto tem um vazio no meio que precisa de ritmo.
- 1920px não precisa de prancheta própria (o cartão não cresce); se o scrim mudar de leitura numa tela larga, diga isso em uma linha.

## Regras que o desenho não pode quebrar
- **A ação destrutiva nunca é a mais fácil de acertar sem querer.** [Descartar] é o único elemento em tom de perigo da caixa; [Voltar] é a saída barata e não pode parecer desabilitado por ser fantasma.
- **Nada de "Cancelar"**: o rótulo homologado é "Voltar".
- **Honestidade de escopo**: o corpo não pode sugerir que a simulação salva será apagada — não será. E, se a variante travada existir, não pode vender falha de rede como limitação de Premium nem o contrário.
- **Distinguir os dois destrutivos**: descartar edições e excluir a simulação não podem ser a mesma caixa vermelha. A diferença de gravidade tem de estar no desenho, não só no verbo.
- Alvo de toque ≥44px nos dois botões e no `X`; contraste medido contra `--surface-card` **por cima do scrim**, não contra o fundo da página.
- Frase honesta sempre em elemento de largura plena — nunca em sufixo de campo ou `placeholder` (lição já paga em 016).

## Armadilhas já pagas neste projeto
- **Texto que estoura sem quebrar teste**: `toBeVisible`/`toContainText` passam num título ocluído. A pergunta em caixa alta com `letter-spacing` largo é exatamente o tipo de string que transborda a 390px sem nenhuma asserção reclamar — desenhe medindo caixas.
- **Recuo reservado ao `X`**: o título já carrega 40px de `padding-right`; um desenho que ignore isso produz colisão só na implementação.
- **Botão nascido fora da viewport** (custou 100,5px de overflow no épico de billing): a fileira justificada à direita dentro de um cartão de 92vw é a mesma geometria que falhou lá.
- **Selo/afirmação que ninguém vê** (o toast que nunca renderizou, também no billing): se o desenho prometer um retorno visual após [Descartar], ele tem de sobreviver ao desmonte da tela — prefira não prometer.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não uma amostra)**:
1. Repouso a 390px — versão atual (só pergunta + botões) e **versão corrigida com corpo**, lado a lado, para o dono comparar.
2. Repouso a 1280px, versão corrigida.
3. Variante **escritas travadas** (offline e Premium pausado), 390px.
4. Estados de interação: foco inicial, hover e pressionado em [Voltar] e [Descartar].
5. Uma prancheta de **coerência**: este diálogo ao lado do de excluir simulação, mostrando qual anatomia comum os dois passam a ter e onde a gravidade os separa.

Reaproveite os primitivos existentes, sem criar nenhum: `tf-dialog` centrado (scrim `tf-dialog__overlay`, `tf-dialog__x` para o fechar), `tf-dialog__title` para a pergunta, `tf-dialog__desc` para o corpo novo, `tf-btn--ghost` em "Voltar", `tf-btn--danger` em "Descartar" e, se a variante travada precisar de destaque, o `tf-alert` de tom informativo — nunca um bloco novo.

## Perguntas em aberto para o dono
1. **Qual é a frase do corpo?** A verdade técnica é "só as edições desta sessão se perdem; a simulação salva continua como estava" — mas a redação final é copy de produto e precisa ser sua, não minha.
2. **Existe uma terceira saída "Salvar e fechar"?** A copy `"Salvar como novo"` está escrita no dicionário e **nunca foi renderizada em lugar nenhum** — funcionalidade planejada e esquecida, ou copy morta? E, se existir, o que ela faz quando o vendedor está offline ou com Premium pausado, casos em que salvar é impossível?
3. **O diálogo deve nomear a simulação** (`"Descartar as alterações de “{nome}”?"`), como o de excluir faz, ou o nome é ruído aqui?
4. **O `X` de fechar fica?** Hoje ele existe e duplica o [Voltar]; a alternativa é uma caixa sem escape visual, só [Voltar]/[Descartar] + `Esc`.
5. **As duas confirmações destrutivas convergem para uma anatomia única** (título + corpo + [Voltar][ação]) ou a exclusão ganha um degrau a mais de atrito, por destruir o objeto?
