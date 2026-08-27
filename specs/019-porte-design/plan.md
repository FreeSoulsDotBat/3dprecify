# Implementation Plan: 019 — O porte do design (157 superfícies) + as features que o dono incluiu

**Branch**: `019-porte-design` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-porte-design/spec.md` (pós-clarify: 5/5 + 2 decisões
pós-arquiteto; zero `NEEDS CLARIFICATION`)

**Autoridade de escopo**: [`docs/product/019-porte-design-scope-brief.md`](../../docs/product/019-porte-design-scope-brief.md)
**Autoridade de design**: [`docs/design/handoff-019/`](../../docs/design/handoff-019/) (README = punch-list;
`tf-components.css` = folha-fonte byte-a-byte) + as pranchetas remotas do projeto Claude Design
`a90ed7d4`, transcritas por fatia (copy sempre verbatim).
**Autoridade de decisão técnica**: [`research.md`](./research.md) (decisões **A–K**, arquiteto
2026-08-26/27). Este incremento **não** tem `arquitetura-019.md` (Princípio VI; precedente do 018).
**ADRs**: [0032](../../docs/adr/0032-primitivos-do-porte-do-design.md) (PR-A) ·
[0031 §Emenda 2026-08-26](../../docs/adr/0031-desktop-composition-gate.md) (PR-F) ·
[0033](../../docs/adr/0033-observacao-e-fixacao-de-preco.md) (PR-D) ·
[0034](../../docs/adr/0034-orcamento-montado-motor-e-congelamento.md) (PR-E) — todos **Proposed**; o
dono flipa cada um no gate da fatia que o executa.

---

## Summary

As 157 superfícies desenhadas pelo dono são, na maior parte, **espelho** do que já existe. O que o
espelho devolveu — e o que este plano entrega em seis fatias — é: **(A)** a camada de baixo que faltava
(8 primitivos + o tom de ATENÇÃO + as guardas de folha), **(B)** a mudança de padrão do Premium
(bloqueia só no salvar; a barreira é a AUSÊNCIA do handler, não um `disabled`), **(C)** quatro
comportamentos da Calculadora sem tocar a fórmula, **(D)** o Catálogo ganhando dado novo sem virar fonte
de preço (observação + fixação + unicidade, migração 0008, opus), **(E)** o construtor "Montar e Enviar"
com `computeQuote` no motor (4.2.0) e congelamento pelo E4 (migração 0009, opus), e **(F)** Simulações
em tela larga pela emenda do ADR-0031 + as divergências D1–D4 viradas em guarda ou decisão.

A abordagem em uma frase: **portar o design é aplicar deltas medidos, e cada delta que toca dado ou
dinheiro entra por ADR próprio, escalado a opus, atrás de uma prova numérica — nunca por inferência.**

---

## Technical Context

**Language/Version**: TypeScript 5.x · React 19 · Python 3.12 (backend) — nenhuma versão sobe.

**Primary Dependencies**: já instaladas, nenhuma nova. Frontend: Vite 8 PWA · Tailwind v4 + DS `tf-*`
Radix-wired (ADR-0007) · TanStack Router/Query · Zustand · RHF+Zod. Backend: FastAPI · SQLAlchemy 2.0 ·
Alembic · psycopg. Motor: `packages/pricing-core` (4.1.0 → **4.2.0** na PR-E, ADR-0034).

**Storage**: PostgreSQL 17. **Duas migrações aditivas**, ambas em fatias próprias: **0008** (PR-D:
`price_observations` + `products.seller_fixed_price/seller_fixed_at` + `name_norm` e índice único
parcial em `filaments/printers/products/boms`) e **0009** (PR-E: enums `kind='QUOTE'` /
`headline_basis='PRECO_ORCAMENTO'` em `snapshots` **com o `CASE` do `CHECK headline_matches_totals`
estendido no mesmo ato** — ADR-0034 §2). Duas chaves novas de `localStorage`: dispensa do selo
(chave = identidade da fonte, research §G) e nada mais; o "Entendi" da plausibilidade é memória de
sessão (§H). **Nenhuma escrita nova no outbox** (research §E-3/K).

**Testing**: Vitest + Testing Library (lógica/composição) · Playwright e2e contra stack real (auth
emulator + backend + Postgres + MP stub) · guardas de **geometria nos dois eixos** lidas do DOM ·
pytest (backend, incl. corrida de concorrência para unicidade) · contract drift-guard (OpenAPI+Orval)
· duas guardas de folha novas (research §A: "uma classe `tf-*`, um arquivo" e "zero
`tf-phone-scroll`/`tf-price--rola`"), ambas provadas por mutação.

**Target Platform**: PWA web mobile-first (390px) + desktop ≥1280px (corte do 018, reafirmado pela
emenda do 0031). O ramo mobile é o mesmo código, intocado, exceto a T212 (research §I, `sticky`).

**Project Type**: monorepo web (pnpm workspaces) — `apps/web` + `backend` + `packages/pricing-core`.

**Performance Goals**: sem meta nova; a observação de preço é **uma** requisição em lote por visita
(`PUT`), depois do render — nunca por item, nunca antes de exibir (ADR-0033 §2).

**Constraints**: Constituição IV intacta (diff **vazio** em `app/entitlement/`, SC-1903) · o backend
**nunca recomputa preço** (ADR-0008; quem escreve a observação é o cliente) · `catalogVersion` intocado
(o 019 não toca tarifa; o 017 corre em paralelo) · `PRICING_MODEL_VERSION` bumpa **só** na PR-E e só
MINOR, com varredura de igualdade 4.1.0↔4.2.0 antes · copy **verbatim** da prancheta · homologação
**espera a Rodada 1** (D5) — cada fatia sai em CORREÇÃO DECLARADA com evidência visual completa.

**Scale/Scope**: 20 US, 6 fatias (PR-A…PR-F), 2 features novas, 2 migrações, 4 ADRs. Maior incremento
do projeto (o 016 tinha 17 US). Rota de fuga registrada: a PR-E pode virar 020 se escorregar (brief §8
Ressalva 5) — decisão do dono, disponível até ela começar.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Scalability & Quality First** — primitivos entram no DS compartilhado (ADR-0032), não em
      telas; `computeQuote` no motor compartilhado (ADR-0034), nunca aritmética de tela; a observação de
      preço é recurso próprio com contrato congelado — nada compra velocidade com dívida.
- [x] **II. Truth Over Approval** — o brief e o research **mediram** antes de afirmar (V0: 3 correções de
      premissa; arquiteto: 5 correções de escopo, incl. `--tf-warning-deep` inexistente e Q5 offline
      inalcançável); confianças explícitas por decisão; a contradição do foco foi levada ao dono, não
      resolvida por conveniência.
- [x] **III. Test-First** — toda fatia tem vermelho antes do verde e prova de não-vacuidade por mutação
      (guardas de folha, D1, geometria); `computeQuote` nasce com vetor numérico + varredura de igualdade
      4.1.0↔4.2.0; a unicidade nasce com corrida de concorrência; o CHECK do enum novo nasce com o teste
      que **espera a recusa** (ADR-0034 §2).
- [x] **IV. Server-Side Entitlements** — o servidor já distingue `none|lapsed|active` pelo ledger e as
      portas de leitura/escrita já são diferentes (research §E, medido); a PR-B **não toca**
      `app/entitlement/` (diff vazio é consequência do desenho); o formulário inerte não tem handler de
      escrita (ausência, não `disabled`).
- [x] **V. Clean Architecture Integrity** — variante entra no primitivo que já existe; primitivo novo
      nasce com componente dono (ADR-0032 §Option C); `premiumGate` puro em `shared/billing` respeita
      FSD-Lite (research §E-1); o congelamento reutiliza a maquinaria do E4 (sem segundo mecanismo);
      `subject_id` sem FK segue o precedente 0019/0021.
- [x] **VI. Lean Living Documentation** — research.md é a autoridade técnica (sem `arquitetura-019.md`);
      a Clarification da 007 é UM parágrafo datado (ADR-0033 §5, aplicado por este plan); o handoff é
      cópia versionada, não reescrita.
- [x] **VII. Spec-Driven Flow** — specify → clarify (5/5 + 2 pós-arquiteto) → plan; checklist 16/16;
      `/speckit-analyze` roda antes do tasks; a homologação segue o processo da casa (D5).
- [x] **VIII. Architecture Decided Before Implementation** — cada escolha estrutural traça a um ADR
      (0032/0033/0034, emenda 0031) ou a uma decisão registrada do dono (spec §Clarifications: Q3, Q4,
      Q5, Q6, Q8, foco, US18). **Um ponto ainda aberto, roteado ao gate da PR-B (não bloqueia o plan)**:
      research §E-5 — o visitante DESLOGADO no lote 32 (default recomendado (a): a superfície de entrada
      de hoje continua; o lote 32 vale para o logado sem premium).

**Pós-design (re-check)**: sem violação nova. O único gate condicional é o de contraste do
`--warning-text` (ADR-0032 §4: a PR-A **mede**; reprovando, o tom claro é escurecido e **isso é decisão
do dono** — cor de marca).

---

## Project Structure

### Documentation (this feature)

```text
specs/019-porte-design/
├── plan.md                  # este arquivo
├── research.md              # decisões A–K (autoridade técnica)
├── data-model.md            # Fase 1 — as entidades novas (observação, fixação, unicidade, quote)
├── quickstart.md            # Fase 1 — como subir e provar cada fatia
├── contracts/
│   ├── ui-porte.md          # contrato de composição (primitivos, gates, geometria, foco)
│   └── api-019.md           # contrato de API (price-observations, products.fixed, snapshots QUOTE)
├── checklists/requirements.md
├── design/                  # cópias das pranchetas transcritas POR FATIA (DesignSync) — nasce na PR-A
└── tasks.md                 # /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
apps/web/src/
├── shared/ui/               # PR-A: alert.{tsx,css} (+compact/action/close/warning) · button (+width)
│                            #       segmented (+split) · badge (+warning) · NOVOS: aviso, plist, table, frozen
├── shared/billing/          # PR-B: premiumGate() pura (união discriminada) + vazio didático
├── shared/i18n/messages.pt-br.ts   # PR-A: canal→marketplace, acentos, "1 ano"; copy verbatim por fatia
├── styles/tokens/colors.css # PR-A: --warning-text (gate de contraste) · token-parity 87→88
├── styles/                  # PR-A: guardas de folha (uma classe/um arquivo; zero phone-scroll/rola)
├── features/calculator/     # PR-C: plausibilidade (blur/Entendi store), máquina (readout/confirm),
│                            #       selo compact+dismiss (chave de fonte); T212 sticky
├── features/catalog/        # PR-B: cadeia de corpos sem parede; PR-D: recálculo/fixar/duplicar/nome
├── features/scenarios/      # PR-B: vazio → calculadora; PR-F: composição ≥1280px (mesmo componente)
├── features/history/        # PR-B: vazio → calculadora; PR-E: construtor + envio (snapshot QUOTE)
├── entities/catalog/        # PR-D: price-observations client (PUT em lote pós-render)
└── pages/{calcular,catalogo,bom,historico}/   # composição por fatia

backend/
├── alembic/versions/0008_*.py   # PR-D: price_observations + seller_fixed_* + name_norm + índices
├── alembic/versions/0009_*.py   # PR-E: enums QUOTE/PRECO_ORCAMENTO + CASE do CHECK estendido
├── app/models/__init__.py       # PR-D/E: modelos + comentário FR-310/313 reescrito (ADR-0033 §1)
├── app/api/price_observations.py   # PR-D: GET/PUT
├── app/api/catalog*.py          # PR-D: seller_fixed_price no PATCH; normalização + sufixo "(2)"
├── app/api/history.py           # PR-E: _BASIS_TOTAL_KEY + Literal (guarda de igualdade de conjuntos)
└── app/entitlement/             # INTOCADO (diff vazio — SC-1903)

packages/pricing-core/src/index.ts   # PR-E: computeQuote, 4.2.0 (MINOR), varredura de igualdade
contracts/openapi.json               # PR-D/E: regen + drift-guard idempotente
```

**Structure Decision**: monorepo existente, sem diretório novo de topo. Fronteiras FSD-Lite mantidas:
`shared` não importa `entities`/`features` (por isso `premiumGate` recebe forma estrutural `{status}`,
research §E-1); primitivos só em `shared/ui`; regra de dinheiro só em `pricing-core`.

---

## Fatias (PRs autorizados um a um pelo dono — ADR-0006, squash em `develop`)

| # | fatia | US (spec) | ADR/gate | depende de | escalação |
| --- | --- | --- | --- | --- | --- |
| **V0** | medição (não vira PR) — classificação (a)/(b)/(c) dos itens do handoff §1/§3; contagem real de "canal"; contraste do `--warning-text` | — | — | — | — |
| **PR-A** | Fundação DS: 8 primitivos, tom ATENÇÃO, guardas de folha, marca/foco (SEM anel — decisão 25/08), copy mecânica, vocabulário | US1, US2 | ADR-0032 flip | V0 | — |
| **PR-B** | Premium sem parede: `premiumGate`, vazio didático (6 frases verbatim), `<Frozen>` = fieldset disabled, ausência de handler, lapsed-com-itens | US3 | — (diff vazio em entitlement) | PR-A (`tf-frozen`, `tf-btn--half`) | — |
| **PR-C** | Calculadora: plausibilidade (blur, store de sessão), máquina (readout, confirmação), selo compact+dismiss (chave de fonte), T212 sticky, R$/kWh íntegra, "0,00" | US4 | — (sem bump de modelo) | PR-A (`tf-aviso`, `--compact`, `__close`) | — |
| **PR-D** | Recálculo do Catálogo: migração 0008, `price_observations` GET/PUT, `seller_fixed_price`, `name_norm`+índice parcial, sufixo "(2)", `tf-plist`/`tf-table` na lista; Clarification na 007 | US5 | ADR-0033 flip | PR-A (`tf-plist`, `tf-table`, `--warning`) | **opus** (leaf de dinheiro + schema) |
| **PR-E** | Montar e Enviar: `computeQuote` 4.2.0 + varredura de igualdade, migração 0009 (+CASE), construtor, envio = snapshot QUOTE + PDF com bruto→desconto→total | US6 (US18 RETIRADA) | ADR-0034 flip | PR-A (`tf-aviso`), PR-D (0008 antes da 0009) | **opus** (pricing-core + payload congelado) |
| **PR-F** | Simulações ≥1280px (emenda 0031; mesmo componente, outro hospedeiro) + D1 (teste de mudança conjunta) + D2 (chave única) + A11-r medido; Q1/Q2 ao dono no gate | US7 | emenda 0031 flip | PR-A | — |

**Ordem e independência**: PR-A bloqueia todas. Depois dela, **B, C, D, F são independentes entre si**
(dependências de primitivo medidas no research §A) — podem sair em qualquer ordem e o dono pode parar
após qualquer uma sem meio-produto no ar. **PR-E é a única tudo-ou-nada** e sai por último (depende da
0008 pela numeração de migração e é a única que inventa produto). PR-B antes de PR-C: maior valor
percebido por custo (brief §5, ~75%).

---

## Phase 0 — Research (CONCLUÍDA pelo arquiteto)

[`research.md`](./research.md): decisões A (primitivos: variante-no-existente / novo-com-dono; contrato
do `tf-frozen`; gate de contraste), B (emenda 0031), C-1..C-4 (observação uma-linha-por-item escrita
pelo cliente pós-render; `seller_fixed_price` nullable que não compõe; `name_norm` + índice parcial +
vetor compartilhado; Clarification da 007), D (`computeQuote` sobre `computeBom`, MINOR, piso estrito,
Q7/Q10 confirmadas, a armadilha do `CASE`), E-1..E-5 (`premiumGate` puro; ausência de handler; outbox
não é do catálogo; a parede que sai; E-5 deslogado ao gate da PR-B), F (foco: RESOLVIDO — sai), G
(dispensa do selo = chave de conteúdo), H ("Entendi" em sessão por campo+valor), I (T212 sticky, nunca
fixed — o slot é do toaster), J (vocabulário pelas chaves; diff de teste lido separado), K (o que não
se toca). Zero `NEEDS CLARIFICATION` no spec.

## Phase 1 — Design & Contracts

- [`data-model.md`](./data-model.md) — as 4 entidades novas + os estados de interface novos.
- [`contracts/ui-porte.md`](./contracts/ui-porte.md) — composição: primitivos, gates, geometria, foco,
  invariante um-teaser, o que cada fatia NÃO pode atravessar.
- [`contracts/api-019.md`](./contracts/api-019.md) — `price-observations` (GET/PUT), `products`
  (`sellerFixedPrice`), `snapshots` (`kind: QUOTE`), regra de nome; o drift-guard congela.
- [`quickstart.md`](./quickstart.md) — subir a stack (com a armadilha da porta 9099 documentada) e a
  prova ponta-a-ponta de cada fatia.
- **Clarification da 007 aplicada por este plan** (texto do ADR-0033 §5) em
  `specs/007-e2-catalog-entitlement/spec.md`.
- Agent context (`CLAUDE.md` bloco SPECKIT) apontado para este plan.

**Re-check da Constituição pós-design**: passa (ver acima). Próximo: `/speckit-analyze` → `/speckit-tasks`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Primeira tabela com preço guardado (`price_observations`) — toca o invariante do E2 | "era R$ 38,90" exige lembrar o que o vendedor VIU; decisão do dono (Q3=servidor) | Dispositivo (sem migração) foi oferecido e recusado pelo dono — a frase precisa valer em qualquer aparelho. Mitigação: recurso separado, cliente escreve, servidor nunca recomputa, `ProductOut` sem dinheiro (ADR-0033) |
| Leaf de dinheiro em `products` (`seller_fixed_price`) | Q4=número final: o preço do anúncio é o que o vendedor quer travar | Fixar o markup (sem leaf) foi oferecido e recusado — o número do anúncio continuaria oscilando. Mitigação: nome que denuncia o uso, `NULL`=acompanhando, nunca compõe (kit/orçamento/cenário) |
| Função nova no motor + bump 4.2.0 | FR-1916 proíbe soma paralela; desconto no total precisa de uma regra de dinheiro só | Compor na tela: dois lugares arredondando dinheiro divergem num centavo (70%). Estender `computeBom`: opcional em rota quente vira desconto em kit por acidente |
| Enum novo em tabela imutável (`snapshots.kind='QUOTE'`) | Um orçamento enviado É um documento congelado — segundo mecanismo seria duplicação | Tabela própria de orçamentos: duplicaria trigger de imutabilidade, `UNIQUE` de idempotência e o `PATCH` de rótulo. O risco real (o `CASE` do `CHECK` que PASSA em NULL) é tratado na mesma migração com teste que espera a recusa |
