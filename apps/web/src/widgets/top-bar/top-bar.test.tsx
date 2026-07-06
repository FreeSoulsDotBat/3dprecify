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
    expect(logo.getAttribute("src")).toContain("tf-lockup");
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
