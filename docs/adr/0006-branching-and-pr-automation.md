# ADR-0006: Branching model, PR automation, convention-only protection

**Status**: Accepted (2026-06-29) · **Deciders**: Jonatan + main thread · Refines ADR-0001, ADR-0005.

## Context
Jonatan wants a fixed branch flow with promotion automation. GitHub branch protection / rulesets return 403 on
a **private repo on the Free plan**; hard enforcement needs Pro or a public repo. Jonatan declined paying for
Pro and keeping the repo private. Decision taken with the owner (Principle VIII).

## Decision
### Branch flow (one direction only)
```
feature/*  →  develop  →  main  →  release
```
- `feature/*` (and `fix/*`, `chore/*`): all real work; run locally (emulator).
- `develop`: integration branch → **source for UAT** deploys.
- `main`: stable, homologated integration → gate before release.
- `release`: released code → **source for prod** deploys.

### Enforcement: convention-only (no hard lock)
- No Pro, repo stays private → **no branch protection**. The flow is a **documented rule** followed by the AIs
  and Jonatan. **Do not merge on red CI.** Honest caveat: nothing technically blocks a forced/wrong-base merge
  except discipline; revisit (Pro or public) when collaborators join.
- CI runs on PRs and on pushes to `develop`/`main`/`release`.

### PR automation (open only — never auto-merge, never auto-deploy)
- `.github/workflows/auto-pr.yml` triggers on **CI success** (`workflow_run`) for `develop`/`main`:
  - green on `develop` → auto-open PR **`develop → main`** (if none open).
  - green on `main` → auto-open PR **`main → release`** (if none open).
- `feature → develop` PRs are opened by the author (auto-opening every feature branch would be noise).
- Auto-opened PRs are **idempotent** (skip if one already exists) and are opened by `GITHUB_TOKEN` (they do not
  themselves re-trigger CI loops).
- **Activation:** `workflow_run` requires the workflow to live on the default branch — auto-PR activates once
  this lands on `main`.

### Deploys are MANUAL (ADR-0005 refined)
- Nothing deploys on merge. `deploy.yml` is **`workflow_dispatch`** with an `environment` choice
  (`uat` | `prod`); each is gated by its GitHub Environment + `DEPLOY_ENABLED=true`. `develop` is the intended
  UAT source, `release` the prod source, but shipping is always a deliberate manual trigger. Prod stays inert
  until launch.

## Consequences
- Clear, fixed promotion path with low ceremony; promotion PRs appear automatically when green.
- Discipline-dependent (no hard lock) until Pro/public — accepted trade-off for R$0.
- Deploy timing fully under Jonatan's control (cost + launch readiness).

## Alternatives rejected
- **GitHub Pro / public repo** for hard enforcement — owner declined cost / wants private.
- **Auto-deploy on merge** — owner wants manual control over spend and launch.
- **Auto-open feature→develop PRs** — noisy; left manual.
