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
  useRecordSnapshot: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/entities/catalog/use-catalog", () => ({ useProducts: useProductsMock }));
vi.mock("@/entities/bom/use-bom", () => ({ useBoms: useBomsMock }));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@/features/history/snapshot-manage", () => ({ SnapshotManageActions: () => null }));
// O EXPORT tem os seus próprios testes (export-sheet.test.tsx / export-quote.test.tsx); aqui ele é
// ruído. "Recalcular hoje" e "comparar com hoje" NÃO são stubados: é exatamente a AUSÊNCIA deles
// que este arquivo prova, e stubá-los provaria só que um stub não renderiza nada.
vi.mock("@/features/history/export-sheet", () => ({ ExportButton: () => null }));
vi.mock("@/shared/fee-catalog", () => ({
  useFeeCatalog: () => ({
    catalog: { catalogVersion: "2026-08-06.1", marketplaces: [] },
    source: "catalog",
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children: unknown; to?: unknown; [k: string]: unknown }) => (
    <a href={typeof to === "string" ? to : "#"} {...(rest as object)}>
      {children as never}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

import type { FrozenSnapshotPayload } from "@/entities/history/frozen-payload";
import type { HistoryItem } from "@/entities/history/outbox";
import { kindLabel, basisCaption } from "@/entities/history/history-format";
import { messages } from "@/shared/i18n/messages.pt-br";

import { SnapshotDetailPage } from "./snapshot-detail-page";

// 019/PR-E · T135 — a varredura da união alargada, no lado que o vendedor LÊ.
//
// Um `kind: "QUOTE"` atravessa as mesmas telas do E4 sem ganhar mecanismo nenhum, e é justamente
// por isso que ele é perigoso aqui: cada leitor que ramificava com um ternário `KIT ? … : peça
// única` passa a MENTIR sobre o orçamento em silêncio, sem quebrar nada. Este arquivo fixa, por
// superfície, o que um orçamento FAZ e o que ele NÃO FAZ — e cada ausência é provada NÃO-VÁCUA
// pelo mesmo teste com um documento SINGLE, onde a coisa aparece.

const t = messages.historico;
const tq = messages.quote;

const QUOTE_PAYLOAD: FrozenSnapshotPayload = {
  schemaVersion: 1,
  kind: "QUOTE",
  modelVersion: "4.2.0",
  catalogVersion: null,
  lines: [
    {
      name: "Vaso",
      quantity: 2,
      unitPrice: "30.00",
      subtotal: "60.00",
      origin: { kind: "PRODUCT", id: "p1", name: "Vaso" },
    },
    { name: "Prato", quantity: 1, unitPrice: "12.00", subtotal: "12.00", origin: null },
  ],
  discount: { mode: "PCT", value: "10.00", amount: "7.20", grossTotal: "72.00" },
  costFloor: "48.00",
  totals: { precoOrcamento: "64.80" },
  provenance: null,
};

const SINGLE_PAYLOAD: FrozenSnapshotPayload = {
  schemaVersion: 1,
  kind: "SINGLE",
  modelVersion: "3.1.0",
  catalogVersion: null,
  breakdown: { material: "42.10" },
  totals: { custoTotal: "180.00", precoVarejo: "275.00", precoAtacado: "230.00" },
  provenance: { kind: "PRODUCT", id: "p1", name: "Vaso G" },
};

function quoteItem(over: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "s-q",
    clientSnapshotId: "csid-q",
    kind: "QUOTE",
    label: "Cliente João",
    headlineTotal: "64.80",
    headlineBasis: "PRECO_ORCAMENTO",
    deviceQuotedAt: "2026-08-10T19:30:00Z",
    syncState: "synced",
    snapshot: {
      id: "s-q",
      clientSnapshotId: "csid-q",
      kind: "QUOTE",
      label: "Cliente João",
      quoteValidityDays: 15,
      deviceQuotedAt: "2026-08-10T19:30:00Z",
      deviceUtcOffsetMinutes: -180,
      modelVersion: "4.2.0",
      payloadSchemaVersion: 1,
      payload: QUOTE_PAYLOAD as unknown as Record<string, unknown>,
      headlineTotal: "64.80",
      headlineBasis: "PRECO_ORCAMENTO",
    },
    entry: null,
    ...over,
  } as unknown as HistoryItem;
}

function singleItem(): HistoryItem {
  return {
    ...quoteItem(),
    id: "s-1",
    clientSnapshotId: "csid-1",
    kind: "SINGLE",
    headlineTotal: "275.00",
    headlineBasis: "PRECO_VAREJO",
    snapshot: {
      ...(quoteItem().snapshot as object),
      kind: "SINGLE",
      modelVersion: "3.1.0",
      payload: SINGLE_PAYLOAD as unknown as Record<string, unknown>,
      headlineTotal: "275.00",
      headlineBasis: "PRECO_VAREJO",
    },
  } as unknown as HistoryItem;
}

function render1(item: HistoryItem) {
  useSnapshotMock.mockReturnValue({
    item,
    isLoading: false,
    isError: false,
    stale: false,
    refetch: vi.fn(),
  });
  return render(<SnapshotDetailPage snapshotId={item.clientSnapshotId} />);
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
  // A origem RESOLVE para o documento SINGLE (é o que faz "Recalcular hoje"/"comparar" existirem
  // ali) — a ausência no orçamento não pode vir de um catálogo vazio.
  useProductsMock.mockReturnValue({ items: [{ id: "p1", name: "Vaso G" }] });
  useBomsMock.mockReturnValue({ items: [] });
  useEntitlementMock.mockReturnValue({ data: { status: "active" }, isLoading: false });
});

afterEach(() => cleanup());

describe("snapshot-detail-page — o orçamento como DOCUMENTO (US16)", () => {
  it("o número grande é o precoOrcamento, com a legenda do orçamento (nunca 'varejo')", () => {
    render1(quoteItem());

    // Duas vezes, e as duas certas: o número do cartão (headlineTotal) e o "Total" do documento —
    // é o MESMO número por construção (VR-503), e vê-los divergir seria o defeito.
    expect(screen.getAllByText("R$ 64,80")).toHaveLength(2);
    expect(screen.getByText(tq.totalSent)).toBeInTheDocument();
    // A legenda anterior era um ternário com varejo por padrão: um orçamento sairia "Preço de varejo".
    expect(screen.queryByText(t.basisRetailCaption)).not.toBeInTheDocument();
  });

  it("itemiza as linhas com quantidade × unitário e o subtotal gravado", () => {
    render1(quoteItem());

    expect(screen.getByText("Vaso")).toBeInTheDocument();
    expect(
      screen.getByText(tq.lineMeta.replace("{n}", "2").replace("{valor}", "R$ 30,00")),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 60,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 12,00")).toBeInTheDocument();
  });

  it("declara bruto → desconto → total (o desconto nunca fica embutido)", () => {
    render1(quoteItem());

    expect(screen.getByText(tq.subtotal)).toBeInTheDocument();
    expect(screen.getByText("R$ 72,00")).toBeInTheDocument();
    expect(screen.getByText(tq.discountLine.replace("{pct}", "10"))).toBeInTheDocument();
    expect(screen.getByText("- R$ 7,20")).toBeInTheDocument();
    expect(screen.getByText(tq.total)).toBeInTheDocument();
  });

  it("'válido até' é TEXTO: a data do registro + os dias da coluna (Q7)", () => {
    render1(quoteItem());

    // 10/08 + 15 dias = 25/08. Nada expira: é uma frase impressa, não um estado.
    expect(screen.getByTestId("quote-document-dates")).toHaveTextContent(
      tq.documentDates.replace("{data}", "10/08/2026").replace("{ate}", "25/08/2026"),
    );
  });

  it("diz que voltar a acompanhar não vale para orçamentos enviados (US17)", () => {
    render1(quoteItem());
    expect(screen.getByText(tq.noUnfixForSent)).toBeInTheDocument();
  });

  it("um documento SINGLE não ganha nada disso — o ramo é do orçamento, não de todo mundo", () => {
    render1(singleItem());
    expect(screen.queryByTestId("quote-document-dates")).not.toBeInTheDocument();
    expect(screen.queryByText(tq.noUnfixForSent)).not.toBeInTheDocument();
    expect(screen.queryByText(tq.subtotal)).not.toBeInTheDocument();
  });
});

describe("US17 — 'Recalcular hoje' e 'comparar com hoje' NÃO valem para um orçamento", () => {
  it("nenhum dos dois botões existe num orçamento", () => {
    render1(quoteItem());

    expect(screen.queryByRole("button", { name: t.recalcAction })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.compareAction })).not.toBeInTheDocument();
  });

  it("NÃO-VÁCUO: os mesmos dois botões existem no documento SINGLE, com a MESMA montagem", () => {
    render1(singleItem());

    expect(screen.getByRole("button", { name: t.recalcAction })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.compareAction })).toBeInTheDocument();
  });
});

describe("historico-page / history-format — o que a LINHA da lista diz", () => {
  it("um orçamento conta ITENS; um kit conta peças; uma peça é peça (nunca os três iguais)", () => {
    expect(kindLabel(quoteItem())).toBe(tq.itemCount.replace("{n}", "2"));
    expect(kindLabel(singleItem())).toBe(t.kindSingle);
  });

  it("um orçamento de UM item usa o singular da prancheta", () => {
    const um = quoteItem();
    const payload = { ...QUOTE_PAYLOAD, lines: [QUOTE_PAYLOAD.lines![0]!] };
    expect(
      kindLabel({
        ...um,
        snapshot: { ...(um.snapshot as object), payload } as never,
      } as HistoryItem),
    ).toBe(tq.itemCountOne);
  });

  it("a legenda da base do orçamento não é a do varejo", () => {
    expect(basisCaption("PRECO_ORCAMENTO")).toBe(tq.totalSent);
    expect(basisCaption("PRECO_VAREJO")).toBe(t.basisRetailCaption);
    expect(basisCaption("PRECO_ATACADO")).toBe(t.basisWholesaleCaption);
  });
});
