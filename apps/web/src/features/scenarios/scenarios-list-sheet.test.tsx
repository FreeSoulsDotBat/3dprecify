// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 010/T029 (E5, PR-B US6) — manage (search · rename · duplicate · delete) + the lapse read-only
// freeze, written FAILING-first (none of this existed on the list Sheet).

const {
  useScenariosMock,
  renameMutateAsync,
  duplicateMutateAsync,
  deleteMutateAsync,
  entitlement,
  onlineState,
} = vi.hoisted(() => ({
  useScenariosMock: vi.fn(),
  renameMutateAsync: vi.fn(),
  duplicateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  entitlement: { data: { status: "active" } as { status: string } | undefined },
  onlineState: { value: true },
}));

vi.mock("@/entities/scenario/use-scenarios", () => ({
  useScenarios: (args: unknown) => useScenariosMock(args),
  useRenameScenario: () => ({ mutateAsync: renameMutateAsync, isPending: false }),
  useDuplicateScenario: () => ({ mutateAsync: duplicateMutateAsync, isPending: false }),
  useDeleteScenario: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => entitlement,
}));
vi.mock("@/shared/lib/use-online", () => ({
  useOnline: () => onlineState.value,
}));

import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { ScenariosListSheet } from "./scenarios-list-sheet";

const t = messages.scenarios;

const ROW = {
  id: "s1",
  name: "ML Clássico × Shopee",
  note: "Comparação pré-Black Friday",
  config: { schemaVersion: 1, costBasis: { kind: "AD_HOC", ref: null, degraded: false } },
  createdAt: "2026-07-19T10:00:00Z",
  updatedAt: "2026-07-19T10:00:00Z",
};

function listState(items: unknown[] = [ROW], over: Record<string, unknown> = {}) {
  return {
    items,
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    isFetchingMore: false,
    ...over,
  };
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function renderSheet(onOpenScenario = vi.fn()) {
  return render(<ScenariosListSheet open onOpenChange={vi.fn()} onOpenScenario={onOpenScenario} />);
}

beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u1", email: "u@x.dev" } as never,
  });
  entitlement.data = { status: "active" };
  onlineState.value = true;
  useScenariosMock.mockReset().mockReturnValue(listState());
  renameMutateAsync.mockReset();
  duplicateMutateAsync.mockReset();
  deleteMutateAsync.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("ScenariosListSheet — search (T029/US6)", () => {
  it("typing a term calls useScenarios with the DEBOUNCED q", async () => {
    const user = setup();
    renderSheet();
    await user.type(screen.getByLabelText(t.searchPlaceholder), "Maria");
    await waitFor(() =>
      expect(useScenariosMock).toHaveBeenCalledWith(expect.objectContaining({ q: "Maria" })),
    );
  });

  it("an empty search result is HONEST — never silently shows the unfiltered list", async () => {
    useScenariosMock.mockReturnValue(listState([]));
    renderSheet();
    fireEvent.change(screen.getByLabelText(t.searchPlaceholder), { target: { value: "zzz" } });
    await waitFor(() =>
      expect(screen.getByText(t.searchEmpty.replace("{termo}", "zzz"))).toBeInTheDocument(),
    );
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument(); // never the unfiltered empty copy
    await userEvent.click(screen.getByRole("button", { name: t.searchClear }));
    expect(screen.getByLabelText(t.searchPlaceholder)).toHaveValue("");
  });
});

describe("ScenariosListSheet — rename (PATCH, T029)", () => {
  it("opens the rename Sheet pre-filled and saves via PATCH on submit", async () => {
    const user = setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: `${t.rename} ${ROW.name}` }));
    expect(screen.getByText(t.renameSheetTitle)).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue(ROW.name);
    await user.clear(nameInput);
    await user.type(nameInput, "Novo nome");
    renameMutateAsync.mockResolvedValue({ ...ROW, name: "Novo nome" });
    await user.click(screen.getByRole("button", { name: t.saveChanges }));

    await waitFor(() =>
      expect(renameMutateAsync).toHaveBeenCalledWith({
        id: "s1",
        body: { name: "Novo nome", note: ROW.note },
      }),
    );
  });

  it("a blank name blocks submit with the inline required message", async () => {
    const user = setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: `${t.rename} ${ROW.name}` }));
    const nameInput = screen.getByDisplayValue(ROW.name);
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: t.saveChanges }));
    expect(renameMutateAsync).not.toHaveBeenCalled();
  });
});

describe("ScenariosListSheet — duplicate (T029, completes the T026 client gap)", () => {
  it("duplicates and immediately OPENS the copy (ux §5 tweak-and-compare)", async () => {
    const user = setup();
    const onOpenScenario = vi.fn();
    const copy = { ...ROW, id: "s2", name: "Cópia de ML Clássico × Shopee" };
    duplicateMutateAsync.mockResolvedValue(copy);
    renderSheet(onOpenScenario);

    await user.click(screen.getByRole("button", { name: `${t.duplicate} ${ROW.name}` }));

    await waitFor(() => expect(duplicateMutateAsync).toHaveBeenCalledWith("s1"));
    await waitFor(() =>
      expect(onOpenScenario).toHaveBeenCalledWith(
        copy.config,
        expect.objectContaining({ id: "s2" }),
      ),
    );
  });

  it("a denied duplicate (offline/lapsed) shows the honest reason, never a silent failure", async () => {
    const user = setup();
    duplicateMutateAsync.mockRejectedValue(
      new ApiError({ status: 0, code: "UNKNOWN", message: "offline", correlationId: null }),
    );
    renderSheet();
    await user.click(screen.getByRole("button", { name: `${t.duplicate} ${ROW.name}` }));
    await waitFor(() => expect(screen.getByText(t.writeOffline)).toBeInTheDocument());
  });
});

describe("ScenariosListSheet — delete (soft, always confirmed, T029)", () => {
  it("requires confirmation before calling DELETE", async () => {
    const user = setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: `${t.delete} ${ROW.name}` }));
    expect(screen.getByText(t.deleteTitle.replace("{nome}", ROW.name))).toBeInTheDocument();
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    deleteMutateAsync.mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: t.deleteConfirm }));
    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("s1"));
  });
});

describe("ScenariosListSheet — lapse read-only freeze (VR-610/§0.1)", () => {
  it("lapsed: read/reopen still work, but every write action is disabled with an honest reason", async () => {
    entitlement.data = { status: "lapsed" };
    const onOpenScenario = vi.fn();
    renderSheet(onOpenScenario);

    expect(screen.getByRole("button", { name: `${t.open} ${ROW.name}` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `${t.rename} ${ROW.name}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${t.duplicate} ${ROW.name}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${t.delete} ${ROW.name}` })).toBeDisabled();
    expect(screen.getAllByText(t.writeLapsed).length).toBeGreaterThan(0);
  });

  it("offline (active): reads still work, writes disabled with the honest conexão reason", () => {
    onlineState.value = false;
    renderSheet();
    expect(screen.getByRole("button", { name: `${t.rename} ${ROW.name}` })).toBeDisabled();
    expect(screen.getAllByText(t.writeOffline).length).toBeGreaterThan(0);
  });
});
