// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US6/T030 — the product full-page route (ux §1.6b): the calculator layout + a name + the two
// catalog pickers. NO stored price is ever shown — the page recomputes live via the EXISTING
// `computeFromForm` at the current PRICING_MODEL_VERSION (FR-310/FR-313); the SC-305 anchor
// numbers (016/PR-C homologação B1: seed R$ 24,24 / picked catalog R$ 25,65) must hold here
// exactly as in Calcular.
// Reopening a DEGRADED product (deleted reference) shows the calm info alert and the last-known
// values as ordinary editable fields (US6-4) — never blank, never broken.

const {
    navigateMock,
    useProductsMock,
    useFilamentsMock,
    usePrintersMock,
    createMock,
    updateMock,
    recordMock,
    entitlement,
    createScenarioMock,
    fixPriceMutateMock,
    observationsResult,
    observeMock,
} = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    useProductsMock: vi.fn(),
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    recordMock: vi.fn(),
    entitlement: { data: undefined as { status: string } | undefined },
    createScenarioMock: vi.fn(),
    fixPriceMutateMock: vi.fn(),
    observationsResult: {
        byKey: new Map<string, { observedPrice: number; observedAt: string; subjectId: string }>(),
    },
    observeMock: vi.fn(),
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
        useCreateProduct: () => ({ mutateAsync: createMock, isPending: false }),
        useUpdateProduct: () => ({ mutateAsync: updateMock, isPending: false }),
        // 019/PR-D (correção de fidelidade) — o alert "custo hoje > fixado" e "Manter/Aceitar" agora
        // vivem só na FICHA; este stub deixa a mutation observável sem um QueryClient real.
        useFixProductPrice: () => ({ mutate: fixPriceMutateMock, isPending: false }),
    };
});
vi.mock("@/entities/catalog/price-observations", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/price-observations")>();
    return {
        ...actual,
        usePriceObservations: () => ({
            byKey: observationsResult.byKey,
            isLoading: false,
            isError: false,
            error: null,
            entitlementDenied: false,
        }),
        useObservePrices: () => ({ observe: observeMock }),
    };
});
// US3/T019 — the record action on the product page needs the entitlement gate (server's last word)
// and the record mutation. Mocked so the button's presence and the frozen provenance are driven here.
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => entitlement }));
vi.mock("@/entities/history/use-history", () => ({
    useRecordSnapshot: () => ({ mutateAsync: recordMock, isPending: false }),
}));
// 010/T021b — the "Salvar cenário" affordance added to this page needs the same mutation hook the
// scenarios feature already tests in isolation; mocked here so this suite only asserts the WIRING
// (a PRODUCT ref captured, not AD_HOC), never re-tests the Sheet's own behavior.
vi.mock("@/entities/scenario/use-scenarios", () => ({
    useCreateScenario: () => ({ mutateAsync: createScenarioMock, isPending: false }),
}));

import { ProdutoPage } from "./produto-page";

const t = messages.calculator;
const pf = messages.productForm;

const filament = {
    id: "f-1",
    name: "PLA Azul",
    material: "PLA",
    costPerRoll: "110.00",
    rollWeightKg: "1.000",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
};
const printer = {
    id: "p-1",
    name: "Ender 3",
    machineValue: "1200.00",
    machineLifetimeHours: "2000.000",
    avgPowerKw: "0.1200",
    maintenanceReservePerHour: "0.500000",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
};
const savedProduct = {
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
    includeMarketplace: false,
    channels: [],
    otherCosts: [],
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T00:00:00Z",
};

function listState(items: unknown[]) {
    return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPage(productId?: string, gate: PremiumGate = "active") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ProdutoPage productId={productId} gate={gate} />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    useSessionStore.setState({
        status: "authenticated",
        user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useProductsMock.mockReturnValue(listState([savedProduct]));
    useFilamentsMock.mockReturnValue(listState([filament]));
    usePrintersMock.mockReturnValue(listState([printer]));
    createMock.mockResolvedValue(savedProduct);
    updateMock.mockResolvedValue(savedProduct);
    entitlement.data = { status: "active" };
    recordMock.mockResolvedValue({ clientSnapshotId: "csid-1", syncState: "synced" });
    observationsResult.byKey = new Map();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useSessionStore.setState({ status: "anonymous", user: null });
});

// 019/PR-F (T142, prancheta 10): o cartão grande divide o valor em `tf-price__cur/int/dec`, então
// "R$ 25,65" deixou de ser um nó de texto único — o matcher lê o `tf-price__amount` inteiro,
// sem espaços (a lição da PR-C: âncoras por elemento, não por substring solta).
function heroAmount(value: string) {
    const want = value.replace(/\s/g, "");
    return (_: string, el: Element | null) =>
        el?.classList.contains("tf-price__amount") === true &&
        (el.textContent ?? "").replace(/\s/g, "") === want;
}

describe("ProdutoPage — create (US6/T030)", () => {
    it("renders name + pickers + the calculator sections, recomputing live (seed R$ 24,24)", () => {
        renderPage();

        expect(screen.getByRole("textbox", { name: pf.nameLabel })).toBeInTheDocument();
        expect(
            screen.getByRole("combobox", { name: t.catalogPicker.filament }),
        ).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: t.catalogPicker.printer })).toBeInTheDocument();
        // Live recompute of the untouched defaults — same seed number as Calcular (FR-310). 016/PR-C
        // homologação B1 — the seed's varejo is now R$ 24,24 (machine 4000/3600h).
        expect(screen.getAllByText(heroAmount("R$ 24,24")).length).toBeGreaterThan(0);
    });

    it("picking the saved refs pre-fills editable fields and recomputes the SC-305 number", () => {
        renderPage();

        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
            target: { value: "f-1" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
            target: { value: "p-1" },
        });

        expect(screen.getByDisplayValue("110,00")).toBeInTheDocument();
        expect(screen.getByDisplayValue("1200,00")).toBeInTheDocument();
        expect(screen.getAllByText(heroAmount("R$ 25,65")).length).toBeGreaterThan(0);
    });

    it("saves through the wire mapping and navigates back to the catalog", async () => {
        renderPage();

        // 019/PR-D (T068, achado do coordenador) — "Vaso G" já é o nome de `savedProduct` na lista
        // carregada por padrão (`beforeEach`); um nome DIFERENTE prova o caminho feliz sem colidir com
        // a recusa nova de nome repetido (coberta em teste próprio, abaixo).
        fireEvent.change(screen.getByRole("textbox", { name: pf.nameLabel }), {
            target: { value: "Vaso H" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
            target: { value: "f-1" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
            target: { value: "p-1" },
        });
        fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

        await waitFor(() => expect(createMock).toHaveBeenCalled());
        const body = createMock.mock.calls[0][0];
        expect(body).toMatchObject({ name: "Vaso H", filamentId: "f-1", printerId: "p-1" });
        expect(body.pieceInputs.markupVarejoPct).toBe("50");
        expect(navigateMock).toHaveBeenCalledWith({ to: "/catalogo", search: { tab: "products" } });
    });

    // 019/PR-D (T068, achado do coordenador) — o mesmo intercepto do 17b/17d, agora no formulário
    // do produto: nome repetido recusa ANTES do submit, nunca chega a `create`/`update`.
    it("nome repetido (create): recusa ANTES do submit, com o texto de apoio, e não chama create", async () => {
        renderPage();

        fireEvent.change(screen.getByRole("textbox", { name: pf.nameLabel }), {
            target: { value: "Vaso G" }, // o nome de `savedProduct`, já na lista carregada
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
            target: { value: "f-1" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
            target: { value: "p-1" },
        });
        fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

        expect(await screen.findByText(messages.catalogForm.nameConflict)).toBeInTheDocument();
        expect(screen.getByText(messages.catalogForm.nameConflictHint)).toBeInTheDocument();
        expect(createMock).not.toHaveBeenCalled();
    });

    it("nome repetido (edit): editar SEM mudar o próprio nome não se recusa sozinho (o próprio id sai da comparação)", async () => {
        renderPage("prod-1"); // productId = savedProduct.id ("prod-1"), name já é "Vaso G"

        fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

        await waitFor(() => expect(updateMock).toHaveBeenCalled());
        expect(screen.queryByText(messages.catalogForm.nameConflict)).not.toBeInTheDocument();
    });

    it("without a saved filament AND printer, explains honestly why a product cannot be created", () => {
        useFilamentsMock.mockReturnValue(listState([]));
        renderPage();

        expect(screen.getByText(pf.needRefs)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: pf.saveProduct })).not.toBeInTheDocument();
    });

    it("a required name is enforced before any write", async () => {
        renderPage();
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.filament }), {
            target: { value: "f-1" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: t.catalogPicker.printer }), {
            target: { value: "p-1" },
        });
        fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

        await waitFor(() => expect(screen.getByText(pf.nameRequired)).toBeInTheDocument());
        expect(createMock).not.toHaveBeenCalled();
    });
});

describe("ProdutoPage — reopen/edit (US6-3/US6-4)", () => {
    it("reopens a saved product with its inputs and recomputes — no stored price on the wire", () => {
        renderPage("prod-1");

        expect(screen.getByRole("textbox", { name: pf.nameLabel })).toHaveValue("Vaso G");
        expect(screen.getByDisplayValue("110,00")).toBeInTheDocument();
        // R$ 25,65 comes from computeFromForm NOW, not from any persisted price (FR-310/FR-313).
        expect(screen.getAllByText(heroAmount("R$ 25,65")).length).toBeGreaterThan(0);
    });

    it("an UNLINKED product shows the calm state + manual picker + editable last-known values", () => {
        // E3 amended this copy (homologation F1). It used to say the filament "foi removido" — true
        // in E2, where every product was born with links. A kit save now materializes products with
        // NO links (ADR-0017), and those two histories are indistinguishable in the data BY DESIGN:
        // same state, same remedy. So the page states what it can know — nothing is linked, the
        // values were kept — instead of inventing a removal that may never have happened.
        useProductsMock.mockReturnValue(listState([{ ...savedProduct, filamentId: null }]));
        renderPage("prod-1");

        expect(screen.getByText(messages.catalog.needsAttention)).toBeInTheDocument();
        expect(screen.getByText(pf.manualValuesKept)).toBeInTheDocument();
        const picker = screen.getByRole("combobox", { name: t.catalogPicker.filament });
        expect(picker).toHaveValue("");
        expect(screen.getByDisplayValue("110,00")).toBeInTheDocument(); // last-known, editable
    });

    it("saving an edit PUTs through the wire mapping", async () => {
        renderPage("prod-1");
        fireEvent.click(screen.getByRole("button", { name: pf.saveProduct }));

        await waitFor(() => expect(updateMock).toHaveBeenCalled());
        const { id, body } = updateMock.mock.calls[0][0];
        expect(id).toBe("prod-1");
        expect(body).toMatchObject({ name: "Vaso G", filamentId: "f-1", printerId: "p-1" });
    });
});

describe("ProdutoPage — o recálculo do Catálogo, na FICHA (019/PR-D, correção de fidelidade)", () => {
    const catalogo = messages.catalog;

    // Movido de `features/catalog/products-panel.test.tsx` — a prancheta 17c desenha este aviso só
    // no ITEM ABERTO, nunca na lista.
    it("fixado com custo hoje > fixado: Alert warning + 'Voltar a acompanhar o custo' chama a mutation com { id, sellerFixedPrice: null }", () => {
        useProductsMock.mockReturnValue(
            listState([
                {
                    ...savedProduct,
                    sellerFixedPrice: "20.00",
                    sellerFixedAt: "2026-06-04T00:00:00Z",
                },
            ]),
        );
        renderPage("prod-1");

        const alert = screen.getByTestId("product-fixed-over-alert");
        expect(alert).toHaveTextContent(
            catalogo.fixedOverNote.replace("{hoje}", "R$ 25,65").replace("{diff}", "R$ 5,65"),
        );
        fireEvent.click(screen.getByRole("button", { name: catalogo.unfix }));
        expect(fixPriceMutateMock).toHaveBeenCalledWith({ id: "prod-1", sellerFixedPrice: null });
    });

    // Movido de `features/catalog/products-panel.test.tsx` — 16b·2: "Manter {valor}" fixa no preço
    // ANTERIOR (a observação salva); "Aceitar novo preço" existe ao lado.
    it("produto com mudança: 'Manter {era}' chama a mutation com sellerFixedPrice = era.toFixed(2), e 'Aceitar novo preço' existe", () => {
        useProductsMock.mockReturnValue(listState([savedProduct]));
        observationsResult.byKey = new Map([
            [
                "PRODUCT:prod-1",
                { observedPrice: 20, observedAt: "2026-05-12", subjectId: "prod-1" },
            ],
        ]);
        renderPage("prod-1");

        expect(
            screen.getByRole("button", { name: catalogo.keepPrice.replace("{valor}", "R$ 20,00") }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: catalogo.acceptNewPrice })).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: catalogo.keepPrice.replace("{valor}", "R$ 20,00") }),
        );
        expect(fixPriceMutateMock).toHaveBeenCalledWith({
            id: "prod-1",
            sellerFixedPrice: "20.00",
        });
    });
});

describe("ProdutoPage — record a snapshot with PRODUCT provenance (US3/T019)", () => {
    const h = messages.history;
    const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

    it("a premium seller can record the on-screen price, tagged with the product as its origin", async () => {
        // This is the entry point PR-A lacked: the calculator binds filament/printer, never a product,
        // so a calculator snapshot is genuinely ad-hoc (provenance null). Only THIS surface can produce
        // `provenance.kind = "PRODUCT"`, which is what makes SC-502 reachable from a product at all.
        const user = setup();
        renderPage("prod-1");

        await user.click(screen.getByRole("button", { name: h.saveAction }));
        await user.click(await screen.findByRole("button", { name: h.saveSheetSubmit }));

        await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1));
        const body = recordMock.mock.calls[0][0];
        expect(body.kind).toBe("SINGLE");
        // The captured origin — informational, resolved at read time later (ADR-0019 §5).
        expect(body.payload.provenance).toEqual({ kind: "PRODUCT", id: "prod-1", name: "Vaso G" });
        // And it is a real frozen document: money as strings, never a float leaf.
        expect(typeof body.payload.totals.precoVarejo).toBe("string");
    });

    it("a NEW (unsaved) product offers NO record action — there is no origin to tag yet", () => {
        renderPage(); // create mode, no productId
        expect(screen.queryByRole("button", { name: h.saveAction })).not.toBeInTheDocument();
    });

    it("without an active premium the record action does not exist (server's last word)", () => {
        entitlement.data = { status: "none" };
        renderPage("prod-1");
        expect(screen.queryByRole("button", { name: h.saveAction })).not.toBeInTheDocument();
    });
});

describe("ProdutoPage — save a scenario referencing THIS product (010/T021b)", () => {
    const s = messages.scenarios;
    const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

    it("captures a PRODUCT costBasis (id + name), not AD_HOC — closes FR-606a on the UI side", async () => {
        const user = setup();
        createScenarioMock.mockResolvedValue({ id: "sc-1" });
        renderPage("prod-1");

        await user.click(screen.getByTestId("save-scenario-trigger"));
        // Disambiguate from the page's OWN "Nome do produto" field (same "Nome…" prefix) — the Sheet's
        // "Nome" field is the LAST match (its Dialog portal mounts after the page content).
        const nameInputs = screen.getAllByLabelText(new RegExp("^" + s.nameField));
        await user.type(nameInputs[nameInputs.length - 1]!, "Vaso G no ML");
        await user.click(screen.getByTestId("save-scenario-submit"));

        await waitFor(() => expect(createScenarioMock).toHaveBeenCalledTimes(1));
        const body = createScenarioMock.mock.calls[0]![0];
        expect(body.config.costBasis.kind).toBe("PRODUCT");
        expect(body.config.costBasis.ref).toEqual({ id: "prod-1", name: "Vaso G" });
    });

    it("a NEW (unsaved) product offers no save-scenario action — there is no id to reference yet", () => {
        renderPage(); // create mode, no productId
        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });

    it("without an active premium the action does not exist", () => {
        entitlement.data = { status: "none" };
        renderPage("prod-1");
        expect(screen.queryByTestId("save-scenario-trigger")).not.toBeInTheDocument();
    });
});

describe("ProdutoPage — gate não-active, inerte up front (019/PR-B T045, ex-013/FB-02)", () => {
    it("lapsed: campos inertes (Frozen), Salvar visível+disabled, rodapé com a frase de reativação — nunca um fail-at-save surpresa", () => {
        // `gate` vem do PAI (CatalogoPage) — o mock de entitlement da própria página fica "active"
        // aqui, provando que o congelamento é guiado pela prop, não por um segundo gate.
        renderPage("prod-1", "lapsed");

        expect(screen.getByRole("textbox", { name: pf.nameLabel })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: t.catalogPicker.filament })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: t.catalogPicker.printer })).toBeDisabled();
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(
            messages.catalog.reactivateBody,
        );
        const cta = screen.getByTestId("teaser-upgrade-cta");
        expect(cta).toHaveTextContent(messages.billing.reactivateAction);
        const saveBtn = screen.getByRole("button", { name: pf.saveProduct });
        expect(saveBtn).toBeVisible();
        expect(saveBtn).toBeDisabled();
        // FR-409 — reads/recompute still work while lapsed.
        expect(screen.getAllByText(heroAmount("R$ 25,65")).length).toBeGreaterThan(0);
    });

    it("never-subscribed: mesma inércia, convite 'Assinar Premium'", () => {
        renderPage("prod-1", "never-subscribed");
        expect(screen.getByRole("textbox", { name: pf.nameLabel })).toBeDisabled();
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(
            messages.premiumTeaser.saveIsPartOfPremium,
        );
        expect(screen.getByTestId("teaser-upgrade-cta")).toHaveTextContent(
            messages.billing.subscribeAction,
        );
    });

    it("active keeps the product form fully editable — regression guard", () => {
        renderPage("prod-1");
        expect(screen.getByRole("textbox", { name: pf.nameLabel })).not.toBeDisabled();
        const saveBtn = screen.getByRole("button", { name: pf.saveProduct });
        expect(saveBtn).toBeInTheDocument();
        expect(saveBtn).not.toBeDisabled();
        expect(screen.queryByTestId("premium-footer-note")).not.toBeInTheDocument();
        expect(screen.queryByTestId("teaser-upgrade-cta")).not.toBeInTheDocument();
    });
});
