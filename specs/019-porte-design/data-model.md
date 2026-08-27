# Data model — 019 O porte do design (Fase 1)

**Resumo em uma linha**: quatro coisas novas persistidas — **observação de preço**, **preço fixado**,
**nome normalizado com unicidade**, e o **orçamento enviado** como `snapshot` de tipo `QUOTE` — todas
governadas por uma regra só: *o app nunca exibe um preço que ele mesmo calculou no passado; exibe o
cálculo de hoje ou o número que o vendedor declarou* (ADR-0033 §1). Mais três estados de interface.

Autoridade: [ADR-0033](../../docs/adr/0033-observacao-e-fixacao-de-preco.md) (PR-D) e
[ADR-0034](../../docs/adr/0034-orcamento-montado-motor-e-congelamento.md) (PR-E). Sem migração até a
PR-D; PR-A/B/C/F **não tocam dado persistido**.

---

## 1. `price_observations` (NOVA — migração 0008, PR-D)

| campo | tipo | regra |
| --- | --- | --- |
| `id` | uuid7 | PK |
| `owner_uid` | FK → `accounts` | a **única** FK |
| `subject_kind` | TEXT `CHECK IN ('PRODUCT','KIT')` | |
| `subject_id` | uuid **sem FK** | resolve ou não resolve (precedente ADR-0019 §5 / ADR-0021 N2) |
| `observed_price` | `MONEY_SETTLED NOT NULL` | `>= 0 AND <> 'NaN'` |
| `observed_at` | timestamptz NOT NULL | |
| `model_version` | TEXT NOT NULL | registro, não regra |
| `catalog_version` | TEXT NULL | registro, não regra |
| `created_at` / `updated_at` | timestamptz | |

**`UNIQUE (owner_uid, subject_kind, subject_id)`** — **uma linha por item**, atualizada no lugar
(append-only rejeitado: ~73k linhas/conta/ano das quais só a última é lida).

**Quem escreve**: o **cliente**, em lote (`PUT`), **depois** de um recompute bem-sucedido de todos os
itens exibidos. O servidor valida e guarda; não deriva, não compara, não conta. **Falha na escrita ⇒ a
marca não avança ⇒ o aviso repete** (honesto). Escrever antes de exibir esconderia uma mudança — proibido.
**Online-only, sem outbox.**

**Derivação no cliente**: `mudou = observado != recomputadoHoje`; "3 preços mudaram" = contagem; "era
R$ X" = `observed_price`; "Salvo em DD/MM" = `observed_at`. **Ausência é ausência**: sem linha, nada é
exibido (nem "0 mudaram", nem "era R$ 0,00").

**Efeito visível e aceito**: recarregar a página "consome" a visita.

## 2. `products.seller_fixed_price` + `seller_fixed_at` (NOVOS — migração 0008, PR-D)

| campo | tipo | regra |
| --- | --- | --- |
| `seller_fixed_price` | `MONEY_SETTLED NULL` | `NULL OR (>= 0 AND <> 'NaN')`; `NULL` = acompanhando o custo |
| `seller_fixed_at` | timestamptz NULL | quando fixou |

- Fixado, a tela mostra **o número do vendedor** (como declaração); o custo continua recomputado ao
  lado; `custoHoje > seller_fixed_price` ⇒ aviso tom ATENÇÃO. **Nunca desfixa sozinho** (Q4).
- **Não compõe**: kit (`computeBom`), orçamento (`computeQuote`) e cenário seguem o motor — o fixado é o
  preço do ANÚNCIO (embute comissão) e usá-lo em venda direta cobraria comissão inexistente.
- Desfixar = `NULL` de volta, sem etapa intermediária. Não toca Orçamentos nem Histórico.

## 3. `name_norm` + unicidade (NOVO — migração 0008, PR-D)

Em `filaments`, `printers`, `products`, `boms`: `name_norm TEXT NOT NULL` + índice único **parcial**
`UNIQUE (owner_uid, name_norm) WHERE deleted_at IS NULL`. "Por tipo" cai de graça (tabelas diferentes).

**Normalização (uma definição, dois idiomas)**: `NFD` → remover marcas combinantes (`Mn`) → minúsculas
(`lower()` / `toLowerCase()` — **não** `casefold()`, diverge em `ß`) → `trim` → colapsar espaços
internos. **Vetor de casos compartilhado** (fixture única lida por pytest e vitest); o servidor é a
autoridade.

**Dois comportamentos**: no **formulário** (cliente, online) a recusa "já está no catálogo" ANTES de
enviar; no **servidor**, conflito ⇒ **renomeia com sufixo "(2)", "(3)"… em silêncio** (Q5 — sem aviso,
sem descarte). Exercitado como **corrida de concorrência** no servidor (duas criações simultâneas), não
como outbox — catálogo é online-only (medido; research §C-3).

## 4. `snapshots` — o orçamento enviado (migração 0009, PR-E)

Enums aditivos: `kind IN ('SINGLE','KIT','QUOTE')` · `headline_basis IN
('PRECO_VAREJO','PRECO_ATACADO','PRECO_ORCAMENTO')`. **Na mesma migração**: o `CASE` do `CHECK
headline_matches_totals` ganha `WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'` — sem isso o `CASE`
devolve NULL e o `CHECK` **passa em silêncio** (ADR-0034 §2). Teste insere total divergente e **espera
a recusa**. Espelho na aplicação: `_BASIS_TOTAL_KEY` + `Literal` com guarda de igualdade de conjuntos.

**Payload congelado (envelope plano do E4/Option A)**, para `kind: "QUOTE"`:

```
{ kind: "QUOTE",
  lines: [{ name, quantity, unitPrice, subtotal, origin }],   // FrozenQuoteLine — lida por um ramo QUOTE NOVO em
                                                              // build_quote_view (o PDF de hoje lê line.totals[key]; "a forma
                                                              // que o PDF já lê" era FALSA — auditoria 27/08). Dinheiro = STRING.
  totals: { precoOrcamento },                                 // = netTotal = headline_total
  discount: { mode: "PCT"|"AMOUNT", value, amount, grossTotal },  // DECLARADO, nunca embutido; value TAMBÉM string
                                                              // (validation.py:106 rejeita float); amount/grossTotal entram em
                                                              // _MONEY_POSITION_KEYS; coerência validada no pydantic (422)
  costFloor,                                                  // custoTotal do motor
  modelVersion: "4.2.0", schemaVersion: 1 }                    // exigidos pelos CHECKs :606/:627. quoteValidityDays
                                                              // NÃO entra no payload: é COLUNA (models:652) e o PDF já a
                                                              // imprime — "Válido até" é TEXTO derivado dela
```

Gatilho de imutabilidade, `UNIQUE (owner_uid, client_snapshot_id)` e `PATCH` só-de-`label`: **intactos**.
"Enviar" = este snapshot + PDF (ADR-0020) com as linhas bruto → desconto → total quando houver `discount`.

## 5. `computeQuote` (pricing-core 4.2.0 — MINOR, PR-E)

```
computeQuote({ lines: BomLineInput[], discount?: { mode: "PCT"|"AMOUNT"; value: number } })
  -> { bom: BomResult; grossTotal; discountAmount; netTotal; costFloor; belowCost: boolean }
```

`grossTotal = bom.precoVarejo` (venda direta, sem canal) · desconto no TOTAL, uma vez, `Decimal` +
`toMoney` (ADR-0008) · `costFloor = bom.custoTotal` · `belowCost = netTotal < costFloor` (estrito) ·
desconto > total ⇒ `ValidationError` (nunca negativo) · nada de canal/banda/tarifa. **Antes do bump**:
varredura de igualdade 4.1.0↔4.2.0 sobre `computeCalculator`/`computeBom`.

---

## 6. Estados de interface (novos, não persistidos no servidor)

| estado | onde | chave / forma | regra |
| --- | --- | --- | --- |
| Dispensa do selo de procedência | `localStorage`, device-scoped, **sem uid** (identificador de fonte pública) | conjunto limitado de `(marketplace, source, effectiveDate)` | chave ausente ⇒ não dispensado ⇒ o selo reaparece quando a fonte muda (D3), sem comparação de datas (research §G) |
| "Entendi" da plausibilidade | store em memória (`features/calculator`) | `${campo}:${valorNormalizado}` | morre ao recarregar; `850`→dispensado, `2.400`→volta (§H) |
| `premiumGate` | função pura em `shared/billing` sobre `{status}` do entitlement + sessão | união `active \| lapsed-com-itens \| free-nunca-teve \| unknown` | decidida pelo LEDGER (o servidor já expõe `none\|lapsed\|active`); `unknown` nunca presume (§E-1) |
| Resumo fixo do preço (T212) | CSS `position: sticky` no topo da coluna do formulário, mobile 390px | — | nunca `fixed` no rodapé (o slot é do toaster); guarda de geometria nos dois eixos (§I) |

## 7. O que continua vindo do servidor sem mudança

Entitlement (`GET /api/v1/entitlement` — única fonte do plano; **não muda**), identidade, assinatura,
catálogo de tarifas (`catalogVersion` intocado), lista/detalhe de orçamentos (só o enum cresce), cenários.
`ProductOut` continua **sem campo de dinheiro derivado de cálculo** — verificável pelo drift-guard.
