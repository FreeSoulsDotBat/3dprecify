# F03a — Motor de preço, núcleo

## Resumo

Seis casos-ouro **calculados à mão** e confrontados com o motor: **os seis batem, dígito a dígito**.
Nenhuma divergência numérica no núcleo. As três propriedades que mais podiam morder estão corretas e
foram verificadas por caso construído, não por leitura: o arredondamento é **half-up de verdade**
(0,005 → 0,01, e não 0,00 de banqueiro), o dinheiro **não passa por ponto flutuante** (0,1 + 0,2 dá
0,30 exato), e o **detalhamento fecha** — as sete linhas exibidas somam exatamente o custo total,
porque cada agregado é a soma de linhas JÁ arredondadas. Divisão por zero é impossível nos dois
denominadores (`rollWeightKg` e `machineLifetimeHours` são `assertPositive`).
**Um achado**: o pacote não carrega sob `node` puro (imports relativos sem extensão) — a mesma classe
que foi consertada no `fee-ingest` e não aqui. Não bloqueia provisionamento. **Duas observações** com
pergunta: `failurePct` e os markups não têm teto.

---

## Método

Projetei seis entradas **antes** de executar, cada uma mirando uma propriedade específica; calculei a
saída esperada à mão; só então rodei o motor e comparei. As entradas e o resultado bruto do motor
ficam em `../evidencias/F03a-casos-ouro.json`.

**Desvio de R8 declarado**: para EXECUTAR os casos foi preciso um arquivo dentro de
`packages/pricing-core/tests/` (ver §[F03a-001] — o pacote não roda sob `node` puro). O arquivo foi
criado, executado e **apagado na mesma fase**; `git status` fora de `docs/homologacao/` voltou vazio,
verificado. Nenhuma linha de produção foi alterada.

---

## Tabela de casos-ouro

Fórmula auditada (`packages/pricing-core/src/index.ts:168-215`):

```
material   = costPerRoll / (rollWeightKg × 1000) × (printGrams + wasteGrams)     [:168]
energy     = printTimeHours × avgPowerKw × tariffPerKwh                          [:174]
machine    = (machineValue / machineLifetimeHours + manutencao/h) × printTimeHours [:180]
produção   = arred(material) + arred(energy) + arred(machine)                    [:192]
falha      = produção × failurePct / 100          ← sobre o subtotal ARREDONDADO  [:193]
finishing  = finishTimeHours × finishRatePerHour                                 [:196]
labor      = laborHours × laborRatePerHour                                       [:197]
admin      = Σ arred(otherCosts[].value)                                         [:205]
custoTotal = Σ das SETE linhas já arredondadas                                   [:207]
varejo     = custoTotal × (1 + markupVarejoPct/100)                              [:210]
atacado    = custoTotal × (1 + markupAtacadoPct/100)                             [:213]
```

| caso | o que testa | calculado à mão | motor | bate? |
| --- | --- | --- | --- | --- |
| **G1** — 120/1kg, 100g, 5h, 0,15kW, R$1/kWh, máquina 3000/3000h, falha 10%, markup 100/50 | o caminho base | mat 12,00 · ene 0,75 · máq 5,00 · falha 17,75×0,10 = 1,775 → **1,78** · custo **19,53** · varejo **39,06** · atacado 19,53×1,5 = 29,295 → **29,30** | idênticos | ✅ |
| **G2** — 0,1/1kg × 50g = **0,005** exato | a DIREÇÃO do arredondamento na fronteira | half-up ⇒ **0,01** (banqueiro daria 0,00) | 0,01 | ✅ |
| **G3** — tudo zero, denominadores = 1 | zero não quebra nada | tudo 0,00 | tudo 0 | ✅ |
| **G4** — `otherCosts` = 0,1 e 0,2 | ponto flutuante em dinheiro | 0,1+0,2 = **0,30** exato (float daria 0,30000000000000004) | 0,3 | ✅ |
| **G5** — falha 33,33% sobre linhas que arredondam | a falha incide sobre o subtotal ARREDONDADO | mat 3,30 · ene 0,33 · máq 0,33 ⇒ subtotal **3,96** · falha 3,96×0,3333 = 1,3199 → **1,32** · custo **5,28** | idênticos | ✅ |
| **G6** — todos os campos preenchidos, markup 0% | o detalhamento FECHA | 17,53+0,68+5,78+1,80+20,00+15,00+3,40 = **64,19**; varejo = atacado = 64,19 | idênticos | ✅ |

**Conclusão numérica: nenhuma divergência.** O que o código faz é o que a aritmética manda.

### Três propriedades confirmadas por construção

1. **Half-up é half-up.** G2 põe o valor exatamente em 0,005. Half-up dá 0,01; "round half to even"
   (o padrão de muitas linguagens) daria 0,00. O motor deu **0,01** — `rounding.ts:12` usa
   `Decimal.ROUND_HALF_UP` explicitamente, e a direção é consistente: sempre para cima na fronteira.
2. **Dinheiro nunca vira `float`.** G4 usa o par clássico. `admin` saiu **0,3**, não
   `0.30000000000000004`. Os intermediários são `Decimal` em plena precisão e só são quantizados na
   emissão (`rounding.ts:4-5`).
3. **O detalhamento fecha.** G6 tem as sete linhas preenchidas e elas somam **exatamente** o
   `custoTotal` exibido. Isso não é acidente: `sumMoney` soma linhas JÁ arredondadas
   (`index.ts:207`), então o que o vendedor vê some sem resto. A alternativa — somar em plena
   precisão e arredondar no fim — produziria um total que não bate com as parcelas na tela.

### Divisão por zero e entrada inválida

- `rollWeightKg` e `machineLifetimeHours` são `assertPositive` (`index.ts:148,155`) — os **dois**
  denominadores da fórmula. Zero **lança** antes de qualquer cálculo.
- Todo o resto é `assertNonNegative`: negativo lança, ausente cai no default 0 (`index.ts:135-143`).
- `!Number.isFinite` também lança (`index.ts:121,128`) — `NaN` e `Infinity` não entram.

---

## Achados

### [F03a-001] `pricing-core` não carrega sob `node` puro — imports relativos sem extensão

- **Severidade**: Baixo
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% (reproduzido: `ERR_MODULE_NOT_FOUND` para `.../src/channels`)
- **Local**: `packages/pricing-core/src/index.ts:12` (`from "./channels"`) e `:13`
  (`from "./rounding"`)
- **Evidência**: `node` com um `.mjs` importando `src/index.ts` falha com
  `ERR_MODULE_NOT_FOUND, url: file:///.../packages/pricing-core/src/channels`. Sob `vitest`/`vite`
  resolve, porque esses resolvedores são tolerantes.
- **Impacto**: nenhum em produção — o pacote é **empacotado pelo Vite** no cliente e o backend nunca
  o executa (FR-118: o backend não recalcula). O impacto é de ferramenta: qualquer script, prova ou
  diagnóstico que queira rodar o motor sob `node` direto não roda, e foi exatamente o que aconteceu
  nesta fase.
- **Por que vale registrar mesmo sendo Baixo**: esta MESMA classe de defeito foi encontrada e
  consertada no `packages/fee-ingest` durante a 014/US4, com a lição registrada ("uma suíte que passa
  não prova nada sobre um programa que não RODA — vitest é o resolvedor tolerante"). O conserto foi
  aplicado a um pacote e **não ao irmão**.

---

## Observações com pergunta (não são achados — são limites sem teto declarado)

### [F03a-002] `failurePct` não tem teto

`assertNonNegative` (`index.ts:157`) aceita qualquer valor ≥ 0. `failurePct = 1000` produz uma falha
de 10× o subtotal de produção, sem aviso. Não afirmo que seja defeito: um teto arbitrário também
mente. **Pergunta para `PENDENCIAS.md`**: existe um teto de produto para taxa de falha (100%? 50%?),
ou a ausência de teto é deliberada porque o número é do vendedor?

### [F03a-003] `markupVarejoPct` / `markupAtacadoPct` não têm teto nem ordem imposta

Idem (`index.ts:163-164`). Além disso **nada exige que varejo ≥ atacado** — um vendedor pode digitar
markup de atacado MAIOR que o de varejo e o motor calcula sem reclamar, produzindo um "preço de
atacado" acima do varejo. **Pergunta**: isso é entrada válida (o vendedor manda) ou é engano que a UI
deveria pelo menos sinalizar?

---

## Não verificado nesta fase

1. **O caminho por canal** (`computeChannel`, comissão, piso por item, bandas, frete/voucher) — é a
   **F03b**, deliberadamente separada.
2. **`computeBom`** (a soma por peça do E3) — não estava no escopo declarado de F03a; entra na F03b
   ou vira sub-fase própria. **Pergunta**: incluo o `computeBom` na F03b?
3. **Se a UI valida antes** do que o motor lança. O motor lança `ValidationError`; se a UI impede a
   entrada antes disso, os limites acima nunca são atingidos na prática. Isso se mede na **F08**
   (estados e erros), não aqui.
