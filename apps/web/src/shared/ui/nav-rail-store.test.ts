// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 018/T007 — a preferência do rail. O caso que interessa de verdade é o último: sem armazenamento
// o app não pode quebrar, e o menu abre expandido em silêncio.

describe("nav-rail-store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("começa expandido", async () => {
    const { useNavRailStore } = await import("./nav-rail-store");
    expect(useNavRailStore.getState().collapsed).toBe(false);
  });

  it("alterna e persiste sob a chave do aparelho", async () => {
    const { useNavRailStore, NAV_RAIL_STORAGE_KEY } = await import("./nav-rail-store");
    useNavRailStore.getState().toggle();
    expect(useNavRailStore.getState().collapsed).toBe(true);

    const raw = localStorage.getItem(NAV_RAIL_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({ state: { collapsed: true } });
  });

  it("reidrata o que ficou salvo — recarregar mantém o menu recolhido", async () => {
    const { NAV_RAIL_STORAGE_KEY } = await import("./nav-rail-store");
    localStorage.setItem(
      NAV_RAIL_STORAGE_KEY,
      JSON.stringify({ state: { collapsed: true }, version: 0 }),
    );
    vi.resetModules();
    const { useNavRailStore } = await import("./nav-rail-store");
    expect(useNavRailStore.getState().collapsed).toBe(true);
  });

  it("setCollapsed é idempotente", async () => {
    const { useNavRailStore } = await import("./nav-rail-store");
    useNavRailStore.getState().setCollapsed(true);
    useNavRailStore.getState().setCollapsed(true);
    expect(useNavRailStore.getState().collapsed).toBe(true);
  });

  it("degrada para memória quando o armazenamento recusa a escrita (aba privada)", async () => {
    // A LEITURA funciona e a ESCRITA falha — é assim que o modo privado quebra de verdade, e é por
    // isso que a sonda do store escreve em vez de só checar se `localStorage` existe.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    const { useNavRailStore } = await import("./nav-rail-store");
    expect(useNavRailStore.getState().collapsed).toBe(false);
    expect(() => useNavRailStore.getState().toggle()).not.toThrow();
    expect(useNavRailStore.getState().collapsed).toBe(true);
  });
});
