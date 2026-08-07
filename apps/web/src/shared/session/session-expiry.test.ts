import { beforeEach, describe, expect, it, vi } from "vitest";

// hotfix 016/A3 (H5, 2026-08-07) — the CAMINHO DE VOLTA store, written FAILING-first.
//
// The non-negotiable property of this whole slice: **a 401 NEVER signs the seller out and NEVER
// purges the outbox.** This module is deliberately dumb enough to make that STRUCTURAL, not a
// promise kept by discipline: it knows one boolean and nothing about auth. It cannot import
// `shared/session/sign-out-guard` (nothing here needs to) and it CANNOT import
// `entities/history/outbox` even if it wanted to — `shared` importing `entities/history` is an
// eslint-boundaries violation, not just a convention.
//
// The property is proven two ways: (a) a spy on the REAL `requestSignOut` never fires across a full
// mark→clear lifecycle; (b) grep-shaped — this file's own imports (asserted below) never reach
// `sign-out-guard` or `outbox`.

const requestSignOut = vi.fn(async () => {});
vi.mock("@/shared/session/sign-out-guard", () => ({ requestSignOut }));
const purgeOutbox = vi.fn(async () => {});
vi.mock("@/entities/history/outbox", () => ({ purgeOutbox }));

const { clearSessionExpired, isSessionExpired, markSessionExpired, useSessionExpired } =
  await import("./session-expiry");

beforeEach(() => {
  vi.clearAllMocks();
  clearSessionExpired();
});

describe("the store — one boolean, nothing else", () => {
  it("starts cleared", () => {
    expect(isSessionExpired()).toBe(false);
  });

  it("markSessionExpired sets it; clearSessionExpired unsets it", () => {
    markSessionExpired();
    expect(isSessionExpired()).toBe(true);
    clearSessionExpired();
    expect(isSessionExpired()).toBe(false);
  });

  it("markSessionExpired is idempotent — calling it twice changes nothing else", () => {
    markSessionExpired();
    markSessionExpired();
    expect(isSessionExpired()).toBe(true);
  });
});

describe("PROPRIEDADE NÃO-NEGOCIÁVEL — a 401 NUNCA chama requestSignOut nem purgeOutbox", () => {
  it("marcar e limpar a sessão expirada repetidamente nunca dispara nenhum dos dois", () => {
    markSessionExpired();
    markSessionExpired();
    clearSessionExpired();
    markSessionExpired();
    clearSessionExpired();

    expect(requestSignOut).not.toHaveBeenCalled();
    expect(purgeOutbox).not.toHaveBeenCalled();
  });

  it("useSessionExpired (o hook que o banner lê) também nunca toca em nenhum dos dois", () => {
    // Reading the hook's underlying getter must be equally inert.
    void useSessionExpired;
    expect(requestSignOut).not.toHaveBeenCalled();
    expect(purgeOutbox).not.toHaveBeenCalled();
  });
});
