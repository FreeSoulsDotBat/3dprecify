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
