# F02B — Drift spec↔código: 006, 007, 008, 009, 010

Auditado contra o código em `012-e6-billing-pr-c` (HEAD `d46e4c0`), PR #36. Ferramenta: leitura de
spec.md/tasks.md/dod-evidence.md/homologation-*.md/ADRs + grep/read direto do código; 4 subagentes
Explore (read-only, sem Edit/Write) cobriram 007/008/009/010 em paralelo; 006 foi verificado
diretamente por mim. Toda contagem cita o comando que a produziu.

## Resumo
~130 FR/SC avaliados nas 5 specs. Maioria **IMPLEMENTADO**. Nenhum FR-core AUSENTE sem decisão
registrada. **O achado mais grave e recorrente é estrutural, não pontual**: três specs (007 FR-312/
SC-306, 008 FR-410/SC-408) documentavam "nenhum preço/CTA de compra antes do E6" como garantia de
honestidade — o E6 (012-e6-billing) chegou e isso **mudou de fato** (teasers agora mostram preço real +
botão "Assinar"), a mudança está registrada e testada, **mas só na spec 012**, nunca por emenda nas specs
007/008 originais. É DIVERGENTE-POR-DECISÃO na prática, DIVERGENTE-POR-DOCUMENTAÇÃO-NÃO-ATUALIZADA na
forma. 006 confere integralmente com o código de hoje, incluindo o FR-010/deploy conscientemente aberto
(release cut em `main` confirmado, commit `0b12426`) e o gate:all idêntico em `lefthook.yml:20` e
`ci.yml:32`. 009 confirma o gatilho PL/pgSQL (ADR-0019) e o guard de geometria do PDF, ambos vivos e
corretos. 010 confirma que o deferral de criação de cenário KIT-basis continua genuinamente verdadeiro
(zero chamadores de `serializeKitBasis` em produção) e acha um achado de rastreabilidade: o dod-evidence
de 010 nunca foi atualizado após a spec 013 corrigir o re-snapshot de `lastKnown` para base KIT. Nenhuma
contagem suspeita do tipo "325 linhas com NUL" apareceu — todas as contagens citam comando.

---

## specs/006-uat-deploy-hardening

Sem drift na maior parte. FR-201–214/SC-201–207 verificados diretamente (não delegado).

| FR/SC | Classificação | Local |
|---|---|---|
| FR-207 (guard inerte por padrão) | IMPLEMENTADO | `.github/workflows/deploy.yml:26-31` (`DEPLOY_ENABLED` check antes de qualquer deploy) |
| FR-209 (release merge develop→main) | IMPLEMENTADO | `git log main`: `0b12426 release: first cut - E1 complete + 006 hardening (develop -> main, FR-209)` |
| FR-210 (sem schema fantasma) | IMPLEMENTADO | `grep -c HTTPValidationError contracts/openapi.json` → **0** |
| FR-211 (conformance em CI) | IMPLEMENTADO | `backend/tests/test_conformance.py:1-57` (Schemathesis sobre ASGI, `schema.parametrize()`, roda dentro de `pytest`) |
| FR-212 (comando único, mesma string local/CI) | IMPLEMENTADO | `package.json:22` `"gate:all": "pnpm gate:fe && pnpm gate:be"`; `lefthook.yml:20` `run: pnpm gate:all`; `.github/workflows/ci.yml:32` `- run: pnpm gate:all` — string idêntica nos três lugares |
| FR-213 (ground state reconciliado + branch órfã podada) | IMPLEMENTADO | `git ls-remote --heads origin \| grep deploy-env-wiring` → 0 linhas (branch ausente do remoto); CLAUDE.md mantém histórico datado e consistente até 014 |
| FR-214 (aviso de privacidade) | IMPLEMENTADO | `apps/web/src/pages/privacidade/privacidade.test.tsx:18-32`, rota ligada em `router.tsx` e `sign-in-screen.tsx` |
| FR-208 (config documentada) | IMPLEMENTADO | `docs/environments.md` (2.5K) existe |
| FR-206 (runbook + rollback) | PARCIAL/DIVERGENTE-POR-DECISÃO — ver achado B-001 abaixo |

### [F02B-001] FR-206 — rollback documentado mas nunca exercitado contra UAT
- Spec/AC: FR-206 (`specs/006-uat-deploy-hardening/spec.md:168-169`) — "A documented rollback procedure
  MUST exist and MUST have been exercised at least once against UAT before this feature is considered done."
- Classificação: DIVERGENTE-POR-DECISÃO
- Certeza: 95%
- Local: `docs/runbooks/uat-deploy.md:81-86` (procedimento documentado, nunca executado)
- Evidência: o texto do FR usa "MUST have been exercised" (passado, condição de conclusão), mas
  `dod-evidence.md:6-10,42-44` registra explicitamente que a rehearsal (T025-T028) foi DEFERIDA para o
  marco v1-launch por decisão do dono 2026-07-09 (spec.md:249-266, Clarifications sessão 2026-07-09). A
  spec e o dod-evidence concordam entre si — a divergência é só contra a letra literal do FR-206 original,
  que a Clarification posterior re-escopa sem reescrever o FR.
- Origem: develop (decisão pré-existente ao PR #36, não nova)

### Não confere achado adicional em 006
FR-201..205 (mecanismo de deploy pronto, execução deferida), SC-201..204 (deferidas) — todas
DIVERGENTE-POR-DECISÃO já auto-registradas em `dod-evidence.md:21-27`, conferido: consistentes com o
código hoje (nenhuma execução real de deploy encontrada — nenhum log/evidência de UAT rodando). Sem
achado novo além do já documentado.

---

## specs/007-e2-catalog-entitlement

52 FR/SC avaliados (Explore agent, background).

| FR/SC | Classificação | Local (resumo) |
|---|---|---|
| FR-301/302 (gate write/read + erro padrão) | IMPLEMENTADO | `backend/app/entitlement/__init__.py:81-104` |
| FR-304–309, FR-313 | IMPLEMENTADO | ver detalhe abaixo |
| FR-310/311 | IMPLEMENTADO | `backend/app/models/__init__.py:199-206`; `entitlement/__init__.py:94-104` |
| SC-301/302/305/307/309 | IMPLEMENTADO | sem drift |

### [F02B-002] FR-303 — "sem self-service até E6" não é mais toda a verdade
- Spec/AC: FR-303 (`specs/007-e2-catalog-entitlement/spec.md`) — grant só via CLI operador, "no
  self-service until E6".
- Classificação: DIVERGENTE-POR-DECISÃO
- Certeza: 90%
- Local: `backend/app/billing/grant_writer.py:39-116` (grants automáticos com `source="payment"` a partir
  de webhooks/reconciliação do Mercado Pago verificados, zero envolvimento do operador)
- Evidência: `specs/012-e6-billing/spec.md:120-123` documenta esse caminho; `backend/app/scripts/
  grant_premium.py:1-13` continua o único caminho *manual*. A CLI operador não foi removida (ainda é
  IMPLEMENTADO como mecanismo), mas a frase "no self-service until E6" da 007 ficou obsoleta porque o E6
  chegou — e a 007 nunca foi emendada para dizer isso.
- Origem: PR #36 (012-e6-billing, o mecanismo automático) sobre uma premissa da 007 (develop)

### [F02B-003] FR-312/SC-306 — o teaser agora mostra preço real, a spec 007 diz "sem preço"
- Spec/AC: FR-312/SC-306 (`specs/007-e2-catalog-entitlement/spec.md`) — "honest teasers... no price and no
  date... never a fake save."
- Classificação: DIVERGENTE (documentado no código, não na spec 007)
- Certeza: 95%
- Local: `apps/web/src/shared/billing/price-line.ts:24-26` (`teaserPriceLine()` → "Premium: R$ 15,99/mês");
  `apps/web/src/features/catalog/premium-teaser.tsx:19-21,47`
- Evidência: o próprio código documenta a mudança — comentário em `premium-teaser.tsx:19-21`: "T038 — ESTE
  COMENTARIO CADUCOU na US7 e foi corrigido: ele dizia 'sem preco, sem CTA de compra (billing e E6)' ACIMA
  de um preco e de um botao de compra." A decisão formal vive em `specs/012-e6-billing/spec.md:218-234`
  (US7), não em nenhuma emenda de 007/spec.md ou 007/dod-evidence.md.
- Origem: PR #36 (012-e6-billing) — a spec 007 nunca foi tocada

### [F02B-004] Contagens do dod-evidence de 007 são um retrato de 2026-07-10, não uma contagem viva
- Classificação: NÃO É DRIFT DE COMPORTAMENTO (nota de higiene documental)
- Certeza: alta (contagem medida agora)
- Evidência: `grep -rc "^def test_\|^async def test_" backend/tests/*.py` somado = **276** funções de
  teste hoje, vs. "89 pytest" no dod-evidence de 007; `apps/web/src` Grep `^\s*(it|test)\(` com glob
  `*.test.*` = **887** ocorrências hoje, vs. "295 web tests" no dod-evidence. Esperado (specs posteriores
  adicionaram testes) — não é um achado de drift em si, mas confirma que os números do dod-evidence não
  devem ser lidos como verdade atual.

### Código sem requisito (007)
- `backend/app/models/__init__.py:99,114-117` — `EntitlementGrant.source` ganhou um terceiro valor
  (`'payment'`) e a coluna `subscription_id` (FK), adicionados pelo E6/ADR-0023. A tabela é descrita em
  007 (Key Entities) como "grantor, source beta/comp" — o enum já é mais largo que o texto da 007.

### Não verificado (007)
1. SC-303/SC-304/SC-307 (round-trip byte-idêntico) — não executado nesta auditoria. Pergunta: `uv run
   pytest backend/tests/test_filaments.py backend/tests/test_printers.py backend/tests/test_products.py`
   na branch atual ainda passa 100%?
2. SC-310 (suíte de guarda E1 inalterada) — confirmado estaticamente que `/calcular` não tem
   `beforeLoad` de auth; não rodado `pnpm e2e` completo. Pergunta: a suíte e2e completa ainda passa sem
   regressão nas specs E1?

---

## specs/008-e3-multi-piece-bom

16 FR + 12 SC avaliados (Explore agent, background). Testes executados pelo agente: `pytest
backend/tests/test_boms.py` → 43 passed; `vitest packages/pricing-core/tests/computeBom.test.ts` → 26
passed; 5 arquivos de teste frontend de bom/kit → 46 passed; `lint-imports` → 5/5; `openapi.json`
regenerado e comparado byte a byte com o commitado → idêntico.

| FR/SC | Classificação | Local (resumo) |
|---|---|---|
| FR-401–405, 407–409, 411–416 | IMPLEMENTADO | testes citados acima, todos verdes hoje |
| SC-401–407, 411–412 | IMPLEMENTADO | idem |

### [F02B-005] FR-410/SC-408 — mesmo padrão da 007: "sem CTA de compra pré-E6" caducou
- Spec/AC: FR-410/SC-408 (`specs/008-e3-multi-piece-bom/spec.md`) — "no purchase CTA before E6".
- Classificação: DIVERGENTE-POR-DECISÃO
- Certeza: 95%
- Local: `apps/web/src/shared/billing/teaser-upgrade.tsx:9-19,64-74`; `apps/web/src/features/bom/
  bom-teaser.tsx:26`
- Evidência: preço real + CTA "Assinar" renderizados hoje. Decisão registrada em `specs/012-e6-billing/
  spec.md:218-232,326-327` (FR-710/US7) e no comentário do próprio código (`teaser-upgrade.tsx:9-19`).
  Garantia residual (só os 3 preços reais decididos aparecem, nunca fabricado) confirmada por
  `apps/web/tests/e2e/bom.spec.ts:184-190`.
- Origem: PR #36 (012-e6-billing) sobre premissa da 008 (develop), 008 nunca emendada

### [F02B-006] Clarification D4 da própria 008 está desatualizada (422 de BOM vazio já implementado)
- Spec/AC: texto de clarificação D4 (`specs/008-e3-multi-piece-bom/spec.md:74-84`) — diz que o 422 para
  kit sem linhas "is tracked as separate implementation work... currently accepted [as absent]".
- Classificação: DIVERGENTE (spec desatualizada, código correto)
- Certeza: 95%
- Local: `backend/app/api/boms.py:180` (`lines: list[BomLineIn] = Field(min_length=1)`);
  `backend/tests/test_boms.py:363-370` (`test_a_kit_with_no_lines_is_422`, passa); `contracts/
  openapi.json` `BomIn.lines.minItems == 1` confirmado por regeneração byte-idêntica.
- Evidência: o comportamento que a spec descrevia como pendente já está implementado e testado — a nota
  D4 nunca foi riscada/atualizada.
- Origem: develop (não é do PR #36)

### [F02B-007] SC-410 — cobertura de overflow do nav de 5 abas não inclui `/kits` especificamente
- Spec/AC: SC-410 (`specs/008-e3-multi-piece-bom/spec.md`) — nav de 5 abas sem overflow em 390px.
- Classificação: PARCIAL
- Certeza: 75%
- Local: `apps/web/tests/e2e/a11y-overflow.spec.ts:99-107` testa apenas `/catalogo`, `/historico`, `/conta`
  — `/kits` ausente da lista de rotas testadas (grep por `/kits` no arquivo = 0 ocorrências). A única
  checagem de overflow em `/kits` é `bom.spec.ts:129-173`, que testa colisão de barra de total fixa vs
  nav (fix de época 014), não overflow geral do nav de 5 abas.
- Evidência: a garantia genérica se sustenta (as 5 abas sempre renderizam juntas), mas não há um teste de
  overflow dedicado a `/kits` como o SC implica.
- Origem: develop

### Código sem requisito (008)
- `apps/web/src/pages/bom/bom-page.tsx:6,13,556-574` — botão de congelar cenário de kit em snapshot
  (feature 009/E4), corretamente fora do escopo de 008 mas hoje inseparável da UI de BOM.

### Não verificado (008)
1. SC-409/FR-411 ("todas as garantias E1/E2 inalteradas") — spot-check apenas; suíte e2e completa E1/E2
   não executada nesta auditoria. Pergunta: `pnpm e2e` completo passa 100% sem regressão?

---

## specs/009-e4-history-snapshots-export

29 FR + 15 SC avaliados (Explore agent, background). Foco especial cumprido: gatilho PL/pgSQL e guard de
geometria do PDF, ambos confirmados vivos.

| FR/SC | Classificação | Local (resumo) |
|---|---|---|
| FR-501–506, 508–512, 514–529 | IMPLEMENTADO | ver ADR-specific abaixo para os itens críticos |
| SC-501–511, 513–515 | IMPLEMENTADO | idem |
| FR-513 (CSV formula-injection aceito) | DIVERGENTE-POR-DECISÃO (confirmado, não é drift) | `backend/app/services/quote_render.py:345-370` sem prefixo `'`, decisão em ADR-0020 §Consequences |

### [F02B-008] ADR-0019 — trigger PL/pgSQL de imutabilidade, confirmado vivo e correto
- Spec/AC: FR-504/SC-504 (`specs/009-e4-history-snapshots-export/spec.md`)
- Classificação: IMPLEMENTADO — sem drift
- Certeza: 95%
- Local: `backend/alembic/versions/0003_e4_snapshots.py:45-70` (função `snapshots_forbid_content_update()`)
  + `:192-207` (`BEFORE UPDATE ON snapshots ... ENABLE ALWAYS TRIGGER`)
- Evidência: o corpo do trigger compara 13 colunas nomeadas via `IS DISTINCT FROM` e faz `RAISE EXCEPTION`
  para qualquer mudança fora de `label`/`deleted_at`/`updated_at`; anexado à tabela correta (`snapshots`,
  única tabela do tipo). Reforçado por guard de ORM (`backend/app/models/__init__.py:867-893`,
  `SNAPSHOT_MUTABLE_COLUMNS`) e ausência de rota `PUT` em `history.py`/`export.py` (grep confirmado vazio).
  Três camadas, todas presentes hoje.
- Origem: develop

### [F02B-009] Guard de geometria do PDF (regressão do close-out PR #21) — confirmado ainda presente
- Spec/AC: lição registrada em CLAUDE.md ("nome de item longo invadia as colunas de preço").
- Classificação: IMPLEMENTADO — sem drift
- Certeza: 95%
- Local: `backend/tests/test_export.py:801-880+` `class TestQuoteLayout`, `_assert_no_overprint` faz
  asserção geométrica (`x_end <= anchor_x`), não textual, cobrindo nome de item longo e rótulo "Outros
  custos" longo, mais teste de não-truncamento.
- Evidência: `backend/app/services/quote_render.py` renderiza nomes via `Paragraph(_xml(...))` com
  `VALIGN TOP` (linhas 288-296, 310) — corresponde à correção documentada. `reportlab==5.0.0` confirmado
  pinado em `backend/pyproject.toml:18` (não assumido).
- Origem: develop

### [F02B-010] FR-507 — mecanismo "sem linha zerada fabricada" tem um caminho morto conhecido, já registrado
- Spec/AC: FR-507 — payload JSONB com chave ausente não deve renderizar linha zero para fórmula antiga.
- Classificação: PARCIAL
- Certeza: 60%
- Local: `rehomologation-pr-a.md` Nit 2 (citado pelo subagente, não relido linha a linha por mim)
- Evidência: a homologação já registrou que, para snapshots SINGLE, o detalhe sempre imprime as 6 linhas
  fixas do Breakdown mesmo quando zeradas — tornando o mecanismo de "chave ausente" efetivamente não
  exercitado nesse caminho. O revisor original julgou isso NÃO ser violação de FR-507 (fidelidade ao que
  a calculadora mostrou), mas o mecanismo em si permanece não testado para o caso que o motivou
  (payload de versão de modelo mais antiga com menos chaves).
- Origem: develop (achado auto-registrado, não novo)

### Código sem requisito (009)
- `backend/app/api/history.py:63-101` — guards de abuso/DoS (`_PAYLOAD_SIZE_CAP_BYTES` 512KB,
  `_PAYLOAD_MAX_DEPTH` 64), atribuídos em comentário a "audit finding E4-02" — não rastreável a nenhum
  FR-5xx/SC-5xx nem a `docs/decisions/audit-findings-r2.md` (grep por "E4-02"/"E4-05" nesse arquivo = 0
  ocorrências). Certeza 70% de que é hardening legítimo não documentado, não escopo indevido.

### Não verificado (009)
1. FR-526/SC-512 ("todas as garantias E1-E3 inalteradas") — dod-evidence cita "120/120 e2e" da SHA de
   fusão do PR-C (2026-07-17), três épicos atrás do HEAD atual. Pergunta: `pnpm gate:all` no HEAD atual
   ainda passa as specs Playwright de E1/E2/E3 sem regressão?
2. FR-507 no caminho de payload de versão de modelo antiga — não há teste de "linha ausente" achado
   especificamente para `snapshot-detail-page.tsx`. Pergunta: um snapshot gravado sob uma versão de
   modelo mais antiga (menos chaves de breakdown que a UI atual conhece) renderiza só as linhas
   gravadas, ou nunca foi re-testado após PR-B/PR-C?
3. Contagens do dod-evidence ("253/257 pytest", "626 testes/78 arquivos", "120/120 e2e") não
   reproduzidas. Único número medido nesta auditoria: `pytest tests/test_history.py tests/test_export.py
   tests/test_migrations.py --collect-only -q` → **118 testes coletados** (coleta, não execução; escopo
   menor que o total do dod-evidence — não comparável diretamente).

---

## specs/010-e5-saved-scenarios

20 FR + ~11 SC avaliados (Explore agent, background). Testes executados pelo agente:
`uv run pytest tests/test_scenarios.py -q` → 61 passed; `uv run pytest -q` (suíte backend completa) →
444 passed, 0 failed, 1 skipped; `npx vitest run` (suíte web completa) → 976 passed, 0 failed;
subconjunto de cenário/histórico → 143 passed. e2e Playwright não re-executado.

| FR/SC | Classificação | Local (resumo) |
|---|---|---|
| FR-601–605, 607–620 | IMPLEMENTADO | testes citados acima, todos verdes hoje |
| FR-606a | PARCIAL | ver achado B-011 |
| SC-601–612 | IMPLEMENTADO | sem drift |

### [F02B-011] FR-606a — criação de cenário KIT-basis continua deliberadamente ausente
- Spec/AC: FR-606a (`specs/010-e5-saved-scenarios/spec.md`) + Clarifications sessão 2026-07-20.
- Classificação: DIVERGENTE-POR-DECISÃO (confirmado ainda verdadeiro)
- Certeza: 95%
- Local: `apps/web/src/entities/scenario/config-document.ts:164` (`serializeKitBasis` definida, zero
  chamadores em produção); `apps/web/src/pages/bom/bom-page.tsx` (grep "Scenario|cenário" = 0
  ocorrências); `SaveScenarioSheet` só renderizado em `calcular-page.tsx` (AD_HOC) e `produto-page.tsx`
  (PRODUCT).
- Evidência: deferral registrado em `spec.md` §Clarifications 2026-07-20 (linha ~438-446), ratificado em
  CLAUDE.md e `business-rules.md:56`. O ramo KIT em `calcular-page.tsx:291,305,448` existe só para
  reabertura (`loadedScenario`), nunca para criação nova. Genuinamente ainda verdadeiro hoje, não uma
  regressão silenciosa.
- Origem: develop

### [F02B-012] FR-607b — dod-evidence de 010 nunca foi atualizado após a correção da 013 (re-snapshot KIT)
- Spec/AC: FR-607b (D3/D6 para base KIT).
- Classificação: DIVERGENTE (documentação, não comportamento — comportamento hoje está correto)
- Certeza: 90%
- Local: `backend/app/api/scenarios.py:454-463` (resnapshot de `lastKnown` para base KIT)
- Evidência: `dod-evidence.md:224-226` de 010 afirma "resolver D3/D6 covers PRODUCT + KIT" sem diferenciar
  save-time (resnapshot) de read-time (resolve). No PR-B original (2026-07-20) o resnapshot de
  `lastKnown` só cobria base PRODUCT — a correção para KIT veio depois, em `specs/013-audit-remediation`
  (achado E5-01, `tasks.md:193` T070). O código de HOJE cobre ambos corretamente (achado positivo), mas a
  afirmação do dod-evidence de 010 nunca foi corrigida para dizer "corrigido em 013", criando uma
  impressão de que 010 sempre entregou isso completo.
- Origem: develop (010 original + correção 013)

### Código sem requisito (010)
- `apps/web/src/entities/scenario/config-document.ts:61-77,188-213` — campo `category?: string` em
  `ScenarioChannelIntent`, adicionado pela spec 014/US8 (comentário explícito "014/T068... FR-003a"),
  aditivo e documentado, mas sem FR/SC correspondente em 010.

### Não verificado (010)
1. e2e Playwright completo (dod-evidence de 010 alega "70/70 chromium 0-flaky") — não re-executado.
   Pergunta: `pnpm --filter web e2e` na branch atual confirma 0 regressões em `scenarios.spec.ts`,
   `scenarios-manage.spec.ts` e nas specs E1-E4?
2. FR-608 (selo de staleness no reopen de cenário offline) — mecanismo confirmado
   (`use-scenarios.ts`/`fee-catalog.ts`), componente visual renderizado não rastreado até o JSX final.
   Pergunta: qual componente renderiza o selo dentro de `ScenarioContextBar`/`calcular-page.tsx` quando
   offline com cache expirado?
3. FR-609 (comissão ≥100% num slot dentro de um cenário reaberto) — mecanismo (`fee-prefill.ts`)
   confirmado reaproveitado, teste específico não localizado/rodado linha a linha. Pergunta:
   `apps/web/src/pages/calcular/calcular-scenarios.test.tsx` tem um caso de comissão ≥100% num slot
   salvo?

---

## Não verificado (consolidado — perguntas que exigiriam execução, não delegadas nesta auditoria read-only)

1. 006: nenhuma pendência de execução além do já registrado como deferido pelo dono.
2. 007: `pytest` completo em filaments/printers/products na branch atual; `pnpm e2e` completo.
3. 008: `pnpm e2e` completo (E1/E2 sem regressão).
4. 009: `pnpm gate:all`/e2e completo no HEAD atual (dod-evidence é de 3 épicos atrás); teste de payload
   de versão de modelo antiga em `snapshot-detail-page.tsx`.
5. 010: e2e completo; componente visual do selo de staleness em cenário reaberto; teste de comissão
   ≥100% em slot de cenário salvo.
