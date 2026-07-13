# UX Spec — E4 Histórico + snapshots + export (T001 · designer-ux → Claude Design handoff)

**Level**: wireframe / flow / state — **NOT pixel-final**. Final UI is produced in Claude Design from this + the
UI the owner envisions. Structure in English; all user-facing copy in **pt-BR** (i18n-ready, tom honesto/calmo).

**Feeds**: T010 (record action), T011 (sign-out guard), T013 (list + detail), T015 (US5 teaser). Forward-designed
here, **not blocking PR-A**: T019/T020 (detail + "Recalcular hoje", PR-B), T022 (search/filter/label/delete,
PR-B), T028 (export affordances, PR-C). Non-blocking, parallel with all of PR-A (tasks.md T001).

**Sources of truth**: `spec.md` (US1–US7, FR-501..529, SC-501..515, the **two-shelf rule**, three dated owner
sessions) · `plan.md` · `data-model.md` (D1 frozen payload, D3 provenance-without-FK, D5 device date, §7 open
points) · `contracts/api-surface.md` · **ADR-0018** (the outbox — `syncState` vocabulary, §7 merged list, §8
blocked-on-403, §9 sign-out guard) · **ADR-0019** (immutability) · **ADR-0020** (server-rendered export ⇒
online-only) · house honesty lineage: `specs/007-e2-catalog-entitlement/ux-catalog.md` §0.3/§2/§3,
`specs/008-e3-multi-piece-bom/ux-bom.md` §1.2-D (the F1/K3 lesson) + `docs/product/ux-decisions.md`.

**Mobile-first 390px.** Every wireframe drawn at that viewport; ≥44px touch targets; no horizontal overflow
(FR-010 lineage). Desktop notes inline.

**DS reused (ADR-0007 `tf-*`)**: `PageHeader` (widget), `Card`, `EmptyState`, `Alert`, `Badge`, `Button`, `Icon`,
`Spinner`, `Field`, `NumberField`, `Select`, `Switch`, `Dialog`/`Sheet` (Radix focus-trap, ≥44px close),
`Toaster`/`toast`, `BreakdownRow`. The E2 `PremiumTeaserDialog` pattern is **reused, not rebuilt**. **`PriceHero`
is deliberately NOT used on any snapshot surface** — see §0.3. No new DS primitives invented; real gaps in §9.

---

## 0. Cross-cutting decisions — read before building any Histórico surface

### 0.1 The honesty core — entitlement × connectivity × affordance matrix

Persistence is **server-authoritative** (FR-510, Constitution IV). The client mirrors that truth honestly; it
never decides it. Recording is only **offered** when the **last-known server** entitlement was `active` (ADR-0018
§8 — a cached server response, **never** a client-held flag).

| Affordance | `active` online | `active` OFFLINE | `lapsed` | `none` (free) / signed-out |
|---|---|---|---|---|
| Histórico tab reachable | list (server ∪ outbox) | list from cache ∪ outbox | list, **read-only freeze** | **teaser** (§7), never a broken list |
| "Salvar no histórico" (Calcular / Kits) | enqueue → sync → real 2xx | enqueue → **pendente** (§1) | tap → reactivation panel (server denies anyway) | tap → **teaser**, nothing persists |
| Open a snapshot (detail) | stored values | stored values (cache) | stored values | — |
| Editar rótulo · Excluir (PR-B) | works | honest *"precisa de conexão"* | reactivation panel | — |
| **Recalcular hoje** (PR-B) | new entry | new entry, **pendente** + stale-catalog caption (§4.4 ⚠) | reactivation panel | — |
| **Exportar** (PR-C) | works | **disabled with reason** (ADR-0020) | **denied** honestly (Q6) | teaser, **no artifact** (FR-516) |
| Any "success" toast | **real 2xx only** | never | never | never |

Three non-negotiables carried from E2 §0.3 / E3 §0.1: **(1)** an affordance is **visible**, never hidden; **(2)**
the intercept is **honest and specific** (conexão / reativação / Premium — never a generic error, never a fake
"salvo!"); **(3)** nothing persists and no success is faked.

### 0.2 The two-shelf rule, as a *visual* rule (the inverse of E3 — both ship in the same app)

This is the single highest-risk confusion in E4. E3 taught the codebase *and the reader* one reflex; E4 must do
the opposite, on the next screen over, without contradicting it.

| | **Kit line / catalog (E2·E3)** | **Snapshot (E4)** |
|---|---|---|
| On reopen | recomputes live | renders **stored** values, zero recomputation |
| Origin deleted | degrades → line reads `(avulsa)` + the **calm mute caption** `productForm.manualValuesKept` | **nothing happens.** Captured name still shows; **"abrir produto" simply absent**; **no caption, no warning, no badge** |
| Fields | editable inputs | **read-only rows** — a snapshot detail has **no form** |
| Date | none | **on every surface, always** (FR-523) |
| The words *removido / excluído / deletado* | **banned** (F1/K3) | **banned** — and here the *absence of any message at all* is the correct behavior |

**Design devices that make a snapshot unmistakable at a glance** (all four, they are cheap and they compound):
1. **Every money figure is dated in place** — the date is not metadata in a corner, it is part of the money block.
2. **The money label is `Valor cotado`, never `Preço`** — "preço" is what the live calculator/catalog says today.
3. **No `PriceHero`** on any snapshot surface (§0.3) — the live-price hero is the visual signature of "hoje".
4. **No input controls** in a snapshot detail — rows, not fields. A read-only surface *looks* frozen.

> Homologation cue (T023): the two-shelf contrast is only proven when a deleted product makes a **kit line
> degrade with a caption** and a **snapshot change nothing at all**, side by side. Design them so a screenshot of
> each is obviously a different kind of object.

### 0.3 Money + date rendering rules (FR-523 · FR-525 · D5)

- **The UI never does arithmetic.** Every number on a snapshot surface is read from the **stored payload**
  (decimal strings) and only *formatted*. No sums, no re-rounding, no `?? 0` fallback in JSX.
- **Absence ≠ zero (FR-507).** The renderer iterates the keys **present** in `result`. A breakdown line the
  formula did not have then renders **nothing** — never `R$ 0,00`. (The frozen types must be structurally
  independent of the live `PriceResult`, or TypeScript itself will manufacture the fabricated zero — tasks.md
  standing rule.)
- **The date renders with the captured offset.** Format the calendar day the seller actually saw, using
  `deviceQuotedAt` + `deviceUtcOffsetMinutes` (D5) — never the viewer's current zone. `dd/mm/aaaa` (pt-BR);
  time (`às HH:mm`) only on the detail, never on the card.
- **Money uses tabular figures** (Inter `tnum`, per `ux-decisions.md`), right-aligned in breakdown rows.
- **No snapshot surface may present a value as current** (FR-523/SC-511) — the pairing *`Cotado em {data}` +
  `Valor cotado`* is the mechanical guarantee, on the card, on the detail, and in the exported artifact.

---

## 1. The sync states — the deliverable (US1 · ADR-0018 · FR-527/529 · SC-513/514)

**The product has never had one of these.** Recording works offline (the seller at a fair), so an entry can exist
on the device before it exists in the account. The vocabulary below is the whole honesty budget of E4's PR-A.

### 1.1 The four states, their triggers, and the exact copy

`syncState: synced | pending | blocked | failed` (ADR-0018 §8 — the list is ONE selector, *server ∪ outbox*,
deduped on `clientSnapshotId`, **server-wins**).

| state | What actually happened | Badge (list card) | Icon | Tone | Auto-retry | Actions offered | Exportable |
|---|---|---|---|---|---|---|---|
| **synced** | the server answered **2xx** — the row exists in the account | **no badge** (the baseline; a badge on every card is noise) | — | — | — | export · recalcular · rótulo · excluir | **yes** (online) |
| **pending** | queued at record time and **not yet accepted**: offline, in flight, timeout, **lost response**, 5xx | **"Pendente neste dispositivo"** | `history` | neutral / muted | **yes** (boot · `online` · focus · pós-login, backoff) | *Tentar agora* (online only) · *Descartar* (destructive, confirmado) | **no** → *"Sincronize para exportar."* |
| **blocked** | the server **denied** it: `403 ENTITLEMENT_REQUIRED` at sync (Premium lapsed/revoked between record and sync) | **"Envio pausado · precisa de Premium"** | `crown` | **info (calmo, NUNCA danger)** | stopped — **resumes automatically** on the next `active` entitlement | *Tentar novamente* · *Descartar* (destructive, confirmado) | **no** |
| **failed** | the server **rejected the content permanently**: `422` (payload inválido / acima do limite) | **"Não foi possível registrar"** | `triangle-alert` | danger | **no** | *Tentar novamente* · *Descartar* (destructive, confirmado) + `state.supportCode` | **no** |

**The load-bearing distinction, in one line:** *no answer is **not** the same as **not saved**.* A lost response,
a timeout, an abort, a 5xx ⇒ **pending**. Only an **explicit server rejection** produces `blocked` (403) or
`failed` (422). **"Falhou" never appears for a network non-answer.**

### 1.2 The copy, verbatim

```
pending  — badge:    "Pendente neste dispositivo"
           detail:   [Alert tone="info"]  Ainda não sincronizado
                     Este registro está só neste dispositivo e ainda não chegou à sua conta.
                     Ele sincroniza sozinho quando você voltar a ficar online.
           caption:  Enquanto não sincroniza, ele existe só aqui — se os dados do app forem
                     limpos, ele se perde.                          ← detail only, muted, NOT on the card
           toast (ao registrar offline, tone="info", NUNCA success):
                     "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."

blocked  — badge:    "Envio pausado · precisa de Premium"
           detail:   [Alert tone="info"]  Envio pausado
                     Este registro não foi enviado para a sua conta: o Premium não está ativo.
                     Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar
                     ativo, ele é enviado automaticamente.
           actions:  [ Tentar novamente ]   [ Descartar ]

failed   — badge:    "Não foi possível registrar"
           detail:   [Alert tone="danger"] Não foi possível registrar
                     O servidor não aceitou este registro. Ele não será reenviado sozinho.
                     Você pode tentar de novo ou descartar.
                     Código de suporte: {correlationId}            ← reuse state.supportCode
           actions:  [ Tentar novamente ]   [ Descartar ]

synced   — (sem badge). Toast real, só no 2xx: "Registro salvo no histórico."
```

**Banned on these surfaces** (test-guardable): "salvo" / "guardado" / "salvo com sucesso" while `pending`;
"falhou" for a non-answer; "bloqueado" / "expirou" / "suspenso" for `blocked` (the calm-lapse vocabulary rule,
E2 §3); any fabricated date or price.

> **Divergence from ADR-0018 §9's sketch copy, recorded.** The ADR sketches *"não foi registrado — precisa de
> Premium ativo"*. Proposed instead: **"Envio pausado · precisa de Premium"**. Why: (a) *pausado* is already the
> product's calm word for a lapse (`Premium pausado`, E2 §3 — one vocabulary, not two); (b) it is **literally
> true** — the retry is paused and **resumes by itself** when the entitlement returns (ADR-0018 §9), which "não
> foi registrado" hides; (c) "não foi registrado" reads as a terminal failure and would collide with `failed`.
> The *body* copy still states plainly that it has **not** reached the account. **Owner ratifies at homologation.**

### 1.3 Significant choice — how a `pending` entry looks in the list (≥3 options, Constitution)

**Option A — merged list, newest-first, with a per-card badge (RECOMMENDED, ~88%).** A pending entry sits in its
natural chronological slot (it was recorded *now*, so it lands on top) and carries the "Pendente neste
dispositivo" badge; a queue banner above the list aggregates (§2.2).
- Pros: it **is** the list — ADR-0018 §8 makes the merged selector structural, so no component can read the server
  query alone and lie by omission (the E3 PR-C lesson answered by construction); the entry is ordinary data, so it
  renders, tests and audits like any other; one mental model.
- Cons: a badge must be scannable at 390px (solved: text badge, not color-only).
- Scalability: high — a future E5 offline write reuses the same badge vocabulary.

**Option B — a separate "Pendentes" section pinned above the history.** Two visual groups.
- Pros: unmissable. Cons: it **implies pending entries are a different kind of thing** ("um rascunho"), which is
  exactly the wrong lesson — they are real records the server has not yet accepted; it also duplicates the
  ordering rule and invites a component that reads only the server list. Scalability: low. **~30%.**

**Option C — a toast/queue indicator only; the list shows synced entries.** Pending lives in a status chip.
- Pros: the list stays "clean". Cons: **a record the seller made would be invisible in the Histórico** — that is
  the silent-drop failure mode SC-513 forbids, dressed as tidiness. Reject. **~5%.**

**Decision: A.** With the aggregate banner (§2.2) as the *action* surface (Sincronizar agora), never as a
substitute for the badge.

### 1.4 Significant choice — feedback at the moment of recording (≥3 options)

**Option A — enqueue-first, one path online and offline (RECOMMENDED, ~85%).** "Salvar no histórico" **always**
writes the outbox entry first (durable, `clientSnapshotId` minted here), the entry appears in the Histórico
immediately as **pendente**, and the sync engine drains. The **success toast fires only on the real 2xx**;
offline, the honest *pending* toast fires instead.
- Pros: one code path ⇒ zero fake-success surface; the failed-enqueue case can honestly **throw** (ADR-0018 §1 —
  the outbox, unlike the read cache, must not swallow write failures); online the pending badge is a ~300ms blink
  and then a real "Registro salvo no histórico."; the seller at a fair and the seller at home do the same thing.
- Cons: a fast online path shows a transient badge (harmless; and it is *true*).
- Scalability: high.

**Option B — online: await the 2xx inline (button spinner), only enqueue when offline.** Two paths.
- Pros: no transient badge online. Cons: two code paths, two failure vocabularies, and the ugly middle case (the
  request is in flight when the network drops) has to be *retrofitted* into the queue anyway; a lost response
  would leave a spinner with nothing honest to say. **~45%.**

**Option C — optimistic "salvo!" then reconcile.** Rejected outright: it is the fake success the epic exists to
forbid (Principle II; ADR-0018 §4). **~0%.**

**Decision: A.**

### 1.5 Transitions + a11y

- `pending → synced`: the badge disappears, a **real** success toast fires, the card stays in place (no reorder —
  the sort key is `deviceQuotedAt`, which never changes). Announce politely: `aria-live="polite"` → *"Registro
  sincronizado."*
- `pending → blocked` (403) / `pending → failed` (422): the badge swaps in place; **no toast storm** — if N
  entries block at once, one aggregate banner announces it (§2.2), not N toasts.
- `blocked → pending` (entitlement returns `active`): silent, automatic; the banner count updates.
- Badges are **text + icon**, never color-only (WCAG 2.2 AA, `ux-decisions.md`).
- *Descartar* is destructive and **always confirmed** (Dialog, name/label echoed): *"Descartar este registro? Ele
  não foi enviado para a sua conta e não poderá ser recuperado."* → `[ Descartar ]` (danger) · `[ Voltar ]`.

---

## 2. Surface 1 — Histórico list (US2 → T013; search/filter = **PR-B**)

### 2.1 Frame + card anatomy (premium, populated)

```
┌────────────────────────────────────────────┐
│  Histórico                                  │  ← PageHeader (focusable h1)
│  O que você cotou, com a data. Os valores   │  ← description (states the frozen promise)
│  ficam como estavam no dia.                 │
│                                             │
│ ┌── queue banner (só se houver fila) ────┐ │  ← §2.2
│ │ ⌁ 2 registros pendentes neste           │ │
│ │   dispositivo.      [ Sincronizar agora ]│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌── [PR-B] busca + período ───────────────┐ │  ← ver §2.6 (NÃO em PR-A)
│ │ [ 🔎 Buscar por rótulo…              ]  │ │
│ │ [ 30 dias ][ 90 dias ][ Tudo ][ Período ]│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Cliente João — vaso G                 │  │  ← rótulo (ou fallback, §2.3)
│  │ [Pendente neste dispositivo]          │  │  ← Badge — só quando ≠ synced
│  │ Cotado em 12/07/2026 · Kit · 3 peças  │  │  ← DATA SEMPRE (FR-523) + tipo
│  │ Valor cotado          R$ 275,00       │  │  ← "Valor cotado", nunca "Preço"
│  │ preço de varejo                       │  │  ← headline_basis, explícito
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Vaso G — Mariana                      │  │
│  │ Cotado em 03/07/2026 · Peça única     │  │
│  │ Valor cotado          R$ 187,35       │  │
│  │ preço de varejo                       │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- **Card** = `Card padding="sm"`, whole body tappable → detail (§3). Row order: **rótulo → badge (se houver) →
  data + tipo → valor + base**. The date is **structurally above the money**: a card can never be read as a live
  price.
- **Never** the live `PriceHero` treatment (§0.2/§0.3). Money right-aligned, tabular.
- **Truncation**: the label truncates with ellipsis (full label in the detail). The **date and the total never
  truncate** — they are the claim.
- **Desktop**: the same cards in a max-w column; the queue banner spans the column. No table (a table would read
  as a live spreadsheet and invites horizontal overflow at 390px).

### 2.2 The queue banner (aggregate, action surface)

`Alert tone="info"` above the list, **only when the outbox is non-empty**:

```
online   :  "{n} registro(s) pendente(s) neste dispositivo."      [ Sincronizar agora ]
offline  :  "Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos
             quando você voltar a ficar online."                    (sem botão)
blocked≥1:  "{n} registro(s) não foram enviados: o Premium não está ativo."   [ Ver ]  (rola até o 1º)
failed ≥1:  "{n} registro(s) não puderam ser registrados."                    [ Ver ]
```

Precedence when mixed: **failed > blocked > pending** (the state that needs a human decision wins the banner);
the per-card badges always tell the full truth regardless of the banner.

### 2.3 Card label fallback (no `label` given)

The label is optional (FR-519). A card with none shows, in the label slot, the **captured provenance name**
(`payload.provenance.name`, e.g. *"Vaso G"*) — and, when provenance is `ADHOC`/absent, the honest neutral
**"Cálculo avulso"**. **Never** an invented name, never an empty row, never "Sem título" in a way that reads as
broken.

### 2.4 States

**EMPTY (premium, zero entries)** — `EmptyState` + action:
```
            (◷ history icon)
      Nenhum registro ainda
  Calcule uma peça ou um kit e toque em
  "Salvar no histórico" para guardar o preço
  com a data.
        [   Ir para a calculadora   ]
```

**LOADING** — centered `Spinner` in the list body; header stays (no layout jump). No skeleton primitive (G1).

**ERROR (server read failed, online)** — **never an error wall over data the user already holds**: if the cache
and/or the outbox have entries, render them and put a **non-blocking** `Alert tone="danger"` strip above with
`[ Tentar novamente ]` (loading-aware). Only a *cold* failure (nothing cached, nothing queued) renders the
full-panel error (`historico.loadError` + retry) — mirrors E2 §1.4.

**OFFLINE (active, read from cache)** — calm `Alert tone="info"`: *"Modo leitura offline — seus registros
continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online."* (Reuses the
E2/E3 offline vocabulary family; note it says **pendente**, not "salvo".)

**LAPSED (read-only freeze, FR-517)** — calm `Alert tone="info"`: *"Premium pausado — seus registros continuam
aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium."* Cards render normally;
every **write/export** affordance stays **visible** and, on tap, opens the reactivation panel (E2 §3 pattern; no
price, no date). **Nothing is deleted by the lapse.**

### 2.5 Long history (unbounded)

Keyset pagination (`data-model.md` D4) → **infinite scroll with an explicit `[ Carregar mais ]` button** (an
explicit button beats an auto-loading sentinel for a11y and for a seller scanning on a bad connection). A page
size is **not a cap** — no copy may ever suggest a limit (a cap would be a business-rules amendment, FR-518).

### 2.6 Search + date range (US6 — **PR-B**, designed now)

- **Busca por rótulo**: a `Field` text input, debounced, server-side `ILIKE` (owner-scoped). Empty result →
  honest `EmptyState`: *"Nenhum registro encontrado para “{termo}”."* + `[ Limpar busca ]`. **Never** silently
  show everything.
  ⚠ **Accent-sensitivity (data-model §7.5): `joao` does NOT find `João`.** If the owner accepts, the search field
  needs no extra copy; if not, it is an `unaccent` migration. **Owner flag (§10-F5).**
- **Período**: preset chips **`30 dias · 90 dias · Tudo · Período…`** (the chips cover ~95% of real use at 390px;
  `Período…` opens a Sheet with two native `<input type="date">` in `Field`s — zero deps, OS-native pickers).
  Rejected: two always-visible date inputs (eat the viewport, and most sellers want "os últimos meses").
- Filters compose (busca ∧ período) and the active filter is echoed as a removable chip so the seller always knows
  **why** they are seeing fewer entries — never a mysteriously short list.
- **The outbox is never filtered out.** A pending entry always renders (it is the record the seller just made);
  when a filter would exclude it, keep it and mark it with the existing badge. *An unsynced record must never
  disappear because of a filter.*

---

## 3. Surface 2 — Snapshot detail (US2 → T013; version/origin/recalcular = **PR-B** → T019/T020)

**Renders STORED values. Zero recomputation. No form, no inputs.**

```
┌────────────────────────────────────────────┐
│ ‹ Voltar                                    │
│  Cliente João — vaso G              ✎  🗑   │  ← rótulo + editar rótulo/excluir (PR-B)
│  [Pendente neste dispositivo]               │  ← Badge, se ≠ synced (§1)
│                                             │
│ ┌── o bloco da alegação (a "claim") ─────┐ │
│ │ Cotado em 12/07/2026 às 19:30           │ │  ← DATA + hora (offset capturado, D5)
│ │ Valor cotado            R$ 275,00       │ │  ← "Valor cotado" + base, nunca PriceHero
│ │ preço de varejo                         │ │
│ │ Validade da proposta: 15 dias            │ │  ← Q9 (só se informada)
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌── [Alert info] só quando pending/blocked/failed ──┐
│ │ Ainda não sincronizado …                 │ │  ← §1.2 (copy exata)
│ │ [ Tentar agora ]   [ Descartar ]         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  Valores congelados em 12/07/2026           │  ← caption acima do detalhamento
│  ── Peças do kit ───────────────────        │  ← KIT: itens + qty + valor por linha
│  Vaso G                3×     R$ 135,00     │
│  Suporte               5×     R$  60,00     │
│  Peça 3 (avulsa)       1×     R$  80,00     │
│  ── Detalhamento ───────────────────        │  ← BreakdownRow, SOMENTE as linhas gravadas
│  Material                     R$  42,10     │     (ausente ≠ zero — FR-507)
│  Energia                      R$   3,80     │
│  …                                          │
│  Custo total                  R$ 180,00     │
│  Preços por canal (se gravados)             │  ← rollup congelado, mesmas regras
│                                             │
│ ┌── ficha técnica (colapsável, calma) ───┐ │
│ │ Calculado com a fórmula versão 3.1.0    │ │  ← FR-506 / A29
│ │ Registro criado a partir de: Vaso G     │ │  ← nome CAPTURADO — sempre aparece
│ │            [ Abrir produto ]            │ │  ← SÓ se a origem ainda resolve (§3.2)
│ │ ⓘ Este registro guarda os valores como  │ │  ← InfoTip / caption (a regra das duas prateleiras)
│ │   foram calculados naquele dia. Ele não │ │
│ │   muda quando você edita o catálogo nem │ │
│ │   quando a fórmula do app é atualizada. │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  [ Recalcular hoje ]        [ Exportar ]    │  ← PR-B / PR-C (§4 · §6)
└────────────────────────────────────────────┘
```

### 3.1 What the detail must NOT do

- **No recomputation of any line** (SC-501) — every figure is a formatted stored string.
- **No fabricated zero** for a line the payload lacks (FR-507) — the row is simply absent.
- **No degraded state, no "last-known" caption, no warning** — a snapshot depends on nothing (FR-503).
- **No editable field** except the label (PR-B), which is a separate, explicit action — never an inline input in
  the breakdown.

### 3.2 The origin affordance (US3-2 — the inverse of E3's degraded line)

- The **captured name always displays** (`Registro criado a partir de: Vaso G`) — it is what the thing was called
  then, and it is part of the frozen document.
- **`[ Abrir produto ]` appears only when the id still resolves** to an owned, live product/kit at read time.
- **When it does not resolve: the button is simply absent.** No disabled button, no broken link, **no
  "produto excluído" claim, no caption, no badge, no tone change.** The surface looks *identical* to a snapshot
  whose origin was always ad-hoc. **This absence is the feature.**
- Test guard (T018): `/removid|excluíd|deletad/i` matches **nothing** on any snapshot surface.

### 3.3 The device-clock caveat — ⚠ owner call (§10-F2)

FR-528: the date is the device's and the server cannot verify it; it **must not be presented as verified**. It
also must not alarm the seller, who is reading *their own* record of *their own* quote. Recommended (~70%): a
single muted line **inside the collapsed ficha técnica**, nowhere else:
> *"Data registrada pelo seu aparelho no momento da cotação."*

Alternatives: (B) no caveat anywhere (~55% — arguably fine, since the app never claims verification; but it
leaves the limitation invisible); (C) a caveat on the card/claim block (~15% — noise on every card, and it
undermines the seller's own record for no benefit). **Owner decides.**

---

## 4. The record action — where a snapshot is born (US1 → T010)

### 4.1 Entry points (no IA change — FR-524)

- **Calcular** (single piece): a `[ Salvar no histórico ]` `Button` **below the results block**, beside/under the
  existing `freemiumNote`. Free/signed-out → teaser (§7). *(The E1 free calculator is otherwise untouched.)*
- **Kits** (composer + a saved kit): the same button in/near the pinned assembly summary — the kit's frozen
  payload carries lines + the per-channel rollup from PR-A (Q2).
- **No new nav tab. The Histórico tab already exists (FR-524).**

### 4.2 The record Sheet (right-anchored full-height `Sheet` — E2 §0.2 idiom)

```
                         ┌──────────────────────────┐
                         │ Salvar no histórico    ✕ │
                         │ Vamos guardar os valores  │  ← honesto: o que congela
                         │ exatamente como estão     │
                         │ nesta tela, com a data    │
                         │ de hoje.                  │
                         │                           │
                         │ Rótulo (opcional)         │
                         │ [ Cliente João — vaso G ] │  ← Field, ≤120 chars
                         │ Cliente, pedido…          │  ← hint
                         │                           │
                         │ Validade da proposta      │
                         │ [ 15        dias ]        │  ← NumberField (opcional, Q9)
                         │                           │
                         │ Preço que você está       │  ← ⚠ §10-F1 (owner)
                         │ cotando                   │
                         │ ( • ) Varejo  R$ 275,00   │
                         │ (   ) Atacado R$ 230,00   │
                         │                           │
                         │ Cotado em 12/07/2026      │  ← a data, mostrada ANTES de gravar
                         │                           │
                         │        [ Salvar no        │
                         │          histórico ]      │
                         └──────────────────────────┘
```

- **Offline**: the Sheet works identically; the primary button keeps its label (it *does* record — into the
  device). The confirmation is the honest **pending** toast (§1.2), never a success toast.
- **Free / signed-out / lapsed**: the button is visible and intercepts (teaser / reactivation) — nothing persists.
- Blank label ⇒ NULL (never `""`); validity blank ⇒ absent (and it is **not** a TTL — nothing expires the record).

### 4.3 Significant choice — which number is "the quoted price"? (≥3 options; **owner flag §10-F1**)

`data-model.md` §7.1 leaves `headline_basis` open, and it is a **UX-visible** question: the card, the detail and
the exported quote all show *"the"* total, but E1 computes `custoTotal`, `precoVarejo`, `precoAtacado` **and**
per-channel announce prices.

- **Option A — the seller picks at record time (Varejo | Atacado), pre-selected Varejo (RECOMMENDED, ~72%).** A
  snapshot **is the seller's assertion**; an atacado quote is a real thing sellers send. Zero extra taps for the
  common case; the basis is then labelled everywhere (`preço de varejo`), so the number is never ambiguous.
  Cons: one more control in the record Sheet.
- **Option B — always `precoVarejo`, no choice (~60%).** Leanest; matches the data-model recommendation. Cons: an
  atacado seller's Histórico would **lie about what they quoted**, and the fix later is new UX anyway.
- **Option C — record both, show both on the card (~35%).** Honest but the card loses its single headline, and the
  export would have to ask "which one goes in the quote?" at export time instead.

**Both A and B keep `headline_basis` labelled on every surface** — that part is non-negotiable (an unlabelled
total is an ambiguous claim). **Owner decides.**

### 4.4 "Recalcular hoje" (US3-4 / FR-505 — **PR-B**, T020)

It **creates a new entry** and **never** modifies the original. Two honest variants:

```
origem ainda existe:
  ┌─ Dialog ────────────────────────────────┐
  │ Recalcular hoje                          │
  │ Isso cria um NOVO registro com os valores │
  │ do seu catálogo hoje. O registro de       │
  │ 03/07/2026 continua como está.            │
  │              [ Voltar ] [ Recalcular ]    │
  └──────────────────────────────────────────┘

origem NÃO resolve mais (produto/kit não está mais no catálogo):
  ┌─ Dialog ────────────────────────────────┐
  │ Recalcular hoje                          │
  │ A origem deste registro não está mais no  │
  │ seu catálogo. Dá para recalcular usando   │
  │ os valores guardados neste registro e a   │
  │ fórmula atual — mas isso NÃO reflete os    │
  │ preços de hoje do seu catálogo.           │
  │              [ Voltar ] [ Recalcular ]    │
  └──────────────────────────────────────────┘
```

The resulting entry lands in the list as a normal new snapshot (pending → synced). It is dated **today**.
Note the copy never says the origin was "removida/excluída" — it says only what is **true now**: it does not
resolve. (It may have been renamed away, deleted in another session, or never saved.)

⚠ **Offline + "Recalcular hoje" (gap the spec did not answer — §10-F3).** The action re-resolves *today's catalog*
values; offline, "today's catalog" is the **cached** catalog. Recommended (~70%): keep the action available with
an honest caption — *"Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar
desatualizados."* — and the new entry queues as pending. Alternative: disable it offline with the reason
(*"Recalcular precisa de conexão para usar os preços de hoje."*) — simpler and arguably more honest, but it denies
the fair-seller a re-quote. **Owner/plan call.**

---

## 5. Surface 4 — Sign-out with a non-empty queue (ADR-0018 §10 → T011)

**Blocking, honest, at the sign-out action.** Entries must never vanish silently nor leak into the next account.

```
                  ┌──────────────────────────────────┐
                  │ ⚠ 2 registros ainda não foram    │  ← Dialog (Radix, focus-trap)
                  │   sincronizados                   │
                  │                                   │
                  │ Eles estão só neste dispositivo.   │
                  │ Se você sair agora sem enviar,     │
                  │ eles são apagados deste aparelho   │
                  │ e não vão para a sua conta.        │
                  │                                   │
                  │   [   Sincronizar agora   ]        │  ← primário (SÓ online)
                  │   [   Sair e descartar    ]        │  ← danger → 2º confirm
                  │   [        Voltar         ]        │  ← "Voltar", NUNCA "Cancelar" (FR-014)
                  └──────────────────────────────────┘

offline: "Sincronizar agora" fica DESABILITADO com o motivo visível:
         "Precisa de conexão para enviar."          ← nunca um botão que finge

2º confirm (destrutivo, explícito):
                  ┌──────────────────────────────────┐
                  │ Descartar 2 registros e sair?     │
                  │ Eles não foram enviados para a    │
                  │ sua conta e não poderão ser        │
                  │ recuperados.                       │
                  │  [ Voltar ]  [ Descartar e sair ] │  ← danger
                  └──────────────────────────────────┘
```

- **"Sincronizar agora"** drains the queue; on full success it proceeds to sign-out automatically. If some entries
  come back **blocked** (403 — the Premium lapsed) or **failed**, **do not sign out**: return to the dialog with
  the honest count (*"{n} registro(s) não puderam ser enviados."*) and the same three choices. Never a partial
  silent discard.
- **Discard** purges the outbox key with the uid-keyed sweep + the history read cache (the shipped
  purge-on-signout pattern: `purgeBomCache` / catalog cache → **`history` joins the sweep**, T013).
- **Empty queue ⇒ no dialog** — the sign-out stays one click (the shipped behavior).
- ⚠ **Code-org (C1, §9):** sign-out is triggered from **two** places today — `widgets/top-bar/top-bar.tsx` and
  `pages/conta/conta-page.tsx`, both calling `signOutUser()` from `shared/session/session-store`. A guard added in
  only one leaves a hole through which unsynced quotes vanish. **Both must route through one guarded intent.**

---

## 6. Export affordances (US4 — **PR-C**, T028; ADR-0020)

Export is **server-rendered and online-only**, and a **pending** snapshot has no server row to render.

| Situation | Affordance | Copy |
|---|---|---|
| synced + online + active | `[ Exportar ]` enabled → export Sheet | — |
| **offline** | **visible, disabled, with the reason** | *"Exportar precisa de conexão."* |
| snapshot **pending** (or blocked/failed) | **visible, disabled, with the reason** | *"Sincronize para exportar."* |
| **lapsed** (Q6) | visible → **reactivation panel** | *"Exportar precisa do Premium ativo. Seus registros continuam aqui para leitura."* |
| free / signed-out | visible → **teaser**, **no artifact** | §7 |

Never a spinner that ends in nothing; never a fake "arquivo gerado"; never a partial artifact.

**Export Sheet** (premium, online):
```
│ Exportar                             ✕ │
│ ( • ) Orçamento para o cliente (PDF)    │
│ (   ) Meu histórico (CSV)               │
│                                         │
│ [ ] Incluir detalhamento de custos      │  ← Switch, OFF por padrão (Q4/FR-512)
│     Seu cliente veria material, energia,│  ← a razão, dita em voz alta
│     máquina, falha e margem.            │
│                                         │
│ O orçamento leva: itens, quantidades,   │  ← o que vai no documento (sem surpresa)
│ o valor cotado, a data e a validade,    │
│ e identifica você pelo nome e e-mail    │  ← Q13 — o e-mail pessoal, dito abertamente
│ da sua conta.                           │
│              [ Gerar PDF ]              │
```

The "incluir detalhamento" switch is **off by default and stays off** — leaking margin to the seller's client is a
product-level harm (Q4). The copy above the switch names the harm instead of hiding it.

---

## 7. Surface 5 — The honest teaser (US5 → T015; free / signed-out)

Reuses the E2 `PremiumTeaserDialog` lineage verbatim (crown; **no price, no availability date, no purchase CTA**
before E6; no fake "salvo!"). **The Histórico tab EXPLAINS — it is never a broken list, and it NEVER shows a
fabricated sample entry.**

```
┌────────────────────────────────────────────┐
│  Histórico                                  │
│                                             │
│            (♛ crown)                        │
│   Guarde o preço que você cotou,            │  ← title
│   com a data                                │
│                                             │
│  No Premium, cada cálculo pode virar um      │  ← body (valor; SEM preço/data)
│  registro com data. Os valores ficam como    │
│  estavam no dia — mesmo que o seu catálogo   │
│  mude depois.                                │
│                                             │
│  A calculadora continua grátis.              │  ← reafirma a promessa livre
│                                             │
│        [   Salvar um cálculo   ]             │  ← afordância VISÍVEL → abre o teaser
└────────────────────────────────────────────┘

Dialog (ao tocar qualquer "salvar no histórico" / "exportar"):
                    ┌──────────────────────────┐
                    │ (♛)                    ✕ │
                    │ O histórico faz parte do  │
                    │ Premium                   │
                    │                           │
                    │ No Premium você registra o │
                    │ preço que cotou, com a     │
                    │ data, e reabre depois      │
                    │ exatamente como estava.    │
                    │                           │
                    │ Calcular continua grátis.  │
                    │                           │
                    │            [  Entendi  ]  │  ← SEM preço, SEM data, SEM "assinar"
                    └──────────────────────────┘

Signed-out: + "Para guardar seu histórico, entre e ative o Premium."
            [ Entrar ] [ Entendi ]     ← Entrar → /sign-in?redirect=/historico
```

- **Exportar (free)**: the affordance opens **this same teaser** and **no artifact is produced** (FR-516/Q7) —
  including for an ephemeral, unsaved calculation. No "exporte grátis uma vez".
- The `PremiumTeaserDialog` needs `redirect=/historico` + the `historico.teaser*` copy — the E3 note (C2) applies:
  **parametrize the one component, do not clone it**.

---

## 8. Microcopy pt-BR (proposed `messages.pt-br.ts` — owner-ratified at homologation)

> Tom: honesto, calmo, técnico-cordial. **Sem preço, sem data de disponibilidade, sem CTA de compra** (E6).
> **"Cancelar" é banido (FR-014) — usar "Voltar".** Extends the existing (placeholder) `historico` block.

```ts
historico: {
  title: "Histórico",
  subtitle: "O que você cotou, com a data. Os valores ficam como estavam no dia.",
  // list
  emptyTitle: "Nenhum registro ainda",
  emptyBody: "Calcule uma peça ou um kit e toque em “Salvar no histórico” para guardar o preço com a data.",
  emptyAction: "Ir para a calculadora",
  quotedAt: "Cotado em {data}",                 // card + detail (SEMPRE — FR-523)
  quotedAtTime: "Cotado em {data} às {hora}",   // detail
  quotedValue: "Valor cotado",                  // NUNCA "Preço"
  basisRetail: "preço de varejo",
  basisWholesale: "preço de atacado",
  kindSingle: "Peça única",
  kindKit: "Kit · {n} peças",
  adhocFallback: "Cálculo avulso",              // rótulo ausente + sem provenance
  loadMore: "Carregar mais",
  loadError: "Não foi possível carregar seu histórico.",
  retry: "Tentar novamente",
  // detail
  frozenCaption: "Valores congelados em {data}",
  validity: "Validade da proposta: {n} dias",
  kitPieces: "Peças do kit",
  breakdown: "Detalhamento",
  techTitle: "Ficha técnica",
  modelVersion: "Calculado com a fórmula versão {versao}",           // FR-506 / A29
  origin: "Registro criado a partir de: {nome}",                     // nome CAPTURADO
  openOrigin: "Abrir produto",                                       // SÓ se a origem resolve
  frozenExplainer:
    "Este registro guarda os valores como foram calculados naquele dia. Ele não muda quando você edita o catálogo nem quando a fórmula do app é atualizada.",
  deviceClockNote: "Data registrada pelo seu aparelho no momento da cotação.",  // ⚠ F2 (owner)
  // record
  saveAction: "Salvar no histórico",
  saveSheetTitle: "Salvar no histórico",
  saveSheetIntro: "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.",
  labelField: "Rótulo (opcional)",
  labelHint: "Cliente, pedido…",
  validityField: "Validade da proposta",
  validityUnit: "dias",
  basisField: "Preço que você está cotando",    // ⚠ F1 (owner) — só se Opção A
  saved: "Registro salvo no histórico.",        // toast success — SÓ em 2xx real
  // sync states (§1) — o vocabulário
  syncPendingBadge: "Pendente neste dispositivo",
  syncPendingTitle: "Ainda não sincronizado",
  syncPendingBody:
    "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online.",
  syncPendingDurability:
    "Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde.",
  syncPendingToast: "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão.",
  syncBlockedBadge: "Envio pausado · precisa de Premium",
  syncBlockedTitle: "Envio pausado",
  syncBlockedBody:
    "Este registro não foi enviado para a sua conta: o Premium não está ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é enviado automaticamente.",
  syncFailedBadge: "Não foi possível registrar",
  syncFailedTitle: "Não foi possível registrar",
  syncFailedBody:
    "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você pode tentar de novo ou descartar.",
  syncedAnnounce: "Registro sincronizado.",     // aria-live polite
  retryNow: "Tentar agora",
  retryAgain: "Tentar novamente",
  discard: "Descartar",
  discardConfirmTitle: "Descartar este registro?",
  discardConfirmBody:
    "Ele não foi enviado para a sua conta e não poderá ser recuperado.",
  // queue banner (§2.2)
  queuePending: "{n} registro(s) pendente(s) neste dispositivo.",
  queuePendingOffline:
    "Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online.",
  queueBlocked: "{n} registro(s) não foram enviados: o Premium não está ativo.",
  queueFailed: "{n} registro(s) não puderam ser registrados.",
  syncNow: "Sincronizar agora",
  queueSee: "Ver",
  // sign-out guard (§5)
  signOutQueueTitle: "{n} registro(s) ainda não foram sincronizados",
  signOutQueueBody:
    "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta.",
  signOutSyncNow: "Sincronizar agora",
  signOutSyncOffline: "Precisa de conexão para enviar.",
  signOutDiscard: "Sair e descartar",
  signOutDiscardConfirmTitle: "Descartar {n} registro(s) e sair?",
  signOutDiscardConfirmBody:
    "Eles não foram enviados para a sua conta e não poderão ser recuperados.",
  signOutDiscardConfirm: "Descartar e sair",
  signOutPartial: "{n} registro(s) não puderam ser enviados.",
  back: "Voltar",                                // NUNCA "Cancelar" (FR-014)
  // offline / lapsed (mesma família E2/E3)
  offlineTitle: "Modo leitura offline",
  offlineBody:
    "Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online.",
  lapsedTitle: "Premium pausado",
  lapsedBody:
    "Seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium.",
  // PR-B — manage
  searchPlaceholder: "Buscar por rótulo…",
  searchEmpty: "Nenhum registro encontrado para “{termo}”.",
  searchClear: "Limpar busca",
  period30: "30 dias",
  period90: "90 dias",
  periodAll: "Tudo",
  periodCustom: "Período…",
  editLabel: "Editar rótulo",
  labelSaved: "Rótulo atualizado.",
  deleteTitle: "Excluir este registro?",
  deleteBody: "Esta ação não pode ser desfeita.",
  deleteConfirm: "Excluir",
  recalcAction: "Recalcular hoje",
  recalcTitle: "Recalcular hoje",
  recalcBody:
    "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de {data} continua como está.",
  recalcNoOriginBody:
    "A origem deste registro não está mais no seu catálogo. Dá para recalcular usando os valores guardados neste registro e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo.",
  recalcOfflineNote:
    "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados.",  // ⚠ F3
  recalcConfirm: "Recalcular",
  // PR-C — export
  exportAction: "Exportar",
  exportQuotePdf: "Orçamento para o cliente (PDF)",
  exportHistoryCsv: "Meu histórico (CSV)",
  exportIncludeCosts: "Incluir detalhamento de custos",
  exportIncludeCostsWarn:
    "Seu cliente veria material, energia, máquina, falha e margem.",
  exportContents:
    "O orçamento leva: itens, quantidades, o valor cotado, a data e a validade, e identifica você pelo nome e e-mail da sua conta.",
  exportGenerate: "Gerar PDF",
  exportOffline: "Exportar precisa de conexão.",
  exportPending: "Sincronize para exportar.",
  exportLapsed: "Exportar precisa do Premium ativo. Seus registros continuam aqui para leitura.",
  // teaser (US5) — SEM preço, SEM data, SEM CTA de compra
  teaserTitle: "Guarde o preço que você cotou, com a data",
  teaserBody:
    "No Premium, cada cálculo pode virar um registro com data. Os valores ficam como estavam no dia — mesmo que o seu catálogo mude depois.",
  teaserAction: "Salvar um cálculo",
  teaserDialogTitle: "O histórico faz parte do Premium",
  teaserDialogBody:
    "No Premium você registra o preço que cotou, com a data, e reabre depois exatamente como estava.",
  teaserFreeNote: "A calculadora continua grátis.",
  teaserSignedOutBody: "Para guardar seu histórico, entre e ative o Premium.",
},
```

Reused unchanged: `apiError.entitlementRequired`, `calculator.freemiumNote`, `premiumTeaser.{signIn,dismiss,
reactivateTitle,reactivateBody}`, `state.supportCode`, `nav.historico`, `catalogo.retry`. **Replaced**: the
placeholder `historico.emptyTitle` ("Histórico em breve") / `emptyBody` — E4 fills the tab (FR-524).

---

## 9. Claude Design handoff — what to prototype + gaps

### 9.1 Worth a pixel prototype (ranked; PR-A can proceed on this wireframe + the shipped DS)

1. **The sync-state badges + the pending/blocked/failed detail Alerts** — the surface the product has never had,
   and the one place an honesty bug would be invisible. Needs a treatment that reads as *"true, calm, not an
   error"*. **Highest.**
2. **Histórico list card** — label · badge · **date** · `Valor cotado` + basis. Must be **impossible** to mistake
   for a live catalog card at 390px (§0.2). **Highest.**
3. **Snapshot detail** — the claim block + the frozen breakdown + the ficha técnica; the "frozen, read-only"
   chrome. **High.**
4. **Sign-out-with-queue dialog** (+ the 2-step destructive confirm, + the offline disabled state). **High.**
5. **Teaser** (free + signed-out) — E2/E3 lineage, owner ratifies copy. **High.**
6. **Record Sheet** (rótulo · validade · [basis?] · a data mostrada antes de gravar). **Medium.**
7. **Export Sheet** + the three disabled-with-reason states. **Medium (PR-C).**
8. **Empty / loading / offline / lapsed** states. **Low (DS-ready).**

### 9.2 DS gaps + code-org flags (compose-first; nothing invents a primitive silently)

- **C1 — the sign-out guard has TWO entry points (load-bearing).** `widgets/top-bar/top-bar.tsx` **and**
  `pages/conta/conta-page.tsx` both call `signOutUser()` from `shared/session/session-store`. A dialog added to one
  leaves a hole through which unsynced quotes vanish silently — exactly what ADR-0018 §10 forbids. FSD-Lite also
  blocks the obvious shortcut (`shared` may not import `entities/history`). **Recommendation**: `shared/session`
  exposes a `requestSignOut()` intent (a store flag); **one app-level guard component** (mounted in the app shell,
  free to import `entities/history`) reads the outbox count, renders the dialog, performs the purge, and only then
  calls the real `signOutUser()`. Both callers switch to `requestSignOut()`. **This is a T011 architecture
  decision, not a styling one.**
- **G1 — no `Skeleton`** — `Spinner` remains the honest minimum (same soft gap as E2 G3 / E3 G2).
- **G2 — icon set has no `clock` / `cloud-off` / `refresh`.** Available set is 32 glyphs (`history`, `crown`,
  `triangle-alert`, `circle-check`, `download`, `share-2`, …). **Recommendation**: text-first badges (`history` for
  pending, `crown` for blocked, `triangle-alert` for failed) and a **text-only** "Sincronizar agora" button. If the
  owner wants a sync glyph, `refresh-cw` + `cloud-off` would be inlined into `icon.tsx` — the only place a new SVG
  is ever added (the E3 G3 precedent). *Soft gap.*
- **G3 — `Badge` tone for `pending`.** Verify the shipped `BadgeTone` union has a neutral/attention tone that is
  **not** danger; if not, compose the badge from `Badge tone="neutral"` + icon + text. Pending must never look like
  an error — it is a normal, expected state for a seller at a fair.
- **G4 — date-range input (PR-B)**: no date primitive. **Recommendation**: preset chips + a `Sheet` with two
  native `<input type="date">` in `Field`s (zero deps, OS pickers at 390px). *Not a DS gap; a layout choice.*
- **G5 — ConfirmDialog**: same as E2 G5 — `Dialog` + a `danger` `Button` covers every destructive confirm here
  (descartar · excluir · sair e descartar). A thin app-level wrapper is worth it (3 callers).

---

## 10. Owner flags (do not invent — Principle VIII)

| # | Flag | Recommendation (confidence) |
|---|---|---|
| **F1** | **Which number is "the quoted price"?** (`headline_basis` — `data-model.md` §7.1). It shapes the record Sheet, the card, and the exported quote. | **Let the seller pick at record time (Varejo pré-selecionado)** — a snapshot is the seller's assertion, and atacado quotes are real (**72%**). Fallback: always Varejo (60%). **Either way, the basis is labelled on every surface.** |
| **F2** | **Do we surface the device-clock caveat to the seller?** (FR-528 — must not be presented as verified, must not be silently "fixed"). | **A muted line inside the collapsed ficha técnica only** — *"Data registrada pelo seu aparelho no momento da cotação."* (**70%**). Not on the card, not on the claim block. |
| **F3** | **"Recalcular hoje" while OFFLINE** — the spec did not answer it. It re-resolves *today's catalog*, which offline is the **cached** catalog. | **Keep it available with the honest stale-catalog caption**, new entry queues as pending (**70%**). Alternative: disable offline with the reason. PR-B decision. |
| **F4** | **The `pending` durability sentence** — *"se os dados do app forem limpos, ele se perde"* is **true** (IndexedDB eviction; `navigator.storage.persist()` is best-effort) but it is the most alarming sentence in the app. | **Keep it, detail-only, muted, never on the card** (**75%**). Softer alternative: rely on "neste dispositivo" alone to carry the caveat (55% — cheaper, but it leaves a real risk unsaid, and E4's whole premise is that we say the uncomfortable thing). |
| **F5** | **Accent-sensitive label search** (`data-model.md` §7.5): `joao` will **not** find `João`. | Accept for E4 (**65%**) — labels are usually typed with accents by the same person who searches them. If not accepted, it is an `unaccent` extension migration (a new DB posture ⇒ owner call). |
| **F6** | **Copy conflict with the task brief**: the sign-out dialog was specified with a **[Cancelar]** button; **FR-014 bans "cancelar"** in the message module (the house uses **"Voltar"**). | **"Voltar"** (**95%**) — flagged so the divergence from the brief is a decision, not a slip. |
| **F7** | **`blocked` badge copy diverges from ADR-0018 §9's sketch** ("não foi registrado — precisa de Premium ativo" → **"Envio pausado · precisa de Premium"**). | Adopt the proposed copy (**80%**) — one calm vocabulary with `Premium pausado`, and it is literally true (the retry resumes on the next `active`). Owner ratifies at PR-A homologation. |

---

## Determinism / honesty guardrails carried into every E4 UI task

- **A snapshot has no degraded state.** Origin gone ⇒ the captured name still shows and **"abrir produto" is
  simply absent** — no caption, no warning, **no "produto excluído" claim** (FR-503; the F1/K3 lesson, inverted).
  The regex guard `/removid|excluíd|deletad/i` must match **nothing** on any snapshot surface.
- **The date is on every snapshot surface**, above the money, always (FR-523/SC-511). **No snapshot surface may
  present a value as current.** `Valor cotado`, never `Preço`; never `PriceHero`.
- **"Pendente neste dispositivo" — never "salvo", never "guardado".** Durability is *in practice*, not *in
  guarantee* (ADR-0018 Consequences).
- **A lost response renders `pendente`, never "falhou".** *No answer is not the same as not saved.*
- **`blocked` is retained, visible and honestly explained** — never a silent drop (FR-529/SC-514).
- **Success toasts fire only on a real 2xx.** Offline / lapsed / free never toast success.
- **Absence ≠ zero** — a line the payload lacks renders as nothing, never `R$ 0,00` (FR-507).
- **Export never fakes**: offline ⇒ disabled **with its reason**; pending ⇒ *"Sincronize para exportar."*; lapsed
  ⇒ denied honestly, **no partial artifact** (ADR-0020, FR-515).
- **The free calculator is untouched** (SC-507/SC-512) and the **IA does not change — no new nav tab** (FR-524).
- **All copy: honest, calm, pt-BR, no price, no availability date, no pre-E6 purchase CTA. "Cancelar" is banned —
  use "Voltar".**
