import { useEffect, useState } from "react";

// 019/polish — the uid-keyed device-cache pre-fill effect, extracted from 6 copies
// (entities/{bom,catalog,history×2,scenario,user}) that all did: reset the local state whenever the
// key changes, skip the load while disabled (no uid yet), otherwise load, adopt the result if the
// effect has not been cleaned up, and never let a rejection go unhandled.
//
// 015/A5 ([F08-001]) — o pre-carregamento pode falhar (quota estourada, store corrompido, navegacao
// privada) e a tela sobrevive, porque a consulta online roda de qualquer jeito. O que nao pode e
// falhar em SILENCIO: sem este catch a rejeicao ficava sem tratador, e o vendedor perdia o
// pre-preenchimento e o boot offline sem ninguem ficar sabendo.

/**
 * Pre-fills a piece of state from the uid-keyed offline cache. Resets to `null` whenever `args`
 * changes (so account B never flashes account A's data) and skips the load entirely while
 * `enabled` is false. `warnMessage` is passed verbatim to `console.warn` on a rejected load — each
 * call site keeps its own text.
 */
export function useCachedPreload<T, A extends readonly unknown[]>(
    load: (...args: A) => Promise<T | null>,
    args: A,
    enabled: boolean,
    warnMessage: string,
): T | null {
    const [cached, setCached] = useState<T | null>(null);
    useEffect(() => {
        let cancelled = false;
        setCached(null);
        if (!enabled) return;
        void load(...args)
            .then((value) => {
                if (!cancelled && value) setCached(value);
            })
            .catch((erro: unknown) => {
                console.warn(warnMessage, erro);
            });
        return () => {
            cancelled = true;
        };
    }, args);
    return cached;
}
