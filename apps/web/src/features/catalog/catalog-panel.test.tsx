// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FilamentOut } from "@/shared/api/generated";
import { ApiError } from "@/shared/api/transport";
import type { PremiumGate } from "@/shared/billing/premium-gate";
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

// 019/PR-B (T106) — spy real do `toast` para provar ZERO chamadas quando `create`/`update` estão
// ausentes (o toast FALSO da auditoria: `await create?.(body)` não lançava, e caía direto no
// sucesso). `importOriginal` preserva todo o resto do módulo (Sheet/Dialog/EmptyState…) — só o
// `toast` vira espião.
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));
vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return { ...actual, toast: toastSpy };
});

afterEach(() => {
  cleanup();
  toastSpy.mockClear();
});

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
    /** 019/PR-B (T044) — `"active"` por padrão: os testes de CRUD de hoje continuam exercitando
     *  o caminho vivo sem precisar declarar o gate em cada `it`. */
    gate?: PremiumGate;
  } = {},
) {
  const create = opts.create ?? vi.fn().mockResolvedValue({});
  const update = opts.update ?? vi.fn().mockResolvedValue({});
  const remove = opts.remove ?? vi.fn().mockResolvedValue(undefined);
  const gate = opts.gate ?? "active";
  render(
    <CatalogPanel<FilamentOut, FilamentFormValues>
      list={opts.list ?? listState()}
      copy={copy}
      feature="filaments"
      gate={gate}
      rowName={(f) => f.name}
      rowSummary={filamentSummary}
      emptyForm={emptyFilamentForm}
      toFormValues={filamentToForm}
      renderForm={(args) => <FilamentForm {...args} />}
      create={gate === "active" ? (create as (body: unknown) => Promise<unknown>) : undefined}
      update={
        gate === "active" ? (update as (id: string, body: unknown) => Promise<unknown>) : undefined
      }
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

  // 019/PR-F (T098) — a ressalva `staleHint` por linha ("pode estar desatualizada") saiu do ramo
  // mobile também; só resta a faixa única "Modo leitura offline" no topo do painel.
  it("offline (stale): a faixa única aparece, e a linha do mobile não repete o aviso por item", () => {
    renderPanel({ list: listState({ stale: true }) });
    expect(screen.getByText(catalogo.offlineTitle)).toBeInTheDocument();
    expect(screen.queryByText(catalogo.staleHint)).not.toBeInTheDocument();
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

// 019/PR-B (T037) — o vazio didático substitui a crown/`ENTITLEMENT_REQUIRED` e o vazio curto de
// hoje nos dois ramos que o grátis alcança. Nota: `messages.apiError.entitlementRequired` e
// `messages.premiumTeaser.salvarFazParteDoPremium` são o MESMO texto ("Salvar faz parte do
// Premium.") — então NÃO dá para provar "não é mais a crown" checando ausência desse texto (ele
// aparece de novo, legitimamente, como a frase do rodapé do formulário inerte). A prova estrutural
// é a existência do botão "Adicionar filamento": a crown de hoje nunca teve `action` nenhuma.
describe("CatalogPanel — vazio didático para quem não paga (019/PR-B T037)", () => {
  it("logado sem premium (403 ENTITLEMENT_REQUIRED): vazio didático + Adicionar abre o formulário inerte", async () => {
    renderPanel({
      list: listState({
        items: [],
        isError: true,
        error: new ApiError({
          status: 403,
          code: "ENTITLEMENT_REQUIRED",
          message: "",
          correlationId: null,
        }),
      }),
      gate: "free-nunca-teve",
    });

    const vazio = screen.getByTestId("vazio-didatico");
    expect(within(vazio).getByText(catalogo.emptyFilamentsTitle)).toBeInTheDocument();
    expect(within(vazio).getByText(catalogo.didaticoFilamentsBody)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    const frozen = await screen.findByTestId("catalog-form-frozen");
    expect(frozen.tagName.toLowerCase()).toBe("fieldset");
    expect(frozen).toHaveAttribute("disabled");

    const note = screen.getByTestId("premium-footer-note");
    expect(note).toHaveTextContent(messages.premiumTeaser.salvarFazParteDoPremium);

    const cta = screen.getByTestId("teaser-upgrade-cta");
    expect(cta.className).toContain("tf-btn--secondary");
    expect(cta.closest("fieldset[disabled]")).toBeNull(); // fora do Frozen
    expect(cta).not.toHaveAttribute("aria-disabled");

    const saveBtn = screen.getByRole("button", { name: cf.save });
    expect(saveBtn).toBeVisible();
    expect(saveBtn).toBeDisabled();

    // A frase vem ANTES da linha de botões no DOM.
    expect(note.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Clicar em tudo: zero chamadas de mutação/toast (create/update nem chegam ao painel).
    fireEvent.click(saveBtn);
    fireEvent.click(cta);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("deslogado: lista vazia SEM consulta é o MESMO vazio didático, e o convite leva ao sign-in", async () => {
    renderPanel({
      list: listState({ items: [], isError: false }),
      gate: "signed-out",
    });

    const vazio = screen.getByTestId("vazio-didatico");
    expect(within(vazio).getByText(catalogo.emptyFilamentsTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    const frozen = await screen.findByTestId("catalog-form-frozen");
    expect(frozen).toHaveAttribute("disabled");

    const cta = screen.getByTestId("teaser-upgrade-cta");
    expect(cta.className).toContain("tf-btn--secondary");
    expect(cta.closest("fieldset[disabled]")).toBeNull();
    expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");

    const saveBtn = screen.getByRole("button", { name: cf.save });
    expect(saveBtn).toBeVisible();
    expect(saveBtn).toBeDisabled();
    fireEvent.click(saveBtn);
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

// 019/PR-B (T038) — lapsed com itens: reads completos, SEM a faixa "Premium pausado", e o
// formulário abre PREENCHIDO inerte com a frase de reativação.
describe("CatalogPanel — lapsed com itens (019/PR-B T038)", () => {
  it("mostra os itens sem a faixa lapsed, e editar abre o formulário preenchido com o convite de reativar", async () => {
    renderPanel({ gate: "lapsed" }); // default list já tem filA (PLA Azul)

    expect(screen.getByText("PLA Azul")).toBeInTheDocument();
    expect(screen.queryByText("Premium pausado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${catalogo.edit} PLA Azul` }));

    const frozen = await screen.findByTestId("catalog-form-frozen");
    expect(within(frozen).getByRole("textbox", { name: cf.name })).toHaveValue("PLA Azul");

    expect(screen.getByTestId("premium-footer-note")).toHaveTextContent(catalogo.reactivateBody);
    const cta = screen.getByTestId("teaser-upgrade-cta");
    expect(cta).toHaveTextContent(messages.billing.reactivateAction);
    expect(cta.closest("fieldset[disabled]")).toBeNull();

    const saveBtn = screen.getByRole("button", { name: cf.saveChanges });
    expect(saveBtn).toBeDisabled();
    fireEvent.click(saveBtn);
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

// 019/PR-B (T106, achado 01 da auditoria) — o toast FALSO: um submit programático (bypassando o
// botão desabilitado) não pode gerar um sucesso inventado.
describe("CatalogPanel — sem toast falso quando create/update ausentes (019/PR-B T106)", () => {
  it("primeira camada: sem onSubmit ligado (gate não-active), um submit nativo no <form> não faz nada", async () => {
    renderPanel({ list: listState({ items: [] }), gate: "free-nunca-teve" });
    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));

    const frozen = await screen.findByTestId("catalog-form-frozen");
    const form = frozen.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(toastSpy).not.toHaveBeenCalled();
    expect(screen.getByText(cf.newFilament)).toBeInTheDocument(); // a gaveta continua aberta
  });

  it("segunda camada: gate active mas `create` ausente — handleSubmit não fecha nem avisa sozinho", async () => {
    render(
      <CatalogPanel<FilamentOut, FilamentFormValues>
        list={listState({ items: [] })}
        copy={copy}
        feature="filaments"
        gate="active"
        rowName={(f) => f.name}
        rowSummary={filamentSummary}
        emptyForm={emptyFilamentForm}
        toFormValues={filamentToForm}
        renderForm={(args) => <FilamentForm {...args} />}
        remove={vi.fn().mockResolvedValue(undefined)}
        saving={false}
        deleting={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: catalogo.addFilament }));
    fireEvent.change(field(cf.name), { target: { value: "PETG Preto" } });
    fireEvent.change(field(fields.costPerRoll), { target: { value: "135,00" } });
    fireEvent.change(field(fields.rollWeight), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: cf.save }));

    await waitFor(() => expect(screen.queryByText(cf.newFilament)).toBeInTheDocument());
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
