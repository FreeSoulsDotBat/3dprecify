# Tasks: Mapeamento categoria→comissão (ML + Amazon) com atualização mensal

**Spec**: [spec.md](./spec.md) · **Plano**: [plan.md](./plan.md) · **Medições**: [research.md](./research.md)
**Contratos**: [contracts/category-tree.md](./contracts/category-tree.md) · **Validação**: [quickstart.md](./quickstart.md)

**Tests**: MANDATORY per Constitution Principle III (Test-First, NON-NEGOTIABLE) — lógicos **e** visuais. Cada teste
é escrito e **observado falhando** antes da implementação. A alíquota por categoria é domínio de dinheiro: leva
casos numéricos explícitos, com os valores reais medidos em 2026-07-28.

## Format: `[ID] [P?] [Story] Description`

`[P]` = paralelizável (arquivo diferente, sem dependência pendente). `[US#]` só nas fases de história.

## Path Conventions

`apps/web/src/…` (cliente) · `backend/app/…` (serve dados) · `.github/workflows/…` (laço mensal) ·
`packages/fee-ingest/` = a ingestão (pacote de workspace, D1 decidido em 2026-07-28).

---

## Phase 0: Decisões bloqueantes (Princípio VIII) ⛔

> **D1 e D2 foram decididos em 2026-07-28** (após a revisão adversarial) e 25 tarefas destravaram. **D3 segue
> aberta** — a fatia ML (Fase 8) continua parada. T001 deixou de ser pré-condição de D2 e passa a ser a medição que
> dimensiona a espinha e valida a compressão em 100% dos nós (T057).

- [ ] T001 Varrer a árvore de categorias ML **completa, uma vez**, guardando a alíquota **de cada nó**, e reportar: total de nós, nós cuja alíquota **diverge do pai**, tamanho em bytes da árvore completa vs comprimida, e a **taxa de divergência por nível de profundidade** — a medição de fase 0 amostrou 96 filhos de **profundidade 1**; os níveis 2–4 têm n=3, então a direção se sustenta mas a magnitude **não está medida** — script descartável em `scripts/probes/t001-ml-tree-census.mjs`
- [x] T002 ✅ DECIDIDO 2026-07-28 — **D1 = `packages/fee-ingest`**: onde mora o código de ingestão (`plan.md` §Decisões estruturais pendentes) — registrar em `docs/decisions/tech-stack-decisions.md`
- [x] T003 ✅ DECIDIDO 2026-07-28 — **D2 = espinha no `catalog.json` + nomes sob demanda**: como a árvore de nomes chega ao cliente, **à luz de T001** — inclui resolver a contradição declarada entre a opção (a) e a US1 AS5 ("o seletor nunca exige rede") — registrar em `docs/decisions/tech-stack-decisions.md`
- [x] T004 ✅ **PARECER EMITIDO 2026-07-28 — LIBERA COM CONDIÇÕES (88%)**, 8 condições verificáveis, nenhuma dependente da visibilidade do repo (adendo em `seguranca-ci-first.md`). Ratificação **D3** do `seguranca` + dono: refresh token do ML em GitHub Secrets com o repositório público (QA2/QA3) — registrar como adendo em `specs/014-fee-category-mapping/seguranca-ci-first.md`

**Checkpoint**: T002+T003 ✅ liberaram da Fase 1 à Fase 7 e a Fase 9. **T004 continua bloqueando apenas a Fase 8 (ML)** + T069b.

---

## Phase 1: Setup

- [x] T005 Criar o pacote de workspace da ingestão, com `package.json`/tsconfig conforme o padrão do monorepo — em `packages/fee-ingest/`
- [x] T006 [P] Adicionar `playwright` como dependência **apenas da ingestão** (a página da Amazon é JS-renderizada — R3), sem tocar nas dependências de `apps/web` — em `packages/fee-ingest/package.json`
- [ ] T007 [P] Registrar a fronteira do `packages/fee-ingest` no `dependency-cruiser` e no `import-linter`, para que ela **não** possa importar de `apps/web` nem do `backend` — em `.dependency-cruiser.cjs`

---

## Phase 2: Foundational (bloqueia TODAS as histórias) ⚠️

> Esta fase é o motor da US2 e a correção de dois defeitos que já existem. Nada nas histórias funciona antes dela.

### Testes (escritos e observados falhando primeiro)

- [x] T008 [P] Teste: `resolveEntry` é **independente da ordem** — embaralhar `entries` não altera nenhuma resolução (SC-801) — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T009 [P] Teste: resolução sobe a cadeia de ancestrais — categoria sem entrada própria herda do **ancestral mais próximo**, com os números medidos (Celulares e Telefones 18%, Celulares e Smartphones **16%**, neto sem entrada → 18%) — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T010 [P] Teste: duas entradas com conjunto de determinantes **idêntico** são **erro de parse** — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T011 [P] Teste: entrada com `commissionPct: null` cujas **bandas** também têm comissão nula é **rejeitada no parse** (SC-802, o furo herdado do 013) — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T012 [P] Teste: árvore com `parentId` órfão, e árvore com **ciclo**, são erro de parse (um ciclo travaria a resolução em laço infinito) — em `apps/web/src/shared/fee-catalog/category-tree.test.ts`
- [x] T013 [P] Teste: `category` em `determinants` que não existe na árvore é erro de parse — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T013a [P] Teste: slot **sem determinantes** (modalidade vazia, como em cenários e kits salvos antes do 014) resolve para `null` + "sem referência", e **não** para `entries[0]` — o fallback posicional de `fee-catalog.ts:111` hoje entregaria a alíquota de uma categoria arbitrária sob selo "referência" (FR-027) — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T013b [P] Teste: semente embutida inválida **degrada por marketplace** e não derruba o boot — hoje `use-fee-catalog.ts:14` valida no module load com `.parse()` que lança, o que vira tela branca assim que a semente passar a ser gerada por robô (FR-026) — em `apps/web/src/shared/fee-catalog/use-fee-catalog.test.ts`
- [ ] T013c [P] Teste: **não-regressão** de quem NÃO escolhe categoria — o caminho sem categoria entrega o mesmo resultado de antes do 014 em pré-fill, selo e comportamento offline (SC-808, hoje sem nenhuma tarefa) — em `apps/web/src/features/calculator/fee-prefill.test.ts`

### Implementação

- [x] T014 Criar o módulo da árvore: forma achatada (`id`/`name`/`parentId`), schema Zod com as invariantes de T012, cadeia de ancestrais e busca por texto — em `apps/web/src/shared/fee-catalog/category-tree.ts`
- [x] T015 Estender o guard F3 ao **nível de banda**: uma entrada só é válida se a comissão existir no topo **ou** em todas as bandas (SC-802/FR-008) — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T016 Reescrever `resolveEntry` como caminhada pela cadeia de ancestrais, substituindo o `.find()` que hoje vence por ordem de array (R6) — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T017 Adicionar validação de determinantes duplicados e de `category` órfã ao parse do catálogo — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T017a Remover o fallback posicional `?? mk.entries[0]` — sem determinantes e sem entrada `determinants: null` explícita, o resultado é `null` (FR-027) — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T017b Política de validação **por camada**: fatal no gerador e no CI; no cliente, degradar por marketplace em vez de lançar no carregamento do módulo (FR-026) — em `apps/web/src/shared/fee-catalog/use-fee-catalog.ts`
- [x] T017d Registrar no **ADR-0010** a exceção declarada ao Q-A ("nunca auto-merge"): a dispensa vale **apenas** para diffs de puro frescor, porque a proibição foi escrita para o artefato de dinheiro — em `docs/adr/0010-marketplace-fee-catalog-architecture.md`
- [x] T017c Registrar como **adendo ao ADR-0010** a mudança de semântica da resolução (casamento por subconjunto → por cadeia de ancestrais): store persistido e sementes escritos sob a regra antiga continuam válidos como forma e podem resolver diferente — em `docs/adr/0010-marketplace-fee-catalog-architecture.md`
- [x] T018 Exportar o módulo da árvore no barril do pacote — em `apps/web/src/shared/fee-catalog/index.ts`

**Checkpoint**: catálogo resolve por categoria, de forma determinística, e recusa dados que mentiriam.

---

## Phase 3: User Story 2 — o pré-fill resolve pela categoria (P1, FUNDACIONAL) 🎯 MVP

**Objetivo**: a busca de tarifa passa a **usar** a categoria; sem isso o mapa existe e ninguém o alcança.
**Teste independente**: com uma entrada chaveada por categoria, resolver um slot e ver o selo nomear a categoria.

### Testes ⚠️

- [x] T019 [P] [US2] Teste: `slotDeterminants` emite `category` quando há categoria escolhida, e a omite quando não há — em `apps/web/src/features/calculator/fee-prefill.test.ts`
- [x] T020 [P] [US2] Teste: sem categoria escolhida em marketplace **com** catch-all publicado (Amazon "Outros" 15%) → pré-preenche o catch-all, selo "categoria não informada" (Q5) — em `apps/web/src/features/calculator/fee-prefill.test.ts`
- [x] T021 [P] [US2] Teste: sem categoria escolhida em marketplace **sem** catch-all publicado (ML) → `null` + selo "sem referência"; o sistema **não** deriva catch-all de faixa (FR-011a) — em `apps/web/src/features/calculator/fee-prefill.test.ts`
- [x] T022 [P] [US2] Teste: valor editado pelo vendedor vence sempre, selo "ajustado por você" — em `apps/web/src/features/calculator/fee-prefill.test.ts`

### Implementação

- [x] T023 [US2] Estender `slotDeterminants` para emitir o eixo `category` por slot — em `apps/web/src/features/calculator/fee-prefill.ts`
- [x] T024 [US2] Passar a árvore para `resolveSlotEntry` e aplicar a política Q5 (catch-all publicado vs "sem referência") — em `apps/web/src/features/calculator/fee-prefill.ts`
- [x] T025 [US2] Selo passa a **nomear a categoria** do número, e a distinguir "categoria não informada" de "sem referência" — em `apps/web/src/features/calculator/fee-seal.tsx`

---

## Phase 4: User Story 1 — escolher a categoria, por canal (P1)

**Objetivo**: o vendedor informa a categoria por slot, buscando por texto; escolher é opcional.
**Teste independente**: abrir um slot, achar a categoria digitando parte do nome, e ver que a escolha é por slot.

### Testes ⚠️

- [x] T026 [P] [US1] Teste: busca por parte do nome filtra a lista, com os nomes publicados pelo marketplace — em `apps/web/src/features/calculator/category-picker.test.tsx`
- [x] T027 [P] [US1] Teste: a escolha é **por slot** — categoria no ML não vira a categoria da Amazon (US1 AS4) — em `apps/web/src/features/calculator/category-picker.test.tsx`
- [x] T028 [P] [US1] Teste: marketplace sem eixo de categoria (Shopee, Outro) não renderiza seletor — em `apps/web/src/features/calculator/category-picker.test.tsx`
- [ ] T029 [P] [US1] Teste: o seletor funciona **offline** a partir do que o cliente já tem (US1 AS5) — em `apps/web/src/features/calculator/category-picker.test.tsx`

### Implementação

- [x] T030 [US1] Implementar o comportamento do seletor: busca por texto, seleção opcional, limpeza — em `apps/web/src/features/calculator/category-picker.tsx`
- [x] T030a [US1] Seletor como **campo de primeira classe**: sempre visível e expandido nos slots ML/Amazon, em estado vazio ativo (FR-006a) — em `apps/web/src/features/calculator/calculator-form.tsx`
- [ ] T030b [US1] Catch-all como **ação**, não selo passivo: declara que é a maior alíquota da tabela e oferece escolher a categoria (FR-006b) — em `apps/web/src/features/calculator/fee-seal.tsx`
- [ ] T030c [US1] Retorno da escolha em **reais sobre o preço**, não em pontos percentuais (FR-006c) — em `apps/web/src/features/calculator/category-picker.tsx`
- [ ] T030d [US1] Memória local de **última categoria usada por marketplace** (pré-selecionada e editável) + recentes no topo do seletor — reduz o atrito de reescolha **sem** schema novo e sem tocar no domínio de catálogo — em `apps/web/src/features/calculator/category-picker.tsx`
- [x] T031 [US1] Ligar o seletor ao slot de canal, por slot, sem vazar entre canais — em `apps/web/src/features/calculator/calculator-form.tsx`
- [ ] T032 [US1] Entregar a árvore ao cliente conforme D2 (semente / artefato sob demanda / podada) — em `apps/web/src/shared/fee-catalog/seed.ts`
- [ ] T033 [US1] Homologação visual no navegador: passos 1–7 do [quickstart V6](./quickstart.md) — evidência em `specs/014-fee-category-mapping/dod-evidence.md`

---

## Phase 5: User Story 3 — Amazon: o mapa completo, com procedência (P1)

**Objetivo**: toda categoria publicada pela Amazon, com alíquota, mínimo BRL 1,00, eixo de plano e faixas de preço.
**Teste independente**: comparar o mapa com a tabela oficial — cobertura total, zero itens inventados.

### Testes ⚠️

- [x] T034 [P] [US3] Teste: o parser normaliza **U+00A0** antes de comparar — a fixture reproduz a célula real da Amazon, e sem a normalização o teste falha (foi o que reprovou o G2 — R3) — em `packages/fee-ingest/amazon.test.ts`
- [x] T035 [P] [US3] Teste: categoria com limiar de preço (Acessórios Eletrônicos R$ 100; Móveis e Colchões R$ 200) vira `priceBands`, **não** um percentual achatado; fronteira testada **dos dois lados** — em `packages/fee-ingest/amazon.test.ts`
- [x] T036 [P] [US3] Teste: nenhuma categoria ausente da tabela oficial existe no resultado, e nenhuma publicada falta (US3 AS1) — em `packages/fee-ingest/amazon.test.ts`
- [x] T037 [P] [US3] Teste: toda entrada gerada carrega `sourceUrl` + `effectiveDate` + `lastReviewed`, e o texto de origem **nomeia a categoria** (SC-803) — em `packages/fee-ingest/amazon.test.ts`

### Implementação

- [x] T038 [US3] Implementar o coletor da tabela pública da Amazon com browser headless, sem credencial (medido no G2) — em `packages/fee-ingest/amazon.mjs`
- [x] T039 [US3] Modelar o eixo de plano (Profissional / Individual) com a cobrança por item, deixando a **assinatura mensal explicitamente fora** (é custo mensal, não por venda) — em `packages/fee-ingest/amazon.mjs`
- [x] T040 [US3] Declarar no texto da entrada que a base de comissão da Amazon inclui frete e a nossa não — subestimação **declarada** (Q9/FR-014) — em `packages/fee-ingest/amazon.mjs`
- [x] T041 [US3] Gerar as entradas Amazon no catálogo servido (hoje **0 entradas** — R5) — em `backend/app/data/catalog.json`

---

## Phase 6: User Story 4 — atualização mensal que abre PR com o diff (P1)

**Objetivo**: o mapa continua verdadeiro no mês que vem sem ninguém lembrar dele.
**Teste independente**: rodar contra fonte alterada → PR com diff; contra fonte quebrada → nenhum PR.

### Testes ⚠️

- [ ] T042 [P] [US4] Teste: fonte alterada → **um** PR cujo corpo lista cada mudança como old → new **por categoria**, com URL e data — em `packages/fee-ingest/refresh.test.ts`
- [ ] T043 [P] [US4] Teste: falha de leitura → **nenhum** PR, artefato **byte a byte** inalterado, alerta, e `lastReviewed` **não** avança (SC-806/FR-020a) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T044 [P] [US4] Teste: parse **vazio ou encolhido** além do limiar produz o mesmo desfecho de erro de rede — "0 categorias" nunca é lido como "as taxas caíram" — em `packages/fee-ingest/refresh.test.ts`
- [ ] T045 [P] [US4] Teste: execução sem mudança → PR que altera **apenas** `lastReviewed` (Q7) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T046 [P] [US4] Teste: categoria que **desapareceu** da fonte aparece em seção própria do PR, e não é apagada nem revalidada em silêncio — em `packages/fee-ingest/refresh.test.ts`

### Implementação

- [ ] T047 [US4] Montador do diff old → new por categoria + corpo do PR conforme [contracts §C3](./contracts/category-tree.md) — em `packages/fee-ingest/refresh.mjs`
- [ ] T048 [US4] Fail-safe: limiar de encolhimento declarado, artefato intocado em falha, alerta — em `packages/fee-ingest/refresh.mjs`
- [ ] T049 [US4] Workflow mensal: `schedule` **dia 1 às 06:00 UTC** + `workflow_dispatch`, PR mirando **`develop`**, **nunca** auto-merge. **Pré-condição a documentar no próprio workflow: o `schedule` do GitHub roda a partir da branch DEFAULT (`main`) — enquanto o arquivo não chegar em `main` por um corte de release, o laço mensal NÃO dispara sozinho** (ADR-0010 §A6.1) — em `.github/workflows/fee-refresh.yml`
- [ ] T050 [US4] Jobs **independentes** por marketplace: a falha do ML não impede a Amazon (FR-022) — em `.github/workflows/fee-refresh.yml`
- [ ] T050a [P] [US4] Teste: parser que lê a **coluna errada** e devolve 38 linhas plausíveis é detectado como falha de forma — valores-canário (Roupas 14%, Calçados 14%, Relógios 13%), teto de % de linhas alteradas, e coluna localizada por **cabeçalho** e não por índice (FR-018a) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T048a Proteger o branch de integração com ruleset exigindo PR — hoje `develop` **não tem proteção nem ruleset** (medido: 404 + `[]`), então o único portão do artefato de dinheiro é código que o próprio job executa (FR-020c) — em configuração do repositório
- [ ] T049a [US4] Classificador de **dispensa de revisão** (não de escrita): o job **sempre** abre PR; o classificador só decide se aquele PR pode auto-mergear, e apenas quando o diff for **exclusivamente** `lastReviewed`. Determinístico e, em dúvida ou erro, **nega a dispensa** (FR-020a) — em `packages/fee-ingest/refresh.mjs`
- [ ] T049b [P] [US4] Teste: o classificador **nunca** dispensa revisão de um diff que toque dinheiro; classificador em erro nega a dispensa; e **nenhum caminho do job escreve direto** no branch de integração — em `packages/fee-ingest/refresh.test.ts`
- [ ] T050b [P] [US4] Teste: nó que mudou de **pai** entre execuções aparece em seção própria do PR com a alíquota efetiva old → new, mesmo sem nenhum campo do artefato ter mudado (FR-019a) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T051 [US4] Verificar que a execução consome **0 tokens de LLM** e portanto **não** gera linha em `docs/token-ledger.md` (SC-811) — evidência em `specs/014-fee-category-mapping/dod-evidence.md`

---

## Phase 7: User Story 5 — quando o robô falha, o selo conta a verdade (P2)

**Objetivo**: a morte do laço mensal vira visível ao usuário sem depender de alguém olhar um painel.
**Teste independente**: envelhecer `lastReviewed` e ver o selo marcar "desatualizada" sem intervenção.

### Testes ⚠️

- [ ] T052 [P] [US5] Teste: a janela de obsolescência é medida contra a data de **ENTREGA ao usuário**, não contra a leitura da fonte — um valor lido no dia 1 e entregue no dia 20 **não** conta 19 dias de idade (FR-020b) — em `apps/web/src/features/calculator/fee-seal.test.tsx`
- [ ] T052a [US5] Carregar a data de entrega no artefato e passar a derivar `isStale` dela — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [ ] T053 [P] [US5] Teste: `lastReviewed` só avança por releitura real da fonte, nunca por "o job rodou" (SC-807) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T054 [P] [US5] Teste: comparação de frescor entre semente e catálogo servido **nunca reduz cobertura** (SC-805) — em `apps/web/src/shared/fee-catalog/use-fee-catalog.test.ts`

### Implementação

- [ ] T055 [US5] Garantir que a origem do valor (embutida / persistida / servida) continue refletida no selo com o eixo novo — em `apps/web/src/features/calculator/fee-seal.tsx`

---

## Phase 8: User Story 6 — Mercado Livre: o mapa completo (P2) ⛔ fatia própria

> **O DoD do 014 fecha sem esta fase** (Q2). Ela é autorizada à parte e **para** até T004.

### Testes ⚠️

- [ ] T056 [P] [US6] Teste: entradas ML trazem a alíquota **exata** por categoria, nunca a faixa publicada 10–14% / 15–19% — em `packages/fee-ingest/ml.test.ts` ⛔BLOQUEADA por T004
- [ ] T057 [P] [US6] Teste: a compressão por herança preserva a resolução em **100% dos nós**, não numa amostra — o censo da T001 já busca a alíquota de cada nó, então a equivalência `resolve(comprimido) == alíquota bruta` sai **de graça** para a árvore inteira; pedir amostra aqui seria aceitar risco de dinheiro que já foi pago — em `packages/fee-ingest/ml.test.ts` ⛔BLOQUEADA por T004
- [ ] T058 [P] [US6] Teste: faixas de custo fixo abaixo de R$ 79 usam as fronteiras publicadas literalmente, e a lacuna R$ 50,01–78,99 **permanece lacuna** (FR-014a) — em `packages/fee-ingest/ml.test.ts` ⛔BLOQUEADA por T004
- [ ] T059 [P] [US6] Teste: toda entrada ML **declara a premissa de logística** sob a qual o custo fixo vale (Q8) — em `packages/fee-ingest/ml.test.ts` ⛔BLOQUEADA por T004

### Implementação

- [ ] T060 [US6] Coletor ML: percorrer a árvore + obter alíquota por categoria e tipo de anúncio, em runner hospedado (G1 mediu que **não há geo-gate**) — em `packages/fee-ingest/ml.mjs` ⛔BLOQUEADA por T004
- [ ] T061 [US6] Compressão por herança: emitir entrada **apenas** onde a alíquota difere do pai (R1) — em `packages/fee-ingest/ml.mjs` ⛔BLOQUEADA por T004
- [ ] T062 [US6] Custo fixo abaixo de R$ 79 com fronteiras literais e premissa declarada — em `packages/fee-ingest/ml.mjs` ⛔BLOQUEADA por T004
- [ ] T062a [US6] **Condição 1**: o job que carrega o segredo instala **zero dependências** — só `checkout` + `setup-node` + `node` com built-ins; Playwright/Amazon em **job separado sem segredo** — em `.github/workflows/fee-refresh.yml` ⛔BLOQUEADA por T069b
- [ ] T062b [US6] **Condições 2 e 3**: todas as actions do `fee-refresh.yml` pinadas por SHA de 40 caracteres, e o segredo num **GitHub Environment** `ml-ingest` com regra de branch restrita ao default (hoje há 0 environments) — em `.github/workflows/fee-refresh.yml` ⛔BLOQUEADA por T069b
- [ ] T062c [US6] **Condição 4**: `::add-mask::` no token **rotacionado** antes de qualquer log — o token NOVO devolvido pela rotação **não é mascarado** pelo GitHub, e um `console.log` do corpo publicaria um refresh token válido para sempre em log de repo público — em `packages/fee-ingest/ml.mjs` ⛔BLOQUEADA por T004
- [ ] T062d [US6] **Condições 5 e 6**: o segredo nunca em workflow disparado por `pull_request`, `pull_request_target` ou **`workflow_run`**; e separação em dois jobs — coleta com o segredo e `contents: read`, publicação com `contents: write` **sem** o segredo — em `.github/workflows/fee-refresh.yml` ⛔BLOQUEADA por T069b
- [ ] T062e [US6] **Condição 8**: runbook de revogação testado uma vez e cronometrado (≤15 min), **2FA** na conta da casa, e rotação manual anual em calendário — em `docs/runbooks/` ⛔BLOQUEADA por T004
- [ ] T063 [US6] Configurar o segredo `ML_REFRESH_TOKEN` **sem write-back** (viável porque o G3 mediu que o token antigo sobrevive à rotação) e conceder à app **apenas** "Publicação e sincronização: Leitura" — em `.github/workflows/fee-refresh.yml` ⛔BLOQUEADA por T004
- [ ] T064 [US6] Gerar as entradas ML no catálogo servido (hoje **0 entradas** — R5) — em `backend/app/data/catalog.json` ⛔BLOQUEADA por T004

---

## Phase 9: User Story 8 — a categoria acompanha o que o vendedor salva (P3)

### Testes ⚠️

- [ ] T065 [P] [US8] Teste: cenário salvo depois do 014 re-resolve a categoria pelo catálogo de hoje, como os demais slots não sobrescritos (contrato de leitura da E5, inalterado) — em `apps/web/src/features/scenarios/scenario-resolver.test.ts`
- [ ] T066 [P] [US8] Teste: cenário, kit e **snapshot** criados **antes** do 014 abrem inalterados e sem categoria; imutabilidade intocada (SC-809) — em `apps/web/src/features/scenarios/scenario-resolver.test.ts`
- [ ] T067 [P] [US8] Teste: produto de catálogo **não** ganha campo de categoria (FR-003a) — em `apps/web/src/features/catalog/products.test.ts`

### Implementação

- [ ] T068 [US8] Persistir a categoria na intenção de canal do cenário (JSONB existente do ADR-0021 — sem coluna nova) — em `apps/web/src/features/scenarios/scenario-model.ts`

---

## Phase 10: Polish & Cross-Cutting

- [ ] T068a Fixar com o `arquiteto` os **números** do orçamento do SC-810 (bytes da semente e custo de parse no boot) — T069 hoje compara com um número que **não existe** — em `specs/014-fee-category-mapping/plan.md`
- [ ] T069 [P] Orçamento do SC-810: medir tamanho da semente e custo de validação no boot, comparar com o número fixado em T068a, e provar que a primeira pintura offline da calculadora gratuita **não** regrediu — evidência em `specs/014-fee-category-mapping/dod-evidence.md`
- [ ] T041a [P] [US3] Superfície de detalhe "de onde vem este número" (o N3 do `designer-ux`): o selo é um `Badge` e a advertência completa da Amazon tem 250 caracteres — `AMAZON_CAVEATS_FULL` existe no código e ainda não tem onde ser mostrada. O `source` por entrada carrega a forma curta — em `apps/web/src/features/calculator/fee-seal.tsx`
- [ ] T069a [P] Verificar o SC-813 (hoje sem nenhuma tarefa): o workflow roda **só** em runner hospedado, não há runner self-hosted, e o incremento não adiciona **nenhum** recurso de nuvem — o resultado que os gates compraram precisa de alguém que o verifique — em `.github/workflows/fee-refresh.yml`
- [ ] T069b [P] Fechar SEC-014-02/08/10 (`allowed_actions`, `sha_pinning_required: true`, `trufflehog@main`) e o §A6.5(iii) (CI independente sobre o PR mensal). **Condição 7 do parecer: esta tarefa é PRÉ-CONDIÇÃO de T060/T063, não consequência** — as correções de segurança estavam bloqueadas pelo próprio parecer que as exige — em `.github/workflows/`
- [ ] T070 [P] Regenerar o contrato OpenAPI e provar idempotência se **qualquer** rota do backend mudou, docstrings incluídas (o drift-guard só roda no CI e reprova **depois** do gate verde) — em `apps/web/src/shared/api/`
- [ ] T071 [P] e2e do fluxo completo: escolher categoria → calcular → salvar cenário → reabrir — em `apps/web/e2e/category-fee.spec.ts`
- [ ] T072 Decisão do dono sobre **Q11** e, com ela, o descarte formal da **US7** (o desbloqueio da US6 removeu a premissa dela) — registrar em `spec.md`
- [ ] T073 Fechar as três perguntas remanescentes (Q4, Q9, Q12) ou registrar por escrito que ficam como estão — em `spec.md`
- [ ] T074 Apagar os probes descartáveis (`scripts/probes/g1-*`, `g2-*`, `g3-*`, `ml-oauth.mjs`, `t001-*`) e o workflow dos gates, agora que a ingestão do 014 é dona dos mesmos caminhos (ADR-0010 §A13 manda) — em `scripts/probes/`, `.github/workflows/`
- [ ] T075 `pnpm gate:all` verde + e2e + homologação visual do dono — evidência em `specs/014-fee-category-mapping/dod-evidence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Fase 0 (decisões) ──> Fase 1 (setup) ──> Fase 2 (foundational) ──┬──> Fase 3 (US2) ──> Fase 4 (US1)
                                                                  ├──> Fase 5 (US3 Amazon) ──> Fase 6 (US4 laço)
                                                                  ├──> Fase 7 (US5 selo)
                                                                  ├──> Fase 8 (US6 ML) ⛔ só após T004
                                                                  └──> Fase 9 (US8) ──> Fase 10 (polish)
```

### User Story Dependencies

- **US2 é pré-requisito real de todas** — sem o eixo na busca, o mapa existe e ninguém o alcança.
- **US1** depende de US2 (o seletor precisa de algo que resolva) e de **D2**.
- **US3** (Amazon) e **US6** (ML) são **independentes entre si** — a falha de um marketplace não bloqueia o outro.
- **US4** depende de existir pelo menos um mapa (US3 basta).
- **US8** depende de US1+US2.

### Within Each User Story

- Testes MUST ser escritos e **observados falhando** antes da implementação (NON-NEGOTIABLE).

### Parallel Opportunities

- Fase 2: T008–T013 em paralelo (todos testes, arquivos distintos).
- Fase 5 e Fase 6 podem correr em paralelo com a Fase 7.
- **US3 (Amazon) e US6 (ML) em paralelo** assim que T004 sair — são jobs e arquivos separados por desenho.

---

## Implementation Strategy

**MVP = Fase 2 + Fase 3 + Fase 5** (foundational + US2 + Amazon). Nesse ponto o vendedor já tem alíquota por
categoria da Amazon, com procedência e selo honesto, **sem nenhuma credencial envolvida**.

**Entrega incremental**, espelhando o fatiamento do plano:

| PR | fases | destrava |
|---|---|---|
| **PR-A** | 1, 2, 3, 4, 5, 6 | valor completo da Amazon + laço mensal vivo |
| **PR-B** | 8 | ML — a única fatia com segredo, **para até T004** |
| **PR-C** | 9, 10 | persistência em cenários + fechamento |

**Nota de roteamento (ADR-0022)**: T014–T017 e todas as tarefas de `packages/fee-ingest` que produzem **valores de dinheiro**
(T035, T038, T057, T058, T061, T062) tocam o domínio de precificação e são **escaladas para `opus`** — a regra de
escalonamento do `CLAUDE.md` é não-negociável para leaf de dinheiro, catálogo de tarifas e faixas.
