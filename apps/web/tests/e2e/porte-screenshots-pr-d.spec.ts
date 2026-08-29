import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/T078 — os screenshots 1:1 da PR-D (recálculo do Catálogo), nos dois temas, para
// `specs/019-porte-design/evidencias/pr-d/`. Só roda com `PORTE_SCREENSHOTS=1` (é evidência, não
// gate). Molde: `porte-screenshots-pr-c.spec.ts` (mesma disciplina — `deviceScaleFactor: 1`,
// `shot()` grava a imagem + a caixa medida do DOM em `medidas`). Rodar só no projeto `chromium`
// (`--project=chromium`) — as larguras 1024/1279/1280/1920 não fazem sentido sob o perfil "mobile"
// (`isMobile`/toque fixos), e 390 já sai coberto aqui sem precisar do segundo projeto.
//
// Superfícies (brief do coordenador, T078):
//   (1) a faixa "N preços mudaram" + "era R$ X" + "Salvo em" a 390 (`tf-plist`)
//   (2) o item fixado: `Alert` atenção (custo hoje > fixado) na ficha + a flag "fixado" na lista
//   (3) a lista a 390 (`tf-plist` denso, ≥3 itens) — a MESMA captura do item (1) cobre os dois
//   (4) a `tf-table` a 1024 e a 1279
//   (5) o mestre-detalhe a 1280 (inalterado, 018) e a 1920
//   (6) o cabeçalho da ficha nos 4 estados — recalculado / sem mudança / fixado / parado
//   (7) o diálogo de duplicar
//   (8) a recusa de nome repetido no formulário

const OUT = fileURLToPath(
  new URL("../../../../specs/019-porte-design/evidencias/pr-d/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const t = messages.calculator;
const catalogo = messages.catalogo;
const cf = messages.catalogForm;
const pf = messages.productForm;

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1 });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((th) => {
    document.documentElement.dataset.theme = th;
  }, theme);
}

const medidas: Record<string, unknown> = {};
async function shot(page: Page, chave: string, locator?: ReturnType<Page["locator"]>) {
  const alvo = locator ?? page;
  if (locator) await locator.scrollIntoViewIfNeeded();
  // `animations: "disabled"` — achado da 1ª rodada (29/08): a pílula do Segmented tem
  // `transition: background-color .15s`, e a captura saía ~40 ms depois do `setTheme` — congelava
  // a pílula "Filamentos" no MEIO da troca claro→escuro (rgba(255,255,255,.66) = (174,175,176)),
  // parecendo uma aba selecionada errada. Reproduzido pixel a pixel no main loop; o produto está
  // certo — a captura é que precisa esperar as transições terminarem.
  await alvo.screenshot({ path: join(OUT, `${chave}.png`), animations: "disabled" });
  medidas[chave] = {
    viewport: page.viewportSize(),
    overflowX: await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    box: locator ? await locator.boundingBox() : null,
  };
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
// Funde com o que já está no disco: o `afterAll` roda por worker/arquivo, e o último a terminar
// sobrescrevia os demais (a armadilha do `medidas-*.json` da PR-C — aqui a 1ª rodada gravou `{}`).
test.afterAll(() => {
  const path = join(OUT, "medidas-pr-d.json");
  let prev: Record<string, unknown>;
  try {
    prev = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    prev = {};
  }
  writeFileSync(path, JSON.stringify({ ...prev, ...medidas }, null, 2) + "\n");
});

// ---- Helpers (molde `catalog-recalculo.spec.ts`, T069) ----------------------------------------

async function setupPremiumAccount(page: Page, tag: string): Promise<void> {
  const email = await signUpThrowaway(page, tag);
  await page.goto("/catalogo");
  await expect(page.getByRole("tab", { name: catalogo.tabFilaments })).toBeVisible();
  grantPremium(email);
  await page.reload();
}

async function createFilament(page: Page, name: string, costPerRoll: string): Promise<void> {
  await page.getByRole("button", { name: catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: cf.name }).fill(name);
  await page.getByRole("textbox", { name: new RegExp(cf.material) }).fill("PLA");
  await page.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) }).fill(costPerRoll);
  await page.getByRole("textbox", { name: new RegExp(t.fields.rollWeight) }).fill("1");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

async function createPrinter(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: cf.name }).fill(name);
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineValue) }).fill("1200");
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineLifetime) }).fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.fields.avgPower) }).fill("0,12");
  await page.getByRole("textbox", { name: new RegExp(t.fields.maintenance) }).fill("0,5");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

async function createProduct(
  page: Page,
  name: string,
  filamentName: string,
  printerName: string,
): Promise<void> {
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
  await page.getByRole("button", { name: catalogo.addProduct }).click();
  await page.getByRole("textbox", { name: pf.nameLabel }).fill(name);
  await page
    .getByRole("combobox", { name: t.catalogPicker.filament })
    .selectOption({ label: filamentName });
  await page
    .getByRole("combobox", { name: t.catalogPicker.printer })
    .selectOption({ label: printerName });
  await page.getByRole("button", { name: pf.saveProduct }).click();
  // `.last()` — criar vários produtos em sequência empilha toasts ("Produto salvo." não some
  // instantaneamente); o modo estrito do Playwright rejeitaria 2 elementos com o mesmo texto.
  await expect(page.getByText(pf.savedProduct).last()).toBeVisible();
}

/** A linha do item na aba ativa — ancorada por `data-testid="master-item"` (≥1280, mestre-
 *  detalhe) ou pela classe folha `tf-plist__row` (< 1280, a lista densa que o achado do T069
 *  corrigiu em `cde9469`), FILTRADA por texto EXATO (`getByText(name, { exact: true })`), nunca
 *  substring solta — a causa raiz do intermitente: `getByText(name)`/`hasText` sem `exact` casava
 *  a MESMA string dentro do resumo de um PRODUTO que só MENCIONA este filamento ("Vaso Shot A
 *  Filamento Shot · Impressora Shot"), e o clique caía na linha errada (ou em nada clicável). */
function filamentRow(page: Page, name: string) {
  const isWide = (page.viewportSize()?.width ?? 0) >= 1280;
  return isWide
    ? page.getByTestId("master-item").filter({ has: page.getByText(name, { exact: true }) })
    : page.locator(".tf-plist__row").filter({ has: page.getByText(name, { exact: true }) });
}

async function editFilamentCost(page: Page, name: string, newCost: string): Promise<void> {
  // ACHADO (2ª rodada): `openProductFicha` deixa a página na FICHA (`/catalogo?produto=<id>`,
  // `data-testid="calc-content"`) — essa rota NÃO tem o tablist Filamentos/Impressoras/Produtos/
  // Kits (é uma página inteira separada, não uma aba). Chamar esta função logo depois de uma
  // ficha aberta ficava esperando um `tab` que nunca existia até o teste estourar o timeout. Ir
  // para `/catalogo` de propósito torna a função independente de onde a página estava antes —
  // nunca assume o tablist já visível.
  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabFilaments }).click();
  await filamentRow(page, name).click();
  const field = page.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) });
  // Prova que a edição abriu — achado: às vezes o clique caía fora e este campo nunca aparecia; o
  // `.fill()` seguinte travaria esperando um alvo inexistente até o timeout do teste.
  await expect(field).toBeVisible();
  await field.fill(newCost);
  // O rótulo do botão de salvar também muda por modo ("Salvar" no Sheet de criação/edição vs.
  // "Salvar alterações" na ficha inline do mestre-detalhe) — os dois começam com "Salvar".
  await page.getByRole("button", { name: /^Salvar/ }).click();
  await expect(page.getByText(cf.savedFilament)).toBeVisible();
  // Lição do hotfix A2 ("a semente responde primeiro"): esperar o VALOR MUTADO aparecer na
  // própria linha antes de seguir — o toast confirma o 2xx do CLIENTE, mas a próxima leitura
  // (`gotoProductsTab`/`openProductFicha` fazem um reload de verdade, uma leitura NOVA do
  // servidor) só é honesta se o servidor já persistiu. `filamentSummary` (`catalog-schema.ts:143`)
  // formata "R$ {custo},00 / …" — aguardamos essa substring exata na linha, não um
  // `waitForTimeout` às cegas.
  await expect(filamentRow(page, name)).toContainText(`R$ ${newCost},00`, { timeout: 10_000 });
}

async function deleteFilament(page: Page, name: string): Promise<void> {
  // Mesmo motivo do `editFilamentCost` acima — não assume o tablist já visível.
  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabFilaments }).click();
  await filamentRow(page, name).click();
  await page.getByRole("button", { name: `${catalogo.remove} ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: cf.deleteConfirm, exact: true })
    .click();
  await expect(filamentRow(page, name)).toHaveCount(0);
}

async function gotoProductsTab(page: Page): Promise<void> {
  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
}

async function openProductFicha(page: Page, name: string): Promise<void> {
  await gotoProductsTab(page);
  await page.getByTestId("master-item").filter({ hasText: name }).click();
  await page
    .getByTestId("detail-panel")
    .getByRole("button", { name: catalogo.detailOpenEditor })
    .click();
  await expect(page.getByTestId("calc-content")).toBeVisible();
}

// ---- (1)+(3) — a lista a 390: faixa "N preços mudaram" + "era"/"Salvo em" + tf-plist denso -----

for (const theme of THEMES) {
  test(`(1)+(3) lista a 390 — faixa "N mudaram" + era/Salvo em + tf-plist denso (${theme})`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await setupPremiumAccount(page, `shot-lista-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento Shot", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Shot");
    await createProduct(page, "Vaso Shot A", "Filamento Shot", "Impressora Shot");
    await createProduct(page, "Vaso Shot B", "Filamento Shot", "Impressora Shot");
    await createProduct(page, "Vaso Shot C", "Filamento Shot", "Impressora Shot");
    // 3 criações em sequência empilham 3 toasts ("Produto salvo."); a 390px o `.tf-toaster` pode
    // sobrepor a lista/tablist — esperar os toasts sumirem (auto-dismiss, `toast.tsx` duração
    // padrão 5000ms) antes de clicar evita um clique caído sobre um card em vez do alvo real
    // (achado do relatório da fatia: sem esta espera, o clique em "Filamento Shot" às vezes
    // silenciosamente não abria a edição).
    await expect(page.locator(".tf-toast")).toHaveCount(0, { timeout: 6_000 });
    await setTheme(page, theme);

    // ACHADO (2ª rodada, trace de rede): sem bloquear o PUT, a marca se autocorrige RÁPIDO DEMAIS
    // para o teste flagrar — GET+PUT+GET de `/price-observations` em ~30ms no localhost (visto no
    // trace: GET 34.202 → PUT 34.233 → GET 34.256), então a faixa "mudou" já tinha desaparecido
    // antes do primeiro poll do `expect`. Mesmo bloqueio das outras cenas (T069/`catalog-recalculo.
    // spec.ts`): segurar o PUT até depois da captura mantém a comparação "mudou" visível.
    await page.route("**/api/v1/price-observations", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await editFilamentCost(page, "Filamento Shot", "120");
    await gotoProductsTab(page);
    await setTheme(page, theme); // goto = navegação real, o tema volta ao padrão do sistema

    await expect(page.getByTestId("products-price-changed-banner")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("product-row-was").first()).toBeVisible();
    await shot(page, `lista-390-mudou-${theme}`); // página inteira: faixa + 3 linhas + era + salvo
    await page.unroute("**/api/v1/price-observations");
  });
}

// ---- (2) — item fixado: flag "fixado" na lista + Alert atenção só na FICHA ---------------------
//
// Correção de fidelidade (019/PR-D): nenhuma prancheta (16a/16b/17c) desenha "Manter {valor}" nem
// o Alert "custo hoje > fixado" NA LISTA — os dois vivem só no ITEM ABERTO. `lista-fixado-alert-*`
// não existe mais; a captura `ficha-fixado-alert-*` já cobre o aviso.

for (const theme of THEMES) {
  test(`(2) item fixado — flag na lista + Alert atenção (só na ficha) (${theme})`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-fixado-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento Fixado", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Fixado");
    await createProduct(page, "Produto Fixado", "Filamento Fixado", "Impressora Fixado");
    await setTheme(page, theme);

    // Bloqueia o PUT de observação enquanto o "mudou" está exposto — sem isso, a própria escrita
    // automática corrige a comparação e o "Manter" desaparece antes do clique (achado do T069).
    await page.route("**/api/v1/price-observations", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await editFilamentCost(page, "Filamento Fixado", "120");
    await gotoProductsTab(page);
    await setTheme(page, theme);
    // Confirma o precondicionante (a faixa "mudou") antes do botão — molde `catalog-recalculo.spec.ts`
    // (T069): checar a faixa primeiro dá um erro legível se a mudança de custo não pegou, em vez de
    // um "elemento não encontrado" opaco no botão.
    await expect(page.getByTestId("products-price-changed-banner")).toBeVisible({
      timeout: 10_000,
    });
    const row = page.getByTestId("master-item").filter({ hasText: "Produto Fixado" });
    await row.click();
    await page
      .getByTestId("detail-panel")
      .getByRole("button", { name: catalogo.detailOpenEditor })
      .click();
    await expect(page.getByTestId("calc-content")).toBeVisible();
    const keepButton = page.getByRole("button", { name: /^Manter/ });
    await expect(keepButton).toBeVisible({ timeout: 10_000 });
    await keepButton.click();
    await page.unroute("**/api/v1/price-observations");

    const fichaAlert = page.getByTestId("product-fixed-over-alert");
    await expect(fichaAlert).toBeVisible({ timeout: 10_000 });
    await shot(page, `ficha-fixado-alert-1280-${theme}`, fichaAlert);

    await gotoProductsTab(page);
    await setTheme(page, theme);
    await expect(row.getByTestId("product-row-fixed")).toBeVisible({ timeout: 10_000 });
    await shot(page, `lista-fixado-flag-1280-${theme}`, row);
  });
}

// ---- (4) — a tf-table a 1024 e a 1279 -----------------------------------------------------------

for (const theme of THEMES) {
  test(`(4) tf-table a 1024 e 1279 (${theme})`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-tabela-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento Tabela", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Tabela");
    await createProduct(page, "Produto Tabela", "Filamento Tabela", "Impressora Tabela");

    for (const width of [1024, 1279]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/catalogo");
      await page.getByRole("tab", { name: catalogo.tabProducts }).click();
      await setTheme(page, theme);
      const table = page.locator("table.tf-table");
      await expect(table).toBeVisible();
      await shot(page, `tf-table-${width}-${theme}`, table);
      await shot(page, `tela-tf-table-${width}-${theme}`);
    }
  });
}

// ---- (5) — o mestre-detalhe a 1280 (inalterado, 018) e a 1920 -----------------------------------

for (const theme of THEMES) {
  test(`(5) mestre-detalhe a 1280 (inalterado) e a 1920 (${theme})`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-md-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento MD", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora MD");
    await createProduct(page, "Produto MD", "Filamento MD", "Impressora MD");

    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/catalogo");
      await page.getByRole("tab", { name: catalogo.tabProducts }).click();
      await setTheme(page, theme);
      await expect(page.getByTestId("master-list")).toBeVisible();
      await expect(page.getByTestId("detail-panel")).toBeVisible();
      await expect(page.locator("table.tf-table")).toHaveCount(0);
      await shot(page, `mestre-detalhe-${width}-${theme}`);
    }
  });
}

// ---- (6) — o cabeçalho da ficha nos 4 estados ---------------------------------------------------

for (const theme of THEMES) {
  test(`(6) cabeçalho da ficha — recalculado / sem mudança / fixado / parado (${theme})`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-cab-${theme}-${info.workerIndex}`);
    await page.getByRole("tab", { name: catalogo.tabFilaments }).click();
    await createFilament(page, "Filamento Recalc H", "100");
    await createFilament(page, "Filamento Igual H", "100");
    await createFilament(page, "Filamento Fixo H", "100");
    await createFilament(page, "Filamento Parado H", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Cabecalho");

    await createProduct(
      page,
      "Produto Recalculado H",
      "Filamento Recalc H",
      "Impressora Cabecalho",
    );
    await createProduct(page, "Produto SemMudanca H", "Filamento Igual H", "Impressora Cabecalho");
    await createProduct(page, "Produto Fixado H", "Filamento Fixo H", "Impressora Cabecalho");
    await createProduct(page, "Produto Parado H", "Filamento Parado H", "Impressora Cabecalho");

    // A 1ª visita já grava as 4 observações (recompute recém-criado === observado — sem faixa).
    await gotoProductsTab(page);
    await expect(page.getByTestId("products-price-changed-banner")).toHaveCount(0);
    await setTheme(page, theme); // aplicado de novo depois de cada goto abaixo

    // ---- sem mudança: uma 2ª visita sem editar nada — `capUnchanged`. ----
    await gotoProductsTab(page);
    await setTheme(page, theme);
    await openProductFicha(page, "Produto SemMudanca H");
    await setTheme(page, theme);
    await expect(page.getByText(catalogo.suggestedRetail)).toBeVisible();
    await shot(
      page,
      `ficha-cabecalho-sem-mudanca-1280-${theme}`,
      page.locator(".tf-price").first(),
    );

    // ---- recalculado: editar o filamento — `capRecalculated`. ----
    await page.route("**/api/v1/price-observations", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await editFilamentCost(page, "Filamento Recalc H", "130");
    await openProductFicha(page, "Produto Recalculado H");
    await setTheme(page, theme);
    await expect(page.getByText(catalogo.suggestedRetail)).toBeVisible();
    await shot(
      page,
      `ficha-cabecalho-recalculado-1280-${theme}`,
      page.locator(".tf-price").first(),
    );

    // ---- fixado: editar + "Manter {valor}" na FICHA — `capFixed`. Correção de fidelidade
    // (019/PR-D): "Manter" mora só no ITEM ABERTO (17c/16b·2), nunca na lista. -----------------
    await editFilamentCost(page, "Filamento Fixo H", "130");
    await openProductFicha(page, "Produto Fixado H");
    await setTheme(page, theme);
    const keepButton = page.getByRole("button", { name: /^Manter/ });
    await expect(keepButton).toBeVisible({ timeout: 10_000 });
    await keepButton.click();
    await page.unroute("**/api/v1/price-observations");
    await expect(page.getByText(catalogo.fixedByYou)).toBeVisible();
    await shot(page, `ficha-cabecalho-fixado-1280-${theme}`, page.locator(".tf-price").first());

    // ---- parado: apagar o filamento do produto — `capStopped`. ----
    await deleteFilament(page, "Filamento Parado H");
    await openProductFicha(page, "Produto Parado H");
    await setTheme(page, theme);
    await expect(page.getByText(catalogo.stoppedPrice)).toBeVisible();
    await shot(page, `ficha-cabecalho-parado-1280-${theme}`, page.locator(".tf-price").first());
  });
}

// ---- (7) — o diálogo de duplicar ----------------------------------------------------------------

for (const theme of THEMES) {
  test(`(7) diálogo de duplicar (${theme})`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-dup-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento Duplicar", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Duplicar");
    await createProduct(page, "Produto Original", "Filamento Duplicar", "Impressora Duplicar");
    await setTheme(page, theme);

    await gotoProductsTab(page);
    await setTheme(page, theme);
    const row = page.getByTestId("master-item").filter({ hasText: "Produto Original" });
    await row.click();
    await page
      .getByTestId("detail-panel")
      .getByRole("button", { name: `${catalogo.duplicate} Produto Original` })
      .click();
    const dialog = page.getByTestId("product-duplicate-dialog");
    await expect(dialog).toBeVisible();
    await shot(page, `duplicar-dialogo-1280-${theme}`, dialog);
  });
}

// ---- (8) — a recusa de nome repetido no formulário ----------------------------------------------

for (const theme of THEMES) {
  test(`(8) recusa de nome repetido no formulário (${theme})`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupPremiumAccount(page, `shot-nome-${theme}-${info.workerIndex}`);
    await createFilament(page, "Filamento Nome", "100");
    await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
    await createPrinter(page, "Impressora Nome");
    await createProduct(page, "Produto Existente", "Filamento Nome", "Impressora Nome");
    await setTheme(page, theme);

    await gotoProductsTab(page);
    await setTheme(page, theme);
    await page.getByRole("button", { name: catalogo.addProduct }).click();
    await setTheme(page, theme);
    await page.getByRole("textbox", { name: pf.nameLabel }).fill("Produto Existente");
    await page
      .getByRole("combobox", { name: t.catalogPicker.filament })
      .selectOption({ label: "Filamento Nome" });
    await page
      .getByRole("combobox", { name: t.catalogPicker.printer })
      .selectOption({ label: "Impressora Nome" });
    await page.getByRole("button", { name: pf.saveProduct }).click();
    await expect(page.getByText(cf.nameConflict)).toBeVisible();
    await expect(page.getByText(cf.nameConflictHint)).toBeVisible();
    const field = page.locator(".tf-field").filter({ hasText: pf.nameLabel });
    await shot(page, `nome-repetido-recusa-1280-${theme}`, field);
    await shot(page, `tela-nome-repetido-recusa-1280-${theme}`);
  });
}
