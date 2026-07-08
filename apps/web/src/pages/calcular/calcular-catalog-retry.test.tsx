// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEE_CATALOG_SEED, type UseFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CalcularPage } from "./calcular-page";

// US3 (SC-104): the online catalog refresh is non-blocking — a failure must surface a RETRY without
// ever blocking the calculator (seed/store keep it live). We mock ONLY the store hook so we can drive
// isError/isFetching/refetch deterministically; the seed, schema and pricing model stay real.
const { useFeeCatalogMock } = vi.hoisted(() => ({ useFeeCatalogMock: vi.fn() }));
vi.mock("@/shared/fee-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/fee-catalog")>();
  return { ...actual, useFeeCatalog: () => useFeeCatalogMock() };
});

afterEach(() => cleanup());
const t = messages.calculator;

function catalogState(over: Partial<UseFeeCatalog> = {}): UseFeeCatalog {
  return {
    catalog: FEE_CATALOG_SEED,
    source: "seed",
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalcularPage />
    </QueryClientProvider>,
  );
}

describe("US3 — non-blocking catalog refresh retry (SC-104)", () => {
  it("surfaces a retry notice on a failed refresh WHILE the calculator still computes (no blank grid)", () => {
    useFeeCatalogMock.mockReturnValue(catalogState({ isError: true }));
    renderPage();

    // The non-blocking notice + a retry affordance are shown.
    expect(screen.getByText(t.channels.refreshErrorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.channels.refreshRetry })).toBeInTheDocument();

    // Non-blocking: the price still computes from the entered costs (never blocked on the network).
    fireEvent.change(screen.getByRole("textbox", { name: t.fields.costPerRoll }), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: t.fields.rollWeight }), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: t.fields.grams }), {
      target: { value: "100" },
    });
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it("clicking 'Tentar novamente' calls refetch", () => {
    const refetch = vi.fn();
    useFeeCatalogMock.mockReturnValue(catalogState({ isError: true, refetch }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: t.channels.refreshRetry }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows NO retry notice when the catalog is healthy", () => {
    useFeeCatalogMock.mockReturnValue(catalogState({ isError: false }));
    renderPage();

    expect(screen.queryByText(t.channels.refreshErrorTitle)).not.toBeInTheDocument();
  });
});
