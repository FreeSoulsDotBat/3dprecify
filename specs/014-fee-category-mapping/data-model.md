# Phase 1 — Data model: 014 category→fee mapping

Deriva de [research.md](./research.md). A forma abaixo é consequência de **medição** (R1), não de preferência.

---

## 1. `CategoryNode` — a árvore, achatada

```
CategoryNode
  id           string   identificador publicado pelo marketplace (ex. "MLB1051")
  name         string   nome publicado, verbatim (Q12: nada de taxonomia interna)
  parentId     string | null    null = raiz
  marketplace  "MERCADO_LIVRE" | "AMAZON"
```

**Achatada, não aninhada.** A busca por texto (US1 AS1) varre uma lista; a resolução por ancestral sobe por
`parentId`. Aninhar obrigaria a percorrer a árvore para as duas operações e complicaria o diff mensal.

**Regras**
- `id` é único por marketplace.
- `parentId` referencia um `id` existente do **mesmo** marketplace, ou é `null`.
- A árvore **não pode ter ciclo**; validado no parse (um ciclo travaria a resolução por ancestral em laço infinito).

---

## 2. `FeeEntry` — inalterada na forma, esparsa no uso

O contrato atual **já comporta** o eixo novo: `determinants` é `Record<string,string>` (R8). Nenhuma mudança de
envelope, nenhuma migração.

```
determinants: { listingType: "gold_pro", category: "MLB1051" }   ← ML
determinants: { plan: "PROFISSIONAL", category: "eletronicos" }  ← Amazon
determinants: { listingType: "gold_pro" }                         ← catch-all do marketplace
determinants: null                                                ← Shopee (inalterado)
```

**Esparsidade (a consequência de R1).** Uma entrada com `category` existe **somente onde a alíquota difere da do
nó pai**. Medido: ~87,5% dos nós herdam. Guardar os herdeiros seria repetir a mesma informação dezenas de milhares
de vezes.

**Campos alterados**: nenhum. **Campos novos**: nenhum.

> **Correção (2026-07-28).** Dizer "o incremento muda resolução e conteúdo, não forma" era verdade sobre o
> **schema** e enganoso sobre o **contrato**. A semântica da resolução muda: hoje `fee-catalog.ts:117` casa
> determinantes por **subconjunto** (uma entrada `{listingType}` casa com um slot que informa
> `{listingType, category}`); o resolvedor da §3 exige casamento **exato** por nível da cadeia. Store persistido e
> semente **escritos sob a regra antiga** continuam válidos como forma e podem resolver diferente. É mudança de
> contrato de resolução e precisa ser registrada como tal (adendo ao ADR-0010), não escondida sob "forma
> inalterada".

---

## 3. Resolução — subir a cadeia de ancestrais

Substitui o `.find()` de `fee-catalog.ts:113`, que hoje vence por ordem de arquivo (R6).

```
resolver(marketplace, category, modalidade):
    nó ← category
    enquanto nó ≠ null:
        e ← entrada com determinants { modalidade, category: nó.id }
        se e existe: devolve e                    ← o ancestral mais próximo vence
        nó ← pai(nó)
    e ← entrada com determinants { modalidade }   ← catch-all publicado do marketplace
    se e existe: devolve e  (selo: "categoria não informada")
    devolve null                                   ← selo "sem referência"
```

**Por que isto satisfaz o SC-801 por construção**: o ancestral mais próximo é, por definição, o mais específico, e a
cadeia de ancestrais é única. Não há ordenação, não há desempate, não há dependência da ordem do arquivo. A
propriedade não é testada e torcida — ela é estrutural.

**Empate é rejeitado na validação, não desempatado em runtime**: duas entradas com conjunto de determinantes
idêntico são erro.

> **Correção (2026-07-28, revisão adversarial).** Uma versão anterior deste documento dizia que "a ambiguidade
> deixa de ser resolvível porque deixa de ser representável". **Isso é falso**: ela continua perfeitamente
> representável em JSON — apenas é *rejeitada*. E rejeitar não é de graça: **onde** se rejeita decide se o
> defeito vira aviso de build ou tela branca no celular do vendedor (ver §4).

### 3b. O `entries[0]` — um segundo caminho que fabrica número (defeito existente)

`fee-catalog.ts:111` hoje faz `mk.entries.find((e) => e.determinants === null) ?? mk.entries[0] ?? null`. Quando um
slot não tem determinantes (`slotDeterminants` devolve `null` se a modalidade for vazia), o catálogo entrega **a
primeira entrada do array** — depois do 014, a alíquota de **uma categoria arbitrária**, sob selo "referência".

Hoje é inócuo porque ML e Amazon têm 0 entradas. **Depois do 014 é o SC-802/FR-011 violado**, e cenários e kits
persistidos antes do incremento carregam `modality: ""`.

**Decisão**: sem determinantes **e** sem entrada `determinants: null` explícita ⇒ `null` + "sem referência".
O fallback posicional é removido, não ajustado.

**Sem categoria escolhida** (Q5): o laço começa direto no catch-all. Amazon tem um publicado ("Outros" 15%); ML
não — lá o resultado é `null` e o selo lê "sem referência". O sistema **nunca** deriva um catch-all de uma faixa.

---

## 4. Validação (rejeição no parse/boot, ruidosa)

| regra | origem |
|---|---|
| Entrada com `commissionPct: null` precisa de `priceBands` **e cada banda precisa carregar comissão** | SC-802 / FR-008 — estende o guard F3, hoje cego ao nível de banda (R7) |
| Dois conjuntos de determinantes idênticos no mesmo marketplace → erro | SC-801, item 3 acima |
| `parentId` órfão ou ciclo na árvore → erro | integridade da resolução |
| `category` em `determinants` que não existe na árvore → erro | impede entrada resolvendo para categoria fantasma |
| Todo valor com `sourceUrl` + `effectiveDate` + `lastReviewed` | SC-803 (gate de procedência já existente) |

### 4b. **Onde** se rejeita — a política por camada (corrige um risco crítico)

`use-fee-catalog.ts:14` valida a semente **no carregamento do módulo**, com `parseFeeCatalog` que lança. Isso foi
escrito para uma semente **humana com 1 entrada**, e o comentário no código diz que falhar alto é intencional.
Depois do 014 a semente passa a ser **gerada por robô** — e um determinante duplicado, um `parentId` órfão ou uma
`category` fantasma viram **tela branca no boot, online e offline, para todos os usuários**, até um novo bundle.

A assimetria denuncia o problema: os caminhos **servido** e **persistido** já engolem erro e caem na semente
(degradam bem). A semente não tem para onde cair.

| camada | política em dado inválido |
|---|---|
| gerador da ingestão | **fatal** — não emite artefato |
| CI (gate + PR mensal) | **fatal** — reprova, nenhum PR |
| catálogo servido / store persistido | descarta e cai na camada de baixo (comportamento atual, mantido) |
| **semente embutida** | **degrada por marketplace** — descarta o marketplace inválido e sela "sem referência"; **nunca derruba o boot** |

O rigor não diminui: um dado inválido nunca vira preço. Ele só deixa de derrubar o app do vendedor por um defeito
que já foi detectável duas camadas antes.

---

## 5. Persistência (Q10 decidido)

| objeto | guarda categoria? |
|---|---|
| **Cenário salvo** | **Sim** — junto da demais intenção de canal (ADR-0021, JSONB de intenção; nenhuma coluna nova) |
| **Produto de catálogo** | **Não** — é reusado entre canais; categoria é decisão de canal |
| **Snapshot imutável** | Apenas herda o que o payload já tinha. **Imutabilidade intocada** (ADR-0019) |
| **Kit** | Herda pela linha, como as demais intenções de canal |

Ausência de categoria é estado **válido e permanente** — todo objeto salvo antes do 014 continua assim (SC-809).

---

## 5b. Mudança de pai é mudança de dinheiro — e o diff por categoria não a enxerga

Com entradas esparsas, `parentId` **determina alíquota**. Se o marketplace mover um nó herdeiro para um pai de
alíquota diferente, a alíquota efetiva daquele nó muda — **e o `catalog.json` não muda em nenhum campo**. O diff do
PR mensal, que é por categoria/campo, não mostraria nada. O laço publicaria uma mudança de preço sem uma linha no
PR, o que contraria o FR-016 no espírito e o SC-806 na intenção.

**Regra**: o comparador mensal compara **alíquota resolvida por nó**, não só campos de entrada. Nó cuja alíquota
efetiva mudou por **re-parenting** entra em seção própria do PR, com old → new.

## 5c. Skew entre árvore e catálogo

Se a árvore viajar por um canal e o catálogo por outro, uma árvore velha com catálogo novo dá **ancestral errado**,
logo **comissão errada sob selo de referência**. A árvore MUST carregar a `catalogVersion` com que foi gerada, e
resolver com versões divergentes é **erro**, não um "melhor esforço".

> Este risco **desaparece por construção** se a espinha de resolução viajar dentro do próprio `catalog.json` — ver
> `plan.md` §D2, opção recomendada pelo `arquiteto`.

---

## 6. Estado de partida (medido — R5)

`catalog.json` hoje: **ML 0 entradas · Amazon 0 entradas · Shopee 1**. O incremento popula os dois do zero, então o
SC-805 (nunca reduzir cobertura) não tem cobertura a perder em ML/Amazon. O risco de regressão fica na Shopee — que
este incremento **não toca**.
