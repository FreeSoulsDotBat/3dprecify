// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 018 — achado A1 da homologação, virado teste.
//
// No mestre-detalhe, o registro abria à direita e NENHUM card da lista ficava marcado: o vendedor
// perdia o vínculo entre o que escolheu e o que está lendo. Nada quebrava, nada ficava vermelho —
// por isso só a imagem pegou. Este teste é o que impede a volta.

const { useHistoryMock, useSyncOutboxMock, useEntitlementMock, useEntryActionsMock, searchMock } =
  vi.hoisted(() => ({
    useHistoryMock: vi.fn(),
    useSyncOutboxMock: vi.fn(),
    useEntitlementMock: vi.fn(),
    useEntryActionsMock: vi.fn(),
    searchMock: vi.fn(),
  }));

vi.mock("@/entities/history/use-history", () => ({
  useHistory: useHistoryMock,
  useSyncOutbox: useSyncOutboxMock,
  useEntryActions: useEntryActionsMock,
  useSnapshot: () => ({ item: null, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));
// O detalhe não é o assunto aqui — e ele puxa React Query (produtos/kits, para resolver a origem).
// Dublado, o teste mede exatamente uma coisa: se a LISTA declara qual card está aberto.
vi.mock("@/pages/historico/snapshot-detail-page", async () => {
  const react = await import("react");
  return {
    SnapshotDetailPage: ({ snapshotId }: { snapshotId: string }) => (
      <div data-testid="detalhe">detalhe {snapshotId}</div>
    ),
    SnapshotEmbeddedContext: react.createContext(false),
  };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: unknown; [k: string]: unknown }) => (
    <a {...(rest as object)}>{children as never}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => searchMock(),
}));

import type { HistoryItem } from "@/entities/history/outbox";
import { installMatchMedia, VIEWPORT } from "@/shared/lib/match-media.test-helper";
import { useSessionStore } from "@/shared/session/session-store";

import { HistoricoPage } from "./historico-page";

function item(over: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "s1",
    clientSnapshotId: "csid-1",
    kind: "SINGLE",
    label: "Cliente João",
    headlineTotal: "275.00",
    headlineBasis: "PRECO_VAREJO",
    deviceQuotedAt: "2026-07-12T19:30:00Z",
    syncState: "synced",
    snapshot: null,
    entry: null,
    ...over,
  };
}

let mm: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  mm = installMatchMedia(VIEWPORT.desktopLarge);
  useSessionStore.setState({ status: "authenticated" });
  useEntitlementMock.mockReturnValue({
    data: { status: "active" },
    isLoading: false,
    stale: false,
  });
  useSyncOutboxMock.mockReturnValue({ sync: vi.fn(), syncing: false });
  useEntryActionsMock.mockReturnValue({});
  useHistoryMock.mockReturnValue({
    items: [
      item({ clientSnapshotId: "a", label: "Cliente Ana" }),
      item({ clientSnapshotId: "b", label: "Feira do maker" }),
    ],
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    isFetchingMore: false,
  });
});
afterEach(() => {
  mm.restore();
  cleanup();
  vi.clearAllMocks();
});

describe("Orçamentos — o card aberto se declara (018/A1)", () => {
  it("marca APENAS o card do registro que está aberto à direita", () => {
    searchMock.mockReturnValue({ snapshot: "b" });
    render(<HistoricoPage />);

    const abertos = document.querySelectorAll('[aria-current="true"]');
    expect(abertos).toHaveLength(1);
    expect(abertos[0].id).toBe("snap-b");
    expect(abertos[0].querySelector(".tf-historico__card--aberto")).not.toBeNull();
  });

  it("sem nada aberto, nenhum card se declara escolhido", () => {
    searchMock.mockReturnValue({});
    render(<HistoricoPage />);
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(0);
  });

  it("no mobile não há lista para marcar — `?snapshot=` toma a tela inteira", () => {
    mm.setWidth(VIEWPORT.belowCut);
    searchMock.mockReturnValue({ snapshot: "b" });
    render(<HistoricoPage />);
    // A lista nem existe nesse ramo: o detalhe é a página.
    expect(screen.queryByText("Cliente Ana")).not.toBeInTheDocument();
  });
});
