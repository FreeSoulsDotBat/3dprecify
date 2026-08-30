# Auditoria de implementabilidade 019 — parecer 05: dados / migrações / motor (PR-D · PR-E)

> Agente `dev-estrutura-de-dados` ESCALADO a opus (ADR-0022), 2026-08-27, só leitura. Base: head Alembic
> **0007**, `pricing-core` **4.1.0**. Entrada bruta da síntese; o SQL abaixo é para as tasks carregarem literalmente.

## Achados por task

| task | achado (fato, arquivo:linha) | sev. | task reescrita |
| --- | --- | --- | --- |
| T062 | (a) O round-trip real é `backend/tests/test_migrations.py` e só exercita `_OWNED_TABLES` (`:41-53`) — tabela nova fora da lista tem `downgrade()` "verificado" por no-op. (b) O índice único parcial nasce sobre dados legados que podem colidir ("Gancho"+"gancho" hoje são legais — nenhuma `UniqueConstraint` de nome em `filaments`/`printers`/`products`/`boms`, models `:132-155,:161-194,:206-349,:361-379`) ⇒ `CREATE UNIQUE INDEX` quebra o upgrade. (c) `name_norm NOT NULL` não nasce num passo com backfill. | BLOQUEIA | Asserir estado pós-upgrade: `price_observations` com `uq_price_observations_subject (owner_uid, subject_kind, subject_id)`, `ck_…_subject_kind_enum`, `ck_…_observed_price_valid`, `ck_…_observed_at_finite`, `ck_…_model_version_set`, FK só para `accounts`; `products.seller_fixed_price` NULL-able + `ck_products_seller_fixed_price_valid` + `seller_fixed_at`; `name_norm TEXT NOT NULL` + índice único PARCIAL `uq_{filaments,printers,products,boms}_owner_name_norm … WHERE deleted_at IS NULL` (as 4 têm `deleted_at`: `:155,:194,:349,:379`; `bom_lines` NÃO — `:396`). Teste de backfill com legado: semear linhas sem `name_norm` E duas da mesma conta colidindo ("Gancho"/"gancho ") ⇒ upgrade CONCLUI com sufixo "(2)". Acrescentar `"price_observations"` a `_OWNED_TABLES` (`test_migrations.py:41-53`, container próprio `:70-76`). |
| T063 | (a) `backend/app/lib/` **não existe**. (b) pytest roda com cwd=`backend/` (`package.json:21`). (c) **`\s`/`.strip()`/`.trim()` divergem entre Python e JS** (Python casa `\x85` e não `﻿`; JS o inverso); o fixture (18 casos) não tem NBSP/BOM/NEL — as duas passam e divergem. | RETRABALHO | Classe de espaço EXPLÍCITA e idêntica: `[ \t\n\r\f\v   -     　﻿]`; fixture via `Path(__file__).resolve().parents[2] / "specs/…"`; +3 casos (NBSP interno, BOM nas pontas, NEL). |
| T064 | (a) Portas CORRETAS (`app/entitlement/__init__.py:90,102`): `require_catalog_read` = `active\|lapsed`, **`none` ⇒ 403** (`:110`) — o GET responde 403 ao grátis; a PR-B tolera. (b) **PUT em lote com o mesmo (kind,id) duas vezes ⇒ `ON CONFLICT DO UPDATE` levanta `cardinality_violation` ⇒ 500.** (c) Sem teto de lote (o Histórico tem `_PAYLOAD_SIZE_CAP_BYTES`, `history.py:65`). (d) "o servidor NÃO altera o valor" é falso para 3+ casas: `MONEY_SETTLED = Numeric(12,2)` (models:53) arredonda; `finite_non_negative` (`app/validation.py:55`) não checa escala. | BLOQUEIA (b) / RETRABALHO (c,d) | GET `none` ⇒ 403, `lapsed` ⇒ 200; PUT `lapsed` ⇒ 403; `observedPrice` negativo/NaN/> CEIL_MONEY ⇒ 422 (`finite_non_negative`) **e com mais de 2 casas ⇒ 422**; **lote com (kind,id) repetido ⇒ 422, nunca 500**; lote > 500 ⇒ 422; PUT idempotente. |
| T065 | (a) Retry sob `IntegrityError` só em **SAVEPOINT** (`session.begin_nested()`): o save de kit é UMA transação (ADR-0017, `boms.py:8-20`). (b) Corrida com DUAS conexões reais (threads + dois `TestClient`), não `asyncio.gather` numa sessão. (c) A regra é das 4 tabelas. | BLOQUEIA (a) | Para CADA tabela (POST /filaments, /printers, /products, /boms): "Gancho" e depois "gancho " ⇒ 201 com o nome FINAL "(2)"; renomear (PUT) para nome ocupado segue a MESMA regra; corrida por duas conexões ⇒ uma renomeada, zero perdidas, zero 500; mutação: sem `begin_nested()` o kit inteiro morre — asserir com linha ad-hoc que colide. |
| T066 | (a) **`PATCH /products/{id}` NÃO EXISTE** (`products.py` `:464/:489/:514/:529/:547`); o contrato `api-019.md` inventa o verbo. (b) "compõe pelo motor" é inasserível no backend: `boms.py:4` "stores its INPUTS/STRUCTURE and never a price" — o servidor nunca chama motor (ADR-0008). | BLOQUEIA (a) / RETRABALHO (b) | Rota NOVA `PATCH` com `{sellerFixedPrice}`; `null` desfixa e zera `sellerFixedAt`; outra chave ⇒ 422 (`extra="forbid"`, precedente `scenarios.py:593-596`); `lapsed` ⇒ 403. Não-composição provada por AUSÊNCIA: `set(ProductOut.model_fields)` congelado = campos de hoje + `sellerFixedPrice` + `sellerFixedAt`; `BomLineOut`/`BomOut` (`boms.py:190-227`) NÃO ganham `seller_fixed_price`. |
| T067 | Observação é online-only, sem outbox (ADR-0033 §2); o catálogo tem cache uid-keyed (`entities/catalog/catalog-cache.ts`) — a implementação natural cachearia o GET. | PRECISÃO | Offline (`use-online.ts`) ⇒ zero PUT e nada no outbox; resposta NÃO persistida em `catalog-cache.ts`; 403 no grátis não vira erro visível. |
| T068 | "Salvo em 12/05" vem de `observed_at`; se o servidor carimbar, formatar no fuso LOCAL (precedente `device_quoted_at` + `device_utc_offset_minutes`, models `:655-661`; esta tabela não guarda offset). | PRECISÃO | Asserir com instante que atravessa a meia-noite UTC. |
| T070 | **Não existe `pnpm gen:api` na raiz** (`package.json:9-27`); vive em `apps/web/package.json:12`. Exportador: `backend/scripts/export_openapi.py`. O guarda congela `contracts/openapi.json` E `apps/web/src/shared/api` (`.github/workflows/ci.yml:65-71`). | RETRABALHO | Os TRÊS comandos do CI, da raiz: (1) `cd backend && PYTHONPATH=. uv run python scripts/export_openapi.py && cd ..` (2) `pnpm --filter @3dprecify/web gen:api` (3) `git diff --exit-code -- contracts/openapi.json apps/web/src/shared/api`; duas vezes; docstring vira `description`; formatar só da raiz. |
| T071 | (a) Docstring confere: `models/__init__.py:198-204`. (b) Falta `downgrade()`, `Index` espelhado no modelo, ordem em passos. (c) Seria a **primeira data-migration** do projeto (nenhum `op.get_bind()` em `alembic/versions/`) e **não pode importar `app.lib.name_norm`** (migração mergeada é imutável — `scripts/check-migrations.sh:1-9`). | BLOQUEIA (c) | `0008_price_observations_fixed_price_name_norm.py` em 6 passos: (1) `create_table` (DDL abaixo); (2) `add_column` `seller_fixed_price` Numeric(12,2) + `seller_fixed_at` timestamptz + `ck_products_seller_fixed_price_valid`; (3) `name_norm` NULLABLE nas 4; (4) backfill Python via `op.get_bind()` com a função COPIADA e desempate "(2)"; (5) `alter_column(nullable=False)`; (6) índices únicos parciais. `downgrade()` = inverso exato; docstring declara que os VALORES de `seller_fixed_price` morrem (molde `0007_remove_waste.py:14-27`). Modelo: `PriceObservation` + 5 colunas + 4 `Index(unique=True, postgresql_where=text("deleted_at IS NULL"))` (precedente `ix_snapshots_owner_active`, models `:632-638`) + reescrita do docstring `:198-204` com ADR-0033 §1. |
| T072 | (a) `catalog*.py` não existe. (b) Sítios de escrita de nome são exatamente 8: `products.py:375` (dentro de `_apply` `:370` — FUNIL de POST, PUT e materialização de kit `boms.py:428-431`), `filaments.py:161,192`, `printers.py:148,180`, `boms.py:596,642`. (c) **`app/lib` é pacote-raiz novo** e o `import-linter` (`pyproject.toml:79-138`) não o cobre. | BLOQUEIA (a,c) | `price_observations.py` (router registrado em `main.py` junto de products `:134`) + `app/lib/__init__.py` + `name_norm.py` + contrato `[[tool.importlinter.contracts]]` "dependency-free leaf" (molde `:134-138`); aplicar nos 8 sítios; retry sob `begin_nested()` limitado (50 ⇒ 422). |
| T073 | `sellerFixedAt` não tem dono declarado. | RETRABALHO | `ProductPatchIn(CamelModel)` `extra="forbid"`, campo único `seller_fixed_price: Decimal \| None`; **`sellerFixedAt` carimbado pelo SERVIDOR** (`datetime.now(UTC)`), NULL ao desfixar — nunca do corpo (o único carimbo de aparelho é `device_quoted_at`, e o prefixo `device_` declara que o servidor não verifica, models `:653-658`). |
| T077 | A Clarification JÁ está em `specs/007-e2-catalog-entitlement/spec.md:410`. | PRECISÃO | Diff palavra a palavra contra ADR-0033 §5. |
| T079 | (a) `bom.precoVarejo` EXISTE (`packages/pricing-core/src/index.ts:483`), `custoTotal` (`:481`). (b) **"sem `channels` (o tipo não aceita)" é FALSO**: `BomLineInput.input` é `PriceInput` (`:446-449`) e `PriceInput.channels?` (`:174`) — `Omit<>` não barra uma variável já tipada; a recusa tem de ser de RUNTIME. (c) `tests/version.test.ts:19,25` fixa "4.1.0". | BLOQUEIA (b) | `grossTotal === bom.precoVarejo`; `netTotal === toMoney(gross − discountAmount)`; `costFloor === bom.custoTotal`; `belowCost` ESTRITO (empate = false); desconto > total / negativo / pct > 100 / não-finito ⇒ `ValidationError` (`index.ts:196`); **linha com `input.channels` não-vazio ⇒ `ValidationError` field=`lines[i].input.channels`**; `PRICING_MODEL_VERSION === "4.2.0"` e `version.test.ts:19` + `package.json:3` mudam JUNTO. |
| T080 | Falta onde/formato/semente/commit da fixture; se gerada depois de tocar `src/`, é circular (014/C). `**/__fixtures__/**` já está fora do coverage (`vitest.config.ts:34`). | BLOQUEIA | Primeiro commit da fatia com `src/index.ts` INTOCADO: `tests/__fixtures__/generate-equality-4.1.0.mjs` (PRNG `mulberry32(20260827)`, sem `Math.random`/`Date`) emite `tests/__fixtures__/equality-4.1.0.json` = `{generatedAtVersion:"4.1.0", calculator:[{input,result}]×500, bom:[{lines,result}]×200}` cobrindo com/sem `channels`, `otherCosts`, `failurePct` alto, meio-centavo (ROUND_HALF_UP, `rounding.ts:12`). O teste compara campo a campo ignorando apenas `modelVersion`. |
| T081 | (a) **NÃO EXISTE ENUM POSTGRES** — zero `sa.Enum`/`CREATE TYPE` em `alembic/versions/`; `kind`/`headline_basis` são `Text` + CHECK (`models:584,586`; `0003:105-110`). Não há `ALTER TYPE`, nada fora de transação, downgrade É possível. (b) Gatilho de imutabilidade `BEFORE UPDATE … FOR EACH ROW` sem filtro por kind (`0003:181-188`) ⇒ cobre QUOTE. (c) A 0006 criou `trg_snapshots_forbid_delete` (`0006:106-159`) ⇒ **o downgrade da 0009 é irreversível com uma linha QUOTE**. | BLOQUEIA (a,c) | QUOTE/PRECO_ORCAMENTO aceitos (CHECKs em TEXT); INSERT QUOTE com `headline_total ≠ payload.totals.precoOrcamento` ⇒ RECUSADO por `ck_snapshots_headline_matches_totals`; não-vácuo removendo o ramo; SINGLE/KIT intocadas; UPDATE em QUOTE recusado pelo gatilho; `downgrade()` restaura os CHECKs e **falha por desenho se existir QUOTE** (docstring no molde `0007:14-27`). |
| T082 | (a) Espelhos de `headline_basis` são **QUATRO** no backend: `history.py:71-74` (`_BASIS_TOTAL_KEY`), `history.py:119` (`Literal`), `quote_render.py:31` (`_BASIS_TOTAL`), `quote_render.py:244` (`_BASIS_CAPTION`); + um 5º no cliente `pages/historico/recalc-today.tsx:53-56` (`Record<SnapshotInHeadlineBasis,…>` — quebra o typecheck, bom). (b) **`_basis_key` tem fallback SILENCIOSO para `precoVarejo`** (`:96-97`). (c) **`build_quote_view` só tem ramos `KIT` e "resto"** (`:199-213`) ⇒ QUOTE cai em SINGLE e imprime UMA linha de `provenance`. (d) CSV: `_CSV_FIELDS` (`:57`) são 5 escalares; `export.py:55-66` `load_only` sem `payload` ⇒ nenhuma coluna nova. | BLOQUEIA | `test_history_basis_mirror.py`: igualdade de conjuntos entre os 4 espelhos (+ `kind` `history.py:109` vs CHECK); POST QUOTE ⇒ 201; PDF de QUOTE itemiza `payload.lines`, imprime "Total (Preço do orçamento)" e bruto→desconto→total só com `discount`; CSV com cabeçalho idêntico e `kind=QUOTE`/`headlineBasis=PRECO_ORCAMENTO`. |
| T084 | Playwright não mede glifo em PDF; o medidor é `test_export.py:776 _pdf_runs` + `:894 _assert_no_overprint` (usados em `:915,:926,:975`). | RETRABALHO | e2e: total == `computeQuote`, aviso de piso, Enviar ⇒ QUOTE, imutável, PDF 200; geometria em `test_export.py` com nome de 300 chars reusando os helpers. |
| T085 | Falta `package.json:3`, `version.test.ts:19`, extensão `.ts` nos imports (`boots-under-node.test.ts` — 014/US4). | RETRABALHO | Ver texto reescrito na síntese. |
| T086 | (a) São CHECKs. (b) Espelho: 4 no backend + 5 no front (`recalc-today.tsx:53-56`, `compare-today.tsx`) — e "Recalcular hoje"/"comparar hoje" NÃO valem para orçamento enviado (copy US17). (c) Payload QUOTE precisa de `modelVersion` e `schemaVersion` (`ck_snapshots_payload_version_matches` `:606`, `ck_snapshots_payload_schema_matches` `:627`) — §4 do data-model não lista. (d) O exportador é o grosso do trabalho (ver T082). | BLOQUEIA | 0009 = DROP+ADD dos três CHECKs no mesmo ato (SQL abaixo); `history.py` `_BASIS_TOTAL_KEY` + `Literal`s (`:109,:119`); `quote_render.py` `_BASIS_TOTAL`/`_BASIS_CAPTION` + ramo `QUOTE` em `build_quote_view` (`:179-241`) + bloco bruto→desconto→total; front `frozen-payload.ts` (`kind` `:140`, `FrozenTotals.precoOrcamento?` `:70-73`, `FrozenQuoteDiscount`); `recalc-today.tsx:53-56`/`compare-today.tsx` decidem que QUOTE não recalcula. |
| T089 | Mesmos comandos errados da T070. | RETRABALHO | — |

## Tasks NOVAS (estruturas sem dono)

- N1 [P] [US5] `"price_observations"` em `_OWNED_TABLES` (`test_migrations.py:41-53`).
- N2 [US5] `name_norm` × materialização de kit: `boms.py:294-306 _dedup_match` casa `Product.name == name` EXATO (docstring `:295`, ADR-0017 §3). Duas saídas: casar por `name_norm` (emenda ao ADR-0017) ou manter exato e deixar "(2)" criar quase-duplicado. Teste dos dois casos em `test_boms.py`.
- N3 [P] [US5] Fixture `name-norm.json` +3 casos (NBSP, BOM, NEL).
- N4 [US5] Contrato `import-linter` para `app.lib` (`pyproject.toml:134-138`); `uv run lint-imports` faz parte de `gate:be` (`package.json:21`).
- N5 [P] [US5] Teste do lote com (kind,id) repetido ⇒ 422 (senão `cardinality_violation` ⇒ 500 repetido para sempre).
- N6 [P] [US5] `catalog-cache.ts` tolera `sellerFixedPrice`/`sellerFixedAt` AUSENTES em entradas antigas (ausente ≠ fixado em 0,00), com teste.
- N7 [US6] `__fixtures__/generate-equality-4.1.0.mjs` + `equality-4.1.0.json` commitados ANTES de `src/index.ts` mudar.
- N8 [US6] `frozen-payload.ts` alargado + teste de que `FROZEN_PAYLOAD_SCHEMA_VERSION` continua **1** (precedente `repricedFromFrozen` `:165-171`).
- N9 [US6] Varredura da união alargada nos 8 consumidores: `pages/historico/{snapshot-detail-page,historico-page,recalc-today,compare-today}.tsx`, `features/history/{record-snapshot-sheet,export-sheet}.tsx`, `entities/history/outbox.ts`, `features/scenarios/scenario-context-bar.tsx` — por arquivo, o que um QUOTE faz e NÃO faz.

## SQL/tipos que as tasks carregam literalmente

**CHECK atual** (`0003_e4_snapshots.py:139-147`, espelho `models/__init__.py:618-626`):

```sql
headline_total = ((payload->'totals') ->> (CASE headline_basis
   WHEN 'PRECO_VAREJO'  THEN 'precoVarejo'
   WHEN 'PRECO_ATACADO' THEN 'precoAtacado'
 END))::numeric
```

**Migração 0009 — os três CHECKs no mesmo ato (não há enum):**

```python
op.drop_constraint(op.f("ck_snapshots_kind_enum"), "snapshots", type_="check")
op.create_check_constraint(op.f("ck_snapshots_kind_enum"), "snapshots",
                           "kind IN ('SINGLE','KIT','QUOTE')")
op.drop_constraint(op.f("ck_snapshots_headline_basis_enum"), "snapshots", type_="check")
op.create_check_constraint(op.f("ck_snapshots_headline_basis_enum"), "snapshots",
                           "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO','PRECO_ORCAMENTO')")
op.drop_constraint(op.f("ck_snapshots_headline_matches_totals"), "snapshots", type_="check")
op.create_check_constraint(
    op.f("ck_snapshots_headline_matches_totals"), "snapshots",
    "headline_total = ((payload->'totals') ->> ("
    "CASE headline_basis"
    " WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
    " WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
    " WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'"
    " END))::numeric",
)
```

**DDL de `price_observations` (0008):**

```python
op.create_table(
    "price_observations",
    sa.Column("id", sa.UUID(), nullable=False),
    sa.Column("owner_uid", sa.Text(), nullable=False),
    sa.Column("subject_kind", sa.Text(), nullable=False),
    sa.Column("subject_id", sa.UUID(), nullable=False),          # sem FK (ADR-0019 §5 / ADR-0021 N2)
    sa.Column("observed_price", sa.Numeric(precision=12, scale=2), nullable=False),  # MONEY_SETTLED
    sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("model_version", sa.Text(), nullable=False),
    sa.Column("catalog_version", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.CheckConstraint("subject_kind IN ('PRODUCT','KIT')", name=op.f("ck_price_observations_subject_kind_enum")),
    sa.CheckConstraint("observed_price >= 0 AND observed_price <> 'NaN'::numeric", name=op.f("ck_price_observations_observed_price_valid")),
    sa.CheckConstraint("observed_at > '-infinity' AND observed_at < 'infinity'", name=op.f("ck_price_observations_observed_at_finite")),
    sa.CheckConstraint("length(btrim(model_version)) > 0", name=op.f("ck_price_observations_model_version_set")),
    sa.ForeignKeyConstraint(["owner_uid"], ["accounts.account_uid"], name=op.f("fk_price_observations_owner_uid_accounts")),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_price_observations")),
    sa.UniqueConstraint("owner_uid", "subject_kind", "subject_id", name="uq_price_observations_subject"),
)
```

Índice do GET por conta: **nenhum** — a UNIQUE liderada por `owner_uid` já serve `WHERE owner_uid = :uid`.

**Índice único parcial (× 4 tabelas):**

```python
op.create_index("uq_products_owner_name_norm", "products", ["owner_uid", "name_norm"],
                unique=True, postgresql_where=sa.text("deleted_at IS NULL"))
# idem uq_filaments_owner_name_norm, uq_printers_owner_name_norm, uq_boms_owner_name_norm
```

**Backfill (Python dentro da migração, função COPIADA, com desempate):**

```python
import re, unicodedata
_WS = r"[ \t\n\r\f\v   -     　﻿]+"

def _norm(name: str) -> str:                      # cópia congelada — NUNCA importar app.lib
    d = unicodedata.normalize("NFD", name)
    d = "".join(c for c in d if unicodedata.category(c) != "Mn")
    return re.sub(_WS, " ", re.sub(r"^%s|%s$" % (_WS, _WS), "", d.lower()))

def _backfill(conn, table):
    rows = conn.execute(sa.text(
        f"SELECT id, owner_uid, name, deleted_at FROM {table} ORDER BY created_at, id")).fetchall()
    seen: set[tuple[str, str]] = set()             # (owner_uid, name_norm) VIVOS já usados
    for r in rows:
        base = _norm(r.name); cand = base; n = 1
        if r.deleted_at is None:
            while (r.owner_uid, cand) in seen:      # colisão LEGADA: desempata em silêncio
                n += 1; cand = f"{base} ({n})"
            seen.add((r.owner_uid, cand))
        conn.execute(sa.text(f"UPDATE {table} SET name_norm = :v WHERE id = :i"), {"v": cand, "i": r.id})
```

## Decisões que a autoridade já responde (fonte)

1. `downgrade()` da 0008 reversível no esquema; valores de `seller_fixed_price` morrem (molde `0007_remove_waste.py:14-27` + deploy adiado).
2. `downgrade()` da 0009 irreversível com QUOTE (`trg_snapshots_forbid_delete`, `0006:106-159`) — declarar.
3. Enum vs CHECK: não há enum Postgres em lugar nenhum.
4. Gatilho de imutabilidade cobre `QUOTE` (`0003:181-188`).
5. `payload_schema_version` continua **1** (`repricedFromFrozen` entrou sem bump, `frozen-payload.ts:165-171`); o payload traz `schemaVersion: 1`.
6. `model_version` do snapshot = `PRICING_MODEL_VERSION` do cliente (`ck_snapshots_payload_version_matches`, models:606); antigos continuam 4.1.0/4.0.0 (`isPreRemovalModel`, `recalc-today.tsx:64`).
7. CSV: nenhuma coluna nova (FR-513; `_CSV_FIELDS` `:57`, `export.py:55-66`).
8. Endpoint de export real: `GET /api/v1/history/{snapshot_id}/quote.pdf` (`export.py:78-84`) e `GET /api/v1/history/export.csv` (`:38-42`) — `api-019.md` diz `/history/{id}/export?format=pdf`: **corrigir o contrato**.
9. `quoteValidityDays` NÃO vai no payload — é coluna (`models:652`), o PDF já a imprime (`quote_render.py:312-313`). Remover da §4 do data-model.
10. Nenhum `ErrorCode` novo (`app/errors.py:22-41`).
11. `ProductOut` sem dinheiro é prova de TESTE, não do drift-guard.
12. "Fixar não compõe" é estrutural (`BomLineOut` `boms.py:190-211` sem preço; `PriceInput` `index.ts:144-175` sem preço).

## Decisões que só o dono responde

1. **Quem carimba `observed_at`**: (a) servidor (`now()`) e o campo sai do corpo — 75%; (b) cliente manda e a coluna se chama `device_observed_at` — 60%; (c) cliente manda em `observed_at` (redação atual do ADR) — contradiz o precedente `device_` (models `:653-658`) — 20%.
2. **`_dedup_match` de kit**: normalizado (emenda ao ADR-0017 §3) — recomendado 70% — ou exato + "(2)".
3. **Forma de `payload.lines` do QUOTE**: (a) reusar `FrozenKitLine` (`frozen-payload.ts:111-121`) com `totals.precoVarejo` por linha e `precoOrcamento` só na raiz — 80%; (b) forma nova `{unitPrice, subtotal}` — 55%; (c) desconto por linha — proibido (ADR-0034 §1.2).
4. **Onde mora `name_norm`**: `app/lib/name_norm.py` + contrato (75%) ou `app/validation.py` (60%).
5. **Teto do lote do PUT**: proposta **500** (ADR raciocina sobre 200 produtos por conta).
