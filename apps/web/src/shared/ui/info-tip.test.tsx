// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { InfoTip } from "./info-tip";

// Radix Popover positions its content with floating-ui, which observes size changes.
// jsdom ships no ResizeObserver, so provide a no-op — the a11y contract (open on click,
// labelled trigger, content in the DOM) is what we assert, not pixel positioning.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => cleanup());

describe("InfoTip (E1 item 8 — section info affordance)", () => {
  it("renders a labelled trigger and keeps the content hidden until opened", () => {
    render(<InfoTip label="Sobre os custos da peça">Explicação do cálculo.</InfoTip>);

    expect(screen.getByRole("button", { name: "Sobre os custos da peça" })).toBeInTheDocument();
    // Content is not in the DOM while closed (works on touch AND desktop via tap/click).
    expect(screen.queryByText("Explicação do cálculo.")).not.toBeInTheDocument();
  });

  it("opens the explanation on click/tap", async () => {
    const user = userEvent.setup();
    render(<InfoTip label="Sobre os custos da peça">Explicação do cálculo.</InfoTip>);

    await user.click(screen.getByRole("button", { name: "Sobre os custos da peça" }));

    expect(await screen.findByText("Explicação do cálculo.")).toBeInTheDocument();
  });
});
