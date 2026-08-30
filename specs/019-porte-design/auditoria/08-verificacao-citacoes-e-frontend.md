# Verificação pós-auditoria — pareceres 08: citações mecânicas (qa-software) + frontend (dev-frontend)

> 2026-08-27, só leitura. Ambos sobre o `tasks.md` reescrito.

## 08a — Citações (qa-software): 155 conferidas · 150 ok · 5 erradas (todas de LOCALIZAÇÃO)

| task | citação | real | gravidade |
| --- | --- | --- | --- |
| T081 | `0003_e4_snapshots.py:181-188` "gatilho FOR EACH ROW" | `:181-188` é o índice `ix_snapshots_owner_active`; o `CREATE TRIGGER … FOR EACH ROW` está em **`:192-197`** | moderada (linha errada no arquivo certo) |
| T079 | `index.ts:174` `PriceInput.channels?` | está em **`:173`** (`:174` é `catalogVersion?`) | baixa |
| T071 | `models/__init__.py:207-239` `Product.__table_args__` | abre em `:207` e fecha em **`:288`** (o range cortava 9 CHECKs) | moderada |
| T080/T085 | `vitest.config.ts:34`/`:36` | há 4 `vitest.config.ts`; o da RAIZ é o que exclui `__fixtures__` (**`:35`**) e tem o ratchet 100% (**`:38`**); o de `packages/pricing-core` tem 6 linhas | moderada (ambiguidade de arquivo) |
| T083 | `quote_render.py:199-213` "só ramifica KIT" | o `if snapshot.kind == "KIT":` está em **`:195`** | baixa |

Afirmações de não-existência: 9 conferidas, 0 falsas. Símbolos citados como existentes: todos existem.

## 08b — Frontend (dev-frontend): PR-B PRONTA · PR-C PRONTA COM 1 CORREÇÃO · PR-D-front PRONTA · PR-F PRONTA

| task | errado | correção |
| --- | --- | --- |
| T060 | "os DOIS wrappers `ControlledNumber`" — só existe UM (`features/catalog/catalog-controls.tsx:68`); a Calculadora usa `ControlledField` (`calculator-form.tsx:157-163`) que recebe `{control, meta: CalcFieldMeta}` e passa `<NumberField …>` em `:201-205`; `tariffPerKwh` é um `CalcFieldMeta` (`calculator-schema.ts:388-392`) | `precision?: number` entra em `CalcFieldMeta` (`calculator-schema.ts:346-360`), lido em `:201-205`; e como prop no `ControlledNumber` do catálogo — dois MECANISMOS |
| T045 | "confirmar arquivo:linha do footer do produto" | `produto-page.tsx:298` (`<fieldset disabled={lapsed}>`), Salvar removido em `:315-322`, aviso de reativação em `:324-325` |

~90 citações e as fronteiras FSD (`eslint.config.mjs:62/:77/:80-81/:83/:84/:85`) conferidas: `pages → features` ✔ (T124), `widgets → features` ✔ (bom-line-editor), `entities → shared` só ✔ (T067), `shared/billing` sem `entities` ✔ (T036). Não-existências: todas verdadeiras (`useIsListDense` inexistente — task nova legítima; `ScenarioListBody` em `scenarios-list-sheet.tsx:184`, usado em `:478`, props `onOpenScenario`/`onClose`/`lapsed`). Resíduos no `tasks.md`: nenhum. Stale: `analise-implementabilidade.md` §7.1 ("⛔ DONO").
