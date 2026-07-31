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

## Pendente para o merge

- [ ] Homologação visual (`qa-produto`) do PR #31.
- [ ] Autorização do dono para o squash-merge em `develop` (ADR-0006).
