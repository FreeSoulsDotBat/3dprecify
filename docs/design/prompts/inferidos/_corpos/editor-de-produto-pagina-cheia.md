# Editor de produto em página cheia (Catálogo → Produtos)

## O que desenhar
A tela inteira em que o vendedor cria ou edita um **produto** do Catálogo Premium: o maior formulário do
aplicativo. Ela abre a partir da aba **Produtos** do Catálogo (rota `/catalogo?produto=novo` ou
`?produto=<id>`) e **substitui a página do Catálogo inteira** — as pílulas de abas somem, o cabeçalho vira
"Novo produto" / "Editar produto" e não existe nenhuma outra saída na tela. Quem usa é o vendedor premium
que já salvou pelo menos um filamento e uma impressora e agora quer congelar uma peça no catálogo com todos
os custos, o markup e os canais de marketplace dela. Ao salvar, a tela fecha e volta para a aba Produtos.
Origem no código: `apps/web/src/pages/catalogo/produto-page.tsx` (linhas 272–453) e
`apps/web/src/pages/catalogo/catalogo-page.tsx`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Nenhuma prancheta, em nenhuma das quatro fontes, jamais desenhou esta
tela. O inventário E1–E9 prevê "form add/editar" em *sheet* só para filamento e impressora; produto aparece
apenas como terceiro segmento de **lista**. O protótipo `CatalogScreen.jsx` trata "produto" com o MESMO
sheet de dois campos — não é remotamente esta tela. E o `research.md` §E do 018 registra por escrito
"Rejeitado: recompor o formulário completo de Produto dentro de 560px" e manda manter "o editor de página
cheia que já existe" — uma decisão textual, sem artboard. Ou seja: a composição inteira (onde mora o
Salvar, a ordem dos blocos, a ausência de saída no topo, e o fato de a tela não participar do mestre-detalhe
do desktop nem a 1920px) foi inferida por IA. Este achado é o **pai** de três outros:
`seletor-de-filamento-e-impressora`, `recados-do-editor-de-produto` e `rodape-do-editor-de-produto` — aqui
desenhamos a **composição e a hierarquia**; o miolo de cada peça tem prompt próprio.

## O que já existe hoje (não invente do zero — corrija)
Ordem vertical atual, de cima para baixo, coluna única centralizada:

| # | Bloco | Conteúdo real hoje |
|---|---|---|
| 1 | Cabeçalho | "Novo produto" ou "Editar produto". → **Sem botão de voltar, fechar ou cancelar. Não há saída.** |
| 2 | Recado (condicional) | Alerta informativo "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam editáveis." |
| 3 | Recado (condicional) | Alerta informativo "Premium pausado" + "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." |
| 4 | Cartão nome + ação | Campo "Nome do produto" (obrigatório, placeholder "Ex.: Vaso G") **e** o botão primário "Salvar produto" **e** o alerta de erro de gravação. → **A ação principal mora no primeiro cartão, no alto, a mais de uma tela de distância do preço que o vendedor está conferindo.** |
| 5 | Cartão de referências | Título "Usar do catálogo", legenda "Preenche os campos com o item salvo — você ainda pode editar tudo.", dois selects: "Filamento salvo" e "Impressora salva", ambos com placeholder "Escolher…". |
| 6 | Corpo, coluna esquerda | "Custos da peça" · "Mão de obra e custos" · "Outros custos" (lista de custos nomeados que o vendedor adiciona). |
| 7 | Corpo, coluna direita | "Markup" · "Marketplace" (canais de venda, cada um com marketplace, modalidade, categoria e tarifas). |
| 8 | Rodapé | O resultado de preço vivo (ou o alerta "Confira os campos destacados para ver o preço."), o botão "Salvar em Orçamentos" e o botão "Salvar simulação". |

Duas colunas só a partir de 1024px; abaixo disso tudo vira uma pilha só, na ordem 6 → 7 → 8.

→ **Largura**: esta página tem teto próprio de **1120px** e **não** recebeu o alargamento de 1720px que as
quatro telas redesenhadas do 018 ganharam. Medido: a 1920px sobram ~400px de margem morta de cada lado
enquanto o formulário mais denso do produto se espreme em 1120px.
→ **Nenhum estado de "há alterações não salvas"** existe: sair da tela descarta tudo, em silêncio.

## Conteúdo e dados reais
- **Nome do produto** — texto, obrigatório. Exemplo real: `Vaso G`.
- **Custos da peça**: "Custo do rolo" (R$, obrigatório — ex.: `R$ 129,90`) · "Peso do rolo" (kg, obrigatório
  — ex.: `1`) · "Gramas usadas" (g, obrigatório — ex.: `85`) · "Consumo médio" (kW, obrigatório — ex.:
  `0,15`) · "Tarifa de energia" (R$/kWh — ex.: `R$ 0,92`) · "Reserva de manutenção" (R$/h) · "Taxa de falha"
  (%) · "Valor da máquina" (R$ — ex.: `R$ 2.400,00`) · "Vida útil da máquina" (h) · tempo de impressão em
  **h e min**.
- **Mão de obra e custos** (todos opcionais): "Tempo de acabamento" (h) · "Valor do acabamento" (R$/h) ·
  "Mão de obra (horas)" (h) · "Valor da hora" (R$/h).
- **Outros custos**: lista variável, cada item com nome e valor em R$; pode estar vazia.
- **Markup**: "Markup varejo" (%, obrigatório — ex.: `250`) e "Markup atacado" (%, obrigatório).
- **Marketplace**: um ou mais canais; o conjunto de campos **muda conforme o marketplace escolhido** (trocar
  o marketplace apaga a categoria, a modalidade e as tarifas do anterior — elas pertenciam a outra
  taxonomia). Desenhe o cartão de canal preparado para ter de 3 a 7 campos.
- **Rodapé de resultado** (derivado, nunca digitado, nunca armazenado — recalculado a cada tecla): "Material",
  "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra", "Custo total", "Preço varejo",
  "Preço atacado" e, por canal, "Preço para anunciar" e "Recebido líquido". Números verdadeiros de semente:
  custo total `R$ 16,16`, preço varejo `R$ 24,24`, recebido líquido `R$ 21,01`.

## Estados obrigatórios
1. **Repouso — criação** (`?produto=novo`): cabeçalho "Novo produto", nome vazio, selects em "Escolher…",
   campos com valores padrão, rodapé já mostrando um preço.
2. **Repouso — edição**: cabeçalho "Editar produto", tudo preenchido, e o rodapé ganha "Salvar em
   Orçamentos" e "Salvar simulação" (só existem em produto já salvo).
3. **Carregando o produto**: a lista ainda não respondeu — cabeçalho + um `Spinner` centralizado, nada mais.
4. **Não encontrado**: alerta informativo "Não encontramos este produto." + botão secundário "Voltar ao
   catálogo". Nunca um formulário em branco.
5. **Pré-requisito ausente** (criar sem nenhum filamento ou impressora salvos): alerta informativo "Para
   criar um produto, salve antes um filamento e uma impressora no catálogo." + "Voltar ao catálogo". O
   formulário **não** aparece.
6. **Nome vazio ao salvar**: erro no campo — "Dê um nome ao produto."
7. **Campos inválidos ao salvar**: alerta de perigo no cartão do nome — "Confira os campos destacados antes
   de salvar." E, no rodapé, no lugar do preço: "Confira os campos destacados para ver o preço."
8. **Salvando**: o botão "Salvar produto" em estado de carregamento (spinner dentro do botão).
9. **Falha de gravação**: a página **fica aberta**, com um alerta de perigo e a frase específica do erro
   (rede, sessão expirada, servidor). Nunca perder o que foi digitado, nunca vender falha de rede como
   "não é premium".
10. **Referência solta / degradado**: o select mostra "— Manual —" no lugar de "Escolher…", e o topo traz
    "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam
    editáveis." Os campos seguem editáveis e o preço segue sendo calculado. O recado **some sozinho** no
    instante em que os dois selects são preenchidos.
11. **Premium pausado (lapsed)**: leitura e cálculo continuam completos, **toda** a entrada fica inerte
    (nome, selects e o corpo de duas colunas inteiro), o botão "Salvar produto" **desaparece** e no lugar
    dele entra "Reative o Premium" + "Reative o Premium para voltar a criar e editar. Seus itens estão
    salvos." Precisa ser visível já na primeira renderização — nunca uma surpresa na hora de salvar.
12. **Foco, hover, pressionado, desabilitado** em campos, selects e nos três botões — inclusive o foco
    visível dentro do estado inerte do item 11, que hoje é o único sinal de que ali havia um campo.

## Viewports
- **390px (mobile)** — obrigatório: é a tela em que o produto nasceu e a pilha de 8 blocos é a experiência
  real. Mostre a rolagem longa e onde o Salvar cai em relação ao preço.
- **1280px (desktop, o corte do 018)** — obrigatório: é onde as duas colunas ligam e onde o desenho precisa
  decidir a barra de ação.
- **1920px** — obrigatório: é o caso que expõe o problema medido (teto de 1120px, ~400px mortos de cada
  lado) e onde o dono precisa ver a alternativa desenhada antes de decidir.

## Regras que o desenho não pode quebrar
- **Freemium é binário**: esta tela só existe atrás do portão premium. Não desenhe meia-tela, campo
  borrado ou preço escondido para não-assinante — quem não é premium não chega aqui.
- **Nenhum preço é armazenado**: todo número do rodapé é recalculado ao vivo. O desenho não pode sugerir
  "preço salvo" nem "última atualização".
- **Degradação dita, não escondida**: a referência solta é informada com calma e os valores continuam
  editáveis; nunca um muro de erro, e nunca afirmar que algo "foi removido" (o dado não sabe se foi).
- **Falha de rede nunca é vendida como limite de plano**, e vice-versa.
- **Frase honesta nunca mora em placeholder**: "Preenche os campos com o item salvo — você ainda pode editar
  tudo." e qualquer aviso vivem em elemento de largura cheia, com espaço para quebrar em duas linhas.
- **Alvo de toque ≥ 44px** em selects, botões de remover linha de "Outros custos" e de canal.
- **Contraste medido contra o fundo real do cartão**, não contra o fundo da página — inclusive no estado
  inerte do premium pausado (cinza sobre cinza é o risco óbvio ali).

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido nos DOIS eixos**: o headless não enxerga barra de rolagem clássica; já
  perdemos um item por medir só X. A 390px a linha de canal de marketplace é a candidata a estourar.
- **Valor astronômico**: o preço tem rolagem própria dentro do bloco de valor justamente porque um número
  gigante já esticou a página inteira. Desenhe o bloco de preço sabendo que `R$ 1.234.567,89` precisa caber
  ou rolar **dentro do cartão**, sem empurrar o layout.
- **Texto ocluso passa em teste**: um elemento totalmente coberto ou fora da coluna ainda "existe" para o
  código. Layout se homologa com caixa, então entregue as pranchetas com as áreas medíveis explícitas.
- **Sufixo cortado**: já tivemos placeholder com a parte honesta clipada. Rótulo e unidade ("R$/kWh", "h",
  "%") precisam de espaço próprio, não podem depender do campo estar largo.
- **A tela não participa do mestre-detalhe do 018**: qualquer proposta de aproximá-la das outras quatro
  telas é uma mudança de produto, não um detalhe visual — trate como proposta, marcada como tal.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. `Editar produto — 1920px, repouso` (o caso que expõe a largura morta).
2. `Editar produto — 1280px, repouso` (duas colunas ligadas).
3. `Novo produto — 390px, repouso` (a pilha completa, com a rolagem indicada).
4. `390px — referência solta` (o "— Manual —" + o recado que some sozinho).
5. `1280px — Premium pausado` (tudo inerte, sem Salvar, com a linha de reativação).
6. `1280px — falha de gravação` + `390px — campos inválidos` (os dois erros, com a frase literal).
7. `390px — carregando` e `390px — não encontrado` / `pré-requisito ausente` (podem dividir uma prancheta).

Reutilize os primitivos existentes, sem inventar nenhum: o cabeçalho de página para o título; o cartão
padrão para cada bloco; o campo com rótulo/erro/obrigatoriedade para todo input; o select do design system
para os dois seletores; o botão primário para "Salvar produto" e secundário para "Salvar em Orçamentos" e
"Salvar simulação"; o alerta nas três tonalidades (informativo para recados e premium pausado, perigo para
erro de gravação e para o preço inválido); o spinner de carregamento; e o bloco de preço grande já existente
para "Preço varejo" / "Preço para anunciar". Se o desenho precisar de uma barra de ação fixa, componha-a com
cartão + botão existentes e diga explicitamente que é uma composição nova, não um primitivo novo.

## Perguntas em aberto para o dono
1. **Onde mora o "Salvar produto"?** Hoje está preso ao cartão do nome, no topo. As alternativas mudam a
   tela inteira: barra de ação fixa no rodapé da janela, cartão de ação junto ao preço no fim, ou uma faixa
   de cabeçalho com título + Salvar. Qual você quer?
2. **A tela precisa de uma saída explícita?** Hoje não há voltar, cancelar nem fechar — só o gesto do
   sistema. Se entrar um "Voltar ao catálogo" no topo, o que acontece com as edições não salvas: descarta em
   silêncio, pergunta, ou salva?
3. **Esta tela entra no mestre-detalhe do 018 a 1920px** (lista de produtos à esquerda, editor à direita) ou
   segue sendo página cheia e apenas ganha o teto de 1720px das outras quatro? O `research.md` §E rejeitou
   encaixá-la nos 560px da ficha, mas não decidiu esta terceira via.
4. **O cartão "Usar do catálogo" continua sendo um cartão separado** ou se funde ao cartão de identidade do
   produto (nome + filamento + impressora numa só faixa de identificação)?
5. **A ordem "custos à esquerda, markup + marketplace à direita" é obrigatória?** Ela existe hoje só porque
   herda a tela Calcular; se o produto puder ter ordem própria, o desenho tem muito mais liberdade — mas
   isso quebra a paridade visual com a Calcular, que já foi um requisito explícito.
