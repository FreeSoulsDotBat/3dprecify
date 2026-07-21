import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/app/app-shell";
import { BomPage } from "@/pages/bom/bom-page";
import { CalcularPage } from "@/pages/calcular/calcular-page";
import { CatalogoPage } from "@/pages/catalogo/catalogo-page";
import { ProdutoPage } from "@/pages/catalogo/produto-page";
import { ContaPage } from "@/pages/conta/conta-page";
import { ErrorPage } from "@/pages/error/error-page";
import { HistoricoPage } from "@/pages/historico/historico-page";
import { SnapshotDetailPage } from "@/pages/historico/snapshot-detail-page";
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
// 008/K1: /kits joins the whitelist — the kit teaser's "Entrar" promises a return there.
const RETURN_TO_INTENT = ["/catalogo", "/kits", "/historico", "/conta"] as const;
type ReturnToIntent = (typeof RETURN_TO_INTENT)[number];

// E6/T016 (coordinator-reported HIGH defect): the intent must carry `pathname + search`, not just
// the pathname — a bounce off `/conta?checkout=retorno` (MP's real `back_url` shape) that loses
// the query silently drops the seller into the ordinary Conta panel instead of the honest
// `CheckoutReturnPanel`. The whitelist check still runs ONLY against the pathname (the
// same-origin/open-redirect guard is unweakened — an unknown pathname is rejected regardless of
// what query it carries); the query, once the pathname clears the whitelist, travels untouched.
function splitPathAndSearch(target: string): { pathname: string; search: string } {
  const qIdx = target.indexOf("?");
  return qIdx === -1
    ? { pathname: target, search: "" }
    : { pathname: target.slice(0, qIdx), search: target.slice(qIdx + 1) };
}

interface SignInLanding {
  to: ReturnToIntent | "/calcular";
  search: Record<string, string>;
}

function safeRedirect(target: string | undefined): SignInLanding {
  if (!target) return { to: "/calcular", search: {} };
  const { pathname, search } = splitPathAndSearch(target);
  if (!RETURN_TO_INTENT.includes(pathname as ReturnToIntent))
    return { to: "/calcular", search: {} };
  return {
    to: pathname as ReturnToIntent,
    search: Object.fromEntries(new URLSearchParams(search)),
  };
}

// GC-2: guarded tabs require an authenticated session. Anything else (anonymous OR
// not-configured) is bounced to /sign-in carrying the return-to-intent (pathname + search,
// T016). Client guards are UX only — the server stays the boundary (GC-5, Principle IV).
function requireAuth(status: SessionStatus, href: string): void {
  if (status !== "authenticated") {
    throw redirect({ to: "/sign-in", search: { redirect: href } });
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
  // `?tab=products` lets the product page land back on the Produtos tab after a save; `?tab=kits`
  // is where a saved kit lands the seller (E3/K2).
  validateSearch: (search: Record<string, unknown>): { tab?: "products" | "kits" } => ({
    tab: search.tab === "products" || search.tab === "kits" ? search.tab : undefined,
  }),
  component: CatalogoPage,
});

// US6/T030 (ux §1.6b): the product create/edit FULL PAGE routes — guarded like /catalogo.
const produtoNovoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo/produtos/novo",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.href),
  component: ProdutoPage,
});

function ProdutoEditRouteComponent() {
  const { productId } = produtoEditRoute.useParams();
  return <ProdutoPage productId={productId} />;
}

const produtoEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalogo/produtos/$productId",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.href),
  component: ProdutoEditRouteComponent,
});

// 008/US5 (ADR-0015) + K1 (R8 D-K1): /kits is PUBLIC like /catalogo — a free/signed-out user
// must SEE the honest premium teaser there, never a bounce. The composer itself gates IN-PAGE on
// the authoritative GET /api/v1/entitlement (`status === active`) — a server-informed guard,
// never a local flag. Route = user vocabulary (Kits); the code module stays pages/bom (K1).
const bomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kits",
  // `?id=<kitId>` reopens a SAVED kit in the composer (E3/PR-B): it reloads the kit's inputs and
  // recomputes the price — no price was ever stored (FR-407). `&copy=1` loads the same inputs as a
  // NEW, unsaved kit (US4 duplicate) — the seller reviews and saves it themselves; nothing is
  // written behind their back.
  validateSearch: (search: Record<string, unknown>): { id?: string; copy?: boolean } => ({
    id: typeof search.id === "string" && search.id ? search.id : undefined,
    copy: search.copy === true || search.copy === "1" ? true : undefined,
  }),
  component: BomPage,
});

// 009/US5: /historico joins /catalogo and /kits as PUBLIC — a signed-out seller must SEE the honest
// teaser on the tab, never a bounce to sign-in. The ledger itself gates IN-PAGE on the authoritative
// entitlement (server-informed, never a local flag), and the server gates every read and write
// regardless (GC-5, Principle IV). The DETAIL route below stays guarded: there is nothing to teach a
// signed-out visitor at a snapshot's URL, and it addresses one specific record.
const historicoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/historico",
  component: HistoricoPage,
});

// 009/T013 — the frozen detail. The URL key is the **clientSnapshotId**, not the server id: it is
// minted on the device at record time and is the only id a still-unsynced record HAS. Keying on the
// server id would make a pending quote unopenable — and it is stable across the sync, so a link
// taken while pending keeps working afterwards.
function SnapshotDetailRouteComponent() {
  const { snapshotId } = snapshotDetailRoute.useParams();
  return <SnapshotDetailPage snapshotId={snapshotId} />;
}

const snapshotDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/historico/$snapshotId",
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.href),
  component: SnapshotDetailRouteComponent,
});

// E6/T013/T015: MP's `back_url` targets `/conta?checkout=retorno` (a 1-segment route — the
// measured `base:'./'` cold-load trap, ux-billing.md §0.4/§10-F5). ContaPage reads `checkout` to
// swap in the honest return surface instead of the normal plan panel.
const contaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/conta",
  validateSearch: (search: Record<string, unknown>): { checkout?: "retorno" } => ({
    checkout: search.checkout === "retorno" ? "retorno" : undefined,
  }),
  beforeLoad: ({ context, location }) => requireAuth(context.status, location.href),
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
      const landing = safeRedirect(search.redirect);
      throw redirect({ to: landing.to, search: landing.search as never });
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
  bomRoute,
  historicoRoute,
  snapshotDetailRoute,
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
