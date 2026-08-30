# Contrato de composição — 018 Abas desktop (Fase 1)

O que este incremento expõe não é uma API: é uma **composição de interface**. Este arquivo fixa as
fronteiras que a implementação não pode atravessar — o equivalente, para uma tela, do que um contrato
OpenAPI é para um endpoint.

Autoridade de layout: [`../design/Abas-Desktop.dc.html`](../design/Abas-Desktop.dc.html).

---

## C0 — O gate (vale para todas as telas)

```
useIsWide()  →  boolean        // shared/lib/use-is-wide.ts
              matchMedia("(min-width: 1280px)"), false sem window/matchMedia
```

- **Único** consumidor da largura. Nenhum outro `matchMedia("(min-width: …)")` nasce neste incremento.
- `false` ⇒ a árvore renderizada é **exatamente** a de hoje. Não "parecida": a mesma.
- O componente `AppNav` continua recebendo `variant` do shell; o rail é uma **propriedade nova**, não
  uma terceira variante.

---

## C1 — Catálogo (`pages/catalogo/catalogo-page.tsx`)

| Fronteira | Regra |
|---|---|
| Cabeçalho | título + contagem da seção · grupo segmentado das 4 seções · botão de adicionar da seção ativa |
| Corpo (premium, largo) | grade `[lista] [ficha 560px]`; lista em 1 coluna até ~1600px, 2 acima |
| Corpo (premium, estreito) | **inalterado** — abas + painel de hoje |
| Corpo (grátis/deslogado) | **um** `PremiumTeaser`, em qualquer largura |
| Seleção | estado da página; clicar num card **não navega** |
| Ficha — filamento/impressora | monta `FilamentForm` / `PrinterForm` **existentes**; salvar usa as mutations de hoje |
| Ficha — produto/kit | resumo + ação que navega para o editor de hoje (`?produto=`, `/kits?id=`) |
| Exclusão | continua passando pelo diálogo de confirmação de hoje |

**Proibições explícitas**: não duplicar `FilamentForm`/`PrinterForm`; não criar rota nova; não fazer
requisição nova para buscar (a busca filtra o cache).

---

## C2 — Orçamentos (`pages/historico/historico-page.tsx`)

| Fronteira | Regra |
|---|---|
| Corpo (premium, largo) | grade `[filtros+lista 520px] [registro]` |
| Corpo (premium, estreito) | **inalterado** |
| Detalhe | reusa os blocos de hoje: valor cotado + base, detalhamento, canais, ficha técnica, validade, aviso de congelado, recalcular, comparar, exportar, excluir, editar rótulo |
| Rota `/historico/$id` | continua existindo e respondendo igual |
| Paginação | carregar mais **não** troca o registro aberto |
| Pendências | o aviso de registros pendentes continua acima da grade; o selo continua no card |

**Proibição explícita**: nenhum caminho novo pode escrever num registro congelado (ADR-0019 —
imutabilidade é do banco, e continua sendo).

---

## C3 — Kits (`pages/bom/bom-page.tsx` + `features/bom/assembly-summary.tsx`)

```
AssemblySummary({ bom, uiSkipped, excludedLineCount, variant })
   variant: "pinned"  (padrão — mobile/estreito, comportamento de hoje)
          | "column"  (desktop largo — sem .assembly-summary__pinned)
```

| Fronteira | Regra |
|---|---|
| Corpo (largo) | grade `[peças] [resumo 480px]`; resumo em coluna fixa |
| Corpo (estreito) | **inalterado**, barra fixa no rodapé incluída |
| Conteúdo do resumo | custo total + contagem · varejo · atacado · canais do kit · nome · salvar |
| Peça inválida | continua fora do total; o aviso continua no card da peça; o resumo continua declarando quantas ficaram de fora |
| `--pinned-bottom` / 014-T118 | intocado — é o contrato do mobile |

---

## C4 — Conta (`pages/conta/conta-page.tsx`)

| Fronteira | Regra |
|---|---|
| Corpo (largo) | 3 colunas: identidade+plano(+oferta) · tema · privacidade+sair |
| Corpo (estreito) | **inalterado** |
| Plano | `PlanSection` continua recebendo o estado **resolvido** (SC-708: o painel não vê ledger nem espelho do PSP e portanto não pode inferir) |
| Tema | controle segmentado escreve no mesmo `useThemeStore`; o interruptor do mobile permanece |
| `?checkout=retorno` | continua tomando a página inteira, em qualquer largura |

---

## C5 — Menu (`app/app-shell.tsx` + `widgets/app-nav/app-nav.tsx`)

| Fronteira | Regra |
|---|---|
| Larguras | rail só existe no desktop; mobile não monta nada disso |
| Estado | `precifica3d-nav-rail` (aparelho), padrão expandido |
| Recolhido | 76px, ícones centralizados |
| Rótulo | **some da tela, nunca da árvore de acessibilidade** — nome acessível preservado |
| Botão "Recolher" | fora da lista de itens: não entra na travessia por setas |
| Teclado | roving tabindex de hoje continua funcionando idêntico |

---

## C6 — Invariantes que atravessam tudo

1. **Zero mudança de número.** Nenhum valor calculado muda; os vetores canônicos são a trava.
2. **Zero mudança de contrato.** Nenhum endpoint, payload ou schema é tocado.
3. **Zero primitiva nova de DS.** `segmented.tsx` é composição de `Button`/tokens existentes.
4. **Um teaser, nunca dois.** Em qualquer largura, para grátis/deslogado.
5. **Servidor manda no entitlement.** Nenhum caminho novo de escrita escapa do gate de hoje.
6. **O mobile é o mesmo código.** Não equivalente: o mesmo.
