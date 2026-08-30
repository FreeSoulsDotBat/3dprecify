# Verificação pós-auditoria — parecer 09: dados/migrações/motor (dev-estrutura-de-dados, opus)

> 2026-08-27, só leitura. Veredito ANTES das correções: **PR-D NÃO PRONTO (9 correções, 2 quebram o upgrade) · PR-E NÃO
> PRONTO (3 defeitos de comportamento no texto — 1 é REGRESSÃO em KIT — + 6 correções)**. Todas aplicadas no `tasks.md`
> na mesma data (ver `analise-implementabilidade.md` §8).

| task | errado (arquivo:linha real) | correção aplicada |
| --- | --- | --- |
| T062 | "contra `migrated_db`" é impossível para o backfill: a fixture é session-scoped e já roda `upgrade head` (`conftest.py:74-95`, `:88`) — não há como semear legado | container PRÓPRIO (`test_migrations.py:63-76`): `upgrade("0007")` → semear → `upgrade("0008")`; asserções de estado pós-upgrade podem usar `migrated_db` |
| T062×T071 | nome de 5.000 chars faz o CHECK de 120 E o índice btree (2704 bytes) abortarem o upgrade; hoje nada limita nome (`Text`, zero `max_length` em `app/api/*.py`) | teto 120 só no pydantic (escritas novas); SEM CHECK de comprimento no banco (legado ficaria inválido); `name_norm` gravado como `left(norm, 200)` no backfill E no escritor — o índice cabe; `name` legado intocado |
| T071 | nomes de CHECK no MODELO devem ser CURTOS: `NAMING_CONVENTION["ck"] = "ck_%(table_name)s_%(constraint_name)s"` (`models:44-51`; precedente `name="kind_enum"` `:584`) | modelo: `seller_fixed_price_valid`, `subject_kind_enum`, `observed_price_valid`, `observed_at_finite`, `model_version_set`; migração: literal `op.f("ck_…")`; `UniqueConstraint`/`Index` com nome completo (`:583`, `:634`) |
| T064/T072 | "mais de 2 casas ⇒ 422 via `finite_non_negative`" é falso: `:55-65` não checa escala; nada em `backend/app/` checa (`Numeric(12,2)` arredonda calado) | `field_validator` NOVO em `PriceObservationIn`: `value.as_tuple().exponent >= -2` senão 422 — divergência consciente do resto da casa, registrada |
| T063 | a classe literal tem U+2028/U+2029 CRUS (LineTerminator em JS — regex literal não compila) e não inclui NEL (U+0085) | escapes de codepoint idênticos nos dois idiomas; **NEL fica FORA por decisão** (fixture o declara PRESERVADO); TS remove Mn com `/\p{Mn}/gu` após `normalize("NFD")`; `İ` (U+0130) no fixture |
| T072 | "8 sítios": a materialização de kit (`boms.py:431`) reusa `products.py:_apply` via `boms.py:52-53` | **7** sítios |
| T075/T127 | falta a condição de privacidade (parecer 01) | "sem persistência local" registrado na tabela de `app/providers.test.tsx:117-177` |
| T068 | há DUAS cópias de `fmtDate` (`fee-seal.tsx:40` e `calculator-form.tsx:774` `fmtDatePtBr`); `product-summary.ts:34-36` sem caminho; fuso | promover a `shared/lib/format-date.ts` absorvendo as duas; caminho citado; "fuso do APARELHO na leitura — a tabela não guarda offset" |
| T086 | **REGRESSÃO**: `_MONEY_POSITION_KEYS` ganhar `lines` marca a SUBÁRVORE (`validation.py:96-99`) — `lines[].quantity` (int) ⇒ 422 para todo KIT existente; `discount` marcaria `value` (percentual) | ganha as FOLHAS `unitPrice`, `subtotal`, `costFloor`, `amount`, `grossTotal` — nunca `lines`/`discount`; teste de não-regressão KIT com `quantity` inteiro ⇒ 201 |
| T079 | contradição: igualdades numéricas × "saída como STRING"; `custoTotal` é `:482`; `version.test.ts` asserção em `:18` (`:25` é o major "4", não muda) | `computeQuote` devolve NÚMEROS; a conversão para string é do documento (T133, `frozen-payload.ts` `toMoneyString :200-201`, incl. `discount.value`) |
| T080 | `computeBom` aceita `channels` por linha e devolve `BomResult.channels` (`:485`) | os 200 casos `bom` incluem `channels` por linha; comparação abrange `result.channels[]` |
| T080/T085 | `vitest.config.ts` do pacote tem 6 linhas | root `vitest.config.ts:35` (`__fixtures__`) e `:38` (ratchet) |
| T081 | gatilho: `0003:192-199`; função vigente = **V2 da 0006** (`0006:118-144`, aplicada `:150`); `trg_snapshots_forbid_delete` `0006:106-114,:152-159` | citações corrigidas |
| T082/T086 | `_BASIS_CAPTION` está em `:247`; 5º consumidor com fallback cru em `:350` | `:247`; teste asserta legenda TRADUZIDA |
| T082/T084 | `_assert_no_overprint` (`:894`) é função ANINHADA num teste | promover a escopo de módulo antes de reusar |
| T082 | falta o adversarial `<b>`/`&amp;` no nome do item e no rótulo do desconto | acrescentado |
| T084/T088 | "NÃO enfileira" é falso: `useRecordSnapshot` SEMPRE chama `enqueueSnapshot` (`use-history.ts:96`) e drena a fila inteira (`:100`) | online: passa transitoriamente pelo outbox (durable-first, ADR-0018) e drena; a promessa da DECISÃO 4 é que OFFLINE o botão está `disabled` e nada é enfileirado; e2e asserta um POST para ESTE orçamento (fila vazia no início); sem id do servidor não há PDF (`export.py:80-84`) — a tela diz isso |
| T078 | 4 decisões aplicadas sem registro no ADR-0033 | §Adendo datado no 0033: `observed_at` no servidor · lote 500 · nome 120 + legado · `_dedup_match` normalizado (cruza T129) |

SQL: DDL/CHECKs/índice/backfill compilam com os ajustes (nome curto no modelo; `_WS` por escapes; `name_norm` truncado a 200; `created_at`/`deleted_at` existem nas 4). Resíduos nos contratos: `api-019.md` §PR-E com `quoteValidityDays` no payload; "enum aditivo" (`api-019` e `data-model.md:57`) → "CHECK aditivo"; "composição sempre pelo motor" → "provado por ausência de campo".
