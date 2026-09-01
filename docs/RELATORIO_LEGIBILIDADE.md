# Relatório de Legibilidade — 3DPrecify

> Auditoria de 2026-08-31 (branch `019-polish`, `gate:all` verde na baseline). Somente leitura;
> nenhum comportamento foi alterado. Ordenação por **custo de debug** (o que o achado impede quando
> se caça um bug), não por severidade teórica. Companheiro de navegação: `docs/MAPA_DO_CODIGO.md`.

## Resumo — os 5 arquivos mais hostis

1. **`apps/web/src/features/calculator/calculator-form.tsx` (1803 linhas)** — 20 componentes + 3 tipos + 8 objetos de estilo num arquivo; três organismos inteiros (262/232/174 linhas) escondidos no meio; achar onde um campo renderiza exige varrer tudo.
2. **`packages/pricing-core/src/index.ts` (780) + `channels.ts:205`** — sete responsabilidades sem separador (calculadora, canal, kit, orçamento); e a função mais crítica do produto (`grossUpOnce`, 18 linhas que decidem cada preço) tem a variável do anúncio em R$ chamada `listPct`.
3. **`backend/app/models/__init__.py` (1067)** — 12 tabelas de 6 épicos, ~60 CheckConstraints inline e uma regra executável (listener de imutabilidade) escondida no rodapé.
4. **`backend/app/api/scenarios.py` (701)** — o docstring descreve um arquivo que não existe mais ("PR-A subset only" num módulo com PUT/PATCH/DELETE/resolver); importa 5 helpers privados de outros routers; reconstrói à mão um contrato de 16 chaves mágicas, duas vezes.
5. **`apps/web/src/features/catalog/catalog-panel.tsx` (739)** — um componente de 604 linhas com 26 props, 7 `useState` e uma cadeia de 6 ramos atribuindo `body`; entender a tela exige simular 6 booleanos de cabeça.

Transversais que doem em todo debug: vocabulário não canônico (17 colisões mapeadas — glossário no MAPA_DO_CODIGO §5), **zero log nos pontos que escrevem dinheiro** no backend, zero trace no caminho de cômputo do preço no front, e comentários-changelog que descrevem PRs passadas em vez do estado atual.

---

## Bugs reais anotados (NÃO corrigidos — regra de ouro da auditoria)

Achados de **comportamento** encontrados de passagem. **Status pós-decisões do dono (2026-08-31):**
B1 CORRIGIDO (ausência visível + valor zero, decisão do dono) · B8 CORRIGIDO (rounding explícito,
aprovado) · B9 e B11 FECHADOS de graça pela própria refatoração (serializador único; 500 logado) ·
B6 e B7 → RADAR do módulo de pagamento ("ainda não vimos nada do módulo de pagamento") · B2/B3/B4/
B5/B10 explicados ao dono, aguardando a decisão dele. Tabela original mantida como registro:

| # | arquivo:linha | o que acontece |
|---|---|---|
| B1 | `features/history/quote-builder.tsx:336-343` | erro do motor de preço vira `baseTotal = 0` → **R$ 0,00 na tela**, sem log nem aviso (o padrão do app é "ausência ≠ zero") |
| B2 | `pages/calcular/calcular-page.tsx:106` vs `pages/catalogo/produto-page.tsx:85` vs `widgets/bom-line-editor/bom-line-editor.tsx:90` | `handleMarketplaceChange` triplicado; só a versão de calcular-page usa `{shouldValidate:true}` — comportamento diverge entre telas |
| B3 | `pages/historico/recalc-today.tsx:262-266` | a cadeia de toast por `syncState` copiada não tem o ramo `unauthenticated` — cai no toast `danger` genérico (as outras duas cópias têm) |
| B4 | `entities/history/history-format.ts:58-71` vs `backend/app/services/quote_render.py:341` | o 5º espelho de `headline_basis` (front) tem fallback "Preço de varejo" onde o backend **recusa por design** — um kind de versão futura seria rotulado varejo no app e recusado no PDF; é o único espelho fora do teste de paridade |
| B5 | `entities/history/frozen-payload.ts:444-456` vs `calculator-model.ts:369-375` | "canal COM taxa" diverge: a versão viva conta `surcharges.length > 0`, a congelada não — snapshot com só sobretaxa é lido como "sem taxa" |
| B6 | `backend/app/scripts/reconcile_subscriptions.py:34-37` | o job de reconciliação ignora `subscriptions_unreachable` e retorna exit 0 sempre — reporta sucesso com o MP fora do ar |
| B7 | `backend/app/api/billing.py:182` | fallback `"http://localhost:5173"` numa URL de retorno de pagamento; se `cors_origins` vier vazio em prod, o vendedor volta para localhost após pagar |
| B8 | `entities/history/frozen-payload.ts:41` | `toMoneyString` usa `new Decimal(v).toFixed(2)` que depende do rounding **global** da lib; coincide com o ADR-0008 por default, não por declaração — um `Decimal.set({rounding})` em qualquer lugar mudaria o documento imutável |
| B9 | `frozen-payload.ts:304-333` vs `config-document.ts:138-162` | os serializadores gêmeos tratam `undefined` diferente (um converte para `null` explicitamente, o outro converge por acidente) |
| B10 | `features/scenarios/scenarios-list-sheet.tsx:98-103` | `honestWriteError` local sombreia o de `shared/api/error-messages` com **texto diferente** — o mesmo erro tem duas mensagens conforme a tela |
| B11 | `backend/app/errors.py:156` | o handler de 500 descarta a exceção: sem log, sem traceback, sem Sentry — combinado com `observability.py:58-63` (loga `INTERNAL` sem tipo/mensagem), um 500 em prod é invisível |

---

## Achados por custo de debug

Colunas: categoria · problema · custo de debug · severidade (A/M/B) · esforço (P/M/G) · correção.

### Nível 1 — Altíssimo: regra de dinheiro duplicada ou ilegível

| arquivo:linha | cat | problema | custo de debug | sev | esf | correção |
|---|---|---|---|---|---|---|
| `pricing-core/channels.ts:142-146` vs `features/calculator/fee-prefill.ts:303-307` | DUPLICAÇÃO | `bandFixedFee` (anúncio × pct/100) reimplementada inline na feature — a única reimplementação de conta de preço fora do pricing-core | o número na tela e o da conta podem divergir, ambos "certos" | A | P | exportar `bandFixedFee` do pacote e chamar |
| `channels.ts:214-216` | NOMES | `listPct` é o **anúncio em R$**; `commissionAtListPct` é **comissão em R$** — os nomes dizem percentual; `keep`/`keepFixedPct` sem unidade | nome que mente na função mais crítica do produto; "corrigir" o falso pct quebraria tudo em silêncio | A | P | `anuncio`/`comissaoNoAnuncio`/`fatorRetido` |
| `channels.ts:172-191` vs `shared/fee-catalog/fee-catalog.ts:71-74,246-256` | DUPLICAÇÃO | `validateBandRules` reescrita como dois `.refine()` Zod; mensagens já divergem | payload passa numa porta e falha na outra com mensagens diferentes | A | M | o Zod chama `validateBandRules` num `superRefine` |
| `pricing-core/index.ts:689-712,742` vs `backend/app/api/history.py:155-165` | DUPLICAÇÃO | 3 regras de desconto do orçamento espelhadas em Python sem mecanismo de paridade | um centavo de desacordo e o outbox re-POSTa um 422 para sempre | A | M | marcar cada espelho com o `index.ts:NNN` de origem + teste de paridade |
| `channels.ts:124-131` vs `fee-catalog.ts:464-473` vs `fee-ingest/guardrails.ts:101-126` | DUPLICAÇÃO | seleção de faixa meio-aberta `[min, max)` em TRÊS implementações | mudar a regra de empate exige achar as três | A | P | exportar `bandContaining` do pacote |
| `history-format.ts:58-71` + 4 espelhos | DUPLICAÇÃO | o mapa `headline_basis → total/legenda` existe em 5 lugares; o 5º (front) fora do teste de paridade e com semântica oposta (bug B4) | ver B4 | A | M | estender o teste de paridade ao TS ou gerar do contrato |
| `frozen-payload.ts:444-456` vs `calculator-model.ts:369-375` | DUPLICAÇÃO | "canal COM taxa" duas vezes, já divergentes (bug B5); o comentário admite "sync pelo significado, não por chamada" | linha do PDF some sem erro | A | M | função única em `shared/lib` ou congelar o booleano |
| `features/calculator/calculator-form.tsx` (inteiro) | TAMANHO | 20 componentes/1803 linhas, sem índice | toda mudança na calculadora começa varrendo 1800 linhas | A | G | decomposição atomic design (plano da onda 5) |
| `calculator-form.tsx:1166-1428` | TAMANHO | `ChannelSlot` 262 linhas, 8 props, 10 blocos condicionais + regra de catálogo | um campo que "sumiu" pode vir de 4 fontes | A | G | extrair determinants/fee-grid/captions/seals |
| `calculator-model.ts:485-555` | ESTADO | IIFE de 55 linhas dentro de `.map()` mutando contador externo `let ep = 0` — realinhamento por efeito colateral posicional | um slot inválido no meio desloca os seguintes e nada avisa | A | M | extrair `mapSlotOutcome` puro; índice pré-calculado |
| `backend/app/errors.py:156` + `observability.py:58-63,80-89` | ERROS | 500 sem exceção logada; `_emit` sem `userUid` (prometido no docstring) e com UUID embutido na rota | um 500 em prod não deixa NADA; impossível filtrar por conta ou agregar por rota | A | P | `log.exception` + Sentry; `userUid`; template de rota |
| `backend/app/billing/grant_writer.py:88-116,140-169,196-239` | ERROS | os três caminhos que ESCREVEM dinheiro (grant, carência, revogação) sem nenhum log estruturado | "por que essa conta ficou premium?" só lendo o banco | A | P | `log.info("grant_written", ...)` nos 3 + nos deny-by-default |
| `backend/app/billing/signature.py:47-58` | ERROS | 6 causas de rejeição de webhook colapsadas num único `False` mudo | 401 de webhook indistinguível entre "secret não provisionado" e "forjado" | A | M | enum de motivo + log na rota |
| `backend/app/billing/providers/mercadopago.py:179-189,201-207` | ERROS | `create_preapproval`/`cancel_preapproval` engolem `httpx.HTTPError` → `None`/`False` sem log (ao lado de `_get` que levanta `ProviderUnavailable` — duas políticas no mesmo arquivo) | um checkout 503 não diz se foi rede, 4xx ou corpo inválido | A | M | mesma disciplina do `_get` |
| `backend/app/api/scenarios.py:44-59` · `boms.py:44-59` | CAMADAS | routers importando helpers **privados** de outros routers (`# pyright: ignore[reportPrivateUsage]` + apelidos); nenhum contrato dentro de `app.api` | mudar `products._to_out` quebra kits e cenários em silêncio; entender um cenário = 3 arquivos de rota | A | G | extrair `app/services/catalog_resolver.py` (a camada já existe no import-linter) |
| `scenarios.py:242-307` | TIPOS | o contrato de 16 chaves camelCase construído à mão DUAS vezes (`dict[str, Any]`); o docstring narra que essas chaves já quebraram o reopen uma vez | campo novo = editar 2 dicts sem ajuda do type checker | A | M | `PriceInputWire(BaseModel)` com alias |
| `scenarios.py:11-15` | RUÍDO | docstring descreve arquivo que não existe mais ("PR-A subset only") | o único mapa do arquivo mais complexo do backend desvia o leitor | A | P | reescrever o cabeçalho |
| `catalog-panel.tsx:135-739` | TAMANHO | 604 linhas, 26 props, 7 `useState`, `let body` em cadeia de 6 ramos, 3 layouts inline | simular 6 booleanos de cabeça para saber o que a tela mostra | A | G | quebrar em body-router + 3 listas + sheets |
| `pricing-core/index.ts` (inteiro) | TAMANHO | 7 responsabilidades sem separador de arquivo (versão, tipos, erros, calculadora, canal, kit, orçamento) | todo bug de dinheiro começa lendo 780 linhas | A | M | divisão com barrel de reexports (onda 5; API pública intacta — 31 imports, todos da raiz) |
| `backend/app/models/__init__.py` (inteiro) | TAMANHO | 12 tabelas de 6 épicos + listener de imutabilidade no rodapé + o check de dinheiro (`>= 0 AND <> NaN`) repetido 22× | ler o schema de uma tabela = navegar 1067 linhas; a regra que LEVANTA em runtime é a última coisa do arquivo | A | G | pacote `app/models/` por agregado, `__init__` reexporta (onda 5) |
| `backend/app/api/*` ×5 | NOMES | `_to_out` ×5, `_owned` ×5, `_not_found` ×5, `_apply` ×3 — semânticas diferentes, mesmo nome (a prova: o import renomeia) | traceback com `_to_out` não diz qual; grep devolve 5 | A | M | prefixar por domínio + mover compartilhados p/ services |
| `backend/app/api/*` (~20 sítios) | TIPOS | `claims: dict[str, Any]` acessado por chave mágica em toda rota | `claims["user_id"]` compila e explode em runtime | A | M | `@dataclass(frozen=True) Claims` |

### Nível 2 — Alto: estrutura que esconde a regra

| arquivo:linha | cat | problema | custo de debug | sev | esf | correção |
|---|---|---|---|---|---|---|
| `pages/catalogo/produto-page.tsx:423-591` | ESTADO | três IIFE anônimas de 74/29/40 linhas dentro do JSX decidindo `<fieldset>` vs `<Frozen>` | JSX sem nome, não testável | A | M | átomo `<EditableSection active>` |
| `produto-page.tsx:230-254` | TAMANHO | `headerCaption` com ternário de 4 níveis; `headerLabel`/`headerValue` repetem a mesma árvore 3× | mudar uma regra = acertar 3 árvores | A | M | `productHeaderState()` puro + teste |
| `calculator-form.tsx:487-719` | TAMANHO | `MachineCostFields` 232 linhas; dois `<Segmented>` quase idênticos (L570-585 vs 587-599) | os dois divergem em silêncio | A | G | extrair 4 moléculas + `useMachineCostMode()` |
| `features/history/quote-builder.tsx:112-557` | TAMANHO | duas telas completas no mesmo corpo; 4 `catch {}` sem variável; 4 props exigidas e nunca lidas; `sending`+`sendingRef`, `sent`+`sentRef` (4 estados p/ 2 fatos) | qual estado é a verdade depende da linha | A | G | extrair `QuoteItemPicker`/`QuoteReview` + `useSubmitOnce()`; remover props mortas |
| `pages/bom/bom-page.tsx:208-216` | ESTADO | `useEffect` lê 5 valores e declara `[openedSig]`; hidratação controlada por 3 refs mutáveis | "a hidratação não roda" e a razão está em 3 refs + 1 assinatura | A | M | `useKitHydration()` com deps reais |
| `pages/calcular/calcular-page.tsx:567-609` | RUÍDO | `<MarketplaceSection>` renderizado 2× com 16 props cada (só o wrapper muda) | 16 props conferidas em par a cada mudança | A | P | um só nó com props em objeto |
| `record-snapshot-sheet.tsx:166-175` · `quote-builder.tsx:266-271` · `recalc-today.tsx:262-266` | RUÍDO | cadeia de toast por `syncState` triplicada (bug B3 numa das cópias) | bug de cópia já materializado | A | P | `toastForSyncState()` em entities/history |
| `pages/catalogo/catalogo-page.tsx:122-194` | CAMADAS | página roda o motor sobre TODOS os produtos num `useMemo` e dispara ESCRITA (`observe`) num `useEffect` de 8 deps | um render extra pode gravar observação; a causa fica a 60 linhas do efeito | A | M | `useProductRecompute()` + `useObserveVisibleProducts()` |
| `calculator-form.tsx:1565-1691` | ESTADO | `MarketplaceSection` com 16 props; `control` e `catalog` descem 4 níveis | rastrear um valor = 4 saltos de arquivo | A | M | agrupar props (`channelEditing`/`catalogState`/`entitlement`) |
| `pages/historico/historico-page.tsx:237-491` | TAMANHO | `HistoryLedger` 255 linhas com 12 booleanos derivados entrelaçados | qual booleano manda? | A | G | `useLedgerFilters()` + `ledgerViewState()` puro |
| `backend/app/services/quote_render.py:231-324` | TAMANHO | `build_quote_view` 94 linhas: 2 despachos `if kind` a 40 linhas de distância | por que KIT imprime custo e QUOTE não = ler os 3 ramos 2× | A | M | extrair `_quote_lines`/`_kit_lines`/`_single_line`/`_breakdown_for` |
| `quote_render.py:382-492` | TAMANHO | `render_quote_pdf` 111 linhas: layout + formatação + regra de apresentação misturados | distinguir regra de `Spacer(1, 4*mm)` | A | G | separar story/tables; a decisão do L450 sobe p/ `QuoteView` |
| `backend/app/api/boms.py:499-580` + `scenarios.py:289-306` | TAMANHO | ramo degradado com 18 chamadas `_degraded_or(x, "0"/"1")` à mão, replicado em 2 arquivos (36 chamadas) | um fallback errado (denominador `"0"`) é invisível | A | M | tabela `_DEGRADED_DEFAULTS` + construtor único |
| `boms.py:416-470` | CAMADAS | `_materialize` cria linhas de `products` como efeito colateral do save do kit, sem um log | produtos "aparecem" no catálogo sem rastro de qual save os criou | M | G | mover p/ `app/services/kit_materialization.py` + logar |
| `backend/app/api/history.py:196-256` | TAMANHO | `_validate_frozen_document` = 7 regras em sequência cuja ORDEM é semântica (comentário de 7 linhas explica) | 422 = ler 61 linhas p/ saber qual regra disparou | M | M | lista de validadores nomeados executada em ordem |
| `scenarios.py:105-141,385-419` · `quote_render.py:153-161` | TIPOS | `config`/`payload` = `dict[str, Any]` navegado por 12+ chaves mágicas; `quote_render` inventou 4 acessadores genéricos p/ sobreviver | renomear uma chave não quebra nada até o vendedor abrir o PDF | A | G | TypedDict/BaseModel `extra="allow"` só p/ nomear as chaves |
| `frozen-payload.ts:304-333` ≡ `config-document.ts:138-162` (+`:47`/`:43`) | RUÍDO | serializador recursivo + `toExactString` + tipo de folha triplicados (bug B9) | correção num não propaga ao outro | A | M | `shared/lib/decimal-leaf.ts` |
| `pricing-core/index.ts:224-344` | TAMANHO | `computeCalculator` 120 linhas (recusa + normalizações + 17 asserções + 7 blocos + canais + retorno) | — | A | M | extrair `assertPriceInput`/`withDefaults`/`computeCostLines` |
| `index.ts:515-627` | TAMANHO | `computeBom` 112 linhas com laço³ e `Map` de flags inline | — | A | M | extrair `accumulateRollups()` |
| `channels.ts:330-405` | TAMANHO | `chooseBand` 76 linhas; arrow interno de 18; `grossUpOnce` recomputado no fim p/ par já resolvido | "por que este nível ficou sem referência?" = 6 saltos | M | M | extrair `scoreCandidate`; reaproveitar o candidato |
| `entities/*/{bom,catalog,history,scenario,entitlement}-cache.ts` | RUÍDO | 5 módulos de cache idênticos, **15 `catch {}` vazios** | corrigir um bug de cache = 5 edições | M | M | fábrica `shared/lib/uid-cache.ts` |
| `use-history.ts:205-225` ≡ `:301-321` + 4 arquivos | RUÍDO | bloco de pré-carregamento copiado 6× (o comentário admite) | 6 cópias | M | M | `useCachedPreload()` em shared/lib |
| `shared/ui/breakdown-row.tsx:19-26` | APRESENT. | 4º formatador de dinheiro (toLocaleString + `prefix="R$"` default + sinal U+2212) — no componente que imprime o detalhamento do preço | divergência de formatação onde a auditoria de honestidade olha | A | P | usar `formatBRL` (verificar byte-igualdade antes) |
| `features/catalog/catalog-schema.ts:212` | APRESENT. | 5º formatador: `` `R$ ${formatDecimal(...)}` `` remonta `formatBRL` à mão, sem `digits` explícito, com `Number(string)` sobre leaf decimal | linha do catálogo pode divergir em casas | M | P | `formatBRL` |
| `entities/history/history-format.ts:26-28` | TIPOS | `money(string)` faz `Number(string)` — ressuscita o float que o documento congelado existe para matar | precisão perdida na exibição de registro imutável | A | P | formatar direto da string (como o Python já faz) |
| `calculator-form.tsx:1049-1054` | APRESENT. | moeda à mão (`toFixed(2).replace(".", ",")`) no MESMO arquivo que importa `formatBRL` | regra de dinheiro manuscrita em componente | A | P | `formatBRL` |
| `backend/app/api/naming.py:69-84` | ERROS | o retry de sufixo renomeia a linha do vendedor em silêncio, sem log de qual tentativa venceu | "por que meu produto virou 'Gancho (2)'?" sem rastro | A | P | `log.info("name_conflict_resolved", ...)` |
| `backend/app/auth.py:64-68` · `entitlement/__init__.py:84-89` | ERROS | 401 e 403 sem log do estado derivado | active vs lapsed vs none indistinguível do lado servidor | M | P | logar o motivo |
| `history.py:422-429` | ERROS | replay idempotente do outbox (o mecanismo central offline) sem nenhum log | "o outbox está em loop" sem sinal no servidor | M | P | `log.info("snapshot_replay", ...)` |

### Nível 3 — Médio: nomes, magia, tipos

| arquivo:linha | cat | problema | custo de debug | sev | esf | correção |
|---|---|---|---|---|---|---|
| `scenarios-list-sheet.tsx:98-103` | RUÍDO | `honestWriteError` sombreando o compartilhado com texto diferente (bug B10) | o import certo depende do arquivo | A | P | apagar a cópia |
| `pages/historico/snapshot-detail-page.tsx:238-253` | TAMANHO | `SyncAlert` com DOIS ternários de 4 níveis sobre o mesmo `state` | — | M | P | `SYNC_COPY: Record<SyncState,{…}>` (padrão já usado no arquivo) |
| `snapshot-detail-page.tsx:331-362` | RUÍDO | 4 blocos JSX idênticos (varejo/atacado × anúncio/líquido) | — | M | P | array + `.map()` |
| `features/catalog/products-panel.tsx:162-168` | TIPOS | cinco `as unknown as` seguidos exatamente onde os dados de dinheiro passam (duplicar produto) | o compilador desligado no pior lugar | A | M | `productOutToProductIn()` tipada |
| `pages/bom/bom-page.tsx:277-294` | TAMANHO | `uiSkippedCounts` com 4 níveis de aninhamento e 2 `Map` mutáveis num componente | — | M | M | `countSkippedByMarketplace()` puro |
| `bom-page.tsx:442-487` | RUÍDO | `EmptyState` e `VazioDidatico` com o MESMO bloco de 2 botões palavra por palavra | — | M | P | reusar |
| `calcular-page.tsx:95-104` | ESTADO | `computeFormSignature` = JSON.stringify de ~20 campos a cada render; o comentário admite ser fix de bug de memoização | dirty errado é invisível até perder trabalho | M | M | mover p/ `form-signature.ts` com testes |
| `calcular-page.tsx:196-218` vs `produto-page.tsx:136-156` | RUÍDO | `applyFilament`/`applyPrinter` duplicados com union de campos à mão | — | M | P | `useCatalogPrefill()` |
| `calculator-model.ts:317-325` · `produto-page.tsx:221,393` | TIPOS | `!` não-nulo sobre variáveis cuja garantia está a 170 linhas | — | M | P | estreitar com `if` no ponto |
| `historico-page.tsx:81,243,742` | TIPOS | `useSearch(...) as {…}` 3× no mesmo arquivo com shapes DIFERENTES | — | M | P | `useHistoricoSearch()` tipado |
| `historico-page.tsx:331-338` | ESTADO | `useEffect` de navegação com array nas deps (dispara por referência) | navegação fantasma difícil de reproduzir | M | P | depender do id escalar |
| `pricing-core/index.ts:274` | MAGIA | `.times(1000)` (kg→g) cru na fórmula de material | — | M | P | `GRAMS_PER_KG` |
| `channels.ts` + `index.ts` (~10×) | MAGIA | `/100` de percentual repetido ~10× | — | M | P | `pctToRate()` em rounding.ts |
| `scenarios.py:169,621` + `models:901` | MAGIA | limite `500` do note em 3 literais (o do name É constante — inconsistência interna) | — | M | P | `_NOTE_MAX_CHARS` |
| `history.py:250,252` + `models:765,776` | MAGIA | `3650` e `840` nus na app e no CHECK, sem nome dizendo "10 anos"/"UTC±14h" | 422 que não se explica | M | P | constantes importadas nos 2 lados |
| `products.py:606-611` ≡ `price_observations.py:97-101` | MAGIA | regra "máx 2 casas por `Numeric(12,2)`" escrita 2× | — | M | P | `money_scale_ok()` em validation.py |
| `billing/*.py` ×4 + `models:967` | MAGIA | status `"authorized"`/`"grace"`/… como strings cruas em 5 lugares | typo passa no type checker e vira 500 no CHECK | M | M | `SubscriptionStatus(StrEnum)` + `GrantSource` |
| `filaments.py:43` · `printers.py:37` · `products.py:58` · `boms.py:78-79` | MAGIA | `_NAME_INDEX` ×4 valores + 1 duplicata; esquecer um na migração mata o retry de sufixo em silêncio | — | M | P | dicionário único em naming.py |
| `checkout.py:25` · `subscription.py:27` | CAMADAS | `NON_TERMINAL_STATUSES` mora em `reconcile.py` — a máquina de estados num arquivo onde ninguém procura | — | M | P | `billing/states.py` |
| `quote_render.py` (~15 strings) + `export.py:76,107` | MAGIA | copy pt-BR voltada ao CLIENTE hardcoded no backend (comentário admite duplicação com o front) | "de onde saiu esse texto no PDF" | M | M | concentrar em `quote_copy.py` |
| `quote_render.py:386-492` | MAGIA | layout em literais; dois `colWidths` que precisam somar 160mm sem nada dizer | coluna estourada sem onde inspecionar | B | P | constantes derivadas |
| `products.py:257-258` · `boms.py:222-223` | TIPOS | `channels`/`other_costs` entram tipados e saem `list[dict[str, Any]]` | campo dropado só aparece no cliente | M | P | tipar o Out |
| `messages.pt-br.ts:571 + :608` | NOMES | `account` E `conta` como namespaces de topo distintos (+ `nav.conta`); `outrosCustos` em 2 profundidades | achar uma string de conta é 1/3 | M | P | fundir; um idioma para chaves |
| `messages.pt-br.ts:31-570` | TAMANHO | bloco `calculator` de 539 linhas / 5 níveis | grep pelo texto, nunca pela chave | M | G | quebrar por tela + barrel |
| `entities/*` (15×) | ERROS | `throw new Error("unreachable: …")` idêntico em 15 sítios, sem status/rota | Sentry cheio de linhas iguais sem contexto | M | P | `assertStatus(res, rota)` no transport |
| `fee-catalog.ts:427-450` | ERROS | `catch {}` descarta o `ZodError` do seed; só loga a contagem | qual campo do seed quebrou? | M | P | logar `err.issues` |
| `frozen-payload.ts:38` vs `config-document.ts:40` | TIPOS | `MoneyString` e `DecimalString` = mesmo conceito, 2 nomes | — | M | P | alias único em shared/lib |
| `channels.ts` ×3 · `fee-catalog.ts` · `fee_catalog.py` | TIPOS | `PriceBand`/`FixedFeeRule`/`VoucherBand` declarados 3× (TS, Zod, Pydantic) sem gerador | a forma do dinheiro tem 3 fontes de verdade | A | G | gerar de uma fonte (Orval já existe) |
| `premium-gate.ts:35-39` vs `entitlement-cache.ts:28` | TIPOS | `SERVER_STATUSES` 2× | — | M | P | constante exportada única |
| `premium-gate.ts:31` | NOMES | união com literal bilíngue `"free-nunca-teve"` | — | M | P | `"never-subscribed"` |
| `fee-ingest/guardrails.ts` | NOMES | "guardrails" = 5 responsabilidades sem relação; `validarData` (pt) + `checkParseSanity` (en) no mesmo arquivo | — | M | M | dividir por assunto |
| `billing.py:347-379` | RUÍDO | `novo = APIRouter(...)` (pt num módulo 50/50) + 2 handlers 503 com 4 params nunca usados | parâmetros sugerem caminho que não existe | B | P | renomear + limpar params |
| `grant_writer.py:217,235` · `mercadopago.py:55` | NOMES | `alvo` e `_REEMBOLSO` em módulos de identificadores EN | grep por "refund" não acha | B | P | `revocable_grants`/`_REFUND_STATUSES` |
| backend (vários) | NOMES | booleanos sem prefixo: `degraded`, `matched`, `granted`, `inserted`, `verified`, `live_mode` | `granted` ambíguo entre "agora" e "está" | B | P | `is_`/`has_`/`did_` |
| front (vários) | NOMES | `belowCost`, `overridden`, `changed`, `filtered`, `edited`, `stale` sem prefixo; `shell`, `fail`, `at`, `mk`, `acc`, `b`, `c` | — | B | P | idem |
| `scenarios-list-sheet.tsx:81-91` | NOMES | `relativeLabel` com pt-BR hardcoded fora do messages | — | M | P | mover as 5 frases p/ i18n |
| `history-format.ts:95,36,41` · `use-history.ts:231,327` · `fee-catalog.ts:544` | MAGIA | `86_400_000`, `60_000`, `(1000*60*60*24)` crus (o vizinho tem `DAY_…` nomeado) | — | M | P | constantes compartilhadas |
| `plausibilidade.ts:74` vs `validation.py:45` | MAGIA | `2_147_483_647` copiado à mão do backend | — | M | P | pinar com teste de paridade |
| `outbox.ts:267-275` | TAMANHO | ternário de 4 níveis status HTTP → SyncState com comentário no meio da expressão | — | M | P | `Record<number, SyncState>` |
| `mercadopago.py:123` | MAGIA | `timeout=10.0` literal no cliente HTTP de pagamento | não ajustável por ambiente | B | P | settings |
| `history.py:436` vs `scenarios.py:495` | MAGIA | page size 50 vs 25 sem justificativa | cliente pagina errado num dos dois | B | P | constante ou comentário |

### Nível 4 — Ruído e comentários

| arquivo:linha | cat | problema | sev | esf | correção |
|---|---|---|---|---|---|
| `calculator-model.ts` (33% prosa) · `calculator-schema.ts` (30%) · `calculator-form.tsx` (16%) | RUÍDO | comentários-changelog ("019/PR-C T057", "hotfix 016/A2") que contam a história das PRs, não a regra vigente; um docstring que se autocorrige ("That justification is now FALSE") | M | M | arqueologia → ADRs; no código só a regra atual |
| `backend/app/main.py:3-4` | RUÍDO | docstring: "NO product routes here" — `create_app` monta 13 routers | M | P | atualizar |
| `errors.py:62-63` vs `:71-74` | RUÍDO | "No 403 constant exists on purpose" 8 linhas acima de um 403 publicado | M | P | remover a frase |
| `main.py:61-63` | RUÍDO | justificativa do `_strip_phantom_422` baseada numa premissa hoje falsa | M | M | reescrever o porquê |
| `quote-builder.tsx:87-118` + `historico-page.tsx:161-163` | RUÍDO | 4 props exigidas e nunca lidas; a page passa `filaments={[]}` | M | P | remover |
| `quote-builder.tsx:214-239,337-343` | RUÍDO | `try computeQuote(desconto) catch computeQuote(sem)` escrito 3× | M | P | `safeComputeQuote()` |
| `quote-builder.tsx:506` | RUÍDO | `quoteResult?.netTotal ?? 0` sobre valor não-nulo — sugere estado que não existe | B | P | remover |
| `calculator-schema.ts:479` | RUÍDO | `LABOR_FIELDS = LABOR_AND_FINISH_FIELDS` — alias puro | B | P | remover |
| `plausibilidade.ts:255` · `sentry.ts:61` | RUÍDO | `avisosPorCampo` e `isObservabilityInitialised` exportados e nunca importados | B | P | remover |
| `frozen-payload.ts` (~20 símbolos) | RUÍDO | tipos exportados usados só no próprio arquivo | B | P | tirar `export` |
| `calculator-form.tsx:85-150` | RUÍDO | 8 `CSSProperties` inline convivendo com classes tf-*/Tailwind | B | M | migrar p/ `calculator-form.css` |
| `bom-page.tsx:365-367` | RUÍDO | `return setSaveError(...)` — retorna void de setter | B | P | separar statements |
| `calcular-page.tsx:409-414` | RUÍDO | IIFE no JSX p/ um Alert condicional | B | P | componente nomeado |
| `calculator-form.tsx:434-436` + `plausibilidade.ts:82` | RUÍDO | dois `Intl.NumberFormat` pt-BR gêmeos | M | P | `formatDecimalPtBr(n, digits)` compartilhado |
| `backend/tests/{test_scenarios,test_history,test_export}.py` (1596/1513/1318) | RUÍDO | monólitos de teste onde achar "o teste do comportamento X" custa grep — relevante porque docstrings do código citam nomes de teste como prova de decisões | B | G | (fora do escopo das ondas; registrado) |

---

## Observações finais

- **O que NÃO está quebrado:** higiene básica do backend (zero `except:` nu, zero `print` fora de
  scripts, aninhamento controlado — medido por AST); adoção do `formatBRL` (23 usos corretos vs 5
  desvios); `console.*` do front (só 7 usos, todos deliberados e uniformes); as fronteiras FSD/camadas
  (vigiadas por 3 ferramentas). O problema real é **densidade, vocabulário e ausência de rastro**.
- **Prettier/eslint/ruff existem e rodam no gate** — a onda de ferramental é a mudança de `tabWidth`
  para 4 (decisão do dono) + eventual ratchet de tamanho, não a introdução das ferramentas.
- **Rede de segurança para refatorar:** `pnpm gate:all` verde na baseline; pricing-core com 100% de
  cobertura ratcheted + varredura de igualdade de 700 casos (`version-equality`), que é a prova de
  byte-identidade para a divisão do pacote; 31 imports do pacote, todos pela raiz (barrel seguro).

---

## Adendo — execução (Ondas 1–8, 2026-08-31, branch 019-polish)

As oito ondas foram executadas em 24 commits (a7a1824..HEAD), `gate:all` verde em cada fechamento
de onda e na baseline. Mapa do resultado: `docs/MAPA_DO_CODIGO.md` §7. Resumo do que cada onda
entregou e do que ficou DE FORA por decisão:

- **Executado:** tabWidth 4 (mecânico puro) · ruído/comentários falsos · renomes (grossUpOnce,
  never-subscribed, billing EN, formatFrozenBRL, helpers por domínio) · fonte única
  (bandFixedFee/bandContaining exportadas, decimal-leaf, uid-cache, preload, catalog_resolver,
  SERVER_STATUSES) · quebra dos 10 monolitos (pricing-core, calculator-form, models, scenarios-
  helpers, messages, catalog-panel, quote-builder, historico, bom-page, scenarios-list;
  quote_render em helpers nomeados) · constantes/tipos (Claims, SubscriptionStatus,
  PriceInputWire, NAME_INDEX, limites nomeados, mp_timeout_seconds) · logs de decisão (Onda 7,
  §7 do MAPA) · ratchet max-lines 750 · pino de superfície + teste de caracterização.

- **Pendências deliberadas (não são esquecimento):**
  1. Os **11 bugs (B1–B11)** — intocados, regra de ouro; decidir e corrigir é trabalho novo.
  2. `breakdown-row` fora do `formatBRL` (usa sinal U+2212 próprio — trocar muda pixels) e o
     placeholder manuscrito de `channel-fee-field` (formatDecimal acrescentaria separador de
     milhar) — as duas trocas NÃO são byte-idênticas; decisão de UI.
  3. Toast por syncState triplicado e `honestWriteError` local — unificar CORRIGE B3/B10 (muda
     comportamento); esperam a decisão dos bugs.
  4. `products-panel` cinco `as unknown as` → mapper tipado (risco de dropar campo; merece teste
     próprio) · typing do Out de channels/other_costs (mudaria OpenAPI → drift-guard; é mudança de
     contrato, não de legibilidade).
  5. Fusão `account`/`conta` no i18n e o nó quote/histórico/"Orçamentos" — vocabulário visível ao
     usuário; decisão de produto.
  6. `useEffect` de hidratação do bom-page (3 refs) e os 12 booleanos do HistoryLedger —
     reestruturar estado é risco real; ficou nomeado e localizado, não reescrito.
  7. `PriceResult.trace?`/`unpricedReason`/`appliedBand` no resultado do motor — proposta de
     observabilidade do cálculo (aditiva, mas toca contrato do motor: MINOR + varredura).
  8. Monólitos de TESTE (test_scenarios 1596 etc.) e a redução das 26 props do catalog-panel.
  9. Paridade backend↔front dos 3 espelhos de desconto e do 5º espelho de headline_basis (B4) —
     o teste de paridade é a correção estrutural; junto com B4.


### Decisões do dono já executadas (2026-08-31, rodada 3)

- **3(1)+3(2)**: chaves do i18n em inglês (profundidade total) + `conta` fundido em `account`
  (commit `dac157c`); vocabulário de DOMÍNIO/wire preservado (precoVarejo, PriceLevel, rotas).
- **4(1)**: Out de `channels`/`otherCosts` tipado (commit `177b4fc`) — os 2 últimos
  `as unknown as` caíram. **Acoplamento novo registrado**: o Out agora VALIDA na leitura; aposentar
  um marketplace do `Literal` um dia exige migração de dados, não só de código.
- **4(2)** (trace do motor) e **B6/B7**: radar do módulo de pagamento, por instrução do dono.
- Nomenclatura reafirmada pelo dono: ML/Shopee/Amazon são **marketplace** no visível; campos de
  wire (`channels`) não mudam por serem contrato armazenado.


---

## Rodada 4 — decisões do dono de 2026-09-01

**Executado:**

- **B10** — frase única para escrita sem conexão: **"Esta ação precisa de conexão."** (a escolhida
  cobre também *excluir*). Eram TRÊS implementações de `honestWriteError` e DUAS frases; a frase
  mora agora em `messages.apiError.offlineWrite` — a casa das mensagens que `shared/api` fala pelo
  app todo (antes a função compartilhada lia a chave de UMA tela).
- **B2** — a troca de marketplace passa a **revalidar nas três telas** (recomendação aceita). O
  parâmetro `shouldValidate` morreu: a revalidação é da função, não do chamador, então nenhum sítio
  novo pode esquecê-la.
- **3(3)** — `breakdown-row` (o detalhamento de preço) usa o formatador oficial; o placeholder de
  taxa ganha o separador de milhar. **O menos tipográfico (U+2212) NÃO foi trocado**: a prancheta o
  especifica (`docs/design/prompts/inferidos/calculadora/estados-de-preco-por-canal.md:351`) e dois
  testes o pinam — a aprovação veio da minha descrição dele como detalhe imperceptível, e a
  evidência diz o contrário. Trocar continua sendo 1 caractere + 2 testes, se o dono quiser.
- **B4, B5, 4(3)** — executados nesta mesma rodada (ver commits e §7 do MAPA).

### 4(4) — Zod delegar ao `validateBandRules`: PENDÊNCIA REGISTRADA (decisão do dono: "deixa registrado")

**O que é.** A regra de sanidade de uma tabela de faixas — `commissionPct + fixedFeeRule.pct < 100`,
e `fixedFeeRule` só em `bandMode SELECTION` — existe em DUAS portas:

| Porta | Onde | Papel |
|---|---|---|
| Motor | `packages/pricing-core/src/channels.ts` → `validateBandRules` | recusa na hora de CALCULAR (um denominador zerado devolveria `Infinity`, ou um preço negativo, com cara de resposta) |
| Schema | `apps/web/src/shared/fee-catalog/fee-catalog.ts` → `.refine()` do `priceBandSchema` | recusa o CATÁLOGO ao carregar, impedindo o dado ruim de existir |

As duas portas são legítimas e devem continuar existindo — o que é duplicado é a **matemática**, e
as mensagens das duas já divergiram no texto.

**Por que NÃO foi feito.** Fazer o Zod chamar `validateBandRules` num `superRefine` muda o
**caminho e o texto das `issues`** que o Zod emite. Essas issues não chegam ao vendedor (aparecem em
log de dev e no build do `fee-ingest`), mas podem estar pinadas em testes/guardas do gerador. O
ganho — uma matemática em vez de duas — não paga o risco enquanto as duas cópias estiverem
comentadas apontando uma para a outra, que é o estado atual.

**Gatilho para reabrir.** Quando (a) a regra mudar por qualquer motivo — aí unificar é mais barato
que sincronizar; ou (b) alguém precisar de uma terceira porta (ex.: validação no backend do
catálogo servido). Nesse dia: `superRefine` chamando `validateBandRules`, mensagens vindas do motor,
e os testes do `fee-ingest` ajustados aos textos novos.


### B12 (NOVO — achado pelo teste de paridade do 4(3), 2026-09-01, NÃO corrigido)

**O servidor não reconfere a multiplicação do desconto percentual.** No modo `PCT`, o motor
calcula `discountAmount = toMoney(gross × value / 100)` (`packages/pricing-core/src/quote.ts`). O
backend (`backend/app/api/history.py`, `_validate_declared_discount`) verifica apenas duas coisas:
que `value ≤ 100` e que a identidade final fecha (`gross − amount == netTotal`). Ele **nunca
recalcula** `gross × value / 100`.

**Consequência.** Um documento declarando `mode:"PCT", value:"50", amount:"0.01"` — um percentual
que não tem relação nenhuma com o abatimento — é ACEITO, desde que a subtração declarada bata. O
servidor confia na aritmética percentual do cliente.

**Por que não foi corrigido aqui.** Está fora das 3 regras que o dono autorizou pinar em 4(3), e a
correção não é um teste: é decidir se o backend passa a recomputar um número (hoje ele
deliberadamente NUNCA calcula preço — FR-118; recomputar aqui seria uma exceção a essa regra, ainda
que de VERIFICAÇÃO e não de produção de valor). É decisão do dono.

**Escopo real do risco.** Não é um caminho de fraude do vendedor contra terceiros: o documento é o
registro do próprio vendedor. O dano é um congelado internamente inconsistente (o percentual impresso
não explica o abatimento impresso) que a imutabilidade depois preserva para sempre.


---

## Todos os bugs FECHADOS (2026-09-01, "corrija os bugs que apareceram")

| # | Como fechou |
|---|---|
| B1 | Falha do motor mostra ausência ("—" + legenda honesta); valor segue zero, decisão do dono |
| B2 | Revalida nas três telas; o parâmetro que permitia divergir morreu |
| B3 | `syncToastFor` com `switch` exaustivo — "Recalcular hoje" reconhece sessão expirada; um estado novo sem ramo não compila |
| B4 | Fallback silencioso vira "—" + trava lendo o enum do `openapi.json` (mutação nas duas direções) |
| B5 | `channelHasDeclaredFee` única; o congelado enxerga a sobretaxa. Em registro gravado nada recalcula |
| B6 | Reconciliação com `unreachable > 0` termina em exit ≠ 0, dizendo o que não foi verificado |
| B7 | `_back_url` 503 honesto em vez de devolver a localhost quem acabou de pagar |
| B8 | `ROUND_HALF_UP` explícito no documento imutável |
| B9 | Fechado de graça pela unificação do serializador (não há mais dois para divergir) |
| B10 | Uma frase: "Esta ação precisa de conexão." As três implementações viraram uma |
| B11 | Fechado pela Onda 7: o 500 loga com `exc_info` + Sentry |
| B12 | O servidor confere que o abatimento É o percentual declarado (verificação, não recálculo — FR-118 intacto) |

**Nenhum bug registrado segue aberto.** O que resta em aberto nesta frente é decisão de produto
(o nó "Orçamentos"/`/historico`), a pendência 4(4) documentada acima, e o item 5 (Rodada 1 de
homologação, pranchetas da PR-C, sandbox MP, deploy).
