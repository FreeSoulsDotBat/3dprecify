# Contract — árvore de categorias + resolução (014)

Contratos que este incremento expõe. O envelope do catálogo (`feeCatalogSchema`) **não muda** — ver
[data-model.md §2](../data-model.md).

---

## C1. Artefato de árvore de categorias

Documento novo, entregue pela camada que D2 decidir (`plan.md` §Decisões estruturais pendentes).

```jsonc
{
  "schemaVersion": "1",
  "generatedAt": "2026-08-01T06:00:00Z",
  "trees": [
    {
      "marketplace": "MERCADO_LIVRE",
      "sourceUrl": "https://api.mercadolibre.com/sites/MLB/categories",
      "collectedAt": "2026-08-01",
      "nodes": [
        { "id": "MLB1051", "name": "Celulares e Telefones", "parentId": null },
        { "id": "MLB1055", "name": "Celulares e Smartphones", "parentId": "MLB1051" }
      ]
    }
  ]
}
```

**Invariantes** (validadas no parse, falha ruidosa):
- `id` único por marketplace · `parentId` referencia nó existente do mesmo marketplace ou é `null`
- **sem ciclos** — um ciclo travaria a resolução por ancestral em laço infinito
- `name` é o texto publicado pelo marketplace, **verbatim** (Q12)

---

## C2. Resolução — o contrato observável

```
resolveSlotEntry(catalog, tree, marketplace, modalidade, category?) → FeeEntry | null
```

| entrada | saída | selo |
|---|---|---|
| categoria com entrada própria | essa entrada | nomeia a categoria |
| categoria sem entrada própria, ancestral tem | a do **ancestral mais próximo** | nomeia a categoria do ancestral |
| sem categoria, marketplace publica catch-all | o catch-all | "categoria não informada — usando 'Outros'" |
| sem categoria, marketplace **não** publica catch-all | `null` | "sem referência" |
| nada casa | `null` | "sem referência" |
| valor editado pelo vendedor | (a edição vence sempre) | "ajustado por você" |

**Propriedades que o contrato garante** — cada uma é um teste, não uma intenção:
1. **Independente de ordem**: embaralhar `entries` no artefato não muda nenhuma resolução (SC-801).
2. **Determinística**: mesma entrada, mesma saída, sem relógio nem aleatoriedade.
3. **Nunca fabrica**: não existe caminho que devolva número sem `sourceUrl`.
4. **Nunca 0% sob "referência"**: rejeitado no parse, inclusive dentro de banda (SC-802).

---

## C3. PR mensal — o contrato com o humano que revisa

O PR **é** a interface do laço mensal. Formato do corpo:

```markdown
## Tarifas — <marketplace> — coletado em <data> de <sourceUrl>

| categoria | campo | antes | depois |
|---|---|---|---|
| Celulares e Smartphones | comissão | 16% | 16,5% |

### Categorias removidas da fonte (decisão humana necessária)
- Assinatura do MELI Plus — presente em 2026-07-01, ausente hoje
```

**Regras**:
- Execução **sem mudança** → PR que altera **apenas** `lastReviewed` (Q7/FR-020a). É também a prova mensal de que o
  robô está vivo.
- Execução **que falhou ao ler a fonte** → **nenhum** PR, artefato intocado, alerta. `lastReviewed` **não** avança
  para valor nenhum (SC-806/FR-020a).
- Parse **vazio ou encolhido** além do limiar declarado é **falha**, não "as taxas caíram" (SC-806).
- **Nunca** auto-merge. Alvo: `develop`.

---

## C4. Ingestão — contrato operacional

| | Amazon | Mercado Livre |
|---|---|---|
| credencial | **nenhuma** | token da conta da casa (GitHub Secrets, **sem** write-back) |
| runner | hospedado (medido: G2) | hospedado (medido: G1 — **não há geo-gate**) |
| leitura | browser headless (página JS-renderizada) | API `/sites/MLB/categories` + `/sites/MLB/listing_prices` |
| armadilha conhecida | células de dinheiro usam **U+00A0** — normalizar antes de comparar (R3) | permissão mínima "Publicação e sincronização: Leitura"; menos que isso → 403 em toda a família `/sites/*` |
| tokens de LLM | **0** | **0** |

**Independência**: a falha de um marketplace **não** impede o outro (FR-022). São dois jobs, não um com dois passos.
