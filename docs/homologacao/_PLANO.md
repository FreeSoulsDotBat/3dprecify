# Plano de homologação pré-provisionamento — 3dprecify

**Fase 00 executada em 2026-08-02.** Somente leitura em código de produção (R8): esta rodada escreve
apenas em `docs/homologacao/` e `specs/`.

---

## AVISO 1 — o stack do prompt NÃO é o deste repositório

O prompt fixa como decisões tomadas: *Expo + React Native Web + Supabase + RevenueCat, Edge
Functions, RLS por tabela, `app.json`/`eas.json`, Playwright MCP*. **Verificado no disco: nada disso
existe aqui.**

| o prompt supõe | o que existe (verificado) |
| --- | --- |
| Supabase + Edge Functions + RLS | **FastAPI** (Py 3.12) + **Postgres** via SQLAlchemy 2.0 + Alembic (5 migrações). Não há RLS: o portão é o **entitlement server-side** (ADR-0012) + `import-linter` (5 contratos). |
| Expo / React Native Web / `app.json` / `eas.json` | **React 19 + Vite 8 PWA** + Tailwind v4 + TanStack Router (11 rotas). `ls app.json eas.json` → **não existem**. |
| RevenueCat | **não existe** em dependência nenhuma. |
| App Android com Play Billing | **não há app Android**. As duas rotas do Play existem atrás de flag DESLIGADA (404 no servidor, T035); o provider real é o T036, bloqueado no dono. |
| Playwright MCP | Playwright **direto** (`apps/web/tests/e2e`, 96 testes) + o agente `qa-produto` num navegador real. |

**Consequência**: as fases F04 (parte Play/Android), F05 (RLS/Edge Functions) e F07
(`app.json`/`eas.json`) do catálogo original **ficam sem objeto na forma escrita** e foram
readaptadas, conforme a própria instrução da Fase 00 ("remova fases sem objeto"). Não mudei decisão
arquitetural nenhuma (R10) — medi o código contra as decisões **deste** projeto, que estão em
`.specify/memory/constitution.md` e `docs/adr/`.

## AVISO 2 — a premissa "todas as features implementadas" é FALSA

Verificado em `specs/012-e6-billing/tasks.md` e `specs/014-fee-category-mapping/tasks.md`:

- **E6 (billing) está 31/44** e o PR-C (#36) está **aberto, não mergeado**. O **T036** (provider real
  do Play) está bloqueado na sua provisão, e o **T002** (sandbox real do MP) também.
- **014 tem a fatia ML (US6) NÃO INICIADA**, bloqueada em 8 condições de segurança + autorização sua.
- O laço mensal de tarifas **existe mas não dispara** (sem `fee-refresh.yml`; o `schedule` do GitHub
  lê do branch default, e o corte de release está adiado).

Isto **não invalida a homologação** — muda o que ela pode concluir. Cada fase declara o que audita
como CONSTRUÍDO e o que audita como PENDENTE, e nenhuma vai dizer "pronto para provisionar" sobre
código que ainda não existe.

---

## Catálogo de fases

Esforço: P (< 1h) · M (1–2h) · G (2–3h). Nenhuma passa de ~60% de uma janela de 5h (R2).

| # | Fase | Escopo / alvo | Produz | Esforço | Subagente barato? |
| --- | --- | --- | --- | --- | --- |
| **F01** | Inventário e mapa real | `apps/web/src` (FSD-Lite), `backend/app`, `packages/*`, 11 rotas, 12 módulos de API, 5 migrações, `contracts/openapi.json` | `F01-inventario.md` — o que o código É, sem julgamento | M | **sim** |
| **F02** | Drift spec ↔ código | as **14 specs** + o `dod-evidence.md` de cada uma contra a implementação; e o inverso (código sem spec) | `F02-drift.md`: implementado/parcial/ausente/divergente | G | parcial |
| **F03a** | Preço — núcleo | `packages/pricing-core/src/{index,channels,rounding}.ts`: custo/g, energia, desgaste, taxa de falha, margens, arredondamento e a DIREÇÃO dele, ponto flutuante em dinheiro, divisão por zero, campo vazio/negativo | **tabela de casos-ouro** (entrada → saída calculada à mão) + divergências | G | **não** |
| **F03b** | Preço — canais | bandas (`chooseBand`, ADR-0024 SELECTION vs PROGRESSIVE), incidência da taxa de marketplace (sobre anúncio ou sobre custo), piso por item da Amazon, frete/voucher, e a **A1-r** já registrada | casos-ouro por canal + veredito sobre a A1-r | G | **não** |
| **F04a** | Entitlement e ledger | `backend/app/entitlement/`, `grant_writer.py`, a derivação do ADR-0012, matriz de estados (free/ativo/carência/cancelado-vigente/expirado/estornado/offline-cacheado) | `F04a-entitlement.md` + matriz | M | **não** |
| **F04b** | Billing (Mercado Pago) | `api/billing.py`, `signature.py`, `reconcile.py`, `providers/mercadopago.py`: idempotência, verificação de assinatura, `live_mode`, retry, falha silenciosa; e a superfície do Play com a flag OFF | `F04b-billing.md` | M | **não** |
| **F05** | Auth, dados e segurança | Firebase Auth + `auth.py`; isolamento por `owner_uid` **tabela a tabela** (o equivalente local de RLS); segredo em bundle; validação server-side; **LGPD**: que dado pessoal existe, onde vive, há exclusão de conta | `F05-seguranca.md`, tabela a tabela | G | parcial |
| **F06** | Ingestão de tarifas (014) | `packages/fee-ingest`: guardrails, canárias, `nextCatalogVersion`, o selo de frescor, o teto de linhas alteradas, e o que acontece quando a fonte muda de FORMA | `F06-ingestao.md` | M | **não** |
| **F07** | Durabilidade e offline | outbox uid-keyed (ADR-0018), imutabilidade de snapshot (trigger PL/pgSQL, ADR-0019), cache por uid, `adoptCatalog`, degradação read-time (D3/D6) | `F07-durabilidade.md` | M | **não** |
| **F08** | Estados, erros e resiliência | por tela: loading/vazio/erro/sem-rede/sessão-expirada/dado-parcial; promise sem catch; mensagem técnica vazando ao usuário | `F08-estados.md` | M | parcial |
| **F09** | Build e prontidão de deploy | Vite/PWA, `docs/environments.md`, Cloud Run + Firebase Hosting + WIF, `.env` versionado por engano, deps com CVE, tamanho de bundle. **Alimenta a decisão de provisionar.** | `F09-build.md` + checklist | M | parcial |
| **F10** | Qualidade e cobertura | `any` em caminho crítico, código morto, regra de negócio duplicada, e **testes que passam sem provar nada** (esta sessão achou cinco) | `F10-qualidade.md` | M | parcial |
| **F11a** | Visual — gratuito | rotas públicas + calculadora, em 360/768/1440, nos estados da matriz de F08 | screenshots em `evidencias/` + `F11a-visual-free.md` | G | **não** (`qa-produto`) |
| **F11b** | Visual — premium | catálogo, kits, histórico, cenários, conta/billing, nos mesmos 3 breakpoints | idem | G | **não** (`qa-produto`) |
| **F12** | A11y e localização | contraste AA, labels/roles, teclado, vírgula decimal, `R$`, datas pt-BR, texto hardcoded | `F12-a11y.md` | M | parcial |
| **F13** | Performance | tempo até interativo, re-render da calculadora, N+1 no backend, listas sem virtualização, assets | `F13-perf.md` | M | parcial |
| **F14** | Consolidação | dedup, severidade, flag **bloqueia-provisionamento**, ordenado por risco × esforço | `RELATORIO.md` | M | **não** |
| **F15** | Specs de correção | uma spec spec-kit por achado Bloqueante/Alto, ACs numerados, agrupando só por causa raiz comum | `specs/0XX-*/` | G | **não** |
| **F16** | Roteiro manual | tela a tela na ordem do fluxo real, com os casos-ouro de F03a/F03b como valores a digitar | `ROTEIRO-MANUAL.md` | M | **não** |

**Ordem**: F01 → F02 → F03a → F03b → F04a → F04b → F05 → F06 → F07 → F08 → F09 → F10 → F11a →
F11b → F12 → F13 → F14 → F15 → F16.

**Critério de conclusão de cada fase**: o arquivo de achados existe, começa com resumo de ≤ 10
linhas, todo achado cita `arquivo:linha` e traz grau de certeza; `_STATE.md` e `_LEDGER.md`
atualizados; e a fase PARA.

**IDs determinísticos** (R5): `[F03a-001]`, `[F03a-002]`… — reexecutar uma fase reescreve o mesmo
arquivo com os mesmos IDs para os mesmos achados, sem duplicar.
