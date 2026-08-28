import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/T047 — os screenshots 1:1 da PR-B (Premium sem parede), nos dois temas, para
// `specs/019-porte-design/evidencias/pr-b/`. Só roda com `PORTE_SCREENSHOTS=1` (é evidência, não
// gate); as asserções são mínimas — o julgamento é do dono na segunda passada (Rodada 1 antes).
// Os 4 estados da task: grátis (nunca teve) · grant vencido com itens · deslogado · e o desktop
// 1280+ (32g, o vazio e o formulário lado a lado) — cada um a 390px e, o que a prancheta desenha
// largo, a 1920px. Também MEDE o que o teaser-sweep conta: quantos convites há na tela.

const OUT = fileURLToPath(
  new URL("../../../../specs/019-porte-design/evidencias/pr-b/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const t = messages;
const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1 });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((th) => {
    document.documentElement.dataset.theme = th;
  }, theme);
}

function vencerGrants(email: string): void {
  const sql =
    "UPDATE entitlement_grants SET expires_at = now() - make_interval(hours => 1)" +
    " WHERE account_uid IN (SELECT account_uid FROM accounts WHERE email = :m)";
  const py =
    "import os,sys,sqlalchemy as sa;" +
    "e=sa.create_engine(os.environ['P3D_DATABASE_URL']);c=e.connect();" +
    `n=c.execute(sa.text(${JSON.stringify(sql).replace(/"/g, "'")}),{'m':sys.argv[1]}).rowcount;` +
    "c.commit();sys.exit(0 if n>0 else 3)";
  execSync(`uv run python -c "${py}" ${email}`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

const medidas: Record<string, unknown> = {};
async function medir(page: Page, chave: string): Promise<void> {
  medidas[chave] = {
    viewport: page.viewportSize(),
    convites: await page.getByTestId("teaser-upgrade-cta").count(),
    frozen: await page.getByTestId("catalog-form-frozen").count(),
    vazioDidatico: await page.getByTestId("vazio-didatico").count(),
    overflowX: await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  };
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
test.afterAll(() =>
  writeFileSync(join(OUT, "medidas-pr-b.json"), JSON.stringify(medidas, null, 2) + "\n"),
);

for (const theme of THEMES) {
  test.describe(`390px · ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test(`grátis (nunca teve): vazio didático + formulário inerte + kits + orçamentos + simulações`, async ({
      page,
    }, info) => {
      await signUpThrowaway(page, `shot-free-${theme}-${info.workerIndex}`);
      await page.goto("/catalogo");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-catalogo-vazio-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-catalogo-vazio-390-${theme}.png`) });

      await page.getByRole("button", { name: t.catalogo.addFilament }).first().click();
      await expect(page.getByTestId("catalog-form-frozen")).toBeVisible();
      await medir(page, `free-catalogo-form-inerte-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-catalogo-form-inerte-390-${theme}.png`) });

      await page.goto("/catalogo?tab=printers");
      await setTheme(page, theme);
      await page.getByRole("button", { name: t.catalogo.addPrinter }).first().click();
      await expect(page.getByTestId("catalog-form-frozen")).toBeVisible();
      await page.getByText(/potência de placa/).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(OUT, `free-impressora-dica-390-${theme}.png`) });

      await page.goto("/kits");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-kits-vazio-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-kits-vazio-390-${theme}.png`) });
      await page.getByRole("button", { name: t.bom.addLine }).first().click();
      const salvar = page.getByRole("button", { name: t.bom.save, exact: true });
      await expect(salvar).toBeVisible();
      await salvar.scrollIntoViewIfNeeded();
      await medir(page, `free-kits-composer-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-kits-composer-390-${theme}.png`) });

      await page.goto("/historico");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-orcamentos-vazio-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-orcamentos-vazio-390-${theme}.png`) });

      await page.goto("/calcular");
      await setTheme(page, theme);
      await page.getByRole("button", { name: t.scenarios.navEntry }).click();
      await expect(page.getByRole("dialog").getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-simulacoes-vazio-390-${theme}`);
      await page.screenshot({ path: join(OUT, `free-simulacoes-vazio-390-${theme}.png`) });
    });

    test(`grant vencido com itens: lista + formulário preenchido inerte`, async ({
      page,
    }, info) => {
      const email = await signUpThrowaway(page, `shot-lapsed-${theme}-${info.workerIndex}`);
      await page.goto("/catalogo");
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      grantPremium(email);
      await page.reload();
      await page.getByRole("button", { name: t.catalogo.addFilament }).first().click();
      await page.getByRole("textbox", { name: t.catalogForm.name }).fill("PLA Azul");
      await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
        .fill("94,90");
      await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) })
        .fill("1");
      await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
      await expect(page.getByText(t.catalogForm.savedFilament)).toBeVisible();
      vencerGrants(email);
      await page.reload();
      await setTheme(page, theme);
      await expect(page.getByText("PLA Azul").first()).toBeVisible();
      await medir(page, `lapsed-catalogo-lista-390-${theme}`);
      await page.screenshot({ path: join(OUT, `lapsed-catalogo-lista-390-${theme}.png`) });
      await page.getByText("PLA Azul").first().click();
      await expect(page.getByTestId("catalog-form-frozen")).toBeVisible();
      await medir(page, `lapsed-catalogo-form-390-${theme}`);
      await page.screenshot({ path: join(OUT, `lapsed-catalogo-form-390-${theme}.png`) });
    });

    test(`deslogado: o mesmo caminho`, async ({ page }) => {
      await page.goto("/catalogo");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `signedout-catalogo-vazio-390-${theme}`);
      await page.screenshot({ path: join(OUT, `signedout-catalogo-vazio-390-${theme}.png`) });
      await page.getByRole("button", { name: t.catalogo.addFilament }).first().click();
      await expect(page.getByTestId("catalog-form-frozen")).toBeVisible();
      await medir(page, `signedout-catalogo-form-390-${theme}`);
      await page.screenshot({ path: join(OUT, `signedout-catalogo-form-390-${theme}.png`) });
    });
  });

  test.describe(`1920px · ${theme}`, () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test(`desktop (32g): o vazio e o formulário lado a lado — grátis e deslogado`, async ({
      page,
    }, info) => {
      await page.goto("/catalogo");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `signedout-catalogo-1920-${theme}`);
      await page.screenshot({ path: join(OUT, `signedout-catalogo-1920-${theme}.png`) });

      await page.goto("/kits");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `signedout-kits-1920-${theme}`);
      await page.screenshot({ path: join(OUT, `signedout-kits-1920-${theme}.png`) });

      await page.goto("/historico");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `signedout-orcamentos-1920-${theme}`);
      await page.screenshot({ path: join(OUT, `signedout-orcamentos-1920-${theme}.png`) });

      await signUpThrowaway(page, `shot-free-wide-${theme}-${info.workerIndex}`);
      await page.goto("/catalogo");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-catalogo-1920-${theme}`);
      await page.screenshot({ path: join(OUT, `free-catalogo-1920-${theme}.png`) });
      await page.goto("/catalogo?tab=printers");
      await setTheme(page, theme);
      await expect(page.getByTestId("vazio-didatico")).toBeVisible();
      await medir(page, `free-impressoras-1920-${theme}`);
      await page.screenshot({ path: join(OUT, `free-impressoras-1920-${theme}.png`) });
    });
  });
}
