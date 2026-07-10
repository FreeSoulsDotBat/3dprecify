# PR-C homologation record (T033 QA half) — 007-e2-catalog-entitlement

## Claude/QA homologation run (2026-07-10)

Independent qa-produto-style drive of the PR-C surfaces (US6 products + US7 teaser) against the
REAL stack — compose Postgres (5433, dedicated `precifica3d_homolog` DB, Alembic `0001`), FastAPI
via `scripts/run_e2e_server.py` on 8100, Firebase Auth emulator on 9099, `vite preview` of the
emulator-mode build on 4173. Role-selector-driven, every state screenshotted at 390×844.

### Checks — PASS (after one bug fix, below)

| Surface | Result |
|---|---|
| Signed-out Catálogo tab → honest teaser (crown, no price/date, Entrar + Entendi, "continuam grátis") | PASS |
| Signed-out calculator "Usar do catálogo" slot → same teaser; manual calc untouched (SC-310) | PASS |
| Premium: product full-page create — name + two pickers + calculator body | PASS |
| **SC-305 on the product page**: picking PLA Azul + Ender 3 recomputes **R$ 26,48** (byte-identical) | PASS |
| Save → "Produto salvo." toast → lands back on the Produtos tab (`?tab=products`) | PASS |
| Product row summary = "PLA Azul · Ender 3" (reference names, **never a price**, FR-310) | PASS |
| Reopen recomputes live (R$ 26,48 from `computeFromForm`, no stored price) | PASS |
| Referenced-filament delete → confirm warns "usado em 1 produto(s)… manterão os últimos valores" | PASS |
| Degraded reopen: calm info alert + "— Manual —" picker + editable last-known values (US6-4) | PASS |

Console/pageerror during the drive: **0**.

### Bug found + fixed (the reason homologation exists)

**`ck_products_filament_link_or_snapshot` rejected a material-less last-known snapshot.** Deleting a
referenced filament that had **no material** (an optional label — `filaments.material` is nullable)
made the D6 degradation UPDATE write `filament_material = NULL` alongside the pricing snapshot, which
violated the CHECK's `filament_material IS NOT NULL` clause → the DELETE 500'd and the UI honestly
surfaced "Criar e editar precisam de conexão." The unit tests missed it because they always set a
material. **Fix:** the snapshot's load-bearing fields are the pricing inputs only —
`filament_id IS NOT NULL OR (filament_cost_per_roll IS NOT NULL AND filament_roll_weight_kg IS NOT
NULL)` — material is a display label, not required for a valid snapshot. Changed in the model +
migration `0001` (dev DBs recreated) with a failing-first regression test
(`test_material_less_filament_degrades_cleanly`). Re-drove the whole flow: clean.

## Owner homologation (2026-07-10)

Owner (Jonatan) **homologated PR-C** on 2026-07-10 after driving the running app himself
(`http://localhost:4173`, real stack) — including the owner beta-grant walk: the owner granted
premium to his own throwaway account through the operator CLI (`grant-premium grant
raccoon.panda.934@example.com --source beta`) and exercised the premium surfaces. Teaser copy
ratified. **"homologado, pode continuar"** authorized the PR-C ship (T035).

> **Owner caveat carried forward (as on PR-B):** further homologation rounds MAY be required as
> development unfolds — this sign-off covers the PR-C scope only, not future increments.

Screenshots are session artifacts (scratchpad), not committed — 005/PR-B evidence pattern.
