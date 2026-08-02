// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useHistoryMock, useSyncOutboxMock, useEntitlementMock } = vi.hoisted(() => ({
  useHistoryMock: vi.fn(),
  useSyncOutboxMock: vi.fn(),
  useEntitlementMock: vi.fn(),
}));
vi.mock("@/entities/history/use-history", () => ({
  useHistory: useHistoryMock,
  useSyncOutbox: useSyncOutboxMock,
}));
vi.mock("@/entities/user/use-entitlement", () => ({ useEntitlement: useEntitlementMock }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: unknown; [k: string]: unknown }) => (
    <a {...(rest as object)}>{children as never}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

import { HistoricoPage } from "./historico-page";

// 009/T014 (E4, PR-A) — the honest door, written FAILING-first (US5; E2 US7 / E3 US5 lineage).
//
// A signed-out or free seller opening the Histórico tab must find an EXPLANATION, not a broken
// list — and above all not a FABRICATED SAMPLE ENTRY. A demo row on this particular surface would
// be a fake receipt: the one thing the whole epic exists to make impossible.
//
// The three prohibitions inherited from E2/E3 hold: no price, no availability date, no purchase CTA
// (billing is E6 — a buy button would promise a flow that does not exist, Principle II). And the
// free calculator promise is restated in plain words, because that is what the seller is actually
// worried about when they hit a paywall.

const t = messages.historico;

const emptyList = {
  items: [],
  isLoading: false,
  isError: false,
  stale: false,
  refetch: vi.fn(),
};

function entitlement(status: string | null) {
  return {
    data: status ? { status } : undefined,
    isError: false,
    isLoading: false,
    stale: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSyncOutboxMock.mockReturnValue({ sync: vi.fn(), syncing: false });
  useHistoryMock.mockReturnValue(emptyList);
  useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

afterEach(() => cleanup());

describe("free and signed-out meet an explanation, never a broken list", () => {
  it("free: explains what the Histórico is for — and fabricates NO sample entry", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.getByText(t.teaserBody)).toBeInTheDocument();
    // A demo row here would be a FAKE RECEIPT — the one thing this epic exists to make impossible.
    expect(screen.queryByText(t.quotedValue)).not.toBeInTheDocument();
    // O `/R\$/` cru era um PROXY para "nenhum recibo inventado", e ele funcionava enquanto o teaser
    // não tinha preço nenhum. Com a US7 ele passou a ter o do PLANO, e o proxy pegaria justamente o
    // dinheiro legítimo. A garantia real é mais estreita e continua inteira: todo valor na tela é um
    // dos três preços praticados — qualquer outro seria um registro fabricado.
    for (const n of (document.body.textContent ?? "").match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
  });

  it("signed out: the same honest door, plus a way in", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue(entitlement(null));
    render(<HistoricoPage />);

    expect(screen.getByText(t.teaserTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: messages.signIn.title })).toBeInTheDocument();
  });

  it("o preço é HONESTO (E6/US7) e nada é prometido antes de existir", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    const { container } = render(<HistoricoPage />);
    const text = container.textContent ?? "";

    // A proibição de PREÇO caiu porque a premissa dela caiu: ela dizia "billing is E6", e o E6
    // chegou (PR-A + PR-B na `develop`). O teaser agora mostra o preço REAL e um caminho para
    // assinar — o que era desonesto era prometer uma compra que não existia.
    //
    // O que NÃO caiu, e é o que sobra aqui: só os três números que o produto de fato pratica,
    // nenhuma urgência, nenhum "de/por" riscado (fabricaria um desconto que nunca existiu), e
    // nenhuma promessa de coisa não construída — esta última nunca dependeu de cobrança.
    for (const n of text.match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
    expect(text).not.toMatch(/\b(últimas|só hoje|última chance|aproveite)\b/i);
    expect(text).not.toMatch(/191,88/);
    expect(text).not.toMatch(/\b(em breve|a partir de|lançamento)\b/i);
  });

  it("the free calculator promise is restated in plain words (SC-507/512)", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(screen.getByText(t.teaserFreeNote)).toBeInTheDocument();
  });

  it("LAPSED is NOT teased — a lapsed seller's records are their own data (FR-517)", () => {
    useEntitlementMock.mockReturnValue(entitlement("lapsed"));
    render(<HistoricoPage />);

    expect(screen.queryByText(t.teaserTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
  });
});
