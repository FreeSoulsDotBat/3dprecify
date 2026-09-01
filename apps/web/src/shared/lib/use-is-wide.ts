import { useEffect, useState } from "react";

// @doc ADR-0031 §Decision — o gate estrutural: acima dele monta o mestre-detalhe das telas.
export const WIDE_QUERY = "(min-width: 1280px)"; // 1280: ~960px após a sidebar (dono, 2026-08-10)

// @doc DEC-001 — recolhe por necessidade, sem botão de expandir: expandir devolveria o transbordo.
export const RAIL_FORCADO_QUERY = "(max-width: 599px)"; // 426–599: 240px de menu deixam ~150px

// @doc ADR-0031 §Emenda 2 — só o layout da Calculadora; mesmo número que LIST_DENSE, outra decisão.
export const CALC_WIDE_QUERY = "(min-width: 1024px)"; // 1024: onde `.tf-calc-grid` vira 2 colunas

// @doc ADR-0031 §Emenda 2 — só a densidade da lista do Catálogo; em 1280px o mestre-detalhe assume.
export const LIST_DENSE_QUERY = "(min-width: 1024px)"; // 1024–1279: `tf-table` no lugar dos cards

// ⚠ @doc ADR-0031 §Option C — sem `matchMedia` responde `false`, e é isso que segura o jsdom no
//   ramo mobile: abaixo do limiar não existe caminho de render para a composição desktop.
function useMediaQuery(query: string): boolean {
    const read = () =>
        typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia(query).matches
            : false;
    const [matches, setMatches] = useState<boolean>(read);
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        // Lê uma vez no efeito: entre o primeiro render e o commit a janela pode ter mudado.
        onChange();
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, [query]);
    return matches;
}

export function useIsWide(): boolean {
    return useMediaQuery(WIDE_QUERY);
}

export function useRailForcado(): boolean {
    return useMediaQuery(RAIL_FORCADO_QUERY);
}

export function useIsCalcWide(): boolean {
    return useMediaQuery(CALC_WIDE_QUERY);
}

export function useIsListDense(): boolean {
    return useMediaQuery(LIST_DENSE_QUERY);
}
