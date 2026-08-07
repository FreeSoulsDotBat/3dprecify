# 017 — Scope brief: a ingestão mensal de tarifas (o laço que existe e é disparável)

**Status**: rascunho de escopo de produto (entrada do `/speckit-specify`) · **Autor**: product-owner · **Data**: 2026-08-07
**Branch prevista**: `017-ingestao-mensal` (cortada de `develop`)
**Origem**: autorização do dono (2026-08-07, "pretendo abrir outro workflow para pesquisarmos como podemos ter
todos esses dados dinamicamente") sobre `docs/homologacao/OBTENCAO-DINAMICA-DADOS.md` (plano por dado + as 7
decisões de 2026-08-05), `docs/adr/0010-marketplace-fee-catalog-architecture.md` §A10/§A13 (arquitetura CI-first
já decidida e MEDIDA) e os resíduos declarados de `specs/014-fee-category-mapping/tasks.md`.

> **Este brief especifica COMPORTAMENTO, não arquitetura nem pixels.** A forma do YAML, o desenho do parser, o
> mecanismo de OCR e o lugar do baseline são chamada do `arquiteto` / `devops` / `dev-estrutura-de-dados` na
> rodada seguinte (Princípio VIII).
> **Nenhuma decisão do dono é reaberta aqui** (QA1 `develop` · QA5 mensal dia 1 06:00 UTC · D7 vigia · D11 OCR no
> loop · SC-811 0 tokens de LLM · runner hospedado, self-hosted REJEITADO). Onde eu discordo, está na §8.
> **Nenhum número de tarifa é inventado** (Constituição II): todo valor citado carrega a medição de origem.

---

## 1. Visão

Hoje todo número de tarifa que o produto serve entrou no repositório pela mão de alguém, e sai de validade sem
que ninguém seja avisado — o único alarme é o selo de 45 dias, que fala com o **vendedor**, tarde. O 017 constrói
o laço que relê as fontes públicas, compara com o catálogo servido e **abre um PR para `develop` com um relatório
honesto do que mudou e do que não foi lido** — sem nenhuma credencial nova, sem nenhum token de LLM (SC-811) e
sem nenhum caminho que escreva dinheiro sem um humano no meio. O que ele entrega é o laço **pronto e disparável**.

**O que ele explicitamente NÃO promete:** ele **não dispara sozinho** enquanto o corte de release estiver adiado —
o `schedule` do GitHub roda a partir da branch DEFAULT (`main`) e o arquivo só existirá em `develop` (ADR-0010
§A6.1); o gatilho prático de 2026 é `workflow_dispatch`. Ele **não traz número nenhum do Mercado Livre** (sem o
token da casa não existe caminho público — 302 no servidor e 403 anônimo, ambos MEDIDOS): para o ML ele entrega
**vigias de texto**, não dados. E ele **não publica** nada por conta própria: mudança de tarifa continua chegando
ao usuário por merge do dono + deploy do backend (R6=(a), inalterado).

---

## 2. Restrições dadas (não reabrir)

| # | restrição | origem |
| --- | --- | --- |
| C1 | **US6-ML fora**: nenhuma credencial, nenhum segredo novo, nenhuma chamada a `listing_prices` | parecer `seguranca` (8 condições) + autorização separada do dono, ainda não dada |
| C2 | Runner **hospedado**; self-hosted **REJEITADO**; nada de provisionamento GCP (adiado até v1) | ADR-0010 §A13 (G1 PASS aposentou o geo-gate; QA4 extinta) |
| C3 | PR mensal mira **`develop`**, mensal, **dia 1 às 06:00 UTC**, **nunca** auto-merge de dinheiro | QA1 = (a) · QA5 = (a), dono 2026-07-28 |
| C4 | **0 tokens de LLM** — parsing determinístico; tesseract conta como 0 tokens LLM; nenhuma linha em `docs/token-ledger.md` gerada pelo laço | SC-811 · ADR-0010 §A11 |
| C5 | Toda folha de dinheiro carrega `source`/`sourceUrl`/`effectiveDate`/`lastReviewed`; `lastReviewed` avança **só por releitura real** | Constituição II · SC-807/SC-910 (varredura T073: 80 entradas, 0 problemas) |
| C6 | **Fail-safe**: leitura que falhou não é "as taxas caíram" — sem PR, artefato byte a byte intocado, alerta | SC-806 · ADR-0010 §A2 |
| C7 | Amazon `minPerItem` continua **R$ 1,00** + vigia; nada muda por decisão do robô | D7, dono 2026-08-05 |
| C8 | Shopee: **OCR no loop** com guardas de falha ALTA (forma, sanidade 5–25%, conferência contra as âncoras de TEXTO do art. 26839) | D11, dono 2026-08-05 (contra a recomendação alert-then-curate) |

---

## 3. Precondições medidas (P0 — não são "conserto", são o que quebra na primeira execução real)

- **P0-a · O guarda do catálogo crava a versão em string literal.** `apps/web/src/shared/fee-catalog/fee-catalog.test.ts:62-66`
  afirma `served.catalogVersion === "2026-08-06.1"` e `FEE_CATALOG_SEED.catalogVersion === served.catalogVersion`.
  O laço bumpa `catalogVersion` no artefato e **não** regenera a semente → **o primeiro PR mensal nasce vermelho no
  `gate:all`**, por construção, com o dado correto. Era guarda deliberado do 016 ("bumpou UMA vez"); precisa virar
  **relacional** antes do laço existir. MEDIDO hoje, não hipótese.
- **P0-b · `develop` não tem proteção nem ruleset** (014/T048a, medido: 404 + `[]`). Sem isso, a dispensa de revisão
  do `lastReviewed` (ADR-0010 §A15) não é exceção a portão nenhum — ela é o **único** portão. Tarefa **do dono**
  (configuração do repositório), no mesmo lugar que a T002 do 012 ocupou.
- **P0-c · As 8 condições do parecer de segurança que valem SEM credencial** (014/T069b): `allowed_actions`,
  `sha_pinning_required`, `trufflehog` pinado, e o §A6.5(iii) — CI independente sobre o PR mensal, já que um PR
  aberto com `GITHUB_TOKEN` **não dispara workflow**. As condições restantes (segredo em Environment, job sem
  dependências) só nascem com o ML e ficam fora.

---

## 4. User stories priorizadas

> Toda AC abaixo é verificável por execução ou por teste. "O laço funciona" não é critério; "esta execução
> produziu este PR / esta abortagem nomeada" é.

### P1 — sem isto o incremento não existe

#### US1 — O laço existe como workflow e o dono consegue dispará-lo
*Como dono, quero um workflow que eu possa disparar à mão e que, quando o corte de release acontecer, passe a
rodar sozinho — sem que eu precise lembrar dele todo mês.*

- **AC1** `.github/workflows/fee-refresh.yml` existe com `schedule` (dia 1, 06:00 UTC) **e** `workflow_dispatch`, e
  o cabeçalho do arquivo declara, em texto, que **enquanto ele não chegar em `main` por um corte de release o laço
  NÃO dispara sozinho** (ADR-0010 §A6.1). Um leitor do arquivo não pode sair achando que o laço está vivo.
- **AC2** Os jobs são **independentes por marketplace**: a falha de um não impede o outro (FR-022), e isso é provado
  por uma execução real em que um coletor aborta e o outro conclui.
- **AC3** O PR mira **`develop`** e o job **nunca** faz merge de dinheiro. A dispensa de revisão só se aplica a um
  diff **exclusivamente** `lastReviewed` (classificador já existente, falha fechado) e nasce **desligada** enquanto
  P0-b não estiver satisfeita.
- **AC4** O job **valida o artefato candidato antes de abrir o PR** (§A6.5(i)): schema Zod, cobertura de bandas,
  colisão de `categoryId`, **a propriedade de dominância de banda** (`packages/pricing-core/tests/band-dominance.test.ts`
  — "o anúncio publicado é o mais barato que entrega a base") e a paridade semente↔artefato. Um artefato que não
  passa **não vira PR**.
- **AC5** O workflow contém **zero** referência a `secrets.` além do `GITHUB_TOKEN` — e isso é afirmado por teste,
  não por revisão (C1 estrutural: a credencial não pode entrar de carona numa próxima fatia).
- **AC6** Evidência de aceitação = **uma execução real disparada à mão**, com URL da run, que termine em PR ou em
  abortagem nomeada. Sem execução real, a US não fecha (lição 014/US4: suíte verde não prova programa que roda).

#### US2 — O relatório mensal não mente
*Como revisor de um PR de dinheiro, quero um corpo de PR em que a ausência de mudança seja tão explícita quanto a
presença — e que diga o que NÃO foi lido.*

- **AC1** Execução sem mudança: o corpo **não contém** as seções de mudança (nenhuma "Mudanças de tarifa",
  "Categorias removidas", "Categorias novas") — e o teste afirma **ausência**, não presença. *(É o defeito exato do
  014/US4: o corpo imprimia "Sem mudança de tarifa" diretamente acima de "Categorias removidas da fonte", e todo
  teste afirmava que uma string estava presente.)*
- **AC2** Execução com mudança: cada folha de dinheiro alterada aparece como `old → new`, por categoria, com
  `sourceUrl` e data de coleta.
- **AC3** O corpo declara, **por marketplace**, um de três estados: **LIDO** (com a data), **ABORTADO** (com o motivo
  nomeado) ou **NÃO LIDO** (com o porquê — ex.: "Mercado Livre: sem credencial, fora do escopo do 017"). Um PR
  intitulado "atualização mensal de tarifas" que cobre um marketplace e cala sobre os outros é um relatório falso.
- **AC4** A tabela do PR e o classificador de dispensa leem **a mesma** lista de campos inertes — um campo não pode
  sumir da tabela e continuar bloqueando o merge (absorve 014/U4-f, hoje duplicado entre `refresh.ts:37` e
  `catalog-diff.ts:10`; inofensivo com um marketplace, vivo com dois).

#### US3 — A Amazon relê a própria tabela dentro do CI
*Como dono, quero que a tabela de 38 categorias da Amazon seja relida por um robô no runner, e não pela minha
máquina quando eu lembro.*

- **AC1** O coletor existente (`packages/fee-ingest/src/build-amazon.mjs`, browser headless, sem credencial — G2
  MEDIDO em 2026-07-28 e reconfirmado em 05/08) roda no runner **hospedado**, com o navegador instalado em versão
  **pinada**, e conclui com PR ou com ABORT nomeado.
- **AC2** Bloqueio de bot, CAPTCHA ou mudança de layout produzem **ABORT com o status HTTP e o motivo**, nunca uma
  mudança de tarifa; as canárias (Roupas 14%, Calçados 14%, Relógios 13%), o piso de linhas e a coluna localizada
  **por cabeçalho** continuam valendo.
- **AC3** Toda execução — sucesso ou falha — sobe como artefato da run **as linhas capturadas**, para que um mês
  quebrado seja diagnosticável sem reexecutar contra a fonte.
- **AC4** `lastReviewed` avança **só** quando a página foi realmente relida (regra `collectedAtFor`, já existente);
  uma execução a partir de fixture nunca carimba a data de hoje.
- **AC5** Tempo e minutos faturados da execução ficam **medidos** na evidência (a premissa de custo do ADR-0010 §A4
  é ~5 min/mês; medir é barato e a premissa é do dono).

### P2 — o que o laço passa a vigiar

#### US4 — O vigia da `/precos` (fecha a metade aberta do D7)
*Como dono, decidi manter R$ 1,00 e vigiar; quero saber no mês em que as duas fontes oficiais da Amazon deixarem de
divergir — ou em que o piso mudar.*

- **AC1** Fetch simples (sem navegador — MEDIDO: HTTP 200, 647KB) de `venda.amazon.com.br/precos`, com parser
  determinístico que captura **a comissão mínima por categoria** e **as tarifas de plano** (Individual R$ 2,00/item;
  Profissional R$ 19/mês).
- **AC2** O laço **nunca escreve** `minPerItem` a partir da `/precos` (D7). Ele **reporta divergência**: as ~11
  categorias em que a `/precos` imprime R$ 2,00 contra o R$ 1,00 uniforme da G200336920, e qualquer mudança de
  qualquer um dos dois lados contra o mês anterior.
- **AC3** O relatório imprime a **auto-datação** da página ("comissões atualizadas em 20/01/2025") junto do valor —
  é ela que classifica a fonte como *vintage* e o revisor precisa dela na mesma tela.
- **AC4** Quando as duas fontes **convergirem** (ambas 2,00, ou a G200336920 mudar), o PR é marcado como **pedido de
  decisão do dono** e não altera dado nenhum (o desfecho exato é a Q2 do §7).
- **AC5** Uma mudança na tarifa do plano Individual (hoje `fixedFee` 2,00 em 39 entradas, verbatim relido em
  2026-08-06) dispara a mesma seção de divergência.

#### US5 — Shopee: detector determinístico + OCR com as guardas decididas (D11)
*Como dono, escolhi OCR no loop; quero que um número mal lido falhe ALTO em vez de entrar calado no preço.*

- **AC1 (detector, 0 tokens)** As URLs dos PNGs públicos do art. 26839 são coletadas e **content-addressed**: URL nova
  ou bytes novos = "tabela nova". Sem sinal de mudança, o OCR **não roda**.
- **AC2 (texto)** O artigo é lido com navegador headless (SPA; `networkidle` nunca chega — espera por conteúdo,
  MEDIDO em T057) e diffado como texto, com **âncoras pinadas**: a frase do CNPJ < R$ 8 ("o adicional por item é a
  metade do preço do produto"), a do +R$ 3 (CPF > 450 pedidos/90 dias), os dois pontos regressivos (R$ 10 → R$ 6,50;
  R$ 8 → R$ 6,00) e a **ausência** de qualquer "mínimo/piso" (0 ocorrências hoje). Âncora que sumiu é ABORT.
- **AC3 (guardas do OCR — todas, conjuntivas)** O resultado só é aceito se: passar a **asserção de forma** (número
  esperado de faixas; toda célula parseável como número em formato BR); cair na **faixa de sanidade 5–25%** de
  comissão; **não contradizer** nenhuma âncora de TEXTO; e passar `checkBandCoverage`. Qualquer guarda reprovada =
  **ABORT, sem PR, artefato intocado**.
- **AC4 (prova de não-vacuidade)** Um PNG deliberadamente corrompido (um dígito trocado de forma que o valor
  continue plausível) é capturado por pelo menos uma guarda — **provado por mutação**, não afirmado.
- **AC5** Mesmo com todas as guardas verdes, o diff toca dinheiro ⇒ **nunca** dispensa revisão. O corpo do PR
  imprime os valores lidos **ao lado dos anteriores e do link da imagem**, para que a conferência humana seja
  possível (sem isso o revisor não tem como revisar um OCR).
- **AC6** A regressiva CPF < R$ 12 continua **não modelada** (D12 — o aviso honesto do 016 permanece); o vigia
  apenas avisa se a Shopee publicar a fórmula.

#### US6 — Mercado Livre sem credencial: vigiar o que é público, escrever nada
*Como dono, não vou entregar o token agora; quero mesmo assim saber no mês em que a regra do ML mudar.*

- **AC1** Três vigias **puramente textuais**, com `sourceUrl` e data: (a) a doc de developers do custo fixo/comissão
  (estática, curl com UA de browser → 200 MEDIDO), incluindo a linha "Última atualização em"; (b) a página de
  vendedores que ainda publica a regra dos 50% abaixo de R$ 12,50; (c) a sentinela da **cubagem** (divisor 6000,
  regex sobre o texto oficial).
- **AC2** As três tabelas de frete por reputação (ajuda/40538, /40545, /40547) são relidas com o parser
  determinístico já validado (3 × 29 × 8 = 696 células, 0 divergências na medição de 2026-08-05) e comparadas com um
  **baseline datado**; a guarda de forma **29 linhas × 8 colunas** e o limiar de R$ 79 nos cabeçalhos são
  obrigatórios.
- **AC3** **Nenhum** desses vigias escreve no catálogo servido. O ML tem **0 entradas** hoje; o eixo de frete é do
  E3 e o custo fixo pós-reforma depende do schema do D10, que não pode ser preenchido sem o token. A saída é
  **alerta + baseline atualizado** (onde mora o baseline é a Q1 do §7).
- **AC4** O relatório diz, com todas as letras, que o ML está **NÃO LIDO** quanto a comissão por categoria e valores
  de custo fixo, e por quê — para que ninguém leia "ML vigiado" como "ML atualizado".

#### US7 — As datas do catálogo dizem a verdade sobre o que foi relido
*Como vendedor, quero que "atualizado em" signifique que alguém realmente olhou a fonte.*

- **AC1** Uma execução sem mudança de valor **avança `lastReviewed` apenas nas entradas dos marketplaces
  efetivamente coletados naquela execução**. Um marketplace que abortou, ou que o laço não lê, mantém a data antiga
  — e portanto **envelhece até o selo de 45 dias falar com o vendedor**, que é o comportamento desejado, não um bug.
- **AC2** A paridade semente↔artefato vira **relacional** (P0-a): o guarda passa a afirmar a relação entre os dois
  documentos, e não uma string de versão fixada à mão; o `catalogVersion` continua decidido por `nextCatalogVersion`
  e nunca à mão.
- **AC3** Se a semente passar a ser regenerada pelo laço, o ramo de cache de `adoptCatalog` entra em uso pela
  primeira vez (014/U5-b, latente) e ganha teste; se a semente continuar podada, isso é declarado no relatório.
- **AC4** Nenhum caminho do laço grava `lastReviewed` sem releitura (SC-807 reforçada, não enfraquecida), e a
  execução **não** gera linha em `docs/token-ledger.md` (SC-811, verificado).

### P3 — o que faz o laço ser operável por um humano

#### US8 — Runbook e recibo da execução
- **AC1** `docs/runbooks/fee-refresh.md`: como disparar à mão, como ler o resumo, o que significa vermelho, o que
  fazer quando o OCR aborta, como reexecutar, e a frase explícita de que **até o corte de release o laço é manual**.
- **AC2** Cada execução escreve um **resumo de job** (GitHub step summary) com o estado por marketplace
  (LIDO / ABORTADO / NÃO LIDO) e o link da fonte — o dono lê liveness em 30 segundos, sem abrir logs.
- **AC3** O runbook nomeia o que o 017 **não** cobre e quem herda (ML com token → fatia gateada; frete → E3).

---

## 5. Fatiamento em PRs (ordem é carregada, não estética)

| PR | conteúdo | por que nesta posição |
| --- | --- | --- |
| **PR-A** | P0-a + P0-c + **US1 + US2 + US3** | É a única fatia que transforma "lógica testada" em "laço que roda". P0-a antes de tudo porque o primeiro PR mensal nasceria vermelho sem ela. US2 junto de US1 porque um relatório desonesto não é um defeito de acabamento — é o produto inteiro do laço. Fecha com uma **execução real** (AC6). P0-b é tarefa **do dono**, em paralelo. |
| **PR-B** | **US4 + US7** | Mesma runtime, nenhuma tecnologia nova, e fecha a metade aberta do D7. US7 vem aqui porque a semântica de `lastReviewed` só fica testável com **dois** coletores no mesmo laço (com um, "avança só no que foi lido" é indistinguível de "avança sempre"). |
| **PR-C** | **US5** (Shopee) | O único extrator **não determinístico** do incremento. Ele precisa pousar sobre um laço já provado honesto: se o laço ainda estiver em dúvida, um ABORT do OCR e um laço quebrado ficam indistinguíveis — e é exatamente aí que alguém "roda de novo". A prova por mutação (AC4) é o portão da fatia. |
| **PR-D** | **US6 + US8** | Não escreve dinheiro nenhum: é vigia e documentação. Vai por último porque é a fatia que **descreve o que a fatia ML vai herdar**, e essa descrição fica melhor depois de o laço existir de verdade. |

**Alternativa considerada e rejeitada**: Shopee antes da `/precos` (a Shopee é o marketplace com dado curado vivo,
logo o de maior impacto). Rejeitada porque põe o componente mais arriscado sobre a infraestrutura menos exercitada.
Confiança na ordem proposta: **80%**.

---

## 6. Fora de escopo (explícito)

1. **US6-ML com o token da casa** — nenhuma credencial, nenhum segredo, nenhuma chamada a `listing_prices` ou a
   `users/{id}/shipping_options/free`. Continua gateada pelas **8 condições do parecer do `seguranca` E por
   autorização separada do dono**, que **não** vem de um "continue". As condições T062a–T062d (segredo em
   Environment, job sem dependências, separação coleta/publicação) nascem com aquela fatia, não aqui.
2. **Ingerir a tabela de frete do ML no catálogo servido** — o eixo de frete é do **E3**; o 017 só vigia e guarda
   baseline. **ADR-0025 permanece Proposto**, adiado com a parte ML (dono, 2026-08-05).
3. **D10 — estender o schema do custo fixo do ML** (logística × faixa de preço × peso). Direção decidida; sem o
   token não há dado para preencher, e é mudança estrutural no domínio de precificação (escalação opus, ADR-0022).
4. **O corte de release para `main`** (que faria o `schedule` disparar) — depende da decisão permanente de adiar
   provisionamento/deploy até a v1. O 017 entrega o laço; não move essa decisão.
5. **Runner self-hosted, provisionamento GCP, escrita em datastore, auto-merge de dinheiro** — todos já decididos
   contra (ADR-0010 §A13/§A15, R6=(a)).
6. **Mudar `minPerItem` para 2,00** (D7 = manter + vigiar) e **modelar a fórmula regressiva CPF < R$ 12** (D12 =
   aviso honesto, já entregue no 016).
7. **Resíduos do 014 que o 017 NÃO absorve** — ficam onde estão, com dono declarado: **A1-r** (dominância de banda:
   precisa de desenho com o dono na mesa; exposição hoje ZERO, medida em quatro vias — mas a propriedade entra como
   guarda do laço, AC4 da US1), a **varredura de monotonicidade** a alargar, **C** (`PRICING_MODEL_VERSION`
   não bumpado; 0 diferenças em 9 tabelas × 100k bases), **U5-a/U5-f**, **U4-e/U4-g**, **R1/F-01/F-02/F-03**, e os
   **14 achados MÉDIA/BAIXA nunca verificados** (item D) + os arquivos que **nenhuma lente abriu** (item E).
   **O 017 absorve apenas**: T049, T050, T048a (P0-b), T069b (P0-c), U4-f (US2/AC4) e U5-b (US7/AC3).
8. **A2 do 016** — ver §6.1. Não é ingestão.

### 6.1 Onde vive o A2 (frete Shopee: campo exibe R$ 0,00, a conta desconta R$ 20,00)

**Recomendação: hotfix separado, cortado de `develop`, ANTES da PR-A do 017. Confiança 78%.**

O A2 é **defeito de produto no caminho do dinheiro**, ALTA, pré-existente do modelo 005/E1 (o `voucherCeiling` do
`BAND_VOUCHER` não alimenta o placeholder do eixo, e um **teto** é cobrado como certo; com o volumoso marcado o
líquido chega a ficar negativo). Quatro razões para não pendurá-lo no 017:

1. **Urgência assimétrica.** É um número errado na tela **hoje**; a PR-A do 017 não chega a nenhum usuário. Pôr o
   A2 atrás da esteira de CI atrasa em semanas a correção de um valor visível.
2. **Domínio e agentes diferentes.** O conserto mora na calculadora e no modelo de frete (`designer-ux` para o
   controle que nomeia o desconto, `arquiteto`/opus para o eixo `BAND_VOUCHER`), não em `packages/fee-ingest`.
3. **Superfície de homologação diferente.** Ele exige homologação visual com screenshots e geometria (lição 014,
   paga três vezes). Empacotá-lo na PR-A obrigaria a fatia que mais precisa ser provada por **execução de CI** a
   carregar também uma homologação de tela.
4. **É a mesma classe do bloqueador da PR-E do 016** — "dinheiro sem controle que o nomeie" — e merece o registro
   nesse fio (Clarification datada na spec **005**), não no fio da ingestão.

**Contra-argumento que eu aceito**: um hotfix custa branch, spec e PR para um defeito. Mitigação: não é ciclo
spec-kit completo — é uma Clarification datada em 005 + lista curta de tarefas, e **A3** (sessão expirada sem
caminho de volta, MÉDIA/ALTA, também pré-existente) pode viajar junto, já que ambos são "o produto conta uma
história errada sobre o próprio estado".

**Segunda melhor opção, se o dono preferir um fio só**: o A2 vira **PR-0 do 017**, e a spec do 017 declara, sem
disfarce, que carrega uma user story que não é de ingestão. É pior (mistura domínios e homologações), mas é
honesto. **Não recomendado**: deixá-lo na lista de follow-ups do 016 sem dono — é assim que um defeito de dinheiro
envelhece.

---

## 7. Perguntas para o `/speckit-clarify` (8 — só as que mudam escopo ou aceitação)

| # | pergunta | opções | por que muda escopo |
| --- | --- | --- | --- |
| **Q1** | Onde mora o **baseline** do frete/textos do ML (US6)? | (a) arquivo datado commitado em `packages/fee-ingest/data/` — o E3 herda o insumo medido · (b) só um hash por fonte — barato, não herda nada · (c) não vigiar frete neste incremento | (a) cria artefato novo versionado; (c) apaga metade da US6 |
| **Q2** | Quando as duas fontes da Amazon **convergirem** para R$ 2,00 (US4/AC4), o desfecho é... | (a) PR de **decisão** sem tocar dado · (b) mudar `minPerItem` no PR (sem dispensa de revisão, humano decide no merge) · (c) só alerta no resumo, sem PR | O D7 disse "vigia" e não disse o desfecho; (b) põe o robô propondo dinheiro |
| **Q3** | O laço **regenera a semente** (`seed.ts`) junto do artefato? | (a) sim, o laço regenera as duas cópias · (b) não; a semente segue podada e o guarda vira relacional | Decide se U5-b acorda e se a PR-A mexe em `apps/web` |
| **Q4** | Mês em que a Shopee ABORTA e a Amazon muda: | (a) sai PR **parcial** com a Amazon, nomeando a Shopee como ABORTADA · (b) nenhum PR sai enquanto todos os coletores não passarem | FR-022 diz jobs independentes; o corolário no PR nunca foi escrito. (b) faz um coletor frágil congelar o outro |
| **Q5** | **P0-b** (ruleset em `develop` exigindo PR): | (a) o dono configura antes da PR-A · (b) a dispensa de `lastReviewed` nasce **desligada** por configuração até o ruleset existir · (c) as duas | Sem ruleset, a dispensa é o único portão do artefato de dinheiro (ADR-0010 §A15) |
| **Q6** | Quanto o job valida antes de abrir o PR? | (a) só o subconjunto do artefato (schema + bandas + dominância + paridade) · (b) o `gate:all` inteiro (~6 min, é a validação que o PR não terá porque `GITHUB_TOKEN` não dispara CI) | Muda o custo e o tempo da execução mensal e o que o revisor recebe |
| **Q7** | Qual é o **sinal de um mês perdido** (execução descartada pelo agendador, ou arquivo ainda fora do `main`)? | (a) silêncio até o corte de release, e o runbook diz isso · (b) lembrete mensal (issue automática) · (c) checagem no `ci.yml` que avisa se a última execução tem mais de N dias | O Adendo A14 (45 dias) apoia-se no PR mensal como sinal de vida do dono; sem laço rodando, essa premissa é promessa |
| **Q8** | OCR com **guardas verdes** mas divergência grande contra o servido: | (a) abre PR normal (humano decide) · (b) aborta acima de um limiar declarado de divergência | O D11 decidiu falhar alto para guarda **reprovada**; guarda verde com número muito diferente não foi decidido |

---

## 8. Riscos (com a probabilidade que eu consigo defender)

| # | risco | por que é real | mitigação no escopo | risco residual |
| --- | --- | --- | --- | --- |
| **R1** | **Bloqueio de bot no runner** (Amazon/Shopee) | Ausente hoje neste egress (G2 MEDIDO 2×), mas é decisão de terceiro e pode mudar em qualquer mês; um 403/CAPTCHA se parece com mudança de layout | ABORT com status HTTP + DOM salvo como artefato da run (US3/AC2-AC3); nunca vira mudança de tarifa | MÉDIO ao longo de 12 meses; consequência é **parada**, não corrupção |
| **R2** | **Mudança de layout** numa fonte nova | As fontes novas (`/precos`, art. 26839, ajuda do ML) não têm as guardas de forma que a Amazon ganhou no 014; um vigia sem canária degrada para "diff sempre vazio" e **morre em silêncio** | Cada coletor novo nasce com canária + guarda de forma, e a canária é **provada por mutação** | BAIXO se a AC for cumprida; ALTO se alguém entregar vigia sem canária |
| **R3** | **OCR errando número silenciosamente apesar das guardas** | As guardas restringem **faixa e forma**, não verdade. Um 14% lido como 11% passa por todas elas | Âncoras de TEXTO (as únicas verdades verbatim), dinheiro **nunca** dispensa revisão, e o PR imprime valor lido × valor anterior × link da imagem | **É o risco que a decisão D11 compra.** Minha estimativa honesta: guardas pegam ~85% de um deslocamento sistemático de coluna, ~60% de um dígito aleatório, e **~35% de um erro plausível de uma célula só**. O último portão real é o humano no PR |
| **R4** | **PR mensal mentiroso** | Já aconteceu neste projeto (014/US4: "Sem mudança de tarifa" acima de "Categorias removidas da fonte"), porque todo teste afirmava presença e nenhum afirmava ausência | US2 inteira, com testes de **ausência** e o estado por marketplace | BAIXO — mas só enquanto o teste de ausência existir; ele é o requisito, não o estilo |
| **R5** | **O laço parecer pronto e entregar zero frescor** | `schedule` roda de `main`; o corte está adiado até a v1. O incremento pode fechar 100% e nenhum mês ser coletado | Cabeçalho do YAML (US1/AC1), runbook (US8/AC1), e **execução real como critério de aceitação** (US1/AC6) | Este é o **teto honesto do 017** e precisa aparecer na spec, não só aqui |
| **R6** | **O primeiro PR real nasce vermelho** | MEDIDO: `fee-catalog.test.ts:62-66` crava `catalogVersion` em string literal e afirma paridade com a semente | P0-a antes de tudo (US7/AC2) | Fechado se P0-a for a primeira tarefa |
| **R7** | **Credencial entrando de carona** | A fatia ML é a continuação natural; um `secrets.ML_*` num "só para testar" atravessaria as 8 condições sem revisão | US1/AC5: teste que afirma **zero** `secrets.` além do `GITHUB_TOKEN` | BAIXO, e estrutural em vez de disciplinar |

---

## 9. Ressalvas do PO (não alteram o escopo — Constituição II)

1. **Eu continuo achando o OCR no loop a escolha mais fraca** (a decisão D11 está tomada e não é reaberta). A
   quantificação do R3 é minha obrigação, não uma reabertura: as guardas listadas não distinguem um número
   plausível e errado de um número plausível e certo. Por isso a AC5 da US5 — imprimir valor lido, valor anterior e
   link da imagem no corpo do PR — **não é acabamento**: sem ela, a revisão humana do OCR é teatro.
2. **O 017 não entrega valor visível ao usuário.** Ele entrega "o número para de apodrecer". Se o dono precisar de
   valor visível neste ciclo, isso é o **hotfix do A2** e o **E6 PR-C**, não o 017. Digo isso porque um incremento
   inteiro sem tela é o tipo de coisa que, no meio do caminho, parece candidato a ser adiado — e aí só sobra o selo
   de 45 dias avisando o vendedor.
3. **Sequenciamento**: v1 = E1–E6, e o **E6 PR-C** (US7 teaser · US8 estorno/chargeback · Play Billing flag-ready,
   este último não descartável por decisão do dono) segue aberto. O 017 disputa as mesmas semanas. Recomendo E6
   PR-C antes, ou em paralelo com conjunto de agentes distinto — **confiança 70%**; é recomendação de ordem, não
   decisão minha.
4. **A US6 é a mais fácil de superestimar.** Ela vigia texto e não move um centavo. Se ela for lida como "agora
   temos ML dinâmico", o incremento terá criado exatamente a falsa sensação de cobertura que a AC4 dela existe para
   impedir.
