# Arquitetura do incremento 016 — desenho estrutural para o `/speckit-plan`

**Autor**: `arquiteto` (escalação opus do ADR-0022 — domínio de pricing) · **Data**: 2026-08-05
**Entrada**: `specs/016-correcao-homologacao/spec.md` (pós-clarify, 18 US + V0, 27 FR) ·
`docs/product/016-correcao-homologacao-scope-brief.md` ·
`docs/homologacao/{OBTENCAO-DINAMICA-DADOS,ESTRUTURA-DADOS-MARKETPLACES}.md`
**ADRs que este documento propõe**: **ADR-0025** (blocos de nível de marketplace no catálogo) ·
**ADR-0026** (pricing-core 4.0.0 — remoção do `wasteGrams`) · **ADR-0027** (taxa fixa como função do
preço + sobretaxas por item).

> Este documento decide **forma**, não comportamento. Nenhuma decisão de produto da spec é reaberta.
> Onde o código real contradiz a spec, o conflito está na **§9**, apontado e não escondido
> (Constituição II).

---

## 0. Invariantes que nenhuma decisão abaixo pode violar

| # | invariante | onde ele mora hoje |
| --- | --- | --- |
| I1 | `packages/pricing-core` é a fórmula canônica (TS, offline); **o backend nunca recalcula** | `CLAUDE.md`, ADR-0008 |
| I2 | O cliente resolve a ENTRADA do catálogo; o motor só faz a matemática **chaveada por PREÇO** (A6) | ADR-0010, `fee-prefill.ts` ↔ `channels.ts` |
| I3 | Snapshot congelado é **imutável por trigger** e contém tudo que imprime — nunca referencia o catálogo | ADR-0019, `frozen-payload.ts` |
| I4 | Extensão de schema é **ADITIVA**; **ausência = comportamento antigo** | ADR-0024 §2/§3.2 |
| I5 | `catalogVersion` só se move quando o **CONTEÚDO** muda | `fee-ingest/src/guardrails.ts:nextCatalogVersion` |
| I6 | Nenhum número de tarifa sob selo de referência sem fonte oficial datada | Constituição II, `feeEntrySchema` |
| I7 | Nenhuma taxa de marketplace entra em `custo_total` | SC-105, `computeCalculator` |
| I8 | `feature → feature` é proibido (FSD-Lite + eslint-boundaries); o encontro é em `shared/` ou na `page` | ADR-0004, `shared/billing/teaser-upgrade.tsx` |
| I9 | Nível **sem banda publicada** é um ESTADO (`anuncio: null`), nunca um número emprestado da banda vizinha | SC-817, `channels.ts:chooseBand` |

**I9 é o motor de honestidade que este incremento reusa três vezes** (custo fixo ML não publicado ·
faixa CPF < R$ 12 · janela sem valor). Nenhum estado novo de "sem referência" é inventado.

---

## A. Custo fixo do Mercado Livre = logística × faixa de preço × peso (US15, D10, FR-922)

### A.1 Forma escolhida — **matriz de nível de MARKETPLACE, resolvida em duas etapas**

O custo fixo do ML **não varia por categoria nem por modalidade** (MEDIDO, doc oficial de developers).
Logo ele não é propriedade de uma `FeeEntry` — é propriedade do **marketplace**. Ele entra como um
bloco novo e opcional em `MarketplaceCatalog`, irmão de `determinantsSchema`/`categorySpine`:

```ts
// apps/web/src/shared/fee-catalog/fee-catalog.ts — ADITIVO, ausência = catálogo de hoje
/** Uma célula: o valor publicado, ou a declaração explícita de que a fonte NÃO o publica.
 *  `null` não é "faltou preencher": é uma AFIRMAÇÃO auditável (o truth-gate a lê). */
type FixedCostCell = number | null;

interface FixedCostMatrix {
  /** Os eixos DECLARADOS, em ordem. Existe para que nenhum leitor futuro infira a semântica das
   *  dimensões a partir da forma do array. Hoje sempre ["logistics", "price", "weight"]. */
  axes: readonly ["logistics", "price", "weight"];
  /** Faixas de preço meio-abertas [minPrice, maxPrice) — maxPrice null = ∞. */
  priceBands: { minPrice: number; maxPrice: number | null }[];
  /** Faixas de PESO em GRAMAS, meio-abertas [minGrams, maxGrams) — maxGrams null = ∞. */
  weightBands: { minGrams: number; maxGrams: number | null }[];
  groups: {
    id: string;                    // "ME2" | "FLEX_ME1_PROPRIO"
    label: string;                 // pt-BR, é o que a tela mostra
    /** Os `logistic_type` da API que caem neste grupo. OPCIONAL: o 016 não fala com a API do ML,
     *  e escrever uma string não medida seria inventar contrato. Vem com a fatia US6-ML. */
    logisticTypes?: string[];
    /** cells[priceIndex][weightIndex]. Dimensões conferidas na ingestão e no truth-gate. */
    cells: FixedCostCell[][];
  }[];
  /** Procedência PRÓPRIA — a regra do custo fixo vem do doc de developers, e a comissão do ML virá
   *  de `listing_prices`. Duas fontes, duas datas: uma só procedência mentiria sobre uma delas. */
  source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string;
}

interface MarketplaceCatalog {
  // … campos de hoje …
  fixedCostMatrix?: FixedCostMatrix | null;   // `nullish` (o backend serializa ausente como null)
}
```

**As duas etapas de resolução, e por que o corte é aí** (I2):

| eixo | quem resolve | quando | por quê |
| --- | --- | --- | --- |
| **peso** | cliente (`fee-prefill`) | no prefill | o peso é uma ENTRADA conhecida antes do cálculo |
| **logística** | vendedor (escolha) / cliente (comparação) | no prefill | é uma resposta, não uma função do preço |
| **preço** | `pricing-core` | no gross-up | é o **ponto fixo** — o anúncio escolhe a faixa e a faixa escolhe o anúncio |

O cliente colapsa logística+peso e entrega ao motor **exatamente a forma que o motor já consome
hoje**: `priceBands[]`. **`pricing-core` não muda uma linha por causa da US15** — e, como o que é
congelado é o `PriceInput` resolvido, um snapshot gravado depois do 016 tem a **mesma forma** de um
gravado hoje (I3 intocado; a matriz nunca entra num payload congelado).

```ts
// apps/web/src/features/calculator/fee-prefill.ts (novo)
interface LogisticsFixedCost {
  groupId: string; label: string;
  /** Já resolvido PARA ESTE PESO. Uma janela cuja célula é `null` NÃO gera banda → o nível cai em
   *  I9 ("sem referência — informe"), a menos que `manualFixedFee` a materialize. */
  bands: { minPrice: number; maxPrice: number | null; fixedFee: number }[];
  unpublishedWindows: { minPrice: number; maxPrice: number | null }[];
}
function resolveFixedCost(
  catalog: FeeCatalog, marketplace: Marketplace,
  args: { weightGrams: number; manualFixedFee?: number },
): LogisticsFixedCost[];   // [] quando o marketplace não declara matriz  ⇒  comportamento de hoje
```

**Fusão com a comissão** (a única regra de composição, escrita uma vez):

```
priceBands_do_grupo = grupo.bands.map(b => ({
  minPrice: b.minPrice, maxPrice: b.maxPrice,
  commissionPct: entry.commissionPct,      // ML: constante por (listingType, categoria)
  fixedFee: b.fixedFee,
}))
```
Com `entry === null` ou `entry.commissionPct === null` (**que é o estado do ML hoje** — §9.1) não há
banda: o slot permanece no estado que já existe hoje ("sem referência — informe as taxas"), **e a
comparação por grupo ainda é exibida em R$ de custo fixo**, sem preço. O vendedor aprende o spread
mesmo antes de o token da casa existir — que é exatamente o que a Q2 pediu.

**O campo manual do vendedor preenche APENAS as janelas não publicadas.** Regra explícita, porque a
regra vigente (013/F1, `resolveSlotFees`) diz que um `fixedFee` digitado é **inerte** sobre uma
entrada bandada. Ela continua valendo para Amazon/Shopee (sem matriz ⇒ sem janela não publicada ⇒
nada muda). Para o ML, o número digitado materializa as janelas de `unpublishedWindows` e **nunca**
sobrescreve uma janela publicada — e o selo daquelas janelas lê "informado por você".

### A.2 A comparação por grupo (clarify Q4) — fora de `PriceInput.channels`

`ChannelSlotOutcome` ganha um campo aditivo:

```ts
interface ChannelSlotOutcome {
  // … campos de hoje …
  logistics?: {
    rows: { groupId: string; label: string;
            fixedFee: number | null;              // null = a fonte não publica esta janela
            anuncioVarejo: number | null;         // null = sem comissão conhecida OU I9
            anuncioAtacado: number | null;
            unpublished: boolean }[];
    /** Só é preciso escolher quando as linhas DIVERGEM. Acima de R$ 79 todos os grupos pagam 0 e
     *  colapsam: exigir uma escolha imaterial seria um campo obrigatório sem consequência. */
    requiresChoice: boolean;
    chosen: string | null;   // nunca um default (Q4)
  };
}
```

**A comparação é um segundo passe, puramente apresentacional.** Apenas o grupo ESCOLHIDO entra em
`PriceInput.channels`. Motivo estrutural: `input.channels` é congelado (I3) e serializado no cenário
(ADR-0021); N linhas por slot fariam um documento afirmar que o vendedor cotou cinco canais quando
cotou um. **O documento grava o que foi cotado, não o que foi comparado.**

`requiresChoice === true` e `chosen === null` ⇒ o slot ML não produz número no cartão final (estado
honesto explícito, não um erro).

### A.3 O eixo de peso, e por que ele não vira campo em 016

`effectiveWeightGrams = packageWeightGrams ?? printGrams` (clarify Q3), derivado na **borda** — não
entra em `PriceInput` (o motor não precisa dele; o peso já foi resolvido antes).

**O campo "peso com embalagem" e o aviso de cubagem renderizam se e somente se a matriz resolvida
tiver ≥ 2 faixas de peso.** Com os fatos públicos de hoje (ME2 = R$ 0 em qualquer peso; ≥ R$ 79 = R$ 0
para todos; Flex/ME1 < R$ 79 = não publicado) **não há célula que discrimine peso**, então em 016 o
campo não aparece — e aparece sozinho no dia em que a tabela do ML entrar, sem uma linha de código
nova. É o próprio princípio da US12 (campo dirigido pelo schema) aplicado a si mesmo, e mata o risco
R6 para este campo. **Estreitamento consciente da US15-AC4 → confirmar no gate (§9.6).**

### A.4 Alternativas rejeitadas

| alternativa | por que não | confiança de que é inferior |
| --- | --- | --- |
| **Logística como determinante** (`determinants.logisticType`) | O casamento de determinantes é EXATO: acrescentar a chave quebraria a resolução de todo slot que não a envia (cenário salvo). E o peso, sendo contínuo, teria de ser bucketizado em código antes da consulta — a regra do dinheiro migraria do dado para o app. Explosão combinatória: 2 × ~40 × 6 × N. | 88% |
| **Matriz na `FeeEntry`** | Duplica a mesma matriz em ~80 entradas (drift garantido) e **quebra o refine do schema**: uma entrada ML sem comissão e sem bandas é recusada hoje; relaxá-lo reabre a classe F3 (`commissionPct ?? 0` prefixando 0% sob selo). O fato medido é "não varia por categoria" — no nível de entrada, o schema passaria a permitir que variasse. | 82% |
| **Faixas de peso aninhadas dentro de `priceBands`** | `priceBands` é o cronograma de **comissão** e atravessa payload congelado + documento de cenário + wire. Torná-lo dependente de peso exigiria peso dentro de `pricing-core` (I2 quebrado) e mudaria o significado de um campo que ADR-0024 §2 protege explicitamente. | 90% |
| **Aproximar pelas tabelas de frete medidas** (recomendação (ii) do D10) | **Já rejeitada pelo dono** — registrada só para o histórico. | — |

**Confiança na forma escolhida: 84%.** O que a derrubaria: a tabela real do ML (via token) mostrar
que o custo fixo varia por categoria — nesse dia a matriz sobe para a entrada, e o resolvedor troca
de fonte sem mudar a forma do que entrega ao motor.

---

## B. Shopee < R$ 8 (CNPJ): adicional = metade do preço (US18, FR-927, lacuna E2 mínima)

### B.1 Forma escolhida — **`fixedFeeRule` opcional NA BANDA de preço**

O adicional é função do **preço final**, que só existe depois do gross-up. Ao contrário do peso, isto
**não pode** ser resolvido no cliente: é o ponto fixo. Logo vive em `pricing-core` — aditivo:

```ts
// packages/pricing-core/src/channels.ts
/** Como a taxa FIXA desta banda se forma. AUSENTE = a constante `fixedFee` — o significado que todo
 *  payload gravado antes desta mudança já tem (a mesma disciplina do `bandMode`, ADR-0024). */
type FixedFeeRule = { kind: "PCT_OF_PRICE"; pct: number };   // pct ∈ (0, 100)

interface PriceBand {
  minPrice: number; maxPrice: number | null;
  commissionPct: number;
  fixedFee: number;            // continua obrigatório: é o valor quando não há regra
  fixedFeeRule?: FixedFeeRule; // ADITIVO
}
```

Uma única função nova concentra a leitura, e as **três** chamadas passam a usá-la (é aí que um
esquecimento vira dinheiro errado):

```
bandFixedFee(band, anuncio) = band.fixedFeeRule ? anuncio × pct/100 : band.fixedFee
```
1. `grossUpOnce` — a álgebra continua **fechada e linear**: `L − (c/100)L − (p/100)L = base`
   ⇒ `L = base / (1 − c/100 − p/100)`. Sem iteração nova, sem cap.
2. `chooseBand.at()` — `net = anuncio − charged − bandFixedFee(applied, anuncio)`.
3. `grossUp.finish()` — o fixo deduzido do líquido.

**Restrições declaradas** (recusadas no schema, não toleradas em silêncio):
- `fixedFeeRule` só tem significado em `bandMode: "SELECTION"`. Uma entrada `PROGRESSIVE` que a
  carregue é erro de forma → `superRefine` recusa (irmão do refine `bandMode` sem bandas).
- `c/100 + p/100 < 1` por banda, senão o denominador zera ou inverte → recusa no schema **e** erro
  por slot no motor (nunca um `Infinity` sob selo).

**Dado**: a banda Shopee CNPJ `[0, 80)` **parte em duas** — `[0, 8)` com `fixedFeeRule 50%` e
`[8, 80)` com `fixedFee 4`. Isso muda conteúdo ⇒ `catalogVersion` bumpa (I5).

**Prova de regressão zero (FR-927/SC-909)**: para toda base cujo anúncio resultante seja ≥ R$ 8 o
resultado é **byte-idêntico**. O ponto de atenção que o teste tem de cravar é o candidato de LIMIAR:
`chooseBand` passa a avaliar também `at(8, null)`, então a asserção correta é sobre o par
(anúncio, líquido) em uma varredura de bases atravessando o limiar, não sobre um caso pontual.

### B.2 Alternativas rejeitadas

| alternativa | por que não | confiança |
| --- | --- | --- |
| **Modelar como `commissionPct: 70`** (20 + 50) | Mente na composição: o selo passaria a exibir "Comissão 70%" — número que a Shopee não publica — e `minPerItem`/relatórios leriam a soma como alíquota. | 93% |
| **Regra no nível da ENTRADA** (`lowPriceRule: { belowPrice: 8, … }`) | Dois lugares passariam a descrever o que acontece abaixo de R$ 8 (a banda `[0,80)` continuaria dizendo `fixedFee 4`), e a ordem de precedência viraria regra escondida. | 86% |
| **Resolver no cliente, como o peso** | Impossível: o preço é o ponto fixo. Uma "estimativa de preço" para escolher a regra antes do gross-up seria um segundo motor de preço fora do `pricing-core` (I1). | 95% |
| **Ficar fora** (posição original do brief §6.5) | **Reaberto pelo dono no clarify Q8** — a regra é oficial e determinística. | — |

**Confiança: 86%.**

---

## C. Perfil do vendedor Shopee, +R$ 3/item e o volumoso R$ 50 (FR-926, FR-923)

Três coisas diferentes que a homologação juntou; elas têm **três casas distintas**.

### C.1 Perfil (CPF/CNPJ + volume) → **DETERMINANTE, com um eixo só e três tabelas**

O perfil seleciona **qual tabela publicada vale**. Isso é literalmente o que `determinants` é. A
lacuna E1 ("o catálogo não conhece o vendedor") é aberta pelo **caso mínimo**: um eixo.

```
determinantsSchema.SHOPEE += { sellerProfile: ["CNPJ", "CPF"], highVolume: ["SIM", "NAO"] }

entradas:
  determinants: null                            → tabela CNPJ (A ENTRADA DE HOJE, intocada)
  determinants: { sellerProfile: "CPF" }        → tabela CPF
  determinants: { sellerProfile: "CPF_ALTO_VOLUME" } → tabela CPF + R$ 3/item (art. 26839)
```

**Duas perguntas na tela, um valor de determinante.** O mapeamento vive numa função só
(`slotDeterminants`), declarado:

```
SHOPEE:  perfil === "CPF" && altoVolume  → { sellerProfile: "CPF_ALTO_VOLUME" }
         perfil === "CPF"                → { sellerProfile: "CPF" }
         perfil === "CNPJ" | não respondido → null   // cai na entrada catch-all = tabela CNPJ
```

**Por que CNPJ continua sendo o `null` e não ganha entrada própria**: (a) mantém **byte-idêntico**
todo documento salvo e todo slot em que o vendedor não respondeu (FR-926, última cláusula) — a
resolução de hoje entrega exatamente a mesma entrada; (b) evita a MESMA tabela de dinheiro gravada
em dois lugares, que é como uma delas envelhece sozinha. O `source` da entrada catch-all passa a
**nomear o regime** que ela representa ("vendedor CNPJ"), senão o selo esconde a premissa.

**Por que um eixo composto (`CPF_ALTO_VOLUME`) e não dois eixos**: o casamento é exato, e dois eixos
criariam um espaço cartesiano com buracos (não existe "CNPJ + alto volume" publicado). Um eixo, uma
tabela por valor, zero combinação irrepresentável. Se amanhã a Shopee publicar que o +R$ 3 vale para
todo CPF, a correção é **dado** (duas entradas em vez de três), não schema.

**Confiança: 80%.** Ressalva medida em §9.3 (as fontes discordam sobre a condição do +R$ 3).

### C.2 O +R$ 3/item — **dentro da tabela CPF_ALTO_VOLUME, não como sobretaxa**

É uma alíquota publicada da tabela daquele perfil (`fixedFee` de cada banda = a da CNPJ + 3), com
`source`/`effectiveDate` próprios. Modelá-lo como sobretaxa separada duplicaria um número que a fonte
publica já somado, e faria o selo apontar para duas procedências onde há uma.

### C.3 O volumoso R$ 50 — **`surcharges[]` no `ChannelInput`, com o valor vindo do CATÁLOGO**

Não é tarifa por perfil nem por faixa: é um custo **opcional que o vendedor declara**. Duas peças:

```ts
// catálogo, nível de MARKETPLACE — ADITIVO (o número nunca no código: Constituição II)
interface OptionalSurcharge {
  id: string;                       // "MANUSEIO_VOLUMOSO"
  label: string;                    // pt-BR, exibido no campo
  value: number;                    // R$
  appliesPer: "ORDER" | "ITEM";     // dirige a LEGENDA (clarify Q5), não a aritmética
  source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string;
}
interface MarketplaceCatalog { optionalSurcharges?: OptionalSurcharge[] | null }

// pricing-core — ADITIVO, ausência = byte-idêntico (US16-AC2)
interface ChannelSurcharge { label: string; value: number }
interface ChannelInput { surcharges?: ChannelSurcharge[] }
interface ChannelResult { surcharges: ChannelSurcharge[] }   // ecoado, para a legenda e o PDF
```

**Aritmética**: a sobretaxa é somada **por cima** do fixo em todos os regimes —
`fixoEfetivo(banda, L) = bandFixedFee(banda, L) + Σ surcharges.value`. Ela **atravessa a banda** de
propósito: um `fixedFee` digitado é inerte sobre entrada bandada (regra 013/F1), então somar R$ 50 ao
`fixedFee` da Shopee **não faria nada** — armadilha silenciosa de R$ 50. Este é o motivo estrutural
de a sobretaxa ser um campo próprio e não uma soma no fixo.

**Por que um array rotulado e não um escalar**: FR-923 exige legenda ("a taxa é por pedido") e o
breakdown/PDF imprime linhas que se nomeiam. Um escalar perderia o rótulo, e o rótulo é o que impede
a superestimação multi-item de virar surpresa (ressalva 2 do PO).

**Campo na tela**: um checkbox por sobretaxa **declarada pelo catálogo** — o mesmo princípio da US12.
Zero string e zero número no código; a próxima sobretaxa é dado.

**Persistência (intenção, ADR-0021)**: `ScenarioChannelIntent.surcharges?: string[]` (ids). O VALOR
resolve ao vivo contra o catálogo de hoje. Ausência = nenhuma = byte-idêntico.
**Congelado (I3)**: as sobretaxas resolvidas viajam dentro de `inputs.channels[].surcharges` pelo
`freezeInput` recursivo que já existe — nenhuma forma nova no envelope congelado.

**Confiança: 83%.**

---

## D. Remoção do `wasteGrams` (US10, D2, FR-912/913) — pricing-core **4.0.0**

### D.1 Rejeitar, não ignorar

```ts
// packages/pricing-core/src/index.ts
export const PRICING_MODEL_VERSION = "4.0.0";           // package.json major = 4 (gate `version.test.ts`)
export const RETIRED_INPUT_FIELDS = ["wasteGrams"] as const;

// no topo de computeCalculator, ANTES de qualquer validação:
for (const f of RETIRED_INPUT_FIELDS)
  if (f in input) throw new ValidationError(
    `${f} foi removido do modelo de preço em 4.0.0 — use stripRetiredFields() antes de recomputar`, f);
```

**A chave PRESENTE é o sinal, mesmo com valor `undefined`.** Um `{...documentoAntigo}` carrega a
chave; a camada de mapeamento tem de `delete`, não atribuir `undefined`. Assim o espalhamento
descuidado — o jeito real como isto voltaria — falha alto.

`computeBom` herda a recusa (cada linha passa por `computeCalculator`). O `field` da `ValidationError`
já mapeia para o campo do formulário pela infra existente.

**Alternativa rejeitada — `zod.strict()` na borda do motor** (confiança de que é inferior: 78%):
`pricing-core` tem uma única dependência de runtime (`decimal.js-light`, ADR-0008); acrescentar Zod
custa bundle offline e um parse por recomputo num caminho quente. Pior: `strict()` recusaria **toda**
chave desconhecida, o que transformaria cada extensão aditiva futura em quebra para chamador antigo —
o oposto exato da disciplina I4 de que este projeto depende. A recusa nominal por lista é cirúrgica,
testável e diz o nome do campo.
**Alternativa rejeitada — ignorar em silêncio** (95%): recusada pela FR-912; é a definição do defeito.

### D.2 A camada de mapeamento (a regra de leitura) — **dentro do `pricing-core`**

```ts
export interface DiscardedField { field: (typeof RETIRED_INPUT_FIELDS)[number]; value: string }
/** Genérica na folha (string no documento gravado, número numa entrada viva) — a mesma regra serve
 *  aos dois costurados. Pura, determinística, offline. */
export function stripRetiredFields<T extends Record<string, unknown>>(
  stored: T,
): { kept: Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>; discarded: DiscardedField[] };
/** major(modelVersion) < 4 — o sinal para um documento congelado, que não tem a folha para inspecionar. */
export function isPreRemovalModel(modelVersion: string): boolean;
```

**Por que no `pricing-core` e não em `entities/` ou `shared/`**: a informação "o `wasteGrams` existiu
até a 3.x" é a mesma informação que a constante de versão data. Separá-las cria dois lugares que
precisam concordar. Aqui há **um** lugar que sabe que o campo existiu, e ele é o pacote cujo bump
MAJOR criou a necessidade — sob o ratchet de 100% de cobertura.
*Alternativas*: `entities/pricing-input/` (atravessa duas entidades — history e scenario — então não
é entidade de nenhuma das duas; 70% inferior) · `shared/lib/` (é domínio, não utilitário; 75%).

**Os dois costurados de hidratação, medidos no código:**

| costurado | arquivo | o que acontece hoje | o que passa a acontecer |
| --- | --- | --- | --- |
| cenário reaberto (escalar + KIT) | `features/calculator/scenario-bridge.ts` (dois laços sobre `CALC_FIELD_NAMES`) | tirar `wasteGrams` da lista **descartaria em silêncio** | passa por `stripRetiredFields`; `discarded` sobe no `ScenarioFormPatch` e a tela declara |
| "Recalcular hoje" / "comparar hoje" | `pages/historico/recalc-today.tsx` | reprecifica da ORIGEM viva (produto/kit), nunca das entradas congeladas; sem origem, **reemite o documento congelado sem recomputar** | nenhum mapeamento é necessário; a declaração vem de `isPreRemovalModel(frozen.modelVersion)` |

**A declaração (FR-913) é dirigida por VERSÃO onde há versão e por PRESENÇA DA FOLHA onde não há.**
O documento de cenário deliberadamente não guarda versão de modelo (`config-document.ts` §7.3), então
a evidência honesta ali é a própria folha; o snapshot guarda `modelVersion`, então ali a evidência é a
versão. Nenhum campo novo é criado — e isso importa porque um campo em payload congelado é **para
sempre** (I3).

### D.3 Migração de banco — **DROP** *(numerada `0007` na execução — o head real já ia além; T042/R3)*

| objeto | hoje | depois |
| --- | --- | --- |
| `filaments.default_waste_grams` | `Numeric(12,3)`, `server_default '0'`, NOT NULL + CHECK | **DROP** (coluna + `ck_filaments_default_waste_valid`) |
| `products.waste_grams` | `Numeric(12,3)`, `server_default '0'`, NOT NULL + CHECK | **DROP** (+ `ck_products_waste_grams_valid`) |
| `bom_lines.waste_grams` | `Numeric(12,3)` nullable + CHECK | **DROP** (+ `ck_bom_lines_waste_grams_valid`) |

`downgrade` recria as três colunas com `server_default '0'` — **o schema é reversível, os valores
não**, e isso fica escrito na migração. Justificativa medida: **nenhum ambiente foi provisionado**
(decisão do dono 2026-07-09 — deploy adiado até a v1), então não há linha de produção a destruir.
*Alternativa rejeitada*: manter as colunas mortas (85% inferior) — coluna NOT NULL que ninguém
alimenta é exatamente a duplicação/dead-code que a arquitetura recusa, e ela reapareceria em cada
review futuro como "isso ainda é usado?".

**Wire/contrato** (regen obrigatória: `export_openapi` + `gen:api` da RAIZ + drift-guard, e provar
idempotência): `FilamentIn/FilamentOut.defaultWasteGrams` e `PieceInputs.wasteGrams` saem;
`backend/app/api/scenarios.py` para de emitir a folha em `lastKnown`; `boms.py` para de sincronizar.

**Cliente velho (aba parada em cache) — decisão**: `FilamentIn` e `PieceInputs` passam a **recusar**
campo extra (`extra="forbid"`), com 422 nomeando a mudança de modelo. Pydantic por padrão *ignora* o
extra, e ignorar aqui é a mentira silenciosa que o incremento existe para matar: o vendedor salvaria
um produto achando que o desperdício entrou e veria outro preço. Snapshots do outbox (ADR-0018)
continuam opacos e aceitos como estão — imutabilidade intocada.

### D.4 O que NÃO muda (e a correção do R3 do brief)

Nenhum artefato exportado jamais imprimiu `wasteGrams`: `FrozenBreakdown` não tem linha de
desperdício (o material já vem somado), `quote_render.py` imprime só as chaves do breakdown gravado, e
a tela de detalhe nunca renderiza `payload.inputs`. **O R3 do brief está factualmente errado** (§9.7)
— a mitigação "legenda no documento antigo" é desnecessária, e a declaração honesta é a da §D.2.

**Confiança no conjunto D: 88%.**

---

## E. Teaser premium unificado (US1, FR-901/902/903)

### E.1 Forma escolhida — **um componente em `shared/billing/`, com contrato de conteúdo FECHADO**

```ts
// apps/web/src/shared/billing/premium-teaser.tsx
type PremiumFeatureId = "SCENARIOS" | "CATALOG" | "CATALOG_PICKER" | "KITS" | "QUOTES";
interface PremiumTeaserProps {
  feature: PremiumFeatureId;
  signedOut: boolean;
  /** ÚNICA exceção nomeada: o botão desabilitado-e-visível do "Usar do catálogo" (US1-AC3).
   *  Um slot `children` genérico devolveria a divergência que esta US existe para eliminar. */
  disabledAffordance?: ReactNode;
}
```
Renderiza **exatamente quatro elementos, em ordem fixa**: título da feature · subtítulo · `TeaserUpgrade`
(o botão "Assinar Premium" que o E6 já entregou) · legenda pequena. **Sem props de texto**: os três
textos vêm de um único registro i18n chaveado por `PremiumFeatureId` em `shared/i18n/messages.pt-br.ts`.

**Por que registro e não props**: com props de texto as cinco chamadas voltam a divergir — e a
divergência **é** o defeito (SC-901 pede estrutura idêntica). Com o registro, "mesma estrutura" vira
propriedade de **tipo**, não resultado de teste: uma superfície nova só pode acrescentar cópia, nunca
estrutura.

**Por que em `shared/` e não numa feature**: `features/{catalog,history,scenarios,bom}` são irmãs e
`feature → feature` é proibido (I8). O precedente é o próprio `TeaserUpgrade`, que já foi elevado por
esta mesma razão — o linter objetou quatro vezes, uma por teaser.

**Os quatro componentes antigos são DELETADOS**, não embrulhados (`premium-teaser.tsx`,
`history-teaser.tsx`, `scenario-teaser.tsx`, `bom-teaser.tsx` + o `PremiumTeaserDialog`), senão a
cópia divergente sobrevive atrás do adaptador. `TeaserUpgrade` **não** é bifurcado: ele é o elemento
"Assinar" do padrão (ver §H).

**Homologação estrutural (SC-901)**: um teste que monta os cinco ids e compara a **árvore** renderizada
(ordem de papéis/elementos), não a presença de texto — mais screenshot das cinco (a regra herdada:
caixa acha o que texto não acha; imagem acha o que caixa não acha).

**Confiança: 90%.**

---

## F. Campos da seção de canal dirigidos pelo marketplace (US12, FR-918)

### F.1 O defeito estrutural de hoje, medido

Em `calculator-form.tsx` o seletor de categoria renderiza sob a condição `modalityOptions.length > 0`
— ou seja, **o eixo CATEGORIA é inferido do eixo MODALIDADE**. Funciona por coincidência (Shopee não
tem nenhum dos dois; ML/Amazon têm os dois) e quebra no primeiro marketplace que tiver um sem o outro.

### F.2 Forma escolhida — **um plano puro, derivado do catálogo**

```ts
// apps/web/src/features/calculator/channel-field-plan.ts (novo, puro)
interface ChannelFieldPlan {
  determinants: { key: string; kind: "SELECT" | "CATEGORY_PICKER";
                  label: string; options?: { value: string; label: string }[] }[];
  feeFields: ChannelFieldName[];                    // quais dos 4 campos numéricos aparecem
  logistics?: { groups: { id: string; label: string }[]; weightInput: boolean };
  surcharges: { id: string; label: string; legend: string }[];
}
function channelFieldPlan(catalog: FeeCatalog, marketplace: MarketplaceId): ChannelFieldPlan;
```

**Regras declaradas** (nenhuma inferida a partir de outra):
1. Uma chave de determinante aparece **sse** `determinantsSchema` a declara com lista de opções
   não-vazia; `category` aparece **sse** o marketplace publica `categorySpine` não-vazio.
2. Um campo de tarifa aparece **sse** o marketplace o declara em um bloco **explícito** novo:
   ```ts
   interface MarketplaceCatalog {
     feeAxes?: ("commissionPct" | "fixedFee" | "minPerItem" | "freight")[] | null;  // ADITIVO
   }
   ```
   **Ausência = os quatro campos = a tela de hoje** (I4) — o que torna um catálogo cacheado antigo
   idêntico ao que ele já era. Curadoria de 016: Shopee `[commissionPct, fixedFee, freight]` ·
   Amazon `[commissionPct, fixedFee, minPerItem]` · ML `[commissionPct, fixedFee, freight]`.
   *Por que explícito e não derivado das entradas* (a alternativa óbvia, 72% inferior): derivar de
   "alguma entrada carrega valor não-zero" faz a TELA mudar de forma a cada atualização do catálogo,
   e **não sabe responder para o ML**, que hoje tem zero entradas (§9.1). Qual tarifa a fonte cobra é
   um FATO curável com procedência, não uma estatística do artefato.
3. `logistics` aparece **sse** o marketplace declara `fixedCostMatrix`; `weightInput` sse a matriz
   tiver ≥ 2 faixas de peso (§A.3).
4. `surcharges` = as `optionalSurcharges` declaradas.
5. **Posição** da seção: depois de "Markup", antes de "Como chegamos no preço" (FR-918).

**Regressão zero (FR-919/SC-909)**: o plano decide **renderização** e **quais determinantes são
enviados**. ML/Amazon/Shopee continuam enviando exatamente o que enviam hoje
(`listingType`/`plan`/`category`); a chave nova (`sellerProfile`) só existe quando o vendedor
responde. Logo a resolução — e o preço — é byte-idêntica por construção, não por teste.

**`MODALITY_OPTIONS` deixa de ser tabela codificada** em `calculator-schema.ts` e passa a sair do
`determinantsSchema` (os rótulos pt-BR continuam no i18n, chaveados pelo valor do determinante).

**Confiança: 85%.**

---

## G. Amazon plano Individual = `fixedFee` 2,00 (US14, FR-921)

**É mudança de DADO — com uma exceção de forma, e ela importa.** O gerador passa a escrever
`fixedFee: 2` nas 38 entradas `plan = INDIVIDUAL`, `minPerItem` continua 1,00 uniforme (D7 intocado),
Profissional fora, e `nextCatalogVersion(prev, collectedAt, changed = true)` bumpa (I5).

**A exceção**: esse R$ 2,00 **não vem** da tabela de comissões (`G200336920`) que é o `sourceUrl` da
entrada — vem da `/precos`, com outra data de vigência. Gravar os dois sob uma procedência só faz o
selo apontar para a página errada exatamente sobre o número novo (I6).

```ts
interface FeeEntry {
  /** ADITIVO. Ausente = a procedência da própria entrada (todas as entradas de hoje). Presente
   *  quando a taxa fixa vem de fonte/data DIFERENTES da comissão. */
  fixedFeeSource?: { source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string };
}
```
Metadado puro de catálogo — **não chega ao motor** e não entra em `ChannelInput`. O `FeeSeal` passa a
exibi-lo quando presente.

*Alternativa*: aceitar a procedência única e registrar o desvio no `dod-evidence` — deixa PR-F como
mudança de dado pura. **Confiança de que o campo é a escolha certa: 72%** (é a menor forma honesta, e
habilita o truth-gate a exigir "toda folha de dinheiro com fonte datada"). **Decisão do arquiteto: o
campo entra.** Se o dono preferir PR-F sem schema, a alternativa é aceitável com o desvio registrado.

---

## H. Ordem de risco e coordenação com o E6 (R8)

**O R8 aponta para o risco errado.** Medido no repositório:

- O bump MAJOR (PR-D) toca `pricing-core`, calculadora, catálogo e banco. **O E6 PR-C residual (US8
  reembolso/chargeback + prontidão Play Billing) não chama `pricing-core` nem toca a calculadora.**
  Interseção de arquivos: **vazia**. → **PR-D não precisa esperar o fechamento do E6.**
- A colisão real é **PR-A × E6 US7**: `shared/billing/teaser-upgrade.tsx` **já está na árvore** (com
  os comentários T032/T038 e a homologação dos 18 screenshots). Ou seja, o "acender os teasers" já
  aconteceu. **PR-A tem de ABSORVER esse componente como o elemento "Assinar" do padrão único, nunca
  bifurcá-lo** — se PR-A recriar o botão/preço, o E6 perde a homologação que pagou 100,5px de
  overflow e um toast fantasma para conseguir.

**Ordem interna de 016, e o argumento é `modelVersion`:** cada versão que existe, mesmo por dois dias,
pode ser **carimbada num snapshot imutável** (I3). Minimizar o número de rótulos que chegam a existir
é uma decisão de arquitetura, não de higiene. Por isso:

```
PR-A (teasers) → PR-B (layout) → PR-C (campos, sem bump)
  → PR-D  pricing-core 3.1.0 → 4.0.0   (MAJOR, isolada)
  → PR-E  premium + campos dirigidos   (sem bump)
  → PR-F  dado + E2 mínima + volumoso  4.0.0 → 4.1.0 (MINOR aditivo)
  → PR-G  matriz ML                    (sem bump de pricing-core — só catálogo)
```
Se PR-F/PR-G entrassem **antes** de PR-D, existiria uma 3.2.0 efêmera carimbada em qualquer orçamento
gravado no intervalo. A ordem do brief já é essa; este parágrafo existe para que ninguém a inverta
"para adiantar o dado".

**PR-G não bumpa `PRICING_MODEL_VERSION`** — é a consequência direta da §A.1 (o motor não muda). Bumpa
`catalogVersion`, que é o rótulo certo para "qual tabela precificou".

**Confiança: 80%** (85% na interseção vazia com o E6; a incerteza é sobre o escopo restante do PR-C do
E6, que não li linha a linha).

---

## 7. Derivações de borda (US7, US8) — a regra que impede um campo persistido a mais

`/speckit-plan` vai encontrar duas tentações de gravar estado; ambas são **derivação pura**:

- **US7 (h + min)**: `horas = h + min/60`; exibição inversa `h = trunc(x)`, `min = round(frac(x)×60)`
  com transbordo (60 → +1h, 0min). Bijetiva no domínio de minutos inteiros (SC-905); `5.33 h`
  exibe `5h 20min`. **Nada é persistido**: o decimal continua sendo a única verdade.
- **US8 (custo de máquina)**: `machineLifetimeHours = ritmoHorasAno × paybackAnos`, com
  `RITMOS = [260, 1200, 3300]` h/ano — que a payback 3 anos dá os 780/3.600/9.900 aprovados (SC-906
  confere: 4000/780 = 5,13 · 4000/3600 = 1,11 · 4000/9900 = 0,40). O modo "ajustar" (US8-AC4) é
  **derivado** do valor salvo (não bate com nenhum ritmo × payback inteiro ⇒ ajustar), **não** um
  campo gravado.

**Invariante**: uma derivação de borda **nunca** entra em `PriceInput`, no documento de cenário ou no
payload congelado. O que se grava é o que o motor consome. Cada campo acrescentado a um payload
congelado é permanente (I3).

---

## 8. Mapa fatia → decisão → contrato tocado

| fatia | US | decisões | contratos tocados | bump |
| --- | --- | --- | --- | --- |
| PR-A | US1, US2 | **E** | `shared/billing/premium-teaser`, i18n | — |
| PR-B | US3–US5 | — | CSS/layout | — |
| PR-C | US6–US9 | **§7** | só borda | — |
| **PR-D** | US10 | **D** | `pricing-core` (MAJOR), Alembic `0007`, OpenAPI/Orval, dois costurados | **4.0.0** |
| PR-E | US11–US13 | **F**, **C.1** | `channel-field-plan`, `determinantsSchema`, `slotDeterminants` | — |
| PR-F | US14, US16–US18 | **B**, **C.2/C.3**, **G** | `PriceBand.fixedFeeRule`, `ChannelInput.surcharges`, `optionalSurcharges`, `fixedFeeSource`, dado | **4.1.0** + `catalogVersion` |
| PR-G | US15 | **A** | `fixedCostMatrix`, `resolveFixedCost`, `ChannelSlotOutcome.logistics` | só `catalogVersion` |

Toda extensão acima é **aditiva e opcional**; **ausência = comportamento de hoje** (I4). Nenhuma
migração de payload gravado, em nenhuma delas — a compatibilidade vem da semântica do padrão.

---

## 9. Conflitos medidos entre a spec e o código real (Constituição II)

**9.1 O catálogo do Mercado Livre tem ZERO entradas.** Medido em `backend/app/data/catalog.json:15` e
`apps/web/src/shared/fee-catalog/seed.ts:17` (`entries: []`, sem `categorySpine`); o comentário 015/A11
em `calculator-schema.ts` diz o mesmo. Consequências:
- A Clarification Q2 ("corrigindo o custo fixo cobrado **indevidamente** de vendedores ME2 hoje") é
  **falsa**: hoje não cobramos custo fixo de ML nenhum — o slot ML já lê "sem referência — informe".
  O ganho real da US15 é **positivo** (ensinar o spread e cravar os R$ 0 oficiais), não corretivo.
- **FR-918/US12-AC2 "ML com … seletor de categoria que deixa de vir vazio" NÃO é entregável em 016**:
  exige `categorySpine` + comissões do ML, que só vêm pela API autenticada — a fatia US6-ML está
  **explicitamente fora de escopo** (spec §Fora de escopo 1). O que 016 entrega para o ML é a matriz
  de custo fixo, a comparação por logística e o estado honesto de comissão. **Precisa de decisão do
  dono no gate**: aceitar o recorte, ou tirar a cláusula do FR-918.

**9.2 `PRICING_MODEL_VERSION` é `"3.1.0"`**, não 3.0.0 como a linha de terreno do `CLAUDE.md` afirma.
Alvo do bump MAJOR: **4.0.0** (`packages/pricing-core/src/index.ts:20`; o gate `version.test.ts` amarra
a constante ao major do `package.json`).

**9.3 A regra Shopee < R$ 8 tem duas leituras oficiais incompatíveis.** FR-927 diz "o **adicional
fixo** é metade do preço … a faixa 20% + R$ 4 passa a valer a partir de R$ 8" (⇒ comissão de 20%
continua incidindo). `OBTENCAO-DINAMICA-DADOS.md` §8 diz "<R$ 8 (CNPJ) = **50% do preço sem fixo**"
(⇒ o encargo total é 50%). A diferença é **20% do preço**. A forma da §B suporta as duas (é só qual
`commissionPct` a banda `[0,8)` carrega), mas **o número não pode ser escrito antes de uma releitura
verbatim do art. 26839** — e essa leitura é tarefa de PR-F, não suposição do plano.

**9.4 Defeito latente na mesma família do 014/A2.** `priceBandSchema.fixedFee` é `nullable`, e
`entryToChannelFees` mapeia `b.fixedFee ?? 0` (`fee-prefill.ts:157`): uma banda com fixo nulo
**precifica R$ 0,00 sob selo "Referência"**. É exatamente a forma que a curadoria do ML produz (a
banda conhece a faixa, não o valor). Recomendo o refine espelhado do `commissionPct` em PR-G —
`fixedFee` nulo só é legítimo com `fixedFeeRule` presente. **Não é dívida de review: é o mecanismo que
a §A.1 depende para nunca inventar um zero.**

**9.5 Tabela CPF abaixo de R$ 12 mentiria sob selo.** A tabela CPF publicada é a CNPJ + R$ 3, o que
daria 20% + R$ 7,00 num item de R$ 9 — enquanto a fonte oficial publica **R$ 6,00 em R$ 8** e
**R$ 6,50 em R$ 10** (art. 26839, verbatim). **Decisão do arquiteto**: as bandas das entradas CPF
começam em **R$ 12**; abaixo disso o nível fica sem preço (I9, mecanismo existente) + o aviso da US17
com os dois pontos + campo manual. A US17-AC3 ("não bloqueia o cálculo") é sobre o aviso do **frete
aferido**, não sobre este — conferido no texto da spec. Alternativa (precificar com a tabela e confiar
no aviso): **35%**.

**9.6 US15-AC4 (peso + aviso de cubagem) fica latente em 016** pela §A.3 — não há célula publicada que
discrimine peso, então o campo mudaria zero. Estreitamento consciente; **confirmar no gate**.

**9.7 O R3 do brief está errado.** Nenhum artefato exportado imprime `wasteGrams`: `FrozenBreakdown`
não tem a linha (o desperdício está somado dentro de `material`), `quote_render.py:_COST_LABELS` só
imprime chaves do breakdown, e a tela de detalhe nunca renderiza `payload.inputs`. A mitigação
proposta ("legenda no documento antigo") é desnecessária; o que a US10 realmente precisa entregar é a
declaração de descarte da §D.2.

**9.8 A pergunta de volume da Shopee tem condição ambígua na fonte.** `OBTENCAO` registra "CPF =
mesmas +R$ 3" (tabela) e, em outro ponto, "+R$ 3/item" no contexto de ">450 pedidos/90 dias". FR-926
resolve por decisão (CPF **e** volume). A §C.1 implementa a FR-926 e deixa a correção como **dado**
(duas entradas em vez de três) se a releitura disser outra coisa.

---

## 10. Riscos arquiteturais deste desenho

| # | risco | mitigação embutida |
| --- | --- | --- |
| RA1 | Um caminho **perder** `fixedFeeRule`/`surcharges`/`bandMode` no trajeto e degradar em silêncio (o risco que ADR-0024 §5 nomeia como o real) | Teste ponta-a-ponta do **artefato até o preço**, e retrocompatibilidade com payload real de ANTES — o fixture `frozen-payload-pre-adr-0024.json` já existe e ganha um irmão pré-016 |
| RA2 | A matriz ML e o `priceBands` divergirem de dimensão (células × faixas) | Guarda de forma na ingestão + no `superRefine` do schema: `cells.length === priceBands.length` e cada linha `=== weightBands.length` |
| RA3 | O `stripRetiredFields` ser esquecido num terceiro costurado futuro | A recusa do motor é o alarme: um costurado esquecido **quebra alto**, não em silêncio (é o par recusa+porta que faz isso funcionar) |
| RA4 | A comparação de logística vazar para `PriceInput.channels` | O tipo separa: `logistics` mora em `ChannelSlotOutcome` (camada de feature), e `ChannelInput` não tem onde recebê-la |
| RA5 | O plano de campos (§F) ficar dessincronizado do que é ENVIADO como determinante | Uma função só decide os dois (`channelFieldPlan` alimenta o render **e** `slotDeterminants` lê do mesmo plano) |
