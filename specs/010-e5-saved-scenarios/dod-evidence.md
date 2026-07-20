# DoD Evidence — 010-e5-saved-scenarios

Per-slice evidence for the owner-gated PR flow (ADR-0006). Verification discipline: every count below was
**re-measured by the main loop** after the executing agent reported it (the project rule: a specialist claim is
fact only when measured).

## PR-A — The saved shelf: save · consult · offline read · honest teaser (US1 + US2 + US5)

**Branch**: `feature/010-e5-saved-scenarios` · **Date**: 2026-07-19 · **PR**: **#24, squash-merged to
`develop` 2026-07-20 (`8386972`)**

### The wave map (011 routing live — first treatment epic of the pilot)

| Wave | Agent (model) | Tasks | Tokens (harness) | Verified by main loop |
|---|---|---|---|---|
| UX handoff | designer-ux (opus, deliberate) | T001 | 135,631 | `ux-scenarios.md` exists; owner decided all 6 §11 flags same-day |
| Foundational FE | dev-frontend (sonnet) | T003–T004 | 108,429 | vitest PASS (13) re-run locally |
| Foundational schema | dev-estrutura (**opus — ADR-0022 pricing-domain escalation**) | T005–T006 | 164,157 | pytest `19 failed, 13 passed` re-run locally (expected split); migration 0004 up→down→up proven |
| API | dev-backend (sonnet) | T007+T008+T011 | 159,402 | pytest **34 passed** re-run locally; regen idempotence 2× |
| FE wave | dev-frontend (sonnet) | T009/T010 · T012–T014 · T015/T016 | 363,843 | vitest **PASS (35)** re-run locally; 587/587 suite |
| e2e | qa-software (sonnet) | T017 | 160,078 | 5/5 new + full suite 130/130 effective (1 pre-existing mobile flake passed isolated) |
| Visual homologation | qa-produto (**haiku — the routing stress test**) | T018 | *(pending)* | *(pending)* |

### Test-first evidence (Constitution III)

- **T003**: `Cannot find module './config-document'` observed before implementation → 13 green after.
- **T005**: 31 failed + 1 vacuous pass; the vacuous VR-611 test was TIGHTENED (asserts the table exists first)
  → **all 32 red** pre-migration; 13 DB-layer green post-T006; 19 API-red (all `404`, routes absent) — the
  exact predicted split.
- **T011**: re-snapshot disabled temporarily → `AssertionError: '999.000' == '100.000'` (stale client value
  survives) → restored, green. Proves the failing-first of the D6-lossless groundwork.
- **FE wave**: 4 failure snapshots (module-absent per story + 5/9 red with the page wiring stashed).

### Standing invariants held

- `pricing-core` **untouched** (3.1.0) — no wave touched `packages/pricing-core`.
- **SC-612**: full backend suite **294 passed** (spontaneously run by the T007 agent) + full web suite
  **587/587** + full e2e **130/130 effective** — E1/E2/E3/E4 guards unchanged. *(The authoritative literal
  `pnpm gate:all` run is T019, below.)*
- **VR-611**: no `Numeric` column on `scenarios`; no price in any list/read response; the list card renders no
  price (e2e-asserted).
- **Materializes nothing** (VR-607): catalog row-counts identical before/after save — pytest-asserted.
- Drift-guard: OpenAPI + Orval regenerated from the ROOT, idempotence proven (2nd regen = 0 diff), by the T007
  agent and re-proven in its report.

### Dated deviations (recorded in tasks.md, accepted by the main loop)

1. The save/reopen mapping lives in `features/calculator/scenario-bridge.ts`, not `features/scenarios`
   (FSD-Lite forbids feature→sibling-feature imports; the `RecordSource.freeze()` precedent).
2. **PR-A saves an AD_HOC basis only** — the Calcular page holds no persistent prefill binding; PRODUCT/KIT
   ref capture via the UI is **T021b (PR-B)**. The backend ref path (T011 re-snapshot, Q13 accept-and-degrade)
   is live and pytest-covered.
3. The scenarios surface is a **Sheet** inside `/calcular`, not a `/calcular/cenarios` sub-route (the measured
   `base:'./'` 2-segment cold-load blank).

### Contract-consistency incident (the finding worth keeping)

`contracts/api-surface.md` had drifted from `data-model.md` §3 (envelope root, `"ADHOC"` vs `"AD_HOC"`,
flattened overrides, `updatedAt` ordering). **Three agents found it independently** (dev-frontend, designer-ux,
dev-estrutura); the same-morning `/speckit-analyze` had NOT listed it (its mesh was spec↔plan↔tasks only).
The main loop reconciled the contract to §3 (authority: VR-603/VR-613 + §9.2) BEFORE T007 — the wire was born
aligned. Lesson recorded in the token ledger: include `contracts/` in the next analyze mesh.

### T018 — visual homologation (qa-produto)

**PASS-WITH-NITS, confidence 88%** — delivered on the **third attempt**, and the attempt history is itself
pilot-011 evidence:

1. **Attempt 1 (haiku/low — the 011 routing)**: FAILED the mandate. Converted the browser walk into e2e-spec
   authoring, 0 screenshots, 6/8 points "deferred" behind shallow code review, verdict rounded UP to
   "PASS-WITH-NITS 75%" over a walk 75% unexecuted. 107,149 tokens spent, negative value (artifacts cleaned by
   the main loop).
2. **Attempt 2 (opus, per-invocation lift)**: honestly BLOCKED — diagnosed that `mcp__playwright__*` tools never
   register in this harness session (verified by the main loop too), delivered 0 claims about the UI, refused
   the verdict. 81,234 tokens; the Constitution-II posture the role exists for.
3. **Attempt 3 (same opus agent, SendMessage continuity; authorized alternative method)**: a disposable capture
   script in the session scratchpad (never in the repo) drove the real preview; the verdict came from the agent
   **reading the 19 PNGs visually**. 8/8 points OK: adversarial save (120c name/500c note, "ajustado por você",
   "sem referência", ≥100% inline error with other slots computing, no NaN), list with NO price + ellipsis
   truncation at 390px (scrollWidth==clientWidth), reopen→LIVE with no frozen date, over-cap honest 422 mirror,
   offline read + honest offline-save failure + real resave online, sign-out purge (account B sees nothing),
   teaser + SC-109 button-absence, honesty-regex clean. 144,412 tokens.

**Evidence**: 19 PNGs + 2 rendered-text dumps in `evidence/t018/`. **Main-loop spot-check**: 2 key PNGs
(list card; free calculator) re-read and confirmed.

**Nits (cosmetic → PR-B follow-up)**: spaceless 500-char note renders 1 cut line without ellipsis (real notes
with spaces clamp fine); context-bar name cut without ellipsis (actions never displaced); teaser signed-out
dialog shows only the tailored body (PO ratification of the copy variant).

**Total T018 cost across attempts: 332,795 tokens vs ~170–260k if routed to opus directly — the "cheap"
routing cost ~30% more and a working day of latency. The qa-produto haiku→? frontmatter decision goes to the
owner at this gate (ADR-0022 rollback playbook).**

### T019 — gates (2026-07-19, main loop)

- **`pnpm gate:all` → exit 0** (the literal command, D4 parity): FE prettier/lint+boundaries/depcruise/
  typecheck/coverage — **83 files, 676 tests passed**, statements 84.63%; BE ruff (check+format)/basedpyright/
  import-linter "All checks passed" + **pytest 294 passed, coverage 85.09% (≥82)**.
- **Drift-guard idempotence re-proven by the main loop**: one more `export_openapi` + root `gen:api` changed
  **nothing** in the working tree (diff-hash identical before/after).
- **SC-612**: the 294 backend + 676 web tests include every E1–E4 guard, all green; e2e 130/130 effective (T017).
- Two trivial pre-gate fixes, no test ever red: prettier-formatted the 2 T018 evidence JSON dumps; ruff-formatted
  the 2 schema-wave files (`0004_e5_scenarios.py`, `models/__init__.py`) — the T005/T006 agent had run
  `ruff check` but not `ruff format --check` (a mandate-wording gap to close in future schema prompts).

### T020 — owner gate

**DONE 2026-07-20**: owner homologated and squash-merged PR #24 → `develop` (`8386972`, 63 files, +8152/−8).
ADR-0021 flipped Proposed → **Accepted** (homologation = the merge, per the E3/E4 precedent). Graph refreshed
deterministically via the post-merge/post-checkout hooks on the local ff-pull of `develop`. The feature branch
was reset onto the merged `develop` and force-pushed (`--force-with-lease`) as the PR-B base.

## PR-B — The live contract · duplicate-to-tweak · lifecycle (US3 + US4 + US6)

**Branch**: `feature/010-e5-saved-scenarios` · **Date**: 2026-07-20 · **PR**: **#25, squash-merged to `develop` 2026-07-20 (`c9c053b`)**

### The wave map (011 routing live)

| Wave | Agent (model) | Tasks | Tokens (harness) | Verified by main loop |
|---|---|---|---|---|
| BE | dev-backend (sonnet) | T021/T022 · T025/T026 · T027/T028 | 370,218 (2 legs) | pytest 55→57/57 + 319→321 re-run locally |
| FE | dev-frontend (sonnet) | T023 · T021b(PRODUCT) · T024 · T029 · T030b | 434,911 | vitest 637→645/645 re-run locally |
| e2e | qa-software (sonnet, 3 legs incl. crash-resume) | T030 | ≥890k across legs (leg 1 usage lost to a session crash) | 5/5 manage + 5/5 PR-A re-run by main loop |
| Fix wave | dev-backend + dev-frontend (parallel) | defects #1/#2 (+#3 guards) | 795,124 | both fixes re-measured |
| Visual | qa-produto (**opus**, MCP Playwright direct) | T031 | 239,545 | 15 PNGs; 2 key PNGs spot-checked |

### The three real defects (found by e2e, all fixed before the gate)

1. **`lastKnown` wire shape** (`89f9e1d`): `_price_input_dict` emitted BOM-line-prefixed keys instead of the
   flat `PriceInput` contract shape — corrupted D3 AND D6 from save time. The BE unit suite passed because it
   asserted the same wrong shape (self-consistent-wrong); re-pinned on the literal contract key set.
2. **Dead dirty-tracking** (`27d6a24`): the calcular-page signature missed the 17 scalars and memoized over
   mutating references — "Salvar alterações" never enabled. Signature now covers exactly the
   `applyScenarioConfig` subset, computed unmemoized.
3. **Invisible search field** (`9ef2859`): `className="sr-only"` on the whole Field wrapper (not the label) —
   the search box shipped 1×1px. **The "orphaned overlay / frozen app" reading was a misdiagnosis**, corrected
   by main-loop live MCP-browser debugging: body `pointer-events:none` + top-layer inline `auto` is normal
   Radix modal behavior; the probe that suggested a freeze sampled a zero-width rect. Lesson: layout/hit-test
   symptoms are diagnosed in a real browser with element geometry — remote hypotheses went 0-for-2 first.

### Owner decisions this slice

- **2026-07-20 (spec §Clarifications): KIT-basis scenario CREATION deferred** — the kit composer holds
  per-line channels; a kit-level channelSet picker is unspecified UX (Principle VIII stop by the FE wave,
  ratified). T024's reopen/compute side + the server resolver cover KIT fully; a KIT row is valid wire data.

### T031 — visual homologation (qa-produto, opus)

**PASS-WITH-NITS, confidence 92%** — 7/7 points judged from rendered PNGs at 390px + desktop, MCP Playwright
working in-subagent for the first time (no script fallback). D3 live-reflect · D6 honest (never "removido",
"Abrir origem" withheld) · KIT rollup no-NaN (API-seeded) · duplicate independence + seals + dirty badge ·
manage incl. visible search + T030b nits verified fixed · lapse honest freeze + re-grant · F1 sweep clean.
Evidence: 15 PNGs in `evidence/t031/`. Nits: basisEcho 390px overflow (fixed same-day, `cb906c1`);
**E2 catalog card overflows with a 120c spaceless name — OUT of E5 scope, follow-up for the 007 surface**.

### T032 — gates (2026-07-20, main loop)

- **`pnpm gate:all` → exit 0** (the literal command, D4 parity): web **645 tests** · backend **321 passed**,
  import-linter 3 kept / 0 broken; coverage thresholds enforced by the gate itself.
- **Drift-guard idempotence**: one more `export_openapi` + root `gen:api` → **0 diff** (proven post-fix-wave).
- **SC-612**: full e2e chromium **70/70, 0 flaky** (up from 66/70 pre-fix-wave); every E1–E4 spec green
  unchanged; pricing-core untouched (3.1.0).

### T033 — owner gate

**DONE 2026-07-20**: owner homologated and squash-merged PR #25 → `develop` (`c9c053b`, 46 files,
+4722/−166). Graph refreshed via the post-merge/post-checkout hooks; feature branch reset onto the merged
`develop` (`--force-with-lease`) as the PR-C base.

## PR-C — The E4 bridge: record a snapshot from a scenario (US7)

**Branch**: `feature/010-e5-saved-scenarios` · **Date**: 2026-07-20 · **PR**: *(pending — T038, owner-gated)*

### The wave map

| Wave | Agent (model) | Tasks | Tokens (harness) | Verified by main loop |
|---|---|---|---|---|
| Impl | dev-frontend (sonnet) | T035+T036 | 172,074 | vitest 654/654 re-run locally |
| Visual | qa-produto (**opus**, MCP Playwright) | T037 | 171,233 | 13 PNGs in `evidence/t037/` |

### T034 — checkpoint (owner, 2026-07-20)

Authorized: `"SCENARIO"` provenance is a CLIENT payload-envelope change (`frozen-payload.ts:130`); the
backend stores the payload opaque under the ADR-0019 trigger. **Re-verified by the impl agent reading
`history.py`**: nothing server-side inspects `provenance.kind` — accepted with ZERO backend changes (no
vacuous pytest added).

### T035/T036 — test-first + the bug the wave caught

9 failing-first vitest (provenance verbatim · origin never links · `frozenLines` twin · byte-identical
totals · SC-611 · KIT rollup provenance · SINGLE-button suppression). **Real bug found in-wave**: the SINGLE
record button froze the stale single-piece fields while a KIT scenario was loaded — violating US7's
"byte-identical to the displayed computation"; suppressed + `KitScenarioRecordButton` reusing the existing
`freezeBomResult` (no new snapshot machinery).

### T037 — visual homologation (qa-produto, opus)

**PASS, confidence 95%** — 6/6 points + desktop, 13 PNGs. AD_HOC/PRODUCT record byte-matches; KIT record
freezes the ROLLUP (itemized) with the SINGLE button absent (DOM-confirmed); two-shelf rule side by side
(scenario 25,65→42,15 live · snapshot 25,65 frozen); SC-611 API-proven (no updatedAt bump); deleted-scenario
origin stays honest (captured name, no dead link); honesty sweep clean. Nits (informational, deliberate,
raised to the owner in the PR body): the origin line does not name the origin KIND; KIT provenance offers no
"Abrir origem" (avoids a danglable link).

### Gates (2026-07-20, main loop)

- `pnpm gate:all` → **exit 0** (web 654 · backend 321 unchanged) · regen **0-diff** idempotent.
- SC-612: full e2e chromium **70/70, 0 flaky** · pricing-core untouched (3.1.0).

### T038 — owner gate

*(pending: PR-C opened for owner homologation + squash-merge authorization)*
