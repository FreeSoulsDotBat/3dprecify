# UX Decisions (source of truth) — Precifica3D

Decided with Jonatan, UX round (2026-06-27/28). UI styling is **Claude Design's** domain; this file is the **UX**
(flows, IA, behavior) we own. Brand identity → `docs/design/claude-design-brief.md`.

## Foundations (decided)
- **UX1 — Navigation/IA = bottom tabs** (mobile-first): **Calcular · Catálogo · Histórico · Conta**. Each epic
  slots into a tab/section. Desktop: the same IA as a left sidebar (responsive).
- **UX2 — Calculation flow = single screen, live recompute + progressive disclosure.** Basic inputs always
  visible; advanced groups (Energia, Máquina/Depreciação, Falha, Marketplace) in collapsible sections. Price
  updates as the user types (computation is client-side/offline).
- **UX3 — Result = full breakdown.** Suggested price in hero, plus the itemized breakdown (material, energy,
  machine, labor, failure, margin, marketplace fee → net), **varejo vs atacado** side by side. On-brand
  ("Truth" = transparency); educates the seller.
- **UX4 — Inputs = catalog-driven (target state).** User registers filaments/printers once and selects them in
  the calc; manual entry always available as fallback. The walking skeleton (001) starts manual-only; catalog
  arrives at E2 and becomes the primary path.

## Conventional defaults (deferral rule, low change-risk — vetable)
- **Terminology:** the cost multiplier is labeled **"Markup (margem sobre o custo)"** — disambiguates the
  colloquial "margem" (sellers say margin but mean markup-over-cost). Glossary grows per epic.
- **Numeric/currency input:** `R$` prefix, comma decimal (pt-BR), unit suffix (g, kg, kWh, h), `inputmode`
  numeric/decimal, **tabular figures** for all money/number readouts (Inter `tnum` — no separate monospace,
  per the brand manual).
- **Accessibility target:** WCAG 2.2 AA (contrast ≥4.5:1, ≥44px touch targets, visible focus, labels).
- **Component states matrix:** every interactive surface defines loading / empty / error / success / disabled.
  Errors render the ADR-0002 envelope (`code` → pt-BR message), never a raw stack.
- **Theme:** light default (v1), dark as a first-class second theme (brand is high-contrast both ways);
  tokens themeable from day one.
- **Copy tone:** direct / technical-cordial pt-BR — precise, no flattery, talks in numbers (matches the brand
  and the project Constitution).

## Deferred (see docs/tech-debt.md)
- Onboarding / first-run + starter catalog seed → E2.
- i18n library → internationalization epic (pt-BR messages module meanwhile).

## Resolved / notes
- Wordmark in digital = **"TRUTH'S FORGE"** (assets' "TRUTHS'S FORGE" is a typo → brand-debt for Jonatan's designer).
- Numerals follow the manual: Inter tabular, **no monospace** (mockup "data strip" not in the manual).
- `flowchart TF.txt` is the **Truth's Forge store** e-commerce flow, **not** Precifica3D — out of scope here.
