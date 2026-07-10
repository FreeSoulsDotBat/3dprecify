import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/app/app-shell";
import { CalcularPage } from "@/pages/calcular/calcular-page";
import { CatalogoPage } from "@/pages/catalogo/catalogo-page";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { ContaPage } from "@/pages/conta/conta-page";
import { ErrorPage } from "@/pages/error/error-page";
import { HistoricoPage } from "@/pages/historico/historico-page";
import { NotFoundPage } from "@/pages/not-found/not-found-page";
import { PrivacidadePage } from "@/pages/privacidade/privacidade-page";
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

// 007/US7 (2026-07-10): /catalogo is PUBLIC — a signed-out user must SEE the honest premium
// teaser there (spec US7 scenario 2, ux §2.2), never a bounce. Writes stay server-gated (GC-5);
// the product create/edit routes below remain auth-guarded.
const catalogoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo",
  // `?tab=products` lets the product page land back on the Produtos tab after a save.
  validateSearch: (search: Record<string, unknown>): { tab?: "products" } => ({
    tab: search.tab === "products" ? "products" : undefined,
  }),
  component: CatalogoPage,
});

// US6/T030 (ux §1.6b): the product create/edit FULL PAGE routes — guarded like /catalogo.
const produtoNovoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo/produtos/novo",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.pathname),
  component: ProdutoPage,
});

function ProdutoEditRouteComponent() {
  const { productId } = produtoEditRoute.useParams();
  return <ProdutoPage productId={productId} />;
}

const produtoEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo/produtos/$productId",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.pathname),
  component: ProdutoEditRouteComponent,
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

// FR-214 (006): the minimal honest privacy notice — public content, reachable signed-out (like
// /calcular), linked from the sign-in screen. No `beforeLoad` guard.
const privacidadeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacidade",
  component: PrivacidadePage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  calcularRoute,
  catalogoRoute,
  produtoNovoRoute,
  produtoEditRoute,
  historicoRoute,
  contaRoute,
  signInRoute,
  privacidadeRoute,
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
