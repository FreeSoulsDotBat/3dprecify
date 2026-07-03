// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalcularPage } from "./calcular-page";

afterEach(() => cleanup());

// Guards the 001 canonical calculation through the shell refactor (T031) and the
// R2-6 seed fix: the default render (R$100 / 1kg / 20g / 50%) must show material
// R$ 2,00 and suggested price R$ 3,00 with no user input (spec.md:45-46).
describe("CalcularPage (T026 / US1)", () => {
  it("renders the canonical result R$ 2,00 material / R$ 3,00 price by default", () => {
    render(<CalcularPage />);

    // The itemised breakdown carries the spaced, single-node currency strings.
    expect(screen.getByText("R$ 2,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 3,00")).toBeInTheDocument();
  });

  it("presents the calculator title through a focusable page header", () => {
    render(<CalcularPage />);

    const heading = screen.getByRole("heading", { name: /calcular/i });
    // page-header title is focusable (tabindex=-1) so US3/T045 can move focus to it.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});
