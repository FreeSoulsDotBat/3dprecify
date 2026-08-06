# Contrato — pricing-core 4.x (016)

O pacote `packages/pricing-core` é a fórmula canônica (TS, offline); o backend NUNCA recalcula.
Este contrato descreve a superfície pública nas duas versões que o 016 cria.

## 4.0.0 (PR-D — MAJOR: remoção de campo de entrada)

**Quebra**: `PricingInput` não aceita mais `wasteGrams`. A recusa é NOMINAL e por CHAVE PRESENTE:

```
computeCalculator(input):
  para cada f em RETIRED_INPUT_FIELDS:            # ["wasteGrams"]
    se f in input → throw ValidationError(field=f, "…removido em 4.0.0 — use stripRetiredFields()")
  # só então valida e computa; computeBom herda por linha
```

**Novas exportações** (a regra de leitura mora AQUI, não no app):

```
stripRetiredFields<T>(stored: T) → { kept: Omit<T, retired>, discarded: {field, value}[] }
  # pura; remove por delete (nunca atribui undefined); genérica na folha
isPreRemovalModel(modelVersion: string) → boolean     # major < 4
PRICING_MODEL_VERSION = "4.0.0"                        # amarrado ao major do package.json
```

**Semântica**: material = `gramas × custo/kg` (o desperdício deixa de existir como entrada).
Todo teste numérico canônico é re-baselinado NESTA fatia, com o vermelho observado antes.

## 4.1.0 (PR-F — MINOR: extensões aditivas; ausência = 4.0.0)

```
PriceBand += fixedFeeRule?: { kind: "PCT_OF_PRICE", pct }     # pct ∈ (0,100)
ChannelInput += surcharges?: { label, value }[]
ChannelResult += surcharges: { label, value }[]                # ecoado
```

**Regras**:
- `bandFixedFee(band, L) = fixedFeeRule ? L×pct/100 : fixedFee` — usada nas TRÊS chamadas
  (grossUpOnce · chooseBand.at · finish). Gross-up permanece fechado:
  `L = base / (1 − c/100 − p/100)`.
- `fixoEfetivo = bandFixedFee + Σ surcharges.value` — a sobretaxa ATRAVESSA a banda (um `fixedFee`
  digitado é inerte sobre entrada bandada — 013/F1; a sobretaxa não pode herdar essa inércia).
- Recusas: `fixedFeeRule` fora de `bandMode SELECTION`; `c + pct ≥ 100` numa banda (denominador).
- Compat: payload sem os campos novos ⇒ resultado byte-idêntico a 4.0.0 (testado com fixture
  congelado pré-016).

## Invariantes de teste (ambas as versões)

1. Varredura de LIMIAR: bases cujo anúncio cruza R$ 8 (Shopee CNPJ) — par (anúncio, líquido)
   contínuo e sem banda emprestada (I9).
2. Byte-idêntico: toda combinação sem campo novo reproduz o resultado anterior bit a bit.
3. Não-vacuidade por mutação (padrão da casa): mudar `pct` ou `value` muda o resultado.
