// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 019/PR-C (T052/T058) — a dispensa do selo, POR APARELHO e ATÉ A FONTE MUDAR (decisão do dono
// 2026-08-26). Molde idêntico a `nav-rail-store.test.ts` (018/T007): a mesma sonda de escrita, e o
// mesmo caso que importa de verdade é o último — sem armazenamento o app não quebra.

describe("fee-seal-dismiss-store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("começa sem nenhuma chave dispensada", async () => {
    const { useFeeSealDismissStore } = await import("./fee-seal-dismiss-store");
    expect(useFeeSealDismissStore.getState().keys).toEqual([]);
  });

  it("dispensar grava a chave e persiste sob o nome do store", async () => {
    const { useFeeSealDismissStore, dismissFeeSeal, FEE_SEAL_DISMISS_STORAGE_KEY } =
      await import("./fee-seal-dismiss-store");
    dismissFeeSeal("AMAZON::Tabela Amazon::2026-07-28");
    expect(useFeeSealDismissStore.getState().keys).toEqual(["AMAZON::Tabela Amazon::2026-07-28"]);

    const raw = localStorage.getItem(FEE_SEAL_DISMISS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      state: { keys: ["AMAZON::Tabela Amazon::2026-07-28"] },
    });
  });

  it("reidrata o que ficou salvo — recarregar mantém a dispensa (mesma chave some após reload)", async () => {
    const { FEE_SEAL_DISMISS_STORAGE_KEY } = await import("./fee-seal-dismiss-store");
    localStorage.setItem(
      FEE_SEAL_DISMISS_STORAGE_KEY,
      JSON.stringify({ state: { keys: ["AMAZON::Tabela Amazon::2026-07-28"] }, version: 0 }),
    );
    vi.resetModules();
    const { useFeeSealDismissStore } = await import("./fee-seal-dismiss-store");
    expect(useFeeSealDismissStore.getState().keys).toContain("AMAZON::Tabela Amazon::2026-07-28");
  });

  it("uma data (ou citação) diferente é uma chave DIFERENTE — a fonte mudou, o selo volta", async () => {
    const { useFeeSealDismissStore, dismissFeeSeal } = await import("./fee-seal-dismiss-store");
    dismissFeeSeal("AMAZON::Tabela Amazon::2026-07-28");
    expect(useFeeSealDismissStore.getState().keys).not.toContain(
      "AMAZON::Tabela Amazon::2026-08-01",
    );
  });

  it("dispensar a MESMA chave de novo não duplica — só a traz para a frente", async () => {
    const { useFeeSealDismissStore, dismissFeeSeal } = await import("./fee-seal-dismiss-store");
    dismissFeeSeal("A::x::1");
    dismissFeeSeal("B::y::1");
    dismissFeeSeal("A::x::1");
    expect(useFeeSealDismissStore.getState().keys).toEqual(["A::x::1", "B::y::1"]);
  });

  it("guarda as 50 chaves mais recentes — a 51ª empurra a mais antiga para fora", async () => {
    const { useFeeSealDismissStore, dismissFeeSeal } = await import("./fee-seal-dismiss-store");
    for (let i = 0; i < 51; i += 1) dismissFeeSeal(`K::${i}::1`);
    const { keys } = useFeeSealDismissStore.getState();
    expect(keys).toHaveLength(50);
    expect(keys).toContain("K::50::1"); // a mais recente sobrevive
    expect(keys).not.toContain("K::0::1"); // a mais antiga saiu
  });

  it("degrada para memória quando o armazenamento recusa a escrita (aba privada)", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    const { useFeeSealDismissStore, dismissFeeSeal } = await import("./fee-seal-dismiss-store");
    expect(() => dismissFeeSeal("A::x::1")).not.toThrow();
    expect(useFeeSealDismissStore.getState().keys).toEqual(["A::x::1"]);
  });
});
