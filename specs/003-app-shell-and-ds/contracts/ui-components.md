# Contract: DS batch-1 components (app-shell scope)

**Feature**: `003-app-shell-and-ds` · Governed by **ADR-0007** (Radix behavior skinned with `tf-*` tokens).

This is the UI contract the app shell exposes/consumes. Each component lives in `apps/web/src/shared/ui/` and is
re-exported from the single barrel `shared/ui/index.ts`. "Origin" says whether the component wraps a Radix
primitive (non-trivial a11y) or is pure `tf-*` typed-TSX + CSS. Status text uses the semantic
`--danger-text` / `--success-text` / `--info-text` tokens, never raw hues.

## Refactor (5 existing `001` primitives — contract only, no rewrite)

| Component      | Origin  | Contract notes                                                                 |
|----------------|---------|--------------------------------------------------------------------------------|
| `Card`         | tf-*    | Typed `variant`/`padding` props; unchanged visuals.                            |
| `Field`        | tf-*    | Label + control + error slot; error text uses `--danger-text`.                 |
| `NumberField`  | tf-*    | pt-BR decimal via `decimal-ptbr`; `inputMode="decimal"`; ≥44px target.         |
| `PriceHero`    | tf-*    | Large result display; unchanged canonical R$ formatting.                       |
| `BreakdownRow` | tf-*    | Label/value row; sum-to-cent presentation unchanged.                           |

## Add — pure `tf-*` (presentational)

| Component   | Key props (contract)                                             | a11y / notes                                        |
|-------------|-----------------------------------------------------------------|-----------------------------------------------------|
| `Button`    | `variant` (primary/secondary/ghost/danger), `size`, `disabled`, `loading` | ≥44×44px; `loading` shows `Spinner`, keeps label for SR. |
| `Icon`      | `name` (from 43-SVG set), `size`, `aria-hidden`/`title`         | Decorative → `aria-hidden`; meaningful → `title`.   |
| `Logo`      | `variant` (full/mark), `theme-aware`                            | Brand logo; respects theme.                          |
| `Grafismo`  | `name`, decorative                                              | Decorative brand graphic; `aria-hidden`; reduced-motion safe. |
| `Spinner`   | `size`, `label`                                                | `role="status"` with SR label.                       |
| `Badge`     | `tone` (neutral/info/success/danger)                           | Tone text meets ≥4.5:1 in both themes.               |
| `Alert`     | `tone`, `title`, `children`                                    | `role="alert"` for danger; tone via semantic tokens. |
| `Toast`     | `tone`, `message`, auto-dismiss                                | Rendered by toaster; message mapped from `ErrorCode`.|
| `EmptyState`| `icon`, `title`, `description`, optional `action`             | Used by Catálogo/Histórico placeholders.             |

## Add — Radix-skinned (non-trivial a11y)

| Component        | Radix primitive              | Contract notes                                                        |
|------------------|------------------------------|----------------------------------------------------------------------|
| `TabBar` / `Nav` | `@radix-ui/react-tabs` (or roving-tabindex nav) | Mobile bottom bar / desktop sidebar; active indication; keyboard roving; each item ≥44×44px; items link to routes. |
| `Switch`         | `@radix-ui/react-switch`     | Theme toggle in Conta; labelled; ≥44px hit area.                      |
| `Dialog`/`Sheet` | `@radix-ui/react-dialog`     | Focus-trap while open, Escape closes, focus returns to opener (FR-016). Introduced for any shell modal surface. |

> The exact Radix package list is finalized during implementation **within** ADR-0007's decision (scaffold via
> shadcn CLI, then reskin with `tf-*`). Adding a Radix primitive not listed here is allowed **iff** it is the
> Radix-skinned realization of a non-trivial-a11y widget per ADR-0007 — it is not a new architectural decision.

## Invariants (apply to every component)

- **INV-1**: no horizontal overflow contribution at 390px (FR-010).
- **INV-2**: interactive target ≥ 44×44px (FR-009).
- **INV-3**: status/tone text ≥ 4.5:1 contrast in dark **and** light (FR-008) via semantic tokens.
- **INV-4**: no hardcoded raw `--tf-*` hue in status text; use `--danger/success/info-text` (ADR-0007).
- **INV-5**: only barrel is `shared/ui/index.ts`; no internal barrels; Atomic Design stays a taxonomy.
