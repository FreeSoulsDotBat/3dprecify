# Tasks: Token-Cost Optimization of the Dev Workflow (011)

**Input**: Design documents from `specs/011-token-optimization/`

**Prerequisites**: plan.md · spec.md (Clarifications ratified 2026-07-18) · research.md (devops Q1–Q9, risks
R1–R5) · data-model.md (6 governance objects) · quickstart.md (evidence walkthrough) · ADR-0022 (Proposed)

**Tests**: Constitution Principle III applies as **evidence-first**: 011 ships no product code, so each story's
"tests" are the quickstart evidence procedures — defined BEFORE wiring, exercised as proof, artifacts to the
PR's dod-evidence. `pnpm gate:all` itself must stay byte-identical (FR-011) — it is the subject, not the tool.

**Organization**: by user story, sequenced into the owner-authorized PR slices: **PR-A** = Phase 1–3 (US1 + US5
draft), **PR-B** = Phase 4–6 (US2 + US3 + US5 final), **PR-C** = Phase 7 (US4 verdict; opens with the baseline
BEFORE E5's first treatment op). US6 (P3) rides whichever PR has budget or is explicitly deferred.
**Decisão do dono 2026-07-19: os slices consolidaram num único PR #22** (A + B + baseline do C); a homologação
cobre o conjunto, T032–T034 fecham no E5 — ver `dod-evidence.md` §Processo.

## Format: `[ID] [P?] [Story] Description`

---

## ⚠️ GUARDRAILS PARA O IMPLEMENTADOR (leia antes de qualquer task — regras absolutas)

Estas regras existem porque um implementador que "preenche lacunas" quebraria decisões ratificadas do dono.
Na dúvida, **PARE e pergunte ao Jonatan** — parar é sempre aceitável; improvisar nunca é.

1. **NUNCA use `rtk init --global` / `-g`.** A decisão ratificada Q2 é escopo por-projeto. Se o modo
   per-project não funcionar, isso é um achado para reportar (T015), não uma licença para instalar global.
2. **NUNCA re-pine `designer-ux`.** A pesquisa (`tokenoptimization.md` §C.2/C.3) lista `designer-ux → sonnet`;
   essa recomendação foi **REVERTIDA** pelo dono (Q1). Só 7 arquivos mudam: os 6 executores + `qa-produto`.
   `arquiteto`, `seguranca`, `product-owner`, `designer-ux` ficam **intocados**.
3. **NUNCA toque em `pnpm gate:all`**, no bloco `pre-push` do `lefthook.yml`, no workflow de CI, ou em
   qualquer arquivo sob `apps/`, `backend/`, `packages/`. 011 não muda o que executa — só o que o modelo vê.
4. **NUNCA use `git add -A` / `git add .`** — a árvore de trabalho contém artefatos do épico 010 (E5) que NÃO
   pertencem aos PRs da 011. Faça stage APENAS dos caminhos listados na task de commit de cada PR.
5. **STOP-gates explícitos** (a task diz PARE — então pare e reporte): T015 (R1 — filtragem não ativou),
   qualquer `git log develop..HEAD` não-vazio no T001, qualquer diff inesperado no `.claude/settings.json`
   no T014, e toda autorização de push/merge (Jonatan autoriza cada uma — nunca faça push sem pedir).
6. **Passos humanos**: reiniciar a sessão do Claude Code (T014→T015) só o Jonatan pode fazer. Termine o turno
   pedindo o restart; NÃO simule o resultado nem prossiga sem ele.
7. **Números de custo = harness, nunca auto-estimativa.** Ao registrar linhas no ledger, use os tokens
   reportados pelo harness (`<usage>` das task results); a lição registrada é que auto-estimativa erra ~2×.
8. **Fatos vs. suposições**: `research.md` marca itens `A-VERIFICAR-NA-IMPLEMENTAÇÃO`. Quando você verificar
   um, registre o resultado real (mesmo que contradiga a expectativa) em `dod-evidence.md`. Um resultado que
   contradiz o research é um achado, não um erro seu.
9. **Não invente flags/comandos de rtk ou graphify.** Se um comando documentado aqui não existir na versão
   instalada, rode `--help`, registre a divergência e pare se ela afetar a task.

---

## Phase 1: Setup

**Purpose**: branch + machine preconditions + governance skeleton already drafted in the plan round

- [x] T001 Create branch `feature/011-token-optimization` from `develop` — **procedimento exato, a árvore
      mistura artefatos 010 e 011**: (a) confirme `git log develop..HEAD --oneline` **vazio** na branch atual
      `feature/010-e5-saved-scenarios` (se houver commits, PARE e pergunte); (b) `git checkout -b
      feature/011-token-optimization develop` (untracked e modificados viajam junto — esperado); (c) os
      arquivos da **011** que este épico commita: `specs/011-token-optimization/**`,
      `docs/product/011-token-optimization-scope-brief.md`, `docs/adr/0022-*.md`, a linha 0022 em
      `docs/adr/README.md` (stage por hunk — o arquivo também tem a linha 0021 do épico 010, que NÃO entra),
      as linhas 2026-07-18 de `docs/token-ledger.md` (idem, por hunk), `CLAUDE.md` (ponteiro SPECKIT + os
      blocos das tasks T007/T026) e `.specify/feature.json`; (d) **NUNCA** stage: `specs/010-**`,
      `docs/adr/0021-*.md`, `docs/product/e5-scope-brief.md`, `e5-calcular-390.png`, `.playwright-mcp/`
      (pertencem ao épico 010 e ficam uncommitted na árvore)
- [x] T001b [P] Vendorizar a pesquisa-fonte: copiar `C:\Users\Jonatan\Downloads\tokenoptimization.md` para
      `specs/011-token-optimization/token-optimization-research.md` (Downloads é volátil; ADR-0022 e o spec a
      citam como fonte primária — a cópia no repo é o registro durável; NÃO editar o conteúdo)
- [x] T002 [P] Re-verify machine preconditions and record in dod-evidence: `rg --version` (14.1.1 expected),
      `graphify --version` (0.9.12), `.git/hooks/post-commit`+`post-checkout` absent, `git config
      core.hooksPath` unset (research Q4/Q9 re-run)
- [x] T003 [P] Register ADR-0022 in the index `docs/adr/README.md` (status Proposed, pattern of ADR-0021's row)
      and cross-check its routing table against the ratified spec Clarifications (esp. the designer-ux=opus
      divergence from research §C.2/C.3 — the ADR must flag it, per data-model.md §1 invariant)

**Checkpoint**: branch exists, ADR-0022 indexed, machine facts pinned.

---

## Phase 2: Foundational

**Purpose**: nothing blocks beyond Setup — 011's levers are deliberately independent (the epic's design).
No foundational tasks. **Checkpoint**: immediate.

---

## Phase 3: User Story 1 — Route each agent to the cheapest model that does its job (P1) 🎯 MVP · PR-A

**Goal**: 6 executors → `sonnet`+`effort: medium`, `qa-produto` → `haiku`+`effort: low`, judgment +
`designer-ux` untouched; delegation + escalation rules in CLAUDE.md. Starts saving immediately.

**Independent Test**: quickstart §1 — `git diff` shows exactly 7 agent files / one line per field; 4 untouched;
rules present; one rollback exercised; a re-pinned agent demonstrably runs the cheap model.

### Evidence-first for US1 ⚠️

- [x] T004 [US1] Write the PR-A evidence checklist into `specs/011-token-optimization/dod-evidence.md`
      (quickstart §1 items 1–5 as empty slots) BEFORE editing any agent — the proof shape precedes the change

### Implementation for US1

- [x] T005 [P] [US1] Re-pin the 6 executors — add `effort: medium` and set `model: sonnet` in
      `.claude/agents/{dev-backend,dev-frontend,dev-estrutura-de-dados,devops,qa-software,scrum-master}.md`
- [x] T006 [P] [US1] Re-pin the observer — set `model: haiku` + `effort: low` in `.claude/agents/qa-produto.md`
      (file has no `tools:` line by design — do not add one)
- [x] T007 [US1] Add to `CLAUDE.md`: (a) o bloco de delegação + escalação **verbatim do ADR-0022 §Decision.2**
      (é o snippet exato já decidido — copie-o, não o reescreva); (b) UMA frase na ground line resolvendo a
      contradição com "Next increment: E5 … UNSTARTED": registrar que **011-token-optimization está em voo
      ANTES do E5 por decisão do dono (2026-07-18)** e que o E5 segue na fila como piloto de medição
- [x] T008 [US1] Exercised rollback: revert `qa-software` to opus, show the one-line diff, re-apply
      (SC-008 evidence)
- [x] T009 [US1] Smoke com método concreto: spawn `qa-software` com o prompt "Responda APENAS: qual model id
      aparece no seu system prompt ('You are powered by...')? Não faça mais nada." — a resposta deve conter
      `sonnet` (e para `qa-produto`, `haiku`); anexe a resposta + a linha `<usage>` do harness ao dod-evidence
      (quickstart §1.5). **FATO MEDIDO 2026-07-18 (primeira execução): o registry de agentes carrega no INÍCIO
      da sessão e não faz hot-reload — spawns na mesma sessão dos edits T005/T006 responderam opus com o
      frontmatter já correto em disco. T009 só prova algo NUMA SESSÃO REINICIADA depois dos edits** (mesmo
      passo humano do T014→T015). Se após restart ainda indicar opus, aí sim o pin não pegou: reporte
- [x] T010 [US1] Ledger row for PR-A's own operations (estimate → actual, owner's 2026-07-10 rule) in
      `docs/token-ledger.md`

**Checkpoint**: PR-A demoable — routing live, governance drafted, rollback proven. Owner homologates ADR-0022
routing section here.

---

## Phase 4: User Story 2 — Filter command output before it reaches the model (P1) · PR-B

**Goal**: rtk v0.43.0, project-scoped, filtering Bash output downstream of execution; tee failures; excludes;
honesty guard proven. **R1 (Windows auto-rewrite) is the epic's highest risk — proven FIRST, STOP on failure.**

**Independent Test**: quickstart §2 — raw-vs-filtered `gate:all` (incl. deliberate failure) preserves
conclusion + actionable errors; tee recovery works; exclusions pass through; other repos untouched.

### Evidence-first for US2 ⚠️

- [x] T011 [US2] Extend dod-evidence with the §2 slots (R1 proof · honesty guard · tee recovery · exclusion ·
      scope proof · rollback) BEFORE installing anything

### Implementation for US2

- [x] T012 [US2] Install binary: download `rtk-x86_64-pc-windows-msvc.zip` (release v0.43.0) → `rtk.exe` on
      PATH → sanity `rtk --version` (0.43.0) + `rtk gain` (crates.io name-collision check, research Q6); rode
      `rtk init --help` e registre as flags reais (existe `--hook-only`? existe algo que gere RTK.md/edite
      CLAUDE.md? — se o init for criar arquivos de instrução além do hook, use a flag que instale SÓ o hook)
- [x] T013 [US2] Config: `rtk config --create` / `rtk config` → record the real Windows config path (expected
      `%APPDATA%\rtk\config.toml`, research Q2); write `[hooks] exclude_commands = ["graphify","gh","curl"]`
      (**nomes planos** — a forma documentada do README; os `^`-regex do research eram palpite não verificado)
      + `[tee] enabled=true, mode="failures", directory="D:/projects/3dprecify/.rtk-tee"` (**barras normais**
      no TOML, nunca `\` sem escape); add `.rtk-tee/` to `.gitignore`
- [x] T014 [US2] Hook: `rtk init` (NO `--global`, Q2 ratified) from repo root → diff `.claude/settings.json`:
      new PreToolUse/Bash block present AND the PostToolUse quality-gate block **byte-identical** (research Q5
      open item; qualquer outro diff inesperado = PARE e reporte). **Depois, PASSO HUMANO: termine o turno
      pedindo ao Jonatan para reiniciar a sessão do Claude Code** (o hook só ativa em sessão nova); T015 roda
      na sessão reiniciada
- [x] T015 [US2] **R1 GATE — first executable proof (na sessão reiniciada)**: rode `git status` e um subset de
      pytest via Bash e verifique com sinais determinísticos se a filtragem ativou: (a) `rtk gain --history`
      lista os comandos recém-rodados (hook interceptou) e (b) o output visível no tool result está reduzido
      vs o mesmo comando rodado por fora (compare com o output que o Jonatan rodar no terminal, ou com
      `rtk git status` explícito vs `command git status`). Se o hook NÃO interceptou (history vazio / output
      integral): teste as contingências (`rtk hook claude` delegator / caminho Git Bash), e se nenhuma ativar
      **STOP and reopen US2 with the owner** — no later §2 task counts until filtering is real (quickstart §2.5)
- [x] T016 [US2] Honesty guard (FR-006/SC-002): `pnpm gate:all` raw vs filtered — same exit code, hashed
      artifacts identical, same conclusion; then break one test deliberately **escolhendo uma falha com output
      verboso (≥500 bytes — o tee ignora outputs menores, research Q3)**, rerun filtered: actionable error
      visible in reduced view AND integral output recoverable from `.rtk-tee/` (FR-004/SC-003); revert the break
- [x] T017 [P] [US2] Exclusion pass-through proof: `graphify query`, `gh pr list`, `curl` arrive unfiltered
      (quickstart §2.7)
- [x] T018 [P] [US2] Scope proof (Q2): in a second repo without the hook, commands untouched + no rtk block in
      its `.claude/settings.json` (quickstart §2.8)
- [x] T019 [US2] Exercised rollbacks: one-line `exclude_commands` add proven; full teardown dry-run
      (documented uninstall path) + re-init (SC-008) — **COMPLETO 2026-07-19: (a) exercitado limpo; (b)
      teardown vivo exercitado com o dono presente aprovando os edits — round-trip byte-idêntico (MD5),
      passthrough provado no teardown, re-interceptação provada no re-init; ver dod-evidence §2**
- [x] T020 [US2] Document the tee path + rollback lines in ADR-0022 (FR-004 "path documented"; R2 note: excludes
      live per-user but are inert outside this repo)

**Checkpoint**: US2 provably filtering (or honestly stopped at T015 with the finding escalated).

---

## Phase 5: User Story 3 — Keep the knowledge graph fresh automatically (P2) · PR-B

**Goal**: `graphify hook install` (post-commit/post-checkout) as primary refresh; lefthook invariant guard;
staged retirement of the `post-merge` net; ADR-0014 amended.

**Independent Test**: quickstart §3 — commit triggers rebuild (~20s, 0 LLM tokens); hook survives
`pnpm install`; uninstall falls back cleanly.

### Evidence-first for US3 ⚠️

- [x] T021 [US3] Extend dod-evidence with the §3 slots (install · rebuild timing · survival · retirement ·
      rollback) BEFORE installing the hook

### Implementation for US3

- [x] T022 [US3] `graphify hook status` (before) → `graphify hook install` → inspect and record
      `.git/hooks/post-commit` + `post-checkout` contents (research Q7 open item)
- [x] T023 [US3] Rebuild proof: trivial commit → graph rebuilds (~20s measured, `graphify-out/` mtime,
      `cost.json` unchanged = 0 LLM tokens) (SC-005)
- [x] T024 [US3] Survival proof (research Q8): `pnpm install` (fires `lefthook install` via `prepare`) →
      graphify's hooks byte-identical after
- [x] T025 [US3] Staged retirement (plan decision 2): add the invariant comment to `lefthook.yml` (never
      declare `post-commit`/`post-checkout` — Option C guard), remove the `post-merge` graph-refresh block,
      **e delete `scripts/graph-refresh.sh`** (fato verificado 2026-07-18: `pnpm graph:update` chama
      `graphify update .` direto — package.json:23 — então após a aposentadoria o script não é referenciado
      por nada; confirme com `grep -rn "graph-refresh" .` excluindo node_modules/.git antes de deletar) —
      tudo neste mesmo PR, ONLY after T023–T024 pass on this machine
- [x] T026 [US3] Amend ADR-0014's refresh clause (graphify hook primary · AI close-out procedure
      `pnpm graph:update` retained as documented fallback · no silent supersession) per ADR-0022's amendment
      text; update the CLAUDE.md graphify freshness paragraph to match
- [x] T027 [P] [US3] Pilot-only query-log: `setx GRAPHIFY_QUERY_LOG_ENABLE 1` (env de usuário — sessões novas
      herdam; a sessão corrente não, e tudo bem: o piloto são as sessões do E5); registre em dod-evidence a
      linha de teardown (`setx GRAPHIFY_QUERY_LOG_ENABLE ""` ou remoção via Painel) e o ponto de decisão
      (Q5 → resolved at PR-C verdict)
- [x] T028 [US3] Exercised rollback: `graphify hook uninstall` → `hook status` clean → re-install (SC-008)

**Checkpoint**: refresh deterministic on commit; old net retired without a freshness gap.

---

## Phase 6: User Story 5 — Govern every change with ADR-0022 + rollback playbook (P2) · PR-B close

**Goal**: ADR-0022 complete and internally consistent with everything actually shipped; every playbook line
exercised.

**Independent Test**: ADR-0022 in the index with ≥3 options + confidences; ADR-0014 amendment merged; the three
rollback lines each have an "exercised on <date>" evidence pointer.

- [x] T029 [US5] Finalize ADR-0022 against reality: fold in T013's real config path, T015's R1 outcome, T025's
      retirement, the exercised-rollback dates (T008/T019/T028); reconcile any drift between Proposed text and
      shipped mechanics (no aspirational claims — Constitution II)
- [x] T030 [US5] Ledger row for PR-B's own operations (estimate → actual) in `docs/token-ledger.md`

**Checkpoint**: PR-B demoable — owner homologates; ADR-0022 → Accepted, ADR-0014 amendment live.

---

## Phase 7: User Story 4 — Prove the saving on E5 against the E4 baseline (P1) · PR-C

**Goal**: the meter. Baseline fixed BEFORE E5's first treatment operation; one row per E5 slice; honest verdict.

**Independent Test**: quickstart §4 — a reader of the ledger alone can reproduce the verdict: baseline table,
per-slice rows (estimate → actual + labeled rtk-gain), effective Δ% with caveats, controls never averaged in.

- [x] T031 [US4] Fix the baseline table in `docs/token-ledger.md` per data-model.md §5 (treatment vs control
      shapes; E4 comparables by shape; uncapped E4 PR-A 4.87M excluded) — **hard ordering: lands before E5's
      first implementation slice starts** (it may land with PR-B if E5 is imminent) — **fixada 2026-07-19
      na seção "Baseline do piloto 011" do ledger, incl. os limites de atribuição (rtk=Bash-only ·
      tokenizer ~+30% · expiração do preço intro) e o resultado do R1-gate**
- [x] T032 [US4] Per E5 slice (PR-A/PR-B/PR-C of 010): estimate row before the slice, actual (harness tokens,
      never agent self-estimate) + `rtk gain` snapshot (labeled auxiliary) after — three rows total, written as
      the pilot runs
- [x] T033 [US4] Pilot verdict at E5 close: measured effective Δ% per treatment shape vs comparable, quality
      outcome per slice (homologation verdict + gate), caveats disclosed (Sonnet tokenizer ~+30% · intro-rate
      expiry 2026-08-31), responsible lever named on any shortfall; controls reported separately (SC-006/SC-007);
      resolve Q5 (query-log keep-or-drop) from the pilot data. **Caso alavanca-ausente**: se a US2 parou no
      R1-gate (T015), o veredito mede SÓ routing (+graphify) e diz isso explicitamente — não atribua ao rtk
      economia que ele não produziu, e não trate o alvo ≥30% como se todas as alavancas estivessem ativas
- [x] T034 [US4] If any layer regressed: execute that layer's playbook line and record it; if none, state so
      explicitly (a null result is a result — Constitution II)

**Checkpoint**: PR-C closes the epic with a measured, honest verdict.

---

## Phase 8: User Story 6 — Secondary trims (P3, droppable) · rides any PR with budget

- [x] T035 [P] [US6] Pin `.mcp.json` browser MCPs off `@latest` to exact versions (playwright MCP +
      chrome-devtools MCP); verify `qa-produto` still drives the browser; OR record the explicit deferral note
      in dod-evidence (FR-013) — **pinado (0.0.78 / 1.6.0); verificação do browser fica para a 1ª sessão
      pós-restart (mesmo mecanismo snapshot-por-sessão), slot = 1ª homologação qa-produto do E5**

---

## Phase 9: Polish & Cross-Cutting

- [x] T036 Boundary re-checks (quickstart §5): `lefthook.yml` pre-push + CI workflow still literal
      `pnpm gate:all` (FR-011/SC-009); full gate green; drift-guard silent (no backend change) —
      **literais confirmados + drift-guard silencioso; gate-green LOCAL bloqueado por artefato uncommitted
      do épico 010 (`.playwright-mcp/*.yml`, pré-existente, registrado no T016) — re-checa no CI do PR**
- [x] T037 [P] Update the CLAUDE.md ground line (E-pattern close-out): 011 status + pointer to dod-evidence;
      `.specify/feature.json` back to `specs/010-e5-saved-scenarios` so E5 resumes as the active feature —
      **EXECUTADO 2026-07-19 no próprio PR #22** (ground line reescrita: alavancas landed + veredito pendente
      no E5; feature.json → 010). O ponteiro SPECKIT do rodapé segue em `specs/011-token-optimization/plan.md`
      até o fluxo speckit do E5 retomá-lo — apontar para `specs/010-**` agora referenciaria um caminho ainda
      não commitado (os artefatos do 010 vivem uncommitted na árvore)
- [x] T038 Graph refresh after merge to `develop` — **premissa corrigida 2026-07-19 (ADR-0022 §Amendment
      addendum)**: MEDIDO que `git pull` fast-forward DISPARA `post-merge` nesta máquina (git 2.45.1,
      `pull.rebase=false`) — a rede lefthook `post-merge` → `graph-refresh.sh` foi re-adicionada e é o
      caminho determinístico esperado para o pull do squash-merge em develop. **PROVADO NO EVENTO REAL
      2026-07-19 (merge do próprio PR #22, ff `149c36f..bcbdfe2`): a rede post-merge disparou sozinha —
      `graphify update .` rodou ~26s / 0 tokens / 4898 nós, sem `pnpm graph:update` manual; registro
      completo em dod-evidence §3.** Doc/spec ingestion semântica continua com o caminho da skill

---

## Dependencies & Execution Order

- **Phase 1 → Phase 3** (PR-A): T004 before T005–T007; T008–T010 after.
- **Phase 4 (US2)**: T011 → T012 → T013 → T014 → **T015 (R1 GATE — blocks T016–T020)**.
- **Phase 5 (US3)**: T021 → T022 → T023 → T024 → T025 (retirement ONLY after 23–24 pass) → T026; T027–T028
  parallel-friendly. US2 and US3 are independent of each other; both need Phase 1 only. US3 does NOT need US2.
- **Phase 6**: T029 after T015/T019/T025/T028 outcomes exist.
- **Phase 7**: T031 before 010's first implementation slice (hard external ordering); T032 during E5; T033–T034
  at E5 close. Depends on PR-A (routing live) and ideally PR-B (rtk live) for the pilot to measure all levers.
- **US6/Polish**: anytime after PR-A; T036–T038 at each PR close as applicable.

### Parallel opportunities

- T002 ∥ T003 (Setup). T005 ∥ T006 (different files). T017 ∥ T018 (independent proofs). T027 ∥ T028. T035
  anytime. Within PR-B, US2 (T011–T020) and US3 (T021–T028) can interleave — different surfaces
  (settings/config vs git hooks) — but land in one PR per the slicing.

---

## Implementation Strategy

**MVP = Phase 1 + Phase 3 (PR-A)**: routing alone already cuts price/token on every subsequent operation and
is fully demoable + reversible. Then PR-B adds the two mechanical levers with their proofs (R1 gate can
honestly stop US2 without sinking the PR — US3 stands alone). PR-C is the meter and closes only after the E5
pilot runs. Each PR is owner-homologated before merge (E-pattern); Jonatan authorizes every push/merge.
