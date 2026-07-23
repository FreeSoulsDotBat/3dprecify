# Quickstart de Validação — 013-audit-remediation

Guia de prova por Success Criterion. Pré-requisitos: Node 24 + pnpm 11; uv + Python 3.12; Docker (testes DB); porta 4173 livre (armadilha conhecida: matar preview órfão antes de diagnosticar e2e).

## Gate integral (todo PR)

```bash
pnpm gate:all          # fe: format/lint/depcruise/typecheck/coverage · be: ruff/pyright/pytest/import-linter
pnpm e2e               # Playwright contra o emulador de auth
```

## SC-001 — parser adversarial (C-01)

```bash
pnpm --filter @3dprecify/web test -- decimal-ptbr      # a gramática nova: casos 0.12 / 1500.00 / 1.500,00 / 1,234,56 / 10-5 / 5x3 / R$ 1,50
pnpm --filter @3dprecify/web test -- calculator-schema catalog-schema
```
Esperado: cada entrada do conjunto ou parseia para o valor INTENCIONADO ou vira `null` (erro de campo); nenhum valor errado silencioso. Prova manual: digitar `0.12` no campo kW do calculator → erro ou 0,12 — nunca energia ×100.

## SC-002 — navegação direta (C-02)

```bash
pnpm --filter @3dprecify/web test:e2e -- deep-links    # spec NOVO: page.goto direto em /historico?snapshot=<id> e /catalogo?produto=<id>
firebase emulators:start --only hosting                # conferir os redirects 301 das URLs antigas (captura :id)
```

## SC-003 — lapsed no catálogo (C-03)

Backend + front locais, conta com grant expirado (CLI `grant_premium` + expiração): abrir /catalogo → banner "Premium pausado" + forms `disabled` + linha de reativação; leitura integral preservada. Homologação visual: qa-produto (390px + desktop).

## SC-004 — 422 nunca 500 (C-06/C-07)

```bash
cd backend && uv run pytest -q -k "over_ceiling or min_length"   # inclui os casos novos: tariffPerKwh e quantity de BomLine; kit vazio
```

## SC-005 — as 4 mutações-guarda (C-08/C-09)

Prova única no PR (aplicar a mutação, ver vermelho, reverter):
1. Deletar `providers.tsx:49-52` (purges) → `pnpm --filter @3dprecify/web test -- providers` FALHA.
2. Inverter a condição `uidChanged` → idem.
3. Inverter a ordem de dois `op.drop_*` no downgrade do 0005 → `uv run pytest -q -k migration_roundtrip` FALHA.
4. Criar migração dummy com `down_revision` duplicado → `scripts/check-migrations.sh` FALHA (`alembic heads` ≠ 1).

## SC-006 — passe documental (C-15)

Verificação por inspeção (uma linha por claim): `grep -n "RLS" specs/007-e2-catalog-entitlement/dod-evidence.md` (ausente) · `grep -n "orchestrates" .specify/memory/constitution.md` (ausente) · `grep -n "No product route" backend/app/auth.py` (ausente) · Clarification datada presente em `specs/005-*/spec.md` (SC-105) · CLAUDE.md ground sem "E6 UNSTARTED" · etc. — lista completa: FR-014.

## SC-008 — pré-fill ML/Amazon (US8)

Com o catálogo curado servido: no calculator, selecionar canal Mercado Livre → taxas pré-preenchidas + selo "referência" (não "sem referência"); Amazon com anúncio barato → piso R$ 1 aplicado. Conferir `sourceUrl`/`effectiveDate` em `backend/app/data/catalog.json` e paridade com `seed.ts`. **Gate: valores validados pelo dono antes do merge.**

## Drift-guard (PR do min_length)

```bash
cd backend && uv run python -m app.scripts.export_openapi   # (comando da casa para regenerar contracts/openapi.json)
pnpm gen:api                                                # do ROOT (nunca de apps/web — lição registrada)
git diff --exit-code contracts/ apps/web/src/shared/api/    # idempotência provada
```
