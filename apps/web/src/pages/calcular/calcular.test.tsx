// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { CalcularPage } from "./calcular-page";

afterEach(() => cleanup());

const t = messages.calculator;

/** Render the page inside a fresh QueryClient (the fee-catalog store uses TanStack Query). The
 *  served fetch fails in jsdom → the hook falls back to the bundled seed, which is what we want. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalcularPage />
    </QueryClientProvider>,
  );
}

/** Assert the given nodes appear in document order (each precedes the next). */
function expectDomOrder(nodes: readonly HTMLElement[]) {
  for (let i = 0; i < nodes.length - 1; i++) {
    const rel = nodes[i].compareDocumentPosition(nodes[i + 1]);
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
}

// E1 MVP (US1 + US2). The default seed (100/1kg/100g, 5h, 0,12kW, tariff 1, machine 4000/2000h,
// optionals 0) renders a coherent price with no user input: custo_total R$ 20,60, varejo
// R$ 30,90, atacado R$ 26,78. The numeric formula is pinned in pricing-core + the model test;
// here we guard the screen wiring (both prices shown together, the transparent breakdown, and
// the per-field validation path).
describe("CalcularPage — US1 correct retail + wholesale price", () => {
  it("shows BOTH prices together (SC-010) and the breakdown by default", () => {
    renderPage();

    // Retail + wholesale are always shown together (label appears in the hero + derivation row).
    expect(screen.getAllByText(t.results.varejo).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.results.atacado).length).toBeGreaterThan(0);

    // Breakdown lines (single-node currency strings) for the default seed.
    expect(screen.getByText("R$ 0,60")).toBeInTheDocument(); // energy
    expect(screen.getByText("R$ 20,60")).toBeInTheDocument(); // custo_total (unique)
    expect(screen.getByText("R$ 30,90")).toBeInTheDocument(); // varejo derivation
    expect(screen.getByText("R$ 26,78")).toBeInTheDocument(); // atacado derivation
  });

  it("orders the sections top→bottom: inputs → optional → markup → breakdown → prices (SC-010, item 1)", () => {
    renderPage();

    const inputs = screen.getByText(t.sections.inputs);
    const optional = screen.getByText(t.sections.optional);
    const markup = screen.getByText(t.sections.markup);
    const breakdown = screen.getByText(t.sections.breakdown);
    // "Preço varejo" appears in the breakdown derivation row AND the closing hero — the
    // LAST occurrence is the hero, which must be the final price block on the screen.
    const varejoNodes = screen.getAllByText(t.results.varejo);
    const priceHero = varejoNodes[varejoNodes.length - 1];

    expectDomOrder([inputs, optional, markup, breakdown, priceHero]);
  });

  it("shows an ⓘ info tip on each section title (item 8)", () => {
    renderPage();

    expect(screen.getByRole("button", { name: t.sectionInfo.inputs.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.sectionInfo.optional.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.sectionInfo.markup.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.sectionInfo.breakdown.label })).toBeInTheDocument();
  });

  it("presents the calculator title through a focusable page header", () => {
    renderPage();

    const heading = screen.getByRole("heading", { name: /calcular/i });
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("carries no tax/imposto input (FR-021) and keeps the free-tier note (US6)", () => {
    renderPage();

    expect(screen.queryByText(/imposto/i)).toBeNull();
    expect(screen.getByText(t.freemiumNote)).toBeInTheDocument();
  });
});

describe("CalcularPage — US2 transparency + validation", () => {
  it("labels the breakdown lines in pt-BR", () => {
    renderPage();

    expect(screen.getByText(t.results.material)).toBeInTheDocument();
    expect(screen.getByText(t.results.energy)).toBeInTheDocument();
    expect(screen.getByText(t.results.machine)).toBeInTheDocument();
    expect(screen.getByText(t.results.custoTotal)).toBeInTheDocument();
  });

  it("rejects an invalid roll weight with a pt-BR message and hides the price (SC-008)", async () => {
    renderPage();

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

// US4 (optional labor + admin folded into custo_total) + US1 multi-channel marketplace. The labor
// section sits between the optional adjustments and markup; the marketplace section is the last
// block, starting with one Mercado Livre channel slot whose prices show in "Preços por canal".
describe("CalcularPage — US4 labor/admin + US1 marketplace", () => {
  it("renders the labor + admin breakdown rows (US4)", () => {
    renderPage();

    // "Mão de obra" is unique; "Outros custos" is shared with the adminTotal field label, so it
    // legitimately appears more than once (the field input + the breakdown row).
    expect(screen.getByText(t.results.labor)).toBeInTheDocument();
    expect(screen.getAllByText(t.results.admin).length).toBeGreaterThan(0);
  });

  it("shows an ⓘ info tip on the labor + marketplace section titles", () => {
    renderPage();

    expect(screen.getByRole("button", { name: t.sectionInfo.labor.label })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.sectionInfo.marketplace.label }),
    ).toBeInTheDocument();
  });

  it("starts with one Mercado Livre channel slot and its fee inputs (US1)", () => {
    renderPage();

    // The default slot: a Marketplace selector defaulting to Mercado Livre + a Comissão fee input.
    expect(screen.getByRole("combobox", { name: new RegExp(t.channels.marketplace) })).toHaveValue(
      "MERCADO_LIVRE",
    );
    expect(
      screen.getByRole("textbox", {
        name: (n) => n.startsWith(t.channels.commission) && !n.includes("mínima"),
      }),
    ).toBeInTheDocument();
    // The channel is listed together with the others under "Preços por canal".
    expect(screen.getByText(t.channels.pricesTitle)).toBeInTheDocument();
  });

  it("updates the channel's gross-up prices as its commission changes (US1)", () => {
    renderPage();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: (n) => n.startsWith(t.channels.commission) && !n.includes("mínima"),
      }),
      {
        target: { value: "20" },
      },
    );

    // Seed varejo 30,90 grossed up at 20% → 38,63 to advertise; anúncio + líquido rows are shown.
    expect(screen.getByText("R$ 38,63")).toBeInTheDocument();
    expect(screen.getAllByText(t.results.precoAnuncio).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.results.recebidoLiquido).length).toBeGreaterThan(0);
  });
});
