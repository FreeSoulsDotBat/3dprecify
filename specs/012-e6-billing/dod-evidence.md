# DoD Evidence — 012-e6-billing

Per-slice evidence for the owner-gated PR flow (ADR-0006). Verification discipline: every count below was
**re-measured by the main loop** after the executing agent reported it.

## PR-A — The turnstile: price → checkout → verified grant (US1 + US2 + US3)

**Branch**: `feature/012-e6-billing` · **Dates**: 2026-07-20..21 · **PR**: *(pending — T020, owner-gated;
ADR-0023 flips Proposed → Accepted at this gate)* · **Mode**: the owner's **build-first/provision-later**
strategy — everything below ran with ZERO real MP credentials (the T011b local stub).

### The wave map (011 routing live)

| Wave | Agent (model) | Tasks | Tokens (harness) | Verified by main loop |
|---|---|---|---|---|
| UX handoff | designer-ux (opus) | T001 | 126,608 | `ux-billing.md`; 9 flags → owner decided all 2026-07-21 |
| Foundational | dev-estrutura (**opus — ADR-0022 money-domain**) | T004–T007 | 186,659 | 27 passed + 14 SEC red-by-design re-run locally; migration 0005 up→down→up |
| US3 spine | dev-backend (sonnet) | T008–T011b | 311,536 | SEC 16/16 · 366 passed re-run |
| Checkout | dev-backend (sonnet) | T012–T013 | 146,598 | 374/0 re-run; regen hash-idempotent |
| US1 FE | dev-frontend (sonnet) | T014–T015 | 213,059 | 673/673 + tsc clean re-run |
| Cold-return fix | dev-frontend (sonnet, resumed) | e2e defect | 274,029 | 679/679 + auth-boundary 6/6 in-browser |
| e2e | qa-software (sonnet, 2 legs) | T016 | ≥610,419 | 7/7 flows; flip proven at browser level |
| Security review | **seguranca (opus, BLOCKING)** | T017 | 135,575 | APPROVED-WITH-CONDITIONS → conditions closed same-day (378/378) |
| Visual homologation | qa-produto (opus, 3 legs incl. a session crash) | T018 | ~286,883–293,221 (leg-1 usage lost to the crash; two ledger recorders) | PASS 94% · 12 PNGs in `evidence/t018/` |

### The real defects found and fixed pre-gate (the net working as designed)

1. **Cold-return loss (HIGH, e2e-found)**: MP's browser redirect-back bounced through sign-in and LOST the
   query string — the honest confirmation surface never rendered. Fixed (`951d714`): the redirect intent
   carries pathname+search (open-redirect guard extended, regression-tested) + the app boot gates on
   `authStateReady()` (no anonymous flash on cold nav) + the Conta 390px plan-row wraps. Flip proven in the
   browser: honest pending pre-confirmation → success on the mounted panel's own poll, no reload.
2. **T017 security conditions (closed same-day, `41c7f8a`)**: C1 — the SEC-104 contradictory-lookup test
   (signed webhook + rejected lookup → 200 ack, zero writes); C2 — `billing_events.raw` PRUNED to an audit
   whitelist + SEC-501 content sweep (payer email/CPF/card data never persisted); L1 — prod refuses a
   non-production MP base URL (settings validator). L2 (orphan preapproval on a lost checkout race)
   accepted-deferred to T016b. The 300s freshness window was RATIFIED by the review.
3. **Cross-wave tsc gap**: `BILLING_UNAVAILABLE` missing from the FE error-messages map (invisible to
   vitest, caught by the FE wave's typecheck).

### T018 — visual homologation (qa-produto, opus)

**PASS, confidence 94%** — 7/7 points by eye at 390px (+ desktop at the offer), 12 PNGs, **zero app
defects**: exact prices with the de/por ABSENCE asserted · sign-in-first with full return-to-intent · honest
"Confirmando seu pagamento…" → self-poll flip → premium unlocked without re-login · abandonment with no
ghost state and no "409" jargon (owner F6) · spoof invisible · courtesy state honest · subscription
display-precedence over courtesy (eye + API-corroborated). Nits: N1 courtesy-active accounts have no in-UI
paid-conversion door (by design — product flag for the owner) · N2 state surfaces desktop-checked only at
the offer · N3 dev-console ApiError log on the 409 path.

### T019 — gates (2026-07-21, main loop)

- **`pnpm gate:all` → exit 0** (the literal command): web 768 gate-mode / 679 plain vitest · backend 378 ·
  import-linter **4 kept / 0 broken** (the new `E6 layering: api → billing → models` contract included).
- **Drift-guard idempotence**: regen pair → **0 diff** (hash-identical).
- **SC-709**: full e2e chromium **77/77, 0 flaky, 0 skipped** (70 pre-E6 + 7 billing) — every E1–E5 guard
  green unchanged; `pricing-core` untouched (3.1.0).
- **Infra note (for CI observation)**: playwright's 3-webServer boot can race TWO concurrent `uv run`
  alembic processes (global-setup + `run_e2e_server.py`) — reproduced locally under the `firebase
  emulators:exec` wrapper timing; green when servers pre-exist (reuse) or timing separates them. If CI's e2e
  job reds on this, the fix is a single migration owner in global-setup.

### T020 — owner gate

**FEITO 2026-07-23** — PR #28, `0a3296b`, squash-merge autorizado pelo dono. A ADR-0023 so foi de
Proposed para **Accepted em 2026-08-01**: o portao passou e a flag ficou para tras por lapso de
registro, nao por decisao. Achado ao medir a branch `feature/012-e6-billing`, que esta INTEIRAMENTE
absorvida na `develop` (merge de prova: ZERO arquivos de diferenca) e **nao deve ser retomada** — o
merge dela de 23/07 se chama "develop (013 audit remediation)" mas e ANTERIOR ao `1212a16` (24/07),
entao E6-02 e L2-N1 nunca estiveram la. O E6 continua a partir da `develop`.

---

## PR-B — o ciclo reverso: cancelar · carencia · a Conta como casa da cobranca (US4+US5+US6)

Branch `012-e6-billing-pr-b`. Quatro commits: `eeb1346` (US4) · `42544fd` (US5) · `a99deeb` (US6) ·
`ed27cc3` (T027 e2e) · `629473e` (T028 correcoes).

### T029 — gates (2026-08-01)

- **`pnpm gate:all` → exit 0** (o comando LITERAL, o mesmo da CI): **1209 front** (eram 1179 antes da
  fatia) · **424 back** (eram 400) · cobertura back 83,25% sobre piso 82 · import-linter **5 kept /
  0 broken**.
- **Drift-guard**: par de regeracao (`export_openapi` + `gen:api` da raiz) → **0 diff nas DUAS
  passadas**. Duas rotas novas no contrato: `GET /billing/subscription` e
  `POST /billing/subscription/cancel`.
- **e2e**: `billing-lifecycle.spec.ts` **5/5 chromium** contra a pilha real (Postgres + emulador de
  auth + backend + stub do MP). Inclui um guarda de GEOMETRIA a 390px, provado nao-vacuo por mutacao
  (sem o `flex-wrap`: 747 contra 390).
- **SC-709 — provado pela FORMA, nao por suite verde**: `git diff develop` sobre
  `backend/app/entitlement/`, `apps/web/src/entities/user/` e `packages/` da **ZERO**. A derivacao
  `active` do ADR-0012 nao mudou porque o codigo que a implementa nao foi tocado; a carencia e um
  grant ACRESCENTADO ao ledger append-only, e o lapso segue sendo a expiracao fazendo o trabalho
  dela. Nenhuma regra de gate de E1-E5 alterada.

### T028 — homologacao visual (`qa-produto`, opus)

**FAIL 72%** na primeira rodada · **18 screenshots + 15 dumps de geometria** · 6 estados alcancados
por caminho REAL (o congelado por cobranca aprovada + expiracao — primeira vez na vida do produto) ·
zero erros de console. **Dois bloqueadores, ambos do dev, ambos corrigidos e cravados** (B1 transbordo
de 100,5px com botao fora da viewport; B2 toast que nunca renderizava, medido com MutationObserver:
0 insercoes em 8s). Detalhe completo, mais o A1 que foi medido certo mas NAO e defeito, em
`tasks.md` §T028. Custo: 141.502 tokens (estimado ~150k).

### T030 — portao do dono

*(pendente: PR-B aberto. **Tres decisoes esperam voce**: a §4.3/§10-F1 — a linha da cortesia que
sobrevive a uma assinatura cancelada, implementada e revertivel numa linha; o **A2** — dois botoes
vizinhos comecando com "Atualizar", ambas as strings ESPECIFICADAS, entao renomear e decisao de
produto; e o **A3** — a cautela da carencia e so texto, com o selo verde CERTO e o fallback `info`
do proprio spec nao aplicado.)*

---

## PR-C — teaser aceso · estorno · prontidao do Play (US7 + US8 + Q2)

Branch `012-e6-billing-pr-c`. Commits: `6dd4888` (US7) · `0645ab8` (US8) · `8389bc5` (T035 Play) ·
`f690b74` (T037 e2e) · `f5de7ed` (T038 correcoes).

### T039 — gates (2026-08-02)

- **`pnpm gate:all` → exit 0** (o comando LITERAL da CI): **1219 front** · **444 back** (eram 400 no
  inicio do E6 PR-B) · import-linter **5 kept / 0 broken**.
- **e2e**: **17/17 chromium** contra a pilha real, nos tres arquivos de billing
  (`billing.spec.ts` do PR-A + `billing-lifecycle` do PR-B + `billing-teasers` do PR-C).
- **Drift-guard**: par de regeracao → 0 diff. O PR-C nao acrescenta rota ao contrato com a flag
  desligada — que e a garantia da SC-711, e ela aparece no proprio contrato.
- **SC-709**: `git diff develop` sobre `backend/app/entitlement/`, `apps/web/src/entities/user/` e
  `packages/` da **ZERO**. A revogacao da US8 e um `UPDATE` em `revoked_at` — uma escrita que a
  derivacao do ADR-0012 ja sabia ler. Nenhuma regra nova.

### FR-713 — a varredura de AUSENCIA, com escopo declarado

Procurei 12 termos em `apps/web/src` + `backend/app` + `packages`: `proration`, `rateio`,
`periodo de teste`, `trial`, `cupom`, `desconto`, `nota fiscal`, `NF-e`, `CNPJ`, `imposto`, `ICMS`.
**Nove deram ZERO.** Os quatro hits sao falsos positivos, cada um verificado:

| termo | onde | por que nao e violacao |
|---|---|---|
| `cupom` | `messages.pt-br.ts` — `freightLine: "Frete / cupom"` | cupom de FRETE de marketplace (dominio E1), nao de assinatura |
| `desconto` | comentarios em `plans.ts`/`price-line.ts` e nos testes | os comentarios explicam por que um desconto NAO e fabricado |
| `CNPJ` | `seed.ts` / `catalog.json` | titulo da fonte da politica de comissao da Shopee |
| `imposto` | `calcular.test.tsx` | um teste AFIRMANDO que nao existe campo de imposto (FR-021) |

A homologacao (T038) fez a mesma varredura pela UI — 22 capturas de `innerText` contra 34 termos —
e chegou ao mesmo lugar. **Duas varreduras independentes, uma por codigo e outra por tela.**

### T038 — homologacao visual

**PASS COM RESSALVAS 88%**, 37 screenshots, geometria do DOM em 12 estados. Cinco defeitos, todos
corrigidos; detalhe em `tasks.md` §T038. Custo: 144.280 tokens (estimado ~150k).

### T041/T042 — o que fica para o portao do dono

- **T041** (ground line + `business-rules.md` + a decisao de DEPLOY) e de fechamento de EPICO, e o
  E6 so fecha quando o T036 tiver a provisao do Play. O gatilho da regra de 2026-07-09 (**v1 = E1-E6
  completo**) dispara ali, nao aqui.
- **T042** — o handoff fiscal (Q9) esta escrito em `docs/product/e6-fiscal-handoff.md`: e rastreio de
  bloqueador de LANCAMENTO, nao codigo.

### T036 e T040 — bloqueados

- **T036** espera conta Play + service account + uma compra no internal testing. Nao da para stubbar
  com honestidade: um stub provaria que o meu stub concorda comigo.
- **T040** e o portao do dono.
