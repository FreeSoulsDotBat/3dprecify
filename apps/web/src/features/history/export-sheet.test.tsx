// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Inside a <form>, Radix Switch mirrors its state into a hidden checkbox and measures it; jsdom
// ships no ResizeObserver, so provide a no-op (same idiom as info-tip.test.tsx). What we assert is
// the behaviour — checked state, the value that travels — not pixels.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const exportQuote = vi.fn();
const exportCsv = vi.fn();
vi.mock("@/entities/history/use-export", () => ({
  useExportQuote: () => ({ mutateAsync: exportQuote, isPending: false }),
  useExportHistoryCsv: () => ({ mutateAsync: exportCsv, isPending: false }),
}));

const entitlement = { data: undefined as { status: string } | undefined };
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => entitlement,
}));

import type { HistoryItem } from "@/entities/history/outbox";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Toaster, useToastStore } from "@/shared/ui";

import { ExportButton } from "./export-sheet";

// 009/T028 (E4, PR-C, US4) — the export affordance, written FAILING-first.
//
// The artifact is rendered by the SERVER (ADR-0020), and that one fact dictates this whole surface:
// the export cannot work offline, and it cannot work for a record the server has never seen. Both
// are ordinary situations for this app — it records offline by design — so the affordance's job is
// to say WHICH of them is true, right where the seller taps. What it must never do is spin, fake a
// file, or silently do nothing.
//
// The other load-bearing property is the cost toggle. It is OFF by default and stays off unless the
// seller says otherwise: the default output goes to their CUSTOMER, and a customer who can read the
// material/energy/machine/failure lines can compute the seller's margin (Q4/FR-512, SC-506). A
// default-on switch here would not be a UX slip — it would leak the seller's margin to the person
// they are negotiating against.

const t = messages.historico;

const SYNCED: HistoryItem = {
  clientSnapshotId: "csid-1",
  syncState: "synced",
  headlineTotal: "44.10",
  headlineBasis: "PRECO_VAREJO",
  deviceQuotedAt: "2026-07-13T19:30:00.000Z",
  label: "Cliente João",
  snapshot: { id: "srv-1" },
} as unknown as HistoryItem;

const PENDING: HistoryItem = {
  ...SYNCED,
  syncState: "pending",
  snapshot: undefined,
} as unknown as HistoryItem;

function renderButton(item: HistoryItem = SYNCED) {
  return render(
    <>
      <ExportButton item={item} />
      <Toaster />
    </>,
  );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
  entitlement.data = { status: "active" };
  setOnline(true);
  exportQuote.mockResolvedValue(undefined);
  exportCsv.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

async function openSheet() {
  const user = setup();
  renderButton();
  await user.click(screen.getByRole("button", { name: t.exportAction }));
  await screen.findByText(t.exportContents);
  return user;
}

describe("the cost breakdown is OPT-IN (Q4/FR-512, SC-506)", () => {
  it("the switch is OFF when the Sheet opens — the default artifact goes to the CUSTOMER", async () => {
    await openSheet();

    expect(screen.getByRole("switch", { name: t.exportIncludeCosts })).not.toBeChecked();
    // The harm is NAMED, not hidden behind a neutral label.
    expect(screen.getByText(t.exportIncludeCostsWarn)).toBeInTheDocument();
  });

  it("generating with the default asks the server for a quote with NO cost lines", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: t.exportGenerate }));

    await waitFor(() => expect(exportQuote).toHaveBeenCalledTimes(1));
    expect(exportQuote).toHaveBeenCalledWith({
      snapshotId: "srv-1",
      includeCostBreakdown: false,
    });
  });

  it("the seller can opt IN, and only then does the breakdown travel", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("switch", { name: t.exportIncludeCosts }));
    await user.click(screen.getByRole("button", { name: t.exportGenerate }));

    await waitFor(() => expect(exportQuote).toHaveBeenCalledTimes(1));
    expect(exportQuote).toHaveBeenCalledWith({ snapshotId: "srv-1", includeCostBreakdown: true });
  });

  it("says up front what the document carries — including the personal e-mail (Q13)", async () => {
    await openSheet();

    expect(screen.getByText(t.exportContents)).toBeInTheDocument();
  });
});

describe("the artifact is server-rendered, so it needs a connection AND a server row", () => {
  it("offline: visible, DISABLED, and it says why — never a fake success", async () => {
    setOnline(false);
    const user = setup();
    renderButton();

    const button = screen.getByRole("button", { name: t.exportAction });
    expect(button).toBeDisabled();
    expect(screen.getByText(t.exportOffline)).toBeInTheDocument();
    // The reason is not just decoration: it NAMES the disabled control for a screen reader.
    expect(button).toHaveAccessibleDescription(t.exportOffline);

    await user.click(button);
    expect(screen.queryByText(t.exportContents)).not.toBeInTheDocument();
    expect(exportQuote).not.toHaveBeenCalled();
  });

  it("pending: visible, DISABLED — you cannot export a record the server has never seen", async () => {
    const user = setup();
    renderButton(PENDING);

    const button = screen.getByRole("button", { name: t.exportAction });
    expect(button).toBeDisabled();
    expect(screen.getByText(t.exportPending)).toBeInTheDocument();

    await user.click(button);
    expect(exportQuote).not.toHaveBeenCalled();
  });

  it("failed/blocked read the same way — the record is not in the account either", () => {
    renderButton({ ...PENDING, syncState: "failed" } as unknown as HistoryItem);

    expect(screen.getByRole("button", { name: t.exportAction })).toBeDisabled();
    expect(screen.getByText(t.exportPending)).toBeInTheDocument();
  });

  it("offline AND pending: says the connection first — it is the root cause of both", () => {
    setOnline(false);
    renderButton(PENDING);

    expect(screen.getByText(t.exportOffline)).toBeInTheDocument();
    expect(screen.queryByText(t.exportPending)).not.toBeInTheDocument();
  });
});

describe("the gate is the SERVER's last word (Principle IV / FR-515, SC-508)", () => {
  it("lapsed: the record stays READABLE and the export says exactly what is paused", async () => {
    entitlement.data = { status: "lapsed" };
    const user = setup();
    renderButton();

    const button = screen.getByRole("button", { name: t.exportAction });
    expect(button).toBeDisabled();
    expect(screen.getByText(t.exportLapsed)).toBeInTheDocument();

    await user.click(button);
    expect(exportQuote).not.toHaveBeenCalled();
  });

  it("free / no server answer: no export affordance at all (FR-516 — no artifact, ever)", () => {
    entitlement.data = { status: "none" };
    renderButton();
    expect(screen.queryByRole("button", { name: t.exportAction })).not.toBeInTheDocument();

    cleanup();
    entitlement.data = undefined;
    renderButton();
    expect(screen.queryByRole("button", { name: t.exportAction })).not.toBeInTheDocument();
  });
});

describe("the history CSV (FR-513)", () => {
  it("switching to the CSV drops the quote-only copy — a control with no effect would be a lie", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("radio", { name: t.exportHistoryCsv }));

    // The cost toggle only exists for the quote; the CSV is the seller's own ledger.
    expect(screen.queryByRole("switch", { name: t.exportIncludeCosts })).not.toBeInTheDocument();
    expect(screen.queryByText(t.exportContents)).not.toBeInTheDocument();
    // And it says the honest thing about what the server-rendered ledger can contain.
    expect(screen.getByText(t.exportCsvNote)).toBeInTheDocument();
  });

  it("downloads the ledger — never the quote endpoint", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("radio", { name: t.exportHistoryCsv }));
    await user.click(screen.getByRole("button", { name: t.exportGenerateCsv }));

    await waitFor(() => expect(exportCsv).toHaveBeenCalledTimes(1));
    expect(exportQuote).not.toHaveBeenCalled();
  });
});

describe("honest feedback — a failure is never a file", () => {
  it("says it did NOT generate, and keeps the Sheet open with the choices intact", async () => {
    exportQuote.mockRejectedValue(new Error("boom"));
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: t.exportGenerate }));

    expect(await screen.findByText(t.exportFailed)).toBeInTheDocument();
    expect(screen.getByText(t.exportContents)).toBeInTheDocument();
  });

  it("a lapse that lands MID-FLIGHT is reported as the lapse it is, not a generic error", async () => {
    // The REAL transport error — a hand-rolled look-alike would pass an `instanceof` check that
    // production would fail, and the whole point of this branch is reading the wire `code`.
    exportQuote.mockRejectedValue(
      new ApiError({
        status: 403,
        code: "ENTITLEMENT_REQUIRED",
        message: "Premium required",
        correlationId: "corr-403",
      }),
    );
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: t.exportGenerate }));

    expect(await screen.findByText(t.exportLapsed)).toBeInTheDocument();
    expect(screen.queryByText(t.exportFailed)).not.toBeInTheDocument();
  });

  it("closes on success — the file is the feedback", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: t.exportGenerate }));

    await waitFor(() => expect(screen.queryByText(t.exportContents)).not.toBeInTheDocument());
  });
});
