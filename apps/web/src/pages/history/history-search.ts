import { useSearch } from "@tanstack/react-router";

// 019/Polish — a rota tinha 3 sítios chamando `useSearch({ strict: false })` com shapes diferentes
// (`?snapshot=`, `?construir=1`). Um único tipo-superset (todos os campos opcionais) + um hook fino
// substitui os três casts locais sem mudar nenhum valor lido.
export interface HistorySearch {
    snapshot?: string;
    construir?: boolean;
}

export function useHistorySearch(): HistorySearch {
    return useSearch({ strict: false }) as HistorySearch;
}
