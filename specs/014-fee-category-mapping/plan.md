# Implementation Plan: Mapeamento categoria→comissão (ML + Amazon) com atualização mensal

**Branch**: `014-fee-category-mapping` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/014-fee-category-mapping/spec.md` · pesquisa de fase 0 em [research.md](./research.md)

## Summary

Dar ao vendedor a alíquota **da categoria em que ele realmente anuncia**, em vez de uma taxa genérica por
marketplace, e manter esse mapa verdadeiro sozinho por um laço mensal que abre PR e nunca faz merge.

A abordagem técnica sai de uma medição desta fase (R1): a comissão do ML é **constante por trechos** na árvore de
categorias — 87,5% dos nós herdam do pai, 12,5% divergem. Então o mapa guarda a alíquota **só onde ela difere do
pai**, e a resolução **sobe a cadeia de ancestrais até o primeiro nó com valor definido**. Isso resolve o SC-801
(mais-específico vence, independente de ordem) **estruturalmente**, não por ordenação — e reduz o artefato em
provável ordem de grandeza.

A ingestão roda **CI-first** em runner hospedado do GitHub para os dois marketplaces (ADR-0010 §A10/§A13): Amazon
sem credencial nenhuma, ML com token da conta da casa em GitHub Secrets sem write-back. Nenhum serviço de nuvem
novo, R$ 0,00 recorrente.

**Correção estrutural pós-PR #31 (2026-07-28) — ADR-0024, Bandas progressivas.** A revisão multi-agente do PR #31
mediu que a Amazon cobra comissão **por parcela do preço** ("15% até R$ 200,00 e 10% para o **excedente**",
verificado na fonte oficial), enquanto `priceBands` significa, em `pricing-core`, **seleção** de uma faixa aplicada
ao preço inteiro. Três categorias (Móveis, Colchões, Acessórios Eletrônicos) subestimavam a comissão acima do
limiar, sob selo "Referência". A correção introduz um discriminador **aditivo** (`bandMode`, ausente = seleção) —
formato ditado por uma restrição dura: `priceBands` atravessa `frozen-payload.ts` (snapshots **imutáveis**,
ADR-0019) e `config-document.ts` (cenários salvos, ADR-0021), então **trocar o sentido do campo reinterpretaria
preços já congelados**. A compatibilidade vem do significado do padrão, não de migração. Tarefas na **Fase 6C**;
o risco real está no ADR-0024 §5 — não é errar a aritmética progressiva, é **perder o `bandMode` no trajeto** e
degradar em silêncio de volta ao bug atual, agora justificado pelo padrão.

## Technical Context

**Language/Version**: TypeScript 5.x (Node 24) no cliente e na ingestão · Python 3.12 no backend (serve dados, não
recalcula)

**Primary Dependencies**: Zod (contrato do catálogo, validação no parse/boot) · Playwright/chromium **apenas na
ingestão Amazon** (a página é JS-renderizada — R3) · `fetch` nativo para a API do ML · GitHub Actions
(`schedule` + `workflow_dispatch`)

**Storage**: artefato JSON commitado (`backend/app/data/catalog.json`) + store persistido no cliente + semente
embutida — as três camadas já existentes do ADR-0010, mesma forma

**Testing**: Vitest (unidade/contrato do resolvedor e do parser) · Playwright (e2e do seletor) · pytest (rota que
serve) · `pnpm gate:all` como portão único

**Target Platform**: web responsiva + Android (mesmo core) · runner `ubuntu-latest` para a ingestão

**Project Type**: monorepo pnpm — web app + backend + pacote de domínio

**Performance Goals**: o seletor de categoria filtra sem travar a digitação; primeira pintura offline da calculadora
gratuita **não regride** (SC-810)

**Constraints**: resolução **offline** (o seletor nunca exige rede) · `pricing-core` continua a fórmula canônica e o
backend **nunca** recalcula · ingestão com **0 tokens de LLM** (SC-811) · refresh token nunca no repo/cliente/env

**Scale/Scope**: ML com dezenas de milhares de nós de categoria (total exato **não medido** — é tarefa do
incremento, não estimativa daqui) · Amazon com 38 linhas de comissão medidas · 4 marketplaces no catálogo, 2 tocados

## Constitution Check

- [x] **I. Scalability & Quality First** — a compressão por herança (R1) e a resolução por ancestral servem
      igualmente web e Android a partir do mesmo core; nenhuma escolha troca escalabilidade por conveniência.
- [x] **II. Truth Over Approval** — toda API e comportamento externo aqui foi **medido nesta sessão**, não assumido
      (R1–R4). Uma hipótese minha foi refutada por medição e está registrada como refutada (R1). O que não medi
      está dito como não medido, com confiança explícita.
- [x] **III. Test-First** — testes lógicos (resolvedor por ancestral, guard de banda, parser Amazon com U+00A0) e
      visuais (seletor homologado no navegador) planejados antes da implementação; a alíquota por categoria é
      domínio de dinheiro e leva casos numéricos explícitos.
- [x] **IV. Server-Side Entitlements** — **não se aplica por desenho**: o catálogo permanece gratuito e público
      (Q4), nenhum portão premium novo é introduzido. Nenhuma decisão de entitlement é movida para o cliente.
- [x] **V. Clean Architecture Integrity** — reusa as três camadas do ADR-0010 e o contrato existente (o eixo
      `category` cabe em `determinants` sem mudar o envelope — R8). Corrige dois defeitos existentes em vez de
      contorná-los (R6, R7).
- [x] **VI. Lean Living Documentation** — a spec **apaga** o que ficou falso no brief (geo-gate, US6 bloqueada) em
      vez de anexar correção ao lado.
- [x] **VII. Spec-Driven Flow** — specify e clarify feitos; `analyze` antes de implementar.
- [ ] **VIII. Architecture Decided Before Implementation** — **3 escolhas estruturais pendentes**, enumeradas
      abaixo com ≥3 opções e confiança. **O plano segue; as tarefas que dependem delas PARAM até o dono decidir.**

## Decisões estruturais — DECIDIDAS pelo dono em 2026-07-28 (após revisão adversarial)

**D1 = (b) `packages/fee-ingest`.** Pacote de workspace. O parser produz folhas de dinheiro e precisa satisfazer o
**mesmo** `feeEntrySchema` do catálogo; fora do workspace duplicaria a validação (Princípio V) e ficaria fora do
`gate:all` — e a ferramenta que ninguém observa é justamente a que mais precisa de portão. Playwright entra como
`devDependency` **só** desse pacote, com a fronteira travada no `dependency-cruiser` (T007).

**D2 = espinha no catálogo + nomes sob demanda.** Havia **dois consumidores** onde o plano tratava um artefato: o
*resolvedor* precisa apenas de `id`+`parentId` dos nós **divergentes e seus ancestrais**; o *seletor* precisa dos
**nomes** de todos. A espinha viaja dentro do próprio `catalog.json`; o índice de nomes é buscado e persistido sob
demanda. **Consequências**: a alíquota fica offline desde o primeiro uso (a contradição FR-005/US1 AS5 se dissolve —
offline o app é completo em **preço** e incompleto em **nome**) e o risco de skew árvore↔catálogo **desaparece por
construção**, porque o dado que decide dinheiro anda num artefato só, com um `catalogVersion` só.

**D3 — ainda aberta.** A fatia ML segue parada em T004.

**Obsolescência = medida contra ENTREGA**, não contra leitura da fonte nem contra merge (FR-020b).

**Escopo = 014 completo agora**, com artefato embutido de transição enquanto não há deploy. O contraponto do
`product-owner` (80% de que o certo era reduzir e priorizar o E6) está registrado em `spec.md` §Clarifications — a
decisão foi tomada com ele à vista, não por omissão.

## Decisões estruturais pendentes (Princípio VIII — não inferidas)

### D1 — Onde mora o código de ingestão

| # | Opção | Confiança |
|---|---|---|
| **(a)** | `scripts/fee-ingest/` — Node solto, fora do grafo de workspaces, como os probes de hoje | **55%** — é o menor incremento estrutural e o que mais se parece com o que já existe; em compensação fica fora do `gate:all` por padrão. |
| (b) | Novo pacote de workspace `packages/fee-ingest` | 30% — entra no `gate:all`, tipagem e lint de graça, reusa o Zod do contrato; custo: mais um pacote no monorepo para uma ferramenta que roda 12×/ano. |
| (c) | Dentro de `backend/` como comando Python | 15% — colocaria o parser longe do contrato Zod que ele precisa satisfazer, e duplicaria a validação em outra linguagem. |

**Por que não posso escolher sozinho**: "project/module structure and boundaries" é área nomeada no Princípio VIII.

### D2 — Como a árvore de nomes de categoria chega ao cliente (o seletor precisa dela; a alíquota não)

| # | Opção | Confiança |
|---|---|---|
| **(a)** | Artefato **separado** de árvore, buscado e persistido sob demanda (não embutido na semente) | **60%** — protege o SC-810 (primeira pintura offline) porque a semente não cresce; o seletor exige rede **na primeira vez**, o que colide com a US1 AS5. |
| (b) | Tudo na semente embutida | 25% — seletor 100% offline desde o primeiro uso, mas é o caminho que mais ameaça o SC-810, e o tamanho real ainda **não foi medido**. |
| (c) | Semente embutida **podada** (só os nós onde a alíquota diverge + seus ancestrais) + árvore completa sob demanda | 15% — melhor dos dois, mais complexidade e um estado "cobertura parcial" a explicar no selo. |

**Bloqueio honesto**: (a) e a US1 AS5 ("o seletor nunca exige rede") **se contradizem** na primeira execução. Essa
contradição é do dono resolver, não minha para silenciar. Antes de decidir, a **T-medição** abaixo dá o número que
falta.

### D3 — Ratificação de segredo em repositório público (`seguranca`, QA2/QA3)

O G1 reduziu esta questão: o perigo específico era **runner self-hosted**, que deixou de existir. Resta o refresh
token do ML em GitHub Secrets num repo hoje público. **Não é decisão minha nem do plano** — é do `seguranca`, com
ratificação do dono. **A fatia ML PARA aqui**; a fatia Amazon não depende disto.

## Project Structure

### Documentation (this feature)

```text
specs/014-fee-category-mapping/
├── plan.md              # este arquivo
├── research.md          # fase 0 — as medições
├── data-model.md        # fase 1
├── quickstart.md        # fase 1
├── contracts/           # fase 1
├── seguranca-ci-first.md# parecer bloqueante (pré-existente)
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/web/src/
├── shared/fee-catalog/
│   ├── fee-catalog.ts          # ALTERADO: guard F3 no nível de banda (R7) + resolução por ancestral (R6)
│   ├── category-tree.ts        # NOVO: forma da árvore + busca por texto + cadeia de ancestrais
│   └── seed.ts                 # ALTERADO conforme D2
├── features/calculator/
│   ├── fee-prefill.ts          # ALTERADO: slotDeterminants passa a emitir `category`
│   ├── fee-seal.tsx            # ALTERADO: selo nomeia a categoria; "categoria não informada"
│   └── category-picker.tsx     # NOVO: comportamento do seletor (UX é do designer-ux)
└── features/scenarios/         # ALTERADO: categoria persiste em cenário (FR-003a)

backend/app/data/catalog.json   # ALTERADO: entradas ML + Amazon (hoje ambas vazias — R5)

<local de D1>/                  # NOVO: parser Amazon (browser headless) + coletor ML (API) + montador do diff
.github/workflows/
└── fee-refresh.yml             # NOVO: schedule dia 1 06:00 UTC + workflow_dispatch, PR → develop
```

**Structure Decision**: o incremento **não cria camada nova no app**. Ele adiciona um eixo (`category`) a um
contrato que já o comporta (R8), corrige dois defeitos no módulo compartilhado que já existe (R6, R7) e acrescenta
**um** artefato de dados novo (a árvore) e **um** workflow. A única fronteira genuinamente nova é o local da
ingestão — que é exatamente D1, e por isso não foi inferida.

## Fatiamento (Q2 decidido: o DoD fecha sem o ML)

| fatia | conteúdo | depende de |
|---|---|---|
| **PR-A** | Fundação + Amazon: resolução por ancestral (R6), guard de banda (R7), eixo `category`, seletor, mapa Amazon, laço mensal Amazon | D1, D2 |
| **PR-B** | ML: coletor da API, compressão por herança, custo fixo com premissa declarada (FR-014a) | D1, D2, **D3** |
| **PR-C** | Persistência em cenários (FR-003a) + polimento de selo | PR-A |

**T-medição (primeira tarefa do PR-A, antes de D2 ser decidido)**: varrer a árvore ML completa **uma vez** e contar
(i) total de nós, (ii) nós onde a alíquota diverge do pai, (iii) tamanho em bytes das duas formas. **D2 não deve ser
decidido sem esses três números** — é a mesma disciplina que já derrubou uma hipótese minha nesta fase.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Princípio VIII não satisfeito (3 pendências) | D1/D2 são estrutura de projeto e entrega de dados; D3 é segurança. O Princípio VIII **proíbe** que eu os defina por padrão silencioso. | Escolher eu mesmo seria mais rápido e é exatamente o que o princípio existe para impedir. As opções estão enumeradas com confiança; o dono decide. |
| Playwright/chromium como dependência de ingestão | A tabela da Amazon é JS-renderizada; `curl` devolve casca vazia (medido, R3). | Um fetch HTTP simples não retorna a tabela. A alternativa (SP-API) não entrega mapa categoria→alíquota e exige registro pesado. |
