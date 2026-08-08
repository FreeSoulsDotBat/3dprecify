# Tasks: 017 — Ingestão dinâmica mensal de tarifas (CI-first)

**Input**: `spec.md` (pós-clarify 8/8) · `plan.md` · `arquitetura-017.md` (decisões A–J) ·
`research.md` (R1–R7) · `data-model.md` (§1–§7) · `contracts/` · ADRs **0028/0029/0030
Propostos** (flip nos gates do dono) · brief do PO (fatiamento PR-A..PR-D).

**Prerequisites**: hotfix A2/A3 mergeado (`3accd38` — o teste anti-reversão da regra da folha
lida depende do dado corrigido) · E6 code-complete (nenhuma colisão de domínio).

**Tests**: MANDATÓRIOS (Constituição III) — cada guarda nasce VERMELHA e observada. As provas de
EXECUÇÃO da decisão J são portões de fatia, não estilo: toda fatia fecha com **execução real com
URL** (SC-1001); todo `.mjs` novo é **bootado sob `node` puro** no próprio job (014/US4); o corpo
do PR é testado por **AUSÊNCIA** (`not.toContain`); canária nova é provada por **MUTAÇÃO**.

**Organization**: pelas 4 fatias do PO. Cada push/merge é **OWNER-GATED** (ADR-0006). Ledger por
onda (estimar ANTES, real DEPOIS). Routing ADR-0022: executor padrão `devops`/`dev-frontend`
(sonnet); **as folhas de dinheiro do catálogo NÃO mudam neste incremento** (o laço RELÊ, não
remodela) — se alguma tarefa precisar tocar schema de folha, ESCALA para opus antes de começar.

## Regras de pé para toda tarefa desta feature

- **Coletor emite fatia, nunca escreve** (ADR-0028); folha não lida vem da BASE — é o que impede
  a reversão silenciosa do hotfix A2 (freight/freightSubsidyInfo/optionalSurcharges não estão no
  PNG da Shopee).
- **Um bump de `catalogVersion` por execução**, sempre via `nextCatalogVersion`; nenhuma literal
  de versão em teste (ADR-0029).
- **Zero `secrets.` além de `GITHUB_TOKEN`** — repo-wide (as sondas morrem na PR-A); zero lógica
  de dinheiro/relatório em YAML; nunca auto-merge de dinheiro.
- **0 tokens LLM no laço** (SC-811; tesseract = 0); nenhuma linha de token-ledger por execução.
- **Vigia não tem caminho de tipo até o dinheiro** (nenhuma `WatchReading → FeeEntry`); baseline
  sem `shape`/`anchors` é proibido; `absentAnchors` sempre presente.
- **Âncoras Shopee vêm do T057** (016 dod-evidence), NUNCA do `OBTENCAO §8` (desatualizado — R7).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Apagar as sondas descartáveis (decisão H — estrutural, não faxina):
      `.github/workflows/g1-probe-ml.yml` · `.github/workflows/g2-probe-amazon.yml` ·
      `scripts/probes/` inteiro. A medição delas está preservada no ADR-0010 §A13; enquanto
      `g1-probe-ml.yml:47` referenciar `secrets.ML_ACCESS_TOKEN`, "nenhuma credencial ML" é
      verdade sobre um arquivo, não sobre o repositório.
- [x] T002 [P] `scripts/check-action-pins.sh`: a linha "os 5 workflows parseiam" vira contagem
      CALCULADA (J.6 — com `fee-refresh.yml` o número cravado passaria a mentir).
- [ ] T003 **TAREFA DO DONO (paralela, não bloqueia PR-A)** — P0-b: ruleset de `develop`
      (revisão obrigatória) + o que resta do P0-c: `allowed_actions` na configuração do
      repositório (R6 — `sha_pinning_required` e trufflehog pinado JÁ existem, medido). Gate
      apenas do flip futuro de `ALLOW_FRESHNESS_EXEMPTION`; a dispensa nasce DESLIGADA de
      qualquer forma.

## Phase 2: Foundational — a espinha estrutural (bloqueia todas as US)

- [x] T004 Vermelho observado — `packages/fee-ingest/src/workflow-audit.test.ts` (lendo
      `.github/workflows/` por `fs`): zero `secrets.` em `fee-refresh.yml` além de
      `GITHUB_TOKEN` · zero `secrets.ML_*` em QUALQUER workflow · `fee-refresh.yml` declara
      `schedule` + `workflow_dispatch` e o cabeçalho RA1 (a frase da manualidade). Falha hoje:
      o arquivo não existe e as sondas ainda existem (T001 o deixa meio-verde; todo-verde só
      com T015).
- [x] T005 `packages/fee-ingest/src/verdict.ts` — `CollectorVerdict` (3 casos) +
      `MARKETPLACE_COVERAGE` + a função TOTAL `resolverVereditos(disco) → Record<Mk, Verdict>`
      (sem veredito ⇒ `NAO_LIDO "o job não produziu veredito"`). Teste vermelho antes: cobertura
      total, nenhum marketplace calado.
- [x] T006 `packages/fee-ingest/src/slice.ts` — `CatalogSlice` + `aplicarFatia` (regra da folha
      lida). **O teste anti-reversão do hotfix A2 é o caso numérico central** (data-model §7):
      base Shopee com `freightSubsidyInfo` + fatia só-comissão ⇒ subsídio byte-idêntico.
- [x] T007 [P] `packages/fee-ingest/src/inert-fields.ts` — funde `refresh.ts:INERT` +
      `catalog-diff.ts:INERT_PATHS` numa lista só; os dois consumidores migram no mesmo commit
      (fecha 014/U4-f). Teste: as listas antigas deixam de existir (grep asserido).
- [x] T008 `packages/fee-ingest/src/compose.ts` — `compor(base, slices[])`: ordem alfabética ·
      `decideRefresh` POR marketplace · fatia reprovada ⇒ veredito ABORTADO (o PR parcial da Q4
      por tipo) · UM `nextCatalogVersion` + UM `generatedAt` · `RunOutcome` de 2 casos. Casos
      numéricos do data-model §7 vermelhos antes (incl. bump único com 2 fatias admitidas).
- [x] T009 `packages/fee-ingest/src/seed-projection.ts` + **P0-a** (ADR-0029):
      `projetarSemente(servido)` com a política de poda DECLARADA (Amazon 78→0 vira regra
      testável) → gera `apps/web/src/shared/fee-catalog/seed.data.json`; `seed.ts` encolhe para
      política+parse+export; o ramo de cache de adoção (014/U5-b) acorda COM teste.
      `fee-catalog.test.ts`: a literal `"2026-08-07.0"` MORRE, entram as 4 relações da decisão B.
      NÃO procurar a linha pelo número (conflito 1 — as coordenadas do brief estão vencidas).
- [x] T010 [P] `packages/fee-ingest/src/pr-body.ts` — função pura conforme
      `contracts/pr-mensal.md`, com TODAS as asserções mínimas do contrato vermelhas antes
      (ausência via `not.toContain` · 3 estados sempre · AC5 em folha de OCR · seção de vigias ·
      rodapé de dispensa · seção DECISÃO no topo).
- [x] T011 [P] `packages/fee-ingest/src/exemption.ts` — classificador falha-fechado nos DOIS
      eixos (diff inerte E arquivos ⊆ par artefato+semente); `ALLOW_FRESHNESS_EXEMPTION` padrão
      `false`; o corpo imprime o estado e o porquê. Caso do data-model §7: baseline extra no PR
      ⇒ NEGADA pelo eixo (b).
- [x] T012 `packages/fee-ingest/src/build.mjs` + script raiz `pnpm fee:build` (compor → validar
      → artefato + semente). **Bootado sob `node` puro** no gate local E no job (J.1);
      idempotência: 2ª passada + `git diff --exit-code` (decisão C.4).
- [x] T013 `pnpm gate:artifact` (decisão D): renomear os 3 existentes para a convenção
      `*.artifact.test.ts` (truth-gate de `fee-catalog` · `artifact-fixed-point` ·
      `band-dominance`) + os novos (paridade de projeção · cobertura · colisão de categoria) ·
      meta-guarda (todo arquivo que menciona `backend/app/data/catalog.json` casa a convenção ou
      está em exceção datada) · **prova por MUTAÇÃO: artefato envenenado reprova nos DOIS gates**
      (comissão fora de faixa · banda sobreposta · versão desalinhada de `generatedAt`). A
      mecânica do filtro vitest (`--include` vs `--project`) verifica-se aqui — a propriedade é o
      critério, o flag é detalhe.

**Checkpoint Foundational**: `pnpm gate:fe` + `pnpm gate:artifact` verdes; `fee:build` idempotente
localmente; nenhuma literal de versão viva.

---

## ══ PR-A — P0-a + espinha + Amazon no runner + a execução real (US1 + US2 + US3) ══

- [x] T014 [US3] `packages/fee-ingest/scripts/build-amazon.mjs` migra de WRITER para EMISSOR DE
      FATIA (ADR-0028 — não opcional): lê a fonte, emite `CatalogSlice` + veredito; NUNCA mais
      toca `catalog.json`. Canárias preservadas (Roupas 14% · Calçados 14% · Relógios 13% · piso
      de linhas · coluna POR CABEÇALHO). Ponto fixo: fixture inalterada ⇒ fatia idêntica e
      `collectedAt` NÃO avança (FR-1011).
- [x] T015 [US1] `.github/workflows/fee-refresh.yml` conforme `contracts/workflow-yaml.md`:
      nesta fatia os jobs `amazon-tabela` + `publicar` (os demais entram nas suas fatias) ·
      cabeçalho RA1 obrigatório · actions pinadas por SHA (I8) · branch `bot/fee-refresh-<data>`
      + `gh pr list` antes de criar · `pnpm gate:artifact` dentro do job · upload de vereditos e
      linhas capturadas como artefato da run. T004 fica TODO-verde aqui.
- [x] T016 [US2] Integração corpo-do-PR no `publicar`: `pr-body.ts` consome os vereditos reais;
      estados dos marketplaces ainda-sem-coletor saem como NÃO LIDO com motivo honesto
      ("Shopee: coletor entra na PR-C" · "ML: sem credencial, fora do escopo do 017").
- [x] T017 [US1] **EXECUÇÃO REAL disparada à mão** (SC-1001 — portão da fatia): URL da run ·
      termina em PR ou ABORT nomeado · artefatos baixáveis · tempo/minutos faturados MEDIDOS
      (US3/AC5, premissa ~5 min/mês do ADR-0010 conferida) · numa segunda execução no mesmo dia,
      nenhum PR duplicado. Evidência em `dod-evidence.md`.
- [x] T018 [US1] Fechamento da fatia: `pnpm gate:all` exit 0 · e2e intocados (o 017 não tem
      tela — diff de `apps/web` restrito a `shared/fee-catalog/`) · ausências asseridas no corpo
      do PR da fatia (lição 014/US4) · linha do ledger da onda.
- [ ] T019 [US1] **Owner-gated PR-A → `develop`** (squash). No gate: **ADR-0028 e ADR-0029
      flipam Proposto → Aceito** (precedente ADR-0023). Graph refresh no merge.

---

## ══ PR-B — O vigia da /precos + liveness (US4 + US7) ══

- [ ] T020 [US4] Vermelho observado — `packages/fee-ingest/src/watch/amazon-precos.test.ts`:
      parser determinístico sobre fixture da /precos (fetch simples — G medido, 200/647 KB) ·
      captura mínimos por categoria + planos (Individual R$ 2,00/item · Profissional R$ 19/mês)
      + AUTO-DATAÇÃO da página · **estrutural: o módulo não exporta NENHUMA função
      `WatchReading → FeeEntry | CatalogSlice`** (decisão E.2).
- [ ] T021 [US4] `watch/amazon-precos.ts` + `data/amazon-precos.baseline.json` (forma comum §3
      com `absentAnchors`): divergência vs baseline E vs a constante
      `AMAZON_INDIVIDUAL_PER_ITEM_FEE` (o número mora num lugar só) ⇒ seção de vigia no MESMO
      PR; convergência das fontes ⇒ **PR de DECISÃO** (título `DECISÃO — ` + label
      `decisao-do-dono` + seção no TOPO + dispensa forçada NÃO — Q2); NUNCA escreve `minPerItem`
      (D7). Canária de forma provada por mutação.
- [ ] T022 [P] [US7] `ci.yml` job `loop-liveness` (decisão G): idade do DADO
      (`hoje − max(lastReviewed)` restrito à `MARKETPLACE_COVERAGE`) · >35d ⇒ `::warning::` +
      step summary + `exit 0` · fora do `needs` do `ci-pass` · mensagem própria para
      nunca-coletado. A constante soma `LOOP_CYCLE_DAYS(31) + 4` com o comentário do porquê
      (35 < 45 — avisar ANTES do selo falar com o vendedor).
- [ ] T023 [US7] Com DOIS caminhos de coleta no laço, provar o que era não-testável com um:
      execução em que só a /precos é relida ⇒ `lastReviewed` do catálogo INTACTO (vigia não
      carimba catálogo) e baseline atualizado; execução com Amazon abortada ⇒ entradas Amazon
      envelhecem (SC-1007). Job `amazon-precos` entra no `fee-refresh.yml`.
- [ ] T024 [US4] Fechamento: execução real com URL — **esta é a run que prova a independência
      da US1/AC2** (agora há dois caminhos de coleta: um job abortado NÃO impede o outro de
      concluir LIDO; emenda C1 do analyze) · gate:all · ledger · **owner-gated PR-B**.

---

## ══ PR-C — Shopee: detector + OCR com as guardas decididas (US5) ══

- [ ] T025 [US5] Vermelho observado — `watch/shopee-detector.test.ts`: identidade =
      `sha256(bytes)` · URL nova + bytes iguais ⇒ "re-upload sem mudança", OCR NÃO roda ·
      bytes novos ⇒ tabela nova · hashes inalterados ⇒ 0 OCR (o caminho de 11 meses/ano).
- [ ] T026 [US5] `data/shopee-art26839.baseline.json` — âncoras VERBATIM pinadas do **T057**
      (nunca do OBTENCAO §8 — R7): a frase do CNPJ < R$ 8 · a do +R$ 3 (CPF > 450 pedidos/90d) ·
      os dois pontos regressivos (10→6,50 · 8→6,00) · `absentAnchors: ["mínimo","piso"]` ·
      endereços sha256 dos PNGs. **Na mesma fatia** (RA4): os comentários curatoriais de
      `seed.ts` migram para cá como âncoras executáveis. + Nota datada em
      `docs/homologacao/OBTENCAO-DINAMICA-DADOS.md` §8 apontando o T057.
- [ ] T027 [US5] `ocr/ocr-shopee.ts` — `tesseract.js@7.0.0` devDependency; **resolver a
      pendência R2**: `langPath` local (traineddata versionado em `data/`) OU URL fixada +
      SHA-256 conferido antes do uso (abortando se divergir) — a propriedade é a invariância
      entre execuções, provada por teste.
- [ ] T028 [US5] `ocr/avaliar-ocr.ts` — as guardas conjuntivas com os casos numéricos do
      data-model §7 vermelhos antes (20% passa · 4,9%/25,1% ABORT · "6.50" com ponto ABORT ·
      âncora removida ABORT). Sob o ratchet 100%.
- [ ] T029 [US5] **Prova por MUTAÇÃO** (portão da fatia — US5/AC4): PNG com um dígito trocado
      mantendo valor plausível ⇒ pego por ≥1 guarda em 100% das rodadas. Registrar QUAL guarda
      pegou cada mutação (a tabela discriminante — precedente M3 do PR-F).
- [ ] T030 [US5] Banner Q8 + o portão humano: `OCR_DIVERGENCE_BANNER` como constante com razão
      escrita (**proposta >30% relativo ou >R$ 5,00 absoluto — o DONO ratifica no gate desta
      fatia**) · folha de OCR NUNCA dispensa revisão · AC5 sempre (lido × anterior × link da
      imagem). Job `shopee` entra no `fee-refresh.yml`. Registrar RA3 na evidência (teto de
      bloco INERTE na Shopee: 10 × 2 entradas — a defesa é isto aqui).
- [ ] T031 [US5] Fechamento: execução real com URL (detector sem mudança ⇒ 0 OCR provado na
      run) · gate:all · ledger · **owner-gated PR-C**. No gate: **ADR-0030 flipa** + o dono
      ratifica o limiar do banner.

---

## ══ PR-D — ML sem credencial + runbook (US6 + US8) ══

- [ ] T032 [US6] Vermelho observado — `watch/ml-vigias.test.ts`: os 3 vigias textuais (doc
      developers com "Última atualização em" · regra 50% < R$ 12,50 · sentinela da cubagem
      divisor 6000) sobre fixtures; estrutural: nenhum caminho `WatchReading → CatalogSlice`.
- [ ] T033 [US6] `watch/ml-vigias.ts` + baselines: `ml-textos.baseline.json` +
      `ml-frete-{verde,amarela,vermelha}.baseline.json` (3 × 29×8 — as tabelas medidas
      2026-08-05; guarda de forma 29×8 + limiar R$ 79 nos cabeçalhos, canárias provadas por
      mutação). Saída = ALERTA + baseline atualizado; **NENHUM caminho escreve no catálogo
      servido** (o ML tem 0 entradas; frete é do E3; ADR-0025 segue Proposto).
- [ ] T034 [P] [US6] O corpo do PR declara o ML **NÃO LIDO quanto a comissão/custo fixo com o
      porquê** em 100% das execuções (SC-1003) — asserido no teste do `pr-body`, não confiado à
      prosa. Job `ml-vigias` entra no `fee-refresh.yml` (o YAML final tem os 5 jobs).
- [ ] T035 [US8] `docs/runbooks/fee-refresh.md`: disparar à mão · ler o resumo · o que significa
      vermelho · o que fazer quando o OCR aborta (re-pinar âncora = editar arquivo de dado) ·
      como reexecutar · **a frase explícita: ATÉ O CORTE DE RELEASE O LOOP É MANUAL** · limites
      (ML com token → fatia gateada · frete → E3).
- [ ] T036 [US8] Resumo de job por execução (step summary): estado por marketplace + link da
      fonte (US8/AC2) — gerado pelo mesmo `pr-body`/veredito, nunca por heredoc.
- [ ] T037 [US6] Fechamento: execução real FINAL com os 5 jobs (URL + minutos medidos vs a
      premissa ~5 min) · SC-1002..1007 conferidos um a um · gate:all · ledger ·
      **owner-gated PR-D**.

---

## Phase Final: Polish & fechamento do incremento

- [ ] T038 [P] `dod-evidence.md` consolidado: as execuções reais (URLs) · medições (minutos ·
      0 OCR no caminho comum · idade do dado) · RA1–RA7 revisitados · o que o 017 NÃO cobre e
      quem herda.
- [ ] T039 [P] Ground line do `CLAUDE.md` + linha do roadmap se aplicável + memória do projeto;
      `pnpm graph:update` (a atualização de docs/imagens usa o caminho da skill).
- [ ] T040 Registro final no ledger (as 4 ondas somadas vs estimativas) + follow-ups que
      sobraram com dono declarado.

---

## Dependencies & execução

- Phase 2 (T004–T013) bloqueia TODAS as US; dentro dela T005→T006→T008 são sequenciais
  (tipos), T007/T010/T011 paralelas após T005.
- PR-A → PR-B → PR-C → PR-D é a ordem do PO (cada fatia adiciona um job ao MESMO YAML — merge
  incremental evita conflito estrutural). US7 (T022/T023) só é plenamente testável com o
  segundo caminho de coleta — por isso viaja na PR-B (nota da própria spec).
- T003 (dono) corre em paralelo e NÃO bloqueia nada — a dispensa nasce desligada.
- MVP = PR-A (o laço existe, dispara, e o primeiro PR mensal real nasce com gate verde —
  SC-1001/1008).

## Estimativas de ledger (antes de cada onda — regra do dono 2026-07-10)

PR-A ~400k (espinha + migração do coletor + execução real) · PR-B ~250k · PR-C ~350k (OCR +
mutação) · PR-D ~250k · Polish ~80k. Real registrado por onda.
