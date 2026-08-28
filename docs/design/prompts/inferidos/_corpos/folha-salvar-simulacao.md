# Folha "Salvar simulação" — nome, nota e o eco da base de custo

## O que desenhar
A folha (painel deslizante) que aparece quando um vendedor **premium** termina de comparar canais na calculadora e toca em "Salvar simulação". Ela captura duas coisas — um **nome** e uma **nota opcional** — e é o único momento em que o produto pergunta "como você quer chamar essa estratégia?". Ela vive em dois lugares: na aba **Calcular** (base de custo avulsa, logo abaixo do bloco "Preços por canal") e dentro do **produto do Catálogo** (base de custo = a referência do catálogo). O que é salvo não é um preço congelado: é a *estratégia* (canais, taxas ajustadas, base de custo), que recalcula com os preços de hoje toda vez que for reaberta — e essa distinção entre Simulações e Orçamentos é justamente o que o vendedor precisa entender **antes** de nomear.

## Por que este prompt existe
Esta folha nunca foi desenhada: a ordem, a hierarquia e o comportamento saíram direto do JSX (`apps/web/src/features/scenarios/save-scenario-sheet.tsx`), inferidos de requisito textual. O protótipo de 2026-07-02 tem uma folha de formulário parecida ("Adicionar filamento", `CatalogScreen.jsx`), mas ela é **ancorada embaixo** e tem um rodapé com **[Cancelar][Salvar]** lado a lado — a construída é ancorada à **direita**, não tem rodapé e não tem Cancelar. E o objeto é outro: no protótipo, salvar era *gated* ("Ação Salvar → dispara bottom-sheet de UPSELL"), então uma folha de salvar simulação não podia existir lá. O documento `ux-scenarios.md` §10.1 item 4 pede este protótipo com prioridade "High" — nunca foi feito.

## O que já existe hoje (não invente do zero — corrija)
Ordem literal na tela, de cima para baixo:

| # | Elemento | Texto literal em pt-BR |
|---|---|---|
| 1 | Título da folha | "Salvar simulação" |
| 2 | Parágrafo de introdução (cinza, `--text-muted`, `fs-body-sm`) | "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje." |
| 3 | Campo obrigatório, texto de uma linha | rótulo "Nome" (com marca de obrigatório) |
| 4 | Campo opcional, área de texto de 3 linhas | rótulo "Nota (opcional)" + a marca "opcional" à direita do rótulo |
| 5 | Linha de eco, **cinza, tamanho pequeno**, sem rótulo destacado | "Base de custo: avulsa" · "Base de custo: Suporte de fone de ouvido (referência do catálogo)" |
| 6 | Linha de erro do envio (vermelha), só quando existe | ver Estados |
| 7 | Botão de envio, largura total | "Salvar simulação" |
| — | Fechar | apenas o "✕" de 44×44px no canto superior direito. **Não existe Cancelar.** |

→ **O problema central**: o item 5 é a única informação que diz *o que está sendo guardado*, e hoje ele aparece **por último, em cinza, do tamanho de uma legenda**, depois dos campos. A pessoa nomeia antes de saber o que nomeia. O desenho deve resolver isso — a base de custo é contexto de cabeçalho, não rodapé.
→ **Sem contador de caracteres** apesar de dois limites reais (120 e 500). No Nome o navegador trava em 121 caracteres e só então a mensagem de erro aparece; na Nota não há trava nenhuma — dá para digitar 900 caracteres e só descobrir no clique.
→ **Sem nome sugerido.** A folha abre com o campo vazio, embora o app já saiba o produto/base e a data.
→ **A folha é ancorada à direita, ocupando a altura toda** (largura = min(92vw, 26rem)). Em 390px isso vira uma gaveta lateral de ~359px colada na borda direita — herdado do primitivo, não decidido.
→ **O botão de envio não tem estado de carregando**: durante o POST ele só fica desabilitado (o primitivo de botão tem estado com giro e rótulo mantido, e a folha de "Renomear simulação" usa esse estado; esta não).
→ **Mensagem escrita e nunca exibida**: "Esta simulação ficou grande demais para salvar. Reduza o número de peças ou de custos e tente de novo." existe no arquivo de textos e **nenhuma tela a renderiza**. Se o desenho previr o caso de payload grande, ele precisa ter lugar visível — frase honesta que ninguém vê é frase que não existe.
→ **Beco sem saída**: se a calculadora não produziu um resultado válido, o botão de envio abre desabilitado e a folha não mostra explicação nenhuma (a frase "Corrija os campos da calculadora antes de salvar." só é acionada por um envio que o botão desabilitado impede). Desenhe esse caso com a frase visível, não com um botão morto.

## Conteúdo e dados reais
- **Nome** — texto livre, obrigatório, máximo **120 caracteres**. Erros literais: "Dê um nome à simulação." (vazio) e "Máximo de 120 caracteres." (estourou). Espaços nas pontas são descartados no envio.
- **Nota** — texto livre, opcional, máximo **500 caracteres**, 3 linhas visíveis. Erro literal: "Máximo de 500 caracteres."
- **Base de custo** — somente leitura, derivada do que estava na tela quando a folha abriu (é congelada na abertura: quem escreve o nome não altera mais o que será salvo). Três formas possíveis do sufixo: "avulsa", "referência do catálogo", "kit do catálogo" — hoje só as duas primeiras chegam à tela. Exemplos reais para desenhar: `Base de custo: avulsa` e `Base de custo: Suporte de fone de ouvido (referência do catálogo)`.
- **Nome longo sem espaço** é um caso real e já quebrou layout: desenhe o eco com quebra em qualquer ponto (120 caracteres colados têm de quebrar dentro do painel de ~359px, nunca vazar).
- **Sucesso** — um aviso flutuante de tom positivo com "Simulação salva." e a folha fecha. Só em gravação real: nada de "salvo!" otimista.
- Números que circulam ao redor desta folha, se precisar mostrar contexto na prancheta: preço sugerido `R$ 24,24`, alternativas `R$ 16,16` e `R$ 21,01`.

## Estados obrigatórios
1. **Gatilho ausente** — sem premium ativo o botão "Salvar simulação" simplesmente **não existe** na calculadora (não é cinza, não é isca). Desenhe a região sem ele, para mostrar que a página livre fica intacta.
2. **Gatilho inerte** — botão visível e desabilitado enquanto a calculadora está inválida; precisa de uma explicação legível ao lado ("Corrija os campos da calculadora antes de salvar."), hoje inexistente.
3. **Repouso da folha** — campos vazios, botão de envio habilitado.
4. **Foco** — anel de foco visível no campo de texto e na área de texto, e no "✕".
5. **Digitando com erro no Nome** — a mensagem "Dê um nome à simulação." **não** aparece antes da pessoa digitar; ela aparece assim que o campo foi tocado **ou** depois de uma tentativa de envio (regra criada em resposta a um defeito real: o clique não fazia nada e nada era dito). Desenhe as duas situações: campo intocado silencioso e campo em erro depois do clique.
6. **Limite estourado** — Nome com 121 caracteres ("Máximo de 120 caracteres."), Nota com 501+ ("Máximo de 500 caracteres."). Mostre onde o contador deveria estar.
7. **Enviando** — botão ocupado (giro + rótulo mantido), campos ainda legíveis, "✕" ainda alcançável.
8. **Erro de gravação** — a folha **permanece aberta com tudo digitado intacto**, e a linha vermelha diz a causa medida. Sem conexão: "Salvar uma simulação precisa de conexão." Falha do servidor: a mensagem específica do erro. Nunca uma falha de rede vendida como "não é premium".
9. **Documento grande demais** — a frase citada acima, hoje sem lugar na tela.
10. **Sucesso** — aviso "Simulação salva." e fechamento.
11. **Premium pausado / sem permissão** — o gatilho some (mesmo caso 1). Se a assinatura vencer entre abrir a folha e enviar, o servidor recusa e o caso 8 é o que aparece: desenhe essa recusa com texto honesto, não com um upsell disfarçado de erro.

## Viewports
- **390px (mobile)** — obrigatório: é o uso principal e é onde a âncora lateral de altura cheia é mais questionável. Mostre também o comportamento com teclado virtual aberto (o botão de envio não pode ficar inalcançável).
- **1280px (desktop)** — obrigatório: a mesma folha aparece na calculadora e dentro do produto do Catálogo. Em 1280 o painel de 416px convive com a página atrás; mostre a relação com o conteúdo escurecido por trás.
- **1920px** — opcional, só se a proporção do painel mudar sua recomendação.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou o vendedor tem premium ativo e a folha existe inteira, ou o gatilho não existe. Nada de campo desabilitado com cadeado, nada de isca dentro da folha.
- **Procedência do número**: o eco da base de custo é a origem do que está sendo salvo — ele precisa estar visível **antes** do envio e legível sem esforço.
- **A promessa tem de aparecer**: "recalcula com os preços de hoje" é o que separa Simulação de Orçamento; não pode virar letra miúda.
- **Frase honesta nunca em placeholder** e nunca dentro de um elemento estreito que corte o texto — erros e explicações vivem em elementos de largura total.
- **Erro nunca cria fato**: falha de gravação mantém os valores; nada de fechar a folha e perder o que foi digitado.
- **Alvos ≥44×44px** (o "✕", o botão de envio) e contraste medido contra a superfície real da folha, nos dois temas.
- Se você propuser um botão **Cancelar** (o protótipo tinha), diga onde ele fica sem competir com o envio — e lembre que o vocabulário do produto usa "Voltar", nunca "Cancelar", em superfícies de simulação.

## Armadilhas já pagas neste projeto
- **Texto ocluso passa em teste**: elemento visível para o código e coberto na tela. Verifique o empilhamento do painel, do escurecimento de fundo e do aviso flutuante de sucesso.
- **Estouro horizontal medido**: um nome de 120 caracteres sem espaço já ameaçou vazar o painel de 390px; o eco precisa quebrar em qualquer ponto.
- **Placeholder que corta a frase**: já aconteceu de a frase honesta caber só como sufixo de um campo e ser truncada — não repita.
- **Aviso que existe no código e nunca aparece**: é literalmente o caso da mensagem de "grande demais"; todo texto de estado precisa de uma prancheta que o mostre.
- **Barra de rolagem clássica não aparece em captura**: se o conteúdo da folha passar da altura, desenhe explicitamente onde ele rola e o que fica fixo.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (igualmente acabado)**:
1. Folha em repouso, 390px — com a base de custo reposicionada como contexto de cabeçalho.
2. Folha com Nome em erro depois de tentar salvar, 390px.
3. Folha em envio + folha em erro de gravação com valores intactos ("Salvar uma simulação precisa de conexão."), 390px.
4. Folha com limites (contador de Nome e de Nota) e nome longo sem espaço no eco, 390px.
5. Folha em 1280px, sobre a calculadora, mostrando o escurecimento e a ancoragem escolhida.
6. Região do gatilho na calculadora nos três casos: presente, inerte com explicação, e ausente (sem premium).
7. Estado de sucesso: aviso "Simulação salva." e a folha saindo.

Reutilize os primitivos existentes, sem inventar novos: painel deslizante `tf-dialog--sheet` (com o fecho `tf-dialog__x` de 44×44) para a folha; `tf-dialog__title` para "Salvar simulação" e `tf-dialog__desc` para a introdução; `tf-field` (rótulo + marca "opcional" + linha de erro com `--danger-text`) envolvendo `tf-input` para Nome e Nota; `tf-btn` primário de largura total, com o estado `loading` de giro, para o envio; `tf-btn--secondary` para o gatilho na calculadora; o aviso flutuante padrão de tom positivo para "Simulação salva."; e, se o eco virar bloco de contexto, uma superfície `tf-card` discreta ou `tf-badge` para o sufixo de origem.

## Perguntas em aberto para o dono
1. **O eco da base de custo sobe para o topo?** Ele é a informação que diz o que está sendo salvo, mas hoje é a última linha em cinza. Quer contexto de cabeçalho (acima do Nome), ou mantém como confirmação final?
2. **"Base de custo: avulsa"** é uma frase que um vendedor leigo entende? "avulsa" é vocabulário interno. Existe rótulo aprovado para "não veio do catálogo"?
3. **Nome sugerido**: a folha deve abrir com algo pré-preenchido (nome do produto + data, por exemplo) e editável, ou o campo vazio é intencional para forçar uma escolha consciente?
4. **Cancelar/Voltar**: o protótipo tinha rodapé com dois botões; a peça construída só tem o "✕". Fica só o "✕" ou entra um "Voltar" explícito?
5. **Ancoragem em mobile**: gaveta lateral de altura cheia (como está) ou folha de baixo (como o protótipo de "Adicionar filamento")? Isso muda toda a composição em 390px.
6. **Documento grande demais**: a mensagem existe e nunca é mostrada. É um estado que ainda deve existir? Se sim, a recusa aparece na folha ou antes, no gatilho?
