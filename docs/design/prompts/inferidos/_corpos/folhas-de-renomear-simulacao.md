# Renomear simulação — uma folha só, hoje são duas

## O que desenhar

A folha (painel lateral) que abre quando o vendedor renomeia uma simulação salva. Ela é alcançada por
**dois caminhos diferentes** dentro de Simulações: (1) pelo cartão da lista "Minhas simulações", tocando
no ícone de lápis da linha de ações; (2) pela barra de contexto da simulação já aberta na calculadora
(a faixa "Simulação: {nome}" com os botões `Abrir origem · Renomear · Duplicar · Salvar alterações`).
O usuário é o vendedor que salvou dez estratégias e não lembra mais qual é qual — renomear é como ele
arruma a prateleira. É uma peça pequena, de trinta segundos de uso, e por isso mesmo ela precisa ser
**a mesma peça nos dois caminhos**. Desenhe UMA folha canônica, e desenhe as duas origens ao redor dela
para mostrar de onde ela nasce.

## Por que este prompt existe

Ninguém desenhou renomear. Cada PR inferiu a sua tela a partir do texto do requisito e o resultado são
**duas folhas divergentes para a mesma ação**: a da lista tem Nome + Nota e mostra erro; a da barra de
contexto tem só o Nome (a Nota fica inalcançável por esse caminho) e **falha em silêncio** — se o campo
estiver vazio ou passar de 120 caracteres, o botão não faz nada, não mostra nada, não fecha nada. Pior:
as duas usam o rótulo **"Salvar alterações"**, que na barra de contexto é o nome de OUTRA ação (gravar a
configuração inteira da simulação). A mesma frase significa duas coisas a dois centímetros de distância.
O canvas 018 tem um botão parecido ("Editar rótulo", ficha de Orçamentos), mas é outro objeto e o canvas
não desenha a folha que ele abre; o protótipo de 2026-07-02 não tem renomear em lugar nenhum. Não existe
autoridade que diga qual das duas está certa — e é exatamente por isso que existem duas.

## O que já existe hoje (não invente do zero — corrija)

**Folha A — a partir do cartão da lista** (`scenarios-list-sheet.tsx`): título `"Renomear simulação"`,
campo `"Nome"` obrigatório, campo `"Nota (opcional)"` como área de texto de 3 linhas, um parágrafo de erro
em vermelho solto logo acima do botão, e o botão `"Salvar alterações"`.

**Folha B — a partir da barra de contexto** (`scenario-context-bar.tsx`): título `"Renomear simulação"`,
campo `"Nome"` obrigatório, botão `"Salvar alterações"`. Nada mais.

| Elemento | Folha A (lista) | Folha B (barra) | → problema |
|---|---|---|---|
| Título | "Renomear simulação" | "Renomear simulação" | igual, é a única coisa que bate |
| Nome | texto, obrigatório, limite 120 | texto, obrigatório, limite 120 | → aceita digitar 121 caracteres (o campo trava só em 121) e não há contador em nenhuma das duas |
| Nota | área de 3 linhas, limite 500 | **ausente** | → a mesma ação edita a nota num caminho e não no outro |
| Erro de validação | parágrafo vermelho solto, abaixo dos campos, longe do campo culpado | **nenhum** | → na B o botão simplesmente não responde: falha muda |
| Botão | "Salvar alterações" | "Salvar alterações" | → na barra de contexto esse é o rótulo do PUT da configuração inteira, logo atrás da folha |
| Erro de rede | dentro da folha | **atrás da folha**, no alerta da barra de contexto, coberto pelo painel | → o vendedor vê o botão parar de girar e nada acontecer |

→ Um detalhe herdado das duas: o rótulo do campo de nota sai na tela como **"Nota (opcional) opcional"** —
o texto já traz "(opcional)" e o marcador de campo opcional do design system acrescenta a palavra de novo.
Resolva no desenho: ou o rótulo é `"Nota"` com o marcador, ou é `"Nota (opcional)"` sem ele.

**Ao redor.** No cartão da lista: nome em uma linha com reticências, nota em duas linhas com reticências,
`"Atualizado há 2 dias"`, e uma fileira de três botões-ícone à direita (lápis · copiar · lixeira). Na barra
de contexto: `"Simulação: Camiseta 3D — Shopee agressivo"`, a legenda `"Recalculado com os preços de hoje"`,
o selo `"Alterações não salvas"`, o botão `"Fechar simulação"` à direita, e a fileira
`Abrir origem · Renomear · Duplicar · Salvar alterações`.

## Conteúdo e dados reais

- **Nome** — texto, obrigatório, até **120 caracteres**. Exemplo real: `Camiseta 3D — Shopee agressivo`.
  Adversarial: `Suporte de fone articulado com base emborrachada — Mercado Livre Clássico sem frete grátis`
  (93 caracteres, precisa caber na folha de 390px sem estourar).
- **Nota** — texto livre, opcional, até **500 caracteres**. Exemplo real:
  `Margem apertada de propósito, só para queimar estoque de PLA cinza.`
- **Erros literais, já homologados:** `"Dê um nome à simulação."` · `"Máximo de 120 caracteres."` ·
  `"Máximo de 500 caracteres."`
- **Erro de escrita sem conexão:** `"Esta ação precisa de conexão."`
- **Sucesso:** a folha fecha e sai um aviso curto de sucesso — `"Simulação renomeada."` — e só depois de
  a gravação ter acontecido de verdade.
- A folha **não mostra dinheiro nenhum**: renomear não toca preço, canal nem base de custo. Se o desenho
  quiser lembrar o vendedor de qual simulação ele está renomeando, o material honesto disponível é o nome
  anterior e a linha `"Atualizado há 2 dias"` — nunca um preço recalculado ali dentro.

## Estados obrigatórios

1. **Repouso** — nome preenchido com o valor atual, nota preenchida com a nota atual, botão habilitado.
2. **Foco** no campo de nome (anel de foco visível sobre o fundo do painel, não sobre o fundo da página).
3. **Hover** e **pressionado** no botão primário e nos botões-ícone do cartão de origem.
4. **Nome vazio** — `"Dê um nome à simulação."` ancorado NO campo de nome, não solto no rodapé.
5. **Nome longo demais** — `"Máximo de 120 caracteres."` + a decisão de contador (ver perguntas).
6. **Nota longa demais** — `"Máximo de 500 caracteres."` ancorado no campo de nota.
7. **Gravando** — botão em carregamento, campos ainda legíveis, folha não fecha antes da resposta.
8. **Falhou a gravação** — mensagem honesta DENTRO da folha, valores digitados intactos, folha aberta.
9. **Sem conexão** — `"Esta ação precisa de conexão."`; hoje o botão "Renomear" nas duas origens já nasce
   desabilitado offline, com a razão escrita por perto: desenhe o botão desabilitado + a frase.
10. **Premium pausado** — mesma trava, com a frase existente:
    `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` A simulação continua
    abrindo e recalculando; só a escrita congela — o desenho tem que dizer isso, não sugerir perda.
11. **Sucesso** — folha fechada, o nome novo já visível na lista/na barra, aviso de sucesso.

Não existe estado vazio nem estado degradado nesta peça: ela só abre sobre uma simulação que existe.

## Viewports

- **390px (mobile)** — obrigatório. O painel ocupa 92% da largura (≈358px) ancorado à direita, altura
  cheia, com rolagem própria.
- **1280px (desktop)** — obrigatório. O mesmo painel fica com 416px fixos na borda direita, sobre a tela
  da calculadora; a barra de contexto e o cartão da lista continuam visíveis por trás do véu, e é
  justamente aí que a colisão de rótulo com o "Salvar alterações" da barra fica visível. Desenhe essa
  sobreposição em uma prancheta — é o argumento do prompt. 1920px não acrescenta nada: o painel não cresce.

## Regras que o desenho não pode quebrar

- **Nenhuma ação falha em silêncio.** Todo caminho que não grava tem que dizer o motivo na tela.
- **O aviso de sucesso só existe depois da gravação real.** Nada de confirmar otimista.
- **Falha de rede nunca é vendida como limite de plano** — e limite de plano nunca é disfarçado de erro
  técnico. São duas frases distintas e já escritas; use-as literalmente.
- **Premium pausado não some com nada**: a frase fala em reativar, nunca em perder simulações.
- A frase honesta mora em texto de verdade, **nunca dentro do campo como placeholder** — placeholder é
  cortado pela largura do campo e some ao digitar.
- **Um rótulo, um significado.** Nesta funcionalidade não pode existir duas ações diferentes chamadas
  "Salvar alterações".
- Alvos de toque **≥ 44px** — inclusive os três botões-ícone do cartão, que hoje moram lado a lado.
- Contraste medido contra o fundo real do painel (que é mais claro que o fundo da página), não contra o
  fundo da página.

## Armadilhas já pagas neste projeto

- **Texto que estoura a coluna.** Um nome de 120 caracteres sem espaço nenhum já quebrou a lista antes; o
  cartão só ficou correto depois de ganhar quebra em qualquer ponto. Mostre o nome longo no campo, no
  cartão e no título da barra de contexto. No painel de 358px já houve botão nascido fora da viewport.
- **Texto ocluso passa em teste.** Um erro renderizado atrás do painel aberto (que é exatamente o que a
  folha B faz hoje com o erro de rede) satisfaz qualquer verificação de conteúdo e não é visto por
  ninguém. O desenho precisa deixar explícito onde cada mensagem aparece em relação ao painel.
- **Painel que fecha e trava a página.** Já custou um app congelado nesta base: o conteúdo do painel não
  pode sumir no mesmo instante em que ele fecha. É restrição de implementação, mas nasce do desenho da
  transição de fechamento — desenhe o fechamento como um estado, não como um corte.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como cidadão de primeira classe (pelo menos a prancheta
1 e a 5 nos dois temas):

1. **Folha canônica em repouso, 390px** — com os valores reais do exemplo.
2. **Folha canônica em repouso, 1280px**, sobreposta à calculadora com a barra de contexto visível atrás.
3. **Erros** — nome vazio, nome longo demais, nota longa demais (390px).
4. **Gravando + falhou a gravação** (390px), com a mensagem dentro da folha.
5. **As duas origens** — o cartão da lista com a fileira de ícones, e a barra de contexto com os quatro
   botões — incluindo os estados **sem conexão** e **premium pausado** com a razão escrita.

Reutilize os primitivos existentes, sem inventar componente novo: o painel é o **Sheet ancorado à direita**;
o título é o **título de folha**; cada campo é o **Field** (com rótulo, marcador de obrigatório/opcional e
o slot de erro do próprio Field — é lá que o erro deve morar, não num parágrafo solto); os campos são
`tf-input` (o de nota em área de texto de 3 linhas); o botão de confirmar é o **Button primário**, os do
cartão são **Button ghost pequeno com ícone**; a razão da trava é texto secundário; o erro de escrita é o
**Alert de tom perigo**; o aviso de sucesso é o **toast de tom sucesso**; o selo de alterações não salvas
é o **Badge neutro**.

## Perguntas em aberto para o dono

1. **A folha canônica edita a Nota também quando aberta pela barra de contexto?** Unificar significa que
   renomear pela barra passa a poder mexer na nota (mais consistente, mais campo numa ação que se chama
   "renomear"). Alternativa: a folha só tem Nome, e editar a nota vira outra porta.
2. **Qual é o rótulo do botão de confirmar?** "Salvar alterações" está ocupado pela gravação da
   configuração. Candidatos: "Salvar nome", "Renomear", "Salvar". A escolha muda a largura do botão nos
   dois temas e no painel de 358px.
3. **Contador de caracteres: mostrar sempre, só ao se aproximar do limite, ou nunca?** Hoje não existe
   nenhum, e o campo deixa digitar um caractere além do limite só para conseguir acusar o erro.
4. **Apagar a nota na folha significa apagar a nota da simulação?** Hoje, pelo caminho da lista, esvaziar
   a área de texto remove a nota de verdade — se isso é o comportamento desejado, o desenho deve avisar; se
   não é, precisa de uma ação explícita de remover.
