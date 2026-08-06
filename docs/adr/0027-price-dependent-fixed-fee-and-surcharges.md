# ADR-0027 — Taxa fixa como **função do preço** e sobretaxas por item (pricing-core 4.1.0)

- **Status**: Proposto
- **Data**: 2026-08-05
- **Contexto**: 016-correcao-homologacao (US16 · US18 · FR-923/927; clarify Q5 e Q8) — escalação opus
  do ADR-0022 (regra de preço no domínio de pricing)
- **Decide**: como representar (a) um adicional que é **percentual do preço final** e (b) um custo
  **opcional por item** que o vendedor declara — sem reinterpretar nenhum payload já gravado.
- **Relaciona**: ADR-0024 (o padrão aditivo e o `bandMode`) · ADR-0011 (o ponto fixo de banda) ·
  ADR-0008 (arredondamento) · ADR-0019 · ADR-0021 · ADR-0025 (blocos de nível de marketplace).

---

## 1. O problema, medido

**(a) A lacuna E2.** A Shopee publica, para vendedor **CNPJ**, que abaixo de **R$ 8,00** o adicional é
**metade do preço do produto** — e a faixa "20% + R$ 4" passa a valer a partir de R$ 8 (art. 26839).
Nosso `fixedFee` é constante por banda. Consequência hoje: **superestimamos a taxa de item muito
barato** — chaveiro e brinde, o caso mais comum de impressão 3D.

**(b) Um custo real que nenhuma banda descreve.** A Shopee cobra **R$ 50,00 por pedido** de manuseio de
item volumoso (art. 3305, vigência 02/02/2026, OFICIAL). Não é comissão, não varia por faixa, e o
vendedor só descobre no extrato. Decisão do dono **D13**: campo opcional que **soma no cálculo**, com
a legenda dizendo que a taxa é por **pedido** (clarify Q5) — a calculadora precifica por unidade, o
multi-item superestima, e isso fica dito.

## 2. As restrições que decidem o formato

1. **O preço é o ponto fixo.** O adicional de 50% depende do **anúncio**, que só existe depois do
   gross-up. Ao contrário do peso (ADR-0025 §3.2), isto **não pode** ser resolvido no cliente: uma
   "estimativa de preço" para escolher a regra antes do gross-up seria um segundo motor de preço fora
   do `pricing-core`.
2. **ADR-0024 §2**: `priceBands` e `ChannelInput` atravessam payload congelado (imutável), documento
   de cenário, wire e artefato. **Aditivo, e a ausência tem de significar o comportamento antigo.**
3. **A regra 013/F1 é uma armadilha aqui**: um `fixedFee` digitado/derivado é **inerte** sobre uma
   entrada bandada (na banda, `pricing-core` toma comissão **e** fixo da banda que contém o anúncio).
   Somar R$ 50 ao `fixedFee` da Shopee **não faria nada** — R$ 50 desaparecendo em silêncio.

## 3. Decisão

### 3.1 `fixedFeeRule` — opcional, **na banda**

```ts
/** Como a taxa FIXA desta banda se forma. AUSENTE = a constante `fixedFee` — o significado que todo
 *  payload gravado antes desta mudança já tem (a mesma disciplina do `bandMode`, ADR-0024). */
type FixedFeeRule = { kind: "PCT_OF_PRICE"; pct: number };   // pct ∈ (0, 100)

interface PriceBand {
  minPrice: number; maxPrice: number | null;
  commissionPct: number;
  fixedFee: number;             // continua obrigatório: é o valor quando não há regra
  fixedFeeRule?: FixedFeeRule;  // ADITIVO
}
```

Na banda, e não na entrada, porque a regra **descreve uma janela de preço** — que é exatamente o que
uma banda é. Uma regra no nível da entrada faria dois lugares descreverem o que acontece abaixo de
R$ 8 (a banda `[0,80)` continuaria afirmando `fixedFee 4`), e a precedência viraria regra escondida.

**Uma única leitura, usada nos três pontos** — e é aí que um esquecimento vira dinheiro errado:

```
bandFixedFee(banda, anuncio) = banda.fixedFeeRule ? anuncio × pct/100 : banda.fixedFee
```
1. `grossUpOnce` — a álgebra continua **fechada e linear**: `L − (c/100)L − (p/100)L = base`
   ⇒ `L = base / (1 − c/100 − p/100)`. Sem iteração nova, sem cap terminal.
2. `chooseBand.at()` — `net = anuncio − charged − bandFixedFee(applied, anuncio)`.
3. `grossUp.finish()` — o fixo deduzido do líquido.

**Restrições recusadas no schema, não toleradas em silêncio:**
- `fixedFeeRule` só tem significado em `bandMode: "SELECTION"`. Uma entrada `PROGRESSIVE` que a carregue
  é erro de forma → `superRefine` recusa (irmão do refine "bandMode sem bandas").
- Por banda, `c/100 + p/100 < 1` — senão o denominador zera ou inverte. Recusa no schema **e** erro por
  slot no motor: nunca um `Infinity` sob selo.

**Dado**: a banda Shopee CNPJ `[0, 80)` **parte em duas** — `[0, 8)` com regra de 50% e `[8, 80)` com
`fixedFee 4`. Muda conteúdo ⇒ `catalogVersion` bumpa.

### 3.2 `surcharges[]` — no canal, com o valor vindo do CATÁLOGO

```ts
// catálogo, nível de MARKETPLACE (ADR-0025) — o número NUNCA no código (Constituição II)
interface OptionalSurcharge {
  id: string; label: string; value: number;
  appliesPer: "ORDER" | "ITEM";     // dirige a LEGENDA (clarify Q5), não a aritmética
  source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string;
}
interface MarketplaceCatalog { optionalSurcharges?: OptionalSurcharge[] | null }

// pricing-core — ADITIVO, ausência = byte-idêntico (US16-AC2)
interface ChannelSurcharge { label: string; value: number }
interface ChannelInput  { surcharges?: ChannelSurcharge[] }
interface ChannelResult { surcharges: ChannelSurcharge[] }   // ecoado, para a legenda e o PDF
```

**Aritmética**: somada **por cima** do fixo em **todos** os regimes —
`fixoEfetivo(banda, L) = bandFixedFee(banda, L) + Σ surcharges.value`. Ela **atravessa a banda** de
propósito: é a resposta direta à restrição §2.3.

**Array rotulado, não escalar**: a FR-923 exige a legenda ("a taxa é por pedido") e o breakdown/PDF
imprime linhas que se nomeiam. Um escalar perderia o rótulo — e o rótulo é o que impede a
superestimação multi-item de virar surpresa no extrato.

**Campo na tela**: um checkbox por sobretaxa **declarada pelo catálogo** (o princípio da US12 aplicado
a si mesmo). Zero string e zero número no código; a próxima sobretaxa é dado, não código.

**Persistência**: `ScenarioChannelIntent.surcharges?: string[]` (ids) — **intenção**, ADR-0021; o valor
resolve ao vivo contra o catálogo de hoje. Ausência = nenhuma = byte-idêntico. No congelado, as
sobretaxas resolvidas viajam dentro de `inputs.channels[].surcharges` pelo `freezeInput` recursivo que
já existe — **nenhuma forma nova no envelope congelado**.

### 3.3 Versão

Ambas as adições são opcionais e a ausência preserva o comportamento ⇒ **MINOR**: `4.0.0 → 4.1.0`
(sobre a 4.0.0 do ADR-0026, que precede esta fatia).

### 3.4 O que este ADR **não** faz

- **Não** modela a regressiva CPF abaixo de R$ 12: a fórmula **não é publicada** (só dois pontos
  oficiais). A hipótese linear `R$ 4 + 0,25×preço` é colinear com os pontos e **não é fato** — ela não
  entra em lugar nenhum (D12/US17: aviso honesto).
- **Não** modela o ajuste de frete aferido (art. 4478): é recálculo caso a caso pela tabela da
  transportadora, incalculável por natureza — fica como aviso.
- **Não** transforma `fixedFee` em função arbitrária do preço. `PCT_OF_PRICE` é o **caso mínimo** que a
  fonte publica; qualquer outra forma (`kind` novo) é decisão nova.

## 4. Alternativas consideradas

| | por que não | confiança |
| --- | --- | --- |
| **Modelar o < R$ 8 como `commissionPct: 70`** (20 + 50) | Mente na composição: o selo exibiria "Comissão 70%" — número que a Shopee não publica — e `minPerItem`/relatórios leriam a soma como alíquota. | 93% |
| **Regra no nível da ENTRADA** (`lowPriceRule: { belowPrice: 8, … }`) | Dois lugares descrevendo a mesma janela; precedência vira regra escondida. | 86% |
| **Resolver a regra no cliente**, como o peso do ADR-0025 | Impossível: o preço é o ponto fixo. Exigiria um segundo motor de preço fora do `pricing-core`. | 95% |
| **Volumoso como `fixedFee` somado no prefill** | **Silenciosamente não faria nada** sobre a entrada bandada da Shopee (regra 013/F1) — R$ 50 desaparecendo sob um selo que diz que as taxas foram ajustadas. É a classe E1-02 de volta. | 92% |
| **Volumoso como campo escalar `bulkyItemFee` no `PriceInput`** | Ou entraria em `custo_total` (proibido — nenhuma taxa de marketplace entra no custo) ou seria um segundo caminho de taxa de canal fora de `ChannelInput`. E hard-codaria R$ 50 no motor. | 88% |
| **Volumoso rateado por "itens por pedido"** | **Já decidido pelo dono** (clarify Q5): somar inteiro + legenda. Promover a rateio depois é pequeno e reversível — o `appliesPer: "ORDER"` já é o gancho. | — |
| **Deixar a lacuna E2 fora** (posição original do brief §6.5) | **Reaberta pelo dono no clarify Q8**: a regra é oficial, publicada e determinística. | — |

## 5. Consequências

**Boas**
- Paramos de superestimar o item barato CNPJ, com uma forma que a fonte publica e que o gross-up
  resolve em forma fechada (nenhuma iteração nova).
- O R$ 50 do volumoso passa a existir na conta **com rótulo e procedência**, e a próxima sobretaxa de
  qualquer marketplace é dado.
- `appliesPer` deixa o caminho pronto para o rateio, sem prometê-lo.

**Custos e riscos**
- Toca `packages/pricing-core` (ratchet de 100%) e a superfície de wire: `fixedFeeRule` e `surcharges`
  atravessam Orval, o schema do catálogo, o payload congelado e o documento de cenário — em **todos**
  como opcionais.
- **O risco real é o mesmo que o ADR-0024 §5 nomeou, e por isso ele se repete aqui**: não é errar a
  aritmética (é linear e testável em três pontos), é um caminho **perder** o campo no trajeto e
  degradar em silêncio para a constante antiga — invisível porque o padrão a justifica. Exige prova
  ponta-a-ponta do artefato **até o preço**, e retrocompatibilidade com payload real de ANTES (o
  fixture `frozen-payload-pre-adr-0024.json` ganha um irmão pré-016).
- **Regressão zero (FR-927) tem um ponto de atenção nomeado**: `chooseBand` passa a avaliar também o
  candidato de LIMIAR em R$ 8, então a asserção correta é sobre o par (anúncio, líquido) numa varredura
  de bases **atravessando** o limiar — não sobre um caso pontual acima dele.
- **Pendência de fonte que precede o número** (Constituição II): a spec (FR-927) lê "o **adicional
  fixo** é metade do preço … a faixa 20% + R$ 4 vale a partir de R$ 8" (comissão de 20% continua),
  enquanto `OBTENCAO-DINAMICA-DADOS.md` §8 lê "<R$ 8 (CNPJ) = **50% do preço sem fixo**" (o encargo
  total é 50%). A diferença é 20% do preço. A forma acima suporta as duas — é só qual `commissionPct` a
  banda `[0,8)` carrega — mas **nenhum número entra antes de uma releitura verbatim do art. 26839**.

## 6. Reabrir se

- A Shopee publicar a tabela regressiva CPF completa: aí ela deixa de ser aviso e vira dado — e
  provavelmente um `kind` novo de `FixedFeeRule` (interpolação por pontos), decisão nova.
- Os usuários de peça grande pedirem o rateio do volumoso (Q5 previu e o dono aceitou o custo).
- Um segundo marketplace cobrar fixo como função do preço com outra forma que não `PCT_OF_PRICE`.
- Aparecer um payload gravado com `fixedFeeRule` ou `surcharges` sem que nenhum código os tenha
  escrito — sinal de que a aditividade vazou (o mesmo canário do ADR-0024 §6).
