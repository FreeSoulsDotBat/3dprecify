# AUDITORIA — 3dprecify (Precifica3D)

**Data:** 2026-07-23 · **Branch auditado:** `feature/012-e6-billing` (HEAD `66627e6`) · **Método:** auditoria adversarial read-only em duas sessões — Sessão A: 7 lentes paralelas por épico (E1–E6 + foundation); Sessão B: 6 lentes (front restante, qualidade de testes, qualidade estrutural/Fase 3, processo/011/CI) — com verificação cruzada dos achados de maior severidade no loop principal. Nenhum arquivo de produção foi alterado (exceções autorizadas: este relatório e as linhas de estimativa/real em `docs/token-ledger.md`). Custo medido: 1.138.297 tokens (Sessão A) + 749.368 (Sessão B) = **1.887.665 tokens** de fan-out.

---

## 1. Sumário executivo

O código está **substancialmente conforme às specs** — as invariantes financeiras e de segurança centrais (fórmula canônica só no `pricing-core` com backend nunca recomputando; gate de entitlement server-side em 100% das rotas, com teste que varre `app.routes` dinamicamente; imutabilidade de snapshots em 3 camadas; idempotência de billing por constraint no banco; paridade literal `gate:all` local↔CI; purge de caches cross-account completo) **verificaram-se todas verdadeiras com evidência**. Não há nenhum achado Crítico. Há **3 Altos**: (1) o parser numérico pt-BR compartilhado trata todo `.` como separador de milhar sem nenhuma barreira no input — `"0.12"` vira `12` na calculadora e `"1500.00"` vira `150000` **gravado no catálogo**, erros de dinheiro de 100× silenciosos; (2) três rotas de produção de 2+ segmentos expostas à armadilha conhecida do `base:'./'` (tela branca em refresh/bookmark/link direto); (3) a variante somente-leitura do catálogo para conta `lapsed`, exigida pela ux-spec do E2, **nunca foi implementada** — as strings existem órfãs no i18n e um comentário afirma o comportamento que não existe. Os 19 Médios concentram-se em quatro padrões sistêmicos: doc-drift nos artefatos de fechamento (incluindo um dod-evidence que reivindica "RLS backstop" inexistente); paridade de validação divergente entre endpoints irmãos (validadores financeiros copiados 5×, um deles com comentário "verbatim" falso); suposições sobre o Mercado Pago testadas circularmente contra o próprio stub; e testes que não verificam o invariante que o código implementa (o purge de privacidade cross-account passaria verde com 4 linhas deletadas). A qualidade estrutural é alta — zero TODO/FIXME em produção, zero violações de boundaries, zero segredos, disciplina failing-first visível — e vários pontos prováveis de defeito foram verificados **corretos** (purge completo, rtk hook funcionando, `reportlab==5.0.0` legítimo no lock).

**Contagem:** Crítico **0** · Alto **3** · Médio **19** · Baixo **52** · Informativo **7** — total **81**. A grande maioria `[VERIFICADO]`; os itens com componente `[INFERIDO]` estão marcados individualmente.

---

## 2. Mapa Planejado vs. Encontrado (Fase 0, revisado pós-Sessão B)

| # | Decisão declarada (fonte) | Encontrado | Veredito |
|---|---|---|---|
| 1 | pnpm workspaces, Node 24 (ADR-0004) | engines `>=24 <25`, pnpm 11, catalog | ✅ [V] |
| 2 | React 19 + Vite 8 + Tailwind v4 PWA | catalog + vite-plugin-pwa | ✅ [V] |
| 3 | DS `tf-*` Radix-wired (ADR-0007) | `.tf-*` + wrappers finos sobre Radix; AppNav semântico aprovado | ✅ [V] |
| 4 | TanStack Router/Query, Zustand, RHF+Zod | confirmado | ✅ [V] |
| 5 | FSD-Lite + eslint-boundaries + dependency-cruiser | regras ativas; greps de violação = 0 | ✅ [V] |
| 6 | FastAPI Py 3.12 via uv | confirmado | ✅ [V] |
| 7 | Wire camelCase `alias_generator` | amostrado em errors/scenarios | ✅ [V] |
| 8 | ErrorCode enum → union TS → mapa pt-BR (ADR-0002) | 8 = 8 = 8 valores | ✅ [V] |
| 9 | structlog correlation-first + `X-Correlation-Id` | backend emite, front propaga e tageia Sentry | ✅ [V] |
| 10 | Pricing canônico TS; backend nunca recomputa | sweep: zero aritmética de preço em Python | ✅ [V] |
| 11 | Postgres + SQLAlchemy 2.0 + Alembic (ADR-0013) | 5 migrações; compose postgres:17 | ✅ [V] |
| 12 | Entitlement gate + ledger append-only (ADR-0012) | gate em 100% das rotas (auditoria dinâmica); append-only só por convenção (E2-06) | ✅/⚠️ [V] |
| 13 | Imutabilidade snapshots 3 camadas (ADR-0019) | trigger + guard ORM + PATCH label-only | ✅ [V] |
| 14 | reportlab==5.0.0 pinado (ADR-0020) | pin real — `uv.lock:1171-1179` resolve do PyPI (sdist hash, 2026-06-18) | ✅ [V] |
| 15 | `gate:all` idêntico local↔CI (006/D4) | byte-idêntico | ✅ [V] |
| 16 | Drift-guard OpenAPI | todo push/PR, sem path-filter | ✅ [V] |
| 17 | Deploy adiado até v1 | fora do alcance de código | n/a |
| 18 | CLAUDE.md "E6 UNSTARTED" | E6 PR-A implementado nesta branch (spec-kit seguido) — drift do ground | ⚠️ [V] (M-01) |
| 19 | Mercado Pago (ADR-0023 / seguranca-round §8) | SEC-1xx..7xx conformes; lacunas E6-01/02/04 | ✅/⚠️ [V] |
| 20 | Roteamento agentes ADR-0022 + alavancas 011 | frontmatter ✅; rtk hook FUNCIONANDO (1.401 comandos interceptados; banner é falso-negativo de escopo global); hooks graphify instalados; invariante lefthook respeitada | ✅ [V] |
| 21 | FR-413 nav "Kits" 5ª aba (008) | `app-nav.tsx:19-25`, ordem e copy literais da spec | ✅ [V] |
| 22 | SC-105 toggle OFF mantém lista de canais visível rotulada simulação (005) | seção inteira escondida; divergência só registrada em dod-evidence, spec viva nunca emendada | ⚠️ [V] (FA-04) |
| 23 | ux-catalog §3: variante lapsed somente-leitura | **não implementada**; strings órfãs no i18n | ❌ [V] (FB-02) |

---

## 3. Achados

> IDs por lente — Sessão A: `E1..E6` (épicos), `F` (foundation), `M` (main-loop). Sessão B: `FA/FB/FC` (front), `T` (testes), `Q` (qualidade estrutural), `P` (processo/CI). Ordenados por severidade.

### ALTO

### [FA-01/FB-01] Parser pt-BR trata todo "." como separador de milhar, sem nenhuma barreira no input — erros de dinheiro de 100× silenciosos em DUAS superfícies
- Categoria: Bug
- Severidade: **Alto**
- Status: [VERIFICADO] (supersede o E1-04 da Sessão A, que era [INFERIDO] — a hipótese de masking upstream caiu)
- Local: `apps/web/src/shared/lib/decimal-ptbr.ts:6-10` (raiz); superfície 1 (calculadora): `apps/web/src/shared/ui/number-field.tsx:22-61` + `features/calculator/calculator-schema.ts:105-106`; superfície 2 (catálogo, persiste): `features/catalog/catalog-schema.ts:36-38`
- Evidência: `parseDecimal` faz `.replace(/\./g,"").replace(",",".")` → `parseFloat`. O `NumberField` não tem `type`, `pattern` nem filtro de tecla (`inputMode="decimal"` só afeta teclado mobile, que inclui o "."); o RHF passa o valor bruto. Na calculadora, `"0.12"` em kW → `12` (energia ×100). No catálogo, `"1500.00"` em `costPerRoll`/`machineValue` → `150000`, **gravado**, contaminando todo preço futuro derivado do item. Nenhuma mensagem de erro em nenhum caso (o resultado é finito e ≥0).
- Spec relacionada: lacuna de especificação (nenhum FR define parsing de separador misto); o comentário do próprio arquivo promete apenas "nunca NaN/∞", e o caso real é pior — valor errado e finito.
- Impacto: acontece quando o usuário digita/cola decimal com ponto (hábito en-US, datasheets) em qualquer campo numérico do app.
- Direção de correção: um único fix na raiz — validar a string limpa contra um padrão pt-BR estrito (rejeitar resíduo/ambiguidade) ou heurística documentada (um único "." seguido de 1–2 dígitos sem "," = decimal); teste adversarial nas duas superfícies.
- Esforço estimado: M

### [F-02] Rotas de 2+ segmentos expostas à armadilha `base:'./'` — tela branca em cold-load/refresh/bookmark
- Categoria: Bug | Arquitetura · Severidade: **Alto** · Status: [VERIFICADO] (dupla checagem)
- Local: `apps/web/src/app/router.tsx:116` (`/catalogo/produtos/novo`), `:128` (`/catalogo/produtos/$productId`), `:173` (`/historico/$snapshotId`); `vite.config.ts:10` (`base:"./"`); `firebase.json:5` (rewrite `**`→`index.html`)
- Evidência: assets relativos numa URL de 2+ segmentos resolvem para `/historico/assets/...`, o rewrite devolve `index.html` no lugar do JS/CSS e o app fica em branco. Armadilha **medida e documentada** pelo projeto (o comentário do E6 em `router.tsx:178-181` a chama de "the measured base:'./' cold-load trap"); mitigada só em rotas novas (`/kits?id=`, `/conta?checkout=retorno`). Os e2e evitam deliberadamente `page.goto(deep-link)` — nenhuma suíte pega. A Sessão B confirmou em `snapshot-detail-page` sem agravante novo.
- Spec relacionada: lacuna de especificação — nenhum FR de 008/009 documenta o risco.
- Impacto: usuário real dá F5, abre bookmark ou compartilha link → tela branca em produção.
- Direção: 1 segmento + query param (padrão `/kits`), OU decisão explícita de trocar `base` para `"/"` (revisitar a decisão Capacitor — Princípio VIII).
- Esforço: M (por rota) | G (base global)

### [FB-02] Variante somente-leitura do catálogo para conta `lapsed` (ux-catalog §3) nunca foi implementada — strings órfãs no i18n provam a intenção abandonada
- Categoria: Conformidade (Ausente) · Severidade: **Alto** · Status: [VERIFICADO]
- Local: `apps/web/src/features/catalog/*` + `pages/catalogo/produto-page.tsx` (zero imports de `useEntitlement`); `filament-form.tsx:12` (comentário afirma o comportamento; `FilamentFormProps` não tem `disabled`/`readOnly`); `messages.pt-br.ts:316-319` (`lapsedTitle`/`lapsedBody`/`readOnlyHint` nunca renderizadas); `catalogo-page.tsx:101` (lapsed cai no branch de active)
- Evidência: `ux-catalog.md §3` (007) exige para `lapsed`: banner "Premium pausado" + sheet de edição somente-leitura + painel de reativação, "nunca punitivo, sempre distinto de `none`". O mesmo padrão está corretamente ligado em cenários (`scenarios-list-sheet.tsx:313-314`) e kits (`bom-page.tsx:412-413`) — só o catálogo ficou sem. A cópia de reativação da spec nem existe no messages (zero ocorrências).
- Spec relacionada: `specs/007-e2-catalog-entitlement/ux-catalog.md §3` (linhas ~550-552).
- Impacto: acontece quando um assinante com Premium pausado abre o Catálogo — vê Adicionar/Editar/Excluir vivos, preenche o formulário inteiro e só ao salvar recebe a mesma frase genérica mostrada a quem nunca comprou, contradizendo o objetivo explícito da spec.
- Direção: implementar banner + variante read-only nas 3 superfícies (filaments/printers/products), reaproveitando as strings órfãs + adicionando a cópia de reativação; o padrão já existe 2× no repo para copiar.
- Esforço: M

### MÉDIO — Sessão A (inalterados; detalhes com evidência completa nas entradas)

### [E1-01] Catálogo de fees shipado só cobre Shopee — ML e Amazon `entries: []` contradizem FR-105a · Conformidade · [V] · `backend/app/data/catalog.json:6-15`; `seed.ts:14-24` · Curar entradas ou Clarification datada · M
### [E1-02] Override de um único fee Shopee derruba silenciosamente `priceBands` + voucher co-financiado — recebido líquido superestimado, sem teste no seam · Bug · [V] · `calculator-model.ts:170-179` · Mesma classe do gap que o amendment ADR-0011 (2026-07-07) fechou · Preservar bands/voucher sob override parcial · M
### [E2-02] `dod-evidence.md` do E2 reivindica "RLS backstop" como evidência entregue; RLS = 0 ocorrências no backend (confirmado por 2 lentes independentes) · Conformidade · [V] · `specs/007/dod-evidence.md:30` · Violação do Truth Over Approval (Princípio II) · Corrigir a linha (ou implementar) · P
### [E3-01] `BomLineIn.tariffPerKwh` sem o teto que `products.py` tem — 500 em vez de 422 ao materializar peça nova (o contrato afirma "mirrors products") · Bug · [V] · `boms.py:99-106` vs `products.py:209-212`; `errors.py:120-161` · Reusar `_finite_non_negative` + teste · P
### [E5-01] Re-snapshot de `lastKnown` no save nunca cobre base KIT; o docstring delega a um mecanismo (T024) que é leitura pura e nunca grava · Bug · [V] · `scenarios.py:473-501` (linha 486); comentário enganoso também em `test_scenarios.py:952-953` · Bomba-relógio para a criação KIT-basis futura · Espelhar `_resolve_kit_last_known` + corrigir comentários · P
### [E5-03] N+1 na listagem de cenários — até 100–300+ queries sequenciais por página (PRODUCT 2/linha, KIT 3/linha) · Performance · [V] · `scenarios.py:530-535` · Batch por página · M
### [E6-01] Assinatura do webhook MP testada circularmente — o stub assina com o mesmo `canonical_manifest` da produção; o gate §8.1 exigia vetor known-good · Testes/Segurança · [V] · `test_billing_security.py:82-86,225-245`; `stub.py:139-149` · Se a canonicalização real divergir, produção rejeita 401 tudo · Fixture real do simulador MP · P
### [E6-02] `data.id` do manifest lido do corpo, não do query param da notificação · Bug/Segurança · [INFERIDO ~55%] · `api/billing.py:78-88` · Validar no simulador MP; ligado ao E6-01 · P
### [E6-04] Preço exibido (copy i18n) e cobrado (plano MP) = 2 fontes sincronizadas à mão, sem guarda · Conformidade · [V] · `billing-plans.ts:16-31` vs `api/billing.py:136-138` · Runbook + smoke test de deploy · M
### [F-04] CORS `allow_methods/headers=["*"]` com `allow_credentials=True` — gap de decisão · Segurança · [V] · `main.py:82-94` · Restringir e registrar · P

### MÉDIO — Sessão B

### [FA-02] `parseFloat` parcial aceita strings malformadas silenciosamente
- Bug · [VERIFICADO] · Local: `decimal-ptbr.ts:9`; `calculator-schema.ts:105`; mesma leniência no catálogo (`catalog-schema.ts:36-38`)
- Evidência: `"1,234,56"` → replace troca só a 1ª vírgula → parseFloat para no resíduo → `1.234` sem erro; `"1--5"` → `1`; a limpeza também concatena (`"5x3"` → `53`, [I]). A defesa atual é "o que sobra depois de filtrar", não "o formato é válido".
- Impacto: paste de valor mal formatado produz número plausível e errado, sem sinal. Direção: validar formato estrito antes de aceitar (mesmo fix raiz do FA-01/FB-01). Esforço: P

### [FA-03] `setValue` programático de prefill nunca passa `shouldValidate` — erro obsoleto visível contradizendo preço correto
- Bug · [VERIFICADO] · `calcular-page.tsx:139-141,167-169,175-181,235` (grep `shouldValidate` = 0)
- O preço se corrige (recompute re-parseia bruto), a mensagem de erro velha fica até toque manual no campo. Direção: `{shouldValidate:true}` nos prefills. P

### [FA-04] Toggle marketplaces OFF esconde a seção de canais inteira; a spec 005 exige lista visível rotulada "simulação" (4 ocorrências nunca emendadas)
- Conformidade · [VERIFICADO] · `calculator-form.tsx:518` vs `specs/005/spec.md:126,130,199,233`
- A divergência foi "owner-clarified" só no dod-evidence (:48-49) e ADR-0011:237-239; a spec viva mente e o teste (`calcular.test.tsx:178-213`) fixa o comportamento divergente. FR-113 (headline por canal) também ❌ — descopo documentado no ADR, não na spec.
- Direção: Clarification datada na spec 005 OU implementar a letra. P (doc) / M (impl)

### [FB-03] Rename de cenário não valida nota ≤500 (o create valida; o backend valida ambos simetricamente)
- Bug/Inconsistência · [VERIFICADO] · `scenarios-list-sheet.tsx:198-235,391-403` vs `save-scenario-sheet.tsx:82,101,149` vs `scenarios.py:188-198,626-636`
- Falha só no submit com frase genérica em vez da mensagem específica já existente. Direção: replicar a validação. P

### [T-01] Downgrade das 5 migrações Alembic 100% sem teste
- Testes · [VERIFICADO] · `conftest.py:89` (só `upgrade head`); grep downgrade em tests = 0; todas as 5 migrações definem `downgrade()` (0005 com índice parcial-UNIQUE + CHECK restaurado + ordem de FK)
- Impacto: downgrade quebrado chega como operação break-glass que falha quando mais necessária; inverter a ordem de dois `op.drop_*` não é pego por nada. Direção: teste `requires_db` upgrade→downgrade base→upgrade. P

### [T-02] Purge de caches na troca de usuário (a lição de identity-leak FR-309/Q2) quase todo sem asserção; branch `uidChanged` sem teste
- Testes · [VERIFICADO] · `providers.tsx:26-64` (6 query-caches + 5 purges idb) vs `providers.test.tsx:34-55` (só 2 chaves, só transição anonymous, só 2 asserções)
- Mutações que passariam verdes: deletar as linhas 49-52 (4 purges); inverter a condição `uidChanged` (:29). O código está correto (verificado pela lente Q — Q-06), mas a suíte não protege o controle de privacidade.
- Impacto: regressão de vazamento cross-account em dispositivo compartilhado não seria detectada. Direção: popular todos os caches + espionar `removeQueries` por QUERY_ROOT + caso u1→u2 direto. M

### [Q-03] Validadores financeiros `_finite_non_negative` + constantes `_CEIL_*` copiados em 5 routers, sem módulo compartilhado
- Arquitetura · [VERIFICADO] · Definições irmãs: `filaments.py:46`, `history.py:83`, `printers.py:42`, `products.py:68`, inline `boms.py:104`; `_CEIL_MONEY=10**10` redefinido em 5 arquivos; nenhum módulo `validation.py` existe
- É regra FINANCEIRA replicada — consistente hoje "por sorte, não por construção"; o E3-01 é o caso onde a cópia JÁ divergiu. Direção: `backend/app/validation.py` + tabela única de tetos. M

### [Q-04] `_reject_bad_leaves` duplicado com comentário "mirrors verbatim" FALSO (tetos divergem: 10¹⁰ vs 10¹²)
- Arquitetura/Bug-latente · [VERIFICADO] · `history.py:93` (`_CEIL_MONEY`) vs `scenarios.py:90` + `:93` ("Mirrors history.py verbatim") + `:116` (`_CEIL_CONFIG_LEAF=10**12`)
- Documentação afirmativa-falsa: manutenção guiada pelo comentário propagaria correção errada. Direção: extrair parametrizado por teto + corrigir comentário. M

### [P-03] Nenhum gate detecta múltiplos heads Alembic / `down_revision` órfão
- Cobertura de gate · [VERIFICADO] (lacuna de especificação) · `check-migrations.sh:27` só pega M/D/R (amend-guard); arquivos novos com o mesmo `down_revision` passam e só quebram no `upgrade head` de alguém; grep `alembic heads` em scripts/CI = 0
- Direção: passo `alembic heads` (exatamente 1 linha) no job migration-guard ou `gate:be`. P

### BAIXO — Sessão A (32→30; M-02 absorvido pelo P-02)

- **[E1-03]** `freshest()` compara `catalogVersion` lexicograficamente — quebra com ≥10 versões/dia · Bug · [V] · `use-fee-catalog.ts:27-29` · P
- **[E1-05]** Seleção de regime floor/linear em float nativo (comparação, não valor) · Qualidade · [V] · `channels.ts:69,109-110` · P
- **[E1-06]** `priceBands` escapam da guarda [0,100); seed nunca validado em runtime · Arquitetura · [I] · `index.ts:266-267`; `use-fee-catalog.ts:86-89` · P
- **[E1-07]** SC-109 "3.0.0" desatualizado (código 3.1.0, ADR-0016 não retro-anotado) · Doc · [V] · P
- **[E2-01]** Índices parciais do data-model §7 não existem na migração 0001 · Conformidade/Perf · [V] · P
- **[E2-03]** `_live_links` sem filtro `owner_uid` (seguro por construção, não auto-defensivo) · Segurança · [V] · `products.py:421-438` · P
- **[E2-04]** Comentário "/catalogo auth-guarded" contradiz o roteador · Qualidade · [V] · P
- **[E2-05]** ADR-0012 "one PK lookup" vs upsert+commit+select-all em toda operação · Perf/Doc · [V] · P
- **[E2-06]** Ledger sem reforço de imutabilidade no banco/ORM (sem paridade E4; nunca prometido) · Arquitetura · [V] · P
- **[E3-02]** `quantity` sem teto — overflow int4 → 500 · Bug · [V/I] · `boms.py:80,91-97` · P
- **[E3-03]** N+1 no write (`_materialize`) vs read batched do próprio módulo · Perf · [V] · M
- **[E3-04]** Kit vazio: bloqueado só no cliente (ambiguidade genuína de spec) · Consistência · [V] · P
- **[E4-01]** Leaf monetário int passa validador, renderiza "" no PDF · Bug · [V] · P
- **[E4-02]** `_reject_bad_leaves` sem limite de profundidade; size-cap depois · Bug · [I] · P
- **[E4-03]** `headline_basis` sem `server_default` documentado · Doc · [V] · P
- **[E4-04]** Nome do UNIQUE difere do data-model (§4 nem lista) · Doc · [V] · P
- **[E4-05]** Filtro from/to aceita datetime naïve (só caller não-UI) · Bug/tz · [I] · P
- **[E5-02]** Duplicata trunca em 120 sem "…" (decisão do dono F5 não seguida; ramo sem teste) · Divergência · [V] · `scenarios.py:677-679` · P
- **[E5-04]** Linha degradada dentro de kit vivo nunca exercitada via API de cenários · Testes · [V] · P
- **[E6-03]** Preapproval MP órfã em corrida de checkout duplo (aceito no ADR-0023:244) · Bug · [V] · M
- **[E6-05]** Boot sem segredos MP desabilita billing sem sinal operacional · Ops · [V] · P
- **[E6-06]** `EntitlementView` não expressa grace/pending (pré-requisito PR-B) · Arquitetura · [V] · M
- **[E6-07]** Copy "nada foi cobrado" omite cortesia ativa · Qualidade · [V] · P
- **[E6-08]** Regex `x-signature` rígido à ordem exata · Qualidade · [I] · P
- **[E6-10]** Reconcile serial sem paginação (escala pré-v1 trivial) · Perf · [V] · M
- **[F-01]** Constituição ainda diz "scrum-master orchestrates" (agente já corrigido; SC-7 do 002 incompleto) · Conformidade · [V] · P
- **[F-03]** Docstring `auth.py` "No product route consumes this yet" — consumido por 14 arquivos · Doc · [V] · P
- **[F-05]** 401/TOKEN_EXPIRED ad hoc por página · Arquitetura · [V/I] · P/M
- **[F-06]** Transport sem retry próprio (React Query default cobre queries) · Observação · [V] · P
- **[M-01]** CLAUDE.md "E6 UNSTARTED" vs PR-A implementado (spec-kit foi seguido — drift do ground) · Doc · [V] · P

### BAIXO — Sessão B

- **[FA-05]** Conversão wire→pt-BR (`wireToPtBr`) triplicada idêntica, premissa "máx um ." não validada · Qualidade · [V] · `catalog-prefill.ts:13-15`, `product-mapping.ts:18-20`, `scenario-bridge.ts:49-51` · Extrair p/ shared/lib + teste da premissa · P
- **[FB-04]** Corrida de load: produto vinculado pisca "Manual · Manual" no primeiro render (isLoading descartado) · Bug · [V mecanismo/I perceptibilidade] · `products-panel.tsx:26-35` + `use-catalog.ts:74,106` · P
- **[FB-05]** Zod do catálogo sem tetos `_CEIL_*` — acima do teto vira 422 genérico em vez de erro inline · Validação · [V] · `catalog-schema.ts` · P
- **[FC-01]** 10 de 33 ícones do DS nunca usados (peso morto no bundle) · Qualidade · [V] · `icon.tsx:12-38` · P
- **[FC-02]** DS hardcoda 3 strings pt-BR fora do messages "single source" (`Fechar`×2, `Notificações`) · i18n · [V] · `toast.tsx:64,76`; `dialog.tsx:44` · P
- **[FC-03]** PWA `autoUpdate` silencioso sem decisão registrada (nenhum `useRegisterSW`) · Qualidade · [I] · `vite.config.ts:15` · P (doc) / M (prompt)
- **[T-03]** e2e grant-flip prova "conceder à única sub pendente" via fallback global do stub, não o mapeamento preapproval→owner (coberto em unitário) · Testes · [V] · `billing.spec.ts:96-209` + `stub.py:222-249` · M
- **[T-04]** Concorrência de duas abas (outbox drain simultâneo) nem implementada nem testada — write-back local pode perder registro · Testes · [I] · grep BroadcastChannel/locks = 0 · M
- **[T-05]** SEC-107 (constant-time) verificado por grep de substring — trocar a comparação real por `==` passaria · Testes · [V] · `test_billing_security.py:238-245` · P
- **[T-06]** Isolamento DB não-billing só por uid-literal único, sem truncate (billing trunca) · Testes · [V] · `conftest.py:74-96` vs `:108-154` · M
- **[T-07]** Exclusão de coverage `shared/api/**` silencia `transport.ts` e `error-messages.ts` (hand-written; comentário diz "Generated Orval client") · Testes · [V] · `vitest.config.ts:20` · P
- **[Q-01]** Display pt-BR reimplementado 3× (breakdown-row, price-hero vs formatDecimal) — fura "print money through one rule" (008 R7) · Qualidade · [V] · P
- **[Q-02]** `wireToPtBr` = segunda gramática de conversão fora do parser canônico (assunção wire-sem-milhar não testada) · Arquitetura · [V] · P
- **[Q-05]** 6 caches offline uid-keyed com estrutura idêntica copiada (~5 funções cada) · Arquitetura · [V] · factory `makeUidCache<T>` · M
- **[Q-07]** `_not_found` 6× / `_owned` 5× copy-paste — owner-scoping (controle de segurança, Constitution IV) replicado por router · Qualidade · [V] · `owned_or_404` genérico · M
- **[Q-08]** God files: `models/__init__.py` 892 linhas (13 classes E1→E6) e `scenarios.py` 707 · Arquitetura · [V] · split por domínio; prioridade baixa · M
- **[Q-10]** `computeCalculator` a cada keystroke sem debounce (memo removido conscientemente por bug de mutação; `catalogCtx` recria `Date.now()` por render) · Performance · [V] · `calcular-page.tsx:206-219` · `useDeferredValue` SE profiling acusar — não acionar sem medir · P
- **[Q-11]** `generated.ts` 5.288 linhas — tree-shaking provável ok (imports nomeados), não medido no bundler · Performance · [I] · `vite build --report` como verificação · P
- **[Q-12]** Deps backend sem constraint (fastapi, structlog, pydantic-settings, sentry-sdk) — lock garante reprodutibilidade, disciplina de pin inconsistente · Dependências · [V] · floors mínimos · P
- **[P-01]** Banner rtk "No hook installed" polui 100% dos Bash; dod-evidence 011 o descreve como confinado a um comando — mecanismo FUNCIONA (1.401 comandos interceptados) · Processo/DX · [V] · atualizar dod-evidence · P
- **[P-02]** `.config/rtk/filters.toml` = debris órfão (template global, sem referência em nenhum artefato 011, não-ignorado) — absorve o M-02 · Higiene · [V] · apagar ou gitignore · P
- **[P-04]** decisions-backlog §9 "Cloudflare per-PR preview" stale há ~1 mês apesar de apontado no audit-findings de 2026-06-28; disclaimer não cobre §9 · Doc-drift · [V] · `decisions-backlog.md:92` · P

### INFORMATIVO (verificações que confirmaram decisões corretas — sem ação)

- **[E4-06]** Revogação de token não purga o outbox — correto por design (uid-keyed, sem vazamento; ADR-0018 §8/§10). [V]
- **[E4-07]** CSV formula-injection: nenhum dos 4 gatilhos de re-abertura disparou; vigiar D1–D4 (ingestão ML). [V]
- **[E6-09]** Fallback do stub MP: isolamento test-only verificado (gated, default prod `None`). [V]
- **[Q-06]** Purge-on-signout **COMPLETO** — 6 caches uid-keyed varridos; outbox deliberadamente só no branch "descartar" do guard; fee-catalog corretamente fora (público). O ponto mais provável de defeito passou. [V]
- **[Q-09]** Resolvers D3/D6 em 3 domínios — duplicação de forma, não trivialmente extraível; agir só se um 4º domínio surgir. [I]
- **[Q-13]** Majors agressivas (zod4/tw4/vite8/orval8/eslint10/firebase12) sem CVE afirmável offline — `pnpm audit`/`uv pip audit` recomendados como verificação; a suspeita sobre `reportlab==5.0.0` foi RESOLVIDA (pin legítimo no `uv.lock:1171-1179`). [I→V parcial]
- **[Q-14]** Exports do pricing-core (`roundHalfUp`, `resolveChannels`, `applyBandFloor`) sem consumidor externo — API pública inflada, não código morto. [I]

---

## 4. Cobertura da auditoria

**Método:** 13 lentes read-only em 2 sessões (Sessão A: E1/E4 opus, E6 via `seguranca`/opus, demais sonnet; Sessão B: testes e Fase 3 em opus, demais sonnet), evidência arquivo:linha obrigatória, disciplina [VERIFICADO]/[INFERIDO]; achados de topo re-verificados independentemente no loop principal (F-02, E5-01, E3-01, reportlab no lock — todos confirmaram/resolveram). Custo total medido: **1.887.665 tokens** de fan-out.

**Lido integralmente (produção):**
- **Backend: ~100%** — 5 migrações, 11 routers, `billing/**`, entitlement, db, models, errors, main, settings, auth, observability, quote_render, scripts, mp_stub.
- **pricing-core: 100%** (3 arquivos).
- **Front: ~95%** — todas as features (calculator, catalog, bom, history, scenarios, billing, auth), entities, pages, widgets, DS `shared/ui` (18 componentes .tsx), `shared/{api,lib,i18n,session,observability,fee-catalog}`, app (router/providers/shell), main.tsx, vite.config.
- **Testes:** corpos integrais das suítes de billing (5), conftest/helpers, errors/conformance, outbox/session/providers/entitlement/transport/calculator-model/resolved-basis/billing-components, pricing-core computeCalculator+determinism, e2e billing.spec; blocos downgrade das 5 migrações; teste geométrico do PDF.
- **Specs/ADRs:** specs 001–012 (spec+data-model+plan nas lentes), ADR-0001..0023, constitution, seguranca-round 012, dod-evidence 011 integral (claims classificadas), lefthook/ci/deploy/auto-pr/scripts.

**Por amostragem:** corpos de test_history/test_scenarios/test_products/test_filaments/test_printers/test_entitlement_* (nomes + seções críticas); testes de página front restantes; e2e não-billing (via grep de padrões); ux-docs (trechos citados); CSS do DS (3 integrais de ~19); ADR-0009/0010; tech-debt (8 itens cruzados); pnpm-lock/uv.lock (pontual).

**NÃO coberto (limites declarados):**
- Nada foi **executado** (gate/testes/e2e/`pnpm audit`/`uv pip audit`) — auditoria estática por decisão de escopo; os audits de dependência são o follow-up recomendado do Q-13.
- Corpos completos dos testes amostrados acima; e2e specs não-billing na íntegra; ~16 arquivos CSS do DS; specs 011 {spec,data-model,research} integrais; docs/design e product briefs integrais; output real do bundler (Q-11); enumeração exaustiva de funções >100 linhas; comportamento 401 página-a-página (F-05 parcial [I]); `ux-scenarios.md` context-bar (amostragem planejada da lente Front-A não realizada — declarado por ela).

---

## 5. Top 10 prioridades (severidade × esforço)

1. **FA-01/FB-01** — parser pt-BR do ponto (Alto, M): um fix na raiz elimina erros de dinheiro de 100× em duas superfícies, uma delas persistente no catálogo.
2. **F-02** — deep-link/refresh quebra 3 rotas em produção (Alto, M): a tática (`?id=`) já existe no próprio código.
3. **FB-02** — variante lapsed do catálogo (Alto, M): UX especificada ausente; strings prontas e padrão já implementado 2× no repo — custo baixo para um Alto.
4. **E6-01 + E6-02** — vetor known-good da assinatura MP + data.id query-vs-body (Médio, P): ~1 fixture protege a autenticação de todo o billing antes do cutover live.
5. **T-02** — assertar o purge de privacidade cross-account (Médio, M): o código está certo; a suíte precisa impedi-lo de regredir.
6. **E1-02** — override Shopee derruba voucher/bands (Médio, M): honestidade de dinheiro no fluxo principal.
7. **E5-01** — re-snapshot KIT + comentários enganosos (Médio, P): ~10 linhas agora evitam defeito garantido no futuro.
8. **E3-01 + Q-03/Q-04** — paridade de validação: fix pontual do 500 (P) + módulo compartilhado de validadores financeiros (M) que impede a próxima divergência.
9. **T-01 + P-03** — round-trip de downgrade + gate `alembic heads` (Médio, P): dois guards baratos para a camada de migração.
10. **FA-04 + E2-02 + F-01 + M-01** — lote de reconciliação documental (Médio/Baixo, P): emendar spec 005, dod-evidence 007, Constituição e CLAUDE.md num único passe de verdade documental.

*Menções: E5-03 (N+1 — priorizar se a listagem ficar lenta em UAT); E6-04 (cross-check de preço antes do primeiro real cobrado); E1-01 (decisão de produto).*

---

## 6. Riscos sistêmicos (padrões que merecem correção estrutural, não pontual)

1. **Doc-drift nos artefatos de fechamento e ground** (E2-02, FA-04, F-01, F-03, E1-07, E4-03/04, E2-05, M-01, P-01, P-04, Q-04): specs/ADRs/dod-evidence/docstrings/comentários afirmam coisas que o código superou, nunca teve — ou, no caso Q-04, afirmam "verbatim" o que diverge. O processo SDD gera muitos documentos e nenhum gate re-verifica os fechados. *Direção: checklist de close-out que confronta claims com grep; retro-anotação obrigatória quando um ADR supera um SC; proibir comentários "mirrors X" sem teste que os prove.*
2. **Paridade de validação divergente entre módulos irmãos** (E3-01, E3-02, Q-03, Q-04, FB-05, FB-03): a mesma regra financeira implementada com rigor diferente em módulos gerados em sessões diferentes — o dialeto clássico de código por IA. Já produziu um 500 alcançável (E3-01) e uma inconsistência de UX (FB-03). *Direção: módulo compartilhado de validadores/tetos no backend + espelhamento sistemático no Zod do front.*
3. **Parser numérico leniente como raiz única de múltiplos bugs de dinheiro** (FA-01/FB-01, FA-02, FA-06, E1-04†, Q-02, FA-05): toda entrada numérica do app passa por um parser que aceita quase tudo; as conversões wire↔display têm 3 cópias + 2 reimplementações de display. *Direção: um único módulo de parse/format estrito com testes adversariais, consumido por todas as superfícies.*
4. **O código implementa, o teste não verifica** (T-02, T-05, E6-01, T-01, E5-04, E5-02): invariantes críticos (purge de privacidade, constant-time, canonicalização MP, downgrade) protegidos por asserções mais fracas que o invariante — mutações triviais passariam verdes. *Direção: para todo controle de segurança/privacidade, exigir o teste que falha quando o controle é removido.*
5. **Handoffs deferidos sem dono nem gatilho** (E5-01, FB-02, E1-01, E6-06): deferimentos legítimos que viram comentário/strings órfãs e ninguém é avisado quando o gatilho chega — o FB-02 mostra o estágio terminal (strings adicionadas, wiring nunca feito, comentário afirmando o que não existe). *Direção: todo deferimento vira linha em tech-debt/decisions-backlog com gatilho explícito (o padrão dos 4 gatilhos do CSV no ADR-0020 é o modelo).*
6. **Disciplina de batching não uniforme** (E5-03, E3-03, E2-05): read-paths exemplares convivem com write/list-paths N+1 nos mesmos módulos. *Direção: helper de resolução em lote + teste de contagem de queries por endpoint de lista.*
7. **Duas fontes sincronizadas à mão para o mesmo fato** (E6-04; seed↔catalog.json hoje idênticos mas sem guarda): *Direção: teste de igualdade ou gerador único para todo par espelhado.*

† E1-04 foi superado por FA-01/FB-01.

---

*Auditoria conduzida em 2026-07-23 (Sessões A e B). Achados [INFERIDO] devem ser confirmados antes de virar issue; os demais são acionáveis diretamente com as referências arquivo:linha citadas.*

---

## Status da remediação (incremento 013-audit-remediation, 2026-07-23)

Rastreabilidade achado → resolução. Estados: **CORRIGIDO** (fix + teste) · **TESTE-GUARDA** (código já certo, suíte passa a provar) · **DOC** (passe documental C-15) · **DEFERIDO** (decisão datada) · **ACEITO** (§5 anti-scope-creep, não se mexe) · **PENDENTE** (nomeado, não bloqueia).

### Os 3 Altos
| Achado | Estado | Evidência |
|---|---|---|
| FA-01/FB-01 (parser ".") | **CORRIGIDO** | `3cdfcd6` gramática estrita + limpeza de afixo ancorada; T018b PASS 98% (100× morto através da persistência) |
| F-02 (deep-link tela branca) | **CORRIGIDO** (rotas) + **PENDENTE** (301 hosting) | `6b36dd2` migração p/ query-param; T025 PASS 95%; T024 301 não-provável no Windows (só Linux/deploy) |
| FB-02 (catálogo lapsed ausente) | **CORRIGIDO** | `c48f632` + `bbd7ae1` (nit do delete); T034 PASS-WITH-NITS 90% |

### Médios
| Achado | Issue | Estado | Evidência |
|---|---|---|---|
| E1-02 (override Shopee derruba voucher) | C-14 | **CORRIGIDO** | `6e08214`, decisão do dono: comissão digitada derruba bands, voucher preservado |
| E1-03 (freshest string vs int) | C-12 | **CORRIGIDO** | `a669dc3` parse data+int |
| E1-06 (seed sem validação no boot) | C-12 | **CORRIGIDO** | `a669dc3` `parseFeeCatalog` no module-load |
| E2-02 ("RLS backstop" falso) | C-15 | **DOC** | `17ab172` linha corrigida |
| E2-03 (`_live_links` sem owner_uid) | C-11 | **CORRIGIDO** | `516a113` — na verdade um VAZAMENTO cross-account, provado failing-first |
| E3-01/E3-02 (BomLine sem tetos → 500) | C-06 | **CORRIGIDO** | `1c66e68` tetos em `validation.py`; 422 nunca 500 |
| E4-01 (int em posição de dinheiro) | C-06 | **CORRIGIDO** | `1c66e68` `reject_bad_leaves` parametrizado |
| E4-02 (cap depois da varredura) | C-11 | **CORRIGIDO** | `516a113` ordem depth→size→walk, iterativo |
| E4-05 (from/to naïve) | C-11 | **CORRIGIDO** | `516a113` `AwareDatetime` |
| E5-01 (re-snapshot KIT ausente) | C-11 | **CORRIGIDO** | `516a113` espelha `_resolve_kit_last_known` + 2 comentários enganosos |
| E5-02 (ellipsis nome duplicado) | C-11 | **CORRIGIDO** | `516a113` |
| E5-04 (linha de kit degradada sem teste) | C-10 | **TESTE-GUARDA** | `e5dc02e` |
| F-04 (CORS `["*"]`) | C-13 | **CORRIGIDO** | `6cd7250` métodos/headers restritos ao que o cliente envia |
| FA-02/FA-06 (parseFloat parcial) | C-01 | **CORRIGIDO** | `3cdfcd6` (mesmo fix raiz de FA-01) |
| FA-03 (prefill sem shouldValidate) | C-12 | **CORRIGIDO** | `864c120` |
| FA-04 (SC-105 divergência viva) | C-15 | **DOC** | `17ab172` Clarification datada na spec 005 (D2=A) |
| FA-05 (`wireToPtBr` triplicado) | C-01 | **CORRIGIDO** | `3cdfcd6` export único + teste de premissa |
| FB-03 (rename sem validação de nota) | C-07 | **CORRIGIDO** | `d6d3341` |
| FB-04 ("Manual · Manual" em loading) | C-12 | **CORRIGIDO** | `a669dc3` placeholder "carregando…"; T077b |
| FB-05 (front sem teto de magnitude) | C-07 | **CORRIGIDO** | `d6d3341` `v.tooHigh` |
| T-01 (sem round-trip de migração) | C-09 | **TESTE-GUARDA** | `8a61458` upgrade→downgrade→upgrade |
| T-02 (purge cross-account sem asserção) | C-08 | **TESTE-GUARDA** | `eaacd0a` por chave nomeada + branch uidChanged |
| P-03 (sem guarda de head único) | C-09 | **TESTE-GUARDA** | `c9d7b73` `alembic heads`==1 (CI-only, D4 preservado) |
| Q-03/Q-04 (validadores divergentes 5×) | C-06 | **CORRIGIDO** | `1c66e68` fonte única + comentário "verbatim" falso removido |

### Baixos (amostra — lote completo em C-11/C-12/C-13/C-15)
| Achado | Estado |
|---|---|
| FC-01 (10 ícones mortos) | **CORRIGIDO** `a669dc3` (cada um grep-verificado) |
| FC-02 (3 strings no DS) | **CORRIGIDO** `a669dc3` movidas para i18n |
| FC-03 (autoUpdate silencioso) | **DOC** TD-024 (decisão D5 registrada) |
| F-01 (Constituição "orchestrates") | **DOC** `17ab172` + bump 1.1.1 |
| F-03 (docstring auth.py) | **DOC** `17ab172` (auditoria dizia 14 arquivos, são 11) |
| E1-07 / E2-04 / E2-05 / E4-03 / E4-04 / P-01 / P-04 / M-01 | **DOC** `17ab172` |
| P-02 (`.config/rtk` debris) | **CORRIGIDO** `6cd7250` gitignore (rm bloqueado pelo classifier) |
| T-06 (truncate autouse) | **DOC** TD-023 (consciente-não-feito, gatilho registrado) |
| T-07 (exclusão de coverage larga) | **TESTE-GUARDA** `f82b96c` |
| D4 / D5 / D6 (gates do dono) | **DOC** Clarification 008 / TD-024 / TD-025 |

### Deferido / Aceito
| Achado | Estado |
|---|---|
| E1-01 (ML/Amazon `entries: []`) | **DEFERIDO** → incremento 014 (mapeamento categoria→taxa; gate T063, `us8-fee-proposal.md §9`) |
| E4-06 · E6-09 · Q-06 · F-06 · E4-07 · E6-03 · Q-09 · Q-14 · E2-06 | **ACEITO** (§5 anti-scope-creep — verificados corretos ou decisão datada) |
| Onda 2 (E6-01/02/04/05, billing) | pré-cutover do E6 — entram no épico, não neste incremento |
| Onda 7 (N+1, perf, estrutura) | backlog ordenado (C-16..C-23) — fora do escopo desta remediação |

*Achados de performance (E5-03, E3-03) e os itens de billing permanecem como backlog nomeado; nada foi silenciosamente fechado.*
