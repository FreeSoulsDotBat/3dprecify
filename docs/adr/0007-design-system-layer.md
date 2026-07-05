# ADR-0007: Design system layer — Radix behavior skinned with `tf-*` tokens

- **Status**: Accepted
- **Date**: 2026-07-02
- **Deciders**: Jonatan (owner) + planning session (arquiteto, dev-frontend, qa-produto)

## Context

The product prototype ("Truth's Forge / Precifica3D") was homologated visually across three rounds by
`qa-produto` and approved as the product vision. It ships a **real design system**: a semantic token graph
(`tokens/*.css`), 33 primitives with prop contracts (`ds-readme.md` / `ds-adherence.oxlintrc.json`), and a
visual skin built as **`tf-*` CSS classes** (one `.css` per component) — measured for WCAG 2.2 AA in both
themes.

ADR-0004 (F2.2/F3.1) ratified **"Tailwind v4 + shadcn/ui (Radix; Base UI fallback)"** and **"Atomic Design as
taxonomy inside `shared/ui`"**. The `001` slice already shipped **5 `tf-*` typed-TSX + CSS primitives**
(`card`, `field`, `number-field`, `price-hero`, `breakdown-row`) — i.e. the CSS-class approach, not
Tailwind-utility shadcn output.

Materializing the ~18 components the 4-tab app needs (and the 33 in the full DS) forces a decision:
adopt shadcn's **Tailwind-utility skin** (discarding the homologated + measured `tf-*` visual layer) or keep
the `tf-*` skin and reimplement complex-widget accessibility (Dialog/Sheet, Select, Switch, Tabs, Tooltip,
Collapsible) by hand. This decision blocks all component work for `003-app-shell-and-ds` and every later epoch,
so it is recorded before implementation (Principle VIII / ADR-0003).

## Options considered (≥3, per Constitution)

### Option A — shadcn/ui "pure" (Radix + Tailwind utilities + CVA)
- Pros: literal reading of ADR-0004 F2.2; vast ecosystem/examples; agents "own the .tsx"; least bespoke a11y.
- Cons: rewrites the 5 existing primitives and the byte-aligned, WCAG-measured DS skin (utilities ≠ `tf-*`
  CSS); discards the homologated visual layer; high near-term rework.
- Scalability impact: strong long-term (market standard), high migration cost now.
- Confidence: 45%

### Option B — Bespoke `tf-*` typed-TSX + CSS (what 001 and the prototype already do); revise ADR-0004 F2.2
- Pros: reuses 100% of the homologated DS (tokens, prop contracts, 33 primitives); least rework; visual layer
  already measured.
- Cons: hand-rolling accessible behavior for Dialog/Sheet, Select, Switch, Tabs, Tooltip, Collapsible is
  expensive and risky (focus-trap, keyboard, ARIA); abandons the ratified Radix decision.
- Scalability impact: medium — the a11y/focus risk sits with us for every complex widget.
- Confidence: 55%

### Option C — Hybrid: Radix (behavior/a11y) skinned with `tf-*` tokens
- Radix **unstyled** primitives for widgets with non-trivial a11y — `Dialog`/`Sheet`, `Select`, `Switch`,
  `Tabs`/`TabBar`, `Tooltip`, `Collapsible`, `Checkbox`, `Radio` — reskinned with the `tf-*` token CSS. The
  shadcn CLI is used only to scaffold the Radix wiring, which we then reskin.
- Purely-visual primitives stay `tf-*` typed-TSX + CSS (already built / trivially built): `Card`, `PriceHero`,
  `BreakdownRow`, `Button`, `Icon`, `Badge`, `Alert`, `Skeleton`, `Spinner`, `Toast`, `Logo`, `Grafismo`,
  `EmptyState`, `SegmentedControl`, `Divider`, `ListItem`, `Field`, `NumberField`, `Input`, `Textarea`, etc.
- Pros: honors the *intent* of ADR-0004 F2.2 (Radix wiring + agents own the .tsx) **and** preserves the
  homologated DS + WCAG measurements; hard a11y is outsourced to Radix where it matters.
- Cons: two style origins (Radix-wired vs pure `tf-*`) — needs a clear convention for when to use each; adds
  Radix package deps.
- Scalability impact: high — robust a11y + brand visual preserved.
- Confidence: 72%

## Decision

**Option C.** This ADR **refines** (does not supersede) ADR-0004 F2.2: within this project, "shadcn/ui" means
the **Radix wiring source** (scaffold via the shadcn CLI, then reskin), **not** the Tailwind-utility skin. The
brand skin is the homologated `tf-*` token CSS.

Convention (the "when to use which" the option's Cons calls for):
- **Radix-skinned** (`shared/ui/*` wrapping a `@radix-ui/react-*` primitive) is REQUIRED for any component
  whose accessibility is non-trivial: modal/sheet, listbox/select, switch/checkbox/radio, tabs, tooltip,
  collapsible/accordion, and anything needing focus-trap / focus-restore / roving-tabindex / typeahead.
  **Exception (clarified 2026-07-03, post-close audit):** ROUTE NAVIGATION rendered as tabs (the shell's
  TabBar/sidebar `app-nav`) must be a `nav` landmark of links with `aria-current="page"` (hand-rolled
  roving-tabindex) — NOT `@radix-ui/react-tabs`, whose `tablist/tabpanel` semantics are for same-view
  panel switching and would be an ARIA anti-pattern for navigation. Sanctioned by the 003
  `contracts/ui-components.md`; do not "fix" app-nav to Radix Tabs.
- **Pure `tf-*` typed-TSX + CSS** for purely-presentational or simple-interaction primitives.
- Both live in `shared/ui`; **Atomic Design stays a taxonomy** (ADR-0004 F3.1) — no top-level
  `atoms/`/`molecules/` folders; the only permitted barrel is `shared/ui/index.ts` (no internal barrels).
- Tokens remain the single source of the skin; components never hardcode raw `--tf-*` hues in status text —
  they use the semantic `--danger-text` / `--success-text` / `--info-text` tokens (remapped per theme).

Jonatan approved Option C in the 2026-07-02 planning session.

## Consequences

- **Positive**: preserves the homologated, WCAG-measured DS and its token graph; outsources the expensive/risky
  accessibility (focus-trap, keyboard nav, ARIA) to Radix; keeps the ratified "agents own the .tsx + Radix"
  intent of ADR-0004; the 5 existing `001` primitives are kept (contract refactor only, no rewrite).
- **Negative / trade-offs accepted**: two component origins to keep coherent (mitigated by the convention
  above and by `ds-adherence.oxlintrc.json` used as a supplemental, non-gating oxlint check); Radix runtime
  deps added to `apps/web`.
- **Follow-ups / new ADRs triggered**:
  - ~~Materialize FSD-Lite `pages/` + `widgets/` + `entities/` layers and extend the boundary gates
    (`eslint-plugin-boundaries`, dependency-cruiser)~~ — **DONE (2026-07-03, 003 Phase 8 / T066)**. The
    `pages/`, `widgets/`, `entities/` layers exist and hold the shell (`app/app-shell.tsx` +
    `widgets/{app-nav,top-bar,page-header,offline-banner}` + `pages/*` + `entities/user`); the canonical
    import direction `app → pages → widgets → features → entities → shared` is enforced by
    `eslint.config.mjs` (`boundaries/dependencies`) and `.dependency-cruiser.cjs` (no-upward-imports).
    `pnpm lint` + `pnpm depcruise` green.
  - ~~Add a **token-parity snapshot test** so DS↔app token drift is caught in CI~~ — **DONE (2026-07-03,
    003 / T010 + T062)**. `apps/web/src/styles/token-parity.test.ts` freezes the homologated 87-token color
    graph (84 DS + the 3 semantic status-text tokens `--danger/success/info-text`) and asserts both themes;
    any renamed/removed/unsanctioned token fails the gate. Green 4/4.
  - **FE observability now materialized (2026-07-03, 003 / T069, decision D2)**: `@sentry/react` init gated
    on `VITE_SENTRY_DSN` (silent no-op in dev/e2e), console/network/click breadcrumbs, the transport's
    `captureApiError` reports every `ApiError` tagged `code`+`correlationId`+`status`, and the router error
    boundary (`pages/error`) reports the boundary hit tagged with the user-visible support code. Makes the
    002 DoD observability claim true.
  - **Orval mutator now wired (2026-07-03, 003 / T067 follow-up, decision A20)**: the generated client routes
    through `shared/api/transport.ts` (`orvalFetch`) — every generated call gets the fresh Firebase ID token,
    typed baseURL, and `ApiError` normalisation. `orval.config.ts` `clean` is OFF because the mutator lives in
    the output folder (a bare `clean:true` would wipe it).
  - ADR-0008 (pending) — `pricing-core` version registry + rounding policy (blocks E1).
  - Entitlement enforcement ADR (pending, TD-005) — server-authoritative, blocks E2.

## Brand naming — masthead wordmark (homologation FAQ)

**Not a defect; do not "fix" it.** The shell top-bar and the sign-in masthead intentionally render the stacked
wordmark **"TRUTH'S FORGE"**, not "Precifica3D". Truth's Forge is the **studio / brand owner**; Precifica3D is
the **product** ("Precifica3D by Truth's Forge"). Confirmed by Jonatan 2026-06-28 — see
`docs/design/claude-design-brief.md` (§1 brand owner, §2 logo lockup "TRUTH'S FORGE", and the 2026-06-28
confirmation note). This is exactly why the DS skin uses the `tf-*` (Truth's Forge) class prefix.

The logo's accessible name is the **product** name (`<Logo alt={messages.appName}>` → "Precifica3D", set by
the top-bar and sign-in callers; `Logo` itself has no hardcoded alt) even though the visual wordmark shows the
**studio** — accepted as-is (the accessible name should be the app users actually know). Logged here so
re-homologations don't re-flag the masthead (raised + investigated by `qa-produto` during the 2026-07-05 PR #4
visual sweep; verdict SHIP).
