import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import {
    goOffline,
    grantPremium,
    recordFromCalculator,
    revokePremium,
    signUpThrowaway,
} from "./history-helpers";

// 009/T031 (E4, PR-C, US4) e2e — the claims of the export slice that only the REAL stack can settle.
//
// What this layer uniquely proves (and what it deliberately does NOT):
//
//   · It DOES prove the round trip: an authenticated browser asks the real server, the real
//     `require_entitlement` gate runs, ReportLab renders, and a real file lands on the device. None
//     of that is reachable from a unit test — the frontend mocks the transport, and the backend
//     tests never involve a browser, a token, or a download.
//   · (The PDF's CONTENT is now pinned server-side by `test_export.py`, which decodes the page
//     streams and reads the printed text — see the note below on why THIS layer still does not.)
//   · It DOES prove the WIRE: that the seller's cost-breakdown decision travels as the parameter the
//     server actually reads. A camelCase/snake_case mismatch would make FastAPI silently default it,
//     and the switch would become decorative — the failure mode with no error message.
//   · It DOES prove the client REFLECTS the server's word: a revoked grant reaches the UI as a
//     paused plan (visible, disabled, named) over a record that is still whole — the half of FR-515
//     no backend test can see.
//   · It does NOT prove the server's own 403. That is settled against real Postgres in
//     `test_export.py::TestExportEndpoints` and was re-confirmed on the running stack with a real
//     token at T030. Proving it a third time here would mean widening the e2e auth seam
//     (`firebase.ts` exposes `signUp` only) to hand out ID tokens — a production seam grown for a
//     claim already closed.
//   · It does NOT re-prove SC-506's CONTENT. ReportLab deflates its page streams, so grepping the
//     downloaded bytes for "Material" would pass whether or not the line is in the document — a test
//     that cannot fail is worse than no test. The content is pinned where it can actually be read:
//     `test_export.py::TestQuoteContent` (the content model) and the T030 homologation (the rendered
//     artifact, opened and read). What this spec checks is that the *request* asks for no costs.
//
// Navigation: the detail is opened from the ledger, as a seller does — never a cold deep-link
// (013/deep-links.spec.ts covers that class directly, against the now-migrated `?snapshot=` URL).

const t = messages;

/** Record from the calculator and WAIT for the server's own "Salvo" before moving on.
 *
 *  Every test here needs a SYNCED record (an export needs a server row), and the ledger is rendered
 *  from the account — so navigating to /historico before the POST lands is a race, and losing it
 *  shows "Nenhum registro ainda" and a click that finds nothing. Under 8 workers, mobile lost it.
 *  The wait cannot live in the shared `recordFromCalculator`: the offline specs record while offline,
 *  where the honest confirmation is "pendente", not "salvo". */
async function recordAndWaitSaved(page: Page): Promise<void> {
    await recordFromCalculator(page);
    await expect(page.getByText(t.historico.saved)).toBeVisible();
}

async function openFirstRecord(page: Page): Promise<void> {
    await page.goto("/historico");
    await page.getByText(t.historico.quotedAt.split("{")[0]!.trim()).first().click();
    // 013/F-02 (D1=A): `?snapshot=<id>` on `/historico`, not `/historico/<id>` (the migrated shape).
    await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
}

test("US4: the export round trip — a real PDF, and the default asks for NO cost lines (SC-506)", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `export-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/calcular");
    await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
    await recordAndWaitSaved(page);
    await openFirstRecord(page);

    // Watch the actual request the app makes — the switch is only real if its value reaches the server.
    const quoteRequest = page.waitForRequest((r) => r.url().includes("/quote.pdf"));
    const download = page.waitForEvent("download");

    await page.getByRole("button", { name: t.historico.exportAction }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(t.historico.exportContents)).toBeVisible();
    // Untouched — the default artifact is the one that goes to the seller's customer.
    await expect(
        sheet.getByRole("switch", { name: t.historico.exportIncludeCosts }),
    ).not.toBeChecked();
    await sheet.getByRole("button", { name: t.historico.exportGenerate }).click();

    expect((await quoteRequest).url()).toContain("includeCostBreakdown=false");

    // A real file, with the name the SERVER chose, carrying real PDF bytes.
    const file = await download;
    expect(file.suggestedFilename()).toBe("orcamento.pdf");
    const path = await file.path();
    const bytes = await import("node:fs/promises").then((fs) => fs.readFile(path));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000); // a rendered quote, not an empty shell
});

test("US4: the opt-in is the ONLY way the breakdown travels (Q4/FR-512)", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `export-optin-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/calcular");
    await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
    await recordAndWaitSaved(page);
    await openFirstRecord(page);

    const quoteRequest = page.waitForRequest((r) => r.url().includes("/quote.pdf"));
    const download = page.waitForEvent("download");

    await page.getByRole("button", { name: t.historico.exportAction }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("switch", { name: t.historico.exportIncludeCosts }).click();
    await sheet.getByRole("button", { name: t.historico.exportGenerate }).click();

    expect((await quoteRequest).url()).toContain("includeCostBreakdown=true");
    await download;

    // Reopening starts OFF again: the decision to show a customer the cost lines is per-quote, and a
    // remembered "on" would leak the margin on the NEXT one silently.
    await page.getByRole("button", { name: t.historico.exportAction }).click();
    await expect(
        page.getByRole("dialog").getByRole("switch", { name: t.historico.exportIncludeCosts }),
    ).not.toBeChecked();
});

// The SERVER's own refusal (403 ENTITLEMENT_REQUIRED, zero bytes) is proven in
// `test_export.py::TestExportEndpoints` against real Postgres, and was re-confirmed on the running
// stack with a real token during the T030 homologation. Proving it a third time HERE would mean
// widening the e2e auth seam (`firebase.ts` exposes `signUp` only) to hand out ID tokens — a
// production seam grown for a test whose claim is already settled. What this test adds instead is
// the half no backend test can see: that the client faithfully REFLECTS that refusal, and reflects
// it as a paused plan rather than a missing record.
test("SC-508: a lapse pauses the export and says so — the record itself stays whole (FR-517)", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `export-lapse-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/calcular");
    await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
    await recordAndWaitSaved(page);
    await openFirstRecord(page);

    revokePremium(email);
    await page.reload();
    await openFirstRecord(page);

    // Visible, disabled, and it names which thing is paused (ux §6) — not a vanished button.
    const button = page.getByRole("button", { name: t.historico.exportAction });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByText(t.historico.exportLapsed)).toBeVisible();
    // The record is NOT gone and NOT degraded: a lapse pauses writes, it deletes nothing (FR-517).
    await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
});

test("US4: offline, the affordance is disabled WITH ITS REASON — never a spinner into nothing", async ({
    page,
    context,
}, info) => {
    const email = await signUpThrowaway(page, `export-offline-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/calcular");
    await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
    await recordAndWaitSaved(page);
    await openFirstRecord(page);

    await goOffline(page, context);

    const button = page.getByRole("button", { name: t.historico.exportAction });
    await expect(button).toBeDisabled();
    await expect(page.getByText(t.historico.exportOffline)).toBeVisible();
});
