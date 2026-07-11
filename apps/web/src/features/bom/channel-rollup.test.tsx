// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { BomChannelRollup } from "@3dprecify/pricing-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { ChannelRollup } from "./channel-rollup";

// 008/T006b follow-up — the qa-produto homologation flagged that the aggregate skippedLines
// caption (ux §1.7) is unreachable through the FORM: the calculator's per-slot validation
// intercepts a bad fee (e.g. commission ≥ 100) BEFORE the engine, so a UI-invalid slot never
// becomes an engine-level `ChannelResult.error` — the line shows its own inline error and the
// rollup honestly counts one fewer contribution. The caption's code path is CONTRACTUAL
// (`BomChannelRollup.skippedLines`, anchored in pricing-core) and must render whenever a
// persisted/degraded input DOES produce an engine-errored slot — pinned here at component level.

const t = messages.bom;

function rollup(overrides: Partial<BomChannelRollup>): BomChannelRollup {
  return {
    marketplace: "MERCADO_LIVRE",
    precoAnuncioVarejo: 152.71,
    recebidoLiquidoVarejo: 116.71,
    precoAnuncioAtacado: 134.27,
    recebidoLiquidoAtacado: 101.15,
    freightCostVarejo: 0,
    freightCostAtacado: 0,
    contributingLines: 2,
    skippedLines: 0,
    ...overrides,
  };
}

afterEach(cleanup);

describe("ChannelRollup — skippedLines honesty (ux §1.7, SC-107 extended)", () => {
  it("a rollup with skipped lines shows the calm caption alongside the priced sum", () => {
    render(<ChannelRollup channels={[rollup({ contributingLines: 1, skippedLines: 1 })]} />);
    expect(screen.getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
    expect(screen.getByText(t.channelContributing.replace("{n}", "1"))).toBeInTheDocument();
    // The sum for the lines that DID price still renders.
    expect(screen.getAllByText(/R\$\s?152,71/).length).toBeGreaterThan(0);
  });

  it("contributingLines === 0 reads as honest absence — never a fabricated R$ 0,00", () => {
    render(
      <ChannelRollup
        channels={[
          rollup({
            contributingLines: 0,
            skippedLines: 2,
            precoAnuncioVarejo: null,
            recebidoLiquidoVarejo: null,
            precoAnuncioAtacado: null,
            recebidoLiquidoAtacado: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText(t.channelNoContrib)).toBeInTheDocument();
    expect(screen.getByText(t.channelSkipped.replace("{n}", "2"))).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s?0,00/)).not.toBeInTheDocument();
  });

  it("a null-marketplace group is labelled with the manual channel fallback", () => {
    render(<ChannelRollup channels={[rollup({ marketplace: null })]} />);
    expect(screen.getByText(messages.calculator.channels.channelFallback)).toBeInTheDocument();
  });

  it("renders nothing when no line carries a channel (like Calcular with marketplaces off)", () => {
    const { container } = render(<ChannelRollup channels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
