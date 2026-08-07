import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { signUpThrowaway } from "./history-helpers";

// 016/T072-A7 — a oferta (`OfferPanel`): o radio do periodo nascia esticado (292x13px MEDIDO,
// `input[type=radio]` sem regra propria dentro de um `label` `display:flex; flex-direction:
// column` — sem `align-items`/`width` o cross-axis default e "stretch", entao o controle ocupa a
// largura inteira do card, virando uma barra). O CARD inteiro ja e o alvo de toque (INV-2,
// billing.css), entao o requisito aqui e sobre o CONTROLE VISIVEL: ele volta a ser redondo e do
// tamanho nativo do radio (~16-20px), nunca esticado, e fica alinhado ao rotulo — nao a asserção
// de alvo de toque generica (essa e a11y-targets-contrast.spec.ts).

const t = messages.billing;

test("T072-A7: o radio do periodo na oferta e um controle compacto, nao uma barra", async ({
  page,
}) => {
  await signUpThrowaway(page, "offer-radio-geom");
  await page.goto("/kits");
  await page.getByRole("link", { name: t.subscribeAction }).click();

  await expect(page.getByText(t.planMonthlyPrice)).toBeVisible();

  const radios = page.locator('input[type="radio"][name="tf-billing-period"]');
  await expect(radios).toHaveCount(2);

  for (let i = 0; i < 2; i++) {
    const box = await radios.nth(i).boundingBox();
    expect(box, `radio #${i} has a box`).not.toBeNull();
    // A native radio's rendered box is small and roughly square — never a full-width bar. 28px is
    // a generous ceiling (well above any real UA rendering, well below the measured 292px bug).
    expect(box!.width, `radio #${i} width`).toBeLessThanOrEqual(28);
    expect(box!.height, `radio #${i} height`).toBeGreaterThanOrEqual(12);
    // Not squashed to a hairline either — MEASURED regression was 13px tall AND 292px wide; a fix
    // that only shrank the width but left it a flat hairline would still be wrong.
    expect(box!.width - box!.height, `radio #${i} is roughly square, not a bar`).toBeLessThan(12);
  }
});
