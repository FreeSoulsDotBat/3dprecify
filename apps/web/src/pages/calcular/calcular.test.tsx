// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { CalcularPage } from "./calcular-page";

afterEach(() => cleanup());

const t = messages.calculator;

// E1 MVP (US1 + US2). The default seed (100/1kg/100g, 5h, 0,12kW, tariff 1, machine 4000/2000h,
// optionals 0) renders a coherent price with no user input: custo_total R$ 20,60, varejo
// R$ 30,90, atacado R$ 26,78. The numeric formula is pinned in pricing-core + the model test;
// here we guard the screen wiring (both prices shown together, the transparent breakdown, and
// the per-field validation path).
describe("CalcularPage — US1 correct retail + wholesale price", () => {
  it("shows BOTH prices together (SC-010) and the breakdown by default", () => {
    render(<CalcularPage />);

    // Retail + wholesale are always shown together (label appears in the hero + derivation row).
    expect(screen.getAllByText(t.results.varejo).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.results.atacado).length).toBeGreaterThan(0);

    // Breakdown lines (single-node currency strings) for the default seed.
    expect(screen.getByText("R$ 0,60")).toBeInTheDocument(); // energy
    expect(screen.getByText("R$ 20,60")).toBeInTheDocument(); // custo_total (unique)
    expect(screen.getByText("R$ 30,90")).toBeInTheDocument(); // varejo derivation
    expect(screen.getByText("R$ 26,78")).toBeInTheDocument(); // atacado derivation
  });

  it("presents the calculator title through a focusable page header", () => {
    render(<CalcularPage />);

    const heading = screen.getByRole("heading", { name: /calcular/i });
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("carries no tax/imposto input (FR-021) and keeps the free-tier note (US6)", () => {
    render(<CalcularPage />);

    expect(screen.queryByText(/imposto/i)).toBeNull();
    expect(screen.getByText(t.freemiumNote)).toBeInTheDocument();
  });
});

describe("CalcularPage — US2 transparency + validation", () => {
  it("labels the breakdown lines in pt-BR", () => {
    render(<CalcularPage />);

    expect(screen.getByText(t.results.material)).toBeInTheDocument();
    expect(screen.getByText(t.results.energy)).toBeInTheDocument();
    expect(screen.getByText(t.results.machine)).toBeInTheDocument();
    expect(screen.getByText(t.results.custoTotal)).toBeInTheDocument();
  });

  it("rejects an invalid roll weight with a pt-BR message and hides the price (SC-008)", async () => {
    render(<CalcularPage />);

    // Query by accessible name (the aria-hidden "*" is excluded), like the Playwright e2e.
    fireEvent.change(screen.getByRole("textbox", { name: t.fields.rollWeight }), {
      target: { value: "0" },
    });

    // Per-field pt-BR message, never a NaN/#DIV0.
    expect(await screen.findByText(t.rollWeightError)).toBeInTheDocument();
    // The price is withheld until the input is valid again.
    expect(screen.queryByText("R$ 20,60")).toBeNull();
    expect(screen.getByText(t.invalidNote)).toBeInTheDocument();
  });
});
