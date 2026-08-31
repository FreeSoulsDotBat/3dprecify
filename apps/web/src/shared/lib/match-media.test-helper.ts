/**
 * 018 — auxiliar SÓ para teste: instala um `window.matchMedia` de mentira em jsdom, com uma largura
 * que os testes controlam.
 *
 * Existe porque `useIsWide` responde `false` sem `matchMedia` (ADR-0031): esse silêncio é a garantia
 * de que o mobile não mudou, e o preço dela é que todo teste de DESKTOP precisa dizer, em voz alta,
 * que está numa janela larga.
 *
 * O nome do arquivo NÃO termina em `.test.ts`, então o vitest não o coleta (`include:
 * src/**\/*.test.{ts,tsx}`), e nenhum código de aplicação o importa — ele não entra no bundle.
 */

type Listener = (event: MediaQueryListEvent) => void;

/**
 * Forma MUTÁVEL do nosso `MediaQueryList` de mentira. Não estende `MediaQueryList` de propósito:
 * lá `matches` é `readonly` (o navegador é quem muda), e aqui somos nós. O `as unknown as
 * MediaQueryList` acontece uma vez só, na fronteira em que devolvemos o objeto.
 */
interface FakeMql {
    media: string;
    matches: boolean;
    onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null;
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    addListener: (listener: Listener) => void;
    removeListener: (listener: Listener) => void;
    dispatchEvent: () => boolean;
    __update: (width: number) => void;
}

/** Avalia `(min-width: Npx)` / `(max-width: Npx)` contra uma largura. Ignora o que não reconhece. */
function matchesQuery(query: string, width: number): boolean {
    let result = true;
    const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
    if (min) result &&= width >= Number(min[1]);
    if (max) result &&= width <= Number(max[1]);
    return result;
}

export interface MatchMediaHandle {
    /** Muda a largura e avisa quem estiver ouvindo — como um resize de verdade. */
    setWidth: (width: number) => void;
    /** Devolve o `matchMedia` original (ou remove o que instalamos). */
    restore: () => void;
}

/**
 * Instala o `matchMedia` falso e devolve o controle dele.
 *
 * ```ts
 * const mm = installMatchMedia(1440);
 * afterEach(() => mm.restore());
 * ```
 */
export function installMatchMedia(width: number): MatchMediaHandle {
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    const live = new Set<FakeMql>();
    let current = width;

    function create(query: string): FakeMql {
        const listeners = new Set<Listener>();
        const mql: FakeMql = {
            media: query,
            matches: matchesQuery(query, current),
            onchange: null,
            addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                listeners.add(listener as Listener);
            },
            removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                listeners.delete(listener as Listener);
            },
            addListener: (listener: Listener) => {
                listeners.add(listener);
            },
            removeListener: (listener: Listener) => {
                listeners.delete(listener);
            },
            dispatchEvent: () => true,
            __update: (next: number) => {
                const matches = matchesQuery(query, next);
                if (matches === mql.matches) return;
                mql.matches = matches;
                const event = { matches, media: query } as MediaQueryListEvent;
                listeners.forEach((listener) => listener(event));
                mql.onchange?.call(mql as unknown as MediaQueryList, event);
            },
        };
        live.add(mql);
        return mql;
    }

    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: (query: string) => create(query) as unknown as MediaQueryList,
    });

    return {
        setWidth: (next: number) => {
            current = next;
            live.forEach((mql) => mql.__update(next));
        },
        restore: () => {
            live.clear();
            if (original) Object.defineProperty(window, "matchMedia", original);
            else delete (window as Partial<Window>).matchMedia;
        },
    };
}

/** Larguras nomeadas, para o teste dizer o que quer medir em vez de repetir números mágicos. */
export const VIEWPORT = {
    /** Acima do corte, com folga para a lista em duas colunas (a premissa do desenho). */
    desktopLarge: 1920,
    /** Acima do corte, lista em uma coluna. */
    desktop: 1280,
    /** Um pixel abaixo do corte — a largura que PROVA o limiar. */
    belowCut: 1279,
    /** Mobile homologado. */
    mobile: 390,
} as const;
