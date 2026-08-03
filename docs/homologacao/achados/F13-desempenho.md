# F13 — Desempenho

## Resumo

**A matemática não é o gargalo, e agora isso está medido em vez de suposto**: precificar 3 canais custa
**0,11ms** — 0,68% de um quadro de 60fps —, validar o catálogo inteiro de 56 KB com Zod custa
**0,27ms**, e o cálculo escala **linearmente** (sem N²). O backend é estruturalmente imune a N+1 por
carga preguiçosa: **zero `relationship()` declarada**, zero consulta dentro de laço, e os índices
parciais compostos batem exatamente com a paginação keyset.

O custo real está em dois lugares, e os dois foram medidos em navegador com CPU e rede estranguladas:

1. **A primeira visita.** Um chunk único de 903 KB, **zero divisão de código** e um `<div id="root">`
   vazio ⇒ em celular fraco com 3G o vendedor olha para **7,1 segundos de tela em branco**.
   **Mas o PWA resgata**: a segunda visita cai para **157ms (−98%)** e o app abre **offline em 271ms**.
   O problema é exclusivamente a primeira visita — que é justamente o momento da aquisição.
2. **Cada tecla digitada na calculadora** custa **15,6ms (mediana) em celular médio** e **25,2ms em
   celular fraco**, com picos de **42,7ms**. Como o cálculo custa 0,11ms, **99,3% disso é
   re-renderização do React** — não a conta.

Seis achados: **quatro Médios, dois Baixos, nenhum bloqueante**.

---

## Como medi

- **Navegador real** (Chromium via Playwright), viewport 360×800, cache desabilitado, estrangulamento
  de CPU e rede pelo CDP. Servidor: `vite preview` local sobre o `dist/` versionado.
- **Cálculo puro**: `pricing-core` empacotado com esbuild para o scratchpad e cronometrado sob
  `node v24.14.0` — **nenhum arquivo do repositório foi criado ou alterado** (R8).
- **Ressalvas honestas**: é `preview` local (sem CDN, sem latência de servidor real); o
  estrangulamento de CPU do Chromium é uma aproximação de aparelho; e cada perfil rodou **uma vez**,
  não em amostra repetida. As ordens de grandeza são sólidas; os milissegundos exatos, não.

---

## O que está certo, e vale registrar

| verificação | resultado |
| --- | --- |
| N+1 por carga preguiçosa | **impossível por construção** — zero `relationship()` no modelo |
| consulta dentro de laço | **zero** (39 `execute` no app, nenhum em `for`/`while`) |
| achatamento deliberado de consultas | `backend/app/api/boms.py:546` — comentário explícito: *"Flat query count regardless of how many kits: 1 + 1 + 3, never one round-trip per line"* |
| índices | 18 criados; parciais compostos `(owner_uid, created_at, id) WHERE deleted_at IS NULL` — batem **exatamente** com a paginação keyset |
| escala do cálculo | **linear**: 1→10 canais = 0,039→0,399ms |
| Sentry replay/feedback/tracing | **0 ocorrências** no bundle — o *tree-shaking* funcionou |
| fontes | 6 woff2 (~145 KB), **todas** `font-display: swap` |
| PWA offline | **abre em 271ms** em modo avião |
| cache do cliente | `staleTime` deliberado e documentado por consulta (5min catálogo, 60s histórico/cenários) |

### Os números do cálculo

| operação | por chamada | % de um quadro (16,7ms) |
| --- | --- | --- |
| `computeCalculator`, 0 canais | 0,025ms | 0,15% |
| `computeCalculator`, 3 canais | **0,113ms** | **0,68%** |
| `computeCalculator`, 10 canais | 0,399ms | 2,39% |
| `computeBom`, 50 peças × 3 canais | 6,64ms | 40% |
| `parseFeeCatalog` (Zod, 56 KB, 79 entradas) | 0,271ms | 1,6% |

Até o pior caso que consegui construir — um kit de 50 peças com 3 canais cada — cabe dentro de um
quadro. **A fórmula não é o problema, e nunca foi.**

---

## Achados

### [F13-001] A primeira visita é 7,1 segundos de tela em branco em celular fraco

- **Severidade**: **Médio**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% quanto aos números medidos; a ressalva do `preview` local vale
- **Local**: `apps/web/vite.config.ts` (sem `manualChunks`), `apps/web/src/app/router.tsx`
  (11 rotas, **nenhuma** com carga preguiçosa), `apps/web/dist/index.html` (`<div id="root">` vazio)

**Medido** (360×800, cache frio, `/calcular`):

| perfil | 1º texto na tela | duração do JS |
| --- | --- | --- |
| desktop, sem estrangulamento | 238ms | 122ms |
| celular médio (CPU 4x, 4G lento) | **2.111ms** | 1.583ms |
| celular fraco (CPU 6x, 3G) | **7.234ms** | 6.165ms |

O FCP e o primeiro texto em `#root` são praticamente o mesmo instante (2.088 vs 2.111ms): **nada
aparece antes do bundle terminar**. Não há esqueleto, não há casca estática — o HTML servido tem um
`<div>` vazio e mais nada.

E `/` custa **o mesmo** que `/calcular`, o que confirma empiricamente o que o código diz: há **um só
chunk**. Quem abre a calculadora baixa o compositor de kits, o painel de cobrança e o histórico junto.

**A metade que salva o achado de ser pior**: o service worker resolve a repetição por completo.

| visita | 1º texto (celular fraco, 3G) |
| --- | --- |
| 1ª (frio) | 7.135ms |
| 2ª (SW instalado) | **157ms** |
| 3ª | 157ms |
| offline, modo avião | **271ms — abre** |

**−98%.** O PWA está bem feito. O problema é **só** a primeira visita — que é exatamente onde a
calculadora grátis precisa converter um desconhecido. Cruza com `[F11a-003]`: a promessa "a
calculadora é grátis" não lidera a página, e agora sabemos que ela também demora até 7s para
aparecer.

**Conserto (não aplicado — R8)**: dividir o bundle por rota (as 11 rotas já são a fronteira natural) e
pôr uma casca estática no `index.html` para que algo apareça antes do JS. Nenhum dos dois muda
comportamento.

**Também ausente**: não há **orçamento de tamanho de bundle no CI** — nada impede o chunk de crescer.

---

### [F13-002] Toda leitura protegida é precedida de uma escrita com commit

- **Severidade**: **Médio**
- **Bloqueia provisionamento**: **não** — mas é o achado que pior envelhece com o número de usuários
- **Certeza**: 100%
- **Local**: `backend/app/entitlement/__init__.py:43-52`, chamado em `:87` e `:100`
- **Alcance medido**: **50 usos** de `require_entitlement` / `require_catalog_read` em **8 módulos**
  de API (`billing`, `boms`, `export`, `filaments`, `history`, `printers`, `products`, `scenarios`)

`ensure_account` faz um `INSERT ... ON CONFLICT DO UPDATE` gravando `last_seen_at` e **dá `commit`**
(`:52`) **em toda requisição protegida** — inclusive nas que só leem.

O propósito é legítimo (provisionar a conta a partir dos claims verificados, D1). A consequência é que
**toda listagem de catálogo abre uma transação de escrita antes de ler**: um `UPDATE` de linha por
requisição, com o bloqueio de linha por conta, o WAL e as tuplas mortas que isso gera. Não é lento com
um usuário; é o tipo de coisa que se descobre com muitos.

**Conserto (não aplicado — R8)**: separar o provisionamento (uma vez, na primeira requisição da
sessão) do carimbo de `last_seen_at` (assíncrono, amostrado, ou com granularidade de minutos em vez
de por requisição).

---

### [F13-003] O ledger inteiro é carregado a cada requisição protegida

- **Severidade**: **Baixo**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100%
- **Local**: `backend/app/entitlement/__init__.py:57-60`

```python
select(EntitlementGrant).where(EntitlementGrant.account_uid == uid)
```

**Sem `LIMIT`, sem `ORDER BY`, sem filtro de `revoked_at`/`expires_at`** — a filtragem acontece em
Python (`:64-66`). O ledger é **append-only e ilimitado** por decisão de arquitetura (ADR-0012), e o
E6 acrescentou escritores: carência, cobrança repetida, estorno. O crescimento é O(eventos de
cobrança), não O(meses).

Em números de hoje é irrelevante (dezenas de linhas). Registro porque **a consulta não tem teto por
construção**, e o filtro que hoje roda em Python cabe inteiro num `WHERE` que o índice
`ix_entitlement_grants_account_uid` já atende.

**É a mesma função onde vive o `[F04a-001]`** (`:69`, `max(active, key=granted_at)` — o grant mais
recente em vez do mais distante). Um conserto passa pelo outro.

---

### [F13-004] Quatro listas do catálogo não têm limite — e as duas listas irmãs têm

- **Severidade**: **Médio**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100%
- **Local**: `backend/app/api/filaments.py:121`, `printers.py:122`, `products.py:447`,
  `boms.py:546` — nenhuma com `.limit()`; cliente sem virtualização (**zero** ocorrência de
  `react-virtual`/`react-window` em `apps/web/src`)

| endpoint | paginação |
| --- | --- |
| `history` | **keyset**, `limit` 1..100, padrão 50 |
| `scenarios` | **keyset**, `limit` 1..100, padrão 25 |
| `filaments` | **nenhuma** |
| `printers` | **nenhuma** |
| `products` | **nenhuma** |
| `boms` | **nenhuma** |

Um vendedor com 500 produtos recebe 500 registros num JSON, o cliente renderiza 500 nós no DOM sem
virtualização, e o cache grava a lista inteira no IndexedDB.

**O que torna este achado a quinta instância do padrão que domina esta auditoria**: a cura existe no
mesmo repositório, no módulo ao lado. O histórico e os cenários foram paginados por keyset **com
índice parcial composto feito sob medida** — e o catálogo, escrito antes, nunca herdou. Igual aos
imports sem extensão, ao `then(run, run)`, ao `?? 0` e ao NBSP do `formatBRL`.

E o `boms.py` prova que a equipe conhece o assunto: ele **achatou deliberadamente** a contagem de
consultas e escreveu o porquê. Resolveram o N+1 e não o tamanho da página.

---

### [F13-005] Cada tecla na calculadora custa 15,6ms em celular médio — e 99,3% disso é re-render

- **Severidade**: **Médio**
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% (medição com **controle positivo**: a tela mudou nas três execuções)
- **Local**: `apps/web/src/pages/calcular/calcular-page.tsx:209` (`const values = watch()`), com
  **zero** `useMemo`/`useCallback`/`memo` em toda a feature da calculadora

**Medido** (após o boot, 21 campos na tela, digitando em `costPerRoll`):

| CPU | mediana por tecla | máximo |
| --- | --- | --- |
| 1x (desktop) | 2,40ms | 5,40ms |
| **4x (celular médio)** | **15,60ms** | 24,40ms |
| **6x (celular fraco)** | **25,20ms** | 42,70ms |

Um quadro de 60fps é 16,7ms. Em celular médio a mediana já come **93% do quadro** e o pico o
ultrapassa; em celular fraco **toda tecla perde quadros** e o pico vale 2,5 quadros.

**A atribuição é o que dá valor ao achado**: o cálculo em si custa **0,11ms** (medido acima). Logo
**99,3% do custo é reconciliação do React** — `watch()` sem argumentos assina **todos** os campos, e a
página inteira mais a árvore do formulário (509 + 728 linhas) re-renderizam a cada tecla.

**E aqui é preciso ser justo com quem escreveu isso.** O comentário em `calcular-page.tsx:77-79`
registra que a memoização foi **removida de propósito**: `useMemo([values.channels])` nunca
recomputava, porque o RHF muta o array no lugar e a referência não muda. **A remoção foi certa** — um
preço silenciosamente velho é pior do que um preço lento, e essa é a ordem de prioridade correta num
produto que calcula dinheiro.

O que caducou foi a **conclusão** escrita em `:220-221` — *"isto não precisa de memoização"*. Sem
medição, era uma aposta razoável. Com medição, ela é falsa em celular médio.

**Conserto (não aplicado — R8)**: nada que envolva memoizar por referência, que foi o bug original. Os
caminhos honestos são assinar por campo (`useWatch` com nome) em vez do formulário inteiro, memoizar
por **valor** (chave derivada do conteúdo, não da referência), ou isolar a árvore de resultados. Isto
precisa de projeto, não de remendo — e o critério de aceite tem de ser **medido**, não presumido:
mediana por tecla abaixo de um quadro a 4x.

---

### [F13-006] `computeCalculator` derruba a conta inteira por causa de um canal — o contrário do que sua própria documentação promete

- **Severidade**: **Baixo** (robustez; **não alcançável hoje**)
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% quanto ao comportamento; 100% quanto à inalcançabilidade pelo catálogo
- **Local**: `packages/pricing-core/src/index.ts:46-48` (a promessa), `channels.ts` (`grossUpOnce`)

`packages/pricing-core/src/index.ts:46-48` documenta o SC-107:

> *"A slot that fails its own validation carries an `error` and null prices — its siblings still
> compute (per-slot isolation, SC-107); **the engine never throws for one bad channel**."*

**Medido, com controle positivo:**

| caso | resultado |
| --- | --- |
| canal bom sozinho | OK — anúncio R$ 94,95 |
| canal bom **+** canal com banda sem `commissionPct` | **LANÇA** `[DecimalError] Invalid argument: undefined` — **o canal bom morre junto** |
| a mesma dupla em ordem invertida | **LANÇA** (não depende da ordem) |
| **controle**: canal bom + canal com comissão 150% | **não lança** — isola corretamente: `error: "commissionPct must be a finite number in [0, 100)"` |

O controle é o que prova o achado: o isolamento por slot **funciona** para a invalidez que o motor
valida, e **não existe** para a que ele não valida. A promessa "nunca lança" vale só para o primeiro
conjunto.

**Por que continua Baixo, e eu não inflo**: o caminho pelo catálogo está **fechado**. O guard do 014
em `apps/web/src/shared/fee-catalog/fee-catalog.ts:112` exige que *toda* banda carregue comissão, e
`entryToChannelFees` ainda mapeia `b.commissionPct ?? 0`. São duas barreiras antes do motor.

É **defesa em profundidade**, não defeito vivo — e o registro que importa é o outro: **um invariante
documentado em maiúsculas ("never throws") que não vale**. Documentação que promete mais do que o
código entrega é a mesma classe do `[F02-000]`.

---

## Não verificado nesta fase

1. **Desempenho com dados reais em volume.** Medi a calculadora com o formulário vazio/padrão. Não
   construí uma conta com 500 produtos para ver o `[F13-004]` doer — exigiria semear o banco, e a R8
   me proíbe de tocar em migração ou seed.
2. **Latência real de rede e de servidor.** Tudo foi `vite preview` em `localhost`. O tempo de
   resposta do Cloud Run, o *cold start* e a distância até `southamerica-east1` não existem aqui — e
   não existirão até o provisionamento.
3. **Amostra estatística.** Cada perfil rodou uma vez. As ordens de grandeza (238ms vs 7.234ms;
   2,4ms vs 25,2ms) são grandes demais para serem ruído, mas eu não afirmo os milissegundos exatos.
4. **Memória e vazamento em sessão longa.** Não medi heap ao longo do tempo. O
   `use-catalog.test.tsx` já mostrou `QueryClient` não desmontado em teste (a CI intermitente do
   US5/US8) — se isso tem análogo em produção, eu não sei.
5. **Custo do `computeBom` na tela.** Medi a função (6,64ms para 50 peças). Não medi o kit composer
   renderizando 50 linhas — pelo `[F13-005]`, o re-render deve dominar aqui também, mas **isso é
   inferência e fica como pergunta**, não como fato.
