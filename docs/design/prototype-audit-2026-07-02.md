# Prototype audit — Claude Design "Precifica3D — Protótipo Clicável" (2026-07-02)

6-agent comparative audit (product-owner, arquiteto, designer-ux, dev-frontend, qa-produto rendered,
dev-estrutura-de-dados) of the Claude Design project `7aa5d31e-294d-4d26-8a7e-d53d81751664` against
business rules, architecture decisions, and the canonical pricing domain. Downloaded artifacts in
session scratchpad `design-import/`; rendered screenshots in `design-render/shots/` (19 screens,
mobile+desktop, dark+light; DS component pixels not observable — `_ds_bundle.js` behind OAuth).

## Verdict

**Approved as product vision with one correction round.** Structure, IA (4 tabs + sidebar), freemium
boundary (mostly), copy tone, tokens and the 001 math are faithful. Correction prompt:
`docs/design/prompts/claude-design-prototype-fixes.md` (37 items).

## What is RIGHT (do not regress)

- 001 formula **matches pricing-core to the cent** (canonical 100/1/20/50 → 2,00/3,00 verified by
  executing the prototype's own code). Integer percent (A12), pt-BR parsing identical to
  `decimal-ptbr.ts`.
- Freemium mostly correct: no R$ price ("R$ —", "Preço em definição"), no trial, no quota numbers,
  Catálogo/Histórico/Salvar gated, math 100% free.
- Tokens **byte-identical** to `apps/web` (zero drift). DS adds ready inputs: `fonts.css` + 6 woff2
  (closes TD-014), theme pre-paint script (A34), ~28 primitives with prop contracts
  (`ds-adherence.oxlintrc.json`), Lucide self-hosted mask+currentColor icons (A35 input), good 404
  (A37 input), offline banner + login offline alert (A33 aligned).

## What is WRONG or MISSING (top findings; full list = the fixes prompt)

| # | Finding | Sev | Agent |
|---|---------|-----|-------|
| 1 | "Do catálogo" selectors exposed to FREE user in calculator — persistence-premium boundary leak | ALTA | PO |
| 2 | Copy pre-decides open decisions: "Mercado Pago" (billing ADR pending), "Cancele quando quiser" (A27), "Mais opções em breve" (A28), "conta inteira à mostra" (A24/A25 open) | ALTA | PO/Arq |
| 3 | Conta Premium card illegible in dark (white-on-white title, 1:1) — rendered & measured | ALTA | QA |
| 4 | Breakdown doesn't sum (9,35+4,68=14,03 vs total 14,02); history demo values don't close (…≠23,38); `onSave` hardcodes price | ALTA | QA/Dados |
| 5 | Canonical homolog example not seeded (seeds show ~14,03, not 2,00/3,00) | ALTA | UX |
| 6 | No focus management in sheets/upsell/404 (trap/return/heading focus) | ALTA | UX |
| 7 | TD-015 unresolved: no `--danger-text`; `--danger-deep` ≈3,1:1 on dark card (AA fail) | ALTA | FE |
| 8 | Missing states: loading skeletons, load-error (Catálogo/Histórico), premium-history empty, generic error/500 screen, ErrorCode-keyed messages, correlationId | MÉDIA | UX/Arq |
| 9 | Marketplace presets understate real ML fees (6,00/12–17% vs doc 6,75/14–19%); fixed third-party fees presented as fact; no mpPct≥100 guard | MÉDIA | Dados/PO |
| 10 | "/kg" label glued to roll cost (unit error); "Margem" labels markup value; "R$ 1.200" w/o cents; Moeda line mixes locale | MÉDIA | Dados/QA |
| 11 | Touch targets < 44px (Add/Comparar 40, pencil 36, close 38, switch 28); aria-pressed/role=status missing | MÉDIA | UX |
| 12 | Pre-paint skips `prefers-color-scheme` (A34); DS docs say "light default" while product is dark-default | MÉDIA | Arq/FE |
| 13 | ~6px horizontal overflow at 390px (grafismos `right:-22px`, no clip) — measured | MÉDIA | QA |
| 14 | Printer form captures only "Nome" (created printer can't feed calc); no inline validation; negatives unvalidated except weight | MÉDIA | UX/Dados |
| 15 | Identity hardcoded ("Jonatan Silva") — must be labeled as `/me` server-confirmed (A23); premium in localStorage = demo-only, entitlement is server-side | MÉDIA | Arq/PO |
| 16 | History lacks formula-version stamp/inputs (confirms A29/TD-009 gap); peso=0 leaves non-zero breakdown lines; infinite pulse violates own motion rule; hardcoded radii; contentMax 880 vs token 1120; glow on Save not on result | BAIXA | vários |

## V2 verification (2026-07-02, after correction round 1)

3-agent verification (product-owner, qa-produto rendered with REAL `_ds_bundle.js`, dev-frontend diff)
of the corrected prototype against the 37-item fixes prompt. **Scorecard: 20 FIXED · 11 PARTIAL ·
6 NOT FIXED · 0 regressions.**

- **FIXED (20):** 1-9, 11-14 (freemium teaser, copies, canonical seeds rendering R$ 2,00/3,00 live,
  sums close to the cent, peso=0 zeroes breakdown, mp guard, unit labels, money format), 17-19
  (load-error+retry, premium-history empty, generic 500 screen w/ correlationId), 26 (Conta Premium
  card measured 21:1 / 10,99:1 in dark), 29 (one-shot splash), 30 (overflow gone, measured 390=390),
  33 (glow on result hero). Live recompute confirmed with real DS components (TabBar/buttons truly
  clickable this round).
- **PARTIAL (11):** 10 (negatives still silent outside weight), 16 (skeletons exist but no "Demo:
  carregando" toggle; near-invisible in dark), 20 (error map uses non-canonical codes; not in DS
  readme), 22 (trap+Esc OK; Esc doesn't return focus; tab change doesn't focus title), 23 (close
  upsell 38px, sidebar toggle 40px, Switch 28px, SegmentedControl 36px still <44), 24 (sidebar toggle
  lacks aria-pressed), 25 (danger-text only as LOCAL `--p3d-danger-text` in prototype, only danger;
  DS tokens untouched; offline banner teal low-contrast in dark), 31 (contentMax still 880; small
  radii hardcoded), 32 ("Nome" still raw input), 34 (printer form missing modelo/h-dia/dias-mês/
  payback; no "cor"; Salvar not disabled), 36 (identity still "Jonatan Silva" + no readme /me note).
- **NOT FIXED (6):** 15 (Moeda×Idioma mixed), 21 (no "filamentos comuns" seed CTA), 27 (pre-paint
  still skips prefers-color-scheme), 28 (DS docs still say light-default), 35 (1-letter initials
  collide), 37 (no "Escopo por época" readme section).
- **Root cause of residuals:** the DS layer (readme, `tokens/colors.css`, manifest) is byte-identical
  to v1 — all fixes were applied inside `prototype.dc.html` only. Round-2 prompt:
  `docs/design/prompts/claude-design-prototype-fixes-r2.md`.
- Acceptable deviations (no action): version stamp "calc-001" instead of "v1.0.0"; markup label
  "(varejo)" with "sobre o custo" in helper text; 500-screen copy variants; empty history unreachable
  in demo (real app reaches it on first run).

## V3 verification (2026-07-02, after correction round 2)

2-agent verification (static diff + qa-produto rendered with real bundle AND real SVG assets — logo/icons
finally render). **Round-2 scorecard: 7 FIXED · 1 PARTIAL · 11 NOT FIXED · 0 regressions · 0 JS errors.**

- **FIXED (rendered & measured):** #10 seed CTA "Começar com filamentos comuns" (catalog now starts
  empty, seeds PLA/PETG/ABS); #11 focus (Escape returns focus to trigger, tab change focuses title);
  #12 touch targets (all ≥44px measured: close 44, switch 46×44, sidebar toggle 203×44, segmented
  116×44); #13 ARIA (aria-pressed + aria-live); #14 "Demo: carregando" toggle + dark-visible skeleton
  (1,79:1, reduced-motion honored); #14b "Demo: histórico vazio" (copy now matches); bonus: 500-screen
  copy ("Código de suporte:" / "Recarregar").
- **PARTIAL:** #1 — offline-banner dark contrast fixed (11,96:1) but via ANOTHER local token
  (`--p3d-info-text`); official DS tokens still not created.
- **NOT FIXED (2nd consecutive round, byte-identical to v2):** DS layer #2 (theme docs), #3 (canonical
  ErrorCode map + readme table), #4 (escopo por época), #5 (/me note); prototype substance #6 (identity
  "Jonatan Silva"), #7 (pre-paint prefers-color-scheme), #8 (negatives validation), #9 (Moeda×Idioma),
  #15 (contentMax 880/hardcoded radii), #16 (raw Nome input), #17 (catalog forms), p3dpulse cleanup.
- Nit (não é defeito do design): ícone `clock` da linha "Demo: carregando" não estava no NOSSO pacote de
  SVGs baixados (existe no projeto remoto).

**RECOMMENDATION — stop iterating with Claude Design; absorb residuals app-side.** Two rounds show the
same pattern: demonstrable-state/a11y items get fixed, substance items get skipped, and the DS layer is
never touched. Every residual item has a natural app-side home: `--danger-text`/`--success-text`/
`--info-text` + theme-doc fix → `apps/web/src/styles/tokens/colors.css` (closes TD-015);
ErrorCode→pt-BR map → `messages.pt-br.ts` (A37/ADR-0002 work anyway); pre-paint with
`prefers-color-scheme` → `index.html` (A34, already decided); negatives validation → pricing-core
contract already rejects them; Moeda/Idioma, content-max token, DS Field for "Nome", complete catalog
forms → the TSX rebuild (TD-017/E2 specs). The prototype is hereby signed off as VISUAL REFERENCE with
these residuals documented; do not treat its remaining imperfections as spec.

## Implications for open decisions (input, not yet captured)

- **A35 (iconography):** prototype ships Lucide `lucide-static@0.487.0` self-hosted, CSS mask +
  `currentColor` (~26 icons used). Strategy compatible with the stack — near-ready decision.
- **A36 (visual baseline):** tokens versioned + full screen inventory in light/dark make the DS a
  strong baseline candidate; Peace Sans still stand-in (TD-010); prototype runtime (React 18 UMD via
  CDN) is reference-only, not runnable in-repo.
- **A37 (404/error UI):** 404 exists and is good; generic error-boundary screen and code→message map
  are missing (requested in the fixes prompt).
- **App-side work identified (not design defects):** copy fonts.css + woff2 (TD-014), adopt pre-paint
  + persist (A34), rebuild ~28 primitives from oxlintrc contracts + shell (TD-017), gate `field.css`
  danger paliative, treat oxlintrc as spec (optional oxlint as supplementary linter).
