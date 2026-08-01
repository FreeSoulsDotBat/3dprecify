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
- [x] T007 [P] Registrar a fronteira do `packages/fee-ingest` no `dependency-cruiser` e no `import-linter`, para que ela **não** possa importar de `apps/web` nem do `backend` — em `.dependency-cruiser.cjs`

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
- [x] T013c [P] Teste: **não-regressão** de quem NÃO escolhe categoria — o caminho sem categoria entrega o mesmo resultado de antes do 014 em pré-fill, selo e comportamento offline (SC-808, hoje sem nenhuma tarefa) — em `apps/web/src/features/calculator/fee-prefill.test.ts`

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

> **Estado (parte 1 entregue)**: a **lógica pura** do laço existe e está testada em
> `packages/fee-ingest/src/catalog-diff.ts` — o comparador old → new por categoria e o
> classificador de dispensa (`mayAutoMerge`), que falha fechado. O **orquestrador**
> (`refresh.mjs`) e o **workflow** ainda não existem, então **o laço mensal ainda não roda**.
> T049a/T049b estão parcialmente cobertos ali (a decisão de dispensa e o dinheiro-nunca-dispensa);
> o que falta neles é a metade que só existe dentro do job: "nenhum caminho escreve direto no
> branch de integração". T049/T050 dependem das 8 condições do parecer (T069b).

### Testes ⚠️

- [x] T042 [P] [US4] Teste: fonte alterada → **um** PR cujo corpo lista cada mudança como old → new **por categoria**, com URL e data — em `packages/fee-ingest/refresh.test.ts`
- [x] T043 [P] [US4] Teste: falha de leitura → **nenhum** PR, artefato **byte a byte** inalterado, alerta, e `lastReviewed` **não** avança (SC-806/FR-020a) — em `packages/fee-ingest/refresh.test.ts`
- [x] T044 [P] [US4] Teste: parse **vazio ou encolhido** além do limiar produz o mesmo desfecho de erro de rede — "0 categorias" nunca é lido como "as taxas caíram" — em `packages/fee-ingest/refresh.test.ts`
- [x] T045 [P] [US4] Teste: execução sem mudança → PR que altera **apenas** `lastReviewed` (Q7) — em `packages/fee-ingest/refresh.test.ts`
- [x] T046 [P] [US4] Teste: categoria que **desapareceu** da fonte aparece em seção própria do PR, e não é apagada nem revalidada em silêncio — em `packages/fee-ingest/refresh.test.ts`

### Implementação

- [x] T047 [US4] Montador do diff old → new por categoria + corpo do PR conforme [contracts §C3](./contracts/category-tree.md) — em `packages/fee-ingest/refresh.mjs`
- [x] T048 [US4] Fail-safe: limiar de encolhimento declarado, artefato intocado em falha, alerta — em `packages/fee-ingest/refresh.mjs`
- [ ] T049 [US4] Workflow mensal: `schedule` **dia 1 às 06:00 UTC** + `workflow_dispatch`, PR mirando **`develop`**, **nunca** auto-merge. **Pré-condição a documentar no próprio workflow: o `schedule` do GitHub roda a partir da branch DEFAULT (`main`) — enquanto o arquivo não chegar em `main` por um corte de release, o laço mensal NÃO dispara sozinho** (ADR-0010 §A6.1) — em `.github/workflows/fee-refresh.yml`
- [ ] T050 [US4] Jobs **independentes** por marketplace: a falha do ML não impede a Amazon (FR-022) — em `.github/workflows/fee-refresh.yml`
- [x] T050a [P] [US4] Teste: parser que lê a **coluna errada** e devolve 38 linhas plausíveis é detectado como falha de forma — valores-canário (Roupas 14%, Calçados 14%, Relógios 13%), teto de % de linhas alteradas, e coluna localizada por **cabeçalho** e não por índice (FR-018a) — em `packages/fee-ingest/refresh.test.ts`
- [ ] T048a Proteger o branch de integração com ruleset exigindo PR — hoje `develop` **não tem proteção nem ruleset** (medido: 404 + `[]`), então o único portão do artefato de dinheiro é código que o próprio job executa (FR-020c) — em configuração do repositório
- [x] T049a [US4] Classificador de **dispensa de revisão** (não de escrita): o job **sempre** abre PR; o classificador só decide se aquele PR pode auto-mergear, e apenas quando o diff for **exclusivamente** `lastReviewed`. Determinístico e, em dúvida ou erro, **nega a dispensa** (FR-020a) — em `packages/fee-ingest/refresh.mjs`
- [x] T049b [P] [US4] Teste: o classificador **nunca** dispensa revisão de um diff que toque dinheiro; classificador em erro nega a dispensa; e **nenhum caminho do job escreve direto** no branch de integração — em `packages/fee-ingest/refresh.test.ts`
- [x] T050b [P] [US4] Teste: nó que mudou de **pai** entre execuções aparece em seção própria do PR com a alíquota efetiva old → new, mesmo sem nenhum campo do artefato ter mudado (FR-019a) — em `packages/fee-ingest/src/catalog-diff.test.ts` (não em `refresh.test.ts`: a detecção é do comparador, não do orquestrador)
- [x] T051 [US4] Verificar que a execução consome **0 tokens de LLM** e portanto **não** gera linha em `docs/token-ledger.md` (SC-811) — evidência em `specs/014-fee-category-mapping/dod-evidence.md`

---

> **Nota de execucao (T102/T106, 2026-07-31)** — a T106 tinha duas metades e so uma cabia aqui.
> A colisao de `categoryId` virou `checkCategoryIdCollisions` e o gerador aborta NOMEANDO os
> colidentes e o id disputado ("colisao" sem nomes nao e acionavel). Ja **validar o artefato montado
> contra o schema Zod dentro do gerador** exigiria `packages/fee-ingest` importar
> `apps/web/src/shared/fee-catalog` — um PACOTE dependendo de um APP —, ou duplicar o contrato em
> outra copia. As duas saidas sao decisao estrutural (Principio VIII), nao escolha minha.
> **Mitigacao ja existente, verificada**: `apps/web/src/shared/fee-catalog/fee-catalog.test.ts:31`
> valida o artefato COMMITTED contra o schema e roda no `gate:all`, entao um artefato invalido nao
> chega ao usuario. O que faltava — e que a T106 fecha — e o gerador parar de imprimir "sucesso"
> para quem o roda.

## Phase 6C: Correções da revisão multi-agente do PR #31 🔴 BLOQUEIA O MERGE

**Origem**: revisão de 6 dimensões + verificação adversarial sobre `develop...HEAD` (2026-07-28).
34 achados brutos → 5 confirmados. A A1 é **dinheiro errado no artefato commitado hoje**.
**Objetivo**: o número entregue bater com a fonte, e o que a tela afirma ser verdade.
**Teste independente**: Móveis a R$ 300,00 ⇒ comissão R$ 40,00 (não R$ 30,00); e um payload congelado
de ANTES reproduzir o mesmo preço DEPOIS.

> **Nota de escopo honesta**: a **A2** não é requisito novo. A FR-008 e o SC-802 já exigiam rejeitar
> comissão nula dentro de faixa de preço; o `.refine` implementado só fechou um dos dois lados.
> É defeito de implementação contra requisito existente — registrado assim para a correção não se
> disfarçar de escopo novo.

### A1 — comissão por parcela (HIGH · dinheiro errado hoje) · ADR-0024

- [x] T076 [P] Teste (falhando primeiro, **SC-814/FR-014b**): `grossUp` com `bandMode: "PROGRESSIVE"` bate com a fonte nos **três** pontos de prova — abaixo do limiar, **no** limiar, e acima (Móveis R$ 300 ⇒ R$ 40,00) — em `packages/pricing-core/src/channels.test.ts`
- [x] T077 [P] Teste (falhando primeiro): a **ausência** de `bandMode` preserva bit-a-bit o comportamento de seleção — as bandas Shopee e o custo fixo ML existentes não mudam nenhum centavo — em `packages/pricing-core/src/channels.test.ts`
- [x] T078 [US3] **FR-014b** — `BandMode` + soma por parcela em `grossUp`, com gross-up **por segmento** (a função progressiva é contínua ⇒ não precisa do ponto fixo; o modo `SELECTION` mantém a iteração) — em `packages/pricing-core/src/channels.ts` ⚠️ **domínio de precificação: escalonado para `opus` (CLAUDE.md), cobertura ratchet 100%**
- [x] T079 [US3] `bandMode` atravessa o schema do catálogo como **opcional** (ausente = seleção) — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T080 [US3] `bandMode` atravessa `entryToChannelFees` até `ChannelInput` sem se perder — em `apps/web/src/features/calculator/fee-prefill.ts`, `calculator-model.ts`
- [x] T081 [US3] O gerador emite `bandMode: "PROGRESSIVE"` para as categorias com limiar, e o parser passa a **distinguir** parcela de seleção na leitura da célula — em `packages/fee-ingest/src/amazon-parse.ts`, `amazon-to-catalog.ts`
- [x] T082 [US3] Regenerar `backend/app/data/catalog.json` e conferir Móveis · Colchões · Acessórios Eletrônicos — em `packages/fee-ingest/src/build-amazon.mjs`
- [x] T083 [P] Teste **SC-815** de retrocompatibilidade com **payload congelado REAL de antes** da correção (não fixture escrito depois): mesmo preço, mesmo centavo — em `apps/web/src/entities/history/frozen-payload.test.ts`
- [x] T084 [P] Teste da travessia ponta-a-ponta: artefato → resolução → `ChannelInput` → preço, provando que `bandMode` **não** se perde no caminho. **É o risco real do ADR-0024 §5**: perder o modo degrada em silêncio para o bug atual, agora justificado pelo padrão — em `apps/web/src/features/calculator/fee-prefill.test.ts`

> **Contabilidade corrigida (2026-07-30)** — a A1 foi implementada nesta branch (ADR-0024 aceito,
> `bandMode` no motor, no schema, no pré-fill e no gerador; `catalog.json` regenerado) e as caixas
> ficaram sem marcar. Marcadas agora. **T083 continua ABERTA e não é formalidade**: o que existe é a
> prova SC-815 em `pricing-core` (ausência do discriminador = seleção); falta a prova pedida — um
> payload congelado REAL de ANTES da mudança reproduzindo o mesmo centavo DEPOIS. Fixture escrito
> hoje prova a intenção de hoje; só o payload antigo prova que o passado não se moveu.
> T076/T077 e T084 vivem em arquivos diferentes dos previstos (`tests/progressive-bands.test.ts` e
> `features/calculator/progressive-traversal.test.ts`).

> **Nota de execução (T083, 2026-07-30)** — o "payload REAL de antes" foi levado ao pé da letra: os
> três documentos de `apps/web/src/entities/history/__fixtures__/frozen-payload-pre-adr-0024.json`
> foram **gerados pelo código de `1212a16`** (a base desta branch, anterior ao ADR-0024), extraído
> com `git show` e executado à parte. Proveniência e regra de manutenção em `__fixtures__/README.md`
> — o arquivo **não se regenera** quando o teste reprova; reprovar é dizer que o passado se moveu.
> 1. **A asserção é o DOCUMENTO INTEIRO**, não os totais: `freezePriceResult(computeCalculator(…))`
>    de hoje contra o payload antigo, com `toEqual`. Um centavo em qualquer folha reprova.
> 2. **Três escalas porque uma não bastaria**: os anúncios caem em `[0,80)`, `[80,100)` e `[100,200)`,
>    e o voucher de frete (≥ 79) só entra nos dois últimos.
> 3. **Falsificação MEDIDA** (o teste passou de primeira, então precisava provar que pode reprovar):
>    inverter o padrão do `bandMode` para progressivo reprova **2 dos 3** — o primeiro sobrevive
>    porque abaixo do primeiro limiar os dois modos coincidem, que é a matemática correta. O código
>    foi restaurado com `git checkout` logo em seguida.
> 4. **O alvo achado no caminho**: `recalc-today.tsx` afirma no docstring que "sob uma fórmula
>    inalterada, reprecificar as entradas congeladas devolve exatamente os valores congelados" —
>    e **nenhum caminho de código exercita isso** (o "Recalcular hoje" re-emite o documento quando a
>    origem sumiu, nunca reprecifica as entradas). Este teste é o que torna a afirmação verificada em
>    vez de declarada. Sétima vez nesta sessão em que a regra estava escrita e não imposta.
> 5. `**/__fixtures__/**` saiu da cobertura: é dado, e o v8 tentava parsear o `.md` a cada rodada.

### A1b — o BACKEND comia dois campos do incremento 🔴 (achado 2026-07-29, ao levantar o app de verdade)

> **Nenhum teste podia ver isto, e nenhum viu**: o cliente lê o artefato do DISCO nos testes, e o
> `truth-gate` chamado "serves the committed artifact" comparava só versão e nomes de marketplace.
> O `response_model` do FastAPI é uma **allowlist**: campo que ele não conhece, ele descarta — em
> silêncio, por construção. Descobriu-se rodando o app: `curl` no endpoint devolvia **0** nós de
> espinha e **0** `bandMode`. Efeito real: pelo caminho servido o cliente recebia 76 entradas
> chaveadas por categoria e **nenhuma forma de nomeá-las** ⇒ o seletor da US1 renderizava vazio e
> escolher categoria era impossível com o backend saudável; e a comissão por parcela degradava para
> seleção ⇒ o defeito A1 de volta, ao vivo, justificado pelo padrão.

- [x] T075a ✅ `category_spine` + `band_mode` no `response_model` — em `backend/app/api/fee_catalog.py`
- [x] T075b ✅ Teste de fidelidade `disk ⊆ wire`: **todo** campo do artefato sobrevive à serialização, para sempre — substitui o teste cujo nome prometia mais do que ele verificava — em `backend/tests/test_fee_catalog.py`
- [x] T075c ✅ Schemas do cliente para `nullish` e não `optional`: o backend serializa ausência como `null` explícito, e um schema que só tolera `undefined` **reprovaria o payload servido** — silenciosamente, caindo na semente — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`
- [x] T075d ✅ Contrato OpenAPI + cliente Orval regenerados, idempotência provada (+59 / +21, estável na segunda rodada)

### A2 — o guard F3 fecha só um lado (MEDIUM · latente, gatilho = curadoria ML)

- [x] T085 [P] Teste (falhando primeiro): entrada com `commissionPct` de topo **não-nulo** e banda com comissão **nula** é rejeitada no parse — a variante que os testes atuais não cobrem — em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [x] T086 [US2] Remover o curto-circuito do `.refine`: a exigência "toda banda carrega sua própria comissão" vale **independente** do topo (FR-008/SC-802) — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`

> **Nota (A2, 2026-07-30)** — o `.refine` virou **dois** `.refine` em vez de um `||` alargado. O `||`
> não era só incompleto, era enganoso: o número de topo funcionava como **chamariz**. As bandas
> SUBSTITUEM o topo em `entryToChannelFees` (`b.commissionPct ?? 0`), então uma entrada com 12% no
> topo e banda de comissão nula passava no guard, exibia 12% para quem lesse o JSON, e cobrava **0%**
> naquela faixa sob selo de "Referência". Separar as duas exigências também dá mensagem e `path`
> próprios a cada uma — quem regenerar o catálogo vê qual das duas quebrou.

### A3 — o seletor afirma o que não é verdade (MEDIUM · Princípio II, estado padrão de 100% dos usuários)

- [x] T087 [P] Teste (falhando primeiro): o teste atual só verifica que existe um `role="status"` — passar a **verificar o texto**, que hoje faz afirmação falsa — em `apps/web/src/features/calculator/category-picker.test.tsx`
- [x] T088 [US1] Reescrever o estado vazio (FR-006d): não afirmar que há taxa exibida, não prometer carregamento que não acontece para o ML, e **concordar com o selo do mesmo slot** — em `apps/web/src/shared/i18n/messages.pt-br.ts`, `category-picker.tsx`

> **Nota (A3, 2026-07-30)** — "concordar com o selo" virou **dependência de dados**, não coincidência
> de redação: o seletor recebe `hasFeeReference`, derivado do selo do próprio slot, e passa a só falar
> do que ele sabe (a lista de categorias). Antes ele afirmava sobre a taxa sem ter como saber dela —
> que é a raiz do achado, não a escolha das palavras. Duas mensagens, ambas alcançáveis: selo `none`
> (slot ML recém-criado) e selo `adjusted` (o vendedor digitou a própria comissão).

### A4/A5 — higiene do gerador (armadilhas plantadas para o laço mensal)

- [x] T089 [P] Teste (falhando primeiro): célula com estrutura não reconhecida (limiares divergentes, ordem invertida, redação alternativa) é **falha daquela categoria**, não 15% fixo (FR-014c) — em `packages/fee-ingest/src/amazon-parse.test.ts`
- [x] T090 [US3] A recusa da linha 72 deixa de ser desfeita a jusante: `parsePct` não vê célula que `parseBands` recusou — em `packages/fee-ingest/src/amazon-parse.ts`
- [x] T091 [P] Remover o fallback inalcançável `?? {AMAZON vazia}` (Princípio V) e garantir que **nada é escrito** antes do artefato estar montado — em `packages/fee-ingest/src/build-amazon.mjs`

> **Nota (A4/A5, 2026-07-30)** — a raiz da A4 era o **tipo de retorno**, não a linha 96. `parseBands`
> devolvia `null` para duas coisas incompatíveis ("isto não é banda" e "isto PARECE banda e eu me
> recuso a ler"), então o chamador não tinha como respeitar a recusa. Virou `readCommissionCell` com
> três respostas (`FLAT` / `BANDED` / `UNRECOGNISED`): a recusa deixou de ser representável como
> "não é banda", e o `?? parsePct(...)` saiu junto. Cobre também três faixas e redação alternativa,
> que hoje viravam a primeira alíquota da célula.
> Na A5 o `??` não era só inalcançável: o `.map` só SUBSTITUI uma Amazon existente, então o objeto
> fabricado nunca podia ser usado — ele apenas fazia o script **parecer** que tratava a ausência,
> enquanto uma ausência real gravava o artefato inalterado e só depois morria no `console.log`.
> **Incidente durante a execução**: rodei `node build-amazon.mjs --help` supondo que fosse flag; não
> é, e o script buscou a página ao vivo e reescreveu `catalog.json` (só datas). Revertido com
> `git checkout --` e conferido contra o HEAD antes de commitar. O script não tem modo seco — vale
> anotar como candidato a `--dry-run` no laço da US4.

### Da varredura dos 27 restantes (2026-07-28) — **17 confirmados · 10 refutados**

**Consertar agora — dano ou requisito descumprido hoje**

- [x] T094 ✅ **DECIDIDO 2026-07-28 — opção (a): EMITIR o catch-all.** A entrada apenas-modalidade sai de "Outros" 15%; quem não escolhe categoria recebe esse valor com selo "categoria não informada". Tensão registrada no `spec.md` (§Clarifications, terceira rodada): "Outros" é categoria para produtos que não se encaixam, não alíquota declarada para "categoria desconhecida" — é interpretação, sustentada por ser o **teto** da tabela (erro sempre a favor do vendedor)
- [x] T095 [US3] Executar a decisão da T094 em `packages/fee-ingest/src/amazon-to-catalog.ts` + `fee-prefill.ts` (`viaCatchAll`) **juntas** — consertar só uma metade acende o defeito da outra
- [x] T096 [P] [US3] Teste do truth-gate contra o artefato **REAL** (não fixture): `resolveSlot(servido, "AMAZON", "PROFISSIONAL")` sem categoria produz o desfecho decidido na T094. **Hoje falha** — e é a asserção que o fixture inventado escondeu — em `apps/web/src/features/calculator/fee-prefill.test.ts`
> **Nota (T095/T096, 2026-07-30)** — a metade do cliente (`viaCatchAll`) já existia; faltava a do
> gerador. A entrada só-de-modalidade é **cópia da linha publicada "Outros"**, e é emitida apenas se
> essa linha existir na leitura — sem ela, nenhum catch-all, jamais um substituto escolhido por nós
> (FR-011a). A assimetria com o ML cai do dado, não de um `if` sobre marketplaces.
> O artefato foi regenerado **sem nova leitura** (a partir da própria leitura registrada nele), então
> `lastReviewed`/`effectiveDate` continuam sendo os de uma coleta real — avançá-los aqui seria
> afirmar releitura que não houve. Efeito colateral revelado: o `bandMode` estava gravado **depois**
> de `lastReviewed` e o gerador o emite antes — ou seja, o artefato commitado era igual em VALOR mas
> não em bytes ao que o gerador produz. O `toEqual` do teste de ponto fixo ignora ordem de chave e
> por isso passava. Agora o arquivo é saída literal do gerador.

- [x] T097 [US1] Trocar o marketplace do slot MUST limpar a `category` junto com a modalidade: hoje o id do marketplace antigo sobrevive **invisível** (o ramo de espinha vazia vem antes do ramo `value`), sem botão "Limpar", e **continua sendo enviado como determinante** — dois cliques (Amazon→ML), contra `spec.md` §Edge Cases — em `calcular-page.tsx:237`, `produto-page.tsx:169`, `bom-line-editor.tsx:86`
> **Nota (T097, 2026-07-30)** — a regra do que reseta saiu dos três handlers e virou UM lugar
> (`slotResetOnMarketplaceChange`). Três cópias da mesma regra é como uma fica para trás — que é
> literalmente o que aconteceu com a categoria nas três. Junto veio um conserto que a T095 **abriu**:
> `viaCatchAll` perguntava "o vendedor escolheu categoria?" quando a pergunta certa é "a entrada que
> vamos citar tem categoria?". As duas divergem sempre que uma categoria escolhida NÃO resolve (id de
> cenário salvo, de catálogo que perdeu o nó, ou resíduo da própria troca) — a busca cai no catch-all
> e o selo diria "Referência" para um 15% que não é da categoria escolhida.
> Fica para a **T116** o chip em branco (`categoryPath` de id ausente) e a ordem dos ramos do seletor:
> com a T097 a espinha vazia deixa de esconder um id vivo, mas um id persistido ainda pode.

- [x] T098 [P] [US1] O `return` antecipado do ramo `embedded` (`fee-seal.tsx:49`) engole **DUAS** coisas, e são o mesmo conserto: (a) `originCategoryName` — alíquota herdada de ancestral aparece sem dizer que não é a da categoria escolhida; (b) o marcador **`stale`** — no caminho da semente o alarme de 30 dias **nunca dispara** (SC-807), e o docstring de `fee-prefill.ts:164-166` declara literalmente o contrato oposto. O ramo `catchAll` vizinho aplica `t.outdated` sem olhar `embedded`, então a assimetria é **acidental**. Tornar `embedded` um **modificador do texto-base**, não um early return. Teste `embedded + stale` — **hoje não existe nenhum** — em `apps/web/src/features/calculator/{fee-seal.tsx,fee-seal.test.tsx}`
- [x] T099 [P] Princípio V: `catchAllName` é parâmetro sem chamador de produção, e o teste vacuoso de `catalog-diff.test.ts:280` não exercita o ramo que nomeia — remover ou corrigir ambos

> **Nota (T098/T099, 2026-07-30)** — o `embedded` virou modificador do texto-base, e com isso o selo
> embutido passou a mostrar TAMBÉM a data de revisão (antes escondida). Esconder a data era o que
> impedia a semente de dizer quão velha ela é — e é dessa mesma data que o alarme de 30 dias sai.
> A semente é a cópia que mais envelhece: ela só muda quando um build novo sai.
> Na T099 o `catchAllName` saiu por REMOÇÃO, não por ganhar chamador: o nome da linha publicada já
> está dentro de `source` ("… — Outros (…)"), então a interpolação não acrescentava nada que o selo
> não pudesse dizer. E o teste vacuoso do `catalog-diff` foi removido em vez de corrigido — o ramo
> que ele nomeava já é exercido de verdade duas vezes acima; ele só fazia a cobertura parecer maior.

**Pré-requisitos de regenerar `seed.ts` (T032)** — inertes hoje, nascem no dia da regeneração

- [x] T100 [P] `freshest`: versão não-parseável MUST ser considerada **menos** fresca. Hoje o sentinel `"invalid-seed"` vence a comparação lexicográfica e faria o app rejeitar **permanentemente** catálogo servido e persistido — em `apps/web/src/shared/fee-catalog/fee-catalog.ts`

**Pré-requisitos da US4 (o laço mensal)** — ✅ **DECIDIDO 2026-07-28: saem do PR #31 e entram no PR que constrói o laço.**
Nenhum tem gatilho hoje (nenhum workflow invoca o gerador; `diffCatalogs` não tem consumidor), e é no PR do laço que
ficam testáveis de verdade. Ficam aqui como **pré-condições declaradas da US4**, não como bugs em aberto.

- [x] T101 [US4] `effectiveDate` recebe a **data da execução**, e não é inerte ⇒ duas execuções sobre a MESMA tabela produzem **76 entradas alteradas** e `mayAutoMerge` nunca retorna true. Preservar o `effectiveDate` anterior (ou o literal "não declarado pela fonte"). **Não** pôr em `INERT_PATHS` — isso tornaria auto-mergeável uma mudança real de vigência — em `build-amazon.mjs:81`
- [x] T102 [P] [US4] Canárias como par `(commissionPct, minPerItem)` **e** aridade exata de 3 colunas: uma coluna inserida na fonte desloca a posicional e zera todos os `minPerItem` com `ok: true` — em `packages/fee-ingest/src/guardrails.ts`, `amazon-parse.ts`
- [x] T103 [P] [US4] Campos de **nível marketplace** fora de `categorySpine`/`entries` nunca são comparados ⇒ furo no fail-closed que o próprio módulo promete — em `packages/fee-ingest/src/catalog-diff.ts`
- [x] T104 [P] [US4] Entrada sumida e marketplace adicionado/removido derrubam `freshnessOnly` mas não entram em **lista nenhuma**: o PR diz "algo mudou" sem descrever o quê — em `catalog-diff.ts`
- [x] T105 [P] [US4] `marketplacesOf()` no padrão de `spineOf`/`entriesOf`: hoje `?? []` só cobre null/undefined e um JSON válido não-array **estoura**, contra o contrato "degrada, não quebra" — em `catalog-diff.ts`
- [x] T106 [P] [US4] O gerador não valida o próprio output: colisão de `categoryId` sai com **exit 0 e "sucesso" impresso**, e o artefato inválido derruba o marketplace inteiro no cliente — abortar nomeando os colidentes, e validar o artefato montado contra o schema antes de escrever — em `build-amazon.mjs`

> **Nota (T100, 2026-07-30)** — o sentinel `"invalid-seed"` vence lexicograficamente qualquer
> `"2026-…"` (o "i" vence o "2") **e** é o piso SÍNCRONO do estado. Ou seja: no dia em que a semente
> empacotada saísse quebrada, o app recusaria permanentemente o catálogo servido E o persistido —
> justamente os dois caminhos que existem para consertar isso. Um erro de build viraria um app que
> não aceita conserto. A regra agora é explícita: versão ilegível perde para legível, sempre; duas
> ilegíveis mantêm a que chega, para o refresh continuar idempotente.

**Dívida sem prazo**

- [x] T107 [P] a11y do estado escolhido do seletor: ao escolher, o foco cai em `document.body` e o chip não tem live region nem rótulo — enquanto os dois ramos vizinhos do mesmo arquivo usam `role="status"` — em `category-picker.tsx`

> **Nota (T107, 2026-07-30)** — o foco só é movido quando a escolha parte do VENDEDOR; montar já com
> uma categoria (produto salvo, cenário reaberto) não rouba o foco de ninguém. O teste de foco exigiu
> um invólucro controlado: com `onChange` mockado o ramo escolhido nunca renderiza, então a versão
> ingênua do teste mediria o mock e não o componente.

### Do batidão de UI + regras (2026-07-29/30) — 6 lentes em browser real + 4 auditorias de regra

> **Decisão do dono 2026-07-30**: todos os 36 achados confirmados das quatro operações entram **aqui**,
> inclusive os que são defeito de código **já shipado** (E3/E4) e não do entregável do 014.
> Registrada a ressalva que levantei e que o dono decidiu aceitar: o PR #31 fica grande e mistura
> "consertar o que acabei de construir" com "consertar o que já está em `develop``". Por isso as
> tarefas ficam **agrupadas por origem** — um revisor consegue percorrer em passadas separadas.

**Dado do vendedor — perda ou corrupção · ALCANÇÁVEL HOJE · faça primeiro**

- [x] T109 [P] 🔴 **SC-816** — `listOutbox` engole erro de leitura e devolve `[]`, e as **três** funções que REESCREVEM a fila (`enqueueSnapshot`, `removeEntry`, `updateEntry`) usam essa leitura tolerante como base do write **dentro do lock**. Leitura falha + escrita bem-sucedida (o `db.onclose` do Safari que a própria `idb-keyval` documenta) ⇒ a fila é **rebaseada em vazio** e os pendentes somem sem uma linha de erro. O outbox é a **única** cópia da cotação gravada offline. Extrair `readOutboxStrict` (sem catch) para os reescritores — leitura falha **aborta** a reescrita; a tolerante fica só para exibição — em `apps/web/src/entities/history/outbox.ts:115`
- [x] T110 [P] Teste: `idbGet` rejeitando ⇒ `idbSet` **não** é chamado e a fila sobrevive. O teste atual (`use-history.test.tsx:225`) afirma só `syncState === "pending"` e **nunca olha se os pendentes sobreviveram** — em `apps/web/src/entities/history/outbox.test.ts`
- [x] T111a [P] Teste (falhando primeiro): um 404 **sem** evidência de replay (`attempts === 0`, ou `code !== "NOT_FOUND"`) **preserva** a entrada e NÃO relata `synced`; um 404 de replay legítimo continua apagando (SC-816) — em `apps/web/src/entities/history/outbox.test.ts`
- [x] T111 [P] 🔴 **SC-816** — `settleEntry` trata **qualquer** 404 como "o vendedor apagou em outro dispositivo": apaga a entrada e devolve `synced`, com toast verde "Salvo". Um 404 de proxy/hosting chega como `ApiError{status:404, code:"UNKNOWN"}` e é indistinguível. A ADR-0018 §5 escopa a regra a um **replay**, e o comentário do código enuncia o invariante que o código não impõe. Só apagar com evidência de replay: `entry.attempts > 0` **E** `code === "NOT_FOUND"` — em `apps/web/src/entities/history/outbox.ts:206`
- [x] T112a [P] Teste (falhando primeiro): recálculo com a origem ausente grava um registro **distinguível** de um repreçado de verdade, e a tela o declara (SC-818). ⚠️ **Este teste não é opcional em nenhuma hipótese**: pela ADR-0019 o registro é imutável, então um erro aqui não tem conserto pós-fato — a única chance de acertar é antes de gravar — em `apps/web/src/pages/historico/recalc-today.test.tsx`
- [x] T112 [P] 🔴 **SC-818** — "Recalcular hoje" com a origem sumida grava dado **permanentemente ambíguo**: o recálculo devolve `{payload: frozen, fromFrozen: true}`, o `onConfirm` **descarta** `fromFrozen`, e o documento antigo é gravado com `deviceQuotedAt = hoje`; o detalhe imprime "Valores congelados em <hoje>". Pela ADR-0019 o registro é **imutável** — não há conserto pós-fato. Campo **aditivo** `repricedFromFrozen?: true` (ausência = normal, o mesmo padrão do `bandMode`/ADR-0024) + legenda; ou não oferecer a gravação nesse caminho — em `apps/web/src/pages/historico/recalc-today.tsx:117,178-206`

**`pricing-core` modo SELEÇÃO — inertes hoje, PRÉ-REQUISITO DA US6 (ML)**

> Hoje inertes porque Shopee está limpa (medido), a Amazon virou toda `PROGRESSIVE` e o ML tem 0
> entradas. **As tarefas T058/T062 testam a lacuna só do lado da INGESTÃO** — passariam verdes
> enquanto o motor a preenche em silêncio. Fazer **antes** da T056.

- [x] T113a [P] Teste (falhando primeiro): **varredura** sobre as bandas ML de `band-floor.test.ts:71-75` provando que, para toda base, `bandContaining(bands, anuncio)` é **a banda aplicada** — hoje o caso da base 79,00 exibe líquido 64,52 contra 69,52 real (SC-108/SC-817). Incluir monotonicidade do anúncio — em `packages/pricing-core/tests/band-convergence.test.ts`
- [x] T113 [P] **SC-817/SC-108** — o laço de ponto fixo pode sair pelo cap `MAX_BAND_ITERS` **sem convergir**, e as linhas seguintes adotam a banda que sobrou como se fosse estável, cobrando alíquota/fixo de uma banda que **não contém** o anúncio (reproduzido ao centavo com as bandas ML de `band-floor.test.ts:71-75`: anúncio 79,00, líquido exibido 64,52, real 69,52; com 3+ bandas o erro pode ser **contra** o vendedor). Viola SC-108. Após o laço, verificar `bandContaining(bands, anuncio) === band`; sem auto-consistência, escolher o par determinístico de **maior taxa** (nunca superestimar o líquido) e **nunca** devolver `appliedBand` como estável — em `packages/pricing-core/src/channels.ts:209,215-217`
- [x] T114a [P] Teste (falhando primeiro): preço que cai **fora de toda banda publicada** (a lacuna ML R$ 50,01–78,99) produz nível **não precificado** + selo "sem referência", NUNCA a tarifa da banda vizinha; e a inversão medida (base 50 → 65,70 vs base 55 → 63,95) deixa de existir (SC-817/FR-014a) — em `packages/pricing-core/tests/band-convergence.test.ts`
- [x] T114 [P] **SC-817/FR-014a** — os fallbacks `bandContaining(...) ?? bands[last]` e `?? band` fazem o motor **emprestar** a tarifa de uma banda vizinha quando o preço cai fora de toda banda — preenchendo no CÁLCULO a lacuna que a FR-014a proíbe preencher no CATÁLOGO (ML R$ 50,01–78,99), e produzindo inversão (base 50 → anúncio 65,70; base 55 → 63,95). Dar estado próprio a "sem tarifa publicada para este preço" (nível não-precificado → selo "sem referência") e validar cobertura/contiguidade na ingestão — em `packages/pricing-core/src/channels.ts:208,211`

> **Nota de execução (T113/T114, 2026-07-30)** — feitas como UMA correção: são o mesmo reparo da
> mesma função sob o mesmo SC-817, e separá-las obrigaria a escrever um comportamento para apagá-lo
> no commit seguinte. Três desvios do que a tarefa previa, todos por medição:
> 1. O laço de ponto fixo **saiu inteiro** (`MAX_BAND_ITERS` não existe mais). Em vez de detectar a
>    não-convergência depois, o motor resolve TODA banda e ordena os resultados; a auto-consistência
>    vira o topo de uma ordem total, sem caso especial e sem ramo morto.
> 2. `appliedBand` passou a ser **sempre a banda que contém o anúncio** — mais forte que "não devolver
>    como estável", e verificável por varredura (o invariante que o teste sweep guarda).
> 3. A monotonicidade reprovou a primeira versão: no degrau o motor pulava para R$ 84,67 quando
>    R$ 79,00 já entregava o líquido. Faltavam os candidatos das **próprias fronteiras**. Com eles o
>    degrau vira um **platô** em R$ 79,00 para toda base de 64,52 a 69,52 — que é a verdade do custo
>    fixo do ML, não um artefato. As fronteiras só entram quando alguma banda publicada já responde
>    (senão elas "escapariam" da lacuna da FR-014a por outra porta, empurrando o vendedor R$ 29 acima).

**UI do 014 — do batidão visual**

- [x] T115a [P] [US1] Teste **visual/geométrico** (falhando primeiro): o campo do seletor tem altura ≥ 44px, borda e fundo distinguíveis do papel, e alvo de toque ≥ 44px em 390px — medido com `boundingBox()` e estilo computado, não por impressão (FR-006a) — em `apps/web/tests/e2e/calculator.spec.ts`
- [x] T115 [US1] O seletor de categoria **não tem uma única regra de CSS**: renderiza como `<input>` nativo cru de 24px, sem borda, sem fundo, sem padding — enquanto a **FR-006a** exige um campo "de primeira classe, sempre expandido" **exatamente** para que o vendedor não aceite a alíquota errada sem perceber. Achado por **duas lentes independentes**; é o mais caro do lote do batidão — em `apps/web/src/features/calculator/category-picker.tsx`
- [x] T116a [P] [US1] Teste (falhando primeiro): `categoryPath` com id fora da espinha NÃO devolve string vazia, e o chip do seletor nunca renderiza rótulo em branco ao lado do "Limpar" — em `apps/web/src/shared/fee-catalog/category-tree.test.ts`, `category-picker.test.tsx`
- [x] T116 [P] [US1] `categoryPath` devolve string **vazia** para um id ausente da espinha, então o chip "categoria escolhida" renderiza **em branco** ao lado do "Limpar". Não é a T097 (aquela é espinha vazia); nenhum guard valida `slot.category` contra a espinha — em `apps/web/src/shared/fee-catalog/category-tree.ts:121-128`, `category-picker.tsx:52-61`

> **Nota de execução (T115/T116, 2026-07-30)** — a falha da T115 foi MEDIDA em browser real antes do
> conserto: `altura do alvo de toque do seletor · Expected >= 44 · Received 24`. O conserto não
> reescreveu a moldura: o input entrou no par `.tf-inputwrap`/`.tf-input` do DS, o mesmo do
> NumberField — refazer borda/altura/foco aqui teria criado um segundo campo com a mesma aparência e
> destino próprio. Quatro coisas que a tarefa não previa:
> 1. **Por que a varredura de alvos de toque não pegou**: `a11y-targets-contrast.spec.ts` seleciona
>    `a[data-nav-item]`, `.tf-topbar__theme` e `button.tf-btn` — nenhum controle de formulário entra
>    na conta. O seletor nunca esteve no escopo dela.
> 2. **O screenshot achou o que a geometria não vê** (a lição da E4, de novo): com a moldura de campo,
>    a lista de UM resultado lia como um SEGUNDO CAMPO preenchido com "Calçados". Virou superfície
>    elevada, raio menor, divisórias e um chevron `aria-hidden` — elemento real, não `::after`, porque
>    conteúdo gerado por CSS entra no nome acessível em alguns motores.
> 3. **O estado ESCOLHIDO também falhava a FR-006a** e não estava na tarefa: ele retornava só o chip,
>    então rótulo, dica e moldura sumiam e a categoria virava palavra solta entre "Modalidade" e
>    "Comissão". Agora mantém nome e moldura — sem `<Field>`, que renderiza `<label htmlFor>` e aqui
>    não há controle para apontar. O teste cobre esse estado.
> 4. **O teste do estado escolhido pegou um `:focus-within` transitório**: o "Limpar" vive dentro da
>    moldura, o foco vai para ele (T107) e o DS repinta a borda por cima de uma transição — medir sem
>    tirar o foco comparava um campo focado com um em repouso. Blur + `expect.poll`.
>
> A T116 mudou o **tipo**, não o `if`: `categoryPath` devolve `string | null`, e a lista de opções
> passou a chamar `categoryPathOfNode(index, node)` — por NÓ, onde o caso desconhecido deixa de ser
> representável. A string vazia não era "sem nome": era um valor que o chamador renderizava como
> rótulo em branco ao lado do "Limpar". `ancestorChain`, a função irmã, já documentava e tratava o id
> ausente; esta deixava a descoberta para quem chamasse.
- [x] T117a [P] [US1] Teste (falhando primeiro): o contrato ARIA anunciado é o CUMPRIDO — `aria-expanded` reflete o estado real, `aria-controls` aponta para um `listbox` existente, e a opção ativa é anunciada; ou, se a decisão for deixar de anunciar, nenhum atributo de combobox permanece — em `apps/web/src/features/calculator/category-picker.test.tsx`
- [x] T117 [P] [US1] O campo anuncia o contrato ARIA de `combobox` (`aria-expanded` + `aria-controls` para um `role="listbox"`) sem cumpri-lo — leitor de tela recebe promessa que a implementação não honra. Cumprir o contrato **ou** deixar de anunciá-lo — em `apps/web/src/features/calculator/category-picker.tsx`

> **Nota de execução (T117, 2026-07-30)** — a tarefa dava as duas saídas; escolhi **deixar de
> anunciar**, e a razão não é economia: **o widget que está na tela não é um combobox**. A lista fica
> em FLUXO abaixo do campo (decisão da T115, para não reabrir a classe de defeito de sobreposição que
> este projeto pagou três vezes) e cada resultado é um `<button>` de verdade — Enter, Espaço e foco de
> graça, em qualquer AT. Implementar o contrato exigiria virar popup + `aria-activedescendant` +
> navegação por setas, ou seja, trocar o widget para caber no rótulo.
>
> Nada foi perdido: **nenhuma metade do que era anunciado funcionava**. `aria-controls` apontava para
> uma `listbox` que só existe enquanto há resultados (referência morta na maior parte do tempo), não
> havia `aria-activedescendant` nem tecla nenhuma, e `aria-selected={false}` era fixo em toda opção.
>
> O que faltava DE FATO — saber que os resultados apareceram — virou uma live region **única e sempre
> montada**. As duas propriedades são deliberadas: uma região que aparece junto com o texto não é
> anunciada de forma confiável (o leitor precisa já estar observando), e duas regiões concorrentes
> sobre a mesma busca é como o leitor acaba não lendo nenhuma em ordem. A antiga `noResults` foi
> absorvida por ela; `:empty { display: none }` esconde a caixa vazia sem tirar o elemento do DOM.
>
> **O screenshot achou um defeito de honestidade que eu mesmo tinha acabado de introduzir**: a lista
> mostra no máximo 8, e o rótulo dizia "8 categorias encontradas" quando a busca por "a" na espinha
> da Amazon casa **31**. O vendedor pararia de refinar acreditando ter visto tudo, e a categoria dele
> pode ser a nona. Agora a contagem é do total real (`searchCategories` sem corte — o padrão do helper
> é 50, que é só um corte maior) e o rótulo diz "Mostrando 8 de 31 — refine a busca". Segunda vez
> nesta sessão em que abrir a imagem achou o que a asserção não vê.
>
> Os 7 testes que codificavam o contrato falso foram **reescritos, não apagados** (`combobox`→
> `textbox`, `listbox`→`list`, `option`→`button`).

**Geometria e honestidade em código já shipado (E3/E4)**

- [x] T118a [P] Teste **geométrico** (falhando primeiro): o retângulo da barra de total do kit NÃO intersecta o da navegação inferior, em 390px e 412px, com o kit em composição — asserção de caixas, porque texto extraído é cego para oclusão — em `apps/web/tests/e2e/bom.spec.ts`
- [x] T118 [P] A barra fixa "Total do kit" fica **atrás** da navegação inferior: os dois valores aparecem com os dígitos **cortados** durante toda a composição do kit — em `apps/web/src/pages/bom/` (barra de total) + o `z-index`/`padding-bottom` do shell

> **Nota de execução (T118, 2026-07-30)** — falha MEDIDA antes do conserto, em 412px: base da barra
> em **907**, topo da TabBar em **850** — 57px do total enterrados. A barra fica em
> `features/bom/assembly-summary.tsx`, não em `pages/bom/` como a tarefa supunha.
> 1. **A causa não é o `z-index`.** É que `padding-bottom` e `position: sticky` não se encontram: a
>    reserva do shell move o conteúdo que ROLA, e um sticky para em relação ao VIEWPORT. O
>    `bottom-2` (8px) media do chão da tela, o que são 56px dentro de uma TabBar de 64. Subir o
>    `z-index` teria pintado a barra por cima da navegação — trocaria qual dos dois fica cortado.
> 2. **O recuo passou a ser do SHELL**, via `--pinned-bottom` declarado em `app-shell.css` (com o
>    valor de mobile somando `--tabbar-h` + safe-area). A única camada que sabe qual cromo existe é
>    a que o desenha; uma feature que escreve `bottom: 8px` está adivinhando, e esta adivinhou
>    errado. O componente consome `var(--pinned-bottom, var(--space-2))` — o fallback é para quem
>    renderiza fora do shell (testes de unidade), não para esconder um shell quebrado.
> 3. **Os utilitários Tailwind viraram uma classe** (`.assembly-summary__pinned`): `bottom` agora
>    depende de um token com dois valores, o que um utilitário não expressa.
> 4. **Adjacente, NÃO corrigido aqui**: `shared/ui/toast.css` faz `bottom: calc(var(--tabbar-h) +
>    var(--space-3))` **incondicionalmente**, então no desktop o toast flutua 76px acima do chão sem
>    TabBar nenhuma. É o mesmo problema pelo outro lado, e `--pinned-bottom` é o consumidor natural
>    — mas mexer no toast é fora do escopo desta tarefa e tem e2e próprio.
- [x] T119a [P] Teste **geométrico** (falhando primeiro): rótulo de palavra única de 120 caracteres — o limite do próprio campo — mantém `documentElement.scrollWidth === clientWidth` no detalhe do histórico em 390px e 412px — em `apps/web/tests/e2e/history-manage.spec.ts`
- [x] T119 [P] Um rótulo com palavra longa sem espaços — **digitado dentro do limite de 120 do próprio campo** — faz o detalhe do histórico transbordar para **1676px** num viewport de 412. Quebra de palavra + contenção com `overflow-x` próprio — em `apps/web/src/pages/historico/`

> **Nota de execução (T119, 2026-07-30)** — falha MEDIDA: **1798px** num viewport de 390. Três
> desvios do que a tarefa previa, todos por medição e não por leitura:
> 1. **A lista NUNCA transbordou** — só o detalhe. O card do razão já quebra o rótulo; a asserção da
>    lista entrou no teste e passou de primeira, o que é evidência, não redundância.
> 2. **O culpado é um só, e não fica em `pages/historico/`**: um diagnóstico em browser que lista
>    todo elemento com `scrollWidth > clientWidth` termina em `h1.tf-page-header__title`
>    (client=358, scroll=1782) — o widget COMPARTILHADO. Todos os ancestrais acima apenas herdavam a
>    largura. O conserto é uma linha lá, e vale para toda página que dá nome a um registro.
> 3. **Nada ganhou `overflow-x` próprio**, ao contrário do que a tarefa sugeria: com a palavra
>    quebrando não sobra o que conter, e um contêiner de rolagem que nunca pode ser exercitado é
>    defesa contra um estado que não ocorre (Princípio V). `anywhere` e não `break-word` — este
>    último se recusa a quebrar justamente quando é a largura mínima do elemento que define o
>    contêiner, que é este caso.
>
> **E o teste tinha uma corrida minha**: navegar logo após "Salvar no histórico" aborta o
> enfileiramento+drenagem em voo e o registro se perde em silêncio. Falhava só na PRIMEIRA tentativa
> (a repetição passava com a máquina quente) — a forma exata como uma corrida real se disfarça de
> instabilidade. Os dois testes vizinhos do mesmo arquivo já documentavam a espera, com essas
> palavras; o meu a omitiu. Quinta vez nesta sessão em que o repositório já descrevia a armadilha.
- [x] T120a [P] Teste (falhando primeiro): canal gravado **sem comissão resolvível** não exibe "Preço para anunciar" nem "Recebido líquido" no detalhe congelado — herda a mesma recusa que a Calcular aplica com `hasFee: false` (Princípio II) — em `apps/web/tests/e2e/history-manage.spec.ts`
- [x] T120 [P] O registro congelado exibe "Preço para anunciar" e "Recebido líquido" para um canal **sem comissão informada** — exatamente os números que a Calcular se **recusou** a exibir (`hasFee: false` esconde atrás de "Informe a comissão…"). O histórico precisa herdar a mesma recusa, ou o congelado afirma o que a origem negou (Princípio II) — em `apps/web/src/pages/historico/`

> **Nota de execução (T120, 2026-07-30)** — reproduzido literalmente antes do conserto, no estado
> PADRÃO de 100% dos usuários (o slot nasce em Mercado Livre, que hoje não tem entrada no catálogo):
> `"MERCADO_LIVRE · Preço para anunciar · Varejo R$ 30,90 · Recebido líquido · Varejo R$ 30,90 ·
> Preço para anunciar · Atacado R$ 26,78 · Recebido líquido · Atacado R$ 26,78"` — anúncio igual ao
> líquido igual ao preço direto, quatro linhas afirmando um preço de marketplace que nunca foi
> calculado. A mesma asserção contra a tela da Calcular passou de primeira: a origem já recusava.
>
> **O conserto é de LEITURA, não de escrita, e essa é a decisão que importa.** As entradas de taxa já
> viajam dentro do documento (`inputs.channels` no SINGLE, `lines[].input.channels` no KIT), então o
> fato é recuperável de **todo registro já gravado** — que um gatilho de banco torna irregravável
> (ADR-0019). Congelar `null` na escrita teria consertado só os registros futuros e deixado os
> existentes afirmando a mesma coisa para sempre.
>
> 1. **Num KIT o canal é um ROLLUP**: casa por marketplace, nunca por índice. Se QUALQUER linha
>    contribuinte pagou taxa naquele marketplace, o número somado significa alguma coisa.
> 2. **`true` quando a ausência não é PROVÁVEL** — payload sem entradas de canal, índice fora da
>    lista, rollup sem slot correspondente. Esconder uma linha por palpite é a mesma fabricação na
>    direção contrária (SC-815). O teste M11 que já existia em `snapshot-detail.test.tsx` usa um
>    payload sem `inputs`, e passou sem tocar — virou a guarda de regressão dessa regra.
> 3. **`error` e `contributingLines` ficaram FORA do portão**: um erro não é um preço, e as contagens
>    descrevem a composição, não o dinheiro.
> 4. **Verificado e fora do escopo**: o export PDF/CSV (`quote_render.py`) não renderiza canais, então
>    a mesma mentira não existe no documento que o vendedor manda ao cliente.
> 5. O arquivo **já declarava a proibição** no seu cabeçalho — "uma linha ausente não é um zero"
>    (FR-507) — e o bloco de canais era o único lugar que não a honrava. Sexta vez nesta sessão.

**Fora desta branch — registrado, não executável aqui**

- [ ] T121 📌 **HAND-OFF para `feature/012-e6-billing`** (NÃO fazer nesta branch): um checkout abandonado deixa `subscriptions.status='pending'` para sempre e todo re-Assinar vira **409 eterno**, enquanto a cópia da UI (`messages.pt-br.ts:851`, "aguarde alguns minutos e tente de novo") promete uma recuperação que **nenhum caminho de código oferece**. O reap de *stale pending* está **especificado** em `data-model.md` §5 e em `models/__init__.py:827` e **nunca virou tarefa** — a T011 está `[x]` sem a metade que a própria cópia ratificada pressupõe. Inerte hoje (épico adiado por decisão do dono 2026-07-09). Abrir a tarefa em `specs/012-e6-billing/tasks.md` **naquela branch**, antes do PR-B.

**Follow-ups da homologação visual (2026-07-30) — registrados, NÃO bloqueiam o merge**

> A homologação deu **PASS COM RESSALVAS (92%)** com 41 screenshots e geometria lida do browser.
> Duas ressalvas foram corrigidas na hora (**R2** — o selo nomeava a categoria duas vezes, porque a
> `source` do catálogo da Amazon já a carrega e a cláusula `(para X)` deste incremento a repetia; e
> **R3** — o congelado exibia o enum cru `MERCADO_LIVRE`, defeito PRÉ-EXISTENTE, confirmado idêntico
> em `develop`, corrigido aqui porque a T120 reescreveu exatamente aquele bloco). O que sobrou:

- [ ] **R1 [designer-ux]** — com UM único resultado, a lista do seletor ainda flerta com "campo
  preenchido". A distinção é mensurável (borda `rgb(215,216,224)` vs `rgb(185,187,198)`, raio 10 vs
  14, sombra vs nenhuma, chevron, contagem entre os dois), mas com um resultado o peso recai quase
  todo no chevron. É o limite do conserto da T115, não uma falha dele — em `category-picker.css`
- [ ] **F-01 (fora do mandato, PRÉ-EXISTENTE do E2)** — o rodapé da Calcular exibe "Salvar e exportar
  fazem parte do Premium" para quem **é** Premium e está salvando sem impedimento. `calcular-page.tsx`
  renderiza `t.freemiumNote` sem gate de entitlement, e `calcular.test.tsx` afirma que ele está
  SEMPRE presente — o teste tranca a cópia errada. Confirmado idêntico em `develop`
- [ ] **F-02 (fora do mandato)** — em 1440px o formulário fica encostado à direita com ~850px vazios
  à esquerda. Sem rolagem horizontal, sem relação com este PR
- [ ] **F-03** — **T116 e SC-817 não são alcançáveis pela UI** e a homologação PROVOU a
  inalcançabilidade em vez de fabricar o estado: a categoria nunca é persistida (os dois manipuladores
  de troca de marketplace a zeram) e as bandas Shopee do catálogo servido cobrem `0 → ∞` sem lacuna.
  Ambos ficam cobertos só por teste de unidade até existir um caminho real

**Revisão adversarial final (workflow, 2026-07-31) — o bloqueador foi corrigido; o resto fica**

> 14 agentes, 18 achados brutos, 4 verificados por 2 céticos cada. **O único bloqueador era o
> `catalogVersion`** (77 → 79 entradas sob rótulo idêntico `2026-07-28.0`, com a sequência cravada em
> `.0` no gerador) — corrigido nesta mesma leva: `nextCatalogVersion` em `guardrails.ts` (fora do
> `.mjs`, que é isento de cobertura) e o artefato em `2026-07-28.1` **sem nova leitura**.

- [ ] **A1-r [pricing-core] — `chooseBand` ordena por rank ANTES de preço** (`channels.ts:235`).
  Numa tabela em "vale" (comissão que cai e depois sobe) o motor escolhe um anúncio **dominado**:
  reproduzido por mim, `113,54 → R$ 157,16` e `113,55 → R$ 130,34` — um centavo de base derruba o
  anúncio em R$ 26,82, e o candidato de limiar 130,34 é mais barato **e** entrega líquido maior.
  **Exposição hoje é ZERO, medida em três vias independentes**: a Shopee (única tabela `SELECTION`
  viva) dá 0 inversões; a Amazon carimba `PROGRESSIVE` em toda célula com bandas e nem passa por
  `chooseBand`; o ML não tem entrada nenhuma. `checkBandCoverage` não impede a forma em vale, então
  o dado é representável — e viaja em snapshot congelado. Consertar antes de existir uma tabela assim
- [ ] **A1-r/teste — a monotonicidade é afirmada em geral e provada num fixture.**
  `band-convergence.test.ts:92` chama-se "o anúncio nunca cai quando a base sobe" e varre **apenas**
  `ML_CONTIGUAS`, cujas bandas superiores compartilham 12% e não disparam nada. Par obrigatório do
  item acima: alargar a varredura reprova enquanto o `sort` não mudar
- [ ] **B — `fee-catalog.ts` é BINÁRIO para o git** (`Bin 14402 → 14879`): há um byte NUL literal em
  `determinantKey` (`return "\0null"`). Consequência medida: toda lente que usou `git diff <arquivo>`
  **não viu nada** — inclusive a reescrita do guard A2 (T085/T086), mudança de validação no domínio de
  precificação, invisível ao diff E ao `blame`. Trocar por `"\0null"` ou `"__null__"`
- [ ] **C — `PRICING_MODEL_VERSION` continua 3.1.0 sobre uma implementação reescrita.** O crítico de
  completude rodou o diferencial velho-vs-novo (9 tabelas × 100k bases): **0 diferenças** em anúncio,
  líquido e banda aplicada. É higiene de versionamento, não defeito — registrado para não se perder
- [ ] **D — 14 achados de severidade MÉDIA/BAIXA ficaram FORA do orçamento de céticos.** Estão
  **não verificados**, nunca confirmados. Se alguém retomar, é por aí que se começa
- [ ] **E — arquivos do diff que NENHUMA lente abriu**, nomeados pelo crítico de completude:
  `entities/history/outbox.ts` (T109/T110/T111 — `readOutboxStrict`/SC-816, a única cópia de um
  orçamento gravado offline), `pages/historico/recalc-today.tsx` (SC-818, grava dentro de um payload
  que o ADR-0019 torna imutável, via cast cru), `fee-ingest/src/amazon-parse.ts` (o parser da fonte) e
  os **229 linhas** de e2e novos. Nenhum revisor os leu

**Follow-ups da analise em 3 lentes (2026-07-31) — os 2 bloqueios foram corrigidos; estes ficam**

- [ ] **U4-a [ALTO] — o denominador do teto cruza marketplaces.** `refresh.ts::entryCount` soma as
  entradas de TODOS os marketplaces, mas o numerador so conta as materialmente alteradas. Hoje da no
  mesmo porque so a Amazon e regerada; **no dia em que o ML entrar** (US6, a outra metade desta mesma
  feature) o denominador cresce e o teto morre calado. Nao e risco hipotetico: e trabalho ja planejado.
  Falta tambem o teste — nenhum caso de teto usa artefato multi-marketplace
- [ ] **U4-b [ALTO] — a T102 fechou a coluna A MAIS e deixou aberta a coluna A MENOS.**
  `amazon-parse.ts:140` (`if (row.length < 3) continue;`) descarta a linha CURTA **em silencio**,
  antes da guarda de aridade. E a mensagem de erro promete `"a column was inserted or removed"`
  quando o caso "removed" e inalcancavel — a copia afirma uma cobertura que o codigo nao tem. Mesma
  familia SC-806 que o commit da T102 afirma ter fechado
- [ ] **U4-c [MEDIO] — `sanity: { ok: true }` cravado** em `build-amazon.mjs`: o parametro de
  sanidade de `decideRefresh`, que os testes T043/T044 prendem, **e morto no unico chamador de
  producao** (a checagem real e o `checkParseSanity`, antes). Ou o parametro some, ou o chamador passa
  o verdadeiro — do jeito que esta, dois testes guardam um caminho que producao nao percorre
- [ ] **U4-d [MEDIO] — `PR_BODY_OUT` escreve DEPOIS do artefato.** Um caminho invalido nessa variavel
  deixa artefato no disco com saida nao-zero: o meio-passo que o comentario da linha 164 do proprio
  arquivo diz ter eliminado. Sem consequencia hoje (nao ha workflow), e por isso nao bloqueia
- [ ] **U4-e [MEDIO, fora da US4] — o cartao de canal colapsa a 430px**: coluna de ~140px com rotulos
  sobrepostos ("Comissao"/"Taxa fixa", "Comissao minima"/"Frete"). Medido pela lente visual em browser
  real; **pre-existente**, nao regressao desta fatia — designer-ux
- [ ] **U4-f — a lista `INERT` esta DUPLICADA** entre `refresh.ts:37` e `catalog-diff.ts:10`. Sao
  identicas hoje, entao nao e defeito; o vetor registrado e acrescentar um caminho so em `refresh.ts`,
  porque ai o campo some da TABELA do PR enquanto `mayAutoMerge` continua negando — o revisor recebe
  um PR que exige revisao e nao mostra o que revisar
- [ ] **U4-g — ~279 das 1067 linhas adicionadas sao TESTE que nenhuma lente abriu.** A fatia inteira
  roda sobre a afirmacao "os testes prendem", e foi exatamente isso que ficou sem auditoria em
  `catalog-diff.test.ts`, `amazon-to-catalog.test.ts` e `amazon-parse.test.ts`

> **Licao de processo, para o proximo mandato de revisao**: pelo menos uma lente precisa ter permissao
> de EXECUTAR o ponto de entrada. Todas foram read-only, e a quebra de boot (o bloqueio 1) so aparece
> ao rodar — ela quase escapou por isso, e a suite inteira era cega a ela porque o vitest resolve o
> que o `node` recusa.

### Fechamento
- [x] T122 `pnpm gate:all` verde + CI verde no PR #31 + regenerar contrato se alguma rota mudou — evidência em `specs/014-fee-category-mapping/dod-evidence.md`

---

## Phase 7: User Story 5 — quando o robô falha, o selo conta a verdade (P2)

**Objetivo**: a morte do laço mensal vira visível ao usuário sem depender de alguém olhar um painel.
**Teste independente**: envelhecer `lastReviewed` e ver o selo marcar "desatualizada" sem intervenção.

### Testes ⚠️

- [x] T052 [P] [US5] Teste **(premissa REESCRITA 2026-08-01, ver Clarification)**: a janela e dimensionada como **ciclo do laco + folga de entrega** e continua medida contra `lastReviewed`. Um valor lido no dia 1 e entregue no dia 20 **nao** alarma; um valor que passou de um ciclo inteiro **sem releitura** alarma. O alarme significa "algo falhou", nunca "o ciclo esta terminando" (FR-020b emendada) — em `apps/web/src/features/calculator/fee-seal.test.tsx`
- [x] T052a ~~Carregar a data de entrega no artefato~~ **SUPERADA 2026-08-01 pela mesma Clarification**: nao ha campo novo. Mover o relogio para a entrega faria um numero nao-verificado ha meses parecer fresco ao chegar num aparelho novo — a mentira inversa, e maior. O artefato de dinheiro fica intocado
- [x] T053 [P] [US5] Teste: `lastReviewed` só avança por releitura real da fonte, nunca por "o job rodou" (SC-807) — em `packages/fee-ingest/refresh.test.ts`
- [x] T054 [P] [US5] Teste: comparação de frescor entre semente e catálogo servido **nunca reduz cobertura** (SC-805) — em `apps/web/src/shared/fee-catalog/use-fee-catalog.test.ts`

### Implementação

- [x] T055 [US5] Garantir que a origem do valor (embutida / persistida / servida) continue refletida no selo com o eixo novo — em `apps/web/src/features/calculator/fee-seal.tsx`

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
                                                                  │         └──> Fase 6C (correções PR #31) 🔴 bloqueia merge
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
