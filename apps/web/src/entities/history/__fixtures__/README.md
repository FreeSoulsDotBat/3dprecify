# Documentos congelados de ANTES — proveniência

## `frozen-payload-pre-adr-0024.json`

Três `FrozenSnapshotPayload` **gerados pelo código do commit `1212a16`** — a base desta branch
(`014-fee-category-mapping`), anterior ao ADR-0024 e ao campo `bandMode`. Não foram escritos à mão.

**Como foram produzidos** (para reprodução; o script é descartável e não vive no repositório):

1. Extrair as fontes daquele commit — `packages/pricing-core/src/{index,channels,rounding}.ts` e
   `apps/web/src/entities/history/frozen-payload.ts` — com `git show 1212a16:<caminho>`, dentro de
   `packages/pricing-core/` (é o único pacote onde o `decimal.js-light` resolve).
2. Chamar o `computeCalculator` + `freezePriceResult` **daquele dia** sobre o vetor canônico SC-001
   em três escalas (×1, ×2,5, ×5), com um canal Shopee carregando as bandas **reais** do
   `catalog.json` committed em `1212a16` (`catalogVersion` 2026-07-07.0) e um canal Mercado Livre de
   taxa simples.
3. Escrever o array aqui e apagar a extração.

**Por que três.** Os anúncios varejo caem em bandas publicadas diferentes — R$ 58,73 (`[0, 80)`),
R$ 97,36 (`[80, 100)`) e R$ 149,98 (`[100, 200)`) — e o voucher de frete (≥ 79) só entra nos dois
últimos. É onde seleção e parcela divergem; um documento só não tocaria o caminho que o ADR-0024
mudou. Medido: inverter o padrão de `bandMode` reprova **dois** dos três — o primeiro sobrevive
porque abaixo do primeiro limiar os dois modos coincidem, o que é a matemática correta.

**Regra.** Este arquivo é um artefato do passado: ele **não se regenera** quando um teste reprova.
Um teste que reprova contra ele está dizendo que o passado se moveu, e é o código de hoje que precisa
de conserto — não o fixture. Consumido por `frozen-payload.test.ts` (SC-815 / T083).
