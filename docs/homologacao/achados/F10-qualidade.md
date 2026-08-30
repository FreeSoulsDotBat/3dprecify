# F10 — Qualidade e cobertura

## Resumo

**Zero `any` explícito** em `apps/web/src` fora de testes e do cliente gerado — medido, não estimado.
Os `Any` do backend estão todos na fronteira de JSON (`request.json()`, `resp.json()`), que é o
único lugar honesto para eles: o payload é genuinamente desconhecido até ser validado. O ratchet de
cobertura é explícito e justificado (100% em `packages/*`, piso realista medido em `apps/web`).
**Um achado Baixo**: o `MIN_ROWS = 28` — o piso que decide se um parse do catálogo de tarifas é
aceito — mora no **único arquivo isento de cobertura**. **E um achado de MÉTODO, que vale mais que
os dois**: a classe "teste que passa sem provar nada" **não é detectável mecanicamente**, e esta
auditoria tem cinco instâncias documentadas para prová-lo. Os dois únicos detectores que funcionaram
foram observar o vermelho primeiro e mutar o código.

---

## O que está medido e certo

| verificação | resultado |
| --- | --- |
| `any` explícito em `apps/web/src` (fora de teste e do gerado) | **zero** |
| `Any` no backend | só em fronteira de JSON e num helper de coerção — uso correto |
| ratchet de cobertura | `packages/*/src/**` a **100%**; `apps/web/src/**` num piso medido (~81/77/78/82) |
| exclusões do ratchet | o cliente gerado (Orval) e os `.mjs` — ver o achado |

O piso de `apps/web` ser **medido a partir da baseline real** em vez de um número redondo é a escolha
certa: um alvo aspiracional que ninguém alcança vira exceção permanente; um piso na baseline pega
regressão sem mentir sobre o estado.

---

## Achados

### [F10-001] O piso que aceita ou rejeita o catálogo de tarifas mora no arquivo isento de cobertura

- **Severidade**: **Baixo**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100%
- **Local**: `packages/fee-ingest/src/build-amazon.mjs:39` (`const MIN_ROWS = 28`), isento por
  `vitest.config.ts:32` (`"packages/*/src/**/*.mjs"`)

A equipe **sabia** da isenção e agiu sobre ela: várias regras foram deliberadamente movidas para fora
do `.mjs` exatamente por isso, e os comentários dizem o porquê —
*"este arquivo é isento de cobertura, e a regra que decide o rótulo do dinheiro não pode morar num
lugar isento"* (`nextCatalogVersion`, `collectedAtFor`, `decideRefresh` foram todos migrados para
`guardrails.ts`/`refresh.ts` por essa razão).

**A migração ficou incompleta em um ponto.** O `MIN_ROWS = 28` é uma decisão de dinheiro: ele define
quantas categorias um parse precisa produzir para ser aceito. `checkParseSanity` é testada com um
`minRows` **passado por parâmetro** — a função está coberta; **o valor não está**. Se alguém trocar
28 por 2, nenhum teste reclama, e o guarda que existe para pegar "a fonte encolheu" passa a aceitar
um parse de duas linhas.

**Também não coberto no mesmo arquivo**: os três `process.exit(1)` de cobertura de banda, colisão de
id e data inválida. As *funções* que decidem estão testadas; o **encadeamento** que as chama não.

**Conserto mínimo (não aplicado — R8)**: mover a constante para `guardrails.ts`, ao lado das regras
que já migraram pelo mesmo motivo. Uma linha.

---

## O achado de método

### [F10-002] "Teste que passa sem provar nada" não é detectável mecanicamente

- **Severidade**: não é defeito de código — é **fato sobre o processo**
- **Certeza**: 100% (cinco instâncias documentadas nesta sessão, todas achadas por outro meio)

Varri por todos os padrões mecânicos plausíveis: `toBeGreaterThanOrEqual(0)`, `expect(true)`,
`assert True`, `toBeDefined()`, `is not None`. **Nenhum achado real.** O que a varredura encontra são
asserções *fracas* (`toBeDefined()` num campo que nunca seria `undefined`) e estreitamentos de tipo
legítimos (`assert back_url is not None` antes de usá-lo) — ruído, não sinal.

**As cinco instâncias reais desta sessão não têm forma sintática em comum:**

| instância | por que passava | como foi achada |
| --- | --- | --- |
| `.count(...) >= 0` no teste de estorno | trivialmente verdadeira | **releitura antes do commit** |
| o 404 "sem assinatura" (T021) | a rota não existia, e o framework já dava 404 | **observar o vermelho** — era o único verde entre 12 |
| os três verdes da carência (T023) | `payment_failed` era no-op, então "nada foi escrito" era trivial | **observar o vermelho** — 7 vermelhos e 3 verdes |
| o `/R\$/` do teaser de Histórico | proxy que funcionava só enquanto não havia preço na tela | **a suíte quebrando** quando o preço entrou |
| os 404 do Play (T035) | as rotas não existiam em lugar nenhum | **controle positivo** construído de propósito |

O que elas têm em comum não é sintaxe — é **semântica**: a asserção é verdadeira por um motivo
diferente do que o nome do teste afirma. Nenhum linter alcança isso.

**Os dois detectores que funcionaram, e eu os aplicaria como regra:**

1. **Observar o vermelho, e ler cada verde nele.** Um teste que passa na rodada vermelha está
   passando pelo motivo errado — por definição. Foi assim que 4 das 5 apareceram.
2. **Mutar o código e exigir que o teste caia.** Foi assim que os guardas de geometria, de dominância
   de banda e de cortesia-não-revogada foram provados não-vácuos.

Isto **não vira spec de correção** (não há código a corrigir). Vira, se você quiser, uma linha na
Definição de Pronto: *"todo teste novo foi visto FALHAR pelo motivo pretendido"*. →
`PENDENCIAS.md` §P-015.

---

## Não verificado nesta fase

1. **Código morto** — não rodei detecção (`knip`, `ts-prune`) porque nenhuma está instalada, e
   instalar ferramenta viola o espírito da R8. O `dependency-cruiser` e o `eslint-boundaries` pegam
   import proibido, não export não usado. **Pergunta**: vale rodar uma detecção pontual?
2. **Regra de negócio duplicada** — a F02 e a F03 não acharam duplicação de fórmula (o
   `pricing-core` é fonte única e o backend não recalcula, FR-118). Não varri o cliente procurando
   reimplementação parcial de regra de exibição.
3. **Cobertura do CLI de operador** (`grant_premium.py`, 60% medido no gate) e do
   `reconcile_subscriptions.py` (**0%**). O segundo é a rede de segurança do `[F04b-001]` — uma rede
   de segurança sem teste é a segunda metade daquele achado.
