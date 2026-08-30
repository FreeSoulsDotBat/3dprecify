# PR-B homologation record (T026) — 007-e2-catalog-entitlement

## Owner homologation (2026-07-10)

Owner (Jonatan) declared the PR-B premium loop **homologated** on 2026-07-10, post-merge of PR #11
(`e655504` on `develop`). Scope: the T026 walk — grant → save filament/printer → calculator pre-fill
→ Conta shows the active plan.

> **Owner caveat (verbatim intent, 2026-07-10):** further homologation rounds MAY be required as
> development unfolds. This sign-off covers the PR-B scope only — it does NOT pre-approve future
> increments (PR-C surfaces, later E2+ changes), each of which gets its own homologation gate.

## Claude/QA homologation run (2026-07-10)

Independent qa-produto-style drive of the same loop against the REAL stack — not mocks:
compose Postgres (5433, dedicated `precifica3d_homolog` DB, Alembic `0001` applied), FastAPI via
`scripts/run_e2e_server.py` on **8100**, Firebase Auth emulator on **9099**, `vite preview` of the
emulator-mode build on **4173**. Interactions were role-selector-driven (same surface a user hits);
every state screenshotted and visually judged at **390×844** (mandated mobile viewport) plus a
**1280×800** desktop pass. Throwaway accounts: `homolog-mob-…@e2e.local`, `homolog-desk-…@e2e.local`;
grants written through the real operator CLI (`app.scripts.grant_premium … --source beta`).

### Checks — 14/14 PASS

| # | Check | Result |
|---|-------|--------|
| 1 | Free: seed varejo R$ 30,90 computa (calculadora intocada) | PASS |
| 2 | Free: NENHUM picker de catálogo renderiza | PASS |
| 3 | Conta free: plano "Gratuito" honesto | PASS |
| 4 | Catálogo free: deny honesto ("Salvar faz parte do Premium.") | PASS |
| 5 | Pós-grant (reload): tabs do catálogo aparecem | PASS |
| 6 | Filamento "PLA Azul" criado e listado (110 / 1 kg / 5 g) | PASS |
| 7 | Impressora "Ender 3" criada e listada (1200 / 2000 h / 0,12 kW / 0,5) | PASS |
| 8 | Premium: pickers renderizam no calculador | PASS |
| 9 | Pre-fill: Custo do rolo = 110,00 (editável) | PASS |
| 10 | Pre-fill: Valor da máquina = 1200,00 (editável) | PASS |
| 11 | **SC-305**: preço varejo R$ 26,48 — byte-idêntico ao manual | PASS |
| 12 | Conta premium: "Premium · via programa beta" do `/entitlement` real | PASS |
| 13 | Offline (PWA): app carrega, picker responde do cache uid-keyed, 110,00 | PASS |
| 14 | Desktop 1280px: CRUD + pre-fill íntegros, layout são | PASS |

Console: only the EXPECTED 403s (the honest `ENTITLEMENT_REQUIRED` deny for the never-granted
account) and offline-phase network noise; zero unexplained errors/pageerrors. Network: only
navigation-aborted (`ERR_ABORTED`) in-flight fetches on route change — benign.

### Visual judgment (screenshots reviewed one by one)

Mobile 390px: no overflow anywhere (calculator, catalog tabs, forms-in-dialog, Conta); tf-* DS
consistent; toasts honest ("Filamento salvo." / "Impressora salva."); picker card copy is honest
("Preenche os campos com o item salvo — você ainda pode editar tudo."); Conta shows the source
("via programa beta"). Desktop: sidebar nav + centered content correct; picker renders
conditionally only for kinds that have saved items. The Catálogo tab bar already exposes a
"Produtos" tab (US6 placeholder). Screenshots are session artifacts (scratchpad), not committed —
005 evidence pattern.

### Nits found (cosmetic, NOT blockers — queued for PR-C polish)

1. **Offline broken logo**: with the network gone the header logo renders as a broken image
   (alt "Precifica3D"); the SW precache (8 entries) does not include the logo asset. Online-only
   users never see it; offline is a supported read path (FR-309), so worth precaching.
2. **avgPower pre-fill formatting**: picking a printer fills "Consumo médio" as `0,1200` (4 decimal
   places) while manual entry/seed shows `0,12`. Same number, inconsistent presentation.

**Verdict: PASS** — the PR-B premium loop is homologated (QA run) on top of the owner's sign-off,
with the two cosmetic nits above logged for PR-C polish (T034 scope).
