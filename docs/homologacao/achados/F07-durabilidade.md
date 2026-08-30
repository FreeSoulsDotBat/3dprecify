# F07 — Durabilidade e offline

## Resumo

As quatro garantias de durabilidade **se sustentam**, e duas delas por mecanismo estrutural e não por
disciplina. A imutabilidade do snapshot é um gatilho PL/pgSQL com **13 colunas** protegidas por
`IS DISTINCT FROM`, e — detalhe que quase ninguém acerta — está em **`ENABLE ALWAYS`**, então ele
dispara mesmo com `session_replication_role = replica`. O outbox é chaveado por conta, tem trava de
exclusão mútua via Web Locks, e o *sign-out* com fila não-vazia é **guardado**: o código o trata
explicitamente como *"a ÚNICA cópia de uma cotação"*. A degradação D3/D6 é **read-time** em todo
caminho de leitura, e não captura-no-delete.
**Nenhum achado de correção.** Uma observação com consequência: o gatilho protege `UPDATE` e **não**
`DELETE` — o que é coerente hoje (o app nunca apaga de verdade), e **vira o problema de amanhã** no
dia em que a exclusão de conta do `[F05-001]` precisar apagar.

---

## As quatro garantias

### 1. Imutabilidade do snapshot (ADR-0019)

`backend/alembic/versions/0003_e4_snapshots.py:45-72,195-207`.

| propriedade | veredito |
| --- | --- |
| colunas congeladas | **13**, listadas explicitamente |
| comparação | `IS DISTINCT FROM` — **seguro a nulo** (`=` deixaria passar `NULL → valor`) |
| o que PODE mudar | só `label`, `deleted_at`, `updated_at` — e a exceção **diz isso** na mensagem |
| erro | `ERRCODE = 'check_violation'`, não uma exceção genérica |
| ativação | **`ENABLE ALWAYS`** (`:207`), não o `ENABLE` padrão |

O `ENABLE ALWAYS` é o detalhe que separa uma garantia de uma intenção: um gatilho em modo *origin*
**não dispara** quando a sessão está em `session_replication_role = replica` — que é como rodam
réplicas e várias ferramentas de restauração. A migração comenta exatamente isso (`:200`).

### 2. O outbox offline (ADR-0018)

`apps/web/src/entities/history/outbox.ts`.

| propriedade | onde | veredito |
| --- | --- | --- |
| chave por conta | `:47` — `history:outbox:${uid}` | ✅ dispositivo compartilhado não cruza |
| exclusão mútua | `:117` — Web Locks com degradação graciosa | ✅ duas abas não corrompem a fila |
| estados | `:33` — `synced \| pending \| blocked \| failed` | ✅ `blocked` é visível, não silencioso |
| sign-out com fila | guardado (`sign-out-guard.ts`) + e2e dedicado | ✅ **nunca purga em silêncio** |

O comentário do guarda (`sign-out-guard.ts:6`) enuncia a razão com precisão: todo o resto do cache
*"pode sempre ser reconstruído do servidor. O outbox quebra isso: ele é a ÚNICA cópia"*. Um cache que
some é inconveniência; um outbox que some é a cotação do vendedor perdida.

Um 403 no sync (grant expirado entre a fila e o envio) vira `blocked` — **visível e retido**, nunca
aceito em silêncio. É a materialização do "o servidor decide no sync" do ADR-0015.

### 3. Caches por conta

Todos os caches de leitura são chaveados por uid (`catalog-cache`, `history-cache`, `bom-cache`,
cenários), com teste dedicado afirmando que a saída de uma conta **não** apaga a da outra. A única
exceção é o catálogo de TARIFAS (`FEE_CATALOG_STORE_KEY = "fee-catalog"`, chave única) — e é
**correto**: tarifa é dado público, não do vendedor.

### 4. Degradação read-time (D3/D6)

`backend/app/api/scenarios.py:388-424`. O resolvedor roda em **toda** leitura — `GET /{id}`, lista,
e as respostas de escrita — e o `lastKnown` é a foto capturada na última resolução bem-sucedida,
**não** algo escrito no momento do delete. A distinção importa: captura-no-delete exigiria interceptar
todo caminho de exclusão (e um esquecido produz um cenário que mente); read-time degrada sozinho
porque a resolução simplesmente não encontra o alvo.

O `:457` registra que o rollup é *"uma leitura pura que nunca escreve `lastKnown` em lugar nenhum"* —
a propriedade que impede a leitura de virar escrita disfarçada.

---

## Observação

### [F07-001] O gatilho protege `UPDATE` e não `DELETE` — e a exclusão de conta vai precisar apagar

- **Severidade**: **Baixo hoje**, e **pré-requisito** de `[F05-001]`
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100%
- **Local**: `backend/alembic/versions/0003_e4_snapshots.py:195-196` (`BEFORE UPDATE ON snapshots`)

O gatilho é `BEFORE UPDATE`. Um `DELETE FROM snapshots` no nível SQL remove o registro inteiro sem
encontrar guarda nenhuma.

**Hoje isso é coerente**: varri `backend/app` e **não existe** `delete(Snapshot)` nem
`DELETE FROM snapshots` — o app faz apenas soft-delete via `deleted_at`, e o gatilho permite mexer
nesse campo justamente para isso.

**Amanhã vira colisão.** O `[F05-001]` diz que não existe exclusão de conta e que ela é obrigação
legal. Quando ela for construída, ela **vai** precisar apagar (ou anonimizar) snapshots — e vai
encontrar um gatilho que impede alterar o `payload` e nenhum que impeça remover a linha. Ou seja: o
caminho legal disponível é justamente o **menos** auditável (sumir com o registro), enquanto o mais
auditável (anonimizar o payload, mantendo o registro contábil) está **bloqueado pelo gatilho**.

Isso não é defeito de hoje. É a informação que a decisão de P-010 precisa ter na mesa: **a forma do
gatilho empurra a exclusão de conta para a solução mais destrutiva**, e mudar isso depois de existir
snapshot em produção é migração, não patch.

---

## Não verificado nesta fase

1. **O comportamento do outbox sob quota cheia de IndexedDB** — o que acontece quando o `set` falha
   por espaço. Há caminho de erro (`failed`), mas não construí o caso.
2. **A corrida entre duas abas com o mesmo uid** — há Web Locks, e há degradação graciosa quando a
   API não existe (`locks ? … : fn()`). No navegador sem Web Locks a trava vira no-op; não medi qual
   é a superfície real disso (Safari antigo?).
3. **Restauração a partir de backup** — se um `pg_restore` roda com `session_replication_role =
   replica`, o `ENABLE ALWAYS` faz o gatilho disparar durante a restauração, o que pode **impedir**
   restaurar dados legítimos. Não testei; é a contrapartida da escolha certa, e vale saber antes do
   primeiro backup real. → `PENDENCIAS.md` §P-012.
