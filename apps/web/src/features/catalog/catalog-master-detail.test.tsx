// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CatalogListState } from "@/entities/catalog/use-catalog";
import type { FilamentOut, ProductOut } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { installMatchMedia, VIEWPORT } from "@/shared/lib/match-media.test-helper";

import { CatalogPanel } from "./catalog-panel";
import { emptyFilamentForm, filamentSummary, filamentToForm } from "./catalog-schema";
import { FilamentForm } from "./filament-form";

// 018/T020 — o mestre-detalhe do Catálogo (≥1280px).
//
// Todo teste aqui INSTALA uma janela larga explicitamente. É o preço, declarado no ADR-0031, de o
// `useIsWide` responder `false` sem `matchMedia`: o silêncio do jsdom é o que garante que a suíte
// inteira do app continue exercitando o ramo mobile sem que ninguém precise se lembrar disso.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

// O material entra no texto que a busca varre (`filamentSummary`), então ele precisa ser o material
// DE VERDADE: com "PLA" fixo em todos, buscar "PLA" casava até com o PETG e o teste da seleção
// derivada media a coisa errada.
function fil(id: string, name: string, material = "PLA", cost = "110.00"): FilamentOut {
  return {
    id,
    name,
    material,
    costPerRoll: cost,
    rollWeightKg: "1",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
  };
}

const copy = {
  addLabel: catalogo.addFilament,
  emptyTitle: catalogo.emptyFilamentsTitle,
  emptyBody: catalogo.emptyFilamentsBody,
  newTitle: cf.newFilament,
  editTitle: cf.editFilament,
  savedToast: cf.savedFilament,
  count: (n: number) => catalogo.countFilaments.replace("{n}", String(n)),
};

function listState(items: FilamentOut[]): CatalogListState<FilamentOut> {
  return { items, isLoading: false, isError: false, error: null, stale: false, refetch: vi.fn() };
}

function renderPanel(items: FilamentOut[], over: Record<string, unknown> = {}) {
  const update = vi.fn().mockResolvedValue({});
  render(
    <CatalogPanel
      list={listState(items)}
      copy={copy}
      feature="filaments"
      gate="active"
      detailKicker={catalogo.detailFilament}
      rowName={(f) => f.name}
      rowSummary={filamentSummary}
      emptyForm={emptyFilamentForm}
      toFormValues={filamentToForm}
      renderForm={(args) => <FilamentForm {...args} />}
      create={vi.fn().mockResolvedValue({})}
      update={update}
      remove={vi.fn().mockResolvedValue({})}
      deleting={false}
      {...over}
    />,
  );
  return { update };
}

describe("Catálogo — mestre-detalhe (018/US1)", () => {
  let mm: ReturnType<typeof installMatchMedia>;
  beforeEach(() => {
    mm = installMatchMedia(VIEWPORT.desktopLarge);
  });
  afterEach(() => {
    mm.restore();
    cleanup();
  });

  it("mostra lista e ficha ao mesmo tempo, com o primeiro item aberto", () => {
    renderPanel([fil("f1", "PLA Prata"), fil("f2", "PETG Preto", "PETG")]);

    expect(screen.getByTestId("master-list")).toBeInTheDocument();
    const ficha = screen.getByTestId("detail-panel");
    expect(within(ficha).getByRole("heading", { name: "PLA Prata" })).toBeInTheDocument();
    expect(within(ficha).getByText(catalogo.detailFilament)).toBeInTheDocument();
  });

  it("clicar num card TROCA a ficha — e não navega para lugar nenhum", async () => {
    const user = userEvent.setup();
    renderPanel([fil("f1", "PLA Prata"), fil("f2", "PETG Preto", "PETG")]);

    const cards = screen.getAllByTestId("master-item");
    expect(cards[0]).toHaveAttribute("aria-current", "true");

    await user.click(cards[1]);

    const ficha = screen.getByTestId("detail-panel");
    expect(within(ficha).getByRole("heading", { name: "PETG Preto" })).toBeInTheDocument();
    expect(screen.getAllByTestId("master-item")[1]).toHaveAttribute("aria-current", "true");
    // A lista continua na tela: é a promessa inteira do mestre-detalhe.
    expect(screen.getByTestId("master-list")).toBeInTheDocument();
  });

  it("a ficha de filamento É o editor, e salvar usa a mutation de sempre", async () => {
    const user = userEvent.setup();
    const { update } = renderPanel([fil("f1", "PLA Prata")]);

    const ficha = screen.getByTestId("detail-panel");
    const nome = within(ficha).getByLabelText(/^Nome/i);
    await user.clear(nome);
    await user.type(nome, "PLA Prata 1kg");
    await user.click(within(ficha).getByRole("button", { name: /^Salvar/ }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe("f1");
  });

  it("a busca filtra a lista carregada e o vazio dela fala de BUSCA, não de catálogo vazio", async () => {
    const user = userEvent.setup();
    renderPanel([fil("f1", "PLA Prata"), fil("f2", "PETG Preto", "PETG")]);

    await user.type(screen.getByLabelText(catalogo.searchLabel), "PETG");
    expect(screen.getAllByTestId("master-item")).toHaveLength(1);

    await user.clear(screen.getByLabelText(catalogo.searchLabel));
    await user.type(screen.getByLabelText(catalogo.searchLabel), "zzz");
    expect(screen.queryByTestId("master-item")).not.toBeInTheDocument();
    expect(screen.getByText(catalogo.searchEmptyTitle)).toBeInTheDocument();
    // O vazio do CATÁLOGO diria outra coisa — e seria mentira sobre os dados do vendedor.
    expect(screen.queryByText(catalogo.emptyFilamentsTitle)).not.toBeInTheDocument();
  });

  it("a seleção é derivada da lista atual: filtrar o item aberto não deixa ficha órfã", async () => {
    const user = userEvent.setup();
    renderPanel([fil("f1", "PLA Prata"), fil("f2", "PETG Preto", "PETG")]);

    await user.click(screen.getAllByTestId("master-item")[1]); // abre PETG
    await user.type(screen.getByLabelText(catalogo.searchLabel), "PLA");

    const ficha = screen.getByTestId("detail-panel");
    expect(within(ficha).getByRole("heading", { name: "PLA Prata" })).toBeInTheDocument();
    expect(within(ficha).queryByRole("heading", { name: "PETG Preto" })).not.toBeInTheDocument();
  });

  it("produto/kit: a ficha RESUME e manda para o editor de página cheia (não recompõe o formulário)", async () => {
    const user = userEvent.setup();
    const onEditNavigate = vi.fn();
    const prod = { id: "p1", name: "Vaso G" } as ProductOut;
    render(
      <CatalogPanel<ProductOut, never>
        list={{
          items: [prod],
          isLoading: false,
          isError: false,
          error: null,
          stale: false,
          refetch: vi.fn(),
        }}
        copy={{ ...copy, addLabel: catalogo.addProduct }}
        feature="products"
        gate="active"
        detailKicker={catalogo.detailProduct}
        rowName={(p) => p.name}
        rowSummary={() => "42 g"}
        onCreateNavigate={vi.fn()}
        onEditNavigate={onEditNavigate}
        remove={vi.fn().mockResolvedValue({})}
        deleting={false}
      />,
    );

    const ficha = screen.getByTestId("detail-panel");
    // Nenhum campo de formulário na ficha de produto — o formulário completo continua na página.
    expect(within(ficha).queryByLabelText(/^Nome/i)).not.toBeInTheDocument();
    await user.click(within(ficha).getByRole("button", { name: catalogo.detailOpenEditor }));
    expect(onEditNavigate).toHaveBeenCalledWith(prod);
  });

  it("abaixo do corte NADA disso existe — é a lista de hoje", () => {
    mm.setWidth(VIEWPORT.belowCut);
    cleanup();
    renderPanel([fil("f1", "PLA Prata")]);

    expect(screen.queryByTestId("master-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-panel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(catalogo.searchLabel)).not.toBeInTheDocument();
  });
});
