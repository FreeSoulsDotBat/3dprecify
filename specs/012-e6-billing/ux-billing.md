# UX Spec — E6 billing: the purchase turnstile (T001 · designer-ux → Claude Design handoff)

**Level**: wireframe / flow / state — **NOT pixel-final**. Final UI is produced in Claude Design from this + the
UI the owner envisions. Structure in English; all user-facing copy in **pt-BR** (i18n-ready, tom honesto/calmo).

**Feeds** (tasks.md): T015 (US1 offer surface + Assinar CTA + checkout hand-off — `features/billing`), T026 (US6
Conta plan panel + cancel/manage), T032 (US7 teaser light-up), and the return states T015/T016 exercise. Forward-
designed here, **not blocking PR-A**: PR-B panel states (T025/T026 — active/grace/pending/cancelled/lapsed + dual
grant), PR-B cancel (T021/T022), PR-C teaser CTA (T031/T032). T001 is **non-blocking, parallel with all of PR-A**
(tasks.md Phase 1).

**Sources of truth**: `spec.md` (US1–US8, FR-701..714, SC-701..711, §Clarifications 2026-07-20 — prices, dual-
grant, grace floor) · `docs/product/e6-scope-brief.md` §5 (story intents) + §10 Q11 (owner: "Assinar" lives in
Conta, reachable from every teaser) · `contracts/api-surface.md` (the wire states + the **display↔storage map**) ·
`data-model.md` §4–§5 (grant-writing rules + the `subscriptions.status` machine) · `arquiteto-round.md` §2
(`init_point` hosted checkout · verify-by-lookup) · **ADR-0023** (Proposed → Accepted at the PR-A owner gate).
House honesty lineage reused verbatim: `specs/010-e5-saved-scenarios/ux-scenarios.md` (§0.1 the honesty core,
§7 the teaser lineage), `specs/007-e2-catalog-entitlement/ux-catalog.md` (lapse/freeze vocabulary), the shipped
Conta `PlanSection` (`apps/web/src/pages/conta/conta-page.tsx`) which **this spec extends, it does not replace**.

**Mobile-first 390px.** Every wireframe drawn at that viewport; ≥44px touch targets; **no horizontal overflow at
390px** is a hard invariant. The four teasers were homologated with adversarial sizes (E4/E5 lesson) — the shared
Assinar CTA composes into them **without breaking their honest-notice layout** (§7). Desktop notes inline.

**DS reused (ADR-0007 `tf-*`)**: `PageHeader`, `Card`, `EmptyState`, `Alert` (tones `neutral|info|success|danger`
— **there is no `warning`/`caution` tone; §9-G1 is the one real DS gap**), `Badge` (same four tones), `Button`
(`primary|secondary|ghost|danger`), `Icon` (`crown`, `banknote`, `circle-check`, `circle-alert`,
`triangle-alert`, `check` all present — no billing glyph is missing), `Spinner`, `Dialog`/`DialogContent
variant="center"`, `Toaster`/`toast`. The E2 `PremiumTeaserDialog` lineage and the shipped Conta sections are
**reused, not rebuilt**. No new DS primitive invented; real gaps in §9.

---

## 0. Cross-cutting decisions — read before building any billing surface

### 0.1 The honesty core — the client shows server truth, it never asserts entitlement (Constitution IV, sharpest)

E6 is the epic where a client lie has a **financial** consequence (brief §9). The one rule under everything:

> **Entitlement is 100% server-authoritative. The client's only jobs are (1) START checkout and (2) DISPLAY
> server truth. It NEVER asserts "paid" and NEVER shows a billing state it inferred locally** (SC-708). Premium
> flips only when `GET /api/v1/entitlement` returns `active` off a server-verified `source=payment` grant.

Consequences that shape every screen below:

| Surface | The honest rule | The lie it forbids |
|---|---|---|
| **Return from MP checkout** | poll server truth; say *"confirmando com o Mercado Pago"* | a fake *"processando…"* that implies the charge already succeeded (US2.2) |
| **Abandoned checkout** | the account is **exactly** as before — no badge, no "quase premium" | a ghost *"pendente premium"* state (US2.2 — indistinguishable from never-started) |
| **Conta panel, any state** | render `GET /billing/subscription` ∪ `GET /entitlement` verbatim | an optimistic/guessed state; a stale price |
| **Premium flip** | happens by itself within the ADR-0012 window, **no re-login** | a "faça login de novo para ativar" that fakes friction (SC-701) |
| **Grace** | *"pagamento pendente — regularize até {data}"*, premium **still active** | *"tudo certo"* while a card is failing (US5.1) |

**A `source=payment` grant has NO client path.** The client cannot write it, cannot fake it, cannot pre-flip on
the return. It waits for the server. This is the E5 offline-write posture taken to its limit: offline, or on a
return the server hasn't yet confirmed, the surface **says what it truly knows and nothing more.**

### 0.2 Price presentation rules (FR-701 / SC-707 — real pair, no fake anchor)

The **only** numbers that may ever render (from **one** FE product constant — `features/billing`, the same
constant the teasers read; a mismatch is a release blocker, contracts §Wire invariants):

- **Monthly**: `R$ 15,99/mês` (charged every month).
- **Annual**: `R$ 155,88/ano`, presented as **"equivalente a R$ 12,99/mês"** (one yearly charge — clarification
  2026-07-20).
- **The honest delta** (all derivable, none fabricated): 12 × 15,99 = **R$ 191,88/ano** no mensal; annual saves
  **R$ 36,00/ano ≈ 19%**. These may be shown as a **factual comparison**, e.g. *"economia de ~19% frente ao
  mensal"*.

> **The de/por prohibition (Constitution II, F1 class).** `R$ 191,88` was **never a price the product charged** —
> it is only 12× the monthly. It **MUST NOT** render as a struck-through former price with a "de ~~191,88~~ por
> 155,88" anchor (a fake urgency anchor). It may appear **only** as a plain factual sentence (*"12 meses no mensal
> somam R$ 191,88"*) or be omitted for the cleaner *"equivalente a R$ 12,99/mês (~19% de economia)"*. **Exact
> treatment = owner flag §10-F2.**
>
> **No number before Q1** is moot — Q1 is SET (2026-07-20). But the graceful-degradation contract still stands
> (SC-707 / US7.2): the price constant is the single source; if it were ever unset, every teaser falls back to the
> pre-E6 no-price state, never a placeholder `R$ 0,00`.

### 0.3 The billing-state vocabulary — display↔storage, and the pending-vs-grace firewall

The spec's US6 display words map to the wire `status` (contracts §`GET /billing/subscription`, analyze T1). The FE
does the mapping; **it never invents a state.**

| Display state (US6) | Source | Premium on? | Panel tone |
|---|---|---|---|
| **active** | subscription `authorized` (+ valid grant) | yes | `success` |
| **canceled (not yet lapsed)** | subscription `cancelled`, period still running | yes | `success` + honest caption |
| **grace / pending payment** | subscription `grace` (a **failed renewal**) | **yes** | caution — §9-G1 |
| **lapsed** | `paused`\|`cancelled` past period, **no valid grant** | no (read-only freeze) | `neutral` |
| **courtesy / beta** | no subscription; entitlement `active` via `comp`\|`beta` | yes | `success` |

> **⚠ The pending-vs-grace firewall (the ghost-pendente rule — US2.2).** A subscription `status:"pending"` is an
> **initial checkout not yet confirmed** — it is **NOT** a billing state the Conta panel renders. A `pending`
> account is shown **exactly as a free/lapsed account** (Gratuito / Premium expirado) — never "pagamento
> pendente", never "quase premium". The words *"pagamento pendente — regularize"* belong **only** to `grace`
> (a failed *renewal* of an account that WAS active). Collapsing the two would fabricate a premium-adjacent state
> for someone who never paid. **The FE panel treats `pending` as "no subscription for display".** (`pending` still
> matters for the return surface §3.3 and the 409 double-checkout guard §3.5 — just never as a Conta badge.)

### 0.4 Adversarial size + the return-route deep-link constraint

- **Long period dates** are the size adversary here (not names): *"ativo até 31 de dezembro de 2026, não renova"*
  must wrap cleanly at 390px inside the plan `Card` — the caption wraps to ≤2 lines, never horizontal-scrolls.
- **The MP `back_url` MUST target a single-segment route** (recommend `/assinatura` with a `?retorno=1` query, or
  `/conta` with `?checkout=retorno`). **Reason (project MEMORY — `base:'./'` Capacitor bug):** a 2-segment route
  (`/conta/assinatura/retorno`) **blanks on cold load** because relative asset URLs 404 — and the return from MP
  is by definition a cold external→app navigation. A 1-segment route or a query param sidesteps it. **This is a
  hard design constraint on the return surface, not a preference.** §10-F5.
- The offer/panel/teaser price strings are short and fixed — no overflow risk from the numbers themselves.

---

## 1. Q11 — IA placement of the offer + the "Assinar" reach (owner-decided; options for the record)

**The behavioral requirement (FR-710) is fixed: a working "Assinar" path MUST be reachable from every premium
teaser AND from Conta.** The owner **already decided Q11 = (a)** (brief §10, 2026-07-20): the offer lives **inside
Conta** (extending `PlanSection`), reachable from every teaser. I concur (**~72%**) and record the alternatives per
Constitution.

**Option A — offer inside Conta, opened as a sub-surface from a "Assinar" affordance; teasers route to it
(RECOMMENDED, owner-decided, ~72%).**
Concretely: (1) Conta's `PlanSection` gains an **"Assinar Premium"** button (for `free`/`lapsed`); tapping opens
the **offer surface** (§2) as a sub-route `/assinatura` (a **1-segment route — §0.4**) or a full-height right
`Sheet` on mobile. (2) Every teaser's **shared Assinar CTA** routes to that same offer (signed-in) or through
sign-in → offer (signed-out). (3) The offer's checkout hand-off (§3) is the single path for all entry points.
- **Pros:** Conta already **owns** entitlement state (`GET /entitlement`, `PlanSection`) — plan, price, and
  manage/cancel belong together in the billing home; **one** offer surface, not N; the return + panel states live
  next to where the seller manages the subscription; **no new bottom tab**.
- **Cons:** the offer is one tap deeper than a dedicated screen; discoverability rests on the teaser CTAs + the
  Conta button being prominent (mitigated — the teasers ARE the discovery surface, US7).
- **Scalability:** high — a `/assinatura` sub-route absorbs later billing growth (invoices, plan switch) without
  touching the nav.

**Option B — a dedicated full-screen upgrade route reachable from everywhere (~20%).**
- **Pros:** a single focused conversion surface; the cleanest teaser→checkout funnel.
- **Cons:** splits billing between the upgrade screen and Conta (where cancel/manage/state must still live), so the
  seller learns two places; more surface to keep honest. Escalate only if the owner later wants a marketing-grade
  upgrade page.

**Option C — offer only in Conta, teasers merely deep-link to Conta (~8%).**
- **Rejected.** Forcing every teaser through the generic Conta page loses the intent context ("you hit the *kits*
  wall") and adds a hop; the teaser should reach the **offer**, not the account settings list.

**Recommendation: Option A, ~72%** — matches the owner's Q11 and keeps billing coherent in one home. The residual
28% is Option B's focused-funnel pull; if the owner later wants it, the offer surface (§2) ports unchanged — only
its container moves from a Conta sub-route to a top-level route.

---

## 2. The offer surface (US1 → T015) — real prices, honest discount, working Assinar

### 2.1 Entry points

- **Conta** (`PlanSection`): a primary **"Assinar Premium"** button appears for `free` and `lapsed` accounts
  (for `lapsed` it doubles as the re-subscribe path, §4). Absent for `active` (they already have it — the panel
  shows manage/cancel instead, §4).
- **Every teaser** (§7): the shared Assinar CTA routes here.
- **Signed-out**: the offer is **public product info** — prices may render (they are not per-account). But
  **Assinar routes through sign-in first** (FR-702): `→ /sign-in?redirect=/assinatura`, then back to the offer with
  intent intact. No payment initiates for an anonymous caller.

### 2.2 The offer wireframe (390px)

```
┌────────────────────────────────────────────┐
│ ‹ Voltar     Assinar o Premium              │  ← Sheet/route header (focusable h1)
│  A calculadora é grátis e continua grátis.  │  ← reaffirms the free promise (never sold over)
│  O Premium guarda seu catálogo, kits,       │
│  histórico e cenários — e libera exportar.  │
│                                             │
│  ┌── Plano anual ──────────  ✔ recomendado ┐│  ← highlighted, NOT a dark pattern (both 1 tap)
│  │ R$ 155,88/ano                            ││
│  │ equivalente a R$ 12,99/mês               ││  ← the honest per-month equivalent
│  │ ~19% de economia frente ao mensal        ││  ← the real delta (§0.2) — no "de/por"
│  └──────────────────────────────────────────┘│
│  ┌── Plano mensal ─────────────────────────┐ │
│  │ R$ 15,99/mês                             │ │
│  │ cobrança todo mês, cancele quando quiser │ │
│  └──────────────────────────────────────────┘│
│                                             │
│  [        Assinar Premium        ]          │  ← primary; period = the selected card
│  Você paga no Mercado Pago (Pix ou cartão). │  ← honest hand-off notice (§3.1)
│  O cartão nunca passa pelo nosso app.       │  ← the SC-706 truth, stated plainly
└────────────────────────────────────────────┘
```

- **Two plan cards as tappable peers.** Selecting one sets the checkout `period`. The annual card is
  **pre-highlighted with "recomendado"** and its savings stated — but monthly is equally one tap (no hidden
  option, no pre-checked trap). **Pre-selection default = owner flag §10-F3.**
- **The free promise leads** the copy — the calculator stays free; the offer never implies the free tier is
  degrading.
- **Payment methods are MP's surface** — we say *"Pix ou cartão"* honestly (arquiteto §2: Pix-for-recurring is
  live) but never promise a specific method as ours.
- **Desktop**: same, two plan cards side-by-side in a max-w column; the Assinar CTA full-width below.

### 2.3 States

- **Loading** (plan constant is static, so the only async is the auth check): render immediately; the Assinar
  button shows a `Spinner` only while the `POST /checkout` request is in flight (§3.1).
- **MP unreachable → honest 503** (`BILLING_UNAVAILABLE`, contracts): on tap, `Alert tone="danger"` — *"O Mercado
  Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado."* Never a silent hang, never a fake
  success.
- **Already active** (a seller who reaches the offer while premium): don't sell twice — route to the Conta panel
  (§4) or show *"Você já é Premium."* (guards against the 409 before it happens).

---

## 3. Checkout hand-off + the return states (US2 → T015/T016) — the honesty crux

### 3.1 Leaving to MP (the hand-off)

Tap **Assinar Premium** → `POST /api/v1/billing/checkout {period}` → `200 {initPoint}` → the app navigates
(`window.location`) to **MP's hosted checkout**. The card never touches our app (SC-706). Honest micro-states:

- While the request is in flight: the button shows a `Spinner` + *"Abrindo o Mercado Pago…"* (this is true — we
  are creating the preapproval; it is **not** a payment-processing claim).
- On `503`: §2.3 (honest, nothing charged).
- On `409` (a subscription already `pending`/`authorized`/`grace`/`paused`): §3.5.

### 3.2 The return contract (why the return is the crux)

MP redirects back via `back_url` to our **1-segment return route** (§0.4). **At the moment of return the app does
NOT know if the payment succeeded** — the grant is written only by the server-verified webhook/reconciliation
(§0.1). So the return surface **polls server truth** and renders one of three honest states — it **never** pre-
flips premium and **never** shows a "processando" that implies success.

Return logic: on mount, refetch `GET /api/v1/entitlement` (and `GET /billing/subscription`); poll a few times over
a bounded window (the ADR-0012 propagation window — arquiteto: ≤1 session/token-refresh; a short client poll of
~30–60s covers the common webhook-before-return case, spec §Edge Cases). Then settle.

### 3.3 Return — PENDING (webhook not yet processed)

```
┌────────────────────────────────────────────┐
│            (⟳ Spinner)                      │
│   Confirmando seu pagamento…                │
│  Estamos verificando com o Mercado Pago.    │  ← honest: we are WAITING on the server, not "processing"
│  Assim que confirmar, o Premium liga        │
│  sozinho — você não precisa fazer mais nada.│  ← the no-re-login promise (SC-701)
│                                             │
│         [   Atualizar   ]                   │  ← manual refetch (covers a slow webhook)
│         [ Voltar para a Conta ]             │  ← always an exit; leaving loses nothing
└────────────────────────────────────────────┘
```

- **No fake progress bar, no "processando pagamento".** The copy names exactly what is happening: we are
  **confirming with MP**. This is the single most important honesty line in the epic (§0.1).

### 3.4 Return — SUCCESS (entitlement flipped to active)

```
            (♛ + circle-check)
     Premium ativo!
  Seu catálogo, kits, histórico e cenários
  agora salvam e exportam. Bom trabalho.
        [   Ir para a calculadora   ]
```

- Fires **only** when `GET /entitlement` truly returns `active` with `source:"payment"` — a real server truth, not
  a client guess. A success `toast` may accompany it. Every E2–E5 premium surface is now unlocked (no re-login).

### 3.5 Return — UNCONFIRMED / ABANDONED (indistinguishable from never-started)

If the bounded poll ends with **no** active grant — the seller abandoned, or the webhook is genuinely late — the
surface must NOT claim failure (it might still confirm) and must NOT claim success. It settles to an honest,
**non-alarming** terminal state, and **the account is exactly as before** (US2.2 — no ghost pending premium):

```
┌────────────────────────────────────────────┐
│   Ainda não recebemos a confirmação         │
│  Se você concluiu o pagamento, ele aparece  │
│  aqui em instantes — o Premium liga sozinho.│  ← still-might-confirm, honest
│  Se você não concluiu, nada foi cobrado.    │  ← the abandoned truth
│                                             │
│   [ Verificar de novo ]  [ Voltar à Conta ] │
└────────────────────────────────────────────┘
```

- **The 409 double-checkout state** (a `pending`/active subscription already exists — SEC-604): on a re-Assinar,
  the offer shows *"Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e
  tente de novo."* Honest (there **is** a pending preapproval at MP). The stale-pending reap (reconciliation,
  data-model §5) clears it in the background; the copy never claims the reap timing it can't guarantee. **Note to
  arquiteto: the reap cadence sets how long this 409 can linger — surface it if it's long (§10-F6).**

---

## 4. The Conta billing panel (US6 → T025/T026) — every state, server-sourced

This **extends** the shipped `PlanSection` (`conta-page.tsx`) — it does not replace it. The panel reads
`GET /billing/subscription` first (subscription wins, dual-grant rule); falls back to `GET /entitlement` when the
subscription is `null` (courtesy/beta/free/lapsed). **`pending` subscriptions are treated as "no subscription"**
(§0.3 firewall).

### 4.1 Panel states (390px — the plan `Card` grows a caption + action row)

**ACTIVE (subscription authorized):**
```
│ Plano   [Premium ✔]  Plano anual · renova em 31/12/2026 │
│ [ Gerenciar assinatura ]                                 │  → MP-managed flow (update card / manage)
│ [ Cancelar assinatura ]                                  │  → §5 confirm (in-app endpoint)
```

**CANCELED (not yet lapsed — `cancelled`, period running):**
```
│ Plano   [Premium ✔]  ativo até 31/12/2026 · não renova   │  ← honest: still premium, won't renew
│ Seus itens salvos continuam disponíveis; nada é apagado. │
│ [ Assinar novamente ]                                    │  → §2 offer (a fresh checkout; 409-safe, cancelled ∉ guard set)
```

**GRACE / PENDING PAYMENT (`grace` — a failed renewal; premium STILL active):**
```
│ Plano   [Premium]  pagamento pendente — regularize        │  ← caution tone (§9-G1)
│ até 05/01/2027, senão o Premium pausa.                    │  ← graceUntil (derived), honest deadline
│ [ Atualizar forma de pagamento ]                          │  → MP-managed flow
```

**LAPSED (no valid grant — the existing freeze):**
```
│ Plano   [Premium expirado]                                │  ← existing planLapsed copy, REUSED
│ Seus itens salvos continuam disponíveis para leitura.     │  ← existing planLapsedHint, REUSED
│ [ Assinar novamente ]                                     │  → §2 offer (the re-subscribe CTA)
```

**COURTESY / BETA (no subscription; entitlement active via `comp`/`beta`):**
```
│ Plano   [Premium ✔]  cortesia — sem cobrança              │  ← extends existing planSources.comp = "cortesia"
```
```
│ Plano   [Premium ✔]  via programa beta                    │  ← existing planSources.beta, unchanged
```

**FREE (no subscription, no grant):**
```
│ Plano   [Gratuito]                                        │  ← existing planFree, unchanged
│ [ Assinar Premium ]                                       │  → §2 offer (the first real door)
```

### 4.2 Honesty behaviors on the panel

- **Server truth only** (SC-708): every badge/caption is the ledger + PSP answer. The existing `planStale`
  ("última informação do servidor") caption carries in unchanged when the entitlement read is offline/stale.
- **The date is a real claim here** (unlike E5 scenarios, which forbid dates): a renewal/expiry date IS the
  server's fact. Format `dd/mm/aaaa` (`toLocaleDateString("pt-BR")`, as `PlanSection` already does).
- **`graceUntil` is derived server-side** (contracts + data-model §4) — the FE renders it, never computes it.
- **Manage vs cancel split**: *"Gerenciar assinatura"* / *"Atualizar forma de pagamento"* route **out to MP's
  managed flow** (US6.3 — updating a card is MP's surface). *"Cancelar assinatura"* is our **in-app** confirm →
  `POST /billing/subscription/cancel` (§5).
- **The "Atualizar" (refetch) button** from the shipped `PlanSection` stays — it covers the ≤1-refresh just-granted
  window and any state transition.

### 4.3 The dual-grant edge — courtesy outliving a canceled subscription (owner flag §10-F1)

The clarification: *subscription state wins when one exists; active while ANY valid grant exists.* This creates a
seam: a seller with a **canceled subscription** (period ending 31/12) who **also** holds a **courtesy `comp`
grant** that outlives it. The panel shows the subscription ("ativo até 31/12, não renova") — but at 31/12 they
**won't** lapse (the comp grant keeps them premium). Rendering only "não renova até 31/12" **implies a lapse that
won't happen** — a subtle dishonesty. **Recommendation (§10-F1):** when a valid non-subscription grant coexists,
append a calm line — *"Seu acesso de cortesia continua depois disso."* — so the deadline isn't misread as a
cut-off. Confidence ~70%; the owner should ratify because it is a real (if rare) honesty edge the clarification
half-specifies.

---

## 5. Cancel flow (US4 → T021/T022) — honest, never guilt-tripping

Reached from the **active** panel's *"Cancelar assinatura"*. A `Dialog` (`variant="center"`, Radix focus-trap):

```
                    ┌──────────────────────────┐
                    │ Cancelar a assinatura?  ✕ │
                    │                           │
                    │ Seu Premium continua      │  ← what they KEEP, until when (FR-707/Q10)
                    │ ativo até 31/12/2026.     │
                    │ Depois disso, seus itens  │
                    │ salvos ficam disponíveis  │  ← the freeze, stated calmly (nothing deleted)
                    │ só para leitura — nada é  │
                    │ apagado, e você pode      │
                    │ reativar quando quiser.   │  ← the reversible truth
                    │                           │
                    │   [ Voltar ]  [ Cancelar  │  ← Voltar = the safe dismiss (FR-014)
                    │              assinatura ] │  ← danger; the real action verb
                    └──────────────────────────┘
```

- **No guilt-trip, no dark pattern**: no "tem certeza que quer perder tudo?", no fake scarcity, no hidden default.
  The dialog states the paid-through date, the freeze (read stays, nothing deleted), and reversibility — the
  humane, refund-avoiding truth (brief §2.2).
- **`Voltar` is the safe dismiss** (FR-014 bans "Cancelar" as a *dismiss* control). *"Cancelar assinatura"* is the
  **action verb** of the feature (US4) — legitimate domain language, not a dismiss. This distinction is the one
  place E6 uses the word "Cancelar" on a button, and it is on the **destructive action**, never on the exit.
  (Owner nuance §10-F4.)
- **On confirm** → `POST /billing/subscription/cancel` → `200` → `toast` *"Assinatura cancelada. Premium ativo até
  31/12/2026."* → the panel flips to the **canceled** state (§4.1). Idempotent (cancelling a cancelled sub = no-op
  200 — contracts). **No ledger write, no data touched** (VR-706); the grant expires naturally at period end →
  the existing freeze.

---

## 6. Grace / dunning (US5 → T023/T024) — honest at every step

Grace is a **server state** (a failed renewal → an append-only grace grant, `expires_at = period_end + max(MP
cadence, 7d)` — data-model §4). The seller experiences it as:

- **The Conta panel grace state** (§4.1) — *"pagamento pendente — regularize até {data}, senão o Premium pausa."*
  Premium is **still active** the whole time; the copy is a calm heads-up, never *"tudo certo"* and never a
  premature *"expirado"*.
- **Recovery within grace** → the panel silently returns to **active** with the new renewal date; **no
  seller-visible interruption** (US5.2). No "welcome back" fanfare — nothing broke, so nothing is announced.
- **Grace exhaustion** → expiry-driven lapse → the **lapsed** panel state (§4.1) + the honest reason. Nothing
  deleted; re-subscribe restores writes (the E2–E5 re-grant path, unchanged).

**Where grace shows beyond Conta — owner flag §10-F7.** Grace is time-sensitive and actionable (a card needs
updating), so a Conta-only notice may under-serve it. Options: (a) Conta panel only; (b) + a **slim, non-alarming
caution strip** on app entry while in grace, with *"Atualizar forma de pagamento"*. **Recommendation: (b)** — a
single thin strip, dismissible-per-session, never a blocking modal (premium still works). Confidence ~65%. This
depends on the DS caution tone (§9-G1).

---

## 7. Teaser light-up (US7 → T031/T032) — the shared Assinar CTA into four homologated surfaces

The four teasers today end in an honest **dead-end** (`Entendi`/`Entrar`, no price, no buy — the pre-E6 state).
E6 turns each into a real CTA: **the real price + a shared "Assinar" path** — **without breaking their honest-
notice layout at 390px** (they were homologated with adversarial sizes; keep their constraints).

### 7.1 The shared CTA (one component, `features/billing`)

A single `BillingCta` composed of the DS `Button` + one price line reading the **same price constant** as the offer
(FR-710 / SC-707 — one source, e2e-checked). It routes: signed-in → `/assinatura` (§2); signed-out →
`/sign-in?redirect=/assinatura`. **FSD-Lite note:** a feature cannot import a sibling feature, so — exactly as the
teasers already do for their dialogs — the shared CTA lives in `features/billing` and each teaser imports it (a
feature→feature import is still forbidden; the shared surface must sit in `features/billing` and be consumed, or
be lifted to a shared layer if the boundary linter objects — **§9-G2**).

### 7.2 Composition rule — additive, layout-preserving

Each teaser keeps its existing `EmptyState` (title/description/free-note) **unchanged** and gains, **between the
free-note and the action row**, a compact price line + the Assinar button:

```
   (existing EmptyState — title · description)         ← unchanged
   A calculadora continua grátis.                      ← existing free-note, unchanged
   ─────────────────────────────────────────
   Premium: R$ 15,99/mês ou R$ 12,99/mês no anual      ← NEW price line (short, fixed — no overflow risk)
   [ Assinar ]              [ Agora não / Entrar ]      ← NEW primary + the existing dismiss
```

- **Price line is short and fixed** — it cannot overflow 390px; the adversarial-size homologation (long
  names/notes) does not apply to these constant strings, so the teasers' existing layout constraints hold.
- **The dismiss stays**: signed-in → *"Agora não"* (close, no sell-pressure); signed-out → the existing *"Entrar"*
  (which now leads to the offer, not a dead-end). **Dismiss wording = owner flag §10-F8.**
- **Per-teaser specifics** (all four keep their current container — `Dialog` for catalog/scenarios, inline
  `EmptyState` for bom/history):
  - `catalog/premium-teaser.tsx` — the `PremiumTeaserDialog` + `CatalogTeaser` panel: add the CTA as the Dialog's
    primary and on the panel.
  - `bom/bom-teaser.tsx` · `history/history-teaser.tsx` — inline panels: add the price line + CTA to the button row.
  - `scenarios/scenario-teaser.tsx` — `ScenarioTeaserDialog` + `ScenarioTeaserPanel`: same.
- **Honesty regex must still pass** (T031): no fabricated number (only 15,99 / 12,99 / 155,88), no urgency copy
  ("últimas vagas", "só hoje" — banned), no unverifiable claim.

> **The teaser copy shift**: the pre-E6 teasers each carry a comment *"a buy button would promise a flow that does
> not exist (Principle II)"*. E6 is precisely when that flow **starts existing** — so those comments retire and the
> buy button becomes honest. The free-note (*"a calculadora continua grátis"*) **stays** — the offer never implies
> the free tier is shrinking.

---

## 8. Microcopy pt-BR (proposed `billing:` namespace — owner-ratified at homologation)

> Tom: honesto, calmo, técnico-cordial. Real prices only (15,99 / 155,88 "equivalente a 12,99/mês"). **No fake
> "de/por" anchor, no false urgency, no "processando" that implies success.** **"Cancelar" is a dismiss-ban
> (FR-014) — use "Voltar"**; "Cancelar assinatura" is the *action* verb (§5), the one allowed use.

```ts
billing: {
  // offer (US1)
  offerTitle: "Assinar o Premium",
  offerFreeLead: "A calculadora é grátis e continua grátis.",
  offerBody: "O Premium guarda seu catálogo, kits, histórico e cenários — e libera exportar.",
  planAnnualName: "Plano anual",
  planAnnualBadge: "recomendado",
  planAnnualPrice: "R$ 155,88/ano",
  planAnnualEquiv: "equivalente a R$ 12,99/mês",
  planAnnualSaving: "~19% de economia frente ao mensal",   // the real delta — NUNCA um "de/por"
  planMonthlyName: "Plano mensal",
  planMonthlyPrice: "R$ 15,99/mês",
  planMonthlyNote: "cobrança todo mês, cancele quando quiser",
  subscribeAction: "Assinar Premium",
  handoffNotice: "Você paga no Mercado Pago (Pix ou cartão).",
  cardNeverTouches: "O cartão nunca passa pelo nosso app.",
  alreadyPremium: "Você já é Premium.",
  offerUnavailable: "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado.",
  // checkout hand-off (US2)
  openingCheckout: "Abrindo o Mercado Pago…",              // verdade: criando a preapproval — NÃO "processando pagamento"
  checkoutInProgress:
    "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo.", // 409
  // return states (US2) — server truth only, NUNCA um "processando" que promete sucesso
  returnPendingTitle: "Confirmando seu pagamento…",
  returnPendingBody:
    "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada.",
  returnRefresh: "Atualizar",
  returnBackToConta: "Voltar para a Conta",
  returnSuccessTitle: "Premium ativo!",
  returnSuccessBody: "Seu catálogo, kits, histórico e cenários agora salvam e exportam. Bom trabalho.",
  returnSuccessAction: "Ir para a calculadora",
  returnUnconfirmedTitle: "Ainda não recebemos a confirmação",
  returnUnconfirmedBody:
    "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado.",
  returnVerifyAgain: "Verificar de novo",
  // Conta panel (US6) — extends conta.plan*
  planPeriodMonthly: "Plano mensal",
  planPeriodAnnual: "Plano anual",
  panelRenewsOn: "renova em {data}",
  panelActiveUntilNoRenew: "ativo até {data}, não renova",
  panelCanceledReassure: "Seus itens salvos continuam disponíveis; nada é apagado.",
  panelGraceStatus: "pagamento pendente — regularize",
  panelGraceDeadline: "até {data}, senão o Premium pausa.",
  panelCourtesyNoCharge: "cortesia — sem cobrança",         // estende conta.planSources.comp
  panelDualGrantCourtesy: "Seu acesso de cortesia continua depois disso.", // §4.3 — se coexistir grant válido
  manageSubscription: "Gerenciar assinatura",
  updatePayment: "Atualizar forma de pagamento",
  cancelSubscription: "Cancelar assinatura",                // o VERBO de ação (§5) — não um dismiss
  subscribeAgain: "Assinar novamente",
  // cancel confirm (US4)
  cancelTitle: "Cancelar a assinatura?",
  cancelBody:
    "Seu Premium continua ativo até {data}. Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser.",
  cancelConfirm: "Cancelar assinatura",
  cancelDone: "Assinatura cancelada. Premium ativo até {data}.", // toast — SÓ em 200 real
  // grace strip (US5, §6 — se o owner aprovar F7)
  graceStripBody: "Pagamento pendente. Regularize até {data} para manter o Premium.",
  graceStripAction: "Atualizar forma de pagamento",
  // teaser CTA (US7)
  teaserPriceLine: "Premium: R$ 15,99/mês ou R$ 12,99/mês no anual",
  teaserSubscribe: "Assinar",
  teaserDismiss: "Agora não",
  back: "Voltar",                                           // NUNCA "Cancelar" como dismiss (FR-014)
},
```

Reused **unchanged**: `conta.planLabel` / `planFree` / `planPremium` / `planLapsed` / `planLapsedHint` /
`planStale` / `planSources.{beta,comp}` / `planExpires` / `planRefresh` / `planUnknown`; each teaser's existing
`teaserTitle` / `teaserBody` / `teaserFreeNote` / `teaserSignedOutBody` / `teaserSignIn`; `apiError.*`; `signIn.*`.
E6 invents **no new fee vocabulary** and **no new price** beyond the one constant.

---

## 9. Claude Design handoff — what to prototype + DS gaps

### 9.1 Worth a pixel prototype (ranked; PR-A can proceed on this wireframe + the shipped DS)

1. **The return surface (§3.3–3.5)** — pending / success / unconfirmed. The single highest-risk honesty surface:
   it must read *"we are confirming with the server"*, never *"processing your payment"*. **Highest.**
2. **The offer surface (§2.2)** — two honest plan cards, the real delta, no de/por anchor, the free-promise lead.
   **Highest.**
3. **The Conta billing panel, all six states (§4.1)** — active / canceled / grace / lapsed / courtesy / free, each
   honest, server-sourced; the grace caution styling is the DS-gap surface (§9-G1). **High.**
4. **The cancel confirm (§5)** — humane, no guilt-trip, "Voltar" as the safe dismiss. **High.**
5. **The teaser light-up (§7.2)** — the shared CTA composed into four homologated layouts without breaking them at
   390px. **Medium (mostly additive over shipped surfaces).**
6. **The grace strip (§6)** — only if the owner approves F7 + a caution tone lands. **Low.**

### 9.2 DS notes + gaps (compose-first; nothing invents a primitive silently)

- **G1 — the caution/grace tone is the one real gap.** `Alert`/`Badge` tones are `neutral|info|success|danger`
  only — **there is no `warning`/`caution`.** Grace ("pagamento pendente", premium **still active**) is neither
  `danger` (over-alarms — nothing is broken, premium works) nor `success` (under-signals — a card is failing).
  **Recommendation: add a `caution` tone** to `Alert`/`Badge` (amber, `triangle-alert` icon — already in the icon
  set) as a small, owner-ratified DS addition; **fallback if the owner declines a DS change**: use `info` with the
  explicit deadline copy (calm but honest). **This is the only place E6 needs a DS primitive touched — flag it,
  don't silently reuse `danger`.** §10-F9.
- **G2 — the shared Assinar CTA + FSD-Lite.** A feature cannot import a sibling feature (the existing teasers prove
  this — they locally compose the DS rather than import each other). The shared `BillingCta` must live in
  `features/billing` and be **consumed** by the four teasers; if `eslint-boundaries`/`dependency-cruiser` flags a
  teaser→billing feature import, lift the CTA to a **shared layer** (`shared/ui` or a `shared/billing` seam). The
  designer should assume one shared CTA component, one price constant — the boundary resolution is the FE dev's
  call, not a design change.
- **G3 — the return route is a 1-segment route** (§0.4, the `base:'./'` bug). Design the return as a standalone
  screen reachable at `/assinatura?retorno=1` (or `/conta?checkout=retorno`) — **never** a 2-segment deep route.
  This is a routing constraint the design must respect, not a visual choice.
- **G4 — PriceHero is NOT used here.** Billing shows plan prices in plain plan cards, not the calculator's live
  `PriceHero` (that hero means "today's computed price of a piece" — a different claim). Compose plan cards from
  `Card` + text. No new hero.
- **G5 — the Conta panel extends `PlanSection`, it does not fork it.** The badge + caption + the existing
  "Atualizar" refetch button stay; E6 adds the state branches (§4.1) and the action row. Keep the shipped
  identity/theme/sign-out sections untouched.
- **G6 — icons**: `banknote` (billing), `crown` (premium), `circle-check` (success), `triangle-alert` (caution)
  are all in the shipped set — **no new SVG needed.**

---

## 10. Owner flags (do not invent — Principle VIII)

| # | Flag | Recommendation (confidence) |
|---|---|---|
| **F1** | **Dual-grant honesty edge (§4.3)** — a canceled subscription whose period-end is outlived by a valid courtesy `comp` grant: rendering only "não renova até {data}" implies a lapse that won't happen. | **Append a calm line** — *"Seu acesso de cortesia continua depois disso."* — when a valid non-subscription grant coexists, so the date isn't misread as a cut-off (**~70%**). The clarification half-specifies this seam; it needs owner ratification because it is a real (if rare) honesty edge. |
| **F2** | **The annual-discount framing (§0.2)** — how to show the ~19% / R$ 36,00 delta without a fake "de/por" anchor (R$ 191,88 was never a charged price). | **Show "equivalente a R$ 12,99/mês" + "~19% de economia frente ao mensal"; do NOT render R$ 191,88 as a struck-through former price.** Optionally add a plain factual sentence ("12 meses no mensal somam R$ 191,88") — never labeled "de/por" (**~80%**). |
| **F3** | **Plan pre-selection on the offer (§2.2)** — is the annual plan pre-selected/highlighted, or are both neutral peers? | **Pre-highlight annual as "recomendado" with the savings stated, but keep monthly one tap away (no hidden default, no pre-checked trap)** (**~65%**). Honest nudge, not a dark pattern. If the owner prefers strict neutrality, present both unhighlighted. |
| **F4** | **"Cancelar assinatura" as an action label vs the FR-014 "Cancelar" ban (§5).** | **Allow it as the destructive *action* verb** (the feature IS "cancel the subscription", US4) while keeping **"Voltar"** as the only *dismiss* control (**~85%**). This is the one honest use of the word; it sits on the danger button, never on the exit. Owner ratifies. |
| **F5** | **The return route shape (§0.4/§9-G3)** — the MP `back_url` target. | **A 1-segment route (`/assinatura?retorno=1` or `/conta?checkout=retorno`)** (**~90%**) — a 2-segment route blanks on the cold external→app return under `base:'./'` (project MEMORY, measured). This is a constraint, not a preference; flagged so the owner/arquiteto sets `back_url` accordingly. |
| **F6** | **The 409 "pagamento em andamento" linger (§3.5)** — a stale `pending` subscription blocks a re-Assinar until reconciliation reaps it. | **Keep the honest 409 copy; set the reconciliation reap cadence short enough that the linger is minutes, not hours** (**~60%**) — the exact cadence is arquiteto/implementation ground (data-model §5), surfaced here because it directly shapes how long a returning abandoner sees the 409. |
| **F7** | **Grace visibility beyond Conta (§6)** — Conta-panel only, or + a slim app-entry caution strip while in grace? | **+ a slim, per-session-dismissible caution strip** with "Atualizar forma de pagamento" (**~65%**) — grace is time-sensitive and actionable; a Conta-only notice may be missed. Never a blocking modal (premium still works). Depends on F9. |
| **F8** | **Teaser dismiss wording (§7.2)** — the secondary button beside "Assinar". | **"Agora não" (signed-in) / keep "Entrar" (signed-out)** (**~70%**) — no sell-pressure; the existing "Entendi" also works. Minor; owner picks the voice. |
| **F9** | **The caution DS tone (§9-G1)** — grace needs a tone that is neither `danger` nor `success`; the DS has none. | **Add a small `caution` tone to `Alert`/`Badge`** (amber + `triangle-alert`) as an owner-ratified DS addition (**~70%**); **fallback if declined**: use `info` + explicit deadline copy. The one DS primitive E6 needs touched — flagged, never silently reused as `danger`. |

---

## Determinism / honesty guardrails carried into every E6 UI task

- **The client shows server truth; it never asserts entitlement** (Constitution IV). Premium flips only off a
  verified `source=payment` grant via `GET /entitlement`; no client pre-flip, ever (SC-702/SC-708).
- **The return is "confirming with MP", never "processando"** — no fake progress that implies success; the
  abandoned state is **indistinguishable from never-started** (US2.2), no ghost "pendente premium".
- **The pending-vs-grace firewall**: `pending` renders as free/lapsed on Conta; "pagamento pendente — regularize"
  belongs ONLY to `grace` (a failed renewal) (§0.3).
- **Real prices only** (15,99 / 155,88 "equivalente a 12,99/mês") from one FE constant; **no fake "de/por" anchor**
  (R$ 191,88 was never charged), no placeholder number, no false urgency (SC-707).
- **Cancel keeps what was paid for** — "ativo até {data}, não renova", nothing deleted, reversible; the confirm
  never guilt-trips (FR-707/Q10).
- **Grace stays active + honest** — never "tudo certo" while a card fails; recovery is silent, exhaustion lapses to
  the existing freeze (SC-705).
- **The freeze is REUSED, never redefined** — lapse (cancel/expiry/dunning) routes to the E2/E4/E5 read-only
  freeze; re-subscribe restores writes with data intact (SC-709).
- **`Voltar` is the only dismiss** (FR-014); "Cancelar assinatura" is the allowed *action* verb (§5, §10-F4).
- **≥44px targets, no horizontal overflow at 390px; the return route is 1-segment** (the `base:'./'` bug, §0.4).
- **The card never touches our backend** — say it plainly; no card/PAN/CVV field renders anywhere (SC-706).
- **No new DS primitive silently invented** — the one gap (a caution tone) is a flagged owner call (§9-G1/§10-F9).
</content>
</invoke>
