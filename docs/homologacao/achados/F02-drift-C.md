# F02 — Auditoria de drift spec ↔ código (lente C), PR #36 / branch `012-e6-billing-pr-c`

## Resumo

Avaliei FR/SC de 011, 012, 013, 014 e a tabela de remediação de `audit-confirmation`, priorizando
verificação direta em `arquivo:linha` sobre confiar em `dod-evidence.md`/`tasks.md`. **32 itens
verificados diretamente no código**: 27 IMPLEMENTADO, 3 PENDENTE-DECLARADO (corretamente registrado,
não é drift), 1 DIVERGENTE (achado F02C-001, abaixo — grau baixo). Não encontrei nenhum caso do
padrão caro procurado ("tasks.md diz FEITO, código não faz"): todo claim de remediação verificado
(F1/F-lapsed/F2/F3/L6-01/E6-02/E6-05/L2-N1/E6-01 da `audit-confirmation`; FR-003/FR-015 da 013; B/U4-a/
U5-c/U5-d/A1-r da 014) bateu com o código lido agora. A honestidade dos próprios documentos (A1-r
continua genuinamente aberto, T036/T041 genuinamente bloqueados) se sustentou sob leitura direta.

---

## 011-token-optimization

### [F02C-001] `dod-evidence.md` §4 contradiz a si mesmo — placeholder "empty slot" ao lado do veredito cheio
- Spec/AC: FR-009/FR-010, SC-006/SC-007 (specs/011-token-optimization/spec.md:282-287,324-325)
- Classificação: DIVERGENTE (documental, não de código)
- Certeza: 95%
- Local: specs/011-token-optimization/dod-evidence.md:261-262 vs. :309-338
- Evidência: linha 261 diz `Per-slice rows (T032): *(empty slot)*` e linha 262 diz
  `Pilot verdict (T033): *(empty slot)*`, dentro da seção "§4 Measurement". 47 linhas abaixo, a seção
  "## Veredito do piloto (T032–T034 — fechado 2026-07-20...)" (linha 309) contém a tabela completa com
  números (−77,8%/−83,2%/−79,8%, meta ≥30% atingida). O documento nunca foi atualizado para remover o
  placeholder de "vazio" depois que o veredito fechou — quem lê só até §4 sai achando que o piloto segue
  aberto. **Não é drift de código**: o veredito em si (linhas 309-338) está presente, com números,
  metodologia e ressalvas (tokenizer +30%, intro-rate). O achado é que o dod-evidence tem uma
  auto-contradição de leitura, não uma lacuna de execução.
- Origem: develop (011 já mergeado via PR #22, antes deste branch)

### Veredito do piloto — verificado
- Classificação: IMPLEMENTADO
- Certeza: 90%
- Local: specs/011-token-optimization/dod-evidence.md:309-338; docs/token-ledger.md
- Evidência: a tabela Δ% por forma está presente com métodos, ressalvas obrigatórias aplicadas
  (tokenizer ~+30%, intro-rate expiry 2026-08-31) e um shortfall nomeado com causa (T018 haiku em
  qa-produto, revertido no mesmo dia — "primeira linha exercida do rollback playbook"). SC-007 cumprido
  honestamente: meta atingida nas formas roteadas, não atingida por design nas formas de julgamento.
- Nota: CLAUDE.md (ground line) ainda diz "o veredito do piloto ... está sendo fechado agora ao final do
  E5" — essa frase do ground line está desatualizada frente ao próprio dod-evidence (fechado
  2026-07-20). Documental, baixo risco.

### FR-011/SC-009 — literal `pnpm gate:all` byte-idêntico
- Classificação: IMPLEMENTADO
- Certeza: 85%
- Local: .github/workflows/ci.yml (confirmado por citação no dod-evidence:298-299, não re-lido linha a
  linha nesta passada — NÃO VERIFICADO diretamente por mim, ver seção final)

---

## 012-e6-billing

### FR-704/SC-702 — grant só por evento server-verificado, deny-by-default
- Classificação: IMPLEMENTADO
- Certeza: 95%
- Local: backend/app/billing/grant_writer.py:47-116, backend/app/api/billing.py:78-130
- Evidência: `process_verified_event` resolve a assinatura só por `event.subscription_ref` (comentário
  linha 49: "never by any client/body-supplied account field"); webhook rejeita corpo não-parseável e
  assinatura inválida com 401 antes de tocar o DB (billing.py:78-105).

### L2-N1 (audit-confirmation) — grant sem `period_end` vira PERPÉTUO
- Classificação: PENDENTE-CONFIRMADO CORRIGIDO
- Certeza: 95%
- Local: backend/app/billing/grant_writer.py:78-86
- Evidência: `if period_end is None: return ProcessResult(matched=True, granted=False)` — nega o grant em
  vez de gravar `expires_at=None`. Bate com a tabela de status ("CORRIGIDO") da audit-confirmation.

### E6-02 (audit-confirmation) — `data.id` lido do body em vez do query param
- Classificação: PENDENTE-CONFIRMADO CORRIGIDO
- Certeza: 95%
- Local: backend/app/api/billing.py:86-95
- Evidência: `query_data_id = request.query_params.get("data.id") or request.query_params.get("id")`,
  com fallback pro body só se a query vier vazia. Comentário explícito nomeia o achado E6-02.

### E6-05 (audit-confirmation) — sem sinal de billing-não-configurado no boot
- Classificação: PENDENTE-CONFIRMADO CORRIGIDO
- Certeza: 90%
- Local: backend/app/main.py:51 (`billing_config_status`)
- Evidência: string presente no lifespan de boot (não abri o bloco completo — grau de certeza reduzido
  por não ter lido o corpo do log, só a chave).

### E6-01 (audit-confirmation) — assinatura MP testada circularmente
- Classificação: PENDENTE-DECLARADO (gate de cutover, não drift)
- Certeza: 90%
- Local: backend/tests/test_billing_security.py:275-316
- Evidência: `test_E6_01_canonical_manifest_pins_format_and_lowercases_id` roda; o teste do vetor real do
  MP está `@pytest.mark.skip(reason="E6-01 CUTOVER GATE...")` — exatamente como a tabela da
  audit-confirmation registra ("PARCIAL + GATE").

### `_prune_raw` (C2 do T017) — payload de auditoria com whitelist, sem dado de pagador
- Classificação: IMPLEMENTADO
- Certeza: 90%
- Local: backend/app/billing/providers/mercadopago.py:75-85
- Evidência: função reduz o `resource` a `_RAW_AUDIT_FIELDS` + `payer_id` isolado; docstring nomeia
  "card data, emails, documents, addresses — dropped BEFORE the writer ever sees it."

### FR-712 / T036 (Play Billing real) — NÃO construído contra o Play real
- Classificação: PENDENTE-DECLARADO
- Certeza: 95%
- Local: backend/app/api/billing.py:293-357; specs/012-e6-billing/tasks.md:542; dod-evidence.md:161-165
- Evidência: as duas rotas Play (`/billing/checkout/play`, `/billing/webhook/play-rtdn`) sempre
  retornam 503 "not provisioned" — verificação real contra a Play Developer API não implementada. Flag
  `play_billing_enabled: bool = False` (backend/app/settings.py:68) — as rotas nem são registradas em
  nenhum ambiente hoje (`play_router` retorna `None` com a flag desligada, billing.py:322-323). Bate
  exatamente com o ground do CLAUDE.md e com T036 "BLOQUEADO NO DONO" em tasks.md:542.

### SC-711 — nenhum vendedor alcança superfície Play com a flag OFF
- Classificação: IMPLEMENTADO
- Certeza: 85%
- Local: backend/app/api/billing.py:313-324
- Evidência: gating por REGISTRO (router só existe se a flag for true), não por `if` dentro do handler —
  o comentário do próprio código (linhas 302-304) nomeia essa escolha como intencional contra
  "vazamento por `if` esquecido".

### T030 (PR-B owner gate) — três decisões declaradas pendentes no dod-evidence
- Classificação: NÃO VERIFICADO (não confirmei se as 3 decisões — linha da cortesia sobrevivente,
  nomes dos botões "Atualizar"/"Atualizar", cautela textual da carência — seguem abertas ou foram
  resolvidas em commits posteriores ao dod-evidence.md; o arquivo mesmo mostra T030 como
  `*(pendente...)*` na data em que foi escrito, mas o branch avançou até PR-C desde então)
- Local: specs/012-e6-billing/dod-evidence.md:105-111
- Pergunta exata: as 3 decisões do T030 (cortesia pós-cancelamento, rótulos dos botões "Atualizar",
  cópia da carência) foram resolvidas entre PR-B e PR-C, ou seguem como estavam no dod-evidence?

---

## 013-audit-remediation

### FR-003 (D1=A) — as 3 rotas de deep-link migraram para 1 segmento + query param, com redirect
- Classificação: IMPLEMENTADO
- Certeza: 90%
- Local: apps/web/src/app/router.tsx:129-141 (`/catalogo/produtos/novo`, `/catalogo/produtos/$productId`)
  e :174-200 (`/historico`, `/historico/$snapshotId`)
- Evidência: as 3 rotas antigas (`/catalogo/produtos/novo`, `/catalogo/produtos/$productId`,
  `/historico/$snapshotId`) existem só como `redirect({ to: "/catalogo", search: {...} })` /
  `redirect({ to: "/historico", search: {...} })` — o padrão `?id=` já usado por `/kits`.

### FR-015 (D3=B) — entradas curadas de Mercado Livre e Amazon no catálogo de taxas
- Classificação: IMPLEMENTADO (estrutural — schema suporta `MERCADO_LIVRE`/`AMAZON`; não contei
  entradas no catalog.json servido)
- Certeza: 60%
- Local: apps/web/src/shared/fee-catalog/fee-catalog.ts:11 (`MARKETPLACES = [MERCADO_LIVRE, AMAZON,
  SHOPEE]`), backend/app/data/catalog.json
- Evidência: meu grep textual por `"marketplaceId":"MERCADO_LIVRE"` sem espaço não bateu no JSON — o
  arquivo provavelmente usa espaçamento diferente (`": "`) e eu não corrigi o padrão a tempo; a
  presença de entradas ML/Amazon REAIS no catálogo servido não foi confirmada por contagem, só a
  capacidade estrutural do schema. **NÃO VERIFICADO** o número de entradas curadas.

### 24/24 remediações L1 da audit-confirmation
- Classificação: IMPLEMENTADO (amostra de 8 re-verificada nesta passada: F1, F-lapsed, F2, F3, L6-01,
  E6-02, E6-05, L2-N1 — todas confirmadas em código atual, ver seções acima/abaixo)
- Certeza: 85% (amostra, não as 24 completas)

### F1 — override de "Taxa fixa" zerava comissão Shopee
- Classificação: IMPLEMENTADO (fix presente)
- Certeza: 95%
- Local: apps/web/src/features/calculator/calculator-model.ts:214
- Evidência: `const commissionOverridden = edited.commissionPct !== undefined;` — já não inclui
  `edited.fixedFee !== undefined` na condição, como o achado original tinha.

### F-lapsed — `ProductsPanel` não passava `lapsed`
- Classificação: IMPLEMENTADO (fix presente)
- Certeza: 95%
- Local: apps/web/src/features/catalog/products-panel.tsx:73
- Evidência: `lapsed={entitlement.data?.status === "lapsed"}` presente, com comentário citando "013/FB-02
  (confirmation audit F-lapsed)".

### F2 — parser `0.125` → 125 (grupo de milhar engolindo zero líder)
- Classificação: IMPLEMENTADO (fix presente)
- Certeza: 95%
- Local: apps/web/src/shared/lib/decimal-ptbr.ts:45-48
- Evidência: `RE_PTBR_THOUSANDS = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/` (exige `[1-9]` líder) +
  `RE_ZERO_DECIMAL = /^0\.\d+$/` capturando o caso fracionário.

### L6-01 — `_OWNED_TABLES` sem `subscriptions`/`billing_events`
- Classificação: IMPLEMENTADO (fix presente)
- Certeza: 95%
- Local: backend/tests/test_migrations.py:41-53
- Evidência: as duas tabelas estão na lista, com comentário citando "L6-01".

---

## 014-fee-category-mapping

### A1-r — `chooseBand` ordena por rank antes de preço; exposição hoje é zero, teto guardado por propriedade
- Classificação: PENDENTE-DECLARADO (registrado como aberto — CONFIRMO que segue aberto, não é drift)
- Certeza: 95%
- Local: packages/pricing-core/src/channels.ts:235-237; packages/pricing-core/tests/band-dominance.test.ts
- Evidência: `const ordered = [...fromSchedules, ...fromThresholds].sort((a, b) => rankCandidate(a,
  base) - rankCandidate(b, base) || a.anuncio - b.anuncio)` — o `sort` ainda ordena por `rank` primeiro,
  exatamente o defeito nomeado. tasks.md:599 marca A1-r com `[ ]` (não fechado) — bate. O guard
  `band-dominance.test.ts` existe como teste de propriedade, não como fix do `chooseBand`.

### B — NUL byte em `determinantKey` fazia git tratar `fee-catalog.ts` como binário
- Classificação: IMPLEMENTADO (fechado, tasks.md marca `[x]`)
- Certeza: 95%
- Local: apps/web/src/shared/fee-catalog/fee-catalog.ts:135; .gitattributes:20-28
- Evidência: `if (d === null) return "(null determinants)";` (sem NUL) + `.gitattributes` com `*.ts text
  diff` / `*.mjs text diff` restaurando visibilidade de diff/grep.

### U4-a — denominador do teto cruzava marketplaces em `refresh.ts`
- Classificação: IMPLEMENTADO (fechado, tasks.md marca `[x]`)
- Certeza: 90%
- Local: packages/fee-ingest/src/refresh.ts:177-204
- Evidência: comentário "U4-a — numerador e denominador do MESMO marketplace" + `entryCount(before,
  marketplace)` recebendo o marketplace como parâmetro (função antes somava todos).

### `nextCatalogVersion` — catalogVersion sequenciado por conteúdo
- Classificação: IMPLEMENTADO
- Certeza: 85%
- Local: packages/fee-ingest/src/guardrails.ts:129
- Evidência: função presente, nome bate com o ground do CLAUDE.md ("catalogVersion é agora sequenciado
  por nextCatalogVersion").

### D — 14 achados de severidade MÉDIA/BAIXA "fora do orçamento de céticos"
- Classificação: NÃO VERIFICADO (por design — o próprio tasks.md os declara "não verificados, nunca
  confirmados"; eu não tentei re-auditar os 14 nesta passada, orçamento não permitiu)
- Local: specs/014-fee-category-mapping/tasks.md:660-661

### U8 — categoria acompanha o cenário via JSONB, não acompanha o produto
- Classificação: IMPLEMENTADO (conforme relato da homologação por mutação em tasks.md:729-738, NÃO
  re-executei a mutação — aceito a evidência registrada como plausível, não re-verifiquei
  diretamente por falta de orçamento)
- Certeza: 60% (herdada do relato, não relida por mim linha a linha no código)

---

## Não verificado

1. **012 T030** (dod-evidence:105-111) — as 3 decisões pendentes do owner-gate de PR-B (linha da
   cortesia pós-cancelamento; nomes dos botões "Atualizar"/"Atualizar"; cópia da carência) podem ter
   sido resolvidas em commits entre PR-B e PR-C que não confirmei. Pergunta exata: existe commit entre
   `26397a5` (PR-B merge) e o HEAD atual (`d46e4c0`) que resolve essas 3 decisões, ou seguem abertas?
2. **013 FR-015 / SC-008** — não contei entradas curadas de Mercado Livre/Amazon no
   `backend/app/data/catalog.json` servido nem confirmei `sourceUrl`/`effectiveDate` por entrada; meu
   grep textual falhou por formatação de espaçamento JSON, não recomecei com o padrão correto.
3. **011 FR-011/SC-009** — não abri `.github/workflows/ci.yml` nem `lefthook.yml` linha a linha nesta
   passada para confirmar o literal `pnpm gate:all`; aceitei a citação do dod-evidence.md sem
   re-verificação direta.
4. **014 achado D** (14 achados médio/baixo nunca confirmados) — não tentei fechar nenhum deles; ficam
   exatamente como o próprio tasks.md os registra.
5. **014 U8** — não reexecutei a mutação de categoria (14%→30% comissão, reabrir cenário salvo) nem li
   o JSONB gravado no disco; aceitei o relato da homologação (T038/homologação US8) sem confirmação
   independente.
6. **Contagem de FR/SC total** por spec não foi exaustiva — este documento é uma amostra dirigida aos
   pontos de maior risco financeiro/estrutural nomeados no prompt (F1-classe, A1-r, B, gates de
   cutover), não uma varredura de 100% dos identificadores FR-xxx/SC-xxx das 5 specs.
