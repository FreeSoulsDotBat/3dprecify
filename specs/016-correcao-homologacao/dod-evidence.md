# DoD Evidence — 016

## V0 — Medição do Grupo 0 (T001) · 2026-08-05

**VEREDITO: NÃO HÁ DEFEITO — os itens 15–19 do relatório fecham sem código.**

Medido com o backend correto (`run_e2e_server.py`, SelectorEventLoop) + conta nova logada **sem**
premium (o seam real de auth do e2e, sem `grantPremium`), via
`apps/web/tests/e2e/v0-grupo0.spec.ts` (1 passed). Evidência por tela — screenshot em
`specs/016-correcao-homologacao/evidencias/v0/` (local, gitignored como as demais evidências) +
status HTTP observado:

| tela | chamadas /api observadas | erro vermelho? | teaser? |
| --- | --- | --- | --- |
| Catálogo | 200 entitlement · 403 filaments · 403 products | **não** | sim |
| Kits | 200 entitlement | **não** | sim |
| Orçamentos (Histórico) | 200 entitlement | **não** | sim |
| Simulações (painel "Meus cenários" em /calcular) | 200 entitlement · 200 fee-catalog · 403 filaments · 403 printers | **não** | sim |
| "Usar do catálogo" | 200 entitlement · 200 fee-catalog · 403 filaments · 403 printers | **não** | sim |

- **Zero 5xx em toda a medição** (asserção dura do spec). Os 403 são o `ENTITLEMENT_REQUIRED`
  legítimo, e o cliente os trata no ramo do teaser — como `catalog-panel.tsx` sempre fez.
- **A hipótese do PR #42 está confirmada**: os prints do relatório do dono são anteriores ao
  conserto do backend (ProactorEventLoop → 500 em toda rota de banco), e um 500 cai
  legitimamente no ramo de erro genérico. Com o backend certo, o sintoma não reproduz.
- As imagens confirmam de brinde as divergências de teaser que a PR-A unifica (US1-AC2):
  "+ Adicionar filamento" no Catálogo · "Entendi" em Kits · "Ir para a calculadora" no
  Histórico · linha de preço + bloco "No Premium…" nas Simulações.

**Achados incidentais da medição (não são do produto):**

1. A rota `/cenarios` **nunca existiu** — Simulações é o painel "Meus cenários" dentro de
   `/calcular` (`calcular-page.tsx`). A primeira versão do spec de medição errou por assumir a
   rota (404 medido e corrigido no próprio spec); a spec do 016 (US2-AC2/FR-904) foi corrigida
   para citar só `/historico` como rota real.
2. O gate pre-push falha com traceback `win32file` quando o **Docker está parado** (pytest →
   testcontainers) — reconfirmação da armadilha registrada; subir o Docker Desktop resolve.

## PR-A — US1 teaser único + US2 rótulos · 2026-08-05

**Implementação (dev-frontend, T002–T009)**: vermelho observado (40 TS2339 + 1 vitest + 3 e2e)
antes do verde; `gate:fe` verde; 1236 unit + **108/108 e2e**. Dois desvios justificados: specs e2e
em `apps/web/tests/e2e/` (convenção real do repo, não a do tasks.md) e `disabledAffordance` como
5º elemento após a legenda (a ordem dos 4 fixos é o contrato; provado no T002).

**Homologação visual (qa-produto, T010): PASS COM RESSALVAS 88%** — 20 medições (5 superfícies ×
2 temas × 2 viewports), **44 screenshots** em `evidencias/pr-a/` (gitignorado). Contrato central
limpo em 20/20: 4 elementos em ordem fixa, as remoções da US1-AC2, SC-902 (zero
"Histórico"/"Cenários" visível), zero transbordo, contraste AA nos textos ativos. Nota de método:
a primeira rodada mediu a superfície ERRADA em Simulações (o teaser do picker atrás da folha) —
corrigida ancorando pelo título da feature; a regra "a imagem acha o que a asserção não acha"
pagou de novo.

**Achados e destino:**

| # | achado | severidade | destino |
| --- | --- | --- | --- |
| A1 | O "subtítulo duplicado" da US1-AC2 SOBREVIVEU nas Simulações (`SheetDescription` com a mesma promessa colada no subtítulo do teaser) | MÉDIA | **CORRIGIDO nesta fatia**: a descrição pertence à lista e só renderiza com a lista (`!showTeaser`) |
| A3 | Dois "Assinar" + duas linhas de preço na tela com a folha aberta (o teaser do picker atrás do overlay) — regressão da classe E6/T038-D4, cuja guarda morreu com o componente deletado | BAIXA | **CORRIGIDO nesta fatia**: o slot do picker não renderiza com `scenariosOpen` |
| A2 | A legenda do teaser do picker ("Calcular e ver a conta continuam grátis.") quase duplica a nota freemium da página (decisão 015/A8), ~250px acima | MÉDIA | **DECISÃO DO DONO no gate do PR** — recomendação: deixar para a PR-E, que reescreve exatamente essa promessa (US11-AC2); mexer duas vezes no mesmo texto em duas fatias é churn |
| A4 | Botão desabilitado do picker no tema claro: 4,33:1 (abaixo de AA para texto ativo; desabilitado é isento) | BAIXA | registrado; ajuste de token junto do polish visual do PR-B se o dono quiser |
| A5 | 26 erros de console no grátis = 403 legítimos (queries de catálogo habilitadas sem condição de entitlement, `use-catalog.ts:98`) — PRÉ-EXISTENTE, diff da fatia vazio | OBS | follow-up fora da fatia (limpar o ruído de console do grátis) |
| A6 | Vazio de desktop a 1440px (37% de largura útil) | OBS | é a US4 — linha de base para a homologação do PR-B |

**Não verificado (fronteira honesta do T010)**: PDF/CSV renderizados (o grep no fonte não achou o
par antigo — INFERIDO, não medido; o `label-sweep.spec.ts` cobre superfícies vivas); o ramo
deslogado do `TeaserUpgrade` (`/sign-in?redirect=`).

## PR-B — US3 header/logo · US4 colunas · US5 fusão · 2026-08-06

**Implementação (dev-frontend, T012–T017)**: o vermelho do T012 provado por `git stash` contra o
baseline — **37,3% medido** (= o 37% da auditoria `[F11a-005]`); depois: **93,3%** de largura útil
a 1440px. Logo REAL do dono (os SVGs antigos desenhavam o wordmark com `<text>` de fonte de
sistema — não eram a arte; os PNGs foram aparados de 3375² para 403×160 e servem por tema).
Sidebar em altura cheia à esquerda, header depois dela; fusão US5 dentro de "Como chegamos no
preço"; marcadores laranja/roxo removidos. A seção de canal foi movida para ANTES do bloco de
preço — antecipando a posição que o FR-918 (PR-E) pede, pela leitura da fusão. O executor quebrou
e consertou a contenção do `[F11a-002]` no caminho (273px de transbordo pegos pela suíte
existente — o valor de nunca deletar a guarda). gate:fe verde · 112/112 e2e.

**Homologação visual (qa-produto, T018): FAIL 82% → correções aplicadas → re-verificado.**
31 screenshots em `evidencias/pr-b/`. 4 dos 5 itens do dono resolvidos e confirmados por caixas +
imagem (93,3% re-medido de forma independente; logo nítida por tema, ratio exato; foco
SIDEBAR→TOPBAR→MAIN; fusão sem duplicata; 0 marcadores; 0 transbordo em 20 varreduras).

**O achado que derrubou o veredito — A1 (BLOQUEADOR), e a lição é nova para a casa**: o scroll da
foto do dono (item 9) era **VERTICAL**, não horizontal. `line-height: 1` deixava o conteúdo 4px
mais alto que a caixa; `overflow-x: auto` faz o overflow-y computar `auto`; e o Chromium **headed**
(o ambiente do dono) renderiza a barra clássica de 15px — **invisível em headless**, que desenha
overlay. Por isso 112/112 e2e verdes com o defeito na tela: a guarda só media o eixo X (A2).
**Lição: headless não vê barra de rolagem clássica — o eixo Y se afere por `scrollHeight`, e a
guarda precisa dos DOIS eixos.**

| # | achado | destino |
| --- | --- | --- |
| A1 | Barra vertical de 15px nos cartões (headed), valor 7,5px fora do centro — com valores DEFAULT | **CORRIGIDO**: `line-height: 1.2` remove a CAUSA (a alternativa `overflow-y: hidden` esconderia a barra sem remover o overflow, e headless não conseguiria prová-la) |
| A2 | A guarda T012 era cega ao eixo Y | **CORRIGIDO**: `amountOverflowY` na guarda; vermelho observado (3 falhas) ANTES da correção; verde depois (18/18 headless + 4/4 **headed** com valor adversarial) |
| A3 | A narrativa "o scroll sumiu pelo ganho de largura" não se sustentava: não havia scroll horizontal nem antes (mutação para 448px medida) | registrado — o ganho de largura é real (93,3%) mas o item 9 era o eixo Y |
| A4 | Rodapé clampado em 720px = 60,0% na faixa dele (o piso exato do SC-903); ritmo Varejo/Atacado levemente irregular | registrado como decisão consciente a confirmar no gate do PR ("total centralizado" foi o pedido do dono) |

**Não coberto**: `/catalogo/produtos/$id` (mesmo corpo, exige premium); contraste numérico do
tema claro em 360/390 (fotografado e lido, sem número).

## PR-C — US6 tooltips · US7 h+min · US8 máquina · US9 máscara/fusões · 2026-08-06

**Conteúdo (designer-ux, T023)**: `conteudo-tooltips.md` — 9 textos finais com procedência por
afirmação; resolução do B1 do analyze (11 = 9 campos + os 2 controles da US8, cujo texto é a
própria tela); "Gramas usadas"/falha×desperdício deferidos ao PR-D (escrever agora publicaria
afirmação falsa); premissa minha corrigida (medidor de tomada não custa R$ 40–70 → nenhum preço
na tela); R$ 0,85/kWh e R$ 7,37/h em chaves i18n anuais nomeadas.

**Implementação (dev-frontend, T020–T029)**: vermelho observado nos 3 grupos de teste; helpers
puros `time-input.ts`/`machine-cost.ts`; 3 superfícies que montam o mesmo corpo atualizadas
juntas (SC-305); dois achados de a11y reais corrigidos no caminho (InfoTip dentro de `<label>`
funde o nome acessível; `getByLabel` sem role colide com o trigger). gate:fe verde · 112/112 e2e.

**Homologação (qa-produto, T030): FAIL 74% → correções → re-verificação PASS 96%.** 55+20
screenshots + 9 JSONs em `evidencias/pr-c/`. O que passou de primeira, medido: 9/9 tooltips
VERBATIM lidos do popover renderizado; vetor canônico R$ 28,65/42,98/37,25 sobrevivendo a tudo;
derivação ≈5,13/1,11/0,40 exata (SC-906); teclado/toque/hover.

| # | bloqueador do 1º passe | correção (cada uma com vermelho próprio) |
| --- | --- | --- |
| B1 | A tela NOVA da máquina não aparecia na 1ª visita (semente 2000h ∉ ritmo×payback ⇒ modo ajustar vencia, mostrando o campo aposentado) | semente 3600 (= "Quase todo dia" × 3 anos); **o preço-semente muda: custo R$ 20,60 → R$ 16,16, varejo 30,90 → 24,24, atacado 26,78 → 21,01 — CALCULADO pelo motor, decisão reportada ao dono no gate do PR**; vetor canônico digitado intacto |
| B2 | Máscara de milhar NÃO existia (o `currency` só desenhava o R$ — a premissa da spec era falsa) | agrupamento pt-BR no blur em todo campo currency, roundtrip provado; semente já agrupada ("4.000,00", residual do reverify) |
| B3 | Ritmo ilegível no mobile (87px úteis a 360 vs 197px da opção) | selects empilham <1024px (minmax 240px); guarda nova por `measureText` vermelha-antes |
| B4 | "Tarifa de energia" com 1px de campo a 360 (e o corte a 390 era NOVO, do gatilho ⓘ) | gatilho vira `labelAddon` irmão do `<label>` (também cumpre a posição da US6-AC1/R5) + costs-grid minmax(170px); guarda `clientWidth ≥ scrollWidth` vermelha-antes |

Ressalvas corrigidas: R1 (botões de modo com afordância real) · R2 (alinhamento dos seletores) ·
R3 (Escape vence o hover do tooltip, teste próprio) · R6 (chaves i18n mortas removidas).

**Re-verificação (mesmo qa, 20 screenshots)**: os 4 pontos caíram medidos ("Vida útil" com count
0 no DOM; 12.345,67 agrupado com ida-e-volta exata; `cortadas: []` nas duas larguras;
Escape/supressão correta) + o vetor canônico re-confirmado NA UI nova (entrando pelo "ajustar").
Residual de 1 linha aplicado depois (semente exibida já agrupada).

**Achado de fixture no fechamento (a classe "coerente por construção")**: dois fixtures de teste
semeavam folhas de WIRE com strings de FORMULÁRIO — funcionava por coincidência de gramática até
a semente ganhar milhar. Corrigidos para atravessar `ptBrToWireDecimal`, a mesma fronteira que o
produto atravessa (`scenario-bridge.test.ts`, `kit-basis-summary.test.tsx`).

## PR-D — US10 remoção do Desperdício · pricing-core 4.0.0 · 2026-08-06

**Três executores, cada um com seus vermelhos:**
- **Núcleo (dev-estrutura-de-dados ELEVADO A OPUS, ADR-0022)**: 4.0.0 com recusa nominal por
  CHAVE (mesmo `undefined`), `stripRetiredFields`/`isPreRemovalModel` no próprio pacote, 136
  testes, cobertura **100%**, **7 mutações todas matando teste** (incl. a de ordem: recusa ANTES
  de validar). Correção honesta da instrução: o vermelho do re-baseline é baselines ANTIGOS ×
  entrada nova (a 3.1.0 tratava ausência como 0). Três decisões pinadas em teste: `discarded.value`
  vazio → `""`; `isPreRemovalModel("")` → `false`; `in` também na porta (chave herdada não pode
  passar no motor e ser declarada na porta).
- **Backend (dev-backend)**: postura do wire vermelha por stash (9× 200/201 → 422 nomeando o campo
  e o 4.0.0); migração **`0007`** (o head real — tasks.md contava 0003; o executor conferiu com
  `alembic heads` em vez de obedecer) com round-trip provado em DB descartável e o comentário
  literal "schema reversível, valores não"; regen idempotente (2ª rodada diff vazio); gate:be 469
  passed, cobertura 82,37%.
- **Frontend (dev-frontend)**: os DOIS costurados declarando (Alert info role=status com o nome
  pt-BR "Desperdício (g)"; nota estrutural por `isPreRemovalModel` no recalc/compare); campo
  removido das 4 superfícies; FR-914 (T038b) — tooltips de Gramas/Falha reescritos com seção
  datada; fixture `frozen-payload-pre-016.json` + matriz e2e; grep final com 16 sobras todas
  classificadas; SC-815 REESCRITO (não deletado) para provar a recusa nominal + a porta.

**Homologação visual (qa-produto, T042): PASS COM RESSALVAS 93%** — 42 screenshots + **1 PDF
aberto e decodificado** (lição E4: o congelado imprime Material R$ 11,00 com o desperdício dentro,
Total R$ 42,98 — para sempre). Medido: campo com `visible=0 E markup=0` em 20 medições; declaração
de descarte SEM canal vermelho dominante, 328px em viewport de 360; o recálculo declarado é o SEM
desperdício provado por número (R$ 30,75 na tela; o preço COM desperdício, R$ 32,25, com 0
ocorrências); compare Cotado 42,98 / Hoje 41,33 com a nota estrutural.

| # | achado | destino |
| --- | --- | --- |
| R1 | Grade "Custos da peça" a 1440 ficou `[2,2,2,1]` — "Taxa de falha" órfã com meia-linha vazia | cosmético, **decisão do dono no gate** (span-2 ou reordenar é 1 linha) |
| R2 | Contagens de palavras declaradas no `conteudo-tooltips.md` erradas (41→47; 48→50) | **corrigido** (docs) |
| R3 | `arquitetura-016.md`/`quickstart.md` chamavam a migração de 0003; a real é **0007** | **corrigido** (docs) |
| OBS | Produto salvo exibe escala decimal crua do servidor (`100,000 g`, `markup 50,000%`) — PRÉ-EXISTENTE (diff da fatia é só deleção nesses caminhos) | follow-up fora da fatia |

**Lição nova da homologação (do próprio qa, autocorrigido 2×)**: um seletor de disclosure errado
fez a primeira medição passar VAZIA (asserção de ausência sobre bloco não montado prova zero), e
duas leituras de thumbnail reduzido inventaram defeitos que o recorte 1:1 desmentiu — **a imagem
acha o que a caixa não acha, mas imagem REDUZIDA inventa: julgar no 1:1.**

**Não verificado (fronteira honesta)**: caminho KIT-basis da declaração (criação KIT adiada pelo
dono 2026-07-20 — sem caminho de UI); emulação de toque real no projeto mobile.

## PR-E — US11 marketplace→Premium · US12 campos dirigidos · US13 picker · 2026-08-06

**Implementação (dev-frontend, T044–T054)**: gate do grátis (switch desabilitado + TeaserUpgrade;
estados de erro/pendência degradam para "não", nunca para "sim"); promessa da 1ª dobra reescrita;
Clarifications datadas nas specs **005 E 007** com a frase de enforcement verbatim (T050);
`channelFieldPlan` puro + `feeAxes` aditivo com curadoria (bump próprio de `catalogVersion` →
`2026-08-06.0`, regra "um bump por fatia"); FR-928 (banda com fixedFee nulo recusada; `?? 0`
morto); picker com contador verdadeiro. **Bug real de wire pego de brinde**: o Pydantic dropava
`feeAxes` em silêncio — a mesma classe do 014 (`categorySpine`/`bandMode`), pega pelo teste
drops-no-field. Vermelhos observados; byte-idêntico premium pinado por fixture.

**Homologação (qa-produto, T055): FAIL 80% → correções → re-verificação PASS 93%.** 45+19
screenshots + 2 JSONs em `evidencias/pr-e/`.

| # | achado do 1º passe | destino |
| --- | --- | --- |
| BLOQ | **Dinheiro invisível**: Frete digitado no ML seguia descontando na Amazon (líquido −R$ 25,76) SEM campo na tela — o RA5 que o desvio "não religar o reset ao plano" deixou aberto; o plano filtrava RENDER, nunca VALOR | **CORRIGIDO nos dois sentidos**: reset na troca dirigido pelo plano + regra de render "declarado OU com valor". Re-verificado pelo número (líquido volta a R$ 24,24; selo volta ao honesto) e pelo caminho legado FORJADO via API real: documento salvo com frete na Amazon reabre MOSTRANDO o campo, editável — nada invisível cobra |
| R2 | Árvore de 38 nascia ABERTA (1.795px; o preço a y=4.800 no mobile) | **CORRIGIDO**: nasce recolhida ("Ver todas as categorias (38)", contagem real), scroll próprio 40vh; seção fechada 606px (−1.778px); hint a 61px do campo |
| R3 | Buraco na coluna direita do grátis a 1440 | **PARCIAL**: gate virou faixa full-width + Outros custos migrou; o desbalanço real era ~875px (o qa corrigiu o próprio número — a heurística antiga engolia um cartão) e ficou 838px. Ressalva BAIXA aberta para o dono |
| R4 | Legenda do teaser ficara IMPRECISA com a virada | **CORRIGIDO**: "O cálculo de custo e markup continua grátis." — o qa julgou: trocou imprecisão por eco aceitável |
| — | CTA "Assinar" órfão a ~950px da legenda na faixa full-width | **CORRIGIDO no fechamento** (`align="center"` — a prop que nasceu do mesmo órfão no E6/T038-D2) |
| ML | ML sem seletor de categoria e sem "Comissão mínima/item" — tensão entre US12-AC2 ("permanece como está") e a curadoria | **DECISÃO DO DONO no gate do PR** — leitura registrada: a curadoria É a do research R6/data-model mergeados no #43; "permanece como está" refere-se às adições da US15. Reverter é dado, não código |

**Rodada extra que o fechamento pagou**: o executor declarou o e2e "listado sem erro de parse" —
**listar não é rodar**. Rodado de verdade: 4 falhas reais, todas de TESTE (3 = `signUpThrowaway`
navegando ANTES do `page.route`, persistindo o catálogo servido no cache IDB — o abort só bloqueava
o refetch; 1 = locator frouxo com dois CTAs legítimos). Causa raiz diagnosticada antes de patch;
suíte completa re-rodada: **244 passed / 0 failed**. **Lição (variante e2e da do 014): "a suíte
passa" só conta como evidência se a suíte RODOU.**

**O que o 1º passe já tinha aprovado, medido**: gate em 4 combinações (zero número de canal, zero
vazamento por deep-link); promessa nova aprovada com julgamento próprio; contador do picker morto
("Mostrando 8 de 31" com contagem independente batendo); eixos por marketplace exatos
(Shopee sem categoria/mínimo; Amazon sem frete); Clarifications conferidas texto a texto.

## PR-F · T057 — releitura VERBATIM do art. 26839 · 2026-08-06 (pré-condição dos números)

MEDIDO com navegador headless (a página é SPA; `networkidle` nunca chega — espera por conteúdo).
Texto integral: 7.452 chars; screenshot + txt no scratchpad da sessão. Os trechos LITERAIS:

1. **CNPJ < R$ 8** — *"Para produtos com preço abaixo de R$8, o adicional por item é a metade do
   preço do produto. Produtos acima de R$8 mantêm a comissão conforme a variação de valor do
   item;"* → **resolve o conflito §9.3 do arquiteto**: a comissão (20%) CONTINUA incidindo; o que
   vira função do preço é o ADICIONAL fixo (R$ 4 → preço/2). A leitura do FR-927 estava certa; a
   do OBTENCAO-DINAMICA §8 ("50% sem fixo") estava errada. Banda `[0,8)`: `commissionPct 20` +
   `fixedFeeRule {PCT_OF_PRICE, 50}`.
2. **CPF + R$ 3** — *"operam na modalidade CPF e ultrapassam 450 pedidos em um período de 90 dias,
   além do valor da comissão* é aplicada uma taxa adicional de R$3 por item vendido"* E *"Política
   diferenciada para vendedores com menos de 450 pedidos…: a taxa adicional de R$3 … não será
   aplicada…, ficando vigente apenas a taxa por item vendido (R$4, R$16, R$20 ou R$26)"* →
   **resolve o §9.8**: CPF SEM volume paga a MESMA tabela do catch-all — a correção-como-dado que
   o arquiteto previu: **duas entradas** (catch-all + `CPF_ALTO_VOLUME` = tabela + R$ 3), não
   três. As duas perguntas da tela permanecem; só o mapeamento muda (CPF sem volume → catch-all).
3. **Regressiva < R$ 12** — *"um produto de R$10 tem uma taxa de R$6,50, enquanto um de R$8 terá
   taxa de R$6"* — verbatim, DENTRO da seção do CPF alto volume; fórmula completa segue não
   publicada. Bandas da entrada `CPF_ALTO_VOLUME` começam em R$ 12 (§9.5 do arquiteto); abaixo:
   estado I9 + aviso US17 (gatilho: CPF_ALTO_VOLUME + preço < 12).
4. **Piso de comissão**: 0 ocorrências de "mínim"/"piso" — permanece **não determinado**.

**Complemento (mesma data) — `/precos` da Amazon relida verbatim** (fetch simples, HTTP 200,
647KB): *"O Plano Individual é isento de mensalidade; O custo é de R$ 2,00 por produto vendido."*
e *"Tarifa R$ 2,00 por item + comissão"* — fecha a pendência de 70% do executor do dado (a
vigência do `fixedFeeSource`). A página segue se auto-datando "comissões atualizadas em
20/01/2025" e segue imprimindo o bloco "Comissão mínima R$ 2,00" (~11 categorias) — o conflito
do D7 permanece como estava (decisão: manter 1,00 + vigia; o vigia é do 017).

## PR-F — US14/US16/US17/US18 · pricing-core 4.1.0 · 2026-08-06

**A fatia atravessou uma queda de energia no meio** (o executor do motor foi interrompido com 2
testes vermelhos e o relatório perdido) e foi retomada por auditoria: nada revertido, tudo
diagnosticado.

**Motor 4.1.0 (opus, ADR-0022)**: das 2 falhas herdadas, UMA era o teste errado (comparava o
rótulo da banda; o contrato manda asserir o par anúncio/líquido — corrigido, e um teste novo crava
que o rótulo é a ÚNICA diferença nas 30k bases) e a OUTRA era **defeito latente real**: a guarda
do piso publicado não existia (toda tabela pré-016 começava em R$ 0; `CPF_ALTO_VOLUME` é a
primeira com piso, e sem a guarda o motor respondia R$ 12,00 onde a fonte publica R$ 6,00 num item
de R$ 8). Fronteira cravada: base 2,59 ⇒ I9 · 2,60 ⇒ R$ 12,00; o platô do ML preservado (lacuna
interna ≠ fora da tabela). 7 mutações, todas matando teste — a M3 SOBREVIVEU na 1ª rodada (buraco
real no teste do `net`) e virou tabela discriminante. Cobertura 100/100/100/100.

**Dado (dos verbatims do T057)**: Shopee `[0,8)` = 20% + regra 50% (a comissão CONTINUA — a
leitura refutada do OBTENCAO §8 nunca virou número) · `CPF_ALTO_VOLUME` = catch-all +R$ 3 com piso
R$ 12 (DUAS entradas, não três — o verbatim resolveu) · volumoso R$ 50/ORDER art. 3305 · Amazon
INDIVIDUAL `fixedFee 2,00` em **39** entradas (pela REGRA, não pelo número — a 39ª é a
modality-only; e as 3 bandadas com o valor DENTRO da banda, senão a inércia 013/F1 os engoliria) +
`fixedFeeSource` próprio (/precos, verbatim relido) · `catalogVersion 2026-08-06.1` (um bump).
Pydantic do backend com RED provado antes do fix (a classe do drops-no-field, de novo).

**T069 (PDF)**: linha nomeada da sobretaxa lida de `inputs.channels[].surcharges` (o congelado não
ganhou folha — I3), sob o mesmo gate de honestidade do breakdown; geometria adversarial com rótulo
de 60+ chars pelo padrão do E4 (page stream decodificado); regressão zero pinada por conteúdo.

**Frontend** (chegou pronto na árvore — possivelmente conduzido pelo dono; verificado seam a seam
em vez de refeito): avisos com os dois pontos VERBATIM e zero fórmula; mapeamento
`CPF && >450 → CPF_ALTO_VOLUME`; RA5 fechado (o plano alimenta o `slotDeterminants`). Dois
consertos no fechamento: timeout explícito na varredura de monotonicidade (estourava os 5s default
SÓ sob o gate instrumentado — a classe "vermelho intermitente" da lição 014/US5, morta na causa) e
o locator `exact` do spec novo (30s por zero matches: o nome acessível carrega o marcador de
obrigatório — padrão da casa é `getByRole("textbox")`).

**Homologação (qa-produto, T070): PASS 88% → correções A1–A5 → re-verificação PASS 92%.** 79
screenshots em `evidencias/pr-f/`. Os 5 itens de dado conferidos ATÉ O CENTAVO com expectativas
derivadas da identidade do motor ANTES de olhar a tela (+R$ 3,00 exatos; +R$ 50 inteiro uma vez;
+R$ 2,00 exatos; metade do preço com fronteira do R$ 8 varrida em 6 bases, contínua e monótona;
CPF/CNPJ/sem-resposta byte-idênticos por texto renderizado).

| # | achado T070 | destino |
| --- | --- | --- |
| A1 | Entrada BANDADA exibia "0,00" enquanto o motor cobrava (o +R$ 3 e a metade-do-preço sem número na tela) — classe pré-existente que a fatia tornou mais cara | **CORRIGIDO**: placeholders da banda APLICADA (mudam sozinhos quando o anúncio troca de faixa — provado) + legenda por slot. No reverify a imagem pegou o sufixo do placeholder CORTADO ("2,50 (= 50" a 360px — leitura errada nova); a frase da regra migrou para a legenda de largura total |
| A2 | Checkbox cru 13×13px violando o INV-2 num controle de R$ 50 | **CORRIGIDO**: Switch do DS (44×44, role=switch, temas) |
| A3 | Legenda prometia "+R$ 50" e o anúncio sobe +74,28 (gross-up + troca de banda) | **CORRIGIDO**: a legenda diz as duas metades da verdade |
| A4 | Vigência dita duas vezes no selo do fixo | **CORRIGIDO** (source enxuto; effectiveDate estruturado imprime) |
| A5 | Seção Shopee 1248px a 360 (48% avisos; o do frete permanente) | **CORRIGIDO**: frete aferido em 1 linha + ⓘ (248→60px); contabilidade honesta: −188px do aviso, +92px das legendas novas ⇒ líquido −96px |
| RES | Varejo e atacado em faixas diferentes → placeholder mostra só a do varejo (janela estreita) | registrado como limite conhecido (BAIXA) — muito melhor que o 0,00 de antes |

**Lição nova (do reverify)**: a frase-de-honestidade no PLACEHOLDER é inasserível e cortável — o
atributo carrega o texto inteiro (leitor de tela recebe tudo, asserção de texto passa) enquanto o
render corta onde a caixa acaba. Frase explicativa vive em elemento de largura total; placeholder
carrega só o número.

## Polish — T072 matriz transversal · T073 SC-910 + ADRs · 2026-08-07

**T072 (qa-produto): os 7 cenários nunca homologados — PASSA COM RESSALVAS 84%, 57 screenshots**
(`evidencias/transversal/`). O núcleo se sustenta: o cálculo é offline de verdade (boot frio
reproduz o preço idêntico), a tarifa sai do cache, o outbox não mente ("Pendente neste
dispositivo", nunca "salvo"), **nenhuma falha de rede é vendida como "você não é premium"** (0
ocorrências), o 404 de 1 segmento tem cópia própria e volta funcionando, e a jornada mobile a
360px roda sem um pixel de transbordo com todos os controles novos do 016 ≥ 44px.

**Regressão do PRÓPRIO 016, corrigida na fase (A1)**: a PR-B trocou a logo para PNG e o
`includeAssets` do PWA só cobria `brand/logo/*.svg` — offline, a primeira dobra mostrava o ícone
de imagem quebrada (naturalWidth 0 medido). É a MESMA classe do 009/T016-N5, reintroduzida; o
comentário do config já contava a história. Corrigido (`*.png` no glob) e provado por build: os
dois PNGs presentes no manifest do `dist/sw.js`.

**Follow-ups priorizados (medidos, NÃO consertados — a regra do T072):**

| # | achado | sev | nota |
| --- | --- | --- | --- |
| A2 | Shopee: campo "Frete" exibe R$ 0,00 e a conta desconta R$ 20,00 (o `voucherCeiling` do BAND_VOUCHER de 005/E1 não alimenta o placeholder do eixo, e "teto" é cobrado como certo); com volumoso o líquido fica negativo | **ALTA** | PRÉ-EXISTENTE (modelo 005), mas é a mesma classe do bloqueador da PR-E — dinheiro sem controle que o nomeie. Primeiro da fila |
| A3 | Sessão expirada: nenhuma tela oferece caminho de volta ao sign-in; o outbox culpa a rede ("quando houver conexão") com a conexão intacta; registro não se perde | MÉDIA/ALTA | pré-existente; o caminho real de refresh do Firebase não foi exercido (o seam e2e não expira sessão) |
| A4 | Rota de 2 segmentos inexistente (`/catalogo/produtos/{id-fantasma}`) abre tela BRANCA — o trap conhecido do `base: './'` engole até o 404 | MÉDIA | a memória do projeto já o registra; a medição confirma vivo |
| A5 | O preço-herói exibe "R$" a 6,72px e os centavos a 8px — num produto de preço, centavos não são decoração | MÉDIA | design (Claude Design/designer-ux) |
| A6 | Os 16 gatilhos ⓘ da US6 medem 28×28 no toque (WCAG AA ok; abaixo do piso da casa INV-2 ≥44); o guarda de alvos não cobre a superfície nova | MÉDIA | superfície do 016; mexer no InfoTip é global — designer decide |
| A7 | O radio do plano na oferta de compra nasce esticado (292×13px) e descolado do texto; foco vira barra | MÉDIA | superfície E6 |
| A8–A11 | catálogo vazio+leitura falhando sem selo de idade · "precisa de conexão" nomeando a causa errada · /kits com aviso e compositor convivendo · desktop estreito fora da calculadora (~70% vazio) | BAIXA | backlog |

**Fronteira honesta do T072**: tema escuro não varrido (headless resolve light), tap real dos
tooltips não exercido, expiração REAL de sessão não exercida (401 simulado no transporte),
timeout de servidor (vs abort na borda) não exercido.

**T073 — varredura SC-910 (determinística, script sobre o catálogo servido)**: `catalogVersion
2026-08-06.1` · 3 marketplaces · **80 entradas · 0 problemas** — toda folha de dinheiro com
`source`/`sourceUrl`/`effectiveDate`/`lastReviewed`; todo `fixedFeeSource` datado; nenhuma banda
com `fixedFee` nulo sem regra (FR-928); sobretaxas com procedência. A metade de UI foi coberta
pelas homologações das fatias (selos conferidos texto a texto em T055/T070).

**ADRs**: **0026 e 0027 flipados Proposto→Aceito** com a ratificação do dono no merge do PR de
fechamento (o mesmo mecanismo do ADR-0023/T020); **0025 permanece Proposto** — adiado com a parte
ML (US6-ML/017), por decisão do dono de 2026-08-05.

---

## HOTFIX A2/A3 pós-016 (2026-08-07, branch `hotfix-016-a2-a3`)

O achado A2 do T072 era um defeito de DINHEIRO herdado do 005, não do 016: o modelo BAND_VOUCHER
cobrava do vendedor os R$ 20/30/40 que o art. 23431 (lido VERBATIM, padrão T057) atribui à
SHOPEE — cupom de frete universal, custeado pela plataforma, zero linguagem de "vendedor paga".
Correção de DADO (frete Shopee → `NONE` + `freightSubsidyInfo` aditivo, `catalogVersion
2026-08-07.0`): o líquido da semente foi de R$ 4,24 → R$ 24,24 e o líquido negativo com volumoso
morreu; nenhum ANÚNCIO mudou; congelados SHA-256-idênticos. A3 junto: estado `unauthenticated` no
outbox (401 NUNCA purga — propriedade provada), banner sticky "Entrar de novo". FR-111a revogada
na spec 005 com Clarification datada; FR-111b finalmente cumprida. Homologação **PASS 93%, 43
screenshots, 0 bloqueadores**, mutação de catálogo provada (armadilha nova: a SEMENTE responde a
primeira pintura — esperar o valor MUTADO). Ressalvas R1–R4 corrigidas no fechamento; **R5 vira
follow-up** (máscara de milhar se perde na reabertura programática de cenário — classe B2 da
PR-C, o caminho de restauração pula o blur). Desenho + verbatims + recibo completo:
`docs/homologacao/hotfix-a2-a3-desenho.md`.
