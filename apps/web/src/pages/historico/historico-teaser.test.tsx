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

// 009/T014 (E4, PR-A) — the honest door. 016/US1+US2 (T006/T008): rewritten for the unified
// `PremiumTeaser` (feature=QUOTES) and the "Orçamentos" label (renamed from "Histórico").
//
// The three prohibitions inherited from E2/E3 hold: no fabricated sample entry, and the free
// calculator promise is restated (via the shared teaser's caption).

const t = messages.historico;
const tb = messages.billing;
const pt = messages.premiumTeaser.QUOTES;

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
  it("free: explains what Orçamentos is for — and fabricates NO sample entry", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(screen.getByText(pt.title)).toBeInTheDocument();
    expect(screen.getByText(pt.subtitle)).toBeInTheDocument();
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

  it("signed out: the same honest door, plus a way in via the CTA's own href", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue(entitlement(null));
    render(<HistoricoPage />);

    expect(screen.getByText(pt.title)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");
  });

  it("o preço é HONESTO (E6/US7) e nada é prometido antes de existir", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    const { container } = render(<HistoricoPage />);
    const text = container.textContent ?? "";

    for (const n of text.match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
    expect(text).not.toMatch(/\b(últimas|só hoje|última chance|aproveite)\b/i);
    expect(text).not.toMatch(/191,88/);
    expect(text).not.toMatch(/\b(em breve|a partir de|lançamento)\b/i);
  });

  it("the free calculator promise is restated (SC-507/512, via the shared teaser's caption)", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(screen.getByText(pt.caption)).toBeInTheDocument();
  });

  it("LAPSED is NOT teased — a lapsed seller's records are their own data (FR-517)", () => {
    useEntitlementMock.mockReturnValue(entitlement("lapsed"));
    render(<HistoricoPage />);

    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
  });
});
