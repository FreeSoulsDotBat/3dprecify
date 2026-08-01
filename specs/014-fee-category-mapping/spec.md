# Feature Specification: Mapeamento categoria→comissão (Mercado Livre + Amazon) com atualização mensal automática

**Feature Branch**: `014-fee-category-mapping`

**Created**: 2026-07-28

**Status**: Draft

**Input**: Mapeamento categoria→taxa de comissão para Amazon e Mercado Livre, com atualização mensal automática
via GitHub Actions (CI-first), entregue aos usuários através do catálogo de tarifas existente.

**Fontes autoritativas** (nada aqui é inferido — Princípio VIII): `docs/product/014-fee-category-mapping-scope-brief.md`
(visão, análise de valor, US1–US8, SC-801…SC-812, fronteiras de escopo) · `docs/adr/0010-marketplace-fee-catalog-architecture.md`
§A10 (decisão CI-first) e **§A13 (os quatro gates medidos em 2026-07-27/28)** · `specs/014-fee-category-mapping/seguranca-ci-first.md`
(parecer bloqueante de segurança).

---

## O que mudou desde o brief — correções obrigatórias

O brief foi escrito **antes** dos gates. Três de suas premissas foram medidas e **duas são falsas**. Esta spec
governa; onde divergir do brief, o brief está desatualizado.

| Premissa do brief | Estado medido (ADR-0010 §A13) |
|---|---|
| US6 (ML) está **BLOQUEADA** em Q-D (conta da casa) | **DESBLOQUEADA.** A conta da casa existe e o token funciona. Q3 = decidido pelo dono. |
| US6 AS5: a ingestão ML "roda de egress BR porque a API tem geo-gate" | **FALSO.** G1 mediu as duas pontas com o mesmo token: runner hospedado nos EUA devolve números **idênticos** aos de egress BR. A crença de geo-gate registrada desde 2026-07-06 foi aposentada. |
| Q6: Amazon em CI + ML no Cloud Run Job quando desbloquear | **RESOLVIDO: os dois em runner hospedado do GitHub.** Nenhum serviço de nuvem novo, nenhum custo recorrente, nenhuma máquina self-hosted. |

Corolário que esta spec assume: **não existe runner BR, não existe máquina a possuir.** O risco "adquirir uma
máquina" listado no ADR §A11 não se materializa.

---

## Clarifications

### Session 2026-08-01

- Q: A FR-020b manda medir a obsolescencia contra a data de ENTREGA. O catalogo chega por tres caminhos
  com idades diferentes (semente empacotada, cache persistido, endpoint servido) — qual e a "entrega"?
  -> A: **Nenhum dos tres. O relogio CONTINUA em `lastReviewed`, e o que muda e o TAMANHO da janela.**
  O risco que o selo mede e a Amazon ter mudado a tarifa desde que **conferimos** — nao o tempo que o
  valor levou para chegar. Mover o relogio para a entrega tornaria "fresco" um numero que ninguem
  verifica ha meses (uma instalacao nova de um bundle velho, ou um app que ninguem atualizou), o que e
  uma mentira MAIOR do que o falso positivo que a FR-020b queria corrigir.
  O falso positivo era real, mas a causa nao era o relogio: era a **janela ter exatamente o tamanho do
  ciclo**. Com o laco mensal e 30 dias, todo valor passa os ultimos dias do ciclo gritando
  "desatualizada" mesmo com o robo funcionando. A janela passa a ser `ciclo do laco + folga de
  entrega`, de modo que o alarme so dispare quando algo REALMENTE falhou — o robo nao releu, ou a
  leitura nao foi entregue.

### Session 2026-07-28

- Q: O que acontece quando o vendedor não escolhe categoria? → A: **Híbrido** — usar o catch-all **publicado** quando
  o marketplace tem um (Amazon "Outros" 15%), com selo dizendo "categoria não informada"; exibir **"sem referência"**
  onde não há catch-all publicado (ML). Nunca inventar um catch-all.
- Q: A categoria escolhida persiste em quais objetos salvos? → A: **Cenários sim, produtos de catálogo não**;
  snapshots herdam apenas o que o payload já tinha (imutabilidade intocada).
- Q: Custo fixo do ML abaixo de R$ 79, sem eixo de logística no app? → A: **Modelar com as fronteiras publicadas e
  declarar a premissa de logística na própria entrada.** Não criar eixo de logística; a lacuna R$ 50,01–78,99 da
  fonte permanece lacuna.
- Q: O que produz uma execução que confirma tudo inalterado? → A: **Um PR que avança apenas `lastReviewed`** — houve
  releitura real da fonte, então o selo permanece verdadeiro e o PR mensal é a evidência de que o laço está vivo.
- Q: O 014 pode fechar sem o Mercado Livre? → A: **Sim.** O DoD fecha com a Amazon (US1+US2+US3+US4, zero
  credencial); o **ML é fatia própria**, autorizada à parte — isola a única superfície de segredo e a única pendência
  do `seguranca` sem segurar o resto do incremento.

### Session 2026-07-28 (segunda rodada — após a revisão adversarial de 3 especialistas)

- Q: Construir o 014 completo agora, ou reduzir e priorizar o E6? → A: **014 completo agora**, com um **artefato
  embutido de transição**: a ingestão implementada roda, sua saída **real** é commitada e serve o app em runtime
  **sem depender de deploy**; quando a v1 subir, o endpoint servido e o laço mensal assumem e o embutido volta a ser
  semente enxuta. **Registrado o contraponto do `product-owner` (80% de que o certo era reduzir)**: hoje o 014
  entrega precisão para zero usuários em produção, o E6 segue mid-flight, e o laço mensal não dispara até o workflow
  chegar em `main`. O dono decidiu com o contraponto à vista.
- Q: A janela de obsolescência deve ser medida contra o quê? → A: **Contra a ENTREGA ao usuário**, não contra a
  leitura da fonte nem contra o merge. Corrige a causa do falso positivo estrutural em vez do sintoma; exige que o
  artefato carregue a data de entrega.
- Q: Como a árvore chega ao cliente (D2)? → A: **Espinha de resolução dentro do próprio `catalog.json`** (nós
  divergentes + seus ancestrais) + **índice de nomes sob demanda**. A alíquota fica offline desde o primeiro uso e o
  risco de skew árvore↔catálogo **desaparece por construção**.
- Q: Onde mora o código de ingestão (D1)? → A: **`packages/fee-ingest`**, pacote de workspace — o parser produz
  folhas de dinheiro e precisa satisfazer o **mesmo** schema do catálogo; fora do workspace duplicaria validação e
  ficaria fora do `gate:all`.
- Q: Tornar o repositório privado agora para destravar a fatia ML? → A: **Não.** Segue público, e a fatia ML espera
  o **parecer do `seguranca`** (D3/T004), que já tem três condições concretas nomeadas pelo `arquiteto`:
  `allowed_actions`, pinagem de actions por SHA e `trufflehog@main`. Runner hospedado protege contra persistência do
  segredo, **não** contra exfiltração dentro do run.
- Q: O PR mensal sem mudança de dinheiro deve mesmo existir? → A: **Política dividida por classe de diff**
  (revisando a decisão anterior de Q7). Diff **exclusivamente** de `lastReviewed` → o job comita direto. Qualquer
  campo de **dinheiro** → PR que um humano lê. O guard é determinístico e, **em dúvida, falha abrindo PR**.
  Preserva a intenção do portão humano do ADR-0010 Q-A e remove o ritual mensal que o corroeria.
- Q: O seletor de categoria é opcional e discreto? → A: **Não — campo de primeira classe.** Renderiza sempre e
  expandido nos slots ML/Amazon ("sem categoria" vira exceção, não o caminho fácil); o catch-all deixa de ser selo
  passivo e vira **ação**; e o retorno após escolher é em **reais**, não em pontos percentuais. Escolher continua
  **opcional como gate** (nunca bloqueia o cálculo) e deixa de ser opcional como **afordância**.
- Q: Como reduzir o atrito de reescolher categoria (Q10 revisada)? → A: **Memória local de "última usada" por
  marketplace**, pré-selecionada e editável, mais os recentes no topo do seletor. Mata a maior parte da repetição
  **sem** tornar categoria um atributo de produto, sem migração e sem tocar no domínio de catálogo (E2). O atrito
  medido era 50 produtos × 2 canais ≈ 25–40 min de reescolha.
- Q: Adotar o preditor `domain_discovery` do ML (título do anúncio → categoria)? → A: **Fora do 014**, registrado
  como candidato futuro. Verificado ao vivo em 2026-07-28 e funciona bem para o nosso caso ("suporte de celular
  impresso em 3d" → *Apoio para Celulares*), mas exige **token de usuário** ⇒ só via proxy no backend ⇒ **põe o
  token da conta da casa no caminho de requisição do usuário, a cada digitação**, em vez de 12 chamadas por ano num
  job de CI. O parecer do `seguranca` foi escrito sobre a segunda hipótese, não sobre a primeira — adotar exigiria
  parecer novo. O 014 entrega com busca local, offline e sem credencial.
- Q: Quem tem a palavra final sobre o artefato de dinheiro — o classificador do job ou a plataforma? → A: **A
  plataforma.** `develop` ganha proteção exigindo PR; o robô **nunca** escreve direto e sempre abre PR; o
  classificador passa a decidir **apenas a dispensa de revisão**, e só quando provar que o diff é exclusivamente
  `lastReviewed`. Classificador quebrado produz um PR esperando humano, nunca um commit de dinheiro. Preserva o
  ganho do Q7 (ninguém revisa PR vazio) e responde ao achado do T004: `develop` não tinha proteção nenhuma
  (medido — 404 + rulesets vazios), então o único portão era código que o próprio job executa.
- Q: O mapa de categorias é gratuito ou premium? → A: **GRATUITO — fechada.** Reaberta e decidida com a colisão à
  vista: premium exigiria racharem-se artefato e entrega (categorias servidas sob entitlement, nunca embutidas),
  **matando o ganho do D2** (alíquota offline desde o primeiro uso), acionando o Princípio IV sem nenhuma tarefa
  existente, e fazendo o vendedor gratuito ver 15% onde sua categoria é 12%. O catálogo é o **ativo de topo de
  funil** que traz o não-pagante de volta todo mês; o premium continua no que já vende (E2–E5).

---

### Session 2026-07-28 (terceira rodada — após a revisão multi-agente do PR #31)

- Q: A Amazon cobra **15% até R$ 200,00 e 10% para o excedente** — comissão por **parcela** do preço. O artefato
  modelou como faixa de **seleção** (uma alíquota aplicada ao preço inteiro), subestimando a comissão acima do
  limiar em 3 de 38 categorias. Como representar? → A: **Banda progressiva em `pricing-core`**, com discriminador
  **aditivo** cuja ausência significa seleção de faixa. Motivo do formato aditivo: `priceBands` atravessa
  `frozen-payload.ts` e `config-document.ts` — trocar o sentido do campo **reinterpretaria snapshots já
  congelados**, que são imutáveis por trigger (ADR-0019). Verificado na fonte oficial
  (`venda.amazon.com.br/precos`, 2026-07-28): *"15% até R$ 200,00 e 10% para o **excedente** acima de R$ 200,00"*.
- Q: O buraco no guard F3 (entrada com comissão de topo válida e bandas com comissão nula passa na validação, e as
  bandas têm precedência ⇒ 0% sob selo "Referência") é requisito novo? → A: **Não.** A FR-008 e o SC-802 já
  exigiam isso literalmente; o `.refine` implementado curto-circuita em `commissionPct !== null` e nunca inspeciona
  as bandas. É **defeito de implementação contra requisito existente**, não lacuna de spec — registrado assim para
  a correção não se disfarçar de escopo novo.
- Q: O catch-all publicado da Amazon nunca é emitido — `amazonEntries` só produz `{plan, category}`, então
  `viaCatchAll` é **sempre falso** contra o artefato real, a FR-011 **não se cumpre**, e o ramo `catchAll` do selo
  mais sua cópia i18n são código morto (testados por um fixture que inventa uma forma que o gerador não produz;
  T020/T024/T041 estavam `[x]` indevidamente). Emitir ou remover? → A: **Emitir** (opção *a*): a entrada
  apenas-modalidade sai de "Outros" 15%, e quem não escolhe categoria recebe esse valor pré-preenchido com selo
  "categoria não informada". **Tensão registrada**: "Outros" é a categoria da Amazon para produtos que não se
  encaixam nas demais, **não** uma alíquota declarada para "categoria desconhecida" — tratá-la como catch-all é
  interpretação, não leitura literal. O que a sustenta é que 15% é o **teto** da tabela, então o erro é sempre a
  favor do vendedor; o que a incomoda é a FR-011a, que proíbe derivar catch-all de faixa publicada — aqui não há
  derivação (o valor é publicado como valor próprio), mas há reinterpretação de escopo. Aceito conscientemente.
- Q: O adiamento da **Q9** (base de comissão da Amazon inclui frete, a nossa não) estava justificado por
  "seria mudança em `pricing-core`, que o escopo marca como FORA" — e o ADR-0024 **abre** `pricing-core`. A
  justificativa registrada expirou; reconfirmar ou reabrir? → A: **Adiamento reconfirmado**, agora por um motivo
  próprio e não por um escopo que deixou de valer: a limitação continua **declarada** no texto de cada entrada
  (FR-014, `AMAZON_FEE_BASE_CAVEAT`), e modelar base-com-frete exigiria um eixo de logística que a FR-014a proíbe
  explicitamente. O ADR-0024 abre `pricing-core` para a **combinação de bandas**, não para a base de cobrança.
- Q: Quatro operações de auditoria (revisão do PR #31 · varredura dos 27 restantes · batidão visual + regras ·
  verificação dos pendentes) produziram **36 achados confirmados**, e eles não pertencem todos ao 014: ~20 são do
  entregável próprio, 5 são defeitos de código **já shipado** (outbox/recálculo do E4, geometria de kit e
  histórico do E3/E4), 2 são do `pricing-core` no modo SELEÇÃO (bloqueiam a US6) e 1 é do E6 billing, em outra
  branch. Separar por origem em incrementos distintos, ou concentrar? → A: **Tudo dentro do 014** (Fase 6C).
  **Ressalva levantada e conscientemente aceita pelo dono**: o PR #31 fica grande e mistura "consertar o que
  acabei de construir" com "consertar o que já está em `develop`" — o projeto tem precedente separado para o
  segundo caso (`013-audit-remediation`). Mitigação acordada: as tarefas ficam **agrupadas por origem** dentro da
  fase, para o revisor percorrer em passadas. O achado do billing NÃO é executável nesta branch e fica como
  **hand-off explícito** (T121), não como tarefa que alguém possa marcar feita aqui.
- Q: O estado vazio do seletor afirma "a taxa exibida já é a correta" e "conecte uma vez para carregá-la", no
  estado padrão de 100% dos usuários (slot nasce em ML, que tem 0 entradas e 0 espinha), onde **nenhuma taxa é
  exibida** e conectar **não carrega nada** enquanto a fatia ML estiver bloqueada. → A: o estado vazio **não pode
  afirmar** que existe taxa exibida nem prometer ação que o sistema não cumpre para aquele marketplace (FR-006d).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Escolher a categoria do anúncio, por canal (Priority: P1)

O vendedor informa ao app sob qual categoria do marketplace a peça está anunciada, por slot de canal. **Escolher é
opcional**; não escolher nunca é pior do que hoje.

**Why this priority**: sem o eixo de categoria não existe incremento. É a porta de entrada de todo o resto.

**Independent Test**: abrir um slot de canal ML ou Amazon, buscar a categoria por parte do nome, selecioná-la, e
observar que a escolha é por slot. Entrega valor mesmo se nenhum mapa novo tivesse sido carregado.

**Acceptance Scenarios**:

1. **Given** um slot de canal ML ou Amazon, **When** o vendedor abre o seletor de categoria, **Then** ele encontra a
   categoria **digitando parte do nome** (não apenas navegando uma árvore multinível), e os nomes exibidos são os
   nomes publicados pelo próprio marketplace.
2. **Given** que o vendedor **não** escolhe categoria num marketplace que **publica** um catch-all (Amazon
   "Outros"), **When** as tarifas resolvem, **Then** o catch-all publicado pré-preenche e o selo diz
   **"categoria não informada"**, nomeando o catch-all usado.
2b. **Given** que o vendedor **não** escolhe categoria num marketplace **sem** catch-all publicado (ML), **When** as
   tarifas resolvem, **Then** o selo lê **"sem referência"** e nada é pré-preenchido — o app **não** inventa um
   catch-all a partir da faixa publicada.
3. **Given** um marketplace sem eixo de categoria (Shopee, Outro), **When** o slot renderiza, **Then** nenhum seletor
   de categoria aparece (espelha a regra de modalidade já existente).
4. **Given** um vendedor que escolheu categoria, **When** ele adiciona um segundo slot de canal, **Then** a escolha é
   **por slot** — uma categoria no ML não vira silenciosamente a categoria da Amazon.
5. **Given** uma sessão offline, **When** o vendedor abre o seletor, **Then** ele funciona a partir do catálogo que o
   cliente já tem — o seletor **nunca** exige rede.

> Layout, a escolha entre busca e drill-down, e onde o seletor mora dentro do slot são do **`designer-ux`**. Esta
> história fixa apenas o comportamento.

---

### User Story 2 — O pré-fill resolve pela categoria, com selo que a nomeia (Priority: P1) — FUNDACIONAL

A busca de tarifa passa a **usar** a categoria. Hoje o `slotDeterminants` envia apenas `listingType` (ML) / `plan`
(Amazon), então uma entrada chaveada por categoria nunca resolveria e o recurso pareceria quebrado.

**Why this priority**: é o elo que faz US1 e US3/US6 significarem alguma coisa. Sem ela, o mapa existe e ninguém o
alcança.

**Independent Test**: com uma entrada de catálogo chaveada por categoria, resolver um slot e verificar que ela
pré-preenche e que o selo nomeia a categoria.

**Acceptance Scenarios**:

1. **Given** que existe entrada chaveada para a (marketplace, categoria, modalidade) do vendedor, **When** o slot
   resolve, **Then** essa entrada pré-preenche e o selo nomeia **a categoria a que o número pertence**.
2. **Given** que uma entrada específica de categoria **e** um catch-all do marketplace casam, **When** resolve,
   **Then** vence a **mais específica**, de forma determinística e **independente da ordem** em que aparecem no
   artefato (SC-801).
3. **Given** que o vendedor edita qualquer tarifa pré-preenchida, **When** o selo re-deriva, **Then** ele lê
   **"ajustado por você"** exatamente como hoje — a sobrescrita sempre vence o mapa.
4. **Given** uma categoria sem entrada com fonte, **When** resolve, **Then** o selo lê **"sem referência"** e nada é
   pré-preenchido — nunca o número de uma categoria vizinha, nunca 0%.
5. **Given** qualquer entrada resolvida, **When** ela pré-preenche, **Then** sua comissão é um número **com fonte**:
   uma entrada que pré-preencheria 0% sob selo de "referência" é **impossível** (SC-802).

---

### User Story 3 — Amazon: o mapa completo de categorias, com procedência (Priority: P1)

Toda categoria que a Amazon publica em sua tabela de comissões, com a alíquota, o mínimo de **BRL 1,00** por item, o
eixo de plano, e as categorias com faixa de preço modeladas como `priceBands`.

**Why this priority**: é a metade do valor que **não depende de credencial nenhuma** — mede-se de runner hospedado,
sem conta, sem OAuth (G2). É o caminho mais curto entre a spec e valor entregue.

**Independent Test**: comparar o mapa publicado com a tabela oficial e verificar cobertura total, zero itens
inventados, e procedência em 100% das entradas.

**Acceptance Scenarios**:

1. **Given** a tabela oficial da Amazon, **When** o mapa entra, **Then** **toda** categoria ali publicada está
   presente, e **nenhuma** categoria ausente da tabela existe no catálogo (nada interpolado, nada vindo de blog).
2. **Given** uma categoria que a fonte publica com limiar de preço (Acessórios Eletrônicos em R$ 100; Móveis e
   Colchões em R$ 200), **When** entra, **Then** é modelada como `priceBands` e a calculadora escolhe a faixa pelo
   preço anunciado — não achatada em um percentual único.
3. **Given** toda entrada Amazon, **When** inspecionada, **Then** ela carrega `sourceUrl` + `effectiveDate` +
   `lastReviewed`, e o texto de `source` **nomeia a categoria**.
4. **Given** que o vendedor escolhe um plano (Profissional / Individual), **When** as tarifas resolvem, **Then** a
   cobrança por item do Individual e a ausência dela no Profissional aparecem com fonte, com a **assinatura mensal
   explicitamente fora de escopo** (é custo mensal, não por venda).
5. **Given** que a Amazon cobra comissão sobre uma base que inclui frete enquanto nosso motor cobra sobre o preço
   anunciado, **When** uma entrada Amazon é exibida, **Then** essa limitação é **declarada ao vendedor** no texto da
   própria entrada — subestimação declarada e limitada, nunca silenciosa (Q9).

---

### User Story 4 — Atualização mensal automática que abre um PR com o diff (Priority: P1)

Uma vez por mês, um job relê as fontes, reconstrói o mapa e — se algo mudou — **abre um PR** com um diff que um
humano consegue ler. **Nunca faz merge. Nunca adivinha.**

**Why this priority**: é o que transforma uma curadoria pontual em um produto que continua verdadeiro no mês que vem.

**Independent Test**: rodar o job manualmente contra uma fonte alterada e verificar que abre um PR com o diff
old→new por categoria; rodar contra uma fonte quebrada e verificar que **não** abre PR.

**Acceptance Scenarios**:

1. **Given** uma execução agendada em que valores da fonte mudaram, **When** ela termina, **Then** abre **um** PR
   cujo corpo lista **cada mudança como old → new, por categoria**, com URL da fonte e data de coleta — e o PR
   **não** é auto-mergeado.
2. **Given** uma execução em que a fonte não pode ser lida (formato da página mudou, render falhou, credencial
   expirou, rede), **When** ela falha, **Then** **não** abre PR, deixa o artefato commitado **intocado**, e alerta.
   **Um parse vazio ou drasticamente encolhido é tratado como falha, não como mudança de tarifa** (SC-806).
3. **Given** uma execução que confirma todos os valores inalterados, **When** termina, **Then** abre um PR que
   avança **apenas** `lastReviewed` — e em **nenhum** caso `lastReviewed` avança para um valor que não foi de fato
   relido da fonte.
4. **Given** uma categoria que **desapareceu** da fonte, **When** o diff é montado, **Then** sua remoção é
   **exposta no PR para um humano** — nunca mantida viva silenciosamente sob data de revisão nova.
5. **Given** a execução, **When** roda, **Then** consome **0 tokens de LLM** — o parsing é determinístico (SC-811).
6. **Given** a execução mensal, **When** dispara, **Then** ocorre **no dia 1 às 06:00 UTC**, mira `develop`, e
   também pode ser disparada manualmente sob demanda.

---

### User Story 5 — Quando o robô falha, o selo conta a verdade (Priority: P2)

O selo de obsolescência de 30 dias é o *dead-man's switch* embutido do app. Se o laço mensal morrer, o usuário fica
sabendo.

**Why this priority**: sem isso, uma automação quebrada é indistinguível de uma automação funcionando — e o produto
mentiria por omissão.

**Independent Test**: envelhecer artificialmente o `lastReviewed` de um valor e verificar que o selo o marca como
desatualizado sem nenhuma intervenção.

**Acceptance Scenarios**:

1. **Given** que o job mensal não atualiza um valor com sucesso há mais que a janela de obsolescência, **When** o
   vendedor vê aquela tarifa, **Then** o selo a marca **desatualizada** — a falha do laço vira visível ao usuário
   sem depender de alguém olhar um painel.
2. **Given** um valor que uma execução verificou como inalterado, **When** `lastReviewed` avança, **Then** ele
   avançou porque o valor foi **relido da fonte**, não porque o job rodou.
3. **Given** um cliente offline cuja semente embutida é mais antiga que o catálogo servido, **When** renderiza,
   **Then** o selo marca os valores como **embutida** exatamente como hoje, e a comparação de frescor **nunca reduz**
   a cobertura que o cliente já tinha (SC-805).

---

### User Story 6 — Mercado Livre: o mapa completo de categorias (Priority: P2)

O mesmo mapa para o ML, construído pelo **caminho sancionado por OAuth**: percorrer a árvore de categorias e obter a
alíquota por categoria e tipo de anúncio.

**Why this priority**: P2 e não P1 porque a Amazon entrega valor sozinha e sem credencial; o ML acrescenta o maior
marketplace do país, mas carrega a única superfície de segredo do incremento. **É fatia própria: o DoD do 014 fecha
sem ela**, e ela é autorizada à parte — não por estar bloqueada (não está), mas para que a pendência de ratificação
do `seguranca` não segure o valor já pronto.

**Independent Test**: com o token da conta da casa, extrair a árvore e as alíquotas e verificar que as entradas
trazem as taxas exatas por categoria — nunca a faixa publicada 10–14% / 15–19%.

**Acceptance Scenarios**:

1. **Given** a conta da casa e sua aplicação OAuth, **When** a ingestão roda, **Then** as entradas ML carregam as
   alíquotas **exatas** de Clássico e Premium por categoria — nunca a faixa publicada, nunca um blog.
2. **Given** as faixas de custo fixo do ML abaixo de R$ 79 (R$ 6,25 / 6,50 / 6,75), **When** modeladas, **Then** as
   fronteiras publicadas são usadas literalmente e **a lacuna de R$ 50,01–78,99 que a própria página do ML deixa
   permanece uma lacuna** — nunca interpolada (Q8).
3. **Given** um valor ML, **When** exibido, **Then** a entrada declara sob qual premissa de logística ele vale (Q8) —
   o app não tem eixo de `logistic_type` e não deve fingir que tem.
4. **Given** a ingestão ML, **When** roda, **Then** roda em **runner hospedado do GitHub** — o gate G1 mediu as duas
   pontas com o mesmo token e provou que **não há geo-gate**; nenhum runner self-hosted é usado, e o caminho anônimo
   continua morto e **não** é retentado disfarçado.
5. **Given** a permissão da aplicação ML, **When** configurada, **Then** ela concede **exatamente** o mínimo medido
   ("Publicação e sincronização: Leitura") — nenhuma permissão de escrita é habilitada para a ingestão.

---

### User Story 7 — ML sem a conta: a linha de base que já temos (Priority: P3 — candidata a descarte)

As faixas de custo fixo do ML abaixo de R$ 79 são conhecidas sem API. Publicar **só** elas significaria uma entrada
que conhece o custo fixo mas **não** a comissão — o que o vocabulário atual de selos (por entrada, não por campo)
não consegue expressar honestamente.

**Why this priority**: P3 e **recomendada para descarte**. Com a US6 desbloqueada, esta história perdeu sua razão de
existir: ela era a mitigação para o ML estar bloqueado. Mantida enumerada para que o descarte seja **decisão** e não
esquecimento — depende de Q11.

**Independent Test**: n/a enquanto Q11 não decidir; se mantida, testa-se que uma entrada de conhecimento parcial ou
é rejeitada na validação ou exibe selo por campo.

---

### User Story 8 — A categoria escolhida acompanha o que o vendedor salva (Priority: P3)

Uma categoria escolhida num slot de canal é **intenção de canal**, então pertence junto da demais intenção de canal
que a E5 já guarda. **Alcance decidido: cenários salvos sim; produtos de catálogo não; snapshots herdam apenas o que
o payload já tinha.**

**Why this priority**: valor real mas incremental — sem ela o vendedor reescolhe a categoria a cada cenário.

**Independent Test**: salvar um cenário com categoria, reabrir, e verificar que ela re-resolve pelo catálogo de hoje
como os demais slots não sobrescritos.

**Acceptance Scenarios**:

1. **Given** um cenário salvo criado depois do 014, **When** reaberto, **Then** sua categoria re-resolve pelo
   catálogo de hoje exatamente como os demais slots não sobrescritos (o contrato do resolvedor de leitura da E5,
   inalterado).
2. **Given** um cenário, kit ou **snapshot imutável** criado **antes** do 014, **When** aberto, **Then** renderiza
   inalterado e sem categoria — a ausência de categoria é um estado válido e permanente (SC-809).

---

### Edge Cases

- **A fonte muda de formato sem avisar.** O parse encolhe ou vem vazio: tratado como **falha**, não como "as taxas
  caíram para zero". Nenhum PR, artefato intocado, alerta.
- **Uma categoria some da fonte.** Nunca é apagada silenciosamente nem mantida viva com data nova: a remoção vai
  para o PR, para decisão humana.
- **A credencial do ML expira ou é revogada.** A metade ML falha; a metade Amazon **continua funcionando** — as duas
  não compartilham destino.
- **O agendamento não dispara** (fila do GitHub, repositório inativo, workflow desabilitado). O selo de 30 dias
  expõe isso ao usuário sem depender de ninguém observar a automação.
- **Duas entradas casam com a mesma especificidade.** O desempate precisa ser determinístico e independente da ordem
  do arquivo — nunca "a primeira que aparecer".
- **Uma faixa de preço sem comissão.** Hoje passa na validação e pré-preenche 0% sob selo de referência (achado
  herdado do 013). Precisa ser **rejeitada no parse/boot, ruidosamente** (SC-802).
- **O vendedor escolhe uma categoria e depois troca de marketplace no slot.** A categoria do marketplace antigo não
  pode sobreviver para o novo.
- **Preço anunciado exatamente no limiar de uma faixa** (R$ 100,00; R$ 200,00). A fronteira precisa ser inequívoca e
  testada nos dois lados.

---

## Requirements *(mandatory)*

### Functional Requirements

**Eixo de categoria e resolução**

- **FR-001**: O sistema MUST aceitar `category` como determinante de busca de tarifa, por slot de canal, para os
  marketplaces que publicam categorias (ML e Amazon).
- **FR-002**: O sistema MUST resolver pela entrada **mais específica** entre as que casam, de forma determinística e
  **independente da ordem** das entradas no artefato.
- **FR-003**: O sistema MUST tratar a escolha de categoria como **opcional** e por slot; a ausência de categoria
  MUST permanecer um estado válido, inclusive permanente, para objetos salvos antes deste incremento.
- **FR-003a**: O sistema MUST persistir a categoria escolhida em **cenários salvos**, junto da demais intenção de
  canal. O sistema MUST NOT adicionar categoria a produtos de catálogo. Snapshots MUST apenas herdar o que seu
  payload já continha, sem alteração na imutabilidade.
- **FR-004**: O sistema MUST permitir localizar uma categoria **por texto**, sem exigir navegação pela árvore.
- **FR-005**: O seletor de categoria MUST funcionar **offline**, a partir do catálogo que o cliente já possui.
- **FR-006**: O sistema MUST NOT exibir seletor de categoria para marketplaces sem eixo de categoria.
- **FR-006a**: Nos slots ML e Amazon o seletor MUST renderizar **sempre e expandido**, em estado vazio ativo —
  escolher permanece opcional como **gate** (nunca bloqueia o cálculo) e deixa de ser opcional como **afordância**.
  Um campo colapsado somado a um número plausível já preenchido produz um vendedor que aceita a alíquota errada.
- **FR-006b**: Quando o catch-all publicado for usado por falta de escolha, o sistema MUST apresentá-lo como
  **ação** e não como selo passivo, declarando que é a maior alíquota da tabela quando for o caso.
- **FR-006c**: Ao escolher ou trocar a categoria, o sistema MUST mostrar o efeito em **reais sobre o preço**, não
  apenas em pontos percentuais — o vendedor decide em preço de etiqueta, não em p.p.
- **FR-006d**: O estado vazio do seletor MUST NOT afirmar que existe uma taxa exibida, nem que ela está correta, e
  MUST NOT prometer uma ação de carregamento que o sistema não pode cumprir para aquele marketplace. O texto MUST
  concordar com o selo do mesmo slot: onde o selo lê "sem referência", o seletor MUST orientar o vendedor a
  informar a comissão, não a confiar em um número que não existe.

**Honestidade dos números**

- **FR-007**: Toda entrada MUST carregar `sourceUrl`, `effectiveDate` e `lastReviewed`, e seu texto de origem MUST
  nomear a categoria a que o número pertence.
- **FR-008**: O sistema MUST rejeitar, **no parse/boot e ruidosamente**, qualquer entrada que pré-preencheria
  comissão 0% sob selo de "referência" — **incluindo o caso em que a comissão nula está dentro de uma faixa de
  preço**, que a validação atual não detecta.
- **FR-009**: O sistema MUST NOT interpolar valores: uma lacuna na fonte MUST permanecer lacuna no catálogo.
- **FR-010**: O sistema MUST NOT aceitar valores derivados de faixas publicadas, agregadores ou blogs.
- **FR-011**: Quando o vendedor não escolhe categoria e o marketplace **publica** um catch-all, o sistema MUST
  pré-preencher esse catch-all publicado, com selo dizendo "categoria não informada" e nomeando-o. Quando o
  marketplace **não** publica catch-all, ou quando nenhuma entrada com fonte casa, o sistema MUST exibir
  "sem referência" e MUST NOT pré-preencher valor algum.
- **FR-011a**: O sistema MUST NOT derivar um catch-all a partir de uma faixa publicada, média ou extremo — um
  catch-all só existe se o marketplace o publicar como valor próprio.
- **FR-012**: Uma tarifa editada pelo vendedor MUST sempre vencer o mapa, com o selo lendo "ajustado por você".
- **FR-013**: Uma atualização de catálogo, em qualquer camada de entrega, MUST NOT reduzir cobertura: nenhum slot que
  resolvia antes pode deixar de resolver depois.
- **FR-014**: Quando o motor de cálculo e o marketplace usam bases de cobrança diferentes, a entrada MUST declarar
  essa limitação ao vendedor em seu próprio texto.
- **FR-014a**: O custo fixo do ML abaixo de R$ 79 MUST ser modelado com as fronteiras publicadas literalmente, e a
  entrada MUST declarar sob qual premissa de logística ele vale. O sistema MUST NOT introduzir um eixo de logística
  no modelo, e MUST NOT preencher a lacuna de R$ 50,01–78,99 que a fonte deixa.
- **FR-014b**: Quando o marketplace cobra a comissão **por parcela do preço** (X% sobre a parcela até um limiar,
  Y% sobre o excedente), o catálogo MUST representar essa estrutura como tal e o motor MUST **somar por parcela**.
  O sistema MUST NOT modelá-la como seleção de faixa única, que aplica uma alíquota ao preço inteiro e subestima
  a comissão acima do limiar. A representação MUST ser **aditiva**: a **ausência** do discriminador MUST significar
  seleção de faixa, para que snapshot congelado e cenário salvo antes deste incremento continuem significando
  exatamente o que significavam quando foram gravados.
- **FR-014c**: Uma célula de fonte cuja estrutura de alíquotas o parser **não** reconhece MUST ser tratada como
  falha de leitura daquela categoria. O sistema MUST NOT extrair dela um número parcial — em particular, MUST NOT
  publicar a primeira alíquota encontrada como se fosse a alíquota única da categoria. A recusa de reconhecer
  MUST NOT ser desfeita por um caminho a jusante.

**Laço mensal**

- **FR-015**: O sistema MUST reler as fontes **mensalmente, no dia 1 às 06:00 UTC**, e MUST também permitir disparo
  manual sob demanda.
- **FR-016**: Quando houver mudança, o sistema MUST abrir **um** PR mirando `develop`, cujo corpo lista cada mudança
  como **old → new por categoria**, com URL da fonte e data de coleta.
- **FR-017**: O sistema MUST NOT fazer merge automático e MUST NOT publicar por conta própria.
- **FR-018**: Em falha de leitura, ou em parse vazio ou encolhido além de um limiar declarado, o sistema MUST abrir
  **nenhum** PR, MUST deixar o artefato intocado, e MUST alertar.
- **FR-018a**: O sistema MUST tratar como **falha de forma da fonte** (mesmo desfecho do FR-018), e não como
  mudança de tarifa: (i) valores-canário conhecidos que deixaram de bater, (ii) proporção de linhas alteradas acima
  de um teto declarado, (iii) coluna localizada por posição em vez de por cabeçalho. **O fail-safe atual só detecta
  parse vazio ou encolhido — não detecta um parser que leu a coluna errada e devolveu números plausíveis**, que é o
  modo de falha mais perigoso porque passa despercebido na revisão do PR.
- **FR-019a**: O sistema MUST comparar a **alíquota resolvida por nó** entre execuções, não apenas os campos das
  entradas, e MUST expor em seção própria do PR todo nó cuja alíquota efetiva mudou porque o marketplace **moveu a
  categoria de pai** — uma mudança de preço que não altera nenhum campo do artefato e por isso não apareceria no
  diff.
- **FR-026**: Dado inválido MUST NOT derrubar o aplicativo. A validação MUST ser fatal no gerador e no CI, e no
  cliente MUST degradar por marketplace (descartar o marketplace inválido e selar "sem referência"). Um defeito
  detectável no build **nunca** pode chegar ao vendedor como tela em branco.
- **FR-027**: O sistema MUST NOT resolver por posição no artefato. Sem determinantes e sem entrada com
  `determinants: null` explícita, o resultado MUST ser "sem referência" — o fallback posicional hoje existente
  (`entries[0]`) é removido, não ajustado.
- **FR-019**: O sistema MUST expor no PR, para decisão humana, toda categoria que desapareceu da fonte.
- **FR-020**: `lastReviewed` MUST avançar **somente** mediante reverificação real contra a fonte.
- **FR-020b** *(emendada 2026-08-01 — ver Clarifications)*: A janela de obsolescência MUST ser dimensionada como
  **ciclo do laço + folga de entrega**, e MUST continuar sendo medida contra `lastReviewed`. O alarme MUST significar
  "algo falhou" — o robô não releu, ou a leitura não foi entregue —, nunca "o ciclo está terminando".
  *Texto original, preservado porque o problema que ele nomeia é real e continua endereçado*: "a janela MUST ser
  medida contra a data em que o valor chegou ao usuário… sem isso, o selo acusa 'desatualizada' durante todo o
  intervalo entre a leitura e a entrega — **um falso positivo estrutural, todo mês, sobre valores corretos e
  reverificados**, que treina o vendedor a ignorar exatamente o alarme que a US5 existe para dar."
  *Por que a emenda*: mover o relógio para a entrega faria um número não-verificado há meses parecer fresco assim que
  chegasse a um aparelho novo — a mentira inversa, e maior. A causa do falso positivo era a janela ter o tamanho exato
  do ciclo, não o ponto de partida do relógio.
- **FR-020a**: O job MUST **sempre abrir PR** e MUST NOT escrever direto no branch de integração. A política
  dividida por classe de diff decide **apenas a dispensa de revisão**: um PR cujo diff seja **exclusivamente**
  `lastReviewed` MAY ser auto-mergeado; um PR que toque **qualquer campo de dinheiro** MUST aguardar revisão
  humana. O classificador MUST ser determinístico e, em qualquer dúvida ou erro, MUST **negar a dispensa** — o
  desfecho de falha é um PR esperando humano, nunca uma escrita. Uma execução que **falhou** em ler a fonte MUST
  NOT avançar `lastReviewed` de valor algum.
  *(Duas revisões acumuladas. A primeira trocou "todo mês abre PR" por commit direto de frescor, porque um PR
  quase-vazio recorrente treina o revisor a carimbar. A segunda — após o parecer T004 — tirou do robô o poder de
  **escrever**: com `develop` sem proteção, o classificador dentro do job era o único portão do artefato de
  dinheiro. Agora o classificador decide **dispensa de revisão**, não escrita, e há controle de plataforma atrás
  dele.)*
- **FR-020c**: O branch de integração MUST ter proteção de plataforma exigindo PR — o portão que protege um
  artefato de dinheiro MUST NOT depender exclusivamente de código que o próprio job executa. A dispensa de revisão
  para diffs de puro frescor é uma **exceção declarada** ao "nunca auto-merge" do ADR-0010 Q-A, cuja proibição foi
  escrita para o **artefato de dinheiro**; frescor não é dinheiro, e a exceção MUST ser registrada no ADR, não
  presumida.
- **FR-021**: O laço mensal MUST consumir **0 tokens de LLM**.
- **FR-022**: A falha da metade ML MUST NOT impedir a metade Amazon de funcionar, e vice-versa.

**Credenciais**

- **FR-023**: O refresh token do ML MUST NOT existir no repositório, no cliente, nem em variável de ambiente
  versionada.
- **FR-024**: A aplicação ML MUST operar com o mínimo de permissão medido, sem nenhuma permissão de escrita.
- **FR-025**: A ingestão MUST rodar em runner hospedado; o incremento MUST NOT introduzir runner self-hosted nem
  serviço de nuvem novo.

### Key Entities

- **Categoria de marketplace**: identidade publicada pelo próprio marketplace (identificador + nome + posição na
  árvore de pais/filhos). Vocabulário de cada marketplace, sem taxonomia interna unificada (Q12).
- **Entrada de tarifa**: a unidade de catálogo que casa com (marketplace, categoria, modalidade/plano) e carrega
  comissão, custo fixo, mínimo por item, faixas de preço quando houver, e a procedência completa.
- **Faixa de preço (`priceBands`)**: recorte por preço anunciado dentro de uma entrada, com fronteiras literais da
  fonte; é onde mora o furo de validação herdado do 013.
- **Selo de procedência/frescor**: o texto que diz ao vendedor de onde veio o número, a que categoria pertence, e se
  está desatualizado ou embutido.
- **Execução de atualização**: um ciclo do laço mensal, com seu resultado (mudou / inalterado / falhou), seu diff e
  sua data de coleta.
- **Intenção de canal salva**: a categoria escolhida, guardada junto do restante da intenção de canal (alcance
  conforme Q10).

---

## Success Criteria *(mandatory)*

- **SC-801**: Quando várias entradas casam com um slot, a **mais específica** vence, de forma determinística e
  independente da ordem no artefato — um catch-all de marketplace **nunca** encobre uma entrada de categoria.
- **SC-802**: **Nenhuma entrada pode pré-preencher comissão 0% sob selo de "referência"**, inclusive quando a
  comissão nula está dentro de uma faixa de preço. A rejeição acontece no parse/boot, ruidosamente.
- **SC-803**: 100% dos valores entregues carregam `sourceUrl` + `effectiveDate` + `lastReviewed`, e todo texto de
  selo **nomeia a categoria** do número.
- **SC-804**: Todo valor rastreia até uma fonte oficial lida neste incremento. **0** valores interpolados, **0** de
  agregador ou blog, **0** derivados de faixa publicada. Uma lacuna na fonte permanece lacuna no catálogo.
- **SC-805**: Uma atualização de catálogo, em qualquer camada, **nunca reduz cobertura**.
- **SC-806**: O job mensal **nunca faz merge** e **nunca publica** sozinho; falha de leitura, ou parse vazio ou
  encolhido além do limiar declarado, resulta em **nenhum** PR, artefato intocado e alerta.
- **SC-807**: `lastReviewed` avança **somente** por reverificação real; quando o laço para de funcionar, o selo de
  30 dias dispara e o vendedor lê "desatualizada".
- **SC-808**: Um vendedor que **não** escolhe categoria não fica pior do que antes do 014 — sem regressão em
  pré-fill, honestidade de selo ou comportamento offline.
- **SC-809**: Todas as garantias de aceite de E1–E6 passam inalteradas — calculadora offline gratuita, recomputação
  ao vivo do catálogo, kit D3/D6, **imutabilidade** de snapshot, cenário vivo/congelado, portão de entitlement,
  congelamento no lapso. Objetos salvos antes do 014 renderizam inalterados e sem categoria.
- **SC-810**: O orçamento de primeiro render se mantém: tamanho da semente embutida e custo de validação no boot
  ficam dentro de um orçamento declarado (números definidos pelo `arquiteto`); a primeira pintura offline da
  calculadora gratuita **não** regride.
- **SC-811**: A atualização mensal consome **0 tokens de LLM**, e portanto **não** gera linha em
  `docs/token-ledger.md`.
- **SC-812**: 100% dos valores ML vêm do caminho sancionado por OAuth — **0** de raspagem anônima, **0** de bot com
  sessão armazenada, **0** de agregador terceiro.
- **SC-813**: O incremento adiciona **R$ 0,00** de custo recorrente de infraestrutura e **nenhum** runner
  self-hosted.
- **SC-814**: Para toda categoria cuja fonte publica comissão **por parcela**, a comissão calculada pelo app
  **iguala** a da fonte em pelo menos três pontos de prova: **abaixo** do limiar, **no** limiar, e **acima** dele.
  Móveis a R$ 300,00 ⇒ R$ 40,00 (15%·200 + 10%·100), nunca R$ 30,00.
- **SC-815**: Um snapshot congelado ou cenário salvo **antes** desta correção MUST reproduzir o **mesmo** preço
  depois dela — a mudança é aditiva, e a ausência do discriminador preserva o significado gravado. Verificado com
  payload real de antes, não com fixture escrito depois.
- **SC-816**: A fila offline **nunca encolhe** exceto por sucesso confirmado ou remoção explícita do vendedor. Uma
  falha de **leitura** do armazenamento local MUST abortar a reescrita, nunca servir de base para ela — e uma
  resposta de erro que o cliente não consegue atribuir com certeza ao servidor MUST preservar a entrada. O
  armazenamento local é a **única** cópia da cotação gravada offline (ADR-0018).
- **SC-817**: Nenhum caminho de seleção de banda pode aplicar uma alíquota de banda que **não contém** o preço
  anunciado (SC-108). Quando o preço cai fora de toda banda publicada, o sistema MUST tratar o nível como **não
  precificado** — MUST NOT emprestar a tarifa da banda vizinha, que é preencher no cálculo a lacuna que a FR-014a
  proíbe preencher no catálogo.
- **SC-818**: Um valor gravado como resultado de recálculo MUST distinguir, no próprio registro, "repreçado hoje"
  de "reaproveitado de um congelamento anterior". Registro imutável (ADR-0019) não admite conserto pós-fato: a
  distinção existe no momento da gravação ou não existe nunca.

---

## Assumptions

- **A conta da casa do ML está provisionada** (`administrativo@truthsforge.com`) e sua aplicação OAuth existe com a
  permissão mínima medida. Decisão Q3 do dono, 2026-07-24; verificada em execução 2026-07-28.
- **Entrega dos dados = fetch-and-persist** (decisão Q1 do dono, rodada 1): o app busca e persiste, em vez de
  embutir tudo no bundle.
- **A Amazon não requer credencial alguma.** Sua tabela de comissões é pública, renderizada por JS, e o gate G2
  provou que renderiza idêntica de runner não-BR. A conta Amazon que o dono criou **não é usada** pelo pipeline.
- **O catálogo permanece gratuito e público** — **DECIDIDO em 2026-07-28** (Q4 fechada, ver §Clarifications).
  Nenhum portão premium novo é introduzido, o Princípio IV não é acionado por este incremento, e o ADR-0010 R3
  (catálogo servido sem autenticação) segue válido.
- **A cadência é mensal, dia 1, 06:00 UTC**, mirando `develop` (decisões QA5 e QA1 do dono, 2026-07-28).
- **Custódia do refresh token = GitHub Secrets sem write-back**, viável porque o gate G3 mediu que o ML rotaciona o
  token no uso **mas o antigo continua válido**. Pendente de ratificação do `seguranca` quanto a segredo em
  repositório público (QA2/QA3).
- **A fórmula canônica de precificação não muda.** `pricing-core` permanece a autoridade offline e o backend nunca
  recalcula.
- **`designer-ux` é dona da forma do seletor** (layout, busca vs drill-down, posição no slot); esta spec fixa apenas
  comportamento.
- **`arquiteto` define os números do orçamento de SC-810.**

---

## Perguntas em aberto → `/speckit-clarify`

Enumeradas por instrução explícita do dono (não resolver nesta etapa). As recomendações e confianças vêm do §10 do
scope brief; **Q1, Q3 e Q6 saíram desta lista por já estarem decididos**.

**Resolvidas**: Q2, Q5, Q7 (revisada), Q8, Q10, **Q4** (ver `## Clarifications`). **Já decididas
antes**: Q1, Q3, Q6.

**Restam 3, todas deferidas conscientemente** — nenhuma bloqueia o `/speckit-plan`, e as três primeiras têm
recomendação de alta confiança no brief:

| # | Pergunta | Recomendação do brief | Por que pode esperar |
|---|---|---|---|
| **Q9** | Base de comissão da Amazon inclui frete; a nossa não | (a) declarar, não modelar (~80%) | (b) seria mudança em `pricing-core`, que o escopo já marca como FORA. Decidir isto não altera o plano — altera só o texto da entrada. |
| **Q12** | Vocabulário: taxonomia unificada ou a de cada marketplace? | (a) a de cada marketplace, literal | (b) exigiria inventar uma taxonomia interna, também já marcada como FORA. |
| **Q11** | Entradas de conhecimento parcial / selos por campo (decide a US7) | (a) não — ou a entrada tem fonte completa, ou não entra | **A premissa caiu**: Q11 existia para salvar a US7, que só fazia sentido enquanto o ML estava bloqueado. Com a US6 desbloqueada, o caminho natural é descartar a US7 — mas o descarte é decisão do dono, não omissão. |

Duas decisões **não** são de produto e ficam com o `seguranca` (já enumeradas no parecer bloqueante): a ratificação
de segredo em repositório público (QA2/QA3). O G1 reduziu essa questão — o perigo específico era runner
self-hosted, que deixou de existir.
