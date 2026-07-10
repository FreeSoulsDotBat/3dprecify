// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

// US6-4/T030 — deleting a filament/printer that products REFERENCE warns first (ux §1.6b): the
// confirm Dialog gains an info line with the count; confirming still deletes (the server
// captures last-known + unlinks in the same txn — D6). No warn when nothing references it.

const { useFilamentsMock, useProductsMock } = vi.hoisted(() => ({
  useFilamentsMock: vi.fn(),
  useProductsMock: vi.fn(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return {
    ...actual,
    useFilaments: () => useFilamentsMock(),
    useProducts: () => useProductsMock(),
    useCreateFilament: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateFilament: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteFilament: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

import { FilamentsPanel } from "./filaments-panel";

const catalogo = messages.catalogo;
const pf = messages.productForm;

const filament = {
  id: "f-1",
  name: "PLA Azul",
  material: "PLA",
  costPerRoll: "110.00",
  rollWeightKg: "1.000",
  defaultWasteGrams: "5.000",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};
const productRef = (id: string, filamentId: string | null) => ({
  id,
  name: `Produto ${id}`,
  filamentId,
  printerId: "p-1",
});

function listState(items: unknown[]) {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

beforeEach(() => {
  useFilamentsMock.mockReturnValue(listState([filament]));
  useProductsMock.mockReturnValue(listState([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FilamentsPanel — referenced-item delete warn (US6-4)", () => {
  it("warns with the product count when the filament is referenced", () => {
    useProductsMock.mockReturnValue(
      listState([productRef("a", "f-1"), productRef("b", "f-1"), productRef("c", null)]),
    );
    render(<FilamentsPanel />);

    fireEvent.click(screen.getByRole("button", { name: `${catalogo.remove} PLA Azul` }));

    expect(screen.getByText(pf.deleteWarnFilament.replace("{n}", "2"))).toBeInTheDocument();
  });

  it("shows NO warn when nothing references the filament", () => {
    render(<FilamentsPanel />);

    fireEvent.click(screen.getByRole("button", { name: `${catalogo.remove} PLA Azul` }));

    expect(screen.getByText(messages.catalogForm.deleteBody)).toBeInTheDocument();
    expect(screen.queryByText(pf.deleteWarnFilament.replace("{n}", "0"))).not.toBeInTheDocument();
  });
});
