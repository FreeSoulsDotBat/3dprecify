import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_BACKEND_URL } from "../../playwright.config";

import { captureEntitlementBearerToken } from "./billing-helpers";
import { goOffline, goOnline, grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-D (T069) e2e — o recálculo do Catálogo contra a stack REAL: `pages/catalogo/
// catalogo-page.tsx` recomputa cada produto com o motor real (`computeFromForm`) só quando
// filamentos/impressoras resolveram, injeta o resultado na lista, e — só com a LISTA visível
// (`?produto=` ausente), online, sem erro de leitura das observações — grava em lote
// `PUT /api/v1/price-observations` (dedupe por assinatura na sessão do hook, `5128402`). Molde:
// `catalog.spec.ts` (T025, sign-up→grant→CRUD) + `scenarios-manage.spec.ts` (criação de produto,
// `createProductWithScenario`) + `waste-removal.spec.ts` (POST direto com o bearer capturado).
//
// Viewport FORÇADO a 1280×900 nos cenários 1–4/6/7: essa largura ativa o mestre-detalhe do 018
// (`useIsWide`), onde `product-row-was`/`product-row-fixed` vivem no MESMO `data-testid="master-item"`
// que os specs vizinhos já usam — um único caminho de DOM para toda a asserção, sem depender de
// qual dos dois projetos (chromium/mobile) está rodando. O cenário 5 é o único que varia a largura
// de propósito (é o que testa a densidade em si).

const t = messages.calculator;
const catalogo = messages.catalogo;
const cf = messages.catalogForm;
const pf = messages.productForm;

async function setupPremiumAccount(page: Page, tag: string): Promise<string> {
  const email = await signUpThrowaway(page, tag);
  await page.goto("/catalogo"); // JIT-provisiona a conta antes do grant (mesmo motivo do T025)
  await expect(page.getByRole("tab", { name: catalogo.tabFilaments })).toBeVisible();
  grantPremium(email);
  await page.reload(); // a concessão só é lida na próxima carga
  return email;
}

function waitForObservationPut(page: Page) {
  return page.waitForResponse(
    (r) => r.url().includes("/api/v1/price-observations") && r.request().method() === "PUT",
    { timeout: 15_000 },
  );
}

async function createFilament(
  page: Page,
  name: string,
  costPerRoll: string,
  rollWeightKg: string,
): Promise<string> {
  const resWait = page.waitForResponse(
    (r) => r.url().includes("/api/v1/filaments") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: cf.name }).fill(name);
  await page.getByRole("textbox", { name: new RegExp(cf.material) }).fill("PLA");
  await page.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) }).fill(costPerRoll);
  await page.getByRole("textbox", { name: new RegExp(t.fields.rollWeight) }).fill(rollWeightKg);
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  const res = await resWait;
  await expect(page.getByText(name).first()).toBeVisible();
  return ((await res.json()) as { id: string }).id;
}

async function createPrinter(page: Page, name: string): Promise<string> {
  const resWait = page.waitForResponse(
    (r) => r.url().includes("/api/v1/printers") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: cf.name }).fill(name);
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineValue) }).fill("1200");
  await page.getByRole("textbox", { name: new RegExp(t.fields.machineLifetime) }).fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.fields.avgPower) }).fill("0,12");
  await page.getByRole("textbox", { name: new RegExp(t.fields.maintenance) }).fill("0,5");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  const res = await resWait;
  await expect(page.getByText(name).first()).toBeVisible();
  return ((await res.json()) as { id: string }).id;
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
  await expect(page.getByText(pf.savedProduct)).toBeVisible();
}

async function editFilamentCost(page: Page, name: string, newCost: string): Promise<void> {
  await page.getByRole("tab", { name: catalogo.tabFilaments }).click();
  await page.getByTestId("master-item").filter({ hasText: name }).click();
  const field = page.getByRole("textbox", { name: new RegExp(t.fields.costPerRoll) });
  await field.fill(newCost);
  // A ficha do mestre-detalhe (edição INLINE) usa "Salvar alterações" (`cf.saveChanges`) — o Sheet
  // de criação usa "Salvar" (`cf.save`); são dois botões/rótulos diferentes no mesmo formulário.
  await page.getByRole("button", { name: cf.saveChanges, exact: true }).click();
  await expect(page.getByText(cf.savedFilament)).toBeVisible();
}

async function gotoProductsTab(page: Page): Promise<void> {
  await page.goto("/catalogo"); // navegação REAL (sair/voltar) — remonta CatalogoPage do zero
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
}

function productRow(page: Page, name: string) {
  return page.getByTestId("master-item").filter({ hasText: name });
}

// ---------------------------------------------------------------------------------------------
// Cenários 1–3 (T069): sem observação na 1ª visita → mudou → fixar/desfixar
// ---------------------------------------------------------------------------------------------

test("recompute do Catálogo: sem observação → preço mudou → fixar/desfixar (T069 cenários 1–3)", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupPremiumAccount(page, `recalc-${info.workerIndex}`);

  await createFilament(page, "Filamento Recalculo", "100", "1"); // R$ 100/kg
  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  await createPrinter(page, "Impressora Recalculo");

  const putWait1 = waitForObservationPut(page);
  await createProduct(page, "Vaso Recalculo", "Filamento Recalculo", "Impressora Recalculo");

  // ---- Cenário 1a: primeira visita — sem observação prévia, NENHUMA faixa, nenhum "era". ----
  await expect(page.getByTestId("products-price-changed-banner")).toHaveCount(0);
  const row = productRow(page, "Vaso Recalculo");
  await expect(row).toBeVisible();
  await expect(row.getByTestId("product-row-was")).toHaveCount(0);
  const priceText1 = (await row.locator(".tf-plist__price").innerText()).trim();
  expect(priceText1.length).toBeGreaterThan(0);
  await putWait1; // a observação foi gravada — a PRÓXIMA visita já a lê

  // ---- Cenário 1b: sair (Calculadora) e voltar — preço sem mudança, ainda NENHUMA faixa. ----
  await page.goto("/calcular");
  await gotoProductsTab(page);
  await expect(row).toBeVisible();
  await expect(page.getByTestId("products-price-changed-banner")).toHaveCount(0);
  await expect(row.getByTestId("product-row-was")).toHaveCount(0);
  await expect(row.locator(".tf-plist__price")).toHaveText(priceText1);

  // ---- Cenário 2: editar o filamento (100 → 120/kg) muda o custo do produto (referência LIVE,
  // não um snapshot — `_to_out`, `backend/app/api/products.py:270-297`). A PRÓXIMA visita mostra
  // a faixa "1 preço mudou" + "era {o preço exato que a linha mostrava antes}". ----
  //
  // A MESMA visita também dispara — depois do render, por desenho (`catalogo-page.tsx`) — o PUT
  // que GRAVA a observação de hoje; assim que ele responde, a invalidação refaz a leitura, o
  // "mudou" deixa de ser verdade e a faixa/"Manter" desaparecem sozinhos (correção automática, não
  // um defeito). Para poder AGIR na janela "mudou" sem uma corrida contra a própria escrita
  // automática, este PUT fica bloqueado até depois do clique em "Manter" — silencioso por desenho
  // (`useObservePrices`, `onError` não faz nada), então bloqueá-lo é indistinguível de uma falha de
  // rede breve.
  await page.route("**/api/v1/price-observations", (route) =>
    route.request().method() === "PUT" ? route.abort() : route.continue(),
  );
  await editFilamentCost(page, "Filamento Recalculo", "120");
  await gotoProductsTab(page);

  await expect(page.getByTestId("products-price-changed-banner")).toHaveText(
    catalogo.priceChangedOne,
    { timeout: 10_000 },
  );
  await expect(row.getByTestId("product-row-was")).toHaveText(
    catalogo.priceWasLabel.replace("{valor}", priceText1),
  );
  const priceText2 = (await row.locator(".tf-plist__price").innerText()).trim();
  expect(priceText2).not.toBe(priceText1);

  // ---- Cenário 3a: fixar via "Manter {valor}" (16b·2) — o preço fixado é o ANTERIOR (priceText1,
  // baseado no filamento a 100/kg). O custo de HOJE já está no filamento a 120/kg (priceText2, mais
  // alto) — então o aviso de atenção aparece JÁ NO ATO de fixar, não só depois de uma 3ª edição: o
  // "fixar" é escolher CONGELAR um preço que já ficou atrás do custo. ----
  const keepButton = page.getByRole("button", {
    name: catalogo.keepPrice.replace("{valor}", priceText1),
    exact: true,
  });
  await expect(keepButton).toBeVisible();
  await keepButton.click();
  await page.unroute("**/api/v1/price-observations"); // a janela de corrida já passou (PATCH fixou)
  await expect(row.getByTestId("product-row-fixed")).toBeVisible({ timeout: 10_000 });
  await expect(row.locator(".tf-plist__price")).toHaveText(priceText1);
  const overAlert = page.getByTestId("product-fixed-over-alert");
  await expect(overAlert).toBeVisible({ timeout: 10_000 });
  await expect(overAlert).toContainText("Vaso Recalculo");

  // ---- Cenário 3b: editar o filamento de novo (120 → 150/kg) — o preço GRANDE (fixado) continua
  // SEM mudar; o aviso de atenção permanece (a diferença só cresce). ----
  await editFilamentCost(page, "Filamento Recalculo", "150");
  await gotoProductsTab(page);

  await expect(row.locator(".tf-plist__price")).toHaveText(priceText1); // continua fixado
  await expect(overAlert).toBeVisible({ timeout: 10_000 });
  await expect(overAlert).toContainText("Vaso Recalculo");

  // ---- Cenário 3c: desfixar ("Voltar a acompanhar o custo") — volta ao recomputado de hoje. ----
  await overAlert.getByRole("button", { name: catalogo.unfix }).click();
  await expect(row.getByTestId("product-row-fixed")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId("product-fixed-over-alert")).toHaveCount(0);
  const priceText3 = (await row.locator(".tf-plist__price").innerText()).trim();
  expect(priceText3).not.toBe(priceText1);
});

// ---------------------------------------------------------------------------------------------
// Cenário 4 (T069): nome duplicado — "Gancho" / "gancho " ⇒ "gancho (2)" em silêncio no servidor
// ---------------------------------------------------------------------------------------------

test("nome duplicado: 'Gancho' e 'gancho ' — o segundo vira \"gancho (2)\" em silêncio (T069 cenário 4)", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupPremiumAccount(page, `dup-${info.workerIndex}`);

  const filamentId = await createFilament(page, "Filamento Duplicado", "100", "1");
  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  const printerId = await createPrinter(page, "Impressora Duplicado");

  // O cliente barra nome repetido ANTES do submit — na ficha do produto (`produto-page.tsx`,
  // `nameConflict`) e no diálogo de duplicar (`products-panel.tsx`, `handleDuplicate`). Essa
  // recusa é uma conveniência do cliente; a regra QUE IMPORTA aqui é a do SERVIDOR (Q5, o funil
  // `naming.commit_with_unique_name` — T072/T073), então provamos pela API direta com o token de
  // sessão real (molde `waste-removal.spec.ts` — `captureEntitlementBearerToken`).
  const bearerPromise = captureEntitlementBearerToken(page);
  await page.reload();
  const bearer = await bearerPromise;

  const productBody = (name: string) => ({
    name,
    filamentId,
    printerId,
    pieceInputs: {
      printGrams: "100.000",
      printTimeHours: "5.000",
      failurePct: "0.000",
      finishTimeHours: "0.000",
      finishRatePerHour: "0.000000",
      laborHours: "0.000",
      laborRatePerHour: "0.000000",
      markupVarejoPct: "50.000",
      markupAtacadoPct: "30.000",
    },
    tariffPerKwh: "1.000000",
    includeMarketplace: false,
    channels: [],
    otherCosts: [],
  });

  const first = await page.request.post(`${E2E_BACKEND_URL}/api/v1/products`, {
    headers: { authorization: bearer },
    data: productBody("Gancho"),
  });
  expect(first.ok(), await first.text()).toBeTruthy();
  const firstJson = (await first.json()) as { name: string };
  expect(firstJson.name).toBe("Gancho");

  const second = await page.request.post(`${E2E_BACKEND_URL}/api/v1/products`, {
    headers: { authorization: bearer },
    data: productBody("gancho "),
  });
  expect(second.status()).toBe(201); // 201 honesto — nunca um 409/422 pela colisão de nome (Q5)
  const secondJson = (await second.json()) as { name: string };
  expect(secondJson.name).toBe("gancho (2)");

  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
  // No mestre-detalhe (1280px) o nome aparece DUAS vezes — a linha `master-item` + o `<h2>` da
  // ficha do item selecionado (018/US1) — a asserção escopa à linha da lista, nunca ao texto solto.
  // `filter({ hasText })` faz substring CASE-INSENSITIVE (`filter({ hasText: "Gancho" })` também
  // casaria "gancho (2)") — `filter({ has: getByText(…, { exact: true }) })` compara o texto INTEIRO
  // e sensível a maiúscula, o par exato que este cenário precisa distinguir.
  const exactRow = (name: string) =>
    page.getByTestId("master-item").filter({ has: page.getByText(name, { exact: true }) });
  await expect(exactRow("Gancho")).toBeVisible();
  await expect(exactRow("gancho (2)")).toBeVisible();
});

// ---------------------------------------------------------------------------------------------
// Cenário 5 (T069): densidade — 390 tf-plist / 1024–1279 tf-table / 1280–1920 mestre-detalhe
// ---------------------------------------------------------------------------------------------

test("densidade da lista: 390 tf-plist · 1024–1279 tf-table · 1280–1920 mestre-detalhe, sem overflow (T069 cenário 5)", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupPremiumAccount(page, `dense-${info.workerIndex}`);

  await createFilament(page, "Filamento Densidade", "100", "1");
  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  await createPrinter(page, "Impressora Densidade");
  await createProduct(page, "Peca Densidade", "Filamento Densidade", "Impressora Densidade");
  await expect(page.getByTestId("products-price-changed-banner")).toHaveCount(0); // sanidade

  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  // ---- 1024–1279px: DECISÃO 1 (27/08) — a lista vira `tf-table` densa. ----
  for (const width of [1024, 1279]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/catalogo");
    await page.getByRole("tab", { name: catalogo.tabProducts }).click();
    const table = page.locator("table.tf-table");
    await expect(table).toBeVisible();
    await expect(table.getByText(catalogo.tableColName, { exact: true })).toBeVisible();
    await expect(table.getByText(catalogo.tableColPrice, { exact: true })).toBeVisible();
    await expect(table.getByText(catalogo.tableColBefore, { exact: true })).toBeVisible();
    await expect(table.getByText(catalogo.tableColSavedAt, { exact: true })).toBeVisible();
    await expect(table).toContainText("Peca Densidade");
    expect(await overflow(), `overflow horizontal a ${width}px`).toBe(false);
  }

  // ---- 1280–1920px: o mestre-detalhe do 018 fica INALTERADO (a tabela não substitui a coluna). ----
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/catalogo");
    await page.getByRole("tab", { name: catalogo.tabProducts }).click();
    await expect(page.locator("table.tf-table")).toHaveCount(0);
    await expect(page.getByTestId("master-item").first()).toBeVisible();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    expect(await overflow(), `overflow horizontal a ${width}px`).toBe(false);
  }

  // ---- 390px: `.tf-plist`, NÃO `.tf-table`. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
  await expect(page.getByText("Peca Densidade").first()).toBeVisible();
  expect(await overflow(), "overflow horizontal a 390px").toBe(false);
  await expect(page.locator("table.tf-table")).toHaveCount(0);

  // ACHADO do T069 (29/08), CORRIGIDO na fatia: o ramo estreito de `catalog-panel.tsx` montava
  // cartões com os spans `tf-plist__*` soltos e NUNCA a classe `tf-plist` no container — o nome
  // quebrava em três linhas e cabiam 4 itens na dobra (a captura `lista-390-mudou` provou). Agora
  // a lista É a `tf-plist` de `plist.css`: linhas `tf-plist__row` de 56px separadas por filete.
  await expect(page.locator("ul.tf-plist")).toBeVisible({ timeout: 3_000 });
  expect(await page.locator("ul.tf-plist > li .tf-plist__row").count()).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------------------------
// Cenário 6 (T069): envenenamento — nenhum PUT enquanto filamentos/impressoras ainda carregam
// ---------------------------------------------------------------------------------------------

test("envenenamento: nenhum PUT de observação sai enquanto as referências ainda carregam (T069 cenário 6)", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupPremiumAccount(page, `poison-${info.workerIndex}`);

  await createFilament(page, "Filamento Veneno", "100", "1");
  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  await createPrinter(page, "Impressora Veneno");
  const putWaitInitial = waitForObservationPut(page);
  await createProduct(page, "Peca Veneno", "Filamento Veneno", "Impressora Veneno");
  await putWaitInitial; // a primeira observação fica gravada antes do teste começar a monitorar

  // A criação acima já deixou filamento+impressora QUENTES no cache uid-keyed do dispositivo
  // (`entities/catalog/catalog-cache.ts`, `idb-keyval`, banco "keyval-store"/loja "keyval") — a
  // invalidação de cada mutation refez a leitura e persistiu o resultado. `useCatalogList`'s
  // `isLoading` é `query.isFetching && items.length === 0` (`use-catalog.ts:120`): com o cache
  // pré-carregado, `items.length > 0` ANTES da rede responder, e `isLoading` cai para `false` de
  // imediato — o atraso de rede abaixo nunca teria efeito num recarregamento comum. Este cenário
  // testa a PRIMEIRA leitura deste aparelho, então as duas chaves são apagadas antes do reload
  // atrasado, reproduzindo um aparelho que nunca viu este filamento/impressora (servidor já tem os
  // dados; o dispositivo, não).
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("keyval-store");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const key = String(cursor.key);
              if (key.startsWith("catalog:filaments:") || key.startsWith("catalog:printers:")) {
                cursor.delete();
              }
              cursor.continue();
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

  const puts: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/price-observations") && req.method() === "PUT") {
      puts.push(req.url());
    }
  });

  // Atrasa as DUAS referências ~3s (`products-panel.tsx:27-28`/`catalogo-page.tsx` leem os dois).
  await page.route("**/api/v1/filaments*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await page.route("**/api/v1/printers*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });

  // `page.goto("/catalogo")` é uma navegação REAL (não o `replace: true` do router) — a URL vira
  // "/catalogo" puro, sem `?tab=products`; o tablist volta ao padrão (Filamentos) e precisa do clique.
  await page.goto("/catalogo");
  await page.getByRole("tab", { name: catalogo.tabProducts }).click();
  await expect(page.getByTestId("master-item").filter({ hasText: "Peca Veneno" })).toBeVisible({
    timeout: 15_000,
  });

  // Janela de 1500ms com as referências ainda em voo — NENHUM PUT deve sair.
  await page.waitForTimeout(1_500);
  expect(puts.length, "PUT disparado antes das referências resolverem").toBe(0);

  // Depois que a rota atrasada resolve, exatamente 1 PUT.
  await page.waitForRequest(
    (r) => r.url().includes("/api/v1/price-observations") && r.method() === "PUT",
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500); // sobra para um 2º PUT indevido aparecer, se houvesse
  expect(puts.length, "número de PUTs depois que as referências resolveram").toBe(1);
});

// ---------------------------------------------------------------------------------------------
// Cenário 7 (T069): offline — zero PUT de observação
// ---------------------------------------------------------------------------------------------

test("offline: zero PUT de observação (T069 cenário 7)", async ({ page, context }, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupPremiumAccount(page, `offline-${info.workerIndex}`);

  await createFilament(page, "Filamento Offline", "100", "1");
  await page.getByRole("tab", { name: catalogo.tabPrinters }).click();
  await createPrinter(page, "Impressora Offline");
  const putWaitInitial = waitForObservationPut(page);
  await createProduct(page, "Peca Offline", "Filamento Offline", "Impressora Offline");
  await putWaitInitial; // visita ONLINE — a lista fica no cache uid-keyed do dispositivo

  const puts: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/price-observations") && req.method() === "PUT") {
      puts.push(req.url());
    }
  });

  await goOffline(page, context);
  await page.reload(); // preserva a URL atual (?tab=products) — reload, não goto
  await expect(page.getByTestId("master-item").filter({ hasText: "Peca Offline" })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1_500);
  expect(puts.length, "PUT disparado com o aparelho offline").toBe(0);

  await goOnline(page, context);
});
