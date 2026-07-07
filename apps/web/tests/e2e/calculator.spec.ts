import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// The committed fee-catalog served by GET /api/v1/fee-catalog — used to force the ONLINE reference
// seal (source ≠ seed) in the overflow regression below, matching what the deployed endpoint returns.
const servedCatalogJson = readFileSync(
  fileURLToPath(new URL("../../../../backend/app/data/catalog.json", import.meta.url)),
  "utf-8",
);

// Authenticated calculator E2E (US2). Signs a throwaway user in against the Firebase Auth
// emulator through the app's emulator-only seam (window.__e2eAuth, see shared/lib/firebase.ts),
// then drives the calculator. Requires the emulator running — use `pnpm e2e` at the repo root
// (firebase emulators:exec wraps the Playwright run).

async function signInThrowaway(page: import("@playwright/test").Page, tag: string): Promise<void> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    async ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      await w.__e2eAuth.signUp(em, pw);
    },
    { em: email, pw: "test-passw0rd" },
  );
  // The /sign-in guard bounces authenticated users to the calculator at "/".
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
}

test("authenticated user computes the full E1 model (SC-001 canonical vector)", async ({
  page,
}, info) => {
  await signInThrowaway(page, `base-${info.workerIndex}`);

  const f = messages.calculator.fields;
  // The SC-001 worked example → custo_total R$ 28,65, varejo R$ 42,98, atacado R$ 37,25.
  await page.getByLabel(f.costPerRoll).fill("100");
  await page.getByLabel(f.rollWeight).fill("1");
  await page.getByLabel(f.grams).fill("100");
  await page.getByLabel(f.wasteGrams).fill("10");
  await page.getByLabel(f.printTime).fill("5");
  await page.getByLabel(f.avgPower).fill("0,10");
  await page.getByLabel(f.tariff).fill("1");
  await page.getByLabel(f.machineValue).fill("4000");
  await page.getByLabel(f.machineLifetime).fill("2000");
  await page.getByLabel(f.failure).fill("10");
  await page.getByLabel(f.finishTime).fill("0,5");
  await page.getByLabel(f.finishRate).fill("10");
  await page.getByLabel(f.markupVarejo).fill("50");
  await page.getByLabel(f.markupAtacado).fill("30");

  await expect(page.getByText("R$ 28,65")).toBeVisible(); // custo_total breakdown row
  await expect(page.getByText("R$ 42,98")).toBeVisible(); // varejo derivation row
  await expect(page.getByText("R$ 37,25")).toBeVisible(); // atacado derivation row

  // FR-021 / analyze A1: the corrected model carries NO tax/imposto input.
  await expect(page.getByText(/imposto/i)).toHaveCount(0);
});

test("zero roll weight shows a friendly error, no division by zero", async ({ page }, info) => {
  await signInThrowaway(page, `err-${info.workerIndex}`);

  await page.getByLabel(messages.calculator.fields.rollWeight).fill("0");
  await expect(page.getByText(messages.calculator.rollWeightError)).toBeVisible();
});

test("app shell + calculator work offline once the SW has precached (FR-003/FR-011)", async ({
  page,
  context,
}, info) => {
  await signInThrowaway(page, `offline-${info.workerIndex}`);
  // Wait until the service worker controls the page (precache populated).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // navigation served from the SW precache, not the network
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();

  // The pricing calc is client-side, so it still works with no network.
  await page.getByLabel(messages.calculator.fields.costPerRoll).fill("100");
  await page.getByLabel(messages.calculator.fields.rollWeight).fill("1");
  await page.getByLabel(messages.calculator.fields.grams).fill("100");
  // With the remaining pre-filled defaults (5 h · 0,12 kW · tarifa 1 · máquina 4000/2000 h)
  // this yields custo_total R$ 20,60 → varejo R$ 30,90.
  await expect(page.getByText("R$ 30,90")).toBeVisible();

  await context.setOffline(false);
});

test("signed-out user computes offline with a full breakdown — no save/export, no paywall (US6, SC-009)", async ({
  page,
  context,
}) => {
  const t = messages.calculator;
  // No sign-in: /calcular is public (GC-1). Load online first so the SW can precache.
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // served from the SW precache; auth restores "no user" locally
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Full client-side compute + transparent breakdown, offline AND signed-out.
  await page.getByLabel(t.fields.costPerRoll).fill("100");
  await page.getByLabel(t.fields.rollWeight).fill("1");
  await page.getByLabel(t.fields.grams).fill("100");
  await expect(page.getByText("R$ 20,60")).toBeVisible(); // custo_total breakdown row (seed)
  await expect(page.getByText("R$ 30,90")).toBeVisible(); // varejo for the seed

  // SC-009: nothing is saved/exported and there is no upgrade/paywall CTA. The free-tier
  // note is an honest statement (not a call to action) and stays visible.
  await expect(
    page.getByRole("button", { name: /salvar|exportar|assinar|premium|upgrade|desbloquear/i }),
  ).toHaveCount(0);
  await expect(page.getByText(t.freemiumNote)).toBeVisible();

  await context.setOffline(false);
});

test("full model incl. labor + marketplace has no horizontal overflow at 390px (US4/US1, FR-010)", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Fill the US4 labor/admin + the default channel's fees so every new section + the gross-up
  // rows render, then assert the page still fits 390px with no horizontal scrollbar.
  await page.getByLabel(t.fields.laborHours).fill("2");
  await page.getByLabel(t.fields.laborRate).fill("30");
  await page.getByLabel(t.fields.adminTotal).fill("15");
  const slot = page.getByTestId("channel-slot").first();
  await slot.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await slot.getByLabel(t.channels.fixedFee).fill("5");
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);
});

test("US1: prices several channels at once; add/remove isolates rows; commission 100% errors one slot", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // The default channel (Mercado Livre) — give it a fee so its "Preços por canal" rows render.
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("12");
  await slot0.getByLabel(t.channels.fixedFee).fill("6,75");

  // Add a 2nd channel, make it Shopee with its own fee.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await slot1.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await slot1.getByLabel(t.channels.fixedFee).fill("4");

  // Both channels compute together: each shows anúncio + líquido for varejo e atacado
  // (2 channels × 2 markup levels = 4 "Preço para anunciar" rows).
  await expect(page.getByTestId("channel-price")).toHaveCount(2);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(4);
  await expect(page.getByText(t.results.recebidoLiquido)).toHaveCount(4);

  // Remove the Shopee slot → only its rows drop; Mercado Livre keeps computing.
  await slot1.getByRole("button", { name: t.channels.removeChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2);

  // Re-add Shopee, then set Mercado Livre's commission to 100% — it errors ONLY its slot.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const shopee = page.getByTestId("channel-slot").nth(1);
  await shopee.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await shopee.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await shopee.getByLabel(t.channels.fixedFee).fill("4");

  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("100");
  // Honest inline per-slot error, never a NaN/Infinity; the Shopee slot still shows its prices.
  await expect(slot0.getByText(t.validation.commissionMax)).toBeVisible();
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();
});

test("US2: a covered marketplace pre-fills fees with an honesty seal; editing flips to 'ajustado'; uncovered reads 'sem referência'", async ({
  page,
}) => {
  const t = messages.calculator;
  const seals = t.seals;
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);

  // The default channel is Mercado Livre, which is NOT curated in the seed (its per-category rates
  // are unverifiable) → the slot honestly reads "sem referência", never a fabricated number.
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.none);

  // Switch it to Shopee (price-band curated). With the fee fields left BLANK the model pre-fills
  // from the catalog and the channel computes — the seal states the numbers came from a reference.
  // No backend runs in e2e (vite preview only) → the store falls back to the bundled seed, so the
  // reference is the offline-embedded one.
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.embedded);
  // The pre-filled catalog bands drive the per-channel prices with NO manual entry.
  await expect(page.getByTestId("channel-price")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();

  // Editing any fee is an override → the seal flips to "ajustado por você" (an edited number is
  // never silently trusted as the reference).
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("15");
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.adjusted);
  await expect(slot0.getByTestId("fee-seal")).not.toContainText(seals.embedded);

  // Nothing ever yields NaN/Infinity.
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
});

test("US2: the long ONLINE reference seal wraps — no 390px overflow (FR-010, T026b nit #2)", async ({
  page,
}) => {
  const t = messages.calculator;
  // Serve the committed catalog so the store's active source becomes "catalog" (not the seed) → the
  // slot shows the FULL online reference seal ("Referência: <long source> · atualizada em …"), the
  // ~850px string the homologation caught overflowing. Intercept before load (the fetch is on mount).
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");

  // The online reference seal (long) renders — proving the source is the served catalog, not the seed.
  const seal = slot0.getByTestId("fee-seal");
  await expect(seal).toContainText(t.seals.reference); // "Referência"
  await expect(seal).toContainText(t.seals.updatedOn); // "atualizada em"
  await expect(seal).not.toContainText(t.seals.embedded); // not the offline/seed seal

  // The long seal must WRAP inside 390px, never force a horizontal scrollbar (the nit #2 fix).
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);
});
