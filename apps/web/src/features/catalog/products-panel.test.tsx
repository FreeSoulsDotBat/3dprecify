// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US6/T030 — the Produtos tab panel. Create/edit are FULL PAGE routes (ux §1.6b), so the panel
// navigates instead of opening the Sheet; delete keeps the confirm Dialog. The row summary shows
// the reference names ("filamento · impressora") — NEVER a stored price (FR-310: a row price
// would imply a snapshot; prices recompute on open).

const { navigateMock, useProductsMock, useFilamentsMock, usePrintersMock, entitlementStatus } =
    vi.hoisted(() => ({
        navigateMock: vi.fn(),
        useProductsMock: vi.fn(),
        useFilamentsMock: vi.fn(),
        usePrintersMock: vi.fn(),
        entitlementStatus: { current: "active" as "active" | "lapsed" | "none" },
    }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
    return {
        ...actual,
        useProducts: () => useProductsMock(),
        useFilaments: () => useFilamentsMock(),
        usePrinters: () => usePrintersMock(),
        useDeleteProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
        // 019/PR-D (T068) — o diálogo de duplicar (17d) usa `useCreateProduct` direto no painel; sem
        // este stub o teste precisaria de um `QueryClientProvider` real só para montar o componente.
        useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
    };
});
// F-lapsed: the panel now reads its own lapsed state (mutable so a test can flip it).
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({ data: { status: entitlementStatus.current }, isLoading: false }),
}));

import { ProductsPanel } from "./products-panel";

const catalogo = messages.catalog;

function listState(items: unknown[]) {
    return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

const product = {
    id: "prod-1",
    name: "Vaso G",
    filamentId: "f-1",
    printerId: "p-1",
    filamentValues: { material: "PLA", costPerRoll: "110.00", rollWeightKg: "1.000" },
    printerValues: {
        machineValue: "1200.00",
        machineLifetimeHours: "2000.000",
        avgPowerKw: "0.1200",
        maintenanceReservePerHour: "0.500000",
    },
    pieceInputs: {
        printGrams: "100.000",
        printTimeHours: "5.000",
        failurePct: "0.000",
        finishTimeHours: "0.000",
        finishRatePerHour: "0.000000",
        laborHours: "0.000",
        laborRatePerHour: "0.000000",
        markupVarejoPct: "50.000",
        markupAtacadoPct: "30.000",
    },
    tariffPerKwh: "1.000000",
    includeMarketplace: true,
    channels: [],
    otherCosts: [],
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T00:00:00Z",
};

beforeEach(() => {
    useProductsMock.mockReturnValue(listState([]));
    useFilamentsMock.mockReturnValue(
        listState([{ id: "f-1", name: "PLA Azul", costPerRoll: "110.00", rollWeightKg: "1.000" }]),
    );
    usePrintersMock.mockReturnValue(listState([{ id: "p-1", name: "Ender 3" }]));
    entitlementStatus.current = "active";
    // 019/PR-B (T044) — `premiumGate()` também lê a sessão; sem isto o gate cairia em "signed-out"
    // e os testes "active" leriam o vazio didático em vez da lista/CRUD de sempre.
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u-1", email: "u@x.dev" } as never,
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

describe("ProductsPanel — Produtos tab (US6/T030)", () => {
    it("empty state offers the add action, which navigates to the full-page create route", () => {
        render(<ProductsPanel />);

        expect(screen.getByText(catalogo.emptyProductsTitle)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: catalogo.addProduct }));
        // 013/F-02: the create form is a search param on /catalogo now, not a 2-segment route.
        expect(navigateMock).toHaveBeenCalledWith({ to: "/catalogo", search: { produto: "novo" } });
    });

    it("lists products with the REFERENCE names as summary — never a price", () => {
        useProductsMock.mockReturnValue(listState([product]));
        render(<ProductsPanel />);

        expect(screen.getByText("Vaso G")).toBeInTheDocument();
        expect(screen.getByText("PLA Azul · Ender 3")).toBeInTheDocument();
        expect(screen.getByText(catalogo.countProducts.replace("{n}", "1"))).toBeInTheDocument();
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    });

    it("labels a degraded reference as manual in the summary", () => {
        useProductsMock.mockReturnValue(listState([{ ...product, filamentId: null }]));
        render(<ProductsPanel />);

        expect(screen.getByText(`${catalogo.manualRef} · Ender 3`)).toBeInTheDocument();
    });

    it("FB-04: shows a neutral loading placeholder while references are still loading — never 'manual'", () => {
        useProductsMock.mockReturnValue(listState([product]));
        useFilamentsMock.mockReturnValue({
            items: [],
            isLoading: true,
            isError: false,
            error: null,
            stale: false,
            refetch: vi.fn(),
        });
        usePrintersMock.mockReturnValue({
            items: [],
            isLoading: true,
            isError: false,
            error: null,
            stale: false,
            refetch: vi.fn(),
        });
        render(<ProductsPanel />);

        expect(
            screen.getByText(`${catalogo.resolvingRef} · ${catalogo.resolvingRef}`),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(`${catalogo.manualRef} · ${catalogo.manualRef}`),
        ).not.toBeInTheDocument();
    });

    it("row tap navigates to the full-page edit route", () => {
        useProductsMock.mockReturnValue(listState([product]));
        render(<ProductsPanel />);

        fireEvent.click(screen.getByText("Vaso G"));
        expect(navigateMock).toHaveBeenCalledWith({
            to: "/catalogo",
            search: { produto: "prod-1" },
        });
    });

    // F-lapsed (confirmation audit) — the Produtos tab must honor the lapsed state like its siblings.
    it("active: shows the products (no lapsed banner)", () => {
        useProductsMock.mockReturnValue(listState([product]));
        render(<ProductsPanel />);
        expect(screen.getByText("Vaso G")).toBeInTheDocument();
        expect(screen.queryByText("Premium pausado")).not.toBeInTheDocument();
    });

    it("lapsed: reads sobrevivem SEM a faixa 'Premium pausado' (019/PR-B T038), delete abre o intercept de reativação, NÃO a confirmação de verdade", () => {
        entitlementStatus.current = "lapsed";
        useProductsMock.mockReturnValue(listState([product]));
        render(<ProductsPanel />);

        // Reads survive: the product is still listed (FR-409 + ux-catalog §3); a faixa saiu no T038.
        expect(screen.getByText("Vaso G")).toBeInTheDocument();
        expect(screen.queryByText("Premium pausado")).not.toBeInTheDocument();

        // Tapping delete must reach the honest reactivation surface — for products (navigation mode)
        // the row/delete affordance leads to the read-only page, NEVER the working destructive confirm.
        fireEvent.click(screen.getByRole("button", { name: `${catalogo.remove} Vaso G` }));
        expect(screen.queryByText(messages.catalogForm.deleteBody)).not.toBeInTheDocument();
    });
});

// 019/PR-D (T068, pranchetas 16/17) — o recálculo do Catálogo: preço/era/flag por prop (a page
// injeta `recomputed`/`observations`/`changed`; o painel é PURO — nada aqui chama
// `entities/catalog/price-observations` diretamente).
describe("ProductsPanel — o recálculo do Catálogo (019/PR-D T068)", () => {
    function n(id: string, name: string, over: Record<string, unknown> = {}) {
        return { ...product, id, name, ...over };
    }

    it("3 preços mudaram desde a última visita: a faixa (plural) + 'era R$ 38,90' + 'Salvo em 12/05'", () => {
        const items = [
            n("p1", "Suporte", { updatedAt: "2026-05-12T00:00:00Z" }),
            n("p2", "Vaso", { updatedAt: "2026-05-09T00:00:00Z" }),
            n("p3", "Dragão", { updatedAt: "2026-04-28T00:00:00Z" }),
        ];
        useProductsMock.mockReturnValue(listState(items));
        render(
            <ProductsPanel
                recomputed={new Map([["p1", 41.2]])}
                observations={new Map([["p1", { observedPrice: 38.9, observedAt: "2026-05-12" }]])}
                changed={new Map([["p1", { was: 38.9, observedAt: "2026-05-12" }]])}
                changedCount={3}
            />,
        );

        expect(screen.getByTestId("products-price-changed-banner")).toHaveTextContent(
            catalogo.priceChangedCount.replace("{n}", "3"),
        );
        expect(screen.getByText("era R$ 38,90")).toBeInTheDocument();
        expect(screen.getByText("Salvo em 12/05")).toBeInTheDocument();
    });

    it("n=1: usa o singular priceChangedOne", () => {
        useProductsMock.mockReturnValue(listState([n("p1", "Suporte")]));
        render(<ProductsPanel changedCount={1} />);

        expect(screen.getByTestId("products-price-changed-banner")).toHaveTextContent(
            catalogo.priceChangedOne,
        );
    });

    it("fixado: mostra 'Preço fixado por você' (valor do vendedor) e a flag 'fixado' na lista", () => {
        useProductsMock.mockReturnValue(
            listState([
                n("p1", "Suporte", {
                    sellerFixedPrice: "38.90",
                    sellerFixedAt: "2026-06-04T00:00:00Z",
                }),
            ]),
        );
        render(<ProductsPanel recomputed={new Map([["p1", 41.2]])} />);

        expect(screen.getByText("R$ 38,90")).toBeInTheDocument();
        expect(screen.getByTestId("product-row-fixed")).toHaveTextContent(catalogo.fixedFlag);
    });

    // 019/PR-D (correção de fidelidade) — nenhuma prancheta (16a/16b/17c) desenha o aviso
    // "custo hoje > fixado" nem "Manter {valor}" NA LISTA; os dois vivem só no ITEM ABERTO
    // (`pages/catalogo/produto-page.test.tsx`). A LISTA nunca escreve — não sobrou prop para chamar.
    it("custo hoje > fixado NA LISTA: nenhum Alert/'Voltar a acompanhar o custo' (mora só na ficha)", () => {
        useProductsMock.mockReturnValue(
            listState([n("p1", "Suporte", { sellerFixedPrice: "38.90" })]),
        );
        render(<ProductsPanel recomputed={new Map([["p1", 41.2]])} />);

        expect(screen.queryByTestId("product-fixed-over-alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: catalogo.unfix })).not.toBeInTheDocument();
    });

    it("'Manter {valor}' NA LISTA: não renderiza nenhum botão (mora só na ficha)", () => {
        useProductsMock.mockReturnValue(listState([n("p1", "Suporte")]));
        render(
            <ProductsPanel
                recomputed={new Map([["p1", 41.2]])}
                changed={new Map([["p1", { was: 38.9, observedAt: "2026-05-12" }]])}
            />,
        );

        expect(
            screen.queryByRole("button", {
                name: catalogo.keepPrice.replace("{valor}", "R$ 38,90"),
            }),
        ).not.toBeInTheDocument();
    });

    it("nome repetido no diálogo de duplicar recusa ANTES do submit (nameConflict)", async () => {
        useProductsMock.mockReturnValue(
            listState([n("p1", "Gancho"), n("p2", "Vaso hexagonal 15 cm")]),
        );
        render(<ProductsPanel />);

        fireEvent.click(screen.getByRole("button", { name: `${catalogo.duplicate} Gancho` }));
        const dialog = await screen.findByTestId("product-duplicate-dialog");
        const nameInput = within(dialog).getByRole("textbox");
        fireEvent.change(nameInput, { target: { value: "Vaso hexagonal 15 cm" } });
        fireEvent.click(within(dialog).getByRole("button", { name: catalogo.duplicate }));

        expect(
            await within(dialog).findByText(messages.catalogForm.nameConflict),
        ).toBeInTheDocument();
    });

    it("duplicar: nome pré-preenchido com '(cópia)', cria com o wire do original (sem sellerFixedPrice)", async () => {
        const createMock = vi.fn().mockResolvedValue({});
        // 019/PR-D — reaproveita o mock hoisted de useCreateProduct via override local.
        const useCatalog = await import("@/entities/catalog/use-catalog");
        vi.spyOn(useCatalog, "useCreateProduct").mockReturnValue({
            mutateAsync: createMock,
            isPending: false,
        } as never);
        useProductsMock.mockReturnValue(
            listState([n("p1", "Gancho", { sellerFixedPrice: "38.90" })]),
        );
        render(<ProductsPanel />);

        fireEvent.click(screen.getByRole("button", { name: `${catalogo.duplicate} Gancho` }));
        const dialog = await screen.findByTestId("product-duplicate-dialog");
        expect(within(dialog).getByRole("textbox")).toHaveValue(
            `Gancho${catalogo.duplicateCopySuffix}`,
        );
        fireEvent.click(within(dialog).getByRole("button", { name: catalogo.duplicate }));

        await vi.waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        const body = createMock.mock.calls[0][0];
        expect(body.name).toBe(`Gancho${catalogo.duplicateCopySuffix}`);
        expect(body).not.toHaveProperty("sellerFixedPrice");
    });

    it("cópia de um produto degradado continua degradada (filamentId/printerId nulos herdados)", async () => {
        const createMock = vi.fn().mockResolvedValue({});
        const useCatalog = await import("@/entities/catalog/use-catalog");
        vi.spyOn(useCatalog, "useCreateProduct").mockReturnValue({
            mutateAsync: createMock,
            isPending: false,
        } as never);
        useProductsMock.mockReturnValue(listState([n("p1", "Gancho", { filamentId: null })]));
        render(<ProductsPanel />);

        fireEvent.click(screen.getByRole("button", { name: `${catalogo.duplicate} Gancho` }));
        const dialog = await screen.findByTestId("product-duplicate-dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: catalogo.duplicate }));

        await vi.waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock.mock.calls[0][0].filamentId).toBeNull();
    });

    it("degradado: sem preço, sem observação — nunca 'R$ 0,00'; flag 'parado' só quando a referência sumiu", () => {
        useProductsMock.mockReturnValue(
            listState([n("p1", "Chaveiro logo", { filamentId: null })]),
        );
        render(<ProductsPanel recomputed={new Map([["p1", 41.2]])} />);

        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    });

    it("degradado com uma observação salva (o preço 'parado' de quando o vínculo existia) mostra a flag e o valor congelado", () => {
        useProductsMock.mockReturnValue(
            listState([n("p1", "Chaveiro logo", { filamentId: null })]),
        );
        render(
            <ProductsPanel
                observations={new Map([["p1", { observedPrice: 9.5, observedAt: "2026-04-21" }]])}
            />,
        );

        expect(screen.getByText("R$ 9,50")).toBeInTheDocument();
        expect(screen.queryByTestId("product-row-fixed")).not.toBeInTheDocument(); // não é "fixado"
        expect(screen.getByText(catalogo.stoppedFlag)).toBeInTheDocument();
        expect(
            screen.getByText(catalogo.stoppedAtLabel.replace("{data}", "21/04")),
        ).toBeInTheDocument();
    });
});
