# Contrato — mudanças de wire (PR-D, remoção do wasteGrams)

Fluxo obrigatório após qualquer mudança: `export_openapi` + `gen:api` da RAIZ + prova de
idempotência (o drift-guard da CI falha em contrato stale — lição 009/E4).

## Campos que SAEM do contrato

| schema | campo | consumidores afetados |
| --- | --- | --- |
| `FilamentIn` / `FilamentOut` | `defaultWasteGrams` | catálogo de filamentos (CRUD + prefill) |
| `PieceInputs` (produtos, BOM) | `wasteGrams` | produtos, kits, `lastKnown` de cenários |

`app/api/scenarios.py` para de emitir a folha em `lastKnown`; `app/api/boms.py` para de
sincronizar a coluna (que a migração `0003` derruba).

## Postura com cliente VELHO (aba em cache com bundle antigo)

`FilamentIn` e `PieceInputs` passam a **`extra="forbid"`**: um POST/PUT que ainda envie o campo
recebe **422** com mensagem nomeando a mudança de modelo (pricing-core 4.0.0). Racional: o default
do Pydantic (ignorar) faria o vendedor salvar acreditando que o desperdício entrou na conta e ver
outro preço — a mentira silenciosa que o incremento existe para matar. Falhar alto > mentir.

## O que NÃO muda

- Snapshots congelados (ADR-0019) e outbox (ADR-0018): payloads opacos, aceitos como estão —
  imutabilidade intocada; `wasteGrams` DENTRO de payload congelado antigo continua existindo e
  sendo exibido (é o que foi cotado).
- Rotas, códigos de erro (`ErrorCode`), correlação, autenticação: intocados.
- Nenhum endpoint novo neste incremento.

## Critérios de aceitação do contrato

1. Regen idempotente: segunda rodada de `export_openapi` + `gen:api` produz diff vazio.
2. Contract tests (Schemathesis) verdes contra o schema novo.
3. Teste de postura: request com `wasteGrams` presente → 422 nomeando o campo (não 200 silencioso).
