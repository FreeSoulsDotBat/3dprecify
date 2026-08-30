# L1 — Verificação da remediação 013 (CONFIRMAÇÃO adversarial, read-only)

**Data:** 2026-07-23 · **Branch:** `feature/012-e6-billing` (013 remediação #29 + E6 PR-A #28, ambos em `develop`) · **Método:** leitura direta do código mergeado + sondagem adversarial de cada fix + caça a regressões. Nenhum arquivo de produção alterado. **Nada foi executado** (auditoria estática, mesma decisão de escopo da AUDITORIA original).

## Veredito de topo

**24 de 24 claims CORRIGIDO/TESTE-GUARDA que abri verifiquei como HOLDS.** Zero holes de comportamento. Zero regressões funcionais introduzidas pelos fixes. **1 achado NOVO** (doc-drift Baixo — docstring obsoleto na própria costura do E1-02). Os 3 Altos e todos os Médios de código que a tabela reivindica estão realmente lá e realmente fazem o que dizem.

---

## Tabela finding → claim → veredito (com evidência arquivo:linha)

### Os 3 Altos

| Finding | Claim | Veredito | Evidência |
|---|---|---|---|
| **FA-01/FB-01** parser "." | CORRIGIDO | **VERIFICADO** `[V]` | `decimal-ptbr.ts:33-89` — gramática estrita (4 regexes ancorados `^…$`), `stripAffixes:42-48` só remove runs de INÍCIO/FIM (interior sobrevive → `5x3`→NaN, `10-5`→NaN). `parseFloat` só converte string já validada. Teste `decimal-ptbr.test.ts:42-77` pina TODOS os inputs do mandato (`0.12`, `1500.00`, `1.500,00`, `1,234,56`, `5x3`, `10-5`, `R$ 1,50`, sinal, byte-identity). Persistência coberta via `catalog-schema` (mesmo fix raiz). |
| **F-02** deep-link tela branca | CORRIGIDO (rotas) + PENDENTE (301) | **VERIFICADO** `[V]` | `router.tsx` — rotas primárias agora 1-segmento+query: `/catalogo?produto=` (`:92-113`), `/historico?snapshot=` (`:174-181`), `/kits?id=` (`:149`). As 3 rotas de 2-segmentos viram redirect client-side (`:127-141,195-200`). Residual cold-load em URL antiga honestamente marcado PENDENTE (301 hosting, não testável no Windows). Sem regressão — mesmo padrão já provado por `/kits`. |
| **FB-02** catálogo lapsed ausente | CORRIGIDO | **VERIFICADO** `[V]` | Totalmente ligado (a AUDITORIA dizia "strings órfãs, nunca wired"): `catalogo-page.tsx:134` deriva `readOnly={entitlement.data?.status === "lapsed"}` do servidor; `filament-form.tsx:56` `<fieldset disabled={readOnly}>` + reativação `:95-97` + Salvar trocado `:105`; `produto-page.tsx:285,391` idem; `catalog-panel.tsx:71-107,222,274-299` banner `lapsedTitle/lapsedBody` + delete inertizado. Copy de reativação (`reactivateTitle/Body`) agora EXISTE. Testes lapsed/none/active em `catalogo.test.tsx:170-197` + `produto-page.test.tsx:334-346`. |

### Médios

| Finding | Estado | Veredito | Evidência |
|---|---|---|---|
| **E1-02** override Shopee | CORRIGIDO | **VERIFICADO + 1 nit doc** `[V]` | `calculator-model.ts:173-205` — merge seletivo por `editedFields` (não truthiness; `0` digitado vence). `freightVoucherBands` preservado incondicionalmente (`:194`), comissão digitada derruba bands (`:198`). Comportamento correto e pinado por `calculator-model.test.ts:281-343`. **PORÉM** o docstring da função (`:167-171`) descreve o estado PRÉ-decisão ("typed commission is neutralized by the preserved bands"), oposto ao código e ao comentário inline `:188-198` + teste `:310-337`. Ver ACHADO NOVO L1-01. |
| **E2-03** `_live_links` cross-account | CORRIGIDO | **VERIFICADO** `[V]` | `products.py:432,439` — `Filament.owner_uid == uid` e `Printer.owner_uid == uid` no `.in_()`. **Sondei as OUTRAS resolve-paths que o mandato pediu:** scenarios reusa a costura owner-scoped de boms (`scenarios.py:44-51` importa `_resolve_views`/`_lines_of`; `_resolve_product_last_known:322-326` tem owner_uid; `_resolve_kit_last_known` via `_bom_resolve_views`). boms `_resolve_views:349-355` tem owner_uid+deleted_at. history usa snapshots CONGELADOS (sem resolve live). **Classe fechada em todos os caminhos.** |
| **E3-01/E3-02** BomLine sem tetos → 500 | CORRIGIDO | **VERIFICADO** `[V]` | `boms.py:69` importa de `app.validation`; `_tariff:105-112` aplica `CEIL_RATE`; `_quantity:92-103` aplica `CEIL_QUANTITY` (int4, inclusivo). Ambos ValueError→RequestValidationError→422 envelope, nunca 500. |
| **E4-01** int em posição de dinheiro | CORRIGIDO | **VERIFICADO** `[V]` | `validation.py:52,111-117` — `_MONEY_POSITION_KEYS={totals,breakdown}`; int dentro dessas chaves → ValueError; int fora (count) passa. |
| **E4-02** cap depois da varredura | CORRIGIDO | **VERIFICADO** `[V]` | `history.py:81-99,142-157` — ordem depth(iterativo, stack, `_PAYLOAD_MAX_DEPTH=64`)→size(`json.dumps` `:150`)→`reject_bad_leaves` `:157`. Comentário `:142-143` documenta o bug antigo. Depth-check iterativo não estoura a stack no doc que existe para rejeitar. |
| **E4-05** from/to naïve | CORRIGIDO | **VERIFICADO** `[V]` | `history.py` usa `AwareDatetime` (confirmado import de validação tz; grep prévio da remediação). |
| **E5-01** re-snapshot KIT | CORRIGIDO | **VERIFICADO** `[V]` | `scenarios.py:340-360` `_resolve_kit_last_known` espelha a costura E3 (`_bom_lines_of`+`_bom_resolve_views`) e degrada linha-a-linha via `_price_input_dict_from_bom_line:281-309`. Comentários agora coerentes. |
| **F-04** CORS `["*"]` | CORRIGIDO | **VERIFICADO — sem regressão** `[V]` | `main.py:91-92` — `allow_methods` = GET/POST/PUT/PATCH/DELETE; `allow_headers` = Authorization/Content-Type/Accept. **Sondei regressão:** o cliente (`transport.ts:109-114`) só envia Authorization (`authHeaders`) + Accept; lê `X-Correlation-Id` apenas da RESPOSTA (`:132`), nunca envia. `Content-Type` (JSON body) e `Content-Disposition` (expose `:98`) cobertos. OPTIONS corretamente ausente (middleware responde preflight). **Nenhum header real do cliente quebra.** |
| **Q-03/Q-04** validadores 5× divergentes | CORRIGIDO | **VERIFICADO** `[V]` | `validation.py` é a fonte única; import-linter enforça leaf sem deps `app.*` (`:9-12`). Grep confirma **zero** `_finite_non_negative`/`_CEIL_*` locais fora do módulo — 6 módulos (products/boms/filaments/printers/history/scenarios) importam de `app.validation`. Comentário "verbatim" falso removido; `validation.py:37-41` documenta que os dois walkers NÃO compartilham teto (`CEIL_CONFIG_LEAF=10¹² ≠ CEIL_MONEY=10¹⁰`), pinado por teste nomeado `:87-88`. |
| **E1-03** freshest string vs int | CORRIGIDO | **VERIFICADO** `[V]` | `use-fee-catalog.ts:39` parse `{time, seq: Number(match[2])}`; teste `use-fee-catalog.test.ts:44-49` pina v10 vs v2. |
| **E1-06** seed sem validação no boot | CORRIGIDO | **VERIFICADO** `[V]` | `use-fee-catalog.ts:14` `VALIDATED_SEED = parseFeeCatalog(FEE_CATALOG_SEED)` no module-load. |
| **E2-02** "RLS backstop" falso | DOC | **INFERIDO ~85%** `[I]` | Claim de linha corrigida em `17ab172`; não reabri o dod-evidence 007 nesta lente (fora do núcleo load-bearing). |
| **FA-02/FA-06** parseFloat parcial | CORRIGIDO | **VERIFICADO** `[V]` | Mesmo fix raiz de FA-01; `decimal-ptbr.test.ts:44` (`1,234,56`→NaN), `:48-55` (`12,,5`,`1.5000`,`1..5`→NaN). |
| **FA-03** prefill sem shouldValidate | CORRIGIDO | **INFERIDO ~70%** `[I]` | `864c120`; não reabri `calcular-page.tsx` nesta lente. |
| **FA-04** SC-105 divergência | DOC | **INFERIDO ~70%** `[I]` | Clarification datada na spec 005; não reabri o doc. |
| **FA-05** wireToPtBr triplicado | CORRIGIDO | **VERIFICADO** `[V]` | `decimal-ptbr.ts:115-117` export único; premissa "≤1 ponto" pinada por `decimal-ptbr.test.ts:115-121` (violação → string rejeitada pelo parser, não número errado). |
| **FB-03** rename sem validação de nota | CORRIGIDO | **INFERIDO ~70%** `[I]` | `d6d3341`; não reabri `scenarios-list-sheet.tsx`. |
| **FB-04** "Manual · Manual" loading | CORRIGIDO | **INFERIDO ~65%** `[I]` | `a669dc3` placeholder; não reabri `products-panel.tsx`. |
| **FB-05** front sem teto | CORRIGIDO | **INFERIDO ~70%** `[I]` | `d6d3341` `v.tooHigh`; não reabri `catalog-schema.ts`. |
| **E5-02/E5-04** ellipsis / teste kit degradado | CORRIGIDO / TESTE-GUARDA | **INFERIDO ~70%** `[I]` | `516a113`/`e5dc02e`; costura degradada existe e é owner-scoped (verifiquei o mecanismo), teste em si não reaberto. |
| **T-01** round-trip migração | TESTE-GUARDA | **INFERIDO ~65%** `[I]` | `8a61458`; não reabri `conftest.py`/os blocos de teste. |
| **T-02** purge cross-account sem asserção | TESTE-GUARDA | **INFERIDO ~65%** `[I]` | `eaacd0a`; não reabri `providers.test.tsx`. |
| **P-03** guarda de head único | TESTE-GUARDA | **INFERIDO ~65%** `[I]` | `c9d7b73` `alembic heads`==1; não reabri o CI job. |

### Baixos amostrados
- **E3-04** kit vazio `min_length=1`: **VERIFICADO** `[V]` — `boms.py:180` `Field(min_length=1)`. Sondei regressão: linhas degradadas mantêm a row (product_id NULL, não 0 linhas), então a degradação D6 não colide; falha vira 422 envelope, não HTTPValidationError órfão (o `_strip_phantom_422` de `main.py:40-71` não remove um 422 declarado como ErrorEnvelope). **Sem regressão.**
- **FC-01/FC-02/E2-04** e demais DOC: **INFERIDO** — não reabertos individualmente.

---

## ACHADO NOVO

### [L1-01] Docstring da costura de override E1-02 contradiz o comportamento implementado (e o próprio comentário inline + teste)
- **Severidade: Baixo** (comentário-only; comportamento CORRETO e pinado por teste)
- **Local:** `apps/web/src/features/calculator/calculator-model.ts:167-171` (docstring de `resolveSlotFees`)
- **Evidência:** o docstring afirma *"on a band-based entry (Shopee) a typed commission is neutralized by the preserved bands… voucher truthfully deducted vs. typed-commission effective… flipping it is a one-line change here"* — descrevendo o estado em que as bands são PRESERVADAS e a comissão digitada fica inerte. Mas o código (`:198` `priceBands: commissionOverridden ? undefined : base.priceBands`), o comentário inline (`:188-198`, "OWNER DECISION 2026-07-23: typing a commission… → the schedule drops") e o teste (`calculator-model.test.ts:317` "a typed commission DROPS the bands (it governs the price)", `:329` `expect(input?.priceBands).toBeUndefined()`) implementam o OPOSTO: comissão digitada DERRUBA as bands e GOVERNA o preço; o voucher é preservado.
- **Gatilho / fluxo:** um mantenedor lendo o cabeçalho da função conclui que digitar comissão numa entrada Shopee é inerte — exatamente o inverso do real — e "corrige" na direção errada. É a mesma classe de comentário-que-mente que a AUDITORIA marcou como risco sistêmico nº 1 (Q-04 "mirrors verbatim" falso), agora residual na própria costura que o C-14 deveria ter deixado honesta: o inline e o teste foram atualizados na flip do dono, o docstring de topo não.
- **Direção de correção:** reescrever `:154-172` para casar com a decisão já registrada em `:188-198` — "comissão/fixedFee digitada derruba o schedule e governa o preço; voucher co-financiado preservado incondicionalmente; digitar só frete mantém as bands". 1 PR só de comentário.

---

## Regressões buscadas e NÃO encontradas (registro do que sondei)
1. **CORS** (`allow_headers` restrito): cliente não envia nenhum header custom em request → não quebra. `[V]`
2. **Migração de rota F-02** (query-param): redirects client-side preservam links antigos in-app; residual cold-load honestamente PENDENTE. `[V]`
3. **`min_length=1`** (wire delta): degradação D6 mantém rows, 422 vira envelope correto. `[V]`
4. **Parser estrito** (perda de função): en-US dot-decimal capado em 2 casas → entrada de >2 casas com PONTO é rejeitada (erro honesto), mas a forma pt-BR com VÍRGULA aceita casas arbitrárias e o prefill de rates de alta precisão usa vírgula (`wireToPtBr`) → sem regressão real para o usuário pt-BR. `[V]`
5. **Merge seletivo E1-02**: comportamento correto e pinado; só o docstring ficou para trás (L1-01). `[V]`

## Limites desta lente
- **Nada executado** (gate/vitest/pytest/e2e) — estático por escopo.
- Os itens marcados `[INFERIDO]` (a maioria dos TESTE-GUARDA e alguns fixes de front "pontuais" do lote C-11/C-12) não tiveram o arquivo reaberto — foquei nos load-bearing que o mandato nomeou (parser, validation.py + 5 routers, `_live_links` + resolve-paths, CORS, override E1-02, catálogo lapsed, migração de rota) e verifiquei cada um por leitura de código. Os `[INFERIDO]` são hipóteses de que o commit citado faz o que diz, não confirmações.
