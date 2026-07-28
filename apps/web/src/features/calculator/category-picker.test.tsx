// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "@/shared/fee-catalog";

import { CategoryPicker } from "./category-picker";

// 014/US1. The seller does NOT know the marketplace's category name — he thinks "suporte de
// celular" while ML publishes "Acessórios para Celulares". So: search by text, and show the PATH,
// because ML really publishes two near-homonyms at DIFFERENT rates (Celulares e Telefones 18% vs
// Celulares e Smartphones 16%) and picking by name alone is a coin flip on 2 percentage points.

afterEach(cleanup);

const SPINE: CategoryNode[] = [
  { id: "MLB1051", name: "Celulares e Telefones", parentId: null },
  { id: "MLB1055", name: "Celulares e Smartphones", parentId: "MLB1051" },
  { id: "MLB3813", name: "Acessórios para Celulares", parentId: "MLB1051" },
  { id: "MLB1574", name: "Casa, Móveis e Decoração", parentId: null },
];

const setup = (props: Partial<React.ComponentProps<typeof CategoryPicker>> = {}) => {
  const onChange = vi.fn();
  render(<CategoryPicker spine={SPINE} value={undefined} onChange={onChange} {...props} />);
  return { onChange, user: userEvent.setup() };
};

describe("CategoryPicker — finding the category (US1)", () => {
  it("renders ALWAYS visible and expanded, in an empty-but-active state (FR-006a)", () => {
    setup();
    // Not behind a disclosure: a collapsed field plus a plausible pre-filled number is what makes a
    // seller accept the wrong rate. The search input must be there on first paint.
    expect(screen.getByRole("combobox", { name: /categoria/i })).toBeVisible();
  });

  it("filters by part of the name, accent- and case-insensitively", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /categoria/i }), "moveis");
    const list = screen.getByRole("listbox");
    expect(within(list).getByText(/Casa, Móveis e Decoração/)).toBeVisible();
    expect(within(list).queryByText(/Celulares/)).toBeNull();
  });

  it("shows the PATH so near-homonyms are distinguishable, not a coin flip", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /categoria/i }), "celulares");
    const list = screen.getByRole("listbox");
    expect(within(list).getByText(/Celulares e Telefones › Celulares e Smartphones/)).toBeVisible();
    expect(
      within(list).getByText(/Celulares e Telefones › Acessórios para Celulares/),
    ).toBeVisible();
  });

  it("reports the chosen category id", async () => {
    const { user, onChange } = setup();
    await user.type(screen.getByRole("combobox", { name: /categoria/i }), "smartphones");
    await user.click(within(screen.getByRole("listbox")).getByRole("option"));
    expect(onChange).toHaveBeenCalledWith("MLB1055");
  });

  it("a query that matches nothing says so — and says how to search instead", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /categoria/i }), "zzzzz");
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("an already-chosen category shows its full path and can be cleared", async () => {
    const { user, onChange } = setup({ value: "MLB1055" });
    expect(screen.getByText(/Celulares e Telefones › Celulares e Smartphones/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /limpar/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  // The spine is SPARSE and the name index is fetched on demand (D2). Offline on a first run the
  // seller has the RATE but not the full name list — the picker must say that plainly instead of
  // pretending the category does not exist.
  it("an empty spine explains itself instead of rendering a dead field", () => {
    setup({ spine: [] });
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
