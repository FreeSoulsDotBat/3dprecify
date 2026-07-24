# L4 — Frontend surfaces + E6-over-013 merge integrity

**Lens**: frontend + merge-integrity. **Scope**: `develop` after 013 remediation (#29, `42cc45c`)
then E6 billing (#28, `0a3296b`) merged on top. **Mode**: read-only, findings only.

**Verdict**: the E6-over-013 merge is **COHERENT** — the route-migration/checkout-return unification
is sound with strong evidence (see §1). **One real defect** predates the merge and rode through it
unchanged: the lapsed read-only variant is **incomplete on the Produtos surface** (F-1, Medium). All
other audited surfaces (billing honesty, i18n wiring, DS icon removal) verify clean.

---

## §1 · router.tsx — merge unification [VERIFICADO]

The merge resolved 013/F-02 (2-segment → query-param routes) and E6/T016 (checkout-return query
preservation) into **one** mechanism. Confirmed sound on all four sub-checks:

- **(a) No dangling 2-segment target.** Every internal `navigate`/`Link` targets the new query-param
  shape: `products-panel.tsx:62-63` → `/catalogo?produto=…`, `historico-page.tsx:79` reads
  `?snapshot=`. Grep for `/catalogo/produtos|/historico/$|produtos/novo` across `*.tsx` finds only
  (i) the redirect-only route defs in `router.tsx` themselves, (ii) redirect-target tests
  (`router.guards.test.tsx`), (iii) explanatory comments. No live component points at a 2-segment URL.
  `[VERIFICADO]`
- **(b) `safeRedirect` preserves the query for ALL three cases.** `router.tsx:43-47` — the string-href
  form: `known = base match OR target.startsWith(`${base}?`)`. `RETURN_TO_INTENT` (line 32) includes
  `/catalogo`, `/historico`, **and `/conta`**, so `/catalogo?produto=…`, `/historico?snapshot=…` AND
  E6's `/conta?checkout=retorno` all match the `base?…` clause and travel untouched through `/sign-in`
  (`signInRoute.beforeLoad` line 231 redirects with `href:`, not `to:`). `contaRoute.beforeLoad`
  (line 213) uses `location.href` so the `?checkout=retorno` is captured into `redirect` when auth
  bounces. **The E6 `{to, search}` split T016 introduced was correctly collapsed into 013's href form**
  (comment lines 39-42). `[VERIFICADO]`
- **(c) No orphan route component.** The three deprecated routes (`produtoNovoRoute`,
  `produtoEditRoute`, `snapshotDetailRoute`) carry **only** `beforeLoad` redirect, **no `component`** —
  they import no dead module. `ProdutoPage`/`SnapshotDetailPage` are rendered inline by
  `CatalogoPage`/`HistoricoPage`. Nothing dangles. `[VERIFICADO]`
- **(d) Tab-derivation consistent.** `catalogo-page.tsx:105-107` derives `active` from
  `TABS.some(t => t.id === search.tab)` over all 4 ids; `router.tsx:100-111` `validateSearch` accepts
  exactly `filaments|printers|products|kits`. Consistent, and the 013/F-02 follow-up (derive-not-
  useState, `catalogo-page.tsx:92-104`) is present with its regression guard. `[VERIFICADO]`

## §2 · Billing surfaces — honesty [VERIFICADO]

- **OfferPanel** (`offer-panel.tsx`): prices from the single `billing-plans.ts` constant; no "de/por",
  no struck price; "já é Premium" guard (line 26) hides the cards when `status === active`. Honest.
- **BillingCta** (`billing-cta.tsx`): a tap NEVER pre-flips premium; signed-out routes through
  `/sign-in` with `signInRedirect` (default `/conta`, whitelisted); signed-in starts a real checkout
  and hands to MP via `window.location.assign(initPoint)`; 409→`conflict`, else→`unavailable`, both
  honest sentences, never a raw code. Stays `pending` through navigation (no re-enabled flash).
- **CheckoutReturnPanel** (`checkout-return.tsx`): bounded poll (15×3s) of server truth;
  success ONLY on `status===active && source===payment` (`isVerifiedPaymentGrant`); the exhausted
  state says "se você não concluiu, nada foi cobrado" — abandoned is indistinguishable from
  never-started. No "processando" implying a charge. Honest.
- **Return panel actually receives `checkout=retorno` after the merge**: `conta-page.tsx:190-199`
  reads `search.checkout` and takes over the page with `CheckoutReturnPanel`; `contaRoute.validateSearch`
  (`router.tsx:210-212`) admits `checkout: "retorno"`. Wired end-to-end. `[VERIFICADO]`

## §3 · i18n messages.pt-br.ts [VERIFICADO, one nit]

- Both `billing:` (lines 811-848) and `ds:` (852-855) blocks kept by the merge. **Every billing key
  referenced by a component resolves** (returnSuccess/Unconfirmed/Pending*, handoffNotice,
  cardNeverTouches, checkoutInProgress, offerUnavailable, alreadyPremium, subscribeAction, offerTitle,
  offer plan keys via `billing-plans.ts`). No missing key. `[VERIFICADO]`
- **DS a11y labels (FC-02) injected correctly**: `dialog.tsx:46` defaults `closeLabel = messages.ds.close`;
  `toast.tsx:83-84` default `closeLabel = messages.ds.close` / `regionLabel = messages.ds.notifications`,
  both applied to `aria-label`. `[VERIFICADO]`
- **NIT (Info): orphan string** `billing.openingCheckout` (line 831) is defined but referenced by NO
  component (BillingCta uses the button `loading` spinner, not this string). Dead copy, zero runtime
  impact. `[VERIFICADO]`

## §4 · DS after FC-01 icon removal + string moves [VERIFICADO]

- `icon.tsx` registry now holds 22 named glyphs. Every `<Icon name=…>` in the tree resolves to one of
  them; the dynamic maps (`alert.tsx:15-20` TONE_ICON → info/circle-check/circle-alert;
  `empty-state.tsx` `icon?: IconName`) reference only surviving icons. All are typed `IconName`, so any
  removed-icon reference would fail `gate:all` typecheck — the shipped green gate is the proof.
- The `name="arco"`/`name="espada"` hits are `<Grafismo>` brand illustrations, **not** `<Icon>` — not
  touched by FC-01. No component references a removed icon or a moved string that breaks at runtime.
  `[VERIFICADO]`

---

## §5 · FINDINGS

### F-1 (Medium) — lapsed read-only variant INCOMPLETE on the Produtos surface [VERIFICADO]

`apps/web/src/features/catalog/products-panel.tsx:38-66` — `ProductsPanel` does **not** call
`useEntitlement()` and does **not** pass the `lapsed` prop to `CatalogPanel`. Contrast
`filaments-panel.tsx:45` and `printers-panel.tsx:44`, which both pass
`lapsed={entitlement.data?.status === "lapsed"}`. So on the Produtos tab `lapsed` defaults to `false`
(`catalog-panel.tsx:107`), with three consequences for a **lapsed** account:

1. **Working-then-failing delete** — the exact violation 013/T034 claimed to close. In
   `catalog-panel.tsx:252` the delete onClick is `lapsed ? openEdit(item) : setDeleteTarget(item)`.
   With `lapsed=false`, tapping delete on a lapsed product opens the **working** destructive confirm
   Dialog; submitting fires `useDeleteProduct` → server **403 ENTITLEMENT_REQUIRED**. This is precisely
   ux-catalog §3 "nunca mostre um delete funcionando e depois falhe" — the nit
   `013 dod-evidence.md:25` says was fixed. It is fixed for filaments/printers, **not products**.
2. **No "Premium pausado" banner** on the Produtos tab (`catalog-panel.tsx:274` gated on `lapsed`).
3. **No per-row "somente leitura" hint** (`catalog-panel.tsx:222` gated on `lapsed`).

Add and Edit on Produtos ARE honest (they navigate to `/catalogo?produto=…`, and
`catalogo-page.tsx:134` passes `readOnly={status==="lapsed"}` to `ProdutoPage`) — only **delete** and
the **lapsed signalling** are missing.

- **Merge integrity**: NOT a merge regression. `git show 42cc45c:…/products-panel.tsx` (013's own
  merge) already lacked `lapsed`/`useEntitlement`; `0a3296b` (E6) carried it through byte-unchanged.
  The gap is **pre-existing in 013** and contradicts its own shipped evidence.
- **Why it slipped**: `spec.md` SC-003 requires the reactivation invite "em TODAS" the catalog
  surfaces, and T034 homologated a lapsed account with a product seeded — but the lapsed unit test
  (`catalogo.test.tsx`) and the default tab are **filaments**; no test exercises the Produtos tab under
  lapsed, so the delete-honesty regression guard never covered products.
- **Server is still the boundary** — the 403 enforces the gate, so no data-integrity or financial risk;
  this is an honesty/UX defect on one of three surfaces, and it falsifies a shipped homologation claim.
- **Fix direction**: in `products-panel.tsx`, add `const entitlement = useEntitlement();` and pass
  `lapsed={entitlement.data?.status === "lapsed"}` to `CatalogPanel` (one line, mirrors the two sibling
  panels). Delete then routes to the read-only reactivation surface like edit; banner + row hint appear.
  Add a lapsed Produtos-tab test to close the coverage hole.

### F-2 (Info) — orphan i18n string `billing.openingCheckout` [VERIFICADO]

`messages.pt-br.ts:831` — defined, no consumer. Dead copy; remove or wire into BillingCta's pending
affordance. No runtime impact.

---

## §6 · What the owner must know

The E6-over-013 merge is **coherent** — routes, `safeRedirect`, checkout-return, i18n and DS all
reconcile cleanly. The one thing to act on is **pre-existing, not from the merge**: the lapsed
read-only catalog variant was only wired on filaments/printers — **the Produtos tab still opens a
working delete that 403s on submit and shows no "Premium pausado" banner**, directly contradicting 013
SC-003 and the T034 evidence. One-line fix (`lapsed` prop on `ProductsPanel`) + a Produtos-tab lapsed
test.
