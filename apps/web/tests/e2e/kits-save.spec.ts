import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";

// 008/PR-B e2e — kit PERSISTENCE against the REAL stack (Postgres + the entitlement gate). The
// claims under test are the ones a unit test cannot make honestly:
//   · save → the ad-hoc piece MATERIALIZES as a catalog product, said out loud (K3/K4);
//   · saving the same piece name again REFERENCES it — no duplicate ever appears (SC-411);
//   · reopen → the kit reloads its INPUTS and RECOMPUTES the same money (FR-407: no stored price);
//   · a free account's save is denied and materializes NOTHING.

const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
const t = messages;

// 018 mestre-detalhe: a ≥1280px a lista e a ficha do item convivem na MESMA tela, então o nome
// aparece duas vezes (a linha `master-item` + o `<h2>` da ficha). Abaixo do corte a lista segue
// sendo a única leitura — daí o locator trocar por viewport, nunca `.first()` às cegas.
function itemVisible(page: Page, text: string) {
    return (page.viewportSize()?.width ?? 0) >= 1280
        ? page.getByTestId("master-item").filter({ hasText: text })
        : page.getByText(text);
}

/** Abre um produto/kit salvo do Catálogo: no mestre-detalhe (≥1280) o clique na lista só
 *  SELECIONA — quem navega para a rota cheia é o botão "Abrir para editar" da ficha. Abaixo do
 *  corte o clique na linha já navega. */
async function openCatalogItem(page: Page, text: string): Promise<void> {
    if ((page.viewportSize()?.width ?? 0) >= 1280) {
        await page.getByTestId("master-item").filter({ hasText: text }).click();
        await page
            .getByTestId("detail-panel")
            .getByRole("button", { name: t.catalog.detailOpenEditor })
            .click();
    } else {
        await page.getByText(text).click();
    }
}

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

test("premium saves a kit: the ad-hoc piece materializes, reopening recomputes (US2/US6, SC-411)", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `kit-save-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/kits");
    await page.reload();

    // One ad-hoc line at the default values — the composer prices it live (custo R$ 16,16, 016/PR-C B1 seed).
    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
    await expect(page.getByText(/R\$\s?16,16/).first()).toBeVisible();

    await page.getByRole("textbox", { name: new RegExp(t.bom.kitName) }).fill("Kit Suporte");
    await page.getByRole("button", { name: t.bom.save, exact: true }).click();

    // A real 2xx — and the save SAYS what it did to the catalog (K4).
    await expect(page.getByText(t.bom.saved)).toBeVisible();
    await expect(page.getByText(t.bom.savedTitle)).toBeVisible();
    await expect(
        page.getByText(t.bom.savedCreated.replace("{nome}", "Peça 1 · Kit Suporte")),
    ).toBeVisible();

    // The piece really is in the catalog now — as a MANUAL product, flagged for attention (K3),
    // because it has no saved filament/printer behind it yet.
    await page.goto("/catalogo?tab=products");
    await expect(itemVisible(page, "Peça 1 · Kit Suporte")).toBeVisible();
    await expect(page.getByText(t.catalog.needsAttention).first()).toBeVisible();

    // The kit is in the Kits tab, described by STRUCTURE — never a price (FR-407).
    await page.goto("/catalogo?tab=kits");
    await expect(itemVisible(page, "Kit Suporte")).toBeVisible();
    // 018 mestre-detalhe: a ≥1280px o resumo "1 peça(s)" também aparece na ficha (mesmo texto do
    // card) — escopado à linha da lista, nunca `.first()` às cegas.
    await expect(itemVisible(page, t.catalog.countKitPieces.replace("{n}", "1"))).toBeVisible();

    // Reopen it: the inputs come back and the SAME money is RECOMPUTED from them (no stored price).
    await openCatalogItem(page, "Kit Suporte");
    await expect(page.getByText(/R\$\s?16,16/).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: new RegExp(t.bom.kitName) })).toHaveValue(
        "Kit Suporte",
    );

    // Saving a SECOND kit whose piece carries the same name REFERENCES the existing product — the
    // catalog must never grow a duplicate (SC-411), and the seller is told the saved values won.
    await page.goto("/kits");
    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
    await page.getByRole("textbox", { name: new RegExp(t.bom.kitName) }).fill("Kit Dois");
    await page
        .getByRole("textbox", { name: new RegExp(t.bom.pieceName) })
        .fill("Peça 1 · Kit Suporte");
    await page.getByRole("button", { name: t.bom.save, exact: true }).click();

    await expect(
        page.getByText(t.bom.savedReferenced.replace("{nome}", "Peça 1 · Kit Suporte")),
    ).toBeVisible();
    await expect(page.getByText(t.bom.savedSuperseded)).toBeVisible();

    await page.goto("/catalogo?tab=products");
    // 018 mestre-detalhe: a ≥1280px o nome também aparece no `<h2>` da ficha aberta — a contagem
    // que prova "nenhum duplicado" é a das LINHAS da lista, não a de todo texto na tela.
    await expect(itemVisible(page, "Peça 1 · Kit Suporte")).toHaveCount(1); // no duplicate, ever
});

test("deleting a referenced product degrades the kit line on reopen — never a live-reference lie (D6/SC-405)", async ({
    page,
}, info) => {
    const email = await signUpThrowaway(page, `kit-degrade-${info.workerIndex}`);
    grantPremium(email);

    await page.goto("/kits");
    await page.reload();

    // Save a kit with one ad-hoc line → it materializes a manual product the kit line references.
    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
    await expect(page.getByText(/R\$\s?16,16/).first()).toBeVisible();
    await page.getByRole("textbox", { name: new RegExp(t.bom.kitName) }).fill("Kit Degrada");
    await page.getByRole("button", { name: t.bom.save, exact: true }).click();
    await expect(page.getByText(t.bom.saved)).toBeVisible();
    // The save navigated to /kits?id=<kit>; keep that URL to reopen the exact kit after the delete.
    await expect(page).toHaveURL(/\/kits\?id=/);
    const kitUrl = page.url();

    const piece = "Peça 1 · Kit Degrada";

    // Delete the materialized product the kit line references.
    await page.goto("/catalogo?tab=products");
    await expect(itemVisible(page, piece)).toBeVisible();
    await page.getByRole("button", { name: `${t.catalog.remove} ${piece}` }).click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: t.catalogForm.deleteConfirm, exact: true })
        .click();
    await expect(page.getByText(piece)).toHaveCount(0); // gone from the catalog

    // Reopen the kit. The server resolves the soft-deleted product LIVE-only, so the line comes back
    // degraded; the composer recomputes from the last-known snapshot and re-hydrates to it (the
    // client-side staleness + re-hydration are pinned deterministically in the unit tests —
    // use-catalog.test.tsx invalidation + bom-page.test.tsx re-hydration).
    await page.goto(kitUrl);

    // The line degrades HONESTLY: a calm "(avulsa)" + valores-mantidos caption, still priced; it
    // NEVER presents the deleted product as a live reference, and NEVER claims a removal.
    await expect(page.getByText(t.productForm.manualValuesKept)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\(avulsa\)/).first()).toBeVisible();
    await expect(page.getByText(/R\$\s?16,16/).first()).toBeVisible(); // still priceable
    await expect(page.getByText(piece)).toHaveCount(0); // the deleted product is NOT shown as live
    // F1/K3 honesty guard: no removal/deletion claim anywhere on the degraded surface.
    await expect(page.getByText(/removid|excluíd|deletad/i)).toHaveCount(0);
});

test("a FREE account cannot save a kit — and nothing is materialized (SC-411)", async ({
    page,
}, info) => {
    await signUpThrowaway(page, `kit-free-${info.workerIndex}`); // never granted

    // 019/PR-B: a conta grátis monta o kit (composição local, sem rede) e encontra "Salvar kit"
    // desabilitado e VISÍVEL — nada é materializado porque nenhum handler de escrita existe. O
    // servidor continua sendo a fronteira (SC-1903).
    await page.goto("/kits");
    await expect(page.getByTestId("vazio-didatico")).toContainText(t.catalog.educationalKitsBody);
    await page.getByRole("button", { name: t.bom.addLine }).first().click();
    const salvar = page.getByRole("button", { name: t.bom.save, exact: true });
    await expect(salvar).toBeVisible();
    await expect(salvar).toBeDisabled();
});
