# Homologation — T006b (PR-A) · VISUAL homologation of /bom composer + teaser

- **Date**: 2026-07-11
- **Feature**: 008-e3-multi-piece-bom, PR-A
- **Level**: WIREFRAME homologation (structure / states / honest copy / live recompute / 390px no-overflow).
  Pixel-final polish is a later Claude Design pass — NOT judged here.
- **Account used**: `qa-bom-1783742208114@e2e.local` (throwaway, e2e emulator). Premium granted via operator CLI
  (`app.scripts.grant_premium grant … --source beta --by qa-t006b` → `GRANTED wGnQqlnxLmDFyoT8fpAHlTB0imQz`).
- **Stack**: web `http://localhost:4173` (already running), API `http://localhost:8100`, Firebase Auth emulator.
- **Browser**: Playwright MCP. Env note: system Chrome was absent; the `chrome` channel path was junctioned to the
  bundled Playwright Chromium (`chromium-1228/chrome-win64`) so the MCP could launch. No app/code change.
- **Viewports**: mobile 390×844 first (primary), then desktop 1280×800.
- **Evidence**: `specs/008-e3-multi-piece-bom/evidence/t006b/`

## Overall verdict: **PASS-with-nits**

The composer structure, entitlement route-guard, teaser honesty, live recompute, catalog-reference provenance,
per-channel rollup, remove-line, and 390px no-horizontal-overflow all work and read honestly. One honesty-critical
open item (skippedLines caption, §1.7) could not be demonstrated via the UI — flagged below as the top PR-A item.
No uncaught errors; the only console errors are the intentional pre-grant 403s.

---

## Per-item verdicts (A–H)

### A. Signed-out teaser — PASS
`/bom` signed-out shows the honest crown teaser (no composer). Copy seen (quoted):
- h1 "Montagem"; teaser title "Monte e precifique pedidos com várias peças";
- body "Some várias peças — avulsas ou do seu catálogo — com quantidade e veja o preço da montagem inteira.";
- "Para montar pedidos, entre e ative o Premium.";
- free-promise "A calculadora de peça única continua grátis.";
- buttons **"Entrar"** + **"Entendi"** only. NO price/date/"assinar" anywhere (regex-verified).
- "Entrar" routes to `/sign-in?redirect=%2Fbom` (= `/sign-in?redirect=/bom`) ✓. No horizontal overflow (390=390).
- Evidence: `A-signed-out-teaser-390.png`

### Step 3 · Free signed-in teaser (pre-grant) — PASS
Signed-in `none` at `/bom`: same crown panel; body "No Premium você monta um pedido com várias peças e vê o preço
da montagem inteira, por canal."; free-note present; **only "Entendi"** (no "Entrar", no purchase CTA). No
price/date. No overflow. Evidence: `step3-free-teaser-signed-in-390.png`

### B. Empty composer (post-grant) — PASS
Composer mounts after the grant. PageHeader "Montagem" + subtitle "Some várias peças e veja o preço do pedido.";
EmptyState h2 "Monte seu pedido peça por peça" + body "Some várias peças — avulsas ou do seu catálogo — com
quantidade e veja o preço da montagem inteira." + action "+ Adicionar peça". No overflow (390=390).
Evidence: `B-empty-composer-390.png`

### C. Compose ad-hoc — PASS
Add line → expands with the calculator piece form, all sections present: **Custos da peça / Ajustes opcionais /
Mão de obra e custos / Outros custos / Markup / Como chegamos no preço / Marketplace**. Per-line money shows
"R$ 20,60 /un · Total R$ 20,60" and the assembly "Total da montagem" appears.
- Qty → 3: line total "R$ 20,60 /un · Total R$ 61,80" AND assembly (Custo R$ 61,80, Varejo R$ 92,70, Atacado
  R$ 80,34, rollup R$ 92,70) recompute **live** ✓
- Qty → 0: calm caption **"Quantidade 0 — não entra no total."**, line total "R$ 0,00", assembly R$ 0,00, line
  stays visible, no crash ✓
- No horizontal overflow at 390 (`scrollWidth == clientWidth == 375` with the vertical scrollbar present).
- Evidence: `C1-line-expanded-adhoc-390-full.png`, `C2-qty-zero-390.png`

### D. Catalog-referenced line — PASS
Created via `/catalogo` (premium CRUD): filament "PLA QA" (R$100 / 1kg), printer "Ender QA" (R$4000 / 2000h /
0,10 kW), product "Vaso QA" (PLA QA · Ender QA, gramas 100, tempo 5, tarifa 1).
- On `/bom`, expanded line carries the in-line **"Usar produto salvo"** picker (options "— Manual —" + "Vaso QA").
- Pick "Vaso QA" → header "Peça 1 · Vaso QA", fields pre-fill from **live** product values (Consumo médio 0,1000 kW
  from Ender QA → per-unit R$ 20,50, distinct from the ad-hoc 0,12 default), seal **"do catálogo: Vaso QA"** ✓
- Edit Gramas (100→120) → seal flips to **"do catálogo: Vaso QA · ajustado por você"**, per-unit live-recomputes
  to R$ 22,50 ✓
- Evidence: `D1-catalog-ref-seal-390.png`, `D2-catalog-ref-adjusted-390.png`

### E. Per-channel rollup — PASS (main) + one honesty finding (probe)
Assembly summary shows **"Preços por canal (montagem)"** → a **Mercado Livre** block with Varejo/Atacado
"Preço para anunciar" + "Recebido líquido" and **"{n} peça(s) somaram neste canal"**.
- With line1 commission 12%: Varejo anunciar R$ 38,35 / líquido R$ 33,75; Atacado R$ 33,24 / R$ 29,25 —
  coherent (líquido 33,75 = 22,50×1.5; anúncio grossed-up for the fee). "1 peça(s) somaram neste canal".
- Two lines (12% + 15%): rollup aggregates → Varejo anunciar R$ 74,70 / líquido R$ 64,65, Atacado R$ 64,75 /
  R$ 56,03, **"2 peça(s) somaram neste canal"** ✓
- Evidence: `E1-assembly-rollup-390.png`
- **Honesty probe (finding)**: setting line 2's commission = 100 shows the per-line error **"Corrija os campos
  deste canal para ver os preços."** and the rollup drops to **"1 peça(s) somaram neste canal"** — but the §1.7
  skipped caption **"{n} peça(s) sem preço neste canal — não entrou na soma."** does **NOT** appear. I could not
  force a genuine computed channel `error` slot via the UI (extreme Taxa fixa / Comissão mínima just gross up the
  advertised price rather than error), so the skippedLines caption could not be demonstrated at all through the UI.
  Evidence: `E2-honesty-probe-commission100-390.png`

### F. Remove line — PASS
Removed line 2 → count 2→1, only "Peça 1 · Vaso QA" remains; assembly Custo total updated **live** R$ 43,10 →
R$ 22,50; no crash, no overflow, 0 console errors.

### G. Desktop pass (1280×800) — PASS
Left-sidebar shell (Calcular/Catálogo/Histórico/Conta) + "Conectado como qa-bom-…" + Sair. Composer is a readable
single column (line card, "+ Adicionar peça", "Total da montagem" + PriceHero pair, "Preços por canal (montagem)").
Expanded line renders the full form + picker + adjusted seal. No horizontal overflow (1265=1265). Single column is
acceptable at PR-A; the wide right whitespace is the §1.1 two-column desktop opportunity (deferred).
Evidence: `G1-desktop-composer-1280.png`, `G2-desktop-line-expanded-1280.png`

### H. Console + network — PASS (no BOM defects)
- Console errors: only the **intentional pre-grant 403s** — `GET /api/v1/filaments` and `/api/v1/printers`
  (free `none` identity on /calcular before the grant). No uncaught JS errors anywhere.
- Console warnings: PWA manifest `icons/icon-192.png` "resource isn't a valid image" — pre-existing preview-build
  asset warning, present on sign-in/bom/catalogo, **not** BOM-specific.
- Network after grant: `GET /api/v1/entitlement` → 200 (route-guard is server-informed, ADR-0015), `GET
  /api/v1/products` → 200 (picker read). **Zero `/api/v1/boms` calls** — PR-A composer is free-standing / no
  persistence (§1.9). No unexpected 4xx/5xx.
- §1.9 honesty verified: **no "Salvar" button, no "Nome da montagem" field, no fake save** in the composer. All
  buttons carry accessible names.

---

## Ranked nit list

### Should be resolved / confirmed in PR-A
1. **skippedLines honesty caption (§1.7) not surfaced via UI** — a line whose channel can't price (commission=100 →
   "Corrija os campos deste canal") is silently dropped from the "N peça(s) somaram" count with no assembly-level
   "N peça(s) sem preço neste canal — não entrou na soma." This is the spec's honesty-critical surface. Mitigants:
   the per-line error IS shown and the "somaram" count is honest. **Action**: qa-software should verify
   `BomChannelRollup.skippedLines` + the caption at the contract/component level (it is not reachable through the
   composer's own inputs), and dev should confirm whether a field-invalid channel is meant to feed skippedLines or
   get an assembly-level note. Confidence this is a real gap: ~70% (caveat: a field-validation error may legitimately
   never become a `skippedLines` error slot).

### Deferred to the Claude Design pixel pass (or later PR)
2. **Line density (§1.3)** — Ajustes/Mão de obra/Outros custos/Marketplace are always expanded inline; a single line
   is very tall (~4000px). §1.3 recommends a secondary disclosure to keep the line short. Fine at wireframe scale;
   will hurt at 5–20 lines. (§6.1 item 2.)
3. **Pinned/sticky assembly summary bar (§1.1)** — currently a plain bottom section. Explicitly acceptable for PR-A;
   the sticky refinement is future polish.
4. **Desktop two-column (§1.1 desktop note)** — currently single column with large right whitespace; lines-left /
   summary-right is the desktop opportunity.
5. **Per-line vs rollup consistency** — with commission empty/0 the per-line "Preços por canal" says "Informe a
   comissão do canal para ver os preços." while the assembly rollup shows numbers (treats 0 as valid). Minor; the
   rollup behavior is arguably the more useful one.
6. **Reused E1 components (not BOM defects)** — PriceHero renders "R$" as a tiny superscript (reads oddly at a
   glance but is the shipped calculator hero); Tarifa field shows "1,000000" trailing zeros. Out of BOM scope.
7. **Empty-catalog picker** — "Usar produto salvo" is hidden entirely when the catalog has zero products (rather
   than a disabled "cadastre um produto"/offline hint). Reasonable, but slightly deviates from "each line carries a
   picker" (§1.2-C). Low priority.
8. **PWA manifest icon warning** — pre-existing `icon-192.png` not a valid image; not BOM.

---

## Addendum (2026-07-11, post-homologation)

- **Top nit #1 (skippedLines caption)**: RESOLVED — form-invalid slots now surface in the rollup as honest
  per-LINE skipped counts (commit `ad988ed`; counts refined to lines-not-slots in the pre-push review round).
- **Deferred nit #2 (line density)**: RESOLVED early — the ux §1.3 secondary disclosure shipped in `ad988ed`.
- **K1 rename (2026-07-11)**: the surfaces homologated here now read the Kit vocabulary (route `/kits`,
  title "Monte seus kits", 5th nav tab) — commit `a389dc8`. Screenshots show the pre-rename copy; the
  behaviors homologated are unchanged.
- **Pre-push review round**: a 6-dimension multi-agent review confirmed 2 majors (entitlement-guard
  tear-down on background refetch error; missing catalog-prefill coverage at the kit surface) — both fixed
  test-first with the remaining actionable minors; see the PR description for the full disposition.
