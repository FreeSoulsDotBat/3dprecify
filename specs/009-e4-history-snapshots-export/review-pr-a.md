# Revisão multi-agente pré-merge — E4 PR-A (PR #18)

**Data:** 2026-07-13 · **Escopo:** `git diff develop...HEAD` (branch `feature/009-e4-history-snapshots-export`)
**Método:** 6 lentes independentes (arquitetura · estrutura/FSD-Lite · bugs · negócio · segurança · testes) →
41 achados brutos → refutação adversarial (3 refutadores de lentes distintas para BLOCKER/MAJOR, 1 para MINOR) →
**31 confirmados · 10 refutados · 0 sem veredicto** → crítico de completude.

> **Autoria.** O corpo deste relatório foi sintetizado por um subagente do próprio workflow (que gravou o
> arquivo por conta própria). Ele foi lido, conferido contra o journal e **verificado independentemente** na
> main-loop antes de ser mantido: o B1 foi reproduzido com um probe executável e o BLOCKER do `KitLines`
> (achado do crítico de completude, ausente da tabela abaixo — ver §Crítico) foi confirmado lendo o código.
>
> **Nota de método.** A primeira rodada esgotou o limite da sessão e 53 dos 112 agentes morreram; o
> pós-processamento da época enterrava um achado sem veredicto no balde "refutado". Isso foi corrigido
> (três estados: CONFIRMADO / REFUTADO / SEM_VEREDICTO) e os veredictos faltantes foram re-rodados. Este
> relatório é reconstruído do journal completo do run — **todos os 41 achados têm veredicto real**.

---

## Veredicto

**NÃO MERGEAR como está.** Três blockers, e — mais grave — **dois defeitos que se tornam IRREVERSÍVEIS
no instante em que a primeira linha de produção for gravada**, porque a tabela é imutável por trigger
(ADR-0019). Esses dois não são "dívida": são a única classe de erro que este épico não pode consertar depois.

---

## 🔴 O que vira irreversível no primeiro registro de produção

### I1 · Floats de dinheiro congelados no JSONB imutável (`frozen-payload.ts:227`)
`freezeInput` só stringifica números de **topo**. No ramo `channels` o teste é `typeof cv === "number"` —
mas `priceBands` e `freightVoucherBands` são **arrays de objetos** (`calculator-model.ts:189`), então caem
no `else` e são copiados **verbatim**. Toda cotação gravada com um canal real (Shopee/Mercado Livre) congela
`fixedFee`, `commissionPct`, `minPrice`, `voucherCeiling` como **floats JSON** dentro do documento imutável.

Isso viola FR-525 e o contrato declarado do próprio módulo ("os únicos números JSON são contagens inteiras"),
e o validador server-side que existiria para pegar exatamente isso (VR-502, scan recursivo de float) **não foi
implementado**. A linha é imutável por trigger ⇒ **não há backfill possível**.

**Fix:** tornar `freezeInput` recursivo sobre arrays e objetos (todo leaf numérico vira string decimal) +
implementar o scan VR-502 no servidor, para que um float seja 422 e não uma corrupção permanente.

### I2 · `catalogVersion` descartado + envelope divergente do `data-model.md` (`frozen-payload.ts:128`)
O documento gravado é `{schemaVersion, kind, modelVersion, inputs, breakdown, totals, channels, lines,
provenance}`. O `data-model.md` §3 — artefato autoritativo que **este mesmo PR entrega** — especifica
`{…, catalogVersion, result}`. Não há `result`, não há `catalogVersion`; e ambos carimbam
`payload_schema_version = 1`.

`PriceResult.catalogVersion` existe e é populado (`pricing-core/src/index.ts:99,229`); o `data-model.md:243`
o pede como proveniência do catálogo de tarifas (ADR-0010). Todo documento v1 será congelado **para sempre sem
a proveniência da tarifa**. Dinheiro não está em risco (os valores resolvidos SÃO inlined via `freezeInput`),
mas incluir depois exige bumpar o envelope ou conviver com v1s que têm e não têm a chave.

**Fix:** decidir `catalogVersion` **dentro ou fora agora** (só o "dentro" é reversível) e reconciliar
`data-model.md` §3 + VR-503 com o envelope realmente gravado, antes de congelar `payload_schema_version = 1`.

---

## 🔴 Blockers

### B1 · O registro gravado offline SOME do Histórico (`use-history.ts:124`)
`useOutboxQuery` — a query que lê a **própria fila do aparelho** no IndexedDB — é a **única** sem
`networkMode: "always"`. A mutation (`:77`), a query do servidor (`:168`) e a de sync (`:209`) todas têm.
Com o default `"online"`, o TanStack **PAUSA** a query offline; com `initialData: []` ela reporta **fila vazia**.

Cenário (a feira, literalmente FR-527): o vendedor grava offline → o fix B1 do T016 funciona, a entrada chega
ao IndexedDB, o toast diz "pendente" → ele abre o Histórico → `mergeHistory(server, [])` devolve **zero itens**.
O registro está no disco e o app diz que ele não existe. É o **mesmo blocker que o T016 achou (B1), reintroduzido
na query que a correção não cobriu** — e a suíte verde de 520 testes não vê, porque mocka `idb-keyval` e nunca
toca no `onlineManager`.

**Fix:** `networkMode: "always"` no `useOutboxQuery` (uma leitura local NUNCA pode depender de rede) + um teste
que renderize o `useHistory` real com `onlineManager.setOnline(false)` e uma fila semeada.

> **Reconciliação com a evidência do T016 (verificado na main-loop, 2026-07-13).** O print
> `evidence/fix-03-lista-pendente-offline-390.png` mostra o registro pendente **aparecendo** offline, o que
> parecia refutar este blocker. Não refuta — **explica**. Um probe determinístico (`useHistory` real +
> `onlineManager.setOnline(false)` + fila semeada com 1 entrada) devolve **0 itens**; adicionar
> `networkMode: "always"` ao `useOutboxQuery` faz o mesmo probe passar. Causa provada.
>
> A diferença está em QUEM fica offline. O `onlineManager` do TanStack só vira offline quando a janela dispara
> o evento `offline`. No harness do Playwright o `navigator.onLine` virou `false` (por isso os banners "Você
> está offline" aparecem no print) mas o `onlineManager` **continuou online** — e a prova é o próprio print: a
> query rodou. Um celular de verdade perdendo sinal na feira **dispara** o evento, e aí a fila some.
>
> Duas consequências: (a) o blocker é real e mira exatamente o cenário FR-527; (b) **a homologação T016 deu um
> falso PASS** neste ponto — a emulação de offline dela não alcança o `onlineManager`. Isso é um defeito do
> HARNESS, e é o motivo pelo qual M13 (zero specs e2e) é mais grave do que parece: nem o e2e, como está montado
> hoje, pegaria isto.

### B2 · Entrada `blocked`/`failed` é um beco sem saída (`historico-page.tsx:214`)
Não existe **[Tentar novamente]** nem **[Descartar]** em lugar nenhum (ADR-0018 §9 e ux-history §1.1 os exigem;
`rg 'Descartar'` só acha a string na copy do sign-out). Uma entrada `failed` (422) nunca é re-tentada
(`outbox.ts:193`) e não pode ser descartada — ela **envenena todo sign-out futuro**: o diálogo do guard aparece
para sempre, e a única saída é **"Sair e descartar"**, que chama `purgeOutbox` e apaga a **fila inteira**.

**Fix:** `retryEntry`/`discardEntry` por entrada no `outbox.ts` + os dois botões no card e no Alert do detalhe.

### B3 · `purgeOutbox` destrói a única cópia num sign-out involuntário (`providers.tsx:51`)
A purga roda em **qualquer** transição para `anonymous`. O comentário no código *argumenta* que ela deve ser
incondicional ("o vendedor já foi perguntado e escolheu") — mas isso é auto-refutável: no caminho **com** diálogo
o guard já purgou (`sign-out-outbox-guard.tsx:80-83`) ou se recusou a sair, então a linha 51 é um **no-op** ali.
O único efeito real dela é nas transições que o guard **não** mediou.

E o gatilho já existe em árvore: `transport.ts:60-63` renova o token a cada request; o SDK do Firebase
auto-desloga em `auth/user-disabled` / `auth/user-token-expired` (token revogado) / `auth/user-not-found`.
Ou seja: os POSTs do próprio drain são um caminho vivo de *token revogado* → sign-out do SDK →
`onIdTokenChanged(null)` → **fila apagada, sem diálogo, sem toast**. Viola ADR-0018 §10 ("entradas nunca somem
em silêncio") e spec.md:409-410.

**Fix:** não purgar numa transição que o guard não mediou — reter a fila uid-keyed e apresentá-la no próximo
sign-in do mesmo uid.

---

## 🟠 Majors

| # | Local | Defeito |
|---|---|---|
| M1 | `use-history.ts:94` | `syncState: still?.syncState ?? "synced"` trata "ausente da fila" como **prova de aceite do servidor** — mas `listOutbox` devolve `[]` em qualquer erro de leitura. Resultado: toast **"Registro salvo no histórico."** para um registro que o servidor nunca viu. Reprodução mundana: POST lento → vendedor sai → "Sair e descartar" → a mutation em voo lê `[]` → "salvo". |
| M2 | `history.py:61-79` | POST **sem validação nenhuma**: VR-501/502/503 ausentes, sem scan de float, sem cap de tamanho, sem a invariante `headline_total == payload.totals[basis]`. `POST {"headlineTotal":"999.00", payload.totals.precoVarejo:"21.90"}` é **aceito**: o card mostra R$ 999,00 e o detalhe R$ 21,90 — dois "quanto o vendedor cobrou" para a mesma linha imutável. Overflow de `Numeric(12,2)` vira **500** (o contrato promete 422), e o outbox re-POSTa um 500 para sempre. |
| M3 | `history.py:231/247` | Truncagem **silenciosa** em 50 linhas (`next_cursor` hard-coded `None`, cliente não pagina). O 51º registro simplesmente não aparece — sem "carregar mais", sem aviso. Pior: o detalhe resolve pela lista (`snapshot-detail-page.tsx:51`), então um link para esse snapshot renderiza **"Registro não encontrado"** para um registro que o servidor tem. (`tasks.md` se contradiz: T006/PR-A está `[x]` alegando o keyset que não existe; T022/PR-B o re-atribui.) |
| M4 | `history.py:82` | `PATCH` com body que **omite** `label` **apaga** o label (único campo mutável) e devolve **200**. `label: ""` vira 500. O PATCH não sabe dizer "não mexa no label". |
| M5 | `outbox-syncer.tsx:27` | Só 2 dos 4 gatilhos de drain do ADR-0018 §7: faltam `focus`/`visibilitychange`, não há backoff (`attempts` é escrito e **nunca lido**). Num 5xx transitório com `navigator.onLine === true`, nenhum evento `online` dispara: **não há recuperação automática in-session**, enquanto o toast promete "sincroniza sozinho". (`plan.md:156` previa um `sync-engine.ts` que nunca foi criado.) |
| M6 | `use-history.ts:186` | `hasLocal`/`isError`/`stale` derivam de `cached` e `query.data === undefined`, mas o TanStack **mantém** `data` após refetch falho. Efeito: a parede de erro "Não foi possível carregar seu histórico" renderiza **por cima da lista que está sendo renderizada**, e a legenda honesta de offline nunca aparece. |
| M7 | `snapshot-detail-page.tsx:63` | Falha de leitura colapsa no mesmo branch de registro inexistente: a página afirma **"Registro não encontrado"** quando a verdade é "não conseguimos carregar". |
| M8 | `snapshot-detail-page.tsx:78` | Falta o bloco Alert §1.2 no detalhe (pending/blocked/failed) — e com ele a **frase F4 de durabilidade**, decisão datada do owner: nada em lugar nenhum avisa que um pendente vive só ali e se perde se os dados do app forem limpos. |
| M9 | `outbox.ts:108` | `navigator.storage.persist()` (ADR-0018 §1, T009 — marcado `[x]`) **nunca é chamado** em todo o `apps/web`. A fila — única cópia de uma cotação — vive num bucket best-effort evictável. |
| M10 | `sign-out-outbox-guard.tsx:66` | `syncNow` chama `drainOutbox` cru em vez do seam `useSyncOutbox`, então **não invalida as query keys**: após um sync parcial o vendedor volta a uma lista que ainda estampa "Pendente" em registros já sincronizados. |
| M11 | `snapshot-detail-page.tsx:104` | Os preços **por canal** são congelados no payload e **nunca renderizados**. `messages.historico.channels` ("Preços por canal") é copy morta — o vendedor não vê o preço de anúncio/líquido que ele de fato cobrou. |
| M12 | `models/__init__.py:664` | O guard ORM `before_update` — **camada 2 das 4** da imutabilidade (ADR-0019) — tem **ZERO testes**: apagar o bloco `@event.listens_for` inteiro deixa a suíte backend **verde**. O próprio ADR pediu esse teste. |
| M13 | `playwright.config.ts` | E4 PR-A traz **zero specs e2e** — a única camada onde IndexedDB real, `onlineManager` real, Web Locks reais e os defaults reais do TanStack rodam juntos. É exatamente onde os dois blockers do T016 viviam, e é exatamente onde B1 (acima) ainda vive. |

---

## 🟡 Minors

- `calcular-page.tsx:255` + `record-snapshot-sheet.tsx:44` — os comentários prometem o comportamento **pré-Q15**
  ("free/deslogado **vê** o botão e encontra o teaser") **ao lado** do código que implementa Q15 (o botão é
  **ausente**). Um dev futuro "restaura" o documentado e quebra SC-109.
- `models/__init__.py:639` — `payload_schema_version` nunca vem do request; é sempre o `server_default` 1,
  mesmo para um envelope v2. E a linha é imutável ⇒ o rótulo errado é permanente.
- `outbox.ts:212` — qualquer status ≠ 403/404/422 (incl. 5xx) vira `pending` e é re-POSTado **para sempre**:
  sem backoff, sem cap, `attempts` nunca lido.
- `history-format.ts:13` — helpers de domínio dentro de uma **page slice**; `features/history` (onde PR-B/PR-C
  vão morar) é estruturalmente **proibido** de importar de `pages`. Move para `entities/history` (precedente
  `product-summary.ts` do E2).
- `record-snapshot-sheet.tsx:100` — `useMemo(() => source.freeze(), [source])` re-congela a **cada re-render do
  pai** (o call site recria o literal). O invariante "congela ao ABRIR" não é o que o código faz, e o teste não
  vê porque o mock devolve constante.

---

## Achados derrubados pela refutação (10)

Registrados para que não voltem como ruído:

- **A truncagem em 50 como BLOCKER** (`history.py:231`) — o defeito é real (M3), mas a acusação de blocker caiu.
- **`use-entitlement.ts:61/92` — "a query de entitlement pausa no cold boot offline"** (2 achados) — **falso**:
  o `onlineManager` do query-core 5.101.2 **não lê `navigator.onLine`** no boot. Os refutadores provaram lendo a
  fonte instalada. A legenda `stale` da Q14 **aparece** como o owner exigiu.
- **`use-entitlement.test.tsx:61` — "o teste simula offline rejeitando o fetch"** — cai junto com a premissa acima.
- **`outbox.ts:93` — "o branch `navigator.locks` nunca é exercitado (jsdom)"** — **falso**, verificado por execução:
  `vitest.config.ts:14` define `environment: "node"`.
- **`sign-out-guard.ts:36` — "o seam é convenção, `signOutUser` segue exportado"** — fatos certos, acusação não.
- **`snapshot-detail.test.tsx:199` — "o teste é uma tautologia"** — refutado em quatro frentes independentes.
- **`outbox.ts:51` — guard de shape fraco** — cenário de falha inalcançável.
- **`sign-out-outbox-guard.tsx:66` (MINOR, versão negócio)** — a moldura de desonestidade colapsa (o defeito real
  sobrevive como M10).

---

## Crítico de completude — o que as 6 lentes NÃO abriram

O crítico varreu as superfícies do diff que não apareciam em nenhum dos 31 achados. Trouxe **6 novos**, e o
primeiro é o achado mais grave de toda a revisão — **nenhuma das seis lentes o viu**.

### C1 · 🔴 BLOCKER — um kit gravado no ATACADO é itemizado a preço de VAREJO (`snapshot-detail-page.tsx:145`)
`KitLines` fixa `line.totals.precoVarejo`. A base da manchete (`headlineBasis`) pode ser `PRECO_ATACADO` — a
decisão F1 do owner torna o atacado uma base gravável de primeira classe, e `freezeTotals` grava as duas.
Resultado: o vendedor fecha um kit de 3 peças com um lojista **no atacado**, grava, reabre — e as linhas das
peças mostram **preço de varejo**, contradizendo a manchete que ele de fato cobrou. É a mentira exata que o
épico inteiro existe para impedir: *o Histórico prova o que você cobrou*. **Verificado por leitura do código.**

**Fix:** itemizar pela base do snapshot (`payload.headlineBasis`), não por uma constante.

### C2 · 🟠 MAJOR — a quantidade some ao lado de um total já multiplicado (`snapshot-detail-page.tsx:144`)
A linha renderiza `3×` colada num valor que **já é** `perUnit × quantity` (`pricing-core` escala em
`BomLineResult`). O vendedor lê como preço unitário e multiplica de novo — erro de 3× na conferência.

### C3–C6 · MAJOR
- `use-entitlement.ts:61` — a query de entitlement é a única ainda no `networkMode` default. *(Atenção: os
  refutadores derrubaram a versão cold-boot desta acusação lendo a fonte do `query-core`; o que sobra é a
  transição offline **em sessão** — mesma raiz do B1. Tratar junto, não como achado independente.)*
- `historico-page.tsx:49` — o gate do Histórico não tem ramo para "o servidor nunca respondeu sobre o plano":
  um free/offline cai na parede de erro em vez do teaser honesto — a única porta que a Q15 deixou aberta.
- `historico-page.tsx:179` — a precedência do QueueBanner remove **[Sincronizar agora]** (a única drenagem
  manual do app) sempre que QUALQUER entrada está `failed`/`blocked`, prendendo atrás dela todas as `pending`
  saudáveis.
- `sign-out-outbox-guard.tsx:85` — `navigator.onLine` é lido **uma vez** no render do diálogo bloqueante e não
  assina evento nenhum: um diálogo aberto offline mantém [Sincronizar agora] desabilitado **para sempre**,
  mesmo depois que a rede volta. Sobra só "Sair e descartar".

### O funil de perda de dado (risco de integração apontado pelo crítico)
C5 + M5 + B2 se compõem num estado **sem saída**: numa rede de portal cativo (`navigator.onLine` continua
`true`, então nenhum evento `online` dispara e nada drena sozinho), **uma** entrada `failed` esconde o único
botão de drenagem manual, prendendo todas as pendentes saudáveis — e a única ação que o app ainda oferece é
"Sair e descartar", que purga a fila **inteira**. Três defeitos individualmente sobrevivíveis montam um funil
de perda de dado.

### Cinco suspeitas que o crítico CHECOU E INOCENTOU
Registradas para ninguém re-gastar token: sinal do `deviceUtcOffsetMinutes` (correto); ausência da linha
`admin` no detalhe (correta — seria dupla contagem); idempotência do POST + delete-then-replay (invariantes
válidas, testadas); ordenação do `mergeHistory` (lexicográfica == cronológica, ambos os lados em UTC);
`withOutboxLock` e a corrida B2 do T016 (a disciplina do lock está correta e fecha a corrida).

### C7–C8 · a camada 3 (o trigger PL/pgSQL) — o que uma segunda passagem do crítico somou
*(Rodada independente do crítico, 2026-07-13. Confirma C1 e a refutação do cold-boot acima; soma dois achados
sobre o trigger que nenhuma lente e nenhuma outra passagem abriram.)*

- **C7 · 🟡 MINOR — o trigger é `ENABLE`, não `ENABLE ALWAYS`** (`alembic/versions/0003_e4_snapshots.py:161`).
  Um trigger em modo `origin` (o default) **não dispara** sob `session_replication_role = 'replica'` — o modo
  usado por apply de replicação lógica, `pg_restore --disable-triggers` e várias ferramentas de migração/DMS.
  O ADR-0019 vende a camada 3 como o que torna SC-504 ("**0** write paths podem alterar um snapshot")
  demonstrável **no banco**, e não uma promessa sobre o código que por acaso escrevemos; sob essa GUC a
  demonstração cai. Alcance prático limitado (setar a GUC exige superuser; o role do app no Cloud SQL não é),
  por isso MINOR — mas **fechar custa uma linha numa migration que ainda não subiu**, e depois custa uma
  segunda migration.
  **Fix:** `op.execute("ALTER TABLE snapshots ENABLE ALWAYS TRIGGER trg_snapshots_immutable;")` após o `CREATE TRIGGER`.

- **C8 · 🟡 MINOR — o teste do trigger exercita 2 das 13 colunas congeladas** (`backend/tests/test_history.py:174`).
  O predicado do PL/pgSQL cobre as 13 colunas corretamente (as 16 da tabela menos as 3 mutáveis) — isso está
  certo. Mas o teste só tenta `headline_total` e `device_quoted_at`. **Ninguém toca `payload`** (o documento
  congelado inteiro) nem **`owner_uid`** (cuja alteração é uma **troca de dono entre contas** — FR-511/SC-509).
  Apagar a cláusula `OR (NEW.payload IS DISTINCT FROM OLD.payload)` do PL/pgSQL deixa **a suíte inteira verde**.
  Sendo o trigger a defesa declarada contra o código **futuro** (E5/E6), esse teste é o único mecanismo que
  impede alguém de "simplificar" essas cláusulas.
  **Fix:** parametrizar o teste sobre as 13 colunas (um `for` sobre uma lista de `UPDATE`s).

**Boa notícia verificada na mesma passagem** (para não se re-gastar token): os testes de banco rodam contra um
**Postgres 17 real** (testcontainers + `alembic upgrade head`), e sem Docker eles **skipam com motivo visível**
— nunca verde silencioso. SQLite não é usado como dublê, e o trigger **é** de fato exercitado. A camada 3 é
real; o que falta é abrangência de teste (C8) e o `ENABLE ALWAYS` (C7). A **camada 2** (guard ORM
`before_update`) segue com **zero** testes — é o M12 já confirmado.

**Observação estrutural que ninguém tinha registrado:** `GET /api/v1/history/{snapshot_id}` (`history.py:250`)
recebe o **uuid do servidor** e por isso **não tem NENHUM chamador** — o detalhe resolve pela lista, keyed no
`clientSnapshotId`. É exatamente isso que torna a truncagem em 50 (M3) **fatal** para o detalhe: não existe
fallback de servidor. Um endpoint inteiro + sua entrada de contrato + o cliente Orval sobem sem que ninguém os
exercite ponta a ponta.

---

## Sequência recomendada

1. **Antes de qualquer merge:** I1 e I2 (irreversíveis) + **C1** (o kit atacado/varejo) + B1, B2, B3.
2. **Ainda nesta fatia:** M1, M2, M4 e C2 (mentem sobre dinheiro/estado) e M12/M13 (as camadas de teste que
   deixariam tudo isso passar verde de novo — e M13 é o que pegaria B1, *desde que o e2e emule offline de um
   jeito que alcance o `onlineManager`*, o que o harness atual não faz).
2b. **Barato agora, caro depois — enquanto a migration 0003 não subiu:** **C7** (`ENABLE ALWAYS` no trigger) e
   o CHECK ligando `headline_total`/`headline_basis` ao `payload->>'totals'` (hoje o banco garante coerência
   para `kind` e `modelVersion` — os dois campos que **não** são dinheiro — e não garante para os dois que são).
   Depois da primeira linha em produção, cada um destes vira uma segunda migration sobre linhas que **não podem
   ser atualizadas**.
3. **Pode ir para PR-B com registro datado:** M3 (keyset), M5 (gatilhos de drain), M11, C4, C5, C8, e os minors.
