# ADR-0024 — Bandas de preço **progressivas**: comissão por parcela, sem reinterpretar o passado

- **Status**: Proposto
- **Data**: 2026-07-28
- **Contexto**: 014-fee-category-mapping (correção do PR #31)
- **Decide**: como representar uma comissão cobrada **por parcela do preço** sem alterar o significado
  de nenhum payload já gravado.
- **Relaciona**: ADR-0011 (pricing-core, Part 3 — o ponto fixo de banda), ADR-0010 (catálogo de tarifas),
  ADR-0019 (imutabilidade de snapshot), ADR-0021 (cenários salvos).

---

## 1. O problema, medido

A Amazon Brasil publica, para algumas categorias, duas alíquotas:

> "15% até R$ 200,00 e **10% para o excedente** acima de R$ 200,00"
> — `venda.amazon.com.br/precos`, lido em 2026-07-28

*Excedente.* A alíquota menor incide **somente sobre a parte do preço que passa do limiar**. É a
mesma estrutura que a Amazon usa em todas as suas praças ("for the portion of the total sales price
up to…").

O 014 gravou essas categorias como `priceBands`, que em `pricing-core` significa outra coisa:
`bandContaining` **seleciona uma** banda e aplica sua alíquota ao **preço inteiro**.

Efeito nas 3 categorias afetadas (Móveis, Colchões — limiar R$ 200; Acessórios Eletrônicos — R$ 100),
num anúncio de R$ 300,00 em Móveis:

| | comissão |
|---|---|
| o que o app calcula (seleção) | 10% × 300 = **R$ 30,00** |
| o que a Amazon cobra (parcela) | 15% × 200 + 10% × 100 = **R$ 40,00** |

O vendedor recebe **R$ 10,00 a menos** do que a tela prometeu, sob selo "Referência" — uma afirmação
de procedência. Abaixo do limiar as duas semânticas coincidem, e o cálculo já está correto; acima, o
erro é **constante**, igual a `(15% − 10%) × limiar`.

Nada disso é visível para o gate: 988 testes verdes, 100% de cobertura no pacote de ingestão. **O
código faz exatamente o que foi escrito para fazer; o que está errado é a leitura da fonte.**

## 2. A restrição que decide o formato

`priceBands` **não** é interno de `pricing-core`. Ele atravessa:

- `apps/web/src/entities/history/frozen-payload.ts` — o payload congelado de um snapshot, **imutável
  por trigger PL/pgSQL** (ADR-0019);
- `apps/web/src/entities/scenario/config-document.ts` — a intenção gravada de um cenário salvo (ADR-0021);
- o contrato de wire (`shared/api/generated.ts`) e o artefato servido.

Trocar o **significado** do campo reinterpretaria, em silêncio, o preço que um snapshot já congelado
afirma. Um registro que o produto promete imutável passaria a valer outro número sem que uma única
linha dele mudasse. Isso é inaceitável — e não é uma preocupação teórica: a imutabilidade de snapshot
é uma garantia de aceite de E4 (SC-809).

Logo: **a mudança tem de ser aditiva, e o silêncio tem de significar o comportamento antigo.**

## 3. Decisão

Introduzir um discriminador **explícito e opcional** no conjunto de bandas:

```ts
/** Como as bandas se combinam para formar a comissão.
 *  AUSENTE = "SELECTION" — o significado que todo payload gravado antes desta mudança já tem. */
export type BandMode = "SELECTION" | "PROGRESSIVE";
```

- **`SELECTION`** (padrão, e o significado da ausência): a banda que contém o preço define a alíquota
  aplicada ao preço inteiro. É o que Shopee e o custo fixo do ML usam — corretamente.
- **`PROGRESSIVE`**: a comissão é a **soma por parcela**:
  `fee(L) = Σ_bandas  pct_i × (min(L, max_i) − min_i)⁺`

O catálogo carrega `bandMode` por entrada; `pricing-core` o recebe já resolvido, como recebe todo o
resto (A6 — o cliente resolve a entrada, o motor faz só a matemática de preço).

### 3.1 O gross-up fica mais simples, não mais complexo

O modo `SELECTION` obriga uma **iteração de ponto fixo** (`MAX_BAND_ITERS`) porque a função de taxa é
**descontínua** no limiar: o anúncio determina a banda, e a banda determina o anúncio.

`PROGRESSIVE` é **contínua e monotônica** — não há descontinuidade, então não há ponto fixo a
perseguir. Para o segmento que contém a solução, o gross-up é fechado:

```
líquido(L) = L − fee(L) − fixedFee
fee(L) = pct_k·(L − min_k) + Σ_{i<k} pct_i·(max_i − min_i)
⇒ L = (base + fixedFee + pct_k·min_k − acumulado_k) / (1 − pct_k)
```

resolvendo por segmento e escolhendo o único cujo `L` cai dentro do próprio segmento. Determinístico,
sem iteração, sem cap terminal.

### 3.2 O que **não** muda

- Nenhuma banda existente ganha `bandMode` no artefato. Shopee e ML seguem sem o campo, e sem o campo
  o comportamento é bit-a-bit o de hoje.
- Nenhum payload congelado é migrado, reescrito ou tocado. A imutabilidade permanece intacta —
  a compatibilidade vem da **semântica do padrão**, não de uma migração.
- O piso por item (`minPerItem`) e o `fixedFee` continuam ortogonais ao modo.

## 4. Alternativas consideradas

| | por que não |
|---|---|
| **Trocar a semântica de `priceBands` para progressiva** | Reinterpreta snapshots imutáveis. Descartada pela restituição §2 — é exatamente o dano que ADR-0019 existe para impedir. |
| **Não publicar as 3 categorias** (entrada sem comissão ⇒ "sem referência") | Honesto e barato, mas entrega menos: o vendedor digita à mão um número que a fonte publica e que sabemos ler. Fica como **fallback** se a implementação do modo progressivo se mostrar arriscada perto do merge. |
| **Publicar 15% fixo** (a alíquota conservadora) | Erra a favor do vendedor, mas **inventa um número que a Amazon não publica** e o exibe sob selo "Referência". É precisamente o que `amazon-parse.ts:72` se recusa a fazer ("adivinhar qual está certo seria inventar dinheiro"). Rejeitada por coerência com FR-009/FR-010. |
| **Calcular uma alíquota efetiva por preço e gravá-la** | Seria um valor derivado, não publicado (FR-011a), e mudaria a cada preço — não é representável como catálogo. |

## 5. Consequências

**Boas**

- O número entregue passa a bater com a fonte nos três pontos de prova (abaixo, no, e acima do
  limiar) — SC-814.
- A estrutura vale para qualquer marketplace futuro com a mesma cobrança; não é um remendo Amazon.
- O caminho `SELECTION` perde a única razão de existir da iteração, mas a mantém — ela continua
  correta e é o que os payloads gravados esperam.

**Custos e riscos**

- Toca o **domínio de precificação** (`packages/pricing-core`): escalonamento obrigatório para `opus`,
  e a cobertura do pacote é ratchet de 100%.
- Aumenta a superfície do contrato de wire: `bandMode` precisa atravessar Orval, o schema do catálogo,
  o payload congelado e o documento de cenário — em **todos** como opcional.
- **O risco real é o oposto do óbvio**: não é errar a matemática progressiva (ela é simples e
  testável em três pontos), é um caminho qualquer **perder** o `bandMode` no meio do trajeto e
  degradar silenciosamente para `SELECTION` — que é o bug atual, de volta pela porta dos fundos, agora
  invisível porque o padrão o justifica. Por isso SC-815 exige a prova de retrocompatibilidade com
  **payload real de antes**, e a travessia precisa de teste ponta-a-ponta do artefato até o preço.

## 6. Reabrir se

- A Amazon publicar uma terceira estrutura de cobrança (ex.: teto absoluto de comissão por item);
- Qualquer marketplace passar a exigir modo por **banda** e não por conjunto de bandas;
- Um payload gravado aparecer com `bandMode` sem que nenhum código o tenha escrito — sinal de que a
  aditividade vazou.
