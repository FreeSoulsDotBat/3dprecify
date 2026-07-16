// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
vi.mock("@/entities/history/use-history", () => ({
  useRecordSnapshot: () => ({ mutateAsync, isPending: false }),
}));

const entitlement = { data: undefined as { status: string } | undefined };
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => entitlement,
}));

import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import { messages } from "@/shared/i18n/messages.pt-br";
import type { SnapshotIn } from "@/shared/api/generated";
import { Toaster, useToastStore } from "@/shared/ui";

import { RecordSnapshotButton } from "./record-snapshot-sheet";

// 009/T010 (E4, PR-A) — the record action, written FAILING-first.
//
// A snapshot is the seller's ASSERTION: it must record the number they say they quoted, labelled,
// with the date they quoted it. Three properties are load-bearing here:
//
//   1. The seller PICKS the basis (owner decision F1, 2026-07-13). Retail is pre-selected because
//      it is the common case, but an atacado quote is a real thing sellers send — recording it as
//      varejo would make the Histórico lie about what they charged.
//   2. The body is built at RECORD time from the frozen payload — the totals shown in the Sheet are
//      the ones that go to the server, never a re-derivation.
//   3. Recording is only OFFERED on a last-known SERVER entitlement of `active` (Principle IV /
//      ADR-0015: a cached server answer, never a client-held flag). Free ⇒ the honest teaser, and
//      NOTHING is queued.

const PAYLOAD: FrozenSnapshotPayload = {
  schemaVersion: 1,
  kind: "SINGLE",
  modelVersion: "3.1.0",
  catalogVersion: null,
  totals: { custoTotal: "12.00", precoVarejo: "27.50", precoAtacado: "23.00" },
  provenance: null,
};

function renderButton() {
  return render(
    <>
      <RecordSnapshotButton source={{ kind: "SINGLE", freeze: () => PAYLOAD }} />
      <Toaster />
    </>,
  );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
  entitlement.data = { status: "active" };
  mutateAsync.mockResolvedValue({ clientSnapshotId: "csid-1", syncState: "synced" });
});

afterEach(() => cleanup());

describe("the record Sheet (premium, active)", () => {
  it("opens from the results with the honest intro — what exactly gets frozen", async () => {
    const user = setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));

    expect(await screen.findByText(messages.historico.saveSheetIntro)).toBeInTheDocument();
  });

  it("shows BOTH candidate totals, labelled, with varejo pre-selected", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));

    const varejo = await screen.findByRole("radio", { name: /varejo/i });
    const atacado = screen.getByRole("radio", { name: /atacado/i });

    expect(varejo).toBeChecked();
    expect(atacado).not.toBeChecked();
    // The number the seller is about to assert is on screen BEFORE they assert it.
    expect(screen.getByText(/27,50/)).toBeInTheDocument();
    expect(screen.getByText(/23,00/)).toBeInTheDocument();
  });

  it("records the varejo total, the label and the validity as given", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));

    await user.type(await screen.findByLabelText(messages.historico.labelField), "Cliente João");
    await user.type(screen.getByLabelText(messages.historico.validityField), "15");
    await user.click(screen.getByRole("button", { name: messages.historico.saveSheetSubmit }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
    expect(body.headlineBasis).toBe("PRECO_VAREJO");
    expect(body.headlineTotal).toBe("27.50");
    expect(body.label).toBe("Cliente João");
    expect(body.quoteValidityDays).toBe(15);
    expect(body.kind).toBe("SINGLE");
    expect(body.modelVersion).toBe("3.1.0");
    expect(body.payload).toEqual(PAYLOAD);
    // Minted at RECORD time — minting at SEND time would regenerate after a restart and duplicate.
    expect(body.clientSnapshotId).toMatch(/[0-9a-f-]{36}/);
  });

  it("records the ATACADO total when the seller says that is what they quoted", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));

    await user.click(await screen.findByRole("radio", { name: /atacado/i }));
    await user.click(screen.getByRole("button", { name: messages.historico.saveSheetSubmit }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
    expect(body.headlineBasis).toBe("PRECO_ATACADO");
    expect(body.headlineTotal).toBe("23.00");
  });

  it("an empty label is NULL, never an empty string; an empty validity is absent", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await user.click(
      await screen.findByRole("button", { name: messages.historico.saveSheetSubmit }),
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
    expect(body.label).toBeNull();
    expect(body.quoteValidityDays).toBeNull();
  });

  it("carries the device clock — the date the seller quoted, offset included (FR-528)", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await user.click(
      await screen.findByRole("button", { name: messages.historico.saveSheetSubmit }),
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0]?.[0] as SnapshotIn;
    expect(body.deviceQuotedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.deviceUtcOffsetMinutes).toBe("number");
  });
});

describe("the payload is frozen ONCE, when the Sheet opens (review PR-A, minor)", () => {
  it("a parent re-render never re-freezes — 'freeze at open' must be literally true", async () => {
    const user = setup();
    const freeze = vi.fn(() => PAYLOAD);
    // A NEW `source` object identity every render — a `useMemo([source])` would re-freeze on it.
    const tree = (
      <>
        <RecordSnapshotButton source={{ kind: "SINGLE", freeze }} />
        <Toaster />
      </>
    );
    const { rerender } = render(tree);

    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await screen.findByText(messages.historico.saveSheetIntro);
    expect(freeze).toHaveBeenCalledTimes(1);

    // Re-render with a fresh `source` while the Sheet is still open (the open state is preserved) —
    // the values on screen must NOT be re-captured.
    rerender(
      <>
        <RecordSnapshotButton source={{ kind: "SINGLE", freeze }} />
        <Toaster />
      </>,
    );
    expect(freeze).toHaveBeenCalledTimes(1);
  });
});

describe("honest feedback — 'saved' is said only when it IS saved", () => {
  it("says PENDING (info), never success, when the record only reached the device", async () => {
    mutateAsync.mockResolvedValue({ clientSnapshotId: "csid-1", syncState: "pending" });
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await user.click(
      await screen.findByRole("button", { name: messages.historico.saveSheetSubmit }),
    );

    expect(await screen.findByText(messages.historico.syncPendingToast)).toBeInTheDocument();
    expect(screen.queryByText(messages.historico.saved)).not.toBeInTheDocument();
  });

  it("says SAVED only on a real server answer", async () => {
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await user.click(
      await screen.findByRole("button", { name: messages.historico.saveSheetSubmit }),
    );

    expect(await screen.findByText(messages.historico.saved)).toBeInTheDocument();
  });

  it("says it did NOT record when the device could not keep it", async () => {
    mutateAsync.mockRejectedValue(new Error("QuotaExceeded"));
    const user = setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: messages.historico.saveAction }));
    await user.click(
      await screen.findByRole("button", { name: messages.historico.saveSheetSubmit }),
    );

    expect(await screen.findByText(messages.historico.saveDeviceFailed)).toBeInTheDocument();
  });
});

describe("the gate is the SERVER's last word (Principle IV)", () => {
  // Owner decision, 2026-07-13: without an ACTIVE premium the button does not EXIST. Not disabled,
  // not a teaser trigger — absent. The free calculator is not a sales floor: SC-109 (spec 005) says
  // no save/export/paywall affordance ever appears there, and this epic's own SC-507/512 promise the
  // free calculator stays intact. The honest door is the Histórico tab, where a seller is actually
  // asking about history. (This is the ONE place the design handoff was overruled — see spec §Clar.)
  it("free: the button does not exist — the calculator is not a sales floor", () => {
    entitlement.data = { status: "none" };
    renderButton();

    expect(
      screen.queryByRole("button", { name: messages.historico.saveAction }),
    ).not.toBeInTheDocument();
  });

  it("lapsed: same — recording needs an ACTIVE premium (reading stays open elsewhere, FR-517)", () => {
    entitlement.data = { status: "lapsed" };
    renderButton();

    expect(
      screen.queryByRole("button", { name: messages.historico.saveAction }),
    ).not.toBeInTheDocument();
  });

  it("unknown (no server answer at all): it does not FABRICATE premium", () => {
    entitlement.data = undefined;
    renderButton();

    expect(
      screen.queryByRole("button", { name: messages.historico.saveAction }),
    ).not.toBeInTheDocument();
  });
});
