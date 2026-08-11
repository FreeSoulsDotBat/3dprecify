# DoD evidence — 018 Abas desktop

**Branch**: `018-abas-desktop` (a partir de `develop`) · **Data**: 2026-08-11
**Estado**: código completo · **homologado pelo assistente** (PASS COM RESSALVAS 88%, 2 defeitos achados e corrigidos) · **NÃO homologado pelo dono**. Registro: [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md). Ver §7.

---

## 1. O que foi construído

| Fatia | Entrega | Onde |
|---|---|---|
| Fundação | `useIsWide` (gate único, 1280px) · `nav-rail-store` · `Segmented` · auxiliar de teste de `matchMedia` | `shared/lib/`, `shared/ui/` |
| US5 | Menu recolhível 240↔76px, botão "Recolher" no rodapé do menu | `widgets/app-nav/`, `app/app-shell.*` |
| US1 | Catálogo mestre-detalhe: cabeçalho com pílulas, busca, lista, ficha fixa de 560px | `features/catalog/catalog-panel.tsx` + `catalog-master-detail.css`, `pages/catalogo/` |
| US2 | Orçamentos mestre-detalhe: lista 520px + registro congelado | `pages/historico/` |
| US3 | Kits em duas colunas, resumo de 480px, sem barra no rodapé | `pages/bom/`, `features/bom/assembly-summary.tsx` |
| US4 | Conta em três colunas, tema segmentado, oferta inline, aviso de privacidade | `pages/conta/` |

Nenhuma fórmula, contrato de API ou esquema foi tocado. `pricing-core` não subiu de versão.

---

## 2. A prova do mobile (US6 / SC-005) — **medida, não afirmada**

**Método**: assinatura de 5 rotas × 2 larguras (390 e 360), capturada ANTES do primeiro commit
(`evidencias/baseline-mobile/`) e recapturada depois de todas as fatias. A assinatura lê **caixas do
DOM** (`getBoundingClientRect` de 10 marcos de layout), os dois eixos de rolagem, o `data-layout`, o
`<h1>` e a contagem de teasers.

```
MOBILE IDENTICO: 0 diferencas em 10 telas
```

Nenhum marco moveu um décimo de pixel. Isso não é sorte: é consequência de duas escolhas.

1. **`useIsWide` responde `false` sem `matchMedia`** (ADR-0031/B). Em jsdom não existe `matchMedia`,
   então **a suíte inteira do app continua exercitando o ramo mobile** — 1 528 testes, nenhum
   alterado para acomodar o 018.
2. **`display: contents` nos invólucros do Kits.** Abaixo do corte os dois `<div>` novos somem do
   layout e os filhos voltam a ser filhos diretos da `<section>`, herdando o mesmo `gap`. O mobile
   não ficou "equivalente" — ficou a mesma caixa.

## 3. O corte de 1280px (SC-003) — medido em quatro larguras

| Largura | Catálogo: lista / ficha | Transbordo horizontal |
|---|---|---|
| 1920 | 1032 / 560 (duas colunas de cards) | 0 |
| 1600 | 712 / 560 | 0 |
| 1280 | 392 / 560 (uma coluna) | 0 |
| **1279** | **não existe** — a tela de hoje | 0 |
| 1024 | não existe | 0 |
| 390 / 360 | não existe | 0 |

O par 1280/1279 é o que prova o limiar. `overflowX = 0` em todas as larguras, nas quatro telas.

## 4. Largura útil (SC-001)

A 1920px, com `--content-max-wide` em 1720px: **100% da largura útil de conteúdo** nas quatro telas
(medido como `section.width / (main.clientWidth − goteiras)`). O teto de 1120px do 016 continua
valendo até 1279px.

Recolher o menu devolve **164px** ao conteúdo (main 1680 → 1844) — SC-004 pede ≥160.

## 5. Testes

`pnpm gate:all` verde: formato · lint + fronteiras · dependency-cruiser (466 módulos) · typecheck ·
**1 528 testes de frontend** · backend 473 + cobertura 82,67% · import-linter 5/5.

Testes novos deste incremento:

| Arquivo | O que trava |
|---|---|
| `shared/lib/use-is-wide.test.ts` | o gate, incluindo o caso sem `matchMedia` — o que protege o mobile |
| `shared/ui/nav-rail-store.test.ts` | preferência do rail, incl. degradação quando o armazenamento recusa escrita |
| `shared/ui/segmented.test.tsx` | teclado (um tabstop, setas, Home/End) e os dois papéis (tablist/radiogroup) |
| `widgets/app-nav/app-nav-rail.test.tsx` | recolher/expandir + **o rótulo sai da tela, nunca da árvore de acessibilidade** |
| `features/catalog/catalog-master-detail.test.tsx` | clicar seleciona sem navegar · busca · seleção derivada · produto abre a página · nada disso existe a 1279 |
| `features/bom/assembly-summary-variant.test.tsx` | `pinned` é o padrão; `column` não deixa nada no rodapé |
| `pages/conta/conta-desktop.test.tsx` | tema segmentado no desktop, **interruptor no mobile**, oferta inline |

## 6. O que o navegador achou que os testes não achariam

Duas coisas, e as duas só apareceram na imagem ou na medida — não numa asserção:

1. **O botão "Recolher" nascia fora de alcance.** A sidebar é irmã flex do `<main>` e esticava com o
   conteúdo: medido em **2 803px de altura** numa `/calcular` cheia, com o botão no fim daquilo. O
   conserto foi dar ao menu a altura da janela (`position: sticky; height: 100dvh;
   align-self: flex-start`).
2. **O campo de busca do Catálogo usava o ícone de PACOTE.** Não havia lupa no conjunto de ícones.
   Nenhuma asserção de texto veria isso; a imagem viu na primeira olhada. Entrou `search` (Lucide),
   com o SVG de proveniência em `public/brand/icons/lucide/`.

E um defeito que os **testes** acharam, este sim: a primeira versão do `HistoryLedger` declarava o
invólucro como um **componente dentro do componente**. Cada render criava uma função nova, o React
via um tipo novo e desmontava a subárvore — o campo de busca do Orçamentos perdia o que era digitado
a cada tecla e o debounce nunca chegava ao servidor. Dois testes do US6 falharam na hora.

## 7. O que NÃO está feito — e é preciso dizer

- **A homologação do dono não aconteceu.** Tudo aqui é `CORREÇÃO DECLARADA`
  (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`). O que fecha o 018 é a segunda passada dele.
- **Não há guarda de geometria PERMANENTE** para as novas larguras. As medidas de §3 foram feitas
  por script, uma vez. A tarefa T028/T036/T043/T050 (estender
  `tests/e2e/pages-desktop-width.spec.ts`) **não foi executada** — sem ela, uma regressão de layout
  não tem quem a pegue no CI. É a pendência mais séria deste PR.
- **A caminhada e2e (Playwright) não rodou** neste ciclo; a verificação de navegador foi feita por
  script próprio contra o servidor de desenvolvimento, com conta premium real e catálogo semeado.
- ~~Orçamentos e Kits medidos sem dados densos~~ — **corrigido** na homologação de 2026-08-11, com dados adversariais semeados. Texto original: Orçamentos e Kits foram medidos sem dados densos: o Kits estava com o compositor vazio e o
  Orçamentos sem registros gravados, então o mestre-detalhe do Orçamentos e a coluna de resumo do
  Kits foram exercitados por teste e por composição, **não por uma tela cheia de dados reais**.
- ~~Não foi medido em tema claro~~ — **corrigido**: os dois temas foram medidos na homologação de 2026-08-11 (e a frase original estava invertida: o que faltava era o ESCURO). Segue sem **leitor de tela real**.

## 8. Desvios conscientes do arquivo de design

| Desvio | Por quê |
|---|---|
| O rótulo do menu recolhido usa `sr-only`, não `display: none` | O desenho apagaria o nome de cada item para leitor de tela. O que se vê é o desenho; o que se ouve continua sendo "Catálogo" |
| O botão de adicionar do Catálogo fica ao lado da BUSCA, não das pílulas | Levá-lo ao cabeçalho exigiria a página conhecer a ação de criar de cada um dos 4 painéis. Fica para o dono aceitar ou recusar |
| A ficha de Produto/Kit resume e abre a página cheia | Decisão do dono no clarify de 2026-08-10 |
| O aviso de privacidade não tem link para a política | O desenho não tem um; a versão com `Link` exigia contexto de roteador e quebrava 7 testes |

## 9. ADR

**ADR-0031** (`docs/adr/0031-desktop-composition-gate.md`) está **Proposed**. Ele cobre o gate único,
a invariância mobile estrutural, onde mora a seleção e a persistência do rail. O dono flipa para
Accepted no gate — com uma correção a registrar: o ADR diz que a seleção é estado do componente nos
dois mestre-detalhes; no **Orçamentos** ela mora em `?snapshot=`, onde já morava desde o 013/F-02.
Usar o que existia foi mais fiel ao código do que aplicar a regra ao pé da letra.
