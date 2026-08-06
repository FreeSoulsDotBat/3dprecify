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
