// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
// 019/PR-E — a versão do modelo vem do PACOTE, nunca de um literal: o bump 4.1.0 → 4.2.0
// (ADR-0034 §1) deixou este arquivo vermelho por um literal que não tinha por que existir.
import { computeCalculator, type PriceInput, PRICING_MODEL_VERSION } from "@3dprecify/pricing-core";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 019/PR-D (T067, ADR-0033 §2) — vermelho primeiro. O módulo é PURO sobre dados: recebe os preços
// RECOMPUTADOS por argumento (nunca chama o motor sozinho) e NUNCA importa `@/features` — a
// asserção de grafo abaixo lê o próprio arquivo-fonte para provar a fronteira, no molde do
// `premium-gate.test.ts`.

const { listMock, putMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  putMock: vi.fn(),
}));
vi.mock("@/shared/api/generated", () => ({
  listPriceObservationsApiV1PriceObservationsGet: listMock,
  putPriceObservationsApiV1PriceObservationsPut: putMock,
}));

const { onlineMock } = vi.hoisted(() => ({ onlineMock: vi.fn(() => true) }));
vi.mock("@/shared/lib/use-online", () => ({ useOnline: onlineMock }));

import { ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import {
  derivePriceChanges,
  observationKey,
  priceObservationsQueryKey,
  type PriceObservation,
  type RecomputedPrice,
  useObservePrices,
  usePriceObservations,
} from "./price-observations";

function signInAs(uid: string) {
  useSessionStore.setState({ status: "authenticated", user: { uid } as never });
}

const clientes: QueryClient[] = [];
function novoCliente() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(c);
  return c;
}

function wrapper() {
  const client = novoCliente();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  listMock.mockReset().mockResolvedValue({ status: 200, data: { items: [] } });
  putMock.mockReset().mockResolvedValue({ status: 200, data: { upserted: 0 } });
  onlineMock.mockReset().mockReturnValue(true);
  signInAs("uidA");
});

afterEach(async () => {
  await Promise.all(clientes.map((c) => c.cancelQueries()));
  for (const c of clientes) {
    c.unmount();
    c.clear();
  }
  clientes.length = 0;
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

// ── Fronteira: o módulo é puro sobre dados, nunca importa `@/features` ────────────────────────────

describe("price-observations — fronteira FSD-Lite (asserção de grafo por texto-fonte)", () => {
  it("o arquivo-fonte não importa @/features nem persiste em catalog-cache", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.join(__dirname, "price-observations.ts"), "utf-8");
    expect(src).not.toMatch(/@\/features/);
    expect(src).not.toMatch(/catalog-cache/);
  });
});

// ── derivePriceChanges — pura, motor REAL (não mockado) ───────────────────────────────────────────

function baseInput(precoVarejo: number): PriceInput {
  // Ajusta o custo para que o motor produza exatamente `precoVarejo` sob markup 0 (varejo = custo).
  return {
    costPerRoll: precoVarejo,
    rollWeightKg: 1, // material = costPerRoll/(1kg*1000g) * 1000g = costPerRoll = precoVarejo
    printGrams: 1000,
    printTimeHours: 0,
    avgPowerKw: 0,
    tariffPerKwh: 0,
    machineValue: 0,
    machineLifetimeHours: 1,
    markupVarejoPct: 0,
    markupAtacadoPct: 0,
  };
}

function recomputed(subjectId: string, precoVarejo: number): RecomputedPrice {
  const real = computeCalculator(baseInput(precoVarejo));
  return { subjectKind: "PRODUCT", subjectId, precoVarejo: real.precoVarejo };
}

function observation(subjectId: string, observedPrice: number): PriceObservation {
  return {
    subjectKind: "PRODUCT",
    subjectId,
    observedPrice,
    observedAt: "2026-08-01T00:00:00Z",
    modelVersion: PRICING_MODEL_VERSION,
  };
}

describe("derivePriceChanges — pura, sobre o motor REAL", () => {
  it("3 de 12 mudados: count 3, was/now certos, sem observação não conta, igualdade em centavos não conta", () => {
    const recomputados: RecomputedPrice[] = [];
    const byKey = new Map<string, PriceObservation>();
    for (let i = 0; i < 12; i++) {
      const id = `p${i}`;
      const price = 100 + i;
      recomputados.push(recomputed(id, price));
    }
    // 3 mudaram de verdade (observado != recomputado em centavos)
    byKey.set(observationKey("PRODUCT", "p0"), observation("p0", 50)); // mudou: 100 -> 50
    byKey.set(observationKey("PRODUCT", "p1"), observation("p1", 200)); // mudou: 101 -> 200
    byKey.set(observationKey("PRODUCT", "p2"), observation("p2", 999)); // mudou
    // igual em centavos — não conta
    byKey.set(observationKey("PRODUCT", "p3"), observation("p3", 103));
    // p4..p11 SEM observação — não contam (ausência é ausência)

    const { changed, count } = derivePriceChanges(recomputados, byKey);
    expect(count).toBe(3);
    expect(changed).toHaveLength(3);
    const byId = new Map(changed.map((c) => [c.subjectId, c]));
    expect(byId.get("p0")).toMatchObject({ was: 50, now: 100 });
    expect(byId.get("p1")).toMatchObject({ was: 200, now: 101 });
    expect(byId.get("p2")).toMatchObject({ was: 999, now: 102 });
  });

  it("comparação é em centavos (Math.round(x*100)) — nunca ponto flutuante cru", () => {
    const rec = recomputed("p1", 10.1);
    const byKey = new Map<string, PriceObservation>([
      [observationKey("PRODUCT", "p1"), observation("p1", 10.1)],
    ]);
    const { count } = derivePriceChanges([rec], byKey);
    expect(count).toBe(0);
  });
});

// ── usePriceObservations — leitura, 403 ENTITLEMENT_REQUIRED honesto ──────────────────────────────

describe("usePriceObservations", () => {
  it("leitura online popula byKey", async () => {
    listMock.mockResolvedValue({
      status: 200,
      data: {
        items: [
          {
            subjectKind: "PRODUCT",
            subjectId: "p1",
            observedPrice: "10.00",
            observedAt: "2026-08-01T00:00:00Z",
            modelVersion: PRICING_MODEL_VERSION,
            catalogVersion: null,
          },
        ],
      },
    });

    const { result } = renderHook(() => usePriceObservations(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.byKey.size).toBe(1));
    expect(result.current.entitlementDenied).toBe(false);
    expect(result.current.byKey.get(observationKey("PRODUCT", "p1"))?.observedPrice).toBe(10);
  });

  it("403 ENTITLEMENT_REQUIRED ⇒ entitlementDenied, byKey vazio, SEM erro visível", async () => {
    listMock.mockRejectedValue(
      new ApiError({
        status: 403,
        code: "ENTITLEMENT_REQUIRED",
        message: "denied",
        correlationId: null,
      }),
    );

    const { result } = renderHook(() => usePriceObservations(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.entitlementDenied).toBe(true));
    expect(result.current.byKey.size).toBe(0);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("uma falha comum (rede) permanece visível como erro — só ENTITLEMENT_REQUIRED é silenciosa", async () => {
    listMock.mockRejectedValue(
      new ApiError({ status: 500, code: "UNKNOWN", message: "boom", correlationId: null }),
    );

    const { result } = renderHook(() => usePriceObservations(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.entitlementDenied).toBe(false);
  });
});

// ── useObservePrices — PUT em lote, online-only, dedupe por assinatura, falha silenciosa ──────────

describe("useObservePrices", () => {
  it("observe([]) não chama nada", () => {
    const { result } = renderHook(() => useObservePrices(), { wrapper: wrapper() });
    result.current.observe([]);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("observe([a,b]) chama o PUT 1× com os 2 itens (string decimal 2 casas + modelVersion)", async () => {
    const { result } = renderHook(() => useObservePrices(), { wrapper: wrapper() });

    result.current.observe([
      { subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 },
      { subjectKind: "PRODUCT", subjectId: "p2", precoVarejo: 20.5 },
    ]);

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
    expect(putMock).toHaveBeenCalledWith({
      items: [
        {
          subjectKind: "PRODUCT",
          subjectId: "p1",
          observedPrice: "10.00",
          modelVersion: PRICING_MODEL_VERSION,
        },
        {
          subjectKind: "PRODUCT",
          subjectId: "p2",
          observedPrice: "20.50",
          modelVersion: PRICING_MODEL_VERSION,
        },
      ],
    });
  });

  it("dedupe: o MESMO conjunto (mesma assinatura) não repete o PUT na mesma sessão do hook", async () => {
    const { result } = renderHook(() => useObservePrices(), { wrapper: wrapper() });
    const items: RecomputedPrice[] = [{ subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 }];

    result.current.observe(items);
    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));

    result.current.observe(items);
    await new Promise((r) => setTimeout(r, 0));
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it("um conjunto DIFERENTE (nova assinatura) dispara um novo PUT", async () => {
    const { result } = renderHook(() => useObservePrices(), { wrapper: wrapper() });

    result.current.observe([{ subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 }]);
    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));

    result.current.observe([{ subjectKind: "PRODUCT", subjectId: "p2", precoVarejo: 20 }]);
    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(2));
  });

  it("offline: nada é enviado", () => {
    onlineMock.mockReturnValue(false);
    const { result } = renderHook(() => useObservePrices(), { wrapper: wrapper() });

    result.current.observe([{ subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 }]);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("falha do PUT (rede/403 lapsed) é SILENCIOSA — sem toast/Alert; a marca não avança", async () => {
    putMock.mockRejectedValue(
      new ApiError({
        status: 403,
        code: "ENTITLEMENT_REQUIRED",
        message: "lapsed",
        correlationId: null,
      }),
    );
    const client = novoCliente();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useObservePrices(), { wrapper: Wrapper });
    result.current.observe([{ subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 }]);

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: priceObservationsQueryKey("uidA"),
    });
  });

  it("2xx invalida priceObservationsQueryKey", async () => {
    const client = novoCliente();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useObservePrices(), { wrapper: Wrapper });
    result.current.observe([{ subjectKind: "PRODUCT", subjectId: "p1", precoVarejo: 10 }]);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: priceObservationsQueryKey("uidA") }),
    );
  });
});
