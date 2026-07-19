# UX Spec — E5 saved marketplace scenarios (T001 · designer-ux → Claude Design handoff)

**Level**: wireframe / flow / state — **NOT pixel-final**. Final UI is produced in Claude Design from this + the
UI the owner envisions. Structure in English; all user-facing copy in **pt-BR** (i18n-ready, tom honesto/calmo).

**Feeds**: T010 (save action + "Salvar cenário" sheet), T013 (list + reopen), T014 (reopen → live recompute),
T016 (US5 teaser). Forward-designed here, **not blocking PR-A**: T023 (D3/D6 degraded caption, PR-B), T024 (kit
basis), T026 ("Duplicar", PR-B), T028/T029 (rename · edit-config · search · delete · lapse, PR-B), T036 (US7
record-from-scenario, PR-C, droppable). Non-blocking, parallel with all of PR-A (tasks.md T001).

**Sources of truth**: `spec.md` (US1–US7, FR-601..620, SC-601..612, the **four-object map**, §Clarifications
sessions 2026-07-17 + 2026-07-19) · `data-model.md` (§3 the intent envelope, §7 DECIDED points) ·
`contracts/api-surface.md` (7 routes; **⚠ list-ordering drift — §11-F3**) · **ADR-0021** (Proposed — store
intent, resolve values live; soft reference; read-time D3/D6) · house honesty lineage:
`specs/009-e4-history-snapshots-export/ux-history.md` (the format + the inverse two-shelf rule),
`specs/008-e3-multi-piece-bom/ux-bom.md` §1.2-D (the `productForm.manualValuesKept` degraded caption, F1/K3),
`specs/007-e2-catalog-entitlement/ux-catalog.md` §2/§4 (offline · lapse · staleness vocabulary) ·
`docs/product/ux-decisions.md`. The **live multi-channel calculator** surface is the screenshot at
`e5-calcular-390.png` (this spec dir) — this IA **extends that surface**, it does not replace it.

**Mobile-first 390px.** Every wireframe drawn at that viewport; ≥44px touch targets; **no horizontal overflow at
390px** is a hard invariant (adversarial SIZE is a design input — §0.4). Desktop notes inline.

**DS reused (ADR-0007 `tf-*`)**: `PageHeader`, `Card`, `EmptyState`, `Alert`, `Badge`, `Button`, `Icon`,
`Spinner`, `Field`, `NumberField`, `Select`, `Switch`, `Dialog`/`Sheet` (Radix focus-trap, ≥44px close),
`Toaster`/`toast`, `PriceHero` (**used here — the inverse of E4**, §0.3), the whole shipped 005 calculator
(fields · channel slots · `Como chegamos no preço` · `Preços por canal`). The E2 `PremiumTeaserDialog` is
**reused, not rebuilt**. No new DS primitives invented; real gaps in §10.

---

## 0. Cross-cutting decisions — read before building any scenario surface

### 0.1 The honesty core — entitlement × connectivity × affordance matrix

Persistence is **server-authoritative** (FR-603, Constitution IV); the **live recompute on reopen runs
client-side** in `pricing-core` (FR-619, ADR-0015). The client mirrors that truth honestly; it never decides it.
A **write** is only *offered* as real when the last-known **server** entitlement was `active` — never a
client-held flag.

The one line that separates E5 from E4: **a scenario write has NO offline path.** There is no outbox, no
`pending`, no queue (the deliberate contrast with E4 — FR-613). Offline, a write **fails honestly and nothing
persists**. Only **reads/reopen/recompute** work offline (from cache).

| Affordance | `active` online | `active` OFFLINE | `lapsed` | `none` (free) / signed-out |
|---|---|---|---|---|
| **"Meus cenários"** entry (the door) | list (server ∪ read cache) | list from cache | list, **read-only freeze** | **teaser surface** (§7), never a broken/fabricated list |
| Open a scenario → **live recompute** | today's numbers | today's numbers, cache + **staleness seal** | today's numbers (**recompute is a read**, survives lapse) | — (free uses the free 005 calculator) |
| **"Salvar cenário"** (inline, Calcular) | `POST` → real 201 + toast | **honest "precisa de conexão"**, nothing persists | tap → **reactivation panel** (server denies anyway) | **button ABSENT on the free calculator** — ⚠ §11-F2 (the SC-109 rule) |
| **"Salvar alterações"** (`PUT` full-config) | works | honest conexão | reactivation panel | — |
| **"Duplicar"** (US4) | `POST /duplicate` → 201 | honest conexão | reactivation panel | teaser (no card to duplicate — the surface just explains) |
| **Renomear** (`PATCH`) · **Excluir** (`DELETE`) | works | honest conexão | reactivation panel | — |
| Any **"salvo!" success** toast | **real 2xx only** | never | never | never |

Three non-negotiables carried from E2 §0.3 / E3 §0.1 / E4 §0.1: **(1)** the *door* (the scenarios surface) is
**visible**, never hidden; **(2)** the intercept is **honest and specific** (conexão / reativação / Premium —
never a generic error, never a fake "salvo!"); **(3)** nothing persists and no success is faked.

> **⚠ SC-109 × FR-616 — the same head-on collision E4 hit (§11-F2, must be owner-ratified).** FR-616 says every
> free "salvar cenário / duplicate / scenarios" affordance is **visible → teaser**. But **SC-109 (spec 005,
> shipped + e2e-pinned)** forbids *any* save/export/paywall **button** on the free calculator. E4 resolved the
> identical conflict (owner, 2026-07-13): the record button is **absent** on the free calculator; the honest door
> is the **Histórico tab**. **This spec applies the same resolution:** the inline **"Salvar cenário" button is
> premium-only (absent for free)**; the honest door for a free user is the **"Meus cenários" surface** (a
> navigation affordance, not a save button — SC-109-safe, exactly like opening the Histórico tab), which
> explains + teases. FR-616's intent ("a scenarios affordance is visible → teaser") is met by the door; SC-109 is
> respected because no *save button* sits on the free calculator. **This reconciliation is also the strongest
> functional argument in Q11 — see §1.**

### 0.2 The four-object rule, as a *visual* rule (a scenario is the exact INVERSE of an E4 snapshot)

E4's whole risk was making a snapshot look frozen. E5's whole risk is the opposite: making a **live** scenario
accidentally look frozen (a stored date, a read-only chrome) — which would collapse it into a snapshot and break
the taxonomy. Wherever the E4 rule says "frozen / dated / read-only", the scenario rule is the **exact inverse**.

| | **Snapshot (E4)** | **Scenario (E5)** |
|---|---|---|
| On reopen | renders **stored** values, zero recomputation | **recomputes live** — it *is* the calculator, populated |
| Money label | `Valor cotado` | **`Preço`** (the live calculator's word — today's price) |
| Date on the face | **always** (the date is the claim) | **NEVER** — no date anywhere on a scenario surface |
| `PriceHero` | **banned** (§0.3 E4) | **used** — the live-price hero is the signature of "hoje" |
| Fields | **read-only rows**, no form | **editable inputs** — the full live calculator, tweakable |
| Referenced basis edited | nothing changes | **D3 live-reflect** on reopen |
| Referenced basis deleted | nothing changes | **D6 last-known** + the calm `manualValuesKept` caption |
| The words *removido / excluído / deletado* | banned (absence is the behavior) | **banned** — degrade to last-known, never a removal claim |

**Four design devices that make a scenario unmistakably LIVE at a glance** (cheap, they compound):
1. **`PriceHero` on reopen** — the same live retail/atacado hero the free calculator shows; a scenario reopens
   *into the calculator*, not into a receipt.
2. **No date, anywhere.** No "salvo em", no "cotado em" — a scenario is a view of *today*. (Only `updated_at`
   drives internal ordering; it is not on the card as a claim — see §3.1 and §11-F3.)
3. **Editable fields, not rows.** The reopened surface is the live form; the seller can change a fee and watch
   the price move (that *is* duplicate-to-tweak).
4. **The fee seals move.** A non-overridden slot re-resolves and shows the catalog seal; an overridden slot keeps
   the number + **`ajustado por você`**; offline shows **`pode estar desatualizada`** — never stale-as-live.

> Homologation cue (T031): the live-vs-frozen contrast is only proven when, **side by side**, a deleted product
> makes a **snapshot change nothing** and makes a **scenario's basis degrade to last-known + reflect a fee
> refresh** on reopen. Design them so a screenshot of each is obviously a different kind of object.

### 0.3 Money + seal rendering rules (live — the inverse of E4 §0.3)

- **The reopened scenario computes.** Unlike a snapshot, every number is produced by the shipped `pricing-core`
  path (`fee-prefill.ts` re-resolves non-overridden slots → `computeCalculator` / `computeBom`). This is the
  **only** honesty inversion from E4: here the UI *does* show a live computed price, because that is the feature.
- **No stored price is ever shown as the scenario's value.** The list card shows **name · note · last-updated**
  and **never a price** (there is no stored price — FR-606/VR-611). The price appears only inside the reopened
  live calculator.
- **Absence ≠ zero** still holds in the breakdown (reused from the shipped calculator): a line the compute did
  not produce renders nothing, never `R$ 0,00`.
- **The three fee seals carry in verbatim** (005): `ajustado por você` (overridden slot), the catalog reference
  seal (re-resolved slot), `pode estar desatualizada` (offline/stale cache), `sem referência — informe as taxas`
  (uncovered combination), the ML free-shipping `estimativa` seal. E5 **fabricates no fee** and adds no new seal.
- **Money uses tabular figures**, right-aligned (Inter `tnum`, `ux-decisions.md`) — reused from the calculator.

### 0.4 Adversarial SIZE is a design input (the E4 lesson, applied)

Homologation and layout must be tested with a **120-char name** and a **500-char note**, not "Cenário 1".

- **List card name**: single line, **ellipsis-truncated** at the card width; the full name lives in the loaded
  context bar (§4.1, wraps to max 2 lines) and the rename sheet. **The card never wraps the name to a third line
  and never horizontal-scrolls.**
- **List card note**: clamped to **2 lines** (`line-clamp-2`) with ellipsis; the full note is in the rename/edit
  sheet.
- **Loaded context bar** ("Cenário: {name}"): the name truncates so the **[Duplicar]/[⋯] actions never get
  pushed off-screen**; a 120-char name must not steal the actions. Truncate the name, never the controls.
- **Many channels (3 marketplaces)**: the reopened live view inherits the shipped 005 stacked per-channel cards —
  already non-overflowing at 390px. E5 adds no wider row.
- **Duplicate default name** "Cópia de {name}" can exceed 120 when {name} is already long — see §5 + §11-F6.

---

## 1. Q11 — IA placement of the scenarios surface (the headline recommendation; ≥2 options + confidence)

**The behavioral requirement (FR-615) is fixed: save / load / list a scenario must be reachable from the
multi-channel calculator.** The *placement* is my recommendation + the owner's call. The owner's working default
is **(a) inside Calcular, 65%**. I concur, at a **similar confidence, and with one refinement forced by §0.1**:
the *list entry point* must be a **navigation-like affordance** (so it is the free user's honest door without
breaking SC-109), not merely an inline "save" button.

**Option A — inside Calcular, list as a sub-surface reached from a nav-like "Meus cenários" entry (RECOMMENDED,
~66%).**
Concretely: (1) a **"Meus cenários"** entry in the **Calcular page header** (always visible, incl. free/
signed-out → the honest door/teaser); tapping opens the scenarios **list** as a sub-route `/calcular/cenarios`
(or a full-height right `Sheet` on mobile). (2) **"Salvar cenário"** as a **premium-only** action near the
results / in the loaded-scenario context bar (absent for free — the SC-109 resolution, §0.1/§11-F2). (3) opening
a card **loads the config into the calculator** and closes the list → live recompute.
- **Pros:** a scenario **is** the saved calculator state — you always want to load it *into* Calcular to see it
  live and tweak/duplicate, so its home is the calculator surface; the nav-like "Meus cenários" door cleanly
  satisfies both FR-616 (visible → teaser) and SC-109 (no save button on the free calc); **no 6th bottom tab**
  (the nav is already 5: Calcular · Catálogo · Kits · Histórico · Conta — a 6th at 390px forces an overflow/"Mais"
  pattern).
- **Cons:** the list is one tap "deeper" than a top-level tab; discoverability rests on the header entry being
  prominent.
- **Scalability:** high — the sub-route pattern absorbs later scenario growth (compare-two-side-by-side, tags)
  without touching the bottom nav.

**Option B — a 6th "Cenários" bottom tab (peer of Histórico, ~26%).**
- **Pros:** honest **peer treatment** in the four-object map (Snapshot got a tab; a Scenario is its mirror);
  the cleanest free-door story (open the tab → teaser, identical to Histórico); a scenario browsed independently
  of a live calc session.
- **Cons:** **six labelled tabs at 390px** is crowded (~65px each) — it forces icon-only tabs or a "Mais"
  overflow, a real nav regression; and it slightly fights the functional truth that you load a scenario *into*
  Calcular, so a distant tab means a round-trip (open tab → open scenario → land back in Calcular). **This is the
  option to escalate if the owner weights four-object peer-consistency over nav economy** — it is not wrong, just
  costlier on the nav.

**Option C — under Catálogo (~8%).**
- **Rejected.** A scenario **materializes nothing** and is an *analysis*, not merchandise (spec §3, FR-604); the
  catalog IA is for things you sell. Putting scenarios under Catálogo is exactly the collision the four-object map
  warns against.

**Recommendation: Option A, confidence ~66%** — inside Calcular, with the list reached via a **nav-like "Meus
cenários"** entry (the free door) and **"Salvar cenário" premium-only inline** (SC-109). The residual 34% is the
genuine peer-consistency pull of Option B; if the owner prefers B, the wireframes below port almost unchanged
(the list surface and reopen flow are identical — only the entry point moves from the Calcular header to a bottom
tab). **Owner decides at T002/homologation.**

---

## 2. Surface — the "Salvar cenário" affordance + name/note sheet (US1 → T010)

### 2.1 Entry point on Calcular (premium-only inline — the SC-109 rule)

The shipped calculator (screenshot) already ends with the freemium **caption** *"Calcular e ver a conta é grátis.
Salvar e exportar fazem parte do Premium."* — that caption stays for everyone. For a **premium** seller, a
**"Salvar cenário"** button appears **below the `Preços por canal` block**, beside the existing caption:

```
│ Preços por canal                            │
│ ┌──────────────────────────────────────┐  │
│ │ Mercado Livre · Clássico              │  │  ← shipped 005 per-channel result
│ │ …                                     │  │
│ └──────────────────────────────────────┘  │
│                                             │
│  [        Salvar cenário        ]           │  ← PREMIUM ONLY (absent for free — §0.1)
│  Calcular e ver a conta é grátis.           │  ← existing caption, unchanged, for everyone
│  Salvar e exportar fazem parte do Premium.  │
```

- **Free / signed-out**: the button is **absent** (SC-109). The honest door is **"Meus cenários"** (§1 / §3.5).
- **Lapsed**: the button is **visible** and, on tap, opens the **reactivation panel** (E2 §3, no price/date).
- **Offline (active)**: the button is visible; on tap it **fails honestly** — *"Salvar um cenário precisa de
  conexão."* — nothing persists, no `pending`, no queue (FR-613, the E4 contrast).

### 2.2 The "Meus cenários" header entry (the door — always visible)

Top of the Calcular page, a compact secondary affordance (nav-like, **visible for everyone**):

```
│  CALCULAR PREÇO                    ☰ Meus cenários │  ← header entry (premium→list, free→teaser)
```

Placement note: it sits with the page title, **not** inside the results block — so it reads as *navigation to a
surface*, not as a *save button on the calculator* (the SC-109 distinction, §0.1). Desktop: same, right-aligned
in the page header.

### 2.3 The save Sheet (right-anchored full-height `Sheet` — E2/E4 idiom)

```
                         ┌──────────────────────────┐
                         │ Salvar cenário         ✕ │
                         │ Guardamos a estratégia    │  ← honest: intent, not a price
                         │ desta tela — canais,      │
                         │ taxas ajustadas, base de  │
                         │ custo. Ao reabrir, ela    │
                         │ recalcula com os preços   │
                         │ de hoje.                  │
                         │                           │
                         │ Nome *                    │
                         │ [ ML Clássico × Shopee  ] │  ← Field, obrigatório, ≤120
                         │                           │
                         │ Nota (opcional)           │
                         │ [ Comparação pré-Black  ] │  ← Field textarea, ≤500
                         │ [ Friday                ] │
                         │                           │
                         │ Base de custo: Vaso G     │  ← echo of the current cost basis (read-only)
                         │ (referência do catálogo)  │     kind: avulsa | produto | kit
                         │                           │
                         │       [ Salvar cenário ]  │
                         └──────────────────────────┘
```

- **Name required, ≤120.** Blank on submit → inline error *"Dê um nome ao cenário."* Over 120 → inline
  *"Máximo de 120 caracteres."* (mirror an honest 422; never a silent truncation).
- **Note optional, ≤500.** Blank ⇒ NULL (never `""`). Over 500 → inline *"Máximo de 500 caracteres."*
- **Base de custo echo**: a read-only line stating what the scenario will reference — *avulsa* (ad-hoc inputs),
  *produto* ("Vaso G"), or *kit* — so the seller knows what they are saving. No editing of the basis here (it
  comes from the calculator state).
- **`config` over 256 KB** (a very large kit basis) → the save fails with the honest 422 copy
  *"Este cenário ficou grande demais para salvar. Reduza o número de peças ou de custos e tente de novo."* —
  never a silent drop (data-model §7.5).
- **Success**: real 201 only → toast *"Cenário salvo."* + the context bar (§4.1) now shows the saved name.
- **Offline / lapsed / free**: per §0.1 (honest conexão / reactivation / absent).

---

## 3. Surface — the scenarios list (US2 → T013; search/manage = PR-B)

### 3.1 Frame + card anatomy (premium, populated)

Opened from "Meus cenários". Ordered **newest-saved first — `created_at DESC`** (owner-DECIDED 2026-07-19;
data-model §5). **⚠ the contract doc still says `updatedAt DESC` — reconcile, §11-F3; design follows the owner
decision.**

```
┌────────────────────────────────────────────┐
│ ‹ Voltar     Meus cenários                  │  ← Sheet/route header (focusable h1)
│  Estratégias salvas. Cada uma recalcula     │  ← description (states the LIVE promise, no date)
│  com os preços de hoje quando você abre.    │
│                                             │
│ ┌── busca (PR-B) ─────────────────────────┐ │
│ │ [ 🔎 Buscar por nome…               ]   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ ML Clássico × Shopee                  │  │  ← name (1 line, ellipsis — §0.4)
│  │ Comparação pré-Black Friday           │  │  ← note (2-line clamp; omitted if none)
│  │ Atualizado há 2 dias            ⋯     │  │  ← relative last-updated + overflow menu
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Vaso G — só Mercado Livre             │  │
│  │ Atualizado há 1 semana          ⋯     │  │  ← no note → the row is simply absent
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- **Card** = `Card padding="sm"`, whole body tappable → **loads the scenario into the calculator** and closes the
  list (§4). **No price on the card** (there is none — §0.3). **No absolute date** — a scenario carries no claim;
  the muted *"Atualizado há …"* is a management convenience, not a dated assertion (rendered from `updatedAt`).
- **Overflow `⋯`** (per card): **Abrir · Duplicar · Renomear · Excluir** (each gated per §0.1).
- **Truncation** per §0.4: name 1 line, note 2 lines, never horizontal scroll.
- **Desktop**: the same cards in a max-w column; no table (a table would read as a spreadsheet and risks 390px
  overflow on the small breakpoint).

### 3.2 States

**EMPTY (premium, zero scenarios)** — `EmptyState` + action:
```
            (◑ layers/compare icon)
      Nenhum cenário salvo ainda
  Monte uma comparação de canais na
  calculadora e toque em "Salvar cenário"
  para guardá-la e reabrir quando quiser.
        [   Voltar para a calculadora   ]
```

**LOADING** — centered `Spinner` in the list body; header stays (no layout jump).

**ERROR (server read failed, online)** — **never an error wall over data the user already holds**: if the cache
has scenarios, render them + a non-blocking `Alert tone="danger"` strip with `[ Tentar novamente ]`. Only a
*cold* failure (nothing cached) renders the full-panel error + retry (mirrors E2 §1.4 / E4 §2.4).

**OFFLINE (active, read from cache)** — calm `Alert tone="info"`: *"Modo leitura offline — seus cenários
continuam aqui e podem ser abertos. Salvar, renomear, duplicar ou excluir precisam de conexão."* (Reuses the
E2/E3/E4 offline vocabulary; note it never says "salvo" and it names that **writes need connection**, not a
queue.)

**LAPSED (read-only freeze, FR-612)** — calm `Alert tone="info"`: *"Premium pausado — seus cenários continuam
aqui e podem ser abertos e recalculados. Para salvar, renomear, duplicar ou excluir, reative o Premium."* Cards
render normally; every **write** affordance stays **visible** and, on tap, opens the reactivation panel (E2 §3;
no price, no date). **Nothing is deleted by the lapse.**

### 3.3 Long list (unbounded)

Keyset pagination (`created_at, id` DESC; data-model §5) → **infinite scroll with an explicit `[ Carregar mais ]`
button** (better for a11y + a bad connection than an auto-sentinel). A page size is **not a cap** — no copy may
suggest a limit (a cap would be a business-rules amendment, FR-611).

### 3.4 Search by name (US6 — PR-B, designed now)

- A `Field` text input, debounced, server-side owner-scoped `ILIKE '%term%'`. Empty result → honest
  `EmptyState`: *"Nenhum cenário encontrado para “{termo}”."* + `[ Limpar busca ]`. **Never** silently show
  everything.
- **⚠ Accent-sensitive (owner-DECIDED accept-as-is, 2026-07-19):** `joao` will **not** find `João`. The
  empty-result state **does not pretend otherwise** — it honestly reports zero matches for the term as typed; no
  copy implies accent-insensitive matching. (If the owner later adds `unaccent`, no copy changes.)

### 3.5 Free / signed-out — the door is here, not a broken list (US5 → §7)

Opening "Meus cenários" while free/signed-out shows the **teaser surface** (§7), **never** a fabricated sample
scenario and never a broken/empty "0 cenários" list that implies the feature is on. This is the honest door that
satisfies FR-616 without a save button on the free calculator (§0.1).

---

## 4. Surface — reopen → the LIVE view (US3 → T014/T023; the crux of the taxonomy)

**Opening a scenario loads its config into the shipped 005 calculator and recomputes live.** There is almost no
new UI here — the reopened scenario *is* the calculator (screenshot), pre-filled. The differences from a fresh
calc are five, all honesty-bearing.

### 4.1 The "cenário carregado" context bar (new, small composite)

Pinned at the top of the Calcular surface while a scenario is loaded:

```
│ ┌── cenário carregado ────────────────────┐ │
│ │ Cenário: ML Clássico × Shopee     ⋯     │ │  ← name (truncates; actions never pushed off — §0.4)
│ │ Recalculado com os preços de hoje ·     │ │  ← states LIVE, NO date
│ │ [ Duplicar ]   [ Salvar alterações ]    │ │  ← Duplicar (US4) · PUT full-config (US6)
│ └──────────────────────────────────────────┘ │
```

- **No date.** The subtitle affirms *"Recalculado com os preços de hoje"* — the live promise made visible, the
  inverse of E4's dated claim block (§0.2).
- **`⋯`**: Renomear · Fechar cenário (returns to a blank calc). Fechar never deletes.
- **Unsaved-changes state**: when the seller edits any field after loading, show a muted badge **"Alterações não
  salvas"** on the context bar and enable **"Salvar alterações"** (`PUT`). Closing with unsaved changes → a calm
  confirm *"Descartar as alterações não salvas deste cenário?"* → `[ Voltar ] [ Descartar ]`. See §11-F4 for the
  `PUT`-vs-"Salvar como novo" model.

### 4.2 The five honesty behaviors on reopen

1. **Live recompute, no frozen value** (FR-606). Every number is produced by the shipped path; `PriceHero` shows
   today's retail/atacado. **No date on any surface** (SC-602).
2. **Overridden fee slot → `ajustado por você`** (FR-607). A slot the seller explicitly adjusted keeps the number
   and shows the seal (`calculator.seals.adjusted`, reused). A **non-overridden** slot re-resolves from **today's**
   catalog and shows the catalog reference seal — a fee-catalog refresh since save **is** reflected here (the
   live-vs-frozen boundary, VR-604).
3. **Referenced basis edited → D3 live-reflect** (FR-607a). If the cost basis references a product/kit that was
   edited since save, the reopened scenario shows the **new** cost — the resolver read the live row.
4. **Referenced basis deleted → D6 last-known, honest** (FR-607b). If the ref no longer resolves (soft-deleted /
   cross-tenant / never-existed), the basis degrades to **last-known editable values** with the **calm muted
   caption reused verbatim from E2/E3** — *"Os valores atuais foram mantidos e continuam editáveis."*
   (`productForm.manualValuesKept`). The captured name still shows. **Never "removido/excluído/deletado"** (the
   F1/K3 guard — the regex `/removid|excluíd|deletad/i` must match nothing). The scenario stays **priceable +
   re-saveable**. **"Abrir origem"** is offered **only if the ref resolves** owned + live; when it does not, the
   affordance is simply **absent** (no broken link, no disabled button) — the E3/E4 posture.
5. **Offline → staleness, never stale-as-live** (FR-608). Computed offline from a cached reference past its
   freshness window, the affected slot shows the shipped seal **`pode estar desatualizada`** — never a stale fee
   dressed as fresh.

### 4.3 005 honesty cases hold inside a reopened scenario (FR-609)

Reused verbatim, no new copy: a slot the catalog cannot resolve → **`sem referência — informe as taxas`** (no
fabricated pre-fill); a saved override with **commission ≥ 100%** → the same inline per-slot error, **other slots
keep computing**, no NaN/Infinity; the ML free-shipping subsidy → the **`estimativa`** seal. E5 changes *which
inputs are persisted*, never the pricing math.

### 4.4 Kit basis (Q12 — owner-decided; PR-B → T024)

When the cost basis is a **kit**, the reopen applies the scenario's channelSet **uniformly to every kit line →
`computeBom` → per-marketplace rollup** (no `pricing-core` change). Visually this is the shipped kit-aware
per-channel result; the context bar's "Base de custo" reads *kit: {name}* and, if the kit ref degraded, the same
§4.2-4 D6 caption applies per line (the `(avulsa)` line vocabulary from E3).

---

## 5. Duplicate-to-tweak — the headline move (US4 → T026, PR-B)

Reachable from **two** places: the list card `⋯ → Duplicar`, and the loaded context bar `[ Duplicar ]`.

- **Duplicate creates an independent new scenario** — new id, own name, deep-copied config. Editing the copy
  changes **0%** of the original (VR-608, guaranteed by separate rows). The copy references the same product/kit
  and re-resolves live on its own reopen.
- **Default name**: **"Cópia de {name}"**. On success, the app **loads the copy** into the calculator (context
  bar shows the copy) so the seller can immediately tweak one thing and compare — that is the whole feature.
- **⚠ 120-char interaction (adversarial SIZE — §0.4 / §11-F6):** if {name} is already near 120, "Cópia de "
  overflows the cap. Recommended: **truncate the base so "Cópia de …" fits ≤120**, OR open the rename sheet
  pre-filled with the (truncated) proposed name so the seller confirms. Never a silent 422 on a headline action.
- **Offline / lapsed / free**: per §0.1 (honest conexão / reactivation / teaser — a free user has no card to
  duplicate; the teaser surface explains).

The comparison workflow, stated for the designer: *duplicate → the copy loads → change one channel/fee/framing →
the price moves live → the original is untouched in the list.* There is no side-by-side split view in v1 (out of
scope — the seller compares by reopening each); if the owner wants a two-up compare later it is additive and lands
on the sub-route pattern (Q11 Option A scales to it).

---

## 6. Manage + lapse (US6 → T028/T029, PR-B)

- **Renomear** (`PATCH`, name/note only): a small `Sheet` with the two `Field`s (same caps + inline errors as
  §2.3). From the list, renaming never re-sends the whole config (the `PATCH`/`PUT` split, owner-confirmed).
- **Editar configuração** (`PUT` full-replace): reopen → edit in the calculator → **"Salvar alterações"** on the
  context bar (§4.1). This realizes the four-object map's *"editable: name + whole config"*.
- **Excluir** (`DELETE`, soft): destructive, **always confirmed** — *"Excluir o cenário “{name}”? Esta ação não
  pode ser desfeita."* → `[ Voltar ] [ Excluir ]` (danger). Soft-delete; a lapse never deletes (FR-612).
- **Lapse read-only freeze** (§3.2 LAPSED + the §0.1 matrix): every write affordance stays **visible** → the
  reactivation panel; **reopen + recompute keep working** (recompute is a read — the Q9 line). Re-grant restores
  writes with data intact — zero UI state to reconcile.
- **"Cancelar" is banned (FR-014)** — every dismissive control is **"Voltar"**.

---

## 7. The honest teaser (US5 → T016; free / signed-out)

Reuses the E2 `PremiumTeaserDialog` lineage verbatim (crown; **no price, no availability date, no purchase CTA**
before E6; no fake "salvo!"). The **"Meus cenários" surface EXPLAINS** — it is never a broken list and **never a
fabricated sample scenario** (SC-607).

```
┌────────────────────────────────────────────┐
│ ‹ Voltar     Meus cenários                  │
│                                             │
│            (♛ crown)                        │
│   Salve suas estratégias de venda           │  ← title (value, no price/date)
│                                             │
│  No Premium, você guarda uma comparação de   │  ← body
│  canais — Mercado Livre, Shopee, Amazon —    │
│  e reabre quando quiser. Ela recalcula com   │
│  os preços de hoje, e você pode duplicar     │
│  para testar variações.                      │
│                                             │
│  A calculadora continua grátis.              │  ← reaffirms the free promise
│                                             │
│        [   Salvar um cenário   ]             │  ← visible affordance → opens the Dialog
└────────────────────────────────────────────┘

Dialog (ao tocar "Salvar um cenário" / "Duplicar"):
                    ┌──────────────────────────┐
                    │ (♛)                    ✕ │
                    │ Cenários fazem parte do   │
                    │ Premium                   │
                    │                           │
                    │ No Premium você salva sua  │
                    │ comparação de canais e     │
                    │ reabre depois com os       │
                    │ preços de hoje — e duplica │
                    │ para comparar variações.   │
                    │                           │
                    │ Calcular continua grátis.  │
                    │            [  Entendi  ]  │  ← SEM preço, SEM data, SEM "assinar"
                    └──────────────────────────┘

Signed-out: + "Para salvar seus cenários, entre e ative o Premium."
            [ Entrar ] [ Entendi ]     ← Entrar → /sign-in?redirect=/calcular/cenarios
```

- **No fabricated sample scenario, no fake "salvo!", nothing persists, no artifact generated** (US5 acceptance).
- The `PremiumTeaserDialog` is **parametrized, not cloned** (the E3 C2 / E4 note) — `redirect=/calcular/cenarios`
  + the `scenarios.teaser*` copy.

---

## 8. US7 — record a snapshot from a scenario (P3, DROPPABLE → T036, PR-C)

Light by design (droppable; cut before US4). A premium seller viewing a scenario's **live** result can **freeze
it into the Histórico** — reusing the **E4 record path verbatim** with the scenario as an **informational
provenance** source.

- **Entry point**: a `[ Registrar no histórico ]` button in the loaded context bar (§4.1), **premium-only**
  (same SC-109 posture; absent for free).
- **It opens the shipped E4 record Sheet** (ux-history.md §4.2) — no new record UI. The resulting snapshot is
  **byte-identical** to the scenario's current live computation and **frozen** (E4 immutability holds); the
  scenario is unchanged.
- **Provenance line** (informational only, on the snapshot detail's ficha técnica): *"Originou-se do cenário:
  {name}"* — it can never alter or degrade the snapshot. The E4 `provenance.kind` enum gains `"SCENARIO"` (a
  snapshot-payload change, **not** a scenarios-table change — data-model §7.6).
- **Honesty seam**: the moment a snapshot is recorded it becomes a **frozen, dated** object and must obey **all**
  the E4 rules (`Valor cotado`, the date, no `PriceHero`, no recompute). The bridge is the *one* place both
  objects meet — the designer must ensure the snapshot detail looks like E4, not like the live scenario it came
  from.

---

## 9. Microcopy pt-BR (proposed `messages.pt-br.ts` — owner-ratified at homologation)

> Tom: honesto, calmo, técnico-cordial. **Sem preço, sem data de disponibilidade, sem CTA de compra** (E6).
> **"Cancelar" é banido (FR-014) — usar "Voltar".** No new fee seal; the three 005 seals are reused as-is.

```ts
scenarios: {
  // entry / nav
  navEntry: "Meus cenários",
  listTitle: "Meus cenários",
  listSubtitle: "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.",
  // save
  saveAction: "Salvar cenário",
  saveSheetTitle: "Salvar cenário",
  saveSheetIntro:
    "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje.",
  nameField: "Nome",
  nameRequired: "Dê um nome ao cenário.",
  nameTooLong: "Máximo de 120 caracteres.",
  noteField: "Nota (opcional)",
  noteTooLong: "Máximo de 500 caracteres.",
  basisEcho: "Base de custo: {nome}",
  basisKindAdhoc: "avulsa",
  basisKindProduct: "referência do catálogo",
  basisKindKit: "kit do catálogo",
  saved: "Cenário salvo.",                       // toast success — SÓ em 201 real
  saveTooLarge:
    "Este cenário ficou grande demais para salvar. Reduza o número de peças ou de custos e tente de novo.",
  saveOffline: "Salvar um cenário precisa de conexão.",
  // list card
  updatedRelative: "Atualizado {quando}",        // "há 2 dias" etc. — NUNCA uma data-alegação
  cardMenu: "Mais ações",
  open: "Abrir",
  duplicate: "Duplicar",
  rename: "Renomear",
  delete: "Excluir",
  // list states
  emptyTitle: "Nenhum cenário salvo ainda",
  emptyBody:
    "Monte uma comparação de canais na calculadora e toque em “Salvar cenário” para guardá-la e reabrir quando quiser.",
  emptyAction: "Voltar para a calculadora",
  loadError: "Não foi possível carregar seus cenários.",
  retry: "Tentar novamente",
  loadMore: "Carregar mais",
  offlineTitle: "Modo leitura offline",
  offlineBody:
    "Seus cenários continuam aqui e podem ser abertos. Salvar, renomear, duplicar ou excluir precisam de conexão.",
  lapsedTitle: "Premium pausado",
  lapsedBody:
    "Seus cenários continuam aqui e podem ser abertos e recalculados. Para salvar, renomear, duplicar ou excluir, reative o Premium.",
  // search (PR-B)
  searchPlaceholder: "Buscar por nome…",
  searchEmpty: "Nenhum cenário encontrado para “{termo}”.",
  searchClear: "Limpar busca",
  // reopen — loaded context bar
  loadedLabel: "Cenário: {nome}",
  loadedLive: "Recalculado com os preços de hoje",   // NUNCA uma data
  unsavedBadge: "Alterações não salvas",
  saveChanges: "Salvar alterações",
  saveChangesDone: "Cenário atualizado.",            // SÓ em 200 real
  closeScenario: "Fechar cenário",
  discardChangesTitle: "Descartar as alterações não salvas deste cenário?",
  discardChanges: "Descartar",
  writeOffline: "Esta ação precisa de conexão.",     // renomear/duplicar/editar/excluir offline
  // degraded basis (D6) — reuse verbatim, NUNCA "removido/excluído/deletado"
  basisManualValuesKept: "Os valores atuais foram mantidos e continuam editáveis.",  // = productForm.manualValuesKept
  openOrigin: "Abrir origem",                        // SÓ se a referência ainda resolve
  // duplicate
  duplicateNamePrefix: "Cópia de {nome}",
  // delete
  deleteTitle: "Excluir o cenário “{nome}”?",
  deleteBody: "Esta ação não pode ser desfeita.",
  deleteConfirm: "Excluir",
  // US7 bridge (PR-C, droppable)
  recordSnapshot: "Registrar no histórico",
  provenance: "Originou-se do cenário: {nome}",
  // teaser (US5) — SEM preço, SEM data, SEM CTA de compra
  teaserTitle: "Salve suas estratégias de venda",
  teaserBody:
    "No Premium, você guarda uma comparação de canais — Mercado Livre, Shopee, Amazon — e reabre quando quiser. Ela recalcula com os preços de hoje, e você pode duplicar para testar variações.",
  teaserFreeNote: "A calculadora continua grátis.",
  teaserAction: "Salvar um cenário",
  teaserDialogTitle: "Cenários fazem parte do Premium",
  teaserDialogBody:
    "No Premium você salva sua comparação de canais e reabre depois com os preços de hoje — e duplica para comparar variações.",
  teaserSignedOutBody: "Para salvar seus cenários, entre e ative o Premium.",
  back: "Voltar",                                    // NUNCA "Cancelar" (FR-014)
},
```

Reused **unchanged**: `calculator.seals.adjusted` ("ajustado por você"), the `sem referência — informe as taxas`
and `estimativa` seals, `catalogo.staleHint` / the shipped `"pode estar desatualizada"`,
`productForm.manualValuesKept`, `apiError.entitlementRequired`, `premiumTeaser.{signIn,dismiss,reactivateTitle,
reactivateBody}`, the whole shipped `calculator.*` (fields · channel slots · results · per-channel rollup),
`nav.*`. E5 invents **no new fee vocabulary**.

---

## 10. Claude Design handoff — what to prototype + gaps

### 10.1 Worth a pixel prototype (ranked; PR-A can proceed on this wireframe + the shipped DS)

1. **The "cenário carregado" context bar** (§4.1) — the one genuinely new composite; it must read as *"this is a
   live saved strategy, recalculated for today"* with **no date**, and it must survive a 120-char name without
   pushing the actions off-screen. **Highest.**
2. **The scenarios list card** (§3.1) — name · note · relative-updated · `⋯`. Must be **impossible** to mistake
   for a live catalog/price card (no price on it) and must not overflow at 390px with adversarial name/note.
   **Highest.**
3. **The reopened live view with the moving seals** (§4.2) — an overridden slot (`ajustado por você`) beside a
   re-resolved slot, and a **degraded basis** with the calm `manualValuesKept` caption + no "removido". **High.**
4. **The save Sheet** (§2.3) — name/note caps + inline honest errors + the basis echo. **High.**
5. **Teaser** (free + signed-out, §7) — E2/E3/E4 lineage, owner ratifies copy. **High.**
6. **List states** — empty / loading / error-over-cache / offline / lapsed (§3.2). **Medium (mostly DS-ready).**
7. **Duplicate + the 120-char default-name interaction** (§5). **Medium.**
8. **US7 bridge** — reuses the E4 record Sheet; only the provenance line is new (§8). **Low (PR-C, droppable).**

### 10.2 DS notes + gaps (compose-first; nothing invents a primitive silently)

- **PriceHero is REUSED here** (the inverse of E4) — the reopened scenario shows the live hero. No new hero.
- **The reopened scenario reuses the ENTIRE shipped 005 calculator** — fields, channel slots, `Como chegamos no
  preço`, `Preços por canal`. E5's only additive UI is (a) the context bar, (b) the list, (c) the save Sheet, (d)
  the teaser parametrization. Keep the new surface area small.
- **G1 — the "cenário carregado" context bar** is a new small composite: compose from `Card` + `Badge`
  ("Alterações não salvas") + `Button`s. No new primitive.
- **G2 — icon**: the list/entry may want a "layers/compare" glyph; if the shipped 32-glyph set lacks one, a
  text-first entry ("Meus cenários") + `crown` (teaser) covers PR-A; a new SVG is inlined into `icon.tsx` only if
  the owner wants it (the E3/E4 precedent). *Soft gap.*
- **G3 — ConfirmDialog**: `Dialog` + a `danger` `Button` covers every destructive confirm (excluir · descartar
  alterações). Reuse the E2/E4 wrapper if it exists.
- **G4 — the "Meus cenários" entry placement** is the physical expression of Q11 — if the owner picks Option B
  (6th tab), this entry becomes a bottom-nav tab and everything else is unchanged. **Design the header entry now;
  it is a one-line move to a tab later.**
- **G5 — no offline write states beyond a toast/intercept** — deliberately (no `pending`/`queued` UI exists in
  E5, the E4 contrast). Do **not** build a sync-badge system here; a scenario is either saved (server) or it
  isn't.

---

## 11. Owner flags (do not invent — Principle VIII)

> **ALL SIX FLAGS DECIDED by the owner, 2026-07-19** (recorded in `spec.md` §Clarifications, session
> 2026-07-19): **F1** Option A — inside Calcular ("Meus cenários" header entry + premium-only inline save).
> **F2** RATIFIED — the E4-precedent resolution stands (no free inline save button; the surface entry is the
> honest door; SC-109 + its e2e untouched). **F3** the contract doc was reconciled to `created_at DESC` the
> same day (main loop). **F4** BOTH — "Salvar alterações" (`PUT`) primary + "Salvar como novo" (`POST`).
> **F5** truncate the base so "Cópia de …" fits ≤120. **F6** relative label kept ("Atualizado há…").
> The table below is the historical record of the recommendation set.


| # | Flag | Recommendation (confidence) |
|---|---|---|
| **F1** | **Q11 — final IA placement** (inside Calcular vs a 6th "Cenários" tab vs Catálogo). §1. | **Option A — inside Calcular**, list via a nav-like "Meus cenários" entry, "Salvar cenário" premium-only inline (**~66%**). Escalate to Option B (own tab, ~26%) only if peer-consistency in the four-object map outweighs nav economy. |
| **F2** | **SC-109 × FR-616 conflict** (the same collision E4 hit): FR-616 wants a visible free "salvar cenário" affordance → teaser; SC-109 (005, shipped + e2e-pinned) forbids any save button on the free calculator. §0.1. | **Mirror E4's owner resolution (2026-07-13):** inline "Salvar cenário" button **absent** for free; the honest door is the **"Meus cenários" surface** (navigation, not a save button). FR-616 met by the door, SC-109 respected (**~85%**). Needs the same explicit owner ratification E4 got. |
| **F3** | **List-ordering drift** — spec §Clarifications + data-model §5/§7 DECIDED **`created_at DESC` (newest-saved)**, but `contracts/api-surface.md` still says **`updatedAt DESC` (newest-edited)** in three places (schema comment, the "List, search, pagination" section, the `ScenarioList` note). §3.1. | **Reconcile the contract doc to the owner decision (`created_at DESC`)** (**~90%**) — this is a stale-doc inconsistency, not a reopened decision; the UX is designed to `created_at DESC`. Flagged so the parent aligns the contract before T007/T008. (If the owner actually prefers newest-*edited* for a duplicate-to-tweak flow, that reverses the DECIDED §7 point — a dated re-clarification, not mine.) |
| **F4** | **Loaded-scenario edit model** — after reopen + tweak, is the primary "Salvar alterações" (`PUT`, overwrites the loaded scenario) or "Salvar como novo" (`POST`)? §4.1. | **Offer both**: "Salvar alterações" (`PUT`) as the context-bar primary + "Salvar como novo" in the `⋯` menu (**~75%**). Duplicate-to-tweak (US4) is the *explicit* clone path; the overwrite path serves iterative refinement of one strategy. |
| **F5** | **Duplicate default name over the cap** — "Cópia de {name}" exceeds 120 when {name} is long. §5. | **Truncate the base so "Cópia de …" fits ≤120**, or open the rename sheet pre-filled with the proposed (truncated) name (**~70%**). Never a silent 422 on the headline action. |
| **F6** | **Relative vs absolute "updated" on the card** — I used *"Atualizado há 2 dias"* (relative) to avoid any dated-claim read (§0.2). §3.1. | **Keep relative** (**~70%**) — a scenario carries no date-as-claim; a relative "touched" label is a management convenience that cannot be misread as "the price was this on that day". Absolute date risks the E4/E5 confusion the whole taxonomy guards against. |

---

## Determinism / honesty guardrails carried into every E5 UI task

- **A scenario is LIVE — no date anywhere, ever.** No "salvo em", no "cotado em"; `Preço`, not `Valor cotado`;
  `PriceHero` is used (the inverse of E4). A dated scenario surface is a bug (SC-602).
- **The list card shows no price** — there is none stored (VR-611). The price lives only inside the reopened live
  calculator.
- **A degraded basis degrades to last-known + `manualValuesKept`, never "removido/excluído/deletado"** (F1/K3;
  the regex `/removid|excluíd|deletad/i` must match nothing on any scenario surface). "Abrir origem" only when the
  ref resolves.
- **No offline write path.** A save/rename/duplicate/delete offline **fails honestly** — no `pending`, no queue,
  no fake "salvo!" (the deliberate E4 contrast, FR-613). Reads/reopen/recompute work offline with the staleness
  seal.
- **Recompute is a READ** — it survives a lapse and works offline; only save/duplicate/rename/edit/delete are
  writes and are gated (the Q9 line).
- **Success toasts fire only on a real 2xx.** Offline / lapsed / free never toast success.
- **No fabricated fee, no fabricated sample scenario, no fake success** (FR-616/SC-607). The three 005 seals carry
  in unchanged; E5 adds none.
- **No save button on the free calculator** (SC-109); the free door is the "Meus cenários" surface (§0.1/§11-F2).
- **≥44px targets, no horizontal overflow at 390px, adversarial SIZE tested** (120-char name, 500-char note).
- **All copy: honest, calm, pt-BR, no price, no availability date, no pre-E6 purchase CTA. "Cancelar" is banned —
  use "Voltar".**
```