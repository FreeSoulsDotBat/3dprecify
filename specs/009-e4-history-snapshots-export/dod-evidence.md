# 009-e4-history-snapshots-export — DoD evidence

**Status (2026-07-17): E4 shipped to `develop` across three owner-authorized slices — PR-A #18, PR-B #19,
PR-C #20 all owner-merged.** E4 gives the product its second shelf: a **frozen** one. The calculator's shelf
is always current; the Histórico's is never — and the epic's whole job is to make both true at once, visibly.
This file is the E4 DoD map. Built mirroring the E2/E3 cadence: each slice shipped only on full `gate:all` +
e2e + **SC-512 untouched** + qa-produto homologation + owner authorization.

> **Merges** (local `-0300`, authoritative from the commit dates):
> | Slice | PR | SHA | Merged | Carries |
> |---|---|---|---|---|
> | **PR-A** — the frozen shelf: record (online + offline) · consult · honest teaser | [#18](https://github.com/FreeSoulsDotBat/3dprecify/pull/18) | `b1fbd80` | 2026-07-16 00:33 | US1 · US2 · US5 · **ADR-0018** + **ADR-0019** |
> | **PR-B** — US3 catalog-churn inertness + US6 manage/lapse | [#19](https://github.com/FreeSoulsDotBat/3dprecify/pull/19) | `bd9d95e` | 2026-07-16 13:40 | US3 · US6 · **A29 closed** |
> | **PR-C** — Export (US4) + the comparison (US7) | [#20](https://github.com/FreeSoulsDotBat/3dprecify/pull/20) | `e10b49f` | 2026-07-17 10:05 | US4 · US7 · **ADR-0020** |

## Gates (PR-C run — CI run [`29548507245`](https://github.com/FreeSoulsDotBat/3dprecify/actions/runs/29548507245), 2026-07-17; `develop` green at `e10b49f`)

| Gate | Result |
|------|--------|
| `pnpm gate:all` (THE command — identical string in lefthook pre-push and the CI `gate` job, D4) | green end-to-end (4m04s) |
| Backend (ruff check+format · basedpyright strict · pytest --cov · import-linter) | clean; **253 pytest passed**, coverage **86.58%** (floor 82; 1714 stmts / 230 miss) |
| import-linter | **3 contracts kept, 0 broken** — incl. the one PR-C added: **`E4 layering: api -> services -> models`** (23 files, 58 dependencies analyzed) |
| Frontend (format · lint+boundaries · dependency-cruiser · typecheck · coverage) | green; **626 tests / 78 files passed**; coverage **85.63** stmts / **80.76** branch / **82.82** funcs / **87.47** lines — above the `apps/web/src` floors (77/73/74/78) with `packages/*` held at the **100% ratchet** |
| Playwright e2e (chromium + mobile, Auth emulator + real backend + compose Postgres) | **120/120** (1.8m) incl. the four E4 specs: `history-export.spec.ts` · `history-manage.spec.ts` · `history-offline.spec.ts` · `history-signout-queue.spec.ts` |
| Contract drift-guard (OpenAPI export → Orval regen) | **0 drift** — PR-C added the export routes *and* taught the contract to declare the bytes (`format: "binary"`) |
| Migration-amend guard (merged migrations are immutable) | pass |
| Secret scan (gitleaks + trufflehog) · GitGuardian | pass |
| Backend image build · Web build (vite) | pass — `reportlab==5.0.0` installs on `python:3.12-slim` with no compiler/`apt` (the T025 pin, proven in the image) |

**9/9 checks green** on the merge; `develop`'s own CI is green at `e10b49f`.

## Success criteria — SC-501..515

| SC | Status | Evidence |
|----|--------|----------|
| **SC-501** — records a price and, on a fresh session/device, reopens it with every line **byte-identical**, **zero** recomputation | ✅ | `test_the_frozen_payload_round_trips_byte_identically`; `frozen-payload.test.ts` (envelope Option A); the detail renders the **stored** breakdown — no recompute path exists; T016 homologation walk |
| **SC-502** — editing **or** deleting a referenced catalog entity changes **0%** of snapshots and produces **no** degraded/warning state | ✅ | `test_SC502_the_snapshots_table_has_no_foreign_key_into_the_catalog` + `test_SC502_hard_purging_the_origin_neither_fails_nor_touches_the_snapshot` (ADR-0019 §5 — provenance without an FK); `snapshot-detail.test.tsx` no-degrade/no-"removed"-lie guards; `origin.test.ts` read-time resolution; **T023 two-shelf side-by-side homologation** |
| **SC-503** — 100% of persistence authorized server-side; free/signed-out/faked-premium denied, persists+reads nothing | ✅ | `test_a_free_caller_is_denied_and_NOTHING_is_written` · `test_a_signed_out_caller_is_denied`; `require_entitlement` on every write (ADR-0012/0015) |
| **SC-504** — **0** write paths alter a snapshot; only the label moves; owner may delete the whole entry | ✅ | **defense in depth, three layers:** `test_C8_a_raw_UPDATE_of_ANY_frozen_column_RAISES_at_the_database` (the project's first **PL/pgSQL** trigger — an invariant, not a promise) · `test_M12_the_ORM_before_update_guard_raises_a_ValueError_before_any_SQL` · `test_PATCH_rejects_a_smuggled_frozen_field_with_422_never_a_silent_ignore` · `test_the_label_and_only_the_label_may_move` · `test_no_PUT_route_exists_on_the_snapshot_resource` (machine-checked by the drift-guard) |
| **SC-505** — recording creates **zero** catalog objects | ✅ | the record path writes only `snapshots` (the explicit contrast with E3's K3 materialization); T016 homologation inspected the catalog after every record path |
| **SC-506** — an exported quote has **zero** internal cost lines unless opted in; exported values equal the stored values exactly | ✅ | `TestQuoteContent::test_a_single_quote_hides_internal_costs_by_default` · `test_opting_in_reveals_the_stored_breakdown_verbatim` · `TestRouteGuarantees::test_the_endpoint_HONOURS_the_opt_in_flag_in_the_ARTIFACT_it_returns` (the artifact, not the 200); `TestHistoryCsv::test_rows_equal_the_stored_snapshots_exactly`; **T030 verified on the downloaded PDF/CSV bytes** |
| **SC-507** — every free/signed-out affordance honest on the rendered UI; the free calculator unchanged | ✅ | `historico-teaser.test.tsx`; `test_a_free_account_gets_no_artifact` · `test_signed_out_is_unauthenticated` (**no artifact produced**, not merely hidden); SC-512 keeps the free calculator intact |
| **SC-508** — on lapse: 100% readable, 0% writable, **0% exportable**, 0% deleted; re-grant restores both | ✅ | `test_a_lapse_freezes_writes_but_keeps_the_ledger_readable` · `test_on_lapse_reads_survive_writes_are_denied_and_NOTHING_is_deleted`; the export clause: `TestExportEndpoints::test_a_lapse_denies_the_export_with_NO_partial_artifact` (Q6 — the owner's harder rule, overriding the PO) |
| **SC-509** — zero cross-account reads/writes; another account's entry indistinguishable from non-existent | ✅ | `test_another_accounts_snapshot_is_indistinguishable_from_non_existent` · `test_the_same_key_under_a_DIFFERENT_account_is_not_a_collision` · `TestRouteGuarantees::test_one_account_can_NEVER_export_another_account_row` (a **shared** `owned_snapshot` predicate — 2 copies of a posse check drift, and what drifts is account isolation) |
| **SC-510** — after one online load, 100% of snapshots readable offline | ✅ | uid-keyed offline cache (the E2 pattern); `use-history.test.tsx` |
| **SC-511** — every surface displays its record date; **no** surface presents a value as current | ✅ | `test_the_device_clock_is_stored_verbatim_and_created_at_never_reaches_the_wire` · `TestQuotePresentation::test_the_printed_date_is_the_DEVICE_day_not_the_UTC_day` · `TestHistoryCsv::test_created_at_is_never_a_column` + `test_the_quoted_date_is_the_DEVICE_day_the_seller_saw_not_the_UTC_day`; **the T030 re-verification proved all four surfaces (card · detail · PDF · CSV) agree under a real UTC straddle** |
| **SC-512** — all E1/E2/E3 guarantees pass **unchanged** | ✅ | the full E1+E2+E3 e2e passes unchanged inside the 120/120, in **every** slice's gate (not just at close-out) |
| **SC-513** (Q8) — an offline snapshot syncs **exactly once** — 0 duplicates across retry/reconnect/restart, 0 silent drops; visibly pending meanwhile | ✅ | `test_a_replayed_client_snapshot_id_returns_the_SAME_row_and_never_duplicates` · `test_a_replay_after_a_DELETE_does_not_resurrect_the_snapshot` (the soft-delete tombstone lives **inside** the unique key); `outbox.test.ts` · `outbox-syncer.test.tsx` · `sign-out-outbox-guard.test.tsx`; `history-offline.spec.ts` + `history-signout-queue.spec.ts`; **ADR-0018**; T016 homologation read **IndexedDB directly** at each step |
| **SC-514** (Q8) — a denied sync surfaces the denial honestly; 0 silent drops, 0 entries left claiming saved | ✅ | the blocked state (retained · visible · explained · **Tentar novamente**/**Descartar**); `outbox-syncer.test.tsx`; T016 homologation drove revoke-before-sync then re-grant |
| **SC-515** — a **kit** quote itemizes every piece (name + quantity) with the total and zero cost lines | ✅ | `test_a_kit_quote_itemizes_every_piece_and_still_hides_costs`; `TestRouteGuarantees::test_a_kit_opt_in_actually_returns_the_kit_cost_line`; adversarial: `test_a_zero_quantity_line_prints_ZERO_never_one` + `test_a_nameless_kit_piece_is_NAMED_never_a_blank_cell` |

## Failing-first discipline (per-task, captured)

- **PR-A** (US1/US2/US5): the frozen-payload pair T002→T003 and the table/router chain T004→T005→T006 written
  failing-first; the outbox T008→T009 (queue before the action that enqueues); teaser T014→T015.
- **PR-B** (US3/US6): T018→T019→T020 (SC-502 tests → detail surface → recalculate); T021→T022 (lapse/manage).
- **PR-C** (US4/US7): T026→T027 (`test_export.py` red before `quote_render.py`); T028 FE **15 red → green**;
  T029 US7 with 7 failing-first tests.
- **The review-fix cycle went further than failing-first:** every test in `TestReviewCoverage` was written
  against a **mutation the reviewer ran and watched pass green** — the test exists because the absence was
  demonstrated, not suspected.

## Homologation evidence

- **PR-A** (T016): `homologation-t016.md` — the offline → sync → reopen walk at 390px + desktop on the real
  stack, with `psql` proof and **direct IndexedDB reads** at every step.
- **PR-A review + re-homologation**: `review-pr-a.md` → `rehomologation-pr-a.md` (2026-07-15) — **PASS**, 2 nits,
  0 blockers. This pass exists because the review found that T016's PASS was partly a **false PASS**; the
  re-homologation is what corrected it. Envelope Option A frozen here.
- **PR-B** (T023): the **two-shelf side-by-side** — one deleted product referenced by BOTH a snapshot and a kit:
  the **kit degrades** ("Peça 1 · (avulsa)" + "valores mantidos", still priced) and the **snapshot does not move
  at all** (byte-identical value, origin link silently gone, captured name retained, no "removed" lie). Both
  behaviours are correct, and the contrast *is* the deliverable. 390px + desktop. *(Driven directly rather than
  via the qa-produto subagent.)*
- **PR-C** (T030): the export walk — **PASS-WITH-NITS → re-verified → PASS** (confidence 85%→92%). Verified on
  the **real downloaded artifact**, never asserted from a 200: SC-506 default quote has zero cost lines; the
  opt-in switch is **off again on reopen even after an opt-in export**; SC-515 kit itemizes; FR-515 the server
  **genuinely refuses on lapse** (403 `ENTITLEMENT_REQUIRED`, no bytes). The re-verification closed both open
  items on real artifacts: the CSV date fix re-read under a **real UTC straddle** (browser in `Asia/Dubai`,
  UTC+4 — card/detail/PDF/CSV all four agree, and `+04:00` travels in the file), and **US7 proven reachable in
  the browser**, disproving the earlier "no lever" finding (filament 110 → 220 ⇒ "Cotado em 16/07 R$ 26,48" vs
  "Hoje R$ 43,80", **frozen record unmoved** at `Material R$ 11,55`).
- **PR-C multi-agent review** (2026-07-16, **~2.13M tokens** — see `docs/token-ledger.md`): 6 lenses → 21
  findings, **zero refuted**, **4 real BLOCKERs**, all fixed test-first (ReportLab markup injection; money
  counted twice — `admin` **is** Σ otherCosts; `int(0 or 1) == 1` where quantity 0 is a legal state; a blank
  "item" cell). Then the MAJORs + the 5 unadjudicated + MINORs (`bce1bac`), then cleanup (`e2b20da`).

## The lesson this epic paid for (recorded, because it generalizes)

**Two homologations opened the artifact and passed — with benign data.** All four PR-C blockers were
**data-dependent**. *Opening the artifact is necessary and **not sufficient**: it must be opened with
**adversarial** data.* `TestReviewBlockers` + `TestReviewCoverage` are that data, kept.

Two process findings worth carrying forward:

1. **Nobody refutes the fix.** A claim in `c8977da` — that a bare `&` corrupts ReportLab output — was **false**,
   and was propagated to three places before a 4-line probe against the real parser disproved it (a bare `&`
   prints verbatim; only the *entity* form is interpreted, and `<` is what breaks). Refuting a **finding** is the
   habit; refuting a **fix** is not. It should be.
2. **A refuter with write tools edited `export.py`** (removing a posse check to see whether any test caught it —
   none did; that *was* the finding) and reverted. The tree was verified before proceeding. Future reviews:
   refuters in `isolation: 'worktree'` or with no write tool. *(Related: worktree isolation does **not** by itself
   guarantee the right tree — one run created worktrees at `0b12426`, three epics stale.)*

## Decisions honored / recorded

- **ADR-0018** (offline snapshot outbox — device-durable queue, exactly-once sync, entitlement at sync) —
  **Accepted** by the owner at the PR-A gate, 2026-07-16.
- **ADR-0019** (snapshot immutability — enforcement in depth + provenance **without** a foreign key) —
  **Accepted** at the PR-A gate, 2026-07-16. Carries the project's first **PL/pgSQL** trigger.
- **ADR-0020** (export artifact rendering — server-rendered PDF/CSV behind an **active**-entitlement gate) —
  **Accepted** at the PR-C gate, 2026-07-17, including the asymmetry it names explicitly: **recording works
  offline; exporting does not.** An export is a server-rendered artifact, and the server is exactly what an
  offline device does not have.
  - **T025 — the PDF library was verified and pinned, not assumed** (ADR-0008's own precedent). **`reportlab==5.0.0`**:
    pure-Python `py3-none-any` wheel, installs on `python:3.12-slim` with no compiler/`apt` (the C accel is now the
    optional `rl_accel` extra), deps pillow + charset-normalizer, **BSD**. WeasyPrint rejected on native
    Pango/cairo/GDK-PixBuf; fpdf2 2.8.7 kept as fallback (no native deps, but LGPL-3.0 + thinner layout).
  - **ADR-0008 stands untouched:** the renderer prints stored, already-rounded values and performs **zero**
    arithmetic. "The backend never recomputes" is intact — a document renderer forks nothing, which is precisely
    why the ADR-0015 precedent does not transfer.
- **A29 closed** (`docs/decisions/audit-findings-r2.md`, open since 2026-07-02, explicitly reserved for E4):
  **LABELED + "Recalcular hoje"** — not silent freeze, not recalculation-with-diff. "Recalcular hoje" creates a
  **new** snapshot and **re-resolves the origin** against today's catalog rather than repricing frozen inputs
  (FR-505) — *"meu custo subiu desde que cotei?" is the question the seller is actually asking, and a
  frozen-input reprice could never answer "sim" to a filament price rise.* The rejected **diff** survives as US7's
  side-by-side, which labels two numbers and **computes no delta** (money arithmetic lives in `pricing-core`).
- **Q6** — export does **not** survive a lapse (*overrides* the PO's own 65%-confidence recommendation).
  **Q7** — export stays Premium, full stop; the conversion tension is **consciously accepted**, not overlooked.
- **US7 was droppable (P3) and was BUILT, not dropped** — owner decision, 2026-07-16: US4 landed whole, so
  nothing forced the cut.
- **Accepted deviation (T030, owner-ratified):** ux §6 says a lapsed export → *"visible → reactivation panel"*;
  shipped as **visible + disabled + `exportLapsed`**, matching the offline/pending reason-pattern beside it.
  A panel would open a dialog whose only content is the sentence already on screen, and there is **no
  reactivation flow to offer before E6** — it would promise a door that does not exist.

## T034 — final quickstart validation (§1..§9)

**Verdict: PASS-WITH-NITS on the first walk → raised to PASS after the fix was applied and RE-VERIFIED LIVE**
(qa-produto, 2026-07-17; ledger rows filed). The only pass that crosses the **seams between slices** — the three
per-slice homologations each stayed inside their own slice. Driven on the real stack (preview `:4173` + backend
`:8100` + compose Postgres `:5433` + Auth emulator), with **adversarial** data throughout (per E4's own recorded
lesson), the immutability trigger proven by a **direct DB UPDATE**, and revoke/re-grant cycles via the operator CLI.

> **Raised to PASS (same qa-produto agent, re-driven on the committed fix `5a0f5f9`).** The corrected quote was
> re-rendered with the adversarial names and read on the real bytes — long names now wrap, `Qtd.`/`Total` legible,
> markup still verbatim; the cost-label twin fixed too. The label decision was verified **in the browser**: an
> original labelled "Cliente João & Cia · pedido 41" recalculated after a filament rise produced a new entry that
> **inherited the label**, took a **fresh (null) validity**, and repriced to **75,90** at today's catalog while the
> original stayed intact — and searching "pedido 41" returns **both** (the then-vs-now payoff of the inherit
> decision). Gates on that exact HEAD: recalc unit 11/11 (incl. the 2 label tests), backend 257, typecheck+lint
> clean, **e2e 120/120**. The three nits are resolved and re-verified; nothing regressed.

| § | Verdict | Load-bearing evidence |
|---|---------|----------------------|
| §1 frozen shelf | PASS | "other device" = fresh storageState with IndexedDB **removed** ⇒ server-only; detail byte-identical to the stored payload; catalog 0/0/0 ⇒ recompute was impossible (SC-505) |
| §2 two-shelf rule | PASS | same deleted product P: **snapshot intact** (30,90, captured name shown, no degraded caption, "Abrir produto" absent) **vs kit degrades** (`degraded:true`, "Peça 1 · (avulsa)"). Both correct — the contrast is the deliverable |
| §3 offline (6/6) | PASS | lost-response replay of the same `clientSnapshotId` ⇒ 200, **1 row**; two tabs draining ⇒ exactly 1; delete-then-retry ⇒ 404, **no resurrection** |
| §4 entitlement at sync | PASS | revoke ⇒ "Envio pausado · precisa de Premium", retained+visible, **0 server rows**; re-grant ⇒ landed itself, 1 row |
| §5 immutability | PASS | PATCH label 200; **7/7 other fields ⇒ 422**; no PUT (405); the **PL/pgSQL trigger raises** on every frozen column incl. a surgical `jsonb_set` into a money leaf; hard-delete of the origin neither fails nor touches the snapshot |
| §6 export | **PASS-WITH-NITS** | one real defect (the overflow, below); everything else passed **with** adversarial data — markup verbatim, qty 0 prints 0, lapse ⇒ 403 zero bytes, offline/pending disabled-with-reason, CSV RFC4180-exact |
| §7 recalcular hoje | PASS | filament raised **first** ⇒ recalc **R$ 75,90 / material 40,00**, original unmoved at 30,90 / 10,00 — repricing frozen inputs could never produce 75,90 (proves re-resolve); origin gone ⇒ dialog **says** it used the stored values |
| §8 honest door | PASS (doc nit) | no price/date/CTA, no fabricated entry; free `GET /history` 403, 0 rows, PDF/CSV 403 no bytes |
| §9 regression (SC-512) | PASS | **e2e 120/120** + live checks: catalog live-reflect, kit D3/D6, free calculator intact, gate 403 on 5 routes |

**The cross-slice chain (the reason the run existed):** recorded **offline from a product** → synced → raised the
filament 100→400 **and deleted the product** → exported. The frozen provenance survived the offline queue
(`{"kind":"PRODUCT","name":"Vaso <b>Grande</b> & R&D"}`); after the churn the total held (30,90) and the **PDF
printed the frozen `Material R$ 10,00`** with the catalog already at R$ 400 — the document did not rot crossing the
three slices. **No seam defect.**

### The one real defect — found, fixed, regression-guarded, re-verified (close-out PR #21)

**§6 · PDF item name overran the quantity and price columns.** `render_quote_pdf` put `line.name` into a
ReportLab `Table` cell as a **raw str**, which does not wrap; past ~68 characters it crossed the *Qtd.* and *Total*
columns — in the document that goes to the **customer** — while `extract_text()` still returned a clean string
(text assertions are blind to a glyph collision). Nothing bounded name length (DB `Text`, no `max_length`, the
only `maxLength={120}` is on the *label*, not the name).

- **Fixed** (`quote_render.py`): the name — and, caught by the `seguranca` review, the "Outros custos" **cost
  label**, which has the identical raw-str/free-text shape — now render as `Paragraph(_xml(...))` with `VALIGN TOP`.
  They wrap; markup still prints verbatim (`_xml` stays on the path).
- **Guarded** (`test_export.py::TestQuoteLayout`): the new tests assert **geometry** (`x_end <= anchor_x` on the
  shared baseline) — exactly what text extraction could not see — plus a wrap test (no character lost) and a
  markup-survives test. Each was watched **fail on the reverted source** before the fix (mutation-proven), and the
  extractor tracks leading/`T*`/glyph-advance so it reports real positions, not a page it never read.
- **Why it survived 253 tests + two homologations + a 2.13M-token review:** `test_export.py` had no long-name
  case, and content-only checks cannot detect a collision. It is E4's own lesson on a new axis — here even
  adversarial *content* was insufficient; it took adversarial *size*.

### Nits

1. **Doc (fixed):** quickstart §8 described a "salvar/exportar teaser" that owner decision **Q15** (2026-07-13)
   removed — the record button is **absent** for free users, not a teaser trigger. Code was right; the line aged.
   Corrected with a dated note crediting T034.
2. **CSV formula injection (consciously accepted, recorded):** routed to `seguranca` — verdict **accept + record**
   (85%): `label` is the only attacker-influenceable column, the export is owner-scoped with no cross-account write
   path, so payload author and file reader are the same principal, and every guard breaks FR-513's round-trip while
   protecting nobody. Recorded in ADR-0020 §Consequences with four mandatory re-open triggers; the FR-513-preserving
   half (RFC4180 round-trip) is now pinned by a test that previously did not exist.
3. **Open product decision — NOT decided (Principle VIII):** "Recalcular hoje" writes `label: null`
   (`recalc-today.tsx:194`) — the new snapshot is born unlabeled. Whether it should inherit the original's label is
   unspecified in FR-505 / ux-history / tests. Left for the owner; a one-line change either way.

## Owner sign-off

E4 functionality shipped and homologated across PR #18 / #19 / #20. The close-out homologation (T034) found one
customer-facing defect (PDF overflow), fixed with mutation-proven regression tests and **re-verified live** by the
same qa-produto agent on the committed fix; plus two recorded decisions (CSV-injection accept; recalc label
inherit) and the doc correction. **The fix + close-out docs are the close-out follow-up — `feature/009-e4-close-out`,
opened as PR #21 (all 9 CI checks green), awaiting the owner's squash-merge** (ADR-0006). On that merge: graph
refresh, then T033 (roadmap `SHIPPED` row + `CLAUDE.md` ground line) — the last step, held because it asserts epic
completion. *(Owner sign-off recorded on that merge.)*
