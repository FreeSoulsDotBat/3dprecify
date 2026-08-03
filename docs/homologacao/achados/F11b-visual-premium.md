# F11b — Homologação visual do fluxo PREMIUM

## Resumo

Renderei as 5 superfícies premium × 3 larguras (360/768/1440) com dados adversariais — kit de 11 linhas,
nomes de 68–70 caracteres, catálogo com 12 filamentos/8 impressoras/10 produtos, e valores até
R$ 87.885,95 — em **124 screenshots** (`evidencias/f11b/`), com geometria lida do DOM.
**Oito achados; três bloqueiam.** Os dois graves estão em números que o vendedor MOSTRA ao cliente e
são invisíveis a qualquer asserção: (1) no **detalhe congelado do histórico** o `R$` desgruda do valor
— "R$" numa linha, "70.867,77" na outra — **inclusive a 1440px**, num documento que a ADR-0019 torna
imutável; (2) na **carência**, o único caminho de recuperar o pagamento é um `tf-btn--ghost` sem fundo,
sem borda e sem sublinhado, idêntico ao "Recarregar" neutro ao lado, enquanto gratuito/cancelado/
congelado ganham botão roxo preenchido. Zero transbordo horizontal em todas as 15 combinações; os
6 estados de cobrança + o diálogo foram alcançados e medidos; o toast do cancelamento (conserto do
T028/B2) renderiza a 360px. **A [F11a-002] piorou: no total do kit ela quebra nas TRÊS larguras e o
limiar caiu de R$ 10 mil para R$ 1.000.** A [F11a-001] alcançou o formulário de produto do catálogo,
onde o valor errado é SALVO.

---

## Ambiente medido

Pilha subida à mão e conferida antes de qualquer diagnóstico (regra do preview órfão): Postgres :5433
(banco `precifica3d_e2e` recriado + `alembic upgrade head` até `0005`), backend :8100
(`/health` → `{"status":"ok"}`), stub do Mercado Pago :8200 (`/openapi.json` → 200), emulador Firebase
Auth :9099 (`demo-precifica3d`), `vite preview` :4173 servindo um build feito nesta sessão
(`dist/assets/index-CtQ4NiHe.js`). Nenhum processo prévio em 4173/8100/8200 — `netstat` antes de subir.
Branch `012-e6-billing-pr-c`.

Contas: uma premium por grant de operador (`--source beta`) com o catálogo adversarial semeado pela
API própria do app; e **cinco contas descartáveis** para os estados de cobrança (assinatura real pelo
stub + webhooks assinados + expiração forçada em SQL + grant `--source comp`).

Viewports: 360×740, 768×1024, 1440×900, `deviceScaleFactor: 2`.

---

## Alcance dos defeitos herdados da F11a

### [F11a-002] — quebra do número no meio: **mais larga e mais grave do que a F11a mediu**

Não é achado novo, mas a medição mudou o tamanho do problema. O elemento é o mesmo
(`.tf-price__int`, `word-break: break-word` + `overflow-wrap: anywhere`), e em **todos** os casos
`scrollWidth === clientWidth` (a asserção geométrica passa).

| Superfície | Caixa do `__int` | Limiar medido | 360 | 768 | 1440 |
|---|---|---|---|---|---|
| **/kits — Total do kit** | 89px @360 · **149px @768 e @1440** | **≥ R$ 1.000** | quebra | **quebra** | **quebra** |
| /calcular · cenário reaberto | 108px @360 · 124px @768+ | ≥ R$ 10.000 @360 | quebra | ok | ok |
| /historico — lista | — (componente diferente) | — | ok | ok | ok |
| /catalogo — listas | não exibe preço | — | — | — | — |

Medição de largura de texto na fonte real do cartão (`700 40px Inter` @360, `700 60px` @1440),
caixa do kit:

| string | largura @360 (caixa 89px) | largura @1440 (caixa 149px) |
|---|---|---|
| `999` | 77,9px — cabe | 116,9px — cabe |
| `1.000` | **110,4px — não cabe** | **165,5px — não cabe** |
| `87.885` | 133,5px | 200,2px |

**A consequência é pior no kit**, e por dois motivos: o cartão é uma coluna de largura FIXA, então a
tela larga não salva o número; e no mesmo cartão o "Custo total R$ 32.100,07" renderiza **certo numa
linha só** logo acima do preço quebrado — uma tela que mostra um número certo e um errado lado a lado
é mais convincente do que uma que erra os dois. Evidência: `kits-1440-total-card-zoom.png`,
`kits-768-total-card-zoom.png`, `kits-360-compositor.png` (lê-se `87.8` / `85` / `,95`).

### [F11a-001] — campo com afixo dos dois lados: alcança o **formulário do catálogo**

Também não é achado novo, mas a superfície nova é pior. O formulário de produto
(`/catalogo/produtos/novo`) a 360px tem **quatro** campos com afixo dos dois lados, todos estreitos
demais, e nenhum com `maxLength`:

| campo | largura útil @360 | afixos |
|---|---|---|
| `tariffPerKwh` | **33px** | `R$` … `/kWh` |
| `maintenanceReservePerHour` | 55px | `R$` … `/h` |
| `finishRatePerHour` | 55px | `R$` … `/h` |
| `laborRatePerHour` | 55px | `R$` … `/h` |

Teste vivo: digitei `1000,00` em "Tarifa de energia" **no formulário do catálogo** —
`value === "1000,00"`, `scrollWidth 67 > clientWidth 33`, `scrollLeft 33`, e a tela mostra
**`R$ 0,00 /kWh`** (`catalogo-360-campo-1000-zoom.png`). Na calculadora o valor errado polui um
cálculo; **aqui ele é SALVO** e passa a alimentar todo produto, kit, cenário e registro futuro que
referencie esse item. Os formulários de filamento (229–239px) e de impressora (207–239px) não têm o
problema — só o de produto, que empilha dois campos por linha.

---

## Achados

### [F11b-001] O `R$` desgruda do valor no registro congelado do histórico — inclusive a 1440px

- Severidade: **Alto**
- Bloqueia provisionamento: **sim**
- Certeza: **97%**
- Local: `/historico` → detalhe do registro, bloco "Peças do kit". Grade de 3 colunas cuja coluna de
  valor mede **81px** (linha do produto caro) e **70,7px** (linha da peça avulsa) — independente da
  viewport. Causa distinta da [F11a-002]: aqui não é o `overflow-wrap` do `.tf-price__int`, é a
  quebra do espaço entre símbolo e número numa célula estreita.
- Evidência:
  - `historico-1440-detalhe-kit.png` — a linha "Suporte Articulado … · 3 un" mostra **`R$` na primeira
    linha e `70.867,77` na segunda**; a quantidade também parte (`3` / `un`). Idem na última linha:
    `R$` / `1.107,72`.
  - `historico-360-detalhe-kit.png` — a 360 o defeito atinge **7 das 11 peças** (todo valor ≥ R$ 1.000).
  - Geometria: `R$ 70.867,77` → caixa 81px, **2 caixas de linha**, `scrollWidth 81 === clientWidth 81`
    nas três larguras. `R$ 1.107,72` → 70,7px, 2 linhas nas três larguras. A 360, também
    `R$ 1.446,48` / `2.024,96` / `2.700,00` / `3.471,12` / `4.339,30` (todos 2 linhas, 91–92px).
- Impacto: é o documento que o vendedor abre na frente do cliente, e a ADR-0019 o torna **imutável** —
  não há "editar depois". A própria copy do projeto já proibiu essa quebra por escrito no comentário
  T038/D1 (`messages.pt-br.ts:926`: *"Numa linha de PREÇO, separar o símbolo do valor é a única quebra
  que não se permite"*) — a regra existe e não está aplicada aqui. Nenhuma asserção de texto
  (`toContainText("R$ 70.867,77")` passa) nem de transbordo (`delta = 0`) vê isso.

### [F11b-002] Na carência, a ação que salva a assinatura é a única sem botão

- Severidade: **Alto**
- Bloqueia provisionamento: **sim**
- Certeza: **95%**
- Local: `/conta`, painel de cobrança. Estilos computados medidos nos 6 estados:

| estado | ação principal | classe | `background-color` | `border-color` |
|---|---|---|---|---|
| gratuito | Assinar Premium | `tf-btn--primary` | `rgb(120,0,255)` | — |
| cancelado | Assinar novamente | `tf-btn--primary` | `rgb(120,0,255)` | — |
| congelado | Assinar novamente | `tf-btn--primary` | `rgb(120,0,255)` | — |
| **carência** | **Atualizar forma de pagamento** | **`tf-btn--ghost`** | **`rgba(0,0,0,0)`** | **`rgba(0,0,0,0)`** |
| **ativo** | **Gerenciar assinatura** · **Cancelar assinatura** | **ambos `tf-btn--ghost`** | **`rgba(0,0,0,0)`** | **`rgba(0,0,0,0)`** |
| cortesia | (nenhuma) | — | — | — |

- Evidência: `conta-360-carencia.png`, `conta-1440-carencia.png`, `conta-360-ativo.png`,
  `conta-1440-ativo.png`. Em carência, "Atualizar forma de pagamento" e "Recarregar" têm **a mesma
  cor (`rgb(11,12,15)`), o mesmo peso (600), zero fundo, zero borda e `text-decoration: none`** — a
  única diferença entre a ação que recupera o Premium e um botão de recarregar tela são as palavras.
  Nas mesmas telas, o "Sair" logo abaixo tem borda (`1px rgb(185,187,198)`) e fundo branco: a página
  prova que sabe desenhar afordância, e não a usa no caminho do dinheiro.
- Impacto: o vendedor cujo cartão foi recusado tem **um** caminho e ele é o menos visível da tela;
  passado o prazo ("até 12/09/2026, senão o Premium pausa"), ele cai para congelado — e só então
  recebe um botão roxo. A hierarquia visual está invertida em relação ao risco. Foi medido a 360 e a
  1440; a homologação anterior (T028/T038) mediu 390 e 1280 e olhou transbordo, não afordância.

### [F11b-003] A 360px a aba "Impressoras" do catálogo renderiza "mpressoras"

- Severidade: **Médio**
- Bloqueia provisionamento: **não**
- Certeza: **99%**
- Local: `/catalogo`, `[role="tablist"]` a 360px. As 4 abas são `flex: 1 1 0%` com `padding: 0 16px`
  e `min-width: 44px`; a 360 cada pílula fica com **76px** (74px de conteúdo), e o padding declarado
  de 16px vira **1px** de folga real em "Filamentos" e **−3,9px** em "Impressoras".
- Evidência: `catalogo-360-tablist-impressoras-selecionada.png` — a pílula roxa selecionada mostra
  **`mpressoras`**: o `I` inicial e parte do `s` final ficam fora do fundo e são cortados.
  Medido: pílula `x=100 → 176`, texto `x=96,1 → 179,9` (vaza 3,9px de cada lado),
  `scrollWidth 79 > clientWidth 74`. A 768 e a 1440 as abas medem 106px e nada vaza (`folga 11,1px`).
  Efeito colateral na mesma imagem: entre o fim de "Filamentos" e o começo de "Impressoras" sobram
  **5,1px** — os dois rótulos leem como uma palavra só (`catalogo-360-filamentos.png`).
- Impacto: o rótulo da navegação principal do catálogo premium exibe uma não-palavra na largura mais
  estreita suportada. `toBeVisible`/`toHaveText` passam; só a imagem denuncia.

### [F11b-004] No diálogo de cancelamento, a ação irreversível é a única que parece um botão

- Severidade: **Médio**
- Bloqueia provisionamento: **não**
- Certeza: **93%**
- Local: `/conta` → diálogo "Cancelar a assinatura?", nas três larguras.
- Evidência: `conta-360-dialogo-cancelar.png`, `conta-360-dialogo-zoom.png`. Medido:
  `Voltar` = `tf-btn--ghost`, `background rgba(0,0,0,0)`, **85,6 × 48px**;
  `Cancelar assinatura` = `tf-btn--danger`, `background rgb(239,51,64)` preenchido, **187,6 × 48px**.
  O botão destrutivo é **2,2× mais largo** e o único com fundo.
- Impacto: a copy do §5 é exemplar (diz o que mantém, até quando, que nada é apagado) e o desenho
  contradiz a copy — a saída segura, que a própria mensagem chama de saída segura (FR-014), tem a
  afordância mais fraca da caixa. Não é um bloqueador, é uma inversão de peso num diálogo de perda.

### [F11b-005] Três ações só-ícone no cartão de cenário, com 4px entre "Duplicar" e "Excluir"

- Severidade: **Médio**
- Bloqueia provisionamento: **não**
- Certeza: **90%**
- Local: `/calcular` → folha "Meus cenários", a 360px.
- Evidência: `cenarios-360-lista.png`, `cenarios-360-cartao-zoom.png`. Medido por cartão:
  Renomear `x=158→210`, Duplicar `x=214→266`, Excluir `x=270→322` — **52 × 44px cada, gaps de
  exatamente 4,0px**, nenhum com texto visível. Os nomes acessíveis existem e são bons
  (`aria-label="Excluir Estrategia Mercado Livre …"`), então não é achado de a11y programática — é de
  alvo de toque: 4px separam duplicar de excluir num polegar.
- Impacto: erro de toque num cartão que representa uma estratégia de venda salva. O diálogo de
  confirmação existe (`deleteTitle`), o que rebaixa a severidade, mas não elimina o atrito.

### [F11b-006] A barra do cenário reaberto mostra 21% do nome e não cresce com a tela

- Severidade: **Baixo**
- Bloqueia provisionamento: **não**
- Certeza: **95%**
- Local: `/calcular` com um cenário carregado.
- Evidência: `cenarios-360-reaberto.png`, `cenarios-1440-reaberto.png`. Medido: o `p.truncate` do
  rótulo "Cenário: {nome}" tem `clientWidth 147px` a 360 e **267px a 768 E a 1440** (não cresce),
  contra `scrollWidth 698px` — ou seja, **21%** do nome a 360 e 38% nas telas largas, num cartão que a
  1440 tem centenas de pixels livres à direita. Truncamento é honesto (elipse), o desperdício não é.
- Impacto: com dois cenários de nomes parecidos ("Estrategia Mercado Livre …" / "Estrategia Mercado
  Pago …"), a barra não distingue qual está carregado. Na mesma barra convivem quatro tratamentos
  visuais para quatro ações (Fechar cenário = texto puro, Renomear = texto puro, Duplicar = contorno,
  Salvar alterações = preenchido desabilitado) — a mesma inconsistência do [F11b-002], aqui sem
  consequência financeira.

### [F11b-007] A cortesia não oferece nenhum caminho de assinatura

- Severidade: **Baixo**
- Bloqueia provisionamento: **não**
- Certeza: **88%** (pode ser decisão de produto — reporto o fato, não a intenção)
- Local: `/conta` com grant `--source comp`, nas três larguras.
- Evidência: `conta-360-cortesia.png`, `conta-1440-cortesia.png`. O painel mostra "Premium ·
  cortesia" e **um único botão: "Recarregar"**. Não há "Assinar Premium" nem "Gerenciar assinatura".
- Impacto: quem está de cortesia só descobre como pagar depois que a cortesia acaba (aí o estado vira
  congelado e o botão roxo aparece). Se a cortesia é uma porta de entrada comercial, essa é a única
  tela onde ela não vende.

### [F11b-008] A 360px o painel fixo do kit come 45% da viewport

- Severidade: **Baixo**
- Bloqueia provisionamento: **não**
- Certeza: **92%**
- Local: `/kits` com um kit carregado, a 360×740.
- Evidência: `kits-360-compositor.png`. Medido: `div.assembly-summary__pinned`
  (`position: sticky`, `z-index: 10`) ocupa `y = 331,3 → 668`, **336,7px = 45,5% da altura da tela**;
  com a topbar (56px) e a tabbar (72px), sobram **275px** para a lista de peças — e um cartão de peça
  com nome longo mede **250px**. O vendedor enxerga ~1,1 peça por vez, e o texto da peça é cortado no
  meio da palavra ("Polegadas") pela borda do painel, sem esmaecimento nem sombra que anuncie a
  sobreposição.
- Impacto: agravado pelo [F11a-002]: os dois cartões de preço estão **187,7px** de altura *porque* o
  número quebrou em duas linhas; consertar a quebra devolve ~40px de viewport de graça.

---

## Não-achados (hipóteses derrubadas ao medir)

- **Transbordo horizontal**: `scrollWidth − clientWidth = 0` nas **15** combinações
  (5 superfícies × 3 larguras), inclusive com kit de 11 linhas e nomes de 70 caracteres. Nenhuma
  página empurra a viewport.
- **Toast do cancelamento (conserto T028/B2)**: renderiza a 360px, com ícone, texto
  "Assinatura cancelada. Premium ativo até 02/09/2026." e botão fechar — `conta-360-cancelado-toast.png`.
- **Transbordo do painel ativo (conserto T028/B1)**: a 360px as três ações cabem em duas linhas dentro
  do cartão (`Gerenciar` até `x=323`, `Cancelar`+`Recarregar` até `x=323`, viewport 360, card até 344).
  Nenhum botão nasce fora da tela. O conserto medido a 390 **também vale a 360**.
- **Lista do histórico com valor alto**: `R$ 87.885,95` renderiza numa linha só nas três larguras —
  componente diferente do cartão-herói. Achei que quebraria; não quebra.
- **Rótulos longos nas listas**: catálogo, histórico e cenários truncam com elipse
  (`overflow: hidden` + `truncate`), sem corte no meio de glifo. Honesto.
- **Nomes acessíveis dos ícones**: os três ícones do cartão de cenário têm `aria-label` completo com
  o nome do cenário. Suspeitei de botões anônimos; não são.
- **Diálogos de recalcular e exportar**: abrem e cabem nas três larguras, sem transbordo e sem
  elemento escapando (`escapes = []`).
- **Sobreposição no compositor de kit**: parecia bug de z-order na imagem; a medição mostrou
  `position: sticky` deliberado. Virou o [F11b-008], que é sobre custo de viewport, não sobre bug.

---

## Não alcançado

- **`/conta` no estado "just-granted" (janela de ≤1 refresh)** — depende de uma corrida entre o grant e
  a query de entitlement; não consegui parar a tela nesse quadro sem instrumentar o app (proibido pela
  regra de só-leitura). Os 6 estados estáveis foram todos alcançados.
- **Retorno do checkout (`returnPending` / `returnSuccess` / `returnUnconfirmed`)** — não estava na lista
  de superfícies pedida, e o hand-off do stub é interceptado no teste; não renderizei essas três telas.
- **Estados offline e "Premium pausado" DENTRO de `/catalogo`, `/kits`, `/historico` e `/calcular`** —
  a F11b foi orçada por superfície × largura; o cruzamento estado-degradado × superfície × largura
  multiplicaria por 3 o número de renders. Não olhei; não afirmo nada sobre eles.
- **Tema escuro** — todos os 124 screenshots estão no tema claro. O alternador existe em `/conta` e não
  foi acionado.
- **Detalhe do histórico com origem ausente (`frozenReusedCaption`) e o comparar-hoje efetivado** — abri o
  diálogo "Recalcular hoje" (`historico-{360,768,1440}-recalcular-dialogo.png`) mas **não confirmei** o
  recálculo, então não vi o registro comparativo resultante.
- **PDF/CSV exportados** — abri o diálogo de exportação nas três larguras; não baixei nem abri os
  artefatos. A lição do E4 (geometria no PDF) não foi reexercida aqui.
- **Aparelho real / toque real** — tudo foi Chromium headless com `deviceScaleFactor: 2`. Os achados de
  alvo de toque ([F11b-005]) são geométricos, não empíricos.

---

## Conformidade com a regra de só-leitura

`git status --porcelain` ao final: **uma única entrada**, `?? docs/homologacao/` (o diretório inteiro é
não rastreado desde a F11a). Nenhum arquivo de `apps/`, `backend/`, `packages/`, `contracts/`,
`scripts/` ou `specs/` aparece. Os scripts de condução do navegador foram escritos no scratchpad da
sessão, fora do repositório. Os dados adversariais entraram pelo banco de e2e
(`precifica3d_e2e`), que é recriado a cada execução.

---

## Verificação do main loop (protocolo da auditoria)

| afirmação | verificação | resultado |
| --- | --- | --- |
| o `R$` desgruda do valor porque a formatação usa espaço comum | leitura de `shared/lib/decimal-ptbr.ts:146` | **confere** — `` return `R$ ${formatDecimal(value, 2)}` ``, espaço comum |
| o código já proíbe essa quebra por escrito | `grep` por NBSP nos dois arquivos | **confere** — `messages.pt-br.ts` tem **3** NBSP; `decimal-ptbr.ts` tem **0** |
| alcance do formatador | `grep` por `formatBRL`/`formatCurrency` fora de teste | **19 chamadores** |

### [F11b-000] A causa raiz, e ela tem dono e data

O `[F11b-001]` não é um defeito de largura. É **um defeito de formatação de dinheiro**, e a cura já
existe neste repositório — aplicada ao lugar errado, por mim, um dia antes desta auditoria.

Na **T038/D1** (2026-08-02) a homologação visual do PR-C mediu que a linha de preço do teaser quebrava
entre `R$` e o valor, e eu escrevi, no commit:

> *"separar o símbolo do valor é a única quebra que não se permite numa linha de preço"*

E apliquei NBSP a **três constantes de copy** (`planMonthlyPrice`, `planAnnualPrice`,
`planAnnualEquiv`). **Não apliquei ao `formatBRL`** — o formatador por onde passa **todo preço do
produto**, com 19 chamadores, cujo próprio comentário se descreve como *"uma regra só"* para o
dinheiro.

Resultado medido pela F11b: o mesmo defeito, no **documento congelado do histórico** — aquele que a
ADR-0019 torna imutável e que o vendedor mostra ao cliente —, **e a 1440px também**, não só na
largura mínima.

**É a quarta vez nesta sessão que uma cura existe num módulo e não foi aplicada ao irmão** (as
outras: import sem extensão consertado no `fee-ingest` e não no `pricing-core`; o `None` com dois
significados nomeado no `amazon-parse` e repetido no `_get` do MP; o `then(run, run)` do outbox não
herdado pelos seis pré-carregamentos). Desta vez o irmão fui eu, ontem — o que torna o padrão mais
convincente, não menos: **consertar o sintoma que a homologação apontou não é consertar o defeito.**

**Conserto (não aplicado — R8)**: NBSP em `decimal-ptbr.ts:146`. Uma linha, 19 chamadores curados de
uma vez. → spec na F15, e ela deve dizer explicitamente para procurar OUTROS lugares que montem
dinheiro por concatenação.
