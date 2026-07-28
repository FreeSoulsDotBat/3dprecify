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

**Campos alterados**: nenhum. **Campos novos**: nenhum. O incremento muda **resolução** e **conteúdo**, não forma.

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

**Empate é impossível por validação, não por regra de runtime**: duas entradas com conjunto de determinantes
idêntico são **erro de parse/boot**. A ambiguidade deixa de ser resolvível porque deixa de ser representável.

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

## 6. Estado de partida (medido — R5)

`catalog.json` hoje: **ML 0 entradas · Amazon 0 entradas · Shopee 1**. O incremento popula os dois do zero, então o
SC-805 (nunca reduzir cobertura) não tem cobertura a perder em ML/Amazon. O risco de regressão fica na Shopee — que
este incremento **não toca**.
