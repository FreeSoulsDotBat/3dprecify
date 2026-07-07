// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { FeeSeal } from "./fee-seal";

afterEach(() => cleanup());

const t = messages.calculator.seals;

describe("FeeSeal — honesty states (FR-107)", () => {
  it("a fresh reference shows the source + a pt-BR review date", () => {
    render(
      <FeeSeal state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-07-06" }} />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.reference);
    expect(seal).toHaveTextContent("Ajuda Shopee");
    expect(seal).toHaveTextContent("06/07/2026"); // ISO → pt-BR dd/mm/yyyy
    expect(seal).not.toHaveTextContent(t.outdated);
  });

  it("a stale reference appends the desatualizada warning", () => {
    render(
      <FeeSeal
        state={{ kind: "reference", source: "Ajuda Shopee", reviewedOn: "2026-01-01", stale: true }}
      />,
    );
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.outdated);
  });

  it("an embedded (seed) reference reads 'referência embutida' without a live date", () => {
    render(
      <FeeSeal
        state={{
          kind: "reference",
          source: "Ajuda Shopee",
          reviewedOn: "2026-07-06",
          embedded: true,
        }}
      />,
    );
    const seal = screen.getByTestId("fee-seal");
    expect(seal).toHaveTextContent(t.embedded);
    expect(seal).not.toHaveTextContent("06/07/2026");
  });

  it("an adjusted slot reads 'ajustado por você'", () => {
    render(<FeeSeal state={{ kind: "adjusted" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.adjusted);
  });

  it("an uncovered slot reads 'sem referência' — never a fabricated number", () => {
    render(<FeeSeal state={{ kind: "none" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.none);
  });

  it("the ML freight subsidy is marked as an estimate (A4)", () => {
    render(<FeeSeal state={{ kind: "estimate" }} />);
    expect(screen.getByTestId("fee-seal")).toHaveTextContent(t.estimate);
  });
});
