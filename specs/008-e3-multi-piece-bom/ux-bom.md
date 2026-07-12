# UX Spec — E3 Multi-piece BOM (T001 · designer-ux → Claude Design handoff)

> **K1 supersession (2026-07-11):** the owner renamed every user-facing surface to **Kit/Kits** (spec K1) —
> route `/kits`, nav tab "Kits", title "Monte seus kits" + approved subtitle. This document's "Montagem"
> vocabulary, `/bom` routing and §5 copy blocks are SUPERSEDED where they differ; `messages.pt-br.ts`
> (`bom.*` block) is the shipping copy source. §0.4's entry-point question is CLOSED (5th tab approved).
> Wireframes/flows/states remain the design reference.

**Level**: wireframe / flow / state — NOT pixel-final. Final UI is produced in Claude Design from this + the UI
the owner envisions. Structure in English; all user-facing copy in pt-BR (i18n-ready, tom honesto/calmo).

**Feeds**: T005 (BOM composer), T008 (US5 teaser). Forward-designed here but not blocking PR-A: T015 (save UI,
PR-B), T017 (manage + lapse, PR-B), T021 (degraded catalog-ref line, PR-C). Non-blocking for PR-A (tasks.md
T001 — runs alongside all of PR-A).

**Sources of truth**: `spec.md` (US1–US5, FR-401..412, SC-401..409, Q1/Q2/Q3), `contracts/pricing-core-bom.md`
(the `computeBom` / `BomResult` / `BomChannelRollup` shape the UI renders), `contracts/api-surface.md`
(persistence wire, PR-B), `quickstart.md` §1..§7, ADR-0015 (server-informed route-guard; offline compute is a
**soft** boundary — never imply server enforcement), ADR-0016 (assembly = independent per-piece sum × qty +
per-channel rollup). Fixed owner decisions honored: **Q1** independent per-piece sum × qty (no shared-plate);
**Q2** both line sources (ad-hoc AND catalog-ref) from increment one, catalog-ref is live + degrades to
last-known; **Q3** the WHOLE BOM feature is Premium (first paywalled compute) — free single-piece calculator
stays untouched.

**Mobile-first 390px** (FR-411 inherits E1's no-horizontal-overflow rule). All wireframes drawn at that
viewport; desktop notes inline.

**DS reused (ADR-0007 `tf-*`)**: `PageHeader` (widget), `Card`, `EmptyState`, `Alert`, `Badge`, `Button`,
`Icon`, `Spinner`, `Select`, `NumberField`, `Field`, `Dialog`/`Sheet` (Radix focus-trap, ≥44px close),
`Toaster`/`toast`, `BreakdownRow`, `PriceHero`, `Switch`. The calculator's local `SectionTitle`+`InfoTip`,
`FieldGroup`, `MarketplaceSection`/`ChannelPrices`, `OtherCostsSection`, and the E2 `PremiumTeaserDialog`
pattern are **reused, not rebuilt**. No new DS primitives invented — real gaps + one code-org constraint are in
§6.

---

## 0. Cross-cutting decisions (apply to every BOM surface)

### 0.1 The honesty core — route-guard + entitlement × affordance matrix (read before building any state)

BOM feature access is a **server-informed client route-guard** (ADR-0015): the composer mounts only when the
authoritative `GET /api/v1/entitlement` returns `status = active` — **never** a local/persisted flag. All
**persistence** (PR-B: `POST/GET/PUT/DELETE /api/v1/boms`) is the hard, server-authoritative boundary
(`require_entitlement` writes / `require_catalog_read` reads). The **offline compute is a soft boundary** — a
determined user could call `computeBom` directly, and the UI must **never imply the calculation itself is
server-enforced**. The paid value is honestly *compose-at-scale + save + manage + catalog-reference*, not the
act of summing numbers.

| Surface / affordance | `active` online | `active` OFFLINE | `lapsed` | `none` (free) / signed-out |
|---|---|---|---|---|
| Reach `/bom` → composer | mounts | mounts (compute is offline) | see §3 (read-only saved list; compose → reactivation) | **teaser** (§2), never the composer |
| Compose / edit lines / recompute | works (offline compute) | works (offline compute) | read + re-price saved only | — (teaser) |
| Save / rename / delete BOM (PR-B) | real 2xx | honest "precisa de conexão" | reactivation panel (write frozen) | teaser / `401` |
| Any "success" toast | real 2xx only | never | never | never |

Three non-negotiables carried from E2 §0.3: **(1)** an affordance is **visible**, never hidden (hiding lies
about the product); **(2)** the intercept is **honest and specific** (connection / reactivation / Premium — never
a generic error, never a fake "salvo!"); **(3)** nothing persists and no success is faked.

### 0.2 Money rendering — the UI never does arithmetic

Every money number the composer shows comes **only** from `computeBom` (`BomResult`) — the feature layer sums
nothing (ADR-0016). Per-line, per-line×qty and assembly totals are read straight off `BomLineResult` /
`BomResult` and rendered with the existing `BreakdownRow` / `PriceHero` (which format the number). On the
persistence wire (PR-B) money is **decimal strings**, camelCase, never floats (`api-surface.md`). No
BOM surface computes, re-rounds, or re-sums a price in JSX — double-rounding is prevented in the core (FR-412),
not patched in the view.

### 0.3 Composer IA at 390px — how line list + per-line inputs + assembly total coexist

> Significant UX choice → ≥3 options (Constitution). A full piece form (Custos da peça grid + Ajustes + Mão de
> obra + Outros custos + Marketplace) is tall; several of them stacked at 390px is unusable. Recommendation:
> **Option A**.

**Option A — Collapsible line cards + pinned assembly summary (RECOMMENDED, confidence ~80%).** Each line is a
`Card` that is **collapsed to a summary row by default** (name/qty/line-total) and **expands one at a time** to
reveal its full editor; a compact assembly summary is **pinned at the bottom** (tap to expand the breakdown +
per-channel rollup).
- Pros: only the line being edited pays the vertical cost; the list stays scannable at 5–20 lines; the total is
  always in view (the number the seller came for); mirrors how a real order is read (a list of items + a
  bottom line); reuses `Card` + a local collapse — no DS gap.
- Cons: needs a per-line expand/collapse affordance (composable from `Button` + `Icon chevron`; no primitive
  gap) and disclosure state to manage; the bottom summary bar wants a small sticky container.
- Scalability: high — a long BOM scrolls as summary rows; a future "duplicate line" or drag-reorder slots in.

**Option B — Flat, every line always fully expanded.** Each line renders its whole piece form inline, stacked.
- Pros: zero disclosure logic; everything visible; closest to "N calculators stacked".
- Cons: at 390px two lines already push the total far below the fold; 5+ lines is an unreadable scroll; the
  assembly total is never near the inputs. Degrades badly with the exact scale BOM exists for.
- Scalability: low.

**Option C — Master–detail (list of summary rows → tap opens a per-line editor Sheet/route).** The `/bom` page
is a summary list + total; editing a line opens a full-height `Sheet` (or sub-route) with that line's form.
- Pros: the list page stays clean; each editor gets full width; `Sheet` already exists.
- Cons: an extra tap + context switch per edit; live "change qty → total updates" is less immediate when the
  inputs live behind a sheet; heavier than the value warrants for quick qty tweaks.
- Scalability: medium-high (good for very large BOMs later).

**Decision**: **A**. It keeps the total live and in-view (Acceptance US1-2), stays readable at scale, and needs
no new primitive. **C** is the clean fallback if the owner later wants very large assemblies; the line-editor
content spec below is identical either way (inline-expanded vs sheet-hosted).

### 0.4 Where `/bom` lives in the IA (entry point)

> The shipped nav is a **fixed 4-tab** shell (Calcular / Catálogo / Histórico / Conta, `messages.nav`). Adding
> BOM touches that fixed IA → a real decision. ≥3 options.

**Option A — a 5th nav tab "Montagem" (RECOMMENDED, confidence ~68%).** BOM becomes a first-class destination.
- Pros: discoverable; a durable Premium feature deserves a home; the guard/teaser (§0.1) makes it honest for
  free users who tap it. Cons: 5 tabs crowd a 390px bottom bar; changes the "fixed 4-tab" IA (needs an owner nod
  + a nav icon — see §6 G3). Scalability: high once the tab exists.

**Option B — entry from Calcular ("Precificar um pedido com várias peças →").** A link/card on the calculator
routes to `/bom`.
- Pros: contextual (the user is already pricing); no nav change; naturally frames BOM as "the multi-piece step
  up from single-piece". Cons: less discoverable than a tab; adds a Premium affordance onto the free calculator
  (must be an honest teaser trigger for free users, not a broken link). Scalability: medium.

**Option C — entry from Catálogo (a "Montagens" surface beside Produtos).** BOM lives under the catalog IA.
- Pros: BOMs *are* saved, per-account, premium — same shelf as products; reuses the segmented-tab pattern.
  Cons: conflates "a reusable catalog item" with "a priced order"; buries the composer two levels down.
  Scalability: medium.

**Decision**: **A** for the destination, **with B's contextual link folded in** (a "Montar um pedido" affordance
on Calcular that routes to `/bom` — an honest teaser trigger for free users). Both point at the same guarded
`/bom` route. **Owner nod needed** before adding the 5th tab (touches fixed IA + needs a nav icon, §6 G3); until
then B alone ships the entry without changing the nav. This is the one place the handoff needs an owner call.

---

## 1. BOM composer — PREMIUM ACTIVE (US1 → T005)

### 1.1 Page frame / IA (Option A — collapsible lines + pinned summary)

```
┌────────────────────────────────────────────┐
│  Montagem                                   │  ← PageHeader (focusable h1)
│  Some várias peças e veja o preço do pedido.│  ← PageHeader description (honest, no price)
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Peça 1 · Vaso G          3×    ▸      │  │  ← LINE (collapsed): name · qty · chevron
│  │ R$ 45,00 /un · Total R$ 135,00        │  │     per-unit + line total (read off BomLineResult)
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Peça 2 · Suporte         5×    ▸      │  │
│  │ R$ 12,00 /un · Total R$ 60,00         │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Peça 3 · (avulsa)        1×    ▸      │  │  ← ad-hoc line, no product bound
│  │ R$ 80,00 /un · Total R$ 80,00         │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [        + Adicionar peça             ]    │  ← single add affordance (§1.2-C chooser)
│                                             │
│ ┌── pinned summary bar (tap ▲ to expand) ─┐ │
│ │ Total da montagem   R$ 275,00      ▲    │ │  ← assembly custoTotal / preços (BomResult)
│ └─────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

- **Line row anatomy** (collapsed): line 1 = `Peça {n} · {product name | "(avulsa)"}` + `{qty}×` + chevron;
  line 2 = `R$ {perUnit} /un · Total R$ {lineTotal}` (`--text-muted`, `--fs-caption`). All numbers from
  `BomLineResult`. Whole row tappable → expands (§1.3/§1.4).
- **Pinned summary bar**: `Total da montagem` + assembly `custoTotal` always visible; tap `▲` expands the full
  assembly breakdown + per-channel rollup (§1.7). Desktop: the summary can sit as a right-column sticky card
  instead of a bottom bar.
- **Desktop note**: two-column — lines left, expanded summary/breakdown right (mirrors Calcular's results
  column). Mobile keeps the single scroll + bottom bar.

### 1.2 Line source model — how a line becomes ad-hoc vs catalog-referenced

> Significant UX choice → ≥3 options. Recommendation: **Option C** (mirrors the shipped E2 calculator picker).

**Option A — two add buttons ("＋ Peça avulsa" / "＋ Do catálogo").** Explicit branch at add-time.
- Pros: dead-obvious; one tap to the right kind. Cons: two buttons crowd 390px; a user who added avulsa then
  wants to bind a product has no path; duplicates the E2 pattern with a different shape.

**Option B — one "＋ Adicionar peça" → a small chooser Dialog (Avulsa / Do catálogo).** Add-time branch via a
sheet/dialog.
- Pros: one clean button; scales to future sources. Cons: an extra tap + modal for every add; still forces the
  ad-hoc↔catalog choice up-front and locks it.

**Option C — one "＋ Adicionar peça" adds an ad-hoc line; each line carries an in-line "Usar produto salvo"
picker (RECOMMENDED, confidence ~78%).** A line is ad-hoc by default; a `Select` at the top of the expanded
line binds it to a saved product (exactly the E2 `catalogPicker` idiom, one layer up — product instead of
filament/printer).
- Pros: **one** consistent mental model reused from the shipped calculator (`calculator.catalogPicker`); a line
  can start avulsa and later bind a product (or unbind back to Manual); the degraded state (product deleted →
  "— Manual —" + last-known, §4) is the *same* control simply reset to Manual — one honesty pattern, no new
  concept; no add-time modal. Cons: the "this line uses a saved product" state is a picker value, not a
  separate row type — needs a clear bound/adjusted seal (provided, §1.4). Scalability: high — new sources
  (assemblies-in-assemblies, later) are just more picker options.

**Decision**: **C**. It is the E2 pattern the codebase already ships and homologated; it makes ad-hoc and
catalog-ref *coexist in one line type* (Q2) instead of forking two row shapes, and it makes degradation a
picker reset rather than a special screen.

### 1.3 Line — EXPANDED, ad-hoc (reuses the calculator piece-input vocabulary)

Do **not** redesign the piece form. The expanded ad-hoc line hosts the **same sections/fields/validation** the
single-piece calculator uses — `SectionTitle`+`InfoTip`, the "Custos da peça" `FieldGroup`, "Ajustes opcionais",
"Mão de obra e custos", "Outros custos", and the "Marketplace" section — over its own RHF sub-form. (Code-org
constraint: `feature/bom` may not import `feature/calculator` internals — the shared form body needs a shared
home; see §6 C1. This is a wiring note, not a redesign — the visual spec is "the calculator's piece form,
verbatim, inside a line".)

```
┌──────────────────────────────────────────┐
│ Peça 3 · (avulsa)            1×   ▾   🗑  │  ← header: name · qty stepper · collapse · remove
│ ┌────────────────────────────────────┐   │
│ │ Usar produto salvo                  │   │  ← in-line picker (§1.2-C). value = "— Manual —"
│ │ [ — Manual —                     ▾ ]│   │     options: saved products + Manual
│ └────────────────────────────────────┘   │
│ ⓘ Custos da peça                          │  ← SectionTitle + InfoTip (verbatim from Calcular)
│ ┌────────────────────────────────────┐   │
│ │ Custo do rolo     Peso do rolo      │   │  ← the exact calculator FieldGroup grid
│ │ [ R$ 110,00 ]     [ 1     kg ]      │   │
│ │ …                                   │   │
│ └────────────────────────────────────┘   │
│ ⓘ Ajustes opcionais · Mão de obra ·       │  ← same optional/labor/outros sections, collapsed
│   Outros custos · Marketplace   (▾)       │     under a secondary disclosure to keep the line short
│                                           │
│ ── Preço desta peça ─────────────────     │  ← per-line breakdown (§1.6)
│ Custo total /un        R$ 80,00           │
│ Total da linha (1×)    R$ 80,00           │
└──────────────────────────────────────────┘
```

- **Quantity** (`§1.5`) sits in the line header so it's editable without expanding the whole form.
- **Live recompute** (Acceptance US1-2): every field/qty change re-runs `computeBom` on the current lines
  (offline, no server round-trip) and updates the line breakdown + the pinned assembly total immediately.
- **Validation**: per-field, reuse `calculator.validation.*` + `rollWeightError` + `machineLifetimePositive`
  **verbatim** (FR-402 lineage — a bad line flags itself, never NaNs a sibling; per-slot isolation is already
  in the core). An invalid line shows the calculator's `invalidNote` in its own breakdown slot and contributes
  nothing to the total until fixed (honest, not silently zero — a caption says why).

### 1.4 Line — EXPANDED, catalog-referenced (live product, US1 + forward to US3)

Picking a saved product in the in-line picker **pre-fills** the line's piece inputs from the product's **live**
values (resolve `productId → PriceInput`, T005 adapter). Fields stay visible but read as sourced; a seal states
provenance — reusing the exact E2 seal vocabulary.

```
│ ┌────────────────────────────────────┐   │
│ │ Usar produto salvo                  │   │
│ │ [ Vaso G                         ▾ ]│   │  ← a saved product is bound
│ └────────────────────────────────────┘   │
│ 🏷 do catálogo: Vaso G                    │  ← Badge/caption seal (provenance)
│  … pre-filled piece fields, still shown … │
```

- **Provenance seal** (reuse `seals` vocabulary): bound & untouched → **"do catálogo: {nome}"**; the moment the
  user edits any pre-filled field → flip to reuse `seals.adjusted` → **"do catálogo: {nome} · ajustado por
  você"** (the identical honesty pattern the marketplace `FeeSeal` + the E2 filament picker already use — no new
  concept).
- **Live** (Q2 / US3-2): the reference stores no price; on reopen the product's *current* values re-resolve and
  `computeBom` recomputes (FR-407). PR-A composes the live reference; the persisted degradation lifecycle
  (delete → last-known) lands in PR-C but is designed now (§4).
- **Offline**: the picker options come from the uid-keyed product cache (E2 `entities/catalog`); if the cache
  was never loaded online the picker shows a single disabled honest option — reuse
  `catalogPicker`/`offlineNeedsLoad` **"Conecte para carregar seu catálogo"** — never a fabricated product.

### 1.5 Quantity control + the qty-0 honesty

`quantity` is a **finite integer ≥ 0** (contract). Render a compact `NumberField` (no currency; unit `un` or a
`−/＋` stepper) in each line header.

```
│ Peça 2 · Suporte     [ − ] 5 [ + ]  un    │
```

- **qty 0 is valid** (contract: contributes zero, no throw). A line at qty 0 stays in the list but shows a calm
  caption **"Quantidade 0 — não entra no total."** and its `Total da linha` reads `R$ 0,00`. Honest empty, never
  hidden, never a crash.
- Non-integer / negative input is rejected inline with the calculator's numeric messages (never silently
  coerced).

### 1.6 Per-line breakdown (transparent — per-unit × qty)

Each expanded line shows the same transparency the calculator gives one piece, plus the qty scaling. Values come
from `BomLineResult` (`line: PriceResult` per-unit; `custoTotal/precoVarejo/precoAtacado` = per-unit × qty).

- **Per-unit block** = the calculator's `PriceResults` breakdown for that line (Material / Energia / Máquina /
  Falha / Acabamento / Mão de obra / Outros custos → Custo total /un → Preço varejo·atacado /un) — reused
  verbatim via `BreakdownRow`.
- **Line total row(s)**: `Total da linha ({qty}×)` for custo + preços, each = the displayed per-unit value ×
  qty (read from `BomLineResult`, **not** re-multiplied in JSX). A caption `{perUnit} × {qty}` makes the
  arithmetic legible without the UI doing it.

### 1.7 Assembly total + per-channel rollup (the honesty of `skippedLines`)

> Significant UX choice → ≥3 options. The rollup groups every line's channels by `marketplace` and must surface
> `skippedLines` **honestly** (a channel slot in `error` contributes zero and the UI says so — never silently).
> Recommendation: **Option A**.

**Option A — reuse the calculator's "Preços por canal" card, one block per marketplace, with a per-rollup
skipped-lines caption (RECOMMENDED, confidence ~82%).** Under the assembly summary: headline `custoTotal /
precoVarejo / precoAtacado` (`PriceHero` pair, like Calcular), then one card per `BomChannelRollup` grouped by
marketplace (anúncio + líquido, varejo e atacado) — the exact `ChannelPrices` layout, one level up.
- Pros: the seller already reads this exact card for one piece (zero relearn); per-slot isolation is already the
  shipped mental model (SC-107 → extended); the `skippedLines` honesty line reads naturally as a caption on the
  affected marketplace block; `contributingLines === 0` → the block honestly shows "no priced line", not a fake
  R$ 0. Cons: a marketplace present in only some lines needs a clear "n peças somaram" hint so the seller knows
  the rollup isn't every line. Scalability: high.

**Option B — a lines × channels matrix/table.** Rows = lines, columns = marketplaces, cells = líquido.
- Pros: dense, comparative. Cons: horizontal overflow at 390px (breaks FR-411); a table primitive is a DS gap;
  over-built for a personal tool. Reject for mobile-first.

**Option C — per-line channels only, no assembly rollup.** Show each line's channels; skip the aggregate.
- Pros: simplest. Cons: **violates the contract** (`BomResult.channels` rollup is in scope, D-B.1) and the whole
  point of an assembly view — the seller wants "what do I charge on Mercado Livre for the *whole order*". Reject.

**Decision**: **A**.

```
│ ┌── assembly summary (expanded) ─────────┐ │
│ │ Total da montagem                       │ │
│ │  Custo total            R$ 275,00       │ │  ← BomResult.custoTotal
│ │ ┌────────────┐  ┌────────────┐          │ │
│ │ │ Varejo     │  │ Atacado    │          │ │  ← PriceHero pair (precoVarejo/Atacado)
│ │ │ R$ 430,00  │  │ R$ 360,00  │          │ │
│ │ └────────────┘  └────────────┘          │ │
│ │                                         │ │
│ │ ⓘ Preços por canal (montagem)           │ │  ← per-marketplace rollup (BomChannelRollup[])
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ Mercado Livre · Clássico            │ │ │
│ │ │  Varejo  anúncio R$ … · líquido R$ … │ │ │  ← Σ over contributing lines × qty
│ │ │  Atacado anúncio R$ … · líquido R$ … │ │ │
│ │ │  2 peças somaram neste canal         │ │ │  ← contributingLines (context)
│ │ │  ⚠ 1 peça sem preço aqui —           │ │ │  ← skippedLines HONESTY (calm, not danger)
│ │ │     não entrou na soma.              │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
```

- **skippedLines** (`BomChannelRollup.skippedLines > 0`): a calm caption on that marketplace block —
  **"{n} peça(s) sem preço neste canal — não entrou(aram) na soma."** Tone = info/muted, **never** danger; the
  rollup is still correct for the lines that did price. This is the assembly-level echo of the calculator's
  `channels.errorRow`.
- **contributingLines === 0** (a marketplace where every contributing slot errored / no line carries it): the
  block honestly reads **"Nenhuma peça com preço neste canal."** — null prices shown as absent, never fabricated
  R$ 0.
- **No channels at all** (no line included a marketplace): the per-channel card is simply omitted (like the
  calculator when marketplaces are off) — headline custo/varejo/atacado still shows.

### 1.8 States — EMPTY / LOADING / ERROR

**EMPTY (zero lines)** — reuse `EmptyState` with an `action` Button.
```
┌────────────────────────────────────────────┐
│  Montagem                                   │
│            (◆ package/copy icon)            │
│      Monte seu pedido peça por peça         │  ← title
│  Some várias peças — avulsas ou do seu      │
│  catálogo — com quantidade e veja o preço   │  ← desc (value, no price)
│  da montagem inteira.                       │
│         [   + Adicionar peça   ]            │  ← EmptyState.action
└────────────────────────────────────────────┘
```

**LOADING** — the composer itself computes offline (instant, no spinner needed). A `Spinner` appears **only**
where a real fetch happens: the product picker options (E2 catalog read) and, in PR-B, the saved-BOM list/reopen.
Mirrors the E2 catalog loading pattern; no skeleton primitive (G2 soft gap).

**ERROR** — a failed **product-catalog** read (for the picker) is non-blocking: reuse the calculator's
`channels.refreshError*` pattern — an `Alert tone="info"` + retry, the composer keeps working with whatever the
cache holds (ad-hoc lines never depend on the network). A failed **saved-BOM** load (PR-B) reuses the
`conta-page`/catalog error: `Alert tone="danger"` + loading-aware retry. Never an error wall over the composer.

### 1.9 Save affordance — placeholder now, real in PR-B

PR-A ships a **free-standing** composer (no persistence — quickstart §2: "nothing persisted until save"). Honesty
forbids a button that appears to save but can't. So:

- **PR-A**: the composer reserves the header slot for save but **does not render a working "Salvar"** (no fake
  action). Optionally a muted caption `A montagem some salva no Premium — em breve.` may sit near the summary,
  but only if it never reads as an available action. Recommendation: reserve the layout, ship no button.
- **PR-B (designed now, T015)**: a `Nome da montagem` `Field` + a real **"Salvar montagem"** `Button` (header
  action or in the summary bar). Real `toast tone="success"` **"Montagem salva."** fires **only** on a real
  2xx (`POST /api/v1/boms`); offline/lapsed/free never toast success (§0.1). Save → route to the saved-BOM list
  (PR-B). Copy uses **"Voltar"**, never "Cancelar" (FR-014 bans "cancelar" in the message module).

```
 (PR-B)  ┌──────────────────────────────────┐
         │ Nome da montagem                  │
         │ [ Kit suporte + base            ] │  ← Field (non-blank)
         │              [ Salvar montagem ]  │  ← real 2xx only → toast → list
         └──────────────────────────────────┘
```

---

## 2. BOM teaser — FREE / SIGNED-OUT (US5 → T008)

Because the whole feature is Premium (Q3), a free or signed-out user who reaches `/bom` sees an **honest
teaser**, never the composer, never a broken/fake screen (SC-408). This **reuses the shipped E2
`PremiumTeaserDialog` pattern verbatim** (`features/catalog/premium-teaser.tsx`) with BOM copy — the same crown,
same "no price / no date / no purchase CTA" honesty (billing is E6; a buy button would promise a flow that does
not exist — Principle II). The **free single-piece calculator is 100% untouched** (FR-411/SC-409) — the teaser
gates only `/bom`.

### 2.1 Free (signed-in, `none`)

```
┌────────────────────────────────────────────┐
│  Montagem                                   │
│            (♛ crown)                        │
│   Monte e precifique pedidos com            │  ← title
│   várias peças                              │
│  Some várias peças — avulsas ou do seu      │
│  catálogo — com quantidade e veja o preço   │  ← desc (value; NO price/date)
│  da montagem inteira.                       │
│                                             │
│   No Premium você monta um pedido com       │  ← body (value)
│   várias peças e vê o preço da montagem     │
│   inteira, por canal.                       │
│                                             │
│   A calculadora de peça única continua      │  ← reaffirms the free promise (FR-411)
│   grátis.                                   │
│                                             │
│            [  Entendi  ]                    │  ← single dismiss. NO price/date/"assinar"
└────────────────────────────────────────────┘
```

- Rendered as the E2 teaser (an `EmptyState`-framed panel and/or `PremiumTeaserDialog`). The free promise line
  is BOM-specific: **"A calculadora de peça única continua grátis."** (echoes `calculator.freemiumNote`).
- No CTA to buy; the panel informs, it does not sell. When E6 lands the dismiss becomes the upgrade entry.

### 2.2 Signed-out

Same panel; the honest step is that BOM needs an account **and** Premium.

```
│  Para montar pedidos, entre e ative o       │
│  Premium.                                   │
│   [ Entrar ]  [ Entendi ]                   │  ← Entrar → /sign-in?redirect=/bom
```

- **"Entrar"** routes to the existing Google sign-in with **`redirect=/bom`** (the E2 teaser hardcodes
  `/catalogo` — this needs a `redirect` prop on `PremiumTeaserDialog`, §6 C2). Honesty holds: login alone won't
  unlock — the copy says so.

---

## 3. Saved BOMs — LAPSED + OFFLINE (PR-B forward; the reconciliation the plan must settle)

PR-A has no persistence, so PR-A's lapsed/offline `/bom` reduces to the §2 teaser (no saved data exists). Once
PR-B ships save/list, these states apply to the **saved-BOM management surface** and are designed now.

> **Honest tension to reconcile (flag for owner/plan).** ADR-0015 says the composer route-guard gates on
> `status = active` and "free/**lapsed**/signed-out see the teaser". But FR-409 + `api-surface.md` say lapsed
> `GET /api/v1/boms` returns `200` (read allowed) and only **writes** are `403`. So a lapsed user with saved
> BOMs should **read + re-price** them, not see a blanket teaser. Recommended reconciliation (confidence ~76%):
> **the composer/create entry is active-gated (lapsed → reactivation panel), but the saved-BOM list + reopen +
> re-price is a read surface allowed on lapse** (mirrors E2 catalog lapse §3). The teaser (§2) is for
> `none`/signed-out (no data); lapsed-with-data gets the calm read-only freeze below. This keeps both ADR-0015
> (feature access is active-informed) and FR-409 (data stays readable) true — the plan/ADR should record it
> explicitly.

**Lapsed (read-only freeze — calm, never punitive; "expirou/bloqueado/suspenso" banned):**
```
┌────────────────────────────────────────────┐
│  Montagem                                   │
│  ┌──────────────────────────────────────┐  │
│  │ ⌁ Premium pausado                    │  │  ← Alert tone="info" (NOT danger)
│  │   Suas montagens salvas continuam    │  │
│  │   aqui e podem ser reabertas e        │  │
│  │   recalculadas. Para criar ou editar, │  │
│  │   reative o Premium.                  │  │
│  └──────────────────────────────────────┘  │
│  … saved BOM rows … (open → read + re-price)│  ← reads/re-price work; write → reactivation panel
```
- Reopen a saved BOM → recomputes live (read allowed); every **write** (rename/edit/delete/new) → the
  reactivation panel (same shape as the teaser Dialog, copy tuned: *"Reative o Premium para voltar a criar e
  editar. Suas montagens estão salvas."*). No price, no date, no fake action. No BOM is deleted by the lapse
  (FR-409).

**Offline (active, no network — PR-B):** reads come from the uid-keyed BOM cache (mirrors E2 `entities/catalog`
→ new `entities/bom`); a calm `Alert tone="info"` **"Modo leitura offline"** banner; **write** affordances stay
visible and, on tap, give the honest **"Criar e salvar precisam de conexão."** — never disabled-and-silent,
never fake-saved. The offline **compute still works** (that's the whole point of `computeBom` being client-side).

---

## 4. Degraded catalog-ref line (US3 / PR-C — designed now)

A saved BOM line that referenced a product **deleted after save** degrades gracefully (Q2 / FR-404, mirroring
E2 product↔filament D6). On reopen the server returns `BomLineOut.degraded: true`, `productId: null`,
`pieceInputs: <last-known>`. The line stays **priceable** — never a crash, never a silent wrong number.

```
│ Peça 2 · — Manual —          5×   ▾   🗑  │  ← name reads "— Manual —" (product gone)
│ ┌────────────────────────────────────┐   │
│ │ ⌁ O produto vinculado foi removido. │   │  ← Alert tone="info" (calm), at top of the line
│ │   Mantivemos os últimos valores —   │   │
│ │   edite se precisar.                │   │
│ └────────────────────────────────────┘   │
│ │ Usar produto salvo                  │   │
│ │ [ — Manual —                     ▾ ]│   │  ← picker reset to Manual (§1.2-C)
│ │  … last-known values, editable …    │   │  ← the fields carry last-known, as normal inputs
```

- The picker **resets to "— Manual —"** and the last-known piece inputs become ordinary editable fields — the
  exact same control/flow as an ad-hoc line, so degradation reuses one pattern (no special screen). The calm
  `Alert tone="info"` mirrors E2 `productForm.degradedFilament` language, adapted: **"O produto vinculado foi
  removido. Mantivemos os últimos valores — edite se precisar."**
- Deleting a product referenced by saved BOM lines (US3 delete path, T020) is non-blocking: the product delete
  succeeds, referencing lines flip to degraded/last-known in the same txn. If the E2 product delete-confirm
  wants a warn line, reuse the `productForm.deleteWarn*` shape: *"Este produto é usado em {n} montagem(ns).
  Elas manterão os últimos valores, editáveis."*

---

## 5. Microcopy pt-BR (proposed i18n keys — for `messages.pt-br.ts`, owner-ratified at BOM homologation)

> Proposed additions; final wording owner-ratified with the teaser. Tom: honesto, calmo, sem marketing, **sem
> preço, sem data**. **"Cancelar" is banned** (FR-014) — use "Voltar". Structured to slot beside the existing
> `catalogo`/`calculator` blocks; a new top-level `bom` block.

```
bom: {
  title: "Montagem",
  subtitle: "Some várias peças e veja o preço do pedido.",
  // empty
  emptyTitle: "Monte seu pedido peça por peça",
  emptyBody: "Some várias peças — avulsas ou do seu catálogo — com quantidade e veja o preço da montagem inteira.",
  addLine: "Adicionar peça",
  // line
  lineLabel: "Peça {n}",
  lineAdhoc: "(avulsa)",
  quantity: "Quantidade",
  quantityUnit: "un",
  removeLine: "Remover peça",
  qtyZero: "Quantidade 0 — não entra no total.",
  expand: "Editar esta peça",
  collapse: "Recolher",
  // in-line catalog picker (§1.2-C / §1.4) — product level
  useProduct: "Usar produto salvo",
  productPlaceholder: "Escolher produto…",
  manual: "— Manual —",
  fromCatalog: "do catálogo: {nome}",
  fromCatalogAdjusted: "do catálogo: {nome} · ajustado por você",  // reuse seals.adjusted tone
  offlineNeedsLoad: "Conecte para carregar seu catálogo",
  // per-line breakdown (§1.6)
  perUnitCusto: "Custo total /un",
  lineTotal: "Total da linha ({qty}×)",
  perUnitTimesQty: "{preco} × {qty}",
  // assembly total + rollup (§1.7)
  assemblyTitle: "Total da montagem",
  assemblyCusto: "Custo total",
  channelsTitle: "Preços por canal (montagem)",
  channelContributing: "{n} peça(s) somaram neste canal",
  channelSkipped: "{n} peça(s) sem preço neste canal — não entrou na soma.",  // skippedLines HONESTY
  channelNoContrib: "Nenhuma peça com preço neste canal.",                    // contributingLines === 0
  // save (PR-B / §1.9) — real success toast only
  nameLabel: "Nome da montagem",
  namePlaceholder: "Ex.: Kit suporte + base",
  save: "Salvar montagem",
  saved: "Montagem salva.",
  saveOffline: "Criar e salvar precisam de conexão.",
  // degraded (US3 / PR-C / §4)
  degradedLine: "O produto vinculado foi removido. Mantivemos os últimos valores — edite se precisar.",
  deleteWarnProduct: "Este produto é usado em {n} montagem(ns). Elas manterão os últimos valores, editáveis.",
  // teaser (US5 / §2) — NO price, NO date, NO purchase CTA
  teaserTitle: "Monte e precifique pedidos com várias peças",
  teaserBody: "Some várias peças — avulsas ou do seu catálogo — com quantidade e veja o preço da montagem inteira.",
  teaserDialogTitle: "A montagem faz parte do Premium",
  teaserDialogBody: "No Premium você monta um pedido com várias peças e vê o preço da montagem inteira, por canal.",
  teaserFreeNote: "A calculadora de peça única continua grátis.",
  teaserSignedOutBody: "Para montar pedidos, entre e ative o Premium.",
  // lapsed / offline saved list (PR-B / §3) — calmo, não punitivo
  lapsedTitle: "Premium pausado",
  lapsedBody: "Suas montagens salvas continuam aqui e podem ser reabertas e recalculadas. Para criar ou editar, reative o Premium.",
  reactivateBody: "Reative o Premium para voltar a criar e editar. Suas montagens estão salvas.",
  offlineTitle: "Modo leitura offline",
  offlineBody: "Suas montagens salvas continuam aqui para reabrir e recalcular. Criar e salvar precisam de conexão.",
  // entry point (§0.4-B contextual link on Calcular)
  calcularEntry: "Montar um pedido com várias peças",
},
```

Existing keys reused unchanged: all of `calculator.fields/hints/sections/sectionInfo/results/captions/
validation/rollWeightError/machineLifetimePositive` (the piece form + per-line breakdown), `calculator.channels.*`
+ `marketplaceNames`/`modalityNames` (per-channel rollup), `calculator.seals.adjusted` ("ajustado por você"),
`calculator.catalogPicker.*` (picker idiom), `apiError.entitlementRequired` ("Salvar faz parte do Premium."),
`nav.*`. The E2 teaser copy in `messages.catalogo.teaser*` is the pattern this `bom.teaser*` block mirrors.

---

## 6. Claude Design handoff — what to prototype visually + gaps

### 6.1 Screens/states worth a visual (pixel) prototype (owner → Claude Design)

Ranked; PR-A can proceed on **this wireframe + the existing DS** for all of them — the visual pass is polish,
not a blocker.

1. **Composer — populated, collapsible lines + pinned assembly summary** (the new IA; validates line-row
   density + the collapse/expand at 390px). *High.*
2. **Expanded line — ad-hoc** (the calculator piece form hosted inside a line; confirm the secondary disclosure
   keeps the line short) **and catalog-ref** (product picker + "do catálogo/ajustado" seal). *High.*
3. **Assembly summary + per-channel rollup** with the **skippedLines honesty caption** (the contract-critical,
   honesty-critical surface). *High.*
4. **BOM teaser** (free + signed-out) — reuse of the E2 pattern; owner ratifies copy. *High.*
5. **Degraded catalog-ref line** ("— Manual —" + calm info Alert + editable last-known). *Medium (PR-C).*
6. **Save affordance** (name + "Salvar montagem" → toast → list) + **lapsed/offline saved-list** banners (calm
   info tone, not danger). *Medium (PR-B).*
7. **Empty state** with `EmptyState.action`. *Low (DS-ready).*

### 6.2 DS gaps + code-org constraints (compose-first; nothing invents a primitive silently)

- **C1 — Shared piece-input form body (code-org, the load-bearing one).** The expanded ad-hoc line needs the
  **calculator's exact piece form** (Custos da peça `FieldGroup`, Ajustes, Mão de obra, Outros custos,
  Marketplace), but FSD-Lite (tasks T005 + `eslint-boundaries`/`depcruise`) forbids `feature/bom` importing
  `feature/calculator` internals or `pages`. Those sections are already **exported** from
  `apps/web/src/features/calculator/calculator-form.tsx` (`FieldGroup`, `SectionTitle`, `MarketplaceSection`,
  `OtherCostsSection`, `PriceResults`). **Recommendation**: lift the shared form-body into a location both
  features may import — a new `features/piece-input/` (or `entities/piece`) that Calcular and BOM both consume —
  so the calculator stays byte-identical (SC-402) and BOM reuses, not forks, the form. **This is not a DS
  primitive gap; it is a code-org decision the plan/T005 must make before the composer is built.** *Highest-value
  flag for the parent agent.*
- **C2 — `PremiumTeaserDialog` redirect + copy props.** The shipped `features/catalog/premium-teaser.tsx`
  hardcodes `redirect: "/catalogo"` and reads `messages.catalogo.teaser*`. BOM needs `redirect: "/bom"` and the
  `bom.teaser*` copy. **Recommendation**: parametrize the existing component (`redirect` + a copy object /
  `variant` prop) rather than clone it — one honest teaser component, two callers. *App-level, no DS gap.*
- **G1 — Collapsible / disclosure row.** No `Accordion`/`Disclosure` primitive. Fully composable from `Card` +
  a `Button` header + `Icon chevron-down/up` + local open-state (the same way `CatalogTabs` was composed
  in-feature for E2's G1). **Recommendation**: a tiny `features/bom` local `LineCard` — not a DS addition. *No
  real gap.*
- **G2 — Skeleton loader.** None. `Spinner` is the honest minimum for the picker/saved-list fetches; a
  `Skeleton` is later polish. *Soft gap (same as E2 G3).*
- **G3 — BOM/assembly icon + (if §0.4-A) a nav icon.** No "assembly/layers" glyph in the 43-icon set; `package`
  is taken by Catálogo. Candidates in-set: `copy` (stacked → "multiple"), `tag`, or `package` reused.
  **Recommendation**: `copy` for the assembly concept; if the owner approves the 5th nav tab (§0.4-A) it needs a
  distinct nav glyph (a Lucide `layers`/`boxes` would need inlining into `icon.tsx` — the only place a new SVG
  would be added). *Soft gap, pending the §0.4 owner call.*
- **G4 — Sticky bottom summary bar.** No primitive; a positioned `Card`/`div` covers it. *Not a gap; a layout
  choice (Option A).*

---

## Determinism / honesty guardrails carried into every BOM UI task

- **Server is the only authority on persistence** (FR-405). The client route-guard (§0.1) is **server-informed**
  (`GET /api/v1/entitlement`), never a local flag (ADR-0015) — it mirrors server truth for honesty, it does not
  replace it. A `403 ENTITLEMENT_REQUIRED` maps to `apiError.entitlementRequired`.
- **The offline compute is a soft boundary — never imply it is server-enforced** (ADR-0015 honesty clause). The
  paid value is compose-at-scale + save/manage + catalog-reference, stated plainly.
- **No fake success, ever**: success toasts fire only on real 2xx (offline/lapsed/free never toast success).
- **The UI never does money arithmetic** — every number is read from `computeBom`/`BomResult` (§0.2); wire money
  is decimal strings (PR-B). Double-rounding is prevented in the core (FR-412), not in the view.
- **`skippedLines`/`contributingLines === 0` are surfaced honestly** — a channel slot in error contributes zero
  and the rollup **says so** calmly (§1.7); never a silent drop, never a fabricated R$ 0.
- **The E1 free single-piece calculator is untouched and byte-identical** (FR-411/SC-402/SC-409) — BOM is an
  additive Premium feature behind an honest guard/teaser; nothing about the free calculator changes.
- **All copy: honest, calm, pt-BR, no price, no date, no pre-E6 purchase CTA** on any Premium/teaser/lapse
  surface (Q3/FR-410/FR-014); "cancelar" banned — use "Voltar".
```