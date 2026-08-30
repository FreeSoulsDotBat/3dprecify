import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbGet, idbSet, idbDel } = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  idbDel: vi.fn(),
}));
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet, del: idbDel }));

import {
  entitlementIdbKey,
  loadCachedEntitlement,
  persistCachedEntitlement,
  purgeEntitlementCache,
} from "./entitlement-cache";

// 009/T011b (E4, PR-A) — owner decision 2026-07-13. Written FAILING-first.
//
// ADR-0018 §9 says recording is offered on the LAST-KNOWN SERVER entitlement — "a cached server
// response, never a client-held flag". Until now that cache was React Query's in-memory one, which
// is empty on a cold boot: a premium seller opening the app ALREADY offline (the feira the outbox
// exists for) got the teaser and could not record at all. The offline queue was unreachable exactly
// when it mattered.
//
// This store makes "last-known" survive a restart. It is a persisted SERVER ANSWER, not a client
// flag: nothing here can grant premium — only echo what the server last said. The server remains
// the authority (Principle IV) and still gets the final word at sync (a 403 ⇒ blocked).

beforeEach(() => {
  vi.clearAllMocks();
  idbGet.mockResolvedValue(undefined);
  idbSet.mockResolvedValue(undefined);
  idbDel.mockResolvedValue(undefined);
});

describe("the entitlement cache is uid-keyed, like every persisted thing in this app", () => {
  it("scopes the store by uid so a shared device never grants one account another's premium", () => {
    expect(entitlementIdbKey("u1")).toBe("entitlement:u1");
    expect(entitlementIdbKey("u2")).not.toBe(entitlementIdbKey("u1"));
  });

  it("is swept on sign-out", async () => {
    await purgeEntitlementCache("u1");
    expect(idbDel).toHaveBeenCalledWith("entitlement:u1");
  });
});

describe("it stores only what the SERVER said", () => {
  it("persists a server answer verbatim", async () => {
    await persistCachedEntitlement("u1", { status: "active", source: "beta", expiresAt: null });
    expect(idbSet).toHaveBeenCalledWith("entitlement:u1", {
      status: "active",
      source: "beta",
      expiresAt: null,
    });
  });

  it("survives a failed write — the cache is a convenience, never authoritative", async () => {
    idbSet.mockRejectedValueOnce(new Error("QuotaExceeded"));
    await expect(
      persistCachedEntitlement("u1", { status: "active" } as never),
    ).resolves.toBeUndefined();
  });

  it("reads back the last-known answer", async () => {
    idbGet.mockResolvedValue({ status: "active" });
    await expect(loadCachedEntitlement("u1")).resolves.toEqual({ status: "active" });
  });

  it("DISCARDS a corrupt or foreign shape rather than fabricating a plan", async () => {
    idbGet.mockResolvedValue({ status: "premium-forever" });
    await expect(loadCachedEntitlement("u1")).resolves.toBeNull();

    idbGet.mockResolvedValue("active");
    await expect(loadCachedEntitlement("u1")).resolves.toBeNull();

    idbGet.mockRejectedValue(new Error("boom"));
    await expect(loadCachedEntitlement("u1")).resolves.toBeNull();
  });

  it("accepts only the three statuses the server can actually answer", async () => {
    for (const status of ["none", "active", "lapsed"]) {
      idbGet.mockResolvedValue({ status });
      await expect(loadCachedEntitlement("u1")).resolves.toEqual({ status });
    }
  });
});
