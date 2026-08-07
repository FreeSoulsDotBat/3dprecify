import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 016/PR-F (T061, US16/US17, FR-923/924/926) — the seller-profile + volumoso turnstile against the
// REAL stack (premium-gated, ADR-0012). Independent Test (spec §US16/§US17): CPF+alto-volume changes
// the price by the published R$ 3,00/band (never fabricated); a base below the CPF_ALTO_VOLUME floor
// (R$ 12) shows the honest I9 warning with NO price; volumoso sums R$ 50,00 exactly once, per order,
// and unchecking it is byte-identical; Amazon INDIVIDUAL reflects the measured R$ 2,00 with its own
// fixed-fee provenance seal.
//
// Numbers below were produced by RUNNING pricing-core's `computeCalculator`/`grossUp` against the
// SEED default (varejo R$ 24,24 / atacado R$ 21,01, 016/PR-C reverify) and the committed
// `backend/app/data/catalog.json` — never guessed.

const t = messages.calculator;

test.describe("Shopee seller profile + volumoso (premium)", () => {
  test.beforeEach(async ({ page }, info) => {
    const email = await signUpThrowaway(page, `shopee-prof-${info.workerIndex}`);
    grantPremium(email);
    await page.reload();
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    const slot = page.getByTestId("channel-slot").first();
    await slot.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  });

  test("sem resposta ao perfil: preço é o catch-all de hoje (R$ 35,30 varejo)", async ({
    page,
  }) => {
    const price = page.getByTestId("channel-price").first();
    await expect(price).toContainText("R$ 35,30");
  });

  test("CPF + mais de 450 pedidos: o anúncio sobe pelo R$ 3,00/banda publicado — o líquido NÃO muda", async ({
    page,
  }) => {
    const slot = page.getByTestId("channel-slot").first();
    await slot
      .getByLabel(t.channels.sellerProfile.sellerTypeLabel)
      .selectOption({ label: t.channels.sellerProfile.sellerTypeOptions.CPF });
    await slot
      .getByLabel(t.channels.sellerProfile.highVolumeLabel)
      .selectOption({ label: t.channels.sellerProfile.highVolumeOptions.SIM });

    const price = page.getByTestId("channel-price").first();
    // catch-all 35,30 → CPF_ALTO_VOLUME 39,05 (o fixo sobe R$ 3,00 e o gross-up multiplica por
    // 1/(1-20%) = 1,25 ⇒ +R$ 3,75 no anúncio); o líquido continua IGUAL entre os dois perfis (a
    // fonte publica o adicional já somado — o seller RECEBE o mesmo, o COMPRADOR paga a diferença).
    //
    // hotfix 016/A2 (2026-08-07): o líquido era R$ 4,24 e virou R$ 24,24 — os R$ 20,00 do
    // "voucher co-financiado" saíam do bolso do vendedor por uma conta que a fonte não publica
    // (o subsídio é da Shopee). O ANÚNCIO não se move: frete nunca foi gross-upado. Re-baseline
    // RODADO com `grossUp` sobre o catálogo commitado, não estimado.
    await expect(price).toContainText("R$ 39,05");
    await expect(price).toContainText("R$ 24,24");
  });

  test("CNPJ (o eixo não existe) resolve o catch-all — byte-idêntico a não responder", async ({
    page,
  }) => {
    const slot = page.getByTestId("channel-slot").first();
    await slot
      .getByLabel(t.channels.sellerProfile.sellerTypeLabel)
      .selectOption({ label: t.channels.sellerProfile.sellerTypeOptions.CNPJ });
    // A pergunta de volume só existe para CPF.
    await expect(slot.getByLabel(t.channels.sellerProfile.highVolumeLabel)).toHaveCount(0);

    const price = page.getByTestId("channel-price").first();
    await expect(price).toContainText("R$ 35,30");
  });

  test("CPF sem alto volume: a fonte diz que o adicional NÃO se aplica — catch-all, não a regressiva", async ({
    page,
  }) => {
    const slot = page.getByTestId("channel-slot").first();
    await slot
      .getByLabel(t.channels.sellerProfile.sellerTypeLabel)
      .selectOption({ label: t.channels.sellerProfile.sellerTypeOptions.CPF });
    await slot
      .getByLabel(t.channels.sellerProfile.highVolumeLabel)
      .selectOption({ label: t.channels.sellerProfile.highVolumeOptions.NAO });

    const price = page.getByTestId("channel-price").first();
    await expect(price).toContainText("R$ 35,30");
    await expect(page.getByTestId("shopee-regressive-fee-warning")).toHaveCount(0);
  });

  test("base abaixo do piso CPF_ALTO_VOLUME (R$ 12): aviso com os dois pontos oficiais, ZERO preço fabricado (I9)", async ({
    page,
  }) => {
    // Zera todo fator que multiplica o preço (custo do rolo, gramas, consumo, tarifa, valor da
    // máquina) — cada um sozinho já zera seu termo, então `printTimeHours` (fica no default) não
    // precisa ser tocado: 0 × qualquer coisa é 0.
    // `getByRole("textbox")` e NÃO `getByLabel`: o padrão da casa desde a PR-C — o ⓘ ("Sobre as
    // gramas usadas") contém o rótulo como substring MAS é role=button (o role filtra); e
    // `exact: true` falha porque o nome acessível do campo obrigatório carrega o marcador de
    // obrigatório junto do rótulo (medido: o locator exact esperou 30s por zero matches).
    await page.getByRole("textbox", { name: t.fields.costPerRoll }).fill("0");
    await page.getByRole("textbox", { name: t.fields.grams }).fill("0");
    await page.getByRole("textbox", { name: t.fields.avgPower }).fill("0");
    await page.getByRole("textbox", { name: t.fields.tariff }).fill("0");
    await page.getByRole("textbox", { name: t.fields.machineValue }).fill("0");

    const slot = page.getByTestId("channel-slot").first();
    await slot
      .getByLabel(t.channels.sellerProfile.sellerTypeLabel)
      .selectOption({ label: t.channels.sellerProfile.sellerTypeOptions.CPF });
    await slot
      .getByLabel(t.channels.sellerProfile.highVolumeLabel)
      .selectOption({ label: t.channels.sellerProfile.highVolumeOptions.SIM });

    const warning = page.getByTestId("shopee-regressive-fee-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("R$10 tem uma taxa de R$6,50");
    await expect(warning).toContainText("R$8 terá taxa de R$6");
    await expect(warning).toContainText("450 pedidos");

    // E nenhum preço aparece para este canal — "sem referência", nunca um número fabricado.
    const price = page.getByTestId("channel-price").first();
    await expect(price).toContainText(t.channels.unpricedBand);
  });

  test("volumoso marcado soma R$ 50,00 com a legenda 'por pedido'; desmarcar é byte-idêntico", async ({
    page,
  }) => {
    const slot = page.getByTestId("channel-slot").first();
    const antesText = await page.getByTestId("channel-price").first().textContent();

    // 016/PR-F homologação (A2) — o controle é o DS `Switch` (role=switch, `shared/ui/switch.tsx`),
    // não mais um `<input type="checkbox">` cru: Playwright's `.check()/.uncheck()` exigem um
    // checkbox/radio nativo (ou role=checkbox), então o toggle usa `.click()` + `aria-checked`.
    const toggle = slot.getByRole("switch", { name: "Manuseio de item volumoso" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(slot.getByText(/por pedido/)).toBeVisible();
    // 016/PR-F homologação (A3) — a legenda diz a verdade completa: o valor entra como custo do
    // canal e o ANÚNCIO sobe mais do que ele (o gross-up incide sobre a sobretaxa também).
    await expect(slot.getByText(/o preço do anúncio sobe MAIS que isso/)).toBeVisible();
    await expect(slot.getByText(/somado inteiro nesta unidade/i)).toBeVisible();

    // catch-all 35,30 → +volumoso 109,58 (o R$ 50 soma ao gross-up E é deduzido do líquido — a
    // conta é do motor, não desta tela). O anúncio é o MESMO de antes do hotfix 016/A2: o frete
    // nunca foi gross-upado, então tirar o voucher não moveu um dígito aqui. O que mudou é o
    // líquido, que era NEGATIVO (−R$ 5,76) e voltou a ser R$ 24,24 — era esse o achado A2.
    const price = page.getByTestId("channel-price").first();
    await expect(price).toContainText("R$ 109,58");
    await expect(price).toContainText("R$ 24,24");
    // E o aviso de "não-lucrativo" NÃO aparece: o líquido negativo que o T072 mediu era o voucher,
    // não a sobretaxa. Um vendedor que confiasse naquela tela recusaria a Shopee por uma conta que
    // não existe.
    await expect(page.getByText(t.channels.negativeLiquido)).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    const depoisText = await page.getByTestId("channel-price").first().textContent();
    expect(depoisText).toBe(antesText);
  });
});

test.describe("Amazon INDIVIDUAL — os R$ 2,00 medidos + a procedência própria do fixo (premium)", () => {
  test("o selo separado mostra a procedência do fixo, e o preço reflete os R$ 2,00", async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `amz-individual-${info.workerIndex}`);
    grantPremium(email);
    await page.reload();
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

    const slot = page.getByTestId("channel-slot").first();
    // O slot já nasce em Amazon/Profissional (015/A11) — troca só a modalidade.
    await slot.getByLabel(t.channels.modality).selectOption("INDIVIDUAL");

    const price = page.getByTestId("channel-price").first();
    // Catch-all "Outros" 15% + R$ 2,00 fixo (plano Individual) sobre a base do seed (R$ 24,24):
    // Profissional ficaria em R$ 28,52 — a diferença é exatamente o fixo do Individual.
    await expect(price).toContainText("R$ 30,87");

    const fixedFeeSeal = slot.getByTestId("fixed-fee-source-seal");
    await expect(fixedFeeSeal).toBeVisible();
    await expect(fixedFeeSeal).toContainText("01/12/2020");
  });
});
