# Token-spend ledger

Owner rule (2026-07-10): every AI operation that costs real tokens — semantic extraction,
subagent fan-outs, multi-agent workflows — appends a row here. Estimate **before** running,
record the actual **after**, and write down the lesson when they diverge. graphify runs also
mirror into `graphify-out/cost.json` (local, gitignored — this file is the durable record).

| Date | Operation | Estimate | Actual | Lesson |
| --- | --- | --- | --- | --- |
| 2026-07-10 | graphify initial full build — semantic extraction of docs + community labeling | — | 107,249 in / 9,827 out | Baseline; code was AST-only (0 tokens). Semantic cache was NOT persisted by this run (fixed 2026-07-10). |
| 2026-07-10 | graphify item-6 ingestion — 26 curated docs (specs/008 + ADRs 0014–0016 + business-rules + CLAUDE.md + 11 agents), 2 subagents | ~10–15k | 216,831 (aggregate in+out) | Word-count estimates undershoot ~15×: subagent read+reason+write overhead dominates, not the doc text. Estimate ≈ corpus tokens × 10 for subagent extraction, or use `GEMINI_API_KEY` to move it off-session. |
| 2026-07-10 | 008 T001 designer-ux UX handoff — 1 subagent reads spec/contracts/quickstart + E2 `ux-catalog.md` pattern, writes `ux-bom.md` | ~100–150k aggregate (corpus ×10 rule from item-6 lesson) | 111,338 (25 tool uses, ~8min) | Corpus ×10 rule held. Handoff surfaced 2 owner flags (5th nav tab; lapsed-at-/bom split) — carried to PR evidence. |
| 2026-07-11 | 008 T005 pre-gate: arquiteto decision — where the shared piece-form lives (C1: page-composition vs entities/piece move vs page-hosted composer) | ~80–120k aggregate | 121,952 (23 tool uses, ~10min) | Slightly over estimate (agent also root-caused a transient hook block). Decision: page/widget-hosted composition (R7 in research.md), 85%. |
| 2026-07-11 | 008 T006b qa-produto visual homologation — browser walk of /bom (390px + desktop, compose/rollup/teaser) + screenshots | ~150–250k aggregate (browser tool calls dominate) | 162,607 (128 tool uses, ~21min) | Within estimate. Verdict PASS-with-nits; top nit (skippedLines caption unreachable via form) answered with a component-level contract test + PR note. |
| 2026-07-11 | 008 K-amendment plan delta: arquiteto decisions R8 (route naming, atomic materialization txn + wire shape, FR-310 relaxation seam, manual-product state, nav icon, PR slicing) + ADR draft | ~100–140k aggregate (R7 was 122k, similar shape + one ADR) | 128,197 (34 tool uses, ~11min) | On estimate. R8 + ADR-0017 (Proposed) + one data-model premise change caught by reading code (bom_lines born with product_id). |
| 2026-07-11 | 008 T009 pre-push extensive review (owner-conditioned): 6-dimension multi-agent workflow (arch/clean-code/bugs/decisions/security/tests) + adversarial verify of blocker/major findings | ~600–900k aggregate (6 finders ×~90k + refuter pairs) | 1,042,131 (10 agents, 319 tool uses, ~14min + paused/resumed via workflow cache) | ~15% over: finders averaged ~150k (whole-branch mandates read far more than a diff review). Yield: 2 CONFIRMED majors (guard tear-down; prefill coverage) + 12 minors — the fan-out paid for itself. |
