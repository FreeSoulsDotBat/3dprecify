// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Transport hardening (a/b/c). A signed-in Firebase user is mocked so the origin-allowlist
// test can prove the token IS attached same-origin and is NOT attached cross-origin — with
// the real null `auth` (Firebase unconfigured in tests) no token attaches either way, so the
// assertion would be vacuous.
vi.mock("@/shared/lib/firebase", () => ({
  auth: { currentUser: { getIdToken: vi.fn(async () => "test-token-123") } },
}));

// Assert the Sentry wiring without a live DSN / network (mirrors sentry.test.ts).
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  breadcrumbsIntegration: vi.fn(() => ({ name: "Breadcrumbs" })),
}));

import * as Sentry from "@sentry/react";

import { ApiError, apiFetch, apiFetchFile } from "./transport";

type FetchInit = RequestInit & { signal: AbortSignal };
type MockFetch = (url: string, init?: RequestInit) => Promise<Response>;

// The transport's timeout is 15s; the timeout test advances exactly that far.
const REQUEST_TIMEOUT_TEST_MS = 15_000;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---- (a) malformed body → ApiError with the REAL status ---------------------------------
describe("transport — malformed response body (hardening a)", () => {
  it("normalises a JSON-typed body that fails to parse into an ApiError with the real status", async () => {
    // A 502 that claims JSON but returns an HTML error page (gateway/proxy failure).
    const fetchMock = vi.fn(
      async () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "application/json", "X-Correlation-Id": "corr-502" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const err = await apiFetch("/api/v1/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "UNKNOWN", correlationId: "corr-502" });
    // Reported to Sentry like any other transport failure.
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.captureException).mock.calls[0]![0]).toBeInstanceOf(ApiError);
  });
});

// ---- (b) timeout → status-0 ApiError -----------------------------------------------------
describe("transport — request timeout (hardening b)", () => {
  it("aborts a hung request after 15s into a status-0 UNKNOWN ApiError", async () => {
    vi.useFakeTimers();
    // A hang that only settles when its signal aborts (what real fetch does on abort).
    const fetchMock = vi.fn(
      (_url: string, init: FetchInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const settled = apiFetch("/api/v1/me").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_TEST_MS);
    const err = await settled;

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: "UNKNOWN" });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

// ---- (c) origin allowlist for the Authorization header ------------------------------------
describe("transport — Authorization origin allowlist (hardening c)", () => {
  it("attaches the token for the API origin but never for a foreign absolute URL", async () => {
    const fetchMock = vi.fn<MockFetch>(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Same-origin: a relative path resolves against VITE_API_BASE_URL → token attached.
    await apiFetch("/api/v1/me");
    const sameOrigin = new Headers(fetchMock.mock.calls[0]![1]?.headers);
    expect(sameOrigin.get("Authorization")).toBe("Bearer test-token-123");

    // Foreign absolute origin → NO token leaks.
    await apiFetch("https://evil.example.com/steal");
    const foreign = new Headers(fetchMock.mock.calls[1]![1]?.headers);
    expect(foreign.get("Authorization")).toBeNull();
  });
});

// ---- server-rendered files (009/T028, ADR-0020) -------------------------------------------
// The export artifacts are BINARY and authenticated. Both facts are why this entry point exists:
// `res.text()` decodes bytes as UTF-8 and silently corrupts a PDF, and a plain `<a href>` would
// fetch without the ID token. What must not be lost in the binary path is the ERROR envelope — a
// lapse answers 403 with JSON, and the call site needs that `code` to say "Premium pausado" instead
// of a generic failure.
describe("transport — apiFetchFile (server-rendered artifacts)", () => {
  const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

  it("returns the bytes VERBATIM as a Blob, with the filename the server chose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<MockFetch>(
        async () =>
          new Response(PDF_BYTES, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "Content-Disposition": 'attachment; filename="orcamento.pdf"',
            },
          }),
      ),
    );

    const file = await apiFetchFile("/api/v1/history/s1/quote.pdf");

    expect(file.filename).toBe("orcamento.pdf");
    expect(file.blob).toBeInstanceOf(Blob);
    // Byte-for-byte: the whole point. A text round-trip would mangle any non-UTF-8 sequence.
    expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("no Content-Disposition ⇒ a null filename, never a guess", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<MockFetch>(
        async () => new Response(PDF_BYTES, { status: 200, headers: { "content-type": "application/pdf" } }),
      ),
    );

    expect((await apiFetchFile("/api/v1/history/s1/quote.pdf")).filename).toBeNull();
  });

  it("a 403 still parses the JSON envelope — the lapse keeps its code (FR-515)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<MockFetch>(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "ENTITLEMENT_REQUIRED",
                message: "Premium required",
                correlationId: "corr-403",
              },
            }),
            { status: 403, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const err = await apiFetchFile("/api/v1/history/s1/quote.pdf").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "ENTITLEMENT_REQUIRED" });
  });
});
