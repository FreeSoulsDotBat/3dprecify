# Pendências — perguntas que dependem de decisão do dono

Nada aqui é inferência apresentada como fato (R6). Cada item é uma pergunta específica.

## P-001 — O stack do prompt não é o deste repositório. Confirma o realinhamento?

O prompt fixa Expo + React Native Web + Supabase + RevenueCat + RLS + `app.json`/`eas.json` +
Playwright MCP como decisões já tomadas. **Nenhum deles existe aqui** — verificado no disco, tabela
em `_PLANO.md` §AVISO 1. Adaptei as fases ao stack real.

**Pergunta**: o prompt foi escrito para outro projeto e o realinhamento está correto, ou existe uma
migração planejada que eu deveria auditar **contra**?

## P-002 — "Todas as features implementadas" não confere. Audito o quê?

E6 está 31/44 com o PR #36 **aberto e não mergeado**; T036 (Play real) e T002 (sandbox MP) estão
bloqueados na sua provisão; a fatia ML da 014 não foi iniciada.

**Pergunta**: audito o HEAD de `develop`, o PR #36 incluso, ou os dois separadamente?
**Default se você não responder**: `develop` + o PR #36, declarando em cada achado de qual dos dois
ele veio.

## P-003 — Não há app Android. A checagem de política do Google tem objeto?

O prompt pede verificar "que nenhum caminho do app Android leva a checkout web". **Não existe app
Android** — o produto é PWA, e as rotas do Play estão atrás de flag desligada.

**Pergunta**: audito isso como PREPARO (o desenho de hoje permitiria a violação no dia em que o app
existir?) ou removo a fase?

## P-004 — Escopo de LGPD

Não encontrei documento sobre tratamento de dado pessoal além do aviso de privacidade da 006.

**Pergunta**: existe base legal ou política escrita **fora** do repositório que eu deveria medir o
código contra, ou a auditoria trata o que o código faz como a única fonte?

## P-005 — As tres specs desatualizadas devem ser EMENDADAS?

A F02 achou tres documentos que enganam quem os le isolados, e nos tres o CODIGO esta certo:

1. `specs/001-walking-skeleton/spec.md` — FR-002 ainda exige login para a calculadora, que a `003`
   tornou publica de proposito.
2. `specs/007-e2-catalog-entitlement/` e `specs/008-e3-multi-piece-bom/` — prometem "sem preco e sem
   CTA de compra antes do E6". O E6 chegou e os teasers acenderam; a mudanca so esta registrada na
   spec `012`.
3. `specs/011-token-optimization/dod-evidence.md` — a linha 262 diz `*(empty slot)*` para o veredito
   do piloto, e a linha 309 traz o veredito FECHADO com numeros. Auto-contradicao no mesmo arquivo.

**Pergunta**: emenda-se a spec fechada com uma nota datada apontando para a decisao que a superou,
ou o registro correto e SEMPRE o da spec mais nova e cabe ao leitor buscar? A Constituicao
(Principio VI — documentacao viva e enxuta) admite as duas leituras, e a escolha muda o volume de
manutencao de doc de todo epico futuro.

**Nota**: a instancia 3 nao depende dessa decisao — e contradicao INTERNA de um unico arquivo, e
consertar nao emenda spec nenhuma. Se voce so quiser fechar essa, e uma linha.

## P-006 — `failurePct` e os markups nao tem teto. E deliberado?

`packages/pricing-core/src/index.ts:157,163-164` — `assertNonNegative` aceita qualquer valor >= 0.
Consequencias medidas: `failurePct = 1000` produz falha de 10x o subtotal de producao sem aviso; e
**nada exige que o markup de varejo seja >= o de atacado**, entao da para produzir um "preco de
atacado" acima do varejo e o motor calcula sem reclamar.

Nao afirmo que seja defeito — um teto arbitrario tambem mente, e o numero e do vendedor.

**Perguntas**: (a) existe teto de produto para taxa de falha? (b) varejo < atacado e entrada valida,
ou e engano que a UI deveria ao menos sinalizar? (Se for so sinalizar, e F08, nao F03.)

## P-007 — O `computeBom` entra na F03b?

A F03a auditou o caminho de peca unica. O `computeBom` (soma por peca do E3, ADR-0016) nao estava no
escopo declarado de nenhuma das duas sub-fases de preco. **Pergunta**: incluo na F03b, ou ele vira
uma sub-fase F03c propria? (Ele tem aritmetica de quantidade e rollup por marketplace — nao e so
chamar o motor N vezes.)

## P-008 — Existe tabela real de voucher de frete da Shopee?

`freightVoucherBands` (frete co-financiado, FR-111a) so foi exercitado pela AUSENCIA na F03b: eu
testei a mecanica (o voucher e resolvido pela banda do anuncio, e varejo/atacado podem cair em
bandas diferentes), mas nao a FIDELIDADE a politica real da Shopee.

**Pergunta**: existe uma tabela de voucher com valores reais — como existe para comissao no
`fee-catalog` — contra a qual eu possa medir? Sem ela, a auditoria consegue afirmar "a conta esta
certa" e NAO consegue afirmar "os numeros sao os que a Shopee pratica".

## P-009 — O Mercado Pago reentrega um webhook respondido com 200? (separa Bloqueante de Medio)

O achado `[F04b-001]` depende disto, e e a UNICA pergunta que muda a severidade dele.

A cadeia esta verificada linha a linha: erro de rede vira `None`, `None` vira `200 "ignored"`, a
reconciliacao nao esta agendada, e nada e logado. O que eu **nao** verifiquei na fonte e se o MP de
fato para de reentregar ao receber 200 — li isso no comentario da propria casa
(`backend/app/api/billing.py:9`, *"MP retries on non-2xx"*), que e a semantica convencional de
webhook, mas **nao abri a documentacao do Mercado Pago**.

- Se o MP **nao** reentrega apos 200 ⇒ `[F04b-001]` e **Bloqueante**: o vendedor paga e nunca recebe.
- Se o MP **reentrega mesmo assim** ⇒ cai para **Medio**: a reentrega salva o caso, e o que sobra e
  a ausencia de log.

**Pergunta**: voce confirma a politica de retry do MP na documentacao oficial? E respondivel em
minutos com a doc na mao, e eu prefiro nao inferir sobre dinheiro.

## P-010 — Nao existe exclusao de conta. Isso bloqueia o provisionamento?

Medido: nao ha rota, nem CLI, nem procedimento escrito para eliminar os dados de um titular. O
produto guarda **e-mail** (`accounts.email`) e **referencia de pagador**
(`subscriptions.payer_ref`), e vai passar a cobrar de brasileiros — a LGPD da ao titular o direito
de eliminacao (art. 18, VI).

Ha um agravante tecnico que precisa de decisao ANTES do primeiro pedido, nao no dia dele: o
historico e **imutavel por gatilho PL/pgSQL** (ADR-0019). Uma exclusao esbarra nisso, e a saida certa
nao e obvia — anonimizar o snapshot? excluir a conta e reter o registro contabil? o que a legislacao
fiscal obriga a manter? E decisao de produto E juridica ao mesmo tempo, e se cruza com o handoff
fiscal que ja esta aberto (`docs/product/e6-fiscal-handoff.md`).

**Perguntas**: (a) existe procedimento fora do repositorio que eu nao vi? (b) se nao, isso entra como
BLOQUEANTE de provisionamento, ou como Alto a resolver logo depois de cobrar do primeiro cliente?
(c) quem decide o que acontece com o snapshot imutavel — voce, ou o contador?

## P-011 — O selo de frescor comeca a avisar em 2026-08-21. O que fazemos ate la?

Medido: a janela e de 45 dias (`STALENESS_DAYS = 31 do ciclo + 14 de folga`), e o artefato tem duas
datas de revisao — `2026-07-07` (Shopee) e `2026-07-28` (Amazon). Logo o selo passa a avisar
"pode estar desatualizada" em **2026-08-21** e **2026-09-11**.

A janela foi dimensionada para tolerar um ciclo mensal. Ela pressupoe que o laco rode, e o laco
**nao roda**: nao existe `fee-refresh.yml` (bloqueado no T069b) e o `schedule` do GitHub le do branch
default, que o corte de release adiado nao alcancou.

O selo esta CERTO — ele vai dizer a verdade. O problema e o momento: a primeira data cai 19 dias
depois desta auditoria, e a segunda perto do provisionamento provavel. Um vendedor que acabou de
pagar veria o aviso numa tela pela qual pagou.

**Tres saidas, e a escolha e sua**: (a) desbloquear o T069b e ligar o laco; (b) recolher a fonte a
mao antes de 21/08 e regerar (o `COLLECTED_AT` existe justamente para isso, e o guarda impede
carimbar data falsa); (c) decidir que o aviso e aceitavel e deixar aparecer.

**Pergunta**: qual das tres? E se for (b), quem faz a coleta?

## P-012 — O `ENABLE ALWAYS` do gatilho pode atrapalhar uma RESTAURACAO?

O gatilho de imutabilidade esta em `ENABLE ALWAYS`, e isso e a escolha CERTA: em modo `ENABLE`
(padrao) ele nao dispararia com `session_replication_role = replica`, que e como rodam replicas e
varias ferramentas — a garantia teria um buraco.

A contrapartida que eu **nao testei**: um `pg_restore` que rode em modo replica vai encontrar o
gatilho ATIVO. Se a restauracao fizer qualquer `UPDATE` nas linhas de `snapshots` (alguns fluxos
fazem), ela pode falhar — e falhar restaurando dado legitimo e o pior momento para descobrir a
propriedade.

**Pergunta**: antes do primeiro backup real, vale rodar um ciclo `pg_dump`/`pg_restore` completo
contra uma base com snapshots e confirmar que passa? Se falhar, a saida conhecida e desabilitar o
gatilho durante a restauracao e reabilitar depois — mas isso precisa estar no runbook ANTES, nao
sendo descoberto durante uma recuperacao.

Relacionado: `[F07-001]` — o gatilho protege `UPDATE` e nao `DELETE`, o que empurra a exclusao de
conta (P-010) para a solucao mais destrutiva.

## P-013 — [RESOLVIDA 2026-08-03, POR MEDICAO] O Sentry captura rejeicao nao tratada?

`apps/web/src/shared/observability/sentry.ts:31` passa `integrations: [breadcrumbsIntegration(...)]`.

Na v8+ do SDK, um ARRAY em `integrations` e **mesclado** com as integracoes padrao — e o
`globalHandlersIntegration`, que captura `onunhandledrejection` e `onerror`, e padrao. Se for esse o
caso, os seis `.then` sem `.catch` do `[F08-001]` sao observaveis em producao e o achado e cosmetico.

**RESPOSTA MEDIDA — nao precisou de voce.** Li o SDK instalado (`@sentry/react` 10.63.0):

| verificado | onde | resultado |
| --- | --- | --- |
| array em `integrations` mescla ou substitui? | `@sentry/core/build/cjs/integration.js:27-28` — `integrations = [...defaultIntegrations, ...userIntegrations]` | **MESCLA** |
| `globalHandlersIntegration` esta nos padroes do browser? | `@sentry/browser/build/npm/cjs/dev/sdk.js:27` | **sim** |
| ele captura `onunhandledrejection` por padrao? | `.../integrations/globalhandlers.js:12` — `onunhandledrejection: true` | **sim** |

A substituicao so aconteceria com a forma de FUNCAO (`integrations: (defaults) => [...]`, linha 29-31),
que nao e a usada aqui. Logo: **o Sentry captura**, o `[F08-001]` **fica Baixo**, e nenhum erro nao
tratado do app esta sendo perdido. Certeza 100%.

(Registro do que era o risco, porque ele era grande:)

**Por que a pergunta vale muito mais do que os seis `catch`**: se as integracoes padrao tiverem sido
SUBSTITUIDAS em vez de mescladas, entao **nenhum erro nao tratado do app inteiro** chega ao Sentry —
nem os seis, nem qualquer excecao de render que a `ErrorPage` nao pegue. O DSN estaria configurado, o
painel estaria vazio, e a leitura natural de um painel vazio e "nao ha erros".

**Pergunta**: confirmo isso lendo o SDK instalado (uns minutos), ou voce prefere validar em runtime
no primeiro deploy com um erro proposital? Sugiro o primeiro — e barato e nao depende de deploy.

## P-014 — Audito tambem a arvore de dependencias de DESENVOLVIMENTO?

Rodei `pnpm audit --prod`: **1 moderada** (`protobufjs` via `firebase`), e medi que ela **nao chega
ao cliente** (zero `protobuf`/`grpc` no bundle servido — o app so importa o Auth e o tree-shaking
removeu o Firestore).

A arvore de DEV (vitest, playwright, eslint, prettier e transitivas) eu **nao** auditei. Ela nao e
servida ao vendedor — mas roda no CI, com acesso ao repositorio e, no caso do `deploy.yml`, ao lado
de credenciais de producao. Isso se cruza diretamente com `[F09-001]`.

**Pergunta**: incluo a arvore de dev no escopo (um `pnpm audit` completo mais triagem do que roda em
workflow com segredo), ou o escopo fica so no que e servido?

## P-015 — Vale virar regra da DoD: "todo teste novo foi visto FALHAR pelo motivo pretendido"?

O `[F10-002]` mediu que "teste que passa sem provar nada" **nao tem forma sintatica** — varri todos
os padroes mecanicos plausiveis e nao achei nenhuma das cinco instancias reais desta sessao. Elas
passavam por motivos semanticos diferentes entre si, e quatro das cinco apareceram do mesmo jeito:
**alguem olhou os VERDES na rodada vermelha**.

**Pergunta**: isso vira uma linha na Definicao de Pronto? A Constituicao ja tem o Principio III
(teste primeiro, falha observada), mas ele diz "observar falhar" — e nao **"ler os que NAO
falharam"**, que e onde as cinco moravam.

Custo: quase zero (e olhar uma saida que ja se produz). Beneficio medido nesta sessao: 5 achados.

Relacionado: a segunda tecnica que funcionou foi **mutar o codigo e exigir que o teste caia** — usada
para provar nao-vacuos o guarda de geometria, o de dominancia de banda e o de cortesia-nao-revogada.
Essa e mais cara e nao proponho como regra geral; proponho para guarda NOVO sobre dinheiro ou
seguranca.

## P-016 — Rodo uma deteccao de codigo morto?

Nao ha `knip`/`ts-prune` instalado, e instalar ferramenta para auditar viola o espirito da R8 (so
leitura). O `dependency-cruiser` e o `eslint-boundaries` pegam import PROIBIDO, nao export nao usado.

**Pergunta**: autoriza uma execucao pontual (`npx knip` sem instalar no `package.json`), ou o item
fica registrado como nao verificado?
