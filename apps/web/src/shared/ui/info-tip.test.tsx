// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// 016/PR-C homologação (R3) — a REAL pointer device: `prefersHover()` reads `matchMedia
// "(hover: hover) and (pointer: fine)"`, which jsdom answers `matches:false` by default (no
// media info) — mocked here to exercise the hover path the qa found broken.
function mockHoverCapablePointer(): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("hover: hover"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

describe("InfoTip (016/PR-C homologação R3) — Escape wins over a lingering hover", () => {
  it("Escape closes it, and a pointer that never left does NOT reopen it", async () => {
    mockHoverCapablePointer();
    render(<InfoTip label="Sobre a tarifa">corpo do tooltip</InfoTip>);
    const trigger = screen.getByRole("button", { name: "Sobre a tarifa" });

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("corpo do tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("corpo do tooltip")).not.toBeInTheDocument());

    // Radix unmounts the content on Escape while the pointer never moved — the browser reads
    // that as the trigger now being "entered" (nothing under the cursor changed position, but
    // what's under it did) and fires a synthetic mouseenter. Reproduced directly here.
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByText("corpo do tooltip")).not.toBeInTheDocument();
  });

  it("hover re-arms once the pointer actually leaves and comes back", async () => {
    mockHoverCapablePointer();
    render(<InfoTip label="Sobre a tarifa">corpo do tooltip</InfoTip>);
    const trigger = screen.getByRole("button", { name: "Sobre a tarifa" });

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("corpo do tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("corpo do tooltip")).not.toBeInTheDocument());

    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("corpo do tooltip")).toBeInTheDocument();
  });
});
