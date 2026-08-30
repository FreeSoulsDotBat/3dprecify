import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/**
 * 019/PR-C (T052/T058, prancheta "Selo de Procedencia" §13a nota) — a dispensa do selo de
 * procedência. Decisão do dono (2026-08-26, verbatim na prancheta): dispensar vale ATÉ A FONTE
 * MUDAR, nunca para sempre — o que foi dispensado é *aquela* procedência conferida (uma citação +
 * uma data), não a ideia de mostrar procedência. Por isso a chave leva a citação e a data: uma
 * tabela que mudou reaparece sozinha, sem o vendedor precisar redescobrir o botão de mostrar.
 *
 * Sem uid — a mesma decisão do `theme-store`/`nav-rail-store` (018/T007): preferência POR
 * APARELHO, não de conta; não viaja entre aparelhos, não vai para o servidor.
 *
 * Molde idêntico a `nav-rail-store.ts`: mesma sonda de escrita (`safeStorage`), porque a LEITURA de
 * `localStorage` pode funcionar com a ESCRITA bloqueada (aba privada) — e é a escrita que precisa
 * falhar alto para o `persist` cair em memória em vez de estourar.
 */
export const FEE_SEAL_DISMISS_STORAGE_KEY = "precifica3d-fee-seal-dismiss";

/** T052 — as 50 chaves mais recentes; dispensar de novo uma chave já presente a traz para a
 *  frente em vez de duplicá-la, então o teto só afeta fontes DISTINTAS dispensadas em sequência. */
const MAX_DISMISSED_KEYS = 50;

interface FeeSealDismissState {
  keys: string[];
  dismiss: (key: string) => void;
}

function safeStorage(): StateStorage | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const probe = `${FEE_SEAL_DISMISS_STORAGE_KEY}::probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return undefined;
  }
}

export const useFeeSealDismissStore = create<FeeSealDismissState>()(
  persist(
    (set, get) => ({
      keys: [],
      dismiss: (key) =>
        set({ keys: [key, ...get().keys.filter((k) => k !== key)].slice(0, MAX_DISMISSED_KEYS) }),
    }),
    {
      name: FEE_SEAL_DISMISS_STORAGE_KEY,
      // `createJSONStorage` trata uma EXCEÇÃO do getter como "sem armazenamento" — devolver
      // `undefined` diretamente entregaria um objeto morto ao `persist` (mesma lição do
      // `nav-rail-store`, 018/T007: sem isso a aba privada estoura `TypeError`).
      storage: createJSONStorage((): StateStorage => {
        const storage = safeStorage();
        if (!storage) throw new Error("armazenamento local indisponível");
        return storage;
      }),
      partialize: (s) => ({ keys: s.keys }),
    },
  ),
);

/** Dispensa um selo pela chave da fonte (`${marketplace}::${source}::${effectiveDate ?? reviewedOn}`). */
export function dismissFeeSeal(key: string): void {
  useFeeSealDismissStore.getState().dismiss(key);
}

/** Reativo: true enquanto a chave estiver entre as dispensadas. */
export function useFeeSealDismissed(key: string): boolean {
  return useFeeSealDismissStore((s) => s.keys.includes(key));
}
