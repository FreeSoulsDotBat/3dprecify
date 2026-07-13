// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useHistoryMock, useSyncOutboxMock } = vi.hoisted(() => ({
  useHistoryMock: vi.fn(),
  useSyncOutboxMock: vi.fn(),
}));
vi.mock("@/entities/history/use-history", () => ({
  useHistory: useHistoryMock,
  useSyncOutbox: useSyncOutboxMock,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: unknown; [k: string]: unknown }) => (
    <a {...(rest as object)}>{children as never}</a>
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
  useHistoryMock.mockReturnValue({
    items: [item(over, payload)],
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

  it("itemizes the pieces of a KIT quote (SC-515)", () => {
    const kit: FrozenSnapshotPayload = {
      schemaVersion: 1,
      kind: "KIT",
      modelVersion: "3.1.0",
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
    render1({ kind: "KIT" }, kit);

    expect(screen.getByText(t.kitPieces)).toBeInTheDocument();
    expect(screen.getByText("Vaso G")).toBeInTheDocument();
    expect(screen.getByText("3×")).toBeInTheDocument();
    expect(screen.getByText("R$ 135,00")).toBeInTheDocument();
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

describe("not found", () => {
  it("says so plainly instead of rendering an empty document", () => {
    useHistoryMock.mockReturnValue({
      items: [],
      isLoading: false,
      isError: false,
      stale: false,
      refetch: vi.fn(),
    });
    render(<SnapshotDetailPage snapshotId="nope" />);

    expect(screen.getByText(t.notFound)).toBeInTheDocument();
  });
});
