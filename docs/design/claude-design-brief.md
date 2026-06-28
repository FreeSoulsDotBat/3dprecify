# Claude Design — Brief / System Prompt: Precifica3D (by Truth's Forge)

> Reusable design brief. Paste as the standing context for Claude Design; append a per-screen spec for each
> screen you want designed. We (product) own UX; Claude Design owns UI. Source of UX: `docs/product/ux-decisions.md`.

---

## 1. Product
**Precifica3D** is a mobile-first pricing calculator (SaaS) for 3D-printing sellers in Brazil. The user enters
their costs and gets a trustworthy suggested price with a transparent breakdown. It grows from a simple
material+markup calc to a full model (energy, machine/depreciation, failure, finishing, marketplace fees,
multi-piece BOM), plus a saved catalog, history, and a marketplace simulator. Freemium: **computation is free;
persistence & scale are premium.** Platform: web PWA first (mobile-first, also fully responsive on desktop),
Android (Play) later. All user-facing copy is **pt-BR**.

**Brand owner:** Truth's Forge. **Audience:** practical 3D-printing sellers/makers (often solo MEIs) who need
fast, correct pricing they can trust. **Personality target:** confident, precise, energetic, premium — never
corporate-sterile, never grungy. The name means *truth forged into shape* — transparency is a core value, so the
UI should make the math feel honest and legible.

## 2. Brand identity (Truth's Forge — apply faithfully)
### Colors
| Role | HEX | Notes |
|------|-----|-------|
| Institutional / hero accent — **Purple** | `#7800ff` | The most "owned" color; CTAs, brand highlights, active states |
| Institutional — **Orange** | `#f7931e` | Energy/secondary actions, badges, highlights |
| Support — **Cyan** | `#15bddc` | Info, links, fresh surfaces |
| Neutral dark | `#000000` | Text, dark-mode base |
| Neutral light | `#ffffff` | Light-mode base/surfaces |
| Secondary (details/icons only) | `#0b8196`, `#bd6c0e`, `#5a16a6` | Support accents, sparingly |

Application rule (from the brand manual + product mockups): **flat color-blocking, no gradients**; large
black/white planes carry structure; saturated accents used **sparingly** for action/emphasis (one accent per
zone). Optional subtle glow/rim-light on hero interactive elements (as on the brand's metallic buttons).
Purple is the signature; orange and cyan support.

### Typography
- **Peace Sans** — display/titles and the brand name; always UPPERCASE + Bold. (Logo/headlines.)
- **Lilita One** — secondary titles/subtitles, mostly UPPERCASE.
- **Inter** — body, UI text, forms, labels (the web/body face).
- **Numbers:** all money/quantity readouts use **tabular figures** (Inter `font-feature-settings: "tnum"`).
  For hero result values and technical metadata, a clean **monospace** accent is welcome — it echoes the brand's
  packaging "data strip" and reinforces a precise/maker feel. (Exact mono face is Claude Design's call.)

### Logo & graphic kit
- Logo = forge monogram (sword/blade stem + orange spark-arc + purple curved banner) + stacked wordmark
  **"TRUTH'S FORGE"**. Horizontal lockup is primary; use the **symbol only** for reduced/compact spots
  (app icon, favicon, nav). Variants exist: color / black / white / watermark. Respect clear-space (≥2.5× the
  module) and don't deform, recolor, or crowd the logo.
- **Grafismos** (recolorable shape kit from the logo's curved DNA): *arco* (spark/energy), *espada* (the forged
  result), *linha curva* (a single connective flourish), *onda* (divider/banner rhythm). Use **one** organic
  flourish per screen to offset the geometry — never clutter. Great for empty states, headers, onboarding.

### Mood
Bold, modern, high-contrast, energetic with a premium edge. Flat matte surfaces; vivid accents; generous
negative space; confident focal logo/hero with breathing room.

## 3. Platform & constraints
- **Mobile-first** (design at ≤414px width first), then responsive up to desktop.
- **PWA**: installable, works offline for calculation; design offline/empty/error states.
- **Accessibility: WCAG 2.2 AA** — contrast ≥4.5:1, touch targets ≥44px, visible focus, labeled inputs.
- **Light theme is the default (v1); dark theme is first-class** (brand is high-contrast both ways) — provide
  tokens, not one-off colors.
- Copy: **pt-BR**, tone **direct / technical-cordial** — precise, talks in numbers, no flattery.

## 4. UX foundations (decided — design to these)
1. **Navigation:** bottom tab bar (mobile) / left sidebar (desktop): **Calcular · Catálogo · Histórico · Conta**.
2. **Calculation screen:** single screen with **live recompute** as the user types; **progressive disclosure** —
   basic inputs always visible, advanced groups (Energia, Máquina/Depreciação, Falha, Marketplace) in
   collapsible sections.
3. **Result:** suggested price as a hero, plus a **full itemized breakdown** (material, energy, machine, labor,
   failure, margin, marketplace fee → net), **varejo vs atacado** comparable side by side. Make the math feel
   transparent and trustworthy.
4. **Inputs:** **catalog-driven** — select saved filament/printer; manual entry as fallback. (Free users see the
   premium upsell when they hit persistence limits — design an honest, non-dark-pattern upsell.)
5. **States:** design loading / empty / error / success / disabled for every interactive surface. Errors show a
   friendly pt-BR message (never a raw error/stack).
6. **Input affordances:** `R$` prefix, comma decimal, unit suffixes (g, kg, kWh, h), numeric keypad on mobile.

## 5. Design first (current increment)
Walking skeleton (001) — two screens only, full model NOT yet present:
- **(a) Login / auth gate** — sign in with Google; clean, branded, trustworthy; explains the value in one line.
- **(b) Minimal calculator** — inputs: custo do rolo (R$), peso do rolo (kg), gramas usadas, markup % ; outputs:
  custo do material and **preço sugerido**, shown clearly. This is the seed of the full calc screen (UX2/UX3),
  so design it to scale into live-recompute + breakdown later.

## 6. Don'ts
- No gradients-as-default, no skeuomorphism, no off-brand colors, no logo distortion/recolor.
- Don't bury the result; don't intimidate with all advanced fields open at once; no dark-pattern upsells.

---
*Open items to confirm with Jonatan before finalizing: wordmark spelling ("TRUTH'S FORGE" assumed), and whether
a monospace numeric face is desired for hero values.*
