# Feature Specification: Ingestão dinâmica mensal de tarifas (CI-first)

**Feature Branch**: `017-ingestao-mensal`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Ingestão dinâmica mensal de tarifas de marketplace (CI-first): o
incremento 017 constrói o loop GitHub Actions que coleta as tarifas públicas de Amazon e Shopee,
diffa contra o catálogo servido, e abre um PR mensal HONESTO para develop — pronto e disparável,
sem prometer o que não pode."

**Fontes autoritativas** (decisões dadas — esta spec NÃO as reabre):
`docs/product/017-ingestao-mensal-scope-brief.md` (brief do product-owner — stories e fatiamento) ·
`docs/homologacao/OBTENCAO-DINAMICA-DADOS.md` (o plano de obtenção POR DADO + as 7 decisões do dono
de 2026-08-05, D7 e D11 em particular) · `docs/adr/0010-marketplace-fee-catalog-architecture.md`
§A10/§A13 (arquitetura CI-first + gates G1/G2/G3 MEDIDOS) · `specs/014-fee-category-mapping/tasks.md`
(o que o 014 construiu e os resíduos absorvidos) · `specs/016-correcao-homologacao/dod-evidence.md`
§T057/§Polish (verbatims + follow-ups).

**A verdade central que esta spec carrega (risco R5 do brief)**: o loop **não dispara sozinho**
enquanto o corte de release estiver adiado — o `schedule` do GitHub roda a partir do branch DEFAULT
(`main`) e o arquivo só existirá em `develop`. O gatilho prático é o disparo manual. O 017 entrega
o loop **pronto e disparável**, provado por execução real — não "rodando sozinho".

---

## Clarifications

### Session 2026-08-07

- Q: Mês em que um coletor aborta e o outro tem mudança real — o que sai? → A: **PR PARCIAL,
  nomeando o abortado.** O marketplace abortado fica byte a byte intocado (fail-safe C6), seu
  `lastReviewed` envelhece até o selo de 45 dias (comportamento desejado), e o corpo o declara
  ABORTADO com o motivo. Um OCR frágil nunca congela o coletor sólido (é o corolário do FR-022
  que faltava escrever).
- Q: Convergência das duas fontes da Amazon — o robô pode propor a mudança? → A: **PR de DECISÃO,
  sem tocar dado.** O robô nunca propõe dinheiro lido da fonte vintage (/precos); se a fonte
  AUTORITATIVA (G200336920) mudar de verdade, o coletor normal já propõe o diff pelo caminho
  revisado. O vigia entrega o fato e a caneta; o dado só muda pela mão do dono.
- Q: OCR com guardas verdes mas divergência GRANDE contra o servido? → A: **PR normal com a
  divergência DESTACADA** (banner "divergência acima do limiar declarado — confira a imagem" +
  lido × anterior × link). Abortar suprimiria os dois casos de uma vez — o erro plausível E a
  mudança real grande, que é a que o dono mais precisa ver; sem PR, ninguém olha imagem nenhuma.
  O portão continua sendo o humano (D11).

---

## Pré-condições P0 *(medidas — quebram a primeira execução real se não vierem antes)*

- **P0-a** — O guarda do catálogo crava `catalogVersion` em STRING LITERAL
  (`apps/web/src/shared/fee-catalog/fee-catalog.test.ts:62-66`) e afirma paridade com a semente:
  o primeiro PR mensal nasceria VERMELHO no `gate:all` por construção, com o dado correto. Vira
  **relacional** ANTES de o loop existir (US7-AC2). MEDIDO, não hipótese.
- **P0-b** — `develop` não tem ruleset/proteção (404 + `[]`, medido no 014/T048a). Sem isso, a
  dispensa de revisão do `lastReviewed` não é exceção a portão nenhum — é o ÚNICO portão. Tarefa
  **do dono** (configuração de repositório), em paralelo; ver Q5.
- **P0-c** — As condições do parecer de segurança que valem SEM credencial (014/T069b):
  `allowed_actions`, `sha_pinning_required`, scanner de segredos pinado, e CI independente sobre o
  PR mensal (um PR aberto com o token padrão do CI **não dispara** os checks — o loop valida antes).
  *Correção medida (2026-08-07, research R6)*: `sha_pinning_required` e o trufflehog pinado **JÁ
  existem e rodam**; resta de fato `allowed_actions` (configuração de repositório — dono) e o CI
  independente, atendido pelo `gate:artifact` dentro do job (arquitetura decisão D).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O loop existe como workflow e o dono consegue dispará-lo (Priority: P1)

Como dono, quero um workflow que eu possa disparar à mão e que, quando o corte de release
acontecer, passe a rodar sozinho — sem que eu precise lembrar dele todo mês.

**Why this priority**: é a única story que transforma "lógica testada" (o 014 já tem orquestrador
e coletor) em "loop que roda". Sem ela o incremento não existe.

**Independent Test**: UMA EXECUÇÃO REAL disparada à mão, com URL da run, terminando em PR ou em
abortagem nomeada — sem execução real, a US não fecha (lição 014/US4).

**Acceptance Scenarios**:

1. **Given** o repositório, **When** o workflow mensal existe, **Then** ele tem agendamento
   (dia 1, 06:00 UTC) E disparo manual, e o CABEÇALHO do arquivo declara em texto que, enquanto
   não chegar ao branch default por um corte de release, o loop NÃO dispara sozinho — um leitor
   do arquivo não pode sair achando que o loop está vivo.
2. **Given** dois coletores no mesmo loop, **When** um deles falha, **Then** o outro conclui
   (jobs independentes por marketplace — FR-022) — provado por uma execução real em que um aborta
   e o outro conclui.
3. **Given** um artefato candidato coletado, **When** o job decide abrir o PR, **Then** ele VALIDA
   antes: schema, cobertura de bandas, colisão de categoria, a propriedade de dominância de banda
   e a paridade semente↔artefato — um artefato que não passa NÃO vira PR.
4. **Given** o PR mensal, **When** aberto, **Then** mira `develop` e o job NUNCA faz merge de
   dinheiro; a dispensa de revisão só se aplica a um diff exclusivamente `lastReviewed`
   (classificador falha-fechado) e NASCE DESLIGADA enquanto P0-b não estiver satisfeita.
5. **Given** o arquivo do workflow, **When** auditado por teste, **Then** contém ZERO referência a
   segredos além do token padrão do CI — afirmado por teste, não por revisão (a credencial do ML
   não pode entrar de carona numa fatia futura).

---

### User Story 2 - O relatório mensal não mente (Priority: P1)

Como revisor de um PR de dinheiro, quero um corpo de PR em que a AUSÊNCIA de mudança seja tão
explícita quanto a presença — e que diga o que NÃO foi lido.

**Why this priority**: um relatório desonesto não é defeito de acabamento — é o produto inteiro
do loop. O 014/US4 já pagou este defeito ("Sem mudança de tarifa" impresso acima de "Categorias
removidas da fonte", com todos os testes afirmando presença e nenhum afirmando ausência).

**Independent Test**: execução sem mudança → corpo SEM seções de mudança (teste afirma AUSÊNCIA);
execução com mudança → cada folha alterada como `antigo → novo` com fonte e data.

**Acceptance Scenarios**:

1. **Given** uma execução sem mudança de tarifa, **When** o corpo do PR é gerado, **Then** ele NÃO
   contém nenhuma seção de mudança — e o teste afirma a ausência, não a presença.
2. **Given** uma execução com mudanças, **When** o corpo é gerado, **Then** cada folha de dinheiro
   alterada aparece como `antigo → novo`, por categoria, com a URL da fonte e a data de coleta.
3. **Given** o loop cobrindo N marketplaces, **When** o corpo é gerado, **Then** declara POR
   MARKETPLACE um de três estados: **LIDO** (com data) · **ABORTADO** (com motivo nomeado) ·
   **NÃO LIDO** (com o porquê — ex.: "Mercado Livre: sem credencial, fora do escopo do 017"). Um
   relatório que cobre um marketplace e cala sobre os outros é um relatório falso.
4. **Given** a tabela do PR e o classificador de dispensa, **When** um campo inerte muda de lista,
   **Then** os dois leem A MESMA lista (absorve 014/U4-f — hoje duplicada em dois arquivos;
   inofensiva com um marketplace, viva com dois).

---

### User Story 3 - A Amazon relê a própria tabela dentro do CI (Priority: P1)

Como dono, quero que a tabela de 38 categorias da Amazon seja relida por um robô no runner, e não
pela minha máquina quando eu lembro.

**Independent Test**: o coletor existente roda no runner hospedado (navegador headless em versão
pinada) e conclui com PR ou ABORT nomeado; as linhas capturadas sobem como artefato da run.

**Acceptance Scenarios**:

1. **Given** o coletor Amazon do 014 (headless, sem credencial — G2 medido 2×), **When** roda no
   runner hospedado, **Then** conclui com PR ou ABORT nomeado.
2. **Given** bloqueio de bot, CAPTCHA ou mudança de layout, **When** a coleta falha, **Then**
   produz ABORT com o status HTTP e o motivo — NUNCA uma mudança de tarifa; as canárias (Roupas
   14% · Calçados 14% · Relógios 13%), o piso de linhas e a coluna localizada POR CABEÇALHO
   continuam valendo.
3. **Given** qualquer execução (sucesso ou falha), **When** termina, **Then** as linhas capturadas
   sobem como artefato da run — um mês quebrado é diagnosticável sem reexecutar contra a fonte.
4. **Given** uma execução a partir de fixture, **When** o catálogo é gerado, **Then** `lastReviewed`
   NÃO avança — a data só avança quando a página foi realmente relida.
5. **Given** a premissa de custo do ADR-0010 (~5 min/mês), **When** a execução real roda, **Then**
   o tempo/minutos faturados ficam MEDIDOS na evidência.

---

### User Story 4 - O vigia da /precos — fecha a metade aberta do D7 (Priority: P2)

Como dono, decidi manter R$ 1,00 e vigiar; quero saber no mês em que as duas fontes oficiais da
Amazon deixarem de divergir — ou em que o piso mudar.

**Independent Test**: fetch simples (sem navegador — medido: HTTP 200) + parser determinístico
capturando mínimos por categoria e tarifas de plano; o loop NUNCA escreve `minPerItem` a partir
da /precos.

**Acceptance Scenarios**:

1. **Given** a página /precos, **When** o vigia coleta, **Then** captura a comissão mínima por
   categoria E as tarifas de plano (Individual R$ 2,00/item; Profissional R$ 19/mês) por fetch
   simples com parser determinístico.
2. **Given** a decisão D7, **When** o vigia encontra divergência, **Then** REPORTA (as ~11
   categorias em que a /precos imprime R$ 2,00 contra o R$ 1,00 uniforme da tabela vigente, e
   qualquer mudança de qualquer lado contra o mês anterior) e NUNCA escreve `minPerItem`.
3. **Given** o relatório de divergência, **When** impresso, **Then** carrega a AUTO-DATAÇÃO da
   página ("comissões atualizadas em 20/01/2025") junto do valor — é ela que classifica a fonte
   como vintage, e o revisor precisa dela na mesma tela.
4. **Given** as duas fontes convergindo (ambas 2,00, ou a tabela vigente mudando), **When** o
   vigia detecta, **Then** o PR é marcado como PEDIDO DE DECISÃO DO DONO e não altera dado nenhum
   (clarify Q2 — resolvido: o robô nunca propõe dinheiro da fonte vintage; a mudança da fonte
   autoritativa chega pelo coletor normal, revisado).
5. **Given** a tarifa do plano Individual (fixedFee 2,00 nas 39 entradas, verbatim de 2026-08-06),
   **When** ela mudar na fonte, **Then** a mesma seção de divergência dispara.

---

### User Story 5 - Shopee: detector determinístico + OCR com as guardas decididas (Priority: P2)

Como dono, escolhi OCR no loop (D11); quero que um número mal lido falhe ALTO em vez de entrar
calado no preço.

**Independent Test**: detector content-addressed (0 tokens) gate o OCR; as 4 guardas conjuntivas;
um PNG deliberadamente corrompido é pego por pelo menos uma guarda — PROVADO POR MUTAÇÃO.

**Acceptance Scenarios**:

1. **Given** os PNGs públicos do art. 26839, **When** o detector roda, **Then** URLs/bytes são
   content-addressed — URL nova ou bytes novos = "tabela nova"; SEM sinal de mudança, o OCR NÃO
   roda (0 tokens no caminho comum).
2. **Given** o texto do artigo (SPA — espera por conteúdo, nunca networkidle; medido em T057),
   **When** diffado, **Then** as ÂNCORAS PINADAS valem: a frase do CNPJ < R$ 8 ("o adicional por
   item é a metade do preço do produto") · a do +R$ 3 (CPF > 450 pedidos/90 dias) · os dois pontos
   regressivos (R$ 10 → R$ 6,50; R$ 8 → R$ 6,00) · a AUSÊNCIA de "mínimo/piso" (0 ocorrências
   hoje). Âncora que sumiu = ABORT.
3. **Given** um resultado de OCR, **When** avaliado, **Then** só é aceito se passar TODAS as
   guardas conjuntivas: asserção de forma (nº de faixas; toda célula parseável em formato BR) ·
   faixa de sanidade 5–25% de comissão · não-contradição com as âncoras de texto · cobertura de
   bandas. Qualquer guarda reprovada = ABORT, sem PR, artefato intocado.
4. **Given** um PNG deliberadamente corrompido (um dígito trocado mantendo o valor plausível),
   **When** o pipeline roda, **Then** pelo menos uma guarda o pega — PROVADO POR MUTAÇÃO, não
   afirmado.
5. **Given** todas as guardas verdes e um diff que toca dinheiro, **When** o PR abre, **Then**
   NUNCA dispensa revisão, e o corpo imprime os valores lidos AO LADO dos anteriores E do link da
   imagem — sem isso, a revisão humana de um OCR é teatro (a quantificação honesta do brief: as
   guardas pegam ~35% do erro plausível de célula única; o portão real é o humano). E quando a
   divergência ultrapassa um limiar declarado, o corpo ganha um BANNER destacado mandando conferir
   a imagem — nunca um abort silencioso (clarify Q8: abortar suprimiria também a mudança real
   grande, a que o dono mais precisa ver).
6. **Given** a regressiva CPF < R$ 12 (D12 — aviso honesto do 016), **When** o vigia lê o artigo,
   **Then** ela continua NÃO modelada; o vigia apenas avisa se a Shopee publicar a fórmula.

---

### User Story 6 - Mercado Livre sem credencial: vigiar o público, escrever NADA (Priority: P2)

Como dono, não vou entregar o token agora; quero mesmo assim saber no mês em que a regra do ML
mudar.

**Independent Test**: três vigias textuais + o releitor das tabelas de frete comparando com
baseline datado; NENHUM caminho escreve no catálogo servido.

**Acceptance Scenarios**:

1. **Given** as fontes públicas do ML, **When** o vigia roda, **Then** três vigias PURAMENTE
   textuais com URL e data: (a) a doc de developers do custo fixo/comissão (estática; inclui a
   linha "Última atualização em") · (b) a página de vendedores com a regra dos 50% abaixo de
   R$ 12,50 · (c) a sentinela da cubagem (divisor 6000, sobre o texto oficial).
2. **Given** as três tabelas de frete por reputação (medidas em 2026-08-05: 3 × 29 × 8 = 696
   células, 0 divergências), **When** relidas, **Then** o parser determinístico compara com um
   BASELINE DATADO E VERSIONADO em `packages/fee-ingest/data/` (clarify Q1 — o alerta diz quais
   células mudaram e o E3 herda o insumo), com a guarda de forma 29 × 8 e o limiar de R$ 79 nos
   cabeçalhos obrigatórios.
3. **Given** qualquer vigia do ML, **When** detecta mudança, **Then** a saída é ALERTA + baseline
   atualizado — NENHUM escreve no catálogo servido (o ML tem 0 entradas; o eixo de frete é do E3;
   o custo fixo pós-reforma depende do token).
4. **Given** o relatório mensal, **When** menciona o ML, **Then** diz com todas as letras que o ML
   está NÃO LIDO quanto a comissão por categoria e valores de custo fixo, e por quê — ninguém pode
   ler "ML vigiado" como "ML atualizado".

---

### User Story 7 - As datas do catálogo dizem a verdade sobre o que foi relido (Priority: P2)

Como vendedor, quero que "atualizado em" signifique que alguém realmente olhou a fonte.

**Independent Test**: só é testável com DOIS coletores no mesmo loop (com um, "avança só no que
foi lido" é indistinguível de "avança sempre") — por isso viaja na fatia do segundo coletor.

**Acceptance Scenarios**:

1. **Given** uma execução sem mudança de valor, **When** o catálogo é regravado, **Then**
   `lastReviewed` avança APENAS nas entradas dos marketplaces efetivamente coletados NAQUELA
   execução; um marketplace abortado ou não-lido mantém a data antiga — e envelhece até o selo de
   45 dias falar com o vendedor, que é o comportamento DESEJADO.
2. **Given** o P0-a, **When** a paridade semente↔artefato é guardada, **Then** o guarda afirma a
   RELAÇÃO entre os dois documentos (nunca uma string de versão fixada à mão); `catalogVersion`
   continua decidido pelo sequenciador, nunca à mão.
3. **Given** a decisão da Q3 (resolvida: o loop REGENERA a semente junto do artefato), **When**
   uma execução muda o catálogo, **Then** as duas cópias saem no mesmo PR em paridade estrita, e o
   ramo de cache latente de adoção (014/U5-b) entra em uso COM teste.
4. **Given** o loop inteiro, **When** roda, **Then** NENHUM caminho grava `lastReviewed` sem
   releitura real, e a execução NÃO gera linha no token-ledger (SC-811, verificado).

---

### User Story 8 - Runbook e recibo da execução (Priority: P3)

**Independent Test**: o dono lê a saúde do loop em 30 segundos, sem abrir logs.

**Acceptance Scenarios**:

1. **Given** `docs/runbooks/fee-refresh.md`, **When** lido, **Then** ensina: disparar à mão, ler o
   resumo, o que significa vermelho, o que fazer quando o OCR aborta, como reexecutar — e a frase
   explícita de que ATÉ O CORTE DE RELEASE O LOOP É MANUAL.
2. **Given** cada execução, **When** termina, **Then** escreve um resumo de job com o estado por
   marketplace (LIDO / ABORTADO / NÃO LIDO) e o link da fonte.
3. **Given** o runbook, **When** nomeia limites, **Then** diz o que o 017 NÃO cobre e quem herda
   (ML com token → fatia gateada; frete → E3).

---

### Edge Cases

- Execução em que UM coletor aborta e o outro muda dado → o desfecho do PR é a Q4 do clarify
  (parcial nomeando o abortado, ou nenhum PR).
- Fonte respondendo 200 com corpo vazio/casca de SPA → canária de forma pega; ABORT, nunca "as
  taxas caíram" (fail-safe C6).
- PNG da Shopee com URL nova mas bytes idênticos (re-upload) → o detector content-addressed usa
  bytes, não só URL; sem mudança real, OCR não roda.
- Âncora de texto do art. 26839 reescrita sem mudança de valor (copyedit) → ABORT do vigia de
  texto (âncora sumiu) — falso positivo aceitável; o runbook ensina a re-pinar.
- Execução dupla no mesmo dia (dispatch manual + schedule futuro) → o PR é idempotente (mesmo
  artefato ⇒ mesmo diff ⇒ nenhum PR duplicado aberto).
- A dispensa de `lastReviewed` com um diff que TAMBÉM toca dinheiro → classificador falha-fechado:
  qualquer folha não-inerte no diff ⇒ revisão obrigatória.
- O guarda relacional (P0-a) num mês em que o loop NÃO rodou → paridade continua verde (a relação
  não depende de valores absolutos).

## Requirements *(mandatory)*

### Functional Requirements

**O loop (US1/US2)**

- **FR-1001**: O sistema MUST ter um workflow mensal (agendado dia 1 06:00 UTC + disparável à mão)
  cujo cabeçalho declara que ele não dispara sozinho até o corte de release; jobs independentes
  por marketplace; PR mirando `develop`; nunca auto-merge de dinheiro.
- **FR-1002**: O job MUST validar o artefato candidato ANTES de abrir o PR (schema, bandas,
  colisões, dominância de banda, paridade semente↔artefato); artefato reprovado não vira PR.
- **FR-1003**: O workflow MUST conter zero segredos além do token padrão do CI, afirmado por teste.
- **FR-1004**: O corpo do PR mensal MUST asserir AUSÊNCIA (execução sem mudança = corpo sem seções
  de mudança, testado por ausência) e declarar por marketplace: LIDO/ABORTADO/NÃO LIDO com
  motivo; mudanças aparecem como `antigo → novo` com fonte e data de coleta.
- **FR-1005**: A tabela do PR e o classificador de dispensa MUST ler a mesma lista de campos
  inertes (uma lista, um lugar — absorve 014/U4-f).
- **FR-1006**: A dispensa de revisão MUST aplicar-se somente a diff exclusivamente `lastReviewed`
  (falha-fechado) e MUST nascer desligada enquanto o ruleset de `develop` (P0-b) não existir.

**Coletores e vigias (US3–US6)**

- **FR-1007**: O coletor Amazon MUST rodar no runner hospedado com navegador pinado; falha de
  fonte (bot/CAPTCHA/layout) MUST produzir ABORT nomeado com status, nunca mudança de tarifa; as
  linhas capturadas MUST subir como artefato da run; canárias e localização de coluna por
  cabeçalho preservadas.
- **FR-1008**: O vigia da /precos MUST capturar mínimos por categoria + tarifas de plano por fetch
  simples determinístico, MUST reportar divergência (incluindo a auto-datação da página) e MUST
  NOT escrever `minPerItem` (D7); convergência das duas fontes MUST virar pedido de decisão do
  dono sem alterar dado.
- **FR-1009**: O pipeline Shopee MUST: (a) gate por detector content-addressed (URL+bytes; sem
  mudança, OCR não roda); (b) diffar o texto com as âncoras pinadas do T057 (âncora sumida =
  ABORT); (c) aceitar OCR somente com TODAS as guardas conjuntivas (forma · sanidade 5–25% ·
  não-contradição com âncoras · cobertura de bandas); (d) provar por MUTAÇÃO que um dígito
  trocado plausível é pego; (e) nunca dispensar revisão quando o diff toca dinheiro, com o corpo
  imprimindo lido × anterior × link da imagem.
- **FR-1010**: Os vigias do ML MUST ser puramente textuais + o releitor de frete contra baseline
  datado (guarda de forma 29×8 + limiar R$ 79); MUST NOT escrever no catálogo servido; o
  relatório MUST declarar o ML como NÃO LIDO quanto a comissão/custo fixo, com o porquê.

**Datas e paridade (US7)**

- **FR-1011**: `lastReviewed` MUST avançar apenas nas entradas de marketplaces efetivamente
  relidos na execução; execução de fixture nunca carimba data; nenhuma linha no token-ledger.
- **FR-1012**: O guarda de paridade semente↔artefato MUST ser relacional (P0-a) — nenhuma string
  de versão fixada à mão; `catalogVersion` sempre pelo sequenciador.

**Operação (US8)**

- **FR-1013**: O runbook MUST existir com o modo de operação manual explícito; cada execução MUST
  escrever resumo de job com estado por marketplace e link de fonte.

### Key Entities

- **Execução mensal**: uma corrida do loop — estado por marketplace (LIDO/ABORTADO/NÃO LIDO),
  artefatos de diagnóstico, resumo de job, e no máximo UM PR.
- **PR mensal**: o produto do loop — diff do catálogo + relatório honesto; nunca se auto-mergeia
  quando toca dinheiro.
- **Baseline de vigia**: o registro datado do último estado lido de uma fonte que NÃO alimenta o
  catálogo (frete ML, textos) — onde mora é a Q1.
- **Detector content-addressed**: URL+bytes dos PNGs da Shopee; o gate de 0 tokens do OCR.
- **Classificador de dispensa**: a única lista de campos inertes, compartilhada com a tabela do
  relatório; falha-fechado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-1001**: Existe UMA execução real disparada à mão, com URL, terminando em PR ou ABORT
  nomeado — antes do fechamento da primeira fatia (US1/lição 014-US4).
- **SC-1002**: Numa execução de teste sem mudança, o corpo do PR contém ZERO seções de mudança
  (asserido por ausência); numa com mudança, 100% das folhas alteradas aparecem como
  `antigo → novo` com fonte+data.
- **SC-1003**: O estado por marketplace (LIDO/ABORTADO/NÃO LIDO) aparece em 100% dos corpos de PR
  e resumos de job — incluindo o ML como NÃO LIDO com o porquê.
- **SC-1004**: Um artefato que reprova qualquer validação NUNCA vira PR (teste de cada guarda);
  falha de fonte NUNCA produz mudança de tarifa (fail-safe C6).
- **SC-1005**: O teste estrutural de segredos passa: zero `secrets.` além do token padrão.
- **SC-1006**: A mutação do PNG (dígito plausível trocado) é pega por ≥1 guarda em 100% das
  rodadas do teste de mutação; o OCR não roda quando o detector não sinaliza mudança.
- **SC-1007**: `lastReviewed` de marketplace não-relido permanece intacto numa execução real
  parcial; o guarda relacional de paridade fica verde num mês COM e num mês SEM execução.
- **SC-1008**: O primeiro PR mensal real nasce com o `gate:all` VERDE (P0-a fechada — hoje
  nasceria vermelho por construção, medido).

## Assumptions

- **DECIDIDO pelo dono (2026-08-07)**: o A2 do 016 (frete BAND_VOUCHER R$ 20 num campo R$ 0,00,
  ALTA) é **hotfix separado cortado de develop ANTES da PR-A**, com o A3 (sessão expirada) viajando
  junto e Clarification datada na spec 005 — conforme a recomendação do PO.
- **DECIDIDO pelo dono (2026-08-07)**: o E6 PR-C roda **EM PARALELO** ao 017 (domínios disjuntos:
  billing vs fee-ingest/CI), cada PR gateado pelo dono como sempre.
- O orquestrador puro do 014 (`RefreshOutcome` de 2 casos, FR-020a) e o coletor Amazon são a base;
  o 017 não os reescreve, os aciona do CI.
- Resíduos do 014 absorvidos: T049/T050 (o YAML), T048a (P0-b, tarefa do dono), T069b (P0-c),
  U4-f (US2), U5-b (US7). Todo o resto do 014 fica onde está, com dono declarado no brief §6.7.
- Tesseract (OCR) conta como 0 tokens de LLM (SC-811); o custo por execução é medido (US3).
- O dono configura o ruleset de develop (P0-b) fora do repositório; até lá a dispensa nasce
  desligada (ver Q5).

## Fora de escopo (explícito)

1. **US6-ML com o token da casa** — nenhuma credencial, nenhum segredo, nenhuma chamada
   autenticada. Gateada pelas 8 condições do parecer do `seguranca` + autorização separada do
   dono, que não vem de um "continue". As condições que só nascem com o ML (segredo em
   Environment, separação coleta/publicação) ficam com aquela fatia.
2. **Ingerir o frete do ML no catálogo** — o eixo é do E3; o 017 vigia e guarda baseline.
   **ADR-0025 permanece Proposto** (adiado com a parte ML, dono 2026-08-05).
3. **D10 (schema do custo fixo ML)** — sem token não há dado; mudança estrutural do domínio de
   preço (escalação opus) fica com a fatia ML.
4. **O corte de release para `main`** — decisão adiada até a v1; o 017 não a move.
5. **Runner self-hosted, provisionamento GCP, auto-merge de dinheiro** — decididos contra.
6. **Mudar `minPerItem` para 2,00** (D7 = manter + vigiar) e **modelar a regressiva CPF < R$ 12**
   (D12 = aviso honesto, entregue no 016).
7. **A2/A3 do 016** — não são ingestão; recomendação do PO nas Assumptions (hotfix separado).
8. **OCR de qualquer coisa além dos PNGs da Shopee.**

## Perguntas do clarify — TODAS RESOLVIDAS (8/8)

**Sessão 1 (2026-08-07): Q2·Q3·Q4·Q5·Q8 · Sessão 2 (mesma data): Q1·Q6·Q7.** Respostas na seção
Clarifications e nos FR/US afetados. A tabela fica como registro.

| # | pergunta | o que muda |
| --- | --- | --- |
| ~~Q1~~ | ~~Baseline ML?~~ **RESOLVIDA (clarify 2026-08-07, sessão 2): arquivo datado versionado em packages/fee-ingest/data/ — o E3 herda o insumo** | ver Clarifications |
| ~~Q2~~ | ~~Convergência?~~ **RESOLVIDA (clarify 2026-08-07): PR de decisão, sem tocar dado — o robô nunca propõe dinheiro da fonte vintage** | ver Clarifications |
| ~~Q3~~ | ~~Semente?~~ **RESOLVIDA (clarify 2026-08-07): regenera AS DUAS no mesmo PR — paridade estrita, U5-b acorda com teste** | ver Clarifications |
| ~~Q4~~ | ~~Aborto parcial?~~ **RESOLVIDA (clarify 2026-08-07): PR PARCIAL nomeando o abortado** | ver Clarifications |
| ~~Q5~~ | ~~Ruleset/dispensa?~~ **RESOLVIDA (clarify 2026-08-07): AS DUAS — ruleset (tarefa do dono, paralela) + dispensa nascendo desligada** | ver Clarifications |
| ~~Q6~~ | ~~Validação do job?~~ **RESOLVIDA (clarify 2026-08-07, sessão 2): subconjunto do artefato no job; o gate:all vem do CI independente do P0-c** | ver Clarifications |
| ~~Q7~~ | ~~Mês perdido?~~ **RESOLVIDA (clarify 2026-08-07, sessão 2): checagem não-bloqueante no ci.yml (>35 dias) — carona na atividade real, sem depender do schedule** | ver Clarifications |
| ~~Q8~~ | ~~OCR verde divergente?~~ **RESOLVIDA (clarify 2026-08-07): PR normal com banner de divergência destacado — nunca abort silencioso** | ver Clarifications |
