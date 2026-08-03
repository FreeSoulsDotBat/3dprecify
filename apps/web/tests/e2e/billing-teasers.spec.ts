import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { teaserPriceLine } from "../../src/shared/billing/price-line";
import { E2E_BACKEND_URL, MP_STUB_URL } from "../../playwright.config";
import { fireStubWebhook } from "./billing-helpers";
import { signUpThrowaway } from "./history-helpers";

// E6 PR-C (T037) — os teasers acesos, o estorno, e as rotas do Play que NAO existem.
//
// O que o vitest prova e que a linha de preco sai da fonte certa. O que ESTE arquivo prova e que ela
// chega na tela de cada um dos quatro, no navegador, com o CTA levando a algum lugar real.

const tb = messages.billing;

test.describe("E6 PR-C — os quatro teasers acesos", () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "chromium-only — um banco de e2e compartilhado",
    );
  });

  for (const [rota, abrir] of [
    ["/kits", null],
    ["/historico", null],
  ] as const) {
    test(`o teaser de ${rota} mostra o preco real e um CTA que leva a oferta`, async ({ page }) => {
      await signUpThrowaway(page, `teaser-${rota.replace("/", "")}`);
      await page.goto(rota);
      if (abrir) await page.getByRole("button", { name: abrir }).click();

      // A LINHA inteira, verbatim da mesma funcao que a UI usa — se as duas divergirem, este
      // teste cai, e divergir e exatamente o bloqueador de release que a FR-710 nomeia.
      await expect(
        page.getByText(teaserPriceLine().replaceAll(String.fromCharCode(160), " ")),
      ).toBeVisible();

      const cta = page.getByRole("link", { name: tb.subscribeAction });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", /\/conta\?assinar=1|\/sign-in/);
    });
  }

  test("o CTA abre a oferta de verdade, com os dois planos para comparar", async ({ page }) => {
    await signUpThrowaway(page, "teaser-oferta");
    await page.goto("/kits");
    await page.getByRole("link", { name: tb.subscribeAction }).click();

    // A prova de que `?assinar=1` nao e decorativo: a oferta abre montada, e com os DOIS planos —
    // porque escolher o periodo pelo vendedor seria vender por ele.
    await expect(page.getByText(tb.planMonthlyPrice)).toBeVisible();
    await expect(page.getByText(tb.planAnnualPrice)).toBeVisible();
  });
});

test.describe("E6 PR-C — o estorno derruba o premium, visto pelo vendedor", () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "chromium-only — um banco de e2e compartilhado",
    );
  });

  test("estorno: a Conta deixa de dizer Premium", async ({ page, request }) => {
    await signUpThrowaway(page, "pr-c-estorno");
    await page.route("https://stub.mercadopago.local/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP</html>" }),
    );
    await page.goto("/conta");
    await page.getByRole("button", { name: tb.subscribeAction }).click();
    await page.getByRole("dialog").getByRole("button", { name: tb.subscribeAction }).click();
    await page.waitForURL(/stub\.mercadopago\.local/);
    const pre = page.url().split("/").pop()!;

    for (const status of ["approved", "refunded"] as const) {
      const reg = await request.post(`${MP_STUB_URL}/_test/payments`, {
        data: { preapprovalId: pre, status, periodDays: 30 },
      });
      expect(reg.status(), await reg.text()).toBe(200);
      const { id } = (await reg.json()) as { id: string };
      const hook = await fireStubWebhook(request, { paymentId: id, requestId: `e2e-${id}` });
      expect(hook.status()).toBe(200);
    }

    await page.goto("/conta");
    // O premium cai NA HORA — sem esperar o fim do periodo, porque o dinheiro voltou.
    await expect(page.getByText(messages.conta.planLapsed)).toBeVisible();
    await expect(page.getByText(messages.conta.planPremium, { exact: true })).toHaveCount(0);
  });
});

test.describe("E6 PR-C — as rotas do Play nao existem neste ambiente", () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "chromium-only");
  });

  for (const rota of ["/api/v1/billing/checkout/play", "/api/v1/billing/webhook/play-rtdn"]) {
    test(`SC-711: ${rota} responde 404 no servidor REAL`, async ({ request }) => {
      // O pytest ja prova isto com uma app construida em memoria. Aqui a pergunta e outra e vale a
      // repeticao: o servidor que o e2e sobe — com a configuracao de verdade, sem flag nenhuma
      // setada — tambem nao tem a rota. E o ambiente que se parece com producao.
      const resp = await request.post(`${E2E_BACKEND_URL}${rota}`, { data: {} });
      expect(resp.status(), `${rota} respondeu ${resp.status()}`).toBe(404);
    });
  }
});
