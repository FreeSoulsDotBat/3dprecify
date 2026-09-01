// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BomLineOut, BomOut, ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T004 — the BOM composer (US1, research R7 wiring): a PREMIUM user composes ad-hoc +
// catalog-referenced lines with quantities and reads a live per-line + assembly breakdown.
// Every money number on this page comes from `computeBom` via `composeBom` (ux §0.2) — these
// tests assert the rendered outcome, not any view-layer arithmetic. Teaser specifics are T007.

const { useEntitlementMock, useProductsMock, useFeeCatalogMock, useBomsMock, useSearchMock } =
    vi.hoisted(() => ({
        useEntitlementMock: vi.fn(),
        useProductsMock: vi.fn(),
        useFeeCatalogMock: vi.fn(),
        useBomsMock: vi.fn(),
        useSearchMock: vi.fn(),
    }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn(), useSearch: () => useSearchMock() };
});
vi.mock("@/entities/bom/use-bom", () => ({
    useBoms: () => useBomsMock(),
    useCreateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const emptyBoms = {
    items: [] as unknown[],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
};
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
    return { ...actual, useProducts: () => useProductsMock() };
});
// Deterministic fee context: an EMPTY catalog by default (no pre-fill), a controlled ML entry
// where a test PINS the catalog→ctx→rollup wiring (review major: with only an empty catalog,
// dropping the page's ctx threading would stay green).
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
    return { ...actual, useFeeCatalog: () => useFeeCatalogMock() };
});

const EMPTY_FEES = {
    catalogVersion: "test-0",
    schemaVersion: "1",
    generatedAt: "2026-01-01T00:00:00Z",
    marketplaces: [],
};
/** ML Clássico 10% / no fixed fee: anúncio varejo do default line = 24,24 / 0,9 = 26,93 (016/PR-C
 *  homologação B1 — o seed mudou de 20,60/30,90/26,78 para 16,16/24,24/21,01, conferido rodando
 *  computeCalculator/grossUp com o novo seed, não chutado). */
const CATALOG_FEES = {
    catalogVersion: "test-1",
    schemaVersion: "1",
    generatedAt: "2026-01-01T00:00:00Z",
    marketplaces: [
        {
            // 015/A11 ([F11a-006]) — o slot em branco nasce AMAZON, nao MERCADO_LIVRE. A fixture acompanha
            // o padrao: o assunto deste teste e "o slot em branco e pre-preenchido PELO CATALOGO", e ele
            // so prova isso se a entrada cobrir o marketplace que o slot realmente traz.
            marketplace: "AMAZON",
            entries: [
                {
                    determinants: { plan: "PROFISSIONAL" }, // Amazon's determinant key (fee-prefill slotDeterminants)
                    commissionPct: 10,
                    fixedFee: 0,
                    priceBands: null,
                    freight: { kind: "NONE" },
                    source: "referência de teste",
                    sourceUrl: "https://example.com/fees",
                    effectiveDate: "2026-01-01",
                    lastReviewed: "2026-01-01",
                },
            ],
        },
    ],
};

function mockFees(catalog: unknown = EMPTY_FEES) {
    useFeeCatalogMock.mockReturnValue({
        catalog,
        source: "catalog" as const,
        refreshFailed: false,
        refreshing: false,
        refetch: vi.fn(),
    });
}

import { BomPage } from "./bom-page";

const t = messages.bom;
const pt = messages.premiumTeaser.KITS;

/** SC-001-shaped saved product (wire decimal strings), re-baseline SEM wasteGrams (016/US10):
 *  custo 27,55 · varejo 41,33 (per unit). */
const productP: ProductOut = {
    id: "p1",
    name: "Vaso G",
    filamentId: "f1",
    printerId: "pr1",
    filamentValues: { material: "PLA", costPerRoll: "100.00", rollWeightKg: "1.000" },
    printerValues: {
        machineValue: "4000.00",
        machineLifetimeHours: "2000",
        avgPowerKw: "0.100",
        maintenanceReservePerHour: "0",
    },
    pieceInputs: {
        printGrams: "100",
        printTimeHours: "5",
        failurePct: "10",
        finishTimeHours: "0.5",
        finishRatePerHour: "10.00",
        laborHours: "0",
        laborRatePerHour: "0",
        markupVarejoPct: "50",
        markupAtacadoPct: "30",
    },
    tariffPerKwh: "1.00",
    includeMarketplace: true,
    channels: [],
    otherCosts: [],
    sellerFixedPrice: null,
    sellerFixedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
};

function listState(items: ProductOut[]) {
    return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPremiumPage(products: ProductOut[] = []) {
    useSessionStore.setState({ status: "authenticated" });
    useEntitlementMock.mockReturnValue({
        data: { status: "active" },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    });
    useProductsMock.mockReturnValue(listState(products));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BomPage />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    mockFees(); // empty catalog default; a test overrides with mockFees(CATALOG_FEES)
    useSearchMock.mockReturnValue({}); // no ?id → fresh composer; a reopen test overrides with { id }
    useBomsMock.mockReturnValue(emptyBoms); // no saved kits by default
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("BomPage — server-informed gate (ADR-0015, US1-4)", () => {
    it("premium (active) reaches the composer: approved K1 copy + empty state + add affordance", () => {
        renderPremiumPage();
        // SC-410 copy half: the owner-approved title/subtitle are live on the page.
        expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
        expect(screen.getByText(t.subtitle)).toBeInTheDocument();
        expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: new RegExp(t.addLine) })).toBeInTheDocument();
        // Review IA nit (2026-07-12): the empty composer also links to the seller's saved kits, not
        // only the nav tab.
        expect(screen.getByRole("button", { name: t.viewKits })).toBeInTheDocument();
    });

    it("a failed fee-catalog refresh is surfaced ONCE, kit-wide, with a retry (honest, non-blocking)", () => {
        mockFees();
        useFeeCatalogMock.mockReturnValue({
            catalog: EMPTY_FEES,
            source: "cache" as const,
            refreshFailed: true,
            refreshing: false,
            refetch: vi.fn(),
        });
        renderPremiumPage();

        // The composer still renders (non-blocking) AND says the fees may be stale, with a retry.
        expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
        expect(
            screen.getByText(messages.calculator.channels.refreshErrorTitle),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: messages.calculator.channels.refreshRetry }),
        ).toBeInTheDocument();
    });

    // Review major (2026-07-11): in React Query v5 a failed BACKGROUND refetch flips isError while
    // `data` keeps the last server answer. That state must NOT tear the composer down (it would
    // destroy every composed line); the wall is only for "no server answer at all".
    it("a refetch error WITH last-known active data keeps the composer mounted (stale, honest)", () => {
        useSessionStore.setState({ status: "authenticated" });
        useEntitlementMock.mockReturnValue({
            data: { status: "active" },
            isLoading: false,
            // The read failed but the server's word survives — in memory from this session, or (009/T011b)
            // from the persisted last-known answer. `stale`, not `isError`: the wall is only for "no
            // answer at all".
            isError: false,
            stale: true,
            refetch: vi.fn(),
        });
        useProductsMock.mockReturnValue(listState([]));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <BomPage />
            </QueryClientProvider>,
        );
        expect(screen.getByText(t.emptyTitle)).toBeInTheDocument(); // composer stays
        expect(screen.queryByRole("button", { name: t.guardRetry })).not.toBeInTheDocument();
        // The failed re-check is stated calmly, not hidden (truth over approval).
        expect(screen.getByText(t.guardError)).toBeInTheDocument();
    });

    // Review minor (2026-07-11): session "loading" was rendered as the signed-out teaser — a brief
    // false "entre e ative o Premium" for a premium user during session bootstrap.
    it("session 'loading' shows the checking state, never the signed-out teaser", () => {
        useSessionStore.setState({ status: "loading" });
        useEntitlementMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });
        useProductsMock.mockReturnValue(listState([]));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <BomPage />
            </QueryClientProvider>,
        );
        expect(screen.getByText(t.guardChecking)).toBeInTheDocument();
        expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
        expect(screen.queryByTestId("premium-teaser")).not.toBeInTheDocument();
    });

    it("while the entitlement check is in flight, neither composer nor teaser renders (honest wait)", () => {
        useSessionStore.setState({ status: "authenticated" });
        useEntitlementMock.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn(),
        });
        useProductsMock.mockReturnValue(listState([]));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <BomPage />
            </QueryClientProvider>,
        );
        expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
        expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    });

    it("an entitlement FETCH ERROR is an honest retry state — never the composer, never the teaser", () => {
        useSessionStore.setState({ status: "authenticated" });
        useEntitlementMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: vi.fn(),
        });
        useProductsMock.mockReturnValue(listState([]));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <BomPage />
            </QueryClientProvider>,
        );
        expect(screen.getByText(t.guardError)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.guardRetry })).toBeInTheDocument();
        expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
        expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    });
});

describe("BomPage — compose ad-hoc lines (US1-1/US1-2)", () => {
    it("adding a line shows it (Peça 1, avulsa) with the default per-unit price live", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        // Line header: "Peça 1" + "(avulsa)"; defaults compute custo 16,16 (016/PR-C homologação B1
        // seed: machine 4000/3600h → machine 5,56, custo_total 16,16).
        expect(screen.getByText(new RegExp(t.lineLabel.replace("{n}", "1")))).toBeInTheDocument();
        expect(screen.getByText(new RegExp("\\(avulsa\\)"))).toBeInTheDocument();
        expect(screen.getAllByText(/R\$\s?16,16/).length).toBeGreaterThan(0);
        // The assembly summary is present with the same honest total.
        expect(screen.getByText(t.assemblyTitle)).toBeInTheDocument();
    });

    it("changing the quantity recomputes the line total and the assembly live (×3 → 48,48)", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        const qty = screen.getByRole("textbox", { name: new RegExp(t.quantity) });
        fireEvent.change(qty, { target: { value: "3" } });
        expect(screen.getAllByText(/R\$\s?48,48/).length).toBeGreaterThan(0);
    });

    it("a blank quantity marks the line invalid honestly (captioned, excluded) — never a crash", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        const qty = screen.getByRole("textbox", { name: new RegExp(t.quantity) });
        fireEvent.change(qty, { target: { value: "" } });
        expect(screen.getByText(t.lineInvalid)).toBeInTheDocument();
        expect(screen.getAllByText(/R\$\s?0,00/).length).toBeGreaterThan(0); // assembly honest zero
    });

    it("quantity 0 is an honest zero: captioned, listed, contributing nothing (edge)", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        const qty = screen.getByRole("textbox", { name: new RegExp(t.quantity) });
        fireEvent.change(qty, { target: { value: "0" } });
        expect(screen.getByText(t.qtyZero)).toBeInTheDocument();
        // The line stays listed; the assembly total reads zero.
        expect(screen.getByText(new RegExp(t.lineLabel.replace("{n}", "1")))).toBeInTheDocument();
        expect(screen.getAllByText(/R\$\s?0,00/).length).toBeGreaterThan(0);
    });

    it("two lines sum independently (Q1) and removing one updates the total live (US1 remove)", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        // 2 × default line (16,16) = 32,32 — read from the engine, never summed in JSX.
        expect(screen.getAllByText(/R\$\s?32,32/).length).toBeGreaterThan(0);
        const removeButtons = screen.getAllByRole("button", { name: new RegExp(t.removeLine) });
        expect(removeButtons).toHaveLength(2);
        fireEvent.click(removeButtons[1]);
        expect(screen.queryByText(/R\$\s?32,32/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/R\$\s?16,16/).length).toBeGreaterThan(0);
    });
});

describe("BomPage — catalog-referenced line (US1/Q2, live product → PriceInput)", () => {
    it("binding a saved product pre-fills the line and prices it from the product's LIVE values", () => {
        renderPremiumPage([productP]);
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        const picker = screen.getByRole("combobox", { name: new RegExp(t.useProduct) });
        fireEvent.change(picker, { target: { value: "p1" } });
        // 016/US10 — re-baseline: custo 27,55 /un from the product's wire values.
        expect(screen.getAllByText(/R\$\s?27,55/).length).toBeGreaterThan(0);
        // The line header now carries the product name; provenance is sealed honestly.
        expect(screen.getAllByText(/Vaso G/).length).toBeGreaterThan(0);
        expect(
            screen.getByText(new RegExp(t.fromCatalog.replace("{nome}", "Vaso G"))),
        ).toBeInTheDocument();
    });

    it("a catalog-bound line ×qty scales through the engine (3 × 27,55 = 82,65)", () => {
        renderPremiumPage([productP]);
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        fireEvent.change(screen.getByRole("combobox", { name: new RegExp(t.useProduct) }), {
            target: { value: "p1" },
        });
        fireEvent.change(screen.getByRole("textbox", { name: new RegExp(t.quantity) }), {
            target: { value: "3" },
        });
        expect(screen.getAllByText(/R\$\s?82,65/).length).toBeGreaterThan(0);
    });
});

// The §1.3 secondary disclosure keeps a line short: optional/labor/outros/marketplace collapse
// under one affordance; its accessible label is composed from the existing section titles.
// 016/US9 — "Ajustes opcionais" retired (its fields joined this SAME disclosure instead of their
// own title — bom-line-editor.tsx), so the composed label drops that name too.
const advancedLabel = [
    messages.calculator.sections.labor,
    messages.calculator.otherCosts.title,
    messages.calculator.sections.marketplace,
].join(" · ");

/** Open the expanded line's secondary disclosure, then type a commission (calcular.test idiom —
 *  the accessible name carries the "opcional" tag). */
function typeCommission(value: string) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) }));
    const commission = screen.getByRole("textbox", {
        name: (n) => n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
    });
    fireEvent.change(commission, { target: { value } });
}

describe("BomPage — line density (ux §1.3 secondary disclosure)", () => {
    it("a fresh line keeps the secondary sections collapsed — only Custos da peça pays the height", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        // The disclosure affordance is visible; the sections behind it are not mounted yet.
        expect(screen.getByRole("button", { name: new RegExp(advancedLabel) })).toBeInTheDocument();
        expect(
            screen.queryByRole("textbox", {
                name: (n) =>
                    n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
            }),
        ).not.toBeInTheDocument();
        // The primary sections stay visible (mandatory costs + the per-unit price).
        expect(
            screen.getByRole("textbox", {
                name: new RegExp(messages.calculator.fields.costPerRoll),
            }),
        ).toBeInTheDocument();
    });

    it("opening the disclosure reveals the marketplace section (and the rest)", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) }));
        expect(
            screen.getByRole("textbox", {
                name: (n) =>
                    n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
            }),
        ).toBeInTheDocument();
    });
});

describe("BomPage — per-channel rollup (US1/FR-403, honest by construction)", () => {
    // Review major (2026-07-11): pins the page's fee-catalog ctx threading — this number can ONLY
    // come from the catalog entry pre-filling the default blank slot (016/PR-C homologação B1:
    // 24,24 / 0,9 = 26,93 — the new seed's varejo).
    it("a catalog-covered blank slot pre-fills and rolls up from the CATALOG fees", () => {
        mockFees(CATALOG_FEES);
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        const rollup = screen.getByText(t.channelsTitle).closest("section, div");
        expect(rollup).not.toBeNull();
        expect(within(rollup as HTMLElement).getAllByText(/26,93/).length).toBeGreaterThan(0);
    });

    it("a line with a manual channel fee rolls up under the kit channels card", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        // The default line ships one Mercado Livre slot with blank fees; over the EMPTY test catalog
        // nothing pre-fills, so type a manual 20% commission: anúncio varejo = 24,24 / 0,8 = 30,30
        // (016/PR-C homologação B1 — the new seed).
        typeCommission("20");
        const rollup = screen.getByText(t.channelsTitle).closest("section, div");
        expect(rollup).not.toBeNull();
        expect(within(rollup as HTMLElement).getAllByText(/30,30/).length).toBeGreaterThan(0);
    });

    // T006b top nit: a FORM-invalid channel slot (commission ≥ 100) never reaches the engine, so
    // it must surface in the assembly rollup as an honest skipped count — never a silent drop
    // from "N peça(s) somaram" (ux §1.7).
    it("a form-invalid slot on one line surfaces as skipped in the rollup, siblings still sum", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        // Line 2 is the expanded one — make its ML slot invalid (commission 100).
        typeCommission("100");
        // Line 1 (default ML slot, zero fees) still contributes; line 2 is counted as skipped.
        const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
        expect(
            within(rollup).getByText(t.channelContributing.replace("{n}", "1")),
        ).toBeInTheDocument();
        expect(within(rollup).getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
    });

    it("a marketplace whose ONLY slot is form-invalid still gets an honest rollup block", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        typeCommission("100");
        const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
        expect(within(rollup).getByText(t.channelNoContrib)).toBeInTheDocument();
        expect(within(rollup).getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
        // Honest absence — never a fabricated R$ 0,00 price in the block.
        expect(within(rollup).queryByText(/R\$\s?0,00/)).not.toBeInTheDocument();
    });

    // Pins the widget's documented claim: collapsing UNMOUNTS the sections but RHF keeps the
    // values, so a collapsed bad fee still rolls up as skipped (review finding, 2026-07-11).
    it("a bad fee stays excluded+captioned after its disclosure collapses", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        typeCommission("100"); // opens the disclosure and types the invalid fee
        fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) })); // collapse
        const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
        expect(within(rollup).getByText(t.channelSkipped.replace("{n}", "1"))).toBeInTheDocument();
    });

    // Mixed rule (lines-not-slots, aligned with pricing-core): a line with one valid + one invalid
    // slot of the same marketplace CONTRIBUTED — it must not also read as skipped.
    it("one valid + one form-invalid slot of the same marketplace: contributes, never 'sem preço'", () => {
        renderPremiumPage();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
        fireEvent.click(screen.getByRole("button", { name: new RegExp(advancedLabel) }));
        fireEvent.click(
            screen.getByRole("button", { name: messages.calculator.channels.addChannel }),
        ); // second ML slot
        const commissions = screen.getAllByRole("textbox", {
            name: (n) =>
                n.startsWith(messages.calculator.channels.commission) && !n.includes("mínima"),
        });
        expect(commissions).toHaveLength(2);
        fireEvent.change(commissions[0], { target: { value: "20" } });
        fireEvent.change(commissions[1], { target: { value: "100" } }); // invalid sibling slot
        const rollup = screen.getByText(t.channelsTitle).closest("section, div") as HTMLElement;
        expect(
            within(rollup).getByText(t.channelContributing.replace("{n}", "1")),
        ).toBeInTheDocument();
        expect(within(rollup).queryByText(/sem preço neste marketplace/)).not.toBeInTheDocument();
        expect(within(rollup).getAllByText(/30,30/).length).toBeGreaterThan(0); // valid slot's money (016/PR-C B1 seed)
    });
});

// PR-C freshness fix (homologation blocker): the composer used to hydrate a reopened kit ONCE per
// id and lock on the first (stale) paint — so after a referenced product was deleted, the kit kept
// showing it as a LIVE reference. The fix re-hydrates when the SERVER-resolved lines change (the
// signature), while keeping the PR-B clobber guard for in-progress edits.
const liveLine: BomLineOut = {
    id: "l1",
    position: 0,
    quantity: 2,
    productId: "p1",
    pieceName: "Vaso G",
    degraded: false,
    pieceInputs: productP.pieceInputs,
    filamentValues: productP.filamentValues,
    printerValues: productP.printerValues,
    tariffPerKwh: productP.tariffPerKwh,
    includeMarketplace: productP.includeMarketplace,
    channels: productP.channels,
    otherCosts: productP.otherCosts,
};
const degradedLine: BomLineOut = { ...liveLine, productId: null, pieceName: null, degraded: true };
const liveKit: BomOut = {
    id: "k1",
    name: "Kit A",
    lines: [liveLine],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
};
const degradedKit: BomOut = { ...liveKit, lines: [degradedLine] };

// A FRESH element tree per render — reusing one element object triggers React's element-reference
// bailout (the child skips re-render), which would mask a real re-hydration bug. In the app, React
// Query's subscription drives this re-render when the kits query refetches.
function bomTree(client: QueryClient) {
    return (
        <QueryClientProvider client={client}>
            <BomPage />
        </QueryClientProvider>
    );
}

function reopenKit(kit: BomOut, products: ProductOut[]) {
    useSessionStore.setState({ status: "authenticated" });
    useEntitlementMock.mockReturnValue({
        data: { status: "active" },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    });
    useProductsMock.mockReturnValue(listState(products));
    useSearchMock.mockReturnValue({ id: "k1" });
    useBomsMock.mockReturnValue({ ...emptyBoms, items: [kit] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { client, ...render(bomTree(client)) };
}

describe("BomPage — reopen re-hydrates on fresh server truth (D6 degrade, PR-C blocker)", () => {
    it("a live→degraded kit refetch re-hydrates: the deleted product stops showing as live", async () => {
        const { client, rerender } = reopenKit(liveKit, [productP]);
        // Reopened live: the line carries the product name and its price.
        expect(screen.getAllByText(/Vaso G/).length).toBeGreaterThan(0);
        expect(screen.queryByText(messages.productForm.manualValuesKept)).not.toBeInTheDocument();

        // The product is deleted → the kits list refetches degraded. The composer must re-hydrate.
        useBomsMock.mockReturnValue({ ...emptyBoms, items: [degradedKit] });
        useProductsMock.mockReturnValue(listState([]));
        rerender(bomTree(client));

        await waitFor(() =>
            expect(screen.getByText(messages.productForm.manualValuesKept)).toBeInTheDocument(),
        );
        expect(screen.getByText(new RegExp("\\(avulsa\\)"))).toBeInTheDocument();
        // The honesty core: the deleted product is NO LONGER presented as a live reference.
        expect(screen.queryByText(/Vaso G/)).not.toBeInTheDocument();
    });

    it("an in-progress edit is NOT clobbered when newer server content arrives (PR-B guard kept)", () => {
        const { client, rerender } = reopenKit(liveKit, [productP]);
        // The seller edits the quantity → the composer is now dirty.
        fireEvent.change(screen.getByRole("textbox", { name: new RegExp(t.quantity) }), {
            target: { value: "5" },
        });

        // A background refetch brings the degraded version — it must NOT overwrite the edit.
        useBomsMock.mockReturnValue({ ...emptyBoms, items: [degradedKit] });
        rerender(bomTree(client));

        expect(screen.getByRole("textbox", { name: new RegExp(t.quantity) })).toHaveValue("5");
        expect(screen.queryByText(messages.productForm.manualValuesKept)).not.toBeInTheDocument();
        // Still shows the (now-stale) live reference — the seller keeps their work; they will see the
        // degraded truth on the next CLEAN reopen. Preserving edits beats a surprise overwrite.
        expect(screen.getAllByText(/Vaso G/).length).toBeGreaterThan(0);
    });
});

// 016/T072-A10 — a LAPSED seller reopening a saved kit (`?id=…`) must reach the composer (FR-409:
// reads/recompute survive a lapse). `openedKit` is a `find()` over the kits list, which starts
// EMPTY while still loading.
// 019/PR-B (T110, DECISÃO 3, 27/08): a parede de CRIAÇÃO (`t.lapsedTitle`/`t.lapsedBody`) que
// existia para "id não encontrado" SAIU junto com a de criação — não há mais painel especial a
// flashar; o composer sempre monta, e "não encontrado" degrada para o mesmo vazio didático do
// grátis (0 linhas). Os dois primeiros testes continuam válidos como estavam (o comportamento que
// verificavam não mudou); o terceiro está invertido.
describe("BomPage — T072-A10 + T046: lapsed reopen reaches the composer, id-not-found degrades to the vazio", () => {
    function reopenLapsed(boms: typeof emptyBoms) {
        useSessionStore.setState({ status: "authenticated" });
        useEntitlementMock.mockReturnValue({
            data: { status: "lapsed" },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });
        useProductsMock.mockReturnValue(listState([productP]));
        useSearchMock.mockReturnValue({ id: "k1" });
        useBomsMock.mockReturnValue(boms);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return render(bomTree(client));
    }

    it("kits list still LOADING: no reactivation copy (there is none anymore) while it hydrates", () => {
        reopenLapsed({ ...emptyBoms, items: [], isLoading: true });
        expect(screen.queryByText(t.lapsedTitle)).not.toBeInTheDocument();
        expect(screen.queryByText(t.lapsedBody)).not.toBeInTheDocument();
    });

    it("kits list LOADED with the kit found: reaches the composer, honest lapsed banner alongside it", () => {
        reopenLapsed({ ...emptyBoms, items: [liveKit], isLoading: false });
        // The CREATE-only reactivation copy must be absent — this is a reopen, not a create.
        expect(screen.queryByText(t.lapsedTitle)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Vaso G/).length).toBeGreaterThan(0);
        expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
    });

    it("kits list LOADED, id genuinely not found: composer degrades to the vazio didático (T046, inverte o antigo)", () => {
        // O teste antigo esperava o painel de reativação (`t.lapsedTitle`) — ele saiu (DECISÃO 3). Sem
        // o kit encontrado, `lines` fica vazio e o gate=lapsed cai no MESMO vazio didático do grátis.
        reopenLapsed({ ...emptyBoms, items: [], isLoading: false });
        expect(screen.queryByText(t.lapsedTitle)).not.toBeInTheDocument();
        expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
        // A faixa de topo (§32e "sai") não existe mais nesta tela — só o `lapsedBanner`, mantido.
        expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
    });
});
