import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 016/PR-B (US4/T012) — the desktop layout geometry: A6 measured the calculator's own content
// at ~37% of the shell's main content area at 1440px ([F11a-005]); SC-903 sets the floor at
// ≥60%. This spec was RED before any CSS existed here — no `.tf-calc-grid`, so `.tf-calc-page`
// (still `max-w-md`, 448px) rendered at a fixed 448/~1200 ≈ 37%, matching the audit's finding
// almost exactly. The guard [F11a-002] (a price card never scrolls internally / never breaks a
// number mid-digit) FIRES here too, at 360/390/1440, with an adversarial six-figure price — the
// scroll must disappear because the page got WIDER, never because this guard was loosened.

const t = messages.calculator;

async function fillNumeric(page: Page, label: RegExp | string, value: string): Promise<void> {
  // Playwright's `.fill()` drives the input through real DOM input events (unlike a raw
  // `el.value = x` from `page.evaluate`, which React's controlled inputs never observe) — the
  // same pattern already proven across this suite (a11y-overflow.spec.ts et al.).
  // 016/US6 (FR-908) — `getByLabel` matches by SUBSTRING across every role, so a tipped field's
  // "Sobre …" InfoTip trigger (an aria-labelled button) collides with the plain field label. All
  // three call sites here are REQUIRED fields (no "opcional" suffix), so `exact` on the textbox
  // role is safe and excludes the tip's button (the same fix `calculator.spec.ts` already needed).
  await page.getByRole("textbox", { name: label, exact: true }).fill(value);
}

/** Drives an adversarial six-figure price (the "R$ 95.057-classe" input the brief names): a
 *  costly filament near a full roll, with a steep markup. Mirrors a11y-overflow.spec.ts's own
 *  "realistic maximum" combo so both guards stress the same class of number. */
async function fillAdversarialPrice(page: Page): Promise<void> {
  await fillNumeric(page, t.fields.costPerRoll, "99999");
  await fillNumeric(page, t.fields.grams, "950");
  await fillNumeric(page, t.fields.markupVarejo, "900");
}

async function priceCardGeometry(page: Page): Promise<{
  lineBoxes: number;
  amountOverflow: number;
  amountOverflowY: number;
  text: string;
}> {
  const int = page.locator(".tf-price__int").first();
  await expect(int).toBeVisible();
  return int.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const amount = el.closest(".tf-price__amount");
    return {
      lineBoxes: range.getClientRects().length,
      text: (el.textContent ?? "").trim(),
      amountOverflow: amount ? amount.scrollWidth - amount.clientWidth : 0,
      // 016/T018-A2 — o eixo do DEFEITO REAL do item 9 é o VERTICAL: `overflow-x: auto` faz o
      // overflow-y computar `auto`, e um conteúdo 4px mais alto que a caixa (line-height: 1)
      // renderiza a barra clássica de 15px em Chromium HEADED (o ambiente do dono) — invisível
      // em headless, que desenha overlay. A guarda só media X, e 112/112 e2e ficaram verdes com
      // a barra da foto do dono na tela. scrollHeight é medível em headless; a barra não é.
      amountOverflowY: amount ? amount.scrollHeight - amount.clientHeight : 0,
    };
  });
}

async function assertNoPriceCardScrollOrBreak(page: Page, label: string): Promise<void> {
  const geo = await priceCardGeometry(page);
  expect(
    geo.amountOverflowY,
    `${label}: price "${geo.text}" overflows vertically by ${geo.amountOverflowY}px (headed Chromium renders a 15px scrollbar here)`,
  ).toBeLessThanOrEqual(0);
  // Non-vacuity: prove the price actually stressed the layout (six digits), not a coincidence.
  expect(
    geo.text.replace(/\D/g, "").length,
    `${label}: expected a six-figure price, got "${geo.text}"`,
  ).toBeGreaterThanOrEqual(6);
  expect(geo.lineBoxes, `${label}: price "${geo.text}" split across ${geo.lineBoxes} lines`).toBe(
    1,
  );
  expect(
    geo.amountOverflow,
    `${label}: price "${geo.text}" scrolls internally by ${geo.amountOverflow}px`,
  ).toBeLessThanOrEqual(0);
}

test.describe("calculator desktop layout — geometry (016/US4, SC-903)", () => {
  test("at 1440px the calculator's own content is ≥60% of the shell's main content area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

    const widths = await page.evaluate(() => {
      const main = document.querySelector(".tf-shell__main");
      const calc = document.querySelector('[data-testid="calc-content"]');
      if (!main || !calc) return null;
      return {
        main: main.getBoundingClientRect().width,
        calc: calc.getBoundingClientRect().width,
      };
    });
    expect(
      widths,
      "expected both .tf-shell__main and [data-testid=calc-content] in the DOM",
    ).not.toBeNull();
    const ratio = widths!.calc / widths!.main;
    expect(
      ratio,
      `content used ${widths!.calc}px of ${widths!.main}px main (${(ratio * 100).toFixed(1)}%)`,
    ).toBeGreaterThanOrEqual(0.6);
  });

  test("at 1440px the price cards never scroll internally with an adversarial price", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    await fillAdversarialPrice(page);
    await assertNoPriceCardScrollOrBreak(page, "1440px");

    // The document itself never grows a horizontal scrollbar either — a wide grid that leaks
    // past the viewport would trade one overflow for another.
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow, `document horizontal overflow at 1440px: ${overflow}px`).toBeLessThanOrEqual(
      1,
    );
  });

  // 015/A6's own lesson, re-checked here: 360 AND 390, never just one. Nothing in this PR
  // touches the mobile breakpoint's CSS, but the guard is cheap and the class of regression
  // (a grid rule with no upper media-query bound leaking into mobile) is exactly the kind a
  // desktop-only manual check would miss.
  for (const width of [360, 390]) {
    test(`at ${width}px nothing regresses: single column, no price-card scroll/break`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      await fillAdversarialPrice(page);
      await assertNoPriceCardScrollOrBreak(page, `${width}px`);

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `document horizontal overflow at ${width}px: ${overflow}px`).toBe(0);
    });
  }
});

// 016/PR-C homologação (B3) — the machine-cost ritmo/payback select pair. The seed
// (machineLifetimeHours=3600) nasce em modo RITMO, so both selects render without interaction.
// The floor is the SELECT's own rendered width against what its currently-selected OPTION text
// needs — a native <select>'s visible box (not the popup list) truncates when narrower than its
// own selected text, which is exactly what the qa screenshot showed ("Quase todo ▾").
test.describe("calculator desktop layout — o bloco da máquina (016/PR-C homologação B3)", () => {
  for (const width of [360, 390, 1440]) {
    test(`at ${width}px nenhum select do bloco da máquina fica mais estreito que sua opção`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

      const ritmo = page.getByRole("combobox", { name: t.machineCost.ritmoLabel });
      const payback = page.getByRole("combobox", { name: t.machineCost.paybackLabel });
      await expect(ritmo).toBeVisible();
      await expect(payback).toBeVisible();

      for (const [name, select] of [
        ["ritmo", ritmo],
        ["payback", payback],
      ] as const) {
        const geo = await select.evaluate((el: HTMLSelectElement) => {
          const selected = el.options[el.selectedIndex]?.text ?? "";
          // A canvas 2D context measures the SAME text the <select> itself renders (font
          // inherited from `.tf-input`), independent of the native OS chrome the box draws
          // around it — the measured floor a real screenshot can't give a headless run.
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          const cs = getComputedStyle(el);
          ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const textWidth = ctx.measureText(selected).width;
          return { clientWidth: el.clientWidth, textWidth, selected };
        });
        // The box must fit the text plus the caret + padding this DS always reserves
        // (select.css: `--space-5` right padding for the caret, `--space-4` left — ~40px total).
        const CARET_AND_PADDING = 40;
        expect(
          geo.clientWidth,
          `${width}px ${name} select "${geo.selected}" needs ≈${Math.ceil(geo.textWidth + CARET_AND_PADDING)}px, has ${geo.clientWidth}px`,
        ).toBeGreaterThanOrEqual(geo.textWidth + CARET_AND_PADDING);
      }
    });
  }
});

// 016/PR-C homologação (B4) — every REQUIRED, pre-filled numeric input in "Custos da peça" (incl.
// the machine-cost value + the h/min printTime pair) must show its whole value — never scrolled/
// clipped, the "R$ 1px" the qa found on Tarifa de energia at 360px (and a pre-existing 3px cut at
// 360px even without the ⓘ, per the qa's own counterfactual).
test.describe("calculator desktop layout — os inputs obrigatórios pré-preenchidos (016/PR-C homologação B4)", () => {
  const REQUIRED_PREFILLED_LABELS = [
    t.fields.costPerRoll,
    t.fields.rollWeight,
    t.fields.grams,
    t.fields.avgPower,
    t.fields.tariff,
    t.fields.machineValue,
    t.timeInput.hoursAria,
    t.timeInput.minutesAria,
  ];

  for (const width of [360, 390, 1440]) {
    test(`at ${width}px nenhum valor pré-preenchido é cortado (clientWidth ≥ scrollWidth)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

      for (const label of REQUIRED_PREFILLED_LABELS) {
        const input = page.getByRole("textbox", { name: label, exact: true }).first();
        await expect(input).toBeVisible();
        const geo = await input.evaluate((el: HTMLInputElement) => ({
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          value: el.value,
        }));
        // A 1px deficit here is flex sub-pixel rounding (clientWidth truncates, scrollWidth's
        // content box does not) — measured on boxes 143–213px wide holding a 4-char value; a REAL
        // clip (the bug: 1px of TOTAL box width) is nowhere near this margin, so a ≤1px tolerance
        // cannot hide it while still absorbing the rounding artefact.
        expect(
          geo.clientWidth,
          `${width}px "${label}" = "${geo.value}" is clipped: clientWidth ${geo.clientWidth}px < scrollWidth ${geo.scrollWidth}px`,
        ).toBeGreaterThanOrEqual(geo.scrollWidth - 1);
      }
    });
  }
});

// hotfix 016/A2 (H2c, 2026-08-07) — the freight-subsidy legend under the Shopee "Frete" field is
// a NEW paragraph on the channel slot, dirigido pelo dado (`freightSubsidyInfo`) — the exact class
// of addition 015/A6/016 keep catching mid-viewport: prose that wraps fine at 1440px and forces
// horizontal scroll at 360px. "Dois temas, sem transbordo a 360" (o desenho, §3).
test.describe("calculator — a legenda do subsídio de frete Shopee não transborda (016/A2 H2c)", () => {
  const t2 = messages.calculator.channels;

  for (const width of [360, 390]) {
    test(`at ${width}px a legenda aparece e o documento não tem overflow horizontal`, async ({
      page,
    }, info) => {
      const email = await signUpThrowaway(page, `calc-layout-freight-${width}-${info.workerIndex}`);
      grantPremium(email);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/calcular");
      await page.reload();
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

      const slot0 = page.getByTestId("channel-slot").first();
      await slot0.getByLabel(t2.marketplace, { exact: true }).selectOption("SHOPEE");

      const legend = page.getByTestId("freight-subsidy-info");
      await expect(legend).toBeVisible();

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `document horizontal overflow at ${width}px: ${overflow}px`).toBe(0);
    });
  }
});

// 019/PR-F (T142/T143, prancheta 10 — "Calculadora - A Conta e os Preços") — o rodapé redesenhado:
// a conta termina no custo total, o `<Segmented split>` Varejo|Atacado governa um preço grande por
// vez, e "Preços por marketplace" vira seção própria. Este bloco cobre a 10b (seis dígitos, sem
// transbordo nos dois eixos, 360/390/1280/1920) e a 10d (720px centralizado a 1280).

/** 10b — o preço que já quebrou no meio do dígito neste projeto (`950.096` em duas linhas a
 *  360px, 015/A6). Material sozinho (energia/máquina/mão de obra/acabamento/falha zerados) com
 *  markup 0% imprime EXATAMENTE R$ 950.096,00 no cartão grande — não um six-digit qualquer, o
 *  mesmo número da prancheta (rollWeightKg=1kg, 1000 g = o rolo inteiro, custo do rolo =
 *  950096,00 ⇒ material = custo_total = preço). */
async function fillSixDigitPrice(page: Page): Promise<void> {
  await fillNumeric(page, t.fields.costPerRoll, "950096");
  await fillNumeric(page, t.fields.grams, "1000");
  await fillNumeric(page, t.fields.avgPower, "0");
  await fillNumeric(page, t.fields.machineValue, "0");
  await fillNumeric(page, t.fields.markupVarejo, "0");
}

async function heroGeometry(page: Page): Promise<{
  text: string;
  cardOverflowX: number;
  cardOverflowY: number;
  amountOverflowX: number;
  amountOverflowY: number;
}> {
  const card = page.getByTestId("price-hero");
  await expect(card).toBeVisible();
  return card.evaluate((el) => {
    const amount = el.querySelector(".tf-price__amount") as HTMLElement | null;
    return {
      text: (amount?.textContent ?? "").trim(),
      cardOverflowX: el.scrollWidth - el.clientWidth,
      cardOverflowY: el.scrollHeight - el.clientHeight,
      amountOverflowX: amount ? amount.scrollWidth - amount.clientWidth : 0,
      amountOverflowY: amount ? amount.scrollHeight - amount.clientHeight : 0,
    };
  });
}

test.describe("calculator — o rodapé redesenhado (019/PR-F, T142/T143, prancheta 10)", () => {
  for (const width of [360, 390, 1280, 1920]) {
    test(`at ${width}px o preço de seis dígitos (R$ 950.096,00, 10b) não transborda em nenhum eixo`, async ({
      page,
    }, info) => {
      const email = await signUpThrowaway(page, `calc-layout-rodape-${width}-${info.workerIndex}`);
      grantPremium(email);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/calcular");
      await page.reload();
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      await fillSixDigitPrice(page);

      const geo = await heroGeometry(page);
      // Non-vacuidade: prova que o preço realmente estressou a caixa (o número da prancheta),
      // não um six-digit qualquer.
      expect(geo.text, `esperava R$ 950.096,00, veio "${geo.text}"`).toContain("950.096");
      expect(
        geo.cardOverflowX,
        `${width}px: o cartão do preço transborda X em ${geo.cardOverflowX}px`,
      ).toBeLessThanOrEqual(0);
      expect(
        geo.cardOverflowY,
        `${width}px: o cartão do preço transborda Y em ${geo.cardOverflowY}px`,
      ).toBeLessThanOrEqual(0);
      expect(
        geo.amountOverflowX,
        `${width}px: o número transborda X em ${geo.amountOverflowX}px`,
      ).toBeLessThanOrEqual(0);
      expect(
        geo.amountOverflowY,
        `${width}px: o número transborda Y em ${geo.amountOverflowY}px`,
      ).toBeLessThanOrEqual(0);

      const docOverflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(
        docOverflow,
        `${width}px: o documento transborda horizontalmente em ${docOverflow}px`,
      ).toBeLessThanOrEqual(1);
    });
  }

  test("at 1280px o bloco de resultado atravessa as duas colunas do formulário, ≤720px e centralizado (10d)", async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `calc-layout-rodape-1280-centro-${info.workerIndex}`);
    grantPremium(email);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/calcular");
    await page.reload();
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    await fillSixDigitPrice(page);

    const geo = await page.evaluate(() => {
      const hero = document.querySelector('[data-testid="price-hero"]') as HTMLElement;
      // `PriceResults` é um Fragment (T142): o wrapper que envolve o cartão + a linha-resumo é
      // um FILHO DIRETO de `.tf-calc-footer` — exatamente o seletor que `calculator-form.css`
      // usa para o teto de 720px (`.tf-calc-footer > *`) e para a centralização
      // (`.tf-calc-footer { align-items: center }`).
      const wrapper = hero.parentElement as HTMLElement;
      const footer = document.querySelector(".tf-calc-footer") as HTMLElement;
      const w = wrapper.getBoundingClientRect();
      const f = footer.getBoundingClientRect();
      return {
        width: w.width,
        wrapperCenter: w.left + w.width / 2,
        footerCenter: f.left + f.width / 2,
      };
    });
    expect(
      geo.width,
      `o bloco de resultado tem ${geo.width}px, esperado ≤720px`,
    ).toBeLessThanOrEqual(721);
    expect(
      Math.abs(geo.wrapperCenter - geo.footerCenter),
      "o bloco de resultado não está centralizado no rodapé",
    ).toBeLessThanOrEqual(2);
  });
});

// ---- Evidência 1:1 do rodapé (T143) — só roda com PORTE_SCREENSHOTS=1; molde
// `porte-screenshots-pr-d.spec.ts` (mesma disciplina: deviceScaleFactor 1, animations disabled,
// medidas-pr-f.json FUNDIDO no afterAll — nunca sobrescrito, a armadilha da PR-C). ----------------

const EVIDENCE_OUT = fileURLToPath(
  new URL("../../../../specs/019-porte-design/evidencias/pr-f/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;

test.describe("PR-F — evidência 1:1 do rodapé (T143)", () => {
  test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
  test.use({ deviceScaleFactor: 1 });

  async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((th) => {
      document.documentElement.dataset.theme = th;
    }, theme);
  }

  const medidas: Record<string, unknown> = {};
  async function shot(page: Page, chave: string): Promise<void> {
    // O rodapé (10a) fica ABAIXO da dobra em todas as larguras que este bloco captura — sem rolar
    // até o `price-hero`, `page.screenshot()` (viewport, não `fullPage`) fotografa só "Custos da
    // peça" no topo, achado no PRIMEIRO run (rodape-390-dark.png mostrava o formulário, não a
    // conta). `scrollIntoViewIfNeeded` é o mesmo padrão do molde `porte-screenshots-pr-d.spec.ts`.
    await page.getByTestId("price-hero").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(EVIDENCE_OUT, `${chave}.png`), animations: "disabled" });
    medidas[chave] = {
      viewport: page.viewportSize(),
      overflowX: await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    };
  }

  test.beforeAll(() => mkdirSync(EVIDENCE_OUT, { recursive: true }));
  test.afterAll(() => {
    const path = join(EVIDENCE_OUT, "medidas-pr-f.json");
    let prev: Record<string, unknown>;
    try {
      prev = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    } catch {
      prev = {};
    }
    writeFileSync(path, JSON.stringify({ ...prev, ...medidas }, null, 2) + "\n");
  });

  for (const width of [360, 390, 1280, 1920]) {
    for (const theme of THEMES) {
      test(`rodape-${width}-${theme}`, async ({ page }, info) => {
        const email = await signUpThrowaway(
          page,
          `pr-f-rodape-${width}-${theme}-${info.workerIndex}`,
        );
        grantPremium(email);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
        await setTheme(page, theme);
        await shot(page, `rodape-${width}-${theme}`);
      });
    }
  }

  for (const theme of THEMES) {
    test(`rodape-atacado-390-${theme}`, async ({ page }, info) => {
      const email = await signUpThrowaway(page, `pr-f-atacado-${theme}-${info.workerIndex}`);
      grantPremium(email);
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/calcular");
      await page.reload();
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      const slot0 = page.getByTestId("channel-slot").first();
      await slot0.getByLabel(/^Comissão(?! mínima)/).fill("20");
      await page
        .getByTestId("price-level-segmented")
        .getByRole("radio", { name: t.captions.atacado })
        .click();
      await setTheme(page, theme);
      await shot(page, `rodape-atacado-390-${theme}`);
    });

    test(`rodape-seis-digitos-360-${theme}`, async ({ page }, info) => {
      const email = await signUpThrowaway(page, `pr-f-seis-digitos-${theme}-${info.workerIndex}`);
      grantPremium(email);
      await page.setViewportSize({ width: 360, height: 900 });
      await page.goto("/calcular");
      await page.reload();
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      await fillSixDigitPrice(page);
      await setTheme(page, theme);
      await shot(page, `rodape-seis-digitos-360-${theme}`);
    });

    test(`rodape-sem-premium-390-${theme}`, async ({ page }, info) => {
      await signUpThrowaway(page, `pr-f-sem-premium-${theme}-${info.workerIndex}`);
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      await setTheme(page, theme);
      await shot(page, `rodape-sem-premium-390-${theme}`);
    });
  }
});
