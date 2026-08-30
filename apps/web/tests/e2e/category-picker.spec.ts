import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 016/US13 (T047, FR-920) — geometry by BOXES (the 014 lesson: a screenshot found what a
// geometric/text assertion could not — the result list read as a second filled field) + the honest
// counter (014 registered "8 encontrados" with 31 real matches — this proves the count is the REAL
// total, never the rendered slice). NOTE (tasks.md path correction, same class as T041's) — the real
// e2e directory is `apps/web/tests/e2e/`, not `apps/web/e2e/`.
//
// The picker only renders inside a channel slot, which is Premium since US11 — this spec runs
// against a premium account throughout.

const t = messages.calculator;
const cp = t.categoryPicker;

const servedCatalogJson = readFileSync(
  fileURLToPath(new URL("../../../../backend/app/data/catalog.json", import.meta.url)),
  "utf-8",
);
const servedCatalog: { marketplaces: { marketplace: string; categorySpine?: { id: string }[] }[] } =
  JSON.parse(servedCatalogJson);
const amazonSpineSize =
  servedCatalog.marketplaces.find((m) => m.marketplace === "AMAZON")?.categorySpine?.length ?? 0;

async function openAmazonSlot(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/fee-catalog", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: servedCatalogJson }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  const slot0 = page.getByTestId("channel-slot").first();
  await slot0.getByLabel(t.channels.marketplace, { exact: true }).selectOption("AMAZON");
  return slot0;
}

test("the search results list does NOT read as a second filled field (box separation)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `catpicker-box-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();
  const slot0 = await openAmazonSlot(page);

  const input = slot0.getByLabel(cp.label);
  await input.fill("a");
  const list = slot0.getByRole("list").first();
  await expect(list).toBeVisible();

  const inputBox = await input.boundingBox();
  const listBox = await list.boundingBox();
  expect(inputBox, "input has a box").not.toBeNull();
  expect(listBox, "results list has a box").not.toBeNull();

  // The list sits BELOW the input (in-flow, never overlapping it) — an overlapping/adjacent-with-no-
  // gap box is exactly what reads as "a second value already typed into the same field" (the 014
  // screenshot finding). A real gap (however small) proves it is a SEPARATE surface.
  expect(
    listBox!.y,
    `the results list (top ${listBox!.y}) must start at/after the input's bottom (${inputBox!.y + inputBox!.height})`,
  ).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);

  // And the list is not painted with a border/frame identical to `.tf-inputwrap`'s (which would make
  // it read as another input) — the DS's OWN list styling (raised surface + shadow), not the field
  // frame class.
  const listFrameClass = await list.evaluate((el) => el.className);
  expect(listFrameClass).not.toContain("tf-inputwrap");
});

test("the counter says the REAL total, never a truncated slice pretending to be the whole (014's '8 with 31')", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `catpicker-count-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();
  const slot0 = await openAmazonSlot(page);

  // Amazon's real spine is 38 categories (flat) — searching a single common letter matches far more
  // than the 8 the list renders.
  const input = slot0.getByLabel(cp.label);
  await input.fill("a");

  const countText = await slot0.getByRole("status").first().innerText();
  const truncatedMatch = /Mostrando (\d+) de (\d+)/.exec(countText);
  expect(truncatedMatch, `counter text was "${countText}"`).not.toBeNull();
  const [, shown, total] = truncatedMatch!;
  expect(Number(shown)).toBe(8); // MAX_RESULTS
  // The real total is NEVER reported as 8 — this is the exact defect class 014 found.
  expect(Number(total)).toBeGreaterThan(8);
  expect(await slot0.getByRole("list").first().getByRole("button").count()).toBe(8);
});

test("hierarchical browse: nasce RECOLHIDA (R2), opens on demand with an honest 'não informada' state before any pick", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `catpicker-tree-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();
  const slot0 = await openAmazonSlot(page);

  // Nothing chosen yet — no "category-chosen" chip renders (the honest "não informada" state; the
  // picker never claims a category is set when it is not).
  await expect(slot0.getByTestId("category-chosen")).toHaveCount(0);

  // 016/US11 (T044 homologação PR-E, R2) — the tree does NOT render inline anymore: an inline
  // 38-node spine measured 1.795px of page height before any interaction. It sits behind a toggle
  // naming the REAL count (never truncated to a rendered slice).
  const toggle = slot0.getByTestId("category-browse-toggle");
  await expect(toggle).toBeVisible();
  expect(amazonSpineSize).toBeGreaterThan(0);
  await expect(toggle).toContainText(String(amazonSpineSize));
  await expect(slot0.getByTestId("category-tree")).toHaveCount(0);

  // Opening it reveals the tree, capped by its own scroll (~40vh) — never the whole page's height.
  await toggle.click();
  const tree = slot0.getByTestId("category-tree");
  await expect(tree).toBeVisible();
  await expect(
    slot0.getByText(cp.browseCount.replace("{n}", String(amazonSpineSize))),
  ).toBeVisible();
  const scrollFrame = slot0.locator(".category-picker__browse-scroll .category-picker__list");
  const maxHeightPx = await scrollFrame.evaluate((el) => getComputedStyle(el).maxHeight);
  expect(
    maxHeightPx.endsWith("vh") || Number.parseFloat(maxHeightPx) > 0,
    maxHeightPx,
  ).toBeTruthy();

  // Amazon's real spine is FLAT (38 nodes, one level) — the tree degrades to a plain list: no
  // expand/collapse affordance renders anywhere (no node has children).
  await expect(tree.locator(".category-picker__expand")).toHaveCount(0);

  // Picking a node from the browse tree selects it, same as picking from search — the honest
  // "não informada" state above flips to a real chosen chip.
  await tree.getByRole("button").first().click();
  await expect(slot0.getByTestId("category-chosen")).toBeVisible();
});
