# Implementation Plan: Abas desktop — Catálogo, Kits, Orçamentos e Conta

**Branch**: `018-abas-desktop` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-abas-desktop/spec.md`

**Autoridade de design**: [`design/Abas-Desktop.dc.html`](./design/Abas-Desktop.dc.html)
**Autoridade de decisão técnica**: [`research.md`](./research.md) (decisões **A–H**). Este incremento
**não** tem `arquitetura-018.md` separado — as decisões estruturais moram em `research.md`, e duplicá-las
num segundo arquivo violaria o Princípio VI (docs enxutos). Quem procurar "a arquitetura do 018" lê
`research.md`.

---

## Summary

Implementar, em desktop ≥1280px, a composição desenhada pelo dono para Catálogo, Kits, Orçamentos e
Conta, mais o rail colapsável do menu. **É um incremento de composição**: nenhuma fórmula, contrato de
API, esquema de dados ou primitiva de design system muda — verificado antes de planejar (as 16 classes
do desenho já existem; os preços por canal do kit e o conteúdo do detalhe do orçamento já existem).

A abordagem técnica em uma frase: **um único gate de largura (`useIsWide`, matchMedia ≥1280px)
seleciona uma composição alternativa nas quatro páginas, e o mobile fica estruturalmente inalcançável
por ela** — abaixo de 1280px o ramo novo não existe na árvore renderizada, e é assim que a US6
("o mobile não se mexe") deixa de depender de disciplina e passa a depender do tipo.

---

## Technical Context

**Language/Version**: TypeScript 5.x · React 19 (já no repo; nenhuma versão sobe neste incremento)

**Primary Dependencies**: Vite 8 PWA · Tailwind v4 + design system `tf-*` (ADR-0007) · TanStack
Router/Query · Zustand · React Hook Form + Zod — **todas já instaladas; nenhuma dependência nova**

**Storage**: nenhuma mudança de servidor ou de esquema. **Uma** chave nova de `localStorage`
(`precifica3d-nav-rail`), no mesmo padrão do tema (`precifica3d-theme`)

**Testing**: Vitest + Testing Library (lógica e composição) · Playwright (e2e) · guardas de
**geometria** lidas do DOM (a lição do 014/Fase 6C: `toBeVisible` passa em elemento ocluso) ·
homologação visual do dono (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`)

**Target Platform**: web desktop ≥1280px para o que é novo; web mobile e tablet inalterados; Android
(PWA/Capacitor) segue o caminho mobile

**Project Type**: web — monorepo pnpm (`apps/web` + `backend` + `packages/*`). **Só `apps/web` é
tocado.**

**Performance Goals**: nenhuma requisição nova; a troca de item selecionado é estado local e deve
repintar sem novo fetch (os dados da seção já estão em cache do TanStack Query)

**Constraints**: zero mudança de fórmula/contrato/esquema · zero primitiva nova de DS · composição
mobile idêntica · sem transbordo horizontal em nenhuma das larguras de SC-003 · sem segunda barra de
rolagem criada pela coluna fixa

**Scale/Scope**: 4 páginas + 1 widget de navegação + 1 shell; ~6 arquivos de composição, ~5 de CSS

---

## Constitution Check

*GATE: passa antes da Fase 0 e é reavaliado após a Fase 1.*

- [x] **I. Scalability & Quality First** — a composição desktop reusa o mesmo núcleo compartilhado
      (`pricing-core`, entities, features); nada é bifurcado por plataforma. O gate de largura é um
      ponto único, não uma condicional espalhada.
- [x] **II. Truth Over Approval** — tudo que fundamenta o escopo foi **verificado no código antes de
      planejar**, não suposto: as 16 classes do desenho existem; `CatalogPanel` tem dois modos
      (gaveta para filamento/impressora, navegação para produtos); o kit já tem `ChannelRollup`; o
      detalhe do orçamento já tem Detalhamento/Canais/Ficha técnica e "Validade da proposta". Risco
      aberto e declarado: **a coluna fixa e a rolagem** são a parte que só o navegador real prova
      (jsdom é cego a layout — o projeto pagou isso três vezes).
- [x] **III. Test-First** — cada fatia entra com teste vermelho antes: composição (RTL com
      `matchMedia` largo), geometria (caixas do DOM), e o guard de invariância mobile. Nenhuma
      fórmula é tocada, então não há vetor numérico novo — os vetores existentes servem de trava
      (SC-007).
- [x] **IV. Server-Side Entitlements** — nada muda: o teaser continua saindo de estado **positivamente
      conhecido**, as escritas continuam barradas pelo servidor, e a ficha do Catálogo não ganha
      nenhum caminho de escrita que não passe pelas mutations de hoje.
- [x] **V. Clean Architecture Integrity** — reuso obrigatório: `CatalogPanel`, `FilamentForm`,
      `PrinterForm`, `AssemblySummary`, `ChannelRollup`, `TechnicalSheet`, `PlanSection`,
      `OfferPanel`, `PremiumTeaser` são **recompostos, não reescritos**. FSD-Lite mantido: páginas
      compõem features/widgets; nenhuma feature passa a importar página.
- [x] **VI. Lean Living Documentation** — sem `arquitetura-018.md` redundante; as decisões vivem em
      `research.md` e os invariantes na spec.
- [x] **VII. Spec-Driven Flow** — `/speckit-specify` e `/speckit-clarify` concluídos (3 decisões do
      dono registradas, 0 marcadores abertos); `/speckit-tasks` é o próximo passo.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — as três escolhas
      estruturais deste incremento estão **decididas e registradas**, não inferidas:
      (1) o gate de largura e a invariância mobile estrutural, (2) onde mora a seleção do
      mestre-detalhe, (3) a persistência do rail. Elas viram **ADR-0031** (Proposed), que o dono
      flipa no gate da fatia — o mesmo ritual dos ADRs 0025–0030. Nenhum item estrutural fica em
      aberto ao entrar na implementação.

---

## Project Structure

### Documentation (this feature)

```text
specs/018-abas-desktop/
├── spec.md                      # o quê e por quê (pós-clarify)
├── plan.md                      # este arquivo
├── research.md                  # Fase 0 — decisões A–H (autoridade técnica)
├── data-model.md                # Fase 1 — estado de UI; nenhuma entidade persistida nova
├── quickstart.md                # Fase 1 — como validar rodando
├── contracts/
│   └── ui-desktop.md            # Fase 1 — contrato de composição das quatro telas
├── design/
│   └── Abas-Desktop.dc.html     # autoridade de layout (cópia versionada do Claude Design)
└── tasks.md                     # Fase 2 — /speckit-tasks (ainda não criado)
```

### Source Code (repository root)

```text
apps/web/src/
├── app/
│   ├── app-shell.tsx            # ALTERA: passa o estado do rail para a sidebar
│   └── app-shell.css            # ALTERA: --sidebar-w vira variável de estado (240px ↔ 76px)
├── shared/
│   ├── lib/
│   │   └── use-is-wide.ts       # NOVO: o único gate de largura (matchMedia ≥1280px)
│   └── ui/
│       ├── nav-rail-store.ts    # NOVO: preferência do rail, padrão do theme-store
│       └── segmented.tsx        # NOVO (composição, não primitiva): grupo segmentado
│                                #   reaproveitado por Catálogo (seções) e Conta (tema)
├── widgets/
│   └── app-nav/
│       ├── app-nav.tsx          # ALTERA: variante colapsada + botão "Recolher"
│       └── app-nav.css          # ALTERA: rail de ícones
├── features/
│   ├── catalog/
│   │   └── catalog-detail.tsx   # NOVO: a ficha da direita (edita filamento/impressora,
│   │                            #   resume produto/kit) — reusa FilamentForm/PrinterForm
│   └── bom/
│       └── assembly-summary.tsx # ALTERA: aceita a variante "coluna" (sem barra fixa)
└── pages/
    ├── catalogo/catalogo-page.tsx     # ALTERA: composição mestre-detalhe no desktop
    ├── bom/bom-page.tsx               # ALTERA: duas colunas no desktop
    ├── historico/historico-page.tsx   # ALTERA: mestre-detalhe no desktop
    └── conta/conta-page.tsx           # ALTERA: grade de três colunas no desktop
```

**Structure Decision**: FSD-Lite existente, sem camada nova. O único arquivo verdadeiramente
transversal é `shared/lib/use-is-wide.ts` — ele mora em `shared` porque quatro páginas e um widget o
consomem, e porque um segundo `matchMedia` espalhado seria a origem óbvia de divergência entre
"o menu acha que é desktop" e "a página acha que não".

`segmented.tsx` entra como **composição sobre o DS**, não primitiva nova: ele monta `Button`/tokens
existentes no mesmo padrão de `role="tablist"` + roving tabindex que `catalogo-page.tsx` já usa hoje —
o objetivo é ter UM lugar para esse padrão, não dois (Catálogo e Conta) divergindo.

---

## Complexity Tracking

> Sem violações da Constituição. Nada a justificar.

Duas escolhas caras foram **rejeitadas** e ficam registradas para não voltarem por engano
(detalhe em `research.md`):

| Rejeitado | Por quê |
|---|---|
| Mestre-detalhe por rota (`/catalogo/$id` renderizando lista+detalhe) | Reabre a armadilha do `base:'./'` (rota de 2 segmentos branca em carga fria) que o projeto já contornou com query param |
| Recompor o formulário completo de Produto dentro da ficha de 560px | Decisão do dono no clarify; e seria reescrever o maior formulário do app para caber num painel |
