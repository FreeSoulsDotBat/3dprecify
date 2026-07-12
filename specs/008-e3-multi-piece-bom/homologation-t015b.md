# Homologation — T015b + T017b (PR-B) · VISUAL homologation of kit save / round-trip / manage / lapse

- **Date**: 2026-07-12
- **Feature**: 008-e3-multi-piece-bom, PR-B (kit persistence — US2/US4/US6, K3/K4, ADR-0017)
- **Level**: WIREFRAME/behavior homologation (structure · states · honest copy · live recompute · 390px
  no-overflow). Pixel-final polish is a later Claude Design pass — NOT judged here.
- **Account used**: `qa-kit-1783826665178@e2e.local` (throwaway, Auth emulator). Premium granted, revoked and
  re-granted through the REAL operator CLI (`app.scripts.grant_premium`, ADR-0012) →
  `rJXoLEnWj5W54HBWNwFAqu8wmdsk`. Free check on a second throwaway (`qa-free-…`).
- **Stack**: web `http://localhost:4173` (`vite build` + `preview`, emulator env), API `http://localhost:8100`
  (real FastAPI + Postgres), Firebase Auth emulator `:9099`. **DB**: a FRESH `precifica3d_qa` database created
  for this run and migrated with `alembic upgrade head` (0001→0002) — see the environment finding **E1** below,
  which is why the pre-existing dev DB could NOT be used.
- **Browser**: Playwright (Chromium, persistent profile) driven headless with screenshots — no Playwright MCP was
  registered in this session, so the browser was driven directly. No app/code change.
- **Viewports**: mobile 390×844 first (primary), then desktop 1280×800.
- **Code state**: `feature/008-e3-pr-b` @ `7cd8703` ("the lapsed CREATE door is a calm panel…") — the lapse
  behavior homologated below is the CURRENT one (the coordinator's mid-run correction), not the earlier brief.
- **Evidence**: `specs/008-e3-multi-piece-bom/evidence/t015b/`

## Overall verdict: **PASS-with-nits — 2 items should be fixed before merge**

Everything T015b and T017b claim is really built and behaves honestly in the rendered app: the save writes only on
a real 2xx, the materialization is said out loud (created vs referenced + values-superseded), **no price is ever
stored** (reopen recomputes — and provably re-prices when the referenced product changes), the K3 attention state
appears and clears exactly per SC-412, manage (rename/duplicate/delete) is complete, and the new lapse split is
exactly as specified — nothing deleted, reads work, save denies honestly with no fake success.

Two defects are worth blocking on, both introduced by this slice:
1. **F1 (honesty-critical)** — a product *born manual* from a kit save is told "O filamento vinculado foi
   removido." / "A impressora vinculada foi removida." It never had a link. The app states a history that did not
   happen.
2. **F2 (data integrity)** — a second tap on "Salvar kit" after a successful save creates a **duplicate kit**
   (the composer stays in create mode).

No uncaught JS errors anywhere. The only 4xx seen are intentional (free identity's catalog reads → 403; the
lapsed `PUT /api/v1/boms/{id}` → 403).

---

## Per-item verdicts

### A. Save flow at `/kits` (premium) — PASS
`/kits` mounts the composer for `active` (server-informed guard, `GET /api/v1/entitlement` 200). Empty state
"Monte seu kit peça por peça" + "+ Adicionar peça" (`01-empty-composer-390.png`).
- Adding a line reveals, inside the line card, the **"Nome da peça no catálogo"** `Field` (placeholder =
  `Peça 1 · {nome do kit}`, live-updating with the kit name), and below the assembly summary the **"Nome do kit"**
  `Field` (required) + **"Salvar kit"** (`02-line-added-full-390.png`, `03-save-panel-390.png`).
- Salvar → real `201 POST /api/v1/boms` → success toast **"Kit salvo."** (only on the 2xx) and the honest
  materialization panel: **"O que este kit fez no seu catálogo"** → **"Peça 1 · Kit Fundo QA — criado no
  catálogo"** + **"Ver meus kits"** (`05b-panel-at-scroll-bottom-390.png`).
- Reference path (2nd kit, piece named after an existing product): **"Peça 1 · Kit Vitrine QA — já existia no
  catálogo, referenciado"** + the `Alert` **"As peças referenciadas usam os valores do produto que já estava
  salvo, não os que você digitou aqui."**; the catalog does **not** grow a duplicate (`Peça 1 · Kit Vitrine QA`
  rows = 1) — SC-411 holds (`13-dedup-referenced-390.png`).
- **Multi-piece kit** (2 ad-hoc lines, second premium account `qa-multi-…`): both pieces materialize and BOTH are
  announced — "Peça 1 · Kit Duas Peças QA — criado no catálogo" + "Peça 2 · Kit Duas Peças QA — criado no
  catálogo"; the rollup reads "2 peça(s) somaram neste canal" and the Kits row reads "2 peça(s)"
  (`29-multi-piece-save-390.png`).
- "Ver meus kits" routes to `/catalogo?tab=kits`. No horizontal overflow at 390 (390 = 390) on any of these.
- Nit **F4**: the success toast is bottom-anchored and **covers the materialization panel it announces** for
  ~5 s — the panel title and its first line sit right under it (`04-saved-toast-panel-390.png` /
  `04b-toast-over-panel-390.png`). Once dismissed everything is reachable above the nav (`05b`).

### B. Round-trip — no stored price (FR-407) — PASS
- `/catalogo?tab=kits` — the **4th tab** lists the kits, each row: name + **"N peça(s)"**, **zero money** on the
  surface (regex-checked: no `R$` in `main`) (`06-catalog-kits-tab-390.png`, `14-kits-tab-manage-390.png`).
- Reopening (`/kits?id=…`) restores the inputs and **recomputes** the same money (custo `R$ 20,60`, varejo
  `R$ 30,90`, atacado `R$ 26,78`), kit-name field re-hydrated (`07-reopened-kit-390.png`).
- Strongest evidence that nothing is stored: after linking the referenced product to a saved filament (PLA QA,
  R$120/1 kg) + printer (Ender QA, 0,1 kW), reopening the SAME kit re-prices to **R$ 22,50 / 33,75 / 29,25** —
  the kit follows the live catalog, it does not replay a frozen number (`16-duplicate-composer-390.png`).
- Nit **F3**: the reopened line header reads **"Peça 1 · Peça 1 · Kit Suporte QA"** — the card prefixes
  `Peça {n} ·` onto a stored `pieceName` that already contains that prefix.

### C. K3 attention indicator (SC-412) — PASS
- Produtos tab: each materialized piece shows `manual · manual` + the calm line **"Vincule um filamento e uma
  impressora salvos"** (`08-produtos-attention-390.png`).
- Product page: the same line as an `Alert tone="info"` at the top (`10-product-attention-born-manual-390.png`).
- Linking **only** the filament → the line **stays** (`11-product-partial-link-390.png`); linking the printer too
  → it **clears live, before saving** (`12-product-both-linked-390.png`). Saving persists it: the row then reads
  `PLA QA · Ender QA` with no attention line.
- **F1 (defect, honesty-critical)** — see the finding list: the same product page ALSO shows two false alerts.

### D. Manage (US4) — PASS
- **Rename**: row → reopen (`/kits?id=…`) → edit "Nome do kit" → Salvar → `200 PUT /api/v1/boms/{id}`; the list
  shows "Kit Fundo QA renomeado" and the kit count does **not** grow (`15-rename-saved-390.png`).
- **Duplicate**: the copy icon opens `/kits?id=…&copy=true` with the composer pre-filled and the name
  **"Kit Suporte QA (cópia)"**; **nothing is written** until the seller saves (kit count unchanged) —
  `16-duplicate-composer-390.png`.
- **Delete**: trash icon → confirm `Dialog` **EXCLUIR "KIT SUPORTE QA"?** / "Esta ação não pode ser desfeita." /
  **Voltar** + **Excluir** (no "cancelar" — FR-014 honored) → row removed (4 → 3) and the **materialized products
  survive** the kit deletion, which is correct (`17-delete-confirm-390.png`, `18-after-delete-390.png`).
- Row actions carry accessible names ("Editar/Duplicar/Excluir {kit}"); icon buttons are 52×44 px.

### E. LAPSE read-only state (current behavior, T017b) — PASS
Premium revoked via the operator CLI → `status = lapsed`.
- **Create door** (`/kits`, no `?id=`): a calm `Alert tone="info"` **"Premium pausado" / "Seus kits salvos
  continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium."** + a
  **"Ver meus kits"** button. Verified: **0 composer** ("Adicionar peça" count 0), **0 "Salvar kit"**, **0 teaser**
  — no fake affordance, no teaser for someone who owns data (`19-lapse-create-door-390.png`).
- **Kits list still readable** while lapsed (3 kits) (`20-lapse-kits-list-390.png`).
- **Reopen** (`/kits?id=…`): the composer mounts, recomputes normally (R$ 20,60), and carries the banner
  **"Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo."**
  (`21-lapse-reopen-banner-390.png`).
- **Save denies honestly**: "Salvar kit" stays visible and enabled (never disabled-and-silent); tapping it hits
  the server → `403 PUT /api/v1/boms/{id}` → **"Salvar faz parte do Premium."** and **no success toast**
  (`SUCCESS TOAST LEAK? 0`) (`22-lapse-save-denied-390.png`).
- **Nothing deleted** — DB truth after the lapse: the only non-live kit is the one I deliberately deleted
  (`select name, deleted_at is null from boms` → `Kit Suporte QA | f`, the other three `t`).
  Re-granting restores writes with the data intact (`23-lapse-nothing-deleted-390.png`).
- Nit **F5**: the denial renders as `Alert tone="danger"` (red) — everywhere else the lapse speaks in the calm
  info tone the ux §3 asks for ("calmo, nunca punitivo").

### F. Free (`none`) — teaser unchanged — PASS
A never-granted throwaway at `/kits` still gets the honest teaser ("Monte e precifique kits com várias peças" …
"A calculadora de peça única continua grátis." → only **Entendi**). No price, no date, no purchase CTA, no
composer, no "Salvar kit" (`28-free-teaser-390.png`). The lapse refactor did not leak the composer to free users.

### G. Desktop pass (1280×800) — PASS
Left-sidebar shell; the save panel, the Kits tab and the Produtos attention state all render correctly with no
horizontal overflow (1280 = 1280) (`24-desktop-save-panel-1280.png`, `25-desktop-kits-tab-1280.png`,
`26-desktop-produtos-attention-1280.png`). Single narrow column with wide right whitespace — the same deferred
§1.1 two-column opportunity noted in the PR-A homologation, not a PR-B regression.

### H. Console + network — PASS (no BOM defects)
- **Zero uncaught JS errors** across every step.
- 4xx seen, all intentional: `403` on `/api/v1/filaments|printers` for the free identity (pre-grant reads on
  `/calcular`), and `403 PUT /api/v1/boms/{id}` for the lapsed save (that IS the boundary).
- Wire behavior: `201 POST /api/v1/boms` on create, `200 PUT` on rename, `200 GET /api/v1/boms` on list/reopen,
  `200 PUT /api/v1/products/{id}` when linking the refs. No unexpected 5xx on the correctly-migrated DB.
- Mobile 390: `scrollWidth == clientWidth == 390` on every kit surface (composer, save panel, kits tab, produtos,
  lapse panel, teaser).

---

## Ranked findings

### Should be fixed before merge

1. **F1 — A born-manual product is told its filament/printer "foi removido" (fabricated history).**
   *Honesty-critical (Principle II).* Opening a product that a kit save materialized shows THREE alerts: the true
   K3 one ("Vincule um filamento e uma impressora salvos") **and** "O filamento vinculado foi removido. Mantivemos
   os últimos valores — edite se precisar." + "A impressora vinculada foi removida. …". Nothing was ever removed —
   the product was born manual. Evidence: `09-product-page-attention-390.png`,
   `10-product-attention-born-manual-390.png` (probe: `degraded 'foi removid' alerts on a BORN-MANUAL product
   (expect 0): 2`).
   Root cause — `apps/web/src/pages/catalogo/produto-page.tsx:133-134`:
   ```ts
   const degradedFilament = Boolean(editing) && initial?.filamentId === "" && filamentId === "";
   const degradedPrinter  = Boolean(editing) && initial?.printerId  === "" && printerId  === "";
   ```
   Before E3 every product was created WITH refs (FR-310), so "no ref ⇒ it was severed" was true. K4
   materialization breaks that premise: it creates ref-less products by design.
   Minimal fixes (dev's call): (a) drop the two "foi removido" alerts and let the single unified K3 line carry
   the state — which is exactly what T015d/SC-412 asked for ("one honest state … the same remedy, so the same
   words"); or (b) carry a real signal on the wire that distinguishes "link severed" from "born manual" and gate
   the degraded copy on it. Confidence this is a real defect: **~95%**.

2. **F2 — A second tap on "Salvar kit" creates a duplicate kit.**
   *Data integrity / no-surprise.* After a successful create the composer stays in CREATE mode (URL remains
   `/kits`, `editing` is undefined), and the button re-enables. Probe: two taps on the same "Salvar kit" →
   **2 rows "Kit Duplo QA"** in the Kits tab (`27-double-save-probe-390.png`). A double-tap is entirely plausible
   on mobile, and the seller has no idea a second kit was written.
   Minimal fix: on a 2xx create, navigate to `/kits?id={saved.id}` (so any further save is the PUT edit path the
   rename flow already uses) — `apps/web/src/pages/bom/bom-page.tsx` `save()`. Confidence: **~90%**.

### Nits (post-merge / Claude Design pass)

3. **F3 — Double "Peça N ·" prefix on reopen/duplicate.** The line header reads "Peça 1 · Peça 1 · Kit Suporte
   QA" because the saved `pieceName` already carries the `Peça {n} · {kit}` default and `BomLineCard` prefixes it
   again. Evidence: `07-reopened-kit-390.png`, `16-duplicate-composer-390.png`. Cosmetic, but it is the first
   thing the seller reads on a reopened kit.
4. **F4 — The success toast covers the materialization panel it announces** (~5 s). Evidence:
   `04-saved-toast-panel-390.png`. Consider anchoring the toast above the panel, or scrolling the panel into view
   on success.
5. **F5 — The lapsed save denial is red (`tone="danger"`).** Every other lapse surface is calm info. The lapse is
   not an error state; consider `tone="info"` for `apiError.entitlementRequired` in this context
   (`22-lapse-save-denied-390.png`).
6. **F6 (pre-existing, not E3) — `/catalogo?tab=printers` silently lands on Filamentos.** The tab init in
   `apps/web/src/pages/catalogo/catalogo-page.tsx:88-91` only maps `products` and `kits`; anything else falls back
   to `filaments`. A deep link/bookmark to Impressoras shows the wrong panel with no hint.
7. **F7 — Kit row name button is 144×42 px** (2 px under the 44 px target); the three action icon buttons are
   52×44 (ok). Trivial.
8. **F8 — The K3 line on the Produtos list is styled exactly like the metadata line** ("manual · manual") — same
   muted text, no icon/tone. It is calm and honest, but low-salience for something that asks the seller to act.
   A subtle info tone/icon would help (design pass). Evidence: `08-produtos-attention-390.png`.
9. **F9 — A server 5xx reads to the user as "Criar e editar precisam de conexão."** Observed while the stale DB
   (E1 below) made `POST /api/v1/boms` return 500: the response carries no CORS headers (Starlette's error
   handler sits outside `CORSMiddleware`), so the browser reports a network failure and `honestWriteError` maps it
   to the offline copy. A server error is not a connection problem — worth a follow-up so a real 5xx says
   something true.

---

## Environment findings (not product defects — but they cost this homologation a full cycle)

- **E1 — The dev database `precifica3d` (host 5433) is stamped `0002` but carries a PRE-EDIT constraint.**
  Its `ck_products_filament_link_or_snapshot` still reads
  `filament_id IS NOT NULL OR (filament_material IS NOT NULL AND filament_cost_per_roll IS NOT NULL AND …)`,
  while migration `0001` in the tree (edited in place at the 2026-07-10 homologation — "a material-less filament
  degrades cleanly") now reads `filament_id IS NOT NULL OR (filament_cost_per_roll IS NOT NULL AND
  filament_roll_weight_kg IS NOT NULL)`. Consequence: on THAT database **every ad-hoc kit save 500s**
  (`psycopg.errors.CheckViolation` on the materialized product, which has no `filament_material`). A freshly
  migrated database (`alembic upgrade head`) has the correct constraint and the whole flow works — which is why
  CI/e2e (they recreate `precifica3d_e2e` every run) never saw it.
  **Action**: the owner's local `precifica3d` DB should be recreated (or the constraint fixed by hand) before the
  next manual test, or it will keep producing phantom "save is broken" reports. This homologation ran against a
  fresh `precifica3d_qa`.
- **E2 — No Playwright/Chrome-DevTools MCP is registered in this session**; the browser was driven directly with
  the workspace's Playwright (persistent Chromium profile). Same fidelity, but the T006b note about the MCP no
  longer applies.

---

## What was NOT covered here

- The degraded catalog-ref line (product deleted after save, US3/PR-C) — out of PR-B scope.
- Offline save behavior (airplane mode → "Criar e salvar precisam de conexão.") — not exercised; F9 above shows
  the same copy is currently the fallback for any unreachable/5xx response.
- Atomicity of a partially-failing materialization (a failing line materializes NOTHING) — covered by the T010
  backend suite; not reachable through the UI (the composer blocks a save with invalid lines via
  `saveInvalid` = "Confira as peças com aviso antes de salvar.").
