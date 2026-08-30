# PLANO DE CORREÇÃO — 3dprecify (a partir de AUDITORIA.md, 2026-07-23)

**Insumo:** `AUDITORIA.md` (81 achados: 0 Crítico · 3 Altos · 19 Médios · 52 Baixos · 7 informativos).
**Forma:** ondas priorizadas → issues prontas (C-nn), cada uma com achados cobertos, escopo, critério de aceite, esforço (P/M/G) e arquivos-âncora. Nenhuma correção foi aplicada — este é o plano.

---

## 0. Princípios do plano

1. **Corrigir pela raiz, não pelo sintoma.** Os 81 achados colapsam em ~24 issues porque muitos compartilham causa (1 parser, 1 família de validadores, 1 passe documental).
2. **Cada issue = 1 PR revisável** (padrão do repo: slice pequena, owner autoriza o merge). Ondas são prioridade, não acoplamento — issues de uma onda são independentes entre si salvo indicação.
3. **Test-first onde o achado é de teste** (Onda 4): o critério de aceite é "a mutação que hoje passa verde passa a falhar".
4. **Decisões pertencem ao dono** (Princípio VIII): itens marcados 🔑 ficam bloqueados pelo gate correspondente da §1 — cada gate tem recomendação registrada.
5. **Billing anda dentro do E6**: a Onda 2 deve entrar como condição do próprio épico (idealmente PR-B / gate de cutover MP-live), não como branch avulso.
6. **O que a auditoria absolveu não se mexe** (§5 — anti-scope-creep).

---

## 1. Gates de decisão do dono (Onda 0)

| Gate | Pergunta | Opções | Recomendação da auditoria |
|---|---|---|---|
| **D1** 🔑 | F-02: como matar a armadilha `base:'./'`? | (a) mover as 3 rotas para 1 segmento + query param (padrão `/kits`) · (b) trocar `base` para `"/"` (revisita a decisão Capacitor do ADR-0004) | **(a)** — M, sem risco arquitetural; (b) é G e só vale se o Capacitor for descartado. Se (b) for tentado um dia, exige ADR próprio. |
| **D2** 🔑 | FA-04: SC-105 (lista de canais visível com toggle OFF) — implementar a letra da spec ou oficializar a divergência? | (a) Clarification datada na spec 005 · (b) implementar lista-visível-rotulada | **(a)** — a divergência já foi "owner-clarified" no dod-evidence em 2026-07-08; falta só o registro na spec viva. (b) reabre design de UI sem demanda de usuário. |
| **D3** 🔑 | E1-01: catálogo ML/Amazon vazio — curar agora ou deferir formalmente? | (a) Clarification datada de deferimento + task de produto para curadoria · (b) curar as entradas já (exige fontes com sourceUrl/effectiveDate) | **(a)** agora + (b) como task de produto sem bloqueio técnico. |
| **D4** 🔑 | E3-04: kit com 0 linhas — servidor rejeita ou permissividade é intencional? | (a) `min_length=1` no `BomIn` · (b) documentar permissividade | **(a)** — espelha o que a UI já promete; 1 linha + 1 teste. |
| **D5** 🔑 | FC-03: PWA autoUpdate silencioso — registrar ou trocar por prompt? | (a) registrar a decisão "silent" em nota de spec/ADR · (b) `registerType:"prompt"` + toast | **(a)** — comportamento atual é válido; (b) só se houver relato real de chunk quebrado pós-deploy. |
| **D6** | T-04: outbox em duas abas — suportar ou declarar single-tab? | (a) declarar single-tab como premissa documentada · (b) `navigator.locks` + teste | **(a)** por ora — (b) entra no backlog se telemetria mostrar uso multi-aba. |

---

## 2. Ondas e issues

### ONDA 1 — Os 3 Altos (destravar imediatamente; D1 bloqueia só a C-02)

**C-01 · Parser numérico pt-BR estrito (mata a família inteira de bugs de dinheiro silenciosos)**
- Cobre: **FA-01/FB-01 (Alto)**, FA-02, FA-06, Q-02, FA-05 (consolidação), Q-01 (opcional no mesmo PR)
- Escopo: reescrever `parseDecimal` em `shared/lib/decimal-ptbr.ts` para validar o formato ANTES de converter — aceitar apenas: dígitos puros; pt-BR estrito (`\d{1,3}(\.\d{3})*(,\d+)?` ou `\d+(,\d+)?`); e o caso não-ambíguo de decimal com ponto (um único `.` seguido de 1–2 dígitos, sem `,`) convertido corretamente. Qualquer resíduo/ambiguidade → `null` → erro de campo existente ("valor inválido — use vírgula"). Extrair `wireToPtBr` triplicado para o mesmo módulo com teste que trava a premissa "wire tem no máximo um ponto". Opcional no mesmo PR: `breakdown-row`/`price-hero` passam a usar `formatDecimal`.
- Aceite: testes adversariais nas DUAS superfícies (calculator-schema e catalog-schema) cobrindo `"0.12"`, `"1500.00"`, `"1.500,00"`, `"1,234,56"`, `"10-5"`, `"5x3"`, `"R$ 1,50"` — nenhum produz valor errado silencioso; `gate:all` verde.
- Esforço: **M** · Âncoras: `decimal-ptbr.ts:6-10`, `calculator-schema.ts:105-106`, `catalog-schema.ts:36-38`, `catalog-prefill.ts:13`, `product-mapping.ts:18`, `scenario-bridge.ts:49`

**C-02 🔑D1 · Deep-links de 2+ segmentos (tela branca em produção)**
- Cobre: **F-02 (Alto)**
- Escopo (assumindo D1=a): `/historico/$snapshotId` → `/historico?snapshot=<id>`; `/catalogo/produtos/$productId` → `/catalogo?produto=<id>`; `/catalogo/produtos/novo` → `/catalogo?produto=novo` (ou `&novo=1`); manter as rotas antigas como redirect client-side durante 1 release; atualizar todos os `navigate`/`Link` internos.
- Aceite: e2e novo que faz `page.goto()` DIRETO nas URLs novas (a classe de teste que hoje é deliberadamente evitada) e as vê renderizar; grep confirma zero rotas de 2+ segmentos restantes no router; MEMORY/token-ledger da armadilha permanecem válidos.
- Esforço: **M** · Âncoras: `router.tsx:116,128,173`, `vite.config.ts:10`, `firebase.json:5`

**C-03 · Variante lapsed do catálogo (UX especificada ausente)**
- Cobre: **FB-02 (Alto)**
- Escopo: banner "Premium pausado" + forms de filament/printer/product em modo somente-leitura + linha de reativação no rodapé, para `status === "lapsed"` — copiando o padrão já ligado em `scenarios-list-sheet.tsx:313-314` e `bom-page.tsx:412-413`; reaproveitar as strings órfãs `messages.pt-br.ts:316-319` e adicionar a cópia de reativação de `ux-catalog.md:550-552`.
- Aceite: teste de componente por superfície (form desabilitado + banner presente quando lapsed; ausente quando active); o fluxo "preenche tudo e só descobre no salvar" fica impossível; lapsed segue lendo tudo (FR-409 intacto).
- Esforço: **M** · Âncoras: `features/catalog/*`, `produto-page.tsx`, `catalogo-page.tsx:101`, `filament-form.tsx:12`

### ONDA 2 — Billing pré-cutover (entra no épico E6; gate para MP-live)

**C-04 · Vetor known-good do Mercado Pago + canonicalização do `data.id`**
- Cobre: **E6-01, E6-02**, T-05, E6-08 (opcional)
- Escopo: (1) capturar do simulador/doc oficial do MP um par real (corpo + headers `x-signature`/`x-request-id`) e fixá-lo como teste de `verify_signature` SEM reusar `canonical_manifest`; (2) na mesma captura, resolver empiricamente corpo-vs-query-param do `data.id` e ajustar `api/billing.py:78-88` se necessário; (3) trocar o teste-grep do SEC-107 por verificação AST de `compare_digest` na função de verify; (4) opcional: parse `k=v` tolerante a ordem no header.
- Aceite: o teste do vetor passa contra a implementação; mutação "trocar compare_digest por ==" falha; decisão corpo/query documentada no ADR-0023.
- Esforço: **P** (+P por opcional) · Âncoras: `signature.py:27-59`, `api/billing.py:78-88`, `test_billing_security.py:238-245`, `mp_stub/stub.py:139-149`

**C-05 · Honestidade operacional do billing**
- Cobre: **E6-04, E6-05**, E6-07 (carona)
- Escopo: (1) runbook de provisionamento do plano MP com passo explícito de sincronização copy↔amount + smoke test de deploy que lê o `amount` do plano e compara com `billing-plans.ts`; (2) log de startup "billing MP: unconfigured" quando segredos ausentes em uat/prod; (3) copy neutra no estado exhausted quando o usuário já é premium por outra fonte.
- Aceite: smoke test falha se copy≠amount; log visível no boot sem segredo; teste de componente da copy cortesia.
- Esforço: **M** · Âncoras: `billing-plans.ts:16-31`, `settings.py:47-49`, `checkout-return.tsx:30-32`
- Rastreio (sem ação nova): **E6-06** (grace na EntitlementView) já é escopo declarado do PR-B — este plano só o registra como pré-requisito de SEC-602; **T-03** (amarrar e2e ao preapproval) entra como melhoria do e2e do E6 se sobrar folga.

### ONDA 3 — Validação compartilhada (a correção estrutural do risco sistêmico nº 2)

**C-06 · `backend/app/validation.py` + paridade de tetos**
- Cobre: **Q-03, Q-04, E3-01, E3-02**, E4-01, e prepara FB-05
- Escopo: módulo único com `finite_non_negative(value, field, ceiling)` + tabela canônica `_CEIL_*` + `reject_bad_leaves(node, *, ceiling)` parametrizado; migrar os 5 routers; `BomLineIn` ganha os tetos de `products` (fecha o 500 do E3-01) e `quantity` ganha teto int4 (E3-02); `_reject_bad_leaves` passa a rejeitar int em posição de dinheiro (E4-01); corrigir o comentário "verbatim" falso.
- Aceite: teste espelho por router (over-ceiling → 422, nunca 500) incluindo `tariffPerKwh` e `quantity` em boms; grep de CI opcional proibindo `_finite_non_negative` local fora do módulo.
- Esforço: **M** · Âncoras: `products.py:45-68`, `boms.py:91-106`, `history.py:83-129`, `scenarios.py:80-116`, `filaments.py:41-46`, `printers.py:36-42`

**C-07 · Espelho de validação no front**
- Cobre: **FB-05, FB-03**
- Escopo: tetos de magnitude no `numField` do `catalog-schema.ts` ("valor muito alto" inline); validação de nota ≤500 no rename de cenário (copiar do save-sheet, mesma string `t.noteTooLong`).
- Aceite: teste de componente para ambos; acima do teto nunca chega ao 422 genérico.
- Esforço: **P** · Âncoras: `catalog-schema.ts`, `scenarios-list-sheet.tsx:198-235,391-403`

### ONDA 4 — Testes-guarda (o código está certo; a suíte passa a prová-lo)

**C-08 · Assertar o purge de privacidade cross-account**
- Cobre: **T-02**
- Escopo: estender `providers.test.tsx` — popular os 5 caches idb + 6 query-roots, afirmar CADA purge/removeQueries na transição para anonymous, e caso novo u1→u2 direto (branch `uidChanged`).
- Aceite: as duas mutações citadas na auditoria (deletar `providers.tsx:49-52`; inverter `:29`) fazem a suíte falhar.
- Esforço: **M** · Âncora: `providers.test.tsx:34-55`

**C-09 · Guards da camada de migração**
- Cobre: **T-01, P-03**
- Escopo: teste `requires_db` de round-trip `upgrade head → downgrade base → upgrade head` (+ `to_regclass` nulo pós-downgrade para as tabelas E6); passo `alembic heads` (== 1 linha) no job migration-guard ou `gate:be`.
- Aceite: inverter a ordem de dois `op.drop_*` no 0005 falha o teste; segundo head simulado falha o gate.
- Esforço: **P** · Âncoras: `conftest.py:89`, `check-migrations.sh:27`, `ci.yml`

**C-10 · Lacunas de teste pontuais**
- Cobre: **E5-04**, T-07, T-06 (opcional)
- Escopo: teste de kit 2+ linhas com 1 produto deletado via `GET /scenarios/{id}` (exercita `_price_input_dict_from_bom_line`); trocar a exclusão de coverage `shared/api/**` por `shared/api/generated.ts`; opcional: truncate autouse para módulos DB não-billing.
- Aceite: coverage passa a contar transport/error-messages; o teste novo falha se o mapeamento de campos da linha degradada quebrar.
- Esforço: **P** (+M no opcional) · Âncoras: `scenarios.py:308-336`, `vitest.config.ts:20`, `conftest.py:74-96`

### ONDA 5 — Correções pontuais de código (lote de Ps; 2–3 PRs temáticos)

**C-11 · Backend pequenos** — cobre **E5-01** (re-snapshot KIT no `_resnapshot_cost_basis` + corrigir os 2 comentários enganosos), **E5-02** (ellipsis F5 no nome da duplicata + teste com nome longo), E2-03 (`owner_uid` no `_live_links`), E4-02 (size-cap antes da varredura + limite de profundidade), E4-05 (exigir tz-aware em from/to), 🔑D4 E3-04 (`min_length=1`). Esforço: **M** (lote).

**C-12 · Front pequenos** — cobre FA-03 (`shouldValidate:true` nos 4 setValue de prefill), FB-04 (placeholder neutro sob isLoading no products-panel), E1-03 (comparação data+int no `freshest()`), E1-05 (comparação de regime em Decimal), E1-06 (seed pelo `parseFeeCatalog` no boot), FC-01 (remover 10 ícones mortos), FC-02 (3 strings do DS para messages). Esforço: **M** (lote).

**C-13 · Endurecimento CORS + higiene** — cobre **F-04** (restringir `allow_methods`/`allow_headers` ao usado: GET/POST/PUT/PATCH/DELETE + Authorization/Content-Type/Accept, com nota registrada em ADR-0002 ou tech-debt) e P-02 (apagar/ignorar `.config/rtk/filters.toml`). Aceite: e2e/preview continuam funcionando com os headers restritos. Esforço: **P**.

**C-14 · Honestidade do override Shopee**
- Cobre: **E1-02**
- Escopo: sob override parcial de slot coberto, preservar `priceBands`/`freightVoucherBands` do entry (sobrescrever apenas os escalares digitados); avaliar com o dono se o voucher vira campo editável (decisão de UX menor). Teste do seam (a lacuna nomeada na auditoria).
- Aceite: editar 1 campo num slot Shopee coberto mantém voucher/bands no cálculo; selo continua "ajustado por você".
- Esforço: **M** · Âncora: `calculator-model.ts:170-179`

### ONDA 6 — Reconciliação documental (1 PR só de docs — o passe de verdade)

**C-15 · O passe único de verdade documental**
- Cobre: **E2-02** (dod-evidence 007: remover "RLS backstop"), 🔑D2 **FA-04** (Clarification datada na spec 005 para SC-105/FR-113), F-01 (Constituição "orchestrates"→"advises" + bump PATCH), F-03 (docstring `auth.py`), E1-07 (nota SC-109→3.1.0), E4-03/E4-04 (data-model 009: server_default + nome do UNIQUE), **M-01** (ground do CLAUDE.md — natural no close-out do E6), P-01 (dod-evidence 011: frequência do banner rtk), P-04 (decisions-backlog §9), E2-04 (comentário /catalogo), 🔑D3 E1-01 (Clarification de deferimento ML/Amazon), 🔑D5 FC-03 (registro da decisão autoUpdate), D6 (registro single-tab), E2-05 (nota ADR-0012 sobre o lookup real).
- Aceite: cada claim corrigida é verificável por grep; nenhuma mudança de comportamento neste PR.
- Esforço: **M** (volume, não complexidade)

### ONDA 7 — Performance e estrutura (medir antes onde indicado; backlog ordenado)

**C-16 · N+1 de cenários** — cobre **E5-03**: batch por página (padrão `_live_links`/`_bom_resolve_views`) ou `asyncio.gather` como paliativo; aceite = teste de contagem de queries por página. Esforço: **M**. *Prioridade sobe se UAT mostrar lentidão na listagem.*
**C-17 · N+1 de escrita em kits** — cobre E3-03: pré-busca IN(...) no `_materialize`. Esforço: **M**.
**C-18 · Factory de caches uid-keyed** — cobre Q-05 (+ previne o próximo cache fora do purge): `makeUidCache<T>(namespace, guard)`. Esforço: **M**.
**C-19 · `owned_or_404` genérico** — cobre Q-07 (owner-scoping único). Esforço: **M**.
**C-20 · Split de `models/__init__.py` por domínio** — cobre Q-08. Esforço: **M**, prioridade baixa (mecânico, alto churn de imports — fazer em janela calma).
**C-21 · Verificações de performance sem mudança** — cobre Q-10 (profiling do compute por keystroke; só então `useDeferredValue`), Q-11 (`vite build --report` p/ tree-shaking do Orval), Q-13 (`pnpm audit` + `uv pip audit`), Q-12 (floors nos deps backend). Esforço: **P**.
**C-22 · Billing pós-deploy** — cobre E6-03 (cancelar preapproval órfã no catch — revisit T016b), E6-10 (paginação do reconcile), T-03/T-04 se D6=b. Gatilho: provisionamento v1. Esforço: **M**.
**C-23 · Sessão 401 centralizada** — cobre F-05: decidir (documentar o ad hoc OU mover detecção 401→re-auth para transport/hook). Esforço: **P/M**.

---

## 3. Mapa achado → issue (Altos e Médios; conferência de completude)

| Achado | Sev | Issue |
|---|---|---|
| FA-01/FB-01 | Alto | C-01 |
| F-02 | Alto | C-02 (🔑D1) |
| FB-02 | Alto | C-03 |
| E1-01 | Médio | C-15 (🔑D3) + task de produto |
| E1-02 | Médio | C-14 |
| E2-02 | Médio | C-15 |
| E3-01 | Médio | C-06 |
| E5-01 | Médio | C-11 |
| E5-03 | Médio | C-16 |
| E6-01 / E6-02 | Médio | C-04 |
| E6-04 | Médio | C-05 |
| F-04 | Médio | C-13 |
| FA-02 | Médio | C-01 |
| FA-03 | Médio | C-12 |
| FA-04 | Médio | C-15 (🔑D2) |
| FB-03 | Médio | C-07 |
| T-01 | Médio | C-09 |
| T-02 | Médio | C-08 |
| Q-03 / Q-04 | Médio | C-06 |
| P-03 | Médio | C-09 |

(Todos os 52 Baixos estão distribuídos em C-05, C-07, C-10, C-11, C-12, C-13, C-15, C-17..C-23 — nenhum ficou sem lar; os que dependem de gate estão marcados.)

---

## 4. Sequenciamento

1. **Agora (paralelo ao E6 em andamento):** Onda 0 (respostas do dono) + C-01 e C-03 (não tocam billing nem rotas — branch de `develop`). C-02 entra assim que D1 fechar.
2. **Dentro do E6:** C-04 e C-05 entram como condições do PR-B / gate de cutover MP-live (o seguranca-round §8.1 já exigia o vetor — C-04 é literalmente fechar uma condição do gate existente).
3. **Depois dos Altos:** Ondas 3–4 (podem correr em paralelo — backend/testes não colidem), depois Onda 5 em 2–3 lotes.
4. **Onda 6 (docs)** pode entrar a qualquer momento após a Onda 0 — recomendado cedo, porque restaura a confiança nos documentos que os próprios PRs de correção vão citar.
5. **Onda 7** é backlog ordenado; C-16 sobe se UAT acusar; C-22 espera o provisionamento v1.

**Estimativa total (excl. Onda 7):** ~13 PRs — 3 M (Altos) + 2 P/M (billing) + 2 M/P (validação) + 3 P/M (testes) + 3 lotes M/P (pontuais) + 1 M (docs). Com o ritmo histórico do repo (slices de 1–2 dias), **~2 a 3 semanas de calendário** sem paralisar o E6.

---

## 5. O que NÃO corrigir (decisões aceitas — anti-scope-creep)

- **E4-06** (revogação não purga outbox), **E6-09** (fallback do stub), **Q-06** (purge completo), **F-06** (retry via React Query) — verificados corretos.
- **E4-07** (CSV formula-injection) — decisão aceita com 4 gatilhos; vigiar quando D1–D4 (ingestão ML) popular labels.
- **E6-03** — aceito no ADR-0023:244; só C-22 opcional pós-deploy.
- **Q-09** (resolvers D3/D6), **Q-14** (exports pricing-core) — observações; agir só com gatilho (4º domínio / limpeza de barrel).
- **E2-06** (imutabilidade do ledger no banco) — nunca prometido; vira item de decisions-backlog se o dono quiser paridade com E4.
- Informativos restantes — sem ação.

---

*Plano gerado em 2026-07-23 a partir de AUDITORIA.md. Antes de abrir as issues: fechar os 6 gates da §1 (5 minutos de decisão do dono destravam ~80% do plano).*
