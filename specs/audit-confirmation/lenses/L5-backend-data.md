# Lens 5 — Backend routers / data / migrations (post-013 + post-E6)

Scope: `backend/app/validation.py` + 5 consumers, the `owner_uid` predicate class (E2-03),
`alembic/versions/` (0001–0005), `main.py` CORS, `app/billing/`, and the merged contract.
Verdict: **CLEAN**. Every 013 remediation and every E6 addition is present, coherent, and
test-guarded. No defect found. One latent-invariant note (INFO) recorded below.

Legend: `[VERIFICADO]` = read the code/artifact directly; `[INFERIDO ~X%]` = reasoned, not run.

---

## F5-01 — validation.py fully adopted; ceilings routed correctly `[VERIFICADO]` — severity: NONE (confirmation)

`backend/app/validation.py` is the single home of `finite_non_negative` / `reject_bad_leaves` /
the `CEIL_*` table, and it is a dependency-free leaf (imports nothing from `app.*`, docstring
L9-12, import-linter contract).

Grep for `_CEIL_|_finite_non_negative|_reject_bad_leaves|def finite_non_negative|def reject_bad_leaves`
across `backend/app/api/` returns only two benign hits: `products.py:128` is a *validator method*
name (`_all_finite_non_negative`) that delegates to the shared `finite_non_negative`, and
`scenarios.py:140` is a test-name comment. **No router kept a local copy.** All five consumers
import from `app.validation`:
- `filaments.py:35`, `printers.py:30`, `products.py:38-47`, `history.py:59`, `boms.py:69`, `scenarios.py:71`.

Two-ceiling split is correct and deliberate (Q-04):
- `history.py:157` passes `reject_bad_leaves(..., money_ceiling=CEIL_MONEY)` (10**10 — leaves land in `Numeric(12,2)`).
- `scenarios.py:141` passes `money_ceiling=CEIL_CONFIG_LEAF` (10**12, deliberately wider — pure intent, no column).
- Asserted by `test_VR602_the_config_ceiling_is_CEIL_CONFIG_LEAF_not_CEIL_MONEY`.

E3-01 / E3-02 / D4 all confirmed in `boms.py`:
- `BomLineIn.tariffPerKwh` → `finite_non_negative(v, "tariffPerKwh", CEIL_RATE)` (`boms.py:105-112`) — 422, not the old opaque 500.
- `BomLineIn.quantity` → `CEIL_QUANTITY` (2 147 483 647, inclusive) (`boms.py:92-103`) — 422, not `integer out of range` 500.
- `BomIn.lines = Field(min_length=1)` (`boms.py:180`), and the wire delta is preserved: `contracts/openapi.json:3284-3297` shows `BomIn.lines.minItems: 1` **and** `lines` in `required`.

## F5-02 — owner_uid predicate: E2-03 fixed, no siblings `[VERIFICADO]` — severity: NONE (confirmation)

`products.py::_live_links` (`products.py:413-443`) now scopes BOTH batch lookups by owner:
`select(Filament).where(Filament.id.in_(fil_ids), Filament.owner_uid == uid)` and the Printer twin.
This is the E2-03 fix (the one read-path query previously keyed by id alone).

Swept every other resolve/list path for the same class — **all id-keyed queries carry `owner_uid`
(+ `deleted_at IS NULL`)**:
- `products`: `_owned`, `_resolve_filament`, `_resolve_printer`, `list_products` — all scoped.
- `boms`: `_owned`, `_resolve_product`, `_dedup_match`, `_resolve_views` (`boms.py:346-356`) — all scoped.
- `scenarios`: `_owned`, `_resolve_product_last_known` (`:320-328`), `_resolve_kit_last_known` (`:351-355`), `list_scenarios` — all scoped.
- `history`: `owned_snapshot`, `list_history`, `record_snapshot` read-back — all scoped.
- `export.py`: uses `owned_snapshot` + an owner+deleted-scoped list — confirmed scoped.

The **only** id-alone queries in the whole surface are the `BomLine` lookups keyed by `bom_id`
(`boms.py::_lines_of :260-267`, `_lines_by_bom :368-385`). These are **not** a leak: `BomLine` has
no `owner_uid` column by design (models docstring §L402 — "ownership comes from `boms`"), and every
caller owner-verifies the parent `Bom` first (`_rendered`/`get_bom`/`update_bom`/`delete_bom` via
`_owned`; `list_boms` derives ids from an owner-scoped query; **`scenarios.py::_resolve_kit_last_known`
owner-checks the `Bom` at `:351-355` before calling `_bom_lines_of`**). Safe by construction today.

## F5-03 — INFO: BomLine authorization is a parent-derived invariant `[VERIFICADO]` — severity: INFO

`_lines_of` / `_lines_by_bom` are correct only because every current caller pre-authorizes the
parent `Bom`. This is an invariant, not a local guard — a future direct `BomLine` query (or a new
caller that forgets the parent check) would silently cross tenants. Fix direction (optional
hardening, not a bug): a one-line docstring on `_lines_of` stating "callers MUST have owner-verified
`bom_id`", or a join to `Bom.owner_uid`. No action required for this audit.

## F5-04 — migration chain: single head, clean round-trip, correct drop order `[VERIFICADO]` — severity: NONE (confirmation)

Linear chain, single head:
`0001 (down=None) → 0002 → 0003 → 0004 → 0005 (down_revision="0004")`.
- `0005_e6_billing.py:45-46`: `revision="0005"`, `down_revision="0004"` — chains to the prior head.
- Single-head is guaranteed operationally: `test_migrations.py::test_full_downgrade_to_base_then_reupgrade_to_head_round_trips_cleanly`
  runs `command.upgrade(cfg, "head")` against a real Postgres — alembic errors on multiple heads,
  so a green run *is* the single-head assertion. It also exercises the full
  upgrade→downgrade→re-upgrade round trip (013 T051 / finding T-01, the FK+trigger drop-order class).
- `0005.downgrade()` order is correct (child before parent): drop the `entitlement_grants` FK +
  column + restore its 2-value CHECK, then drop `billing_events` (holds FK→`subscriptions`), then
  `subscriptions`. No trigger/function is introduced or dropped in 0005 (the 0003 `DROP FUNCTION`
  pair is the one the round-trip test explicitly guards).

## F5-05 — E6 tables honor the ADR-0023 schema; ORM mirrors migration `[VERIFICADO]` — severity: NONE (confirmation)

`subscriptions` (`0005:54-111`, ORM `models:770-828`):
- **No money/card column** (VR-701/SC-706) — references only.
- CHECK enums `provider` / `plan_period` / `status` (incl. `grace`, FR-708).
- `mp_preapproval_id` UNIQUE but nullable (future Play row).
- Partial-UNIQUE `uq_subscriptions_one_active` on `owner_uid` WHERE
  `status IN ('pending','authorized','grace','paused') AND deleted_at IS NULL` (SEC-604) — the ORM
  `Index(...postgresql_where=...)` (`models:798-805`) mirrors the migration's `postgresql_where`
  byte-for-byte.

`billing_events` (`0005:114-140`, ORM `models:831-864`): `event_key` UNIQUE (exactly-once inbox),
`kind` CHECK enum, FK→`subscriptions`, `raw` JSONB (no money leaf).

`entitlement_grants` additive extension (`0005:142-164`): source CHECK widened
`('beta','comp') → ('beta','comp','payment')` recreated under the same name; nullable
`subscription_id` FK→`subscriptions`. ORM matches (`models:99, 116-117`). `read_entitlement_state`
untouched — a payment grant is just another ledger row.

## F5-06 — CORS restriction does NOT starve the webhook `[VERIFICADO]` code / `[INFERIDO ~95%]` runtime — severity: NONE (confirmation)

`main.py:82-99` (F-04): `allow_methods=[GET,POST,PUT,PATCH,DELETE]`,
`allow_headers=[Authorization,Content-Type,Accept]`, `expose_headers=[CORRELATION_HEADER, Content-Disposition]`.

The Mercado Pago webhook (`POST /api/v1/billing/webhook/mercadopago`) is **server-to-server**: CORS
is a *browser*-enforced policy keyed on an `Origin` header and preflight; MP sends neither, so
`allow_methods`/`allow_headers` never gate it. Its auth headers (`x-signature`, `x-request-id`) are
read straight off the `Request` (`billing.py:83-87`) regardless of CORS. `POST` is allowed anyway.
The browser-facing `POST /billing/checkout` sends `Authorization` + `Content-Type` — both permitted.
`X-Correlation-Id` is still exposed. No route needs an excluded method (OPTIONS is answered by the
middleware, not dispatched). **Failure scenario: none.** Latent-only note: if a future billing
response ever needs the browser to READ a custom header, it must be added to `expose_headers` — not
a current gap.

## F5-07 — billing layering respected; grant is genuinely atomic `[VERIFICADO]` — severity: NONE (confirmation)

import-linter `api → billing → models`: no `app/billing/*` module imports `app.api`. The only
`app.api.billing` string is a **docstring** in `billing/__init__.py:6`. billing modules import
`app.models` / `app.entitlement` / `app.settings` and sibling billing modules only
(`grant_writer`, `checkout`, `reconcile`, `events`, `signature`, `providers/mercadopago`).

`grant_writer.process_verified_event` (`grant_writer.py:63-92`) atomicity: the inbox insert
(`pg_insert(BillingEvent).on_conflict_do_nothing(event_key).returning(id)`), the `EntitlementGrant`
add, and the `sub.status`/`current_period_end` update all occur before a **single**
`await session.commit()`. Exactly-once: the loser of a concurrent race gets `inserted=False`
(0 rows returned), writes nothing, returns `granted=False`. Inbox and grant commit together or not
at all (VR-702). Checkout (`checkout.py`) uses the same discipline: app-level SEC-604 pre-check +
DB partial-unique backstop with `IntegrityError → rollback → CheckoutConflict`.

## F5-08 — contract in sync `[VERIFICADO]` — severity: NONE (confirmation)

`contracts/openapi.json` contains `/api/v1/billing/webhook/mercadopago` (:3135),
`/api/v1/billing/checkout` (:3176), and `BomIn.lines.minItems: 1` (:3289) — the merged contract
reflects BOTH the 013 `min_length` delta and the E6 endpoints. The CI drift-guard remains the
enforcing backstop; the committed artifact is already correct.

---

## Return-value summary

- **Missing `owner_uid` predicate elsewhere (E2-03 class): NONE.** `_live_links` is fixed; every
  other id-keyed query is owner+deleted scoped. The only id-alone queries are `BomLine`-by-`bom_id`,
  safe because `BomLine` has no owner column and the parent `Bom` is always owner-verified first
  (recorded as an INFO invariant, F5-03).
- **Migration chain / head integrity: YES.** Single linear head 0001→0005; 0005 chains to 0004;
  round-trip + drop-order guarded by `test_migrations.py`.
- **validation.py fully adopted: YES.** No local `_CEIL_*` / validator copies survive; both ceilings
  routed to the right callers; E3-01/E3-02/D4 all confirmed on the wire.
- **CORS starves the webhook: NO.** MP is server-to-server; CORS is browser-only. POST allowed,
  signature headers read directly, correlation id still exposed.
- **The one thing the owner must know:** the backend data layer is clean and internally coherent
  post-merge — E6 (0005 + billing/) sits additively alongside the 013 fixes with zero conflict, the
  grant terminus is atomic and exactly-once, and no cross-account or overflow-to-500 hole remains.
  The single residual is a design *invariant* (F5-03), not a defect.
