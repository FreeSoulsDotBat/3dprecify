# Quickstart — E1 pricing model validation

Runnable checks that prove E1 works end-to-end. Prereqs: `pnpm install`; Node 24; the 003 shell green.

## 1. Formula core (unit, test-first — the primary gate)

```bash
pnpm --filter @3dprecify/pricing-core test
```
Expected: all SC-001..SC-012 numeric cases green, coverage 100%. The anchor is **SC-001**:

| Line | Expected |
|---|---|
| material / energy / machine / falha / finishing | R$ 11,00 / 0,50 / 10,00 / 2,15 / 5,00 |
| **custo_total** | **R$ 28,65** |
| preço varejo / atacado | R$ 42,98 / 37,25 |
| marketplace anúncio varejo / atacado | R$ 59,98 / 52,81 |
| recebido líquido varejo / atacado | R$ 42,98 / 37,25 |

Key guards to eyeball in the test output: breakdown sums to `custo_total` (SC-002); `falha` is R$ 2,15 (10% of
material+energy+machine), **not** R$ 1,10 (SC-006); `machineHourRate` = 4.000/2.000 = R$ 2,00/h (SC-007);
`modelVersion === "2.0.0"` (SC-011).

## 2. Whole workspace gate

```bash
pnpm gate          # format + lint/boundaries + depcruise + typecheck + coverage
```
Expected: clean; `pricing-core` `package.json` version is `2.0.0` and the version-constant gate test passes.

## 3. Calculator UI (manual, on the running app)

```bash
pnpm dev           # Auth emulator + Vite dev server; open the Calcular tab (public, no sign-in)
```
Verify:
- Enter the SC-001 inputs → the breakdown + retail + wholesale render the table above; both prices always
  shown together (SC-010).
- Set a marketplace commission 20% + fixed fee R$ 5,00 → `preço para anunciar` and `recebido líquido` show for
  **both** varejo and atacado (SC-003); clear them → the marketplace lines disappear (no forced line).
- Leave labor/admin untouched → price unchanged; set labor 2 h × R$ 25/h → `custo_total` rises by exactly
  R$ 50,00 and only the labor line moves (SC-004).
- `avgPowerKw` pre-fills **0,12**; its tooltip explains "média real, não a potência de placa".
- Enter `rollWeightKg` 0 (or `machineLifetimeHours` 0, or commission 100) → a pt-BR validation message, never
  `NaN`/`Infinity`/`#DIV/0!` (SC-008).
- No tax/`imposto` field anywhere (FR-021); no save/export/history affordance and no paywall (SC-009, FR-035).

## 4. Free & offline (e2e)

```bash
pnpm e2e           # Playwright + Auth emulator against the production preview build
```
Expected: the `calculator.spec.ts` cases pass, including full-model compute, optional-0 isolation, marketplace
gross-up, no-bad-numbers guards, and **signed-out + offline** computation of retail/wholesale + breakdown.

## Definition of done (for the increment)

- [ ] SC-001..SC-012 all covered by `pricing-core` tests, written before the implementation.
- [ ] `pnpm gate` green; `pricing-core` at `2.0.0`; TD-020 (`parseDecimal`) retired via per-field validation.
- [ ] e2e calculator suite green (incl. free/offline + no-bad-numbers).
- [ ] Owner homologates the rendered calculator (values match SC-001; breakdown transparent).
