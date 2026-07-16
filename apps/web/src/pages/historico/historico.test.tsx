// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useHistoryMock, useSyncOutboxMock, useEntitlementMock, useEntryActionsMock } = vi.hoisted(
  () => ({
    useHistoryMock: vi.fn(),
    useSyncOutboxMock: vi.fn(),
    useEntitlementMock: vi.fn(),
    useEntryActionsMock: vi.fn(),
  }),
);
vi.mock("@/entities/history/use-history", () => ({
  useHistory: useHistoryMock,
  useSyncOutbox: useSyncOutboxMock,
  useEntryActions: useEntryActionsMock,
}));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: unknown; [k: string]: unknown }) => (
    <a {...(rest as object)}>{children as never}</a>
  ),
  useNavigate: () => vi.fn(),
}));

import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { HistoricoPage } from "./historico-page";

// 009/T012 (E4, PR-A) — the Histórico list, written FAILING-first (US2).
//
// The card is a LEDGER ROW, not a price. Everything here defends that one distinction, because the
// whole epic dies if a seller reads a 2026 quote as today's price:
//
//   * the DATE is on every card, structurally ABOVE the money (FR-523);
//   * the money is labelled "Valor cotado" — never "Preço", which is what the calculator says TODAY;
//   * the basis is labelled too — an unlabelled total is an ambiguous claim;
//   * no PriceHero, no live treatment.
//
// And the list is the MERGED selector (server ∪ outbox). The E3 PR-C lesson — a correct component
// starved of correct data still lies — is answered structurally: the page cannot read the server
// query alone, because that is not what `useHistory()` returns.

const t = messages.historico;

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

function listState(over: Partial<ReturnType<typeof baseList>> = {}) {
  return { ...baseList(), ...over };
}
function baseList() {
  return {
    items: [] as HistoryItem[],
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
  useEntitlementMock.mockReturnValue({
    data: { status: "active" },
    isError: false,
    isLoading: false,
    stale: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  useSyncOutboxMock.mockReturnValue({ sync: vi.fn(), syncing: false });
  useEntryActionsMock.mockReturnValue({
    retry: vi.fn(),
    discard: vi.fn(),
    retrying: false,
    discarding: false,
  });
  useHistoryMock.mockReturnValue(listState());
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

afterEach(() => cleanup());

describe("a card is a ledger row, never a live price", () => {
  it("carries the DATE on every card, and the money is 'Valor cotado' — never 'Preço'", () => {
    useHistoryMock.mockReturnValue(listState({ items: [item()] }));
    render(<HistoricoPage />);

    expect(screen.getByText(/Cotado em 12\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(t.quotedValue)).toBeInTheDocument();
    expect(screen.getByText("R$ 275,00")).toBeInTheDocument();
    // The basis is spelled out — an unlabelled total is an ambiguous claim.
    expect(screen.getByText(t.basisRetailCaption)).toBeInTheDocument();
    expect(screen.queryByText(/^Preço/)).not.toBeInTheDocument();
  });

  it("falls back to the CAPTURED origin name, and then to an honest neutral — never an invented one", () => {
    useHistoryMock.mockReturnValue(
      listState({
        items: [
          item({ clientSnapshotId: "a", label: null, snapshot: null }),
          item({
            clientSnapshotId: "b",
            id: "s2",
            label: null,
            deviceQuotedAt: "2026-07-03T10:00:00Z",
          }),
        ],
      }),
    );
    render(<HistoricoPage />);

    expect(screen.getAllByText(t.adhocFallback)).toHaveLength(2);
  });

  it("shows a PENDING entry in the list with its own values and an honest badge", () => {
    useHistoryMock.mockReturnValue(
      listState({
        items: [item({ id: null, syncState: "pending", headlineTotal: "21.90" })],
      }),
    );
    render(<HistoricoPage />);

    expect(screen.getByText(t.syncPendingBadge)).toBeInTheDocument();
    expect(screen.getByText("R$ 21,90")).toBeInTheDocument();
  });
});

describe("the queue banner — the state that needs a decision wins", () => {
  it("says how many are pending and offers to sync", () => {
    useHistoryMock.mockReturnValue(
      listState({ items: [item({ id: null, syncState: "pending" })] }),
    );
    render(<HistoricoPage />);

    expect(screen.getByText(t.queuePending.replace("{n}", "1"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.syncNow })).toBeInTheDocument();
  });

  it("offline: it never offers a button that cannot work", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    useHistoryMock.mockReturnValue(
      listState({ items: [item({ id: null, syncState: "pending" })] }),
    );
    render(<HistoricoPage />);

    expect(screen.getByText(t.queuePendingOffline.replace("{n}", "1"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.syncNow })).not.toBeInTheDocument();
  });

  it("failed beats blocked beats pending — the banner shows what needs a human", () => {
    useHistoryMock.mockReturnValue(
      listState({
        items: [
          item({ clientSnapshotId: "a", id: null, syncState: "pending" }),
          item({ clientSnapshotId: "b", id: null, syncState: "blocked" }),
          item({ clientSnapshotId: "c", id: null, syncState: "failed" }),
        ],
      }),
    );
    render(<HistoricoPage />);

    expect(screen.getByText(t.queueFailed.replace("{n}", "1"))).toBeInTheDocument();
    expect(screen.queryByText(t.queuePending.replace("{n}", "1"))).not.toBeInTheDocument();
  });

  it("C6 — a single failed entry no longer HIDES the drain for healthy pendings (review PR-A)", () => {
    // The trap: `failed>0` used to return a banner with no button, hiding the app's only manual
    // drain and stranding every healthy pending behind it. Sync must still be offered.
    useHistoryMock.mockReturnValue(
      listState({
        items: [
          item({ clientSnapshotId: "f", id: null, syncState: "failed" }),
          item({ clientSnapshotId: "p1", id: null, syncState: "pending" }),
          item({ clientSnapshotId: "p2", id: null, syncState: "pending" }),
        ],
      }),
    );
    render(<HistoricoPage />);

    expect(screen.getByText(t.queueFailed.replace("{n}", "1"))).toBeInTheDocument();
    // The drain button is present again — the healthy pendings can be sent by hand.
    expect(screen.getByRole("button", { name: t.syncNow })).toBeInTheDocument();
    // …and a [Ver] jump to the entry that needs a decision.
    expect(screen.getByRole("button", { name: t.queueSee })).toBeInTheDocument();
  });
});

describe("C5 — the gate has a branch for 'the server never answered about the plan' (review PR-A)", () => {
  it("shows a calm 'could not verify your plan' + retry, NOT the cold ledger error wall", () => {
    useEntitlementMock.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      stale: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<HistoricoPage />);

    expect(screen.getByText(t.guardError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.guardRetry })).toBeInTheDocument();
    // It must NOT presume "free" (no teaser) and must NOT hit the cold history error wall.
    expect(screen.queryByText(t.teaserTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.loadError)).not.toBeInTheDocument();
  });
});

describe("states", () => {
  it("empty: it says what to do, and does NOT fabricate a sample entry", () => {
    render(<HistoricoPage />);

    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(t.emptyBody)).toBeInTheDocument();
    expect(screen.queryByText(t.quotedValue)).not.toBeInTheDocument();
  });

  it("a COLD read failure (nothing cached, nothing queued) shows the error and a retry", () => {
    useHistoryMock.mockReturnValue(listState({ isError: true }));
    render(<HistoricoPage />);

    expect(screen.getByText(t.loadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.retry })).toBeInTheDocument();
  });

  it("never an error wall OVER data the seller already holds — the rows render, a strip warns", () => {
    useHistoryMock.mockReturnValue(listState({ items: [item()], stale: true }));
    render(<HistoricoPage />);

    expect(screen.getByText("R$ 275,00")).toBeInTheDocument(); // the rows are there…
    expect(screen.getByText(t.loadError)).toBeInTheDocument(); // …and the failure is stated
    expect(screen.getByRole("button", { name: t.retry })).toBeInTheDocument();
  });

  it("offline: the SAME stale data gets the calm offline wording, not an error", () => {
    // Telling someone who is plainly online "Modo leitura offline" is a small, needless lie — and
    // telling someone offline that their read "failed" is another. Same state, two honest readings.
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    useHistoryMock.mockReturnValue(listState({ items: [item()], stale: true }));
    render(<HistoricoPage />);

    expect(screen.getByText(t.offlineTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.loadError)).not.toBeInTheDocument();
  });

  it("lapsed: the ledger stays readable — nothing is deleted by a lapse", () => {
    useEntitlementMock.mockReturnValue({
      data: { status: "lapsed" },
      isError: false,
      isLoading: false,
      stale: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useHistoryMock.mockReturnValue(listState({ items: [item()] }));
    render(<HistoricoPage />);

    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
    expect(screen.getByText("R$ 275,00")).toBeInTheDocument();
  });
});
