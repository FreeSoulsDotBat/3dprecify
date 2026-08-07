# Quickstart 017 — validação de ponta a ponta

Pré-requisitos: Node 24 + pnpm (raiz do repo). Nenhum segredo, nenhum Docker, nenhum Python.

## 1. O gerador local (o mesmo que o CI roda)

```bash
pnpm fee:build          # compor → validar → artefato + semente
git status --short      # esperado: limpo num mês sem mudança de fonte
pnpm fee:build          # 2ª passada
git diff --exit-code -- backend/app/data/catalog.json apps/web/src/shared/fee-catalog/seed.data.json
                        # esperado: exit 0 SEMPRE (ponto fixo — decisão C.4)
```

## 2. O subconjunto do gate (clarify Q6)

```bash
pnpm gate:artifact      # os *.artifact.test.ts — paridade de projeção (P0-a), ponto fixo,
                        # dominância de banda, cobertura, colisão de categoria
# prova de não-vacuidade: envenenar uma comissão no catalog.json ⇒ gate:artifact E gate:all vermelhos
```

## 3. A auditoria estrutural

```bash
pnpm --filter @3dprecify/fee-ingest test workflow-audit
# zero secrets. além de GITHUB_TOKEN em fee-refresh.yml; zero ML_* repo-wide; cabeçalho RA1 presente
```

## 4. A execução real (SC-1001 — fecha a fatia, não é opcional)

```bash
gh workflow run fee-refresh.yml --ref <branch>   # ou pela UI
gh run watch                                      # termina em PR ou ABORT nomeado
# evidência: URL da run + tempo/minutos faturados (US3/AC5) + artefatos de veredito baixáveis
```

Cenários de aceitação da run real: (a) coletor Amazon conclui LIDO ou ABORTADO nomeado; (b) as
linhas capturadas estão nos artefatos da run; (c) o corpo do PR declara os 3 estados de TODOS os
marketplaces; (d) `lastReviewed` só avançou nos relidos; (e) o resumo de job tem estado por
marketplace + link de fonte (US8/AC2).

## 5. Liveness (decisão G)

```bash
# num clone com lastReviewed envelhecido artificialmente >35d:
# o job loop-liveness imprime ::warning:: e sai 0; ci-pass não o lista em needs.
```
