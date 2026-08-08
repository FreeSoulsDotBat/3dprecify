# DoD Evidence — 017 Ingestão dinâmica mensal

## PR-A — a espinha + Amazon + o laço disparável (T001–T018, 2026-08-07)

### A execução real (SC-1001 — o portão da fatia)

**Sete runs até o verde, e cada vermelho ensinou uma coisa diferente — nenhuma delas era do laço:**

| run | evento | desfecho | a lição |
|---|---|---|---|
| [31225235670](https://github.com/FreeSoulsDotBat/3dprecify/actions/runs/31225235670) | push (bootstrap) | coletor ✓ · ponto fixo ✗ | o ponto fixo compara a 2ª passada com a 1ª, NUNCA com o HEAD — contra o HEAD, uma mudança LEGÍTIMA de fonte reprova o gerador por estar certo |
| 31225628498 | push | coletor ✓ · guarda de data ✗ | `not.toContain(hoje)` era coincidência de calendário: no job, a 1ª passada move `lastReviewed` para hoje LEGITIMAMENTE — a guarda virou DERIVAÇÃO (toda data da fatia ∈ insumos) |
| 31226204302 | **workflow_dispatch** | idem, outra data | `JSON.stringify(Map)` = `"{}"` — as vigências nunca entravam no conjunto; localmente passava porque DATA coincidia com a vigência |
| 31226608979 | workflow_dispatch | push do bot ✗ | o `pnpm install` do job instala o lefthook e o push do bot disparava o pre-push de WORKSTATION dentro do runner (123s p/ falhar por ambiente) — `LEFTHOOK=0` escopado ao passo; a validação do runner é o `gate:artifact` (Q6) |
| run 5 | workflow_dispatch | branch do bot NO REMOTO ✓ · criação do PR ✗ | "GitHub Actions is not permitted to create pull requests" — **configuração de repositório** (classe P0-b/P0-c) |
| **run 6** | workflow_dispatch | **VERDE — [PR #54](https://github.com/FreeSoulsDotBat/3dprecify/pull/54) aberto** | ~1m54s de wall (premissa ~5 min/mês do ADR-0010 folgada) |
| run 7 | workflow_dispatch | verde, **0 PR duplicado** | idempotência do mesmo dia provada ("PR já aberto; nada a fazer"; 1 PR aberto no total) |

O padrão das 4 primeiras: o coletor e o compositor passaram SEMPRE — os vermelhos eram guardas
minhas com premissas que só a execução real expunha. A lição 014/US4 ("executar, não listar")
operando exatamente como prometido.

### O primeiro PR mensal ([#54](https://github.com/FreeSoulsDotBat/3dprecify/pull/54) — "Tarifas — leitura de 2026-08-07")

O corpo é o relatório da US2, palavra por palavra: os **3 estados** (AMAZON LIDO com data+URL ·
MERCADO_LIVRE e SHOPEE NÃO LIDO com "o job não produziu veredito") · **"Sem mudança de tarifa
nesta leitura — apenas a data de reverificação avançou"** (a prova-de-vida; a Amazon foi RELIDA
AO VIVO do runner e a tabela não mudou — só `lastReviewed` 2026-07-28→08-07, zero folha de
dinheiro no diff) · a dispensa **NEGADA** com o porquê impresso (`ALLOW_FRESHNESS_EXEMPTION`
desligada; P0-b do dono pendente).

### Mudança de configuração do repositório (2026-08-07, registrada em voz alta)

`actions/permissions/workflow.can_approve_pull_request_reviews: false → true` — o toggle
"Actions pode criar PRs", sem o qual o produto inteiro do laço (o PR mensal) não existe.
`default_workflow_permissions` permanece **read** (os jobs elevam explicitamente por bloco
`permissions:` — o menor-privilégio não mudou). Reversível em um toggle; o dono ratifica no gate.

### As guardas da fatia (resumo; detalhes nos relatórios das ondas)

`gate:fe` 1663 · `gate:artifact` **124 testes em 10 arquivos** com membresia DERIVADA (a
arquitetura previa 3 arquivos; a medição achou 6 — e `band-dominance`, ao passar a ler o
artefato, matou um defeito REAL do comparador que ignorava `fixedFeeRule`) · prova por MUTAÇÃO:
3 venenos (comissão 95% · banda sobreposta · versão desalinhada) reprovando nos DOIS gates ·
exaustividade DECLARADA (§C.2-bis, decidida pelo arquiteto após parada de Princípio VIII do
executor) com o vermelho de TIPO (15 pontos de construção quebraram) e as DUAS fechaduras do
hotfix A2 · o teto do `decideRefresh` somando `materiais + removidas` · remoção de categoria
CANÁRIA aborta (fixado em teste) · P0-a fechado: a literal morreu com um guarda que se guarda
(o teste lê o próprio fonte), semente = projeção GERADA (45.858→2.720 bytes, política medida).

### Pendências para o gate do dono (T019)

- **ADR-0028 (emendado com a exaustividade) e ADR-0029 flipam** Proposto→Aceito no merge.
- RA4: verbatims Shopee preservados como PROSA datada no `seed.ts` — âncoras executáveis na
  PR-C/T026 (o arquiteto reescreveu a RA4 aceitando a janela: a Shopee ainda não está no laço).
- As 2 exceções datadas do `gate:artifact` (`calculator-model.test.ts` · `fee-prefill.test.ts`)
  — dono proposto: a fatia que mexer nesses arquivos por outro motivo.
- O toggle de Actions↔PRs acima.
- O gatilho de bootstrap (`push` escopado à branch + ao YAML) morre com a branch no squash.
- **O PR #54 do bot fica ABERTO para você decidir** — mergear (a releitura é legítima) ou fechar;
  é o primeiro exemplar do ritual mensal.

## PR-B — o vigia da /precos + liveness + a independência provada (T020–T024, 2026-08-08)

**Execuções reais**: [31240364306](https://github.com/FreeSoulsDotBat/3dprecify/actions/runs/31240364306)
VERDE com os 3 jobs → **[PR #56 do bot](https://github.com/FreeSoulsDotBat/3dprecify/pull/56)**
(o segundo ritual mensal, agora com os dois caminhos). Antes dela, a run 31240108931 pagou a
lição nova da casa: **a relação (ii) era de IDENTIDADE por coincidência** — num mês de
só-frescor o rótulo não bumpa e `generatedAt` avança; virou relação de ORDEM (rótulo ≤ geração),
com a identidade provada no ponto de geração (iv).

**A prova de independência (emenda C1 do analyze)**: run
[31240442248](https://github.com/FreeSoulsDotBat/3dprecify/actions/runs/31240442248), branch
DESCARTÁVEL `prova-independencia-c1` (URL da tabela quebrada de propósito; commit/push com
LEFTHOOK=0 — declarado: a branch é quebrada POR DESENHO, jamais mergeável, e morreu ao fim):
**vigia da /precos LIDO com a tabela MORTA na mesma run** (US1/AC2 ✓). Bônus não planejado: o
`publicar` recusou a constante envenenada no `gate:artifact` — a prova de mutação do T013
disparando em condição de produção.

**O achado da PR-B que muda a spec (nota datada aplicada no US4/AC2)**: a /precos REAL de
2026-08-08 declara mínimo UNIFORME R$ 1,00 — as "~11 categorias a R$ 2,00" do brief sumiram da
página entre a medição de 2026-08-05 e a implementação. O vigia nasceu já pegando a fonte em
movimento; baseline seedado do MEDIDO, nunca do hipotético.

**Guardas**: gate:fe verde · gate:artifact 124+ · pins 46 refs/4 workflows · liveness bootado
contra o catálogo real ("2 dias, OK") · SC-1007 nos dois sentidos em compose.test · prova
estrutural do D7 (exports sem caminho para FeeEntry) · canárias do vigia por mutação.
