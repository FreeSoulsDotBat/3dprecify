// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// 016/US11 (T048, FR-915) — marketplace pricing is Premium now; this file's intent has always been
// the CHANNEL MECHANICS (gross-up, the toggle, the fee grid), not proving free-tier access — that
// proof lives in `apps/web/tests/e2e/marketplace-premium.spec.ts`. Mocked `active` so those mechanics
// stay reachable; no test below asserts anything about the teaser/gate itself.
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({
        data: { status: "active" },
        isError: false,
        isLoading: false,
        stale: false,
        isFetching: false,
        refetch: () => {},
    }),
}));

import { CalculatePage } from "./calcular-page";

afterEach(() => cleanup());

const t = messages.calculator;

/** Render the page inside a fresh QueryClient (the fee-catalog store uses TanStack Query). The
 *  served fetch fails in jsdom → the hook falls back to the bundled seed, which is what we want. */
function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CalculatePage />
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

// E1 MVP (US1 + US2). The default seed (100/1kg/100g, 5h, 0,12kW, tariff 1, machine 4000/3600h —
// 016/PR-C homologação B1: 3600 = 1200h/ano "quase todo dia" × 3 anos, the ritmo-mode default —
// optionals 0) renders a coherent price with no user input: custo_total R$ 16,16, varejo
// R$ 24,24, atacado R$ 21,01 (confirmed by running computeCalculator with this seed, not
// guessed). The numeric formula is pinned in pricing-core + the model test; here we guard the
// screen wiring (both prices shown together, the transparent breakdown, and the per-field
// validation path).
describe("CalcularPage — US1 correct retail + wholesale price", () => {
    it("shows BOTH prices together (SC-010) and the breakdown by default", () => {
        renderPage();

        // 019/PR-F (T142, adoção, prancheta 10a) — a conta não tem mais as linhas "Preço
        // varejo"/"Preço atacado" (elas saem para o cabeçalho + o cartão/linha-resumo finais). SC-010
        // continua satisfeita: os DOIS preços seguem visíveis juntos — um no cartão grande (varejo,
        // default), o outro na linha-resumo logo abaixo.
        expect(screen.getByTestId("price-hero")).toHaveTextContent(t.results.retail);
        expect(screen.getByTestId("price-summary-line")).toHaveTextContent(t.captions.wholesale);

        // Breakdown lines (single-node currency strings) for the default seed.
        expect(screen.getByText("R$ 0,60")).toBeInTheDocument(); // energy
        expect(screen.getByText("R$ 16,16")).toBeInTheDocument(); // custo_total (unique)
        expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*24,24/); // varejo hero
        expect(screen.getByTestId("price-summary-line")).toHaveTextContent(/R\$\s*21,01/); // atacado summary
    });

    // 016/US9 (FR-911) — "Ajustes opcionais" fused into "Custos da peça" (retired as its own
    // section); the order pin drops it accordingly.
    it("orders the sections top→bottom: inputs → markup → breakdown → prices (SC-010, item 1)", () => {
        renderPage();

        const inputs = screen.getByText(t.sections.inputs);
        const markup = screen.getByText(t.sections.markup);
        const breakdown = screen.getByText(t.sections.breakdown);
        // "Preço varejo" appears in the breakdown derivation row AND the closing hero — the
        // LAST occurrence is the hero, which must be the final price block on the screen.
        const varejoNodes = screen.getAllByText(t.results.retail);
        const priceHero = varejoNodes[varejoNodes.length - 1];

        expectDomOrder([inputs, markup, breakdown, priceHero]);
    });

    it("shows an ⓘ info tip on each section title (item 8)", () => {
        renderPage();

        expect(
            screen.getByRole("button", { name: t.sectionInfo.inputs.label }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: t.sectionInfo.markup.label }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: t.sectionInfo.breakdown.label }),
        ).toBeInTheDocument();
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
        expect(screen.getByText(t.results.totalCost)).toBeInTheDocument();
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
        expect(screen.queryByText("R$ 16,16")).toBeNull();
        expect(screen.getByText(t.invalidNote)).toBeInTheDocument();
    });
});

// US4 (optional labor folded into custo_total) + US5 (itemized "Outros custos" slot) + US1 multi-
// channel marketplace. The labor section + Outros custos slot sit between the optional adjustments
// and markup; the marketplace section is the last block, starting with one Mercado Livre channel slot.
describe("CalcularPage — US4 labor + US5 outros custos + US1 marketplace", () => {
    it("renders the labor breakdown row and the empty 'Outros custos' slot (US4/US5)", () => {
        renderPage();

        // "Mão de obra" (breakdown row) is unique. The "Outros custos" slot title is present even with 0
        // sub-costs (the slot is always shown so the user can add named costs), but no admin line yet.
        expect(screen.getByText(t.results.labor)).toBeInTheDocument();
        expect(screen.getByText(t.otherCosts.title)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.otherCosts.addCost })).toBeInTheDocument();
    });

    it("shows an ⓘ info tip on the labor + marketplace section titles", () => {
        renderPage();

        expect(screen.getByRole("button", { name: t.sectionInfo.labor.label })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: t.sectionInfo.marketplace.label }),
        ).toBeInTheDocument();
    });

    it("starts with one Amazon channel slot and its fee inputs (US1)", () => {
        renderPage();

        // 015/A11 ([F11a-006]) — o padrao era MERCADO_LIVRE, e o catalogo servido devolve `entries: []`
        // para ele ate a fatia ML existir: a primeira tela do recurso nao mostrava preco NENHUM. Passou
        // a ser AMAZON, que tem tabela — junto com o [F11a-007], que faz o campo "Comissao" mostrar a
        // aliquota aplicada em vez de um "0,00" que implica zero. Quando o ML tiver tarifas, isto volta.
        expect(
            screen.getByRole("combobox", { name: new RegExp(t.channels.marketplace) }),
        ).toHaveValue("AMAZON");
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

        // 016/PR-C homologação B1 — seed varejo 24,24 grossed up at 20% → 30,30 to advertise;
        // anúncio + líquido rows are shown.
        expect(screen.getByText("R$ 30,30")).toBeInTheDocument();
        expect(screen.getAllByText(t.results.listingPrice).length).toBeGreaterThan(0);
        expect(screen.getAllByText(t.results.netReceived).length).toBeGreaterThan(0);
    });
});

// US4 — the "Incluir marketplaces no preço" master toggle is pure UI visibility (owner-clarified):
// it shows/hides the whole marketplace section. The direct varejo/atacado headline never changes.
describe("CalcularPage — US4 'Incluir marketplaces no preço' visibility toggle", () => {
    it("defaults ON: the switch is checked and the marketplace section is visible", () => {
        renderPage();

        expect(screen.getByRole("switch", { name: t.channels.includeToggle })).toBeChecked();
        expect(screen.getByRole("button", { name: t.channels.addChannel })).toBeInTheDocument();
        expect(screen.getByText(t.channels.pricesTitle)).toBeInTheDocument();
    });

    it("toggling OFF hides the whole marketplace section but keeps the direct headline", () => {
        renderPage();

        fireEvent.click(screen.getByRole("switch", { name: t.channels.includeToggle }));

        const toggle = screen.getByRole("switch", { name: t.channels.includeToggle });
        expect(toggle).not.toBeChecked();
        // The channel machinery is gone: no "Adicionar canal", no "Preços por canal".
        expect(
            screen.queryByRole("button", { name: t.channels.addChannel }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(t.channels.pricesTitle)).not.toBeInTheDocument();
        // …but the direct varejo headline the seller reads first is untouched (016/PR-C B1 seed
        // varejo R$ 24,24). 019/PR-F (T142, adoção) — o valor quebra em spans dentro do `price-hero`.
        expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*24,24/);
    });

    it("toggling OFF then ON restores the marketplace section (the switch stays reachable)", () => {
        renderPage();

        const toggle = screen.getByRole("switch", { name: t.channels.includeToggle });
        fireEvent.click(toggle);
        expect(screen.queryByText(t.channels.pricesTitle)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("switch", { name: t.channels.includeToggle }));
        expect(screen.getByText(t.channels.pricesTitle)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.channels.addChannel })).toBeInTheDocument();
    });
});

// US5 — "Outros custos" is a slot of 0..N named sub-costs. Adding one shows it as its own breakdown
// line; removing it drops the line; a bad value errors only its row while the price still computes.
describe("CalcularPage — US5 itemized 'Outros custos' slot", () => {
    const oc = t.otherCosts;

    it("starts empty; adding a named sub-cost shows it as its own breakdown line", () => {
        renderPage();
        expect(screen.queryByTestId("other-cost-row")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: oc.addCost }));
        const row = screen.getByTestId("other-cost-row");
        fireEvent.change(within(row).getByRole("textbox", { name: oc.name }), {
            target: { value: "Embalagem" },
        });
        fireEvent.change(within(row).getByRole("textbox", { name: oc.value }), {
            target: { value: "3,00" },
        });

        // The named line appears in the breakdown with its rounded value.
        expect(screen.getByText("Embalagem")).toBeInTheDocument();
        expect(screen.getAllByText("R$ 3,00").length).toBeGreaterThan(0);
    });

    it("removing a sub-cost drops both its row and its breakdown line", () => {
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: oc.addCost }));
        const row = screen.getByTestId("other-cost-row");
        // "Etiqueta" — a name that doesn't collide with any DS label (e.g. the channel "Frete" field).
        fireEvent.change(within(row).getByRole("textbox", { name: oc.name }), {
            target: { value: "Etiqueta" },
        });
        fireEvent.change(within(row).getByRole("textbox", { name: oc.value }), {
            target: { value: "2,00" },
        });
        expect(screen.getByText("Etiqueta")).toBeInTheDocument();

        fireEvent.click(within(row).getByRole("button", { name: oc.removeCost }));
        expect(screen.queryByTestId("other-cost-row")).not.toBeInTheDocument();
        expect(screen.queryByText("Etiqueta")).not.toBeInTheDocument();
    });

    it("a negative sub-cost value shows an inline error but the price still computes (FR-116)", () => {
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: oc.addCost }));
        const row = screen.getByTestId("other-cost-row");
        fireEvent.change(within(row).getByRole("textbox", { name: oc.value }), {
            target: { value: "-5" },
        });

        expect(within(row).getByText(t.validation.negative)).toBeInTheDocument();
        // No error wall — the headline varejo price is still shown, never a NaN.
        expect(screen.getAllByText(t.results.retail).length).toBeGreaterThan(0);
        expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    });
});
