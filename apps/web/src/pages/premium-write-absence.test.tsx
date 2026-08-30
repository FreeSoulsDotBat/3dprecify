// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BomOut, FilamentOut, PrinterOut, ProductOut } from "@/shared/api/generated";
import type { PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// Radix Select/Popover (o picker de filamento/impressora do ProdutoPage) observa tamanho via
// floating-ui; jsdom não embarca `ResizeObserver`. Mesmo no-op do molde `shared/ui/info-tip.test.tsx`
// — o que este arquivo assevera é ausência de chamada de rede, nunca posicionamento em pixel.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// 019/PR-B (T107) — guarda de AUSÊNCIA, molde SC-709 do E6 ("suíte verde prova que nada quebrou;
// AUSÊNCIA prova que nada aconteceu"). O cliente não chama NENHUMA mutação de escrita quando o
// plano não é `active` — a barreira é a AUSÊNCIA do handler (research §E-2), nunca um `if` que
// alguém pode esquecer de repetir num painel novo. Este arquivo varre `features/catalog/**` e
// `pages/{catalogo,bom,historico}/**`, monta cada superfície nos QUATRO estados não-`active`
// (`free-nunca-teve`, `lapsed`, `signed-out`, `unknown`), clica em tudo que está habilitado e prova
// zero chamadas em TODO hook de escrita que o próprio código-fonte declara — enumerado por leitura
// de arquivo (`readFileSync`), não por uma lista mantida à mão, para que um hook novo sem entrar na
// guarda derrube o teste.
//
// Fica em `src/pages/` (fora de qualquer subpasta) DE PROPÓSITO: o `eslint-boundaries` (ADR-0004)
// só reconhece um "page" element para arquivos DENTRO de `pages/<nome>/…` — um arquivo solto em
// `pages/` não é nenhum desses elementos, então pode importar `catalogo-page`, `bom-page` e
// `historico-page` ao mesmo tempo (três "pages" diferentes, cruzamento que a regra normal proíbe).

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const filA: FilamentOut = {
  id: "f1",
  name: "PLA Azul",
  material: "PLA",
  costPerRoll: "110.00",
  rollWeightKg: "1",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};

const printerA: PrinterOut = {
  id: "pr1",
  name: "Ender 3",
  machineValue: "4000.00",
  machineLifetimeHours: "2000",
  avgPowerKw: "0.100",
  maintenanceReservePerHour: "0",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};

const productA: ProductOut = {
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

const bomA: BomOut = {
  id: "k1",
  name: "Kit Suporte",
  lines: [],
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

const historyItemA = {
  id: "s1",
  clientSnapshotId: "csid-1",
  kind: "SINGLE",
  label: "Cliente João",
  headlineTotal: "21.90",
  headlineBasis: "PRECO_VAREJO",
  deviceQuotedAt: "2026-07-13T19:30:00Z",
  syncState: "synced" as const,
  snapshot: {
    id: "s1",
    clientSnapshotId: "csid-1",
    kind: "SINGLE",
    label: "Cliente João",
    quoteValidityDays: null,
    deviceQuotedAt: "2026-07-13T19:30:00Z",
    deviceUtcOffsetMinutes: -180,
    modelVersion: "3.1.0",
    payloadSchemaVersion: 1,
    payload: { schemaVersion: 1, kind: "SINGLE", modelVersion: "3.1.0" },
    headlineTotal: "21.90",
    headlineBasis: "PRECO_VAREJO",
  },
  entry: null,
};

// ── Spies (hoisted so the `vi.mock` factories below can close over them) ───────────────────────

const {
  useEntitlementMock,
  searchState,
  useFeeCatalogMock,
  useFilamentsMock,
  usePrintersMock,
  useProductsMock,
  useBomsMock,
  useHistoryMock,
  useSyncOutboxMock,
  catalogWrites,
  priceObservationsWrites,
  bomWrites,
  historyWrites,
} = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false });
  return {
    useEntitlementMock: vi.fn(),
    searchState: { current: {} as Record<string, unknown> },
    useFeeCatalogMock: vi.fn(),
    useFilamentsMock: vi.fn(),
    usePrintersMock: vi.fn(),
    useProductsMock: vi.fn(),
    useBomsMock: vi.fn(),
    useHistoryMock: vi.fn(),
    useSyncOutboxMock: vi.fn(),
    catalogWrites: {
      useCreateFilament: mutation(),
      useUpdateFilament: mutation(),
      useDeleteFilament: mutation(),
      useCreatePrinter: mutation(),
      useUpdatePrinter: mutation(),
      useDeletePrinter: mutation(),
      useCreateProduct: mutation(),
      useUpdateProduct: mutation(),
      useDeleteProduct: mutation(),
    },
    // 019/PR-D (T124/T125) — `useFixProductPrice`/`useObservePrices().observe` são escritas NOVAS
    // que o grep de completude (regex `use(?:Create|Update|Delete|Record)\w+`) não alcança pelo
    // nome — ficam FORA de `catalogWrites` (que aquele grep confere byte a byte) e ganham uma
    // asserção manual em `assertNoWrites`, para não forçar o regex a mudar por um verbo novo.
    priceObservationsWrites: { observe: vi.fn(), useFixProductPrice: mutation() },
    bomWrites: {
      useCreateBom: mutation(),
      useUpdateBom: mutation(),
      useDeleteBom: mutation(),
    },
    historyWrites: {
      useRecordSnapshot: mutation(),
      useUpdateLabel: mutation(),
      useDeleteSnapshot: mutation(),
    },
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => searchState.current,
    Link: ({ children, ...rest }: { children?: unknown; [k: string]: unknown }) => (
      <a {...(rest as object)}>{children as never}</a>
    ),
  };
});

vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));

vi.mock("@/entities/catalog/use-catalog", () => ({
  useFilaments: () => useFilamentsMock(),
  usePrinters: () => usePrintersMock(),
  useProducts: () => useProductsMock(),
  useCreateFilament: () => catalogWrites.useCreateFilament,
  useUpdateFilament: () => catalogWrites.useUpdateFilament,
  useDeleteFilament: () => catalogWrites.useDeleteFilament,
  useCreatePrinter: () => catalogWrites.useCreatePrinter,
  useUpdatePrinter: () => catalogWrites.useUpdatePrinter,
  useDeletePrinter: () => catalogWrites.useDeletePrinter,
  useCreateProduct: () => catalogWrites.useCreateProduct,
  useUpdateProduct: () => catalogWrites.useUpdateProduct,
  useDeleteProduct: () => catalogWrites.useDeleteProduct,
  useFixProductPrice: () => priceObservationsWrites.useFixProductPrice,
}));

// 019/PR-D (T124/T125) — a leitura sempre neutra (sem observações salvas) + `observe` rastreado
// pela MESMA guarda de ausência.
vi.mock("@/entities/catalog/price-observations", () => ({
  usePriceObservations: () => ({
    byKey: new Map(),
    isLoading: false,
    isError: false,
    error: null,
    entitlementDenied: false,
  }),
  useObservePrices: () => ({ observe: priceObservationsWrites.observe }),
  derivePriceChanges: () => ({ changed: [], count: 0 }),
  observationKey: (kind: string, id: string) => `${kind}:${id}`,
}));

vi.mock("@/entities/bom/use-bom", () => ({
  useBoms: () => useBomsMock(),
  useCreateBom: () => bomWrites.useCreateBom,
  useUpdateBom: () => bomWrites.useUpdateBom,
  useDeleteBom: () => bomWrites.useDeleteBom,
}));

vi.mock("@/entities/history/use-history", () => ({
  useHistory: () => useHistoryMock(),
  useSyncOutbox: () => useSyncOutboxMock(),
  useRecordSnapshot: () => historyWrites.useRecordSnapshot,
  useUpdateLabel: () => historyWrites.useUpdateLabel,
  useDeleteSnapshot: () => historyWrites.useDeleteSnapshot,
}));

vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return { ...actual, useFeeCatalog: () => useFeeCatalogMock() };
});

import { FilamentsPanel } from "@/features/catalog/filaments-panel";
import { KitsPanel } from "@/features/catalog/kits-panel";
import { PrintersPanel } from "@/features/catalog/printers-panel";
import { ProductsPanel } from "@/features/catalog/products-panel";

import { BomPage } from "@/pages/bom/bom-page";
import { CatalogoPage } from "@/pages/catalogo/catalogo-page";
import { HistoricoPage } from "@/pages/historico/historico-page";

// ── Test helpers ─────────────────────────────────────────────────────────────────────────────

const ALL_WRITE_HOOKS: Record<
  string,
  { mutateAsync: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn> }
> = {
  ...catalogWrites,
  ...bomWrites,
  ...historyWrites,
};

function resetWrites() {
  for (const hook of Object.values(ALL_WRITE_HOOKS)) {
    hook.mutateAsync.mockReset();
    hook.mutate.mockReset();
  }
  priceObservationsWrites.observe.mockReset();
  priceObservationsWrites.useFixProductPrice.mutateAsync.mockReset();
  priceObservationsWrites.useFixProductPrice.mutate.mockReset();
}

function assertNoWrites() {
  for (const [name, hook] of Object.entries(ALL_WRITE_HOOKS)) {
    expect(hook.mutateAsync, `${name}.mutateAsync`).not.toHaveBeenCalled();
    expect(hook.mutate, `${name}.mutate`).not.toHaveBeenCalled();
  }
  expect(priceObservationsWrites.observe, "useObservePrices.observe").not.toHaveBeenCalled();
  expect(
    priceObservationsWrites.useFixProductPrice.mutateAsync,
    "useFixProductPrice.mutateAsync",
  ).not.toHaveBeenCalled();
}

const emptyList = {
  items: [] as unknown[],
  isLoading: false,
  isError: false,
  error: null as { code: string } | null,
  stale: false,
  refetch: vi.fn(),
};

function listOf(items: unknown[]) {
  return { ...emptyList, items };
}

function entitlementRequiredList() {
  return { ...emptyList, isError: true, error: { code: "ENTITLEMENT_REQUIRED" } };
}

/** Sets session + entitlement + the four catalog/bom read hooks for one of the four non-`active`
 *  gates. `withItems` (only meaningful/used for `lapsed`, per the task) puts one saved row in
 *  every list — the "lapsed-com-itens" surface the audit called out by name. */
function setGate(gate: Exclude<PremiumGate, "active">, withItems = false) {
  const authenticated = gate !== "signed-out";
  useSessionStore.setState({
    status: authenticated ? "authenticated" : "anonymous",
    user: authenticated ? ({ uid: "u1", email: "u@x.dev" } as never) : null,
  });

  const data =
    gate === "lapsed"
      ? { status: "lapsed" as const }
      : gate === "free-nunca-teve"
        ? { status: "none" as const }
        : undefined; // signed-out / unknown
  useEntitlementMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
  });

  if (withItems) {
    useFilamentsMock.mockReturnValue(listOf([filA]));
    usePrintersMock.mockReturnValue(listOf([printerA]));
    useProductsMock.mockReturnValue(listOf([productA]));
    useBomsMock.mockReturnValue(listOf([bomA]));
  } else if (gate === "free-nunca-teve") {
    // FR-... o servidor responde 403 ENTITLEMENT_REQUIRED — a lista lê isso, nunca "vazio".
    useFilamentsMock.mockReturnValue(entitlementRequiredList());
    usePrintersMock.mockReturnValue(entitlementRequiredList());
    useProductsMock.mockReturnValue(entitlementRequiredList());
    useBomsMock.mockReturnValue(entitlementRequiredList());
  } else {
    useFilamentsMock.mockReturnValue(listOf([]));
    usePrintersMock.mockReturnValue(listOf([]));
    useProductsMock.mockReturnValue(listOf([]));
    useBomsMock.mockReturnValue(listOf([]));
  }
}

function setActiveGate() {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u1", email: "u@x.dev" } as never,
  });
  useEntitlementMock.mockReturnValue({
    data: { status: "active" },
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
  });
  useFilamentsMock.mockReturnValue(listOf([]));
  usePrintersMock.mockReturnValue(listOf([]));
  useProductsMock.mockReturnValue(listOf([]));
  useBomsMock.mockReturnValue(listOf([]));
}

/** Clicks every currently-enabled button (dedup by label so a fresh dialog's buttons are reached
 *  in the next pass, but nothing is clicked twice), then submits every `<form>` on the page, for a
 *  few passes — enough for one Sheet/Dialog to open and be exercised too. */
function exercisePage() {
  const clicked = new Set<string>();
  for (let pass = 0; pass < 5; pass++) {
    const buttons = screen.queryAllByRole("button");
    let clickedAny = false;
    for (const btn of buttons) {
      if ((btn as HTMLButtonElement).disabled) continue;
      const key = `${btn.getAttribute("aria-label") ?? ""}|${btn.textContent ?? ""}|${pass % 2}`;
      if (clicked.has(key)) continue;
      clicked.add(key);
      fireEvent.click(btn);
      clickedAny = true;
    }
    document.querySelectorAll("form").forEach((f) => fireEvent.submit(f));
    if (!clickedAny) break;
  }
}

const feeCatalogValue = {
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
};

beforeEach(() => {
  resetWrites();
  searchState.current = {};
  useFeeCatalogMock.mockReturnValue(feeCatalogValue);
  useSyncOutboxMock.mockReturnValue({ sync: vi.fn(), syncing: false });
  useHistoryMock.mockReturnValue(emptyList);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

// ── Completude: a lista de hooks espiados é EXAUSTIVA, lida do próprio código-fonte ────────────

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "entities");

function exportedWriteHooks(file: string): string[] {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const matches = text.matchAll(/^export function (use(?:Create|Update|Delete|Record)\w+)/gm);
  return [...matches].map((m) => m[1]);
}

describe("T107 completude — todo hook de escrita em entities/** está espiado", () => {
  it("catalog + bom + history: o grep do código-fonte bate com o conjunto espiado", () => {
    const found = [
      ...exportedWriteHooks("catalog/use-catalog.ts"),
      ...exportedWriteHooks("bom/use-bom.ts"),
      ...exportedWriteHooks("history/use-history.ts"),
    ].sort();
    const spied = Object.keys(ALL_WRITE_HOOKS).sort();
    expect(found.length).toBeGreaterThan(0); // sanity: a regex realmente casou algo
    expect(spied).toEqual(found);
  });
});

// ── Não-vácuo: a MESMA guarda VÊ uma escrita quando active salva de verdade ─────────────────────

describe("T107 não-vácuo — em active, salvar de verdade CHAMA a escrita (prova que o spy funciona)", () => {
  it("FilamentsPanel active: preencher e salvar chama useCreateFilament().mutateAsync 1×", async () => {
    setActiveGate();
    render(<FilamentsPanel />);

    fireEvent.click(screen.getByRole("button", { name: messages.catalogo.addFilament }));
    fireEvent.change(screen.getByRole("textbox", { name: messages.catalogForm.name }), {
      target: { value: "PETG Preto" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: messages.calculator.fields.costPerRoll }),
      { target: { value: "135,00" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: messages.calculator.fields.rollWeight }), {
      target: { value: "1" },
    });
    catalogWrites.useCreateFilament.mutateAsync.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: messages.catalogForm.save }));

    await waitFor(() =>
      expect(catalogWrites.useCreateFilament.mutateAsync).toHaveBeenCalledTimes(1),
    );
    // e nenhum outro hook de escrita foi tocado por essa mesma interação.
    for (const [name, hook] of Object.entries(ALL_WRITE_HOOKS)) {
      if (name === "useCreateFilament") continue;
      expect(hook.mutateAsync, `${name}.mutateAsync`).not.toHaveBeenCalled();
    }
  });
});

// ── A guarda em si: 4 painéis × 4 estados não-active ────────────────────────────────────────────

const NON_ACTIVE_GATES: Exclude<PremiumGate, "active">[] = [
  "free-nunca-teve",
  "lapsed",
  "signed-out",
  "unknown",
];

const CATALOG_SURFACES: [string, () => React.ReactElement][] = [
  ["FilamentsPanel", () => <FilamentsPanel />],
  ["PrintersPanel", () => <PrintersPanel />],
  ["ProductsPanel", () => <ProductsPanel />],
  ["KitsPanel", () => <KitsPanel />],
];

describe("T107 — features/catalog/**: zero escrita sob gate ≠ active", () => {
  for (const [name, Surface] of CATALOG_SURFACES) {
    for (const gate of NON_ACTIVE_GATES) {
      it(`${name} @ ${gate}${gate === "lapsed" ? " (com itens)" : ""}: clicar em tudo não chama nenhuma escrita`, () => {
        setGate(gate, gate === "lapsed");
        render(Surface());
        exercisePage();
        // "lapsed com itens": abrir a edição pelo nome (já coberto por exercisePage — o nome é um
        // <button> clicável) e clicar em tudo de novo.
        exercisePage();
        assertNoWrites();
      });
    }
  }
});

describe("T107 — pages/catalogo/catalogo-page.tsx (as 4 abas + ProdutoPage): zero escrita sob gate ≠ active", () => {
  for (const gate of NON_ACTIVE_GATES) {
    it(`todas as abas @ ${gate}: clicar em tudo não chama nenhuma escrita`, () => {
      setGate(gate, gate === "lapsed");
      render(<CatalogoPage />);
      exercisePage();
      assertNoWrites();
    });

    it(`?produto=novo @ ${gate}: formulário inerte (ou parede honesta de pré-requisito) não chama nenhuma escrita`, () => {
      setGate(gate, gate === "lapsed");
      searchState.current = { produto: "novo" };
      render(<CatalogoPage />);
      exercisePage();
      assertNoWrites();
    });

    it(`?produto=<id existente> @ ${gate}: editar (ou honesto "não encontrado") não chama nenhuma escrita`, () => {
      setGate(gate, gate === "lapsed");
      searchState.current = { produto: productA.id };
      render(<CatalogoPage />);
      exercisePage();
      assertNoWrites();
    });
  }
});

describe("T107 — pages/bom/bom-page.tsx: compor é sempre local; zero escrita sob gate ≠ active", () => {
  for (const gate of NON_ACTIVE_GATES) {
    it(`${gate}: adicionar linha, editar campos, remover linha e tentar Salvar não chamam create/update/delete`, () => {
      setGate(gate, gate === "lapsed");
      render(<BomPage />);
      exercisePage();
      exercisePage(); // uma segunda passada — pega o que a primeira abriu (Sheet/linha nova)
      assertNoWrites();
    });
  }
});

describe("T107 — pages/historico/historico-page.tsx: zero escrita sob gate ≠ active", () => {
  for (const gate of NON_ACTIVE_GATES) {
    it(`${gate}: clicar em tudo (busca, filtros, card do registro) não chama record/relabel/delete`, () => {
      const authenticated = gate !== "signed-out";
      useSessionStore.setState({
        status: authenticated ? "authenticated" : "anonymous",
        user: authenticated ? ({ uid: "u1" } as never) : null,
      });
      const data =
        gate === "lapsed"
          ? { status: "lapsed" as const }
          : gate === "free-nunca-teve"
            ? { status: "none" as const }
            : undefined;
      useEntitlementMock.mockReturnValue({
        data,
        isLoading: false,
        isError: false,
        stale: false,
        refetch: vi.fn(),
      });
      useHistoryMock.mockReturnValue(gate === "lapsed" ? listOf([historyItemA]) : listOf([]));

      render(<HistoricoPage />);
      exercisePage();
      assertNoWrites();
    });
  }
});
