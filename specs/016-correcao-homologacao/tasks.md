# Tasks: Correção da homologação humana + decisões de dados de marketplace

**Input**: Design documents from `/specs/016-correcao-homologacao/`

**Prerequisites**: plan.md · spec.md (pós-clarify 8/8, pós-reversão — **US15 ADIADA, zero tarefas
ML**) · research.md · data-model.md · contracts/ · **arquitetura-016.md** (autoridade de forma)

**Tests**: MANDATORY per Constitution Principle III. Todo teste é escrito e observado FALHANDO
antes da implementação; toda mudança de preço tem casos numéricos + varredura de limiar + prova
byte-idêntica; todo layout se afere com CAIXAS e a homologação visual sai com IMAGEM.

**Organization**: fases = fatias do plan (V0 · PR-A..PR-F), cada uma agrupando as suas user
stories. Cada fatia é um PR squash-merge autorizado pelo dono (ADR-0006). A ordem entre PR-D e
PR-F é ESTRUTURAL (versões efêmeras carimbam snapshot imutável) — não inverter.

**⚠ opus**: tarefas marcadas `⚠opus` tocam o domínio de pricing (ADR-0022) — executor `opus`
obrigatório (US10, US14, US16, US18). As demais seguem o roteamento padrão (executores sonnet).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup + V0 (a medição que vem antes de tudo)

**Purpose**: medir o Grupo 0 ANTES de planejar qualquer conserto dele (spec §V0).

- [x] T001 Medir o Grupo 0: subir o backend com `PORT=8000 P3D_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 uv run python scripts/run_e2e_server.py` (conferir `/health`→200 E `/api/v1/entitlement`→200/401, nunca 500), logar com conta SEM premium, abrir Catálogo · Kits · Orçamentos · Simulações · "Usar do catálogo", registrar screenshot + status HTTP por tela em `specs/016-correcao-homologacao/dod-evidence.md`. Se o teaser aparecer → V0 fecha sem código. Se o erro vermelho persistir → PARAR e reportar ao dono (vira a primeira fatia e reordena o plano).

**Checkpoint**: V0 registrado. PR-A pode começar (V0 só bloqueia consertos do Grupo 0).

---

## Phase 2: PR-A — US1 Teaser único + US2 Rótulos (Priority: P1) 🎯 MVP

**Goal**: um padrão só de teaser nas 5 telas premium; Histórico→Orçamentos, Cenários→Simulações.

**Independent Test**: grátis vê a MESMA árvore nas 5 telas; zero ocorrência dos rótulos antigos em
superfície visível (incl. PDF/CSV); rotas/payloads byte-idênticos.

### Tests (vermelho primeiro) ⚠️

- [x] T002 [P] [US1] Teste estrutural do teaser: montar os 5 `PremiumFeatureId` e comparar a ÁRVORE renderizada (ordem de papéis/elementos, não presença de texto) em `apps/web/src/shared/billing/premium-teaser.test.tsx` — observar o vermelho (componente não existe)
- [x] T003 [P] [US2] Varredura de rótulos: teste que falha se "Histórico"/"Cenários" aparecer em superfície visível (nav, títulos, botões, toasts, vazios, teasers) e nos artefatos exportados (PDF/CSV) em `apps/web/e2e/label-sweep.spec.ts` — observar o vermelho

### Implementation

- [x] T004 [US1] Registro i18n fechado dos teasers (título·subtítulo·legenda por `PremiumFeatureId`; subtítulo de Simulações = o texto aprovado pelo dono) em `apps/web/src/shared/i18n/messages.pt-br.ts`
- [x] T005 [US1] Criar `apps/web/src/shared/billing/premium-teaser.tsx`: 4 elementos em ordem fixa, sem props de texto, exceção única `disabledAffordance`; ABSORVE `shared/billing/teaser-upgrade.tsx` (E6) como o elemento "Assinar" — NUNCA bifurcar (plan §H)
- [x] T006 [US1] Substituir as 5 superfícies pelo componente único e DELETAR os 4 teasers antigos + `PremiumTeaserDialog` (localizar por grep: `premium-teaser`, `history-teaser`, `scenario-teaser`, `bom-teaser` em `apps/web/src/features/*/`) — remover o modal "Cenários fazem parte do Premium"
- [x] T007 [US1] "Usar do catálogo": botão desabilitado E visível + explicação do que é o catálogo no lugar do texto removido, em `apps/web/src/features/catalog/` (componente do picker)
- [x] T008 [US2] Trocar os rótulos via chaves i18n (nunca hard-coded): navegação, títulos, cabeçalhos, botões, toasts, vazios, teasers em `apps/web/src/**` + rótulos dos artefatos exportados em `backend/app/services/quote_render.py` (se contiver o par antigo); rotas `/historico`/`/cenarios` e payloads INTOCADOS
- [x] T009 [US2] Texto de diferenciação nas duas telas (congelado × recalculado hoje) em `apps/web/src/pages/{historico,cenarios}/`
- [x] T010 [US1] Homologação visual (qa-produto): screenshot das 5 telas no grátis + comparação estrutural; tema claro E escuro (SC-901)
- [ ] T011 [US1] Gate da fatia: `pnpm gate:all` + e2e verdes; abrir PR-A (dono autoriza merge)

**Checkpoint**: PR-A entregável sozinha — maior clareza pelo menor custo.

---

## Phase 3: PR-B — US3 Header/logo + US4 Colunas + US5 Fusão de preços (Priority: P2)

**Goal**: desktop sem buracos (≥60% a 1440px), preço sem scroll POR CONSEQUÊNCIA da largura, logo
completa por tema, descritivos de preço num lugar só.

**Independent Test**: geometria por caixas a 360/390/1440 com valor adversarial; screenshots nos
dois temas.

### Tests (vermelho primeiro) ⚠️

- [x] T012 [P] [US4] Teste geométrico: largura útil ≥60% a 1440px + cartões de preço SEM scroll interno/quebra/transbordo a 360/390/1440 com R$ 95.057, em `apps/web/e2e/calculator-layout.spec.ts` (a guarda [F11a-002] FICA; asserção por boxes, não texto) — observar o vermelho a 1440

### Implementation

- [x] T013 [P] [US3] Logo completa: copiar os 2 PNGs do dono (`homologação/`) para `apps/web/src/app/assets/`, exibir variante por tema no header em `apps/web/src/app/` (componente do header)
- [x] T014 [US3] Sidebar à frente do header (preparação p/ colapso futuro; o colapso NÃO entra) sem regressão de foco/tab-order/leitor de tela, em `apps/web/src/app/` (layout)
- [x] T015 [US4] Layout desktop em colunas: título+subtítulo no topo, total centralizado ao final, em `apps/web/src/features/calculator/calculator-form.tsx` (+ CSS/Tailwind)
- [x] T016 [P] [US4] Centralizar textos dos cartões de preço final em `apps/web/src/features/calculator/` (componente dos cartões)
- [x] T017 [US5] Fundir "Preços por canal" em "Como chegamos no preço" (sem duplicar linha, sem perder informação) + remover marcadores laranja/roxo de Material/Energia, em `apps/web/src/features/calculator/calculator-form.tsx`
- [x] T018 [US4] Homologação visual (qa-produto): screenshots 360/390/1440 × claro/escuro, com valor adversarial (SC-903)
- [ ] T019 [US4] Gate da fatia + PR-B

**Checkpoint**: o item 9 do relatório (scroll) resolvido pelo item 2 (largura), com a guarda intacta.

---

## Phase 4: PR-C — US6 Tooltips + US7 h/min + US8 Máquina + US9 Máscara/seções (Priority: P2)

**Goal**: o formulário se explica sozinho e pergunta o que o vendedor SABE — sem bump, sem
migração, nada persistido muda (research R8: derivação de borda nunca entra em payload).

**Independent Test**: igualdade numérica antes/depois no vetor canônico (R$ 28,65/42,98/37,25);
`5.5` reabre `5h 30min`; ritmos derivam 780/3.600/9.900.

### Tests (vermelho primeiro) ⚠️

- [x] T020 [P] [US7] Testes da conversão h+min: bijetiva em minutos inteiros, 60min transborda, `5.33`→`5h 20min`, `5.5`→`5h 30min`, 0 ok, em `apps/web/src/features/calculator/time-input.test.ts`
- [x] T021 [P] [US8] Testes da derivação da máquina: `RITMOS=[260,1200,3300]` h/ano × payback 3 = 780/3.600/9.900; R$ 4.000 → ≈5,13/1,11/0,40 por hora (SC-906); valor salvo fora de ritmo×payback inteiro ⇒ modo "ajustar", em `apps/web/src/features/calculator/machine-cost.test.ts`
- [x] T022 [P] [US9] Prova de reorganização: resultado byte-idêntico no vetor canônico antes/depois das fusões de seção, em `apps/web/src/features/calculator/calculator-model.test.ts`

### Implementation

- [x] T023 [US6] Pesquisar as 11 explicações didáticas (público leigo, pt-BR: por que entra na conta + como descobrir o valor) com PROCEDÊNCIA por explicação, registradas em `specs/016-correcao-homologacao/conteudo-tooltips.md` (autorizado pelo dono; nenhum número vira recomendação sem fonte)
- [x] T024 [US6] Garantir que `InfoTip` funciona por hover, TECLADO e TOQUE (mobile não tem hover) — estender se preciso, sem trocar biblioteca, em `apps/web/src/shared/ui/` (componente InfoTip)
- [x] T025 [US6] Ligar os 11 tooltips (`?` à direita do rótulo) em `apps/web/src/features/calculator/calculator-form.tsx` + textos no i18n; nenhum altera cálculo/validação
- [x] T026 [US7] Implementar h+min na borda (2 campos → decimal; reabertura decimal → h+min) em `apps/web/src/features/calculator/calculator-form.tsx` (+ helper puro `time-input.ts`); o motor continua recebendo decimal
- [x] T027 [US8] Implementar a pergunta nova da máquina: valor pago (currency) · ritmo (3 opções sem digitar) · payback em anos; derivado "≈ R$ X por hora de impressão" em voz alta + modo "ajustar"; documento salvo fora dos ritmos reabre em "ajustar" com o número intacto, em `apps/web/src/features/calculator/calculator-form.tsx` (+ helper `machine-cost.ts`); motor intocado
- [x] T028 [P] [US9] Máscara monetária no "Valor da máquina" (modo `currency` do NumberField existente) em `apps/web/src/features/calculator/calculator-form.tsx`
- [x] T029 [US9] Fusões de seção: "Ajustes opcionais" → "Custos da peça"; acabamento → "Mão de obra e custos", em `apps/web/src/features/calculator/calculator-form.tsx`
- [x] T030 [US6] Homologação visual (qa-produto): tooltips nos 3 modos de acionamento + formulário reorganizado, 2 temas, mobile+desktop (SC-904)
- [x] T031 [US6] Gate da fatia + PR-C (PR #46, `ca98217`, 2026-08-06, owner-merged; homologação visual T030 veio FAIL 74% com 4 bloqueadores + ressalvas — B1 seed não-ritmo, B2 sem máscara de milhar, B3 selects ilegíveis a 360/390, B4 corte de 1px em "Tarifa de energia" — e R1/R2/R3/R6; todos corrigidos na mesma branch, vermelho-antes/verde-depois nas guardas novas, `pnpm gate:fe` + e2e 118/118 verdes antes do merge)

**Checkpoint**: todo o valor didático entregue sem tocar fórmula, versão ou banco.

---

## Phase 5: PR-D — US10 Remoção do Desperdício (Priority: P3) — ISOLADA, pricing-core 4.0.0

**Goal**: `wasteGrams` morre em tudo; o motor REJEITA em vez de ignorar; documentos antigos abrem
declarando o descarte. Bump MAJOR. **Não espera o E6** (interseção vazia, plan §H).

**Independent Test**: matriz de documentos (congelado antigo · simulação antiga · novo) abre sem
quebrar; recusa nominal dispara por chave presente mesmo com valor `undefined`.

### Tests (vermelho primeiro) ⚠️

- [x] T032 [P] [US10] ⚠opus Testes do 4.0.0 em `packages/pricing-core/tests/retired-fields.test.ts`: (a) `computeCalculator({...input, wasteGrams: 10})` → `ValidationError` nomeando o campo; (b) chave presente com `undefined` TAMBÉM recusa; (c) `computeBom` herda por linha; (d) `stripRetiredFields` remove por `delete` e devolve `discarded`; (e) `isPreRemovalModel("3.1.0")=true`/`("4.0.0")=false`; (f) `version.test.ts` amarra 4.0.0 ao major do package.json — observar o vermelho
- [x] T033 [P] [US10] ⚠opus Re-baseline dos casos numéricos canônicos SEM desperdício (material = gramas × custo/kg) em `packages/pricing-core/tests/` — observar o vermelho dos baselines novos antes de mudar o motor
- [x] T034 [P] [US10] Teste de postura do wire: POST filamento/produto com o campo removido → 422 nomeando a mudança, em `backend/tests/` (contract)

### Implementation

- [x] T035 [US10] ⚠opus pricing-core 4.0.0 em `packages/pricing-core/src/index.ts`: `RETIRED_INPUT_FIELDS`, recusa por chave ANTES de validar, `stripRetiredFields()`, `isPreRemovalModel()`, `PRICING_MODEL_VERSION="4.0.0"` + package.json major 4; remover `wasteGrams` da entrada e da fórmula (ratchet 100% mantido)
- [x] T036 [US10] Costurado 1 — `apps/web/src/features/calculator/scenario-bridge.ts`: hidratar via `stripRetiredFields`, subir `discarded` no `ScenarioFormPatch`, e a tela DECLARAR o descarte (FR-913)
- [x] T037 [US10] Costurado 2 — `apps/web/src/pages/historico/recalc-today.tsx`: declaração dirigida por `isPreRemovalModel(frozen.modelVersion)` onde o recálculo diverge por motivo estrutural
- [x] T038 [US10] Remover o campo da tela e dos fluxos: calculadora, filamentos (default), produtos, linhas de BOM em `apps/web/src/features/{calculator,catalog,bom}/` — motor rejeita, então TODO caminho precisa parar de enviar
- [x] T038b [US10] FR-914 — atualizar NESTA fatia o material de apoio de "Taxa de falha" e de "Gramas usadas" para dizer o que cada um cobre (purga/suporte/brim entram nas GRAMAS; falha é a impressão inteira perdida), em `apps/web/src/shared/i18n/messages.pt-br.ts` + tooltip correspondente — a frase só vira VERDADE quando o Desperdício morre, por isso é PR-D e não PR-C (achado C1 do analyze)
- [x] T039 [US10] Migração `backend/alembic/versions/0003_remove_waste.py`: DROP das 3 colunas + CHECKs (`filaments.default_waste_grams`, `products.waste_grams`, `bom_lines.waste_grams`); downgrade recria schema com default '0' e a nota "valores não são recuperáveis" ESCRITA na migração
- [x] T040 [US10] Wire: remover `defaultWasteGrams`/`wasteGrams` dos schemas + `extra="forbid"` em `FilamentIn`/`PieceInputs`; `scenarios.py` para de emitir em `lastKnown`; `boms.py` para de sincronizar; regen da RAIZ (`export_openapi` + `gen:api`) + prova de idempotência (drift-guard) em `backend/app/`
- [x] T041 [US10] Teste e2e da matriz de documentos em `apps/web/tests/e2e/waste-removal.spec.ts` (caminho real do repo — `apps/web/e2e/` não existe): congelado pré-4.0.0 abre/exporta o que foi cotado; simulação pré-4.0.0 reabre COM declaração visível; documento novo limpo; fixture irmão `frozen-payload-pre-016.json` criado ANTES da mudança de UI (RA1)
- [x] T042 [US10] Homologação visual (qa-produto): a declaração de descarte visível nos dois costurados + export do congelado antigo
- [ ] T043 [US10] Gate da fatia + drift-guard + PR-D

**Checkpoint**: 4.0.0 no ar; nenhum documento salvo quebra; nenhuma mentira silenciosa.

---

## Phase 6: PR-E — US11 Marketplace Premium + US12 Campos dirigidos + US13 Picker (Priority: P3)

**Goal**: a virada de freemium com a promessa reescrita e as Clarifications NA MESMA FATIA; a seção
de canal dirigida pelo catálogo; picker com hierarquia e contador verdadeiro.

**Independent Test**: grátis não obtém número de canal por NENHUM caminho; premium byte-idêntico;
Shopee sem categoria / Amazon lista 38 / ML idêntico a hoje.

### Tests (vermelho primeiro) ⚠️

- [x] T044 [P] [US11] Teste e2e do gate: grátis → switch desabilitado+falso, assinar visível, zero número de canal (5 telas + calculadora + deep-link com canal ativo), em `apps/web/e2e/marketplace-premium.spec.ts`
- [x] T045 [P] [US12] Testes do plano puro `channelFieldPlan` em `apps/web/src/features/calculator/channel-field-plan.test.ts`: regras 1–5 do desenho §F.2; `feeAxes` AUSENTE = 4 campos; categoria sse `categorySpine` não-vazio (mata a inferência categoria←modalidade); ML = comportamento de hoje
- [x] T046 [P] [US12] Prova byte-idêntica (FR-919): fixture de combinações suportadas hoje (3 marketplaces × determinantes atuais) reproduz resultado bit a bit, em `apps/web/src/features/calculator/calculator-model.test.ts`
- [x] T047 [P] [US13] Teste geométrico do picker: lista de resultados NÃO parece campo preenchido (boxes) + contador = N real (o 014 registrou "8" com 31), em `apps/web/e2e/category-picker.spec.ts`

### Implementation

- [x] T048 [US11] Switch premium: desabilitado e falso no grátis com `TeaserUpgrade` logo abaixo (visível, nunca escondido; sem número parcial/fake) em `apps/web/src/features/calculator/calculator-form.tsx` — autoridade de entitlement continua no servidor (ADR-0012)
- [x] T049 [US11] Reescrever a promessa da primeira dobra (o que é grátis: custo e markup, sem canal de venda) em `apps/web/src/pages/` (landing/calculadora) + i18n
- [x] T050 [US11] Clarifications datadas da virada em `specs/005-marketplace-multichannel/spec.md` (SC-109) E `specs/007-e2-catalog-entitlement/spec.md` (FR-313/SC-310) — NESTA fatia, nunca antes nem depois. A da 007 inclui a frase de enforcement (achado D1 do analyze): "o enforcement da virada é de UI porque o cálculo é offline por design e as tarifas são dado público semeado no bundle; o valor premium é a conveniência — decisão consciente, não drift do Princípio IV"
- [x] T051 [US12] Criar `apps/web/src/features/calculator/channel-field-plan.ts` (puro; alimenta render E `slotDeterminants` — RA5) + `feeAxes` no schema `apps/web/src/shared/fee-catalog/fee-catalog.ts` (aditivo) + curadoria em `seed.ts` e `backend/app/data/catalog.json` (Shopee/Amazon/ML conforme research R6; a curadoria muda CONTEÚDO ⇒ PR-E faz o SEU bump de `catalogVersion` via `nextCatalogVersion` — a regra é UM bump por fatia que muda conteúdo; o de PR-F é o T068 — achado F1 do analyze)
- [x] T052 [US12] Render dirigido da seção de canal + mover para depois de "Markup" e antes de "Como chegamos no preço" + remover "frete até a transportadora" dos exemplos de "Outros custos" + `MODALITY_OPTIONS` derivado do `determinantsSchema`, em `apps/web/src/features/calculator/{calculator-form.tsx,calculator-schema.ts}`
- [x] T053 [US12] FR-928: refine no schema (banda com `fixedFee` nulo sem `fixedFeeRule` = inválida) + `entryToChannelFees` sem `?? 0` (nível cai no estado I9), em `apps/web/src/shared/fee-catalog/fee-catalog.ts` + `apps/web/src/features/calculator/fee-prefill.ts` + teste
- [x] T054 [US13] Picker: navegação hierárquica (lista com subitens) + busca + contador verdadeiro + estado "não informada", em `apps/web/src/features/calculator/` (CategoryPicker)
- [x] T055 [US11] Homologação visual (qa-produto): grátis vs premium; screenshots dos 3 marketplaces (SC-908/909); geometria + imagem
- [ ] T056 [US11] Gate da fatia + PR-E

**Checkpoint**: a fronteira do freemium fechada SEM contradição silenciosa (promessa + 2
Clarifications viajaram juntas).

---

## Phase 7: PR-F — US14 Amazon Individual + US16 Volumoso + US17 Avisos + US18 Item barato CNPJ (Priority: P3) — pricing-core 4.1.0

**Goal**: as mudanças de dado/regra Shopee/Amazon; MINOR aditivo (ausência = 4.0.0); UM bump de
`catalogVersion` no fechamento.

**Independent Test**: Individual sobe exatos R$ 2,00/item; varredura de limiar em R$ 8 contínua;
volumoso soma R$ 50 com legenda; sem resposta de perfil → byte-idêntico.

### Pré-condição (bloqueia T059+)

- [ ] T057 [US18] Releitura VERBATIM do art. 26839 (seller.shopee.com.br/edu/article/26839, página JS — usar navegador headless como no workflow de 2026-08-05): registrar o trecho LITERAL do regime < R$ 8 CNPJ (a comissão de 20% incide junto? o fixo some?) e a condição exata do +R$ 3/item CPF, em `specs/016-correcao-homologacao/dod-evidence.md` — as fontes internas divergem em 20 p.p. (§9.3/§9.8); NENHUM número é gravado antes disto

### Tests (vermelho primeiro) ⚠️

- [ ] T058 [P] [US18] ⚠opus Testes do `fixedFeeRule` em `packages/pricing-core/tests/fixed-fee-rule.test.ts`: gross-up fechado com PCT_OF_PRICE; VARREDURA de bases cujo anúncio cruza R$ 8 (par anúncio/líquido contínuo, sem banda emprestada — I9); ≥ R$ 8 byte-idêntico; recusas (fora de SELECTION; c+p ≥ 100); não-vacuidade por mutação do `pct`
- [ ] T059 [P] [US16] ⚠opus Testes de `surcharges` em `packages/pricing-core/tests/surcharges.test.ts`: soma POR CIMA do fixo em regime constante E bandado (a armadilha 013/F1 — somar no fixedFee seria inerte); ausência = byte-idêntico; ecoado em `ChannelResult`; mutação do `value`
- [ ] T060 [P] [US14] ⚠opus Teste do dado Amazon: entradas INDIVIDUAL sobem exatamente R$ 2,00/item antes do markup; Profissional intocado; `minPerItem` segue 1,00, em `apps/web/src/shared/fee-catalog/fee-catalog.test.ts`
- [ ] T061 [P] [US17] Testes dos avisos: CPF < R$ 12 exibe os DOIS pontos oficiais e a hipótese linear NÃO é aplicada em cálculo nenhum; frete aferido é informativo (não bloqueia, não fabrica número, não some ao editar), em `apps/web/src/features/calculator/shopee-warnings.test.tsx`

### Implementation

- [ ] T062 [US18] ⚠opus pricing-core 4.1.0 em `packages/pricing-core/src/channels.ts`: `PriceBand.fixedFeeRule` + `bandFixedFee()` usada nas TRÊS chamadas (grossUpOnce · chooseBand.at · finish) + `ChannelInput/ChannelResult.surcharges` + versão 4.1.0 (contrato `contracts/pricing-core-4x.md`)
- [ ] T063 [US18] ⚠opus Dado Shopee CNPJ: partir a banda `[0,80)` em `[0,8)` (fixedFeeRule conforme T057) + `[8,80)` (fixedFee 4) em `apps/web/src/shared/fee-catalog/seed.ts` + `backend/app/data/catalog.json` + espelho do schema com `superRefine` (SELECTION only)
- [ ] T064 [US16] ⚠opus Volumoso: `optionalSurcharges` no catálogo (MANUSEIO_VOLUMOSO 50.00/ORDER, procedência art. 3305) + checkbox dirigido pelo catálogo com legenda "por pedido" + `ScenarioChannelIntent.surcharges` (ids, resolvem ao vivo — ADR-0021) + congelado via `freezeInput` existente, em `fee-catalog.ts`/`calculator-form.tsx`/`calculator-model.ts`/entidade de cenário
- [ ] T065 [US17] Perfil do vendedor: `determinantsSchema.SHOPEE.sellerProfile` + entradas CPF/CPF_ALTO_VOLUME (bandas começam em R$ 12 — §9.5; alto volume = CPF + R$ 3 já somado, conforme T057) + `slotDeterminants` (CNPJ/sem resposta → `null`, byte-idêntico) + as 2 perguntas só no canal Shopee, em `fee-catalog.ts`/`seed.ts`/`catalog.json`/`calculator-form.tsx`
- [ ] T066 [US17] Avisos honestos: CPF < R$ 12 (dois pontos oficiais + contexto) e frete aferido (informativo), em `apps/web/src/features/calculator/` + i18n
- [ ] T067 [US14] ⚠opus Amazon INDIVIDUAL: `fixedFee 0 → 2.00` nas 38 entradas (gerador em `packages/fee-ingest/` + `seed.ts` + `catalog.json`) + `FeeEntry.fixedFeeSource` (procedência `/precos`) + exibição no `FeeSeal`
- [ ] T068 [US14] Bump ÚNICO de `catalogVersion` via `nextCatalogVersion` (`packages/fee-ingest/src/guardrails.ts`) no fechamento da fatia + teste de sequenciamento
- [ ] T069 [US16] Export/PDF: linha nomeada da sobretaxa no breakdown impresso (via `ChannelResult.surcharges` ecoado) + asserção com DADO adversarial e geometria (lição E4), em `backend/app/services/quote_render.py` + teste
- [ ] T070 [US14] Homologação visual (qa-produto): Amazon Individual (preço subiu R$ 2 + selo com procedência própria) · Shopee CNPJ < R$ 8 · CPF < R$ 12 (aviso) · volumoso marcado/desmarcado — screenshots + geometria
- [ ] T071 [US14] Gate da fatia + PR-F

**Checkpoint**: todas as mudanças de preço decididas pelo dono no ar, cada uma com sua prova.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T072 Matriz de homologação transversal (spec §Assumptions): offline (PWA) · erro de rede real · sessão expirada · `/conta` no grátis · tema claro · 404/tela de erro · mobile 360px — MEDIR e registrar em `specs/016-correcao-homologacao/dod-evidence.md`; defeito achado vira follow-up priorizado, não escopo automático
- [ ] T073 [P] Consolidar `specs/016-correcao-homologacao/dod-evidence.md` (V0 + evidências por fatia + T057 verbatim) + a VARREDURA do SC-910 (achado C2 do analyze): toda folha de dinheiro do catálogo servido com `source` + data, e nenhuma superfície da UI exibindo número de tarifa sem procedência — resultado registrado; e propor ao dono o flip Proposed→Accepted dos ADRs 0026/0027 no gate final (0025 fica Proposed — adiado com o ML)
- [ ] T074 [P] Atualizar a linha de terreno (`CLAUDE.md`) e o marker SPECKIT ao fechar o incremento; registrar no `docs/token-ledger.md` toda operação multi-agente da implementação (estimar ANTES, real DEPOIS)

---

## Dependencies & Execution Order

- **T001 (V0)** primeiro; só bloqueia consertos do Grupo 0 (não bloqueia PR-A).
- **Fatias em ordem**: PR-A → PR-B → PR-C → **PR-D** → PR-E → **PR-F** → Polish. A posição de PR-D
  (antes de PR-F) é ESTRUTURAL: minimiza `PRICING_MODEL_VERSION` efêmeros carimbáveis em snapshot
  imutável (plan §H). PR-D NÃO espera o E6.
- **Dentro de cada fatia**: testes escritos e observados FALHANDO antes da implementação; gate
  (`pnpm gate:all` + e2e + drift-guard onde houver backend) fecha a fatia; o dono autoriza cada PR.
- **T057 bloqueia T058–T067** (nenhum número Shopee < R$ 8 sem o trecho verbatim).
- **T005 depende de T004**; **T036/T037 dependem de T035**; **T062 precede T063/T064**;
  **T068 é o último toque de dado da PR-F**.

## Parallel Example: PR-D

```text
# Testes primeiro, em paralelo (arquivos distintos):
T032 retired-fields.test.ts · T033 re-baseline numérico · T034 postura do wire
# Depois, sequencial: T035 (motor) → T036/T037 (costurados, paralelos entre si) → T038–T041
```

## Implementation Strategy

**MVP = PR-A** (US1+US2): entrega sozinha a maior clareza pelo menor custo e fecha [F11b-007].
Cada fatia seguinte agrega valor sem quebrar as anteriores; é legítimo PARAR após qualquer
checkpoint — PR-A..PR-C não deixam meio-produto (nenhuma muda versão ou banco). A partir de PR-D,
cada fatia carrega sua prova de compatibilidade com documentos salvos.
