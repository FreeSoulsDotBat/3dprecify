# UX Spec — E2 Catalog + Entitlement (T005 · designer-ux → Claude Design handoff)

**Level**: wireframe / flow / state — NOT pixel-final. Final UI is produced in Claude Design from this + the UI
the owner envisions. Structure in English; all user-facing copy in pt-BR (i18n-ready, tom honesto/calmo).

**Feeds**: T019 (filament UI), T022 (printer UI), T024 (calculator picker), T025b (Conta plan line), T030
(product UI), T032 (free-tier teaser). Non-blocking for PR-A (tasks.md T005).

**Sources of truth**: `spec.md` (US3–US7, FR-305..313, Q2/Q3/Q5), `contracts/api-surface.md` (wire fields +
authorization table), `research.md` R5/R6 (uid-keyed offline cache, FSD placement). Fixed decisions honored:
Q2 = read offline / write online-only (honest "precisa de conexão", never fake); Q3 = lapse → read-only freeze
(non-punitive); Q5 = honest teaser (visible affordance, no price, no date, never fake-save, never silent no-op).

**Mobile-first 390px** (FR-010 inherited: never horizontal overflow). All wireframes drawn at that viewport.

**DS reused (ADR-0007 `tf-*`)**: `PageHeader`, `Card`, `EmptyState`, `Alert`, `Badge`, `Button`, `Icon`,
`Spinner`, `Select`, `NumberField`, `Field`, `Switch`, `Dialog`/`Sheet` (Radix focus-trap, ≥44px close),
`Toaster/toast`. Calculator's local `SectionTitle`+`InfoTip` and `FeeSeal` patterns are reused, not rebuilt.
No new DS primitives invented here — real gaps are listed in §7.

---

## 0. Cross-cutting decisions (apply to every catalog surface)

### 0.1 Catálogo IA — how to present Filamentos / Impressoras / Produtos at 390px

> Significant UX choice → ≥3 options (Constitution). Recommendation: **Option A**.

**Option A — Segmented tabs (RECOMMENDED, confidence ~80%).** A single in-page segmented control under the
PageHeader switches the body between one list at a time. Each tab owns its own `＋ Novo` action at the top.
- Pros: the primary action (`＋ Novo`) is always one tap away, never buried under two other lists; each list
  scrolls independently; the mental model matches "pick a domain, then act"; scales cleanly as any list grows.
- Cons: only one domain visible at a time (a product author bouncing filament↔product taps a tab); **needs a
  segmented/tabs control the DS lacks** → §7 gap G1 (composable from Button toggle-group + `role="tablist"`
  + roving tabindex, or scaffold a Radix `Tabs` like `Dialog` was).
- Scalability: high. Products (P2) slots in as a third tab in PR-C with zero re-layout.

**Option B — Stacked sections (SectionTitle per domain).** Three `SectionTitle` blocks (reusing the calculator
pattern) stacked vertically, each a short list + its `＋ Novo`.
- Pros: zero DS gap (SectionTitle+Card exist today); everything visible in one scroll; consistent with Calcular.
- Cons: at 390px three CRUD lists = a long scroll; the 2nd/3rd `＋ Novo` sit far down; loading/empty/error must
  be resolved per-section in one view (visually noisy). Degrades as lists grow.
- Scalability: medium-low.

**Option C — Unified list + type filter chips.** One "Meu catálogo" list of mixed items, filtered by chips
(Todos / Filamentos / Impressoras / Produtos), single `＋ Novo` → type chooser.
- Pros: one surface, one add flow; feels light.
- Cons: mixed-shape rows read inconsistently (a filament row ≠ a printer row ≠ a product row); the `＋ Novo`
  needs an extra "what are you adding?" step; filter chips are also a DS gap (like tabs). Weakest for the
  distinct create forms each entity needs.
- Scalability: medium.

**Decision**: **A (segmented tabs)**. If the owner prefers zero DS work for PR-B, **B** is the safe fallback and
this spec's wireframes degrade to it cleanly (the list/row/form specs below are identical either way).

### 0.2 Create/Edit surface — where the entity form lives

> ≥3 options. Recommendation is **split by entity size**.

**Filaments & printers (≤6 fields)** → **RECOMMENDED: right-anchored full-height `Sheet`** (confidence ~78%).
- Pros: `Sheet` primitive already exists (Radix focus-trap, Escape, focus-return, ≥44px close); full-height
  survives the mobile keyboard better than a bottom sheet (a bottom sheet gets covered by the on-screen
  keyboard on a 6-field form); keeps the list context behind it; no new route.
- Cons: a right sheet is a slightly less common mobile idiom than bottom.
- Alt B — **bottom `Sheet`**: friendliest idiom, but keyboard-overlap risk on the lower fields → reject for forms.
- Alt C — **full page route** (`/catalogo/filamentos/novo`): most robust for keyboard + long validation, but
  heavier navigation for a 6-field form → reserve for products.

**Products (piece inputs + channels[] + otherCosts[] + refs)** → **full page route**, reusing the Calcular
layout (FieldGroup/Card/SectionTitle) with a "Salvar produto" header action. A product form is essentially the
calculator + a name + two catalog refs; a sheet is too small. See §1.6.

**Delete** → **center `Dialog`** (confirm), name echoed, `Button variant="danger"`. Product-with-dangling-ref
gets its own warn copy (§1.6, US6-4). Never a silent delete.

### 0.3 Entitlement × affordance behavior matrix (the honesty core — read before building any state)

How every **write** affordance (create / edit / delete / save-product / pick-to-prefill) behaves per account
state. **Reads/pre-fill are allowed in `active` and `lapsed`, denied in `none`.** The client never decides
write-allowance for real (server is authoritative, FR-301) — this table is the honest *presentation* layer that
must match what the server will do.

| Affordance visible? | `active` online | `active` OFFLINE (Q2) | `lapsed` (Q3) | `none` / signed-out (Q5) |
|---|---|---|---|---|
| List / read saved items | yes | yes (cache, stale seal) | yes (read-only) | — (teaser instead) |
| `＋ Novo` / Edit / Delete | works | tap → honest "precisa de conexão" | tap → reactivation panel | tap → Premium teaser |
| Pick-to-prefill in Calcular | works | works from cache | works (freeze allows read) | affordance → Premium teaser |
| Any "success" toast | real only | never (no fake) | never | never |

Three non-negotiables everywhere: **(1)** the affordance is always **visible** (never hidden) — hiding it would
lie about what the product does; **(2)** the intercept is **honest and specific** (connection / reactivation /
Premium — never a generic error, never a fake "salvo!"); **(3)** nothing persists and no success is faked.

---

## 1. Catálogo tab — PREMIUM ACTIVE (US3/US4 → T019/T022; US6 → T030)

### 1.1 IA / page frame (Option A, segmented tabs)

```
┌────────────────────────────────────────────┐
│  Catálogo                                   │  ← PageHeader (focusable h1)
│                                             │
│  ┌────────────┬────────────┬────────────┐  │
│  │ Filamentos │ Impressoras│  Produtos  │  │  ← segmented tabs (G1). active=Filamentos
│  └────────────┴────────────┴────────────┘  │
│                                             │
│  ┌───────────────────────────[  + Novo ]┐  │  ← list header + primary action (right)
│  │                                        │  │
│  │  ┌──────────────────────────────────┐ │  │
│  │  │ PLA Azul                     ✎  🗑│ │  │  ← list row (Card sm). tap body = edit
│  │  │ PLA · R$ 110,00 / 1 kg           │ │  │     ✎ pencil / 🗑 trash = icon buttons
│  │  └──────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────┐ │  │
│  │  │ PETG Preto                   ✎  🗑│ │  │
│  │  │ PETG · R$ 135,00 / 1 kg          │ │  │
│  │  └──────────────────────────────────┘ │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- **Row anatomy** (Card `padding="sm"`, composed — G2): line 1 = name (`--text-strong`, semibold); line 2 =
  key values muted (`--text-muted`, `--fs-caption`). Filament → `{material} · R$ {costPerRoll} / {rollWeightKg}
  kg`. Printer → `R$ {machineValue} · {machineLifetimeHours} h · {avgPowerKw} kW`. Product → `{name}` + a live
  price hint is **not** shown in the row (prices recompute on open, FR-310 — a row price would imply a stored
  snapshot; show `filamento · impressora` refs instead).
- **Row interaction**: whole body tappable → opens Edit sheet. Trailing `✎` (Icon `pencil`) and `🗑` (Icon
  `trash-2`) are separate ≥44px `Button variant="ghost" size="sm"` stops with `aria-label`. No kebab menu (DS
  has no Menu primitive → avoided by design; two explicit actions read fine at this list size). `🗑` → confirm
  Dialog (§1.5).
- **Unpaginated** (contract: no pagination — small personal catalog). Long list = plain vertical scroll; a
  quiet count caption `"{n} filamentos"` under the tab is enough (§1.7).

### 1.2 State — EMPTY (first premium use, per tab)

Reuse `EmptyState` with an `action` Button (the prop exists but is unused today).

```
┌────────────────────────────────────────────┐
│  Catálogo                                   │
│  ┌────────────┬────────────┬────────────┐  │
│  │ Filamentos │ Impressoras│  Produtos  │  │
│  └────────────┴────────────┴────────────┘  │
│                                             │
│            (◆ package icon)                 │
│      Nenhum filamento salvo ainda           │  ← title
│  Salve seus filamentos uma vez e reutilize  │  ← desc (value, not marketing)
│      em cada cálculo.                        │
│                                             │
│            [   + Adicionar filamento   ]    │  ← action Button (primary)
└────────────────────────────────────────────┘
```

Printer/product tabs mirror this with their own copy (§6).

### 1.3 State — LOADING

Centered `Spinner` inside the list body (mirrors `conta-page` identity-loading Card). Tabs + `＋ Novo` stay
visible and inert (no layout jump). No skeleton primitive exists → Spinner is the honest minimum (G3 notes a
skeleton as a nice-to-have, not required for PR-B).

### 1.4 State — ERROR (cloud read failed, online)

Reuse the `conta-page` error pattern: `Alert tone="danger"` + retry `Button` (loading-aware). Never blocks the
tab chrome.

```
│  ┌──────────────────────────────────────┐  │
│  │ ⚠ Não foi possível carregar          │  │  ← Alert danger (title)
│  │   seu catálogo.                       │  │
│  │            [ Tentar novamente ]       │  │  ← Button secondary, loading-aware
│  └──────────────────────────────────────┘  │
```

### 1.5 State — OFFLINE (active + no network, Q2: read ok / write blocked)

Reads come from the uid-keyed cache (research R5). A **persistent, calm** banner sits above the list; write
affordances stay **visible** and, on tap, give the honest connection message (matrix §0.3) — never disabled-
and-silent, never fake-saved.

```
│  ┌──────────────────────────────────────┐  │
│  │ ⌁ Modo leitura offline               │  │  ← Alert tone="info" (NOT danger)
│  │   Seus itens salvos continuam aqui    │  │
│  │   para usar no cálculo. Criar e       │  │
│  │   editar precisam de conexão.         │  │
│  └──────────────────────────────────────┘  │
│  ┌───────────────────────────[  + Novo ]┐  │  ← still visible; tap → toast below
│  │  … rows … (each shows a stale seal    │  │
│  │    if the cache wasn't refreshed)     │  │
```

- Tap `＋ Novo` / Edit / Delete offline → `toast` (or inline `Alert`) **"Criar e editar precisam de conexão."**
  Nothing opens a form that can't save. If a form is already open when the network drops, its "Salvar" surfaces
  the same honest line and stays open (no data loss, no fake success).
- **Stale seal** on rows served from an unrefreshed cache: reuse the seal vocabulary (`"pode estar
  desatualizada"`), a small `--text-muted` caption — mirrors the fee-catalog `refreshFailed` latch (avoid the
  transient pending blink; R5).

### 1.6 Create / Edit — filament & printer form (Sheet, §0.2)

Right-anchored full-height `Sheet`. Form = RHF + Zod reusing the **exact** calculator per-field pt-BR
validation (FR-306: a saved value can never flow NaN/∞ into the engine). Fields use `Field` + `NumberField`
(currency/unit affixes) exactly like Calcular.

```
                         ┌──────────────────────────┐
                         │ Novo filamento         ✕ │  ← SheetTitle + ≥44px close
                         │                           │
                         │ Nome                      │
                         │ [ PLA Azul              ] │  ← text Field (required)
                         │ Material                  │
                         │ [ PLA                   ] │  ← text (label; free text)
                         │ Custo do rolo             │
                         │ [ R$ 110,00             ] │  ← NumberField currency (≥0)
                         │ Peso do rolo              │
                         │ [ 1        kg           ] │  ← NumberField unit (>0)
                         │ Desperdício padrão (opc.) │
                         │ [ 0        g            ] │  ← optional (defaultWasteGrams?)
                         │                           │
                         │ [   Cancelar  ][ Salvar ] │  ← Salvar = primary, loading-aware
                         └──────────────────────────┘
```

Printer sheet (T022) mirrors: Nome / Valor da máquina (R$, ≥0) / Vida útil (h, >0) / Consumo médio (kW, ≥0,
reuse the `avgPower` hint "consumo médio real, não a potência de placa") / Reserva de manutenção (R$/h, opc.).

- **Field errors**: per-field, reuse `calculator.validation.*` + `rollWeightError` / `machineLifetimePositive`
  verbatim (same messages the calculator asserts).
- **Save success**: real `toast tone="success"` "Filamento salvo." + Sheet closes + list refreshes. This toast
  fires **only** on a real 201/200 (never offline, never lapsed, never free — matrix §0.3).
- **Edit** = same Sheet, title "Editar filamento", pre-filled, "Salvar alterações".

### 1.6b Products — full page route (US6 / T030)

`/catalogo/produtos/novo|:id` reusing the Calcular layout. Header action "Salvar produto". Adds: a `Nome do
produto` field at top, and **two catalog `Select` pickers** ("Filamento salvo" / "Impressora salva") that
pre-fill the referenced fields (same component as the calculator picker, §4). The channel + "Outros custos"
sections are the calculator's existing ones. **No stored price is shown on reopen** — the page recomputes live
via the existing `computeFromForm` at the current `PRICING_MODEL_VERSION` (FR-310).

**Dangling reference (US6-4)** — deleting a filament/printer referenced by a product:
- At the delete-confirm of the *filament/printer*, if referenced, the confirm Dialog gains a warn line:
  `"Este filamento é usado em {n} produto(s). Eles manterão os últimos valores, editáveis."` → allow on confirm.
- On reopening the product, a calm `Alert tone="info"` at the top of the referenced section: `"O filamento
  vinculado foi removido. Mantivemos os últimos valores — edite se precisar."` The picker resets to "— Manual —"
  and the fields carry the last-known values as normal editable inputs. Never blank, never broken.

### 1.7 State — LONG LIST

No pagination (contract). Quiet count caption under the active tab (`"{n} filamentos"`). Vertical scroll only;
the `＋ Novo` header + tabs are the only sticky-worthy elements — recommend the tabs+action row stays pinned so
`＋ Novo` is reachable in a long list (nice-to-have, not blocking).

---

## 2. Catálogo tab — FREE / SIGNED-OUT (US7 → T032, honest teaser)

Evolution of today's shipped empty-state (`catalogo.emptyTitle/emptyBody`). The tab **explains the premium
value honestly and shows a visible affordance** whose tap opens the teaser — it is never a broken CRUD screen,
never a price, never a date, never a fake save (Q5/FR-312). Two sub-states share one layout:

### 2.1 Free (signed-in, `none`)

```
┌────────────────────────────────────────────┐
│  Catálogo                                   │
│                                             │
│            (◆ package icon)                 │
│      Salve e reutilize seu catálogo         │  ← title
│  Guarde filamentos, impressoras e produtos  │
│  uma vez e preencha o cálculo com um toque. │  ← desc (value; NO price/date)
│                                             │
│            [   + Adicionar filamento   ]    │  ← VISIBLE affordance (teaser trigger)
│                                             │
│  Salvar faz parte do Premium.               │  ← quiet line (reuses entitlementRequired)
└────────────────────────────────────────────┘
```

Tap `＋ Adicionar filamento` (or any save affordance) → **teaser Dialog** (center):

```
                    ┌──────────────────────────┐
                    │ (♛ crown)              ✕ │
                    │ Salvar faz parte do       │  ← DialogTitle
                    │ Premium                   │
                    │                           │
                    │ No Premium você salva      │  ← DialogDescription (value)
                    │ filamentos, impressoras   │
                    │ e produtos e preenche o    │
                    │ cálculo com um toque.      │
                    │                           │
                    │ Calcular e ver a conta     │  ← reaffirms the free promise
                    │ continuam grátis.          │
                    │                           │
                    │            [  Entendi  ]  │  ← single dismiss. NO price, NO date,
                    └──────────────────────────┘     NO "assinar agora" (billing = E6)
```

- **No CTA to buy** — billing is E6; a purchase button would promise a flow that doesn't exist (Principle II).
  The panel informs; it does not sell. When E6 lands, this dismiss becomes the upgrade entry.
- Uses `Icon name="crown"` (already in the set) as the Premium marker, consistently everywhere Premium is named.

### 2.2 Signed-out

Same layout; the affordance-tap teaser adds one honest step: saving needs an account **and** Premium.

```
                    │ Para salvar seu catálogo, │
                    │ entre e ative o Premium.  │
                    │                           │
                    │   [ Entrar ]  [ Entendi ] │  ← Entrar → /sign-in (existing flow)
```

"Entrar" routes to the existing Google sign-in (which already states the calculator stays free). Honesty holds:
login alone won't unlock saving — the copy says so.

**Relationship to `freemiumNote`**: the calculator footer already reads *"Calcular e ver a conta é grátis.
Salvar e exportar fazem parte do Premium."* The teaser is the **interactive expansion of that same sentence** —
keep the wording aligned so free users hear one consistent promise across surfaces.

---

## 3. Catálogo tab — LAPSED (Q3 read-only freeze → shared across T019/T022/T030)

The seller's data is intact and usable; only writes are frozen. Tone = **calm and reassuring, never punitive**
("expirou/bloqueado/suspenso" language is banned). The lists render normally (reads work); a persistent info
banner explains the state; write affordances stay visible and, on tap, open the **reactivation panel** (no
price, no date — same honesty bar as the teaser).

```
┌────────────────────────────────────────────┐
│  Catálogo                                   │
│  ┌────────────┬────────────┬────────────┐  │
│  │ Filamentos │ Impressoras│  Produtos  │  │
│  └────────────┴────────────┴────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ ⌁ Premium pausado                    │  │  ← Alert tone="info" (NOT danger)
│  │   Seus itens continuam aqui e podem  │  │
│  │   ser usados no cálculo. Para criar  │  │
│  │   ou editar, reative o Premium.       │  │
│  └──────────────────────────────────────┘  │
│  ┌───────────────────────────[  + Novo ]┐  │  ← visible; tap → reactivation panel
│  │  ┌──────────────────────────────────┐ │  │
│  │  │ PLA Azul                     ✎  🗑│ │  │  ← ✎/🗑 also → reactivation panel
│  │  │ PLA · R$ 110,00 / 1 kg           │ │  │  ← still readable; still pre-fillable
│  │  └──────────────────────────────────┘ │  │     in Calcular
```

- Tapping a **row body** in lapsed → opens a **read-only detail** view (or simply does nothing beyond a subtle
  "somente leitura" hint) — recommend read-only detail so the seller can still *see* values; editing from it →
  reactivation panel. Simplest acceptable PR-B behavior: row body opens the normal edit Sheet in a **read-only
  variant** (fields disabled, footer swapped for the reactivation line) — reuses the same Sheet, no new screen.
- **Reactivation panel** = same shape as the teaser Dialog, copy tuned: *"Reative o Premium para voltar a criar
  e editar. Seus itens estão salvos."* No price, no date, no fake action.
- **Never** show a delete/edit as *working* then fail — the intercept happens on tap, honestly.

---

## 4. Calculator picker — USE FROM CATALOG (US5 → T024)

**Prime directive (FR-313/SC-310)**: the manual calculator stays fully free / offline / signed-out and
**byte-identical**. The picker is purely **additive**, sits **above** the manual grid, defaults to Manual, and
ignoring it yields the exact E1 experience. Nothing about the compute path changes (SC-305).

### 4.1 Placement

- **Filamento** picker → top of the **"Custos da peça"** FieldGroup (pre-fills costPerRoll / rollWeight /
  material-linked fields).
- **Impressora** picker → top of the machine fields (pre-fills machineValue / machineLifetime / avgPower /
  maintenance). These currently live in "Custos da peça" / "Ajustes opcionais"; add the printer picker at the
  head of whichever group holds the machine fields.

```
┌────────────────────────────────────────────┐
│  ⓘ Custos da peça                           │  ← existing SectionTitle
│  ┌──────────────────────────────────────┐  │
│  │ Usar filamento salvo                  │  │  ← additive picker row (premium)
│  │ [ PLA Azul                        ▾ ] │  │  ← Select: options = saved + "— Manual —"
│  │ ✎ do catálogo: PLA Azul · editável    │  │  ← seal (Badge/caption) when a pick is active
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Custo do rolo     Peso do rolo        │  │  ← existing manual grid, now pre-filled,
│  │ [ R$ 110,00 ]     [ 1     kg ]        │  │     STILL EDITABLE
│  │ …                                     │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- **Control**: reuse `Select` (native → OS wheel picker, ideal at 390px, zero deps). Default option value =
  Manual (empty); options list the saved filaments/printers by name. Picking → `setValue` on the mapped fields
  (RHF), fields **remain editable** (pre-fill, never lock — FR-308).
- **"From catalog" indicator** (reuse the seal vocabulary already in `messages.calculator.seals`): a small
  caption/`Badge tone="info"` under the picker — `"do catálogo: {nome} · editável"`.
- **Override indicator**: the moment the user edits any pre-filled field, flip the seal to reuse
  `seals.adjusted` = **"ajustado por você"** → `"do catálogo: {nome} · ajustado por você"`. This is the exact
  honesty pattern the marketplace `FeeSeal` already uses — consistent language, no new concept.
- **Offline (Q2)**: picker options come from the uid-keyed cache; pick/pre-fill works offline (freeze/read
  allowed). If the cache was never loaded online → picker shows a single disabled honest option **"Conecte para
  carregar seu catálogo"** (never a fabricated item). If served stale, the section seal notes it (reuse
  `"pode estar desatualizada"`).

### 4.2 Free / signed-out (US7 teaser slot, reserved by T024)

The picker row is **still visible** but non-functional as a picker — it's a teaser trigger. It must **not**
interfere with the manual fields below (they stay fully usable, SC-310).

```
│  ┌──────────────────────────────────────┐  │
│  │ ♛ Usar filamento salvo                │  │  ← visible affordance (crown marker)
│  │ [ Salvar faz parte do Premium     › ] │  │  ← tap → teaser Dialog (§2). NOT a Select
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Custo do rolo     Peso do rolo        │  │  ← manual grid = 100% free, untouched
```

Render as a `Button`/row (not a `Select`) for free/signed-out so there's nothing to fake-pick; tap → the same
teaser Dialog from §2. Lapsed → tap opens the reactivation panel (§3), but picking a saved item to **pre-fill**
still works (read/pre-fill survive freeze — matrix §0.3).

---

## 5. Conta — plan line (T025b · replaces the static `PlanSection`)

Renders `GET /api/v1/entitlement` → `{ status: none|active|lapsed, source?, expiresAt? }` honestly (FR-304).
No fabricated states; no billing/cancel copy (E6). Loading/error mirror the existing `IdentitySection`
(Spinner / `Alert` + retry).

### 5.1 States

```
none (default, today's behavior kept):
│ ┌──────────────────────────────────────┐ │
│ │ Plano                      [Gratuito] │ │  ← Badge neutral (unchanged copy)
│ └──────────────────────────────────────┘ │

active (granted):
│ ┌──────────────────────────────────────┐ │
│ │ Plano                    [♛ Premium]  │ │  ← Badge success + crown
│ │ Concedido para teste (beta)           │ │  ← source line (beta) — grantor NEVER shown
│ │ Válido até 31/12/2026                 │ │  ← expiry when present; else "Sem prazo"
│ └──────────────────────────────────────┘ │

lapsed (was granted, expired/revoked):
│ ┌──────────────────────────────────────┐ │
│ │ Plano                 [Premium pausado]│ │  ← Badge neutral (NOT danger — calm)
│ │ Seus itens salvos continuam            │ │
│ │ disponíveis para leitura.              │ │
│ └──────────────────────────────────────┘ │
```

- `source`: map `beta` → "Concedido para teste (beta)", `comp` → "Cortesia". `expiresAt` → "Válido até
  {dd/mm/aaaa}" or "Sem prazo" when null. **`grantor` is never in the wire payload** (contract) → never shown.

### 5.2 The ≤1-refresh window (FR-304 honest UX)

After the owner grants/revokes out-of-band, the client may lag by up to one token/session refresh. Never render
a stale state as if it were fresh — offer an honest, cheap way to reconcile:

```
│ │ Mudou de plano agora há pouco?         │ │  ← caption, muted
│ │   [ Atualizar ]                        │ │  ← Button ghost/sm → refetch GET /entitlement
```

- `Atualizar` refetches the entitlement query. If the status changes → update in place (real). If it still lags
  (token not yet refreshed) → escalate copy to reuse the existing session line **"Sua sessão expirou. Entre
  novamente."** pattern, i.e. offer sign-out/in to force a fresh token. Never fabricate the new state to please.
- This same helper is what the owner's beta-grant homologation walk (T026) uses to *see* the plan flip.

---

## 6. Microcopy pt-BR (proposed i18n keys — for `messages.pt-br.ts`, owner-ratified at T033)

> Proposed additions; final wording owner-ratified with the teaser (T033). Tom: honesto, calmo, sem marketing,
> **sem preço, sem data**. Structured to slot next to the existing `catalogo`/`conta`/`calculator` blocks.

```
catalogo: {
  // tabs
  tabFilaments: "Filamentos",
  tabPrinters: "Impressoras",
  tabProducts: "Produtos",
  // empty (premium, per entity)
  emptyFilamentsTitle: "Nenhum filamento salvo ainda",
  emptyFilamentsBody: "Salve seus filamentos uma vez e reutilize em cada cálculo.",
  emptyPrintersTitle: "Nenhuma impressora salva ainda",
  emptyPrintersBody: "Salve os dados da sua impressora uma vez e reutilize em cada cálculo.",
  emptyProductsTitle: "Nenhum produto salvo ainda",
  emptyProductsBody: "Salve um produto e reabra para recalcular com a fórmula atual.",
  addFilament: "Adicionar filamento",
  addPrinter: "Adicionar impressora",
  addProduct: "Adicionar produto",
  // list / actions
  countFilaments: "{n} filamento(s)",
  edit: "Editar",
  remove: "Excluir",
  // load/error
  loadError: "Não foi possível carregar seu catálogo.",
  retry: "Tentar novamente",
  // offline (Q2)
  offlineTitle: "Modo leitura offline",
  offlineBody: "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.",
  offlineWriteBlocked: "Criar e editar precisam de conexão.",
  staleHint: "pode estar desatualizada",
  // lapsed (Q3) — calmo, não punitivo
  lapsedTitle: "Premium pausado",
  lapsedBody: "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.",
  readOnlyHint: "somente leitura",
},

catalogForm: {
  newFilament: "Novo filamento",
  editFilament: "Editar filamento",
  newPrinter: "Nova impressora",
  editPrinter: "Editar impressora",
  name: "Nome",
  material: "Material",
  defaultWaste: "Desperdício padrão",
  cancel: "Cancelar",
  save: "Salvar",
  saveChanges: "Salvar alterações",
  savedFilament: "Filamento salvo.",   // real success toast only
  savedPrinter: "Impressora salva.",
  // delete confirm
  deleteFilamentTitle: "Excluir “{nome}”?",
  deleteBody: "Esta ação não pode ser desfeita.",
  deleteConfirm: "Excluir",
  // dangling ref (US6-4)
  deleteReferencedWarn: "Este item é usado em {n} produto(s). Eles manterão os últimos valores, editáveis.",
  danglingOnReopen: "O item vinculado foi removido. Mantivemos os últimos valores — edite se precisar.",
},

catalogPicker: {  // calculator §4
  useFilament: "Usar filamento salvo",
  usePrinter: "Usar impressora salva",
  manual: "— Manual —",
  fromCatalog: "do catálogo: {nome} · editável",
  fromCatalogAdjusted: "do catálogo: {nome} · ajustado por você",  // reuse seals.adjusted tone
  offlineNeedsLoad: "Conecte para carregar seu catálogo",
},

premiumTeaser: {  // US7 §2 — NO price, NO date, NO fake save
  title: "Salvar faz parte do Premium",
  body: "No Premium você salva filamentos, impressoras e produtos e preenche o cálculo com um toque.",
  freeReassure: "Calcular e ver a conta continuam grátis.",
  signedOutBody: "Para salvar seu catálogo, entre e ative o Premium.",
  signIn: "Entrar",
  dismiss: "Entendi",
  // lapsed reactivation
  reactivateTitle: "Reative o Premium",
  reactivateBody: "Reative o Premium para voltar a criar e editar. Seus itens estão salvos.",
},

conta: {  // extends existing conta block (§5)
  planPremium: "Premium",
  planLapsed: "Premium pausado",
  planSourceBeta: "Concedido para teste (beta)",
  planSourceComp: "Cortesia",
  planValidUntil: "Válido até {data}",
  planNoExpiry: "Sem prazo",
  planLapsedBody: "Seus itens salvos continuam disponíveis para leitura.",
  planJustChanged: "Mudou de plano agora há pouco?",
  planRefresh: "Atualizar",
  // still-stale escalation reuses apiError.tokenExpired ("Sua sessão expirou. Entre novamente.")
},
```

Existing keys reused unchanged: `apiError.entitlementRequired` ("Salvar faz parte do Premium."),
`calculator.freemiumNote`, `calculator.seals.adjusted` ("ajustado por você"),
`calculator.validation.*` + `rollWeightError` + `machineLifetimePositive`, `conta.planLabel`/`planFree`.

---

## 7. Claude Design handoff — what to prototype visually + DS gaps

### 7.1 Screens/states worth a visual (pixel) prototype (owner → Claude Design)

Ranked; PR-B can proceed on **this wireframe + the existing DS** for all of them — the visual pass is polish,
not a blocker.

1. **Catálogo premium — populated list + segmented tabs** (the new IA; validates row density + tab control at
   390px). *High value.*
2. **Create/Edit Sheet** (filament & printer) — confirm the right-full-height sheet vs mobile keyboard. *High.*
3. **Premium teaser Dialog** (free + signed-out variants) — the honesty-critical surface; owner ratifies copy
   (T033). *High.*
4. **Calculator picker row + "do catálogo/ajustado" seal** — the additive, must-not-disturb layer. *High.*
5. **Conta plan line** — none / active / lapsed + the ≤1-refresh "Atualizar" helper. *Medium.*
6. **Offline read banner** + **lapsed freeze banner** (calm info tone, not danger). *Medium.*
7. **Empty states** (per entity) with the `EmptyState.action` button. *Low (DS-ready).*
8. **Product page** (US6/PR-C) — reuses Calcular layout; prototype only if the two ref-pickers + dangling-ref
   Alert need visual tuning. *Low, PR-C.*

### 7.2 DS gaps (compose-first; nothing here invents a primitive silently)

- **G1 — Tabs / Segmented control** (`role="tablist"`): needed for the recommended Catálogo IA (§0.1-A).
  *Alternative without a new primitive*: compose a Button toggle-group + roving tabindex + `aria-selected`.
  *Cleaner*: scaffold a Radix `Tabs` the same way `Dialog` was Radix-wired (ADR-0007). If the owner wants zero
  DS work for PR-B, fall back to Option B (stacked SectionTitles) — no gap. **Decision needed by T019.**
- **G2 — List row / ListItem**: no primitive; fully composable from `Card padding="sm"` + flex + two ghost
  icon `Button`s. Recommend a tiny `features/catalog` local component, not a DS addition. *No real gap.*
- **G3 — Skeleton loader**: none. `Spinner` is the honest minimum for PR-B; a `Skeleton` is a later polish, not
  required. *Soft gap.*
- **G4 — Menu / kebab / dropdown**: none — **deliberately avoided**. Two explicit `✎`/`🗑` actions read better
  at this list size and dodge a whole a11y surface. *Not a gap; a decision.*
- **G5 — Confirm/AlertDialog helper**: `Dialog` (center) + a danger `Button` covers it; a thin
  `ConfirmDialog(features)` wrapper is worth it for reuse (delete + dangling-ref + reactivation share the
  shape) but is app-level, not a DS primitive. *No DS gap.*

---

## Determinism / honesty guardrails carried into every UI task

- Server is the only authority on writes (FR-301) — the UI's entitlement gating (§0.3) mirrors it for honesty,
  never *replaces* it. A `403 ENTITLEMENT_REQUIRED` from any surface maps to the existing pt-BR
  `apiError.entitlementRequired`.
- No fake success, ever: success toasts fire only on real 2xx (offline/lapsed/free never toast success).
- Read/pre-fill survive `active` **and** `lapsed`; die in `none`. Writes need `active` **and** a connection.
- The E1 manual calculator is untouched and byte-identical (SC-305/SC-310) — the picker is additive only.
- All copy: honest, calm, pt-BR, **no price, no date** on any Premium/teaser/lapse surface (Q5/FR-312/FR-014).
```

