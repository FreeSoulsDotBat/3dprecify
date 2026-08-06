// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { NumberField } from "./number-field";

afterEach(() => cleanup());

// 016/PR-C homologação (B2) — `currency` only drew the "R$" prefix; `12345,67` displayed as
// "R$ 12345,67", with no thousands grouping. This masks pt-BR grouping ON BLUR (never mid-typing,
// which would fight the caret) for every `currency` field — never changes the SEMANTIC value the
// form state carries (`parseDecimal` already reads grouped and ungrouped forms identically).

/** A tiny controlled harness mirroring how `ControlledField`/RHF wire `value`/`onChange`. */
function Harness({ currency = true, initial = "" }: { currency?: boolean; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      aria-label="Valor"
      currency={currency}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

describe("NumberField — pt-BR thousands grouping on blur (currency mode)", () => {
  it("groups thousands on blur (12345,67 → 12.345,67)", () => {
    render(<Harness initial="12345,67" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("12.345,67");
  });

  it("leaves the SEMANTIC value unchanged — parseDecimal reads the same number before/after", async () => {
    const { parseDecimal } = await import("@/shared/lib/decimal-ptbr");
    render(<Harness initial="12345,67" />);
    const input = screen.getByLabelText("Valor");
    const before = parseDecimal((input as HTMLInputElement).value);
    fireEvent.blur(input);
    const after = parseDecimal((input as HTMLInputElement).value);
    expect(after).toBeCloseTo(before, 6);
    expect(after).toBeCloseTo(12345.67, 2);
  });

  it("round-trips an ALREADY-grouped value untouched (idempotent)", () => {
    render(<Harness initial="12.345,67" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("12.345,67");
  });

  it("formats an integer-looking value with two decimals (4000 → 4.000,00)", () => {
    render(<Harness initial="4000" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("4.000,00");
  });

  it("does nothing on blur when currency is false (non-money numeric fields untouched)", () => {
    render(<Harness currency={false} initial="12345,67" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("12345,67");
  });

  it("leaves an unparseable value exactly as typed (never mangles an invalid string)", () => {
    render(<Harness initial="abc" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("abc");
  });

  it("leaves a blank value blank", () => {
    render(<Harness initial="" />);
    const input = screen.getByLabelText("Valor");
    fireEvent.blur(input);
    expect(input).toHaveValue("");
  });

  it("still calls a caller-supplied onBlur (RHF touched-state tracking survives)", () => {
    let blurred = false;
    render(
      <NumberField
        aria-label="Valor2"
        currency
        value="4000"
        onChange={() => {}}
        onBlur={() => {
          blurred = true;
        }}
      />,
    );
    fireEvent.blur(screen.getByLabelText("Valor2"));
    expect(blurred).toBe(true);
  });
});
