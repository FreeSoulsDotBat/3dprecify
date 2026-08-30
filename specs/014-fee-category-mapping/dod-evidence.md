# 014-fee-category-mapping — DoD evidence

**Status (2026-07-30): PR-A #31 com a Fase 6C fechada e CI verde — aguardando homologação e
autorização do dono.** Este arquivo registra a evidência medida, não a intenção. A regra que ele
segue é a que o E4 pagou duas vezes: **abrir o artefato é necessário e não suficiente — é preciso
abri-lo com dados adversariais, e, para artefato renderizado, com GEOMETRIA adversarial**.

## Portão de fechamento (T122)

| Item | Resultado | Onde |
|---|---|---|
| `pnpm gate:all` local | **verde** — 1089 testes front, 400 back (1 pulado), cobertura 83,53% back / acima do piso front, import-linter 5/5 | rodado em `9459f4a` |
| `pnpm gate:all` no pre-push | **verde** (256,4 s) + `migration-guard` OK, 1 alembic head | hook `pre-push`, push `adf85ed..9459f4a` |
| CI no PR [#31](https://github.com/FreeSoulsDotBat/3dprecify/pull/31) | **9/9 verdes** | [run 30599422555](https://github.com/FreeSoulsDotBat/3dprecify/actions/runs/30599422555) em `9459f4a` |
| Contrato regenerado? | **não foi preciso** — nenhuma rota mudou nesta fase (só frontend + testes), e o **drift-guard passou**, que é a prova e não a suposição | check "Contract drift-guard (OpenAPI + Orval) — SC-6" |
| Push confirmado | `git ls-remote` == HEAD local (`9459f4a`) — exit 0 não é prova neste toolchain | verificado após o push |

Checks do run: Gate · Web build · Contract drift-guard · **E2E (Playwright + emulador + backend/Postgres)** ·
Backend image build · Migration-amend guard · Secret scan · CI pass · GitGuardian — todos `SUCCESS`.

## Fase 6C — a correção que bloqueava o merge

Sete grupos, cada um com o teste escrito e **observado reprovando** antes do conserto (Constituição III).

| Tarefa | Falha MEDIDA antes do conserto | Onde estava a causa |
|---|---|---|
| **T113/T114** | banda aplicada ≠ banda que contém o anúncio; inversão de R$ 29 na lacuna FR-014a | `pricing-core/channels.ts` — o laço de ponto fixo saiu inteiro |
| **T115** | alvo de toque do seletor de categoria: **24px** contra os 44 da WCAG 2.2 AA | o campo não tinha **uma** regra de CSS; entrou no `.tf-inputwrap` do DS |
| **T116** | `categoryPath` devolvia `""` para id fora da espinha ⇒ chip **em branco** ao lado do "Limpar" | corrigido no **tipo** (`string \| null`), não no `if` |
| **T117** | contrato ARIA de `combobox` anunciado e não cumprido em nenhuma metade | deixou de anunciar; o widget real é lista em fluxo com botões |
| **T118** | base da barra "Total do kit" em **907**, topo da TabBar em **850** — 57px enterrados | `padding-bottom` não alcança `position: sticky`; recuo virou `--pinned-bottom` do shell |
| **T119** | detalhe do histórico em **1798px** num viewport de 390 | `h1.tf-page-header__title` (client=358, scroll=1782), o **único** elemento transbordando |
| **T120** | congelado exibindo `Preço para anunciar R$ 30,90 / Recebido líquido R$ 30,90` para canal **sem comissão** | recusa herdada em **tempo de leitura**, o que repara também os registros já gravados |
| **T083** | — (SC-815: prova de que o passado **não** se moveu) | documento congelado gerado pelo código de `1212a16`, anterior ao ADR-0024 |

### O que a evidência de teste NÃO teria pego

- **T115 e T117** foram achados por **screenshot**, não por asserção. Duas vezes: a lista de um
  resultado lendo como um segundo campo preenchido, e a contagem "8 categorias encontradas" quando
  existiam **31** (`MAX_RESULTS` é 8). A segunda era um defeito de honestidade introduzido pela
  própria correção anterior.
- **T118 e T119** exigem asserção de **caixas**: `toBeVisible` e `toContainText` passam com o
  elemento inteiramente coberto ou transbordado — oclusão e overflow não são propriedades do texto.
- **T083** passou de primeira, então foi **falsificado**: inverter o padrão do `bandMode` reprova 2
  dos 3 documentos (o primeiro sobrevive porque abaixo do primeiro limiar os dois modos coincidem —
  matemática correta, não falha do teste). Código restaurado em seguida.

### O padrão que se repetiu sete vezes

O repositório **já descrevia o defeito e não o impunha**:

1. `settleEntry` avisava no docstring sobre `listOutbox` devolvendo `[]`.
2. O teste "recusa uma célula cujos dois limiares discordam" passava verde e checava só `parseBands`,
   enquanto `parseAmazonTable` desfazia a recusa uma linha depois.
3. O docstring de `feeSealState` declarava "desatualizada" num caminho onde o `return` antecipado a
   tornava impossível.
4. O docstring de `fee-prefill` declarava o oposto do que `fee-seal` renderizava.
5. Dois testes vizinhos em `history-manage.spec.ts` documentavam, **com essas palavras**, a espera
   que o meu teste da T119 omitiu — e a corrida se disfarçou de instabilidade.
6. O cabeçalho de `snapshot-detail-page.tsx` declara "uma linha ausente não é um zero" (FR-507); o
   bloco de canais era o único lugar que não honrava a própria proibição.
7. `recalc-today.tsx` afirma que reprecificar as entradas congeladas devolve os valores congelados —
   e **nenhum caminho de código** exercita isso. A T083 é o que torna a afirmação verificada.

## Fora desta branch / fora do escopo, registrado

| Item | Estado |
|---|---|
| **T121** | HAND-OFF para `feature/012-e6-billing`: *stale pending* de checkout abandonado. Inerte hoje (épico adiado, decisão do dono 2026-07-09) |
| **T101–T106** | movidas para o PR do laço mensal (US4) |
| `shared/ui/toast.css` | soma `--tabbar-h` **incondicionalmente** ⇒ no desktop o toast flutua 76px acima do chão sem TabBar. Mesmo problema da T118 pelo outro lado; `--pinned-bottom` é o consumidor natural |
| Export PDF/CSV | **verificado**: não renderiza canais, então a mentira da T120 não existe no documento que o vendedor manda ao cliente |
| Estado SC-817 no histórico | um canal com taxa mas nível sem banda publicada aparece sem linhas e sem legenda. Pré-existente, distinto da T120, não tratado aqui |

## Homologação visual (`qa-produto`, 2026-07-30) — **PASS COM RESSALVAS · 92%**

Browser real, 41 screenshots, geometria lida do DOM. Os 6 grupos alcançáveis passaram nas asserções
**medidas**; 2 estados são comprovadamente **não alcançáveis** e a homologação provou a
inalcançabilidade em vez de fabricá-los — que era o risco pelo qual este papel voltou a `opus`.

| Grupo | Medida de hoje | Medida de antes |
|---|---|---|
| T115 moldura | os 7 `.tf-inputwrap` do slot: `48px · 1px rgb(185,187,198) · radius 14px` **idênticos** | 24px, zero regra de CSS |
| T117 contagem | `"Mostrando 8 de 31 — refine a busca"`; "de" → `8 categorias encontradas` (total real) | "8 encontradas" com 31 existindo |
| T118 barra do kit | 412px: barra até **843**, nav a partir de **850** — `intersects = false` | 907 vs 850 |
| T119 histórico | `scrollWidth === clientWidth` em 390/412/1440; **0** elementos com `right > 391` | 1798px |
| T120 congelado | sem comissão: 0 linhas de preço + a frase; com 12%: os 4 números **voltam** | R$ 30,90 fabricado |
| T097 + selos | catch-all em tom **neutro** (não `--info`); trocar de marketplace limpa a categoria e o selo | — |
| Transversal | `NaN/Infinity/undefined/R$ 0,00` fabricado: `false` em 100% das medições; console e rede limpos | — |

**Não verificado, com a razão provada:** T116 (a categoria nunca é persistida — os dois manipuladores
de troca de marketplace a zeram) e SC-817 (as bandas Shopee servidas cobrem `0 → ∞` sem lacuna).

**Ressalvas corrigidas em seguida** (`gate:all` verde depois de cada uma):

| # | O que era | Origem |
|---|---|---|
| **R2** | `… — Calçados (…) **(para Calçados)** …` — o nome duas vezes: a `source` do catálogo da Amazon já o carrega e a cláusula deste incremento o repetia | **introduzida por 014** — a condição agora é sobre o que já foi impresso, e no caminho da semente (cabeçalho sem fonte) a cláusula permanece |
| **R3** | o congelado exibia o enum cru `MERCADO_LIVRE` enquanto a Calcular escrevia "Mercado Livre" | **PRÉ-EXISTENTE** — linha idêntica em `develop` (lá 257, aqui 283), verificado com `git show`. Corrigida aqui porque a T120 reescreveu esse bloco; o valor cru continua sendo o fallback, para não reescrever documento antigo |

**R1 e os dois achados fora do mandato** (nota de freemium exibida a assinante Premium — pré-existente
do E2 e confirmada em `develop`; coluna vazia no desktop) ficaram registrados como follow-ups em
`tasks.md`, sem bloquear o merge.

> **Custo** (`docs/token-ledger.md`): **146.333** contra estimativa de 200–320k — abaixo da estimativa
> **e** abaixo do comparável do E4 (168.094), com 8 grupos em vez de uma slice. As duas causas medidas:
> mandato enumerado com os números de ANTES para comparar, e a stack subida pelo loop principal antes
> do hand-off.

## Revisão adversarial final (workflow, 2026-07-31)

14 agentes: 5 lentes independentes → 18 achados → os 4 mais severos com **2 céticos cada, default =
refutado**. Achou **um bloqueador**, corrigido em `6b2f267`.

**O bloqueador — `catalogVersion` não bumpado.** Medido:

| | `adf85ed` | `5e63047` |
|---|---|---|
| `catalogVersion` | `2026-07-28.0` | `2026-07-28.0` |
| entradas | 77 | **79** |

Duas entradas novas sob rótulo idêntico, porque o gerador cravava a sequência em `.0`. O rótulo é
congelado dentro do payload que o **ADR-0019 torna imutável**: dois registros com o mesmo nome
descreviam tabelas diferentes — numa, um slot Amazon sem categoria não tinha preço; na outra, ele
precifica a 15% pelo catch-all. O campo existe para responder *qual tabela produziu este número*, e um
registro irregravável não tem conserto depois. Corrigido com `nextCatalogVersion` em `guardrails.ts`
(fora do `.mjs`, que é isento de cobertura) + artefato em `2026-07-28.1` **sem nova leitura**.

**A evidência mais forte do lote veio de onde ninguém pediu:** o crítico de completude rodou um
diferencial **velho-vs-novo** do `grossUp` — 9 tabelas do catálogo × 100.000 bases cada — e mediu
**0 diferenças** em anúncio, líquido e banda aplicada. É a prova de que a reescrita T113/T114 não moveu
nenhum centavo alcançável.

**O que sobrou está em `tasks.md`** (A1-r, B, C, D, E), cada um com a sua medição — incluindo o `sort`
de `chooseBand` (recomendação dominada numa tabela em "vale", **exposição hoje zero medida em três
vias**), o teste de monotonicidade que afirma em geral e prova num fixture, e o byte NUL que faz o git
tratar `fee-catalog.ts` como binário — cegando `diff` e `blame` num arquivo de schema de precificação.

> **Custo** (`docs/token-ledger.md`): **1.476.942** contra estimativa de 400–700k — **2,1× errado**. A
> estimativa ancorou em número de agentes; o custo veio de **profundidade de execução por lente** (473
> usos de ferramenta para 14 agentes: as lentes copiaram fontes, rodaram `node` sobre o `pricing-core`
> real e varreram 100k bases com oráculo próprio). Para revisão, capar céticos quase não move a conta.

## US4 (fatia do orquestrador) — evidencia

**Entregue** nesta fatia: as 6 pre-condicoes (T101-T106) + o orquestrador como decisao pura
(T042-T048, T049a, T049b, T050a) + T051. **Fora dela, por decisao do dono (2026-07-31)**: o
`fee-refresh.yml` (T049/T050, presos a T069b) e o ruleset do `develop` (T048a, configuracao).

### T051 / SC-811 — a execucao mensal consome 0 tokens de LLM

Verificado em tres vias independentes, nao afirmado:

| # | Verificacao | Resultado |
|---|---|---|
| 1 | Dependencias de `packages/fee-ingest` | runtime: **so `zod`**; dev: `@playwright/test`, `@types/node`, `typescript`, `vitest`. **Nenhum SDK de modelo** |
| 2 | Busca por `anthropic\|openai\|claude\|gemini\|llm\|gpt-\|completion\|embedding` em `src/` | **zero ocorrencias** |
| 3 | Toda saida de rede do pacote | so a pagina da Amazon (`sellercentral.amazon.com.br/.../G200336920`). O unico outro host que aparece e `example.com` **dentro de um fixture de teste** (`catalog-diff.test.ts:332`) |

**Consequencia, que e o que a SC-811 de fato pede**: o laco mensal **nao gera linha** em
`docs/token-ledger.md`. Conferido — as duas ocorrencias de "ingest" no ledger sao da ingestao do
**graphify**, de 2026-07-10, sem relacao com o `fee-ingest`.

O parsing e deterministico por construcao: ler a tabela, comparar campo a campo, formatar markdown.
Nada disso pede julgamento de modelo — e e por isso que a regra do ledger nao se aplica aqui, e nao
por dispensa.

### O que esta fatia NAO faz, dito em vez de subentendido

O laco **nao dispara sozinho**. O `schedule` do GitHub roda a partir da branch **default** (`main`),
e o corte de release esta adiado ate v1 — entao, mesmo depois do YAML existir, o gatilho pratico sera
`workflow_dispatch`. O que existe e a decisao inteira, testada e ligada ao gerador; o gatilho e que
falta.

> **Correcao (2026-07-31, achado pela analise em 3 lentes).** Este paragrafo dizia "o laco so roda por
> `node`", e isso era **FALSO quando foi escrito**: o pacote nao bootava sob `node` puro. Tres imports
> relativos de VALOR sem extensao (`amazon-to-catalog.ts` -> `./amazon-parse`, herdado do PR-A
> `461a367`; e dois que esta fatia acrescentou, em `guardrails.ts` e `refresh.ts`) faziam o resolvedor
> ESM do node estourar `ERR_MODULE_NOT_FOUND`. **Nenhum teste podia ver**: todos rodam sob o vitest,
> que e justamente o resolvedor tolerante. A afirmacao so cai ao executar o gerador de verdade — e
> nenhuma lente read-only o executou; ela quase escapou por isso.
>
> Corrigido, e **re-verificado depois do conserto, nao reescrito antes**: `node` importando
> `refresh.ts` + `amazon-to-catalog.ts` + `guardrails.ts` responde `BOOT OK: true`. Uma guarda de
> teste agora reprova qualquer import relativo de producao sem `.ts`, porque a suite sozinha nunca
> veria isto.

### Analise em 3 lentes (workflow, 2026-07-31) — 2 bloqueios CRITICOS, ambos corrigidos

12 agentes: tecnica, negocio/produto e homologacao visual. **A US4 nao tem tela**, entao a lente
visual homologou as duas coisas que o incremento de fato renderiza para um humano.

**O que PASSOU, e e o acerto medido da fatia**: a pergunta central da lente visual — "num PR com 78
entradas, a linha que mudou dinheiro e ACHAVEL?" — passa com folga. Uma comissao mudando em 1
categoria produz um corpo de **299 caracteres / 7 linhas / 2 linhas de tabela**; os 78 avancos de
`lastReviewed` somem, como o docstring promete. Nenhum caso realista chega perto de "load more".
E o selo no app foi conferido em browser real: le `atualizada em 28/07/2026`, que bate com o
`lastReviewed` da entrada servida. **Nenhuma das duas mudancas desta fatia alterou o que o vendedor
le** — `effectiveDate` nao e renderizado por caminho nenhum do app (medido por grep), e
`catalogVersion` tampouco.

**Os dois bloqueios, confirmados por medicao propria e corrigidos:**

| # | O defeito | Como foi confirmado |
|---|---|---|
| 1 | O pacote **nao bootava sob `node`** — 3 imports relativos de valor sem extensao. Quebra herdada do PR-A, ampliada por esta fatia | `node .boot.mjs` -> `ERR_MODULE_NOT_FOUND`; depois do conserto, `BOOT OK: true` |
| 2 | O corpo do PR dizia **"Sem mudanca de tarifa nesta leitura"** logo acima da secao **"Categorias removidas da fonte"** — duas afirmacoes contraditorias no mesmo PR, e a mentirosa e a prova-de-vida do robo | corpo gerado de verdade: as duas frases presentes ao mesmo tempo |

**Por que os dois passaram**: todo teste asseria PRESENCA, nenhum asseria AUSENCIA. Um corpo que diz A
e mostra nao-A satisfaz os dois `toContain`. Os testes novos asserem a ausencia.

**Sobre o bloqueio 2**: uma prova-de-vida que mente e pior do que nenhuma — ela e lida rapido, por
definicao, e e ela que autoriza o revisor a nao olhar o resto.

## Pendente para o merge

- [x] Homologação visual (`qa-produto`) do PR #31 — **PASS COM RESSALVAS**, as duas ressalvas
      acionáveis corrigidas.
- [x] Revisão adversarial final (workflow) — o único bloqueador corrigido; o resto registrado.
- [x] CI verde em `6b2f267` — **9/9**.
- [ ] Autorização do dono para o squash-merge em `develop` (ADR-0006).
