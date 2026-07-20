// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { type FeeCatalog, feeCatalogSchema } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CALC_FIELD_NAMES, defaultCalcValues } from "./calculator-schema";
import { KitBasisSummary } from "./kit-basis-summary";

// 010/T024 (E5, PR-B US3, Q12) — written FAILING-first: the KIT-basis reopen's own read-only
// per-marketplace rollup surface (no scalar form exists to hydrate a multi-piece basis).

const t = messages.scenarios;
const tc = messages.calculator;

const catalog: FeeCatalog = feeCatalogSchema.parse({
  catalogVersion: "2026-07-19.t",
  schemaVersion: "1",
  generatedAt: "2026-07-19T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      entries: [
        {
          determinants: { listingType: "CLASSICO" },
          commissionPct: 12,
          fixedFee: 6.75,
          freight: { kind: "NONE" },
          source: "Ajuda Mercado Livre",
          sourceUrl: "https://www.mercadolivre.com.br/ajuda/",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-07-18",
        },
      ],
    },
  ],
});
const ctx = { catalog, source: "catalog" as const, now: Date.parse("2026-07-19T12:00:00Z") };

function scalarLine(): Record<string, string> {
  const scalars: Record<string, string> = {};
  for (const name of CALC_FIELD_NAMES) scalars[name] = defaultCalcValues[name]!;
  return scalars;
}

function kitConfig(): ScenarioConfig {
  return {
    schemaVersion: 1,
    includeMarketplace: true,
    costBasis: {
      kind: "KIT",
      ref: { id: "k1", name: "Kit sazonal" },
      lastKnown: {
        lines: [
          { name: "Vaso G", quantity: 2, input: scalarLine() },
          { name: "Vaso P", quantity: 1, input: scalarLine() },
        ],
      },
    },
    channels: [{ marketplace: "MERCADO_LIVRE", modality: "CLASSICO" }],
    otherCosts: [],
  };
}

afterEach(() => cleanup());

describe("KitBasisSummary", () => {
  it("renders null for a non-KIT basis (AD_HOC/PRODUCT use the ordinary scalar form)", () => {
    const adhoc: ScenarioConfig = {
      schemaVersion: 1,
      includeMarketplace: true,
      costBasis: { kind: "AD_HOC", ref: null, lastKnown: {} },
      channels: [],
      otherCosts: [],
    };
    const { container } = render(<KitBasisSummary config={adhoc} refName="x" ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the kit name + the per-marketplace rollup, read-only", () => {
    render(<KitBasisSummary config={kitConfig()} refName="Kit sazonal" ctx={ctx} />);

    expect(screen.getByText(t.kitBasisTitle.replace("{nome}", "Kit sazonal"))).toBeInTheDocument();
    expect(screen.getByText(tc.marketplaceNames.MERCADO_LIVRE)).toBeInTheDocument();
    // Both lines contributed (uniform channel application, Q12) — a real varejo price is shown.
    expect(screen.getByText(new RegExp(`${tc.captions.varejo}: R\\$`))).toBeInTheDocument();
  });

  it("no fabricated all-zero rollup — every line invalid renders the honest invalidNote, not R$ 0,00", () => {
    const config = kitConfig();
    // @ts-expect-error — deliberately corrupt the scalar to force an unparseable line
    config.costBasis.lastKnown.lines[0]!.input.costPerRoll = "not-a-number";
    // @ts-expect-error — same for the second line
    config.costBasis.lastKnown.lines[1]!.input.costPerRoll = "not-a-number";

    render(<KitBasisSummary config={config} refName="Kit sazonal" ctx={ctx} />);
    expect(screen.getByText(tc.invalidNote)).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });
});
