// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";

// 008/T007 — the honest kit teaser (US5, ux §2): free/lapsed/signed-out at /kits meet the honest
// Premium panel. 016/US1 (T006): rewritten to assert the UNIFIED `PremiumTeaser` (feature=KITS)
// instead of the deleted `BomTeaser`/dialog — same surface, same door, one shared shape now.

const { useEntitlementMock, useProductsMock, navigateMock } = vi.hoisted(() => ({
  useEntitlementMock: vi.fn(),
  useProductsMock: vi.fn(),
  navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock, useSearch: () => ({}) };
});
vi.mock("@/entities/bom/use-bom", () => ({
  useBoms: () => ({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  }),
  useCreateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBom: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => useEntitlementMock(),
}));
vi.mock("@/entities/catalog/use-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/catalog/use-catalog")>();
  return { ...actual, useProducts: () => useProductsMock() };
});

import { BomPage } from "./bom-page";

const t = messages.bom;
const tb = messages.billing;
const pt = messages.premiumTeaser.KITS;

function renderAt(status: "authenticated" | "anonymous", plan?: "none" | "lapsed") {
  useSessionStore.setState({ status });
  useEntitlementMock.mockReturnValue({
    data: plan ? { status: plan } : undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useProductsMock.mockReturnValue({
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BomPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("BOM teaser — free account (US5, SC-408) — unified PremiumTeaser (016/US1)", () => {
  // 019/PR-B (T110, DECISÃO 3 do dono 27/08): a parede caiu — quem nunca teve Premium encontra o
  // VAZIO DIDÁTICO (mesma forma do vazio de quem paga, frase mais longa) com o composer vivo por
  // baixo, não mais o `PremiumTeaser` cheio. O convite único da tela migrou para dentro do vazio.
  it("shows the vazio didático (kits) with the composer alive, not the old full-screen teaser", () => {
    renderAt("authenticated", "none");
    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    expect(screen.getByText(messages.catalogo.didaticoKitsBody)).toBeInTheDocument();
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
    // O composer está vivo por baixo do vazio — compor não é mais bloqueado, só "Salvar".
    expect(screen.getByRole("button", { name: new RegExp(t.addLine) })).toBeInTheDocument();
  });

  it("o preço é HONESTO (E6/US7); nenhuma data prometida, nenhuma compra fingida", () => {
    renderAt("authenticated", "none");
    for (const n of (document.body.textContent ?? "").match(/\d+[.,]\d{2}/g) ?? []) {
      expect(["15,99", "12,99", "155,88"]).toContain(n);
    }
    expect(document.body.textContent).not.toMatch(/191,88/);
    // Signed-in free: the CTA leads to the offer directly — no /sign-in redirect.
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta).toHaveAttribute("href", "/conta?assinar=1");
  });

  it("a LAPSED account is NOT teased — composer alive; with 0 linhas, vazio didático (FR-409/DECISÃO 3)", () => {
    // PR-A parked this: nothing was saveable then, so lapsed fell through to the teaser. Now that
    // kits persist, a lapse freezes WRITES without repossessing the seller's work — so the teaser
    // (which sells the feature to someone who never had it) is the wrong door.
    // 019/PR-B (T110, DECISÃO 3): a parede de CRIAÇÃO para lapsed caiu junto — o composer monta
    // igual ao grátis; com 0 linhas o vazio didático é a única superfície (o Salvar só existe
    // com ≥1 linha, ver o teste abaixo).
    renderAt("authenticated", "lapsed");
    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    expect(screen.queryByText(t.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.save })).not.toBeInTheDocument();
  });

  it("com ≥1 linha, 'Salvar' fica VISÍVEL+desabilitado — nunca ausente (T046 detalhe 3, inverte o antigo)", () => {
    // O teste antigo asserava `queryByRole("button", {name: t.save})` AUSENTE porque a parede de
    // criação nem deixava o composer montar. Agora que ele monta, adicionar uma peça revela o
    // rodapé de Salvar — visível, desabilitado, com o convite "Reativar Premium" (32e).
    renderAt("authenticated", "lapsed");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.addLine) }));
    const save = screen.getByRole("button", { name: t.save });
    expect(save).toBeInTheDocument();
    expect(save).toBeDisabled();
    expect(screen.getByText(messages.premiumTeaser.salvarFazParteDoPremium)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tb.reactivateAction })).toBeInTheDocument();
  });
});

describe("BOM teaser — signed-out (US5, ux §2.2) — unified PremiumTeaser (016/US1)", () => {
  it("shows the same vazio didático, with the sign-in path embedded in the CTA", () => {
    renderAt("anonymous");
    // 019/PR-B (T110, DECISÃO 3): a parede caiu para o deslogado também — o mesmo vazio didático
    // (não mais o `PremiumTeaser` cheio), com o convite levando ao sign-in.
    expect(screen.queryByText(pt.title)).not.toBeInTheDocument();
    expect(screen.getByTestId("vazio-didatico")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    expect(cta).toHaveAttribute("href", expect.stringContaining("/sign-in?redirect="));
    expect(decodeURIComponent(cta.getAttribute("href") ?? "")).toContain("/conta?assinar=1");
  });

  it("the CTA carries the return-to-intent through sign-in", () => {
    renderAt("anonymous");
    const cta = screen.getByRole("link", { name: tb.subscribeAction });
    fireEvent.click(cta);
    // No fake affordance: nothing here can turn Premium on by itself.
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
