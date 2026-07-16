# Quickstart — E4 validation scenarios

How to prove E4 actually works, end to end. Prerequisites mirror E2/E3: Firebase emulator + backend on `:8100`
+ web preview on `:4173`, a premium grant via the operator CLI.

> ⚠️ **Before diagnosing any "flaky e2e", kill an orphaned preview server first.** A stale `vite preview` on
> `:4173` makes Playwright reuse a **frozen old build** — every "the fix doesn't work" measurement is old code
> (the E3 PR-C trap; `Get-NetTCPConnection -LocalPort 4173`).

## §1 — The frozen shelf (US1/US2 · SC-501)

1. Sign in with a **premium** account, compute a price, record it with a label.
2. **Fresh session / another device** → the entry is in the Histórico with label · total · **date**.
3. Reopen it → **every displayed line is byte-identical** to the recording moment, with **zero recomputation**.
4. Inspect the catalog → **nothing was materialized** (no product, no kit) — SC-505, the explicit contrast with
   E3's K3.

## §2 — The two-shelf rule (US3 · SC-502) — the epic's central promise

1. Record a snapshot from product P.
2. **Edit** P's filament cost → reopen the snapshot: values and total **unchanged**.
3. **Delete** P → reopen the snapshot: it is **fully intact**. There must be **no degraded caption, no warning,
   no "produto excluído" claim** — a snapshot has no degraded state because it depends on nothing. The captured
   origin name still displays; "abrir produto" is simply **not offered**.
4. Compare against a **kit** (E3) referencing the same product: the kit *does* degrade (D6, ADR-0017). **Both
   behaviours are correct** — that is the two-shelf rule, and this side-by-side is the homologation.

## §3 — Offline recording, the first offline write (US1 · SC-513/514 · ADR-0018)

1. Go **offline**. Record a snapshot → it appears **visibly pending** ("pendente neste dispositivo"). It must
   **never** claim to be saved.
2. **Restart the app while still offline** → the pending entry is **still there** (IndexedDB outbox, durable).
3. Go **online** → it syncs and flips to synced. **Exactly once** — no duplicate.
4. **The retry test that matters**: force a lost response (request lands, reply dropped). Retry ⇒ the same
   `clientSnapshotId` ⇒ the server returns the row it **already created** (200). **0 duplicates.**
5. **Two tabs** draining at once ⇒ still exactly one row.
6. **Delete-then-retry** ⇒ the snapshot must **not resurrect** (the soft-delete tombstone is inside the unique
   key).

## §4 — Entitlement at sync (FR-529 · SC-514)

1. Record offline. **Revoke premium** before it syncs. Go online.
2. The entry must become **blocked** — retained, visible, honestly explained ("não foi registrado — precisa de
   Premium ativo"), with **Tentar novamente** / **Descartar**. It must **never** be silently discarded, and never
   left claiming to be saved.
3. **Re-grant** premium → it retries automatically and lands.

## §5 — Immutability (US3 · SC-504 · ADR-0019)

1. `PATCH` a label → succeeds.
2. `PATCH` **any other field** (a value, the date, the model version) → **422**, never a silent ignore.
3. There is **no `PUT`** (machine-checked by the contract drift-guard).
4. **Direct DB proof** — the layer that makes SC-504 an invariant rather than a promise: `UPDATE snapshots SET
   headline_total = 1 WHERE id = …` → the trigger **raises**. Run this by hand; it is the whole point of the
   first PL/pgSQL in the project.
5. `ON DELETE` sanity: hard-deleting the origin product must **not** fail and must **not** touch the snapshot
   (there is no FK — ADR-0019 §5).

## §6 — Export (US4 · SC-506/515 · ADR-0020)

1. Premium + **online** → export a snapshot → the PDF carries items, quantities, price, date, validity and the
   seller's identification, and **zero internal cost lines**.
2. Enable "incluir detalhamento de custos" → **and only then** the breakdown appears.
3. A **kit** quote **itemizes every piece** (name + quantity) + total, still with zero cost lines.
4. **Lapse the account** → export is **denied**, with **no partial artifact**, while the snapshots stay readable
   in-app (FR-515/517 — the owner's harder rule).
5. **Offline** → the export affordance is **disabled with its reason** ("exportar precisa de conexão"). Never a
   fake success.
6. A **pending** snapshot → **not exportable** until it syncs ("sincronize para exportar").
7. CSV rows equal the stored snapshots **exactly** — same values, same rounding, same dates (no re-derivation).

## §7 — "Recalcular hoje" (US3.4 · FR-505)

1. On a snapshot whose origin still resolves, hit **Recalcular hoje** → a **NEW** entry is created from **today's
   catalog values**; the original is **untouched**.
2. Raise the filament price first, then recalculate → the new entry must be **higher**. *(This is the test that
   proves the re-resolve semantics: repricing frozen inputs could never answer "sim" to a price rise.)*
3. Where the origin **no longer resolves** → the recalculation is offered from the frozen inputs and **says so**
   — it must not silently present a frozen-input reprice as catalog-current.

## §8 — The honest door (US5 · SC-507)

Signed out / free: the Histórico tab **explains** honestly (never a broken list, never a fabricated sample entry);
"salvar" / "exportar" show the teaser — nothing persists, **no artifact is generated**, no fake success, no price,
no date, no pre-E6 purchase CTA. The **free calculator is untouched**.

## §9 — Regression (SC-512)

All E1/E2/E3 guarantees pass unchanged: the free calculator, catalog live-recompute, kit D3 live-reflect + D6
degradation, and the entitlement gate. **E4 adds a shelf; it does not alter the existing ones.**
