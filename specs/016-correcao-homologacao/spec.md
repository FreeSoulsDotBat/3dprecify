# Feature Specification: Correção da homologação humana + decisões de dados de marketplace

**Feature Branch**: `016-correcao-homologacao`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Correção da homologação humana + decisões de dados de marketplace: o
incremento 016 aplica as correções que o dono decidiu na homologação pessoal de 2026-08-05 (teasers
honestos unificados, rótulos, layout desktop, campos do formulário, remoção do Desperdício, custo de
máquina por pergunta de negócio, marketplace vira premium, campos dirigidos pelo marketplace) e as 7
decisões de dados tomadas em 2026-08-05 sobre Amazon/ML/Shopee."

**Fontes autoritativas** (decisões dadas — esta spec NÃO as reabre):
`docs/product/016-correcao-homologacao-scope-brief.md` (brief do product-owner — stories e fatiamento) ·
`docs/homologacao/PLANO-CORRECAO-HUMANA.md` (decisões da homologação) ·
`docs/homologacao/OBTENCAO-DINAMICA-DADOS.md` §"Decisões do dono — TOMADAS em 2026-08-05" (D7–D13) ·
`docs/homologacao/ESTRUTURA-DADOS-MARKETPLACES.md` (lacunas E1/E2/E3).

---

## Clarifications

### Session 2026-08-05

- Q: A US15 (custo fixo ML: logística × faixa × peso) entra no 016? → A: **Entra como schema
  honesto SEM números** — o schema completo entra agora com os fatos públicos oficiais (ME2
  Coleta/Agências/Full = R$ 0; ≥ R$ 79 = R$ 0 para todos), corrigindo o custo fixo cobrado
  indevidamente de vendedores ME2 hoje; combinações Flex/ME1 abaixo de R$ 79 resolvem para
  "sem referência — informe" até o token da casa entrar (US6-ML, fora deste incremento).
- Q: Como a tela trata o tipo de logística do ML? → A: **Comparação + escolha** (proposta do dono):
  o canal ML mostra o preço de cada GRUPO de logística (a logística só muda o custo fixo, então os
  grupos colapsam — ME2 completo · Flex/ME1 "sem referência" abaixo de R$ 79 · todas iguais acima),
  e o vendedor marca a que ele usa — essa vira o número do cartão final e o que a simulação salva.
  Nenhum default é assumido; a visão completa ensina o spread entre logísticas.
- Q: Perfil CPF/CNPJ da Shopee vira pergunta? O +R$ 3/item entra? → A: **Perfil + volume; o R$ 3
  entra.** Duas perguntas visíveis só no canal Shopee (campos dirigidos): "CPF ou CNPJ?" e, se CPF,
  "mais de 450 pedidos nos últimos 90 dias?". O +R$ 3,00/item soma ao cálculo quando se aplica
  (CPF + volume, fonte oficial art. 26839); o aviso da US17 usa o perfil como gatilho.
- Q: Shopee < R$ 8 (CNPJ, adicional = metade do preço): modelar, avisar ou ficar fora? → A:
  **Modelar agora.** A regra é oficial, publicada e determinística — entra no cálculo (adicional =
  preço/2 abaixo de R$ 8 para CNPJ; a faixa "20% + R$ 4" passa a valer a partir de R$ 8). Abre a
  lacuna E2 pelo caso mínimo; escalação opus. Vira a US18.
- Q: Volumoso Shopee — os R$ 50 são por PEDIDO e precificamos por UNIDADE; como entram? → A:
  **Somar inteiro + legenda.** Os R$ 50,00 somam à unidade com a legenda dizendo que a taxa é por
  pedido. Nunca subestima; zero campo novo; o multi-item superestima e isso fica dito. Promover
  para rateio depois, se os usuários de peça grande pedirem, é pequeno e reversível.
- Q: De onde vem o PESO do custo fixo ML? → A: **Derivado das gramas usadas, com ajuste.** O peso
  default é o que o formulário já sabe (gramas da peça); um campo opcional "peso com embalagem"
  ajusta; um aviso curto diz que o ML pode cobrar pelo peso cubado (dimensões/cubagem ficam para o
  frete, lacuna E3). Zero campo obrigatório novo.
- Q: O selo "sem referência — informe as taxas" fica, muda ou sai? → A: **Fica, com texto
  reescrito para leigo**: *"Sem taxa de referência para esta combinação — informe as taxas do seu
  anúncio"*, com `?` explicando por que o número não existe no catálogo (a fonte oficial não
  publica) e onde o vendedor encontra o dele (central de vendas do marketplace).
- Q: Como comunicamos que os preços exibidos mudam? → A: **Só nos documentos, sem banner.** O
  recálculo de documento antigo declara o descarte e explica a divergência (US10-AC3/AC4); os
  rótulos de versão congelados dizem qual modelo/tabela precificou cada registro. Não há usuário em
  produção pré-v1 para ler um banner, e a v1 nasce no modelo novo. Se uma mudança estrutural futura
  acontecer COM usuários em produção, o aviso de versão será decidido naquele momento, sobre o
  mecanismo de divergência já pronto.
- **REVERSÃO (mesma data, pós-arquiteto)** — Q: o arquiteto verificou que o catálogo ML está
  **VAZIO** (zero entradas no servido e no seed): a premissa da Q2 ("corrige o custo fixo cobrado
  indevidamente de ME2 hoje") era FALSA — ninguém é cobrado de nada — e o "seletor de categoria
  vazio" da homologação é sintoma disso; a categoria funcional exige o token (US6-ML, fora de
  escopo). O que o canal ML mostra em 016? → A: **ADIAR A PARTE ML TODA.** A US15 sai do
  incremento e volta junto com o token (US6-ML/017); o canal ML permanece como está, com o defeito
  do seletor vazio documentado como conhecido e adiado. As decisões Q4 (comparação por logística +
  escolha) e Q3 (peso das gramas + ajuste) **permanecem válidas como desenho** para quando o ML
  voltar — não são reabertas, só adiadas com a story. O ADR-0025 fica Proposed para esse momento.

---

## Verificação inicial V0 *(pré-condição — NÃO é user story)*

**Medição do Grupo 0 (itens 15–19 do relatório do dono): logado sem premium.** O sintoma relatado —
Catálogo, Kits, Orçamentos e Simulações exibindo *"Não foi possível carregar…"* em vermelho no lugar do
teaser — tem hipótese concorrente forte: os prints são anteriores ao conserto do backend (PR #42),
quando toda rota de banco devolvia 500, e um 500 cai legitimamente no ramo de erro genérico. O cliente
já trata `ENTITLEMENT_REQUIRED` com ramo próprio.

**Aceitação da verificação**: com o backend correto e conta logada **sem** premium, as cinco telas são
abertas e o resultado registrado com evidência (screenshot + resposta HTTP observada).
- Teaser aparece → **não há defeito**; V0 fecha como nota no `dod-evidence.md` (US1 cobre o conteúdo).
- Erro persiste → é o achado mais grave da lista; vira a **primeira** fatia e reordena o plano.

**Nenhuma tarefa de conserto do Grupo 0 é planejada antes desta medição.**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O teaser honesto é UM só, nas cinco telas (Priority: P1)

Como visitante ou usuário grátis, quero entender numa olhada o que cada feature premium faz e como
assinar, sem ler explicação de como o Premium funciona — e ver o MESMO padrão em todas as telas.

**Why this priority**: é a maior clareza pelo menor custo; cinco telas hoje mostram cinco variações do
mesmo recado, e a divergência é o defeito. Fecha de brinde o achado `[F11b-007]` da auditoria (cortesia
sem caminho de assinatura).

**Independent Test**: abrir as cinco telas como usuário grátis e comparar a estrutura renderizada; a
homologação é visual (screenshot) + estrutural (mesmo componente).

**Acceptance Scenarios**:

1. **Given** usuário grátis, **When** abre Simulações, "Usar do catálogo", Catálogo, Kits ou
   Orçamentos, **Then** vê a mesma estrutura — título da página · título + subtítulo da feature ·
   botão "Assinar Premium" · legenda pequena — e nada mais.
2. **Given** as cinco telas de hoje, **When** o padrão entra, **Then** somem especificamente: o
   subtítulo duplicado, o bloco "No Premium…" e a linha de preço de Simulações; o modal "Cenários
   fazem parte do Premium"; "Salvar faz parte do Premium." do "Usar do catálogo"; "+ Adicionar
   filamento" do Catálogo; os botões "Entrar"/"Entendi" de Kits; "Entrar"/"Ir para a calculadora" de
   Orçamentos.
3. **Given** o "Usar do catálogo" no grátis, **When** renderiza, **Then** o botão fica **desabilitado
   e visível** (não escondido) e a explicação do que é o catálogo ocupa o lugar do texto removido.
4. **Given** qualquer teaser, **When** renderiza, **Then** oferece um caminho de assinatura e NÃO
   explica a mecânica do Premium (isso é da tela de compra).
5. **Given** Simulações no grátis, **When** renderiza, **Then** o subtítulo é o texto aprovado pelo
   dono: *"Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando
   quiser — sempre com os preços de hoje."*

---

### User Story 2 - Histórico vira Orçamentos, Cenários vira Simulações (Priority: P1)

Como vendedor, quero dois nomes que digam o que cada coisa é — hoje "Histórico" e "Cenários" não
comunicam a diferença (congelado × recalculado hoje).

**Why this priority**: é a causa raiz da confusão que levou o dono a propor remover o Histórico; o
par de nomes novo elimina a ambiguidade sem remover capacidade.

**Independent Test**: varredura de superfícies visíveis (navegação, títulos, botões, toasts, vazios,
teasers, PDF/CSV exportados) sem NENHUMA ocorrência do par antigo; rotas e payloads intactos.

**Acceptance Scenarios**:

1. **Given** qualquer superfície visível ao usuário (incluindo artefatos exportados PDF/CSV),
   **When** renderizada após a mudança, **Then** exibe "Orçamentos"/"Simulações" e nenhuma ocorrência
   de "Histórico"/"Cenários" resta.
2. **Given** a rota `/historico` e os payloads persistidos, **When** a mudança entra, **Then** nada
   neles muda — a troca é SÓ de rótulo, via chaves de tradução (não hard-coded). *(Correção V0
   2026-08-05: `/cenarios` nunca existiu como rota — Simulações é o painel "Meus cenários" dentro
   de `/calcular`.)*
3. **Given** as duas telas, **When** o usuário as lê, **Then** o texto de cada uma diz o que a
   diferencia da outra (congelado × recalculado hoje); o Histórico NÃO é removido.

---

### User Story 3 - Header com a logo inteira e a sidebar na frente (Priority: P2)

**Why this priority**: identidade visual pedida pelo dono (PNGs fornecidos) + preparação estrutural
para a sidebar colapsável (que NÃO entra).

**Independent Test**: visual por tema (claro/escuro) + navegação por teclado e leitor de tela sem
regressão.

**Acceptance Scenarios**:

1. **Given** os dois PNGs fornecidos pelo dono, **When** o header renderiza em cada tema, **Then** a
   logo completa substitui o texto, com a variante certa por tema.
2. **Given** a nova estrutura, **When** a página renderiza, **Then** a sidebar fica à frente do
   header (preparação para colapso futuro) e foco/tab-order/leitura por leitor de tela não regridem.

---

### User Story 4 - O desktop deixa de ter buracos, e o preço final deixa de rolar (Priority: P2)

**Why this priority**: a auditoria mediu 37% de largura útil a 1440px (`[F11a-005]`); o scroll dos
cartões de preço (item 9 do relatório) é consequência da largura — o conserto certo resolve os dois.

**Independent Test**: medição geométrica a 1440px, 390px e 360px — largura útil, ausência de scroll
interno nos cartões, número nunca quebrado no meio nem transbordando.

**Acceptance Scenarios**:

1. **Given** viewport ≥ breakpoint desktop, **When** a calculadora renderiza, **Then** as seções se
   distribuem em colunas, com título + subtítulo no topo e o total centralizado ao final; a largura
   útil a 1440px sobe do patamar medido (37%) para **≥ 60%**.
2. **Given** o ganho de largura, **When** os cartões de preço final renderizam, **Then** o scroll
   interno desaparece **por consequência da largura, não por remoção da guarda** — o número nunca
   quebra no meio nem transborda, e isso é asseverado por **geometria** (a guarda `[F11a-002]` fica).
3. **Given** viewport 360px e 390px, **When** a calculadora renderiza com valores adversariais
   (ex.: R$ 95.057), **Then** nada regride — sem scroll interno, sem quebra, sem transbordo.
4. **Given** os cartões de preço, **When** renderizam, **Then** os textos ficam centralizados.

---

### User Story 5 - "Preços por canal" some dentro de "Como chegamos no preço" (Priority: P2)

**Independent Test**: uma única seção descreve os preços, sem linha duplicada nem informação perdida;
ordem de leitura determinística.

**Acceptance Scenarios**:

1. **Given** a calculadora com canais ativos, **When** renderiza, **Then** os descritivos de preço
   vivem num único lugar ("Como chegamos no preço"), sem duplicar linha nem perder informação.
2. **Given** as linhas de Material e Energia, **When** renderizam, **Then** os marcadores laranja e
   roxo foram removidos.

---

### User Story 6 - Onze campos passam a se explicar sozinhos (Priority: P2)

Como vendedor leigo, quero saber por que o campo está na conta E como descobrir o valor dele na minha
máquina, sem sair do app.

Campos: Consumo médio · Tarifa de energia · Vida útil da máquina · Reserva de manutenção · Taxa de
falha · Tempo de acabamento · Valor do acabamento · Mão de obra (horas) · Valor da hora (+ os que a
US8 introduzir).

**Why this priority**: foi a queixa central do dono sobre o formulário — números que o vendedor não
sabe onde achar.

**Independent Test**: cada um dos 11 campos tem tooltip acessível que responde as duas perguntas, em
linguagem leiga, com procedência registrada no material de apoio.

**Acceptance Scenarios**:

1. **Given** qualquer um dos 11 campos, **When** o usuário aciona o `?` ao lado do rótulo (hover,
   teclado OU toque — mobile não tem hover), **Then** vê uma explicação que responde: *por que este
   número entra na conta* e *como você descobre o seu*.
2. **Given** o conteúdo das explicações, **When** revisado, **Then** é pt-BR de público leigo, sem
   jargão de engenharia, pesquisado em fonte externa (autorizado pelo dono) com procedência
   registrada no material de apoio; nenhum número vira recomendação sem fonte.
3. **Given** os tooltips, **When** usados, **Then** nenhum altera cálculo, validação ou
   obrigatoriedade de campo.

---

### User Story 7 - Tempo de impressão em horas E minutos (Priority: P2)

**Independent Test**: entrada em dois campos (h + min) → motor recebe um decimal inalterado; um
documento salvo com `5.5` reabre exibindo `5h 30min`.

**Acceptance Scenarios**:

1. **Given** o formulário, **When** o vendedor informa 5h e 30min, **Then** o motor recebe `5.5` e o
   resultado é idêntico ao de hoje com `5,5` — a conversão vive na borda; a fórmula não muda.
2. **Given** uma simulação salva ou orçamento congelado com `5.5`, **When** reabre, **Then** a tela
   exibe `5h 30min`.
3. **Given** entradas de borda (0; minutos ≥ 60; decimal herdado tipo `5.33`), **When** convertidas,
   **Then** o comportamento é determinístico, sem número quebrado (regra de arredondamento declarada).

---

### User Story 8 - Custo de máquina: trocar a pergunta, não a fórmula (Priority: P2)

Como vendedor, não sei a "vida útil da máquina em horas" — ninguém publica isso — mas sei quanto
paguei na impressora e com que frequência ela roda.

**Why this priority**: a máquina é 35% do custo no vetor canônico; o campo fica, a PERGUNTA muda
(decisão D3 — o dono recusou o campo pulável: pulável não é compreensível).

**Independent Test**: as três perguntas novas derivam `machineLifetimeHours` na tela; o motor recebe
os mesmos dois campos de sempre; sem bump, sem migração.

**Acceptance Scenarios**:

1. **Given** o formulário novo, **When** o vendedor responde *quanto custou* (digita), *com que
   frequência roda* (3 opções, sem digitar) e *em quantos anos quer que se pague* (decide), **Then**
   a tela deriva as horas e o motor continua recebendo `machineValue` + `machineLifetimeHours` —
   **a fórmula não muda**.
2. **Given** os três ritmos aprovados pelo dono, **When** selecionados com payback de 3 anos e
   máquina de R$ 4.000, **Then** derivam ≈ 780 h (*poucas horas por semana*) · ≈ 3.600 h (*quase
   todo dia*) · ≈ 9.900 h (*praticamente o dia todo*), e a tela **diz o derivado em voz alta**
   (ex.: *"≈ R$ 1,11 por hora de impressão"*).
3. **Given** quem prefere digitar, **When** aciona "ajustar", **Then** informa as horas direto.
4. **Given** um documento salvo com `machineLifetimeHours` fora dos três ritmos, **When** reabre,
   **Then** entra no modo "ajustar" com o número dele intacto.

---

### User Story 9 - Máscara monetária e seções que fazem sentido juntas (Priority: P2)

**Independent Test**: reorganização pura — igualdade numérica antes/depois para o mesmo vetor.

**Acceptance Scenarios**:

1. **Given** o campo "Valor da máquina", **When** o vendedor digita, **Then** vê formatação monetária
   (milhar pontuado) — o modo `currency` já existente do campo numérico.
2. **Given** as seções atuais, **When** a reorganização entra, **Then** "Ajustes opcionais" funde em
   "Custos da peça" e "Tempo/Valor do acabamento" migram para "Mão de obra e custos"; nenhuma mudança
   de modelo, validação ou resultado (provada por igualdade numérica).

---

### User Story 10 - O campo "Desperdício" morre, e os documentos antigos continuam abrindo (Priority: P3)

> **⚠ Escalação opus obrigatória (ADR-0022)** — altera a superfície do motor de preço.

Decisão dada (D2, opção A): remoção completa. Escopo medido: `filaments.default_waste_grams` ·
`products.waste_grams` (NOT NULL) · `bom_lines.waste_grams` · payload congelado dos orçamentos ·
config das simulações · 54 ocorrências no código.

**Why this priority**: decisão do dono ("essa redundância não é aceitável"), risco mais alto do
incremento — bump MAJOR + migração + regra de leitura.

**Independent Test**: fatia isolada (PR própria); motor rejeita `wasteGrams`; todo documento salvo de
qualquer versão abre sem quebrar.

**Acceptance Scenarios**:

1. **Given** a remoção, **When** o motor recebe `wasteGrams`, **Then** **rejeita** (não ignora em
   silêncio); o campo some da tela, do catálogo (filamentos/produtos), das linhas de BOM e da entrada
   do motor; `PRICING_MODEL_VERSION` recebe bump **MAJOR**.
2. **Given** um orçamento congelado anterior à mudança, **When** aberto/exportado, **Then** exibe
   exatamente o que foi cotado, `wasteGrams` incluído — a imutabilidade não é tocada.
3. **Given** "Recalcular hoje" ou reabrir uma simulação salva com `wasteGrams`, **When** recomputa,
   **Then** a entrada é mapeada para o modelo novo **descartando** `wasteGrams` e **a tela diz que
   descartou** — o usuário não descobre a diferença sozinho.
4. **Given** o preço recalculado de um documento antigo, **When** difere do congelado por este motivo
   novo (estrutural, não churn de catálogo), **Then** a diferença é explicada onde aparece.
5. **Given** a ambiguidade que motivou a remoção, **When** o material de apoio de "Taxa de falha" e
   das gramas for lido, **Then** ele diz o que cada um cobre e o que não cobre (purga/suporte/brim
   entram nas GRAMAS usadas; falha é a impressão inteira perdida) — a ambiguidade não volta por
   omissão.

---

### User Story 11 - Marketplace vira Premium, e a promessa é reescrita na mesma entrega (Priority: P3)

Decisão dada (D1). Sem a promessa reescrita e as Clarifications, a mudança seria uma contradição
silenciosa — a classe `[F02-000]` que a auditoria passou 16 fases medindo. **Os três itens são UMA
entrega.**

**Independent Test**: usuário grátis não obtém cálculo de canal por nenhum caminho; promessa nova na
primeira dobra; Clarifications datadas nas DUAS specs onde a promessa antiga vive.

**Acceptance Scenarios**:

1. **Given** usuário grátis, **When** vê a seção de marketplace, **Then** o switch está
   **desabilitado e falso**, com botão de assinar logo abaixo — visível, nunca escondido; sem cálculo
   de canal, sem número parcial, sem fake.
2. **Given** a primeira dobra, **When** renderiza, **Then** a promessa foi reescrita para a verdade
   nova — o que continua grátis fica dito com precisão: custo e markup, sem canal de venda.
3. **Given** o registro histórico, **When** a fatia entra, **Then** a virada está como Clarification
   datada **nas specs 005 E 007** (SC-109 mora na 005; FR-313/SC-310 na 007) — na MESMA fatia do
   código, nunca antes nem depois.

---

### User Story 12 - Os campos da seção de canal são dirigidos pelo marketplace (Priority: P3)

Como vendedor, não quero ver "Taxa fixa" num marketplace que não cobra taxa fixa, nem um seletor de
categoria vazio.

**Why this priority**: o catálogo já modela os eixos por marketplace; a tela é que renderiza uma
grade fixa de 4 campos para todos — nenhum dado novo é exigido.

**Independent Test**: por marketplace, a seção exibe exatamente os eixos que o marketplace tem;
para combinações já suportadas, resultado byte-idêntico ao de hoje.

**Acceptance Scenarios**:

1. **Given** um marketplace escolhido, **When** a seção de canal renderiza, **Then** os campos são
   dirigidos pelo schema de determinantes daquele marketplace: campo que ele não tem **não aparece**;
   a categoria é só mais um eixo.
2. **Given** os casos concretos medidos, **When** cada canal renderiza, **Then**: **Shopee** — sem
   seletor de categoria (não varia por categoria); **Amazon** — lista plana de 38 categorias (não
   árvore); **Mercado Livre** — permanece como está neste incremento (catálogo ML vazio; o defeito
   do seletor vazio está documentado e adiado com a US15 — ausência de eixos declarados renderiza o
   comportamento de hoje).
3. **Given** a página da calculadora, **When** renderiza, **Then** a seção de canal fica **depois de
   "Markup" e antes de "Como chegamos no preço"**, e "frete até a transportadora" saiu dos exemplos
   de "Outros custos" (o campo Frete já existe na seção do canal — citar nos dois convida contagem
   dupla).
4. **Given** uma combinação já suportada hoje, **When** recalculada após a mudança, **Then** o
   resultado é **byte-idêntico** — regressão zero no cálculo.

---

### User Story 13 - Achar a categoria por busca E por lista com subitens (Priority: P3)

**Independent Test**: navegação hierárquica + busca; os dois defeitos achados na homologação do 014
não regridem — asserção **geométrica** + screenshot (texto extraído é cego para ambos).

**Acceptance Scenarios**:

1. **Given** o seletor de categoria, **When** aberto, **Then** o usuário navega a hierarquia
   visualmente (lista com subitens) além de buscar por texto; existe estado honesto de "não
   informada".
2. **Given** uma busca com resultados, **When** a lista renderiza, **Then** ela NÃO parece um segundo
   campo preenchido (defeito do 014) — asseverado por geometria + screenshot.
3. **Given** uma busca que corresponde a N categorias, **When** o contador renderiza, **Then** diz
   exatamente N (o 014 registrou "8 encontrados" com 31 correspondências).

---

### User Story 14 - O plano Individual da Amazon passa a custar os R$ 2,00/item que custa (Priority: P3)

> **⚠ Escalação opus obrigatória (ADR-0022)** — leaf de dinheiro no catálogo de tarifas.

**Independent Test**: entradas `plan = INDIVIDUAL` somam R$ 2,00/item; versão do catálogo bumpa;
Profissional intocado.

**Acceptance Scenarios**:

1. **Given** o catálogo servido, **When** a mudança entra, **Then** as entradas `plan = INDIVIDUAL`
   passam de taxa fixa 0 para **R$ 2,00** (tarifa oficial por item, MEDIDA, estável desde ≥ dez/2020)
   e `catalogVersion` **bumpa** (o rótulo é congelado em snapshot imutável e precisa continuar
   respondendo qual tabela precificou o registro).
2. **Given** as decisões D7 e a lacuna E1, **When** a mudança entra, **Then** `minPerItem` continua
   R$ 1,00 uniforme (D7 não é reaberto) e o plano Profissional (R$ 19/mês) fica FORA — é custo mensal
   do vendedor, não custo por item.
3. **Given** um usuário no plano Individual, **When** recalcula, **Then** o preço exibido SOBE — é
   consequência aceita; a comunicação vive nos documentos (clarify Q7): a divergência de um
   documento antigo é explicada onde aparece, sem banner.

---

### User Story 15 - O custo fixo do Mercado Livre vira logística × faixa de preço × peso — **ADIADA, FORA DO 016**

> **⚠ ADIADA (dono, 2026-08-05, pós-arquiteto)**: o catálogo ML está VAZIO (verificado no servido
> e no seed) — a story volta junto com o token da casa (US6-ML/017). O texto fica como registro do
> desenho decidido (D10 + clarify Q2/Q3/Q4, que permanecem válidos); **nenhuma tarefa do 016 nasce
> daqui**. ADR-0025 fica Proposed para esse momento.

Decisão dada (D10): estender o schema completo, eixo próprio, SEPARADO do frete.

**Independent Test**: a resolução do custo fixo ML respeita as três dimensões; nenhuma combinação sem
valor público exibe número — resolve para "sem referência — informe".

**Acceptance Scenarios**:

1. **Given** o modelo pós-reforma de 02/03/2026 (confirmado em doc oficial), **When** o custo fixo ML
   resolve, **Then** depende de **tipo de logística** (Flex/`self_service`, ME1, `custom`,
   `not_specified` pagam; ME2 Coleta/Agências/Full NÃO pagam), **faixa de preço** (limiar R$ 79 —
   acima, ninguém paga) e **peso**; NÃO varia por categoria.
2. **Given** o canal ML na tela, **When** renderiza, **Then** exibe o preço por GRUPO de logística
   (comparação — os grupos colapsam onde o valor é igual) e o vendedor **marca a que ele usa**, que
   vira o número do cartão final e o que a simulação salva; nenhum default é assumido (clarify Q4).
3. **Given** uma combinação cujo valor a fonte oficial não publica, **When** resolve, **Then** exibe
   **"sem referência — informe"** com campo manual — NUNCA um número de blog (REPORTADO não sobe a
   fato); a regra dos 50% abaixo de R$ 12,50 não é gravada como número sem prova autenticada; o piso
   de comissão permanece "não determinado".
4. **Given** o eixo de peso, **When** o canal ML precisa dele, **Then** o peso default deriva das
   gramas usadas que o formulário já tem, com campo opcional "peso com embalagem" para ajustar e
   aviso de que o ML pode cobrar pelo peso cubado (clarify Q3) — zero campo obrigatório novo.
5. **Given** as tabelas de frete medidas (3 × 29 × 8), **When** esta story entra, **Then** elas NÃO
   entram aqui — são insumo da lacuna E3 (frete real), fora de escopo.

---

### User Story 16 - Item volumoso na Shopee (Priority: P3)

> **⚠ Escalação opus obrigatória (ADR-0022)** — toca o payload de cálculo/cenário.

Decisão dada (D13): campo opcional que soma no cálculo (não aviso).

**Independent Test**: campo desmarcado → resultado byte-idêntico ao de hoje; marcado → soma R$ 50,00.

**Acceptance Scenarios**:

1. **Given** o canal Shopee, **When** o vendedor marca "Item volumoso", **Then** o cálculo soma
   **R$ 50,00 inteiros à unidade**, com legenda dizendo que a taxa é **por pedido** (clarify Q5 —
   multi-item superestima e isso fica dito); o campo diz de onde vem o valor (art. 3305) e desde
   quando vale (02/02/2026).
2. **Given** o campo desmarcado (ou uma simulação salva anterior ao campo), **When** recalcula,
   **Then** o resultado é **byte-idêntico** ao de hoje (ausência = falso).
3. **Given** o ajuste de frete aferido (art. 4478), **When** esta story entra, **Then** ele NÃO vira
   campo — é incalculável por natureza (recálculo caso a caso) e fica como aviso (US17).

---

### User Story 17 - Onde a Shopee não publica a regra, a calculadora diz isso (Priority: P3)

**Independent Test**: canal Shopee CPF com preço < R$ 12 exibe o aviso com os dois pontos oficiais;
nenhuma fórmula não publicada é aplicada em lugar nenhum.

**Acceptance Scenarios**:

1. **Given** canal Shopee de perfil **CPF** (perguntado na tela — clarify Q6) com preço abaixo de R$ 12, **When**
   renderiza, **Then** a tela avisa que a taxa regressiva **não é publicada pela Shopee** e mostra os
   dois pontos oficiais — R$ 10 → R$ 6,50 e R$ 8 → R$ 6,00 (verbatim, art. 26839) — com o contexto em
   que valem (CPF acima de 450 pedidos/90 dias).
2. **Given** a hipótese linear (R$ 4 + 0,25 × preço), **When** qualquer cálculo roda, **Then** ela
   NÃO é aplicada em lugar nenhum — é colinear com os dois pontos, mas não é fato.
3. **Given** o aviso do ajuste de frete aferido, **When** exibido, **Then** é informativo: não
   bloqueia o cálculo, não fabrica número e não some quando o campo é editado.

---

### User Story 18 - Item barato CNPJ na Shopee: a regra publicada entra na conta (Priority: P3)

> **⚠ Escalação opus obrigatória (ADR-0022)** — regra de preço no domínio de pricing.
> **Nasceu no clarify (Q8, 2026-08-05)** — diferente da regressiva CPF (US17, não publicada), esta
> regra É oficial e determinística; hoje superestimamos o item barato CNPJ.

**Independent Test**: canal Shopee CNPJ com preço < R$ 8 → adicional = metade do preço; ≥ R$ 8 →
byte-idêntico ao de hoje.

**Acceptance Scenarios**:

1. **Given** canal Shopee, perfil CNPJ (perguntado — Q6) e preço abaixo de R$ 8, **When** calcula,
   **Then** o adicional fixo é **metade do preço do produto** (regra oficial, art. 26839) em vez de
   R$ 4; a faixa "20% + R$ 4" passa a valer a partir de R$ 8.
2. **Given** preço ≥ R$ 8 (qualquer perfil), **When** calcula, **Then** o resultado é byte-idêntico
   ao de hoje.
3. **Given** perfil CPF, **When** o preço está abaixo de R$ 12, **Then** esta regra NÃO se aplica —
   a regressiva CPF permanece aviso honesto (US17), porque a fórmula dela não é publicada.

---

### Edge Cases

- Documento salvo com `machineLifetimeHours` fora dos três ritmos → reabre no modo "ajustar" com o
  número intacto (US8-AC4).
- Minutos ≥ 60 digitados no campo de minutos; horas decimais herdadas (`5.33`) → conversão
  determinística com regra de arredondamento declarada (US7-AC3).
- Orçamento congelado antigo exportado em PDF continua imprimindo a linha de desperdício que a tela
  não tem mais → a legenda do documento antigo explica (US10-AC2/AC4, risco R3 do brief).
- Simulação salva com `wasteGrams` reaberta → recomputa descartando e DIZ que descartou (US10-AC3).
- Simulação salva ANTES do campo volumoso existir → ausência = falso, byte-idêntico (US16-AC2).
- Faixa de preço com `fixedFee` nulo → "sem referência — informe", nunca R$ 0,00 sob selo (FR-928).
- Busca de categoria com 31 correspondências → contador diz 31 (US13-AC3).
- Usuário grátis chega por deep-link a um estado com canal ativo → o switch está desabilitado/falso e
  nenhum número de canal aparece (US11-AC1).
- Preço adversarial (R$ 95.057) a 360px/390px/1440px → sem scroll, sem quebra, sem transbordo,
  medido por geometria (US4-AC3).
- Tema claro: logo, teasers e avisos novos têm variante legível nos dois temas (US3-AC1; matriz de
  homologação nas Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

**Teasers e rótulos**

- **FR-901**: O sistema MUST renderizar, para usuário não-entitulado, um único padrão de teaser nas
  cinco superfícies premium (Simulações, Usar do catálogo, Catálogo, Kits, Orçamentos): título da
  página · título + subtítulo da feature · botão "Assinar Premium" · legenda pequena — e nada mais.
- **FR-902**: O teaser MUST oferecer caminho de assinatura e MUST NOT explicar a mecânica do Premium.
- **FR-903**: Os elementos divergentes listados em US1-AC2 MUST ser removidos, incluindo o modal
  "Cenários fazem parte do Premium".
- **FR-904**: Todas as superfícies visíveis (incl. PDF/CSV exportados) MUST usar os rótulos
  "Orçamentos" e "Simulações" via chaves de tradução; rotas (`/historico` — a única do par que
  existe; correção V0), chaves de API e payloads persistidos MUST NOT mudar; o Histórico MUST NOT
  ser removido.

**Layout**

- **FR-905**: O header MUST exibir a logo completa com variante por tema; a sidebar MUST ficar à
  frente do header sem regressão de acessibilidade (foco, teclado, leitor de tela).
- **FR-906**: Acima do breakpoint desktop, a calculadora MUST distribuir as seções em colunas com o
  total centralizado ao final; os cartões de preço MUST NOT ter scroll interno nem número
  quebrado/transbordando em 360/390/1440px — asseverado por geometria.
- **FR-907**: Os descritivos de preço MUST viver numa única seção ("Como chegamos no preço"), sem
  perda de informação; os marcadores coloridos de Material/Energia MUST ser removidos.

**Campos do formulário**

- **FR-908**: Os 11 campos listados na US6 MUST ter explicação acessível (hover + teclado + toque)
  respondendo por que o número entra na conta e como o vendedor o descobre; conteúdo pt-BR leigo com
  procedência registrada; sem alterar cálculo/validação.
- **FR-909**: O tempo de impressão MUST ser informado em horas e minutos, convertido na borda para o
  decimal que o motor já recebe; documentos salvos reabrem exibindo h+min; conversão determinística.
- **FR-910**: O custo de máquina MUST ser perguntado como: valor pago · ritmo de uso (3 opções:
  ≈ 780 h / ≈ 3.600 h / ≈ 9.900 h ao ano-base) · payback em anos; a tela MUST exibir o custo/hora
  derivado e oferecer "ajustar" (digitar horas direto); o motor MUST continuar recebendo
  `machineValue` + `machineLifetimeHours` inalterados — sem bump, sem migração.
- **FR-911**: "Valor da máquina" MUST usar formatação monetária; as fusões de seção da US9 MUST
  preservar igualdade numérica de resultados.

**Remoção do Desperdício**

- **FR-912**: O campo Desperdício MUST ser removido de tela, catálogo, linhas de BOM e entrada do
  motor; o motor MUST rejeitar `wasteGrams` (não ignorar); `PRICING_MODEL_VERSION` MUST receber bump
  MAJOR.
- **FR-913**: Documentos salvos MUST continuar abrindo em qualquer versão: orçamentos congelados
  exibem/exportam o que foi cotado (imutabilidade intocada); recomputações (Recalcular hoje, reabrir
  simulação) MUST descartar `wasteGrams` declarando o descarte ao usuário e explicando a divergência
  de preço onde ela aparece.
- **FR-914**: O material de apoio de "Taxa de falha" e das gramas MUST passar a dizer o que cada um
  cobre (purga/suporte/brim entram nas gramas usadas; falha é a impressão inteira perdida).

**Marketplace Premium e campos dirigidos**

- **FR-915**: Para usuário não-entitulado, o cálculo de canal de venda MUST ser indisponível: switch
  desabilitado e falso com caminho de assinatura visível; nenhum número de canal, parcial ou fake.
- **FR-916**: A promessa da primeira dobra MUST ser reescrita para declarar com precisão o que é
  grátis (custo e markup, sem canal de venda), na MESMA fatia da virada.
- **FR-917**: A virada MUST entrar como Clarification datada nas specs 005 (SC-109) e 007
  (FR-313/SC-310), na mesma fatia.
- **FR-918**: A seção de canal MUST ser dirigida pelo schema de determinantes do marketplace: campo
  inexistente não aparece; Shopee sem seletor de categoria; Amazon com lista plana de 38; ML com taxa
  fixa e categoria funcional; posição da seção depois de "Markup" e antes de "Como chegamos no
  preço"; "frete até a transportadora" sai dos exemplos de "Outros custos".
- **FR-919**: Para combinações já suportadas hoje, o resultado do cálculo MUST ser byte-idêntico
  após a mudança (exceto onde este incremento muda o dado: US14/US16).
- **FR-920**: O seletor de categoria MUST permitir navegação hierárquica além de busca; a lista de
  resultados MUST NOT parecer campo preenchido; o contador MUST dizer o número real de
  correspondências; estado "não informada" honesto.

**Dados e avisos de marketplace**

- **FR-921**: As entradas Amazon `plan = INDIVIDUAL` MUST somar R$ 2,00/item (taxa fixa);
  `catalogVersion` MUST ser bumpado; `minPerItem` permanece R$ 1,00 uniforme; plano Profissional fora.
- **FR-922** *(ADIADO com a US15 — dono, 2026-08-05)*: o custo fixo ML por logística × faixa ×
  peso sai do 016 e volta com o token (US6-ML/017). Permanece válido como desenho: fatos oficiais
  como valor, "sem referência — informe" onde não há valor público, nenhum REPORTADO sobe a fato.
- **FR-923**: O canal Shopee MUST ter o campo opcional "Item volumoso" que soma R$ 50,00 inteiros à
  unidade quando marcado, com legenda declarando que a taxa é por pedido (clarify Q5);
  ausência/desmarcado = resultado byte-idêntico.
- **FR-924**: Canal Shopee CPF com preço < R$ 12 MUST exibir o aviso da taxa regressiva não publicada
  com os dois pontos oficiais e seu contexto; a hipótese linear MUST NOT ser aplicada; o aviso do
  ajuste de frete aferido MUST ser informativo, sem tocar o cálculo.
- **FR-925**: Nenhum número de tarifa MUST aparecer sob selo de referência sem fonte oficial datada
  (Constituição II).
- **FR-926** *(clarify Q6)*: O canal Shopee MUST perguntar o perfil do vendedor (CPF/CNPJ) e, se
  CPF, o volume (> 450 pedidos/90 dias); quando CPF + volume, o cálculo MUST somar R$ 3,00/item
  (fonte oficial art. 26839); as perguntas aparecem SÓ no canal Shopee (campos dirigidos); perfil
  ausente em documento salvo antigo = comportamento de hoje (byte-idêntico).
- **FR-927** *(clarify Q8)*: Para canal Shopee com perfil CNPJ e preço abaixo de R$ 8, o adicional
  fixo MUST ser metade do preço do produto (regra oficial publicada, art. 26839); a partir de R$ 8 o
  comportamento atual permanece byte-idêntico; a regra NÃO se aplica a CPF (US17 cobre esse caso
  como aviso). **Pré-condição de implementação (achado do arquiteto)**: a forma exata da regra
  (o percentual incide junto? o fixo some?) MUST ser conferida verbatim no art. 26839 ANTES de
  gravar qualquer número — as duas fontes internas divergem na leitura.
- **FR-928** *(achado do arquiteto, defeito latente)*: Uma faixa de preço cujo `fixedFee` é nulo
  MUST NOT resolver para R$ 0,00 sob selo de referência — resolve para "sem referência — informe"
  (mesma classe do guard F3/014-A2; entra com a fatia de campos dirigidos).

### Key Entities

- **Teaser premium**: o padrão único de cortesia (título · título+subtítulo da feature · Assinar ·
  legenda) aplicado às cinco superfícies.
- **Entrada do catálogo de tarifas**: eixos por marketplace (determinantes, comissão, taxa fixa,
  mínimo por item, faixas de preço); ganha em US15 o eixo logística × peso do custo fixo ML e em US14
  a taxa fixa do plano Individual.
- **Entrada do motor de preço**: perde `wasteGrams` (US10); tempo permanece decimal; ganha o custo
  condicional de volumoso Shopee (US16).
- **Documento salvo**: orçamento congelado (imutável — exibe o que foi cotado) e simulação
  (recalculada hoje — recomputa com regra de leitura declarada). Ambos carregam os rótulos de versão
  (`PRICING_MODEL_VERSION`, `catalogVersion`) que precisam continuar dizendo a verdade.
- **Promessa da primeira dobra**: o texto de aquisição que declara o que é grátis; muda junto com a
  fronteira do freemium.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-901**: Nas cinco telas premium, o usuário grátis vê estrutura idêntica de teaser (mesmos 4
  elementos, mesma ordem), verificado por screenshot das cinco + comparação estrutural — zero
  variações remanescentes da lista US1-AC2.
- **SC-902**: Zero ocorrências de "Histórico"/"Cenários" em qualquer superfície visível ao usuário,
  incluindo PDF e CSV exportados; rotas e payloads permanecem byte-idênticos.
- **SC-903**: A 1440px, a largura útil da calculadora é ≥ 60% (baseline medida: 37%); a 360, 390 e
  1440px nenhum cartão de preço tem scroll interno, quebra no meio do número ou transbordo — medido
  por geometria com valor adversarial.
- **SC-904**: Os 11 campos têm explicação acessível por hover, teclado e toque que responde as duas
  perguntas; nenhum tooltip altera resultado de cálculo (igualdade numérica).
- **SC-905**: Um documento salvo com `5.5` horas reabre exibindo `5h 30min`; a conversão h+min ↔
  decimal é bijetiva no domínio de minutos inteiros.
- **SC-906**: Com R$ 4.000 e payback 3 anos, os três ritmos exibem ≈ R$ 5,13 / R$ 1,11 / R$ 0,40 por
  hora e a peça de 5h muda o custo conforme a tabela aprovada; o payload enviado ao motor é o mesmo
  par de campos de hoje.
- **SC-907**: Após US10, nenhum documento salvo de nenhuma versão quebra ao abrir (matriz: orçamento
  congelado antigo · simulação antiga · documento novo); toda recomputação de documento antigo exibe
  a declaração de descarte.
- **SC-908**: O usuário grátis não obtém número de canal de venda por nenhum caminho da UI (cinco
  telas + calculadora + deep-links testados); a promessa nova está na primeira dobra e as
  Clarifications datadas existem nas specs 005 e 007.
- **SC-909**: Por marketplace, a seção de canal exibe exatamente os eixos do schema daquele
  marketplace (Shopee sem categoria; Amazon lista de 38; ML permanece o comportamento de hoje —
  parte ML adiada) — verificado por screenshot dos três; para toda combinação já suportada,
  resultado byte-idêntico (exceto US14/US16/US18 e FR-926, cujas diferenças são exatamente as
  decididas: R$ 2,00/item, R$ 50,00 condicional, metade-do-preço < R$ 8 CNPJ, +R$ 3/item CPF de
  volume).
- **SC-910**: Nenhum número de tarifa sem fonte oficial datada aparece sob selo de referência —
  auditado sobre o catálogo servido e sobre a UI (avisos Shopee, "sem referência — informe" ML).
- **SC-911**: V0 está medido e registrado com evidência ANTES de qualquer conserto do Grupo 0.

## Assumptions

- A palavra "Orçamento" descreve o documento congelado exportável que já existe; não introduz
  obrigação fiscal nova — o rodapé "não é documento fiscal" do PDF continua valendo.
- Os dois PNGs de logo fornecidos pelo dono (`homologação/`) são as artes finais para claro/escuro.
- O mecanismo de tooltip existente (`InfoTip`) atende hover/teclado/toque ou é estendido sem troca de
  biblioteca.
- O schema de determinantes do catálogo é capaz de dirigir a tela sem dado novo (medido em
  `ESTRUTURA-DADOS-MARKETPLACES.md`) — exceto o eixo novo do custo fixo ML (US15), que é a extensão
  decidida em D10.
- O fatiamento segue o corte do brief SEM a PR-G (V0 · PR-A teasers+rótulos · PR-B layout · PR-C
  campos · PR-D Desperdício ISOLADA · PR-E premium+dirigidos · PR-F dado Shopee/Amazon), autorizado
  fatia a fatia pelo dono (ADR-0006); PR-D não entra junto com PR-C; a PR-G (ML) saiu com a US15
  (dono, 2026-08-05).
- O E6 (billing) segue em voo (PR-C pendente); o bump MAJOR de PR-D é coordenado com o fechamento do
  E6 ou explicitamente com o arquiteto (risco R8 do brief).
- **Enforcement da virada marketplace-premium (registrado 2026-08-05, achado D1 do analyze)**: é de
  **UI** — o cálculo é offline por design e o catálogo de tarifas é dado público semeado no bundle,
  então o servidor não tem como gatear a conta em si; o valor premium é a conveniência. Decisão
  consciente, não drift do Princípio IV (a autoridade de entitlement sobre dados premium servidos
  permanece no servidor, ADR-0012). A Clarification da 007 (T050) carrega esta frase.
- A matriz de homologação do §9 do brief (offline, erro de rede real, sessão expirada, /conta no
  grátis, tema claro, 404, mobile 360px) é executada como MEDIÇÃO deste incremento; defeito achado
  vira follow-up priorizado, não escopo automático.

## Fora de escopo (explícito)

1. **US6-ML — token da casa no CI** (D9 foi só direção): gateado pelas 8 condições do parecer do
   `seguranca` + autorização separada do dono. Não iniciar em um "continue". Inclui o teste único de
   suficiência da permissão e a coleta de comissão por categoria do ML.
   **E, por decisão do dono (2026-08-05, pós-arquiteto): TODA a parte ML do canal** — US15/FR-922
   (custo fixo logística × faixa × peso), a comparação por logística (Q4), o peso (Q3) e o conserto
   do seletor de categoria vazio — volta junto com o token. O catálogo ML está vazio; sem dados,
   nada disso resolve valor.
2. **Pipeline de ingestão mensal** (vigia da `/precos`, OCR Shopee com guardas, ingestão das tabelas
   de frete ML, `fee-refresh.yml`) → proposta: incremento 017.
3. **Frete real (lacuna E3)** — as 3 tabelas medidas ficam prontas como insumo; não é a vez.
4. **Lacuna E1 completa** (perfil do vendedor): Amazon Profissional R$ 19/mês, Campanhas de Destaque
   Shopee, bloco de perfil próprio — o 016 só toca o mínimo que US14/US17 exigem.
5. **Lacuna E2 geral** (`fixedFee` como função arbitrária do preço) — permanece fora, EXCETO o caso
   Shopee < R$ 8 CNPJ, que o clarify Q8 trouxe para dentro (US18): a regra é oficial e
   determinística. A regressiva CPF continua aviso (US17) — não é publicada.
6. **Isenção promocional Amazon**; **pisos de comissão** ML/Shopee ("não determinado"); **closing fee
   de mídia**.
7. **Sidebar colapsável** (US3 só prepara o terreno) e **homologação da parte premium** (o dono
   homologa depois).

## Perguntas do clarify — TODAS RESOLVIDAS (8/8)

**Sessão 1 (2026-08-05): Q2·Q4·Q5·Q6·Q8 · Sessão 2 (2026-08-05): Q1·Q3·Q7.** Respostas
integradas na seção Clarifications e nos FR/US afetados. A tabela fica como registro.

| # | pergunta | o que muda |
| --- | --- | --- |
| ~~Q1~~ | ~~Selo "sem referência"?~~ **RESOLVIDA (clarify 2026-08-05, sessão 2): fica, texto reescrito para leigo + ? explicativo** | ver Clarifications |
| ~~Q2~~ | ~~US15 entra?~~ **REVERTIDA (mesma data, pós-arquiteto): catálogo ML vazio → a parte ML toda ADIADA para o token (US6-ML/017)** | ver Clarifications §REVERSÃO |
| ~~Q3~~ | ~~Origem do peso ML?~~ **RESOLVIDA (clarify 2026-08-05, sessão 2): derivado das gramas + ajuste opcional "peso com embalagem" + aviso de cubagem** | ver Clarifications |
| ~~Q4~~ | ~~Tipo de logística ML na tela?~~ **RESOLVIDA (clarify 2026-08-05): comparação por grupo + escolha do vendedor, sem default** | ver Clarifications |
| ~~Q5~~ | ~~Volumoso: somar ou ratear?~~ **RESOLVIDA (clarify 2026-08-05): somar R$ 50 inteiros + legenda "por pedido"** | ver Clarifications |
| ~~Q6~~ | ~~Perfil CPF/CNPJ Shopee?~~ **RESOLVIDA (clarify 2026-08-05): perfil + volume perguntados; +R$ 3/item entra** | ver Clarifications + FR-926 |
| ~~Q7~~ | ~~Comunicação da mudança de preços?~~ **RESOLVIDA (clarify 2026-08-05, sessão 2): só nos documentos — divergência explicada onde aparece, sem banner (pré-v1, sem usuário em produção)** | ver Clarifications |
| ~~Q8~~ | ~~Shopee < R$ 8 CNPJ?~~ **RESOLVIDA (clarify 2026-08-05): modelar agora — virou a US18** | ver Clarifications + FR-927 |
