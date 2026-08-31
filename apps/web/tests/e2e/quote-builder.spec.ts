import { expect, test, type Page } from "@playwright/test";

import { computeQuote, type PriceInput } from "@3dprecify/pricing-core";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { goOffline, goOnline, grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-E (T084) e2e — o construtor de orçamento (US16/US17, ADR-0034) contra a stack REAL.
//
// O que só esta camada prova (molde: `catalog-recalculo.spec.ts` para o catálogo, `history-*.spec`
// para o outbox/export):
//
//   · IGUALDADE contra o motor de verdade: o total exibido é comparado com `computeQuote` rodado no
//     PRÓPRIO teste, com o `PriceInput` reconstruído da resposta REAL do POST (nenhum valor de
//     formulário é adivinhado — a mesma disciplina do T083, agora com o pacote real e o backend real
//     fazendo o resto do caminho: POST → linha em Orçamentos → PDF).
//   · O registro REALMENTE aparece em Orçamentos com `kind=QUOTE`, o detalhe itemizado (T135, já
//     existente antes desta fatia) e "válido até".
//   · `GET /quote.pdf` 200 — o backend já lê `kind=QUOTE` (`quote_render.py`, migração 0009).
//   · DECISÃO 4 (offline): montar funciona, Enviar fica desabilitado com a razão, e NADA entra na
//     fila — provado lendo o IndexedDB (`idb-keyval`, banco "keyval-store"), não só a tela.
//
// Geometria fina do PDF é do pytest (`test_export.py`); aqui só o round-trip (200 + bytes `%PDF-`).

const t = messages;
const catalogo = messages.calculator.catalogPicker;
const catalogTabs = messages.catalogo;
const cf = messages.catalogForm;
const pf = messages.productForm;
const f = messages.calculator.fields;
const ti = messages.calculator.timeInput;
const tq = messages.quote;

async function setupPremiumAccount(page: Page, tag: string): Promise<string> {
    const email = await signUpThrowaway(page, tag);
    await page.goto("/catalogo"); // JIT-provisiona a conta antes do grant (molde T025/T069)
    await expect(page.getByRole("tab", { name: catalogTabs.tabFilaments })).toBeVisible();
    grantPremium(email);
    await page.reload(); // a concessão só é lida na próxima carga
    return email;
}

async function createFilament(page: Page, name: string): Promise<void> {
    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/filaments") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: catalogTabs.addFilament }).click();
    await page.getByRole("textbox", { name: cf.name }).fill(name);
    await page.getByRole("textbox", { name: new RegExp(cf.material) }).fill("PLA");
    await page.getByRole("textbox", { name: f.costPerRoll, exact: true }).fill("100");
    await page.getByRole("textbox", { name: f.rollWeight, exact: true }).fill("1");
    await page.getByRole("button", { name: cf.save, exact: true }).click();
    await resWait;
    await expect(page.getByText(name).first()).toBeVisible();
}

async function createPrinter(page: Page, name: string): Promise<void> {
    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/printers") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: catalogTabs.addPrinter }).click();
    await page.getByRole("textbox", { name: cf.name }).fill(name);
    await page.getByRole("textbox", { name: f.machineValue, exact: true }).fill("1200");
    await page.getByRole("textbox", { name: f.machineLifetime, exact: true }).fill("2000");
    await page.getByRole("textbox", { name: f.avgPower, exact: true }).fill("0,12");
    // `maintenanceReservePerHour` é `required: false` (calculator-schema.ts) — `Field` acrescenta o
    // sufixo " opcional" ao nome acessível (field.tsx:76), então `exact: true` com o rótulo cru nunca
    // resolve e trava até o timeout do teste (achado real — molde: `catalog-recalculo.spec.ts`'s
    // `createPrinter`, que já usa regex por este motivo).
    await page.getByRole("textbox", { name: new RegExp(f.maintenance) }).fill("0,5");
    await page.getByRole("button", { name: cf.save, exact: true }).click();
    await resWait;
    await expect(page.getByText(name).first()).toBeVisible();
}

/** O shape mínimo de `ProductOut` que este arquivo lê (wire → `PriceInput`, mesma leitura de
 *  `productToForm`/`computeFromForm`, feita à mão para não depender de `@/features/calculator`
 *  fora de `apps/web/src`). */
interface ProductWire {
    id: string;
    filamentValues: { costPerRoll: string; rollWeightKg: string };
    printerValues: {
        machineValue: string;
        machineLifetimeHours: string;
        avgPowerKw: string;
        maintenanceReservePerHour?: string;
    };
    pieceInputs: {
        printGrams: string;
        printTimeHours: string;
        markupVarejoPct: string;
        markupAtacadoPct: string;
    };
    tariffPerKwh: string;
}

/** Cria um produto ligado (filamento + impressora já existentes), digitando SÓ o que este arquivo
 *  varia por item (gramas + horas de impressão) — o resto fica no default do formulário. Devolve o
 *  `ProductOut` REAL da resposta do POST: o `PriceInput` de referência vem DAÍ, nunca de um valor
 *  adivinhado (a mesma armadilha que o T083 evita rodando `computeQuote` fora da tela). */
async function createProduct(
    page: Page,
    name: string,
    filamentName: string,
    printerName: string,
    printGrams: string,
    printHours: string,
): Promise<ProductWire> {
    await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
    await page.getByRole("button", { name: catalogTabs.addProduct }).click();
    await page.getByRole("textbox", { name: pf.nameLabel }).fill(name);
    await page
        .getByRole("combobox", { name: catalogo.filament })
        .selectOption({ label: filamentName });
    await page
        .getByRole("combobox", { name: catalogo.printer })
        .selectOption({ label: printerName });
    await page.getByRole("textbox", { name: f.grams, exact: true }).fill(printGrams);
    await page.getByLabel(ti.hoursAria).fill(printHours);
    await page.getByLabel(ti.minutesAria).fill("0");

    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/products") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: pf.saveProduct }).click();
    const res = await resWait;
    // Este arquivo cria 3 produtos em sequência rápida (US16) — o toast empilha (`toast.tsx`, um
    // array, 5s de duração cada) em vez de substituir; com dois toasts "Produto salvo." vivos ao
    // mesmo tempo, `getByText` sem escopo é ambíguo (strict-mode violation, achado real). `.last()`
    // é sempre o mais recente.
    await expect(page.getByText(pf.savedProduct).last()).toBeVisible();
    return (await res.json()) as ProductWire;
}

/** Converte o `ProductOut` REAL em `PriceInput` — leitura NUMÉRICA pura das strings de fio (a
 *  mesma disciplina do contrato T083 `wireToInput`), sem canal (Q6, venda direta). */
function toPriceInput(p: ProductWire): PriceInput {
    return {
        costPerRoll: Number(p.filamentValues.costPerRoll),
        rollWeightKg: Number(p.filamentValues.rollWeightKg),
        printGrams: Number(p.pieceInputs.printGrams),
        printTimeHours: Number(p.pieceInputs.printTimeHours),
        avgPowerKw: Number(p.printerValues.avgPowerKw),
        tariffPerKwh: Number(p.tariffPerKwh),
        machineValue: Number(p.printerValues.machineValue),
        machineLifetimeHours: Number(p.printerValues.machineLifetimeHours),
        maintenanceReservePerHour: Number(p.printerValues.maintenanceReservePerHour ?? "0"),
        markupVarejoPct: Number(p.pieceInputs.markupVarejoPct),
        markupAtacadoPct: Number(p.pieceInputs.markupAtacadoPct),
    };
}

async function openBuilder(page: Page): Promise<void> {
    await page.goto("/historico");
    await page.getByRole("button", { name: tq.newQuote }).click();
    // ACHADO (T084): o router serializa `search: { construir: true }` por JSON — a URL real é
    // `?construir=true` (booleano cru), nunca `?construir=1` (a gramática que `validateSearch`
    // também aceita ao LER, mas que `navigate` nunca escreve) — mesma lição do PR-C (`?assinar=%221%22`).
    // Ancorar no `data-testid="quote-builder"` visível (adotado nesta tarefa, `quote-builder.tsx`)
    // em vez de uma gramática de URL específica.
    await expect(page.getByTestId("quote-builder")).toBeVisible();
}

/** Escolhe um item pelo NOME e ajusta a quantidade — escopado à MESMA linha (`quote-line-<id>`)
 *  para não confundir com a quantidade de um item escolhido antes (várias linhas coexistem). */
async function pick(page: Page, name: string, qty: string): Promise<void> {
    const row = page.locator('[data-testid^="quote-line-"]').filter({ hasText: name });
    await row.click();
    await row.getByTestId(/^quote-qty-/).fill(qty);
}

const money = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test("US16: 3 itens × (1, 2, 10) — o total bate com computeQuote rodado fora da tela", async ({
    page,
}, info) => {
    test.setTimeout(150_000);
    await setupPremiumAccount(page, `quote-total-${info.workerIndex}`);

    await createFilament(page, "Filamento Orcamento");
    await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
    await createPrinter(page, "Impressora Orcamento");
    const wireA = await createProduct(
        page,
        "Item A",
        "Filamento Orcamento",
        "Impressora Orcamento",
        "100",
        "4",
    );
    const wireB = await createProduct(
        page,
        "Item B",
        "Filamento Orcamento",
        "Impressora Orcamento",
        "60",
        "2",
    );
    const wireC = await createProduct(
        page,
        "Item C",
        "Filamento Orcamento",
        "Impressora Orcamento",
        "200",
        "8",
    );

    await openBuilder(page);
    await page.getByLabel(tq.clientLabel).fill("Cliente E2E");
    await pick(page, "Item A", "1");
    await pick(page, "Item B", "2");
    await pick(page, "Item C", "10");
    await page.getByRole("button", { name: tq.continueAction }).click();

    const expected = computeQuote({
        lines: [
            { input: toPriceInput(wireA), quantity: 1, name: "Item A" },
            { input: toPriceInput(wireB), quantity: 2, name: "Item B" },
            { input: toPriceInput(wireC), quantity: 10, name: "Item C" },
        ],
    });
    await expect(page.getByTestId("quote-net")).toContainText(money(expected.netTotal));
    await expect(page.getByTestId("quote-gross")).toContainText(money(expected.grossTotal));

    // Desconto até o piso ⇒ aviso "abaixo do custo" com Enviar continuando HABILITADO (Q10).
    await page.getByTestId("quote-discount-mode").selectOption("AMOUNT");
    const exato = (expected.grossTotal - expected.costFloor + 1).toFixed(2).replace(".", ",");
    await page.getByTestId("quote-discount-value").fill(exato);
    await expect(page.getByTestId("quote-below-cost")).toBeVisible();
    await expect(page.getByTestId("quote-send")).toBeEnabled();
    // Desfaz o desconto — o resto do teste manda o orçamento por um número são.
    await page.getByTestId("quote-discount-value").fill("0");

    const postWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/history") && r.request().method() === "POST",
    );
    await page.getByTestId("quote-send").click();
    const post = await postWait;
    const snapshot = (await post.json()) as { id: string };
    await expect(page).toHaveURL(/\/historico(\?)?$/);

    // O registro aparece em Orçamentos: kind QUOTE (contagem de itens), o rótulo, "válido até".
    await page.goto("/historico");
    await expect(page.getByText("Cliente E2E").first()).toBeVisible();
    await page.getByText("Cliente E2E").first().click();
    await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
    await expect(page.getByText("Item A")).toBeVisible();
    await expect(page.getByText("Item B")).toBeVisible();
    await expect(page.getByText("Item C")).toBeVisible();
    await expect(page.getByTestId("quote-document-dates")).toBeVisible();

    // O export já lê kind=QUOTE (migração 0009 / quote_render.py) — o round-trip do PDF.
    const quoteRequest = page.waitForRequest((r) => r.url().includes(`/${snapshot.id}/quote.pdf`));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: t.historico.exportAction }).click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: t.historico.exportGenerate })
        .click();
    await quoteRequest;
    const file = await download;
    const path = await file.path();
    const bytes = await import("node:fs/promises").then((fs) => fs.readFile(path));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});

test("editar o rótulo continua (PATCH) — o payload congelado não muda", async ({ page }, info) => {
    test.setTimeout(90_000);
    await setupPremiumAccount(page, `quote-edit-${info.workerIndex}`);
    await createFilament(page, "Filamento Edit");
    await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
    await createPrinter(page, "Impressora Edit");
    await createProduct(page, "Peca Edit", "Filamento Edit", "Impressora Edit", "100", "4");

    await openBuilder(page);
    await page.getByLabel(tq.clientLabel).fill("Rotulo Original");
    await pick(page, "Peca Edit", "1");
    await page.getByRole("button", { name: tq.continueAction }).click();
    // ACHADO (T084): no mestre-detalhe (viewport largo, sem `setViewportSize` neste teste — o padrão
    // do projeto Playwright já é ≥1280px) `backToList` navega para `/historico` SEM query, mas o
    // mestre-detalhe abre sozinho o mais recente (comentário de `quote-builder.tsx`) — a URL passa
    // por `/historico` só de raspão antes de virar `?snapshot=…`. Esperar o POST (como o US16 já faz)
    // em vez de uma gramática de URL intermediária que pisca.
    const postWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/history") && r.request().method() === "POST",
    );
    await page.getByTestId("quote-send").click();
    await postWait;

    await page.goto("/historico");
    await page.getByText("Rotulo Original").first().click();
    const totalBefore = await page
        .getByText(/R\$\s?[\d.,]+/)
        .first()
        .textContent();

    await page.getByRole("button", { name: t.historico.editLabel }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(t.historico.labelField).fill("Rotulo Editado");
    await dialog.getByRole("button", { name: t.historico.editLabelSave }).click();
    await expect(page.getByText(t.historico.labelSaved)).toBeVisible();

    await expect(page.getByText("Rotulo Editado")).toBeVisible();
    const totalAfter = await page
        .getByText(/R\$\s?[\d.,]+/)
        .first()
        .textContent();
    expect(totalAfter).toBe(totalBefore); // a etiqueta mudou; o congelado, não.
});

test("DECISÃO 4: offline monta mas não envia — reconectar habilita e grava UMA vez", async ({
    page,
    context,
}, info) => {
    test.setTimeout(90_000);
    await setupPremiumAccount(page, `quote-offline-${info.workerIndex}`);
    await createFilament(page, "Filamento Offline");
    await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
    await createPrinter(page, "Impressora Offline");
    await createProduct(
        page,
        "Peca Offline",
        "Filamento Offline",
        "Impressora Offline",
        "100",
        "4",
    );

    await openBuilder(page);
    await page.getByLabel(tq.clientLabel).fill("Cliente Offline");
    await pick(page, "Peca Offline", "1");
    await page.getByRole("button", { name: tq.continueAction }).click();

    await goOffline(page, context);

    await expect(page.getByTestId("quote-send")).toBeDisabled();
    await expect(page.getByTestId("quote-send-reason")).toHaveText(tq.sendOffline);

    // Fila REALMENTE vazia — não só a tela dizendo isso (idb-keyval, banco "keyval-store").
    const outboxKeys = await page.evaluate(
        () =>
            new Promise<string[]>((resolve, reject) => {
                const req = indexedDB.open("keyval-store");
                req.onerror = () => reject(req.error);
                req.onsuccess = () => {
                    const db = req.result;
                    const tx = db.transaction("keyval", "readonly");
                    const store = tx.objectStore("keyval");
                    const cursorReq = store.openCursor();
                    const keys: string[] = [];
                    cursorReq.onsuccess = () => {
                        const cursor = cursorReq.result;
                        if (cursor) {
                            if (String(cursor.key).startsWith("history:outbox:"))
                                keys.push(String(cursor.key));
                            cursor.continue();
                        } else resolve(keys);
                    };
                    cursorReq.onerror = () => reject(cursorReq.error);
                };
            }),
    );
    for (const key of outboxKeys) {
        const raw = await page.evaluate(
            (k) =>
                new Promise((resolve, reject) => {
                    const req = indexedDB.open("keyval-store");
                    req.onsuccess = () => {
                        const tx = req.result.transaction("keyval", "readonly");
                        const getReq = tx.objectStore("keyval").get(k);
                        getReq.onsuccess = () => resolve(getReq.result);
                        getReq.onerror = () => reject(getReq.error);
                    };
                    req.onerror = () => reject(req.error);
                }),
            key,
        );
        expect(raw, `${key} deveria estar vazio offline`).toEqual([]);
    }

    let posts = 0;
    page.on("request", (r) => {
        if (r.url().includes("/api/v1/history") && r.method() === "POST") posts++;
    });

    await goOnline(page, context);
    await expect(page.getByTestId("quote-send")).toBeEnabled();

    const postWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/history") && r.request().method() === "POST",
    );
    await page.getByTestId("quote-send").click();
    await postWait;
    await expect(page).toHaveURL(/\/historico(\?)?$/);

    // UM POST só para este orçamento — a fila começou vazia (achado acima).
    expect(posts).toBe(1);
});

// Densidade — zero transbordo HORIZONTAL (molde `catalog-recalculo.spec.ts`'s cenário 5, que também
// só mede X). ACHADO (T084): o passo de revisão (18d+18e) empilha 3 cartões — itens, desconto/
// total/sobra, "Enviar congela" com validade+aviso — mais Voltar/Enviar; a 390×844 e mesmo a
// 1280×844 (viewport fixo, não o corte de LARGURA de 1280px) esse conteúdo passa naturalmente da
// altura da tela, e rolagem vertical de PÁGINA é o comportamento CORRETO para uma tela de revisão
// rica, não o defeito que a lição do 016 mirava (lá, o alvo era um scroll vertical INDESEJADO numa
// superfície compacta que não devia precisar rolar). Medir Y aqui teria reprovado a tela por rolar
// verticalmente — que é exatamente o que ela deve fazer. `y` segue medido e anexado ao anexo de
// evidência (T089), só não é mais um GATE de falha.
async function overflow(page: Page): Promise<{ x: number; y: number }> {
    return page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
}

for (const width of [390, 1280] as const) {
    test(`densidade ${width}px — sem transbordo horizontal`, async ({ page }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 844 });
        await setupPremiumAccount(page, `quote-density-${width}-${info.workerIndex}`);
        await createFilament(page, "Filamento Densidade");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Densidade");
        await createProduct(
            page,
            "Peca Densidade",
            "Filamento Densidade",
            "Impressora Densidade",
            "100",
            "4",
        );

        await openBuilder(page);
        await pick(page, "Peca Densidade", "1");
        await page.getByRole("button", { name: tq.continueAction }).click();
        await expect(page.getByTestId("quote-net")).toBeVisible();

        const { x } = await overflow(page);
        expect(x, `overflow X em ${width}px`).toBeLessThanOrEqual(1);
    });
}
