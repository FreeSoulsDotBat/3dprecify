# Arquitetura do incremento 017 — desenho estrutural para o `/speckit-plan`

**Autor**: `arquiteto` · **Data**: 2026-08-07 · **Emendado**: 2026-08-07 (§C.2-bis — exaustividade
declarada, bloqueio do T014; §D.3 e RA4 corrigidos por medição do executor)
**Entrada**: `specs/017-ingestao-mensal/spec.md` (pós-clarify 8/8) ·
`docs/product/017-ingestao-mensal-scope-brief.md` · `docs/homologacao/OBTENCAO-DINAMICA-DADOS.md`
(7 decisões do dono de 2026-08-05) · `docs/adr/0010-marketplace-fee-catalog-architecture.md`
§A6/§A10/§A13/§A15/Adendo A14 · `specs/014-fee-category-mapping/tasks.md` (resíduos absorvidos) ·
o código real de `packages/fee-ingest/`, `apps/web/src/shared/fee-catalog/` e `.github/workflows/`.

**ADRs que este documento PROPÕE** (o `/speckit-plan` os escreve; aqui só o número e a tese):
**ADR-0028** (o laço mensal: coletor emite FATIA, a composição publica — **incluindo a exaustividade
declarada**) · **ADR-0029** (a semente como PROJEÇÃO GERADA do artefato servido) · **ADR-0030** (OCR
admissível: motor fixado por lockfile, endereço por bytes, guardas conjuntivas e o portão humano).

> Este documento decide **forma**, não comportamento. Nenhuma decisão do dono é reaberta — nem a
> clarify (8/8), nem as 7 de 2026-08-05, nem QA1/QA5. Onde o **código medido hoje contradiz** uma
> fonte escrita, o conflito está na **§Conflitos**, apontado e não escondido (Constituição II).
> Toda medição abaixo foi feita sobre a árvore de `016-pr-f-dados` (que já contém o hotfix A2/A3).

---

## 0. Invariantes que nenhuma decisão abaixo pode violar

| # | invariante | onde ele mora hoje |
| --- | --- | --- |
| I1 | O job **sempre abre PR** e **nunca escreve** no branch de integração; `RefreshOutcome` é união de 2 casos | `fee-ingest/src/refresh.ts:39` (FR-020a) |
| I2 | Leitura que falhou **não é** "as taxas caíram": artefato byte a byte intocado, sem PR | SC-806, `build-amazon.mjs` |
| I3 | `lastReviewed` só avança por **releitura real** da fonte | `guardrails.ts:collectedAtFor` + `validarData` |
| I4 | `catalogVersion` só se move quando o **CONTEÚDO** mudou, e é decidido por `nextCatalogVersion` — nunca à mão | `guardrails.ts:145` · ADR-0019 (o rótulo congela dentro de snapshot imutável) |
| I5 | Todo número de dinheiro carrega `source`/`sourceUrl`/`effectiveDate`/`lastReviewed` | Constituição II, `feeEntrySchema` |
| I6 | **0 tokens de LLM** no laço; nenhuma linha em `docs/token-ledger.md` gerada por execução | SC-811 · ADR-0010 §A11 |
| I7 | `packages/fee-ingest` **não importa** `apps/` nem `backend/` | `.dependency-cruiser.cjs` regra `fee-ingest-is-standalone` (severity `error`) |
| I8 | Toda `uses:` de workflow é SHA de 40 caracteres, e todo workflow **parseia** | `scripts/check-action-pins.sh` + job `action-pins` |
| I9 | O artefato commitado é **ponto fixo do gerador** — ninguém contrabandeia valor por fora | `artifact-fixed-point.test.ts` |

**I9 é o motor deste incremento inteiro.** Hoje ele vale só para a Amazon; o 017 o estende para toda
fonte que o laço tocar, e é ele que transforma "o laço regenera" em "o laço não pode reverter uma
curadoria em silêncio".

---

## A. Topologia do workflow — **jobs explícitos por FONTE + um job de composição**; os três estados são DADO

### A.1 Contexto

FR-1001/FR-022 exigem independência por marketplace; a US2/AC3 exige que o corpo declare
**LIDO / ABORTADO / NÃO LIDO** para **todos**; a clarify Q4 exige **PR parcial** nomeando o abortado.
As fontes são heterogêneas por natureza medida: Amazon G200336920 exige **navegador headless**
(curl devolve casca), `/precos` é **fetch simples** (200, 647 KB), Shopee exige **headless + OCR**,
os vigias do ML são **fetch com UA**. E a T062a (fatia ML futura, condição 1 do parecer) exige que o
job que um dia carregar o segredo instale **zero dependências**.

### A.2 Opções

| # | opção | prós | contras | escalabilidade | conf. |
| --- | --- | --- | --- | --- | --- |
| A1 | **Um job, passos sequenciais** | um log, trivial | a falha de um mata os outros a menos que tudo vire `continue-on-error` — e aí o estado do run vira invisível; viola FR-022 | péssima: cada fonte nova alonga o caminho crítico | 20% |
| A2 | **`strategy: matrix` por marketplace, `fail-fast:false`** | uma definição só; paralelo de graça | força a UNIÃO dos setups em toda perna (instalar Chromium para um vigia de `curl`) ou uma pilha de `if: matrix.x == …` — a matriz degenera em jobs explícitos com pior legibilidade; **impossibilita a T062a** (perna sem dependências) | boa em número, ruim em heterogeneidade | 45% |
| A3 | **Jobs explícitos por fonte + job `publicar` (`needs`, `if: always()`)** — **ESCOLHIDA** | cada job declara só o próprio setup; isolamento real; a fatia ML entra como job novo sem tocar nos outros; `if: always()` faz o abortado virar dado em vez de sumir | mais linhas de YAML; repetição de `checkout`/`setup-node` (mitigável por composite `uses: ./…`, isento do pin-guard) | linear e honesta: fonte nova = job novo | **86%** |

### A.3 Decisão

**A3.** Cinco jobs na primeira fatia (`amazon-tabela`, `amazon-precos`, `shopee`, `ml-vigias`,
`publicar`), sendo `publicar` o único com `contents: write`/`pull-requests: write`.

**Onde vivem os três estados: no ORQUESTRADOR, como dado; nunca na matriz e nunca no gerador do
corpo.** Cada coletor termina escrevendo um **veredito** (`artifacts/<fonte>.verdict.json`) e sobe-o
como artefato da run. O gerador do corpo é uma **função pura** `(vereditos) → markdown`.

```ts
// packages/fee-ingest/src/verdict.ts — 3 casos, e nenhum quarto que escreva calado
export type CollectorVerdict =
  | { kind: "LIDO"; marketplace: Mk; collectedAt: string; sourceUrl: string; slice: CatalogSlice }
  | { kind: "ABORTADO"; marketplace: Mk; reason: string; sourceUrl: string }
  | { kind: "NAO_LIDO"; marketplace: Mk; reason: string };
```

**A regra que mata a US2/AC3 por construção**: a lista de marketplaces cobertos é **uma tabela única**
(`MARKETPLACE_COVERAGE`, em `fee-ingest`), e o compositor produz `Record<Mk, CollectorVerdict>` por
função **total** sobre ela. Um marketplace sem veredito no disco **não some**: vira
`NAO_LIDO` com motivo `"o job não produziu veredito"`. Ausência de artefato e job que nunca começou
são indistinguíveis no sistema de arquivos — por isso a verdade é a tabela, não o `ls`.

**Nada que decida dinheiro ou texto de relatório mora em YAML.** O `run:` de um job pode: chamar um
`.mjs`, subir artefato, e (no `publicar`) chamar `gh`. Um `if:` de workflow pode escolher SE um job
roda, nunca O QUE ele afirma. Motivo: shell em YAML é o único código deste repositório que nenhum
gate executa — e a lição do 014/US4 é que suíte verde não prova programa que roda.

### A.4 Consequências / o que PROÍBE

- Proíbe `continue-on-error` como mecanismo de independência (ele esconde o estado que a US2 exige).
- Proíbe que o corpo do PR seja montado por `echo`/heredoc no YAML.
- Proíbe um coletor que **conclua sem veredito** — ausência de arquivo é ABORTADO por omissão, e o
  publicador o declara com esse motivo literal.

---

## B. P0-a — a paridade `semente ↔ artefato` vira **relacional**, e a versão tem **uma** fonte

### B.1 Contexto (MEDIDO, e o número já mudou desde o brief)

`apps/web/src/shared/fee-catalog/fee-catalog.test.ts:69-70` afirma
`served.catalogVersion === "2026-08-07.0"` e `FEE_CATALOG_SEED.catalogVersion === served.catalogVersion`.
O brief cita `:62-66` com `"2026-08-06.1"`: **o hotfix A2/A3 já reeditou essa literal**, o que é a
prova empírica do defeito — todo bump de conteúdo obriga a editar à mão uma string dentro de um
teste. O primeiro PR mensal nasce vermelho por construção.

Medido também, e mais importante: **a semente NÃO é uma cópia do artefato servido.** No servido a
Amazon tem 78 entradas; na semente, `entries: []`. Ela é uma **projeção podada** (orçamento SC-810 de
bytes/parse no boot). Logo "paridade estrita" **não pode** significar igualdade de documento.

### B.2 Opções para a forma do guarda

| # | forma | prós | contras | conf. |
| --- | --- | --- | --- | --- |
| B1 | **Só `seed.catalogVersion === served.catalogVersion`** (apagar a literal) | 1 linha, fecha o vermelho | não guarda nada além do rótulo: a semente pode divergir em CONTEÚDO e ficar verde para sempre | 40% |
| B2 | **Igualdade de documento** (semente = servido) | máxima garantia | contraria a poda medida; estoura o orçamento de boot e muda a primeira pintura offline | 15% |
| B3 | **Guarda de PROJEÇÃO** — **ESCOLHIDA**: a semente é o resultado declarado de `projetarSemente(servido)`; o teste afirma a RELAÇÃO, não valores | guarda rótulo E conteúdo; a poda vira política explícita e testável em vez de acidente; sobrevive a qualquer bump sem edição humana | exige extrair a política da poda para um módulo (trabalho da fatia) | **88%** |

### B.3 Decisão

A paridade passa a afirmar **quatro relações**, nenhuma com valor cravado:

1. `semente == projetarSemente(servido)` — profunda, com a política de poda declarada em
   `packages/fee-ingest/src/seed-projection.ts` (§C).
2. `catalogVersion` casa `/^\d{4}-\d{2}-\d{2}\.\d+$/` **e** sua parte de data é a data de
   `generatedAt` — pega a edição à mão de um lado só.
3. `schemaVersion === SCHEMA_VERSION` nos dois (já existe, fica).
4. O rótulo é **o que `nextCatalogVersion(anterior, coleta, mudou)` produziria** — provado no ponto de
   geração (§C), não por adivinhação no consumidor.

**A fonte única da versão continua sendo `guardrails.ts:nextCatalogVersion`**, e o 017 acrescenta a
regra que hoje só existe por acidente de haver um coletor: **UM bump por EXECUÇÃO**, decidido na
composição, jamais um por coletor. Dois coletores bumpando na mesma data produziriam `.1` e `.2` para
o mesmo run — dois rótulos para um conteúdo, dentro de um payload que o ADR-0019 congela para sempre.

### B.4 O que PROÍBE

- Proíbe qualquer literal de `catalogVersion` em teste, código de app ou fixture não-datada.
- Proíbe a semente ser editada à mão a partir do 017 (§C) — ela deixa de ser documento e vira saída.
- Proíbe um coletor chamar `nextCatalogVersion`.

---

## C. Fluxo de regeneração — **coletor emite FATIA; a composição publica**; a semente é gerada; a idempotência é provada

### C.1 O defeito que a forma de hoje teria em paralelo (medido no código)

`build-amazon.mjs` **lê e escreve `backend/app/data/catalog.json` diretamente**, carregando os outros
marketplaces intocados. Isso funciona com um coletor serial. Com jobs independentes (§A) em VMs
isoladas, o último a escrever vence e a curadoria do outro some — em silêncio, sobre dinheiro.

Pior, e este é o achado que muda a fatia da Shopee: um coletor que **regenera o marketplace inteiro**
apaga toda folha que ele não sabe produzir. A Shopee de hoje carrega `freight: {kind:"NONE"}`,
`freightSubsidyInfo` e `optionalSurcharges` — nada disso está no PNG que o OCR lê. Um coletor Shopee
ingênuo **reverteria o hotfix A2 na primeira execução real**, devolvendo o desconto de R$ 20 que
acabou de ser removido do líquido do vendedor.

### C.2 Decisão — cinco regras estruturais

1. **Coletor NÃO escreve o artefato.** Ele emite `CatalogSlice` = { marketplace, folhas lidas,
   exaustividade declarada, `collectedAt`, `sourceUrl` }. O tipo não tem caminho para o disco.
2. **Regra da folha lida** (a que mata o C.1): `aplicarFatia(base, slice)` escreve **apenas as folhas
   que o coletor declarou ter lido**; toda outra folha vem da BASE. Provado por teste: rodar o
   coletor Shopee sobre a tabela vigente com PNG inalterado produz artefato **byte-idêntico** — a
   extensão natural do I9 (`artifact-fixed-point`) para cada fonte nova.
3. **Exaustividade DECLARADA** (§C.2-bis) — o contrapeso obrigatório da regra 2.
4. **A composição é pura e ordenada**: `compor(base, slices[])` aplica em ordem alfabética de
   marketplace, chama `decideRefresh` **por marketplace** (o teto de linhas alteradas já é
   per-marketplace desde o U4-a) e produz:
   - fatia admitida ⇒ entra;
   - fatia reprovada (sanidade/teto) ⇒ **é descartada e seu veredito vira ABORTADO** — que é
     exatamente o PR parcial da clarify Q4, expresso por tipo em vez de por `if`;
   - depois de admitir tudo, **um** `nextCatalogVersion` e **um** `generatedAt`.
   O desfecho do RUN é união de 2 casos, como o da fatia:
   `RunOutcome = {kind:"SEM_PR"; motivo} | {kind:"PR"; titulo; corpo; dispensa}`. Não existe terceiro
   caso que escreva, e um `if` esquecido não cria um que o tipo não tem (FR-020a preservada em dois
   níveis).
5. **A semente é GERADA junto** (clarify Q3): `projetarSemente(artefato)` →
   `apps/web/src/shared/fee-catalog/seed.data.json`; `seed.ts` encolhe para política + parse + export.

### C.2-bis — **Exaustividade declarada** (decisão de 2026-08-07; desbloqueia o T014)

**O buraco, medido pelo executor.** A regra da folha lida só sabe **acrescentar e atualizar**: sob
ela, silêncio significa "não li", nunca "não existe mais". Mas o coletor Amazon de hoje **remove** por
regenerar a seção inteira — e a remoção é um fato REAL da fonte que o 014 já pagou para tratar
("Categorias removidas da fonte (decisão humana necessária)"). Sem contrapeso, o artefato acumularia
fantasmas para sempre — e, pior que acumular, ele **carimbaria `lastReviewed` fresco numa entrada que
a fonte deixou de publicar**: o selo diria "reverificado hoje" sobre uma categoria que não existe mais.
Isso é I3 e I5 quebradas, não um detalhe de limpeza.

**Opções**

| # | opção | prós | contras | conf. |
| --- | --- | --- | --- | --- |
| (b) | `slice.removals: EntryRef[]` — remoção como evento por entrada | máxima explicitude por item | o coletor teria de **diffar contra a base** para produzi-la; isso reintroduz exatamente o acoplamento que a §C.1 elimina (coletor emite, composição compara) e devolve a base para dentro de um job paralelo | 40% |
| (c) | **Nenhuma remoção automática, nunca**; o corpo lista "presentes no catálogo, ausentes na fonte" e um humano remove à mão | o mais conservador; zero risco de remoção indevida | curadoria manual mensal para um caso que a fonte resolve sozinha; e, enquanto o humano não age, a entrada fantasma **continua sendo servida com `lastReviewed` avançado** — o selo mente sob referência. É o custo que mata a opção | 45% |
| (a) | **`CatalogSlice.exhaustive: SectionKey[]`** — **ESCOLHIDA** | o coletor declara o que **leu por inteiro**; a composição deriva a remoção sem que o coletor conheça a base; a Shopee declara `[]` e nunca remove nada; casa com as guardas que já existem (canárias + piso de linhas abortam ANTES de virar fatia) | um campo a mais em todo coletor; exige que a declaração seja **conferida**, não confiada | **87%** |

**A forma exata do campo** — `exhaustive` é **obrigatório**, não opcional, e a razão é a lição
recorrente deste projeto (016/PR-E "declarado OU não-vazio", ADR-0026 recusa NOMINAL): uma declaração
por silêncio é justamente a que ninguém percebe faltando. Um coletor novo tem de **escrever
`exhaustive: []`**, e isso é uma frase, não um esquecimento.

```ts
// packages/fee-ingest/src/slice.ts
/** As seções de um marketplace que um coletor pode ter lido POR INTEIRO.
 *  O tipo NÃO admite bloco de nível de marketplace (`freightSubsidyInfo`, `optionalSurcharges`,
 *  `determinantsSchema`, `feeAxes`): exaustividade nunca pode apagar curadoria que nenhuma fonte
 *  publica — é o hotfix A2 protegido por TIPO, e não por lembrança. */
export type SectionKey = "entries" | "categorySpine";

export interface CatalogSlice {
  marketplace: Mk;
  collectedAt: string;   // valida por `collectedAtFor` — I3 intocada
  sourceUrl: string;
  /** As folhas efetivamente LIDAS, chaveadas por determinantes (regra da folha lida). */
  leaves: LeafWrite[];
  /** Seções lidas por INTEIRO nesta coleta. `[]` = "não afirmo completude de nada".
   *  Presença de "entries" = "este é o conjunto COMPLETO que a fonte publica em `collectedAt`;
   *  entrada da base ausente daqui foi REMOVIDA pela fonte". */
  exhaustive: SectionKey[];
}
```

**O que a composição faz com ele** — quatro regras, e as duas últimas são as que impedem que a
declaração vire uma faca:

1. Seção **não** declarada ⇒ nada é removido dali. A base vence. (Shopee: `exhaustive: []`, sempre.)
2. Seção declarada ⇒ `aplicarFatia` remove da base, **naquele marketplace e naquela seção**, toda
   chave ausente da fatia; as folhas das entradas remanescentes continuam sob a regra da folha lida.
   A Amazon declara `["entries", "categorySpine"]` (a espinha é o que faz `reparented` e
   `removedCategories` funcionarem).
3. **A declaração não é confiada, é condicionada.** Uma fatia só existe se as guardas da fonte
   passaram — `checkParseSanity` (canárias Roupas 14% / Calçados 14% / Relógios 13% **+ o piso
   `MIN_PARSE_ROWS = 28`**), `checkBandCoverage` e `checkCategoryIdCollisions`. Página quebrada, casca
   de SPA ou 403 **abortam antes**, e uma fatia que não existe não remove nada (I2/SC-806).
4. **O teto de mudança em bloco passa a contar remoção.** `decideRefresh` hoje calcula
   `changed = materialEntries(mk).length`; remoções vivem em `diff.removedEntries` e **não entram no
   numerador** — então uma leitura encolhida que passasse o piso removeria entradas sem que o teto
   sequer olhasse. Emenda: `changed = materiais(mk) + removidas(mk)`. **Exposição medida com a regra
   nova**: com `MIN_PARSE_ROWS = 28` sobre 38 categorias, no máximo **10 categorias (20 entradas de
   78 ≈ 26%)** podem sumir numa leitura que passe o piso — abaixo do teto de 50%, portanto ainda
   admissível como fatia, e é **por isso** que a remoção é sempre NOMEADA no corpo e **nunca**
   dispensável (item seguinte).

**O que o corpo do PR imprime numa remoção — e por que "Sem mudança" fica impossível.** Nada de novo
precisa ser inventado: `diffCatalogs` já produz `removedCategories`/`removedEntries`, `semNoticia()`
já retorna `false` quando qualquer uma delas é não-vazia (é literalmente o conserto do 014/US4, com o
comentário no código), e `mayAutoMerge` já **nega a dispensa** nas duas listas. O 017 acrescenta
**uma linha de procedência** a cada item removido, porque sem ela o revisor não consegue distinguir
"a fonte deixou de publicar" de "o coletor não leu":

```
### Categorias removidas da fonte (decisão humana necessária)
- Colchões — ausente na leitura EXAUSTIVA de `entries`+`categorySpine`
  em 2026-09-01 (https://sellercentral.amazon.com.br/…/G200336920)
```

E o teste da US2 afirma a **ausência** do texto "Sem mudança de tarifa nesta leitura" em toda execução
com remoção — afirmado por ausência, não por presença.

**Emenda ao ADR-0028: SIM, e antes do flip.** A exaustividade declarada não é detalhe de
implementação — é a **outra metade** da regra da folha lida (uma só acrescenta; a outra só remove sob
declaração conferida). Um ADR que registre apenas a primeira descreve um sistema que não fecha. O
ADR-0028, ainda **Proposto**, ganha a seção "Exaustividade declarada" com: o tipo acima, as 4 regras
de composição, a exposição medida (≤10 categorias) e a proibição estrutural de exaustividade sobre
bloco de nível de marketplace.

### C.3 Quem executa a regeneração, e por que **JSON** e não TS

Um comando só, com nome de gente, chamado igual por humano e por CI:
`pnpm fee:build` → `node packages/fee-ingest/src/build.mjs`, que orquestra
compor → validar → escrever artefato → escrever semente.

A semente sai como **JSON** e não como TS porque um gerador que reescreve `seed.ts` **destrói os
comentários curatoriais** que hoje são o único lugar em código onde vivem os verbatims da Shopee
(art. 26839, art. 23431, art. 3305). Ver **RA4** para o que o fatiamento fez com essa migração.

### C.4 Como o job prova idempotência (a armadilha do drift-guard)

Exatamente o mecanismo que o `contract-drift` já usa e que este repositório já pagou para aprender:

```
pnpm fee:build            # 1ª passada: escreve artefato + semente
git diff --exit-code -- backend/app/data/catalog.json apps/web/src/shared/fee-catalog/seed.data.json
                          # (esperado: DIFERENTE quando houve mudança de fonte)
pnpm fee:build            # 2ª passada, sobre a saída da 1ª
git diff --exit-code      # (esperado: VAZIO — senão o gerador não tem ponto fixo)
```

A segunda passada roda **no mesmo job**, antes do `gh pr create`. Um gerador sem ponto fixo abriria um
PR novo todo mês sobre a mesma tabela, e o revisor aprenderia a não olhar — que é o defeito que a
US2 inteira existe para impedir.

### C.5 O que PROÍBE

- Proíbe um coletor com acesso de escrita ao artefato (a migração de `build-amazon.mjs` de *writer*
  para *emissor de fatia* é tarefa da PR-A, não opcional).
- Proíbe editar `seed.data.json` à mão.
- Proíbe uma fatia que declare folha que o coletor não leu.
- **Proíbe remoção sem declaração de exaustividade**, e proíbe declarar exaustividade sobre bloco de
  nível de marketplace (o tipo `SectionKey` não a representa).
- **Proíbe uma fatia exaustiva nascida de uma leitura que não passou canária e piso** — a guarda é
  pré-condição da fatia, não pós-condição do PR.

---

## D. O subconjunto do gate que roda dentro do job (clarify Q6) — **derivado, não curado**

### D.1 Contexto

`GITHUB_TOKEN` não dispara CI (ADR-0010 §A6.5): o PR mensal chega **sem** gate. O dono escolheu
"subconjunto do artefato no job" (Q6a). O risco é o de sempre — o mesmo D4 local↔CI: um subconjunto
escrito à mão **diverge** do `gate:all` no dia em que alguém acrescenta um guarda de artefato e
esquece de acrescentá-lo à lista.

### D.2 Opções

| # | opção | contras decisivos | conf. |
| --- | --- | --- | --- |
| D1 | lista de arquivos de teste no YAML | diverge em silêncio; o YAML não é lido por gate nenhum | 20% |
| D2 | `pnpm gate:all` inteiro no job (~6 min) | é a opção (b) que o dono NÃO escolheu; puxa uv/Postgres/e2e para um job que só valida dado | — |
| D3 | **`pnpm gate:artifact` com membresia DERIVADA** — **ESCOLHIDA** | exige convenção de nome e uma meta-guarda | **84%** |

### D.3 Decisão

- Todo teste que **lê `backend/app/data/catalog.json`** passa a se chamar `*.artifact.test.ts`.
  **Correção por medição do executor (2026-08-07): eram 6 arquivos, não os 3 que eu estimei** — e a
  diferença não foi contagem, foi um defeito. `band-dominance.test.ts` **não lia o artefato** (rodava
  sobre tabelas fabricadas); ao passar a lê-lo, achou e matou um defeito real do comparador, que
  **ignorava `fixedFeeRule`** — a regra `PCT_OF_PRICE` da Shopee entrava na dominância como se o fixo
  fosse constante. É a confirmação prática da tese desta decisão: **membresia derivada de "quem lê o
  artefato" encontra guarda que uma lista curada nunca teria convocado.**
- `pnpm gate:artifact` roda **esse conjunto**, e é **o mesmo script** que o job invoca — paridade por
  invocação idêntica, nunca por meta-teste (SC-206, o mesmo princípio do `gate:all`).
- **Meta-guarda anti-divergência**: um teste afirma que *todo* arquivo que menciona
  `backend/app/data/catalog.json` casa a convenção `*.artifact.test.ts` (ou está numa lista de
  exceções datada). A membresia é **propriedade do arquivo**, não curadoria que alguém precise lembrar.
- **Prova de não-vacuidade por MUTAÇÃO**: envenenar o artefato (comissão fora de faixa, banda
  sobreposta, `catalogVersion` desalinhado do `generatedAt`) tem de **reprovar nos dois** —
  `gate:artifact` e `gate:all`. Subconjunto que passa onde o todo reprova é o defeito que esta
  decisão existe para impedir.
- A mecânica exata do filtro do vitest (`--include` vs `--project` vs diretório) é **verificada na
  implementação** — a configuração de raiz usa `projects: ["packages/*","apps/web"]` e a composição
  dos dois flags não está medida. A propriedade acima é o critério; o flag é detalhe.

### D.4 O que PROÍBE

- Proíbe o job rodar um comando que um humano não consiga rodar igual na máquina dele.
- Proíbe acrescentar guarda de artefato fora da convenção (a meta-guarda reprova).

---

## E. Vigias — Amazon `/precos` (D7) e os quatro do ML: **baseline datado, alerta no MESMO PR, zero caminho para o dinheiro**

### E.1 Forma do baseline (clarify Q1 = arquivo datado versionado)

Um arquivo por FONTE em `packages/fee-ingest/data/`, e a pasta passa a ser **a prateleira de registros
datados do repositório**:

```
packages/fee-ingest/data/
  amazon-precos.baseline.json        # mínimos por categoria + tarifas de plano + a AUTO-DATAÇÃO da página
  ml-frete-<reputacao>.baseline.json # 3 arquivos, 29×8 cada (o E3 herda o insumo — Q1)
  ml-textos.baseline.json            # 3 vigias textuais: doc developers ("Última atualização em"), 50%<12,50, cubagem 6000
  shopee-art26839.baseline.json      # âncoras de TEXTO pinadas + endereços dos PNGs (§F)
```

Forma comum, e ela é a única coisa que os quatro compartilham:

```jsonc
{ "sourceUrl": "…", "collectedAt": "2026-08-07", "selfDatedAs": "20/01/2025" /*|null*/,
  "shape": { "rows": 29, "cols": 8 },      // a guarda de forma, como DADO
  "anchors": ["…verbatim…"],               // strings que TÊM de existir; ausência = ABORT
  "absentAnchors": ["mínimo", "piso"],     // strings que NÃO podem existir (a ausência que o 014 esqueceu de afirmar)
  "values": { … }, "contentHash": "sha256:…" }
```

`absentAnchors` é deliberado e é a lição 014/US4 virada em dado: afirmar presença é fácil, e o defeito
mora na ausência.

### E.2 A separação estrutural que garante o D7

O parser de vigia devolve `WatchReading` — um tipo que **não tem construtor para `FeeEntry`**, e o
módulo **não exporta nenhuma função** que receba `WatchReading` e devolva fatia de catálogo. O robô não
"escolhe" não escrever o `minPerItem`: **não existe a função** que o escreveria. É a mesma família de
prova que a FR-020a usa, e é o que faz o D7 sobreviver a um refactor apressado.

O vigia de `/precos` também confere a tarifa do plano Individual contra a constante que **já é a fonte
do número servido** (`amazon-to-catalog.ts:AMAZON_INDIVIDUAL_PER_ITEM_FEE = 2.0`) — uma discordância
entre a página e a constante é alerta, e o número continua morando num lugar só.

### E.3 Onde o alerta sai — **no MESMO PR mensal, em seção própria**

Opções: (i) PR separado por vigia — cria N rituais mensais e mata a premissa do Adendo A14 ("o PR
mensal é o sinal de vida"); (ii) só no resumo de job — ninguém lê resumo de job de um mês que passou;
(iii) **mesmo PR, seção `## Vigias (nenhum dado alterado)`** — **ESCOLHIDA, 82%**. Um só ritual, e o
diff do baseline viaja junto como evidência do que mudou.

### E.4 "PR de decisão" (clarify Q2), mecanicamente

Não é objeto novo. É o **mesmo PR mensal** com quatro marcas, todas produzidas pelo compositor:

1. título prefixado `DECISÃO — `;
2. rótulo `decisao-do-dono` (`gh pr create --label`);
3. **primeira seção** do corpo, acima de tudo, com: valor da fonte A × valor da fonte B ×
   auto-datação × as duas URLs;
4. **dispensa de revisão forçada a NÃO**, independentemente do classificador.

E o dado **não muda**: o único arquivo tocado pelo desfecho "converge" é o baseline.

### E.5 O que PROÍBE

- Proíbe qualquer função `WatchReading → CatalogSlice`.
- Proíbe um vigia sem `shape`/`anchors` (é o R2 do brief: vigia sem canária degrada para "diff sempre
  vazio" e morre em silêncio — a canária de cada vigia novo é provada por mutação).
- Proíbe o vigia do ML tocar o catálogo servido, hoje e depois (o ML tem 0 entradas; o eixo de frete é
  do E3; ADR-0025 segue **Proposto**).

---

## F. Shopee (D11) — **motor de OCR fixado por lockfile, endereço por BYTES, guardas conjuntivas puras**

### F.1 Onde roda o tesseract — a decisão que ninguém pode deixar implícita

| # | opção | prós | contras | conf. |
| --- | --- | --- | --- | --- |
| F1 | `sudo apt-get install tesseract-ocr` no job | trivial de escrever | **a versão vira função da imagem do runner** (as imagens são atualizadas semanalmente e `tesseract-ocr` **não está na lista documentada de pré-instalados** — verificado 2026-08-07). O número lido passa a depender de quando o mês rodou, e as guardas não conseguem distinguir "a Shopee mudou o PNG" de "o runner mudou o OCR" | 25% |
| F2 | container/action de terceiro com o binário | pinável por SHA | mais uma dependência de terceiro no caminho do dinheiro | 45% |
| F3 | **`tesseract.js` (WASM) como devDependency de `packages/fee-ingest`** — **ESCOLHIDA** | a versão do motor cai sob o **mesmo lockfile** de todo o resto; roda no Node 24 do job sem `apt`; nenhum passo privilegiado | mais lento que o binário nativo (irrelevante a 1×/mês); os dados de idioma são um insumo à parte (abaixo) | **80%** |

**Verificado 2026-08-07** (não assumido): `tesseract.js` está em **7.0.0**, é WASM puro e exige Node ≥ 16
(temos 24). **Pendência de verificação declarada, para a tarefa**: `langPath`/`cachePath` controlam a
origem do `por.traineddata`, e a documentação **não afirma** que `langPath` aceite caminho local. A
PROPRIEDADE exigida é: **o traineddata é um insumo FIXADO e conferido por hash, que não varia entre
execuções**. Se `langPath` local funcionar, ele é versionado em `packages/fee-ingest/data/`; se não,
é baixado da URL fixada e o **SHA-256 é conferido antes do uso**, abortando se divergir. Um OCR cujo
dicionário muda sozinho não é determinístico o suficiente para dinheiro.

### F.2 O detector content-addressed — o endereço é o **hash dos bytes**

- **Identidade = `sha256(bytes)` do PNG.** A URL é **procedência**, não identidade.
- URL nova + bytes iguais (re-upload) ⇒ baseline atualiza a URL, **OCR não roda**, e o relatório diz
  "re-upload sem mudança de conteúdo" (é o edge case explícito da spec).
- URL igual + bytes diferentes ⇒ **tabela nova**, OCR roda.
- Conjunto de hashes inalterado ⇒ **0 tokens, 0 OCR** — o caminho comum de 11 meses por ano.

### F.3 As guardas de falha ALTA, como código

Uma função pura, conjuntiva, no estilo de `guardrails.ts` (sob o ratchet de 100%):

```ts
avaliarOcr(leitura, { anchors, absentAnchors, anterior }): SanityVerdict
// TODAS têm de passar:
//  1. FORMA      — nº de faixas esperado; toda célula parseável em formato BR (vírgula decimal)
//  2. SANIDADE   — comissão em [5, 25] %
//  3. NÃO-CONTRADIÇÃO — as âncoras de TEXTO do art. 26839 (as únicas verdades verbatim):
//                  a frase do CNPJ < R$ 8 ("o adicional por item é a metade do preço do produto"),
//                  a do +R$ 3 (CPF > 450 pedidos/90 dias), os dois pontos regressivos
//                  (R$ 10 → R$ 6,50; R$ 8 → R$ 6,00) e a AUSÊNCIA de "mínimo/piso" (0 hoje)
//  4. COBERTURA  — `checkBandCoverage` (já existe)
// Qualquer reprovada ⇒ ABORT, sem PR, artefato intocado.
```

As âncoras vêm do **baseline** (§E.1), não de literais espalhadas: um copyedit da Shopee se conserta
re-pinando um arquivo de dado, e o runbook ensina isso.

**Não-vacuidade por mutação** (US5/AC4, portão da fatia PR-C): um PNG com **um dígito trocado mantendo
o valor plausível** tem de ser pego por ≥ 1 guarda em 100% das rodadas.

### F.4 Guardas verdes + divergência GRANDE (clarify Q8)

Um limiar **declarado como constante com a razão escrita**, no estilo de `CHANGED_ROWS_CEILING`:
`OCR_DIVERGENCE_BANNER` (proposta para o dono ratificar no plan: qualquer folha de dinheiro movendo
> 30% relativo **ou** > R$ 5,00 absoluto). Acima dele: **PR normal**, dispensa NUNCA, e um **banner no
topo** com valor lido × valor anterior × link da imagem. Abortar suprimiria de uma vez o erro plausível
**e** a mudança real grande — e sem PR ninguém abre imagem nenhuma.

**Medição desconfortável, e ela precisa estar escrita**: o teto de mudança em bloco de `refresh.ts`
**não protege a Shopee**. `CEILING_MIN_ENTRIES = 10` e a Shopee tem **2 entradas** — o teto é inerte
justamente no único marketplace cujo extrator não é determinístico. As guardas do §F.3 e o banner do
§F.4 são, ali, a defesa inteira antes do humano.

### F.5 O que PROÍBE

- Proíbe `apt-get install` de motor de OCR.
- Proíbe OCR sem sinal do detector (custo e ruído, e some a propriedade "0 tokens no caminho comum").
- Proíbe dispensa de revisão em qualquer PR que carregue folha vinda de OCR.
- Proíbe o coletor Shopee tocar `freight`, `freightSubsidyInfo` ou `optionalSurcharges` — regra da
  folha lida (§C.2) **e** o tipo `SectionKey` (§C.2-bis), que nem representa exaustividade sobre eles.
  É o que impede a reversão do hotfix A2, por duas fechaduras.

---

## G. Mês perdido (clarify Q7) — o `ci.yml` mede a **idade do DADO**, não a idade do run

### G.1 Opções

| # | opção | contras | conf. |
| --- | --- | --- | --- |
| G1 | job que consulta o histórico de runs (`gh run list -w fee-refresh.yml`) | precisa de token e de rede; **e mente no caso que mais importa**: um mês em que o laço rodou e **abortou** aparece como "rodou há 2 dias" e o alarme dorme | 45% |
| G2 | issue mensal automática | cria um segundo ritual e outro lugar para ignorar | 35% |
| G3 | **job não-bloqueante lendo o artefato commitado** — **ESCOLHIDA** | não distingue "laço parado" de "laço rodando e abortando" — mas isso é uma VIRTUDE aqui: os dois são o mesmo dano | **83%** |

### G.2 Decisão

Job `loop-liveness` no `ci.yml`, **sem segredo, sem rede, sem API**: lê
`backend/app/data/catalog.json`, calcula `hoje − max(lastReviewed)` **restrito aos marketplaces que a
tabela `MARKETPLACE_COVERAGE` declara cobertos** (a mesma tabela do §A — uma lista, um lugar, o
espírito do U4-f), e:

- `> 35 dias` ⇒ `::warning::` + linha no *step summary*, **`exit 0`** (a clarify pediu não-bloqueante);
- nunca coletado / cobertura vazia ⇒ mensagem **diferente**, nomeando o caso (não é o mesmo fato).

**Por que 35**: `LOOP_CYCLE_DAYS (31) + folga de fila (4)`, somado no código como o `31 + 14` do
Adendo A14 — e, decisivo, **35 < 45**: o dono precisa ser avisado **antes** que o selo fale com o
vendedor. Fora do `ci-pass` (`needs`), para não virar portão de merge de quem não tem nada a ver.

### G.3 O que PROÍBE

- Proíbe segredo novo, `gh api` e qualquer dependência de rede nessa checagem.
- Proíbe entrar na lista de `needs` do `ci-pass`.

---

## H. Fronteiras de pacote — o que entra em `fee-ingest`, em `scripts/` e em `.github/`

| lugar | o que ENTRA | o que NÃO entra |
| --- | --- | --- |
| `packages/fee-ingest/src/` | **toda decisão**: parsers, guardas, vereditos, composição, projeção da semente, gerador do corpo do PR, classificador de dispensa, avaliador de OCR; os CLIs `.mjs` (isentos de cobertura **de propósito** — por isso nenhuma regra de dinheiro pode morar neles) | qualquer import de `apps/` ou `backend/` (barrado por `fee-ingest-is-standalone`, severity `error`) |
| `packages/fee-ingest/data/` | baselines datados, âncoras verbatim, endereços dos PNGs, traineddata (se local) | valor servido ao usuário (isso é `backend/app/data/catalog.json`) |
| `.github/workflows/fee-refresh.yml` | orquestração pura: `checkout`, setup, `node …mjs`, upload de artefato, `gh pr create` | condicional que decida conteúdo de relatório ou de dinheiro; `secrets.` além de `GITHUB_TOKEN` |
| `.github/workflows/ci.yml` | o job `loop-liveness` (§G) | qualquer coisa do laço mensal |
| `scripts/` | **nada novo**. E as 4 sondas de 2026-07 (`probes/g1…g3`, `ml-oauth`) + `g1-probe-ml.yml`/`g2-probe-amazon.yml` são **apagadas na PR-A** — o ADR-0010 §A13 já as declara descartáveis e a medição delas está preservada no próprio ADR | — |

**Por que apagar as sondas é estrutural e não faxina**: `g1-probe-ml.yml:47` referencia
`secrets.ML_ACCESS_TOKEN` — medido hoje. Enquanto ele existir, "nenhuma credencial do ML neste
incremento" é verdade sobre um arquivo, não sobre o repositório, e o teste do §I.2 tem de conviver com
uma exceção. Apagando, a afirmação vira **repo-wide**.

O `import-linter` do backend fica intocado (o 017 não escreve Python). O artefato continua morando em
`backend/app/data/` por decisão de contexto de build do ADR-0010 (Adendo 2026-07-07).

---

## I. A dispensa de revisão — escopo por **conjunto de arquivos**, e ela nasce DESLIGADA

### I.1 O buraco que o segundo marketplace abre (achado desta análise)

`mayAutoMerge(diff)` decide olhando **só o diff do catálogo**. A partir do 017 o PR mensal também
carrega **baselines de vigia**. Um mês em que só um baseline mude produz diff de catálogo vazio ⇒
`freshnessOnly === true` ⇒ **dispensa concedida**, e um arquivo que ninguém revisou entraria sozinho.

**Decisão**: a dispensa passa a exigir **as duas condições**: (a) diff do catálogo exclusivamente
inerte **E** (b) conjunto de arquivos do PR ⊆ `{backend/app/data/catalog.json,
apps/web/src/shared/fee-catalog/seed.data.json}`. Falha fechado nos dois eixos. (Remoção nunca é
inerte — `mayAutoMerge` já a nega pelas listas `removedEntries`/`removedCategories`.)

### I.2 O resto

- **Uma lista de campos inertes, um lugar** — `INERT` de `refresh.ts:37` e `INERT_PATHS` de
  `catalog-diff.ts:10` colapsam num módulo só, lido também pela tabela do corpo do PR (fecha o U4-f).
- **Nasce desligada** (clarify Q5): `ALLOW_FRESHNESS_EXEMPTION` como *input*/variável do workflow com
  padrão `false`, e o corpo do PR **imprime** que ela está desligada e por quê (P0-b, tarefa do dono).
  Um interruptor silencioso é um interruptor que ninguém sabe que existe.
- **Teste estrutural de segredos** (FR-1003/SC-1005): em `packages/fee-ingest/src/workflow-audit.test.ts`,
  lendo `.github/workflows/` por `fs` (leitura, não import — a fronteira do §H fala de imports).
  Duas asserções: zero `secrets.` em `fee-refresh.yml` além de `GITHUB_TOKEN`, e **zero `secrets.ML_*`
  em qualquer workflow do repositório**.
- **Execução dupla no mesmo dia** (edge case): branch determinística (`bot/fee-refresh-<data>`) +
  o padrão idempotente que o `auto-pr.yml` já exerce (`gh pr list --head … --state open` antes de
  criar). Mesmo artefato ⇒ mesmo diff ⇒ nenhum PR duplicado.

---

## J. Executar, não listar — as provas que a fatia deve carregar

Herdadas de defeitos que este projeto já pagou, e são requisitos de tarefa, não estilo:

1. **Todo `.mjs` novo é BOOTADO sob `node` puro** dentro do próprio job (o `vitest` é o resolvedor
   tolerante que escondeu três imports sem extensão no 014/US4).
2. **Toda fatia fecha com execução real**, com URL da run (US1/AC6 · SC-1001).
3. **O corpo do PR é testado por AUSÊNCIA** — execução sem mudança ⇒ zero seções de mudança; execução
   **com remoção** ⇒ ausência de "Sem mudança de tarifa nesta leitura" (§C.2-bis).
4. **Cada canária nova é provada por mutação** (R2 do brief).
5. **Tempo e minutos faturados medidos** na evidência (US3/AC5).
6. **`scripts/check-action-pins.sh` imprime "os 5 workflows parseiam"** — número **cravado**, medido
   hoje. Com `fee-refresh.yml` serão 6 (e menos, se as sondas forem apagadas) e a linha passará a
   mentir. Corrigir para contagem calculada na mesma fatia.

---

## O que este desenho PROÍBE

1. **Coletor que escreve o artefato.** Só a composição escreve, e só depois de validar.
2. **Coletor que reescreve folha que não leu.** É o que reverteria o hotfix A2.
3. **Remoção sem exaustividade declarada** — e **exaustividade sobre bloco de nível de marketplace**,
   que o tipo `SectionKey` nem representa.
4. **Fatia exaustiva vinda de leitura que não passou canária + piso de linhas.**
5. **Mais de um bump de `catalogVersion` por execução**, e qualquer bump fora de `nextCatalogVersion`.
6. **Literal de `catalogVersion` em teste** — a paridade é relacional ou não é guarda.
7. **Semente editada à mão**; e semente que divirja da projeção declarada.
8. **Lógica em YAML**: nada que decida dinheiro ou texto de relatório mora fora de TypeScript testado.
9. **`secrets.` além de `GITHUB_TOKEN`** em `fee-refresh.yml`, e `secrets.ML_*` em qualquer workflow.
10. **Runner self-hosted**, provisionamento GCP, escrita em datastore, auto-merge de dinheiro.
11. **Qualquer função que leve leitura de vigia a folha de catálogo.**
12. **`apt-get install` de motor de OCR**, e OCR com dicionário não fixado/não conferido.
13. **Dispensa de revisão** sobre PR que toque arquivo fora do par artefato+semente, sobre folha vinda
    de OCR, ou sobre qualquer remoção — e ela nasce desligada enquanto não houver ruleset.
14. **Vigia sem canária de forma**, e canária que ninguém provou por mutação.
15. **Marketplace calado no relatório**: sem veredito ⇒ NÃO LIDO com motivo, nunca omissão.
16. **`continue-on-error` como mecanismo de independência entre coletores.**

---

## Riscos aceitos com medição

| # | risco | medição | por que é aceito | onde é reaberto |
| --- | --- | --- | --- | --- |
| **RA1** | **O laço não dispara sozinho** | `schedule` roda do branch DEFAULT (`main`); corte de release adiado até a v1 | teto honesto do incremento, declarado no cabeçalho do YAML, no runbook e na spec | no corte de release; o §G avisa a cada 35 dias |
| **RA2** | **OCR plausível e errado** | guardas pegam ~85% de deslocamento de coluna, ~60% de dígito aleatório, **~35% de erro plausível de célula única** (PO) | D11 é decisão do dono; o portão real é o humano, e a AC5 é o que o torna possível | se um PR mensal passar um número errado |
| **RA3** | **Teto de bloco INERTE na Shopee** | `CEILING_MIN_ENTRIES = 10` × 2 entradas Shopee | o teto existe para tabela grande; ali a defesa é §F.3 + §F.4 | quando a Shopee passar de 10 entradas |
| **RA4** | **Verbatins curatoriais na migração da semente** | **corrigido pelo fatiamento**: os verbatins ficam como **prosa datada em `seed.ts`** na PR-A, e as **âncoras executáveis** só nascem na **PR-C/T026** | há uma janela (PR-A→PR-C) em que o verbatim é prosa e não guarda — aceitável porque a Shopee ainda não está no laço nessas fatias | se a PR-C for adiada, a migração para `data/` vira dívida nomeada, não silêncio |
| **RA5** | **Bloqueio de bot / mudança de layout** | G2 PASS medido 2× (28/07 e 05/08) | consequência é **parada**, nunca corrupção (I2): ABORT com status + DOM como artefato | a cada ABORT |
| **RA6** | **Falso positivo do vigia de texto** | âncoras são strings verbatim | ABORT ruidoso > vigia mudo; re-pinar é editar um dado | se a frequência incomodar |
| **RA7** | **`gate:artifact` divergir do `gate:all`** | risco D4 de sempre | membresia derivada + meta-guarda + mutação nos dois | se a meta-guarda ganhar exceção, ela é datada |
| **RA8** | **Remoção legítima que na verdade era leitura encolhida** | com `MIN_PARSE_ROWS = 28` sobre 38 categorias: no máximo **10 categorias / 20 entradas (≈26%)** podem sumir passando o piso — abaixo do teto de 50% | toda remoção é NOMEADA no corpo, nunca dispensável, e o merge é do dono; um mês de fonte encolhida custa uma revisão atenta, não um valor errado | se uma remoção indevida chegar ao merge, o piso sobe (28 é folgado) ou a remoção vira opção (c) |

---

## ADRs propostos (o `/speckit-plan` escreve; aqui só a tese)

- **ADR-0028 — O laço mensal de tarifas: coletor emite fatia, a composição publica.** Topologia A3,
  regra da folha lida, **exaustividade declarada (§C.2-bis, emenda de 2026-08-07)**, `RunOutcome` de
  2 casos, um bump por execução, PR parcial como consequência de tipo. *Proposto — emendar antes do
  flip no gate.*
- **ADR-0029 — A semente como projeção gerada do artefato servido.** Fecha o P0-a com guarda
  relacional, torna a poda uma política declarada, acorda o ramo de cache do U5-b com teste, e traz o
  drift-guard de idempotência para o dado de dinheiro. *Proposto.*
- **ADR-0030 — OCR admissível para dinheiro: motor fixado por lockfile, endereço por bytes, guardas
  conjuntivas e o portão humano.** Registra o D11 com a quantificação honesta do R3 e o limiar do
  banner. *Proposto.*
- **ADR-0025 permanece Proposto** (adiado com a parte ML — dono, 2026-08-05). O 017 não o move.

---

## Conflitos entre as fontes (apontados, não resolvidos por mim)

1. **P0-a: as coordenadas do brief e da spec estão vencidas.** Ambos citam
   `fee-catalog.test.ts:62-66` e `"2026-08-06.1"`; **medido**: linhas **63-71** e `"2026-08-07.0"` —
   o hotfix A2/A3 reeditou a literal. O defeito é o mesmo e ficou **mais forte**.
2. **"Paridade estrita semente↔artefato" (clarify Q3) × a semente medida.** Amazon tem 78 entradas no
   artefato e **0** na semente (poda deliberada, orçamento SC-810). "Paridade estrita" só pode
   significar **paridade da PROJEÇÃO** (§B.3).
3. **Q7: "falha" × "não-bloqueante".** O enunciado da tarefa diz "job que **falha**"; a spec diz
   **não-bloqueante**. Segui a spec (`::warning::`, `exit 0`, fora do `ci-pass`).
4. **Q7: "último run do laço" × o que é mensurável sem mentira.** Histórico de runs não vê o mês que
   rodou e abortou. Medi a **idade do dado** (§G) — reinterpretação do MEIO, não do fim.
5. **"Nenhuma credencial ML neste incremento" × o repositório de hoje.** `g1-probe-ml.yml:47` consome
   `secrets.ML_ACCESS_TOKEN`; a restrição só vira repo-wide apagando as sondas descartáveis (§H).
6. **P0-c está parcialmente FECHADO e o registro não diz.** `sha_pinning_required` já existe e roda; o
   `trufflehog` já está pinado (`ci.yml:153`). Restam `allowed_actions` (config do dono) e o §A6.5(iii),
   atendido pelo §D.
7. **`OBTENCAO-DINAMICA-DADOS.md` §8 está desatualizado sobre a Shopee** ("<R$ 8 = 50% sem fixo"): o
   T057 provou que os 20% continuam incidindo. As âncoras vêm do **T057**, nunca daquele parágrafo.
8. **`decideRefresh` não conta remoções no teto de bloco** (medido: `changed = materialEntries`,
   enquanto `removedEntries` vive fora do numerador). Emendado no §C.2-bis regra 4 — é pré-requisito
   do T014, não melhoria opcional.
