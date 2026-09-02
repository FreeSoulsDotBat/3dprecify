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
import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useThemeStore } from "@/shared/ui/theme-store";

import { TopBar } from "./top-bar";

afterEach(() => cleanup());

// A minimal router so TopBar's `useRouterState` has a real pathname (calcular vs sign-in)
// without pulling in the full app-shell/session/firebase wiring.
function makeRouter(isMobile: boolean, initialPath: string) {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                <TopBar isMobile={isMobile} />
                <Outlet />
            </>
        ),
    });
    const paths = ["/calcular", "/sign-in"] as const;
    const children = paths.map((path) =>
        createRoute({
            getParentRoute: () => rootRoute,
            path,
            component: () => <main>page {path}</main>,
        }),
    );
    return createRouter({
        routeTree: rootRoute.addChildren(children),
        history: createMemoryHistory({ initialEntries: [initialPath] }),
    });
}

describe("TopBar logo (E1 items 6 / 7b / 4)", () => {
    it("renders the full horizontal lockup on desktop", async () => {
        render(<RouterProvider router={makeRouter(false, "/calcular")} />);
        await screen.findByText("page /calcular");

        const logo = screen.getByRole("img", { name: messages.appName });
        // 016/US3 — the full lockup is the owner's PNG artwork now, not the `tf-lockup` SVG.
        expect(logo.getAttribute("src")).toContain("logo-full");
    });

    it("renders the compact mark on mobile (≤425px)", async () => {
        render(<RouterProvider router={makeRouter(true, "/calcular")} />);
        await screen.findByText("page /calcular");

        const logo = screen.getByRole("img", { name: messages.appName });
        expect(logo.getAttribute("src")).toContain("tf-symbol");
    });

    it("suppresses the redundant masthead logo on /sign-in (the card keeps the only logo)", async () => {
        render(<RouterProvider router={makeRouter(false, "/sign-in")} />);
        await screen.findByText("page /sign-in");

        expect(screen.queryByRole("img", { name: messages.appName })).not.toBeInTheDocument();
        // The rest of the chrome (theme toggle) still renders.
        expect(screen.getByRole("button", { name: messages.theme.toggle })).toBeInTheDocument();
    });
});

// 019/T023 — guarda anti-regressão da marca (V0 item 11: já correto; a guarda é o que impede o
// lockup SVG reconstruído em fonte substituta de voltar — prancheta 24g: "a arte real, com a
// tipografia da marca, não o lockup reconstruído"). Três fatos, os três estruturais.
describe("019/T023 — a marca é a arte real", () => {
    const SRC = join(__dirname, "..", "..");
    const files = walk(SRC).filter((f) => !/\.(test|spec)\.tsx?$/.test(f));

    it("o wordmark é logo-full-{white,black}.png nos DOIS temas", async () => {
        for (const [theme, art] of [
            ["dark", "logo-full-white.png"],
            ["light", "logo-full-black.png"],
        ] as const) {
            useThemeStore.setState({ theme });
            render(<RouterProvider router={makeRouter(false, "/calcular")} />);
            await screen.findByText("page /calcular");
            expect(
                screen.getByRole("img", { name: messages.appName }).getAttribute("src"),
            ).toContain(art);
            cleanup();
        }
    });

    it("nenhum arquivo de produto cita `tf-lockup`", () => {
        const hits = files.filter((f) => readFileSync(f, "utf8").includes("tf-lockup"));
        expect(hits.map((f) => relative(SRC, f))).toEqual([]);
    });

    it("<Logo> só é montado na barra de topo e no cartão de entrada", () => {
        const hits = files
            .filter((f) => f.endsWith(".tsx") && /<Logo[\s/>]/.test(readFileSync(f, "utf8")))
            .map((f) => relative(SRC, f).replace(/\\/g, "/"))
            .sort();
        expect(hits).toEqual(["features/auth/sign-in-screen.tsx", "widgets/top-bar/top-bar.tsx"]);
    });
});

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(tsx?|css)$/.test(p)) out.push(p);
    }
    return out;
}
