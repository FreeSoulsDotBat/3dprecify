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
