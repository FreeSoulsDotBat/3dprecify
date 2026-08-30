# Os dois recados que substituem o editor de produto

## O que desenhar

Duas telas curtas que **tomam o lugar inteiro** do editor de produto do Catálogo Premium, antes de qualquer campo aparecer. (a) **Pré-requisito**: o vendedor clicou em "Adicionar produto" mas ainda não tem filamento OU impressora salvos — o produto referencia itens salvos, então o formulário não pode abrir. (b) **Produto não encontrado**: o vendedor abriu `/catalogo?produto=<id>` (linha da lista, deep link, ou o atalho "ver a base" de um cenário salvo) e aquele id não está na lista carregada. As duas vivem na mesma rota do Catálogo — quando `?produto=` está presente, a página do Catálogo **não renderiza as abas**: ela devolve o editor, e portanto estes recados ocupam toda a área de conteúdo, com o rail de navegação do 018 ao lado. A primeira é o primeiro passo do vendedor no Catálogo Premium; a segunda quase sempre chega depois de uma exclusão ou de um link antigo.

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. O verificador adversarial confirmou que nada cobre estas duas telas: o §E9 do protótipo cobre "erro global (envelope ADR-0002)" e "404 de rota inexistente" — recados de **rota/sistema**, não um recado *dentro de um editor* sobre o estado dos dados do próprio vendedor; o §E5 não prevê pré-requisito entre entidades (no protótipo qualquer segmento cria livremente); a matriz §G não tem linha para isso; o `.design-import` cria produto pelo mesmo sheet, sem verificar nada; e o canvas do 018 mantém o editor de produto explicitamente fora (research §E). Uma IA montou as duas à mão, em `max-w-md` centralizado, com `PageHeader` + `Alert tone="info"` + botão secundário. Nunca se decidiu se isso é **estado vazio de marca** ou **alerta**, e a tela do pré-requisito explica o problema e manda o vendedor embora **sem oferecer a ação que o resolve**.

## O que já existe hoje (não invente do zero — corrija)

**(a) Pré-requisito** — `produto-page.tsx`, disparo: `!productId && (filaments.length === 0 || printers.length === 0)`

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho (`PageHeader`) | "Novo produto" |
| Alerta `tone="info"` | "Para criar um produto, salve antes um filamento e uma impressora no catálogo." |
| Botão secundário | "Voltar ao catálogo" |

→ **Problema 1**: não há atalho para "Adicionar filamento" / "Adicionar impressora" — exatamente as duas ações que destravam a tela. O vendedor volta para o Catálogo e tem que descobrir sozinho em qual aba entrar.
→ **Problema 2**: a frase é genérica quando o app **sabe qual dos dois falta**. Se o vendedor já tem 3 filamentos e nenhuma impressora, ele lê "salve antes um filamento e uma impressora" e desconfia de tudo que salvou.
→ **Problema 3**: a largura `max-w-md` (448px) é fixa. O resto do Catálogo usa `tf-page-wide` (460px no mobile, 1120px a partir de 1024px, até 1720px a partir do corte de 1280px do 018). No desktop redesenhado, este recado é uma coluna de 448px perdida numa área de conteúdo de mais de 1400px.

**(b) Produto não encontrado** — disparo: `productId && !editing` (o id não está em `products.items`)

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho | "Editar produto" |
| Enquanto `products.isLoading` | um `Spinner` centralizado, `py-8`, sem nenhuma legenda |
| Depois | Alerta `tone="info"` "Não encontramos este produto." + botão "Voltar ao catálogo" |

→ **Problema 4 (o mais grave)**: o código só distingue `isLoading`. O hook do catálogo expõe também `isError` e `stale`, e **nenhum dos dois é consultado aqui**. Se a leitura falhou (offline sem cache, servidor fora), a lista vem vazia, `isLoading` é falso — e a tela afirma "Não encontramos este produto" para um produto que **existe**. É uma falha de rede vendida como um fato sobre os dados do vendedor. A copy honesta já existe no mesmo arquivo de textos e não está sendo usada: "Não foi possível carregar seu catálogo." + "Tentar novamente", e para offline "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
→ **Problema 5**: o mesmo `isError` afeta a tela (a): com a leitura falhando, `filaments.length === 0` é verdade e o vendedor experiente lê "salve antes um filamento e uma impressora" — uma acusação falsa.
→ **Problema 6**: o cabeçalho diz "Editar produto" acima de "Não encontramos este produto." Título e corpo se contradizem na mesma tela.

## Conteúdo e dados reais

- Entradas para o editor: botão "Adicionar produto" (aba Produtos), clique numa linha da lista, e a barra de contexto de um cenário salvo, que navega para o produto que serve de base ao cenário.
- Ações vizinhas que já existem com estes nomes exatos: "Adicionar filamento", "Adicionar impressora", "Adicionar produto", "Voltar ao catálogo", "Tentar novamente", "Limpar busca".
- Estados do catálogo já modelados: `isLoading`, `isError`, `stale` ("pode estar desatualizada"), lapsed ("Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.").
- Nenhuma das duas telas mostra dinheiro. O editor completo que elas substituem mostra (para calibrar a expectativa de quem chega): nome do produto (placeholder "Ex.: Vaso G"), os dois seletores de catálogo e o resultado recalculado ao vivo, por exemplo **R$ 24,24** como preço sugerido — o vendedor está a um passo disso e o recado é o que o separa dali.
- O pré-requisito só vale para **criar**. Editar um produto já salvo cujos vínculos sumiram não cai aqui: cai no editor normal, com o alerta "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam editáveis." Não misture as duas linguagens.

## Estados obrigatórios

1. **Pré-requisito — falta só filamento**: diz qual falta e oferece "Adicionar filamento" como ação primária, "Voltar ao catálogo" como secundária.
2. **Pré-requisito — falta só impressora**: simétrico, com "Adicionar impressora".
3. **Pré-requisito — faltam os dois**: a frase homologada "Para criar um produto, salve antes um filamento e uma impressora no catálogo." com as duas ações, a primeira em destaque.
4. **Carregando** (`isLoading`, lista ainda não respondeu): não decidir nada ainda. Nem "não encontramos", nem "salve antes". Desenhe o que ocupa esse tempo — hoje é um `Spinner` mudo e isso precisa de uma legenda curta.
5. **Não encontrado de verdade** (lista respondeu, id ausente): "Não encontramos este produto." + volta ao catálogo. Título coerente (ver Problema 6).
6. **Falha de leitura** (`isError`): "Não foi possível carregar seu catálogo." + "Tentar novamente" — nunca a frase de não-encontrado.
7. **Offline com cache**: "Modo leitura offline" (tom `info`, jamais `danger`) + "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
8. **Premium pausado**: "Premium pausado" + "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." — o atalho de criar filamento/impressora não pode ser oferecido como se funcionasse.
9. Para cada botão: repouso, foco visível (anel de foco no fundo real da tela), hover, pressionado, desabilitado.

## Viewports

- **Mobile 390px** — é onde o vendedor usa o produto no dia a dia; a coluna de 448px já se comporta bem aqui, o desenho só precisa confirmar o empilhamento das duas ações e o alvo de toque.
- **Desktop 1280px** — o corte do 018, onde o rail de navegação passa a existir ao lado. É aqui que a decisão de largura tem que aparecer: o recado acompanha `tf-page-wide` ou fica numa coluna centrada com teto próprio?
- **Desktop 1920px** — a área de conteúdo chega a 1720px. Um alerta de 448px encostado à esquerda ou boiando no centro de 1720px é a diferença entre "tela pensada" e "aviso esquecido". Desenhe as duas telas neste tamanho.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca vira fato sobre os dados do vendedor.** "Não encontramos este produto" e "não conseguimos carregar" são afirmações diferentes e precisam de tratamentos visuais diferentes.
- **Não inventar evento que não aconteceu.** O app não sabe se o produto foi excluído, se o link é antigo ou se é de outra conta. A copy não pode dizer "excluído".
- **Freemium binário**: nada de "parcialmente disponível". Premium pausado mantém leitura completa e congela escrita, dito de frente e não descoberto no botão Salvar.
- **A frase honesta fora de placeholder.** Já foi pago neste projeto: frase honesta dentro de campo estreito é frase cortada.
- **Alvo ≥44px** para todos os botões, inclusive no desktop, e contraste medido contra o fundo real de cada tema.
- O recado não pode ser um beco: toda tela oferece pelo menos uma saída **que resolve** e uma que **volta**.

## Armadilhas já pagas neste projeto

- **Largura desperdiçada é defeito medido, não gosto**: no 016 mediu-se ~39% da área de conteúdo usada a 1440px por causa de um `max-w-md` esquecido. Estas duas telas ainda têm exatamente esse `max-w-md`.
- **Overflow horizontal**: medir os dois eixos. O headless não enxerga barra de rolagem clássica; foi assim que o item 9 do 016 escapou.
- **Texto ocluso passa em teste**: `toBeVisible`/`toContainText` passam em elemento sobreposto ou estourado. Assertar geometria, não presença.
- **Botão nascido fora da viewport**: aconteceu na tela de plano (100,5px de estouro). Duas ações lado a lado numa tela estreita é exatamente o arranjo que reproduz isso.
- **Spinner mudo**: um giro sem legenda por vários segundos lê como travamento, e foi o que fez a homologação confundir "carregando" com "quebrado" mais de uma vez.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. Pré-requisito — faltam os dois (390 · 1280 · 1920).
2. Pré-requisito — falta só um dos dois (1280 basta, com a variante de texto visível).
3. Carregando (390 · 1280).
4. Não encontrado (390 · 1280 · 1920).
5. Falha de leitura + offline (1280, lado a lado para comparar os tons).
6. Premium pausado sobre o pré-requisito (1280).

Reutilize os primitivos existentes, sem criar novos: `PageHeader` para o título da rota; **decida e justifique** entre `tf-empty` (`EmptyState`, que já tem ícone decorativo, título, descrição e slot de ação centralizados) e `tf-alert` (`Alert`, com tons `neutral | info | success | danger`, ícone de 20px e `role="status"`) — a auditoria aponta essa indefinição como o buraco central desta peça; `Button` primário/secundário para as ações; `Spinner` para o carregamento; e o `Grafismo` da marca se a resposta for estado vazio. Marque na prancheta qual primitivo é cada bloco.

## Perguntas em aberto para o dono

1. **Estado vazio de marca ou alerta?** O pré-requisito é o primeiro passo do Catálogo Premium (tom de boas-vindas, grafismo, ação em destaque) ou um aviso de bloqueio (`Alert info`, seco)? A escolha muda a tela inteira e ninguém a tomou.
2. **O atalho pode existir?** Oferecer "Adicionar filamento" aqui abre o sheet de filamento *dentro* do editor de produto, ou leva à aba Filamentos do Catálogo e o vendedor tem que voltar a pé? A segunda opção é mais barata e pior.
3. **Contar o que falta é aceitável?** Dizer "você já tem 3 filamentos; falta salvar uma impressora" é mais útil e revela contagem do catálogo numa tela que hoje não revela nada. Pode?
4. **Largura no desktop**: estes recados acompanham `tf-page-wide` (até 1720px) ou ganham um teto próprio de leitura centralizado? O 018 redesenhou as quatro abas, não estes recados.
5. **O caminho do cenário salvo**: quando o produto que serve de base a um cenário não é encontrado, o recado deve dizer algo sobre o cenário de origem, ou permanecer genérico?
