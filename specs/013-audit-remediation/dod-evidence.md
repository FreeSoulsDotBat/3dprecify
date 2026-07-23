# DoD Evidence — 013 Remediação da Auditoria Adversarial

**Branch**: `013-audit-remediation` (cortado de `develop`) · **Data**: 2026-07-23 · **Fonte normativa**: `AUDITORIA.md` (81 achados) + `PLANO-CORRECAO.md` (24 issues C-nn).

Escopo entregue: **7 das 8 user stories** (US8 deferida ao incremento 014 por decisão do dono no gate T063 — ver `us8-fee-proposal.md §9`). Zero migrações de banco. Isolamento do E6 preservado (nenhum arquivo de `billing/` tocado).

---

## Success Criteria

### SC-001 — parser adversarial (US1 / C-01 · C-14)
- **Lógica**: `apps/web/src/shared/lib/decimal-ptbr.test.ts` (gramática estrita), `calculator-schema.test.ts` + `catalog-schema.test.ts` (as 2 superfícies), `calculator-model.test.ts` (seam do override Shopee). Commits `78db82f` (red) → `3cdfcd6` + `6e08214` (fix).
- **Visual (T018b)**: **PASS 98%** — 8 PNGs em `evidence/t018b/`. O bug de 100× provado morto ATRAVÉS da persistência: `0.12` no kW → 0,12 (nunca 12); filamento salvo com `1500.00` → R$ 1.500 gravado, reaberto do backend → 1500 (nunca 150000). Verificado na main-loop por imagem, não pela palavra do agente.
- **Decisão de dono registrada**: override parcial num slot com `priceBands` — comissão digitada DERRUBA o schedule (bands), voucher sempre preservado (2026-07-23).

### SC-002 — navegação direta / F-02 morto (US2 / C-02)
- **Lógica**: e2e novo `apps/web/tests/e2e/deep-links.spec.ts` (`page.goto` DIRETO — a classe de teste antes deliberadamente evitada) + `router.guards.test.tsx`. Commits `c68f97d` (red) → `6b36dd2` + `4c6f3da`. O e2e pegou 2 bugs reais no caminho (Rules-of-Hooks; `requireAuth` perdendo `?produto=`).
- **Regressão caçada em browser vivo**: a migração de rota congelou a aba do catálogo em `useState` (sintoma de lifecycle) — corrigido (`eee441a`), a aba passa a ser derivada da URL, e `filaments`/`printers` (antes silenciosamente não-bookmarkáveis) entram no contrato.
- **Visual (T025)**: **PASS 95%** — 15 PNGs em `evidence/t025/`. URLs novas cold-load + F5 renderizam nas 2 viewports (nunca branco); `/historico?snapshot=<id>` verificado por imagem na main-loop. O único branco é o cold-load da URL ANTIGA no vite-preview — coberto em produção pelos 301 do `firebase.json` (T024), que o preview não aplica.
- **PENDÊNCIA NOMEADA (T024)**: os redirects 301 de hosting NÃO foram provados — bug de tooling só-Windows no `superstatic`/`glob-slash` (isolado e cross-checado em Linux). Verificação requer runner Linux OU `firebase hosting:channel:deploy`. Como deploy segue deferido até v1, fica registrado, não bloqueia.

### SC-003 — catálogo honesto para conta lapsed (US3 / C-03)
- **Lógica**: `filament-form.test.tsx`, `printer-form.test.tsx`, `produto-page.test.tsx`, `catalogo.test.tsx` + guarda de honestidade do delete em `catalog-delete-warn.test.tsx`. Commits `d3f0645` (red) → `c48f632` + `bbd7ae1`.
- **Visual (T034)**: **PASS-WITH-NITS 90%** — 19 PNGs em `evidence/t034/` (conta lapsed real SEMEADA: 1 filamento/1 impressora/1 produto; server `/entitlement` → `lapsed`). Banner "Premium pausado" na lista populada, forms `fieldset disabled` (inertness provada por `input.matches(':disabled')`), FR-409 leituras sobrevivem com valores reais, produto read-only.
- **NIT ENCONTRADO E CORRIGIDO**: na conta lapsed, tocar Excluir abria o confirm destrutivo e só 403-ava no submit (viola ux-catalog §3 "nunca mostre um delete funcionando e depois falhe"). Corrigido — delete espelha o Edit e cai na superfície read-only de reativação; provado in-browser (`evidence/t034/lapsed-delete-now-reactivation-fixed-desktop.png`) + guardas de regressão.
- **DECISÃO ABERTA PARA O DONO**: o banner é gated em `items.length > 0`, então um catálogo lapsed VAZIO não mostra banner (ux-catalog §3 diz "persistente"). Caso populado funciona; o vazio é decisão de design deixada ao dono, não alterada aqui.

### SC-004 — 422 nunca 500 (US4 / C-06 · C-07)
- **Lógica**: `backend/app/validation.py` (módulo-folha único, contrato import-linter "Financial validators are a dependency-free leaf" KEPT) + espelhos por router. Testes: `test_boms.py` (tariffPerKwh/quantity/lines vazio → 422), `test_history.py` (int em posição de dinheiro → 422), front `catalog-schema.test.ts` + `scenarios-list-sheet.test.tsx`. Commits `dc98762` (red) → `1c66e68` + `d6d3341`.
- **Regen de contrato**: `min_length=1` mudou o schema de `BomIn` → regen provado idempotente (o comando REAL, não o assumido pelo quickstart, que foi corrigido).

### SC-005 — as 4 mutações-guarda (US5 / C-08 · C-09 · C-10)
- **Lógica + prova**: `evidence`/`mutation-evidence.md` — as 4 mutações aplicadas → vermelho → revertidas. (1) purge deletado → falha; (2) `||`→`&&` → falha SÓ no branch novo; (3) ordem de `DROP` invertida no 0003 → `DependentObjectsStillExist`; (4) `down_revision` duplicado → `expected exactly 1 alembic head`. Commits `eaacd0a`/`8a61458`/`e5dc02e`/`f82b96c`.
- **Adaptação registrada**: T051 escrito contra as tabelas deste branch (o `0005_e6_billing` só existe no branch do E6); follow-up no docstring.

### SC-006 — passe documental (US7 / C-15)
- **Prova por inspeção**: `docs-verification.md` — cada claim com o grep e o resultado real. Commit `17ab172`. Constituição 1.1.0→1.1.1 com sync-impact report; "RLS backstop" corrigido no dod-evidence do E2; 2 ERROS DA PRÓPRIA AUDITORIA achados e registrados (F-03 "14 arquivos"→11; E4-04 "§4/§6.1"→§5/§6).

### SC-008 — pré-fill ML/Amazon (US8) — **DEFERIDO ao 014**
- Decisão do dono no gate T063 (2026-07-23): mapeamento COMPLETO categoria→taxa nos 2 marketplaces com atualização mensal automática, em spec própria. Curadoria já paga preservada em `us8-fee-proposal.md §8–§10` (valores exatos ML 13%/18% da sessão logada do dono, tabela Amazon integral, bloqueio de wire do `slotDeterminants`). Evidência: `evidence/us8/*.png`.

---

## Gate final

<!-- PREENCHER após T077b + gate:all + e2e no fechamento -->
- `pnpm gate:fe`: **VERDE** (exit 0, cobertura 86,5% statements — última medição 2026-07-23).
- `pnpm gate:be`: **VERDE** (exit 0, 339 passed, cobertura 84,03%, import-linter 4/4 incl. o contrato novo do validation).
- `pnpm e2e`: <!-- resultado final -->
- Homologações visuais: T018b 98% · T025 95% · T034 90% (nit corrigido) · T077b <!-- --> — todas por IMAGEM, evidência PNG por SC.

## Constitution DoD
- [x] Spec-driven (specify→clarify→plan→tasks→analyze→implement)
- [x] Test-first (cada fix nasce do teste failing que codifica a mutação/entrada da auditoria)
- [x] Server-side entitlements intocados (C-03 é apresentação; nenhum gate novo/removido)
- [x] Clean architecture (validation.py folha única; duplicação eliminada; código morto removido)
- [x] Truth over approval (US8 não inventou número; 2 erros da própria auditoria corrigidos)
- [ ] Visual homologado (3 de 4 done; T077b pendente)
- [ ] Autorização do dono para merge (por PR)
