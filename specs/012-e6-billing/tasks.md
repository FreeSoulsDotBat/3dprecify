# Tasks: E6 — Billing: the purchase turnstile (MP recurring end-to-end + Play flag-ready)

**Input**: Design documents from `specs/012-e6-billing/` (spec.md · plan.md · research.md · data-model.md ·
contracts/api-surface.md · quickstart.md · arquiteto-round.md · seguranca-round.md) + **ADR-0023** (payments —
Proposed) + ADR-0012/0018 (reused). Roadmap line: `docs/product/business-rules.md` E6 row.

**Prerequisites**: plan.md ✅ (Constitution Check 8/8) · `/speckit-clarify` ✅ (3 Qs, 2026-07-20) · E5 (010)
shipped. Docker required for DB-backed dev/tests; an **MP sandbox application** (owner-provisioned, T002) +
a dev tunnel required for the webhook path.

**Tests**: MANDATORY per Constitution III — every story starts with tests observed **FAILING**. The
load-bearing suites that MUST precede their implementation: the **SEC-invariant suite**
(`seguranca-round.md` SEC-1xx..7xx → pytest), **VR-701..710** (data-model §6), idempotency/exactly-once
(VR-702/704), env isolation (VR-705), and the grace/lapse mechanics (VR-707). **SC-709 in every PR**: all
E1–E5 guards pass UNCHANGED.

**Organization**: by user story, grouped into the **3-PR delivery** (spec §8 via the brief). Every push/merge
is **OWNER-GATED** (ADR-0006); the graph refreshes on each merge (ADR-0014). Ledger discipline per wave
(estimate BEFORE, harness-actual AFTER).

> **PR-A is the spine — a checkout without a verified-grant terminus is a security liability, not an MVP.**
> `seguranca` review is **BLOCKING pre-merge on PR-A** (the webhook + writer + no-client-trust). ADR-0023
> flips Proposed → **Accepted at the PR-A owner gate** (the ADR-0021 precedent).

## Standing rules for every task in this feature

- **The grant is the terminus.** The ADR-0012 ledger evaluation code (`entitlement/__init__.py`) does NOT
  change; E6 adds ONE writer (`grant_writer`) fed only by server-verified events. The operator CLI is never
  widened to `source=payment` (VR-710).
- **Verify-then-lookup, never trust-the-body** (SEC-104): a webhook body is a trigger; only the
  authoritative MP lookup writes state. Signature verification runs BEFORE any DB touch.
- **Exactly-once via the inbox**: every grant-writing event goes through `billing_events.event_key` UNIQUE
  (`ON CONFLICT DO NOTHING`), same key for webhook AND reconciliation (VR-702/704).
- **Two independent sandbox↔prod guards** (VR-705): per-env HMAC secret/token AND `live_mode`↔`app_env`
  assert. A sandbox event can never write a prod grant.
- **No money column, no card data, ever** (VR-701/SC-706): the backend persists PSP references only; prices
  live in the MP plans + ONE FE product constant (mismatch = release blocker, e2e-checked).
- **Grace = an append-only grace grant** (`expires_at = period_end + max(MP cadence, 7 days)`) — never a
  mutation, never a derivation change (VR-707/SC-709). Lapse is always expiry-driven or revoke-driven.
- **Honest states everywhere** (Constitution II): real prices only (15,99 / 155,88 "equivalente a 12,99/mês");
  "pagamento pendente" during grace, never "tudo certo"; no fake urgency; no client-inferred billing state.
- **Play flag OFF is server-side and asserted** (VR-709/SC-711): flag-gated routes 404 in every E6 env.
- **qa-produto visual homologation before done in every slice** with **adversarial DATA** (E4/E5 lesson):
  spoofed webhooks, replayed events, abandoned checkouts, a beta-granted subscriber, sandbox rejection cards.
- **ADR-0023 is homologated by the owner at the PR-A gate**; it stays Proposed until then.
- **Pin-not-assume** (ADR-0020 lesson): the MP SDK-vs-httpx choice + exact version, and MP's real retry
  cadence, are VERIFIED at T003 before any dependent code.

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — The turnstile: price → checkout → verified grant (US1 + US2 + US3) ══

> **OWNER RE-SEQUENCING 2026-07-21 (spec §Clarifications): build-first, provision-later.** All
> provisioning-independent tasks run FIRST across all three PRs (MP mocked in pytest; a LOCAL MP STUB —
> T011b — powers e2e + visual homologation); the owner then runs an intensive point-by-point homologation
> of the whole platform; ONLY then: T002 (MP sandbox), real-sandbox e2e (T016b), payment homologation, and
> GCP provisioning. T002 therefore moves to the post-homologation phase and no longer blocks the waves —
> the ONLY tasks it still gates are T016b/T018b (real-sandbox validation) and beyond.
> **UX decisions (F1–F9) recorded 2026-07-21**: F4 cancel = Conta-only + explicit label + confirm modal +
> "vigente a partir da próxima cobrança"; F6 = no status-code jargon ever reaches the seller; the rest as
> recommended (incl. F9: the DS gains an owner-ratified `caution` tone).

## Phase 1: Setup

- [x] T001 [P] designer-ux → handoff (NON-BLOCKING, parallel with all PR-A work): the plan/price surface
      (Q11: inside Conta + reachable from every teaser), the checkout hand-off states (pending/return/
      abandoned), the Conta plan panel states (active/grace/pending/cancelled/lapsed — honest copy per
      FR-708/709), and the teaser CTA. Write to `specs/012-e6-billing/ux-billing.md`. Not a merge blocker.
      **→ DONE 2026-07-20**: `ux-billing.md` (6 areas + 9 owner flags §10). Load-bearing findings: DS gap —
      no `caution` tone for grace (flag F9) · the pending≠grace copy firewall (§0.3) · **the MP `back_url`
      must be a 1-SEGMENT route** (the measured `base:'./'` cold-load trap applied to the external return —
      a T013 constraint) · the courtesy-outlives-cancel honesty line (§4.3).
- [ ] T002 **Owner setup checkpoint (RE-SEQUENCED 2026-07-21 → post-homologation phase; gates only T016b/T018b+)**: provision the **MP sandbox application** (access
      token + webhook secret), create the two `preapproval_plan`s (monthly R$ 15,99 · annual R$ 155,88/yr)
      in the sandbox, choose the dev tunnel tool, and hand the values to `.env` (NEVER committed — the
      `P3D_MP_*` SecretStr pattern). Record plan ids in the env, not in code.
- [x] T003 Verify-and-pin (Constitution II / ADR-0020 lesson): confirm MP server access shape (official SDK
      vs httpx) + EXACT version pin in `backend/pyproject.toml`; fetch and record MP's REAL renewal retry
      cadence (feeds the grace `max()`); record both in `research.md` §D10 as RESOLVED with sources. If the
      cadence cannot be confirmed, STOP and surface — never default silently.
      **→ DONE 2026-07-21 (main loop, sources in research §D10)**: MP recycling = **4 reattempts / ~10-day
      window / auto-cancel after 3 rejections** ⇒ grace covers `period_end + max(10d, 7d floor)`; access =
      **httpx (house dep, async)**, SDK `mercadopago==3.3.0` rejected (sync/requests, thin surface);
      reconciliation poll: 6 h.

## Phase 2: Foundational (blocking) — settings, schema, the SEC suite

- [x] T004 Write FAILING pytest first — `backend/tests/test_billing_schema.py`: migration `0005` shape per
      `data-model.md` §1–§3 (tables exist, CHECKs named, `event_key` UNIQUE, `mp_preapproval_id` UNIQUE,
      the one-active-subscription partial index, `entitlement_grants` source CHECK includes `payment` +
      nullable `subscription_id` FK; NO money/card column anywhere — VR-701). Observe failing.
- [x] T005 **[ESCALATED → opus per ADR-0022 — money/entitlement domain]** Implement migration
      `backend/alembic/versions/0005_e6_billing.py` (`down_revision="0004"`) + models `Subscription`,
      `BillingEvent` + the additive `EntitlementGrant` extension in `backend/app/models/__init__.py`.
      Upgrade→downgrade→upgrade proven on the compose DB. `ruff format` + `ruff check` both. Tests green.
- [x] T006 [P] Settings + env plumbing in `backend/app/settings.py`: `P3D_MP_ACCESS_TOKEN`,
      `P3D_MP_WEBHOOK_SECRET`, `P3D_MP_PLAN_ID_MONTHLY`, `P3D_MP_PLAN_ID_ANNUAL` (SecretStr, per-env) +
      `P3D_PLAY_BILLING_ENABLED: bool = False`. Fail-closed pytest: missing secret ⇒ the webhook route
      refuses (SEC-403), flag default OFF (VR-709 half).
- [x] T007 Write FAILING pytest first — `backend/tests/test_billing_security.py`, the **SEC-invariant
      suite** (seguranca-round SEC-1xx..7xx as the spec): bad/absent/garbage `x-signature` → 401 + zero DB
      writes; stale `ts` outside freshness window → reject; constant-time compare; `live_mode`↔`app_env`
      mismatch → reject (VR-705); unknown subscription → no grant; cross-account event isolation (VR-703);
      old-event replay never extends entitlement (VR-704); operator CLI still rejects `payment` (VR-710);
      Play routes 404 when flag OFF (VR-709). Observe ALL failing (routes absent).

> **Foundational wave DONE 2026-07-21 (`7885f1b`, dev-estrutura OPUS)**: 19/19 schema red→green · migration
> `0005` up→down→up proven · settings fail-closed 6/6 · SEC suite authored: **14 red-by-design + 2
> green-by-design (VR-709/VR-710 absence guards)** — 27 passed/14 failed re-measured by the main loop. ADR
> prose reconciled to the implemented contract (plan-id env naming; `grace` in the status enum). Play route
> path stays a placeholder until T036.

## Phase 3: User Story 3 — The verified terminus (Priority: P1, FOUNDATIONAL — build FIRST)

**Goal**: a verified payment event → exactly one `source=payment` grant → premium live without re-login.
**Independent test**: quickstart steps 3–5 (sandbox payment → flip; replay → one grant; spoof → reject).

- [x] T008 [US3] Write FAILING pytest — `backend/tests/test_billing_terminus.py`: verified payment event →
      exactly one grant (`expires_at = current_period_end`, `subscription_id` set) + one inbox row in ONE
      transaction (VR-702); N replays → still one (SC-703); webhook path and reconcile path converge on the
      same `event_key` without double-grant; `GET /api/v1/entitlement` flips to active with `source=payment`
      (SC-701); **clock-skew rule: the grant's `expires_at` is never earlier than MP's authoritative
      `current_period_end`** (spec §Edge Cases — the boundary favors the paying seller). Observe failing.
- [x] T009 [US3] Implement `backend/app/billing/` core: `providers/mercadopago.py` (lookup: preapproval +
      authorized_payments → the normalised verified event), `grant_writer.py` (the ONE shared terminus:
      inbox insert + ledger grant, same transaction, on-conflict-no-op), per ADR-0023 §2–§3. Tests green.
- [x] T010 [US3] Implement the webhook route `POST /api/v1/billing/webhook/mercadopago` in
      `backend/app/api/billing.py`: signature dependency (HMAC manifest per SEC-101..106, BEFORE any DB
      touch) → lookup → `grant_writer`; 200-fast semantics; the SEC suite (T007) goes green here. Wire the
      router in `main.py`; `app.billing` joins import-linter contracts.
- [x] T011 [US3] Implement the reconciliation runner `backend/app/billing/reconcile.py` +
      `backend/app/scripts/reconcile_subscriptions.py` (CLI pattern of `grant_premium.py`): same processing
      function as the webhook post-lookup; heals a missed webhook to the SAME single grant (T008 case).
      Tests green.
- [x] T011b [US3] **Local MP stub** (the build-first enabler, owner 2026-07-21): a small dev-only fake MP
      server (preapproval create/get + authorized_payments + a webhook-firing trigger, signed with the LOCAL
      test secret) usable by e2e and the owner homologation stack — full purchase/renewal/failure/refund
      loops WITHOUT credentials. Lives outside the app (`backend/tests/mp_stub/` or e2e fixture), never
      ships. Tests: the stub round-trip drives the SAME grant_writer path as real MP.

> **US3 spine DONE 2026-07-21 (`ca151a9`, dev-backend sonnet)**: terminus suite failing-first → 5/5; 12/14
> SEC reds green (2 remain, T013-bound: checkout auth); full suite 366 passed re-measured; regen idempotent
> by sha256. Deviations for T017/seguranca: freshness window 300s (MP publishes no default — one constant);
> conftest billing-table isolation fixture; the stub's documented T007-compat fallback (never in the real
> provider); a route-ordering bug self-caught in the stub (the export.csv house lesson re-paid).

## Phase 4: User Story 2 — Checkout (Priority: P1)

**Goal**: signed-in seller → MP hosted checkout; abandoned = never-started; client can't fake paid.
**Independent test**: quickstart step 2.

- [x] T012 [US2] Write FAILING pytest — `backend/tests/test_billing_checkout.py`: `POST /billing/checkout`
      requires auth (401 signed-out — FR-702); creates pending preapproval + `pending` subscription row,
      returns `initPoint`; NO grant written; second checkout while one is active/grace/paused → 409
      (SEC-604); abandoned checkout leaves no entitlement effect (US2.2); MP unreachable → honest 503
      `BILLING_UNAVAILABLE`. Observe failing.
- [x] T013 [US2] Implement `backend/app/billing/checkout.py` + the route; contract ripple: regen OpenAPI +
      Orval from the ROOT, idempotence proven 2×. Tests green.

> **Checkout wave DONE 2026-07-21 (`ed29a6d`, dev-backend sonnet)**: 5/5 failing-first → green; SEC-301/302
> flipped — **the whole SEC suite (16/16) is now green**; full suite 374/0 re-measured; regen idempotent by
> hash. Dated deviations: 409 double-subscribe = `VALIDATION_ERROR` + status 409 (FE branches on status —
> the honest copy is the FE wave's job); stub extended additively with POST /preapproval.

## Phase 5: User Story 1 — The offer surface (Priority: P1)

**Goal**: real prices, honest discount, working Assinar; signed-out routes through sign-in.
**Independent test**: quickstart step 1.

- [x] T014 [US1] Write FAILING vitest — `apps/web/src/features/billing/`: the plan surface renders EXACTLY
      R$ 15,99/mês and R$ 155,88/ano ("equivalente a R$ 12,99/mês") from the ONE product constant; honest
      delta copy (no "de/por" anchor); Assinar → checkout initiation for the chosen period; signed-out →
      sign-in first. Observe failing.
- [x] T015 [US1] Implement `apps/web/src/features/billing/` (plan surface + Assinar CTA + checkout hand-off
      via the generated client; design source `ux-billing.md` if T001 landed, else the shipped teaser/Conta
      conventions). FSD-Lite boundaries hold. Tests green.

> **US1 FE wave DONE 2026-07-21 (`4e161bc`, dev-frontend sonnet)**: 19 failing-first tests → 673/673 vitest
> + tsc clean (re-measured). Offer = Sheet in Conta (Q11 Option A); return takeover on `/conta?checkout=
> retorno` polling entitlement (~45s patience) gated strictly on `active`+`source=payment`; F2/F3/F6/F8
> applied; copy-honesty invariant scoped to non-billing (dated exception — E6 legitimizes price copy);
> caught+fixed the backend wave's BILLING_UNAVAILABLE tsc gap.

## Phase 6: PR-A hardening & delivery

- [x] T016 e2e against the **local MP stub** (T011b): the quickstart 1→5 walk — offer → checkout hand-off →
      webhook flip without re-login → replay=one-grant → spoof=reject → abandoned=no-state. Client-nav
      rules; kill orphan :4173 first. New spec `apps/web/tests/e2e/billing.spec.ts`.
- [ ] T016b **[post-provisioning phase]** the same walk against the REAL MP sandbox + tunnel (T002),
      including a real hosted-checkout payment with a test card — the sandbox truth-check of T016.
> **T016 DONE 2026-07-21** (2 legs): 7/7 chromium flows vs the stub + the HIGH cold-return defect found →
> fixed (`951d714`: redirect carries search · boot gates on authStateReady · Conta wrap) → flip PASSED at
> browser level (strengthened: honest pending pre-confirmation → success on the mounted panel's own poll);
> auth-boundary 6/6 both runs; a11y-overflow fixed; full suite green minus the pre-existing scenarios-manage
> contention flake (passes isolated). Stub recipe + 4 gotchas in the ledger.
- [x] T017 **`seguranca` review — BLOCKING pre-merge** (the spec mandates it): the SEC checklist from
      `seguranca-round.md` §8 against the real diff (signature impl, no-client-trust, env isolation, secret
      handling, LGPD data map — SC-706). Findings fixed before the gate.
      **→ DONE 2026-07-21: APPROVED-WITH-CONDITIONS → conditions CLOSED same-day (main loop)**: C1 SEC-104
      contradictory-lookup test added (200 ack, zero writes) · C2 `raw` PRUNED to the audit whitelist +
      SEC-501 content sweep (ADR-0023 §Post-review) · L1 prod base-URL validator · L2 accepted-deferred
      (orphan preapproval hygiene → T016b). 300s window RATIFIED. 378/378 after closure (re-measured).
- [x] T018 qa-produto visual homologation (390px + desktop, **local-stub stack** — the owner's intensive
      manual homologation follows this same stack; real-sandbox re-check rides T016b): the offer honesty (prices,
      delta, no fake urgency), checkout hand-off states, the flip (premium on without re-login), adversarial
      walks (spoofed webhook attempt visible as nothing, abandoned checkout leaves clean state). Screenshots.
> **Final report reconciliation (main loop)**: the delivered verdict is **PASS, confidence 94%, 3 legs**
> (leg 1 crashed with the session — stack survived, 8 PNGs re-anchored; legs 2–3 completed all 7 points).
> Nits: N1 courtesy-active accounts have no in-UI paid-conversion door (by design — product flag) · N2
> state surfaces desktop-checked only at the offer · N3 dev-console ApiError log on the 409 path.
> **T018 DONE 2026-07-21 (2 legs): PASS-WITH-NITS 95%** — 7/7 pontos por imagem (12 PNGs em
> `evidence/t018/`): oferta exata sem de/por · retorno frio honesto (o fix visto pelo olho) · flip no
> próprio poll SEM reload · unlock sem re-login · abandono sem fantasma · 409 sem jargão (F6) · spoof
> invisível · precedência assinatura>cortesia. Leg 1 bloqueou honesto em 2 sub-pontos (BD e2e poluído +
> classificador); main loop limpou o BD e a leg 2 rendeu tudo. **Nit de PRODUTO pro dono no gate: conta
> cortesia não tem porta na UI pra virar paga (Assinar some quando ativa) — ratificar ou abrir follow-up.**
- [x] T019 `pnpm gate:all` + drift-guard idempotent + **SC-709** (all E1–E5 guards UNCHANGED). Evidence in
      `dod-evidence.md`.
      **→ DONE 2026-07-21**: gate exit 0 (web 768 gate-mode/679 plain · be 378 · import-linter 4/0 incl. the
      new E6 layering contract) · regen 0-diff · **full e2e 77/77 chromium, 0 flaky** (70 pre-E6 + 7
      billing). Infra note: the 3-webServer boot can race two concurrent `uv run` alembic processes
      (global-setup × run_e2e_server) — green under server reuse; CI arbitrates; fix if needed = single
      migration owner in global-setup.
- [x] T020 **Owner-gated PR-A → `develop`** (squash) — **FEITO 2026-07-23**, PR #28, `0a3296b`.
      **ADR-0023 so foi de Proposed para Accepted em 2026-08-01**: o portao passou e a flag ficou para tras
      por lapso de registro, nao por decisao. Achado ao medir a branch `feature/012-e6-billing` — que esta
      INTEIRAMENTE ABSORVIDA na `develop` (merge de prova: zero arquivos de diferenca) e NAO deve ser
      retomada, porque o merge dela de 23/07 se chama "develop (013 audit remediation)" mas e ANTERIOR ao
      `1212a16` (24/07): E6-02 e L2-N1 nunca estiveram la. O E6 continua a partir da `develop`.

---

## ══ PR-B — The reverse lifecycle: cancel · grace · Conta truth (US4 + US5 + US6) ══

## Phase 7: User Story 4 — Cancel at period end (Priority: P1)

- [x] T021 [US4] FAILING pytest observado — `backend/tests/test_billing_cancel.py`, 12 testes.
      **Vermelho medido: `FFFFFFFFFFFF`.** Na primeira rodada foram `FFFFFF.FFFFF` — 11 vermelhos e UM
      verde, e o verde era VACUO: com a rota ainda inexistente o FastAPI ja devolve `404 NOT_FOUND`,
      que satisfazia exatamente o teste do caso "conta sem assinatura". Um verde que nao distingue "a
      rota recusou" de "a rota nao existe" nao prova nada; o teste passou a exigir a mensagem do
      DOMINIO, e so entao os 12 ficaram vermelhos pelo motivo certo.
      Quase toda assercao e sobre AUSENCIA (o ledger nao cresce, o `expires_at` nao anda, o censo de
      linhas nao muda) — a mentira possivel aqui e uma escrita a mais, e presenca nao a detecta.
- [x] T022 [US4] `POST /billing/subscription/cancel` + `GET /billing/subscription` implementados;
      12/12 verdes, suite de billing 74 passed / 1 skipped, contrato regerado 2x identico.
      **Regra do dominio em `app/billing/subscription.py`**, fora da rota. O MP e chamado ANTES do
      espelho local e o status so muda com um `True` dele: espelhar "cancelled" sem confirmacao
      produziria "nao renova" na Conta enquanto o cartao segue sendo cobrado — o defeito mais caro
      que esta rota pode ter, e invisivel para qualquer assercao que olhe so o nosso banco.

> **TRES DECISOES tomadas aqui porque o contrato NAO as escreve** (Principio VIII — decidido e
> registrado, nao inferido em silencio):
> 1. **`cancelAtPeriodEnd` = `status == "cancelled"`**, e NAO "cancelado E o periodo ainda corre".
>    Um booleano que olha o relogio vira falso sozinho na virada do periodo, e a Conta passaria a
>    dizer "renova" sobre uma assinatura cancelada. Quem responde "o periodo ainda corre" e
>    `currentPeriodEnd`, que viaja junto.
> 2. **Cancelar sem assinatura = 404 com mensagem de DOMINIO** ("this account has no subscription to
>    cancel"). Um 200 diria "cancelei" sobre coisa nenhuma; um 404 generico e indistinguivel de rota
>    ausente — foi assim que o teste passou vacuo.
> 3. **`graceUntil` = `null` ate a US5 existir.** Hoje nao ha janela de carencia, entao `null` e a
>    verdade, nao um campo esquecido; quando entrar, e DERIVADO do `expires_at` do grant de carencia
>    (analyze U1), nunca uma coluna nova.
>
> **Achado de infra, corrigido junto:** `mp_stub` (conftest) so se instala para os modulos de uma
> LISTA, e um modulo de fora recebia `None` calado — o sintoma chega como `AttributeError` dentro do
> teste, que nao aponta para a lista. Um teste que PEDE a fixture pelo nome e cujo modulo esta fora
> agora falha com o conserto escrito na mensagem.

## Phase 8: User Story 5 — Grace & dunning (Priority: P2)

- [x] T023 [US5] FAILING pytest observado — `backend/tests/test_billing_grace.py`, 10 testes.
      **Vermelho medido: `FFFFFFFFFF`.** A primeira rodada deu `FFFFF...FF` — SETE vermelhos e TRES
      VERDES, e os tres eram VACUOS pelo mesmo motivo: enquanto `payment_failed` era um no-op,
      "nada foi escrito" era trivialmente verdade. O de "falha sem periodo pago" ganhou um CONTROLE
      POSITIVO no mesmo teste (a mesma caminhada, numa assinatura COM periodo pago, TEM de abrir a
      carencia) — e o contraste e o que prova que o silencio e recusa deliberada, nao ausencia da
      funcionalidade. Os outros dois ganharam pre-condicao (`len(grants) == 2`): "esgotar" so quer
      dizer alguma coisa se houver janela para esgotar. Segunda rodada: 10/10 vermelhos.
      Um erro meu de referencia tambem apareceu aqui: o teste da recuperacao tardia fotografava os
      grants ANTES de o proprio helper envelhece-los, e acusava `_expire_all` de "esticar grant".
- [x] T024 [US5] Ramo de carencia em `grant_writer._open_grace` + `graceUntil` derivado. 10/10
      verdes; com o cancelamento, 22/22.
      **A janela e MEDIDA, nao chutada** — `MP_RETRY_WINDOW_DAYS = 10` (T003, doc oficial do MP: ate
      4 retentativas em ~10 dias, auto-cancelamento apos 3 recusas) e `GRACE_FLOOR_DAYS = 7` (piso
      humano, decisao do dono Q5), e a carencia e o `max` dos dois. O teste crava a REGRA, nao o
      numero: afirmar "10" ficaria verde se alguem trocasse o piso por engano e vermelho no dia
      legitimo em que o MP publicasse outra janela.
      **Ancora em `current_period_end`, nunca em `hoje`**: o relogio do servidor daria carencias de
      tamanhos diferentes para o MESMO evento conforme a hora em que ele chegasse, e daria 10 dias de
      premium a quem nunca pagou. Sem periodo pago conhecido, nada e escrito — irmao do L2-N1.
      **Zero mutacao, zero mudanca de derivacao** (SC-709, ADR-0012 verbatim): UM grant acrescentado
      com `source="payment"` (o CHECK nao ganha valor novo), status a `grace`, e o lapso continua
      sendo a expiracao fazendo o trabalho dela. Nada revogado, nada apagado.
      **A cobertura da reconciliacao veio de graca**: `list_verified_payments` ja alimentava o
      terminus com os pagamentos recusados — eram um no-op. Acrescentado o ramo, o webhook perdido
      cicatriza pelo MESMO caminho, e a convergencia e o UNIQUE do inbox (VR-702/SC-703), nao
      esperteza de aplicacao.
      **`graceUntil` DERIVADO** (analyze U1) do `expires_at` mais distante entre os grants da
      assinatura, e so no estado `grace`. Uma coluna propria poderia divergir do ledger, e a tela
      prometeria um prazo que o motor nao honra.

## Phase 9: User Story 6 — Conta: the billing home (Priority: P2)

- [x] T025 [US6] Testes escritos primeiro — `plan-view.test.ts` (14, a REGRA) + `plan-panel.test.tsx`
      (12, a RENDERIZACAO). O `GET /billing/subscription` ja existia do T022, entao a US6 e a
      composicao das duas verdades do servidor mais a tela.
      Varias assercoes sao sobre AUSENCIA de proposito: as frases do painel sao MUTUAMENTE
      EXCLUDENTES — "Premium expirado" e "ativo ate {data}" descrevem realidades opostas —, e um
      teste so de presenca passaria com as duas na tela ao mesmo tempo.
- [x] T026 [US6] `plan-view.ts` (decisao pura) + `plan-panel.tsx` (so renderizacao) + `useSubscription`
      + painel ligado na Conta. gate:all verde: 1205 front (eram 1179), 424 back.
      **A SC-708 virou estrutural, nao disciplina**: `plan-panel.tsx` recebe um `PlanState` ja
      resolvido e NAO tem acesso ao ledger nem ao espelho do PSP — ele nao CONSEGUE inferir estado de
      cobranca. E `PlanState` e uniao discriminada, entao nenhum `if` esquecido produz painel sem
      estado (mesma forma do `RefreshOutcome` da 014).
      **Precedencia** (clarificacao 2026-07-20): a assinatura vence quando existe; a cortesia responde
      quando nao ha assinatura; ativo enquanto QUALQUER grant valido existir. O erro do LEDGER vence
      ate uma assinatura em maos — o espelho do PSP diz o que foi contratado, nao se o premium esta
      ligado (Constituicao IV).
      **`pending` nao vira premium**: um checkout aberto e nao concluido nao move o ledger (SEC-301).
      **`useSubscription` NAO tem cache de aparelho**, ao contrario do `useEntitlement` — deliberado:
      aquele e cacheado porque o premium precisa sobreviver a um boot offline (ADR-0018 §9); este nao
      tem esse dever, e uma assinatura guardada so poderia dizer "nao renova" sobre estado ja mudado.

> **DECISAO PENDENTE DO DONO — ux-billing §4.3 / §10-F1 (a recomendacao e ~70% e o proprio doc pede
> ratificacao).** Um vendedor com assinatura CANCELADA que tambem carrega grant de cortesia mais
> longo nao vai cair no fim do periodo. Dizer so "ativo ate 31/12 · nao renova" implica um corte que
> nao vai acontecer. **Implementado como o doc recomenda**: quando o `expiresAt` do ledger passa do
> fim do periodo da assinatura, o painel acrescenta "Seu acesso de cortesia continua depois disso."
> A borda e ESTRITA (empate nao conta — os dois acabam juntos e a frase ja esta certa). Reverter e
> uma linha (`planNote` em `plan-panel.tsx`); mantive porque a alternativa e renderizar uma frase
> que se sabe enganosa, e a Constituicao II nao deixa escolher isso por omissao.

> **O guarda de honestidade apanhou um erro meu de lugar.** Escrevi a copy de cancelamento no
> namespace `conta`, e o `copy-honesty.test.ts` reprovou: ele isenta EXATAMENTE um namespace —
> `billing` — porque e la que provedor real, preco real e politica de cancelamento sao a verdade
> ratificada. A tela e a Conta; o ASSUNTO e cobranca. Copy movida, guarda intacto — nenhuma isencao
> foi alargada para acomodar o meu erro.

## Phase 10: PR-B hardening & delivery

- [x] T027 e2e — `apps/web/tests/e2e/billing-lifecycle.spec.ts`, **5/5 verdes em chromium contra a
      pilha real** (Postgres + emulador de auth + backend + stub do MP). Cancelar → "nao renova" →
      expiracao forcada → congelamento → reassinar; renovacao recusada → carencia com prazo →
      recuperacao; e a idempotencia vista pela UI (o segundo clique nao existe).
      **A caminhada de navegador achou UM DEFEITO REAL que nenhum teste unitario podia ver.** A
      precedencia "a assinatura vence quando existe" estava aplicada SEM consultar o ledger: uma
      assinatura `authorized` no espelho do MP cujo grant ja expirou mostrava "Premium · renova em
      {data}" sobre uma conta CONGELADA — o "fake-active" que a US5 proibe em tantas palavras. E
      acontece de verdade: o webhook da renovacao pode se perder (por isso existe a reconciliacao) e
      nesse intervalo os dois discordam. Meus 14 testes de unidade nao viam porque eu so tinha
      alimentado combinacoes COERENTES, e a INCOERENCIA e justamente o caso que importa. Consertado
      (o ledger decide se ha premium; o espelho so decide qual historia contar entre as ativas) e
      cravado com 3 testes novos.
      **Sub-entregas necessarias**, todas registradas:
      · `POST /_test/payments` no stub (registro cross-processo). O `_fallback_authorized_payment`
        resolve UMA vez por assinatura e sempre como APROVADO, entao nao alcanca nem uma renovacao
        recusada nem um segundo evento — e alarga-lo tornaria AMBIGUO o candidato unico de que os
        testes do T016 dependem.
      · `PYTHONIOENCODING=utf-8` no `global-setup`. No Windows o console herdado e cp1252 e o alembic
        estourava ao IMPRIMIR o proprio log da revisao 0004 (que tem um travessao), entre a 0003 e a
        0004 — uma falha que nao diz nada sobre migracao e fazia o e2e local parecer quebrado por
        outro motivo. Na CI (ubuntu) nunca aconteceu.
      **Dois erros meus no caminho, ambos da familia "o teste falhava calado"**: o helper de
      expiracao era um `-c` MULTILINHA, que nao sobrevive ao `cmd.exe`, e reprovava na assercao
      seguinte apontando para o painel; agora e uma linha e sai com codigo 3 se afetar ZERO linhas.
      E a primeira versao do teste de congelamento expirava uma conta que nunca tinha pago — nao ha
      lapso sem grant, entao ele afirmava outra coisa.
      **FORA desta entrega**: a caminhada do duplo-grant (conta beta que assina, cancela e segue
      ativa na cortesia) — a REGRA esta coberta em unidade (`plan-view.test.ts`, 3 casos incluindo a
      borda estrita do empate), mas a caminhada em navegador depende da §4.3 que aguarda ratificacao
      do dono. Nao foi esquecida; esta parada no mesmo portao.
- [x] T028 homologacao visual (`qa-produto`, opus) — **FAIL 72%** na primeira rodada, **18
      screenshots + 15 dumps de geometria**, todos os 6 estados alcancados por caminho REAL (o
      congelado por cobranca aprovada + expiracao, primeira vez na vida do produto). Zero erros de
      console. Dois bloqueadores, **ambos meus, ambos corrigidos e cravados**:

      **B1 — 100,5px de transbordo a 390px, com o "Atualizar" nascendo FORA da viewport.**
      `scrollWidth 491` contra `clientWidth 390`; o botao em x=396,3. A causa era estrutural e nao
      dependia de dado: o `.tf-conta__row--plan` ja tinha `flex-wrap`, mas nao socorria — as acoes
      sao UM item flex, e um item mais largo que o container nao quebra (453,5px contra 316px). Com
      o modal aberto o overlay cobria so 390px e sobrava uma faixa clara com o botao solto a mostra.
      Corrigido com `flex-wrap` no proprio container das acoes.
      **O guarda que nasceu disso pegou o meu conserto INCOMPLETO** (467 ainda transbordava) antes de
      eu declarar pronto, e foi provado nao-vacuo por mutacao: sem o `flex-wrap`, 747 contra 390.
      Nenhuma assercao de texto veria nada disso — `toBeVisible` passa sobre um elemento
      inteiramente fora da tela.

      **B2 — o toast do §5 nunca renderizava.** MEDIDO com `MutationObserver` armado ANTES do clique
      e observado por 8s: ZERO insercoes. A causa e o proprio sucesso — ele muda o estado, o
      `PlanActions` deixa de renderizar o ramo ativo, o `CancelDialog` DESMONTA, e o React Query nao
      invoca callbacks de `mutate` apos unmount. A copy estava no bundle afirmando um reconhecimento
      que em runtime nunca acontecia. Movido para o `onSuccess` do HOOK, que nao depende de nenhum
      componente continuar montado. Verificado em navegador (o toast aparece, com a data do
      servidor) e preso por teste.

> **A1 (a data que aparece "um dia antes") — MEDIDO CERTO, mas NAO e defeito, e nao vou "consertar".**
> A homologacao mediu: servidor manda `2027-12-31T00:00:00Z`, a tela mostra 30/12/2027 em
> `America/Sao_Paulo`. Esta correto: o valor e um INSTANTE, nao uma data — `2027-12-31T00:00:00Z` E
> `2027-12-30 21:00` no fuso do vendedor, e o grant vale enquanto `now < expires_at`, entao o premium
> de fato acaba na NOITE DO DIA 30 para ele. Renderizar 31/12 prometeria tres horas que nao existem,
> e a casa ja tem regra para o sentido do erro: a fronteira favorece o vendedor que paga
> (`grant_writer`, regra de clock-skew). O que a medicao revela de verdade e uma ambiguidade na
> ENTRADA do operador (uma cortesia digitada como "31/12" vira 00:00Z), nao na exibicao. Registrado
> aqui para ninguem "consertar" no sentido errado depois.

> **A2 (MEDIO) — dois botoes vizinhos comecando com "Atualizar"** ("Atualizar forma de pagamento", que
> vai para o MP, e "Atualizar", que refaz o fetch), a 8px de distancia, no momento em que o vendedor
> esta ansioso com um cartao recusado. **As DUAS strings sao especificadas** (§4.1 e §4.2, que manda
> o botao de refetch continuar), entao renomear qualquer uma e decisao de produto/designer, nao
> minha. O `flex-wrap` do B1 os separa em linhas diferentes a 390px, o que ATENUA e nao elimina.

> **A3 (MEDIO) — a cautela da carencia e so texto**, medido: o selo usa tom `success` (pixels
> identicos ao estado ATIVA) e as duas frases saem em `var(--text-muted)`, a mesma cor da legenda
> neutra. O selo verde esta CERTO (o premium segue ativo, §4.1) e a homologacao registrou isso como
> evidencia A FAVOR da decisao F9 — mas o fallback que o proprio spec preve (tom `info` + prazo
> explicito) tambem nao foi aplicado. **Decisao do dono/designer.**

> **A4 — a apresentacao da §4.3 foi HOMOLOGADA** (quebra em 3 linhas a 390px, sem transbordo, le
> bem). A DECISAO segue aguardando o dono.

> **NAO julgado, e dito como tal**: se o deslocamento de fuso atinge as datas de assinatura REAIS
> depende da hora-do-dia que o MP grava em `currentPeriodEnd`, e o stub nao a reproduz. A
> homologacao se recusou a homologar ou reprovar esse recorte por inferencia — que e a resposta certa.
- [x] T029 `gate:all` exit 0 (1209 front / 424 back / 5 contratos) · drift-guard **0 diff nas DUAS
      passadas** · e2e 5/5 chromium · **SC-709 provado pela FORMA**: `git diff develop` sobre
      `app/entitlement/`, `entities/user/` e `packages/` da ZERO — a derivacao nao mudou porque o
      codigo dela nao foi tocado. Evidencia em `dod-evidence.md`.
- [ ] T030 **Owner-gated PR-B → `develop`** (squash). Graph refresh on merge.

---

## ══ PR-C — Teaser light-up · refund mechanics · Play flag-readiness (US7 + US8 + Q2 cross-cut) ══

> US8 is P3-droppable **to the mechanics floor only** (the silent-premium hole must not ship). The Play
> flag-readiness is an OWNER Q2 DECISION — it is NOT droppable; if the epic runs long it slips to its own
> follow-up PR, never silently cut.

## Phase 11: User Story 7 — Teaser light-up (Priority: P2)

- [ ] T031 [US7] Write FAILING vitest — the four teasers (`features/{catalog/premium-teaser,bom/bom-teaser,
      history/history-teaser,scenarios/scenario-teaser}.tsx`) render the real price + the shared Assinar CTA
      (FR-710); honesty regex (no fabricated number, no urgency copy); the price constant matches the plan
      surface (one source). Observe failing.
- [ ] T032 [US7] Implement: point the four teasers at the shared `features/billing` CTA. Tests green.

## Phase 12: User Story 8 — Refund/chargeback mechanics (Priority: P3, mechanics-floor kept)

- [ ] T033 [US8] Write FAILING pytest — verified refund/chargeback → `revoked_at` on the active payment
      grant (append-only revoke) → immediate lapse; idempotent replay; `beta|comp` grants untouched
      (VR-708/SC-710); post-lapse chargeback = audit-only no-op. Observe failing.
- [ ] T034 [US8] Implement in `grant_writer.py` + the event kinds in the MP provider. Tests green.

## Phase 13: Play Billing flag-readiness (owner Q2 — NOT droppable)

- [ ] T035 Write FAILING pytest — with `P3D_PLAY_BILLING_ENABLED=False`: both Play routes 404 server-side
      (VR-709/SC-711); with the flag ON in a test env: the Play provider's verified sandbox purchase event
      reaches the SAME `grant_writer` and writes a `provider=google_play` subscription + `source=payment`
      grant. Observe failing.
- [ ] T036 Implement `backend/app/billing/providers/google_play.py` (purchase-token verify against the Play
      Developer API → normalised event) + the two flag-gated routes; validate against **Play internal
      testing**; record the sandbox-purchase evidence in `specs/012-e6-billing/evidence/play-flag/` — the
      E7 turn-on gate artifact. Tests green; flag stays OFF everywhere.

## Phase 14: PR-C hardening & delivery

- [ ] T037 e2e: teaser walk (all four show price + working CTA); refund flow in sandbox; the two Play-route
      404 asserts.
- [ ] T038 qa-produto homologation: the four teasers' honesty at 390px, refund lapse copy, and the
      quickstart step-10/11 sweep. Screenshots.
- [ ] T039 `pnpm gate:all` + drift-guard + SC-709 + the full quickstart walk end-to-end (the owner
      homologation script) + the FR-713 absence sweep (no proration/trial/coupon/fiscal surface exists
      anywhere — grep + UI walk). Evidence.
- [ ] T040 **Owner-gated PR-C → `develop`** (squash). Graph refresh on merge.

---

## Phase 15: Polish & cross-cutting (at epic close-out)

- [ ] T041 [P] Update `CLAUDE.md` ground line + `docs/product/business-rules.md` E6 row (BUILT/SHIPPED, the
      premium-gate line from the brief §10) + cross-slice dod-evidence; confirm ADR-0023 Accepted; final
      graph refresh. **v1 = E1–E6 complete → surface the DEPLOY decision to the owner** (the standing
      2026-07-09 rule's trigger has fired; the live-webhook validation from Q3 waits there).
- [ ] T042 [P] Q9 fiscal check handoff: a dated note to the owner listing exactly what the accountant must
      confirm (MP receipt sufficiency for the owner's tax regime) — LAUNCH blocker tracking, not code.

---

## Dependencies & execution order

- **Setup (T001–T003)**: T002 (owner MP sandbox) BLOCKS T007+ (nothing that talks to MP runs without creds);
  T003 (pin + cadence) BLOCKS T009/T023. T001 is non-blocking parallel.
- **Foundational (T004–T007) block all stories.** T005 is the opus-escalated schema; T007 (SEC suite) is
  the failing-first spine the webhook implementation turns green.
- **US3 BEFORE US2/US1** (the terminus is foundational — a checkout that can't grant is a liability);
  within PR-A: T008–T011 → T012–T013 → T014–T015 → hardening T016–T020.
- **PR-B needs PR-A merged** (cancel/grace act on real subscriptions+grants). US4 ∥ US5 ∥ US6 once their
  red tests exist.
- **PR-C needs PR-A** (the CTA needs a working checkout); US7 ∥ US8 ∥ Play-flag phases are independent.
- **`pricing-core` is never touched** by any task (~97% — any need to touch it STOPS the task, ADR-0016).

## Parallel opportunities

- T001 (designer-ux) runs beside everything. T004 ∥ T006 (different files). T007 ∥ T004 (different suites).
- Within PR-B: T021/T023/T025 (three red suites, distinct endpoints) then T022 ∥ T024 ∥ T026.
- Within PR-C: T031 ∥ T033 ∥ T035 (three red suites), then T032 ∥ T034 ∥ T036.

## Implementation strategy (MVP first)

- **MVP = PR-A**: a seller sees the real price, pays in sandbox, and premium turns on by itself — verified,
  exactly-once, spoof-proof. That alone replaces the operator CLI as the door.
- PR-B makes the reverse honest (the freeze reachable by real billing). PR-C converts every wall into a
  door sign + refund mechanics + the Play evidence for E7.
- Ledger rows per wave (estimate → harness actual); routing per ADR-0022 (executors sonnet; migration 0005
  opus; qa-produto opus; seguranca opus).
