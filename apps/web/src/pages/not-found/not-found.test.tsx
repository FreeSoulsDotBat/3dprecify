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
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { NotFoundPage } from "./not-found-page";

afterEach(() => cleanup());

// Renders NotFoundPage inside a minimal router so its <Link> resolves. The branded 404 must
// offer a real way back to Calcular (SS-2 / NAV-4) — this proves the way-back is a working link.
async function renderNotFound() {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const home = createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: NotFoundPage,
    });
    const calculate = createRoute({
        getParentRoute: () => rootRoute,
        path: "/calcular",
        component: () => <main>calcular</main>,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([home, calculate]),
        history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);
    await screen.findByText(messages.notFound.title);
}

describe("NotFoundPage (T050 / US4 — SS-2)", () => {
    it("renders the branded not-found title and body", async () => {
        await renderNotFound();
        expect(screen.getByText(messages.notFound.title)).toBeInTheDocument();
        expect(screen.getByText(messages.notFound.body)).toBeInTheDocument();
    });

    it("offers a way back to Calcular", async () => {
        await renderNotFound();
        const back = screen.getByRole("link", { name: messages.notFound.back });
        expect(back).toBeInTheDocument();
        expect(back.getAttribute("href")).toContain("/calcular");
    });
});
