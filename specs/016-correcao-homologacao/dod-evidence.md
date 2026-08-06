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
