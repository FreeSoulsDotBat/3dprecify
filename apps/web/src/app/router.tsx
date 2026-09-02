import {
    createRootRouteWithContext,
    createRoute,
    createRouter,
    redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/app/app-shell";
import { BomPage } from "@/pages/bom/bom-page";
import { CalculatePage } from "@/pages/calcular/calcular-page";
import { CatalogPage } from "@/pages/catalogo/catalogo-page";
import { AccountPage } from "@/pages/conta/conta-page";
import { ErrorPage } from "@/pages/error/error-page";
import { HistoryPage } from "@/pages/historico/historico-page";
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
// 013/F-02 (D1=A): `target` is now a full HREF (pathname + optional `?search`), not just a bare
// pathname — `?produto=`/`?snapshot=` carry the id the return-to-intent must preserve, or a
// sign-in round-trip would silently drop it (landing the seller back on a bare `/catalogo`
// instead of the product they asked for). Still an exact-base-or-`base?...` match — the
// open-redirect guard: an external/protocol-relative target never qualifies.
//
// This SUBSUMES the E6/T016 fix (checkout return preserving its query): `/conta?checkout=retorno`
// (MP's real `back_url` shape) matches `"/conta?…"`, so the query travels untouched through
// /sign-in into ContaPage's `CheckoutReturnPanel` — the same mechanism, one implementation. The
// `{to, search}` split T016 introduced is no longer needed; `href` carries the whole internal URL.
function safeRedirect(target: string | undefined): string {
    if (!target) return "/calcular";
    const known = RETURN_TO_INTENT.some((base) => target === base || target.startsWith(`${base}?`));
    return known ? target : "/calcular";
}

// GC-2: guarded tabs require an authenticated session. Anything else (anonymous OR
// not-configured) is bounced to /sign-in carrying the return-to-intent. Client guards
// are UX only — the server stays the boundary (GC-5, Principle IV).
function requireAuth(status: SessionStatus, target: string): void {
    if (status !== "authenticated") {
        throw redirect({ to: "/sign-in", search: { redirect: target } });
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
const calculateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calcular",
    component: CalculatePage,
});

// 007/US7 (2026-07-10): /catalogo is PUBLIC — a signed-out user must SEE the honest premium
// teaser there (spec US7 scenario 2, ux §2.2), never a bounce. Writes stay server-gated (GC-5).
//
// 013/F-02 (D1=A): the product create/edit FULL PAGE routes used to be their OWN 2-segment
// routes (`/catalogo/produtos/novo`, `/catalogo/produtos/$productId`) — a URL shape that
// `base:'./'` blanks on cold-load/refresh/bookmark (the measured trap, see historicoRoute below).
// They now live as a `?produto=` search param on THIS route (same pattern as `/kits?id=`):
// CatalogoPage reads it and renders ProdutoPage inline instead of the tabs. The auth gate that
// used to live on those routes' `beforeLoad` moves here, conditioned on the param being present —
// plain `/catalogo` (no `produto`) stays public exactly as before.
const catalogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/catalogo",
    // `?tab=` selects the catalog tab: the product page lands back on `products` after a save, a saved
    // kit lands the seller on `kits` (E3/K2). ALL FOUR tabs are valid here — the page derives its tab
    // from this param (013/F-02 follow-up), so the two that used to be missing (`filaments`,
    // `printers`) were silently unbookmarkable. `?produto=<id>` opens the edit form for that product;
    // `?produto=novo` opens the create form.
    validateSearch: (
        search: Record<string, unknown>,
    ): { tab?: "filaments" | "printers" | "products" | "kits"; produto?: string } => ({
        tab:
            search.tab === "filaments" ||
            search.tab === "printers" ||
            search.tab === "products" ||
            search.tab === "kits"
                ? search.tab
                : undefined,
        produto: typeof search.produto === "string" && search.produto ? search.produto : undefined,
    }),
    // `location.href` (not just `search.produto`/pathname) so the round-trip through /sign-in
    // preserves the id — a bare pathname would drop it and land the seller back on `/catalogo`
    // with no product open (013 fix: this WAS observed losing the id via `page.goto` e2e, T020).
    beforeLoad: ({ context, search, location }) => {
        if (search.produto) requireAuth(context.status, location.href);
    },
    component: CatalogPage,
});

// ⚠ @doc DEC-006 — estas rotas NÃO checam auth: só traduzem a forma da URL. O gate acontece no
//   destino, cujo alvo o `safeRedirect` reconhece — checar aqui já engoliu o id duas vezes.
const produtoNovoRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/catalogo/produtos/novo",
    beforeLoad: () => {
        throw redirect({ to: "/catalogo", search: { produto: "novo" } });
    },
});

const produtoEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/catalogo/produtos/$productId",
    beforeLoad: ({ params }) => {
        throw redirect({ to: "/catalogo", search: { produto: params.productId } });
    },
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

// ⚠ @doc DEC-100 — `/historico` é PÚBLICA (o deslogado vê o teaser honesto, nunca um bounce), e
//   o gate de auth só existe quando o parâmetro `?snapshot=` está presente.
const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/historico",
    // 009/T013 — the URL key is the **clientSnapshotId**, not the server id: it is minted on the
    // device at record time and is the only id a still-unsynced record HAS. Keying on the server id
    // would make a pending quote unopenable — and it is stable across the sync, so a link taken
    // while pending keeps working afterwards.
    //
    // 019/PR-E (T088) — `?construir=1` opens the quote builder on this same route (same 1-segment
    // shape as `?snapshot=`/`?produto=novo` — the measured `base:'./'` trap this project already
    // documented). Entitlement is gated IN-PAGE (Constitution IV); this only requires a session.
    validateSearch: (
        search: Record<string, unknown>,
    ): { snapshot?: string; construir?: boolean } => ({
        snapshot:
            typeof search.snapshot === "string" && search.snapshot ? search.snapshot : undefined,
        construir: search.construir === true || search.construir === "1" ? true : undefined,
    }),
    // Same `location.href` reasoning as `catalogoRoute` above — preserve the id through /sign-in.
    beforeLoad: ({ context, search, location }) => {
        if (search.snapshot || search.construir) requireAuth(context.status, location.href);
    },
    component: HistoryPage,
});

// 013/F-02: the OLD 2-segment route stays registered as a CLIENT-SIDE REDIRECT for ≥1 release
// (research §2) — it forwards to the new `?snapshot=` URL, preserving the id. Same caveat as the
// catalogo redirects above: this does not by itself fix a cold-load of the OLD URL (the
// hosting-level 301, T024, does). No auth check of its own — same 016/T072-A4 reasoning as
// `produtoEditRoute` above: `historicoRoute`'s own `beforeLoad` gates auth on the NEW shape,
// which is the one `safeRedirect` can actually round-trip.
const snapshotDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/historico/$snapshotId",
    beforeLoad: ({ params }) => {
        throw redirect({ to: "/historico", search: { snapshot: params.snapshotId } });
    },
});

// E6/T013/T015: MP's `back_url` targets `/conta?checkout=retorno` (a 1-segment route — the
// measured `base:'./'` cold-load trap, ux-billing.md §0.4/§10-F5). ContaPage reads `checkout` to
// swap in the honest return surface instead of the normal plan panel.
const accountRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/conta",
    // `assinar=1` e a intencao que os quatro teasers carregam (US7/T032): a oferta nao tem rota
    // propria — o §7.1 nomeia `/assinatura`, que nunca foi construida —, entao ela abre como Sheet
    // aqui. Validado como a `checkout`: qualquer outro valor vira `undefined`, e nada da URL entra na
    // pagina sem passar por esta porta.
    validateSearch: (search: Record<string, unknown>): { checkout?: "retorno"; assinar?: "1" } => ({
        checkout: search.checkout === "retorno" ? "retorno" : undefined,
        assinar: search.assinar === "1" || search.assinar === 1 ? "1" : undefined,
    }),
    beforeLoad: ({ context, location }) => requireAuth(context.status, location.href),
    component: AccountPage,
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
            // `href` (not `to`): the target may carry a query string (`/catalogo?produto=…` or E6's
            // `/conta?checkout=retorno`), which `to` cannot express on its own (it names a ROUTE, not an
            // arbitrary internal URL).
            throw redirect({ href: safeRedirect(search.redirect) });
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
    calculateRoute,
    catalogRoute,
    produtoNovoRoute,
    produtoEditRoute,
    bomRoute,
    historyRoute,
    snapshotDetailRoute,
    accountRoute,
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
