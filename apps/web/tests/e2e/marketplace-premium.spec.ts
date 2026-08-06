import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 016/US11 (T044, FR-915, SC-908) — the marketplace-Premium turnstile against the REAL stack (the
// entitlement gate is server-derived, ADR-0012). NOTE (tasks.md path correction, same class as
// T041's) — the real e2e directory is `apps/web/tests/e2e/`, not `apps/web/e2e/`.
//
// Independent Test (spec §PR-E): grátis never obtains a channel number through ANY UI path — not the
// calculator, not a deep-link with channel state — while premium stays byte-identical (FR-919).

const t = messages.calculator;

test("free/signed-out: the marketplace switch is disabled+off, TeaserUpgrade is visible below it, and NO channel number ever renders", async ({
  page,
}) => {
  await page.goto("/calcular"); // public — no sign-in needed
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // Disabled AND unchecked — never the form's own default `includeMarketplace: true` reading as ON.
  const toggle = page.getByRole("switch", { name: t.channels.includeToggle });
  await expect(toggle).toBeDisabled();
  await expect(toggle).not.toBeChecked();

  // The subscribe path sits right below — visible, never hidden behind a click. 016/US11 (T044
  // homologação, correção) — scoped to the GATE: the calculator's catalog-picker teaser
  // (`premium-teaser`) legitimately shows its OWN "Assinar Premium" too (a different feature, the
  // US1 unified teaser), so an unscoped `page.getByRole("link", …)` is a strict-mode violation
  // over two REAL, distinct CTAs — neither is removed.
  const gate = page.getByTestId("marketplace-premium-gate");
  await expect(gate).toBeVisible();
  await expect(gate.getByText(t.channels.premiumOnly)).toBeVisible();
  await expect(gate.getByRole("link", { name: messages.billing.subscribeAction })).toBeVisible();

  // No channel machinery exists at all — no marketplace select, no "Adicionar canal", no
  // "Preços por canal", no fee-catalog seal.
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.channels.addChannel })).toHaveCount(0);
  await expect(page.getByText(t.channels.pricesTitle)).toHaveCount(0);
  await expect(page.getByTestId("fee-seal")).toHaveCount(0);

  // The direct varejo/atacado headline the free calculator has always shown is untouched.
  await expect(page.getByText(t.results.varejo).first()).toBeVisible();

  // Clicking the disabled switch does nothing (still off, no channel appears).
  await toggle.click({ force: true }).catch(() => {});
  await expect(toggle).not.toBeChecked();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
});

test("free signed-in (status=none) reads the exact same gate as signed-out", async ({
  page,
}, info) => {
  await signUpThrowaway(page, `mkt-free-${info.workerIndex}`); // no grantPremium — stays "none"
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const toggle = page.getByRole("switch", { name: t.channels.includeToggle });
  await expect(toggle).toBeDisabled();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(t.channels.premiumOnly)).toBeVisible();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
});

// US11-AC1 / the Edge Case named in the spec: a deep-link CANNOT hand a free account a channel
// number either. `/calcular` has no query-param channel state today (T052 confirms the section is
// entirely absent, not merely collapsed) — the honest proof is that even navigating straight in
// with the switch never rendered produces zero channel surface, matching the "no path" requirement.
test("deep-link straight into /calcular (no prior navigation): still zero channel surface for free", async ({
  page,
}) => {
  await page.goto("/calcular?channel=MERCADO_LIVRE&included=1");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: t.channels.includeToggle })).not.toBeChecked();
});

test("premium: the switch is enabled, defaults ON, and channel pricing is byte-identical to before the gate existed", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `mkt-premium-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const toggle = page.getByRole("switch", { name: t.channels.includeToggle });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(t.channels.premiumOnly)).toHaveCount(0);

  // The default Amazon channel slot prices exactly as it always has (016/PR-C B1 seed): 15%
  // catch-all commission over the seed's R$ 24,24 varejo grosses up to R$ 28,52.
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
  await expect(page.getByText(t.results.precoAnuncio).first()).toBeVisible();

  // Toggling off/on still works exactly as before the gate (US4, untouched for premium).
  await toggle.click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByTestId("channel-slot")).toHaveCount(1);
});

// 016/US11 (T044 homologação PR-E, BLOQUEADOR) — the exact repro measured: R$ 50 typed into "Frete"
// on Mercado Livre (whose plan shows it), then the slot switched to Amazon (whose plan does NOT
// show `freightCost`) — the field vanished from the screen but the −R$ 50 kept discounting the
// líquido ("Canal não-lucrativo", seal "ajustado por você"), a number that charges with no control
// naming it anywhere. The fix has two parts and this test proves BOTH: (1) the value itself is
// blanked on the interactive switch — never a hidden-but-alive number; (2) the render rule is
// value-aware, so a field that arrives with a value THROUGH A DIFFERENT PATH (never through
// `onMarketplaceChange` — a reopened scenario) still shows, editable/erasable, instead of vanishing.
test("premium: a hidden fee field never keeps charging — ML+Frete → Amazon blanks the field AND the value", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `mkt-leak-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const slot0 = page.getByTestId("channel-slot").first();
  await slot0.getByLabel(t.channels.marketplace).selectOption("MERCADO_LIVRE");
  await slot0.getByLabel(t.channels.freight).fill("50");
  await expect(slot0.getByLabel(t.channels.freight)).toHaveValue("50");

  // Switch to Amazon — freightCost is outside Amazon's feeAxes.
  await slot0.getByLabel(t.channels.marketplace).selectOption("AMAZON");

  // (a) The field is gone...
  await expect(slot0.getByLabel(t.channels.freight)).toHaveCount(0);
  // (b) ...and so is the DISCOUNT: no "Frete / cupom" deduction line, no "não-lucrativo" warning —
  // the exact symptoms the homologação measured (−R$ 50, líquido −R$ 25,76, the warning caption).
  await expect(page.getByText(t.channels.freightLine)).toHaveCount(0);
  await expect(page.getByText(t.channels.negativeLiquido)).toHaveCount(0);
  await expect(page.getByText(/−R\$\s*50,00/)).toHaveCount(0);

  // (c) Switching BACK to ML proves the value itself was blanked, not merely hidden — a hidden but
  // still-populated field would silently resurrect the R$ 50 the instant it renders again.
  await slot0.getByLabel(t.channels.marketplace).selectOption("MERCADO_LIVRE");
  await expect(slot0.getByLabel(t.channels.freight)).toHaveValue("");
});

// 016/US11 (T044 homologação PR-E, R3) — the free-tier column-height gap at 1440px. Measured:
// right column bottom 849,97px vs left column bottom 2.521,47px — 1.671px of empty space beside a
// gate that only ever needed 205px. The fix moves the gate OUTSIDE the two-column grid tracks
// (`.tf-calc-grid__full`, `grid-column: 1 / -1`) — proven here by its box spanning the FULL grid
// width, not confined to one column's track.
test("free at 1440px: the marketplace gate spans the FULL grid width, not one short column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  const gate = page.getByTestId("marketplace-premium-gate");
  await expect(gate).toBeVisible();

  // Walk up from the gate to the `.tf-calc-grid__full` wrapper the fix adds, and to the grid
  // container itself, to compare widths directly — the gate's OWN wrapper must span (~) the same
  // width as the two-column grid it lives in, not half of it.
  const widths = await gate.evaluate((el) => {
    const full = el.closest(".tf-calc-grid__full");
    const grid = el.closest(".tf-calc-grid");
    return {
      fullWidth: full?.getBoundingClientRect().width ?? null,
      gridWidth: grid?.getBoundingClientRect().width ?? null,
    };
  });
  expect(widths.fullWidth, "gate wrapper has a `.tf-calc-grid__full` ancestor").not.toBeNull();
  expect(widths.gridWidth).not.toBeNull();
  // Within 2px — the grid's own padding/border rounding, never half the width (a single column).
  expect(
    Math.abs(widths.fullWidth! - widths.gridWidth!),
    `gate wrapper ${widths.fullWidth}px vs grid ${widths.gridWidth}px`,
  ).toBeLessThan(2);
});
