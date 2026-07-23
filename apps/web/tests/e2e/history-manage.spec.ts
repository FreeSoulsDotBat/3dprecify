import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import {
  grantPremium,
  recordFromCalculator,
  revokePremium,
  signUpThrowaway,
} from "./history-helpers";

// 009/T024 (E4, PR-B) e2e — the two claims of PR-B that only the REAL stack can settle:
//
//   · US3/SC-502 — the TWO-SHELF rule. A snapshot CONTAINS its values; the catalog LIVE-reflects. So
//     deleting the very product a snapshot was cut from must move NOTHING on the frozen document — it
//     only makes the read-time "Abrir produto" origin link stop resolving. No FK, no cascade, no lie.
//   · US6/SC-508 — a lapse is not a deletion. Reading stays open (the Q3 read-only freeze); the
//     manage surface (rename/delete) simply disappears; a re-grant restores it with the data intact.
//
// The unit/integration layers prove each half in isolation (origin.test.ts, test_history.py §3c/§2c);
// this is the layer where the client's live catalog query and the server's read-time gate run
// together against Postgres — the only place the two-shelf contrast is actually visible to a seller.
//
// A note on navigation: the detail is reached by OPENING it from the ledger (a card click), exactly
// as a seller does — never by a cold deep-link (013/deep-links.spec.ts covers THAT class directly).
// `?snapshot=<id>` requires an authenticated session, so a full page-load of that URL races the
// session bootstrap; the list `/historico` is public and is the real entry point to a record.

const t = messages;

/** Open a snapshot's detail the way a seller does — from the ledger. The card TITLE is stable across
 *  churn/lapse (a frozen label or the frozen origin name), so it identifies the record throughout. */
async function openFromLedger(page: Page, cardTitle: string): Promise<void> {
  await page.goto("/historico");
  await page.getByText(cardTitle).first().click();
  // 013/F-02 (D1=A): the detail is `?snapshot=<id>` on `/historico`, not `/historico/<id>` — the
  // old 2-segment shape `base:'./'` blanked on cold-load, which is exactly why it moved.
  await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
}

test("SC-502/US3: deleting the origin product never moves the snapshot's values — only its link goes", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-churn-${info.workerIndex}`);
  grantPremium(email);

  // Materialize a product the honest way: a one-line kit save turns "Peça 1 · <kit>" into a product.
  await page.goto("/kits");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
  await expect(page.getByText(/R\$\s?20,60/).first()).toBeVisible();
  await page.getByRole("textbox", { name: new RegExp(t.bom.kitName) }).fill("Kit Origem");
  await page.getByRole("button", { name: t.bom.save, exact: true }).click();
  await expect(page.getByText(t.bom.saved)).toBeVisible();

  const piece = "Peça 1 · Kit Origem";

  // Record a snapshot FROM the product page — provenance = PRODUCT, the origin the calculator (which
  // binds a filament/printer, never a product) cannot itself set.
  await page.goto("/catalogo?tab=products");
  await page.getByText(piece).click();
  await expect(page.getByText(/R\$\s?30,90/).first()).toBeVisible(); // varejo of custo 20,60
  await recordFromCalculator(page); // the SAME RecordSnapshotButton + sheet as the calculator
  // Wait for the record to SETTLE (online ⇒ synced) before navigating — else the goto aborts the
  // in-flight enqueue+drain and the snapshot is silently lost.
  await expect(page.getByText(t.historico.saved)).toBeVisible();

  // In the ledger the snapshot carries the frozen value AND a live "Abrir produto" origin link. (The
  // card is titled by the frozen origin name, since the record has no manual label.)
  await openFromLedger(page, piece);
  await expect(page.getByText(/R\$\s?30,90/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: t.historico.openProduct })).toBeVisible();

  // CHURN: delete the origin product through the catalog — the seller's own action (T023). The
  // server soft-deletes it, so it drops out of the LIVE catalog the origin resolver reads.
  await page.goto("/catalogo?tab=products");
  await page.getByRole("button", { name: `${t.catalogo.remove} ${piece}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.catalogForm.deleteConfirm, exact: true })
    .click();
  await expect(page.getByText(piece)).toHaveCount(0); // gone from the catalog

  // Reopen the SAME snapshot from the ledger — its card still names the frozen origin. The document
  // is INERT: the frozen value is unchanged, and the origin link is simply GONE — never a broken
  // link, never a "produto removido" claim on a document that records no such thing.
  await openFromLedger(page, piece);
  await expect(page.getByText(/R\$\s?30,90/).first()).toBeVisible(); // byte-identical claim
  await expect(page.getByRole("link", { name: t.historico.openProduct })).toHaveCount(0);
  await expect(page.getByText(/removid|excluíd|deletad/i)).toHaveCount(0);
});

test("SC-508/US6: a lapse freezes rename+delete but never the reading — a re-grant restores them", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-lapse-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByRole("button", { name: t.historico.saveAction })).toBeVisible();
  await recordFromCalculator(page);
  // Settle before navigating (online ⇒ synced) — else the goto aborts the enqueue+drain.
  await expect(page.getByText(t.historico.saved)).toBeVisible();

  // The card of an unlabelled calculator record is titled by the honest neutral fallback.
  const card = t.historico.adhocFallback;

  // While ACTIVE, both writes are offered on the detail (ADR-0019: the label is the one mutable
  // field; delete is soft + confirmed).
  await openFromLedger(page, card);
  await expect(page.getByText(/R\$/).first()).toBeVisible(); // the frozen document renders
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();
  await expect(page.getByRole("button", { name: t.historico.deleteAction })).toBeVisible();

  // LAPSE — revoke the grant. The record itself is untouched (nothing auto-deletes on a lapse).
  revokePremium(email);
  await openFromLedger(page, card);
  // Reading stays open (require_catalog_read); writing is gone — neither affordance is offered, and
  // the server would deny it regardless.
  await expect(page.getByText(/R\$/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.historico.deleteAction })).toHaveCount(0);

  // RE-GRANT restores the manage surface — the record intact the whole time (SC-508).
  grantPremium(email);
  await openFromLedger(page, card);
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();
  await expect(page.getByText(/R\$/).first()).toBeVisible();
});
