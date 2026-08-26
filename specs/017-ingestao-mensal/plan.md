# Implementation Plan: Ingestão dinâmica mensal de tarifas (CI-first)

**Branch**: `017-ingestao-mensal` | **Date**: 2026-08-07 | **Spec**: `specs/017-ingestao-mensal/spec.md`

**Input**: spec pós-clarify (8/8) + `arquitetura-017.md` (decisões A–J, autoridade de desenho) +
brief do PO (`docs/product/017-ingestao-mensal-scope-brief.md`) + as 7 decisões do dono de
2026-08-05 (`docs/homologacao/OBTENCAO-DINAMICA-DADOS.md`) + ADR-0010 §A6/§A10/§A13/§A15/Adendo A14.

## Summary

O 017 transforma a lógica de ingestão que o 014 deixou testada (orquestrador puro `refresh.ts`,
coletor Amazon headless) num **laço mensal que roda no CI hospedado**: 5 jobs explícitos
(`amazon-tabela` · `amazon-precos` · `shopee` · `ml-vigias` · `publicar`), coletores que **emitem
fatia e nunca escrevem**, composição pura que valida ANTES de abrir o único PR mensal para
`develop`, corpo de PR que **assere ausência** e declara LIDO/ABORTADO/NÃO LIDO por marketplace,
vigias que não têm caminho de tipo até o dinheiro, e OCR da Shopee com motor fixado por lockfile
atrás de um detector content-addressed. A verdade central viaja no cabeçalho do YAML: **o laço é
manual até o corte de release** (o `schedule` lê do branch default `main`).

Pré-condições que quebram a primeira execução real se não vierem antes: **P0-a** (paridade
semente↔artefato vira RELACIONAL — hoje há literal de `catalogVersion` em teste, reeditada à mão
DUAS vezes em dois dias, medido), **P0-b** (ruleset de `develop` — tarefa do DONO; a dispensa
nasce DESLIGADA até lá), **P0-c** (o que resta do T069b sem credencial — ver research §R6:
`allowed_actions` do dono + CI independente via `gate:artifact` no job).

## Technical Context

**Language/Version**: TypeScript (Node 24) para toda decisão (`packages/fee-ingest`, ratchet
100% em `src/`); `.mjs` finos para CLIs (isentos de cobertura DE PROPÓSITO — nenhuma regra de
dinheiro neles, decisão H); YAML só orquestra (decisão A: zero lógica em YAML). **Zero Python
novo** (o artefato mora em `backend/app/data/` por contexto de build — ADR-0010 Adendo
2026-07-07 — sem tocar código Python).

**Primary Dependencies**: GitHub Actions hospedado (`ubuntu-latest`, actions pinadas por SHA —
guarda I8 existente) · Playwright/Chromium pinado (coletor Amazon, herdado do 014) ·
**`tesseract.js` 7.0.0 (WASM) como devDependency** sob o lockfile (decisão F — `apt-get`
PROIBIDO; traineddata é insumo fixado conferido por SHA-256) · `gh` CLI no job `publicar`
(único com `contents: write`/`pull-requests: write`).

**Storage**: arquivos versionados no repo — `backend/app/data/catalog.json` (artefato servido) ·
`apps/web/src/shared/fee-catalog/seed.data.json` (semente GERADA, decisão C — `seed.ts` vira
política+parse) · `packages/fee-ingest/data/*.baseline.json` (baselines datados dos vigias,
clarify Q1). Nenhum datastore, nenhum segredo novo.

**Testing**: vitest sob o ratchet 100% de `fee-ingest/src/` · `pnpm gate:artifact` com
**membresia derivada** (convenção `*.artifact.test.ts` + meta-guarda, decisão D) · provas por
MUTAÇÃO (PNG com dígito plausível trocado; artefato envenenado reprovando nos DOIS gates) ·
teste estrutural de segredos por `fs` sobre `.github/workflows/` · **todo `.mjs` novo bootado
sob `node` puro no próprio job** (lição 014/US4).

**Target Platform**: runner GitHub hospedado (G1/G2/G3 MEDIDOS no ADR-0010 §A13) + a mesma
máquina do dono para `pnpm fee:build` manual (decisão D: o job não roda nada que um humano não
rode igual).

**Project Type**: pipeline de dados CI-first sobre monorepo existente (sem tela, sem endpoint
novo, sem migração).

**Performance Goals**: caminho comum (11 meses/ano sem mudança de PNG) = **0 OCR, 0 tokens LLM**
(detector por `sha256(bytes)`, decisão F.2); premissa de custo ~5 min/mês do ADR-0010 §A4
**medida** na execução real (US3/AC5).

**Constraints**: SC-811 (0 tokens LLM; nenhuma linha no token-ledger por execução) · zero
`secrets.` além de `GITHUB_TOKEN` — repo-wide após apagar as sondas (decisão H/conflito 5) ·
fail-safe C6 (falha de leitura NUNCA vira mudança de tarifa) · I1–I9 do desenho (em particular
I9: artefato = ponto fixo do gerador, estendido a toda fonte).

**Scale/Scope**: 3 marketplaces servidos (80 entradas) + 1 vigiado (ML, 0 entradas) · 4
baselines de vigia · 5 jobs · 1 PR/mês no máximo.

## Constitution Check

- [x] **I. Scalability & Quality First** — fonte nova = job novo + fatia nova (topologia A3,
      linear); a tabela `MARKETPLACE_COVERAGE` é o único ponto de extensão declarado.
- [x] **II. Truth Over Approval** — verificações feitas, não assumidas: `tesseract.js` 7.0.0
      WASM/Node≥16 (verificado 2026-08-07), tesseract AUSENTE dos pré-instalados do runner,
      G2 medido 2×, `/precos` 200 sem navegador; a pendência `langPath` local está DECLARADA
      (research §R2) com a propriedade exigida escrita. O corpo do PR assere AUSÊNCIA; RA1–RA7
      listados com medição.
- [x] **III. Test-First** — cada US nasce com teste vermelho observado; as guardas conjuntivas,
      o classificador de dispensa e o compositor têm casos numéricos planejados (data-model §5);
      não-vacuidade por mutação é critério de tarefa (J.4).
- [x] **IV. Server-Side Entitlements** — n/a direto (nenhum caminho premium); o análogo aqui é
      Constituição II sobre dinheiro público + a regra de que o laço NUNCA auto-mergeia dinheiro.
- [x] **V. Clean Architecture Integrity** — reusa `refresh.ts`/`guardrails.ts`/coletor Amazon do
      014 (aciona, não reescreve); U4-f fecha colapsando as DUAS listas de inertes num módulo;
      as sondas descartáveis morrem (ADR-0010 §A13 já as declara descartáveis).
- [x] **VI. Lean Living Documentation** — runbook `docs/runbooks/fee-refresh.md` (US8);
      `OBTENCAO-DINAMICA-DADOS.md §8` ganha nota datada apontando o T057 (conflito 7 — âncoras
      NUNCA pinadas daquele parágrafo).
- [x] **VII. Spec-Driven Flow** — clarify 8/8 ANTES deste plan; /speckit-tasks e /speckit-analyze
      seguem; a spec permanece fonte da verdade.
- [x] **VIII. No Inference** — toda escolha estrutural traça para: arquitetura-017 A–J (com
      opções + confiança), ADR-0010 (CI-first, runner hospedado), as 7 decisões do dono
      (D7/D11 em particular) e a clarify 8/8. Itens que ficaram com o DONO estão nomeados:
      P0-b (ruleset), `OCR_DIVERGENCE_BANNER` (limiar proposto >30% rel. ou >R$ 5 abs. —
      ratificar no gate da PR-C), ADRs 0028/0029/0030 (Propostos → flip no gate, precedente
      ADR-0023/0026/0027).

## Project Structure

### Documentation (this feature)

```text
specs/017-ingestao-mensal/
├── spec.md              # pós-clarify 8/8
├── arquitetura-017.md   # decisões A–J (autoridade de desenho)
├── plan.md              # este arquivo
├── research.md          # Phase 0 — verificações e resoluções (R1–R7)
├── data-model.md        # Phase 1 — tipos, baselines, estados
├── contracts/
│   ├── verdicts-e-fatias.md   # CollectorVerdict · CatalogSlice · RunOutcome · compor()
│   ├── pr-mensal.md           # o contrato do corpo do PR (ausência asserida, 3 estados, banner)
│   └── workflow-yaml.md       # o contrato do fee-refresh.yml + loop-liveness (o que YAML pode)
├── quickstart.md        # validação: fee:build 2×, gate:artifact, execução real
└── tasks.md             # /speckit-tasks (próximo comando)
```

### Source Code (repository root)

```text
packages/fee-ingest/
├── src/
│   ├── refresh.ts               # EXISTENTE (014) — decideRefresh puro; ganha chamada por-marketplace
│   ├── guardrails.ts            # EXISTENTE — nextCatalogVersion continua a ÚNICA fonte da versão
│   ├── verdict.ts               # NOVO — CollectorVerdict (3 casos) + MARKETPLACE_COVERAGE
│   ├── slice.ts                 # NOVO — CatalogSlice + aplicarFatia (regra da folha lida)
│   ├── compose.ts               # NOVO — compor(base, slices[]) → RunOutcome (2 casos); 1 bump/execução
│   ├── seed-projection.ts       # NOVO — projetarSemente(servido) (política de poda DECLARADA)
│   ├── pr-body.ts               # NOVO — (vereditos, diff, vigias) → markdown (função pura)
│   ├── inert-fields.ts          # NOVO — a ÚNICA lista de campos inertes (funde refresh.INERT + catalog-diff.INERT_PATHS)
│   ├── exemption.ts             # NOVO — classificador de dispensa (diff inerte E conjunto de arquivos ⊆ par; nasce OFF)
│   ├── watch/
│   │   ├── amazon-precos.ts     # NOVO — vigia D7 (WatchReading; SEM função → FeeEntry)
│   │   ├── ml-vigias.ts         # NOVO — 3 textuais + frete 3×29×8 vs baseline
│   │   └── shopee-detector.ts   # NOVO — content-addressed sha256(bytes); gate do OCR
│   ├── ocr/
│   │   ├── ocr-shopee.ts        # NOVO — tesseract.js; traineddata conferido por hash
│   │   └── avaliar-ocr.ts       # NOVO — guardas conjuntivas (forma·sanidade·âncoras·cobertura)
│   ├── build.mjs                # NOVO — CLI: compor → validar → artefato + semente (pnpm fee:build)
│   └── workflow-audit.test.ts   # NOVO — zero secrets. além de GITHUB_TOKEN; zero ML_* repo-wide
├── data/
│   ├── amazon-precos.baseline.json
│   ├── ml-frete-{verde,amarela,vermelha}.baseline.json
│   ├── ml-textos.baseline.json
│   └── shopee-art26839.baseline.json   # âncoras T057 + endereços dos PNGs (verbatims MIGRAM p/ cá — RA4)
├── scripts/build-amazon.mjs     # EXISTENTE — migra de WRITER para EMISSOR DE FATIA (PR-A, não opcional)
apps/web/src/shared/fee-catalog/
├── seed.data.json               # NOVO — semente GERADA (JSON, nunca editada à mão)
├── seed.ts                      # ENCOLHE — política + parse + export
└── fee-catalog.test.ts          # P0-a: literal morre; 4 relações da decisão B (vira *.artifact.test.ts)
.github/workflows/
├── fee-refresh.yml              # NOVO — 5 jobs; cabeçalho declara o teto RA1; dispensa nasce OFF
├── ci.yml                       # ganha job loop-liveness (>35d, warning, exit 0, fora do ci-pass)
└── g1-probe-ml.yml, g2-probe-amazon.yml + scripts/probes/  # APAGADOS na PR-A (decisão H)
docs/runbooks/fee-refresh.md     # NOVO — US8
```

**Structure Decision**: toda decisão em `packages/fee-ingest/src` (TS, ratchet 100%, standalone
por depcruise `error`); `.mjs` finos; YAML só orquestra; baselines/âncoras em `data/`. É a
decisão H do desenho, sem opção alternativa em aberto.

## Fatiamento (o PO fatiou; o desenho não muda)

- **PR-A** — P0-a (guarda relacional/projeção, decisão B) + a espinha estrutural (verdict/slice/
  compose/pr-body/inert-fields/exemption OFF) + `build-amazon.mjs` vira emissor de fatia +
  `fee-refresh.yml` (jobs amazon-tabela + publicar) + sondas apagadas + `gate:artifact` +
  workflow-audit + **execução real com URL** (US1+US2+US3, SC-1001/1008).
- **PR-B** — vigia `/precos` (US4, decisão E) + `loop-liveness` (Q7, decisão G) + US7 completa-se
  com o segundo caminho de coleta (lastReviewed por-marketplace observável).
- **PR-C** — Shopee (US5, decisão F): detector + âncoras T057 no baseline + OCR + guardas +
  mutação + banner Q8 (limiar ratificado pelo dono no gate).
- **PR-D** — ML sem credencial (US6) + runbook/recibo (US8) + fechamento (medições, ADR flips no
  gate do dono).

## Complexity Tracking

Sem violação constitucional a justificar. Duas complexidades deliberadas, ambas com guarda:
a membresia derivada do `gate:artifact` (meta-guarda + mutação — RA7) e a semente gerada
(idempotência provada por 2ª passada + `git diff --exit-code` — decisão C.4).
