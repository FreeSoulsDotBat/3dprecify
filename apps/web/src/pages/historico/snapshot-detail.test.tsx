// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useSnapshotMock,
  useSyncOutboxMock,
  useEntryActionsMock,
  useProductsMock,
  useBomsMock,
  useEntitlementMock,
} = vi.hoisted(() => ({
  useSnapshotMock: vi.fn(),
  useSyncOutboxMock: vi.fn(),
  useEntryActionsMock: vi.fn(),
  useProductsMock: vi.fn(),
  useBomsMock: vi.fn(),
  useEntitlementMock: vi.fn(),
}));
vi.mock("@/entities/history/use-history", () => ({
  useSnapshot: useSnapshotMock,
  useSyncOutbox: useSyncOutboxMock,
  useEntryActions: useEntryActionsMock,
}));
// US3/T019 — the detail resolves the origin at READ TIME against the LIVE catalog (products + kits),
// so the affordance appears only when the origin still exists. Mocked so the resolution is driven by
// the test, never a real query.
vi.mock("@/entities/catalog/use-catalog", () => ({ useProducts: useProductsMock }));
vi.mock("@/entities/bom/use-bom", () => ({ useBoms: useBomsMock }));
// The detail reads the entitlement for ONE thing: the lapse note that explains the absent write
// affordances. Mocked (no QueryClient here); defaulted to active so the ordinary tests see no banner.
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));
// "Recalcular hoje" and the manage bar are exercised in their own tests (recalc-today.test.tsx,
// snapshot-manage.test.tsx); stub them here so this surface's tests stay isolated from their
// entitlement/record/fee-catalog dependencies.
vi.mock("./recalc-today", () => ({ RecalcTodayButton: () => null }));
vi.mock("@/features/history/snapshot-manage", () => ({ SnapshotManageActions: () => null }));
vi.mock("@tanstack/react-router", () => ({
  // An <a> only carries the implicit ARIA role "link" when it has an href — so the mock derives one
  // from `to`, letting `getByRole("link", …)` assert the affordance IS a navigable link.
  Link: ({ children, to, ...rest }: { children: unknown; to?: unknown; [k: string]: unknown }) => (
    <a href={typeof to === "string" ? to : "#"} {...(rest as object)}>
      {children as never}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";

import { SnapshotDetailPage } from "./snapshot-detail-page";

// 009/T012 (E4, PR-A) — the frozen detail, written FAILING-first (US2, SC-501/FR-503/FR-507).
//
// This surface renders a DOCUMENT. Three prohibitions define it, and each one is a lie it would
// otherwise tell:
//
//   1. ZERO RECOMPUTATION. Every figure is a stored string, formatted. Recomputing even one line
//      would make the snapshot quietly track today's catalog — the exact opposite of its promise.
//   2. AN ABSENT LINE IS NOT A ZERO (FR-507). A payload without `finishing` means the seller did not
//      charge for finishing; printing "Acabamento R$ 0,00" would invent a fact. The row is simply
//      not there.
//   3. NO DEGRADED STATE, EVER (FR-503). A snapshot references nothing, so nothing about it can rot.
//      Deleting the origin product changes NOTHING here: no caption, no badge, no tone. The
//      [Abrir produto] button is simply absent — and that absence IS the feature. The surface looks
//      identical to a snapshot that never had an origin.

const t = messages.historico;

const PAYLOAD: FrozenSnapshotPayload = {
  schemaVersion: 1,
  kind: "SINGLE",
  modelVersion: "3.1.0",
  catalogVersion: null,
  breakdown: { material: "42.10", energy: "3.80" }, // NO finishing, NO labor — deliberately
  totals: { custoTotal: "180.00", precoVarejo: "275.00", precoAtacado: "230.00" },
  provenance: { kind: "PRODUCT", id: "p1", name: "Vaso G" },
};

function item(over: Partial<HistoryItem> = {}, payload: FrozenSnapshotPayload = PAYLOAD) {
  return {
    id: "s1",
    clientSnapshotId: "csid-1",
    kind: "SINGLE",
    label: "Cliente João",
    headlineTotal: "275.00",
    headlineBasis: "PRECO_VAREJO",
    deviceQuotedAt: "2026-07-12T19:30:00Z",
    syncState: "synced",
    snapshot: {
      id: "s1",
      clientSnapshotId: "csid-1",
      kind: "SINGLE",
      label: "Cliente João",
      quoteValidityDays: 15,
      deviceQuotedAt: "2026-07-12T19:30:00Z",
      deviceUtcOffsetMinutes: -180,
      modelVersion: "3.1.0",
      payloadSchemaVersion: 1,
      payload: payload as unknown as Record<string, unknown>,
      headlineTotal: "275.00",
      headlineBasis: "PRECO_VAREJO",
    },
    entry: null,
    ...over,
  } as HistoryItem;
}

function render1(over: Partial<HistoryItem> = {}, payload: FrozenSnapshotPayload = PAYLOAD) {
  useSnapshotMock.mockReturnValue({
    item: item(over, payload),
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
  });
  return render(<SnapshotDetailPage snapshotId="csid-1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useSyncOutboxMock.mockReturnValue({ sync: vi.fn(), syncing: false });
  useEntryActionsMock.mockReturnValue({
    retry: vi.fn(),
    discard: vi.fn(),
    retrying: false,
    discarding: false,
  });
  // Default: the origin no longer resolves (empty catalog). Tests that pin the "abrir origem"
  // affordance seed the pool explicitly — the PR-A tests keep rendering identically with it absent.
  useProductsMock.mockReturnValue({ items: [] });
  useBomsMock.mockReturnValue({ items: [] });
  // Default: an active premium — no lapse note. The lapse test overrides it.
  useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
});

afterEach(() => cleanup());

describe("the claim block — what the seller asserted, and when", () => {
  it("shows the date with the time, the quoted value and its basis", () => {
    render1();

    expect(screen.getByText(/Cotado em 12\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(t.quotedValue)).toBeInTheDocument();
    expect(screen.getByText("R$ 275,00")).toBeInTheDocument();
    expect(screen.getByText(t.basisRetailCaption)).toBeInTheDocument();
  });

  it("shows the promised validity when there is one — it is a promise, not a TTL", () => {
    render1();
    expect(screen.getByText(t.validityLine.replace("{n}", "15"))).toBeInTheDocument();
  });
});

describe("the frozen document — every figure is STORED, none is computed", () => {
  it("renders the stored breakdown lines, byte-for-byte", () => {
    render1();

    expect(screen.getByText("R$ 42,10")).toBeInTheDocument(); // material
    expect(screen.getByText("R$ 3,80")).toBeInTheDocument(); // energia
    expect(screen.getByText("R$ 180,00")).toBeInTheDocument(); // custo total
  });

  it("an ABSENT line is ABSENT — never a fabricated R$ 0,00 (FR-507)", () => {
    render1();

    // The payload has no `finishing` and no `labor`: the seller did not charge for them.
    expect(screen.queryByText(messages.calculator.results.finishing)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.calculator.results.labor)).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("itemizes the pieces of a KIT quote (SC-515) — quantity as a COUNT, never a '×' factor (C2)", () => {
    const kit: FrozenSnapshotPayload = {
      schemaVersion: 1,
      kind: "KIT",
      modelVersion: "3.1.0",
      catalogVersion: null,
      lines: [
        {
          name: "Vaso G",
          quantity: 3,
          input: {},
          breakdown: {},
          totals: { precoVarejo: "135.00" },
        },
        {
          name: null,
          quantity: 1,
          input: {},
          breakdown: {},
          totals: { precoVarejo: "80.00" },
        },
      ],
      totals: { custoTotal: "180.00", precoVarejo: "275.00" },
      provenance: null,
    };
    const { container } = render1({ kind: "KIT" }, kit);

    expect(screen.getByText(t.kitPieces)).toBeInTheDocument();
    expect(screen.getByText("Vaso G")).toBeInTheDocument();
    // The total is ALREADY quantity-scaled; "3×" next to it would read as a unit price.
    expect(screen.getByText(t.kitPieceQty.replace("{n}", "3"))).toBeInTheDocument();
    expect(container.textContent ?? "").not.toContain("3×");
    expect(screen.getByText("R$ 135,00")).toBeInTheDocument();
  });

  it("C1 — a kit quoted at ATACADO itemizes at atacado, not varejo (review PR-A)", () => {
    const kit: FrozenSnapshotPayload = {
      schemaVersion: 1,
      kind: "KIT",
      modelVersion: "3.1.0",
      catalogVersion: null,
      lines: [
        {
          name: "Vaso G",
          quantity: 3,
          input: {},
          breakdown: {},
          totals: { precoVarejo: "135.00", precoAtacado: "99.00" },
        },
      ],
      totals: { custoTotal: "180.00", precoVarejo: "275.00", precoAtacado: "230.00" },
      provenance: null,
    };
    render1({ kind: "KIT", headlineBasis: "PRECO_ATACADO", headlineTotal: "230.00" }, kit);

    // The piece must show the atacado figure the seller actually charged — never the varejo one.
    expect(screen.getByText("R$ 99,00")).toBeInTheDocument();
    expect(screen.queryByText("R$ 135,00")).not.toBeInTheDocument();
  });
});

describe("M11 — the per-channel prices are rendered, not silently frozen (review PR-A)", () => {
  it("shows each channel's announce/net figures — a null price is ABSENT, never R$ 0,00", () => {
    const withChannels: FrozenSnapshotPayload = {
      ...PAYLOAD,
      channels: [
        {
          marketplace: "Shopee",
          precoAnuncioVarejo: "185.70",
          recebidoLiquidoVarejo: "114.54",
          precoAnuncioAtacado: null,
          recebidoLiquidoAtacado: null,
        },
      ],
    };
    render1({}, withChannels);

    expect(screen.getByText("Shopee")).toBeInTheDocument();
    expect(screen.getByText("R$ 185,70")).toBeInTheDocument();
    expect(screen.getByText("R$ 114,54")).toBeInTheDocument();
    // Absent atacado prices render nothing — never a fabricated zero.
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });
});

describe("M8 — the sync-state Alert on the detail (review PR-A, §1.2)", () => {
  it("pending: states it is unsynced AND carries the durability caveat (F4) — detail only", () => {
    render1({ syncState: "pending", id: null });

    expect(screen.getByText(t.syncPendingBody)).toBeInTheDocument();
    expect(screen.getByText(t.syncPendingDurability)).toBeInTheDocument();
  });

  it("failed: shows the body, the support code and the retry/discard actions", () => {
    render1({
      syncState: "failed",
      id: null,
      snapshot: null,
      entry: {
        clientSnapshotId: "csid-1",
        body: {} as never,
        syncState: "failed",
        attempts: 1,
        lastStatus: 422,
      },
    });

    expect(screen.getByText(t.syncFailedBody)).toBeInTheDocument();
    expect(screen.getByText(/422/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.retryAgain })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.discard })).toBeInTheDocument();
  });
});

describe("M7 — a read failure is not a missing record (review PR-A)", () => {
  it("says 'could not load' with a retry, NEVER 'Registro não encontrado'", () => {
    useSnapshotMock.mockReturnValue({
      item: null,
      isLoading: false,
      isError: true,
      stale: false,
      refetch: vi.fn(),
    });
    render(<SnapshotDetailPage snapshotId="csid-1" />);

    expect(screen.getByText(t.loadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.retry })).toBeInTheDocument();
    expect(screen.queryByText(t.notFound)).not.toBeInTheDocument();
  });
});

describe("the technical sheet — the date and the formula version, labelled (A29 / FR-506)", () => {
  it("names the formula version the price was computed with", () => {
    render1();
    expect(screen.getByText(t.modelVersionLine.replace("{versao}", "3.1.0"))).toBeInTheDocument();
  });

  it("shows the CAPTURED origin name — what the thing was called then", () => {
    render1();
    expect(screen.getByText(t.originLine.replace("{nome}", "Vaso G"))).toBeInTheDocument();
  });

  it("states the two-shelf rule in plain words", () => {
    render1();
    expect(screen.getByText(t.frozenExplainer)).toBeInTheDocument();
  });

  it("says the date came from the device — asserted, never verified (FR-528)", () => {
    render1();
    expect(screen.getByText(t.deviceClockNote)).toBeInTheDocument();
  });
});

describe("a snapshot NEVER degrades (FR-503) — the absence IS the feature", () => {
  it("says nothing about a deleted or changed origin, anywhere on the surface", () => {
    const { container } = render1();

    // The E3 vocabulary of degradation must not appear here at ALL. A snapshot references nothing,
    // so nothing about it can rot — and a warning would invent a problem the seller does not have.
    expect(container.textContent ?? "").not.toMatch(/removid|excluíd|deletad|desatualizad/i);
  });

  it("renders identically whether the origin still exists or not", () => {
    const withOrigin = render1().container.textContent;
    cleanup();
    const noOrigin = render1(
      {},
      { ...PAYLOAD, provenance: { kind: "PRODUCT", id: "gone", name: "Vaso G" } },
    ).container.textContent;

    expect(noOrigin).toEqual(withOrigin);
  });
});

describe("the origin affordance — resolved at read time, SC-502 (US3/T019)", () => {
  it("offers 'Abrir produto' to the live product while the origin still exists", () => {
    useProductsMock.mockReturnValue({ items: [{ id: "p1" }] }); // PAYLOAD.provenance.id === "p1"
    render1();

    expect(screen.getByRole("link", { name: t.openProduct })).toBeInTheDocument();
    // The captured name is part of the frozen document — it shows whether or not the origin resolves.
    expect(screen.getByText(t.originLine.replace("{nome}", "Vaso G"))).toBeInTheDocument();
  });

  it("SC-502 — a live origin never leaks a value in: the figures stay the STORED ones", () => {
    // Even with a live product of the same id present, the detail consults the catalog ONLY to decide
    // whether to OFFER the link — never for a number. Every figure is the payload's, byte-for-byte.
    useProductsMock.mockReturnValue({ items: [{ id: "p1" }] });
    render1();

    expect(screen.getByText("R$ 42,10")).toBeInTheDocument(); // material, from the payload
    expect(screen.getByText("R$ 180,00")).toBeInTheDocument(); // custo total, from the payload
  });

  it("origin DELETED → no 'Abrir produto', no degrade vocabulary, the name still shows (two-shelf)", () => {
    useProductsMock.mockReturnValue({ items: [] }); // the origin product was deleted
    const { container } = render1();

    expect(screen.queryByRole("link", { name: t.openProduct })).not.toBeInTheDocument();
    expect(screen.getByText(t.originLine.replace("{nome}", "Vaso G"))).toBeInTheDocument();
    // The word "removido/excluído/deletado" must appear NOWHERE — a snapshot never rots (FR-503/FR-507).
    expect(container.textContent ?? "").not.toMatch(/removid|excluíd|deletad|desatualizad/i);
  });

  it("a KIT origin offers 'Abrir kit' while the kit still exists", () => {
    useBomsMock.mockReturnValue({ items: [{ id: "k1" }] });
    render1(
      { kind: "KIT" },
      { ...PAYLOAD, kind: "KIT", provenance: { kind: "KIT", id: "k1", name: "Kit Festa" } },
    );

    expect(screen.getByRole("link", { name: t.openKit })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.openProduct })).not.toBeInTheDocument();
  });
});

describe("not found", () => {
  it("says so plainly instead of rendering an empty document", () => {
    useSnapshotMock.mockReturnValue({
      item: null,
      isLoading: false,
      isError: false,
      stale: false,
      refetch: vi.fn(),
    });
    render(<SnapshotDetailPage snapshotId="nope" />);

    expect(screen.getByText(t.notFound)).toBeInTheDocument();
  });
});

describe("lapse — the ledger stays readable, and the detail SAYS why writing is paused (review PR-B)", () => {
  it("a lapsed premium sees the record AND the lapse note (not a silently missing manage bar)", () => {
    useEntitlementMock.mockReturnValue({ data: { status: "lapsed" }, isLoading: false });
    render1();

    // The frozen figures still render — a lapse deletes nothing (FR-517).
    expect(screen.getByText("R$ 275,00")).toBeInTheDocument();
    // ...and the note explains why rename/delete/recalc are absent, mirroring the list banner.
    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
  });

  it("an ACTIVE premium never sees the lapse note", () => {
    render1(); // default entitlement is active
    expect(screen.queryByText(t.lapsedBanner)).not.toBeInTheDocument();
  });
});
