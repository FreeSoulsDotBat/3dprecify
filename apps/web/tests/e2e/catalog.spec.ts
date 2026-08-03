import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";

// E2 T025 — the FULL premium loop against the REAL stack (backend + Postgres + Auth emulator):
// throwaway sign-up → JIT account → operator CLI grant (the honest path — no HTTP grant route
// exists, ADR-0012) → catalog CRUD → calculator pre-fill (SC-305 numbers) → Conta shows the
// plan → offline read from the uid-keyed cache. Free/never-granted sees the honest deny.

const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
const t = messages;

async function signUpThrowaway(page: Page, tag: string): Promise<string> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      void w.__e2eAuth.signUp(em, pw); // fire-and-forget (redirect destroys the eval context)
    },
    { em: email, pw: "test-passw0rd" },
  );
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  return email;
}

/** Grant premium through the REAL operator path (the CLI writing the ledger — ADR-0012). */
function grantPremium(email: string): void {
  execSync(`uv run python -m app.scripts.grant_premium grant ${email} --source beta --by e2e`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

test("premium loop: grant → save filament+printer → calculator fills itself → Conta shows Premium (T025)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `cat-${info.workerIndex}`);

  // Never-granted: Catálogo shows the honest server deny (403 ENTITLEMENT_REQUIRED placeholder)
  // — and this authenticated request JIT-provisions the account the CLI grants below.
  await page.goto("/catalogo");
  await expect(page.getByText(t.apiError.entitlementRequired).first()).toBeVisible();

  grantPremium(email);
  await page.reload();

  // Filaments tab (default): create "PLA Azul" 110.00 / 1.000 kg / waste 5.
  await expect(page.getByRole("tab", { name: t.catalogo.tabFilaments })).toBeVisible();
  await page.getByRole("button", { name: t.catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("PLA Azul");
  await page.getByRole("textbox", { name: new RegExp(t.catalogForm.material) }).fill("PLA");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
    .fill("110");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) }).fill("1");
  await page.getByRole("textbox", { name: new RegExp(t.catalogForm.defaultWaste) }).fill("5");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("PLA Azul")).toBeVisible();

  // Printers tab: create "Ender 3" 1200 / 2000 h / 0,12 kW / reserve 0,5.
  await page.getByRole("tab", { name: t.catalogo.tabPrinters }).click();
  await page.getByRole("button", { name: t.catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("Ender 3");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) })
    .fill("1200");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineLifetime) })
    .fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.avgPower) }).fill("0,12");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.maintenance) })
    .fill("0,5");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("Ender 3")).toBeVisible();

  // Calculator: pick both → fields pre-fill (editable) and the price is the SC-305 number.
  await page.goto("/calcular");
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.filament })
    .selectOption({ label: "PLA Azul" });
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.printer })
    .selectOption({ label: "Ender 3" });

  await expect(
    page.getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) }),
  ).toHaveValue("110,00");
  await expect(
    page.getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) }),
  ).toHaveValue("1200,00");
  // material 110×(100+5)/1000=11,55 · energy 5×0,12×1=0,60 · machine (1200/2000+0,5)×5=5,50
  // → custo 17,65 → varejo ×1,5 = 26,48 (HALF_UP). The catalog changed convenience, not math.
  await expect(page.getByText("R$ 26,48").first()).toBeVisible();

  // Conta reflects the plan honestly (T025b) — served by the real /entitlement.
  await page.goto("/conta");
  await expect(page.getByText(t.conta.planPremium, { exact: true })).toBeVisible();

  // Offline read (Q2/FR-309): after the online loads above, the picker still answers from the
  // uid-keyed device cache with the network gone.
  await page.goto("/calcular");
  await expect(
    page.getByRole("combobox", { name: t.calculator.catalogPicker.filament }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.filament })
    .selectOption({ label: "PLA Azul" });
  await expect(
    page.getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) }),
  ).toHaveValue("110,00");
  await page.context().setOffline(false);
});

test("free signed-in account: catalog denies honestly, calculator stays fully usable (SC-310)", async ({
  page,
}, info) => {
  await signUpThrowaway(page, `free-${info.workerIndex}`);

  await page.goto("/catalogo");
  await expect(page.getByText(t.apiError.entitlementRequired).first()).toBeVisible();

  // No picker renders for a never-granted account; the manual calculator is untouched.
  await page.goto("/calcular");
  await expect(
    page.getByRole("combobox", { name: t.calculator.catalogPicker.filament }),
  ).toHaveCount(0);
  await expect(page.getByText("R$ 30,90")).toBeVisible(); // seed varejo — the free math lives
});

test("signed-out: Catálogo tab + calculator slot show the honest teaser — no price, no fake save (US7/T031)", async ({
  page,
}) => {
  // The Catálogo tab explains the premium value honestly — never a bounce, never broken CRUD.
  await page.goto("/catalogo");
  await expect(page.getByText(t.catalogo.teaserTitle)).toBeVisible();
  await page.getByRole("button", { name: t.catalogo.addFilament }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t.catalogo.teaserDialogTitle)).toBeVisible();
  await expect(dialog.getByText(t.catalogo.teaserSignedOutBody)).toBeVisible();
  // E6/US7 — o Dialog agora MOSTRA o preco real e um caminho para assinar; a proibicao valia
  // enquanto a cobranca nao existia. Sobra a honestidade: so os tres precos praticados.
  for (const n of (await dialog.innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(n);
  }
  await dialog.getByRole("button", { name: t.catalogo.teaserDismiss }).click();

  // The calculator's "usar do catálogo" slot is a visible affordance → the same teaser; the
  // free manual calculator keeps computing behind it (SC-310).
  await page.goto("/calcular");
  await page.getByRole("button", { name: t.calculator.catalogPicker.title }).click();
  await expect(page.getByRole("dialog").getByText(t.catalogo.teaserDialogTitle)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: t.catalogo.teaserDismiss }).click();
  await expect(page.getByText("R$ 30,90")).toBeVisible();
});
