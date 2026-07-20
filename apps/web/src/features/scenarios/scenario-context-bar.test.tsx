// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 010/T023+T029 (E5, PR-B US3/US6) — written FAILING-first (the extended context bar did not
// exist: PR-A shipped name + live subtitle + Fechar only).

const { renameMutateAsync, duplicateMutateAsync, updateMutateAsync, navigateMock, onlineState } =
  vi.hoisted(() => ({
    renameMutateAsync: vi.fn(),
    duplicateMutateAsync: vi.fn(),
    updateMutateAsync: vi.fn(),
    navigateMock: vi.fn(),
    onlineState: { value: true },
  }));

vi.mock("@/entities/scenario/use-scenarios", () => ({
  useRenameScenario: () => ({ mutateAsync: renameMutateAsync, isPending: false }),
  useDuplicateScenario: () => ({ mutateAsync: duplicateMutateAsync, isPending: false }),
  useUpdateScenario: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("@/shared/lib/use-online", () => ({
  useOnline: () => onlineState.value,
}));

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";

import { ScenarioContextBar, type ScenarioContextBarProps } from "./scenario-context-bar";

const t = messages.scenarios;
const pf = messages.productForm;

const CONFIG: ScenarioConfig = {
  schemaVersion: 1,
  includeMarketplace: true,
  costBasis: { kind: "AD_HOC", ref: null, lastKnown: { costPerRoll: "100" } },
  channels: [],
  otherCosts: [],
};

function baseProps(over: Partial<ScenarioContextBarProps> = {}): ScenarioContextBarProps {
  return {
    scenario: { id: "s1", name: "ML Clássico × Shopee", note: "nota" },
    costBasis: { kind: "AD_HOC", ref: null, degraded: false },
    dirty: false,
    lapsed: false,
    buildCurrentConfig: () => CONFIG,
    onClose: vi.fn(),
    onRenamed: vi.fn(),
    onSavedChanges: vi.fn(),
    onDuplicated: vi.fn(),
    ...over,
  };
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

beforeEach(() => {
  onlineState.value = true;
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("ScenarioContextBar — the D6 honest caption (F1: never removido/excluído/deletado)", () => {
  it("shows the calm manualValuesKept caption when degraded, and never a removal claim", () => {
    render(
      <ScenarioContextBar
        {...baseProps({
          costBasis: { kind: "PRODUCT", ref: { id: "p1", name: "Vaso G" }, degraded: true },
        })}
      />,
    );
    expect(screen.getByText(pf.manualValuesKept)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/removid|excluíd|deletad/i);
  });

  it("shows NO caption when not degraded (D3 live-reflect / AD_HOC)", () => {
    render(<ScenarioContextBar {...baseProps()} />);
    expect(screen.queryByText(pf.manualValuesKept)).not.toBeInTheDocument();
  });
});

describe("ScenarioContextBar — 'Abrir origem' (F1: only when the ref actually resolves)", () => {
  it("offered for a live, resolving PRODUCT ref; navigates to the product page", async () => {
    const user = setup();
    render(
      <ScenarioContextBar
        {...baseProps({
          costBasis: { kind: "PRODUCT", ref: { id: "p1", name: "Vaso G" }, degraded: false },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: t.openOrigin }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/catalogo/produtos/$productId",
      params: { productId: "p1" },
    });
  });

  it("absent when degraded — never a broken link", () => {
    render(
      <ScenarioContextBar
        {...baseProps({
          costBasis: { kind: "PRODUCT", ref: { id: "p1", name: "Vaso G" }, degraded: true },
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: t.openOrigin })).not.toBeInTheDocument();
  });

  it("absent for an AD_HOC basis (nothing to open)", () => {
    render(<ScenarioContextBar {...baseProps()} />);
    expect(screen.queryByRole("button", { name: t.openOrigin })).not.toBeInTheDocument();
  });
});

describe("ScenarioContextBar — unsaved changes + 'Salvar alterações' (PUT, T029)", () => {
  it("dirty=false: no badge, Salvar alterações disabled", () => {
    render(<ScenarioContextBar {...baseProps({ dirty: false })} />);
    expect(screen.queryByText(t.unsavedBadge)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.saveChanges })).toBeDisabled();
  });

  it("dirty=true: shows the badge, saves via PUT on click, calls onSavedChanges on a real 200", async () => {
    const user = setup();
    const onSavedChanges = vi.fn();
    updateMutateAsync.mockResolvedValue({ id: "s1" });
    render(<ScenarioContextBar {...baseProps({ dirty: true, onSavedChanges })} />);

    expect(screen.getByText(t.unsavedBadge)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.saveChanges }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "s1",
        body: { name: "ML Clássico × Shopee", note: "nota", config: CONFIG },
      }),
    );
    await waitFor(() => expect(onSavedChanges).toHaveBeenCalled());
  });

  it("a denied save (offline/lapsed) shows the honest reason, never a fake success", async () => {
    const user = setup();
    updateMutateAsync.mockRejectedValue(
      new ApiError({ status: 0, code: "UNKNOWN", message: "offline", correlationId: null }),
    );
    render(<ScenarioContextBar {...baseProps({ dirty: true })} />);
    await user.click(screen.getByRole("button", { name: t.saveChanges }));
    await waitFor(() => expect(screen.getByText(t.writeOffline)).toBeInTheDocument());
  });
});

describe("ScenarioContextBar — Duplicar (T029)", () => {
  it("duplicates and hands the copy to onDuplicated", async () => {
    const user = setup();
    const onDuplicated = vi.fn();
    duplicateMutateAsync.mockResolvedValue({ id: "s2", name: "Cópia", note: null, config: CONFIG });
    render(<ScenarioContextBar {...baseProps({ onDuplicated })} />);

    await user.click(screen.getByRole("button", { name: t.duplicate }));
    await waitFor(() => expect(duplicateMutateAsync).toHaveBeenCalledWith("s1"));
    await waitFor(() =>
      expect(onDuplicated).toHaveBeenCalledWith(
        CONFIG,
        expect.objectContaining({ id: "s2", name: "Cópia" }),
      ),
    );
  });
});

describe("ScenarioContextBar — Renomear (PATCH, T029)", () => {
  it("opens the rename Sheet and calls PATCH on submit", async () => {
    const user = setup();
    const onRenamed = vi.fn();
    renameMutateAsync.mockResolvedValue({ id: "s1", name: "Novo nome" });
    render(<ScenarioContextBar {...baseProps({ onRenamed })} />);

    await user.click(screen.getByRole("button", { name: t.rename }));
    const input = screen.getByDisplayValue("ML Clássico × Shopee");
    await user.clear(input);
    await user.type(input, "Novo nome");
    await user.click(screen.getByRole("button", { name: t.saveChanges }));

    await waitFor(() =>
      expect(renameMutateAsync).toHaveBeenCalledWith({ id: "s1", body: { name: "Novo nome" } }),
    );
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("Novo nome"));
  });
});

describe("ScenarioContextBar — Fechar cenário with unsaved changes (§4.1)", () => {
  it("dirty: confirms before discarding; 'Voltar' keeps the scenario loaded", async () => {
    const user = setup();
    const onClose = vi.fn();
    render(<ScenarioContextBar {...baseProps({ dirty: true, onClose })} />);

    await user.click(screen.getByRole("button", { name: t.closeScenario }));
    expect(screen.getByText(t.discardChangesTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.back }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: t.closeScenario }));
    await user.click(screen.getByRole("button", { name: t.discardChanges }));
    expect(onClose).toHaveBeenCalled();
  });

  it("clean: closes immediately, no confirm", async () => {
    const user = setup();
    const onClose = vi.fn();
    render(<ScenarioContextBar {...baseProps({ dirty: false, onClose })} />);
    await user.click(screen.getByRole("button", { name: t.closeScenario }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText(t.discardChangesTitle)).not.toBeInTheDocument();
  });
});

describe("ScenarioContextBar — lapse read-only freeze (VR-610) + offline", () => {
  it("lapsed: every write action disabled, honest reason shown, Abrir origem (a read) unaffected", () => {
    render(
      <ScenarioContextBar
        {...baseProps({
          lapsed: true,
          costBasis: { kind: "PRODUCT", ref: { id: "p1", name: "x" }, degraded: false },
        })}
      />,
    );
    expect(screen.getByRole("button", { name: t.rename })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.duplicate })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.openOrigin })).toBeEnabled();
    expect(screen.getByText(t.writeLapsed)).toBeInTheDocument();
  });

  it("offline: writes disabled with the honest conexão reason", () => {
    onlineState.value = false;
    render(<ScenarioContextBar {...baseProps()} />);
    expect(screen.getByRole("button", { name: t.rename })).toBeDisabled();
    expect(screen.getByText(t.writeOffline)).toBeInTheDocument();
  });
});
