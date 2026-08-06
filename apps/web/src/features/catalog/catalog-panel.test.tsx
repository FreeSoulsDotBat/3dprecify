// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FilamentOut } from "@/shared/api/generated";
import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CatalogPanel } from "./catalog-panel";
import {
  emptyFilamentForm,
  type FilamentFormValues,
  filamentSummary,
  filamentToForm,
} from "./catalog-schema";
import { FilamentForm } from "./filament-form";
import { type CatalogListState } from "@/entities/catalog/use-catalog";

afterEach(() => cleanup());

const catalogo = messages.catalogo;
const cf = messages.catalogForm;
const fields = messages.calculator.fields;

const filA: FilamentOut = {
  id: "f1",
  name: "PLA Azul",
  material: "PLA",
  costPerRoll: "110.00",
  rollWeightKg: "1",
  createdAt: "2026-07-09T00:00:00Z",
  updatedAt: "2026-07-09T00:00:00Z",
};

const copy = {
  addLabel: catalogo.addFilament,
  emptyTitle: catalogo.emptyFilamentsTitle,
  emptyBody: catalogo.emptyFilamentsBody,
  newTitle: cf.newFilament,
  editTitle: cf.editFilament,
  savedToast: cf.savedFilament,
  count: (n: number) => catalogo.countFilaments.replace("{n}", String(n)),
};

function listState(
  over: Partial<CatalogListState<FilamentOut>> = {},
): CatalogListState<FilamentOut> {
  return {
    items: [filA],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
    ...over,
  };
}

function renderPanel(
  opts: {
    list?: CatalogListState<FilamentOut>;
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    remove?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const create = opts.create ?? vi.fn().mockResolvedValue({});
  const update = opts.update ?? vi.fn().mockResolvedValue({});
  const remove = opts.remove ?? vi.fn().mockResolvedValue(undefined);
  render(
    <CatalogPanel<FilamentOut, FilamentFormValues>
      list={opts.list ?? listState()}
      copy={copy}
      rowName={(f) => f.name}
      rowSummary={filamentSummary}
      emptyForm={emptyFilamentForm}
      toFormValues={filamentToForm}
      renderForm={(args) => <FilamentForm {...args} />}
      create={create as (body: unknown) => Promise<unknown>}
      update={update as (id: string, body: unknown) => Promise<unknown>}
      remove={remove as (id: string) => Promise<unknown>}
      saving={false}
      deleting={false}
    />,
  );
  return { create, update, remove };
}

const field = (name: string) => screen.getByRole("textbox", { name });

describe("CatalogPanel — premium list + create/edit/delete (T019)", () => {
  it("renders saved rows with their name + honest summary line", () => {
    renderPanel();
    expect(screen.getByText("PLA Azul")).toBeInTheDocument();
    expect(screen.getByText(filamentSummary(filA))).toBeInTheDocument();
  });

  it("shows the empty state with an add action when nothing is saved", () => {
    renderPanel({ list: listState({ items: [] }) });
    expect(screen.getByText(catalogo.emptyFilamentsTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: catalogo.addFilament })).toBeInTheDocument();
  });

  it("opens the create sheet, posts the wire body, then closes on success", async () => {
    const { create } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    expect(await screen.findByText(cf.newFilament)).toBeInTheDocument();
    fireEvent.change(field(cf.name), { target: { value: "PETG Preto" } });
    fireEvent.change(field(fields.costPerRoll), { target: { value: "135,00" } });
    fireEvent.change(field(fields.rollWeight), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: cf.save }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "PETG Preto", costPerRoll: "135", rollWeightKg: "1" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText(cf.newFilament)).not.toBeInTheDocument());
  });

  it("opens the edit sheet pre-filled and PUTs by id", async () => {
    const { update } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: `${catalogo.edit} PLA Azul` }));

    expect(await screen.findByText(cf.editFilament)).toBeInTheDocument();
    expect(field(cf.name)).toHaveValue("PLA Azul");
    fireEvent.change(field(fields.costPerRoll), { target: { value: "120,00" } });
    fireEvent.click(screen.getByRole("button", { name: cf.saveChanges }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "f1",
        expect.objectContaining({ name: "PLA Azul", costPerRoll: "120" }),
      ),
    );
  });

  it("confirms deletion in a dialog before DELETEing by id", async () => {
    const { remove } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: `${catalogo.remove} PLA Azul` }));

    expect(
      await screen.findByText(cf.deleteTitle.replace("{nome}", "PLA Azul")),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cf.deleteConfirm }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("f1"));
  });

  it("keeps the sheet open with an HONEST connection message when a write fails offline", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 0, code: "UNKNOWN", message: "", correlationId: null }),
      );
    renderPanel({ create });

    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));
    fireEvent.change(field(cf.name), { target: { value: "PETG Preto" } });
    fireEvent.change(field(fields.costPerRoll), { target: { value: "135,00" } });
    fireEvent.change(field(fields.rollWeight), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: cf.save }));

    // No fake success: the honest "precisa de conexão" line shows and the sheet stays open.
    expect(await screen.findByText(catalogo.offlineWriteBlocked)).toBeInTheDocument();
    expect(screen.getByText(cf.newFilament)).toBeInTheDocument();
  });
});
