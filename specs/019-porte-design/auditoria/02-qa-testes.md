# Auditoria de implementabilidade 019 — parecer 02: tasks de teste (Phases 5–10)

> Agente `qa-software` (sonnet), 2026-08-27, só leitura. Entrada bruta da síntese.

## Achados por task

| task | achado (fato, arquivo:linha) | sev. | task reescrita |
| --- | --- | --- | --- |
| T036 | `shared/billing/premium-teaser.tsx:1-8` já mora aí; `premium-gate.ts` não existe. Caminho livre. | OK | — |
| T037 | `catalog-panel.test.tsx` existe. O ramo real (`catalog-panel.tsx:228-231`, `ENTITLEMENT_REQUIRED`) renderiza `<EmptyState icon="crown" title={apiError.entitlementRequired}/>` — **nunca** `<PremiumTeaser>`. "NÃO renderiza PremiumTeaser" é vácua; o teste tem de afirmar o que passa a existir E a ausência do `EmptyState` genérico anterior. | RETRABALHO | T037: no `free-nunca-teve` o painel renderiza o vazio didático em vez do EmptyState atual (crown/entitlementRequired); afirmar ausência de `PremiumTeaser` (não-regressão) E do EmptyState genérico; "Adicionar filamento" abre o form; form dentro de `<Frozen>`; nenhuma chamada de rede ao clicar em tudo; "Salvar" disabled visível; "Assinar Premium" secondary; frase ANTES da linha de botões no DOM. |
| T038 | `catalogo.lapsedTitle/lapsedBody` já existem (`messages.pt-br.ts:645-647`) e renderizam em `catalog-panel.tsx:444-448` para `lapsed && items>0`; `reactivateTitle/reactivateBody` (`:651-652`) já são byte-idênticos à frase-alvo e já vivem no ramo `readOnly` do mestre-detalhe. A US3 não cria copy aqui: leva o padrão ao Sheet mobile e APAGA a faixa `:444-448`. | PRECISÃO | T038: itens aparecem; a faixa `Alert(lapsedTitle/lapsedBody)` `:444-448` NÃO renderiza mais; o form (Sheet mobile E ficha) abre PREENCHIDO em `<Frozen>` com `reactivateTitle/reactivateBody` (`:651-652`). |
| T039 | `pages/historico/historico-page.test.tsx` **NÃO EXISTE** (há `historico.test.tsx`, `historico-teaser.test.tsx`, `historico-selecao.test.tsx`, `recalc-today.test.tsx`, `snapshot-detail.test.tsx`). | BLOQUEIA | T039: `pages/historico/historico-teaser.test.tsx` (o vazio grátis já tem casa) + `scenarios-list-sheet.test.tsx`: frase verbatim 32c; "Fazer um cálculo" → `/calcular`; UM `TeaserUpgrade` por tela. |
| T040 | `grant_premium.py:150-156,167` aceita `--expires`; `history-helpers.ts:41-57` `grantPremium(email)` NÃO aceita expiração. Sem estender o helper, o teste testa "nunca-teve", não "vencido". `forcarExpiracao` (`billing-lifecycle.spec.ts:32-54`) é para transição ativo→vencido, não para nascer vencido. | RETRABALHO | Estender `grantPremium(email, {expiresAt?})` → `--expires <passado>`. |
| T047 | Fixar QUANDO: `git fetch origin develop` e comparar contra `origin/develop`, não `develop` local. | PRECISÃO | — |
| T049 | **`features/calculator/plausibility.tsx` não existe** e T056 não promete criá-lo; a lógica mora em `shared/lib/plausibilidade.ts` (`avisoDeCampo`…) e renderiza dentro de `ControlledField` (`calculator-form.tsx:179-197`) a cada render — hoje dispara no `change` (bug real do FR-1909/AC1). Teste órfão. | BLOQUEIA | T049: `features/calculator/calculator-form.test.tsx` (casos novos sobre `ControlledField`): "85"→"850" sem blur ⇒ zero aviso (vermelho hoje); blur ⇒ `role="status"`; "Entendi" some; 2.400+blur volta; erro de validação ⇒ aviso PERMANECE; "R$ 6.000.061,60". Se T056 extrair componente/hook, renomear o alvo. |
| T051 | `machine-cost.ts` só tem funções puras (`RITMOS_HORAS_ANO`, `deriveMachineLifetimeHours`, `costPerHour`, `detectRitmoMode`); readout/diálogo/ressalva não existem. `PRICING_MODEL_VERSION` mora em `packages/pricing-core/src/index.ts:29`; o vetor canônico em `computeCalculator.test.ts`/`channels.test.ts`/`computeBom.test.ts` — asserir "4.1.0" em `calculator-model.test.ts` é o lado errado. | RETRABALHO | Dividir: (a) readout/ressalva onde T057 decidir (Dialog = UI); (b) `packages/pricing-core/tests/computeCalculator.test.ts`: versão 4.1.0 + vetor intacto. |
| T052 | `fee-seal.tsx`/`fee-seal.test.tsx` existem; o selo é `<Badge>` (`:100-107`), sem `onDismiss`/`action`. "Criar" é o verbo errado (reescrita Badge→Alert). `fee-seal.css` só tem `.tf-badge.fee-seal` — a frase "apagar o CSS local que o compact substituiu" (T058) NÃO tem alvo (já resolvido na T021). | RETRABALHO | T052 reescrita (Badge→Alert compact; chave `(marketplace, source, effectiveDate)` em localStorage; 50 chaves). Tirar de T058 a frase do CSS local. |
| T053 | `NumberFieldProps` (`number-field.tsx:15-23`) não tem `precision`; `handleBlur` (`:64-71`) faz `formatDecimal(n, 2)` HARDCODED — bug confirmado. | OK | — |
| T054 | Nenhum `data-testid="price-summary-sticky"` existe; nasce na T059. | PRECISÃO | — |
| T062 | `backend/tests/test_migrations.py:19-22` usa `PostgresContainer` PRÓPRIO para downgrade (a fixture `conftest.migrated_db` só faz upgrade uma vez por sessão). Round-trip contra `migrated_db` nunca exercita downgrade. | RETRABALHO | Seguir `test_full_downgrade_to_base_then_reupgrade_to_head_round_trips_cleanly`. |
| T063 | Sem precedente Python lendo fora de `backend/`; resolver via `Path(__file__).resolve().parents[2] / "specs/019-porte-design/contracts/fixtures/name-norm.json"`. | PRECISÃO | — |
| T065 | Nenhum teste de CORRIDA no backend. `TestClient` síncrono não exercita contenção; precisa de duas conexões/transações explícitas (`session.begin()` + `threading.Event`) ou `httpx.AsyncClient` + `asyncio.gather`. | BLOQUEIA | T065: mecanismo nomeado e registrado em dod-evidence (não-vácuo por desenho, não por timing). |
| T067 | `entities/catalog/price-observations.ts` não existe (novo). Sem precedente de `vi.mock("@3dprecify/pricing-core")`; desnecessário: rodar o motor real e observar a ORDEM via spy no cliente HTTP/mutation. | PRECISÃO | — |
| T068 | `products-panel.test.tsx` existe. Único `fmtDate` conhecido é local em `fee-seal.tsx:40-43` (não exportado) — decidir promover a `shared/lib` ou registrar a reimplementação. | PRECISÃO | — |
| T069 | `tf-table` medido aqui é o que a PRÓPRIA PR-D aplica (T076); T097 só confere. | PRECISÃO | — |
| T080 | Não existe fixture 4.1.0. Commitar `packages/pricing-core/tests/fixtures/version-equality-4.1.0.json` (gerada UMA vez por script descartável ANTES de tocar `src/index.ts`; array `{input, output}` para `computeCalculator` e `computeBom`, 3 canais + casos-limite de `channels.test.ts`/`computeBom.test.ts`). | RETRABALHO | — |
| T081 | `models/__init__.py:625` `name="headline_matches_totals"` existe. Só-upgrade pode usar `migrated_db`; container isolado só se houver downgrade. | PRECISÃO | — |
| T082 | `history.py:71` `_BASIS_TOTAL_KEY`, `:171` consulta. `test_export.py:606-641` já tem `_pdf_text`; `test_the_quote_never_says_canal` (`:672-689`) usa. T082 tem de reusar `quote_render.build_quote_view/render_quote_pdf` + `_pdf_text`, não um 2º extrator. | RETRABALHO | T082: casos novos em `test_export.py` (não arquivo novo) + `test_history_basis_mirror.py` só para a guarda de conjuntos. |
| T083 | `quote-builder.tsx` não existe (novo). `vi.spyOn` em export ESM de `@3dprecify/pricing-core` pode não interceptar (sem precedente). Alternativa: motor real + igualdade com soma calculada fora da tela. | BLOQUEIA | — |
| T084 | Geometria fina do PDF já é do pytest (`test_export.py` `_long_name_quote` `:961`, `_pdf_text`); o e2e só confirma download + bytes plausíveis. | PRECISÃO | — |
| T090 | `messages.pt-br.ts:645,791,1083` — "Premium pausado" em catalogo/bom/historico (4ª ocorrência: catalogo, fora da enumeração). Decidir 3 ou 4 e comparar TODAS. | RETRABALHO | — |
| T091 | `scenario-context-bar.tsx:205,233` e `scenarios-list-sheet.tsx:149,388` já usam `t.rename`/`t.renameSheetTitle` — D2 pode já estar satisfeito; vira guarda de não-regressão provada por mutação. | PRECISÃO | — |
| T092 | `ScenariosList` não existe (export real: `ScenariosListSheet`, `scenarios-list-sheet.tsx:452`); nasce na T095. | PRECISÃO | — |
| T093 | `pages-desktop-width.spec.ts:1-40` mede `widthRatio` (proporção de `.tf-shell__main > section`), não px. Usar o mesmo método. | PRECISÃO | — |
| T100 | **`band-dominance.test.ts` não existe** — o real é `band-dominance.artifact.test.ts`. | BLOQUEIA | T100: vetor canônico (`computeCalculator.test.ts`/`channels.test.ts`/`computeBom.test.ts`) + `band-dominance.artifact.test.ts`. |
| T101 | `_diag-foco` já apagado na T029 (PR-A); T101 é confirmação (grep zero), não remoção. | PRECISÃO | — |

## Tasks NOVAS de teste / helpers

- N1 [P] [US3] `history-helpers.ts:41` `grantPremium(email, { expiresAt? })` → `--expires` (flag existe: `grant_premium.py:167`).
- N2 [US4] Decidir/documentar o mecanismo de espionagem do motor em vitest (sem precedente) — bloqueia T067 e T083.
- N3 [US5] Helper de concorrência backend (`backend/tests/_concurrency.py`): transação segurada por `threading.Event`/duas conexões.
- N4 [US6] Commitar `packages/pricing-core/tests/fixtures/version-equality-4.1.0.json` antes de tocar `src/index.ts`.
- N5 [P] [US7] Medir se D2 já está satisfeito antes de escrever `rename-key.test.ts`.

## Mapa SC → task

| SC | task(s) | lacuna |
| --- | --- | --- |
| SC-1901 | T001–T005 | — |
| SC-1902 | T011, T016 | — |
| SC-1903 | T047, T040, T036/T037 | — |
| SC-1904 | T027 | — |
| SC-1905 | T053, T060 | — |
| SC-1906 | T079, T081, T084 | "soma pelo motor sem paralelo" fraco sem N2 |
| SC-1907 | T093, T054, T069 | nenhuma task varre TODAS as telas tocadas nos 4 cortes; T102 não pede geometria |
| SC-1908 | T090, T091 | D1 pode faltar o 4º texto; D2 pode já valer |
| SC-1909 | T047, T061, T078, T089, T099 | — |

## Asserções vácuas em jsdom → e2e

Nenhuma task T036–T101 tenta contraste/geometria em jsdom (lição internalizada). T084 duplica em e2e o que `test_export.py` já prova com precisão maior.

**Prioridade**: T065 (mecanismo de corrida), T049 (alvo inexistente), T039 e T100 (nomes de arquivo), N2/T067/T083 (mock do motor).
