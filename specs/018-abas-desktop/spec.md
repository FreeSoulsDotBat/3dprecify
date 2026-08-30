# Feature Specification: Abas desktop — Catálogo, Kits, Orçamentos e Conta

**Feature Branch**: `018-abas-desktop`

**Created**: 2026-08-10

**Status**: Draft (pós-specify, pré-clarify)

**Input**: User description: implementar o design "Abas Desktop.dc.html" (Claude Design, projeto
`eaa75c01-e81c-4219-a065-90d702417067`) para as quatro abas restantes em desktop — Catálogo, Kits,
Orçamentos e Conta — mais o rail colapsável do menu lateral. Mobile permanece exatamente como está.

**Autoridade de design**: `specs/018-abas-desktop/design/Abas-Desktop.dc.html` (cópia versionada do
arquivo do Claude Design). Quando esta spec e o arquivo divergirem, **o arquivo manda para layout e
composição**; esta spec manda para comportamento, honestidade de estados e invariantes.

---

## Contexto — por que este incremento existe

O incremento 016 corrigiu 15 pontos apontados pelo dono na rodada 1 de homologação
(`docs/homologacao/rodadas/rodada-01-2026-08-04.md`), entre eles R1-02 ("no desktop as seções se
distribuem em linhas") e R1-09 ("Preços finais sem scroll"). Ao repassar as correções, **o dono
julgou que as páginas ainda não ficaram certas no desktop** e as redesenhou do ponto de vista
desktop (1920px), fora do produto, no Claude Design.

Este incremento é a implementação desse redesenho. Ele **não** reabre o que o 016 decidiu sobre
conteúdo (teaser único honesto, rótulos Orçamentos/Simulações, tooltips, máscara monetária) — reabre
a **composição desktop** dessas telas: onde cada bloco mora, quanta largura ocupa, e o que fica
visível ao mesmo tempo.

**Fato verificado antes de especificar**: o design não introduz nenhuma primitiva nova de design
system. As 16 classes que ele usa (`tf-card--interactive`, `tf-card--pad-sm`, `tf-btn--danger-ghost`,
`tf-price--center`, `tf-badge--info`, `tf-inputwrap--sm`, `tf-costs-grid`,
`tf-historico__origin-link`, `tf-premium-teaser__caption`, `tf-billing-offer__plan`, `tf-nav__label`,
`tf-conta__row--plan`, `tf-empty__action`, `tf-alert--compact`, `tf-field__label--tight`, `tf-tnum`)
**já existem** no repositório. Este é um incremento de composição, não de design system.

---

## Clarifications

### Session 2026-08-10

- Q: A ficha da direita no Catálogo edita o item ou só mostra? → A: **Edita filamento e impressora**
  (a gaveta de hoje some no desktop, esses editores passam a viver na ficha); **Produto continua
  abrindo a página cheia** — a ficha dele mostra o resumo e um "Editar" que abre a página. Nenhum
  formulário é reescrito, e o maior formulário do app não é espremido em 560px.
- Q: A partir de qual largura o mestre-detalhe liga? → A: **1280px**. Entre 1280px e ~1600px a lista
  fica em **uma** coluna ao lado da ficha; a lista só vira **duas** colunas quando houver largura de
  sobra (~1600px+, que é a premissa do desenho a 1920px). Abaixo de 1280px permanece a coluna única
  de hoje.
- Q: O controle de tema segmentado (Claro/Escuro) vale em todas as larguras? → A: **Só no desktop**;
  o mobile mantém o interruptor de hoje, preservando o invariante "o mobile não se mexe".

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Catálogo: escolher e conferir sem sair da tela (Priority: P1)

Hoje, no desktop, o vendedor premium vê uma lista estreita no meio de uma tela larga e precisa
**abrir** um item (gaveta lateral em filamentos/impressoras, página cheia em produtos) para ver ou
mexer no que ele guardou — e ao fechar, perde o contexto da lista.

No desktop redesenhado, a tela é **mestre-detalhe**: as seções do catálogo (Filamentos, Impressoras,
Produtos, Kits) viram pílulas segmentadas à direita do título, com o botão de adicionar ao lado; o
corpo é uma lista de cards com busca, e a ficha do item selecionado ocupa uma coluna fixa à direita
que acompanha a rolagem. Clicar num card troca a ficha; a lista nunca some. Em filamentos e
impressoras a ficha é o **editor**; em produtos e kits ela resume e abre o editor de página cheia
que já existe.

**Why this priority**: é a tela com a maior perda de área hoje e a que o dono citou primeiro; é
também a que mais se beneficia de ver lista e item ao mesmo tempo.

**Independent Test**: entrar como premium no desktop ≥1280px, abrir `/catalogo`, alternar as quatro
seções, clicar em itens diferentes e confirmar que a ficha à direita troca sem que a lista saia da
tela e sem navegação de rota.

**Acceptance Scenarios**:

1. **Given** um premium no desktop com filamentos salvos, **When** abre `/catalogo`, **Then** vê o
   título, as quatro pílulas de seção, o botão de adicionar da seção ativa, a busca, a lista de
   cards e a ficha do primeiro item à direita.
1b. **Given** a mesma tela a 1920px, **When** renderiza, **Then** a lista ocupa **duas** colunas; a
   1280px ocupa **uma**.
2. **Given** a lista renderizada, **When** clica no card de outro item, **Then** a ficha à direita
   passa a mostrar aquele item, o card clicado fica visualmente marcado como selecionado, e **nenhuma
   navegação de rota acontece**.
3. **Given** a seção Filamentos ativa, **When** clica na pílula "Impressoras", **Then** a lista, o
   rótulo do botão de adicionar, a contagem sob o título e a ficha passam todos a falar de
   impressoras.
4. **Given** um item com aviso (ex.: produto que "precisa de atenção"), **When** ele é selecionado,
   **Then** a ficha mostra o aviso correspondente sem esconder os campos.
5. **Given** um usuário grátis ou deslogado, **When** abre `/catalogo`, **Then** vê **um** teaser
   honesto — o mesmo do 016/US1 — e nenhuma lista, nenhuma busca e nenhuma ficha.

---

### User Story 2 - Orçamentos: o registro congelado aberto ao lado da lista (Priority: P1)

O vendedor premium abre Orçamentos para conferir o que cotou. Hoje ele escolhe um registro numa
lista estreita e **vai para outra tela** ver o detalhe; para comparar dois registros, vai e volta.

No desktop redesenhado, filtros e lista ficam numa coluna à esquerda e o registro selecionado abre à
direita, com as ações (Exportar, Recalcular hoje, Comparar com hoje, Excluir), o Detalhamento, os
Preços por canal e a Ficha técnica — tudo sem sair da tela.

**Why this priority**: é a tela de consulta, e consulta com ida-e-volta é a que mais custa tempo ao
vendedor; o conteúdo do detalhe **já existe** (Detalhamento, Preços por canal, Ficha técnica,
Validade da proposta, Recalcular/Comparar) — o incremento os recompõe, não os inventa.

**Independent Test**: entrar como premium no desktop, abrir `/historico`, clicar em registros
diferentes e confirmar que o painel da direita troca, mantendo a lista e os filtros visíveis.

**Acceptance Scenarios**:

1. **Given** um premium com registros salvos, **When** abre `/historico` no desktop, **Then** vê
   filtros + lista à esquerda e o registro mais recente aberto à direita.
2. **Given** a lista renderizada, **When** clica noutro registro, **Then** o painel da direita passa
   a mostrar aquele registro e o card clicado fica marcado como selecionado.
3. **Given** um registro aberto, **When** o vendedor olha o painel, **Then** encontra as mesmas
   verdades que a tela de detalhe de hoje entrega — valor cotado, base, data, tipo, validade,
   detalhamento de custos, preços por canal, ficha técnica e o aviso de que o registro é congelado.
4. **Given** um registro pendente de sincronização, **When** ele aparece na lista, **Then** o selo
   de pendência aparece nele, e o aviso de pendências do dispositivo continua acima da grade.
5. **Given** um usuário grátis ou deslogado, **When** abre `/historico`, **Then** vê **um** teaser
   honesto e nenhuma lista.

---

### User Story 3 - Kits: o total do kit para de morar no rodapé (Priority: P1)

Ao montar um kit no desktop, o vendedor tem uma barra colada no rodapé com o total. No desktop
redesenhado, as peças ficam numa coluna à esquerda e o **resumo** — Total do kit (custo, varejo,
atacado), Preços por canal do kit, nome do kit e salvar — ocupa uma coluna fixa à direita que
acompanha a rolagem.

**Why this priority**: o total é a informação que o vendedor consulta a cada mudança de quantidade;
numa tela larga, ele cabe ao lado do que está sendo editado em vez de disputar o rodapé.

**Independent Test**: montar um kit com três peças no desktop, mudar quantidades e confirmar que o
total à direita responde sem que nada fique colado no rodapé.

**Acceptance Scenarios**:

1. **Given** um premium montando um kit no desktop, **When** a tela renderiza, **Then** as peças
   estão à esquerda e o resumo à direita, e **não existe barra fixa no rodapé**.
2. **Given** o kit com peças válidas, **When** o vendedor altera a quantidade de uma peça, **Then**
   custo total, varejo, atacado e preços por canal do resumo respondem à mudança.
3. **Given** uma peça inválida no kit, **When** o total é calculado, **Then** ela fica de fora do
   total, o card dela mostra o aviso, e o resumo declara quantas peças ficaram de fora — a mesma
   honestidade de hoje, noutro lugar da tela.
4. **Given** a mesma tela em mobile, **When** renderiza, **Then** a barra fixa no rodapé continua
   existindo exatamente como hoje.

---

### User Story 4 - Conta: identidade, plano e preferências lado a lado (Priority: P2)

No desktop a Conta é uma coluna estreita de cartões empilhados. No redesenho, ela vira uma grade de
três colunas: identidade + plano (com a oferta, quando grátis) à esquerda, tema no centro,
privacidade e sair à direita.

**Why this priority**: é a tela de menor frequência das quatro, mas é a tela de quem está pagando —
e é onde a oferta aparece para quem ainda não paga.

**Independent Test**: abrir `/conta` no desktop como grátis e como premium e confirmar as três
colunas e o conteúdo correto de cada estado de plano.

**Acceptance Scenarios**:

1. **Given** um premium no desktop, **When** abre `/conta`, **Then** vê identidade e plano à
   esquerda, tema ao centro, privacidade e "Sair" à direita.
2. **Given** um grátis no desktop, **When** abre `/conta`, **Then** a oferta de assinatura aparece na
   coluna do plano, com os dois planos e o preço de cada um.
3. **Given** qualquer estado de plano, **When** o painel renderiza, **Then** ele continua sendo
   alimentado pela verdade do servidor, sem inferir estado (invariante do 012/PR-B).
4. **Given** o retorno do checkout (`?checkout=retorno`), **When** a página renderiza, **Then** ela
   continua sendo tomada inteira por essa superfície, como hoje.

---

### User Story 5 - O menu recolhe (Priority: P2)

O menu lateral do desktop ocupa 240px. O redesenho dá a ele um botão "Recolher" no rodapé: recolhido,
o menu vira um rail de 76px só com ícones; expandido, volta com os rótulos.

**Why this priority**: devolve largura às telas mestre-detalhe; o próprio comentário do shell
declarou o rail colapsável como terreno preparado no 016/US3 e o colapso como fora daquele escopo.

**Independent Test**: no desktop, clicar em "Recolher", confirmar o rail de ícones, navegar entre
seções, expandir de novo.

**Acceptance Scenarios**:

1. **Given** o desktop com o menu expandido, **When** clica em "Recolher", **Then** o menu passa a
   76px, os rótulos somem e os ícones ficam centralizados.
2. **Given** o menu recolhido, **When** o vendedor aponta um item, **Then** ele consegue identificar
   a seção sem o rótulo visível (o nome permanece disponível como dica/nome acessível).
3. **Given** o menu recolhido, **When** o vendedor navega para outra seção, **Then** o menu continua
   recolhido e a seção atual continua marcada.
4. **Given** o menu recolhido, **When** o vendedor recarrega a página no mesmo aparelho, **Then** o
   menu continua recolhido.
5. **Given** o mobile, **When** a tela renderiza, **Then** não existe rail nem botão "Recolher" — a
   barra inferior continua igual.

---

### User Story 6 - O mobile não se mexe (Priority: P1, invariante)

Nenhuma das cinco histórias acima pode alterar a experiência mobile. O design é declaradamente
desktop; o mobile de hoje foi homologado e permanece.

**Why this priority**: é a única história cuja falha é invisível para quem implementa e visível para
quem usa; e o projeto já pagou por regressão introduzida por correção (016/Polish).

**Independent Test**: percorrer as quatro telas a 390px e a 360px antes e depois do incremento e
comparar.

**Acceptance Scenarios**:

1. **Given** a viewport mobile, **When** qualquer uma das quatro telas renderiza, **Then** a
   composição é a mesma de antes deste incremento — uma coluna, barra inferior, barra fixa do kit no
   rodapé, tema no controle de hoje.
2. **Given** a viewport mobile a 360px, **When** as quatro telas renderizam, **Then** não há
   transbordo horizontal em nenhuma delas.

---

### Edge Cases

- **Catálogo sem nenhum item na seção** — a coluna da direita não pode mostrar a ficha de um item
  que não existe: mostra o vazio honesto da seção e o convite para criar o primeiro.
- **Item selecionado que deixa de existir** (excluído nesta sessão ou noutro aparelho): a seleção cai
  para um item válido, ou para o estado vazio; nunca para uma ficha órfã.
- **Troca de seção com um item selecionado** — a seleção não vaza entre seções (selecionar o 3º
  filamento e ir para Impressoras não pode abrir a 3ª impressora por acidente).
- **Orçamentos com lista paginada** — carregar mais registros não pode trocar o registro aberto.
- **Kit sem nenhuma peça válida** — o resumo declara o total zerado e quantas peças ficaram de fora,
  sem sugerir que o kit tem preço.
- **Largura intermediária (426–1279px)** — nem mobile nem o desktop largo do design: a composição de
  hoje (coluna única) continua valendo, sem mestre-detalhe espremido. Inclui o notebook de 1366px?
  **Não** — 1366 já está acima de 1280 e recebe o mestre-detalhe com a lista em uma coluna.
- **Menu recolhido + tela mestre-detalhe** — a largura extra vai para o conteúdo, e nenhuma das duas
  colunas pode ficar abaixo da sua largura mínima legível.
- **Rolagem independente** — a coluna fixa (ficha/resumo) não pode gerar uma segunda barra de
  rolagem nem cortar o próprio conteúdo quando ele é mais alto que a viewport.

---

## Requirements *(mandatory)*

### Requisitos gerais

- **FR-001**: O sistema MUST aplicar as composições deste incremento **somente** a partir da largura
  de desktop definida na seção Assumptions; abaixo dela a composição atual permanece byte-a-byte
  equivalente em comportamento.
- **FR-002**: O sistema MUST NOT introduzir primitiva nova de design system: toda a composição usa
  classes/componentes já existentes (fato verificado no Contexto).
- **FR-003**: O sistema MUST preservar, em todas as telas tocadas, os estados honestos já
  homologados: teaser único para grátis/deslogado, degradação de leitura offline, avisos de
  pendência e de item inválido.
- **FR-004**: O sistema MUST NOT alterar nenhum cálculo, fórmula, contrato de API ou payload —
  este incremento é de composição de interface.

### Catálogo

- **FR-010**: A tela MUST apresentar, no desktop, o título com a contagem da seção ativa, as quatro
  seções como controle segmentado e o botão de adicionar da seção ativa numa mesma faixa de cabeçalho.
- **FR-011**: A tela MUST apresentar, no desktop e para premium, uma lista de itens com campo de
  busca acima dela: **uma** coluna de 1280px até ~1600px, **duas** colunas acima disso — a lista
  nunca abaixo da largura em que o nome, o selo e o valor do item continuam legíveis numa linha.
- **FR-012**: A tela MUST manter uma ficha do item selecionado numa coluna à direita que acompanha a
  rolagem da lista.
- **FR-013**: Selecionar um item MUST trocar a ficha **sem navegação de rota** e MUST marcar
  visualmente o card selecionado.
- **FR-014**: A busca MUST filtrar a lista da seção ativa pelo que o vendedor digita.
- **FR-015**: A ficha MUST oferecer as ações do item que já existem hoje para aquela seção
  (editar/salvar, duplicar quando aplicável, excluir) e MUST manter a confirmação de exclusão que
  existe hoje.
- **FR-016**: Para **Filamentos e Impressoras**, a ficha MUST ser o editor: os campos do formulário
  de hoje aparecem editáveis na própria ficha, com a ação de salvar ali, e no desktop a gaveta deixa
  de ser usada para esse fim. Para **Produtos e Kits**, a ficha MUST ser um resumo com uma ação que
  abre o editor de página cheia que já existe — o formulário completo de produto MUST NOT ser
  recomposto dentro da ficha.
- **FR-016a**: Uma edição salva pela ficha MUST refletir imediatamente no card correspondente da
  lista, sem recarregar a tela; uma escrita que falha MUST manter os valores digitados e dizer o que
  houve, como já faz hoje.
- **FR-017**: Trocar de seção MUST reiniciar a seleção para o primeiro item daquela seção.
- **FR-018**: Seção vazia MUST mostrar o estado vazio da seção no lugar da lista **e** no lugar da
  ficha, sem ficha órfã.

### Orçamentos

- **FR-020**: A tela MUST apresentar, no desktop e para premium, filtros + lista à esquerda e o
  registro selecionado à direita, ambos visíveis ao mesmo tempo.
- **FR-021**: Selecionar um registro MUST trocar o painel da direita sem sair da tela e MUST marcar o
  card selecionado.
- **FR-022**: O painel da direita MUST entregar o mesmo conjunto de verdades da tela de detalhe
  atual: rótulo, data e hora, tipo, validade da proposta, valor cotado com a base, detalhamento de
  custos, preços por canal, ficha técnica (versão da fórmula e origem) e a declaração de que o
  registro é congelado.
- **FR-023**: As ações do registro (exportar, recalcular hoje, comparar com hoje, excluir, editar
  rótulo) MUST continuar disponíveis a partir do painel da direita, com as mesmas regras de gate de
  hoje.
- **FR-024**: A rota de detalhe existente MUST continuar funcionando para mobile e para deep link.
- **FR-025**: Carregar mais registros MUST NOT trocar o registro aberto.

### Kits

- **FR-030**: A tela MUST apresentar, no desktop, as peças à esquerda e o resumo do kit numa coluna à
  direita que acompanha a rolagem.
- **FR-031**: No desktop, o resumo fixo no rodapé MUST deixar de existir; no mobile ele MUST
  permanecer exatamente como hoje.
- **FR-032**: O resumo MUST conter custo total com a contagem de peças, preço de varejo em destaque,
  preço de atacado, preços por canal do kit, o campo de nome do kit e a ação de salvar.
- **FR-033**: O resumo MUST declarar quantas peças ficaram de fora do total quando houver peça
  inválida, e MUST NOT somar peça inválida.
- **FR-034**: Alterações de quantidade MUST refletir no resumo sem recarregar a tela.

### Conta

- **FR-040**: A tela MUST apresentar, no desktop, três colunas: identidade e plano; tema;
  privacidade e sair.
- **FR-041**: Para conta grátis, a oferta de assinatura MUST aparecer na coluna do plano, com os dois
  planos e seus preços.
- **FR-042**: O painel de plano MUST continuar recebendo o estado já resolvido do servidor, sem
  inferir estado de cobrança (invariante estrutural do 012/PR-B, SC-708).
- **FR-043**: No desktop, o tema MUST ser escolhido por um controle segmentado que **nomeia** as duas
  opções (Claro/Escuro) e marca a ativa; no mobile o controle atual MUST permanecer inalterado. Os
  dois MUST escrever na mesma preferência de tema.
- **FR-044**: A superfície de retorno do checkout MUST continuar tomando a página inteira.

### Menu (shell)

- **FR-050**: O menu lateral do desktop MUST oferecer uma ação de recolher/expandir no seu rodapé.
- **FR-051**: Recolhido, o menu MUST mostrar só ícones, centralizados, e MUST manter o nome de cada
  seção disponível como dica e como nome acessível.
- **FR-052**: O estado recolhido MUST persistir no aparelho entre visitas.
- **FR-053**: O estado do menu MUST NOT existir no mobile.
- **FR-054**: Recolher/expandir MUST NOT quebrar a navegação por teclado já existente no menu (a
  travessia por setas com um único ponto de tabulação).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Numa janela de 1920×1080, cada uma das quatro telas ocupa **pelo menos 85%** da largura
  útil de conteúdo (medida em caixas do DOM, não estimada) — hoje as telas ficam limitadas à coluna
  estreita que motivou o redesenho.
- **SC-002**: Em `/catalogo` e `/historico`, no desktop, o vendedor consegue conferir **três itens
  diferentes sem nenhuma navegação de rota** e sem que a lista saia da tela.
- **SC-003**: Nenhuma das quatro telas apresenta transbordo horizontal nem barra de rolagem
  inesperada — verificado nos **dois eixos** — em 1920px, 1600px, 1440px, 1280px, 1279px (a largura
  imediatamente abaixo do corte), 1024px, 390px e 360px.
- **SC-004**: Recolher o menu devolve pelo menos 160px de largura ao conteúdo, e o estado sobrevive a
  um recarregamento.
- **SC-005**: A composição mobile das quatro telas é indistinguível da atual, comparada
  screenshot a screenshot a 390px e 360px.
- **SC-006**: Para conta grátis/deslogada, cada uma das telas premium apresenta **exatamente um**
  convite ao Premium — nem zero, nem dois (invariante do 016/US1).
- **SC-007**: Nenhum valor calculado muda: os vetores canônicos de preço continuam entregando os
  mesmos números antes e depois do incremento.
- **SC-008**: A homologação visual do dono percorre as quatro telas em desktop e não encontra
  bloqueador de layout.

---

## Assumptions

- **Largura de corte** (decidida no clarify): as composições deste incremento ligam a partir de
  **1280px**; entre 426px e 1279px a composição atual permanece. A lista do Catálogo vira duas
  colunas só a partir de ~1600px. O desenho foi feito a 1920px e não fixa o ponto de corte — a
  medida que o fixou: a 1024px sobram ~700px de conteúdo, e uma ficha de 560px ao lado de uma lista
  de ~140px não é uma tela, é um acidente.
- **Persistência do menu recolhido**: por aparelho, como já se faz com o tema; não é preferência de
  conta e não viaja entre aparelhos.
- **Rotas de detalhe**: `?produto=` (catálogo) e `/historico/$id` continuam existindo — o
  mestre-detalhe é a composição do desktop, não a remoção das rotas. Mobile e deep link continuam
  chegando pelo caminho de hoje.
- **Conteúdo é o do 016**: rótulos, tooltips, textos honestos e preços do teaser vêm do que já está
  no produto; onde o arquivo de design mostra texto diferente do produto, **o produto manda** — a
  não ser que o dono decida o contrário no clarify.
- **Dados do design são fictícios**: os itens, registros e números do arquivo (PLA Prata, Cliente
  Ana, R$ 231,88…) são amostras de layout, não dados a semear.
- **Preços por canal do kit e conteúdo do detalhe do orçamento já existem** no produto (verificado no
  código antes de especificar) — este incremento os recompõe.
- **A aba Calcular está fora**: o arquivo implementado aponta a calculadora para outro arquivo de
  design ("Calcular Desktop"), que **não** faz parte deste incremento.

---

## Out of scope

- A tela **Calcular** (arquivo de design separado, não solicitado).
- Qualquer mudança de fórmula, catálogo de tarifas, contrato de API ou esquema de dados.
- Mudança de conteúdo/texto que não venha do design ou de decisão do dono no clarify.
- A parte **Mercado Livre** adiada no 016 (seletor de categoria vazio) — segue adiada com o token.
- Reabertura dos pontos da rodada 1 de homologação que não sejam de composição desktop.

---

## Dependências

- Design versionado: `specs/018-abas-desktop/design/Abas-Desktop.dc.html`.
- Invariantes herdados: 016/US1 (teaser único), 012/PR-B SC-708 (painel de plano não infere estado),
  009/ADR-0019 (registro congelado é imutável), 014/T118 (elemento fixado respeita a chrome do shell).
- Processo de homologação: `docs/homologacao/PROCESSO-HOMOLOGACAO.md` — o incremento só fecha com a
  segunda passada do dono.
