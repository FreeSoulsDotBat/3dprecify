# Tasks: Abas desktop — Catálogo, Kits, Orçamentos e Conta

**Feature**: `018-abas-desktop` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Autoridade de layout**: [`design/Abas-Desktop.dc.html`](./design/Abas-Desktop.dc.html)
**Autoridade técnica**: [`research.md`](./research.md) (decisões A–H) · **ADR-0031** (Proposed)

**Testes são obrigatórios aqui** — não por preferência, mas pelo Princípio III da Constituição
(test-first) e porque este é um incremento de layout, a classe que o projeto já diagnosticou errado
três vezes fora do navegador.

**Ordem das fatias** (cada uma é um PR autorizado pelo dono):

| Fatia | Conteúdo | Por que nesta ordem |
|---|---|---|
| **PR-A** | Fase 1 + Fase 2 + US5 (menu) | Prova o gate no caminho mais barato e visível antes de qualquer tela grande depender dele |
| **PR-B** | US1 Catálogo | A tela que o dono citou primeiro e a que mais perde área hoje |
| **PR-C** | US2 Orçamentos | Mesmo padrão mestre-detalhe do PR-B, já validado |
| **PR-D** | US3 Kits | Toca `AssemblySummary`, compartilhado com o mobile — depois do padrão firmado |
| **PR-E** | US4 Conta + Polish | Menor risco, fecha o incremento |

---

## Phase 1: Setup — a linha de base antes de mexer em qualquer coisa

- [x] T001 Capturar a **linha de base do mobile** ANTES de qualquer alteração de código: screenshots de `/catalogo`, `/kits`, `/historico` e `/conta` a 390px e a 360px, em 1:1, salvas em `specs/018-abas-desktop/evidencias/baseline-mobile/`. Sem esta captura, SC-005 ("o mobile é indistinguível do atual") não tem contra o quê comparar — e depois do primeiro commit ela não existe mais.
- [x] T002 [P] Subir o produto pelo caminho do `quickstart.md` e registrar em `specs/018-abas-desktop/evidencias/ambiente.md` que `/health` respondeu **200** e `/api/v1/entitlement` respondeu **401** (500 aqui invalida tudo que vier depois). **Feito 2026-08-26** → [evidencias/ambiente.md](./evidencias/ambiente.md): /health 200 · /api/v1/entitlement 401 · postgres healthy/0007.
- [x] T003 [P] Registrar a estimativa de tokens desta operação em `docs/token-ledger.md` (regra do dono 2026-07-10: estimar ANTES, anotar o real DEPOIS). **Linha do fechamento adicionada 2026-08-26** (estimativa ~150k; real fecha no T058).

---

## Phase 2: Foundational — o gate e as peças compartilhadas (BLOQUEIA todas as histórias)

**Nada das fases 3+ começa antes desta fase inteira estar verde.**

- [x] T004 Escrever o teste vermelho do gate em `apps/web/src/shared/lib/use-is-wide.test.ts`: retorna `false` sem `window.matchMedia`; `true` a 1280px; `false` a 1279px; reage a mudança de largura; remove o listener ao desmontar.
- [x] T005 Implementar `apps/web/src/shared/lib/use-is-wide.ts` — `matchMedia("(min-width: 1280px)")`, defensivo contra ausência de `window`/`matchMedia`, no mesmo molde do `useIsMobile` de `apps/web/src/app/app-shell.tsx`. É o **único** `matchMedia` de largura do incremento (ADR-0031/Opção C).
- [x] T006 [P] Criar o auxiliar de teste `apps/web/src/shared/lib/match-media.test-helper.ts` que instala um `matchMedia` largo/estreito em jsdom. O nome NÃO termina em `.test.ts`, então o vitest não o coleta, e o app nunca o importa.
- [x] T007 [P] Escrever o teste vermelho de `apps/web/src/shared/ui/nav-rail-store.test.ts`: padrão expandido; alternar persiste; rehidrata do `localStorage`; degrada para o padrão em memória quando `localStorage` lança.
- [x] T008 [P] Implementar `apps/web/src/shared/ui/nav-rail-store.ts` — Zustand + `persist`, chave `precifica3d-nav-rail`, molde idêntico ao `apps/web/src/shared/ui/theme-store.ts`, **sem** script de pré-paint (research §G).
- [x] T009 [P] Escrever o teste vermelho de `apps/web/src/shared/ui/segmented.test.tsx`: `role`/`aria-selected` corretos, um único ponto de tabulação, setas e Home/End percorrendo, clique selecionando.
- [x] T010 [P] Implementar `apps/web/src/shared/ui/segmented.tsx` compondo `Button` e tokens existentes, extraindo o padrão que hoje vive dentro de `apps/web/src/pages/catalogo/catalogo-page.tsx` (`CatalogTabs`). **Não é primitiva nova de DS** — é o padrão existente com um dono só.
- [x] T011 Exportar `Segmented` em `apps/web/src/shared/ui/index.ts` e confirmar que `pnpm --filter web lint` continua limpo nos limites (eslint-boundaries + dependency-cruiser).
- [x] T012 Rodar `pnpm gate:all` e confirmar verde com a fase 2 completa e **nenhuma tela alterada** — a prova de que a fundação não mexeu em nada ainda.

**Checkpoint**: `useIsWide` existe, é falso em jsdom, e a suíte inteira continua exercitando o ramo de hoje.

---

## Phase 3: US5 — O menu recolhe (P2) · fatia PR-A

**Meta**: o rail colapsável, que é o consumidor mais barato do gate.
**Teste independente**: no desktop, recolher, navegar, recarregar e confirmar que continua recolhido; no mobile, confirmar que nada disso existe.

- [x] T013 [P] [US5] Escrever o teste vermelho em `apps/web/src/widgets/app-nav/app-nav-rail.test.tsx`: com `matchMedia` largo, o botão "Recolher" existe; ao acionar, os rótulos saem da TELA mas **o nome acessível de cada item permanece**; com `matchMedia` estreito, não existe botão nenhum.
- [x] T014 [P] [US5] Escrever o teste vermelho em `apps/web/src/widgets/app-nav/app-nav.test.tsx` (arquivo existente, caso novo): recolhido, a travessia por setas com um único ponto de tabulação continua idêntica, e o botão "Recolher" **não** entra na travessia.
- [x] T015 [US5] Implementar a variante recolhida em `apps/web/src/widgets/app-nav/app-nav.tsx`: prop de estado do rail, botão "Recolher" **fora** da `<ul>`, rótulo escondido visualmente (nunca `display:none` — research §G).
- [x] T016 [US5] Implementar o CSS do rail em `apps/web/src/widgets/app-nav/app-nav.css`: 76px, ícones centralizados, transição de largura.
- [x] T017 [US5] Ligar o estado em `apps/web/src/app/app-shell.tsx` (lendo `nav-rail-store` e `useIsWide`) e transformar `--sidebar-w` em variável de estado em `apps/web/src/app/app-shell.css` (240px ↔ 76px).
- [x] T018 [US5] Estender `apps/web/tests/e2e/shell.spec.ts` com o caminho real: recolher → navegar → recarregar → continua recolhido; e a medida de que o conteúdo ganhou ≥160px de largura (SC-004). **Verde 2026-08-26 (4/4)** — medida com expect.poll: a 1ª versão lia o boundingBox no MEIO da transição do rail (121px/24px "de ganho" na mesma tela).
- [x] T019 [US5] Rodar `pnpm gate:all` + e2e do shell e registrar o resultado em `specs/018-abas-desktop/dod-evidence.md`. **Verde 2026-08-26**: gate:all EXIT 0 (1602 unit FE, cobertura 87,9%/82,7% BE) + shell e2e 4/4 — dod-evidence §Fechamento.

---

## Phase 4: US1 — Catálogo mestre-detalhe (P1) · fatia PR-B · **MVP**

**Meta**: lista e ficha na mesma tela, sem navegação.
**Teste independente**: premium a ≥1280px, alternar as 4 seções, clicar em 3 itens, confirmar que a ficha troca e a URL não muda.

- [x] T020 [P] [US1] Escrever o teste vermelho em `apps/web/src/pages/catalogo/catalogo-desktop.test.tsx`: com `matchMedia` largo e premium, renderiza cabeçalho + segmentado + busca + lista + ficha; clicar noutro card troca a ficha **sem chamar `navigate`**; trocar de seção reinicia a seleção; item excluído não deixa ficha órfã; seção vazia mostra o vazio nos dois lados.
- [x] T021 [P] [US1] Escrever o teste vermelho da busca em `apps/web/src/pages/catalogo/catalogo-busca.test.tsx`: filtra a seção ativa sobre a lista em cache e **não dispara requisição**.
- [x] T022 [P] [US1] Escrever o teste vermelho do teaser em `apps/web/src/pages/catalogo/catalogo-teaser.test.tsx` (arquivo existente, caso novo): com `matchMedia` largo e conta grátis, **um** teaser e nenhuma lista.
- [x] T023 [US1] Implementar `apps/web/src/features/catalog/catalog-detail.tsx` — a ficha: para filamento/impressora monta `FilamentForm`/`PrinterForm` **existentes** com as mutations de hoje; para produto/kit resume e navega para o editor de hoje (research §E, contrato C1).
- [x] T024 [US1] Implementar a composição desktop em `apps/web/src/pages/catalogo/catalogo-page.tsx` atrás de `useIsWide()`, mantendo o ramo estreito **literalmente o de hoje**; trocar `CatalogTabs` local pelo `Segmented` compartilhado nos dois ramos.
- [x] T025 [US1] Implementar o CSS da grade em `apps/web/src/pages/catalogo/catalogo-page.css` (novo): `[lista] [ficha 560px]`, lista 1 coluna até ~1600px e 2 acima, ficha `position: sticky` + `align-self: start` (research §F).
- [x] T026 [US1] Garantir que salvar pela ficha reflete no card da lista sem recarregar, e que a falha de escrita mantém os valores digitados (FR-016a) — caso no teste de T020.
- [x] T027 [US1] Estender `apps/web/tests/e2e/catalog.spec.ts` com o caminho real do mestre-detalhe a 1920px e a 1280px. **Verde 2026-08-26 (2/2)** — troca de seleção troca a ficha, pathname intacto.
- [x] T028 [US1] Guarda de geometria: estender `apps/web/tests/e2e/pages-desktop-width.spec.ts` para `/catalogo` medindo **os dois eixos** em 1920, 1600, 1440, 1280 e **1279** (a largura que prova o corte), e a coluna fixa não podendo empurrar a página. **Satisfeita por guarda SUPERIOR** (review do PR #58): [overflow-geometria.spec.ts](../../apps/web/tests/e2e/overflow-geometria.spec.ts) — dois eixos + nós de TEXTO por Range, 10 larguras incl. 1279/1600/1920 (1600/1920 adicionadas no fechamento, 2026-08-26) + [pages-desktop-width.spec.ts](../../apps/web/tests/e2e/pages-desktop-width.spec.ts) (≥40% de uso).
- [x] T029 [US1] Homologação visual da fatia com screenshots em 1:1 (nunca redimensionados) — a lição do 016. **Satisfeita CONSOLIDADA** (não por fatia): homologação do assistente de 2026-08-11 (PASS COM RESSALVAS 88%, dois temas, dados adversariais — [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md)) + homologação AUTOMATIZADA (773 verificações, 26/35 achados corrigidos — dod-evidence §132+). A passada do DONO segue pendente por regra (dod §7) e foi absorvida pela homologação do 019 (ver T060).

---

## Phase 5: US2 — Orçamentos mestre-detalhe (P1) · fatia PR-C

**Meta**: filtros + lista à esquerda, registro congelado aberto à direita.
**Teste independente**: premium a ≥1280px, clicar em registros diferentes, "Carregar mais" e confirmar que o aberto não muda.

- [x] T030 [P] [US2] Escrever o teste vermelho em `apps/web/src/pages/historico/historico-desktop.test.tsx`: renderiza a grade; clicar troca o painel sem navegar; "Carregar mais" **não** troca o registro aberto; o selo de pendência continua no card e o aviso acima da grade.
- [x] T031 [US2] Extrair de `apps/web/src/pages/historico/snapshot-detail-page.tsx` os blocos do detalhe (valor cotado + base, detalhamento, canais, ficha técnica, validade, aviso de congelado) para um componente reusável, **sem duplicar**, mantendo a rota `/historico/$id` montando o mesmo componente.
- [x] T032 [US2] Implementar a composição desktop em `apps/web/src/pages/historico/historico-page.tsx` atrás de `useIsWide()`, com o ramo estreito intocado.
- [x] T033 [US2] Implementar o CSS da grade em `apps/web/src/pages/historico/historico-page.css`: `[filtros+lista 520px] [registro]`, painel `sticky`.
- [x] T034 [US2] Confirmar que nenhum caminho novo escreve num registro congelado (ADR-0019) — caso explícito no teste de T030.
- [x] T035 [US2] Estender `apps/web/tests/e2e/history-manage.spec.ts` com o mestre-detalhe e confirmar que `/historico/<id>` direto continua respondendo. **Verde 2026-08-26** — lista+registro juntos a 1440px; "link direto" na forma honesta pós-013/F-02: `?snapshot=` sobrevive a reload (a rota de 2 segmentos morreu com o base:'./').
- [x] T036 [US2] Guarda de geometria de `/historico` em `apps/web/tests/e2e/pages-desktop-width.spec.ts`, dois eixos, mesmas larguras de T028. **Satisfeita pela mesma guarda superior do T028** (overflow-geometria varre /historico).
- [x] T037 [US2] Homologação visual da fatia, screenshots 1:1. **Satisfeita CONSOLIDADA** (não por fatia): homologação do assistente de 2026-08-11 (PASS COM RESSALVAS 88%, dois temas, dados adversariais — [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md)) + homologação AUTOMATIZADA (773 verificações, 26/35 achados corrigidos — dod-evidence §132+). A passada do DONO segue pendente por regra (dod §7) e foi absorvida pela homologação do 019 (ver T060).

---

## Phase 6: US3 — Kits com resumo em coluna (P1) · fatia PR-D

**Meta**: o total sai do rodapé e vira coluna fixa no desktop; o mobile mantém a barra.
**Teste independente**: montar kit de 3 peças a ≥1280px, mudar quantidades, confirmar o resumo respondendo e nenhuma barra no rodapé; a 1279px a barra volta.

- [x] T038 [P] [US3] Escrever o teste vermelho em `apps/web/src/features/bom/assembly-summary.test.tsx`: `variant="column"` **não** renderiza `.assembly-summary__pinned`; `variant="pinned"` (padrão) renderiza exatamente como hoje; peça inválida continua fora do total e a contagem de excluídas continua declarada nos dois modos.
- [x] T039 [US3] Implementar a prop `variant` em `apps/web/src/features/bom/assembly-summary.tsx` sem tocar em `--pinned-bottom` nem na lógica do 014/T118.
- [x] T040 [US3] Implementar a composição desktop em `apps/web/src/pages/bom/bom-page.tsx` atrás de `useIsWide()`: `[peças] [resumo 480px]`, com nome do kit e salvar na coluna.
- [x] T041 [US3] Implementar o CSS em `apps/web/src/features/bom/assembly-summary.css` para a variante coluna, deixando as regras da barra fixa intactas.
- [x] T042 [US3] Estender `apps/web/tests/e2e/bom.spec.ts`: a 1920px não existe `[data-testid=kit-total-bar]` fixado; a 1279px existe. **Verde 2026-08-26 (2/2)** — por CLASSE+position computada (o testid existe nas DUAS variantes; "existir" não provava nada).
- [x] T043 [US3] Guarda de geometria de `/kits` em `apps/web/tests/e2e/pages-desktop-width.spec.ts`, dois eixos. **Satisfeita pela mesma guarda superior do T028** (overflow-geometria varre /kits).
- [x] T044 [US3] Homologação visual da fatia, screenshots 1:1. **Satisfeita CONSOLIDADA** (não por fatia): homologação do assistente de 2026-08-11 (PASS COM RESSALVAS 88%, dois temas, dados adversariais — [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md)) + homologação AUTOMATIZADA (773 verificações, 26/35 achados corrigidos — dod-evidence §132+). A passada do DONO segue pendente por regra (dod §7) e foi absorvida pela homologação do 019 (ver T060).

---

## Phase 7: US4 — Conta em três colunas (P2) · fatia PR-E

**Meta**: identidade+plano · tema · privacidade+sair.
**Teste independente**: abrir `/conta` como grátis e como premium a ≥1280px.

- [x] T045 [P] [US4] Escrever o teste vermelho em `apps/web/src/pages/conta/conta-desktop.test.tsx`: três colunas com `matchMedia` largo; a oferta aparece na coluna do plano para grátis; `?checkout=retorno` continua tomando a página inteira; a 390px o interruptor de tema é o de hoje.
- [x] T046 [US4] Implementar a composição desktop em `apps/web/src/pages/conta/conta-page.tsx` atrás de `useIsWide()`.
- [x] T047 [US4] Implementar o tema segmentado (desktop) reusando `Segmented`, escrevendo no mesmo `useThemeStore` — o interruptor do mobile permanece (research §I).
- [x] T048 [US4] Implementar o CSS da grade em `apps/web/src/pages/conta/conta-page.css`.
- [x] T049 [US4] Confirmar por FORMA que `PlanSection` continua recebendo o estado resolvido e sem acesso ao ledger/espelho do PSP (SC-708): `git diff develop -- apps/web/src/features/billing/plan-panel.tsx` deve ser **vazio**.
- [x] T050 [US4] Guarda de geometria de `/conta` em `apps/web/tests/e2e/pages-desktop-width.spec.ts`, dois eixos. **Satisfeita pela guarda do T028 + pages-desktop-width** (/conta autenticada medida lá; overflow-geometria não loga — limite registrado).
- [x] T051 [US4] Homologação visual da fatia, screenshots 1:1. **Satisfeita CONSOLIDADA** (não por fatia): homologação do assistente de 2026-08-11 (PASS COM RESSALVAS 88%, dois temas, dados adversariais — [evidencias/homologacao-2026-08-11.md](./evidencias/homologacao-2026-08-11.md)) + homologação AUTOMATIZADA (773 verificações, 26/35 achados corrigidos — dod-evidence §132+). A passada do DONO segue pendente por regra (dod §7) e foi absorvida pela homologação do 019 (ver T060).

---

## Phase 8: Polish & invariantes que atravessam tudo

- [x] T052 **A prova do mobile**: recapturar as 4 telas a 390px e 360px e comparar com a linha de base de T001, imagem a imagem, registrando o resultado em `specs/018-abas-desktop/dod-evidence.md` (SC-005). Divergência = defeito, não "melhoria".
- [x] T053 [P] Rodar o vetor canônico do `docs/homologacao/ROTEIRO-MANUAL.md` §1.1 e confirmar R$ 28,65 / R$ 42,98 / R$ 37,25 (SC-007). **Fechado 2026-08-26 com um achado**: 28,65/42,98/37,25 eram números do modelo **3.1.0** — o §1.1 pedia o campo Desperdício, morto no 016/PR-D. O vetor 4.1.0 é **27,55/41,33/35,82**, derivado executando o próprio pricing-core e JÁ asserido pela UI real em [calculator.spec.ts](../../apps/web/tests/e2e/calculator.spec.ts) ("SC-001 canonical vector"). SC-007 fica provado: o 018 não mudou valor nenhum — quem estava velho era o roteiro, e o §1.1 foi re-baselined com nota datada.
- [x] T054 [P] Varredura do teaser: as quatro telas premium, em conta grátis, mostram **exatamente um** convite ao Premium em 1920px e em 390px (SC-006). **Verde 2026-08-26 (8/8)** — teaser-sweep.spec.ts novo; as 4 telas do invariante 016/US1 são /catalogo, /kits, /historico e a FOLHA de Simulações (a /calcular tem 2 convites POR DESENHO: picker + gate).
- [x] T055 [P] Medir SC-001 lendo caixas do DOM a 1920px: cada tela ocupando ≥85% da largura útil de conteúdo, com o número anotado por tela.
- [x] T056 Provar que a guarda de geometria **não é vaga**: quebrar de propósito uma das grades e confirmar que a guarda fica vermelha (o projeto já teve guarda que passava em tudo). **Provada 2026-08-26**: min-width:2000px em .tf-costs-grid → vermelha a 360px nomeando `CAIXA DIV.tf-costs-grid`; revertida → verde nas 10 larguras (guarda estendida a 1600/1920 na mesma passada).
- [x] T057 [P] Conferir acessibilidade do rail com o nome acessível de cada item e a travessia por teclado, e registrar o método usado. **Método (2026-08-26)**: asserções de árvore de acessibilidade em jsdom — 9 testes verdes em app-nav-rail.test.tsx + app-nav.test.tsx (nome acessível de CADA seção preservado recolhido; travessia por setas idêntica com UM tabstop; botão Recolher/Expandir FORA da travessia e dizendo o que o clique VAI fazer) + o caminho real no e2e shell.spec.ts (T018).
- [x] T058 Atualizar `specs/018-abas-desktop/dod-evidence.md` com as evidências das cinco fatias e fechar a estimativa em `docs/token-ledger.md` (real vs. estimado). **Feito 2026-08-26** — dod-evidence §"Fechamento do incremento".
- [ ] T059 Pedir ao dono a virada do **ADR-0031** de Proposed para Accepted no gate da última fatia.
- [x] T060 ~~Abrir a rodada 2 do checklist de homologação~~ **SUPERADA por decisão do dono (2026-08-26, planejamento do 019)**: a rodada 2 destas quatro telas é ABSORVIDA pela homologação do incremento 019 (porte do design das 157 superfícies), que as redesenha de novo; e a homologação do 019 ESPERA a Rodada 1 fechar (regra da segunda passada intacta). Abrir uma rodada aqui geraria uma fila que o 019 invalidaria semanas depois. Texto original: abrir a rodada 2 para estas quatro telas em `docs/homologacao/rodadas/`, já no formato do processo — a implementação entrega `CORREÇÃO DECLARADA`, e só a segunda passada do dono fecha.

---

## Dependências

```
Fase 1 (T001–T003)
   └─> Fase 2 (T004–T012)          ← BLOQUEIA tudo
          ├─> Fase 3  US5 menu     (PR-A)
          ├─> Fase 4  US1 Catálogo (PR-B)  ← MVP
          ├─> Fase 5  US2 Orçamentos (PR-C) — usa o padrão firmado na Fase 4
          ├─> Fase 6  US3 Kits     (PR-D)
          └─> Fase 7  US4 Conta    (PR-E)
                 └─> Fase 8 Polish
```

- **T001 é irreversível se pulada**: depois do primeiro commit não existe mais "o mobile de antes"
  para fotografar.
- As fases 3 a 7 são independentes entre si **depois** da fase 2 — podem ser reordenadas se o dono
  quiser outra ordem de PR. A ordem proposta põe o menor risco primeiro (menu) e o compartilhado com
  o mobile depois do padrão firmado (kits).
- Fase 5 depende conceitualmente da Fase 4 apenas por reuso de padrão, não por código.

## Oportunidades de paralelismo

- Fase 2: T006, T007, T008, T009, T010 em paralelo (arquivos distintos, sem dependência entre si).
- Início de cada fase de história: os testes vermelhos marcados [P] rodam juntos.
- Fase 8: T053, T054, T055, T057 são medições independentes.

## Escopo mínimo (MVP)

**Fase 1 + Fase 2 + Fase 4 (US1 Catálogo)**. Entrega a tela que o dono citou primeiro, exercita o
gate, o mestre-detalhe, a ficha-editor e as guardas de geometria — tudo que as fatias seguintes
reusam. Se o incremento parasse aí, o produto ficaria coerente.

## Formato

Todas as 60 tarefas seguem `- [ ] T### [P?] [US#?] descrição com caminho de arquivo`. Fases de
Setup, Foundational e Polish não levam rótulo de história, por definição.

---

## Correções da homologação automatizada (absorvidas no mesmo PR — 2026-08-13/15)

O PR #58 foi reaproveitado para carregar também as correções da homologação automatizada. Estas
tarefas foram executadas; ficam registradas aqui porque o plano exige que o registro não seja menor
que o que foi feito (`docs/homologacao/automatizada/PLANO-CORRECAO.md` §DoD).

- [x] **T200** — Aviso de plausibilidade: módulo puro `shared/lib/plausibilidade.ts` + mensagens +
      fiação no `ControlledField`, no `TimeHmField`, no slot de canal e no card de linha do kit.
      Regra estrutural: AVISO NUNCA VIRA VALIDAÇÃO (teste no último `describe` do módulo).
- [x] **T201** — Transbordo de texto sem espaços: `breakdown-row.css` (`__label`/`__sub`) e
      `catalog-master-detail.css` (`__card`).
- [x] **T202** — Teaser premium a 426px: `premium-teaser.css` (`max-width: min(28rem, 100%)`).
- [x] **T203** — Foco invisível no item de navegação ATIVO: anel interno em `app-nav.css`.
- [x] **T204** — Contraste do texto de status: `--success-text` remedido contra o fundo REAL do
      badge (o `*-soft` composto), não contra o card.
- [x] **T205** — Alvo de toque do link de privacidade na tela de entrada.
- [x] **T206** — Salvar simulação sem nome passou a mostrar a mensagem que já existia escrita.
- [x] **T207** — Tempo do fatiador (`2:30`, `2h30`, `2h30m`) aceito, com rascunho local no campo de
      horas para a digitação caractere a caractere não virar horas×60.
- [x] **T208** — Aviso de saída com alterações não salvas (`aviso-de-saida.ts`).
- [x] **T209** — **Guarda permanente de geometria** em `tests/e2e/overflow-geometria.spec.ts`:
      mede nós de TEXTO por `Range` e inclui 426px. Era exigida pelo plano e faltava.
- [x] **T210** — Pílula selecionada do Segmented em relevo (`--surface-raised` + sombra): no escuro
      ela tinha a mesma cor da bandeja e a seleção era comunicada só pela cor do texto.
- [x] **T211** — Saída da homologação truncada por rodada (`tests/homologacao/global-setup.ts`) e
      relatório bruto do Playwright fora do versionamento.

### Aberto, e depende de decisão do dono

- [x] **T212 → TRANSFERIDA ao 019** (decisão de planejamento 2026-08-26: mexe no mobile — que o 018 prometeu NÃO tocar — e a superfície é redesenhada pelo porte do design; vira candidata de fatia lá). Texto original: Resumo fixo com o preço no mobile (o custo total só aparece após ~4 telas a 390px).
      Contradiz a propriedade "o mobile não se mexe" que ESTE incremento promete.
- [x] **T213** — A faixa de 426–600px: **FEITO** (2026-08-15, autorizado pelo dono). A barra lateral
      recolhe sozinha abaixo de 600px. Implementado como o ADR-0031 §Follow-ups manda — estendendo
      `use-is-wide.ts` com um limiar NOMEADO (`RAIL_FORCADO_QUERY`), não abrindo um segundo
      `matchMedia`. Sem interruptor nessa faixa, de propósito: expandir devolveria o transbordo, é
      restrição de espaço e não preferência. `isRail` deixou de exigir o botão (antes, um
      `collapsed` forçado encolhia a coluna e mantinha os rótulos — o pior dos dois mundos).
      Provado pela guarda, que agora testa o corte pelos DOIS lados (599 e 600).
