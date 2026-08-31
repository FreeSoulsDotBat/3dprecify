// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BomOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T015c (US6/K2) — the Kits tab of the catalog, written FAILING-first. A saved kit is
// catalog content like any other: it lists per-account, it has an honest empty state, it opens
// back into the composer, and it deletes behind a confirm. The panel never prices anything — a
// kit stores inputs only (FR-407), so a row shows structure ("N peças"), never money.
//
// 019/PR-B (T044) — KitsPanel ganhou `useEntitlement()`/`gate` (era o único dos quatro sem faixa
// lapsed nem vazio didático); precisa do MESMO par de mocks (entitlement + sessão) dos irmãos.

const { useBomsMock, deleteBomMock, navigateMock } = vi.hoisted(() => ({
    useBomsMock: vi.fn(),
    deleteBomMock: vi.fn(),
    navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/entities/bom/use-bom", () => ({
    useBoms: () => useBomsMock(),
    useDeleteBom: () => ({ mutateAsync: deleteBomMock, isPending: false }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({
    useEntitlement: () => ({ data: { status: "active" }, isLoading: false }),
}));

import { KitsPanel } from "./kits-panel";

const catalogo = messages.catalogo;

function kit(over: Partial<BomOut> = {}): BomOut {
    return {
        id: "k1",
        name: "Kit Suporte",
        lines: [
            { id: "l1", position: 0, quantity: 2 },
            { id: "l2", position: 1, quantity: 1 },
        ],
        createdAt: "2026-07-11T00:00:00Z",
        updatedAt: "2026-07-11T00:00:00Z",
        ...over,
    } as BomOut;
}

function mockKits(items: BomOut[], over: Record<string, unknown> = {}) {
    useBomsMock.mockReturnValue({
        items,
        isLoading: false,
        isError: false,
        error: null,
        stale: false,
        refetch: vi.fn(),
        ...over,
    });
}

beforeEach(() => {
    useBomsMock.mockReset();
    deleteBomMock.mockReset();
    navigateMock.mockReset();
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

describe("KitsPanel — the saved kits list (K2)", () => {
    it("lists the account's saved kits with their piece count, and never a price", () => {
        mockKits([kit(), kit({ id: "k2", name: "Kit Prateleira", lines: [] })]);
        render(<KitsPanel />);

        expect(screen.getByText("Kit Suporte")).toBeInTheDocument();
        expect(screen.getByText("Kit Prateleira")).toBeInTheDocument();
        // A kit stores inputs only (FR-407) — a row describes structure, never money.
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
        expect(screen.getByText(catalogo.countKitPieces.replace("{n}", "2"))).toBeInTheDocument();
    });

    it("shows the honest empty state when the account has no kits yet", () => {
        mockKits([]);
        render(<KitsPanel />);

        expect(screen.getByText(catalogo.emptyKitsTitle)).toBeInTheDocument();
        expect(screen.getByText(catalogo.emptyKitsBody)).toBeInTheDocument();
    });

    it("opens a saved kit back in the composer (reload → recompute, never a stored price)", () => {
        mockKits([kit()]);
        render(<KitsPanel />);

        // The row's own open affordance (the delete action also carries the kit's name).
        fireEvent.click(screen.getByText("Kit Suporte"));

        expect(navigateMock).toHaveBeenCalledWith({ to: "/kits", search: { id: "k1" } });
    });

    it("the add affordance sends the seller to the composer", () => {
        mockKits([]);
        render(<KitsPanel />);

        fireEvent.click(screen.getByRole("button", { name: new RegExp(catalogo.addKit, "i") }));

        expect(navigateMock).toHaveBeenCalledWith({ to: "/kits" });
    });
});
