# Tech-Stack Decisions — OPEN (decide with Jonatan before implementation)

Per Constitution **Principle VIII** (no inference) + ADR-0003. Sourced from a 10-agent internet sweep
(2025–2026); full reports in the session scratchpad (`research-01..10-*.md`). Every item is **OPEN** until
Jonatan decides. `conf` = the research agent's confidence that its recommendation is the best choice. Decisions
are taken in themed rounds; each outcome is recorded here (→ then an ADR for the structural ones).

> ⚠️ **Cross-cutting truth-flags (Principle II) to resolve first:**
> - **Package manager:** research recommends **pnpm over our earlier npm pick (70%)** — pnpm *catalogs* pin one
>   React/Vite across the workspace, which Capacitor REQUIRES (duplicate React = native crash). Reopens a prior decision.
> - **snake↔camel (ADR-0002 R3.2=A):** no codegen tool transforms case "for free." R3.2=A (snake wire) needs a
>   runtime **Orval transformer/mutator**; R3.2=B (camelCase wire via Pydantic `alias_generator`) needs **zero**
>   mapping. Worth re-confirming A vs B now that the cost is concrete.
> - **Deploy target (TD-003)** now gates the **Firebase-admin credential** method (Cloud Run → keyless ADC).
> - **Branch protection** as a hard gate needs GitHub Pro on a private repo (ADR-0001) — currently convention-only.

## Round F1 — Monorepo foundation (highest cost-to-change; lock first)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| F1.1 | Package manager | npm / **pnpm** / bun | pnpm — strict deps + catalogs (single-React for Capacitor) (70%) |
| F1.2 | Git hooks runner | **lefthook** / husky+lint-staged / pre-commit | lefthook — 1 Go binary, parallel, gates JS+Python via `uv run` (62–65%) |
| F1.3 | Monorepo orchestrator | **none now** / Turborepo now / Nx | none now → Turborepo at first CI pain (78–80%) |
| F1.4 | Node policy | **Node 24 LTS** / 22 / Current | Node 24 (pin .nvmrc+Corepack+engine-strict) (85%) |
| F1.5 | Vite/Capacitor readiness | set `base:'./'` + single-React dedupe from day one; `cap add android` post-MVP | (80–88%) |

## Round F2 — Frontend styling & design system
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| F2.1 | Styling engine | **Tailwind v4** / Panda / vanilla-extract / CSS Modules | Tailwind v4 — zero-runtime, CSS-var tokens, AI-reliable (82%) |
| F2.2 | Component/primitive layer | **shadcn/ui (Radix)** / Chakra v3 / Ark | shadcn copy-paste (agents own .tsx); reject Chakra (Emotion runtime) (78%) |
| F2.3 | Design-token pipeline | plain CSS vars now / **DTCG→Style Dictionary** | plain CSS vars now → Style Dictionary later (identical output) (72%) |
| F2.4 | Light/dark mechanism | **data-theme + CSS-var token sets** / light-dark() / .dark class | data-theme + prefers-color-scheme default (80%) |
| F2.5 | Custom fonts | **self-host WOFF2** (Peace Sans/Lilita One/Inter) as --font-* tokens | self-host (GATE: verify Peace Sans web/app license) (85%) |
| F2.6 | A11y enforcement | primitives + CI axe/Lighthouse + token contrast check | (83%) (GATE: verify #7800ff/#f7931e/#15bddc contrast both themes) |

## Round F3 — Frontend code architecture & standards
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| F3.1 | Folder methodology | **bulletproof-react feature-based** (shared→features→app) / full FSD v2.1 / ad-hoc | feature-based + FSD rules, migration path to FSD (75%) |
| F3.2 | Boundary enforcement | **eslint-plugin-boundaries + dependency-cruiser (CI)** / no-restricted-paths only / Nx | boundaries+dep-cruiser + TS project refs (80%) |
| F3.3 | pricing-core boundary | **pure-TS workspace package, hexagonal, TS project references** | yes — zero React/fetch/storage imports (92%) |
| F3.4 | Barrel files | **none internal** (reserve for pricing-core entry) / FSD per-slice barrels | none (Vite/Vercel/TkDodo benchmarks) (85%) |
| F3.5 | Component patterns | **custom hooks + composition/headless** / container-presentational | hooks wrap pricing-core; headless for reused primitives (88%) |
| F3.6 | File naming case | **kebab-case all files** / PascalCase components / mixed | kebab-case (one regex, FS-safe) — genuinely unsettled (60%) |
| F3.7 | God-component guardrail | soft ESLint max-lines + "extract on 2nd responsibility" | (70%) |

## Round F4 — Frontend state, data, forms
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| F4.1 | Client state | **Zustand v5** / Jotai / Redux Toolkit / Context | Zustand (tiny, store-first) (90%) |
| F4.2 | Server cache | **TanStack Query v5** / SWR / RTK Query | TanStack (only one w/ offline+persistence+paused mutations) (88%) |
| F4.3 | Forms+validation | **RHF v7 + Zod v4** (reuse zod as pricing-core input guard) | (88%) |
| F4.4 | Auth/session surface | Firebase `onIdTokenChanged` → **Zustand store** | so API client reads token w/o Context drilling (80%) |
| F4.5 | Offline-write/sync (E2) | **Hybrid: own IndexedDB pending-sync record** + TanStack transport | not paused-mutations-as-sole-durability on a paid tier (72%) |

## Round B1 — Backend architecture (FastAPI)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| B1.1 | Project structure | **domain-modular** `src/<domain>/...` → modular-monolith+import-linter / layered / hexagonal | domain-modular now (80%) |
| B1.2 | Repository layer | **thin-selective** (direct ORM for CRUD; repo for billing/entitlements+pricing) / none / full | (65%) |
| B1.3 | Pricing engine | **framework-free pure-Python core** (no FastAPI/SQLAlchemy imports) | (78%) |
| B1.4 | DI mechanism | **Depends now** → dependency-injector when non-HTTP jobs; services take deps as args | (75%) |
| B1.5 | firebase-admin verify | **async dep + `run_in_threadpool(verify_id_token)`** | ONLY silent-failure item (bare call stalls loop) (88%) |
| B1.6 | Error/logging stack | **central exception handlers → ADR-0002 envelope + structlog + asgi-correlation-id + Sentry** | (85%) |
| B1.7 | Schema/model split | **strict Pydantic v2 DTO ≠ SQLAlchemy ORM** (SQLModel blurs it) | (82%) |
| B1.8 | App wiring | **create_app() factory + lifespan + pydantic-settings via Depends** | (90%) |

## Round B2 — Backend tooling & quality gate
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| B2.1 | Linter/formatter | **Ruff (lint+format)** / black+isort+flake8 | Ruff, select E/W/F/I/B/C4/UP/N/S/SIM/RUF (95%) |
| B2.2 | Type checker | **basedpyright strict** / mypy+plugin / pyrefly / ty(beta) | basedpyright; ty as fast local until 1.0 (72%) |
| B2.3 | uv layout | **single package** (not workspace) | (90%) |
| B2.4 | Test stack/async | **pytest + pytest-asyncio auto + httpx AsyncClient** | (80%) |
| B2.5 | Coverage policy | **ratchet** + near-100% on pricing module; branch=true | (78%) |
| B2.6 | Enforcement | **CI required gate job + `uv sync --locked` + lefthook mirror + anti---no-verify guard** | (92%) |

## Round C1 — API contracts & communication (extends ADR-0002)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| C1.1 | Codegen tool | **Orval + TanStack Query v5** / Hey API / openapi-typescript | Orval (only mature tool doing snake→camel + TanStack hooks); wrap to throw on 4xx/5xx (75%) |
| C1.2 | snake↔camel location | **(a) Orval transformer (honors R3.2=A)** vs **(b) camelCase wire via Pydantic alias (zero mapping)** | RE-CONFIRM A vs B (70%) |
| C1.3 | Error-code enum | **Python `ErrorCode(str,Enum)` → spec → codegen TS union** | additive-only stable strings (80%) |
| C1.4 | Drift guard CI | **regen + `git diff --exit-code`** now → oasdiff at first consumer | (80%) |
| C1.5 | Contract testing | **Schemathesis** vs Pact(no) vs Dredd | Schemathesis (80%) |
| C1.6 | Versioning | **`/api/v1` prefix + versioned folders from day one** | (85%) |

## Round T1 — Testing strategy
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| T1.1 | FE coverage | **V8 (AST)**, lines/stmts ≥80% branches ≥70%, pricing 100% | (80%) |
| T1.2 | Python factory | **polyfactory** / factory_boy | polyfactory (type-driven) (70%) |
| T1.3 | Firebase in tests | unit: dependency_overrides; E2E: emulator (+ **@nearform/playwright-firebase**) | (75–85%) |
| T1.4 | Visual regression | **Vitest4 toMatchScreenshot (component) + Playwright toHaveScreenshot (page)**; pin runner image | MCP visual = exploratory/non-gating (65%) |
| T1.5 | AI browser QA | **Playwright MCP + Chrome DevTools MCP**; routine via Playwright CLI | (65%) |
| T1.6 | Flaky policy | **0 local / 2 CI retries + quarantine + --fail-on-flaky-tests** | (85%) |
| — | npm-audit | resolve via **vitest 2→4** here | Vitest 4.0 GA Oct-2025 |

## Round D1 — Data layer irreversibles (lock before E2 model)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| D1.1 | ORM | **SQLAlchemy 2.0** / SQLModel / raw asyncpg | SA 2.0 (80%) |
| D1.2 | Driver | **psycopg3** / asyncpg | psycopg3 (one driver, clean PgBouncer) (78%) |
| D1.3 | Money | **Numeric(18,6) unit / Numeric(12,2) settled**, Decimal, ISO-4217 col, ROUND_HALF_UP | never float/money (88%) |
| D1.4 | PK | **UUIDv7 native uuid** (uuid-utils) | UUIDv4 only for must-not-leak tokens (82%) |

## Round D2 — Data layer patterns (E2)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| D2.1 | Tenant isolation | **defense-in-depth phased** (app-layer helper first + RLS backstop) / app-only / RLS-only | owner_uid on EVERY table from row zero (75%) |
| D2.2 | Soft-delete/audit | **deleted_at + partial unique idx** + append-only history for money/saved-calcs | (80%) |
| D2.3 | Migrations | **Alembic async template + naming_convention + date-prefixed + manual review** | (high) |
| D2.4 | Seeding | **hybrid** (Alembic bulk_insert enums + idempotent ON CONFLICT scripts gated APP_ENV + polyfactory) | (78%) |

## Round S1 — Secrets & config
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| S1.1 | CI auth to Google | **WIF (keyless, google-github-actions/auth@v3)** / SA-key JSON | WIF (92%) |
| S1.2 | Firebase admin cred (runtime) | **ADC on Cloud Run** / GCP Secret Manager JSON / env var | depends on deploy target (TD-003) (90%) |
| S1.3 | Central secret store | **GitHub Environments now** → GCP Secret Manager when runtime secrets / SOPS+age | (70%) |
| S1.4 | Env matrix | **dev+prod, 2 Firebase projects, 2 GitHub Environments, .env.[mode]** | structure for stage later (85%) |
| S1.5 | FE env validation | **zod.parse(import.meta.env)** now → @t3-oss/env-core | VITE_* are PUBLIC (75%) |
| S1.6 | Backend config | **pydantic-settings + SecretStr + secrets_dir + @lru_cache/Depends** | (93%) |
| S1.7 | Leak prevention | **gitleaks (pre-commit+CI) + trufflehog --results=verified** + rotation-first | (80%) |

## Round X — Deploy & platform (TD-003 now active)
| ID | Decision | Options | Rec (conf) |
|----|----------|---------|------------|
| X.1 | Backend host | Cloud Run / Fly.io / Render / Railway | (open — drives S1.2) |
| X.2 | SPA host | Cloudflare Pages / Vercel / Firebase Hosting / Netlify | (open) |
| X.3 | Capacitor timing | PWA Capacitor-ready now, `cap add android` post-MVP | (80%) |
