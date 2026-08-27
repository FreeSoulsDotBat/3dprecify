# ADR-0033: Observação de preço, fixação de preço e unicidade de nome — como o Catálogo ganha dado novo sem virar fonte de preço

- **Status**: Proposed (o dono flipa para Accepted no gate da PR-D do 019)
- **Date**: 2026-08-26
- **Deciders**: Jonatan (owner — Q3/Q4/Q5 no clarify de 2026-08-26) + arquiteto (019-porte-design)
- **Escalação**: domínio de pricing (leaf de dinheiro + migração) ⇒ **opus**, por ADR-0022
- **Estende**: ADR-0013 (stack de persistência) · **Relaciona**: ADR-0008 (o backend nunca recomputa) ·
  ADR-0015 (o servidor é o gate) · ADR-0017 §6 / ADR-0019 §5 (referência sem FK, degradação em leitura) ·
  ADR-0021 (intenção guardada, valor resolvido ao vivo)

## Context

O E2 estabeleceu um invariante e o escreveu no modelo, em inglês e em maiúsculas:

> `backend/app/models/__init__.py:198-204` — *"NO price column exists anywhere — prices are recomputed
> client-side with the current `PRICING_MODEL_VERSION` (FR-310/FR-313)."*

A US13/US14 do 019 empurram na direção oposta: *"3 preços mudaram desde a sua última visita"* precisa
de um preço anterior guardado, e *"Preço fixado por você"* precisa do número que o vendedor anunciou.
O dono decidiu as duas no clarify de 2026-08-26 (Q3 = **servidor**; Q4 = **o número final**), sabendo
que isso traz migração, escalação opus e Clarification datada na 007.

O invariante, porém, **não é uma proibição de guardar dinheiro** — é a proibição de o app exibir um
preço que ele calculou no passado. Esta é a distinção que este ADR faz, e é o que permite atender as
duas histórias sem desfazer o E2.

**Fatos medidos (2026-08-26, leitura direta):**

- `products` não tem coluna de preço e **nenhuma** `UniqueConstraint` de nome
  (`models/__init__.py:206-288`); `filaments`, `printers` e `boms` também não.
- **Escritas de catálogo são ONLINE-ONLY, sem outbox** (`entities/catalog/use-catalog.ts:42,176`;
  `entities/bom/use-bom.ts:32`). O outbox (ADR-0018) é **exclusivo do Histórico**. Consequência direta:
  *"dois aparelhos criam Gancho offline"* **não é um cenário alcançável hoje** — o que sobra de real é a
  corrida entre dois aparelhos **online**.
- A última migração é `0007_remove_waste.py` ⇒ a desta fatia é a **0008**.
- O preço só existe no cliente: o backend nunca chama o motor (ADR-0008), e o motor é TS
  (`packages/pricing-core`, 4.1.0).

## Options considered

### Eixo 1 — onde mora a observação de preço ("era R$ 38,90" + "Salvo em 12/05")

#### Opção 1A — Colunas em `products` (`last_observed_price`, `last_observed_at`)
- **Prós**: uma tabela a menos; vem junto no payload que a lista já lê.
- **Contras**: põe uma coluna de dinheiro **na linha do produto**, a um `SELECT` de distância de ser
  lida como "o preço do produto". O invariante do E2 deixa de ser verificável por inspeção (hoje ele é:
  *não existe coluna de preço em `products`*), e todo leitor futuro precisa entender uma sutileza em vez
  de ver uma ausência.
- **Escalabilidade**: negativa — a próxima coluna "quase-preço" entra sem atrito nenhum.
- **Confiança de que produziria um uso indevido em dois incrementos**: 65%.

#### Opção 1B — Tabela própria `product_price_observations`, **append-only** (uma linha por visita)
- **Prós**: trilha completa; combina com o vocabulário de "ledger" da casa.
- **Contras**: crescimento **ilimitado** sem que nada leia o histórico — 200 produtos × uma visita por
  dia = ~73 mil linhas por conta por ano, das quais só a última é usada. Um append-only existe quando as
  linhas antigas são **prova** (E4/E6); uma observação não prova nada, é um marcador de leitura.
- **Escalabilidade**: negativa (poda vira dívida no dia 1).
- **Confiança**: 35%.

#### Opção 1C — Tabela própria, **uma linha por (conta, item)**, atualizada no lugar (ESCOLHIDA)
- **Prós**: `products` continua **literalmente** sem coluna de preço — o invariante segue verificável
  por ausência; o dado que ninguém consulta não cresce; a tabela tem nome que diz o que ela é
  (*observação*, não preço); é servida e cacheada separada, então o payload do produto não ganha
  dinheiro nenhum.
- **Contras**: uma requisição a mais ao abrir o Catálogo; o cliente junta duas listas por id.
- **Escalabilidade**: alta — kits entram na mesma tabela por discriminador, sem migração nova.
- **Confiança**: 80%.

### Eixo 2 — o que é "preço fixado" fisicamente (Q4 = o número final)

- **2A — coluna nullable em `products`** (`seller_fixed_price`, `seller_fixed_at`) — **ESCOLHIDA**.
  Prós: é a leitura literal da decisão do dono ("guardado no produto"); um `NULL` é o estado "não
  fixado", sem tabela paralela e sem join; o prefixo `seller_` faz qualquer uso indevido **ler errado
  em voz alta**. Contras: é dinheiro em `products`, exatamente onde o docstring diz que não há — por
  isso o docstring é **reescrito na mesma migração** e a 007 ganha Clarification (§Decision 5).
  Confiança: 80%.
- **2B — tabela `product_price_pins`**. Prós: `products` fica intocado. Contras: um join para um dado
  1-para-1 que é atributo do produto, e "fixado" some da linha que descreve o produto — a Ressalva 4 do
  PO (três noções de preço parado) piora, não melhora, com o dado escondido. Confiança: 45%.
- **2C — dentro de um JSONB**. Contras: dinheiro sem `CHECK` do banco por nada; `products` é uma tabela
  tipada, e o precedente de JSONB (E4/E5) existe por imutabilidade e polimorfismo, que aqui não há.
  Confiança: 20%.

### Eixo 3 — unicidade de nome (Q5: por conta + tipo, sem maiúscula e sem acento)

- **3A — extensão `unaccent` + índice funcional**. Contras: `unaccent()` **não é IMMUTABLE**, então não
  entra num índice sem uma função wrapper marcada à mão; e passa a exigir uma extensão provisionada no
  Cloud SQL — dependência de infra para uma regra de texto.
- **3B — coluna `name_norm` normalizada pela APLICAÇÃO + índice único parcial** — **ESCOLHIDA**.
  Prós: determinístico, sem extensão, testável como função pura nos dois lados, e o índice é btree
  comum; `WHERE deleted_at IS NULL` impede que um item apagado bloqueie o nome dele para sempre.
  Contras: a normalização existe **duas vezes** (Python no servidor, TS no cliente que avisa antes de
  gravar) — mitigado por um **vetor de teste compartilhado** exercitado nos dois. Confiança: 80%.
- **3C — só na aplicação, sem índice**. Contras: duas requisições simultâneas passam as duas; a regra
  vira intenção. Confiança: 15%.

## Decision

### 1. A distinção que governa tudo isto

> O app **nunca exibe um preço que ele mesmo calculou no passado**. Ele exibe **o cálculo de hoje** ou
> **o número que o vendedor declarou**. Uma observação guardada é *contexto* ("era"), nunca *fonte*; um
> preço fixado é *declaração do vendedor*, nunca *cálculo guardado*.

FR-310/FR-313 continuam valendo com esta redação. Todo teste desta fatia mede a propriedade nessa forma
(existe um caminho em que um valor guardado alimenta o número GRANDE? deve ser **zero**).

### 2. Observação de preço — Opção 1C

- **Tabela `price_observations`** (0008, aditiva): `id` uuid7 · `owner_uid` FK → `accounts` (a **única**
  FK) · `subject_kind` TEXT `CHECK IN ('PRODUCT','KIT')` · `subject_id` uuid **sem FK** (o precedente
  ADR-0019 §5 / ADR-0021 N2: um id que resolve ou não resolve, nunca uma FK que escreve na linha alheia)
  · `observed_price` `MONEY_SETTLED NOT NULL` com o guarda `>= 0 AND <> 'NaN'` da casa · `observed_at`
  timestamptz `NOT NULL` · `model_version` TEXT `NOT NULL` · `catalog_version` TEXT NULL ·
  `created_at`/`updated_at`. **`UNIQUE (owner_uid, subject_kind, subject_id)`** — uma linha por item.
- **Quem escreve é o CLIENTE**, porque é o único que sabe calcular (ADR-0008: o backend nunca recomputa).
  O servidor **valida e guarda**; ele não deriva, não compara e não conta. A frase "3 preços mudaram" é
  **derivada no cliente**, comparando o recomputado de hoje com a observação lida.
- **Quando escreve**: ao abrir a lista, **depois** de um recompute bem-sucedido de todos os itens
  exibidos — uma requisição em lote (`PUT`), idempotente por item.
- **A assimetria que define o modo de falhar**: se a escrita falhar, a marca **não avança** e o vendedor
  vê o mesmo aviso na próxima visita. Isto é honesto (repete uma verdade). O contrário — escrever sem
  ter exibido — **esconderia** uma mudança real, e é proibido: a escrita acontece **depois** do render,
  nunca antes.
- **Ausência é ausência**: sem observação, a linha **não diz nada** — nem "0 preços mudaram", nem
  "era R$ 0,00" (FR-1913).
- **Online-only, sem outbox.** Não entra no outbox do Histórico e não nasce um segundo outbox: uma
  observação perdida custa uma repetição de aviso, nunca um dado do vendedor. (Ver §5 — a PR-B proíbe
  qualquer escrita nova na fila.)
- `model_version`/`catalog_version` são guardados para que um "era R$ X" produzido por outra versão do
  motor ou por outra tabela de tarifas possa, no futuro, ser explicado sem adivinhação. **Nesta fatia
  eles não mudam o comportamento** — são registro, não regra.
- **Superfície**: `GET /api/v1/price-observations` (lista da conta) e `PUT /api/v1/price-observations`
  (lote). Recurso **separado** do produto de propósito: `ProductOut` continua sem nenhum campo de
  dinheiro, e isso segue verificável no contrato congelado pelo drift-guard.

### 3. Fixação de preço — Opção 2A

- `products` ganha `seller_fixed_price` `MONEY_SETTLED NULL` (com o `CHECK` `NULL OR (>= 0 AND <>
  'NaN')`) e `seller_fixed_at` timestamptz NULL. `NULL` = acompanhando o custo. Desfixar é `NULL` de
  volta — sem etapa intermediária, sem perder o item.
- **Fixado, o número exibido é o do vendedor; o custo continua sendo recomputado ao lado**, e é a
  comparação `custo de hoje > preço fixado` que produz o aviso em tom ATENÇÃO (US2/ADR-0032). O produto
  **nunca desfixa sozinho** (decisão do dono).
- **O preço fixado NÃO entra em composição.** `computeBom` compõe kits a partir de **entradas**, e o
  construtor da PR-E vende **direto ao cliente** (Q6: marketplace fora). O número fixado é o **preço do
  anúncio** — que embute a comissão do marketplace —, então usá-lo como preço unitário de venda direta
  cobraria do cliente uma comissão que não existe naquela venda. Regra: **fixar é do Catálogo**; kit,
  orçamento e cenário seguem o motor. Confiança de que a leitura ingênua ("fixou, vale em tudo")
  produziria um número plausível e errado: **80%**.
- Fixar **não** congela orçamento e **não** toca o Histórico (US14 AC3): as duas prateleiras do E4/E5
  continuam sendo o que são, e esta é a terceira noção — nomeada, com verbo próprio, e **sem** escrever
  em nenhuma das outras duas (a Ressalva 4 do PO fica registrada como risco de LEITURA, endereçado pelo
  `designer-ux` na tela, não pelo dado).

### 4. Unicidade de nome — Opção 3B

- Cada tabela de catálogo (`filaments`, `printers`, `products`, `boms`) ganha `name_norm` TEXT NOT NULL
  e um **índice único parcial** `(owner_uid, name_norm) WHERE deleted_at IS NULL`. "Por tipo" cai de
  graça: são tabelas diferentes, então filamento e produto podem coincidir (decisão do dono).
- **Normalização (uma definição, dois idiomas)**: `NFD` → remover marcas combinantes (categoria `Mn`) →
  minúsculas (`str.lower()` no Python, `toLowerCase()` no TS — **não** `casefold()`, que diverge do
  `toLowerCase` em `ß`) → `trim` → colapsar espaços internos em um. Um **vetor de casos compartilhado**
  (mesmo arquivo de fixture, lido pelos dois testes) prova que as duas implementações concordam;
  divergir é defeito, e o servidor é a autoridade.
- **Um comportamento no servidor: conflito ⇒ renomeia com sufixo, em silêncio** (decisão do dono, Q5).
  A recusa "já está no catálogo" é do **formulário**, no cliente, antes de enviar. É por isso que o
  servidor precisa de uma regra só: online o vendedor quase nunca a alcança (o formulário barrou), e a
  corrida real entre dois aparelhos resolve sozinha, sem descartar nada (R6 respeitado).
- **O que a Q5 NÃO autoriza**: criar fila offline para o catálogo. Medido: escritas de catálogo são
  online-only e não há outbox. O "caminho offline do conflito" da FR-1915 é exercitado como **corrida de
  concorrência no servidor** (duas criações simultâneas com o mesmo nome normalizado ⇒ uma renomeada,
  nenhuma perdida), não como teste de outbox.

### 5. Clarification datada — texto para `specs/007-e2-catalog-entitlement/spec.md`

*(O `plan` aplica; este ADR não edita a 007.)*

> ### Clarification 2026-08-26 (019 / PR-D — Q3/Q4 do clarify de 019, ADR-0033)
>
> **FR-310 e FR-313 passam a admitir dois valores monetários guardados no catálogo, e continuam
> proibindo um terceiro.** O invariante do E2 — *"o preço exibido é sempre o recomputado de hoje"* —
> vale sem exceção e ganha a redação que o torna verificável: **o app nunca exibe um preço que ele mesmo
> calculou no passado; exibe o cálculo de hoje ou o número que o vendedor declarou.**
>
> Passam a existir, e são **nomeadamente** distintos de "preço":
> 1. **Observação de preço** (tabela `price_observations`, uma linha por conta+item): o último valor
>    recomputado que o vendedor **viu**, com a data. Serve à frase "era R$ …" e à contagem de preços
>    mudados desde a última visita. **É escrita pelo cliente** (o backend continua sem recomputar,
>    ADR-0008) e **nunca** alimenta o valor exibido; ausência significa "nada a dizer", nunca "R$ 0,00".
> 2. **Preço fixado pelo vendedor** (`products.seller_fixed_price`, nullable): o número do anúncio,
>    declarado por ele. Enquanto existir, é ele que a tela mostra — como **declaração**, não como
>    cálculo —, e o custo continua sendo recomputado ao lado para avisar (tom ATENÇÃO) quando o
>    ultrapassar. Nunca desfixa sozinho; desfixar volta ao recomputado de hoje. **Não participa de kit,
>    orçamento ou cenário**: composição é sempre pelo motor.
>
> Continua **proibido**: guardar preço calculado como fonte de exibição, o backend recomputar qualquer
> preço, e `ProductOut` carregar campo de dinheiro derivado de cálculo. Migração `0008` (aditiva);
> escalação **opus** registrada (ADR-0022).

## Consequences

- **Positivo**: `products` continua sem coluna de preço **calculado**, e o único dinheiro que entra lá é
  declarado pelo vendedor e nomeado como tal; a contagem e o "era R$ X" existem em qualquer aparelho
  (Q3 = servidor) sem que o servidor calcule nada; a unicidade vira propriedade do banco, não intenção
  da aplicação; nada é descartado num conflito.
- **Negativo / aceito**: uma tabela e uma requisição a mais no Catálogo; a normalização de nome existe
  em dois idiomas (com vetor comum como cinto de segurança); a marca de última visita avança ao abrir a
  lista, então recarregar a página "some" com o aviso da visita anterior — comportamento correto para
  *"desde a sua última visita"*, mas visível; e `products` passa a ter um `CHECK` de dinheiro que o
  docstring precisa explicar em vez de negar.
- **Risco declarado**: um leitor futuro tratar `seller_fixed_price` como "o preço". Mitigações: o
  prefixo, o docstring reescrito, a Clarification na 007 e um teste de propriedade que varre os
  caminhos de exibição — se algum número GRANDE puder vir de uma observação, o teste fica vermelho.
- **Follow-ups**: kits entram em `price_observations` pelo discriminador que já existe, sem migração; se
  algum dia alguém precisar do histórico de observações (e não só da última), isso é uma tabela nova de
  **evidência**, com dono e razão próprios — não um `INSERT` a mais nesta.
