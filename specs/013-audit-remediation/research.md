# Research — 013-audit-remediation (Phase 0)

Nenhum NEEDS CLARIFICATION restante (D1–D6 resolvidos na spec §Clarifications). Este documento fixa as decisões técnicas por frente — cada uma com Decision / Rationale / Alternatives.

## §1 · Gramática do parser numérico pt-BR (C-01 / FR-001)

**Decision**: `parseDecimal` valida o formato da string LIMPA (pós-remoção de afixos `R$`/unidade/espaços, que permanece) contra uma gramática fechada, e só então converte:

| Padrão | Interpretação | Exemplo |
|---|---|---|
| `^\d+$` | inteiro | `1500` → 1500 |
| `^\d+,\d+$` | decimal pt-BR | `0,12` → 0.12 |
| `^\d{1,3}(\.\d{3})+(,\d+)?$` | milhar pt-BR (+decimal opcional) | `1.500,00` → 1500 · `1.500` → 1500 |
| `^\d+\.\d{1,2}$` (sem vírgula presente) | **decimal com ponto — caso não-ambíguo documentado** | `0.12` → 0.12 · `1500.00` → 1500 · `1.50` → 1.5 |
| qualquer outra coisa | **rejeita** (`null` → erro de campo existente) | `1,234,56` · `10-5` · `5x3` · `12,,5` |

A desambiguação estrutural: ponto seguido de **exatamente 3 dígitos** em grupos = milhar (convenção pt-BR); ponto seguido de **1–2 dígitos** = decimal (só pode ser en-US). O único caso residualmente ambíguo (`1.500` — "1500" pt-BR vs "1.5" en-US digitado com zeros) resolve a favor de pt-BR, documentado no módulo e nos testes. `parseFloat` deixa de ser a validação — vira só a conversão final de uma string já validada (mata o parse-parcial FA-02/FA-06).

**Rationale**: preserva 100% do comportamento correto atual (todos os formatos pt-BR continuam aceitos byte-idênticos), conserta os dois Altos com UMA mudança, e o caso `1500.00` (paste en-US) passa a ser interpretado como o usuário quis — melhor que rejeitar.

**Alternatives considered**: (a) rejeitar todo ponto — mais simples, mas quebra o paste en-US legítimo e pune o hábito mais comum; (b) masking no `NumberField` — não cobre paste nem programático, e a auditoria provou que o input não é a única porta; (c) `Intl.NumberFormat` parsing — não existe API de parse estável, só de format.

## §2 · Migração de rotas + redirects (C-02 / FR-003, D1=A)

**Decision**:
- `/historico/$snapshotId` → `/historico?snapshot=<id>` · `/catalogo/produtos/$productId` → `/catalogo?produto=<id>` · `/catalogo/produtos/novo` → `/catalogo?produto=novo` — todos via `validateSearch` (padrão idêntico ao `/kits?id=` existente; `/catalogo` já tem `validateSearch` com `tab`, o param `produto` se soma).
- **Redirects em DUAS camadas**: (1) `firebase.json` ganha `redirects` com captura de segmento (`"source": "/historico/:id", "destination": "/historico?snapshot=:id", "type": 301` e equivalentes) — isso conserta INCLUSIVE o cold-load de URLs antigas já compartilhadas, que hoje são tela branca; (2) o router mantém as rotas antigas por ≥1 release como redirect client-side (cobre dev/preview local onde o hosting não existe).

**Rationale**: fato importante levantado no research — as URLs antigas **nunca funcionaram em cold-load** (é exatamente o bug F-02), então nada regride; o redirect de hosting as torna funcionais pela primeira vez. O redirect client-side sozinho seria insuficiente (não roda se o app não boota).

**Alternatives considered**: (a) `base:"/"` — descartado pelo dono (D1); (b) só redirect client-side — deixa as URLs antigas mortas em cold-load; (c) rota `$` catch-all com parse manual — mais frágil que o `redirects` nativo do hosting.

**Risco declarado** (confiança ~85%): a sintaxe de captura do Firebase Hosting `redirects` (`:id`) suporta o caso; validar no emulador/preview no PR — se não suportar, fallback é um redirect estático por prefixo + client-side para o restante.

## §3 · Módulo `backend/app/validation.py` (C-06 / FR-005)

**Decision**: módulo-FOLHA (não importa nada de `app.*`) exportando: as constantes `_CEIL_*` canônicas (valores idênticos aos de `products.py` hoje — nenhuma mudança de limite, só de residência), `finite_non_negative(value, field, ceiling)`, e `reject_bad_leaves(node, *, money_ceiling)` parametrizado (resolve a divergência 10¹⁰/10¹² dos consumidores history/scenarios de forma EXPLÍCITA — cada caller passa seu teto, o comentário "verbatim" falso morre). Routers migram por substituição 1:1; `import-linter` ganha contrato: `validation` é leaf (mesmo padrão do contrato existente de `settings`).

**Rationale**: regra financeira em fonte única (Constitution V); a divergência E3-01 vira impossível por construção; o import-linter torna a decisão estrutural verificável no gate.

**Alternatives considered**: (a) base-class Pydantic compartilhada — acopla schemas de routers distintos, mais invasivo; (b) deixar como está com testes de paridade — trata o sintoma, a 6ª cópia divergiria igual.

## §4 · Variante lapsed do catálogo (C-03 / FR-004)

**Decision**: replicar o padrão server-informed existente — `useEntitlement()` na página, prop `readOnly` descendo para os 3 forms (`fieldset disabled` + rodapé trocado), banner com as strings órfãs `messages.catalogo.lapsed*`, cópia de reativação nova em `messages`. Zero lógica de entitlement nova — só apresentação do estado que o servidor já responde.

**Rationale**: o padrão está provado 2× no repo (cenários `scenarios-list-sheet.tsx:313` e kits `bom-page.tsx:412`); Constitution IV intocado.

**Alternatives considered**: HOC/route-guard genérico de lapsed — abstração prematura para 3 superfícies; recusado (Q-09 mostra que a casa só abstrai no 4º uso).

## §5 · Técnicas dos testes-guarda (C-08/C-09/C-10 / FR-007..009)

**Decision**:
- **T-02**: no `providers.test.tsx`, popular as 5 chaves idb + espiar `queryClient.removeQueries` por QUERY_ROOT; casos: (a) →anonymous varre tudo salvo outbox; (b) u1→u2 direto (o branch nunca testado); asserção por chave nomeada, não por contagem.
- **T-01**: teste `requires_db` novo: `alembic upgrade head → downgrade base → upgrade head` no testcontainer + `to_regclass` nulo pós-downgrade para `subscriptions`/`billing_events`/`scenarios`/`snapshots`.
- **P-03**: `scripts/check-migrations.sh` ganha passo `alembic heads` (metadata-only, não precisa de DB) assertando exatamente 1 linha — roda no job CI existente (migration-guard). Não entra no `gate:all` local para não exigir uv em contexto front (o amend-guard já é CI-only pela mesma razão; paridade D4 preservada porque o gate:all não muda).
- **E5-04**: fixture de kit 2 linhas no `test_scenarios.py` (estender `_mk_kit_with_ad_hoc_line`), deletar o produto de UMA linha, assert do shape por `GET /scenarios/{id}`.
- **T-07**: `vitest.config.ts` exclui só `apps/web/src/shared/api/generated.ts`.

**Rationale**: cada guarda usa a mutação nomeada na auditoria como critério de eficácia (FR-017); nenhum framework novo.

**Alternatives**: mutation-testing automatizado (Stryker) — infra nova, fora de escopo; as mutações da auditoria são executáveis manualmente como prova única no PR.

## §6 · Protocolo de curadoria ML/Amazon (US8 / FR-015, D3=B)

**Decision**: processo em 3 passos com gate humano:
1. **Levantamento** — fontes oficiais (páginas de tarifas Mercado Livre BR e Amazon BR), na ordem de preferência registrada do dono (2026-07-06): fonte determinística/oficial primeiro; WebSearch como fallback; a via de API direta está 403-bloqueada. Cada valor coletado com `sourceUrl` + `effectiveDate` + data da coleta.
2. **Modelagem no schema existente** — as entradas usam o shape atual do catálogo (`commissionPct`, `fixedFee`, `priceBands`, `minPerItem`). ML: curar o plano **Clássico** (o que SC-101 referencia) com suas faixas por preço; Amazon: comissão padrão + `minPerItem` R$ 1 (o floor que o engine já suporta e testa). **Limite declarado**: taxas por-categoria (ML tem dezenas) NÃO cabem no schema atual — a entrada curada é a taxa do caso-comum, e o selo de referência + override manual cobrem o resto (mesma semântica honesta que a Shopee tem hoje). Se o dono quiser granularidade por categoria, é evolução de schema FUTURA (fora deste escopo, flag no PR).
3. **Gate do dono** — os valores entram no PR como proposta com fontes; o merge só após validação explícita do dono sobre cada número (FR-015). `seed.ts` espelha `catalog.json` byte-a-byte (a paridade existente vira teste se ainda não for).

**Rationale**: Truth Over Approval — números de terceiros nunca inferidos; o limite de granularidade é declarado em vez de silenciosamente simplificado.

**Alternatives**: (a) deferir (D3=A) — recusado pelo dono; (b) evoluir o schema para categorias agora — escopo/risco desproporcional para esta feature de remediação.

## §7 · Itens sem pesquisa necessária (decisão = executar conforme achado)

C-11 (E5-01 espelha `_resolve_kit_last_known` no resnapshot; E5-02 ellipsis F5; E2-03 `owner_uid` no where; E4-02 cap antes; E4-05 tz-aware), C-12 (FA-03 `shouldValidate:true`; FB-04 isLoading; E1-03 parse data+int; E1-06 seed via `parseFeeCatalog` no boot; FC-01/FC-02 remoções/moves), C-13 (CORS: `allow_methods=["GET","POST","PUT","PATCH","DELETE"]`, `allow_headers=["Authorization","Content-Type","Accept"]` + nota em tech-debt; OPTIONS/preflight é tratado pelo middleware automaticamente), C-14 (preservar bands/voucher sob override — merge seletivo em `calculator-model.ts:170-179` + teste do seam), C-15 (lista fechada das 12 claims na spec FR-014). Cada um tem a evidência arquivo:linha da auditoria como especificação do fix.
