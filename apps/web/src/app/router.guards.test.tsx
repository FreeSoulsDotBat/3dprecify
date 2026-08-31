// @vitest-environment jsdom
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/shared/api/transport";
import { type SessionStatus } from "@/shared/session/session-store";

import { routeTree } from "./router";

// Builds a router over the REAL route tree (guards included) with an injected auth
// status + start location, then runs the router load so every `beforeLoad` guard
// fires exactly as it would in the app. `router.load()` follows internal redirects,
// so `router.state.location` is the final (post-guard) location. No component is
// rendered here — this exercises the guard contract, not the pages.
type SearchWithRedirect = { redirect?: string };

async function loadAt(status: SessionStatus, path: string) {
    const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [path] }),
        context: { status },
    });
    await router.load();
    return router;
}

function redirectParam(search: unknown): string | undefined {
    return (search as SearchWithRedirect).redirect;
}

// ---- T034 / US2 — guard contract (routes.md GC-1..GC-4) -------------------------
// 007/US7 (2026-07-10): /catalogo left the guarded set — a signed-out user must SEE the honest
// premium teaser there (spec US7 scenario 2, ux §2.2), never a bounce. Writes stay server-gated
// (GC-5); the product create/edit FULL PAGE routes remain guarded.
describe("router auth guards (T034 / US2)", () => {
    // 009/US5 (2026-07-13): /historico left the guarded set for the same reason /catalogo and /kits
    // did — a signed-out seller must SEE the honest teaser on the tab, never a bounce. The SNAPSHOT
    // DETAIL and the product create/edit routes stay guarded — there is nothing to teach a
    // signed-out visitor at those URLs.
    //
    // /conta is a plain guarded route (no old→new migration) — the redirect target is itself.
    const guarded = ["/conta"] as const;

    it.each(guarded)(
        "GC-2: an unauthenticated user hitting %s is sent to /sign-in?redirect=<path>",
        async (path) => {
            const router = await loadAt("anonymous", path);
            expect(router.state.location.pathname).toBe("/sign-in");
            expect(redirectParam(router.state.location.search)).toBe(path);
        },
    );

    it.each(guarded)(
        "GC-2: a not-configured (no Firebase) user hitting %s is still sent to /sign-in",
        async (path) => {
            const router = await loadAt("not-configured", path);
            expect(router.state.location.pathname).toBe("/sign-in");
            expect(redirectParam(router.state.location.search)).toBe(path);
        },
    );

    // 013/F-02 (D1=A) — REVISED 016/T072-A4 (2026-08-07): these are the OLD 2-segment URLs
    // (`base:'./'` blanked them on cold-load — the reason they're migrated at all, see
    // router.tsx). They no longer carry their OWN auth check: they translate the URL shape
    // unconditionally, and the NEW `?produto=`/`?snapshot=` route they land on gates auth itself.
    // A signed-out visitor is still sent to `/sign-in` — but with the NEW shape as the return
    // target, not the old pathname. This is a DELIBERATE behavior change, not a relaxed guard: the
    // old pathname was never in `safeRedirect`'s whitelist, so a genuinely signed-out visitor
    // opening an old bookmarked 2-segment URL used to sign in and land on `/calcular`, silently
    // losing the id — MEASURED (T072-A4). The new target round-trips correctly (T020/T072-A4 e2e).
    describe("old 2-segment URLs still gate auth, via the NEW shape's target (T072-A4)", () => {
        it("GC-2: /historico/csid-1 (anonymous) is sent to /sign-in?redirect=/historico?snapshot=csid-1", async () => {
            const router = await loadAt("anonymous", "/historico/csid-1");
            expect(router.state.location.pathname).toBe("/sign-in");
            expect(redirectParam(router.state.location.search)).toBe("/historico?snapshot=csid-1");
        });

        it("GC-2: /catalogo/produtos/novo (anonymous) is sent to /sign-in?redirect=/catalogo?produto=novo", async () => {
            const router = await loadAt("anonymous", "/catalogo/produtos/novo");
            expect(router.state.location.pathname).toBe("/sign-in");
            expect(redirectParam(router.state.location.search)).toBe("/catalogo?produto=novo");
        });
    });

    // /conta has no new-URL migration — it stays a plain guarded route, reached directly.
    it("an authenticated user reaches /conta directly", async () => {
        const router = await loadAt("authenticated", "/conta");
        expect(router.state.location.pathname).toBe("/conta");
    });

    // ---- 013/T021 — old→new redirect, id preserved (F-02 / D1=A) -----------------------------
    // The old 2-segment routes remain reachable (a stale bookmark/shared link), but an
    // authenticated visitor is now forwarded to the NEW query-param URL — never left on the old
    // shape, which is exactly the one `base:'./'` blanks on a future cold-load/refresh of THAT url.
    describe("old→new redirect preserves the id (T021)", () => {
        it("/historico/:snapshotId → /historico?snapshot=:snapshotId", async () => {
            const router = await loadAt("authenticated", "/historico/csid-1");
            expect(router.state.location.pathname).toBe("/historico");
            expect(router.state.location.search).toEqual({ snapshot: "csid-1" });
        });

        it("/catalogo/produtos/novo → /catalogo?produto=novo", async () => {
            const router = await loadAt("authenticated", "/catalogo/produtos/novo");
            expect(router.state.location.pathname).toBe("/catalogo");
            expect(router.state.location.search).toEqual({ produto: "novo" });
        });

        it("/catalogo/produtos/:productId → /catalogo?produto=:productId", async () => {
            const router = await loadAt("authenticated", "/catalogo/produtos/prod-1");
            expect(router.state.location.pathname).toBe("/catalogo");
            expect(router.state.location.search).toEqual({ produto: "prod-1" });
        });
    });

    // ---- 013/F-02 — the NEW URLs carry the SAME auth gate the old 2-segment routes had, for a
    // direct/cold hit (not just via the redirect above) -----------------------------------------
    describe("the new query-param URLs carry the same gate directly (F-02)", () => {
        it("GC-2: /catalogo?produto=novo (anonymous) is sent to /sign-in", async () => {
            const router = await loadAt("anonymous", "/catalogo?produto=novo");
            expect(router.state.location.pathname).toBe("/sign-in");
        });

        it("GC-2: /historico?snapshot=csid-1 (anonymous) is sent to /sign-in", async () => {
            const router = await loadAt("anonymous", "/historico?snapshot=csid-1");
            expect(router.state.location.pathname).toBe("/sign-in");
        });

        it("an authenticated user reaches /catalogo?produto=novo directly", async () => {
            const router = await loadAt("authenticated", "/catalogo?produto=novo");
            expect(router.state.location.pathname).toBe("/catalogo");
            expect(router.state.location.search).toEqual({ produto: "novo" });
        });

        it("an authenticated user reaches /historico?snapshot=csid-1 directly", async () => {
            const router = await loadAt("authenticated", "/historico?snapshot=csid-1");
            expect(router.state.location.pathname).toBe("/historico");
            expect(router.state.location.search).toEqual({ snapshot: "csid-1" });
        });
    });

    it("GC-1: /calcular renders for an anonymous user (public)", async () => {
        const router = await loadAt("anonymous", "/calcular");
        expect(router.state.location.pathname).toBe("/calcular");
    });

    it("US7: /catalogo renders for an anonymous user (the honest teaser, never a bounce)", async () => {
        const router = await loadAt("anonymous", "/catalogo");
        expect(router.state.location.pathname).toBe("/catalogo");
    });

    // 008/US5 (ADR-0015) + K1 (R8 D-K1): /kits is public like /catalogo — a signed-out user must
    // SEE the honest premium teaser there (never a bounce); the composer gates on the server
    // entitlement in-page. The route is /kits (user vocabulary); the code module stays pages/bom.
    it("US5(008/K1): /kits matches a real route for an anonymous user (teaser, never a bounce)", async () => {
        const router = await loadAt("anonymous", "/kits");
        expect(router.state.location.pathname).toBe("/kits");
        expect(router.state.matches.some((m) => m.routeId === "/kits")).toBe(true);
    });

    it("US5(008/K1): an authenticated user reaches /kits directly (gate is in-page, server-informed)", async () => {
        const router = await loadAt("authenticated", "/kits");
        expect(router.state.matches.some((m) => m.routeId === "/kits")).toBe(true);
    });

    it("US5(009): /historico renders for an anonymous user (the honest teaser, never a bounce)", async () => {
        const router = await loadAt("anonymous", "/historico");
        expect(router.state.location.pathname).toBe("/historico");
        expect(router.state.matches.some((m) => m.routeId === "/historico")).toBe(true);
    });

    it("GC-1: /calcular renders when Firebase is not configured (offline-friendly)", async () => {
        const router = await loadAt("not-configured", "/calcular");
        expect(router.state.location.pathname).toBe("/calcular");
    });

    it("the index `/` redirects to /calcular with no auth gate", async () => {
        const router = await loadAt("anonymous", "/");
        expect(router.state.location.pathname).toBe("/calcular");
    });
});

// ---- T034 / US2 — return-to-intent (routes.md GC-3 / GC-4) ----------------------
describe("sign-in return-to-intent (T034 / US2)", () => {
    it("GC-4: an already-authenticated user on /sign-in is bounced to the redirect target", async () => {
        const router = await loadAt("authenticated", "/sign-in?redirect=/conta");
        expect(router.state.location.pathname).toBe("/conta");
    });

    it("GC-4: an already-authenticated user on /sign-in without a redirect lands on /calcular", async () => {
        const router = await loadAt("authenticated", "/sign-in");
        expect(router.state.location.pathname).toBe("/calcular");
    });

    // 008/K1: the kit teaser's "Entrar" carries redirect=/kits — the whitelist must honor it, or
    // the post-sign-in landing silently falls back to /calcular (a broken promise).
    it("GC-4(008/K1): /sign-in?redirect=/kits lands the authenticated user on /kits", async () => {
        const router = await loadAt("authenticated", "/sign-in?redirect=/kits");
        expect(router.state.location.pathname).toBe("/kits");
    });

    it("GC-3: an anonymous user stays on /sign-in and the intent is preserved", async () => {
        const router = await loadAt("anonymous", "/sign-in?redirect=/historico");
        expect(router.state.location.pathname).toBe("/sign-in");
        expect(redirectParam(router.state.location.search)).toBe("/historico");
    });

    // E6/T016 finding (coordinator-reported HIGH defect): a cold/transient bounce off a guarded
    // route that carries its OWN query (`/conta?checkout=retorno`, MP's real `back_url` shape) must
    // round-trip that query through sign-in — losing it silently skips `CheckoutReturnPanel`
    // (US2/US3's whole honesty surface). Failing-first: before the fix, `safeRedirect`/
    // `RETURN_TO_INTENT` only ever saw/restored the PATHNAME.
    it("GC-2/GC-4 (E6/T016): a guarded route's OWN query round-trips through the sign-in bounce", async () => {
        const guardedWithQuery = await loadAt("anonymous", "/conta?checkout=retorno");
        expect(guardedWithQuery.state.location.pathname).toBe("/sign-in");
        expect(redirectParam(guardedWithQuery.state.location.search)).toBe(
            "/conta?checkout=retorno",
        );

        const backHome = await loadAt(
            "authenticated",
            `/sign-in?redirect=${encodeURIComponent("/conta?checkout=retorno")}`,
        );
        expect(backHome.state.location.pathname).toBe("/conta");
        expect(backHome.state.location.search).toEqual({ checkout: "retorno" });
    });

    // The open-redirect guard still holds: an UNKNOWN pathname is never restored, query or not.
    it("GC-2/GC-4 (E6/T016): an unknown pathname with a query still falls back to /calcular", async () => {
        const router = await loadAt(
            "authenticated",
            `/sign-in?redirect=${encodeURIComponent("//evil.example?x=1")}`,
        );
        expect(router.state.location.pathname).toBe("/calcular");
    });
});

// ---- T036 / US2 — GC-5: the server stays the boundary (regression of /me 401) ---
// Client guards are UX only. A protected request without valid auth must still be
// rejected: the client cannot fabricate credentials, and the server's 401 surfaces
// as a typed ApiError (never a raw code to the user). Mirrors the backend contract
// in backend/tests/test_me.py::test_me_without_token_is_401.
describe("server is the boundary — GC-5 (T036 / regression of /me 401)", () => {
    const meEnvelope = {
        error: {
            code: "UNAUTHENTICATED",
            message: "Missing bearer token",
            correlationId: "corr-me-401",
        },
    };

    function stubFetch401() {
        const fetchMock = vi.fn<
            (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
        >(() =>
            Promise.resolve(
                new Response(JSON.stringify(meEnvelope), {
                    status: 401,
                    headers: {
                        "content-type": "application/json",
                        "X-Correlation-Id": "corr-me-401",
                    },
                }),
            ),
        );
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    afterEach(() => vi.unstubAllGlobals());

    it("sends no Authorization header when there is no signed-in user", async () => {
        const fetchMock = stubFetch401();
        await expect(apiFetch("/api/v1/me")).rejects.toBeInstanceOf(ApiError);

        const [, init] = fetchMock.mock.calls[0]!;
        const headers = init?.headers as Headers;
        expect(headers.get("Authorization")).toBeNull();
    });

    it("surfaces the server 401 as a typed ApiError carrying code + correlationId", async () => {
        stubFetch401();
        const error = await apiFetch("/api/v1/me").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
        expect((error as ApiError).code).toBe("UNAUTHENTICATED");
        expect((error as ApiError).correlationId).toBe("corr-me-401");
    });
});
