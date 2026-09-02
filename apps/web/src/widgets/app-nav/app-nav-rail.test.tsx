// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { AppNav } from "./app-nav";

// 018/T013+T014 — o rail colapsável.
//
// O caso que mais importa aqui NÃO é o visual: é o de acessibilidade. O arquivo de design recolhe
// o menu com `display: none` no rótulo, o que apagaria o nome de cada item para leitor de tela.
// Divergimos de propósito (ADR-0031) e este teste é o que impede alguém de "consertar" isso depois.

afterEach(cleanup);

/** Router mínimo que hospeda o menu, com o estado do rail controlado pelo teste. */
function makeRouter(opts: { railable: boolean; initialCollapsed?: boolean }) {
    const rootRoute = createRootRoute({
        component: function Root() {
            const [collapsed, setCollapsed] = useState(opts.initialCollapsed ?? false);
            return (
                <>
                    <AppNav
                        variant="sidebar"
                        collapsed={collapsed}
                        onToggleCollapsed={
                            opts.railable ? () => setCollapsed((v) => !v) : undefined
                        }
                    />
                    <Outlet />
                </>
            );
        },
    });
    const paths = ["/calcular", "/catalogo", "/kits", "/historico", "/conta"] as const;
    const children = paths.map((path) =>
        createRoute({
            getParentRoute: () => rootRoute,
            path,
            component: () => <main>page {path}</main>,
        }),
    );
    return createRouter({
        routeTree: rootRoute.addChildren(children),
        history: createMemoryHistory({ initialEntries: ["/calcular"] }),
    });
}

async function renderNav(opts: { railable: boolean; initialCollapsed?: boolean }) {
    render(<RouterProvider router={makeRouter(opts)} />);
    await screen.findByText("page /calcular");
    return screen.getByRole("navigation", { name: messages.nav.ariaLabel });
}

describe("AppNav — rail colapsável (018/US5)", () => {
    it("sem interruptor, não existe botão de recolher — a sidebar de sempre", async () => {
        const nav = await renderNav({ railable: false });
        expect(within(nav).queryByRole("button")).not.toBeInTheDocument();
        expect(nav).not.toHaveClass("tf-nav--rail");
    });

    it("recolhe e expande, e o botão diz o que o clique VAI fazer", async () => {
        const user = userEvent.setup();
        const nav = await renderNav({ railable: true });

        const recolher = within(nav).getByRole("button", { name: messages.nav.collapse });
        expect(recolher).toHaveAttribute("aria-expanded", "true");

        await user.click(recolher);
        expect(nav).toHaveClass("tf-nav--rail");

        const expandir = within(nav).getByRole("button", { name: messages.nav.expand });
        expect(expandir).toHaveAttribute("aria-expanded", "false");

        await user.click(expandir);
        expect(nav).not.toHaveClass("tf-nav--rail");
    });

    it("recolhido, cada seção CONTINUA se chamando pelo nome (o que se perde é a tela, não a a11y)", async () => {
        const nav = await renderNav({ railable: true, initialCollapsed: true });

        // O nome acessível sobrevive…
        for (const label of [
            messages.nav.calculate,
            messages.nav.catalog,
            messages.nav.kits,
            messages.nav.history,
            messages.nav.account,
        ]) {
            expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
        }

        // …e some da TELA por `sr-only`, nunca por `display:none` (que o apagaria da árvore).
        const catalog = within(nav).getByRole("link", { name: messages.nav.catalog });
        const label = within(catalog).getByText(messages.nav.catalog);
        expect(label).toHaveClass("sr-only");
        expect(label).not.toHaveStyle({ display: "none" });

        // E a dica devolve o nome ao mouse.
        expect(catalog).toHaveAttribute("title", messages.nav.catalog);
    });

    it("o botão de recolher fica FORA da lista — não entra na travessia por setas das seções", async () => {
        const nav = await renderNav({ railable: true });
        const list = within(nav).getByRole("list");
        expect(within(list).queryByRole("button")).not.toBeInTheDocument();
        expect(
            within(nav).getByRole("button", { name: messages.nav.collapse }),
        ).toBeInTheDocument();
    });

    it("recolhido, a travessia por setas continua idêntica e com UM ponto de tabulação", async () => {
        const user = userEvent.setup();
        const nav = await renderNav({ railable: true, initialCollapsed: true });
        const links = within(nav).getAllByRole("link");

        // Um único tabstop: o da seção atual (/calcular = índice 0).
        expect(links.map((l) => l.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);

        links[0].focus();
        await user.keyboard("{ArrowDown}");
        expect(document.activeElement).toBe(links[1]);
        await user.keyboard("{End}");
        expect(document.activeElement).toBe(links[4]);
    });
});
