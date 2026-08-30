# Contrato: `fee-refresh.yml` + `loop-liveness` (o que YAML pode e o que não pode)

## `fee-refresh.yml` (NOVO)

- **Gatilhos**: `schedule: cron "0 6 1 * *"` + `workflow_dispatch` (com input
  `allow_freshness_exemption`, padrão `false`).
- **CABEÇALHO OBRIGATÓRIO** (US1/AC1 — RA1): comentário declarando que o `schedule` lê do branch
  DEFAULT (`main`) e que, até o corte de release, o laço NÃO dispara sozinho — o gatilho real é
  o manual. Um leitor do arquivo não pode sair achando que o laço está vivo.
- **Jobs** (decisão A — explícitos, nunca matriz): `amazon-tabela` (headless pinado) ·
  `amazon-precos` (fetch simples) · `shopee` (headless + tesseract.js) · `ml-vigias` (fetch) ·
  `publicar` (`needs: [todos]`, `if: always()`), o ÚNICO com
  `permissions: contents: write, pull-requests: write` — os demais `contents: read`.
- **O que um job PODE**: `checkout`, setup pinado por SHA (I8), `node …mjs`, upload de artefato,
  e (só o `publicar`) `gh pr create/list`. **O que NENHUM job pode**: decidir conteúdo de
  relatório ou dinheiro em shell/`if:`; `continue-on-error` como independência; heredoc de corpo
  de PR; `secrets.` além de `GITHUB_TOKEN`.
- **Idempotência**: branch `bot/fee-refresh-<data>`; `gh pr list --head … --state open` antes de
  criar; `pnpm fee:build` 2× com `git diff --exit-code` na segunda.
- **Validação no job** (clarify Q6): `pnpm gate:artifact` — o MESMO script que um humano roda;
  membresia derivada pela convenção `*.artifact.test.ts` + meta-guarda.
- **Boot honesto**: todo `.mjs` novo é executado sob `node` puro no job (não só sob vitest).

## `ci.yml` — job `loop-liveness` (decisão G; clarify Q7)

- Sem segredo, sem rede, sem `gh api`: lê `backend/app/data/catalog.json`, calcula
  `hoje − max(lastReviewed)` restrito à `MARKETPLACE_COVERAGE`.
- `> 35 dias` (código: `LOOP_CYCLE_DAYS 31 + 4` folga; 35 < 45 do selo) ⇒ `::warning::` + step
  summary, **`exit 0`** — não-bloqueante, FORA do `needs` do `ci-pass`.
- Nunca-coletado/cobertura vazia ⇒ mensagem própria nomeando o caso.

## Auditoria estrutural (FR-1003/SC-1005 — `workflow-audit.test.ts`)

Lê `.github/workflows/` por `fs` e afirma: (1) zero `secrets.` em `fee-refresh.yml` além de
`GITHUB_TOKEN`; (2) zero `secrets.ML_*` em QUALQUER workflow — verdade repo-wide que só nasce
apagando as sondas (`g1-probe-ml.yml`/`g2-probe-amazon.yml` + `scripts/probes/`, PR-A, decisão
H; a medição delas está preservada no ADR-0010 §A13); (3) `fee-refresh.yml` declara os dois
gatilhos e o cabeçalho RA1 contém a frase da manualidade.

## `scripts/check-action-pins.sh`

Ganha contagem CALCULADA de workflows (hoje imprime "os 5 workflows parseiam" cravado; com o
sexto arquivo a linha mentiria — J.6, mesma fatia).
