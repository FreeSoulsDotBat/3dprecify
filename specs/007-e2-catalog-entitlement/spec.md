# Feature Specification: E2 — catalog + persistence + entitlement scaffolding

**Feature Branch**: `feature/007-e2-catalog-entitlement`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "E2 — catalog + persistence + entitlement scaffolding: the first database, the
first server-side entitlement enforcement (Constitution IV goes live; TD-005 recorded as blocking E2), and the
catalog domain — filaments, printers, minimal live-recomputed products + calculator pre-fill. Shaped by the
product-owner scope draft (built strictly from `docs/product/business-rules.md`, `docs/decisions/
audit-findings-r2.md` and the constitution) with four owner decisions taken 2026-07-09 (products depth, offline
semantics, lapse policy, free-tier UX) and one explicitly routed to the plan phase (entitlement-flag mechanism,
TD-005 ADR)."

> **Why now.** E1 (the free calculator) is complete and shipped; the road to v1 = E1–E6 runs through E2, the
> increment where the product's business model becomes real: **computation is free; persistence is Premium**
> (zero free quota, decided R3 2026-06-29 — not reopened here). E2 introduces three first-of-their-kind
> capabilities at once: the first **persistence layer** (a database where none exists today), the first
> **server-side entitlement enforcement** (Constitution Principle IV, NON-NEGOTIABLE, finally has a surface to
> protect), and the **catalog domain** that stops sellers re-typing their stable inputs — filament cost,
> printer cost/lifetime/draw — on every single calculation. Until E6 delivers billing, premium is granted
> **out-of-band** (beta/comp), which E2 must make operable and auditable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistence is gated server-side by a binary premium flag (Priority: P1) [FOUNDATIONAL]

Every operation that persists anything (create/update/delete a filament, printer or product; any cloud read of
saved data) is authorized on the **server** against a binary premium entitlement tied to the authenticated
account. The client never decides; a free or signed-out caller is denied with an honest
`ENTITLEMENT_REQUIRED` error and nothing is written or read. This is Constitution IV going live and the
prerequisite for every other story.

**Why this priority**: Principle IV is NON-NEGOTIABLE and TD-005 is recorded as blocking E2. Nothing else in
this feature can ship without the gate being real and server-authoritative.

**Independent Test**: With a free identity, call every persistence operation with a valid payload → each is
denied (`ENTITLEMENT_REQUIRED`), nothing persists. With a premium-granted identity, the same calls succeed.
Forging a local "premium" state on the client unlocks nothing.

**Acceptance Scenarios**:

1. **Given** a free (or signed-out) account, **When** any persistence operation is called, **Then** the server
   denies with `ENTITLEMENT_REQUIRED`, persists nothing, and returns no other account's data.
2. **Given** a premium account, **When** a persistence operation is called with a valid payload, **Then** it
   succeeds and the effect is visible on a fresh session.
3. **Given** a client that fakes a local premium state, **When** it calls a persistence operation, **Then**
   the server still denies — the client is never trusted for entitlement.
4. **Given** the full set of persistence operations, **When** audited, **Then** 100% of them perform the
   server-side check (no persistence path bypasses it).

---

### User Story 2 - Grant/revoke premium out-of-band, before billing exists (Priority: P1)

An **operator** (the owner — no self-service until E6) grants or revokes premium on a specific account,
recording the grant **source** (beta/comp) and an optional **expiry**. This makes the US1 gate operable and
homologable, and lets real beta sellers exercise the catalog before billing exists.

**Why this priority**: Without a grant mechanism the gate can only ever deny — every catalog story becomes
untestable end-to-end. `business-rules.md` explicitly mandates out-of-band grants between E2 and E6.

**Independent Test**: Grant premium to account X → X can persist (US3+). Revoke → X can create nothing new
and existing data follows the decided lapse policy (read-only freeze). The grant is auditable (who/when/source/expiry).

**Acceptance Scenarios**:

1. **Given** a free account X, **When** an operator grants premium, **Then** X gains persistence within one
   session/token refresh and the Conta page reflects the plan honestly.
2. **Given** a granted account X, **When** an operator revokes (or the expiry passes), **Then** X can create/
   edit/delete nothing new, and existing data enters **read-only freeze** (still visible and usable for
   pre-fill; never auto-deleted — owner decision Q3).
3. **Given** any grant, **When** inspected, **Then** its source (beta/comp), grantor and optional expiry are
   recorded.
4. **Given** the grant path, **When** a non-operator (any regular account) attempts it, **Then** it is denied —
   granting is operator-only.

---

### User Story 3 - Save & reuse filaments (Priority: P1)

A premium seller creates, edits, lists and deletes **filaments** — name, material label, roll cost, roll
weight, optional default waste — persisted server-side per account and available on any device signed into the
same account. Saved filaments are readable (for listing/pre-fill) even offline after a first online load.

**Why this priority**: Filament cost is the single most re-typed value in every calculation; it is the
clearest premium value and the smallest atomic catalog entity.

**Independent Test**: As premium, create "PLA Azul" (R$ 110 / 1 kg); reload in a fresh session → identical;
edit the cost → persists; delete → gone and no longer pre-fillable; another account sees none of it.

**Acceptance Scenarios**:

1. **Given** premium, **When** a filament is created with valid pt-BR/BRL inputs, **Then** it persists and
   lists under this account only.
2. **Given** a saved filament, **When** edited or deleted, **Then** the change persists across
   sessions/devices.
3. **Given** invalid input (non-finite cost, roll weight ≤ 0), **When** saving, **Then** per-field pt-BR
   validation blocks it — the same rules the calculator enforces; a bad entry is never stored.
4. **Given** account A's filament, **When** account B is signed in, **Then** B can neither read nor modify it.
5. **Given** a premium account that loaded its catalog online once, **When** the device goes offline, **Then**
   the saved filaments remain readable/pre-fillable (creating/editing requires network — owner decision Q2).

---

### User Story 4 - Save & reuse printers (Priority: P1)

A premium seller creates/edits/lists/deletes **printers** — name, machine value, lifetime hours, effective
average draw (kW), optional maintenance reserve — persisted and synced exactly like filaments.

**Why this priority**: The machine-cost fields are the second cluster of stable re-typed inputs; printers +
filaments together cover the fixed-per-asset inputs of every calculation.

**Independent Test**: As premium, create "Ender 3" (R$ 1.200 / 2.000 h / 0,12 kW); round-trip
(reload/edit/delete) holds; isolation holds; offline read holds.

**Acceptance Scenarios**: mirror US3 (create/edit/delete round-trip, per-field validation, per-account
isolation, offline read) with the printer field set.

---

### User Story 5 - Pre-fill the calculator from a saved filament/printer (Priority: P1)

Inside the calculator, a premium seller **picks a saved filament and/or printer**; the corresponding fields
pre-fill (filament → roll cost / roll weight / material; printer → machine value / lifetime / draw /
maintenance). Pre-filled fields stay **editable** — pre-fill, never lock. The computed prices are
**byte-identical** to typing the same values manually: the catalog changes convenience, never the math.

**Why this priority**: This is the payoff that turns saved data into a filled calculator. Without it, US3/US4
are storage with no in-context value.

**Independent Test**: With a saved filament + printer, pick both in the calculator → the fields populate and
the computed result equals the manual-entry result exactly; override one field → only that field changes;
offline (after one online load) the pick/pre-fill still works; a free/signed-out user gets no usable pre-fill
— only the honest teaser (US7) and the fully-free manual calculator.

**Acceptance Scenarios**:

1. **Given** premium with saved items, **When** a filament/printer is picked in the calculator, **Then** its
   fields pre-fill and remain editable.
2. **Given** a pre-filled calculator, **When** it computes, **Then** the result equals the manual-entry result
   byte-for-byte (SC-305).
3. **Given** a premium account offline (after one online catalog load), **When** picking a saved item,
   **Then** pre-fill works from the local read cache (owner decision Q2).
4. **Given** a free/signed-out user, **When** the calculator renders, **Then** no pre-fill is usable — the E1
   manual calculator stays fully free/offline/signed-out (SC-310), with at most the honest teaser (US7).

---

### User Story 6 - Save reusable products, live-recomputed (Priority: P2)

A premium seller saves a **product** — a named bundle of piece inputs (grams, print time, finishing, labor,
markups) + references to a saved filament and printer + the marketplace channel set + the "Outros custos"
list. Opening a product **re-computes with the CURRENT formula version** — it is a reusable input template,
**never a frozen historical snapshot** (snapshots/history are E4; owner decision Q1 = minimal live-recompute).

**Why this priority**: The largest, least-atomic catalog surface (it references every other entity); the
primitives + pre-fill deliver value earlier. Depth was owner-decided: minimal, live-recomputed, no
variants/images/versioning.

**Independent Test**: Save "Vaso G" referencing "PLA Azul" + "Ender 3"; reopen → inputs reappear and prices
recompute with the live formula; edit the referenced filament's cost → reopening the product reflects the new
cost (reference semantics, not copy).

**Acceptance Scenarios**:

1. **Given** premium, **When** a product is saved, **Then** its inputs + entity references persist per
   account.
2. **Given** a saved product, **When** reopened, **Then** it recomputes with the current formula version —
   no frozen snapshot.
3. **Given** a referenced filament/printer was edited, **When** the product is reopened, **Then** it reflects
   the referenced item's current values.
4. **Given** a referenced filament/printer is deleted, **When** the deletion is attempted, **Then** the seller
   is warned and, on confirming, the product keeps the last-known values as editable overrides — never a
   broken/blank product.

---

### User Story 7 - Honest free-tier "salvar" experience (Priority: P2)

When a free or signed-out user meets a save/catalog affordance (a save button, the Catálogo tab, a "usar do
catálogo" entry), the affordance is **visible** and tapping it opens an **honest teaser**: saving/catalog is
part of Premium — **no price, no date, never a fake "salvo!" confirmation, never a silent no-op** (owner
decision Q5; WTP unvalidated, Constitution II). The Catálogo tab extends the already-shipped honest
empty-state.

**Why this priority**: The free-user-facing consequence of US1 — important for honesty and premium discovery,
but it only has surfaces to attach to once the catalog UI exists.

**Independent Test**: As free/signed-out, tap every save/catalog affordance → each opens the honest teaser;
nothing persists; nothing reports success; no price/date appears anywhere.

**Acceptance Scenarios**:

1. **Given** free/signed-out, **When** any save/catalog affordance is tapped, **Then** an honest premium
   teaser is shown (no price/date), nothing persists, and no success is faked.
2. **Given** free/signed-out, **When** the Catálogo tab is opened, **Then** it explains the premium value
   honestly — never a broken CRUD screen.
3. **Given** the teaser, **When** its copy is reviewed, **Then** it promises no price and no availability
   date.

### Edge Cases

- **Entitlement propagation lag**: a just-granted seller may need a session/token refresh before persistence
  unlocks — the UX must communicate this honestly (e.g. "entre novamente"), never look broken. (Mechanism is
  the plan-phase TD-005 decision; the ≤ one-refresh bound is the product requirement.)
- **Premium lapse with saved data**: exactly the read-only freeze (Q3) — visible, pre-fillable, not
  writable; NEVER silently deleted. Re-grant restores write access to the same data.
- **Dangling references** (deleting a filament/printer referenced by a product): warn + allow; the product
  keeps last-known values as editable overrides (US6 scenario 4).
- **Invalid saved data**: rejected at save with the calculator's per-field pt-BR validation — a bad catalog
  entry must never flow a `NaN`/`Infinity` into a calculation.
- **Client manipulation**: faking premium locally is a server-side non-event (US1 scenario 3) — the past
  cross-user identity-leak lesson makes client trust explicitly unsafe here.
- **Offline write attempt** (premium, no network): an honest "requires connection" state — never a silent
  drop, never a fake success (no offline write queue in E2, Q2).
- **Wire error vocabulary**: E2 adds `ENTITLEMENT_REQUIRED` only. No quota code exists (free = zero, premium
  = unlimited — R3); no conflict code is needed (writes are online-only, Q2).
- **Auth provider gap (A28, flagged, not E2 scope)**: Google-only carries through E2; an alternative provider
  is a decision owed before E6/store submission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-301**: Every persistence operation (create/read/update/delete of any saved catalog data) MUST be
  authorized **server-side** against the account's premium entitlement; the client MUST never be trusted for
  the decision (Constitution IV). Precision (data-model reconciliation 2026-07-09): the entitlement is
  **binary for WRITES** (active ⇒ create/edit/delete allowed; anything else ⇒ denied); READ/pre-fill access
  additionally survives a lapse per the freeze policy (FR-311) — in effect three observable states: active
  (read+write), lapsed (read-only), none (no saved data access).
- **FR-302**: A denied persistence attempt MUST return the honest wire error `ENTITLEMENT_REQUIRED`, persist
  nothing, and leak nothing; this code MUST join the existing error vocabulary end-to-end (server enum → typed
  client → friendly pt-BR message).
- **FR-303**: An operator MUST be able to grant and revoke premium on a specific account without any payment,
  recording grantor, source (beta/comp) and optional expiry; the grant path MUST be operator-only (no
  self-service until E6) and auditable.
- **FR-304**: A grant/revoke MUST take effect within at most one session/token refresh, and the account page
  MUST reflect the current plan honestly (no fabricated plan states).
- **FR-305**: Premium sellers MUST be able to create, list, edit and delete **filaments** (name, material,
  roll cost, roll weight, optional default waste) and **printers** (name, machine value, lifetime hours,
  effective draw, optional maintenance reserve), persisted per account and available across devices/sessions.
- **FR-306**: All saved values MUST pass the same per-field pt-BR validation rules the calculator enforces
  (finite, non-negative, positive where required); invalid data MUST be rejected at save, never stored.
- **FR-307**: Catalog data MUST be strictly isolated per account: no account can read or write another
  account's data, under any manipulation (extends the E1 identity-isolation lesson).
- **FR-308**: The calculator MUST let a premium seller pick a saved filament and/or printer to **pre-fill**
  the corresponding fields; pre-filled fields MUST remain editable, and the computed result MUST be
  byte-identical to entering the same values manually — the pricing engine is not modified by this feature.
- **FR-309**: After at least one online load, a premium account's saved items MUST remain **readable and
  pre-fillable offline** (local read cache); create/edit/delete MUST require a connection and fail honestly
  offline (no write queue, no fake success — owner decision Q2).
- **FR-310**: Premium sellers MUST be able to save a **product** (named piece inputs + references to a saved
  filament and printer + channel set + "Outros custos" list) that, when reopened, **recomputes with the
  current formula version** — never a frozen snapshot (Q1); deleting a referenced item warns and degrades the
  product to last-known editable values (never breaks it).
- **FR-311**: On premium lapse (revoke or expiry), previously-saved data MUST enter **read-only freeze**:
  still visible and usable for read/pre-fill, closed to create/edit/delete, and NEVER auto-deleted (Q3/A27);
  a re-grant MUST restore write access to the same data.
- **FR-312**: Free/signed-out users MUST meet save/catalog affordances as **honest teasers**: visible,
  intercepted on tap with a Premium notice carrying **no price and no date**, never a fake save, never a
  silent no-op (Q5). The R3 zero-free-persistence rule stays intact — no free draft of any kind.
- **FR-313**: The E1 calculator MUST remain fully free, offline and signed-out: no catalog, persistence or
  entitlement surface may gate, block or alter the compute path (E1 SC-009 preserved; prices never computed
  server-side).

### Key Entities

- **Entitlement**: the binary premium state of an account + grant metadata (grantor, source beta/comp,
  granted-at, optional expiry, revoked-at). The server-side authority for every persistence decision.
  (Storage mechanism = plan-phase TD-005 ADR.)
- **Filament**: name, material label, roll cost, roll weight, optional default waste — per account.
- **Printer**: name, machine value, lifetime hours, effective average draw, optional maintenance reserve —
  per account.
- **Product**: name + piece inputs (grams, times, finishing, labor, markups) + references to one filament and
  one printer + channel set + "Outros custos" list — per account; live-recomputed, never a snapshot.
- **Catalog read cache**: the device-local copy of the account's saved items enabling offline read/pre-fill;
  refreshed online; never a write path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301**: 100% of persistence operations are authorized server-side; a free identity's write is denied
  (`ENTITLEMENT_REQUIRED`) and persists nothing even under client manipulation; a premium identity's identical
  call succeeds.
- **SC-302**: Granting premium enables persistence within one session/token refresh; revoking blocks new
  writes; every grant records source + optional expiry and is auditable.
- **SC-303**: A saved filament reloads identical (all fields) on a fresh session/device of the same account;
  edit and delete persist.
- **SC-304**: Same as SC-303 for printers.
- **SC-305**: Computing from a catalog-picked filament/printer yields **byte-identical** prices to typing the
  same values manually — zero difference on every output field.
- **SC-306**: A free/signed-out user persists nothing, never sees a fake "salvo", and every save/catalog
  affordance leads to an honest teaser containing no price and no date.
- **SC-307**: A saved product reproduces its inputs and recomputes with the current formula version; editing a
  referenced item is reflected on reopen; deleting one degrades to last-known editable values with a warning.
- **SC-308**: Zero cross-account reads or writes: account B can access none of account A's data under any
  attempted manipulation.
- **SC-309**: On lapse, 100% of previously-saved data remains readable/pre-fillable and 0% is writable or
  deleted; re-grant restores write access to the same data.
- **SC-310**: The E1 calculator's free/offline/signed-out guarantees hold unchanged (the existing e2e guards
  keep passing); no price is ever computed server-side.

## Clarifications

### Session 2026-08-06 (016/US11 — a virada de freemium do marketplace de venda)

A FR-313/SC-310 continuam verdadeiras para o núcleo do E1 (custo + markup): **nenhuma** superfície de
catálogo/persistência/entitlement gateia, bloqueia ou altera o caminho de cálculo do custo e do
markup — a calculadora "básica" segue livre, offline e sem login. O que a decisão do dono em
2026-08-05 (registrada em `specs/016-correcao-homologacao/spec.md` US11, FR-915/916/917) muda é o
ESCOPO do que "o E1 calculator" cobre: o bloco de **canal de venda de marketplace** (005) deixou de
ser grátis — ele agora exige entitlement ativo, com o mesmo gate de UI que já protege catálogo/
histórico/cenários/kits (ADR-0012).

- **A FR-313/SC-310 não são reescritas.** Elas continuam descrevendo o compromisso correto para o
  que sempre foi "o E1": o pipeline de custo (`material · energia · máquina · falha · acabamento ·
  mão de obra · outros custos · custo_total · markup`). Ler as duas à luz desta Clarification: "o
  cálculo" nelas é este pipeline, não o bloco de marketplace da spec irmã 005 — cuja própria
  Clarification datada (`specs/005-marketplace-multichannel/spec.md`, sessão 2026-08-06) registra a
  virada do lado de lá.
- **A frase de enforcement (achado D1 do analyze, exigida verbatim)**: o enforcement da virada é de
  UI porque o cálculo é offline por design e as tarifas são dado público semeado no bundle; o valor
  premium é a conveniência — decisão consciente, não drift do Princípio IV.
- **Por que isto não quebra o Princípio IV (nenhum dado premium sem entitlement do servidor)**: o
  Princípio IV protege DADOS que o servidor guarda por conta do usuário (catálogo salvo, histórico,
  cenários, kits) — o catálogo de tarifas de marketplace não é um desses; é dado público, semeado no
  bundle do cliente e servido sem autenticação (`GET /api/v1/fee-catalog`, ADR-0010). Um usuário
  técnico sempre pôde ler o bundle e calcular o gross-up manualmente offline; o gate de UI não some
  esse fato, e a decisão do dono é explícita sobre isso: o valor vendido é a conveniência da tela
  pronta, não o segredo de uma fórmula ou de uma tarifa que já é pública.

### Session 2026-08-03 (emenda da homologação pré-provisionamento — 015/A7)

A homologação pré-provisionamento (`docs/homologacao/`) achou afirmações desta spec que o E6 tornou
falsas e que ninguém emendou. A spec original **não é reescrita** — ela é emendada, porque a decisão
de então era certa para então, e apagá-la apagaria o motivo.

- **`[F02B-002]` — FR-303 "grant só via CLI de operador, sem self-service".** Deixou de ser toda a
  verdade quando o E6 entrou: `backend/app/billing/grant_writer.py` escreve grants automáticos com
  `source="payment"` a partir de um webhook verificado do Mercado Pago. O CLI continua existindo e
  continua sendo o único caminho HUMANO; o que mudou é que agora existe um caminho de MÁQUINA, e ele
  é o normal. A frase valia até 2026-07-23 (PR #28).
- **`[F02B-003]` — FR-312/SC-306 "teasers honestos, sem preço".** O teaser mostra preço desde o E6
  PR-C (`apps/web/src/shared/billing/price-line.ts` → "Premium: R$ 15,99/mês"). A intenção original
  ("não prometer o que não se pode cobrar") foi ATENDIDA de outro jeito: agora é possível cobrar,
  então mostrar o preço passou a ser a opção honesta, e omiti-lo é que seria evasivo.
- **`[F02B-004]` — as contagens do `dod-evidence.md`.** Elas são um retrato de 2026-07-10, não uma
  contagem viva ("89 pytest", "295 web tests" contra ~460 e ~1.228 hoje). Não é drift: é a natureza
  do documento. Fica escrito para que ninguém os leia como estado atual.

### Session 2026-07-09 (owner decisions taken pre-spec, via product-owner scope draft)

- Q1 — Products depth in E2 → **(c) minimal live-recompute product** (named inputs + refs; recomputed with
  the CURRENT formula version; no variants/images/versioning; frozen snapshots stay E4/TD-009-A13). P2.
- Q2 — Catalog offline semantics → **(b) offline read/pre-fill cache + online-only writes** (no write queue,
  no conflict resolution, no conflict error code in E2).
- Q3 — Data fate on premium lapse (A27, HIGH — shapes the schema) → **(a) read-only freeze**: retained,
  visible, pre-fillable; writes blocked; NEVER auto-deleted in v1 (user-initiated deletion + full LGPD
  deferred).
- Q5 — Free-tier "salvar" UX → **honest teaser**: affordances visible, tap intercepted with an honest Premium
  notice (no price/date, no fake save). A31 (free local draft) stays OUT — the R3 zero-free-persistence rule
  is not reopened.
- Q4 — **Routed to the plan phase**: the entitlement-flag storage mechanism (token claim vs database row vs
  hybrid) is the TD-005 ADR, presented by the arquiteto to the owner with options. The spec fixes only the
  product constraints: grant metadata (source + expiry), operator-only, honest Conta surface,
  ≤ one-refresh propagation with honest UX during the window.
- Q6 — Assumption consistent with the recorded deploy posture (deferred until v1, revisitable): E2 is built
  and verified against a **local development database** in dev/CI; cloud database provisioning (A41) is
  deferred to the v1-launch increment.

## Assumptions

- The freemium boundary is fixed and not reopened: computation free, ANY persistence Premium, zero free
  quota (R3 2026-06-29); premium = unlimited (no quota error code needed).
- Premium is granted out-of-band (beta/comp) until E6 delivers billing; self-service purchase is E6.
- Google sign-in remains the only provider through E2 (A28 flagged: an alternative is owed before E6/store
  submission).
- E2 develops and verifies against a local development database in dev/CI; cloud provisioning stays deferred
  with the deploy posture (revisitable, owner rule 2026-07-09).
- The existing auth (`/me`), typed transport, error-envelope vocabulary, and pt-BR validation rules are
  reused — E2 extends them (one new error code) rather than rebuilding.
- The fee catalog (marketplace rates, 005) is unrelated infrastructure: it stays curated in-repo and public;
  E2's catalog is the USER's private data.
- Energy tariff (`R$/kWh`) belongs to neither filament nor printer: it is modeled as a saved-product input
  (like the piece fields), staying a manual calculator field otherwise. A per-account "default tariff"
  setting is a candidate later refinement (designer-ux may revisit), not E2 scope.

## Out of Scope

- **Billing / purchase / self-service upgrade** → E6 (grants stay out-of-band).
- **Calculation history + frozen snapshots (formula-version-stamped) + export/share** → E4 (E2 products
  live-recompute; TD-009/A13 stays E4).
- **Multi-piece BOM** → E3 (E2 saves single reusable pieces).
- **Saved marketplace-simulation scenarios** → E5.
- **Taxes/imposto** → still OUT (A24 rationale unchanged).
- **Full LGPD program** (consent management, self-service data deletion) → deferred; the retention posture is
  decided (Q3 freeze, never auto-delete) and the 006 privacy notice gains a data-saving line when catalog
  ships publicly.
- **Offline WRITE queue / conflict sync** → not in E2 (Q2); revisit only with a real multi-device-offline
  demand.
- **User-editable marketplace fee catalog / admin UI** → unchanged from E1 (curated in-repo).
- **Public deploy of E2** → the first deploy waits for v1 = E1–E6 (owner rule, revisitable); E2 ships to
  `develop` and is homologated locally.
- **Additional auth providers** → owed before E6 (A28), not E2.
