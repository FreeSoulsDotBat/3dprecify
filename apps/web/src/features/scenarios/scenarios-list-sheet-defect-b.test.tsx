// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Defect B (coordinator, 2026-07-20, T030 e2e finding) — an alternate repro using the REAL
// `useRenameScenario`/`useScenarios` hooks (only the wire functions mocked, like
// `entities/scenario/use-scenarios.test.tsx` does) over a REAL QueryClient, so the genuine
// query-invalidation-triggered re-render of the list (PATCH success → `invalidateQueries` →
// `ScenariosList` — renamed+exported 019/PR-F T092, was the private `ScenarioListBody` — refetches)
// races against the nested Sheet's own close — exactly the
// concurrency the fully-mocked `scenarios-list-sheet.test.tsx` repro cannot exercise.

const { entitlement, onlineState, renameScenario, listScenarios } = vi.hoisted(() => ({
  entitlement: { data: { status: "active" } as { status: string } | undefined },
  onlineState: { value: true },
  renameScenario: vi.fn(),
  listScenarios: vi.fn(),
}));

vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: () => entitlement }));
vi.mock("@/shared/lib/use-online", () => ({ useOnline: () => onlineState.value }));
vi.mock("@/shared/api/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/generated")>();
  return {
    ...actual,
    listScenariosApiV1ScenariosGet: listScenarios,
    renameScenarioApiV1ScenariosScenarioIdPatch: renameScenario,
  };
});

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

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ScenariosListSheet open onOpenChange={vi.fn()} onOpenScenario={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSessionStore.setState({
    status: "authenticated",
    user: { uid: "u1", email: "u@x.dev" } as never,
  });
  entitlement.data = { status: "active" };
  onlineState.value = true;
  listScenarios.mockReset().mockResolvedValue({ status: 200, data: { items: [ROW] } });
  renameScenario.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("ScenariosListSheet — Defect B, real hooks (query-invalidation race)", () => {
  it("a successful PATCH (real invalidateQueries) closing the nested Sheet leaves no stray overlay", async () => {
    const user = setup();
    // The invalidated refetch resolves with a NEW array/object reference — the exact shape change
    // that could desync a naive key/identity assumption during the close.
    renameScenario.mockResolvedValue({
      status: 200,
      data: { ...ROW, name: "Novo nome" },
    });
    listScenarios.mockResolvedValue({ status: 200, data: { items: [{ ...ROW }] } });

    renderSheet();
    await screen.findByText(ROW.name);

    await user.click(screen.getByRole("button", { name: `${t.rename} ${ROW.name}` }));
    expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(2);

    // Re-arm the list mock so the invalidated refetch resolves with the renamed row.
    listScenarios.mockResolvedValue({
      status: 200,
      data: { items: [{ ...ROW, name: "Novo nome" }] },
    });

    await user.click(screen.getByRole("button", { name: t.saveChanges }));

    // Let BOTH the mutation's onSuccess (invalidateQueries → refetch) and the Sheet close settle.
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Novo nome")).toBeInTheDocument());

    expect(document.querySelectorAll(".tf-dialog__overlay")).toHaveLength(1);
  });
});
