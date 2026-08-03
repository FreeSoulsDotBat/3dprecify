import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// The committed fee-catalog served by GET /api/v1/fee-catalog — used to force the ONLINE reference
// seal (source ≠ seed) in the overflow regression below, matching what the deployed endpoint returns.
const servedCatalogJson = readFileSync(
  fileURLToPath(new URL("../../../../backend/app/data/catalog.json", import.meta.url)),
  "utf-8",
);

// Authenticated calculator E2E (US2). Signs a throwaway user in against the Firebase Auth
// emulator through the app's emulator-only seam (window.__e2eAuth, see shared/lib/firebase.ts),
// then drives the calculator. Requires the emulator running — use `pnpm e2e` at the repo root
// (firebase emulators:exec wraps the Playwright run).

async function signInThrowaway(page: import("@playwright/test").Page, tag: string): Promise<void> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      // Fire-and-forget: signUp triggers the /sign-in → guarded-route auth redirect, and
      // awaiting it here would let that navigation destroy this evaluate's execution context
      // ("Execution context was destroyed"). Kick it off; the caller waits for the redirect UI.
      void w.__e2eAuth.signUp(em, pw);
    },
    { em: email, pw: "test-passw0rd" },
  );
  // The /sign-in guard bounces authenticated users to the calculator at "/".
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
}

test("authenticated user computes the full E1 model (SC-001 canonical vector)", async ({
  page,
}, info) => {
  await signInThrowaway(page, `base-${info.workerIndex}`);

  const f = messages.calculator.fields;
  // The SC-001 worked example → custo_total R$ 28,65, varejo R$ 42,98, atacado R$ 37,25.
  await page.getByLabel(f.costPerRoll).fill("100");
  await page.getByLabel(f.rollWeight).fill("1");
  await page.getByLabel(f.grams).fill("100");
  await page.getByLabel(f.wasteGrams).fill("10");
  await page.getByLabel(f.printTime).fill("5");
  await page.getByLabel(f.avgPower).fill("0,10");
  await page.getByLabel(f.tariff).fill("1");
  await page.getByLabel(f.machineValue).fill("4000");
  await page.getByLabel(f.machineLifetime).fill("2000");
  await page.getByLabel(f.failure).fill("10");
  await page.getByLabel(f.finishTime).fill("0,5");
  await page.getByLabel(f.finishRate).fill("10");
  await page.getByLabel(f.markupVarejo).fill("50");
  await page.getByLabel(f.markupAtacado).fill("30");

  // 015/A11 — `.first()` porque o valor aparece DUAS vezes, e a segunda e aritmetica do modelo, nao
  // duplicacao: com o padrao AMAZON o canal e precificado, e o LIQUIDO RECEBIDO no canal e por
  // construcao igual ao preco de varejo — e exatamente o alvo do gross-up. A derivacao vem antes no
  // DOM (o proprio componente diz "shown BEFORE the suggested prices"), entao `.first()` e ela.
  await expect(page.getByText("R$ 28,65")).toBeVisible(); // custo_total breakdown row
  await expect(page.getByText("R$ 42,98").first()).toBeVisible(); // varejo derivation row
  await expect(page.getByText("R$ 37,25").first()).toBeVisible(); // atacado derivation row

  // FR-021 / analyze A1: the corrected model carries NO tax/imposto input.
  await expect(page.getByText(/imposto/i)).toHaveCount(0);
});

test("zero roll weight shows a friendly error, no division by zero", async ({ page }, info) => {
  await signInThrowaway(page, `err-${info.workerIndex}`);

  await page.getByLabel(messages.calculator.fields.rollWeight).fill("0");
  await expect(page.getByText(messages.calculator.rollWeightError)).toBeVisible();
});

test("app shell + calculator work offline once the SW has precached (FR-003/FR-011)", async ({
  page,
  context,
}, info) => {
  await signInThrowaway(page, `offline-${info.workerIndex}`);
  // Wait until the service worker controls the page (precache populated).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // navigation served from the SW precache, not the network
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();

  // The pricing calc is client-side, so it still works with no network.
  await page.getByLabel(messages.calculator.fields.costPerRoll).fill("100");
  await page.getByLabel(messages.calculator.fields.rollWeight).fill("1");
  await page.getByLabel(messages.calculator.fields.grams).fill("100");
  // With the remaining pre-filled defaults (5 h · 0,12 kW · tarifa 1 · máquina 4000/2000 h)
  // this yields custo_total R$ 20,60 → varejo R$ 30,90.
  await expect(page.getByText("R$ 30,90").first()).toBeVisible(); // .first(): ver nota do A11 (o liquido do canal = varejo, por construcao)

  await context.setOffline(false);
});

test("signed-out user computes offline with a full breakdown — no save/export, no paywall (US6, SC-009)", async ({
  page,
  context,
}) => {
  const t = messages.calculator;
  // No sign-in: /calcular is public (GC-1). Load online first so the SW can precache.
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // served from the SW precache; auth restores "no user" locally
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Full client-side compute + transparent breakdown, offline AND signed-out.
  await page.getByLabel(t.fields.costPerRoll).fill("100");
  await page.getByLabel(t.fields.rollWeight).fill("1");
  await page.getByLabel(t.fields.grams).fill("100");
  // 015/A11 — `.first()` porque o valor aparece DUAS vezes, e a segunda e aritmetica do modelo, nao
  // duplicacao: com o padrao AMAZON o canal e precificado, e o LIQUIDO RECEBIDO no canal e por
  // construcao igual ao preco de varejo — e exatamente o alvo do gross-up. A derivacao vem antes no
  // DOM (o proprio componente diz "shown BEFORE the suggested prices"), entao `.first()` e ela.
  await expect(page.getByText("R$ 20,60")).toBeVisible(); // custo_total breakdown row (seed)
  await expect(page.getByText("R$ 30,90").first()).toBeVisible(); // varejo for the seed

  // SC-009: nothing is saved/exported and there is no upgrade/paywall CTA. The free-tier
  // note is an honest statement (not a call to action) and stays visible.
  await expect(
    page.getByRole("button", { name: /salvar|exportar|assinar|premium|upgrade|desbloquear/i }),
  ).toHaveCount(0);
  await expect(page.getByText(t.freemiumNote)).toBeVisible();

  await context.setOffline(false);
});

test("US3: a failed fee refresh shows a non-blocking retry; the calculator still computes (SC-104)", async ({
  page,
}) => {
  const t = messages.calculator;
  // Force the online catalog refresh to fail; a later retry succeeds. /calcular is public (no sign-in).
  let failFetch = true;
  await page.route("**/api/v1/fee-catalog", async (route) => {
    if (failFetch) return route.abort();
    return route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson });
  });

  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Non-blocking: a retry notice appears, but the calculator computes from the seed regardless.
  await expect(page.getByText(t.channels.refreshErrorTitle)).toBeVisible();
  await page.getByLabel(t.fields.costPerRoll).fill("100");
  await page.getByLabel(t.fields.rollWeight).fill("1");
  await page.getByLabel(t.fields.grams).fill("100");
  await expect(page.getByText("R$ 30,90").first()).toBeVisible(); // varejo from the seed — never a blank grid // .first(): ver nota do A11 (o liquido do canal = varejo, por construcao)

  // Retry now succeeds → the notice clears (the served catalog is adopted).
  failFetch = false;
  await page.getByRole("button", { name: t.channels.refreshRetry }).click();
  await expect(page.getByText(t.channels.refreshErrorTitle)).toHaveCount(0);
});

test("FULL US1–US5 model has no horizontal overflow at 390px (T040, FR-010)", async ({ page }) => {
  const t = messages.calculator;
  // This test's premise is the SEED fee reference (embedded seal). Since E2 the e2e stack runs a
  // real backend, so the catalog fetch is aborted to keep the seed path under test.
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Build the COMPLETE 005 surface: labor (US4-004), several long-named sub-costs incl. an inline
  // error (US5), a manual-fee channel + a Shopee catalog-prefilled channel with its long seal and
  // voucher line (US1/US2), and every gross-up row rendered — then assert no h-scrollbar anywhere.
  await page.getByLabel(t.fields.laborHours).fill("2");
  await page.getByLabel(t.fields.laborRate).fill("30");

  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRows = page.getByTestId("other-cost-row");
  await costRows.nth(0).getByLabel(t.outrosCustos.name).fill("Frete até a transportadora parceira");
  await costRows.nth(0).getByLabel(t.outrosCustos.value).fill("15");
  await costRows.nth(1).getByLabel(t.outrosCustos.value).fill("-1"); // inline per-row error renders too

  const slot0 = page.getByTestId("channel-slot").first();
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await slot0.getByLabel(t.channels.fixedFee).fill("5");
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("SHOPEE");

  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(4); // 2 channels × 2 levels
  await expect(slot1.getByTestId("fee-seal")).toContainText(t.seals.embedded); // the long seal wraps
  await expect(costRows.nth(1).getByText(t.validation.negative)).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);
});

test("US1: prices several channels at once; add/remove isolates rows; commission 100% errors one slot", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // The default channel (Mercado Livre) — give it a fee so its "Preços por canal" rows render.
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("12");
  await slot0.getByLabel(t.channels.fixedFee).fill("6,75");

  // Add a 2nd channel, make it Shopee with its own fee.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await slot1.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await slot1.getByLabel(t.channels.fixedFee).fill("4");

  // Both channels compute together: each shows anúncio + líquido for varejo e atacado
  // (2 channels × 2 markup levels = 4 "Preço para anunciar" rows).
  await expect(page.getByTestId("channel-price")).toHaveCount(2);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(4);
  await expect(page.getByText(t.results.recebidoLiquido)).toHaveCount(4);

  // Remove the Shopee slot → only its rows drop; Mercado Livre keeps computing.
  await slot1.getByRole("button", { name: t.channels.removeChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2);

  // Re-add Shopee, then set Mercado Livre's commission to 100% — it errors ONLY its slot.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const shopee = page.getByTestId("channel-slot").nth(1);
  await shopee.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await shopee.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await shopee.getByLabel(t.channels.fixedFee).fill("4");

  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("100");
  // Honest inline per-slot error, never a NaN/Infinity; the Shopee slot still shows its prices.
  await expect(slot0.getByText(t.validation.commissionMax)).toBeVisible();
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();
});

test("US2: a covered marketplace pre-fills fees with an honesty seal; editing flips to 'ajustado'; uncovered reads 'sem referência'", async ({
  page,
}) => {
  const t = messages.calculator;
  const seals = t.seals;
  // Premise: no served catalog → bundled-seed fallback (the embedded seal). Abort the fetch since
  // the E2 e2e stack now runs a real backend.
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);

  // The default channel is Mercado Livre, which is NOT curated in the seed (its per-category rates
  // are unverifiable) → the slot honestly reads "sem referência", never a fabricated number.
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.none);

  // Switch it to Shopee (price-band curated). With the fee fields left BLANK the model pre-fills
  // from the catalog and the channel computes — the seal states the numbers came from a reference.
  // No backend runs in e2e (vite preview only) → the store falls back to the bundled seed, so the
  // reference is the offline-embedded one.
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.embedded);
  // The pre-filled catalog bands drive the per-channel prices with NO manual entry.
  await expect(page.getByTestId("channel-price")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();

  // Editing any fee is an override → the seal flips to "ajustado por você" (an edited number is
  // never silently trusted as the reference).
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("15");
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.adjusted);
  await expect(slot0.getByTestId("fee-seal")).not.toContainText(seals.embedded);

  // Nothing ever yields NaN/Infinity.
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
});

test("US2: the long ONLINE reference seal wraps — no 390px overflow (FR-010, T026b nit #2)", async ({
  page,
}) => {
  const t = messages.calculator;
  // Serve the committed catalog so the store's active source becomes "catalog" (not the seed) → the
  // slot shows the FULL online reference seal ("Referência: <long source> · atualizada em …"), the
  // ~850px string the homologation caught overflowing. Intercept before load (the fetch is on mount).
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");

  // The online reference seal (long) renders — proving the source is the served catalog, not the seed.
  const seal = slot0.getByTestId("fee-seal");
  await expect(seal).toContainText(t.seals.reference); // "Referência"
  await expect(seal).toContainText(t.seals.updatedOn); // "atualizada em"
  await expect(seal).not.toContainText(t.seals.embedded); // not the offline/seed seal

  // The long seal must WRAP inside 390px, never force a horizontal scrollbar (the nit #2 fix).
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);
});

// 014/T115 (FR-006a) — o seletor de categoria não tinha UMA regra de CSS: renderizava como `<input>`
// nativo cru, ~24px de altura, sem borda, sem fundo e sem padding, dentro de um formulário onde todo
// campo de dinheiro usa a moldura do DS. A FR-006a exige um campo "de primeira classe, sempre
// expandido" EXATAMENTE para que o vendedor não aceite a alíquota errada sem perceber — um campo que
// não parece campo é a mesma falha que um campo colapsado. A varredura de alvos de toque
// (`a11y-targets-contrast.spec.ts`) não pegou: ela seleciona `a[data-nav-item]`, `.tf-topbar__theme`
// e `button.tf-btn` — nenhum controle de formulário entra na conta.
//
// O limiar não é inventado: 44px é WCAG 2.2 AA, e o resto é comparado com um campo IRMÃO do mesmo
// slot, porque a exigência real é que o seletor seja um campo como os outros, não que ele acerte
// números que o DS nunca adotou.
test("US1: o seletor de categoria é um campo de primeira classe, não um <input> cru (FR-006a, T115)", async ({
  page,
}) => {
  const t = messages.calculator;
  // A espinha de categorias viaja no catálogo SERVIDO (a semente empacotada não a carrega) e hoje só
  // a Amazon publica uma — servir o catálogo committed é o que faz o seletor existir na tela.
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("AMAZON");

  const seletor = slot0.getByLabel(t.categoryPicker.label);
  await expect(seletor).toBeVisible();

  // 1. Alvo de toque (WCAG 2.2 AA): 44px. Um <input> sem CSS nasce com ~24px.
  const box = await seletor.boundingBox();
  expect(box, "o seletor tem caixa").not.toBeNull();
  expect(box!.height, "altura do alvo de toque do seletor").toBeGreaterThanOrEqual(44);

  // 2. Moldura: mesma que a de um campo de dinheiro do MESMO slot — mesma altura, mesma borda, mesmo
  //    raio, mesmo fundo. Lido do estilo COMPUTADO, que é o que o vendedor enxerga.
  const moldura = (loc: import("@playwright/test").Locator) =>
    loc.evaluate((el) => {
      const frame = el.closest(".tf-inputwrap");
      if (!frame) return null;
      const s = getComputedStyle(frame);
      return {
        borderWidth: s.borderTopWidth,
        borderStyle: s.borderTopStyle,
        borderColor: s.borderTopColor,
        radius: s.borderTopLeftRadius,
        background: s.backgroundColor,
      };
    });

  const doDinheiro = await moldura(slot0.getByLabel(/^Comissão(?! mínima)/));
  const doSeletor = await moldura(seletor);
  expect(doSeletor, "o seletor está dentro de uma moldura de campo do DS").not.toBeNull();
  expect(doSeletor, "moldura do seletor == moldura do campo de dinheiro irmão").toEqual(doDinheiro);

  // 3. E a lista de resultados não pode empurrar a página para fora dos 390px.
  await seletor.fill("cal");
  // T117 — a lista NÃO se diz uma `listbox` (o contrato de combobox que o campo anunciava sem
  // cumprir saiu inteiro): é uma `<ul>` em fluxo com botões de verdade. Escopado por ela de
  // propósito, porque `getByRole("button")` solto no slot casaria com o "×" de remover canal.
  const resultados = slot0.getByRole("list").getByRole("button");
  await expect(resultados.first()).toBeVisible();
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);

  // 4. E ESCOLHER não pode desmontar o campo. O estado escolhido devolvia só o chip: o rótulo, a
  //    dica e a moldura sumiam, e a categoria do vendedor virava uma palavra solta entre
  //    "Modalidade" e "Comissão". Um campo que deixa de parecer campo depois de preenchido falha a
  //    FR-006a pela mesma porta que um campo que nunca pareceu.
  await resultados.first().click();
  const escolhido = slot0.getByTestId("category-chosen");
  await expect(escolhido).toBeVisible();
  await expect(slot0.getByText(t.categoryPicker.label)).toBeVisible();
  const boxEscolhido = await escolhido.boundingBox();
  expect(boxEscolhido!.height, "altura do campo já escolhido").toBeGreaterThanOrEqual(44);
  // Escolher move o foco para o "Limpar", que vive DENTRO desta moldura: o `:focus-within` do DS
  // repinta a borda com a cor do anel, por cima de uma transição. Medir sem tirar o foco compararia
  // um campo focado com um campo em repouso — e o resultado dependeria do milissegundo. Tira-se o
  // foco, e o `poll` espera a transição assentar em vez de apostar num `waitForTimeout`.
  await escolhido.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect
    .poll(() => moldura(escolhido), { message: "moldura do escolhido == moldura do campo irmão" })
    .toEqual(doDinheiro);
});

test("US4: the 'Incluir marketplaces no preço' toggle shows/hides the whole marketplace section; the direct price stays (SC-105)", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Default ON: the switch is checked and the marketplace machinery is visible.
  const toggle = page.getByRole("switch", { name: t.channels.includeToggle });
  await expect(toggle).toBeChecked();
  await expect(page.getByRole("button", { name: t.channels.addChannel })).toBeVisible();
  await expect(page.getByText(t.channels.pricesTitle)).toBeVisible();

  // Toggle OFF → the entire marketplace section collapses (no channel slots, no "Preços por canal")…
  await toggle.click();
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).not.toBeChecked();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.channels.addChannel })).toHaveCount(0);
  await expect(page.getByText(t.channels.pricesTitle)).toHaveCount(0);
  // …but the direct varejo/atacado headline the seller reads first is untouched, and never a NaN.
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);

  // Toggle back ON → the section (and its channel slot) return; the switch stays reachable throughout.
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByText(t.channels.pricesTitle)).toBeVisible();
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
});

test("US5: itemized 'Outros custos' — named sub-costs each show as a breakdown line; removing one drops it (SC-106)", async ({
  page,
}) => {
  const t = messages.calculator;
  const oc = t.outrosCustos;
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Add two named sub-costs (Embalagem R$ 3,00 + Etiqueta R$ 2,00). "Etiqueta" avoids colliding with
  // the marketplace channel's "Frete" fee label so the breakdown assertions stay unambiguous.
  await page.getByRole("button", { name: oc.addCost }).click();
  await page.getByRole("button", { name: oc.addCost }).click();
  const rows = page.getByTestId("other-cost-row");
  await expect(rows).toHaveCount(2);

  await rows.nth(0).getByLabel(oc.name).fill("Embalagem");
  await rows.nth(0).getByLabel(oc.value).fill("3,00");
  await rows.nth(1).getByLabel(oc.name).fill("Etiqueta");
  await rows.nth(1).getByLabel(oc.value).fill("2,00");

  // Each named sub-cost is its own breakdown line with its rounded value (FR-115). `exact` so the
  // "Embalagem" breakdown line isn't confused with the slot hint text that also mentions it.
  await expect(page.getByText("Embalagem", { exact: true })).toBeVisible();
  await expect(page.getByText("Etiqueta", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 3,00")).toBeVisible();
  await expect(page.getByText("R$ 2,00")).toBeVisible();

  // Remove "Etiqueta" → its row + breakdown line drop; "Embalagem" stays. Never a NaN.
  await rows.nth(1).getByRole("button", { name: oc.removeCost }).click();
  await expect(page.getByTestId("other-cost-row")).toHaveCount(1);
  await expect(page.getByText("Etiqueta", { exact: true })).toHaveCount(0);
  await expect(page.getByText("R$ 2,00")).toHaveCount(0);
  await expect(page.getByText("Embalagem", { exact: true })).toBeVisible();
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
});

// US6 (T037, SC-109): the FULL 005 surface — several channels (manual + catalog-prefilled), the
// visibility toggle exercised, itemized sub-costs — never renders a bad number and never grows a
// save/export/history/paywall affordance. Signed-out throughout (/calcular is public). The
// `PRICING_MODEL_VERSION === "3.0.0"` half of SC-109 is pinned at the source in pricing-core's
// version.test.ts (single source — the e2e asserts the user-visible behaviors); "backend does no
// price compute" is proven behaviorally by the offline test below (prices render with NO backend).
test("US6: full multi-channel + sub-costs surface — no bad numbers, no save/export/paywall, signed-out (SC-109)", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.goto("/calcular"); // public — no sign-in, no wall
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Channel 1 (default Mercado Livre): manual fees, including a HIGH commission (95% — a valid but
  // extreme gross-up whose denominator 0,05 amplifies any float slip into a visible bad number).
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("95");
  await slot0.getByLabel(t.channels.fixedFee).fill("10");

  // Channel 2: Shopee with BLANK fees → the seed catalog pre-fills bands + voucher (the offline
  // reference path), so both fee models (manual + curated bands) compute side by side.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("SHOPEE");

  // Itemized sub-costs: a named one and a BLANK-named one (falls back to the neutral label).
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRows = page.getByTestId("other-cost-row");
  await costRows.nth(0).getByLabel(t.outrosCustos.name).fill("Embalagem");
  await costRows.nth(0).getByLabel(t.outrosCustos.value).fill("3,00");
  await costRows.nth(1).getByLabel(t.outrosCustos.value).fill("1,005"); // rounds HALF_UP → 1,01

  // Everything computes together: both channels price both markup levels (2×2 anúncio rows).
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(4);
  await expect(page.getByText("Embalagem", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 1,01")).toBeVisible(); // the HALF_UP-rounded blank-named line

  // Exercise the toggle across the full surface: off hides the channels (headline intact)…
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(0);
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();
  // …and back on restores BOTH slots with their fees/prefill intact (RHF state survives).
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(4);

  // SC-109: never a NaN/Infinity/#DIV! anywhere on this full surface…
  await expect(page.getByText(/NaN|Infinity|#DIV/)).toHaveCount(0);
  // …and no save/export/history/paywall affordance ever appears; the freemium note is an honest
  // statement, not a CTA. (The bottom-nav "Histórico" LINK is the app shell placeholder, not a
  // calculator affordance — the assertion targets buttons.)
  await expect(
    page.getByRole("button", {
      name: /salvar|exportar|histórico|assinar|premium|upgrade|desbloquear/i,
    }),
  ).toHaveCount(0);
  await expect(page.getByText(t.freemiumNote)).toBeVisible();
});

// US6 (T038): the FULL 005 surface computes OFFLINE and signed-out from the bundled seed — channels
// (manual fees + Shopee catalog pre-fill), the toggle, and sub-costs — with the failed catalog
// refresh staying non-blocking and nothing gating on the network or a sign-in.
test("US6: offline + signed-out — channels, toggle and sub-costs all compute from the seed (SC-109)", async ({
  page,
  context,
}) => {
  const t = messages.calculator;
  // Premise: the BUNDLED SEED answers offline (embedded seal). Abort the served-catalog fetch so
  // the online pre-load never persists a fresher store (the E2 e2e stack runs a real backend).
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  // Load online once so the SW precaches, then go fully offline.
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });
  await context.setOffline(true);
  await page.reload(); // served from the SW precache; no user, no network

  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // The catalog refresh fails offline → the US3 notice appears but blocks NOTHING.
  await expect(page.getByText(t.channels.refreshErrorTitle)).toBeVisible();

  // Manual channel fee → gross-up computes locally (seed varejo 30,90 @20% + R$0 → 38,63).
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await expect(page.getByText("R$ 38,63")).toBeVisible();

  // Shopee pre-fills from the BUNDLED SEED while offline (the honesty seal says so).
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  await expect(slot1.getByTestId("fee-seal")).toContainText(t.seals.embedded);

  // Sub-cost folds into custo_total offline (seed 20,60 + 3,00 = 23,60).
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRow = page.getByTestId("other-cost-row").first();
  await costRow.getByLabel(t.outrosCustos.name).fill("Embalagem");
  await costRow.getByLabel(t.outrosCustos.value).fill("3,00");
  await expect(page.getByText("R$ 23,60")).toBeVisible();

  // The toggle works offline too: off → channels gone, direct headline intact.
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();

  // Signed-out + offline the whole way: no sign-in wall, nothing offered to save, no bad numbers.
  await expect(page.getByText(/NaN|Infinity|#DIV/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /salvar|exportar|assinar|premium|upgrade|desbloquear/i }),
  ).toHaveCount(0);

  await context.setOffline(false);
});
