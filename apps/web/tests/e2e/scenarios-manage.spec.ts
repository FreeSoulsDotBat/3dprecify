import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, revokePremium, signUpThrowaway } from "./history-helpers";

// 010/T030 (E5, PR-B) e2e — the PR-B loop against the REAL stack (Postgres + the entitlement gate
// + the Firebase Auth emulator): D3 live-reflect + D6 honest degradation (both PRODUCT-basis, the
// T021b entry point on `produto-page`), duplicate-to-tweak independence, manage (rename/edit-
// config/search/delete), and the lapse read-only freeze. Reach every scenario surface via
// CLIENT-NAV (a Sheet inside /calcular, or a real router Link) — never a 2-segment `page.goto`
// deep link (`/catalogo/produtos/$id` is one of the known blank-route traps).
//
// Defects #1 (backend `_price_input_dict` wrong key shape) and #2 (calcular-page dirty-tracking
// never firing) reported in an earlier QA pass are FIXED (`89f9e1d`, `27d6a24`) and reconfirmed
// green here — D3, D6, and duplicate-to-tweak (which depends on the dirty gate) all pass.
//
// KNOWN APP DEFECT #3 — STILL PRESENT after the `b0f5c37` fix attempt (reconfirmed 2026-07-20 with
// an isolated repro, NOT worked around): renaming a scenario from the LIST's pencil icon (a Sheet
// nested INSIDE the already-open "Meus cenários" list Sheet — the `tf-*` DS Dialog primitive,
// ADR-0007) still leaves an ORPHANED overlay `<div class="tf-dialog__overlay" data-state="open"
// style="pointer-events:auto">` covering the full viewport after the nested rename Sheet closes —
// `document.elementFromPoint` at the viewport center still resolves to this stray overlay div, not
// the page; `page.getByRole("dialog")` correctly counts only 1 (the outer list, still legitimately
// open). `b0f5c37` fixed the INNER rename Sheet in this same file (`scenarios-list-sheet.tsx`
// ~L370) to stay unconditionally mounted (the correct Radix pattern: let `SheetContent`'s own
// Presence handle animate-out, never gate the whole `<SheetContent>` on local state) — but the
// OUTER `ScenariosListSheet` (~L451-452) still does `{open && (<SheetContent>...)}`, the SAME
// anti-pattern the fix corrected one level down. The delete Dialog in this file (~L411) shows the
// safe alternative: `<DialogContent>` itself is unconditional; only its CHILDREN
// (`{deleteTarget && (...)}`) are gated — `ScenariosListSheet`'s outer Sheet is the one place in
// this file that still gates the CONTENT wrapper itself on `open`, one level above where the fix
// landed. Effect (reconfirmed unchanged): every further click/fill on the page — the list's own
// search field, its cards, even the page's background "Meus cenários" nav button — is silently
// swallowed; a real user would see a frozen, unusable app until reload. The "manage" test below is
// left to fail at this exact step rather than routed around.

const t = messages.calculator;
const s = messages.scenarios;
const pf = messages.productForm;
const catalogo = messages.catalogo;
const cf = messages.catalogForm;
const nav = messages.nav;

async function openScenariosList(page: Page) {
  await page.getByRole("button", { name: s.navEntry }).click();
  return page.getByRole("dialog");
}

/** Create one filament ("PLA Azul" 110/1kg/waste 5) + one printer ("Ender 3" 1200/2000h/0,12kW/0,5)
 *  — the SAME fixture `catalog.spec.ts` (E2/T025) already proved computes "R$ 26,48" with the
 *  calculator's default remaining fields. */
async function createFilamentAndPrinter(page: Page): Promise<void> {
  await page.getByRole("button", { name: catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: cf.name }).fill("PLA Azul");
  await page.getByRole("textbox", { name: new RegExp(cf.material) }).fill("PLA");
  await page.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) }).fill("110");
  await page.getByRole("textbox", { name: new RegExp(t.fields.rollWeight) }).fill("1");
  await page.getByRole("textbox", { name: new RegExp(cf.defaultWaste) }).fill("5");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  await expect(page.getByText("PLA Azul")).toBeVisible();

  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  await page.getByRole("button", { name: catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: cf.name }).fill("Ender 3");
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineValue) }).fill("1200");
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineLifetime) }).fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.fields.avgPower) }).fill("0,12");
  await page.getByRole("textbox", { name: new RegExp(t.fields.maintenance) }).fill("0,5");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  await expect(page.getByText("Ender 3")).toBeVisible();
}

/** Creates a product referencing the filament+printer fixture, opens it (client-nav), and saves a
 *  scenario off it — the T021b PRODUCT-ref capture. Leaves the page on the product's edit route
 *  with the scenario already saved. Returns the product name for later lookups. */
async function createProductWithScenario(
  page: Page,
  productName: string,
  scenarioName: string,
): Promise<void> {
  await page.goto("/catalogo"); // default tab = Filamentos
  await createFilamentAndPrinter(page);

  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
  await page.getByRole("button", { name: catalogo.addProduct }).click(); // client nav → /catalogo/produtos/novo
  await page.getByRole("textbox", { name: pf.nameLabel }).fill(productName);
  await page
    .getByRole("combobox", { name: t.catalogPicker.filament })
    .selectOption({ label: "PLA Azul" });
  await page
    .getByRole("combobox", { name: t.catalogPicker.printer })
    .selectOption({ label: "Ender 3" });
  await expect(page.getByText("R$ 26,48").first()).toBeVisible();
  await page.getByRole("button", { name: pf.saveProduct }).click();
  await expect(page.getByText(pf.savedProduct)).toBeVisible();

  // Back on /catalogo?tab=products (the page's own post-save navigation) — open the product
  // (client-nav row click) to reach the "Salvar cenário" affordance (T021b).
  await page.getByText(productName).click();
  await expect(page.getByText("R$ 26,48").first()).toBeVisible();

  await page.getByTestId("save-scenario-trigger").click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel(s.nameField).fill(scenarioName);
  await sheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();
}

// KNOWN APP DEFECT (found writing this suite, T030, 2026-07-20 — reported, NOT worked around):
// `backend/app/api/scenarios.py::_price_input_dict` (used by `_resolve_product_last_known`, which
// backs BOTH `_resnapshot_cost_basis` at save-time AND `_resolve_cost_basis_for_read` at read-time)
// emits the BOM-LINE-prefixed key shape (`filamentCostPerRoll`/`filamentRollWeightKg`/
// `printerMachineValue`/`printerMachineLifetimeHours`/`printerAvgPowerKw`/
// `printerMaintenanceReservePerHour`/`filamentMaterial`) instead of the FLAT `PriceInput`/
// `CalcFieldName` shape (`costPerRoll`/`rollWeightKg`/`machineValue`/`machineLifetimeHours`/
// `avgPowerKw`/`maintenanceReservePerHour`) a PRODUCT-basis scenario's `costBasis.lastKnown`
// contractually carries — the function's OWN docstring claims "the leaf set matches data-model §3's
// flat `PriceInput` shape exactly", which is false for the 6 filament/printer-linked leaves. The
// frontend's `applyScenarioConfig` (`features/calculator/scenario-bridge.ts`) hydrates the reopen
// form by looking up `lastKnown[name]` for each `CalcFieldName` — those 6 keys never match, so they
// silently stay whatever the calculator form already had (typically `defaultCalcValues`), and the
// reopened price is silently WRONG with no error surfaced. Because `_resnapshot_cost_basis` PERSISTS
// this wrong shape into the DB row at save time (not just at read time), BOTH the D3 live-reflect
// test and the D6 last-known/degraded test below are blocked by the SAME root cause — proven via a
// direct network-log repro (POST /scenarios sent the correct flat shape; the server's OWN response,
// both at create and later reads, already carried the wrong prefixed shape). `filamentMaterial` has
// no `CalcFieldName` counterpart at all and is silently dropped. Piece-only leaves (printGrams,
// wasteGrams, printTimeHours, failurePct, finishTimeHours, finishRatePerHour, laborHours,
// laborRatePerHour, markupVarejoPct, markupAtacadoPct, tariffPerKwh) are unaffected — their key
// names are identical in both shapes. These two tests are left RED on purpose (Constitution
// Principle III/"truth over approval") — they encode the intended VR-605/606 contract and will pass
// once `_price_input_dict` (or a PRODUCT-specific variant of it) is fixed to emit the flat shape.
test.describe("D3/D6 — a scenario referencing a saved product", () => {
  test("D3 live-reflect: editing the linked filament's cost changes the reopened scenario's price (SC-601/VR-605)", async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `scn-d3-${info.workerIndex}`);
    grantPremium(email);
    await page.reload();

    await createProductWithScenario(page, "Vaso Cenário D3", "Cenário Vaso D3");

    // Change the underlying catalog value the product's linked filament resolves to — this is the
    // D3 lever ("linked ⇒ the LIVE row wins", products.py::_to_out) one level below the scenario's
    // OWN D3 resolver (scenarios.py::_resolve_cost_basis_for_read), so a scenario reopen after this
    // edit is genuinely a two-hop live recompute, not a stub.
    await page.getByRole("link", { name: nav.catalogo }).click();
    await expect(page.getByRole("tab", { name: catalogo.tabFilaments })).toBeVisible();
    await page.getByText("PLA Azul").click();
    const editSheet = page.getByRole("dialog");
    await editSheet.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) }).fill("220");
    await editSheet.getByRole("button", { name: cf.saveChanges, exact: true }).click();
    await expect(page.getByText(cf.savedFilament)).toBeVisible();

    // Reopen the scenario from /calcular — the price reflects TODAY's product values (material
    // 220×105/1000=23,10 + energy 0,60 + machine 5,50 = 29,20 → varejo ×1,5 = 43,80), never the
    // R$ 26,48 captured at save time.
    await page.getByRole("link", { name: nav.calcular }).click();
    await page.reload();
    const listDialog = await openScenariosList(page);
    await listDialog.getByText("Cenário Vaso D3").click();
    await expect(page.getByRole("dialog")).toHaveCount(0); // the list sheet closed
    await expect(page.getByText(s.loadedLive)).toBeVisible();
    await expect(page.getByTestId("scenario-context-bar")).not.toContainText(pf.manualValuesKept); // never degraded — the ref still resolves
    await expect(page.getByText("R$ 43,80").first()).toBeVisible();
    await expect(page.getByText("R$ 26,48")).toHaveCount(0); // the stale save-time price is gone
  });

  test("D6 honest degradation: deleting the referenced product degrades to last-known, never claims a removal, stays editable (VR-606)", async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `scn-d6-${info.workerIndex}`);
    grantPremium(email);
    await page.reload();

    await createProductWithScenario(page, "Vaso Cenário D6", "Cenário Vaso D6");

    // Delete the origin product through the catalog — the seller's own action.
    await page.getByRole("link", { name: nav.catalogo }).click();
    await page.getByRole("tab", { name: catalogo.tabProducts }).click();
    await page.getByRole("button", { name: `${catalogo.remove} Vaso Cenário D6` }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: cf.deleteConfirm, exact: true })
      .click();
    await expect(page.getByText("Vaso Cenário D6")).toHaveCount(0);

    // Reopen the scenario — it degrades to last-known: the SAVE-TIME price (R$ 26,48), a calm
    // caption, and NEVER a claim of removal (F1 — the honesty class the E4 lineage guards).
    await page.getByRole("link", { name: nav.calcular }).click();
    await page.reload();
    const listDialog = await openScenariosList(page);
    await listDialog.getByText("Cenário Vaso D6").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(s.loadedLive)).toBeVisible();
    await expect(page.getByText(pf.manualValuesKept)).toBeVisible(); // the honest degraded caption
    await expect(page.getByText("R$ 26,48").first()).toBeVisible(); // last-known, not blank
    await expect(page.getByRole("button", { name: s.openOrigin })).toHaveCount(0); // no broken link
    await expect(page.getByText(/removid|excluíd|deletad/i)).toHaveCount(0); // F1, never inferred

    // Stays editable + re-saveable: change a field, watch the unsaved badge, save it back (PUT).
    const markupField = page.getByRole("textbox", { name: new RegExp(t.fields.markupVarejo) });
    await expect(markupField).toBeEditable();
    await markupField.fill("60");
    await expect(page.getByText(s.unsavedBadge)).toBeVisible();
    await page.getByRole("button", { name: s.saveChanges }).click();
    await expect(page.getByText(s.saveChangesDone)).toBeVisible();
  });
});

test("duplicate-to-tweak: the copy is independent — tweaking it never moves the original (VR-608)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `scn-dup-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  // A real multi-channel comparison worth duplicating: SHOPEE with an explicit commission override.
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("10");

  await page.getByTestId("save-scenario-trigger").click();
  const saveSheet = page.getByRole("dialog");
  await saveSheet.getByLabel(s.nameField).fill("Cenário Base");
  await saveSheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();

  // Duplicate from the list — the copy loads immediately (ux §5).
  const listDialog = await openScenariosList(page);
  await listDialog.getByRole("button", { name: `${s.duplicate} Cenário Base` }).click();
  await expect(page.getByText(s.duplicated)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0); // the list closed, the copy is loaded
  await expect(page.getByText("Cópia de Cenário Base")).toBeVisible();
  // `.fill("10")` writes the raw digits — the field only reformats to "10,00" on parse/blur, and
  // the server preserves whatever scale was submitted (`str(Decimal)`, scale-preserving) — so the
  // round-tripped value is the plain "10", not a fabricated "10,00".
  await expect(
    page
      .getByTestId("channel-slot")
      .nth(0)
      .getByLabel(/^Comissão(?! mínima)/),
  ).toHaveValue("10");

  // Tweak the COPY: rename it and change the override.
  await page.getByRole("button", { name: s.rename }).click();
  const renameSheet = page.getByRole("dialog");
  await renameSheet.getByLabel(s.nameField).fill("Cenário Tweak");
  await renameSheet.getByRole("button", { name: s.saveChanges }).click();
  await expect(page.getByText(s.renamed)).toBeVisible();

  const copyCommission = page
    .getByTestId("channel-slot")
    .nth(0)
    .getByLabel(/^Comissão(?! mínima)/);
  await copyCommission.fill("20");
  await copyCommission.blur();
  await expect(page.getByText(s.unsavedBadge)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: s.saveChanges }).click();
  await expect(page.getByText(s.saveChangesDone)).toBeVisible();

  // Close and reopen the ORIGINAL — byte-for-byte unchanged: still "Cenário Base", override still 10.
  await page.getByRole("button", { name: s.closeScenario }).click();
  const listAfter = await openScenariosList(page);
  // Exact match — "Cenário Base" is a substring of the copy's own "Cópia de Cenário Base" card.
  await listAfter.getByText("Cenário Base", { exact: true }).click();
  await expect(page.getByText(s.loadedLabel.replace("{nome}", "Cenário Base"))).toBeVisible();
  await expect(
    page
      .getByTestId("channel-slot")
      .nth(0)
      .getByLabel(/^Comissão(?! mínima)/),
  ).toHaveValue("10");

  // And the COPY, reopened separately, kept its own tweak (20) — the two are independent both ways.
  const listAgain = await openScenariosList(page);
  await listAgain.getByText("Cenário Tweak").click();
  await expect(
    page
      .getByTestId("channel-slot")
      .nth(0)
      .getByLabel(/^Comissão(?! mínima)/),
  ).toHaveValue("20");
});

test("manage: rename (PATCH), edit-config (PUT), search narrows the list, delete removes it, ordering stays created_at DESC (VR-610-adjacent)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `scn-mgmt-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  async function saveNamed(name: string) {
    await page.getByTestId("save-scenario-trigger").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(s.nameField).fill(name);
    await sheet.getByTestId("save-scenario-submit").click();
    await expect(page.getByText(s.saved)).toBeVisible();
  }

  await saveNamed("Zebra");
  await saveNamed("Alpha"); // created AFTER Zebra → created_at DESC puts it first

  let listDialog = await openScenariosList(page);
  let cards = listDialog.getByTestId("scenario-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Alpha");
  await expect(cards.nth(1)).toContainText("Zebra");

  // Rename "Zebra" (list pencil icon → PATCH) — the name changes, the ORDER does not (created_at,
  // never updated_at).
  await listDialog.getByRole("button", { name: `${s.rename} Zebra` }).click();
  const renameSheet = page.getByRole("dialog");
  await renameSheet.getByLabel(s.nameField).fill("Zebra Renamed");
  await renameSheet.getByRole("button", { name: s.saveChanges }).click();
  await expect(page.getByText(s.renamed)).toBeVisible();
  // The rename correctly happened server-side and the list re-renders with the new name — visible
  // via TEXT assertions, which don't require actionability — but KNOWN APP DEFECT #3 (above) means
  // every further POINTER interaction on the page is now silently swallowed by an orphaned overlay.
  // The rest of this test (search/edit-config/delete) is left to fail there, on purpose.
  await expect(page.getByRole("dialog")).toHaveCount(1);
  listDialog = page.getByRole("dialog");
  cards = listDialog.getByTestId("scenario-card");
  await expect(cards.nth(0)).toContainText("Alpha");
  await expect(cards.nth(1)).toContainText("Zebra Renamed");

  // Search narrows to the matching name only.
  await listDialog.getByLabel(s.searchPlaceholder).fill("Alpha");
  await expect(listDialog.getByTestId("scenario-card")).toHaveCount(1);
  await expect(listDialog.getByText("Alpha")).toBeVisible();
  await expect(listDialog.getByText("Zebra Renamed")).toHaveCount(0);
  await listDialog.getByLabel(s.searchPlaceholder).fill("");
  await expect(listDialog.getByTestId("scenario-card")).toHaveCount(2);

  // Edit-config: reopen "Alpha", change something, "Salvar alterações" (PUT).
  await listDialog.getByText("Alpha").click();
  await expect(page.getByText(s.loadedLabel.replace("{nome}", "Alpha"))).toBeVisible();
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await expect(page.getByText(s.unsavedBadge)).toBeVisible();
  await page.getByRole("button", { name: s.saveChanges }).click();
  await expect(page.getByText(s.saveChangesDone)).toBeVisible();
  await page.getByRole("button", { name: s.closeScenario }).click();

  // Delete "Zebra Renamed" (confirm dialog) — gone from the list.
  listDialog = await openScenariosList(page);
  await listDialog.getByRole("button", { name: `${s.delete} Zebra Renamed` }).click();
  const confirmDialog = page.getByRole("dialog").last();
  await expect(confirmDialog.getByText(s.deleteBody)).toBeVisible();
  await confirmDialog.getByRole("button", { name: s.deleteConfirm, exact: true }).click();
  await expect(page.getByText(s.deleted)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1); // the confirm Dialog closed
  listDialog = page.getByRole("dialog");
  await expect(listDialog.getByTestId("scenario-card")).toHaveCount(1);
  await expect(listDialog.getByText("Zebra Renamed")).toHaveCount(0);
});

test("lapse read-only: reads survive, every write affordance is honestly gated, re-grant restores them intact (VR-610)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `scn-lapse-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  await page.getByTestId("save-scenario-trigger").click();
  const saveSheet = page.getByRole("dialog");
  await saveSheet.getByLabel(s.nameField).fill("Cenário Lapso");
  await saveSheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();

  revokePremium(email);
  await page.reload();

  // Reads survive (200): the list still shows the scenario, with the honest lapsed banner and
  // every write affordance disabled + a reason (never a silent no-op).
  let listDialog = await openScenariosList(page);
  await expect(listDialog.getByText(s.lapsedTitle, { exact: true })).toBeVisible();
  await expect(listDialog.getByText("Cenário Lapso")).toBeVisible();
  await expect(
    listDialog.getByRole("button", { name: `${s.rename} Cenário Lapso` }),
  ).toBeDisabled();
  await expect(
    listDialog.getByRole("button", { name: `${s.duplicate} Cenário Lapso` }),
  ).toBeDisabled();
  await expect(
    listDialog.getByRole("button", { name: `${s.delete} Cenário Lapso` }),
  ).toBeDisabled();
  await expect(listDialog.getByText(s.writeLapsed).first()).toBeVisible();

  // Reopen still works (a read), and the same freeze applies inside the context bar: writes
  // disabled with the reason, and the inline "Salvar cenário" trigger is honestly ABSENT (the
  // SC-109 posture — no active premium, no button — never a disabled ghost of one).
  await listDialog.getByText("Cenário Lapso").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(s.loadedLive)).toBeVisible();
  await expect(page.getByRole("button", { name: s.rename })).toBeDisabled();
  await expect(page.getByRole("button", { name: s.duplicate })).toBeDisabled();
  await expect(page.getByRole("button", { name: s.saveChanges })).toBeDisabled();
  await expect(page.getByText(s.writeLapsed)).toBeVisible();
  await expect(page.getByTestId("save-scenario-trigger")).toHaveCount(0);

  // Re-grant → writes come back to life, data intact the whole time.
  grantPremium(email);
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();
  listDialog = await openScenariosList(page);
  await expect(listDialog.getByText(s.lapsedTitle)).toHaveCount(0);
  await expect(listDialog.getByRole("button", { name: `${s.rename} Cenário Lapso` })).toBeEnabled();
  await listDialog.getByText("Cenário Lapso").click();
  // "Salvar alterações" stays disabled until there IS a change (that's the ordinary dirty-gate, not
  // the lapse freeze) — Renomear/Duplicar are the affordances the lapse freeze itself gated, and
  // they are enabled again with the data intact.
  await expect(page.getByRole("button", { name: s.rename })).toBeEnabled();
  await expect(page.getByRole("button", { name: s.duplicate })).toBeEnabled();
  await expect(page.getByText(s.writeLapsed)).toHaveCount(0);
});
