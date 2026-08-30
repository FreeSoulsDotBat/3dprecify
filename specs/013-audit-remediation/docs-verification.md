# US7 (T080) — docs-only verification checklist

For each claim named in `tasks.md` T081–T086, the exact command and its **real, reproducible output**
(run from the repo root, 2026-07-23, on branch `013-audit-remediation`). This is the "test" for a docs-only
PR — the artifact IS the inspection. All commands were re-run after every edit; output below is captured
verbatim (the harmless `[rtk] /!\ No hook installed …` line some Bash calls print is the local dev-workflow
hook noise from ADR-0022 and is not part of any command's own output).

---

## T081 — SC-308 "RLS backstop" claim (E2-02) + rtk banner frequency (P-01)

**Claim 1 — the RLS-backstop claim is gone from the SC-308 evidence row.**
```
$ grep -n "SC-308" specs/007-e2-catalog-entitlement/dod-evidence.md
30:| **SC-308** — zero cross-account reads/writes | ✅ | `test_*::test_per_account_isolation` (another account's row → 404, no existence oracle); owner-scoped queries only — **no RLS is implemented in this backend** (grep confirms 0 occurrences of Postgres row-level-security in `backend/`; the isolation guarantee is app-layer, not a DB-enforced backstop) |
```
Expected: the row states "no RLS is implemented", not "RLS backstop". ✅ matches.

**Claim 2 — RLS really has 0 occurrences in the backend's own source (excluding vendored `.venv/`).**
```
$ grep -rn "RLS" backend/app --include=*.py | wc -l
0
$ grep -rln "RLS" backend/alembic backend/app
backend/alembic/versions/0003_e4_snapshots.py
```
Expected: `0` in `backend/app`; the one alembic hit is a migration **docstring** ("E2 §0 had promised 'tables
/ CHECK / RLS only'") documenting that RLS was promised and never built — not an implementation. Confirms the
audit's "RLS = 0 occurrences" finding.

**Claim 3 — the 011 dod-evidence rtk-banner frequency correction (P-01) is in place.**
```
$ grep -n "prints on \*\*every single Bash command\|prints on \*\*every\*\* intercepted Bash command" specs/011-token-optimization/dod-evidence.md
106:  actual frequency — the banner prints on **every single Bash command the hook wraps** (100% of the 1,401
177:  rtk init -g` banner checks the GLOBAL scope only; it prints on **every** intercepted Bash command (not
```
Expected: both lines (104-106 and 173-175 in the original audit line numbers, now 104-109 / 173-178 after the
correction's extra lines) state the banner fires on every intercepted command, not "on every call" of
`rtk gain --history` alone. ✅ matches.

---

## T082 — 005 spec toggle show/hide Clarification (FA-04) + FR-113 descope note + SC-109→3.1.0 note (E1-07)

**Claim 1 — a dated Clarification (D2=A) exists and the 4 affected lines are amended.**
```
$ grep -n "Clarification 2026-07-23, D2=A" specs/005-marketplace-multichannel/spec.md
126:**Independent Test**: ... while the entire channel section is hidden (Clarification 2026-07-23, D2=A — see §5).
130:2. **Given** the toggle **off** ... (Clarification 2026-07-23, D2=A).
199:- **FR-113**: ... (Clarification 2026-07-23, D2=A; officializes the 2026-07-08 dod-evidence owner-clarification ...) ...
233:- **SC-105 (include/exclude framing).** ... (Clarification 2026-07-23, D2=A).
```
(4 occurrences at the exact 4 lines named in the task — line numbers shifted slightly after the edits
themselves, but all 4 original locations — US4 Independent Test, its Acceptance Scenario #2, FR-113, SC-105 —
now read "hidden entirely" instead of "visible … labelled simulation".)

**Claim 2 — the FR-113 `includeInHeadline` descope note (traced to ADR-0011, not this spec) is present.**
```
$ grep -n "Descope note" specs/005-marketplace-multichannel/spec.md
199:...**Descope note**: `PriceResult.includeInHeadline` was never added to the pricing-core result contract ... recorded in ADR-0011 ...
```

**Claim 3 — the SC-109 "3.0.0" note pointing at the real 3.1.0 (ADR-0016) is present.**
```
$ grep -n "has since bumped to \*\*\`3.1.0\`\*\*" specs/005-marketplace-multichannel/spec.md
237:...`pricing-core` has since bumped to **`3.1.0`** (E3's BOM compose contract, ADR-0016) ...
```

---

## T083 — Constitution "orchestrates"→"advises on" + PATCH bump 1.1.0→1.1.1 (F-01)

**Claim 1 — the live rule text says "advises on", not "orchestrates".**
```
$ grep -n "scrum-master advises on cadence and DoD" .specify/memory/constitution.md
113:  dev-frontend → qa-software + qa-produto → devops; scrum-master advises on cadence and DoD (the main
```

**Claim 2 — the "Agent roles & handoffs" bullet itself carries no live "orchestrates" claim** (the word
still appears twice, but only inside the sync-impact report's historical quote of the OLD wording — that is
required by the constitution's own Governance clause, not a residual bug):
```
$ grep -A2 "Agent roles & handoffs" .specify/memory/constitution.md | grep -c "orchestrates"
0
```

**Claim 3 — version bumped with a sync-impact report, exactly as §Governance requires.**
```
$ grep -n "Version change: 1.1.0 → 1.1.1" .specify/memory/constitution.md
3:Version change: 1.1.0 → 1.1.1
$ grep -n "^\*\*Version\*\*: 1.1.1" .specify/memory/constitution.md
126:**Version**: 1.1.1 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-07-23
```
The sync-impact-report HTML comment at the top of the file (Version change / Bump rationale / Modified
principles / Templates requiring updates / Authority) was written per the file's own documented template,
same as the existing 1.0.0→1.1.0 report it now sits above.

---

## T084 — `auth.py` docstring (F-03) + `catalogo-page.tsx` comment (E2-04)

**Claim 1 — the false "no consumer yet" docstring line is gone.**
```
$ grep -n "No product route consumes this yet" backend/app/auth.py
(no output — grep exit code 1)
```

**Claim 2 — the real consumer count (transitively, via the entitlement gate + 2 direct imports).**
```
$ grep -rl "require_entitlement\|require_catalog_read\|current_claims" backend/app --include=*.py | sort
backend/app/api/boms.py
backend/app/api/entitlement.py
backend/app/api/export.py
backend/app/api/fee_catalog.py
backend/app/api/filaments.py
backend/app/api/history.py
backend/app/api/me.py
backend/app/api/printers.py
backend/app/api/products.py
backend/app/api/scenarios.py
backend/app/auth.py
backend/app/entitlement/__init__.py
```
11 real consumer files (excluding `auth.py` itself). The audit's literal "14" could not be reproduced exactly
by this grep shape — noted below as a discrepancy — but the underlying claim ("no product route consumes
this yet" is false) is unambiguously confirmed: it is consumed by every catalog/premium route in the backend.

**Claim 3 — the `catalogo-page.tsx` "auth-guarded" comment is corrected.**
```
$ grep -n "auth-guarded" apps/web/src/pages/catalogo/catalogo-page.tsx
(no output — grep exit code 1)
$ grep -n "PUBLIC" apps/web/src/app/router.tsx | head -1
78:// 007/US7 (2026-07-10): /catalogo is PUBLIC — a signed-out user must SEE the honest premium
```
The comment now says the route is PUBLIC (matching the router), with only the `?produto=` sub-view
requiring auth.

---

## T085 — E4 `data-model.md`: `server_default` (E4-03) + UNIQUE name (E4-04) + ADR-0012 lookup note (E2-05)

**Claim 1 — the never-implemented `server_default 'PRECO_VAREJO'` is removed from `headline_basis`'s row.**
```
$ grep -n "headline_basis.*server_default" specs/009-e4-history-snapshots-export/data-model.md
(no output — grep exit code 1)
$ grep -n "headline_basis: Mapped" backend/app/models/__init__.py
671:    headline_basis: Mapped[str] = mapped_column(Text, nullable=False)
```
Confirms: the real ORM column has `nullable=False` and no `server_default` — the doc now matches.

**Claim 2 — the UNIQUE constraint name is reconciled to the real shipped name in every table it appears.**
```
$ grep -n "^| \`uq_snapshots" specs/009-e4-history-snapshots-export/data-model.md
373:| `uq_snapshots_client_snapshot_id` | **UNIQUE** `(owner_uid, client_snapshot_id)` ...
$ grep -n "uq_snapshots_client_snapshot_id" backend/alembic/versions/0003_e4_snapshots.py backend/app/models/__init__.py
backend/alembic/versions/0003_e4_snapshots.py:178:            "owner_uid", "client_snapshot_id", name=op.f("uq_snapshots_client_snapshot_id")
backend/app/models/__init__.py:585:        UniqueConstraint("owner_uid", "client_snapshot_id", name="uq_snapshots_client_snapshot_id"),
```
The old, wrong name (`uq_snapshots_owner_client_snapshot`) still appears exactly once in the doc — inside the
correction footnote itself (§6), explaining what the drift was. It no longer appears in any live constraint
table row.

**Claim 3 — ADR-0012 now documents the real per-request lookup cost (not "one indexed PK lookup").**
```
$ grep -n "E2-05" docs/adr/0012-entitlement-flag-mechanism.md
63:  E2-05)** — this ADR originally said "one indexed PK lookup per protected operation"; as shipped
$ grep -n "async def ensure_account\|async def read_entitlement_state" backend/app/entitlement/__init__.py
43:async def ensure_account(session: AsyncSession, uid: str, email: str | None) -> None:
55:async def read_entitlement_state(session: AsyncSession, uid: str) -> EntitlementState:
```
Confirms both round trips (`ensure_account`'s upsert+commit, `read_entitlement_state`'s select-all-grants)
exist in the real code, as the corrected ADR text now says.

---

## T086 — CLAUDE.md ground (M-01) + decisions-backlog §9 disclaimer (P-04) + D4/D5/D6

**Claim 1 — CLAUDE.md no longer claims E6 is UNSTARTED; 013 is recorded as in progress.**
```
$ grep -n "E6.*UNSTARTED\|is UNSTARTED" CLAUDE.md
(no output — grep exit code 1)
$ grep -n "mid-flight\|013-audit-remediation is in progress" CLAUDE.md
74:**E6 is no longer UNSTARTED (corrected 013 audit remediation, M-01)** — 012-e6-billing (billing — Mercado
75:Pago recurring / Play Billing) is **mid-flight** on `feature/012-e6-billing`, 31 commits ahead of `develop`,
78:**013-audit-remediation is in progress** (branch `013-audit-remediation`) — the 10-specialist audit's
137:(previous increment 012-e6-billing remains mid-flight on `feature/012-e6-billing`,
```
The "31 commits ahead" figure was re-measured, not assumed:
```
$ git rev-list --count develop..feature/012-e6-billing
31
```

**Claim 2 — the spec-kit pointer block at the bottom of CLAUDE.md (owned by the main loop) is untouched.**
```
$ git diff CLAUDE.md | grep -A6 "SPECKIT START"
(no hunk touching the SPECKIT START/END block — only the ground paragraph above it changed)
```

**Claim 3 — `decisions-backlog.md`'s disclaimer now covers §9.**
```
$ grep -n "§9 L92" docs/decisions-backlog.md
20:> - **§9 L92 — deploy target (added 013 audit remediation, P-04):** **DECIDED** = Cloud Run (backend) + ...
```

**Claim 4 — D4/D5/D6 recorded.**
```
$ grep -n "D4 — Empty BOM" specs/008-e3-multi-piece-bom/spec.md
76:- **D4 — Empty BOM (zero lines, E3-04 edge case above): server REJECTS, does not permit.** ...
$ grep -n "^| TD-02[3-5] " docs/tech-debt.md | cut -c1-14
38:| TD-023 |
39:| TD-024 |
40:| TD-025 |
```
`TD-023` (added earlier this session by another agent) is untouched at line 38; `TD-024` (D5, PWA
`autoUpdate`) and `TD-025` (D6, single-tab outbox premise, with a telemetry-shaped re-open trigger) are
appended after it, not inserted before or renumbering it.

---

## Discrepancies between the audit's description and what was actually found

- **T084 / F-03**: the audit says `auth.py`'s docstring is "consumed by 14 files"; the reproducible grep
  above finds **11** real consumer files (9 `api/*.py` routers + `entitlement/__init__.py` + the 2 direct
  importers `me.py`/`fee_catalog.py` already counted among the 9... concretely: 11 files total, listed above,
  excluding `auth.py` itself). The exact count could not be reproduced — recorded here rather than silently
  matched to "14". The underlying claim (the docstring's "no consumer yet" is false) is unaffected and fully
  confirmed.
- **T085 / §4 vs §6.1**: the task names "§4 and §6.1" as where the UNIQUE-name drift lives; the actual
  drifted occurrences in `data-model.md` are in **§5 (Indices table)** and **§6 (Migration `0003` outline)**
  — there is no §6.1 subsection in the document. Both real occurrences were corrected; the section numbers
  in the task description do not match the document's actual structure.
- Every other claim in T081–T086 matched the audit's description as given; no other spurious findings.
