// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { installMatchMedia, VIEWPORT } from "@/shared/lib/match-media.test-helper";
import { useThemeStore } from "@/shared/ui";

import { AccountPage } from "./conta-page";

// 018/T045 — a Conta no desktop.
//
// O caso que mais importa é o ÚLTIMO: no mobile o controle de tema continua sendo o interruptor de
// hoje. O clarify do dono foi explícito, e é o único ponto em que a spec do 018 se contradizia.

// O padrão da casa (conta.test.tsx, bom-teaser.test.tsx): a página monta FORA de um RouterProvider,
// então os hooks de roteador entram dublados. Sem isto, `useSearch` estoura em "stores" de null.
// 019/PR-A — a intenção `?assinar=1` dos teasers entra por aqui (variável hoisted: o dublê é fixo, o
// valor não).
const search = vi.hoisted(() => ({ assinar: undefined as string | undefined }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>();
    return { ...actual, useNavigate: () => vi.fn(), useSearch: () => search };
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

const t = messages.account;

afterEach(cleanup);

describe("Conta — desktop (018/US4)", () => {
    let mm: ReturnType<typeof installMatchMedia>;
    beforeEach(() => {
        mm = installMatchMedia(VIEWPORT.desktopLarge);
        useThemeStore.setState({ theme: "dark" });
    });
    afterEach(() => mm.restore());

    it("o tema vira um controle que NOMEIA as opções, e a ativa é a do store", () => {
        render(<AccountPage />);
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
        render(<AccountPage />);
        await user.click(screen.getByRole("radio", { name: t.themeDark }));
        expect(useThemeStore.getState().theme).toBe("dark");

        await user.click(screen.getByRole("radio", { name: t.themeLight }));
        expect(useThemeStore.getState().theme).toBe("light");
    });

    it("conta grátis recebe a oferta ABERTA na coluna do plano, sem precisar da gaveta", () => {
        render(<AccountPage />);
        // Por PAPEL, não por texto: o `OfferPanel` já nomeia seu próprio `fieldset` com um `<legend>`
        // `sr-only` de mesmo texto — o cartão precisa de um título VISÍVEL, e os dois coexistem
        // legitimamente (um é o nome do grupo de campos, o outro é o cabeçalho do cartão).
        expect(
            screen.getByRole("heading", { name: messages.billing.offerTitle }),
        ).toBeInTheDocument();
    });

    it("o aviso de privacidade aparece com a redação já ratificada (FR-214)", () => {
        render(<AccountPage />);
        expect(screen.getByText(messages.privacy.title)).toBeInTheDocument();
        expect(screen.getByText(messages.privacy.google)).toBeInTheDocument();
    });

    it("abaixo do corte o tema é o INTERRUPTOR de hoje — o mobile não se mexe", () => {
        mm.setWidth(VIEWPORT.belowCut);
        cleanup();
        render(<AccountPage />);
        expect(screen.queryByRole("radiogroup", { name: t.themeLabel })).not.toBeInTheDocument();
        expect(screen.getByRole("switch")).toBeInTheDocument();
        // …e a oferta volta a ser assunto da gaveta.
        expect(screen.queryByText(messages.billing.offerTitle)).not.toBeInTheDocument();
    });
});

// 019/PR-A — dívida do 018 achada pelo e2e (billing-offer-geometry / billing-teasers em chromium):
// no desktop, para quem pode assinar, a oferta já mora na coluna (`#tf-conta-oferta`); chegar por um
// teaser (`?assinar=1`) abria a GAVETA por cima — a mesma oferta duas vezes (dois preços, dois rádios
// de período), a violação de "um convite por tela" (016/US1) que o botão da linha já evitava.
describe("Conta — desktop, chegando por um teaser (?assinar=1)", () => {
    let mm: ReturnType<typeof installMatchMedia>;
    beforeEach(() => {
        mm = installMatchMedia(VIEWPORT.desktopLarge);
        search.assinar = "1";
    });
    afterEach(() => {
        mm.restore();
        search.assinar = undefined;
    });

    it("a oferta aparece UMA vez — na coluna, sem gaveta por cima", () => {
        render(<AccountPage />);
        expect(document.getElementById("tf-conta-oferta")).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        // a medida do e2e: 2 rádios de período por oferta; a duplicata dava 4
        expect(document.querySelectorAll('input[name="tf-billing-period"]')).toHaveLength(2);
    });
});
