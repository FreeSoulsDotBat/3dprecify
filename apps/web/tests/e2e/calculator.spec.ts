import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 016/US11 (T044/PR-E sweep, FR-915) — marketplace channel pricing is Premium now. Tests below whose
// INTENT is the channel MECHANICS (gross-up, pre-fill, the toggle, the category picker) now sign in
// + `grantPremium` first — the free-tier gate itself is proven exclusively in
// `apps/web/tests/e2e/marketplace-premium.spec.ts`, so it is not re-asserted here.

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
  const ti = messages.calculator.timeInput;
  // 016/US10 — re-baseline SEM Desperdício (o campo saiu, pricing-core 4.0.0): custo_total
  // R$ 27,55, varejo R$ 41,33, atacado R$ 35,82.
  // 016/US6 (FR-908) — 8 of these fields now carry an InfoTip whose trigger aria-label is a
  // SUPERSTRING of the plain field label ("Sobre o consumo médio" ⊇ "Consumo médio"); `getByLabel`
  // matches by substring across EVERY role, so it also catches the tip's `button`. Constraining to
  // `getByRole("textbox", …)` excludes the button by role alone — the fix already used elsewhere
  // in this file — so the tipped fields below use that instead of a bare `getByLabel`.
  await page.getByLabel(f.costPerRoll).fill("100");
  await page.getByLabel(f.rollWeight).fill("1");
  await page.getByRole("textbox", { name: f.grams, exact: true }).fill("100");
  // 016/US7 — printTime is now two fields (h + min); the engine still receives the same decimal.
  await page.getByLabel(ti.hoursAria).fill("5");
  await page.getByLabel(ti.minutesAria).fill("0");
  await page.getByRole("textbox", { name: f.avgPower, exact: true }).fill("0,10");
  await page.getByRole("textbox", { name: f.tariff, exact: true }).fill("1");
  await page.getByLabel(f.machineValue).fill("4000");
  // 016/US8 — machineLifetime only renders (in "ajustar" mode). The seed (3600h) IS a ritmo ×
  // payback product now (016/PR-C homologação B1), so the form opens in RITMO mode — "Ajustar
  // horas direto" reveals the raw hours field this canonical vector needs to type 2000 into.
  // 019/PR-C (T057) — o par de botões virou o segmented "Estimar · Ajustar" (prancheta 15a).
  await page
    .getByTestId("machine-mode")
    .getByRole("radio", { name: messages.calculator.machineCost.ajustar })
    .click();
  await page.getByRole("textbox", { name: f.machineLifetime, exact: true }).fill("2000");
  // failure/finishTime/finishRate are OPTIONAL fields — their accessible name carries the "opcional"
  // suffix (field.tsx), so `exact` would miss them; role alone already excludes the tip's button.
  await page.getByRole("textbox", { name: f.failure }).fill("10");
  await page.getByRole("textbox", { name: f.finishTime }).fill("0,5");
  await page.getByRole("textbox", { name: f.finishRate }).fill("10");
  await page.getByLabel(f.markupVarejo).fill("50");
  await page.getByLabel(f.markupAtacado).fill("30");

  // 019/PR-F (T142, adoção) — a linha de derivação "Preço varejo"/"Preço atacado" SAIU da conta
  // (10a); o cartão final agora quebra o valor em spans (R$/inteiro/decimais), então um
  // `getByText` de string exata não o vê mais — `.first()` continua certo (o canal AMAZON
  // pré-precificado do 015/A11 ainda ecoa o varejo na sua linha "Recebido líquido", e o atacado
  // continua na linha-resumo), mas a asserção precisa tolerar a falta de espaço entre "R$" e o
  // número dentro do cartão (regex, não string).
  await expect(page.getByText("R$ 27,55")).toBeVisible(); // custo_total breakdown row
  await expect(page.getByText(/R\$\s*41,33/).first()).toBeVisible(); // varejo (cartão ou canal)
  await expect(page.getByText(/R\$\s*35,82/).first()).toBeVisible(); // atacado (linha-resumo)

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
  await page
    .getByRole("textbox", { name: messages.calculator.fields.grams, exact: true })
    .fill("100");
  // With the remaining pre-filled defaults (5 h · 0,12 kW · tarifa 1 · máquina 4000/3600 h —
  // 016/PR-C homologação B1) this yields custo_total R$ 16,16 → varejo R$ 24,24.
  await expect(page.getByText(/R\$\s*24,24/).first()).toBeVisible(); // 019/PR-F (T142, adoção) — cartão em spans, regex tolera a falta de espaço

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
  await page.getByRole("textbox", { name: t.fields.grams, exact: true }).fill("100");
  // 015/A11 — `.first()` porque o valor aparece DUAS vezes, e a segunda e aritmetica do modelo, nao
  // duplicacao: com o padrao AMAZON o canal e precificado, e o LIQUIDO RECEBIDO no canal e por
  // construcao igual ao preco de varejo — e exatamente o alvo do gross-up. A derivacao vem antes no
  // DOM (o proprio componente diz "shown BEFORE the suggested prices"), entao `.first()` e ela.
  // 016/PR-C homologação B1 — seed custo_total R$ 16,16 / varejo R$ 24,24 (machine 4000/3600h).
  await expect(page.getByText("R$ 16,16")).toBeVisible(); // custo_total breakdown row (seed)
  await expect(page.getByText(/R\$\s*24,24/).first()).toBeVisible(); // 019/PR-F (T142, adoção) — cartão em spans, regex tolera a falta de espaço

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
}, info) => {
  const t = messages.calculator;
  // 016/US11 — the retry notice lives inside the entitled branch of MarketplaceSection now.
  const email = await signUpThrowaway(page, `calc-refresh-${info.workerIndex}`);
  grantPremium(email);
  // Force the online catalog refresh to fail; a later retry succeeds.
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
  await page.getByRole("textbox", { name: t.fields.grams, exact: true }).fill("100");
  // 016/PR-C homologação B1 — seed varejo R$ 24,24.
  await expect(page.getByText(/R\$\s*24,24/).first()).toBeVisible(); // 019/PR-F (T142, adoção) — cartão em spans, regex tolera a falta de espaço

  // Retry now succeeds → the notice clears (the served catalog is adopted).
  failFetch = false;
  await page.getByRole("button", { name: t.channels.refreshRetry }).click();
  await expect(page.getByText(t.channels.refreshErrorTitle)).toHaveCount(0);
});

test("FULL US1–US5 model has no horizontal overflow at 390px (T040, FR-010)", async ({
  page,
}, info) => {
  const t = messages.calculator;
  // 016/US11 (T044 homologação, correção) — the abort has to be registered BEFORE
  // `signUpThrowaway`, not after: that helper's OWN navigation (to /sign-in, then the auto-redirect
  // to "/" once signed up) already mounts the calculator and fetches the fee-catalog. Registering
  // the route AFTER it left that first fetch unintercepted, so the SERVED catalog got fetched and
  // PERSISTED to the client store (ADR-0010's cache) before this test's own goto ever ran — the
  // subsequent abort then only blocked a re-fetch, while the persisted store (now holding real
  // Shopee/Amazon data, newer than the seed) kept answering every render. This test's premise is
  // the SEED reference (embedded seal); the route must be live from the very first navigation.
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  const email = await signUpThrowaway(page, `calc-overflow-${info.workerIndex}`);
  grantPremium(email);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Build the COMPLETE 005 surface: labor (US4-004), several long-named sub-costs incl. an inline
  // error (US5), a manual-fee channel + a Shopee catalog-prefilled channel with its long seal and
  // voucher line (US1/US2), and every gross-up row rendered — then assert no h-scrollbar anywhere.
  // 016/US6 — both are tipped + OPTIONAL (see the canonical-vector test above): role alone
  // disambiguates from the tip's button, and non-exact absorbs the "opcional" suffix.
  await page.getByRole("textbox", { name: t.fields.laborHours }).fill("2");
  await page.getByRole("textbox", { name: t.fields.laborRate }).fill("30");

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
  await slot1.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");

  // 019/PR-F (T142, adoção) — o `<Segmented split>` Varejo|Atacado agora governa qual nível cada
  // marketplace mostra; um cartão por canal, UM nível por vez (default varejo).
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2); // 2 channels × 1 level
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
}, info) => {
  const t = messages.calculator;
  const email = await signUpThrowaway(page, `calc-multi-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // The default channel (Mercado Livre) — give it a fee so its "Preços por canal" rows render.
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("12");
  await slot0.getByLabel(t.channels.fixedFee).fill("6,75");

  // Add a 2nd channel, make it Shopee with its own fee.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");
  await slot1.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await slot1.getByLabel(t.channels.fixedFee).fill("4");

  // Both channels compute together: each shows anúncio + líquido for the SELECTED level (019/PR-F,
  // T142 adoção — o Segmented Varejo|Atacado troca as duas, nunca mostra as duas juntas; default
  // varejo ⇒ 2 canais × 1 nível = 2 linhas, não mais as 4 de antes).
  await expect(page.getByTestId("channel-price")).toHaveCount(2);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2);
  await expect(page.getByText(t.results.recebidoLiquido)).toHaveCount(2);

  // Remove the Shopee slot → only its rows drop; Mercado Livre keeps computing.
  await slot1.getByRole("button", { name: t.channels.removeChannel }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(1);

  // Re-add Shopee, then set Mercado Livre's commission to 100% — it errors ONLY its slot.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const shopee = page.getByTestId("channel-slot").nth(1);
  await shopee.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");
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
}, info) => {
  const t = messages.calculator;
  const seals = t.seals;
  // 016/US11 (T044 homologação, correção) — same ordering defect as the overflow test above: the
  // abort MUST be live before `signUpThrowaway`'s own first navigation, or that navigation fetches
  // and PERSISTS the served catalog before this test's premise (the bundled seed) ever applies.
  // Premise: no served catalog → bundled-seed fallback (the embedded seal). Abort the fetch since
  // the E2 e2e stack now runs a real backend.
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  const email = await signUpThrowaway(page, `calc-seal-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);

  // 015/A11 — the default channel is AMAZON (not Mercado Livre; the comment below predates that
  // change), which is likewise NOT curated in the SEED (only Shopee is) → the slot honestly reads
  // "sem referência", never a fabricated number.
  await expect(slot0.getByTestId("fee-seal")).toContainText(seals.none);

  // Switch it to Shopee (price-band curated). With the fee fields left BLANK the model pre-fills
  // from the catalog and the channel computes — the seal states the numbers came from a reference.
  // No backend runs in e2e (vite preview only) → the store falls back to the bundled seed, so the
  // reference is the offline-embedded one.
  await slot0.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");
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
}, info) => {
  const t = messages.calculator;
  const email = await signUpThrowaway(page, `calc-longseal-${info.workerIndex}`);
  grantPremium(email);
  // Serve the committed catalog so the store's active source becomes "catalog" (not the seed) → the
  // slot shows the FULL online reference seal ("Referência: <long source> · atualizada em …"), the
  // ~850px string the homologation caught overflowing. Intercept before load (the fetch is on mount).
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");

  // The online reference seal (long) renders — proving the source is the served catalog, not the seed.
  const seal = slot0.getByTestId("fee-seal");
  // 019/PR-C (T058, prancheta 13a) — o rótulo nomeia o NÚMERO que o selo respalda ("Comissão"),
  // nunca "Referência"; a citação (a fonte longa) continua no corpo.
  await expect(seal).toContainText(t.seals.commissionLabel); // "Comissão"
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
}, info) => {
  const t = messages.calculator;
  const email = await signUpThrowaway(page, `calc-picker-frame-${info.workerIndex}`);
  grantPremium(email);
  // A espinha de categorias viaja no catálogo SERVIDO (a semente empacotada não a carrega) e hoje só
  // a Amazon publica uma — servir o catálogo committed é o que faz o seletor existir na tela.
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace, { exact: true }).selectOption("AMAZON");

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
}, info) => {
  const t = messages.calculator;
  const email = await signUpThrowaway(page, `calc-toggle-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
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

// 016/US11 (T044/PR-E sweep) — SC-109's "never a bad number, no paywall" claim SPLIT in two, because
// marketplace pricing itself became the paywalled surface (FR-915): what free still gets is the
// sub-costs slot with no bad numbers and the marketplace GATE (never partial channel machinery);
// what premium gets is the full multi-channel mechanics SC-109 originally exercised together. The
// `PRICING_MODEL_VERSION === "3.0.0"` half of SC-109 is pinned at the source in pricing-core's
// version.test.ts; "backend does no price compute" is proven behaviorally by the offline test below.
test("US6 (free/signed-out): sub-costs surface has no bad numbers; the marketplace GATE closes, never a partial channel (SC-109)", async ({
  page,
}) => {
  const t = messages.calculator;
  await page.goto("/calcular"); // public — no sign-in, no wall
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Itemized sub-costs: a named one and a BLANK-named one (falls back to the neutral label).
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRows = page.getByTestId("other-cost-row");
  await costRows.nth(0).getByLabel(t.outrosCustos.name).fill("Embalagem");
  await costRows.nth(0).getByLabel(t.outrosCustos.value).fill("3,00");
  await costRows.nth(1).getByLabel(t.outrosCustos.value).fill("1,005"); // rounds HALF_UP → 1,01

  await expect(page.getByText("Embalagem", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 1,01")).toBeVisible(); // the HALF_UP-rounded blank-named line
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();
  await expect(page.getByText(/NaN|Infinity|#DIV/)).toHaveCount(0);

  // The marketplace section is the GATE, never a partial/collapsed channel surface: disabled+off
  // switch, zero channel slots, zero "Preços por canal", the subscribe path visible.
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).toBeDisabled();
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).not.toBeChecked();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByText(t.channels.pricesTitle)).toHaveCount(0);
  await expect(page.getByText(t.channels.premiumOnly)).toBeVisible();

  // No save/export/history affordance appears on the free calculator; the freemium note is an
  // honest statement, not a CTA. (016/US2: the bottom-nav "Orçamentos" LINK — was "Histórico" — is
  // the app shell placeholder, not a calculator affordance — the assertion targets buttons.)
  await expect(
    page.getByRole("button", { name: /salvar|exportar|histórico|desbloquear/i }),
  ).toHaveCount(0);
  await expect(page.getByText(t.freemiumNote)).toBeVisible();
});

test("US6 (premium): full multi-channel + sub-costs surface — no bad numbers, toggle exercised", async ({
  page,
}, info) => {
  const t = messages.calculator;
  const email = await signUpThrowaway(page, `calc-full-premium-${info.workerIndex}`);
  grantPremium(email);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Channel 1 (default Amazon slot): manual fees, including a HIGH commission (95% — a valid but
  // extreme gross-up whose denominator 0,05 amplifies any float slip into a visible bad number).
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("95");
  await slot0.getByLabel(t.channels.fixedFee).fill("10");

  // Channel 2: Shopee with BLANK fees → the seed catalog pre-fills bands + voucher (the offline
  // reference path), so both fee models (manual + curated bands) compute side by side.
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");

  // Itemized sub-costs: a named one and a BLANK-named one (falls back to the neutral label).
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRows = page.getByTestId("other-cost-row");
  await costRows.nth(0).getByLabel(t.outrosCustos.name).fill("Embalagem");
  await costRows.nth(0).getByLabel(t.outrosCustos.value).fill("3,00");
  await costRows.nth(1).getByLabel(t.outrosCustos.value).fill("1,005"); // rounds HALF_UP → 1,01

  // Everything computes together: both channels price the SELECTED markup level (019/PR-F, T142
  // adoção — Segmented default varejo ⇒ 2×1 anúncio rows, not the old 2×2 side by side).
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2);
  await expect(page.getByText("Embalagem", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 1,01")).toBeVisible(); // the HALF_UP-rounded blank-named line

  // Exercise the toggle across the full surface: off hides the channels (headline intact)…
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(0);
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();
  // …and back on restores BOTH slots with their fees/prefill intact (RHF state survives).
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  await expect(page.getByText(t.results.precoAnuncio)).toHaveCount(2);

  // SC-109's numeric half still holds for the full premium surface: never a NaN/Infinity/#DIV!.
  await expect(page.getByText(/NaN|Infinity|#DIV/)).toHaveCount(0);
});

// US6 (T038): the FULL 005 surface computes OFFLINE from the bundled seed — channels (manual fees +
// Shopee catalog pre-fill), the toggle, and sub-costs — with the failed catalog refresh staying
// non-blocking and nothing gating on the network. 016/US11 — marketplace pricing is Premium now, and
// the entitlement gate itself has to survive offline: the account signs in + is granted premium
// ONLINE first, which lets the entitlement query's answer persist to the uid-keyed device cache
// (009/T011b) — that persisted `active` is what the offline gate reads, never a guessed default.
test("US6: offline + premium — channels, toggle and sub-costs all compute from the seed (SC-109)", async ({
  page,
  context,
}, info) => {
  const t = messages.calculator;
  // 016/US11 (T044 homologação, correção) — the abort must be live BEFORE `signUpThrowaway`'s own
  // first navigation (to /sign-in, then the auto-redirect to "/"): that redirect already mounts the
  // calculator and fetches fee-catalog, and registering the route only after it left that first
  // fetch unintercepted — the SERVED catalog got persisted to the client store before this test's
  // seed premise ever applied, which is exactly what surfaced as "the wrong seal" downstream.
  // Premise: the BUNDLED SEED answers offline (embedded seal). Abort the served-catalog fetch so
  // the online pre-load never persists a fresher store (the E2 e2e stack runs a real backend).
  await page.route("**/api/v1/fee-catalog", (route) => route.abort());
  const email = await signUpThrowaway(page, `calc-offline-${info.workerIndex}`);
  grantPremium(email);
  // Load online once so the SW precaches AND the entitlement query persists `active` to the device
  // cache, then go fully offline.
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).toBeEnabled();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });
  await context.setOffline(true);
  await page.reload(); // served from the SW precache; entitlement answers from the persisted cache

  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  // The gate itself survives offline — the switch is still enabled (the persisted `active` answer,
  // not a network-dependent guess).
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).toBeEnabled();

  // The catalog refresh fails offline → the US3 notice appears but blocks NOTHING.
  await expect(page.getByText(t.channels.refreshErrorTitle)).toBeVisible();

  // Manual channel fee → gross-up computes locally (016/PR-C B1 seed varejo 24,24 @20% + R$0 → 30,30).
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("20");
  await expect(page.getByText("R$ 30,30")).toBeVisible();

  // Shopee pre-fills from the BUNDLED SEED while offline (the honesty seal says so).
  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace, { exact: true }).selectOption("SHOPEE");
  await expect(slot1.getByTestId("fee-seal")).toContainText(t.seals.embedded);

  // Sub-cost folds into custo_total offline (016/PR-C B1 seed 16,16 + 3,00 = 19,16).
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  const costRow = page.getByTestId("other-cost-row").first();
  await costRow.getByLabel(t.outrosCustos.name).fill("Embalagem");
  await costRow.getByLabel(t.outrosCustos.value).fill("3,00");
  await expect(page.getByText("R$ 19,16")).toBeVisible();

  // The toggle works offline too: off → channels gone, direct headline intact.
  await page.getByRole("switch", { name: t.channels.includeToggle }).click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();

  // Offline the whole way: no bad numbers.
  await expect(page.getByText(/NaN|Infinity|#DIV/)).toHaveCount(0);

  await context.setOffline(false);
});

// 015/A8 ([F11a-003]) — a promessa esta na PRIMEIRA DOBRA, e isto e uma assercao de POSICAO.
//
// A auditoria mediu a frase a 3.413px de uma pagina de 3.529 — 97% da altura, 4,6 telas de rolagem
// a 360px — e observou que o teste que a cobria usava `toBeInTheDocument()`: PRESENCA, nao posicao.
// E a licao da US4 outra vez: uma assercao de presenca nao sabe nada sobre onde a coisa esta, e
// "onde" era exatamente o defeito. Um `toBeVisible()` tambem nao bastaria — o Playwright considera
// visivel o que esta abaixo da dobra.
test("a promessa 'é grátis' está na primeira dobra, não no rodapé (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/calcular");
  const promessa = page.getByText(messages.calculator.freemiumNote);
  await expect(promessa).toBeVisible();

  const y = await promessa.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { topo: r.top + window.scrollY, altura: document.documentElement.scrollHeight };
  });

  // Guarda de nao-vacuidade: se a pagina encolher a ponto de caber numa dobra, este teste passaria
  // sem provar nada sobre POSICAO.
  expect(y.altura, "a pagina precisa ser rolavel para a assercao significar algo").toBeGreaterThan(
    800 * 2,
  );
  expect(
    y.topo,
    `a promessa esta a ${Math.round(y.topo)}px de ${y.altura}px — fora da primeira dobra`,
  ).toBeLessThan(800);
});
