import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/**
 * 018/US5 — a preferência do menu recolhido, POR APARELHO.
 *
 * Molde deliberadamente idêntico ao `theme-store.ts` (mesmo `createJSONStorage`, mesmo
 * `partialize`) com **uma** diferença registrada: aqui não existe script de pré-paint em
 * `index.html`. O tema precisa de um porque pintar a cor errada por um quadro é visível e
 * desagradável; um menu que aparece expandido por um quadro e recolhe não pinta nada de errado.
 *
 * Não é preferência de conta: não viaja entre aparelhos, não vai para o servidor (research §G).
 */
export const NAV_RAIL_STORAGE_KEY = "precifica3d-nav-rail";

interface NavRailState {
    collapsed: boolean;
    toggle: () => void;
    setCollapsed: (collapsed: boolean) => void;
}

/**
 * `localStorage` que pode não existir — navegador em modo privado, armazenamento bloqueado. Uma
 * LEITURA pode funcionar e a ESCRITA falhar, então a sonda escreve de verdade. Sem armazenamento,
 * `persist` roda em memória e o menu abre expandido: é degradação, não erro, e não mostra aviso.
 */
function safeStorage(): StateStorage | undefined {
    try {
        if (typeof localStorage === "undefined") return undefined;
        const probe = `${NAV_RAIL_STORAGE_KEY}::probe`;
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
        return localStorage;
    } catch {
        return undefined;
    }
}

export const useNavRailStore = create<NavRailState>()(
    persist(
        (set, get) => ({
            collapsed: false,
            toggle: () => set({ collapsed: !get().collapsed }),
            setCollapsed: (collapsed) => set({ collapsed }),
        }),
        {
            name: NAV_RAIL_STORAGE_KEY,
            // `createJSONStorage` trata uma EXCEÇÃO do getter como "sem armazenamento" e devolve
            // `undefined`, que o `persist` entende. Devolver `undefined` daqui, ao contrário, seria
            // entregar um objeto morto para ele chamar `setItem` em cima — foi exatamente assim que a
            // primeira versão deste arquivo estourou `TypeError` na aba privada, e o teste pegou.
            storage: createJSONStorage((): StateStorage => {
                const storage = safeStorage();
                if (!storage) throw new Error("armazenamento local indisponível");
                return storage;
            }),
            partialize: (s) => ({ collapsed: s.collapsed }),
        },
    ),
);
