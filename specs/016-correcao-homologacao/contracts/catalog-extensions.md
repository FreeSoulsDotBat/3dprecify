# Contrato — extensões do catálogo de tarifas (016)

Consumidores: cliente (prefill/render), backend (serve + valida), fee-ingest (gera + guardrails).
Regra mestra (I4/ADR-0024): **aditivo; ausência = comportamento de hoje**; um catálogo CACHEADO
offline de cliente antigo permanece válido e com o mesmo significado.

## Nível de MARKETPLACE

```
MarketplaceCatalog += {
  feeAxes?: ("commissionPct"|"fixedFee"|"minPerItem"|"freight")[] | null
    # dirige QUAIS campos numéricos a tela mostra; ausência = os 4 (tela de hoje)
    # curadoria 016: SHOPEE [commissionPct, fixedFee, freight]
    #                AMAZON [commissionPct, fixedFee, minPerItem]
    #                ML     [commissionPct, fixedFee, freight]   (comportamento de hoje; parte ML adiada)
  optionalSurcharges?: {
    id, label, value, appliesPer: "ORDER"|"ITEM",          # appliesPer dirige a LEGENDA (Q5)
    source, sourceUrl, effectiveDate, lastReviewed          # procedência própria (I6)
  }[] | null
    # 016: SHOPEE [{ id: MANUSEIO_VOLUMOSO, value: 50.00, appliesPer: ORDER, art. 3305 }]
}
```

## `determinantsSchema` (SHOPEE)

```
SHOPEE += sellerProfile: ["CPF", "CPF_ALTO_VOLUME"]
  # CNPJ NÃO é valor: é a AUSÊNCIA da chave (entrada catch-all de hoje, intocada)
  # mapeamento de tela → determinante em UMA função (slotDeterminants):
  #   CPF + altoVolume → CPF_ALTO_VOLUME · CPF → CPF · CNPJ/sem resposta → (sem chave)
```

## Nível de ENTRADA

```
FeeEntry += fixedFeeSource?: { source, sourceUrl, effectiveDate, lastReviewed }
  # quando a taxa fixa vem de fonte/data ≠ da comissão (Amazon INDIVIDUAL: /precos)
  # metadado de selo — NÃO chega ao motor nem a ChannelInput
PriceBand (catálogo) += fixedFeeRule?: { kind: "PCT_OF_PRICE", pct }
  # espelha o contrato do motor; superRefine: só com bandMode SELECTION
```

**Refine novo (FR-928)**: banda com `fixedFee == null` E sem `fixedFeeRule` é INVÁLIDA — a janela
sem valor publicado se expressa como AUSÊNCIA de banda (estado I9, "sem referência — informe"),
nunca como zero.

## Mudanças de DADO (PR-F, com `catalogVersion` bump único via `nextCatalogVersion`)

| dado | mudança | fonte |
| --- | --- | --- |
| Amazon `plan=INDIVIDUAL` (38 entradas) | `fixedFee 0 → 2.00` + `fixedFeeSource` | /precos (estável ≥ dez/2020, MEDIDO) |
| Shopee CNPJ banda `[0,80)` | parte em `[0,8)` (fixedFeeRule) + `[8,80)` (fixedFee 4) | art. 26839 — **número só após releitura VERBATIM** (§9.3) |
| Shopee entradas CPF / CPF_ALTO_VOLUME | novas; bandas começam em **R$ 12** (abaixo: I9 + aviso US17) | art. 26839 |
| Shopee `optionalSurcharges` | MANUSEIO_VOLUMOSO 50.00/ORDER | art. 3305, vigência 02/02/2026 |

## O que este contrato NÃO contém (adiado — ADR-0025 Proposed)

`fixedCostMatrix` (custo fixo ML logística × faixa × peso), `resolveFixedCost`,
`ChannelSlotOutcome.logistics` — voltam com a fatia US6-ML/017. Nenhum consumidor deve referenciar
esses nomes em 016.
