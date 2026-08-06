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
