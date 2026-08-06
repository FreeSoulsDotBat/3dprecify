# ADR-0025 — Eixos de tarifa de nível de MARKETPLACE: o custo fixo do Mercado Livre, os eixos visíveis e o perfil do vendedor

- **Status**: Proposto
- **Data**: 2026-08-05
- **Contexto**: 016-correcao-homologacao (US12 · US14 · US15 · FR-918/921/922/926) — escalação opus do
  ADR-0022 (mudança estrutural no domínio de pricing)
- **Decide**: onde vive um eixo de tarifa que **não é propriedade de uma entrada** — o custo fixo do ML
  (logística × faixa de preço × peso), quais campos a tela mostra por marketplace, e o perfil do
  vendedor como determinante.
- **Relaciona**: ADR-0010 (arquitetura do catálogo, A6) · ADR-0024 (o padrão de extensão ADITIVA) ·
  ADR-0019 (imutabilidade de snapshot) · ADR-0021 (cenários salvos guardam INTENÇÃO) · ADR-0011
  (pricing-core Part 3).

---

## 1. O problema, medido

**(a) O custo fixo do ML deixou de caber no modelo.** Desde a reforma de **02/03/2026** (MEDIDO, doc
oficial de developers, "Última atualização em 06/03/2026") o custo fixo depende de **tipo de
logística** (Flex/`self_service`, ME1, `custom` e `not_specified` pagam; ME2 Coleta/Agências/Full
**não** pagam), de **faixa de preço** (limiar R$ 79 — acima, ninguém paga) e de **peso**. E **não varia
por categoria**: a categoria move só o percentual.

Nosso schema modela custo fixo como `fixedFee` escalar ou como `fixedFee` por `priceBands` — um eixo
onde a fonte agora tem três.

**(b) Os valores não são públicos.** A estrutura é oficial; os números das faixas abaixo de R$ 79 só
existem via `listing_prices` autenticado (403 anônimo, MEDIDO duas vezes). As tabelas reproduzidas por
terceiros são REPORTADO e **não sobem a fato** (Constituição II). Dois valores **são** oficiais e
entram agora: **ME2 = R$ 0** abaixo do limiar e **R$ 0 para todos acima de R$ 79**.

**(c) A tela mostra uma grade fixa de quatro campos para todos os marketplaces** — "Taxa fixa" onde não
há taxa fixa, seletor de categoria onde não há categoria — enquanto o `determinantsSchema` já sabe os
eixos de cada um. Pior, medido em `calculator-form.tsx`: o seletor de categoria renderiza sob a
condição `modalityOptions.length > 0`, ou seja **o eixo categoria é inferido do eixo modalidade**.
Funciona por coincidência.

**(d) O catálogo não conhece o vendedor** (lacuna E1). A Shopee cobra **+R$ 3/item** por perfil CPF com
volume (> 450 pedidos/90 dias, art. 26839) — atributo do VENDEDOR, não do produto.

## 2. As restrições que decidem o formato

1. **ADR-0024 §2 vale integralmente**: `priceBands` atravessa payload congelado (imutável por trigger,
   ADR-0019), documento de cenário (ADR-0021), wire e artefato servido. Mudar o **significado** de um
   campo reinterpretaria em silêncio um preço que um snapshot já afirma. **A mudança tem de ser
   aditiva, e o silêncio tem de significar o comportamento antigo.**
2. **A6 (ADR-0010)**: o cliente resolve a ENTRADA por determinantes; `pricing-core` faz só a matemática
   **chaveada por PREÇO**. O preço é o ponto fixo do gross-up; peso e logística **não são**.
3. **O casamento de determinantes é EXATO** (014/SC-801). Acrescentar uma chave a um conjunto de
   determinantes existente quebra a resolução de todo slot que não a envia — incluindo todo cenário
   salvo.
4. Um catálogo **cacheado offline** por um cliente antigo não pode quebrar nem mudar de preço.

## 3. Decisão

### 3.1 O custo fixo do ML é um bloco de nível de MARKETPLACE

Porque é o que ele é: uma propriedade do marketplace, medida como **invariante em categoria e
modalidade**. `MarketplaceCatalog` ganha um irmão opcional de `determinantsSchema`/`categorySpine`:

```ts
type FixedCostCell = number | null;   // null = a fonte oficial NÃO publica esta célula (afirmação)

interface FixedCostMatrix {
  axes: readonly ["logistics", "price", "weight"];   // eixos DECLARADOS, nunca inferidos da forma
  priceBands:  { minPrice: number; maxPrice: number | null }[];
  weightBands: { minGrams: number; maxGrams: number | null }[];
  groups: { id: string; label: string; logisticTypes?: string[]; cells: FixedCostCell[][] }[];
  source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string;
}
interface MarketplaceCatalog { fixedCostMatrix?: FixedCostMatrix | null }
```

`cells[priceIndex][weightIndex]`. **Ausência do bloco = o catálogo de hoje, bit a bit.**

`logisticTypes` é **opcional** de propósito: o 016 não fala com a API do ML, e escrever
`"self_service"` sem tê-lo medido contra o endpoint seria inventar contrato. Ele chega com a fatia
US6-ML.

`null` numa célula não é "faltou preencher" — é a declaração auditável de que **a fonte não publica**,
e é o que o truth-gate lê para distinguir lacuna de esquecimento.

### 3.2 A resolução acontece em duas etapas, e o corte é o ponto fixo

| eixo | quem resolve | quando |
| --- | --- | --- |
| **peso** | cliente (`fee-prefill`) | no prefill — é uma entrada conhecida |
| **logística** | vendedor (escolha) / cliente (comparação) | no prefill — é uma resposta |
| **preço** | `pricing-core` | no gross-up — é o ponto fixo |

O cliente colapsa logística+peso e entrega ao motor **exatamente a forma que o motor já consome
hoje** (`priceBands[]`, com o `fixedFee` da célula e a comissão da entrada). Consequências:

- **`pricing-core` não muda uma linha por causa deste ADR.** Nenhum bump de `PRICING_MODEL_VERSION`.
- O que é congelado num snapshot é o `PriceInput` **resolvido** — logo um snapshot pós-016 tem a
  **mesma forma** de um pré-016. **A matriz nunca entra num payload congelado** (ADR-0019 intocado).
- Uma célula `null` simplesmente **não gera banda**: o nível cai no estado que já existe — SC-817,
  "sem banda publicada é um ESTADO, não um número emprestado do vizinho" — e a tela lê **"sem
  referência — informe"** com campo manual. Nenhum estado novo é inventado.
- O `fixedFee` digitado pelo vendedor **materializa apenas as janelas não publicadas**. A regra
  013/F1 (um `fixedFee` digitado é inerte sobre entrada bandada) continua valendo intocada para
  Amazon e Shopee, que não têm matriz e portanto não têm janela não publicada.

### 3.3 A comparação por grupo de logística fica FORA de `PriceInput.channels`

A tela mostra o preço por GRUPO e o vendedor marca o que usa (clarify Q4; nenhum default). A
comparação é um **segundo passe apresentacional**, exposto em `ChannelSlotOutcome.logistics`; só o
grupo **escolhido** entra em `PriceInput.channels`.

Motivo estrutural: `input.channels` é congelado e serializado no cenário. N linhas por slot fariam um
documento afirmar que o vendedor cotou cinco canais quando cotou um. **O documento grava o que foi
cotado, não o que foi comparado.**

A escolha é exigida **somente quando as linhas divergem** (`requiresChoice`). Acima de R$ 79 todos os
grupos pagam zero e colapsam: exigir uma escolha imaterial seria um campo obrigatório sem
consequência — e continuaria sem assumir default nenhum.

### 3.4 Os campos visíveis por marketplace são DECLARADOS, não derivados

```ts
interface MarketplaceCatalog {
  feeAxes?: ("commissionPct" | "fixedFee" | "minPerItem" | "freight")[] | null;   // ADITIVO
}
```
**Ausente = os quatro campos = a tela de hoje.** Um plano puro (`channelFieldPlan(catalog,
marketplace)`) deriva dele + do `determinantsSchema` + do `categorySpine` + da matriz + das
sobretaxas. O eixo categoria passa a depender de **haver spine**, e não de haver modalidade.

Derivar os eixos de "alguma entrada carrega valor não-zero" foi rejeitado: faria a TELA mudar de forma
a cada atualização do catálogo e **não sabe responder para o ML**, que hoje tem `entries: []`. Qual
tarifa a fonte cobra é fato curável com procedência, não estatística do artefato.

### 3.5 O perfil do vendedor é um determinante — um eixo, três tabelas

```
determinantsSchema.SHOPEE += { sellerProfile: ["CNPJ","CPF"], highVolume: ["SIM","NAO"] }

determinants: null                                 → tabela CNPJ  (A ENTRADA DE HOJE, intocada)
determinants: { sellerProfile: "CPF" }             → tabela CPF
determinants: { sellerProfile: "CPF_ALTO_VOLUME" } → tabela CPF + R$ 3/item (art. 26839)
```

Duas perguntas na tela, **um** valor de determinante; o mapeamento vive em uma função só
(`slotDeterminants`). CNPJ e "não respondido" continuam resolvendo pela entrada `null` — que é o que
garante **byte-identidade** para todo documento salvo e todo slot não respondido, sem gravar a mesma
tabela de dinheiro em dois lugares (onde uma delas envelhece sozinha). O `source` da entrada catch-all
passa a **nomear o regime** que ela representa.

Um eixo composto em vez de dois eixos porque o casamento é exato e dois eixos criariam um espaço
cartesiano com buracos ("CNPJ + alto volume" não é publicado). Se a Shopee publicar que o +R$ 3 vale
para todo CPF, a correção é **dado**, não schema.

### 3.6 Procedência por folha, quando as folhas têm fontes diferentes

```ts
interface FeeEntry {
  fixedFeeSource?: { source: string; sourceUrl: string; effectiveDate: string; lastReviewed: string };
}
```
A tarifa de R$ 2,00/item do plano Individual da Amazon (US14) vem da `/precos`; a comissão da mesma
entrada vem da `G200336920`, com outra data. Sob uma procedência só, o selo apontaria a página errada
exatamente sobre o número novo. Metadado puro de catálogo — **não chega ao motor**.

### 3.7 O que NÃO muda

- Nenhuma `FeeEntry` existente ganha campo; Amazon e Shopee seguem idênticas.
- Nenhum payload congelado é migrado, reescrito ou tocado.
- `pricing-core` não muda: nem contrato, nem versão.
- Um catálogo cacheado sem os blocos novos rende exatamente a tela e o preço de hoje.

## 4. Alternativas consideradas

| | por que não | confiança |
| --- | --- | --- |
| **Logística como determinante** (`determinants.logisticType`) | Casamento exato: a chave nova quebraria a resolução de todo slot que não a envia (todo cenário salvo). O peso, contínuo, teria de ser bucketizado em código antes da consulta — a regra do dinheiro migraria do dado para o app. Explosão combinatória 2 × ~40 × 6 × N. | 88% |
| **Matriz dentro da `FeeEntry`** | Duplica a mesma matriz em ~80 entradas (drift garantido) e quebra o refine que exige comissão-ou-bandas: relaxá-lo reabre a classe F3 (`commissionPct ?? 0` prefixando 0% sob selo "Referência"). E permitiria, no schema, que o custo fixo variasse por categoria — contrariando o fato medido. | 82% |
| **Faixas de peso aninhadas em `priceBands`** | `priceBands` é o cronograma de COMISSÃO e atravessa snapshot/cenário/wire; torná-lo dependente de peso exigiria peso dentro de `pricing-core` (A6 quebrado) e mudaria o significado do campo que ADR-0024 §2 protege. | 90% |
| **Aproximar pelas tabelas de frete medidas** | Recomendação (ii) do D10, **já rejeitada pelo dono** — a fidelidade estrutural venceu a economia de schema. Registrada para o histórico. | — |
| **Campos da tela derivados das entradas** | A tela mudaria de forma a cada catálogo novo, e não responde para um marketplace sem entradas (o ML de hoje). | 72% |

## 5. Consequências

**Boas**
- O eixo real da fonte é representável **sem** tocar o motor, o snapshot ou o cenário.
- "Não varia por categoria" deixa de ser observação num documento e vira propriedade **estrutural**:
  no nível de marketplace, não há onde variar.
- A lacuna E1 abre pelo caso mínimo, por um mecanismo que o schema já tinha (determinantes).
- O aparecimento de um campo (peso, logística, sobretaxa) passa a ser consequência do **dado**, o que
  desarma o risco R6 (o formulário engordar no incremento que existe para simplificá-lo).

**Custos e riscos**
- Mais um bloco que o gerador, o backend, o schema Zod e o truth-gate precisam atravessar.
- **O risco real é dimensional**: uma matriz cujas células não batem com as faixas passaria a
  precificar pela célula errada em silêncio. Guarda obrigatória na ingestão **e** no `superRefine`:
  `cells.length === priceBands.length` e cada linha `=== weightBands.length`.
- **Defeito latente que este ADR depende de fechar**: `priceBandSchema.fixedFee` é `nullable` e
  `entryToChannelFees` mapeia `b.fixedFee ?? 0` — uma banda com fixo nulo precifica **R$ 0,00 sob selo
  "Referência"**, exatamente a forma que a curadoria do ML produz. É a irmã do refine 014/A2 (feito
  para `commissionPct`) e tem de entrar junto: `fixedFee` nulo só é legítimo com regra que o produza.
- Enquanto o ML não tiver comissão (fatia US6-ML), o canal exibe a comparação de **custo fixo** sem
  preço. É honesto e é mais do que hoje, mas **não** entrega a cláusula "seletor de categoria do ML
  deixa de vir vazio" do FR-918 — que depende de dado fora de escopo.

## 6. Reabrir se

- A tabela real do ML (via token) mostrar que o custo fixo **varia por categoria** — a matriz sobe para
  a entrada e o resolvedor troca de fonte sem mudar o que entrega ao motor.
- Um segundo marketplace publicar custo fixo com eixos diferentes destes três — `axes` deixa de ser
  literal e vira união.
- A lacuna E1 crescer para custo **mensal** do vendedor (Amazon Profissional R$ 19/mês): isso não é
  custo por item e **não cabe** neste eixo — é bloco de perfil próprio, decisão nova.
- Aparecer um payload gravado com `fixedCostMatrix` dentro: sinal de que a matriz vazou para o
  congelado e a §3.2 foi violada.
