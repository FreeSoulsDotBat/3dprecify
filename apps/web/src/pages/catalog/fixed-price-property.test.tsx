// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// 019/PR-D (T125, ADR-0033: "um leitor futuro tratar `seller_fixed_price` como O preço") — a
// guarda de PROPRIEDADE. `seller_fixed_price`/`price-observations` são vocabulário do RECÁLCULO
// do Catálogo, e o recálculo mora em DOIS lugares só (o desenho não previu um terceiro): a lista
// (`features/catalog/**`) e a ficha (`pages/catalog/**`). Qualquer outro arquivo de `src/` que
// passe a ler esse vocabulário é, por definição, um leitor tratando a declaração do vendedor como
// se fosse a fonte do preço em algum outro contexto (kit, orçamento, cenário) — o exato bug que o
// ADR nomeia.
//
// Escopo do varredura: `src/pages/**` e `src/features/**` (as duas camadas de PRESENTATION que
// podem mostrar um preço), MENOS `pages/catalog/**`/`features/catalog/**` (as exceções) e MENOS
// todo `*.test.ts(x)` (fixtures/mocks de teste não são "um leitor" — `sellerFixedPrice: null` em
// dezenas de fixtures de `ProductOut` por toda a suíte, depois do contrato do FE-1b, não é o bug
// que este teste existe para pegar). `entities/**`/`shared/**` ficam FORA do varredura por
// desenho: são a camada de DADOS — ela tem que declarar o campo para a camada de apresentação
// poder recusar lê-lo.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "..");

const FORBIDDEN = /sellerFixedPrice|observedPrice|price-observations/;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full, out);
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

/** Varre um subdiretório de `src/` (relativo), devolvendo os arquivos (se houver) que citam o
 *  vocabulário proibido — vazio é a propriedade. */
function violations(subdir: string): string[] {
    const dir = path.join(SRC, subdir);
    let files: string[];
    try {
        files = walk(dir);
    } catch {
        return []; // diretório não existe nesta árvore — nada a violar
    }
    return files
        .filter((f) => FORBIDDEN.test(readFileSync(f, "utf8")))
        .map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
}

describe("019/PR-D (T125) — a guarda de propriedade: seller_fixed_price nunca vaza para fora do recálculo", () => {
    it("kit (pages/bom/**) não lê sellerFixedPrice/observedPrice/price-observations", () => {
        expect(violations("pages/bom")).toEqual([]);
    });

    it("orçamento (pages/history/**) não lê sellerFixedPrice/observedPrice/price-observations", () => {
        expect(violations("pages/history")).toEqual([]);
    });

    it("cenário (features/scenarios/**) não lê sellerFixedPrice/observedPrice/price-observations", () => {
        expect(violations("features/scenarios")).toEqual([]);
    });

    it("o resto de pages/**+features/** (fora de pages/catalog/** e features/catalog/**) também não lê", () => {
        const EXEMPT = new Set(["pages/catalog", "features/catalog"]);
        const offenders: string[] = [];
        for (const top of ["pages", "features"] as const) {
            for (const entry of readdirSync(path.join(SRC, top))) {
                const full = path.join(SRC, top, entry);
                if (!statSync(full).isDirectory()) continue; // arquivos soltos (ex.: premium-write-absence.test.tsx) — teste, fora do escopo
                const rel = `${top}/${entry}`;
                if (EXEMPT.has(rel)) continue;
                offenders.push(...violations(rel));
            }
        }
        expect(offenders).toEqual([]);
    });
});

// ── O render: o número grande do produto NUNCA vem de `observedPrice` ──────────────────────────
//
// A leitura acima prova ausência de TEXTO no fonte; esta prova a PROPRIEDADE em tempo de render —
// para o caso comum (produto ligado, sem degradação), o preço grande é sempre o recomputado de
// hoje (`computeFromForm`) ou o valor que o vendedor declarou (`sellerFixedPrice`), nunca a
// observação salva. O ÚNICO lugar em que `observedPrice` alimenta o número grande é o estado
// "parado" (16f/17g, K3 — a referência sumiu, e o congelado É a observação, por desenho; fora do
// escopo desta prova, que é sobre o caso SEM degradação).

const { useProductsMock, useFilamentsMock, usePrintersMock, useObservationsMock } = vi.hoisted(
    () => ({
        useProductsMock: vi.fn(),
        useFilamentsMock: vi.fn(),
        usePrintersMock: vi.fn(),
        useObservationsMock: vi.fn(),
    }),
);
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
    return {
        ...actual,
        useProducts: () => useProductsMock(),
        useFilaments: () => useFilamentsMock(),
        usePrinters: () => usePrintersMock(),
        useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
        useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
        useFixProductPrice: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
    };
});
vi.mock("@/entities/catalog/price-observations", () => ({
    usePriceObservations: () => useObservationsMock(),
    useObservePrices: () => ({ observe: vi.fn() }),
    observationKey: (kind: string, id: string) => `${kind}:${id}`,
}));
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({ data: { status: "active" }, isLoading: false }),
}));
vi.mock("@/entities/history/use-history", () => ({
    useRecordSnapshot: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/entities/scenario/use-scenarios", () => ({
    useCreateScenario: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { ProductPage } from "./product-page";

const catalog = messages.catalog;

function listState(items: unknown[]) {
    return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

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
    sellerFixedPrice: null,
    sellerFixedAt: null,
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T00:00:00Z",
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("019/PR-D (T125) — o render: PriceHero vem de recomputed ou sellerFixedPrice, nunca de observedPrice (caso não-degradado)", () => {
    it("uma observação DIVERGENTE não vaza para o número grande — o número é o recomputado de hoje", () => {
        useProductsMock.mockReturnValue(listState([savedProduct]));
        useFilamentsMock.mockReturnValue(
            listState([
                { id: "f-1", name: "PLA Azul", costPerRoll: "110.00", rollWeightKg: "1.000" },
            ]),
        );
        usePrintersMock.mockReturnValue(listState([{ id: "p-1", name: "Ender 3" }]));
        // Observação salva com um valor ABSURDAMENTE diferente (R$ 999,00) — se o render vazasse
        // `observedPrice` para o número grande, este teste veria "999" na tela.
        useObservationsMock.mockReturnValue({
            byKey: new Map([
                [
                    "PRODUCT:prod-1",
                    { observedPrice: 999, observedAt: "2026-05-01", subjectId: "prod-1" },
                ],
            ]),
            isLoading: false,
            isError: false,
            error: null,
            entitlementDenied: false,
        });

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <ProductPage productId="prod-1" gate="active" />
            </QueryClientProvider>,
        );

        expect(screen.queryByText("999")).not.toBeInTheDocument();
        expect(screen.getByText(catalog.suggestedRetail)).toBeInTheDocument();
    });
});
