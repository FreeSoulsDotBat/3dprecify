// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// US7/T031 — the calculator's "usar do catálogo" slot for free/signed-out users: a VISIBLE
// honest affordance whose tap opens the SAME teaser panel (never a broken picker, never a
// fake save). Premium/lapsed accounts keep the real pickers (US5); the free manual calculator
// itself stays untouched (SC-310).

const { useEntitlementMock, useFilamentsMock, usePrintersMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useFilamentsMock: vi.fn(),
  usePrintersMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return {
    ...actual,
    useFilaments: () => useFilamentsMock(),
    usePrinters: () => usePrintersMock(),
  };
});

import { CalcularPage } from "./calcular-page";

const t = messages.calculator;
const catalogo = messages.catalogo;

function listState(items: unknown[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalcularPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("CalcularPage — free/signed-out teaser slot (US7/T031)", () => {
  it("signed-out: the catalog slot shows the honest affordance; tapping opens the teaser", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue({ data: undefined, isLoading: false });
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: t.catalogPicker.title }));
    expect(screen.getByRole("dialog")).toHaveTextContent(catalogo.teaserDialogTitle);
    // The manual free calculator is untouched behind it (SC-310).
    expect(screen.getAllByText("R$ 30,90").length).toBeGreaterThan(0);
  });

  it("free signed-in (none): same visible affordance → same honest teaser", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "none" }, isLoading: false });
    useFilamentsMock.mockReturnValue(listState([]));
    usePrintersMock.mockReturnValue(listState([]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: t.catalogPicker.title }));
    expect(screen.getByRole("dialog")).toHaveTextContent(catalogo.teaserDialogTitle);
  });

  it("premium keeps the REAL pickers — no teaser affordance", () => {
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u-1", email: "u@x.dev" } as never,
    });
    useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
    useFilamentsMock.mockReturnValue(
      listState([
        {
          id: "f-1",
          name: "PLA Azul",
          costPerRoll: "110.00",
          rollWeightKg: "1.000",
          defaultWasteGrams: "5.000",
        },
      ]),
    );
    usePrintersMock.mockReturnValue(listState([]));
    renderPage();

    expect(screen.getByRole("combobox", { name: t.catalogPicker.filament })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.catalogPicker.title })).not.toBeInTheDocument();
  });
});
