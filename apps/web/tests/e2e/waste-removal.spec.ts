import { PRICING_MODEL_VERSION } from "@3dprecify/pricing-core";

import { expect, test, type Page } from "@playwright/test";

import preRemovalFixture from "../../src/entities/history/__fixtures__/frozen-payload-pre-016.json" with { type: "json" };

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_BACKEND_URL } from "../../playwright.config";

import { captureEntitlementBearerToken } from "./billing-helpers";
import { grantPremium, recordFromCalculator, signUpThrowaway } from "./history-helpers";

// 016/T041 (US10, FR-912/913, SC-907) — the document matrix against the REAL stack: pricing-core
// 4.0.0 REJECTS `wasteGrams`, so no path can silently keep computing it — this is where that
// guarantee meets three documents that were NEVER exercised end-to-end before this fatia:
//
//   [a] a budget recorded TODAY reopens clean — no field, no declaration (the common case).
//   [b] a SIMULATION saved before pricing-core 4.0.0 (its `lastKnown` still carries `wasteGrams`,
//       since nothing purges an old row) reopens RECOMPUTING without it, with the discard
//       DECLARED where the seller can see it (016/T036).
//   [c] a snapshot FROZEN before 4.0.0 (this file's sibling fixture) opens showing exactly what
//       was quoted (immutability untouched, ADR-0019) — and its "comparar hoje" carries the
//       structural note explaining that part of any gap may come from the retired field, not a
//       real cost move (016/T037).
//
// Seeding [b]/[c] goes straight at the backend (a captured bearer token, `captureEntitlementBearerToken`
// — the same seam `billing-helpers.ts` already exercises): the client UI, built on 4.0.0, can never
// itself PRODUCE a document carrying the retired field — only a document written before this fatia
// can, and that is exactly what these two cases must prove survives.

const t = messages;

// 018 mestre-detalhe: a ≥1280px o registro aberto vive na coluna `complementary`, ao lado da
// lista — que também mostra o valor como resumo do card. Abaixo do corte a ficha é a tela inteira.
function historicoDetail(page: Page) {
    return (page.viewportSize()?.width ?? 0) >= 1280 ? page.getByRole("complementary") : page;
}

test.describe("016/T041 — a matriz de documentos (congelado antigo · simulação antiga · novo)", () => {
    test("[a] um orçamento gravado HOJE reabre limpo — sem declaração nenhuma (4.0.0)", async ({
        page,
    }, info) => {
        const email = await signUpThrowaway(page, `waste-a-${info.workerIndex}`);
        grantPremium(email);

        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByText("R$ 24,24").first()).toBeVisible(); // 016/PR-C seed, sem desperdício

        await recordFromCalculator(page);
        await expect(page.getByText(t.historico.saved)).toBeVisible();

        await page.goto("/historico");
        await page.getByText(t.historico.title).first().waitFor();
        // Reopen the just-recorded item — it is the only one for this throwaway account.
        await page.locator(".tf-historico__card, [data-testid='snapshot-card']").first().click();
        await expect(page).toHaveURL(/\/historico\?snapshot=.+/);

        // The technical sheet names the CURRENT model — never a declaration surface for a clean doc.
        // 019/PR-E: o literal pinado quebrou DUAS vezes com bump MINOR (4.1.0 na 016/PR-F, 4.2.0 aqui) —
        // a âncora passa a ler a constante exportada do próprio pacote, como o resto da suíte faz.
        await expect(page.getByText(PRICING_MODEL_VERSION)).toBeVisible();
        await expect(page.getByText(/O documento salvo continha/)).toHaveCount(0);
        await expect(page.getByText(/Desperdício \(g\)/)).toHaveCount(0);
    });

    test("[b] simulação salva com wasteGrams reabre recomputando com a DECLARAÇÃO visível", async ({
        page,
    }, info) => {
        const email = await signUpThrowaway(page, `waste-b-${info.workerIndex}`);
        grantPremium(email);
        await page.goto("/calcular");
        await page.reload();

        const bearer = await captureEntitlementBearerToken(page);
        await page.reload(); // fires GET /entitlement again so the promise above resolves

        const nome = `sim-pre-016-${info.workerIndex}-${Date.now()}`;
        const lastKnown = {
            costPerRoll: "100",
            rollWeightKg: "1",
            printGrams: "100",
            wasteGrams: "10.000", // 016/US10 — the retired leaf a pre-4.0.0 row still carries
            printTimeHours: "5",
            avgPowerKw: "0.10",
            tariffPerKwh: "1",
            machineValue: "4000",
            machineLifetimeHours: "2000",
            maintenanceReservePerHour: "0",
            failurePct: "0",
            finishTimeHours: "0",
            finishRatePerHour: "0",
            laborHours: "0",
            laborRatePerHour: "0",
            markupVarejoPct: "50",
            markupAtacadoPct: "30",
        };
        const createRes = await page.request.post(`${E2E_BACKEND_URL}/api/v1/scenarios`, {
            headers: { authorization: bearer },
            data: {
                name: nome,
                config: {
                    schemaVersion: 1,
                    includeMarketplace: true,
                    costBasis: { kind: "AD_HOC", ref: null, lastKnown },
                    channels: [],
                    otherCosts: [],
                },
            },
        });
        expect(createRes.ok(), await createRes.text()).toBeTruthy();

        // Reopen from Simulações (client-nav — never a deep-link).
        await page.goto("/calcular");
        await page.getByRole("button", { name: new RegExp(t.scenarios.navEntry) }).click();
        await page.getByText(nome).click();

        // The declaration: persistent, names the pt-BR field, never the wire key.
        await expect(page.getByText(/Desperdício \(g\)/)).toBeVisible();
        await expect(page.getByText(/modelo de preço atual não usa mais/)).toBeVisible();
        await expect(page.getByText(/wasteGrams/)).toHaveCount(0);
        // The recompute below happened WITHOUT the field — a coherent, non-NaN price is on screen.
        await expect(page.getByText(/R\$\s?\d+,\d{2}/).first()).toBeVisible();
    });

    test("[c] um snapshot pré-4.0.0 abre exibindo o que foi cotado + a nota estrutural no compare", async ({
        page,
    }, info) => {
        const email = await signUpThrowaway(page, `waste-c-${info.workerIndex}`);
        grantPremium(email);
        await page.goto("/calcular");
        await page.reload();
        const bearer = await captureEntitlementBearerToken(page);
        await page.reload();

        // A live product, priced TODAY (no waste) — the ORIGIN the frozen document points at, so
        // "comparar hoje" has something to resolve against (a null-provenance snapshot has no compare
        // at all, FR-503 — this fixture needs a real origin to exercise the structural note). CREATE
        // requires both links resolved (`_unresolvable`, values-only is a delete-degradation-only
        // shape) — a filament + printer go in first.
        const filamentRes = await page.request.post(`${E2E_BACKEND_URL}/api/v1/filaments`, {
            headers: { authorization: bearer },
            data: {
                name: `filamento-pre-016-${info.workerIndex}`,
                material: "PLA",
                costPerRoll: "100.00",
                rollWeightKg: "1.000",
            },
        });
        expect(filamentRes.ok(), await filamentRes.text()).toBeTruthy();
        const filament = await filamentRes.json();

        const printerRes = await page.request.post(`${E2E_BACKEND_URL}/api/v1/printers`, {
            headers: { authorization: bearer },
            data: {
                name: `impressora-pre-016-${info.workerIndex}`,
                machineValue: "4000.00",
                machineLifetimeHours: "2000.000",
                avgPowerKw: "0.1000",
                maintenanceReservePerHour: "0",
            },
        });
        expect(printerRes.ok(), await printerRes.text()).toBeTruthy();
        const printer = await printerRes.json();

        const productRes = await page.request.post(`${E2E_BACKEND_URL}/api/v1/products`, {
            headers: { authorization: bearer },
            data: {
                name: `produto-pre-016-${info.workerIndex}`,
                filamentId: filament.id,
                printerId: printer.id,
                pieceInputs: {
                    printGrams: "100.000",
                    printTimeHours: "5.000",
                    failurePct: "10.000",
                    finishTimeHours: "0.500",
                    finishRatePerHour: "10.000000",
                    laborHours: "0.000",
                    laborRatePerHour: "0.000000",
                    markupVarejoPct: "50.000",
                    markupAtacadoPct: "30.000",
                },
                tariffPerKwh: "1.000000",
                includeMarketplace: false,
                channels: [],
                otherCosts: [],
            },
        });
        expect(productRes.ok(), await productRes.text()).toBeTruthy();
        const product = await productRes.json();

        const frozen = {
            ...preRemovalFixture,
            provenance: { kind: "PRODUCT", id: product.id, name: product.name },
        };
        const rotulo = `congelado-pre-016-${info.workerIndex}-${Date.now()}`;
        const snapRes = await page.request.post(`${E2E_BACKEND_URL}/api/v1/history`, {
            headers: { authorization: bearer },
            data: {
                clientSnapshotId: crypto.randomUUID(),
                kind: "SINGLE",
                label: rotulo,
                quoteValidityDays: null,
                deviceQuotedAt: "2026-01-10T12:00:00.000Z",
                deviceUtcOffsetMinutes: -180,
                modelVersion: "3.1.0",
                headlineTotal: frozen.totals.precoVarejo,
                headlineBasis: "PRECO_VAREJO",
                payload: frozen,
            },
        });
        expect(snapRes.ok(), await snapRes.text()).toBeTruthy();

        await page.goto("/historico");
        await page.getByText(rotulo).click();
        await expect(page).toHaveURL(/\/historico\?snapshot=.+/);

        // What was quoted — frozen, immutable, exactly the 3.1.0 numbers (ADR-0019 untouched).
        const detalhe = historicoDetail(page);
        await expect(detalhe.getByText("R$ 42,98")).toBeVisible(); // frozen precoVarejo
        await expect(page.getByText("3.1.0")).toBeVisible(); // the technical sheet names the OLD model

        // "Comparar hoje": the live product resolves (cheaper — today's model drops the waste term),
        // and the structural note explains part of the gap.
        await page.getByRole("button", { name: t.historico.compareAction }).click();
        await expect(page.getByText(t.historico.compareToday, { exact: true })).toBeVisible();
        await expect(page.getByText(/calculado pelo modelo 3\.1\.0/)).toBeVisible();
        await expect(page.getByText(/O modelo atual não tem mais esse campo/)).toBeVisible();
    });
});
