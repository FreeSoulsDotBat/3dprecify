# Auditoria de implementabilidade 019 — parecer 06: arquitetura (macro, ordem, FSD, decisões)

> Agente `arquiteto` (opus), 2026-08-27, só leitura; conferiu cada caminho/símbolo/linha de T036–T104. Entrada bruta
> da síntese (`../analise-implementabilidade.md`).

## Achados por task (resumo fiel; o texto reescrito completo foi aplicado no tasks.md)

| task | achado (arquivo:linha) | sev. |
| --- | --- | --- |
| T036 | A união precisa de um 5º estado `signed-out` (E-5/FR-1906); hoje `signedOut` é derivado à parte em `catalogo-page.tsx:105`, `historico-page.tsx:75`, `scenarios-list-sheet.tsx:459`. Teste do grafo de import: `premium-gate.ts` não importa `@/entities` nem `@/features`. | RETRABALHO |
| T037 | (a) O ramo `ENTITLEMENT_REQUIRED` não existe para o deslogado: `use-catalog.ts:98` `enabled: status === "authenticated"` ⇒ sem sessão o painel cai em `catalog-panel.tsx:240` (lista vazia) — o vazio didático ocupa DOIS ramos. (b) `:228-231` não tem `addButton` (`:192-196`). (c) `catalog-panel.tsx:76` e `filament-form.tsx:31` tipam `onSubmit` OBRIGATÓRIO — "não passar o handler" é mudança de assinatura. (d) Salvar é removido, não desabilitado (`filament-form.tsx:98-102`). (e) `Frozen` é `<fieldset disabled>` (`frozen.tsx:23`): "Assinar Premium" dentro dele fica INERTE — fora do fieldset (`closest("fieldset[disabled]") === null`). | BLOQUEIA |
| T038 | Remover a faixa `catalog-panel.tsx:444-448` órfã `catalogo.lapsedTitle/lapsedBody` (`messages:645`) que a T090 quer vigiar — conflito B×F; decidir se as chaves são apagadas. | RETRABALHO |
| T039 | (a) `historico-page.test.tsx` não existe. (b) O grátis nunca chega a um vazio: paredes em `historico-page.tsx:75,:80` e `scenarios-list-sheet.tsx:462`. (c) `HistoryListState` (`use-history.ts:150-166`) NÃO expõe `error` (ao contrário de `CatalogListState`, `use-catalog.ts:54`) — um 403 vira parede fria. | BLOQUEIA |
| T040 | Depende das paredes caírem; "outbox 0" precisa da chave real (`use-history.ts:171 outboxQueryKey`); deslogado: `TeaserUpgrade` já emite `/sign-in?redirect=/conta?assinar=1`. | RETRABALHO |
| T041 | `teaser-sweep.spec.ts:20-24` ancora nos títulos `premiumTeaser.*` que somem — a âncora muda para o título do vazio didático. | RETRABALHO |
| T042 | As 6 superfícies são: Filamentos, Impressoras, Produtos, Kits (`catalogo-page.tsx:29-34`), Orçamentos, Simulações. Roda ANTES de T036–T041. | PRECISÃO |
| T043 | `EmptyState` (`empty-state.tsx:26`) já É o `tf-empty`; `vazio-didatico.tsx` COMPÕE `<EmptyState>` sem CSS próprio (guarda T006). | RETRABALHO |
| T044 | "para o logado" contradiz E-5/FR-1906; falta o 2º ramo (`:240-248`); "botão disabled por plano" não existe (`addButton :192` nunca recebe `disabled`). | BLOQUEIA |
| T045 | `renderForm.onSubmit` obrigatório (`catalog-panel.tsx:76`, passado em `:470,:351`); `filament-form.tsx:31,:53`; `produto-page.tsx` fieldsets `:298,:366,:386`, `readOnly` de `catalogo-page.tsx:100`. Tornar `onSubmit` OPCIONAL; sem handler o `<form>` monta sem `onSubmit`; Salvar `type="button" disabled` visível; "Assinar" FORA do `<Frozen>`. | BLOQUEIA |
| T046 | Não existe "Montar kit" disabled: `bom-page.tsx:136` (`status==="none"`) e `:116` (deslogado) devolvem `<BomGatePanel>` — paredes inteiras. `historico-page.tsx:117/:341` só é alcançado por conta ativa. | BLOQUEIA |
| T047 | Espelho: `git diff develop -- backend/app/api` também vazio; rodar `tests/homologacao`. | PRECISÃO |
| T048 | Entrada-com-intenção JÁ EXISTE: `TeaserUpgrade` → `/sign-in?redirect=/conta?assinar=1` (`catalogo-teaser.test.tsx:113`, `teaser-upgrade.test.tsx:78-85`). Só a copy da 32h entra por cima. | PRECISÃO |
| T049 | O módulo já existe: `shared/lib/plausibilidade.ts` (`LIMIARES`, `avisoDeCampo`, testes, copy `messages.calculator.plausibilidade:120`). (a) **850 g não dispara**: `printGramsMax = 50_000` (`:67`) — prancheta ≠ produto ~59×. (b) "erro não come o aviso" REVERTE `calculator-form.tsx:175-178` (decisão escrita). (c) `fmt` sem `style:"currency"` (`:81-83`) sai "6.000.061,6". | BLOQUEIA |
| T050 | `plausibilidade.ts:26-29`: `features/bom` consome os avisos e não pode importar `features/calculator` (`eslint.config.mjs:83`) — o store do "Entendi" tem de morar em `shared/lib`. | BLOQUEIA |
| T051 | `machine-cost.test.ts` (não `.tsx`), puro; readout/diálogo em `calculator-form.tsx:436-460`; rótulos hoje `adjustButton`/`backToEstimateButton` (`messages:490-491`) — o par vira `<Segmented split>` (primitivo da PR-A sem consumidor). | PRECISÃO |
| T053 | A perda é no `handleBlur` (`number-field.tsx:64-76`, `formatDecimal(n, 2)`) — o comentário `:58-63` ("nunca muda o valor semântico") é falso para 4 casas; `precision` atravessa os DOIS `ControlledNumber` (`features/calculator` e `features/catalog/catalog-controls.tsx`). | RETRABALHO |
| T055 | Transcrição está DEPOIS dos testes verbatim (mesmo defeito em T042/T074/T087). | RETRABALHO |
| T056 | Dois sítios de render: por campo (`:190,:309,:455`, `tf-field__aviso`) e por resultado (`AvisoDeResultado :122-131`); `widgets/bom-line-editor` herda. | RETRABALHO |
| T059 | (a) `calcular-page.css` não existe; layout em `features/calculator/calculator-form.css` (`.tf-calc-page:10`, `.tf-calc-grid:33`, `.tf-calc-footer:74`). (b) Corte da página é **1024** (`:25,:40,:65,:81`), não 1280. (c) O bloco de preço é o `.tf-calc-footer`, ÚLTIMO elemento (`calcular-page.tsx:572`) — "sticky no topo da coluna" descreve DOM inexistente. | BLOQUEIA |
| T060 | `features/scenarios/scenario-bridge.ts` não existe — é `features/calculator/scenario-bridge.ts` (`calcular-page.tsx:36`, `produto-page.tsx:39`; fronteira em `scenarios-list-sheet.tsx:50-51`). Fecha o follow-up R5 (máscara de milhar). | RETRABALHO |
| T062 | Índice único parcial sobre dados com possível colisão prévia ⇒ `CREATE UNIQUE INDEX` falha; o backfill desempata "(2)" antes (R6: nada descartado). | BLOQUEIA |
| T064 | O 403 do PUT no `lapsed` acontece em TODA visita — silencioso no cliente. | PRECISÃO |
| T065 | 2º caminho de escrita: `boms.py:397 _materialize` na transação única do kit (`:593-595,:641`) — `IntegrityError` sem SAVEPOINT aborta tudo; `boms.py:13` casa por `btrim(name)` exato. | BLOQUEIA |
| T067 | **Fronteira FSD**: o recompute mora em `features/calculator` (`computeFromForm`, `product-mapping.ts`, `catalog-prefill.ts`, composto em `produto-page.tsx:23-24,38`); `entities/*` só importa `shared` (`eslint.config.mjs:84`); `features/catalog` não importa `features/calculator` (`:83`). `price-observations.ts` em entities recebe os preços por argumento. | BLOQUEIA |
| T068 | A lista NÃO tem preço (`products-panel.tsx:20` "Never a price in a row (FR-310)"; `kits-panel.tsx:11`) — a maior peça da PR-D sem task; produtos degradados (`productNeedsAttention :66`) não recomputam — nunca "R$ 0,00". | BLOQUEIA |
| T069 | Envenenamento: `useProducts` depende de `useFilaments`/`usePrinters` (`products-panel.tsx:27-28` `filamentsLoading`/`printersLoading`) — PUT só quando os dois resolveram. | BLOQUEIA |
| T070 | Cache: `ProductOut` inteiro em IDB uid-keyed (`catalog-cache.ts:61`); entradas pré-0008 voltam com `undefined`, não `null` — os dois = "não fixado" (`:41-51` não versiona). | PRECISÃO |
| T071 | CHECKs novos em `Product.__table_args__` (`:207-239`); `name_norm` nos 4 modelos. | PRECISÃO |
| T072 | `require_catalog_read` em `entitlement/__init__.py:105-115`; registrar o router. | PRECISÃO |
| T076 | `tf-table ≥1024` conflita com ADR-0031 (único limiar 1280, `use-is-wide.ts`; emenda §6 proíbe 2º gate); em ≥1280 o Catálogo já é o mestre-detalhe (`catalog-panel.tsx:249-367`). | BLOQUEIA |
| T079 | `reject_bad_leaves` rejeita QUALQUER float (`validation.py:106-110`) — `discount.value: number` do ADR-0034 §1 é 422; folhas de dinheiro do QUOTE fora de `_MONEY_POSITION_KEYS` (`:52`) ⇒ E4-01. Dinheiro do documento = STRING decimal. | BLOQUEIA |
| T081 | Três constraints: `kind_enum` (`models:584`), `headline_basis_enum` (`:586`), `CASE` (`:618-626`). | RETRABALHO |
| T082 | Quatro espelhos (+ `_BASIS_CAPTION :247`); `_basis_key` cai em `precoVarejo` (`quote_render.py:97`) ⇒ total vazio no PDF do cliente. | BLOQUEIA |
| T083/T088 | `quote_render.py:202` lê `line.totals[key]`, não `unitPrice`/`subtotal` — "a forma que o PDF já lê" é FALSA; `RecordForm` (`record-snapshot-sheet.tsx:113-124`) `if (!total) return` ⇒ QUOTE não grava; `FrozenSnapshotPayload.kind` (`frozen-payload.ts:140`) é `"SINGLE"\|"KIT"`. | BLOQUEIA |
| T084 | Offline contraditório: `useRecordSnapshot` enfileira no outbox (contra research §K) e o PDF exige id do servidor (`use-export.ts:30-31`). | BLOQUEIA (decisão do dono) |
| T086 | Falta `_BASIS_TOTAL:31`, `_BASIS_CAPTION:247` (imprimiria `PRECO_ORCAMENTO` cru) e o ramo QUOTE em `build_quote_view:195`. | BLOQUEIA |
| T090 | "Premium pausado" literal em `catalogo.lapsedTitle` (`:645`), `bom.lapsedTitle` (`:791`), `scenarios.lapsedTitle` (`:1083`), `conta.planLapsed` (`:550`); `historico` tem `lapsedBody` (`:968`). A PR-B remove a faixa do Catálogo. | RETRABALHO |
| T091/T096 | D2 JÁ FEITO: `scenarios-list-sheet.tsx:388/:149` e `scenario-context-bar.tsx:233/:205` usam `t.renameSheetTitle`/`t.rename`. T096 é no-op → RETIRADA. | RETRABALHO |
| T092/T095 | `ScenariosList` não existe; `ScenariosListSheet` (`:452`) e o privado `ScenarioListBody` (`:478`); `showTeaser :462` no wrapper. Hospedeiro em aberto (VIII); `calcular-page` tem corte de 1024 (`calculator-form.css:25,40,65,81`) — 1280 + 1024 na mesma tela exige emenda. | BLOQUEIA (decisão do dono) |
| T097 | Só medição (D antes de F). | RETRABALHO |
| T098 | `searchEmptyTitle/Body` só no ramo largo (`catalog-panel.tsx:281-293`); `staleHint` em `:316` e `:391`; a faixa fica (`:437-441`). | PRECISÃO |
| T101 | `_diag-foco.spec.ts` não existe (T029 apagou); o diretório tem `_diagnostico.spec.ts`. | PRECISÃO |
| T104 | `docs/adr/README.md:34-36` já lista 0032–0034; o buraco é `0024–0031` (`:33`) e o status stale do 0023 (`:32`). | PRECISÃO |

## Tasks NOVAS (estruturas sem dono)

- N1 [US3] Reescrever `pages/catalogo/catalogo-teaser.test.tsx` (`:70,:74,:76,:111` assertam a parede que a PR-B reverte) — commit separado (research §J).
- N2 [US3] `tests/e2e/catalog.spec.ts:143,:157-182` ancoram no `premiumTeaser.CATALOG.title` — passam ao vazio didático.
- N3 [US3] `tests/homologacao/cf-011-048-shell-teasers-rotas.spec.ts:24-26` varre `/catalogo`, `/kits`, `/historico` pelos títulos de teaser.
- N4 [US3] `HistoryListState` (`use-history.ts:150-166`) ganha `error: ApiError | null` (molde `use-catalog.ts:54`).
- N5 [US3] `ScenarioListBody` ganha o ramo `ENTITLEMENT_REQUIRED` → vazio didático.
- N6 [US3] `catalog-panel.tsx:88` `lapsed?: boolean` → estado do `premiumGate` (união de 5) nos 4 painéis (`filaments-panel.tsx:46`, `printers-panel`, `products-panel.tsx:74`, `kits-panel`).
- N7 [US3] Guarda de AUSÊNCIA no módulo: nenhuma mutação de escrita (`useCreate*`, `useUpdate*`, `useDelete*`, `useRecordSnapshot`) chamada sob gate ≠ `active` (molde SC-709/E6).
- N8 [US3] Decidir QUAL elemento carrega o único convite: `TeaserUpgrade` no `<VazioDidatico>` ou o "Assinar Premium" do rodapé — `premium-teaser.tsx:20-24`, `teaser-sweep.spec.ts:9-12`.
- N9 [US4] `precision` atravessa os DOIS `ControlledNumber` (`features/calculator`, `features/catalog/catalog-controls.tsx` usado por `filament-form.tsx:70-83`).
- N10 [US4] `widgets/bom-line-editor` herda blur + "Entendi".
- N11 [US4] Corrigir `shared/ui/field.css:166` (aponta para `features/calculator/plausibilidade.ts`; é `shared/lib`).
- N12 [US5] **Decidir ONDE o preço da lista é recomputado** (fronteiras): (a) mover `computeFromForm`/`product-mapping`/`catalog-prefill` para `entities/pricing`; (b) compor em `pages/catalogo/catalogo-page.tsx` e injetar por prop; (c) `products-panel` vira `widgets/`.
- N13 [US5] `catalog-cache.ts`: observação NÃO ganha cache de dispositivo (senão entra em `purgeCatalogCache :69-79`).
- N14 [US6] `frozen-payload.ts`: `kind` 3 valores, `FrozenTotals.precoOrcamento?`, `FrozenQuoteLine`; fixtures pré-019 leem idêntico.
- N15 [US6] `validation.py:52` `_MONEY_POSITION_KEYS` cresce (`lines`, `costFloor`, `discount.amount/grossTotal` — nunca `value`).
- N16 [US6] Teste de contrato: payload QUOTE do cliente aceito por `SnapshotIn._validate_frozen_document` (`history.py:131-189`) end-to-end.
- N17 [US7] Se a 20g fizer Simulações destino: rota em `app/router.tsx` + item em `app-nav.tsx:28-32` (1 segmento — `base:'./'`); hoje o nav tem 5 itens.
- N18 [Polish] Dar consumidor — ou declarar mortos — a `tf-btn--full/--half`, `tf-segmented--split`, `tf-badge--warning` (só em teste hoje).
- N19 [Polish] Precache do PWA para assets novos (lição 016/Polish, 009/T016-N5), provado no `dist/sw.js`.

## Ordem/dependências a corrigir

1. Transcrição (T042/T055/T074/T087) para o TOPO de cada fase, antes dos vermelhos.
2. PR-B × PR-F (T038 × T090): decidir na T038, refletir na T090.
3. PR-C × PR-F (T059 × T095): mesma folha `calculator-form.css`; F relê a medida da C.
4. PR-C × PR-D (T053/N9 × T076): D consome `precision`.
5. PR-D × PR-F (T076 × T097): T097 é só medição.
6. PR-D → PR-E (T065 × T085/T088): unicidade de nome muda a materialização; verde antes de PR-E montar kits.
7. Diagrama §Dependências (tasks.md:270-280): seta F→E contradiz a legenda; Phase 8 depende de A + 0008.
8. T010 já feito — T063 destravada.

## Decisões que a autoridade já responde

Deslogado sem parede (E-5/FR-1906) · vazios de Orçamentos/Simulações levam à calculadora — as paredes caem (handoff 32f, `README.md:120-121`, FR-1906, `ui-porte.md` §C2) · "Assinar" FORA do `<Frozen>` (research §A, `frozen.tsx:15-18`) · `premiumGate` puro em `shared/billing` (research §E-1, `eslint.config.mjs:62,85`) · barreira = ausência do handler (research §E-2) · store de plausibilidade em `shared/lib` (`plausibilidade.ts:26-29`) · um teaser (016/US1) · dispensa do selo por chave de conteúdo (research §G) · `quote_validity_days` já existe (`models:652`, Q7) · 0009 = três constraints · dinheiro como STRING (`validation.py:75-83`, `history.py:120-122`) · imutabilidade/UNIQUE/PATCH-de-label intactos (ADR-0034 §2) · nenhum 2º `matchMedia` sem emenda (ADR-0031 §Emenda 6) · D2 já feito.

## Decisões que só o dono responde (cinco)

1. **`tf-table`**: (a) substitui a coluna-mestre a 1280 (redesenha o 018); (b) emenda datada no 0031 com limiar nomeado 1024 só para densidade; (c) `tf-table` sem consumidor no 019. Bloqueia T076/T097.
2. **Hospedeiro de Simulações ≥1280**: coluna de `/calcular` (corte 1024 + 1280 na mesma tela) ou destino novo (rota + 6º item, N17). Bloqueia T092/T095.
3. **A parede de `/kits` cai junto?** `bom-page.tsx:116/:136` não está nomeado em lugar nenhum. Bloqueia T046.
4. **"Enviar" offline**: (a) exige conexão; (b) congela offline, PDF na sincronização; (c) PDF no cliente — rejeitada (ADR-0020). Bloqueia T084/T088.
5. **Limiar de gramas**: prancheta 850 g × `printGramsMax = 50_000` (`plausibilidade.ts:67`). Bloqueia T049.
