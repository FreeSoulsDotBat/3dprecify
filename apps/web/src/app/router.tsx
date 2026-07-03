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

// Auth state the router needs, fed from the session store via RouterProvider context
// in main.tsx. The guards (US2) read `context.status`; when the session listener flips
// it, main.tsx re-invalidates so `beforeLoad` re-runs (e.g. sign-out on a guarded tab
// → redirect, or sign-in on /sign-in → return-to-intent).
export interface RouterContext {
  status: SessionStatus;
}

// The sign-in return-to-intent target. Only the guarded product sections set it, so we
// whitelist known internal routes: this is both the "same-origin/known" clause of GC-3
// and an open-redirect guard (external / protocol-relative targets fall back to Calcular).
const RETURN_TO_INTENT = ["/catalogo", "/historico", "/conta"] as const;
type ReturnToIntent = (typeof RETURN_TO_INTENT)[number];
type SignInLanding = ReturnToIntent | "/calcular";

function safeRedirect(target: string | undefined): SignInLanding {
  return RETURN_TO_INTENT.includes(target as ReturnToIntent)
    ? (target as ReturnToIntent)
    : "/calcular";
}

// GC-2: guarded tabs require an authenticated session. Anything else (anonymous OR
// not-configured) is bounced to /sign-in carrying the return-to-intent. Client guards
// are UX only — the server stays the boundary (GC-5, Principle IV).
function requireAuth(status: SessionStatus, pathname: string): void {
  if (status !== "authenticated") {
    throw redirect({ to: "/sign-in", search: { redirect: pathname } });
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

// `/` → `/calcular` (path redirect, not an auth gate). The former 001 guard that gated
// `/` behind sign-in is gone — Calcular is public (T038).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/calcular" });
  },
});

// GC-1: public. Renders for anonymous, not-configured, and authenticated — online or
// offline. No `beforeLoad` auth check.
const calcularRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calcular",
  component: CalcularPage,
});

const catalogoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.pathname),
  component: CatalogoPage,
});

const historicoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/historico",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.pathname),
  component: HistoricoPage,
});

const contaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conta",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.pathname),
  component: ContaPage,
});

// GC-3 / GC-4: `/sign-in` carries an optional `redirect` return-to-intent. An already-
// authenticated visitor (or one who just signed in — main.tsx invalidates on the status
// flip) is bounced to that target when known, else to Calcular.
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.status === "authenticated") {
      throw redirect({ to: safeRedirect(search.redirect) });
    }
  },
  component: SignInPage,
});

export const routeTree = rootRoute.addChildren([
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
