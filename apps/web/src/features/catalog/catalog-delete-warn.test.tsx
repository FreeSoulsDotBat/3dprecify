// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

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
// 013/FB-02 — FilamentsPanel reads its own lapsed state. Mutable so the delete-honesty block below
// can flip it to "lapsed" (no QueryClientProvider needed for the real hook).
const { entitlementStatus } = vi.hoisted(() => ({ entitlementStatus: { current: "active" } }));
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({ data: { status: entitlementStatus.current }, isLoading: false }),
}));

import { FilamentsPanel } from "./filaments-panel";

const catalog = messages.catalog;
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
    entitlementStatus.current = "active";
    // 019/PR-B (T044) — `premiumGate()` também lê a sessão.
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

describe("FilamentsPanel — referenced-item delete warn (US6-4)", () => {
    it("warns with the product count when the filament is referenced", () => {
        useProductsMock.mockReturnValue(
            listState([productRef("a", "f-1"), productRef("b", "f-1"), productRef("c", null)]),
        );
        render(<FilamentsPanel />);

        fireEvent.click(screen.getByRole("button", { name: `${catalog.remove} PLA Azul` }));

        expect(screen.getByText(pf.deleteWarnFilament.replace("{n}", "2"))).toBeInTheDocument();
    });

    it("shows NO warn when nothing references the filament", () => {
        render(<FilamentsPanel />);

        fireEvent.click(screen.getByRole("button", { name: `${catalog.remove} PLA Azul` }));

        expect(screen.getByText(messages.catalogForm.deleteBody)).toBeInTheDocument();
        expect(
            screen.queryByText(pf.deleteWarnFilament.replace("{n}", "0")),
        ).not.toBeInTheDocument();
    });
});

// 013/FB-02 (T034 homologation nit) — REGRESSION GUARD. On lapsed, tapping delete must NOT open the
// working destructive confirm and then 403 on submit (ux-catalog §3: "Never show a delete/edit as
// *working* then fail — the intercept happens on tap, honestly"). It routes to the same read-only
// reactivation surface Edit uses. Active still gets the real confirm dialog.
describe("FilamentsPanel — lapsed delete honesty (T034)", () => {
    it("active: tapping delete opens the destructive confirm dialog", () => {
        render(<FilamentsPanel />);
        fireEvent.click(screen.getByRole("button", { name: `${catalog.remove} PLA Azul` }));
        expect(screen.getByText(messages.catalogForm.deleteBody)).toBeInTheDocument();
    });

    it("lapsed: tapping delete shows the reactivation intercept, NEVER the destructive confirm", () => {
        entitlementStatus.current = "lapsed";
        render(<FilamentsPanel />);
        fireEvent.click(screen.getByRole("button", { name: `${catalog.remove} PLA Azul` }));
        // The inert edit sheet with its reactivation footer (019/PR-B T045) — the same honest surface
        // Edit uses.
        expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(catalog.reactivateBody);
        // And crucially NOT the working destructive confirm.
        expect(screen.queryByText(messages.catalogForm.deleteBody)).not.toBeInTheDocument();
    });
});
