// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { computeBom, type PriceInput } from "@3dprecify/pricing-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { AssemblySummary } from "./assembly-summary";

// Review 2026-07-12 (UX honesty): with NO valid line the assembly headline used to show three
// fake "R$ 0,00" heroes — a price that does not exist yet, dressed as a real total. It now shows
// the calm "sem preço ainda" state, and a PARTIAL kit (some lines excluded) says so out loud. A
// quantity-0 line is NOT "excluded": it contributed a truthful zero and the priced headline stays.

const t = messages.bom;

const SC001: PriceInput = {
  costPerRoll: 100,
  rollWeightKg: 1,
  printGrams: 100,
  wasteGrams: 10,
  printTimeHours: 5,
  avgPowerKw: 0.1,
  tariffPerKwh: 1,
  machineValue: 4000,
  machineLifetimeHours: 2000,
  failurePct: 10,
  finishTimeHours: 0.5,
  finishRatePerHour: 10,
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
  channels: [],
}; // custo 28,65 · varejo 42,98 · atacado 37,25

afterEach(cleanup);

describe("AssemblySummary — honest headline states", () => {
  it("no valid line: shows the 'sem preço ainda' state, never R$ 0,00 heroes", () => {
    render(<AssemblySummary bom={computeBom([])} />);

    expect(screen.getByText(t.assemblyNoPriceTitle)).toBeInTheDocument();
    expect(screen.getByText(t.assemblyNoPriceBody)).toBeInTheDocument();
    // The custo row and the varejo/atacado heroes must NOT render a fabricated zero.
    expect(screen.queryByText(t.assemblyCusto)).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$\s?0,00/)).not.toBeInTheDocument();
  });

  it("a priced kit with excluded lines shows the total AND how many are out of it", () => {
    render(
      <AssemblySummary bom={computeBom([{ input: SC001, quantity: 1 }])} excludedLineCount={2} />,
    );

    expect(screen.getByText(t.assemblyCusto)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?28,65/).length).toBeGreaterThan(0);
    expect(screen.getByText(t.assemblyExcluded.replace("{n}", "2"))).toBeInTheDocument();
  });

  it("a fully-valid kit shows the priced headline and no excluded note", () => {
    render(<AssemblySummary bom={computeBom([{ input: SC001, quantity: 1 }])} />);

    expect(screen.getByText(t.assemblyCusto)).toBeInTheDocument();
    expect(screen.queryByText(t.assemblyExcluded.replace("{n}", "0"))).not.toBeInTheDocument();
    expect(screen.queryByText(t.assemblyNoPriceTitle)).not.toBeInTheDocument();
  });
});
