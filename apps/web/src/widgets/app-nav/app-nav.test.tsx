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
import { afterEach, describe, expect, it } from "vitest";

import { AppNav, type AppNavVariant } from "./app-nav";

afterEach(() => cleanup());

// A minimal router whose root hosts the nav + an <Outlet/>; child routes mirror the
// five product sections (008/K1 added Kits). This exercises the real active-route
// derivation (NAV-1) and real router links without pulling in the full app-shell.
function makeRouter(variant: AppNavVariant, initialPath = "/calcular") {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AppNav variant={variant} />
        <Outlet />
      </>
    ),
  });
  const paths = ["/calcular", "/catalogo", "/kits", "/historico", "/conta"] as const;
  const children = paths.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <main>page {path}</main>,
    }),
  );
  const routeTree = rootRoute.addChildren(children);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

function activeLinks(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
}

describe("AppNav (T025 / US1 — NAV-1)", () => {
  it("renders the five sections as a bottom TabBar on mobile, exactly one active (008/K1)", async () => {
    render(<RouterProvider router={makeRouter("tabbar")} />);
    await screen.findByText("page /calcular");

    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Calcular" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Catálogo" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Kits" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Histórico" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Conta" })).toBeInTheDocument();

    const active = activeLinks(nav);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAccessibleName("Calcular");
  });

  it("renders the five sections as a side nav on desktop, exactly one active", async () => {
    render(<RouterProvider router={makeRouter("sidebar")} />);
    await screen.findByText("page /calcular");

    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);

    const active = activeLinks(nav);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAccessibleName("Calcular");
  });

  it("the roving tabstop covers all FIVE items (End jumps to the last section)", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter("tabbar")} />);
    await screen.findByText("page /calcular");

    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    await user.click(within(nav).getByRole("link", { name: "Calcular" }));
    await user.keyboard("{End}");
    expect(within(nav).getByRole("link", { name: "Conta" })).toHaveFocus();
  });

  it("moves the active indicator when the user switches sections", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter("tabbar")} />);
    await screen.findByText("page /calcular");

    await user.click(screen.getByRole("link", { name: "Catálogo" }));
    await screen.findByText("page /catalogo");

    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const active = activeLinks(nav);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAccessibleName("Catálogo");
  });
});
