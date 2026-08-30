# DoD Evidence — <increment id> (<date>)

Paste this block into the increment's PR. Visual homologation is **advisory now, gating later** (V2): the
screenshots + the owner's confirmation are the record, not a hard CI block — yet.

## Gates (paste command output / links)
- [ ] `pnpm gate` green (format · lint+boundaries · depcruise · typecheck · coverage)
- [ ] backend gate green (ruff · ruff format · basedpyright strict · pytest · import-linter)
- [ ] CI run green (link): __________
- [ ] Coverage ratchet not lowered (pricing-core ~100%): __________
- [ ] No secret committed (gitleaks/trufflehog clean)

## Tests
- [ ] Logical tests written first and passing (list new/changed): __________
- [ ] Contract drift-guard green (Orval regen + `git diff --exit-code`)

## Visual homologation (qa-produto, V1)
- [ ] Screenshots attached at **mobile ≤414px** and **desktop**: __________
- [ ] Preliminary verdict (qa-produto): pass / issues → __________
- [ ] **Owner (Jonatan) confirmation**: confirmed / changes requested → __________

## Constitution check
- [ ] Principles I–VIII clean. In particular **VIII**: every structural/architectural/communication/standard
      choice traces to an ADR or a recorded decision round — nothing inferred.
- [ ] Spec/docs updated and lean (no dead rules).

## Manual prerequisites touched (if any)
- [ ] Firebase project / GCP / WIF / secrets actions needed from Jonatan: __________
