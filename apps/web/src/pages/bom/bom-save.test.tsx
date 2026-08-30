// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BomIn, BomLineOut, ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T015 — saving a kit, written FAILING-first. The rules under test are honesty rules, not
// plumbing: a success toast + the catalog summary appear ONLY after a real 2xx; what the save did
// to the catalog is stated out loud per piece (created vs referenced, K4); and when a piece was
// referenced instead of created, the seller is told that the saved product's values won — never
// left to discover it by reopening the kit and finding different numbers (ADR-0017 §3).

const {
  useEntitlementMock,
  useProductsMock,
  useFeeCatalogMock,
  createBomMock,
  updateBomMock,
  toastMock,
} = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useProductsMock: vi.fn(),
  useFeeCatalogMock: vi.fn(),
  createBomMock: vi.fn(),
  updateBomMock: vi.fn(),
  toastMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn(), useSearch: () => ({}) };
});
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => useEntitlementMock() }));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return { ...actual, useProducts: () => useProductsMock() };
});
vi.mock("@/entities/bom/use-bom", () => ({
  useBoms: () => ({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  }),
  useCreateBom: () => ({ mutateAsync: createBomMock, isPending: false }),
  useUpdateBom: () => ({ mutateAsync: updateBomMock, isPending: false }),
}));
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return { ...actual, useFeeCatalog: () => useFeeCatalogMock() };
});
vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return { ...actual, toast: toastMock };
});

import { ApiError } from "@/shared/api/transport";

import { BomPage } from "./bom-page";

const t = messages.bom;

const productP: ProductOut = {
  id: "p1",
  name: "Base",
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

// A saved kit ALWAYS echoes its server-resolved lines — a 0-line kit cannot be saved — so the
// create/update mocks mirror that contract. The composer adopts the response directly after a
// create (no refetch-window clobber of in-progress edits, review 2026-07-12), which means an empty
// `lines: []` here would wrongly collapse the composer to its empty state. Values reuse productP's
// already-typed output surfaces.
const savedLine: BomLineOut = {
  id: "l1",
  position: 0,
  quantity: 1,
  productId: null,
  pieceName: "Peça 1 · Kit Suporte",
  degraded: false,
  pieceInputs: productP.pieceInputs,
  filamentValues: productP.filamentValues,
  printerValues: productP.printerValues,
  tariffPerKwh: "1.00",
  includeMarketplace: true,
  channels: [],
  otherCosts: [],
};

function renderPremiumPage(products: ProductOut[] = []) {
  useSessionStore.setState({ status: "authenticated" });
  useEntitlementMock.mockReturnValue({
    data: { status: "active" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useProductsMock.mockReturnValue({
    items: products,
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BomPage />
    </QueryClientProvider>,
  );
}

// 019/PR-B (T046, DECISÃO 3) — o composer monta para QUALQUER sessão conhecida; esta função varia
// o gate para provar que compor (não Salvar) nunca toca a rede, seja qual for o plano.
function renderWithPlan(sessionStatus: "authenticated" | "anonymous", plan?: "none" | "lapsed") {
  useSessionStore.setState({ status: sessionStatus });
  useEntitlementMock.mockReturnValue({
    data: plan ? { status: plan } : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useProductsMock.mockReturnValue({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BomPage />
    </QueryClientProvider>,
  );
}

function addLine() {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine, "i") }));
}

function typeKitName(name: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(t.kitName, "i")), { target: { value: name } });
}

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: t.save }));
}

beforeEach(() => {
  useFeeCatalogMock.mockReturnValue({
    catalog: {
      catalogVersion: "test-0",
      schemaVersion: "1",
      generatedAt: "2026-01-01T00:00:00Z",
      marketplaces: [],
    },
    source: "catalog" as const,
    refreshFailed: false,
    refreshing: false,
    refetch: vi.fn(),
  });
  createBomMock.mockReset();
  updateBomMock.mockReset();
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("kit save — nothing leaves the page until it is valid", () => {
  it("refuses to save an unnamed kit, and never calls the server", () => {
    renderPremiumPage();
    addLine();
    clickSave();

    expect(screen.getByText(t.kitNameRequired)).toBeInTheDocument();
    expect(createBomMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("kit save — the save round-trip", () => {
  it("sends the composed lines and toasts ONLY after a real 2xx", async () => {
    createBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit Suporte",
      lines: [savedLine],
      materializations: [],
    });
    renderPremiumPage();
    addLine();
    typeKitName("Kit Suporte");
    clickSave();

    await waitFor(() => expect(createBomMock).toHaveBeenCalledTimes(1));
    const body = createBomMock.mock.calls[0][0] as BomIn;
    expect(body.name).toBe("Kit Suporte");
    expect(body.lines).toHaveLength(1);
    // An ad-hoc piece rides as a named value-set — it has to materialize (K4).
    expect(body.lines?.[0].pieceName).toBe("Peça 1 · Kit Suporte");
    expect(body.lines?.[0].pieceInputs).toBeDefined();

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(t.saved, { tone: "success" }));
  });

  it("a bound, untouched line saves as a live reference — no piece name, no value-set", async () => {
    createBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit",
      lines: [savedLine],
      materializations: [],
    });
    renderPremiumPage([productP]);
    addLine();
    // Bind the line to the saved product through the in-line picker.
    fireEvent.change(screen.getByLabelText(new RegExp(t.useProduct, "i")), {
      target: { value: "p1" },
    });
    typeKitName("Kit");
    clickSave();

    await waitFor(() => expect(createBomMock).toHaveBeenCalledTimes(1));
    const body = createBomMock.mock.calls[0][0] as BomIn;
    expect(body.lines?.[0].productId).toBe("p1");
    expect(body.lines?.[0].pieceName).toBeUndefined();
    expect(body.lines?.[0].pieceInputs).toBeUndefined();
  });

  it("a failed save says so honestly — no success toast, no catalog summary", async () => {
    createBomMock.mockRejectedValue(
      new ApiError({
        status: 403,
        code: "ENTITLEMENT_REQUIRED",
        message: "denied",
        correlationId: null,
      }),
    );
    renderPremiumPage();
    addLine();
    typeKitName("Kit Suporte");
    clickSave();

    await waitFor(() =>
      expect(screen.getByText(messages.apiError.entitlementRequired)).toBeInTheDocument(),
    );
    expect(toastMock).not.toHaveBeenCalled();
    expect(screen.queryByText(t.savedTitle)).not.toBeInTheDocument();
  });
});

describe("kit save — what it did to the catalog is said out loud (K4)", () => {
  it("reports a piece CREATED in the catalog", async () => {
    createBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit Suporte",
      lines: [savedLine],
      materializations: [{ position: 0, productId: "np1", action: "created" }],
    });
    renderPremiumPage();
    addLine();
    typeKitName("Kit Suporte");
    clickSave();

    await waitFor(() => expect(screen.getByText(t.savedTitle)).toBeInTheDocument());
    expect(
      screen.getByText(t.savedCreated.replace("{nome}", "Peça 1 · Kit Suporte")),
    ).toBeInTheDocument();
    // Nothing was superseded — the warning must not appear where it does not apply.
    expect(screen.queryByText(t.savedSuperseded)).not.toBeInTheDocument();
  });

  it("reports a piece REFERENCED — and warns that the saved product's values won", async () => {
    createBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit Suporte",
      lines: [savedLine],
      materializations: [{ position: 0, productId: "p1", action: "referenced" }],
    });
    renderPremiumPage();
    addLine();
    typeKitName("Kit Suporte");
    clickSave();

    await waitFor(() =>
      expect(
        screen.getByText(t.savedReferenced.replace("{nome}", "Peça 1 · Kit Suporte")),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(t.savedSuperseded)).toBeInTheDocument();
  });
});

describe("kit save — saving twice edits the kit, it does not file a second one", () => {
  it("adopts the created kit's id, so a second Salvar REPLACES it (homologation F2)", async () => {
    createBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit Suporte",
      lines: [savedLine],
      materializations: [],
    });
    updateBomMock.mockResolvedValue({
      id: "k1",
      name: "Kit Suporte",
      lines: [savedLine],
      materializations: [],
    });
    renderPremiumPage();
    addLine();
    typeKitName("Kit Suporte");

    clickSave();
    await waitFor(() => expect(createBomMock).toHaveBeenCalledTimes(1));

    // Tap it again — the seller re-reads the panel and saves once more. Before the fix this filed
    // a SECOND kit with the same name and re-materialized its pieces.
    clickSave();
    await waitFor(() => expect(updateBomMock).toHaveBeenCalledTimes(1));
    expect(updateBomMock.mock.calls[0][0].id).toBe("k1");
    expect(createBomMock).toHaveBeenCalledTimes(1); // still exactly ONE create
  });
});

// 019/PR-B (T046, DECISÃO 3 do dono 27/08) — "montar um kit sem salvar é permitido no
// grátis/lapsed — só 'Salvar' bloqueia". Compor (adicionar/remover linha, editar quantidade) é
// estado LOCAL — nunca dispara `useCreateBom`/`useUpdateBom`. Só um clique real em "Salvar" toca a
// rede, e mesmo esse é recusado pelo servidor sem `active` (Constituição IV; a UI só desabilita o
// botão como affordance, nunca como a barreira real).
describe("kit save — compor nunca é rede; só 'Salvar' toca a rede (019/PR-B)", () => {
  it("premium (active): adicionar linha, editar quantidade e remover não chamam create/update", () => {
    renderPremiumPage();
    addLine();
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(t.quantity) }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.removeLine) }));
    expect(createBomMock).not.toHaveBeenCalled();
    expect(updateBomMock).not.toHaveBeenCalled();
  });

  it("free (none): o composer monta e compõe sem tocar a rede — só 'Salvar' fica desabilitado", () => {
    renderWithPlan("authenticated", "none");
    addLine();
    expect(createBomMock).not.toHaveBeenCalled();
    expect(updateBomMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });

  it("lapsed: o composer monta e compõe sem tocar a rede — só 'Salvar' fica desabilitado", () => {
    renderWithPlan("authenticated", "lapsed");
    addLine();
    expect(createBomMock).not.toHaveBeenCalled();
    expect(updateBomMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });

  it("deslogado: o composer monta e compõe sem tocar a rede — só 'Salvar' fica desabilitado", () => {
    renderWithPlan("anonymous");
    addLine();
    expect(createBomMock).not.toHaveBeenCalled();
    expect(updateBomMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });
});
