# F06 — Ingestão de tarifas (014)

## Resumo

Os guardas da ingestão são **densos e bem postos**: piso de linhas, canárias que checam o PAR
(comissão, mínimo por item) e não só a comissão, recusa de data inválida, sequência de
`catalogVersion` por conteúdo, colisão de `categoryId`, cobertura de bandas, e um teto de linhas
alteradas com denominador por marketplace. Cada um deles nasceu de um defeito real e o comentário
diz qual — é documentação que se paga.
**Nenhum achado de correção.** Mas há uma **consequência datada** que ninguém registrou e que esta
auditoria existe para pegar: o selo de frescor é honesto e **vai começar a avisar que os dados estão
velhos em 2026-08-21** (para as entradas da Shopee) e **2026-09-11** (para as da Amazon), porque o
laço mensal que renovaria o `lastReviewed` **não dispara**. Não é defeito do selo — é o selo fazendo
exatamente o que deve, sobre um abandono que o provisionamento vai tornar visível ao vendedor.

---

## Os guardas, e o que cada um cobre

| guarda | onde | o que pega | o que NÃO pega |
| --- | --- | --- | --- |
| piso de linhas (`minRows` = 28) | `guardrails.ts:36` | encolhimento da fonte | **crescimento** — 200 linhas passariam |
| canárias | `:41-57` | leitura de coluna errada — e checa o **PAR** (comissão **e** mínimo por item) | mudança numa categoria que não é canária |
| `checkBandCoverage` | `:85` | bandas sobrepostas ou fronteira impossível | lacuna publicada (é permitida, FR-014a) |
| `checkCategoryIdCollisions` | `:159` | dois nomes que colapsam no mesmo id (acento/caixa) | — |
| `collectedAtFor` | `:192` | `--from` sem `COLLECTED_AT` — carimbar hoje sobre tabela velha | — |
| `validarData` | `:~215` | `COLLECTED_AT=banana`, data não-calendário, data futura | — |
| `nextCatalogVersion` | `:129` | conteúdo diferente sob rótulo idêntico | — |
| teto de linhas alteradas (50%, mín. 10 entradas) | `refresh.ts:23,34` | mudança **em bloco** que escape das canárias | mudança pontual (é o caso normal, vai a PR) |

**O que me convenceu de que os guardas são reais e não decorativos**: cada um carrega, no comentário,
o defeito que o originou e como foi medido. `validarData` documenta que `COLLECTED_AT=banana` saía
com **exit 0** escrevendo `lastReviewed: "banana"` em 78 entradas, com a suíte inteira passando e
`isStale` devolvendo `false` para sempre. Um guarda que sabe dizer de que morte nasceu é um guarda
que alguém vai pensar duas vezes antes de remover.

### Três coisas que verifiquei e estão certas

1. **A canária checa o par, não só a comissão.** Um deslocamento de coluna que mantivesse o
   percentual e zerasse o mínimo passaria por uma canária que só olhasse a comissão. O código olha os
   dois (`:47` e `:52`).
2. **O piso é o certo para a direção do risco.** Uma leitura de coluna errada encolhe o parse; uma
   fonte que cresce vai para `addedCategories`, e `mayAutoMerge` exige **todas** as listas vazias —
   então crescimento não aborta, mas também **não passa sem revisão humana**. É a escolha certa:
   abortar num crescimento legítimo seria o falso positivo mensal que treina o revisor a ignorar.
3. **A recusa por unidade.** Se a Amazon publicasse a comissão como fração (`0.15`) em vez de
   percentual (`15%`), o `parsePct` exige o `%` e a célula vira `UNRECOGNISED`, que **lança** — o
   parse inteiro morre em voz alta em vez de publicar 0,15% sob selo de referência.

---

## Achado

### [F06-001] O selo de frescor vai começar a avisar em 2026-08-21, e o laço que o calaria não dispara

- **Severidade**: **Médio**
- **Bloqueia provisionamento**: **não** — mas é a primeira coisa que o vendedor vai ver piorar
  sozinha depois que ele começar a pagar.
- **Certeza**: 100% (datas lidas do artefato, janela lida do código)
- **Local**: `backend/app/data/catalog.json` (as datas) ×
  `apps/web/src/shared/fee-catalog/fee-catalog.ts:18-39` (a janela) × ausência de `fee-refresh.yml`
- **Origem**: `develop`

**Medido.** A janela é `STALENESS_DAYS = LOOP_CYCLE_DAYS(31) + DELIVERY_SLACK_DAYS(14) = 45`, e o
artefato tem **duas** datas de revisão:

| `lastReviewed` | quem | o selo começa a avisar em |
| --- | --- | --- |
| `2026-07-07` | as entradas mais antigas (Shopee) | **2026-08-21** |
| `2026-07-28` | as da Amazon (a curadoria da 014) | **2026-09-11** |

A janela de 45 dias foi dimensionada **exatamente** para tolerar um ciclo mensal mais folga de
entrega. Ela pressupõe que o laço rode. Ele **não roda**: não existe `fee-refresh.yml` (bloqueado no
T069b), e mesmo quando existir o `schedule` do GitHub lê do branch default, que o corte de release
adiado não alcançou.

**Por que isto é achado e não trivialidade**: o selo está **certo** — ele vai dizer a verdade. O que
está errado é o mundo que ele descreve. E o momento é ruim: a primeira data cai **19 dias** depois
desta auditoria, e a segunda logo depois do provisionamento provável. Um vendedor que acabou de
pagar vai ver "esta tarifa pode estar desatualizada" numa tela pela qual ele pagou, e a explicação
("o robô que atualizaria isso nunca foi ligado") não é uma que se queira dar depois.

**Não é conserto de código.** É uma das três coisas: ligar o laço (T049/T050, bloqueado no T069b),
recolher a fonte à mão antes da data, ou decidir conscientemente que o aviso é aceitável. As três são
decisão do dono. → `PENDENCIAS.md` §P-011.

---

## Não verificado nesta fase

1. **A fidelidade dos números curados da Shopee** — as entradas de `2026-07-07` foram curadas à mão.
   Verificar se ainda batem com a política publicada da Shopee exige ler a fonte externa, e nenhuma
   sonda automatizada cobre a Shopee (só ML e Amazon têm `g1-probe`/`g2-probe`). **Esta é a mesma
   lacuna do voucher de frete** (`PENDENCIAS.md` §P-008): eu consigo auditar a mecânica, não a
   fidelidade.
2. **O comportamento do laço ponta a ponta contra a página real da Amazon** — o `build-amazon.mjs`
   tem caminho de rede (Playwright headless) que eu não exercitei; a auditoria olhou o caminho
   `--from`. Exercitar o de rede é ir buscar na fonte, e isso muda o artefato — fora do escopo de
   uma auditoria somente-leitura.
3. **O que acontece se a Amazon mudar a estrutura da página** (não o conteúdo da tabela, mas o
   seletor). O `fetchRows` espera `table tr` e `td,th`; se a página trocar para um layout sem
   `<table>`, o `waitForSelector` estoura em 45s e o job falha — falha ALTA, não silenciosa.
   Confirmado por leitura, não construído.
