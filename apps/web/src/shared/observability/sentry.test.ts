// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/shared/api/transport";

import { initObservability, reportError } from "./sentry";

// Mock the Sentry SDK so the wiring is asserted without a live DSN / network.
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  breadcrumbsIntegration: vi.fn(() => ({ name: "Breadcrumbs" })),
}));

// Typed handle on the mocked module.
import * as Sentry from "@sentry/react";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initObservability (T069 / D2) — DSN gating", () => {
  it("is a silent no-op without a DSN", () => {
    const live = initObservability({ dsn: undefined });
    expect(live).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initialises with breadcrumbs (console/network/clicks/history) when a DSN is present", () => {
    const live = initObservability({
      dsn: "https://key@o0.ingest.sentry.io/1",
      environment: "test",
    });
    expect(live).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.breadcrumbsIntegration).toHaveBeenCalledWith({
      console: true,
      dom: true,
      fetch: true,
      xhr: true,
      history: true,
    });
    const initArg = vi.mocked(Sentry.init).mock.calls[0]?.[0];
    expect(initArg).toMatchObject({
      dsn: "https://key@o0.ingest.sentry.io/1",
      environment: "test",
    });
    expect(Array.isArray(initArg?.integrations)).toBe(true);
  });
});

describe("reportError (T069 / D2) — tag hygiene", () => {
  it("forwards defined tags and drops null/undefined ones", () => {
    const err = new Error("boom");
    reportError(err, {
      tags: { code: "INTERNAL", correlationId: null, status: 500, extra: undefined },
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { code: "INTERNAL", status: 500 },
    });
  });

  it("omits the tags context entirely when nothing survives", () => {
    const err = new Error("bare");
    reportError(err, { tags: { correlationId: null } });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
  });
});

describe("transport captureApiError → Sentry wiring (T069 / D2)", () => {
  it("reports a typed ApiError with code + correlationId + status tags on a 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "INTERNAL", message: "kaboom", correlationId: "corr-xyz-9" },
            }),
            { status: 500, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(apiFetch("/api/v1/me")).rejects.toBeInstanceOf(ApiError);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const [captured, context] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect(captured).toBeInstanceOf(ApiError);
    expect(context).toEqual({
      tags: { code: "INTERNAL", correlationId: "corr-xyz-9", status: 500 },
    });
  });
});
