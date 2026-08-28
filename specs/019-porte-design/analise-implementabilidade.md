# 019 — Análise de implementabilidade das fatias B–F (síntese)

> Pedido do dono (2026-08-27): "que desde as linhas de código até as estruturas (micro e macro) estejam cobertas,
> para não ficar revisitando a implementação depois". Seis auditores só-leitura, escopos disjuntos, formulário
> único (achado com arquivo:linha · severidade · task reescrita · tasks novas · decisões): `auditoria/01-seguranca`
> · `02-qa-testes` · `03-frontend-d-e-f` · `04-frontend-b-c` · `05-dados-migracoes` (opus, escalado — domínio de
> preço) · `06-arquiteto` (opus). Custo real 1.137.172 tokens. **Resultado aplicado**: `tasks.md` Phases 5–10
> reescritas (cada task com os símbolos/linhas reais, o SQL literal onde cabe, e as tasks novas N-*), contratos
> corrigidos, e a lista mínima de decisões do dono abaixo. Base auditada: `develop`@`a0917c6` + PR #59.

## 1. Veredito

As Phases 5–10 como estavam **não eram implementáveis de primeira**. Dos 69 itens auditados (T036–T104), **31 tinham
um achado BLOQUEIA** (caminho/símbolo inexistente, mecanismo que não é o do código, ou estrutura que nenhuma task
cobria) e outros 22 RETRABALHO. Os seis auditores convergiram, sem se ver, nos mesmos oito bloqueios estruturais:

| # | bloqueio (fatia) | quem viu | o que era |
| --- | --- | --- | --- |
| 1 | **A parede não é um `disabled`** (B) | 01·04·06 | `catalogo-page.tsx:105-113`, `bom-page.tsx:116/:136`, `historico-page.tsx:75/:80`, `scenarios-list-sheet.tsx:462` são RETORNOS ANTECIPADOS inteiros; "Montar kit disabled por plano" não existe. O grátis nunca chega a um vazio; `HistoryListState` nem expõe `error` (`use-history.ts:150-166`). |
| 2 | **O toast falso** (B) | 01 | `catalog-panel.tsx:157-167`: `await create?.(body)` seguido de `toast(savedToast)` e `setSheet(null)` — com o handler ausente (a barreira estrutural da research §E-2) o app diria "Salvo!" e descartaria o digitado. E `onSubmit` é OBRIGATÓRIO na assinatura (`catalog-panel.tsx:76`, `filament-form.tsx:31`). |
| 3 | **A plausibilidade já existe, e diverge da prancheta** (C) | 02·04·06 | `shared/lib/plausibilidade.ts` (não `features/calculator/plausibility.tsx`), renderizada em TRÊS pontos + `bom-line-editor`; `printGramsMax = 50_000` — os 850 g da prancheta não disparam; "erro não come o aviso" reverte `calculator-form.tsx:175-178`. |
| 4 | **A lista do Catálogo não tem preço, e o recompute é de outra feature** (D) | 03·06 | `products-panel.tsx:20` "Never a price in a row"; `CatalogPanel` é genérico (4 abas) sem `rowPrice`; o recompute mora em `features/calculator` e `entities`/`features/catalog` não podem importá-lo (`eslint.config.mjs:83-84`). |
| 5 | **A migração 0008 quebraria em conta real** (D) | 01·05·06 | Índice único parcial sobre nomes que hoje podem colidir ("Gancho"/"gancho" — nenhuma UNIQUE de nome); nome sem teto (btree >2704 bytes ⇒ 500); backfill seria a 1ª data-migration e NÃO pode importar `app.lib` (migração mergeada é imutável); `_materialize` do kit (`boms.py:397`) roda na transação única — `IntegrityError` sem SAVEPOINT mata o kit; `PATCH /products/{id}` NÃO EXISTE. |
| 6 | **O QUOTE não gravaria e imprimiria errado** (E) | 01·03·05·06 | `RecordForm` (`record-snapshot-sheet.tsx:113-124`) `if (!total) return` — silêncio; `build_quote_view` só ramifica KIT (`quote_render.py:199-213`); `_basis_key` cai em `precoVarejo` (`:96-97`); QUATRO espelhos de `headline_basis`; folhas de dinheiro do QUOTE fora de `_MONEY_POSITION_KEYS` (`validation.py:52`) ⇒ E4-01 (célula vazia no PDF); `reject_bad_leaves` rejeita float (`discount.value: number` ⇒ 422). |
| 7 | **"Enviar" offline é contraditório** (E) | 06 | `useRecordSnapshot` enfileira no outbox (contra research §K) e o PDF exige id do servidor (`use-export.ts:30`). |
| 8 | **Dois limiares de desktop** (D/F) | 03·06 | `tf-table ≥1024` (handoff) × `useIsWide` 1280 (ADR-0031, emenda §6 proíbe 2º gate) × mestre-detalhe do 018 em ≥1280; `/calcular` tem corte próprio de 1024 (`calculator-form.css:25,40,65,81`); `calcular-page.css` não existe; `ScenariosList` não existe. |

E três descobertas que ENCOLHEM trabalho: **D2 já está feito** (`scenarios-list-sheet.tsx:388/:149` = `scenario-context-bar.tsx:233/:205`, T096 retirada); a **entrada-com-intenção já existe** (`TeaserUpgrade` → `/sign-in?redirect=/conta?assinar=1`, provada em teste); **não há enum Postgres** no schema (tudo é CHECK em TEXT — a discussão de `ALTER TYPE` fora de transação some, e o `downgrade` da 0009 é possível).

## 2. O que a autoridade já respondia (aplicado nas tasks, sem perguntar)

- Deslogado vê o MESMO caminho sem parede (spec §Clarifications E-5, FR-1906) — corrige T044 "para o logado".
- Os vazios de Orçamentos/Simulações levam à calculadora ⇒ as paredes daquelas telas caem (handoff 32f, `ui-porte.md` §C2).
- "Assinar Premium" fica FORA do `<Frozen>` (research §A; `frozen.tsx:23` é `<fieldset disabled>`).
- `premiumGate` puro em `shared/billing`, sem importar `entities`/`features` (research §E-1); a barreira é a AUSÊNCIA do handler (§E-2) ⇒ `onSubmit` vira OPCIONAL na assinatura; o 2º membro da união é `"lapsed"` (a função pura não sabe se há itens — a tela compõe "com itens"); um 5º estado `signed-out`.
- Store do "Entendi" mora em `shared/lib` ao lado de `plausibilidade.ts` (`:26-29`: `features/bom` consome os mesmos avisos).
- Dinheiro do documento congelado é STRING decimal (`validation.py:75-83`, `history.py:120-122`) ⇒ `discount.value` também como string; `_MONEY_POSITION_KEYS` cresce.
- `quote_validity_days` já é coluna (`models:652`) e o PDF já a imprime — NÃO entra no payload (data-model §4 corrigido).
- A 0009 mexe em TRÊS CHECKs (kind, basis, CASE) no mesmo ato; o gatilho de imutabilidade cobre QUOTE por construção (`0003:181-188`); `payload_schema_version` continua 1; `model_version` = `PRICING_MODEL_VERSION` do cliente.
- CSV não ganha coluna (FR-513); endpoints reais de export: `/history/{id}/quote.pdf` e `/history/export.csv` (`api-019.md` corrigido).
- Nenhum `ErrorCode` novo (`errors.py:22-41`); nenhum rate limiting (idioma = teto por requisição).
- Um convite por tela (016/US1) — quem o carrega: o `TeaserUpgrade` DENTRO do `<VazioDidatico>`; o rodapé do formulário inerte usa o MESMO componente (não um 2º link).
- D2 já satisfeito; T096 retirada; T091 vira guarda por mutação.

## 3. Recomendações aplicadas por padrão (reversíveis por uma linha — o dono pode discordar)

| tema | padrão aplicado | alternativa |
| --- | --- | --- |
| `observed_at` | **servidor carimba** (`now()`); o corpo do PUT não o envia — coerente com o precedente `device_*` (models `:653-658`); "Salvo em" formata no fuso local | cliente envia em `device_observed_at` |
| `_dedup_match` de kit (`boms.py:294-309`) | **casa por `name_norm`** — emenda datada ao ADR-0017 §3 na PR-D (o match exato viraria armadilha com o índice novo) | exato + sufixo "(2)" cria quase-duplicado |
| Teto do lote do `PUT /price-observations` | **500 itens** ⇒ 422 acima | outro número |
| Teto de nome nas 4 tabelas | **120** (precedente `scenarios.py:84 _NAME_MAX_CHARS`) no pydantic + CHECK | indexar `left()`/`md5()` |
| Lista do Catálogo com preço | **estender `CatalogPanelProps`** (`rowPrice?/rowWas?/rowFlag?`) e trocar a lista por `<Plist>` — filaments/printers/kits ganham de graça | lista dedicada só de produtos (duplica busca/paginação/mestre-detalhe) |
| Onde o recompute da lista roda (fronteiras) | **compor em `pages/catalogo/catalogo-page.tsx`** (pages podem importar features) e injetar os preços por prop nos painéis; `entities/catalog/price-observations.ts` recebe os preços por argumento | mover `computeFromForm`+mapeamentos para `entities/pricing` |
| Como o "Enviar" grava | **`useRecordSnapshot()` direto do `quote-builder`** (o construtor já perguntou validade; o `RecordForm` re-perguntaria e hoje nem grava um QUOTE) | estender `RecordForm` |
| Forma de `payload.lines` | `FrozenQuoteLine {name, quantity, unitPrice, subtotal, origin}` (data-model §4), lido por um ramo QUOTE NOVO em `build_quote_view` — a afirmação "a forma que o PDF já lê" era falsa | reusar `FrozenKitLine` |
| `FixedFeeSourceBadge` | também vira `Alert compact` dispensável pela MESMA chave (é ele quem carrega `effectiveDate`, research §G) | só o `FeeSeal` |
| `name_norm` no backend | `backend/app/lib/name_norm.py` + contrato `import-linter` "dependency-free leaf" (`pyproject.toml:134-138`) | dentro de `app/validation.py` |

## 4. Decisões do dono — TOMADAS em 27/08 (todas na recomendação; aplicadas no `tasks.md` e em spec §Clarifications)

1. **`tf-table` no Catálogo** — (a) substitui a coluna-mestre a 1280 (redesenha o 018 recém-mergeado); (b) emenda datada no ADR-0031 com limiar nomeado 1024 só para densidade de lista; (c) `tf-table` fica sem consumidor no 019. *Bloqueia T076/T097.* Recomendação do arquiteto: (b) — é o que o handoff mediu ("≥1024, leitura de coluna").
2. **Hospedeiro de Simulações ≥1280** — coluna de `/calcular` (que já tem corte de 1024 ⇒ dois limiares na mesma tela, emenda) ou destino de navegação novo (rota de 1 segmento + 6º item no nav — hoje 5). *Bloqueia T092/T095.* A prancheta 20g decide o layout; o dono decide o hospedeiro.
3. **A parede de `/kits` cai junto?** — e "montar um kit sem salvar" no grátis/lapsed é permitido (composição local sem rede)? O lote 32 fala do Catálogo; `bom-page.tsx:116/:136` não está nomeado em lugar nenhum. *Bloqueia T046.*
4. **"Enviar" offline** — (a) exige conexão (o construtor segue offline, o envio não); (b) congela offline e o PDF sai na sincronização, com a tela dizendo isso; (c) PDF no cliente — rejeitada (ADR-0020). *Bloqueia T084/T088.* Recomendação: (a).
5. **Limiar de gramas do aviso** — a prancheta usa 850 g; o produto usa `printGramsMax = 50_000` com procedência escrita (homologado em 13/08). Mudar altera comportamento homologado; não mudar torna o exemplo da prancheta inalcançável. *Bloqueia T049.*

## 5. Conflitos entre fatias e a ordem (B→C→D→F→E)

- **Transcrição antes dos testes**: T042/T055/T074/T087 estavam DEPOIS dos testes que asseveram copy verbatim — movidas para o topo de cada fase.
- **B × F**: a PR-B apaga a faixa `catalogo.lapsedTitle` (`catalog-panel.tsx:444-448`); a T090 (D1) enumera as 7 ocorrências de "Premium pausado" e decide por chave.
- **C × F**: `calculator-form.css` é a mesma folha do sticky (C) e do hospedeiro largo (F); F relê a medida da C.
- **C × D**: `NumberField.precision` (C) atravessa os DOIS `ControlledNumber`; o formulário de produto (D) consome, não recria.
- **D × F**: T097 vira só medição; o `tf-table` entra (ou não) na D, pela decisão 1.
- **D → E**: a unicidade de nome muda a materialização do kit; verde antes de a E montar itens de kit. Produto FIXADO no construtor usa o preço do MOTOR (ADR-0033 §3) — task nova.
- **Diagrama §Dependências**: a seta F→E contradizia a legenda; Phase 8 depende de A + 0008.

## 6. Correções aplicadas fora do `tasks.md`

- `contracts/api-019.md`: `PATCH /products/{id}` marcado como ROTA NOVA (products.py não tem PATCH); endpoints de export reais; `observedAt` sai do corpo do PUT (servidor carimba); teto de lote 500.
- `data-model.md` §4: `quoteValidityDays` sai do payload (é coluna); o payload QUOTE traz `modelVersion`/`schemaVersion` (CHECKs `:606/:627`); `discount.value` como string decimal; `lines[]` = `FrozenQuoteLine`.

## 7. O que esta análise NÃO cobre

### 7.1 Escopo

A copy e a geometria das pranchetas B–F (não congeladas ainda) — a transcrição (agora a 1ª task de cada fase) e a
homologação do dono continuam sendo o único juiz disso. As 5 decisões da §4 foram tomadas em 27/08 — nenhuma task
está bloqueada.

## 8. Verificação pós-auditoria (27/08, quatro verificadores frescos + `speckit-analyze`)

- **Citações** (`auditoria/08a`): 155 conferidas, 150 certas; as 5 erradas eram de LOCALIZAÇÃO (linha/intervalo) — corrigidas.
- **Frontend** (`08b`): PR-B/D-front/F prontas; PR-C com 1 correção (`ControlledNumber` × `ControlledField`/`CalcFieldMeta`) — aplicada.
- **Coerência** (`07`): 24 correções — 14 artefatos-autoridade que ainda diziam o contrário das decisões (research, ui-porte, api-019,
  data-model, plan, quickstart, ADRs 0032/0033/0034, spec US1-AC2), a ordem T130→T076, 3 `[P]` falsos, 11 ambiguidades fechadas
  com a frase e a fonte, e a lacuna ALTA dos testes existentes que a PR-B vira vermelhos (nova T110) — todas aplicadas.
- **Dados** (`09`): PR-D/PR-E tinham 2 erros MEUS que seriam regressão (`_MONEY_POSITION_KEYS` com `lines` recusaria `quantity`
  de todo KIT; "`useRecordSnapshot` não enfileira" é falso — é durable-first) + `migrated_db` já no head, T062×T071 (nome de 5.000
  chars: `name_norm = left(norm, 200)`, sem CHECK de comprimento no banco), nomes CURTOS de CHECK no modelo, U+2028/2029 crus
  na regex, `computeQuote` devolve números, 7 sítios e não 8, validador de escala novo, gatilho V2 da 0006 — todas aplicadas.
- **speckit-analyze**: 0 críticas; 1 MEDIUM (FR-1902 cita `--tf-warning-deep`, que não existe — corrigir ao ratificar `#9a570a`).

**Veredito final: PRONTO PARA IMPLEMENTAR** (PR-B abre pela T042). O que ainda é do dono: ratificar `#9a570a` no gate do PR-A e
os flips dos ADRs por fatia.
