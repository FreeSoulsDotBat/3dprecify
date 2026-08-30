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
// 019/PR-B (T039/T110, prancheta 32f) — a parede caiu: "nunca teve" e deslogado não saltam mais
// para o teaser de página inteira. Ambos ficam na página normal (cabeçalho de sempre) e veem o
// VAZIO DIDÁTICO no lugar da lista — a mesma forma do vazio de quem paga, com a frase mais curta
// e SEM coroa/preço no título. O convite (`TeaserUpgrade`) mora DENTRO do vazio, e continua sendo o
// ÚNICO desta tela (FR-1906) — a garantia é contada pelo link `billing.subscribeAction`, não mais
// pelo `premium-teaser-title` (que não existe nesse caminho).
//
// As três proibições herdadas de E2/E3 continuam de pé: nenhuma linha/entrada de amostra fabricada,
// e a promessa da calculadora grátis segue restatada — agora na frase do vazio didático em vez da
// legenda do `PremiumTeaser`.

const t = messages.historico;
const tb = messages.billing;

const emptyList = {
  items: [],
  isLoading: false,
  isError: false,
  error: null,
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
  it("free: a página normal (cabeçalho de sempre) mostra o vazio didático, e fabrica NENHUMA entrada de amostra", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    // O cabeçalho de sempre — a parede não é mais uma tela substituta.
    expect(screen.getByText(t.title)).toBeInTheDocument();
    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    expect(screen.getByText(t.didaticoTitle)).toBeInTheDocument();
    expect(screen.getByText(t.didaticoBody)).toBeInTheDocument();
    // A demo row here would be a FAKE RECEIPT — the one thing this epic exists to make impossible.
    expect(screen.queryByText(t.quotedValue)).not.toBeInTheDocument();
    for (const n of (document.body.textContent ?? "").match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
  });

  it("free: o botão do vazio é 'Fazer um cálculo' — nunca um formulário de criar (32f)", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(
      screen.getByRole("button", { name: messages.premiumTeaser.fazerUmCalculo }),
    ).toBeInTheDocument();
  });

  it("signed out: a mesma porta sem parede, com o caminho de entrada via o href do próprio CTA", () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    useEntitlementMock.mockReturnValue(entitlement(null));
    render(<HistoricoPage />);

    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta.getAttribute("href")).toContain("/sign-in?redirect=");
  });

  it("exatamente UM convite Premium por tela (FR-1906, invariante um-teaser)", () => {
    useEntitlementMock.mockReturnValue(entitlement("none"));
    render(<HistoricoPage />);

    expect(screen.getAllByRole("link", { name: tb.subscribeAction })).toHaveLength(1);
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

  it("LAPSED is NOT teased — a lapsed seller's records are their own data (FR-517)", () => {
    useEntitlementMock.mockReturnValue(entitlement("lapsed"));
    render(<HistoricoPage />);

    expect(screen.queryByTestId("vazio-didatico")).not.toBeInTheDocument();
    expect(screen.getByText(t.lapsedBanner)).toBeInTheDocument();
  });
});
