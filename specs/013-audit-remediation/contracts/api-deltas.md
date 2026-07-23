# Contract Deltas — 013-audit-remediation (Phase 1)

Nenhum endpoint novo. Três deltas de fronteira + uma obrigação de processo.

## §1 · `POST/PUT /api/v1/boms` — `BomIn.lines` ganha `min_length=1` (D4)

- Antes: kit com `lines: []` é aceito (bloqueio só no cliente). Depois: 422 `VALIDATION` com mensagem de campo.
- **Impacto de contrato**: o schema OpenAPI de `BomIn` muda → **este PR MUST regenerar `contracts/openapi.json` (`export_openapi`) + `pnpm gen:api` do ROOT e provar idempotência** — a lição do drift-guard da casa (dispara até em docstring; aqui é mudança real de schema).
- Também neste grupo (sem mudança de shape wire, só de comportamento de erro): `BomLineIn.tariff_per_kwh` e `quantity` passam a devolver 422 (nunca 500) acima dos tetos — mensagens espelham as de `products` (E3-01/E3-02).

## §2 · CORS (C-13 / F-04)

- `allow_methods`: `["*"]` → `["GET","POST","PUT","PATCH","DELETE"]` · `allow_headers`: `["*"]` → `["Authorization","Content-Type","Accept"]`. Origens: inalteradas (allowlist per-env existente).
- Não muda OpenAPI; muda comportamento de preflight. Verificação: e2e/preview continuam verdes; decisão registrada (nota em ADR-0002 ou tech-debt — item do C-15).

## §3 · Contrato de URLs do front (C-02, D1=A)

| URL antiga (quebrada em cold-load) | Nova | Redirect |
|---|---|---|
| `/historico/:id` | `/historico?snapshot=:id` | hosting 301 (`firebase.json` redirects com captura) + rota client-side por ≥1 release |
| `/catalogo/produtos/novo` | `/catalogo?produto=novo` | idem |
| `/catalogo/produtos/:id` | `/catalogo?produto=:id` | idem |

Guarda de regressão nova: e2e com `page.goto()` DIRETO nas URLs novas (classe de teste hoje deliberadamente evitada — passa a existir). Nota honesta: as URLs antigas nunca funcionaram em cold-load (esse é o bug); o redirect de hosting as torna funcionais pela primeira vez.

## §4 · Sem mudança de contrato (declarado para o analyze)

- `GET /api/v1/fee-catalog`: shape inalterado; só CONTEÚDO novo (entradas ML/Amazon curadas) + `catalogVersion` novo.
- Scenarios/History/Products/Filaments/Printers: zero mudança de shape; E5-01 muda conteúdo gravado (lastKnown de KIT re-capturado), FB-03/FB-05 são validação client-side.
- Nenhuma rota de `billing` tocada (isolamento do E6 por construção).
