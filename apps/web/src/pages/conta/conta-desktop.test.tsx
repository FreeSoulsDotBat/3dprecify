// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { installMatchMedia, VIEWPORT } from "@/shared/lib/match-media.test-helper";
import { useThemeStore } from "@/shared/ui";

import { ContaPage } from "./conta-page";

// 018/T045 — a Conta no desktop.
//
// O caso que mais importa é o ÚLTIMO: no mobile o controle de tema continua sendo o interruptor de
// hoje. O clarify do dono foi explícito, e é o único ponto em que a spec do 018 se contradizia.

// O padrão da casa (conta.test.tsx, bom-teaser.test.tsx): a página monta FORA de um RouterProvider,
// então os hooks de roteador entram dublados. Sem isto, `useSearch` estoura em "stores" de null.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => vi.fn(), useSearch: () => ({}) };
});

vi.mock("@/entities/user/use-identity", () => ({
  useIdentity: () => ({
    data: { email: "maker@exemplo.com" },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({
    data: { status: "none" },
    isLoading: false,
    isError: false,
    isFetching: false,
    stale: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/features/billing/use-subscription", () => ({
  useSubscription: () => ({ data: undefined, isLoading: false }),
}));

const t = messages.conta;

afterEach(cleanup);

describe("Conta — desktop (018/US4)", () => {
  let mm: ReturnType<typeof installMatchMedia>;
  beforeEach(() => {
    mm = installMatchMedia(VIEWPORT.desktopLarge);
    useThemeStore.setState({ theme: "dark" });
  });
  afterEach(() => mm.restore());

  it("o tema vira um controle que NOMEIA as opções, e a ativa é a do store", () => {
    render(<ContaPage />);
    const grupo = screen.getByRole("radiogroup", { name: t.themeLabel });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: t.themeDark })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: t.themeLight })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("escolher a opção já ativa NÃO alterna o tema (um radio não é um interruptor)", async () => {
    const user = userEvent.setup();
    render(<ContaPage />);
    await user.click(screen.getByRole("radio", { name: t.themeDark }));
    expect(useThemeStore.getState().theme).toBe("dark");

    await user.click(screen.getByRole("radio", { name: t.themeLight }));
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("conta grátis recebe a oferta ABERTA na coluna do plano, sem precisar da gaveta", () => {
    render(<ContaPage />);
    // Por PAPEL, não por texto: o `OfferPanel` já nomeia seu próprio `fieldset` com um `<legend>`
    // `sr-only` de mesmo texto — o cartão precisa de um título VISÍVEL, e os dois coexistem
    // legitimamente (um é o nome do grupo de campos, o outro é o cabeçalho do cartão).
    expect(screen.getByRole("heading", { name: messages.billing.offerTitle })).toBeInTheDocument();
  });

  it("o aviso de privacidade aparece com a redação já ratificada (FR-214)", () => {
    render(<ContaPage />);
    expect(screen.getByText(messages.privacy.title)).toBeInTheDocument();
    expect(screen.getByText(messages.privacy.google)).toBeInTheDocument();
  });

  it("abaixo do corte o tema é o INTERRUPTOR de hoje — o mobile não se mexe", () => {
    mm.setWidth(VIEWPORT.belowCut);
    cleanup();
    render(<ContaPage />);
    expect(screen.queryByRole("radiogroup", { name: t.themeLabel })).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    // …e a oferta volta a ser assunto da gaveta.
    expect(screen.queryByText(messages.billing.offerTitle)).not.toBeInTheDocument();
  });
});
