// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Frozen } from "./frozen";

afterEach(() => cleanup());

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("Frozen (T011 / research.md §3 — veste, nunca inerta)", () => {
  it("renders a disabled fieldset with the tf-frozen class", () => {
    render(
      <Frozen>
        <input aria-label="Consumo médio" />
      </Frozen>,
    );

    const fieldset = screen.getByLabelText("Consumo médio").closest("fieldset");
    expect(fieldset).not.toBeNull();
    expect(fieldset).toHaveClass("tf-frozen");
    expect(fieldset).toBeDisabled();
  });

  it("has no prop that turns the disabled state off — the fieldset is always disabled", () => {
    // @ts-expect-error — FrozenProps intentionally has no `disabled` prop to flip.
    render(<Frozen disabled={false}>{null}</Frozen>);

    const fieldset = screen.getByRole("group", { hidden: true }) as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true);
  });

  it("keeps a button OUTSIDE the Frozen clickable", async () => {
    const user = setup();
    let clicks = 0;
    render(
      <div>
        <Frozen>
          <button type="button">dentro</button>
        </Frozen>
        <button type="button" onClick={() => (clicks += 1)}>
          fora
        </button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "fora" }));
    expect(clicks).toBe(1);

    expect(screen.getByRole("button", { name: "dentro" })).toBeDisabled();
  });

  it("keeps the hint's own color and puts no opacity on the wrapper itself", () => {
    // The real ≥5.67:1 measurement against --bg-muted is T016 (e2e, real browser paint);
    // jsdom does not apply the imported CSS cascade, so here we assert the CONTRACT the
    // primitive must hold for that measurement to be possible: the dim lives on the
    // controls (input/select), never as an `opacity` inline style on the <fieldset> wrapper
    // itself (that is exactly the rejected shape — opacity on the container dragged the
    // hint to 2.58:1, research.md §3 / handoff README §1).
    render(
      <Frozen>
        <div className="tf-field">
          <input aria-label="Consumo médio" />
          <span className="tf-field__hint">Consumo médio real da impressora.</span>
        </div>
      </Frozen>,
    );

    const hint = screen.getByText("Consumo médio real da impressora.");
    expect(hint).toHaveClass("tf-field__hint");
    expect(hint.style.opacity).toBe("");

    const wrapper = hint.closest("fieldset");
    expect(wrapper?.style.opacity).toBe("");
  });

  it("forwards className and aria-label", () => {
    render(
      <Frozen className="extra" aria-label="Formulário congelado">
        <input aria-label="x" />
      </Frozen>,
    );

    const fieldset = screen.getByRole("group", { name: "Formulário congelado" });
    expect(fieldset).toHaveClass("tf-frozen");
    expect(fieldset).toHaveClass("extra");
  });
});
