# Auditoria de implementabilidade 019 — parecer 03: frontend PR-D / PR-E / PR-F

> Agente `dev-frontend` (sonnet), 2026-08-27, só leitura. Entrada bruta da síntese.

## Achados por task

| task | achado (fato, arquivo:linha) | sev. | task reescrita / nota |
| --- | --- | --- | --- |
| T067 | `entities/catalog/price-observations.ts` não existe; a única leitura/escrita hoje é `use-catalog.ts` (uid-keyed Query + idb). O "recompute de todos os itens" NÃO tem produtor: `products-panel.tsx:26-42` só lista nomes (`productSummary`, `product-summary.ts:15-28` — "FR-310 — a row price would imply a stored snapshot"). O recompute por item precisa ser CONSTRUÍDO: `productToForm` (`features/calculator/product-mapping.ts:68`) + `computeFromForm` (`calculator-model.ts:443`) em LOOP sobre `useProducts().items`, contra `useFeeCatalog()` — hoje só 1× em `produto-page.tsx:142-149`. | RETRABALHO | T067: hook `useRecomputedProducts(products, catalog)` → `{id, precoVarejo}[]`; o `PUT` só dispara DEPOIS que o mapa terminou para TODOS os itens exibidos; falha do PUT ⇒ próxima visita repete; sem observação ⇒ nada. |
| T068 | `CatalogPanel` (`catalog-panel.tsx:106-513`) é genérico e COMPARTILHADO por filaments/printers/products/kits; `rowName`/`rowSummary` (`:61-102`) só aceitam string — não há `rowPrice`/`rowWas`/`rowFlag`. | BLOQUEIA | Depende da decisão N2 (estender `CatalogPanel` × lista dedicada). |
| T069 | `useIsWide()` = 1280 (`shared/lib/use-is-wide.ts:27`); a 1280+ o Catálogo é MESTRE-DETALHE (`catalog-panel.tsx:249-367`, `tf-catalog-md`), não tabela; `<Table>` não tem consumidor. | RETRABALHO | Ver N4 (limiar) e conflito T076×T097. |
| T070 | `ProductOut` (`backend/app/api/products.py:236-249`) sem dinheiro calculado; nenhum `@router.patch` existe em `products.py` (`:464/489/514/529/547`). | PRECISÃO | O regen introduz OPERAÇÃO nova. |
| T071/T072 | **Não existe `backend/app/api/catalog*.py`** — os writes estão em `filaments.py`, `printers.py`, `products.py`, `boms.py` (`main.py:24-137`). | PRECISÃO | Nomear os 4 arquivos. |
| T073 | `ProductIn` exige `piece_inputs`/`tariff_per_kwh` (`products.py:202-249`, model_validator `:226`) — o PATCH precisa de `ProductPatchIn(CamelModel)` próprio (só `seller_fixed_price`); `_to_out` (`:252`) lê as 2 colunas novas. | RETRABALHO | — |
| T075 | Composição exata: `products.items.map(p => computeFromForm(productToForm(p).values, {catalog, source, now}).result?.precoVarejo)`. | PRECISÃO | — |
| T076 | `kits-panel.tsx` também passa por `CatalogPanel`; `productNeedsAttention`/`catalogo.needsAttention` (K3, `product-summary.ts:34-36`) já significa "referência ausente" — o aviso "custo > fixado" precisa de nome próprio (`productPriceOverFixed`). | RETRABALHO | — |
| T077 | Texto do ADR-0033 §5 pronto; conferir identidade caractere a caractere. | PRECISÃO | — |
| T083/T088 | **"grava pelo `record-snapshot` existente" é falso pronto-para-uso**: `RecordForm` (`record-snapshot-sheet.tsx:100-234`) deriva `candidates` (`:113-118`) só para `PRECO_VAREJO`/`PRECO_ATACADO`; com `totals.precoOrcamento` fica vazio, `total` undefined e o submit (`:229`) NUNCA habilita; pede `basis` por rádio e "Rótulo"/"Validade" de novo. | BLOQUEIA | Ver N3. |
| T083 | `frozen-payload.ts:70-75,138…` (`FrozenSnapshotPayload`/`FrozenTotals`) não têm `precoOrcamento`, `discount`, `costFloor`; `FrozenKitLine` (`:111`) não é idêntica a uma linha de orçamento. | RETRABALHO | Estender aditivamente: `FrozenTotals.precoOrcamento?`, `FrozenDiscount {mode, value, amount, grossTotal}`, `costFloor?`, `FrozenQuoteLine {name, quantity, unitPrice, subtotal, origin}`. |
| T084 | `SnapshotInKind`/`SnapshotInHeadlineBasis` são gerados pelo Orval — só existem após T086 + regen. Dependência cruzada: T086 antes de T083/T084 compilarem. | PRECISÃO | — |
| T090 (D1) | `bom.lapsedTitle+lapsedBody` (`:791,793`) e `scenarios.*` (`:1083,1085`) são PARES; `historico.lapsedBanner` (`:968`) é UMA string; `catalogo.lapsedTitle/lapsedBody` (`:645,647`) é a 4ª ocorrência. | RETRABALHO | Comparar 3 STRINGS RENDERIZADAS + registrar por que catalogo fica fora (PR-D). |
| T091 (D2) | Já é verdade hoje: `scenario-context-bar.tsx:40,205,233` e `scenarios-list-sheet.tsx:62,149,387` usam `t.rename`/`t.renameSheetTitle` do mesmo `messages.scenarios`. | PRECISÃO | Guarda provada por mutação; T096 pode não ter código. |
| T093/T094 | `pages-desktop-width.spec.ts:17-29` mede RAZÃO via `.tf-shell__main > section`; não há teste para `/calcular`. | PRECISÃO | Usar `widthRatio()`; razão ANTES (T094) e DEPOIS (T099). |
| T095/T097 | **Conflito de limiar**: `useIsWide` = 1280; o handoff/contrato pede `tf-table` "Catálogo ≥1024px"; entre 1024–1279 o painel está no ramo mobile (`catalog-panel.tsx:368-432`). Um 2º breakpoint é legítimo (ADR-0033 possui o Catálogo) mas ninguém decidiu. | BLOQUEIA | Ver N4. |
| T098 | `catalogo.searchEmptyTitle/Body` (`:621-622`) são 2 strings sem `{termo}`; `historico.searchEmpty`/`scenarios.searchEmpty` (`:931`, `:1114`) são 1 com `{termo}`. Colapsar em `catalogo.searchEmpty`; `catalog-panel.tsx:284-293` usa `EmptyState` title+description. `catalogo.staleHint` aparece em `:316` (mestre) e `:391` (mobile), por `<li>` quando `list.stale`. | RETRABALHO | Remover as DUAS ocorrências do `staleHint`. |

## Tasks NOVAS (estruturas sem dono)

- N1 [US5] `entities/catalog/product-price.ts` — `useRecomputedProductPrices(products, catalogCtx)`: insumo da faixa "N mudaram" E da coluna de preço. Sem isso T068/T075/T076 não têm de onde ler.
- N2 [US5] **Decisão**: estender `CatalogPanelProps` com `rowPrice?/rowWas?/rowFlag?` e trocar `<ul>/Card` (`:368-432`) e a lista mestre (`:295-322`) por `<Plist>` (filaments/printers/kits ganham de graça) × lista dedicada `products-plist.tsx` (duplica busca/paginação/mestre-detalhe).
- N3 [US6] **Decisão**: "Enviar" grava via (a) `RecordForm` estendido (`PRECO_ORCAMENTO` candidato único, sem rádio, sem re-perguntar rótulo/validade) ou (b) `useRecordSnapshot()` (`use-history.ts:78`) chamado direto do `quote-builder.tsx`.
- N4 [US7] **Decisão**: `tf-table` no Catálogo a 1280 (mesmo `useIsWide`) ou breakpoint próprio 1024 (2º `matchMedia`, escopo 0033).
- N5 [US5] Guarda de propriedade (ADR-0033): nenhum caminho de exibição (lista, ficha, kit, orçamento, cenário) lê `seller_fixed_price`/`price_observations` como "o preço" fora do Catálogo — um teste por tela.
- N6 [US6] `quote-builder.tsx` × item KIT degradado (D6, ADR-0017 §6) — sem task de implementação ligando o construtor à degradação.
- (ausente) PR-E: "produto FIXADO no construtor usa o preço do MOTOR, nunca o fixado" (ADR-0033 §3) — não testado por T079/T083.

## data-testid / i18n / exports / rotas que precisam nascer

- testids: `products-price-changed-banner`, `product-row-fixed` (nenhum listado para T069).
- i18n ausentes hoje (grep vazio): `catalogo.priceChangedCount`, `catalogo.priceWasLabel`, `catalogo.savedAtLabel`, `catalogo.fixedByYou`, `catalogo.unfix`, `productForm.nameConflict`, `catalogo.duplicateCopySuffix`; `catalogo.searchEmpty` nasce substituindo as duas antigas (atualizar testes que as referenciam).
- exports: `shared/lib/name-norm.ts` (`nameNorm(raw)`), `entities/catalog/price-observations.ts` (`usePriceObservations`/`useUpsertPriceObservations`, chave `["price-observations", uid]`, invalidação no molde de `useInvalidateCatalog`).
- rota do construtor: 1 segmento com `?query` (`/historico?construir=1`), molde `/catalogo?produto=novo` (`products-panel.tsx:70`) — armadilha `base:'./'`.
- `PATCH /products/{id}` gera símbolo Orval novo — confirmar convenção com um PATCH existente (`scenarios.py`) antes de escrever T075.

## jsdom → e2e

- T068: comparação/contagem em jsdom; geometria faixa+lista só Playwright.
- T084: colisão de coluna é pytest (`_pdf_text`); e2e só download.
- N5: vitest, um teste por tela.

## Conflitos entre fatias

- PR-D × PR-F em `tf-table`/`CatalogPanel` (T076 × T097): se N2 = lista dedicada, `kits-panel` fica sem `tf-table` e T097 herda o trabalho.
- PR-D × PR-F no limiar: dois breakpoints (0033 × 0031-emenda) — legítimo, tem de ser explícito nos dois PRs.
- PR-D × PR-E: produto fixado no construtor segue o motor (ADR-0033 §3) — sem task.
- PR-F × PR-D no vazio de busca (T098 × T076): F herda os usos que D introduzir.
