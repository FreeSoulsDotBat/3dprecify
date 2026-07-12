// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { computeBom, type PriceInput } from "@3dprecify/pricing-core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { BomLineCard } from "./bom-line-card";

// 008/T021 (ux §1.2-D) — the degraded-line indicator. A kit line whose referenced product was
// DELETED after save reopens on its last-known snapshot; the card marks that state with a CALM
// muted caption (the E2 `productForm.manualValuesKept` copy), NEVER an Alert and NEVER a
// "produto removido/excluído" claim (F1/K3: born-manual and delete-degraded are one honest
// state — the UI does not narrate a deletion the seller may not have caused). The caption's
// trigger is owned by the page (`degraded && productId === ""`); here we pin the card's rendering.

const t = messages.bom;
const kept = messages.productForm.manualValuesKept;

const SC001: PriceInput = {
  costPerRoll: 100,
  rollWeightKg: 1,
  printGrams: 100,
  wasteGrams: 10,
  printTimeHours: 5,
  avgPowerKw: 0.1,
  tariffPerKwh: 1,
  machineValue: 4000,
  machineLifetimeHours: 2000,
  failurePct: 10,
  finishTimeHours: 0.5,
  finishRatePerHour: 10,
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
  channels: [],
};
const lineResult = computeBom([{ input: SC001, quantity: 2 }]).lines[0];

function renderCard(props: Partial<ComponentProps<typeof BomLineCard>> = {}) {
  return render(
    <BomLineCard
      index={2}
      name={null}
      quantityRaw="2"
      onQuantityChange={vi.fn()}
      expanded={false}
      onToggle={vi.fn()}
      onRemove={vi.fn()}
      lineResult={lineResult}
      invalid={false}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("BomLineCard — degraded-line caption (F1/K3, ux §1.2-D)", () => {
  it("degraded: renders the calm 'valores mantidos' caption", () => {
    renderCard({ degraded: true });
    expect(screen.getByText(kept)).toBeInTheDocument();
  });

  it("degraded: NEVER claims the product was removed/excluded/deleted (F1 honesty guard)", () => {
    renderCard({ degraded: true });
    expect(screen.queryByText(/removid|excluíd|deletad/i)).not.toBeInTheDocument();
  });

  it("degraded: labels the line the honest '(avulsa)', not a stale product name", () => {
    renderCard({ degraded: true });
    // The summary/expand button carries the label; anchor on its "— Editar esta peça" suffix so
    // the assertion isn't ambiguous with the remove button (which also names the line).
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Peça 2 · ${escapeRe(t.lineAdhoc)} — ${escapeRe(t.expand)}`),
      }),
    ).toBeInTheDocument();
  });

  it("degraded: the line stays priced — the caption sits ALONGSIDE the money, not instead of it", () => {
    renderCard({ degraded: true });
    expect(screen.getByText(kept)).toBeInTheDocument();
    // custo 28,65 × qty 2 = 57,30 — the degraded line is still a real, priceable line.
    expect(screen.getAllByText(/R\$\s?57,30/).length).toBeGreaterThan(0);
  });

  it("NOT degraded: no caption (negative control — the caption is degrade-only)", () => {
    renderCard({ degraded: false });
    expect(screen.queryByText(kept)).not.toBeInTheDocument();
  });

  it("NOT degraded with a bound product: shows the product name and no caption", () => {
    renderCard({ name: "Base do suporte", degraded: false });
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Peça 2 · Base do suporte — ${escapeRe(t.expand)}`),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(kept)).not.toBeInTheDocument();
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
