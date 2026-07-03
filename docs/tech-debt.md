# Technical Debt & Deferred Decisions

## Governing rule (Jonatan, 2026-06-27)
Before deciding anything with a **real chance of changing later**, flag the **change-likelihood %**. Decide now
only if the choice is stable or cheap-to-reverse. Otherwise log it here as **explicit tech debt** with: the %,
the **trigger** that will force the decision, and the **cheap placeholder** used in the meantime. Conventional
choices with low change-risk (≤~20%) are taken inline and noted in the relevant ADR/doc, not here.

`change %` = estimated probability that, if we locked this **now**, we'd later change it (higher = better to defer).

## Register
| ID | Deferred decision | change % | Trigger (when to decide) | Placeholder used now |
|----|-------------------|----------|--------------------------|----------------------|
| TD-001 | i18n architecture (full i18n library) | 40% | Internationalization epic (post-launch) | Typed pt-BR messages module keyed by error `code`; no i18n lib in 001 |
| ~~TD-002~~ | ~~Visual design system / tokens / styling~~ | — | **Being addressed now (2026-06-27)**: co-authoring the Claude Design prompt with Jonatan's vision + UX decided here; final UI rendered by Claude Design | resolved-in-progress |
| ~~TD-003~~ | ~~Deploy target (SPA host + FastAPI host)~~ | — | **RESOLVED 2026-06-28**: backend=Cloud Run (ADC keyless), SPA=Firebase Hosting | resolved |
| TD-004 | DB physical schema / money repr / multi-tenancy / migrations | 70% | E2 spec (catalog/persistence) | None — 001 is stateless, no DB |
| TD-005 | Entitlement enforcement design (offline+TTL vs per-request) | 50% | E2 + its ADR | None — 001 has no premium surface |
| TD-006 | Payments (Play Billing vs Mercado Pago recurring) | 60% | E6 + ADR (regulatory flux) | None — no payment code before E6 |
| ~~TD-007~~ | ~~Monorepo task runner (Turbo)~~ | — | **RESOLVED 2026-06-28**: pnpm workspaces now → Turborepo at first CI/build pain (F1.3) | resolved |
| TD-008 | pricing-core packaging (ESM/CJS + d.ts) + cross-lang parity | 40% | A 2nd consumer needs the built pkg (server won't reimplement the formula per ADR) | Direct TS import within the monorepo |
| TD-008b | Formal TS **composite project references** (`tsc -b`) wiring apps/web → pricing-core | 30% | Folded into TD-008 (composite needs emit; conflicts with current `noEmit`) | Per-package `tsc --noEmit` (`pnpm -r typecheck`) + tsconfig `paths` + Vite alias |
| TD-009 | pricing-core **version identifier** (to stamp E2 saved-calc snapshots → reproducible quotes) | 60% | E2 persistence (subset of TD-008) | None — 001/002 don't persist calcs |
| TD-010 | Peace Sans **font license** clearance for product/PWA embedding | 50% | Before any public deploy that ships the display font | Use only for logo/static art until cleared; body/UI = Inter (licensed) |
| ~~TD-011~~ | ~~Design-token **semantic role→color** mapping (palette→text/surface roles)~~ | — | **RESOLVED 2026-06-29**: adopted the Truth's Forge semantic token graph verbatim from Claude Design (colors/typography/spacing/radius/elevation/motion + base) into `apps/web/src/styles/`; AA-validated; fixed the dark-accent=cyan bug (accent stays purple, `--accent-text` AA in both themes) | resolved |
| ~~TD-014~~ | ~~Self-host brand webfonts~~ | — | **RESOLVED 2026-07-03**: Inter 400/500/600/700 + Lilita One + Paytone One `.woff2` vendored from Google Fonts (latin subset) into `apps/web/public/brand/fonts/`; `@font-face` active in `base.css`. Peace Sans still gated by TD-010 | resolved |
| TD-015 | **`--danger`-as-text** has no theme-remapping token: `--danger-deep` is AA on light (~5.9:1) but ~3.58:1 on dark `--bg-base` | 40% | Next design fresh-import — add a `--danger-text` that remaps (deep on light, brighter red on dark) | App defaults to light theme (error text AA there); sign-in error uses `--danger-deep` |
| TD-016 | **Maskable PWA icon** (safe-zone padded render) for Android adaptive icons | 30% | Before Play packaging (E7) or an install-quality pass | Manifest ships `any`-purpose 192/512 PNGs (vendored from design); no maskable variant yet |
| TD-017 | Adopt the design's full **LoginScreen + app-shell** (Logo lockup, grafismo, `Button`/`TopBar` primitives) — US1 screens were built minimal pre-token-adoption; also fix the **mobile header cramping** (brand + long email + Sair + theme toggle overflow at ≤414px) | 35% | When polishing US1 visuals or building the real shell/nav (E-level) | Sign-in + header render correctly with tokens (homologated T014), but use plain Tailwind markup, not the design's LoginScreen/TopBar treatment |
| TD-012 | correlation-id **FE-originates** mode (correlate even when no response arrives) | 35% | Network-failure debugging proves the server-originates model insufficient | A9 = server-originates; FE consumes + tags Sentry |
| TD-013 | Sentry **Session Replay** (AI/human sees the exact user session) | 50% | After LGPD privacy notice + cost review; likely premium-gated | Sentry **breadcrumbs** only (console/network/clicks) |

Resolved debt moves to the relevant ADR/doc and is struck from this table.
