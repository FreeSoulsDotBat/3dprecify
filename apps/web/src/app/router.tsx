import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/app/app-shell";
import { CalcularPage } from "@/pages/calcular/calcular-page";
import { CatalogoPage } from "@/pages/catalogo/catalogo-page";
import { ContaPage } from "@/pages/conta/conta-page";
import { ErrorPage } from "@/pages/error/error-page";
import { HistoricoPage } from "@/pages/historico/historico-page";
import { NotFoundPage } from "@/pages/not-found/not-found-page";
import { SignInPage } from "@/pages/sign-in/sign-in-page";
import { type SessionStatus } from "@/shared/session/session-store";

// Auth state the router needs (fed from the session store via RouterProvider
// context in main.tsx). Kept for the US2 guards; NO guards are wired in this slice
// (T024) — every surface is reachable. `/calcular` becoming public and the guarded
// tabs land in US2 (T037–T039).
export interface RouterContext {
  status: SessionStatus;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

// `/` → `/calcular` (path redirect, not an auth guard).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/calcular" });
  },
});

const calcularRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calcular",
  component: CalcularPage,
});

const catalogoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo",
  component: CatalogoPage,
});

const historicoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/historico",
  component: HistoricoPage,
});

const contaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conta",
  component: ContaPage,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  calcularRoute,
  catalogoRoute,
  historicoRoute,
  contaRoute,
  signInRoute,
]);

export const router = createRouter({
  routeTree,
  context: { status: "loading" },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
