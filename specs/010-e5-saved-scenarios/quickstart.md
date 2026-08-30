# Quickstart — E5 validation scenarios

How to prove E5 actually works, end to end. Prerequisites mirror E2/E3/E4: Firebase emulator + backend on
`:8100` + web preview on `:4173` (dedicated ports — another project squats 5173/8000), compose DB migrated to
`0004`, a premium grant via the operator CLI. Decided parameters (owner, 2026-07-19): name ≤120 · note ≤500 ·
`config` cap 256 KB → honest 422 · list ordering `created_at DESC` · accent-sensitive search.

> ⚠️ **Before diagnosing any "flaky e2e", kill an orphaned preview server first** (`Get-NetTCPConnection
> -LocalPort 4173`) — a stale `vite preview` makes Playwright reuse a frozen old build (the E3 PR-C trap).
> And **reach detail views via client-nav, never `page.goto` a 2-segment deep link** (the `base:'./'` trap).

## §1 — Save the what-if (US1 · SC-601/604/606)

1. Sign in **premium**, configure the multi-channel calculator (2+ channels, one explicit fee override, an
   itemized "Outros custos", the framing toggle on), save it as a scenario with a name + note.
2. **Fresh session / another device** → it appears in the scenarios list (name · note · last-updated, newest
   saved first) and reopens with the **full configuration restored** and prices **recomputed live**.
3. As **free / signed-out** (and with a locally-faked premium flag): every save/list/read call is denied
   `ENTITLEMENT_REQUIRED` server-side; nothing persisted, nothing readable.
4. Inspect the catalog → **nothing was materialized** (no product, kit, filament, printer) — the explicit
   contrast with E3's kit-save.

## §2 — The LIVE contract, the mirror of E4's two-shelf rule (US3 · SC-602/603)

1. Save a scenario whose cost basis references product P; note the displayed price.
2. **Edit** P's filament cost → reopen: the scenario **reflects the new cost** (D3 — the exact opposite of an
   E4 snapshot, which must not move; run both side-by-side, that contrast IS the homologation).
3. **Delete** P → reopen: the scenario **degrades to last-known editable values** with the honest E2/E3
   caption — never blank, never "removido", still priceable + re-saveable (D6, lossless via the re-snapshot
   on every save).
4. Refresh the fee catalog to a changed commission → reopen: the **non-overridden** slot re-resolves to the
   new fee; the **overridden** slot keeps the seller's number with the "ajustado por você" seal.
5. The reopened view presents **today's** numbers with **no frozen date**.

## §3 — Offline read, online-only writes (US2 · SC-610)

1. Load the scenarios list online once; go **offline** → the list and every scenario stay readable and
   re-openable from the uid-keyed cache; a stale cached fee reference shows the 005 staleness seal (never
   stale-as-live).
2. Attempt a **save offline** → an **honest failure** (no silent drop, no fake "salvo!", no pending queue —
   the deliberate contrast with E4's outbox).
3. **Sign out** → the scenarios cache is purged; another account sees none of it.

## §4 — Duplicate-to-tweak (US4 · SC-605)

1. Duplicate a scenario → an independent copy (own id, own name).
2. Change one channel / one override / the framing on the copy → it recomputes independently; the original is
   **byte-for-byte unchanged** (and vice versa).

## §5 — Honest teaser (US5 · SC-607)

Free/signed-out: "Salvar cenário", the scenarios surface and "Duplicar" are visible and open the honest
premium notice — no price, no date, no fake success, no fabricated sample scenario, no pre-E6 purchase CTA.
The free 005 calculator is untouched.

## §6 — Manage + lapse (US6 · SC-608/609)

1. Rename (PATCH), edit the whole config (PUT full-replace), search by name (accent-sensitive, owner-scoped),
   soft-delete — all persist per-account; account B sees a 404 indistinguishable from non-existent, even with
   a guessed id.
2. **Revoke premium** → every scenario stays readable **and recomputable** (recompute is a read); every write
   is denied; **zero** rows deleted or modified. **Re-grant** → writes return with data intact.

## §7 — The E4 bridge (US7, P3 — only if it ships · SC-611)

Record a snapshot from a scenario's live result → an immutable E4 snapshot **byte-identical** to the displayed
computation, with informational provenance ("originou-se do cenário X"); a later catalog/fee change alters 0%
of the snapshot; the scenario itself is unchanged.

## §8 — Adversarial data + size (the E4 lesson, both times)

Homologate with: a 120-char scenario name and a 500-char note (and over-cap rejections as honest 422s), many
channels + many "Outros custos", a kit basis with many lines, a deleted referenced basis, a ≥100% commission
override (inline per-slot error, others keep computing), an unresolvable fee slot ("sem referência", no
fabricated pre-fill), a >256 KB config (honest 422, never truncation) — at 390px and desktop, asserting
**geometry** where it renders, not just text.

## §9 — The standing gates (every slice)

`pnpm gate:all` green · contract drift-guard idempotent (regen twice → 0 diff, docstrings included) · **SC-612**:
every E1/E2/E3/E4 guard passes UNCHANGED (free calculator, catalog live-recompute, kit D3/D6, snapshot
immutability, entitlement gate).
